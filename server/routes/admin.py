from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.security import generate_password_hash
import json
import os
import re
import secrets

from db.models import db, Group, SchoolClass, SchoolEnrollment, SchoolRoleAssignment, User
from utils.openai_responses import OpenAIResponsesError, create_structured_response, structured_contract_metadata
from utils.student_import import (
    EXPECTED_HEADERS,
    StudentImportError,
    build_column_mapping_schema,
    generate_student_credentials,
    is_expected_format,
    normalize_expected_records,
    normalize_mapped_records,
    parse_csv_document,
    validate_import_students,
)


admin_bp = Blueprint('admin', __name__)
VALID_ACCOUNT_ROLES = {'admin', 'teacher', 'student'}
SCHOOL_ROLE_FOR_ACCOUNT = {
    'admin': 'school-admin',
    'teacher': 'teacher',
    'student': 'student',
}
OPENAI_STUDENT_IMPORT_MODEL = os.getenv('OPENAI_STUDENT_IMPORT_MODEL', os.getenv('OPENAI_MODEL', 'gpt-4o-mini'))


def _current_admin():
    user = User.query.get(int(get_jwt_identity()))
    if not user or not user.is_active or user.account_role != 'admin':
        return None
    return user


def _admin_can_manage_school(admin, group):
    if not admin or not group or group.is_legacy:
        return False
    return SchoolRoleAssignment.query.filter(
        SchoolRoleAssignment.group_id == group.id,
        SchoolRoleAssignment.user_id == admin.id,
        SchoolRoleAssignment.role.in_(('school-admin', 'headteacher')),
    ).first() is not None


def _admin_managed_school_ids(admin):
    if not admin:
        return []
    return [
        assignment.group_id
        for assignment in SchoolRoleAssignment.query.filter(
            SchoolRoleAssignment.user_id == admin.id,
            SchoolRoleAssignment.role.in_(('school-admin', 'headteacher')),
        ).all()
    ]


def _admin_can_manage_account(admin, user):
    if not admin or not user:
        return False
    if user.id == admin.id or user.managed_by_id == admin.id:
        return True
    school_ids = _admin_managed_school_ids(admin)
    if not school_ids:
        return False
    return SchoolRoleAssignment.query.filter(
        SchoolRoleAssignment.user_id == user.id,
        SchoolRoleAssignment.group_id.in_(school_ids),
    ).first() is not None


def _remove_student_from_other_current_schools(user, destination_group):
    assignments = SchoolRoleAssignment.query.filter(
        SchoolRoleAssignment.user_id == user.id,
        SchoolRoleAssignment.role == 'student',
        SchoolRoleAssignment.group_id != destination_group.id,
    ).all()
    for assignment in assignments:
        other_group = Group.query.get(assignment.group_id)
        if not other_group or other_group.is_legacy:
            continue
        if user in other_group.members:
            other_group.members.remove(user)
        SchoolEnrollment.query.filter_by(group_id=other_group.id, student_id=user.id).delete(
            synchronize_session=False
        )
        db.session.delete(assignment)


def _assign_account_to_school(user, group, school_role):
    if school_role == 'student':
        _remove_student_from_other_current_schools(user, group)

    assignment = SchoolRoleAssignment.query.filter_by(group_id=group.id, user_id=user.id).first()
    if assignment:
        assignment.role = school_role
    else:
        db.session.add(SchoolRoleAssignment(group_id=group.id, user_id=user.id, role=school_role))

    if school_role == 'student' and user not in group.members:
        group.members.append(user)
    elif school_role != 'student' and user in group.members:
        group.members.remove(user)


@admin_bp.route('/accounts', methods=['GET'])
@jwt_required()
def list_accounts():
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    school_ids = _admin_managed_school_ids(admin)
    visible_user_ids = {admin.id}
    if school_ids:
        visible_user_ids.update(
            assignment.user_id
            for assignment in SchoolRoleAssignment.query.filter(
                SchoolRoleAssignment.group_id.in_(school_ids)
            ).all()
        )
    visible_user_ids.update(
        user.id for user in User.query.filter_by(managed_by_id=admin.id).all()
    )
    users = User.query.filter(User.id.in_(visible_user_ids)).order_by(User.username.asc()).all()

    assignments = SchoolRoleAssignment.query.filter(
        SchoolRoleAssignment.user_id.in_(visible_user_ids)
    ).all() if visible_user_ids else []
    assignments_by_user = {}
    for assignment in assignments:
        assignments_by_user.setdefault(assignment.user_id, []).append(assignment.to_dict())

    return jsonify({
        'accounts': [
            {
                **user.to_dict(),
                'schoolAssignments': assignments_by_user.get(user.id, []),
            }
            for user in users
        ]
    }), 200


@admin_bp.route('/accounts', methods=['POST'])
@jwt_required()
def create_account():
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    data = request.get_json() or {}
    username = str(data.get('username') or '').strip()
    email = str(data.get('email') or '').strip().lower()
    account_role = str(data.get('accountRole') or '').strip().lower()
    supplied_password = str(data.get('password') or '')
    generated_password = supplied_password or secrets.token_urlsafe(10)

    if not username or not email or account_role not in VALID_ACCOUNT_ROLES:
        return jsonify({'error': 'username, email, and a valid accountRole are required'}), 400
    if len(generated_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Username or email already exists'}), 409

    group = None
    group_id = str(data.get('groupId') or '').strip()
    if group_id:
        group = Group.query.filter_by(group_id=group_id).first()
        if not _admin_can_manage_school(admin, group):
            return jsonify({'error': 'You cannot assign accounts to this school'}), 403

    user = User(
        username=username,
        email=email,
        password=generate_password_hash(generated_password),
        account_role=account_role,
        managed_by_id=admin.id,
        is_active=True,
        first_name=str(data.get('firstName') or '').strip() or None,
        last_name=str(data.get('lastName') or '').strip() or None,
        year_group=str(data.get('yearGroup') or '').strip() or None,
        tutor_group=str(data.get('tutorGroup') or '').strip() or None,
    )
    db.session.add(user)
    db.session.flush()

    if group:
        school_role = str(data.get('schoolRole') or SCHOOL_ROLE_FOR_ACCOUNT[account_role]).strip()
        allowed_school_roles = {'school-admin', 'headteacher'} if account_role == 'admin' else {SCHOOL_ROLE_FOR_ACCOUNT[account_role]}
        if school_role not in allowed_school_roles:
            db.session.rollback()
            return jsonify({'error': 'School role does not match the account type'}), 400
        _assign_account_to_school(user, group, school_role)

    db.session.commit()
    response = {'account': user.to_dict()}
    if not supplied_password:
        response['temporaryPassword'] = generated_password
    return jsonify(response), 201


@admin_bp.route('/accounts/<int:user_id>', methods=['PATCH'])
@jwt_required()
def update_account(user_id):
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Account not found'}), 404
    if not _admin_can_manage_account(admin, user):
        return jsonify({'error': 'You cannot update this account'}), 403

    data = request.get_json() or {}
    if 'username' in data:
        username = str(data.get('username') or '').strip()
        if not re.fullmatch(r'[A-Za-z0-9._-]{3,80}', username):
            return jsonify({'error': 'Username must use 3-80 letters, numbers, dots, hyphens, or underscores'}), 400
        existing_user = User.query.filter(User.username == username, User.id != user.id).first()
        if existing_user:
            return jsonify({'error': 'Username already exists'}), 409
        user.username = username
    if 'email' in data:
        email = str(data.get('email') or '').strip().lower()
        if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email):
            return jsonify({'error': 'A valid email is required'}), 400
        existing_email = User.query.filter(User.email == email, User.id != user.id).first()
        if existing_email:
            return jsonify({'error': 'Email already exists'}), 409
        user.email = email
    if 'isActive' in data:
        user.is_active = bool(data['isActive'])
    if 'accountRole' in data:
        account_role = str(data['accountRole']).strip().lower()
        if account_role not in VALID_ACCOUNT_ROLES:
            return jsonify({'error': 'Invalid account role'}), 400
        user.account_role = account_role
    if data.get('password'):
        password = str(data['password'])
        valid_student_pin = user.account_role == 'student' and re.fullmatch(r'\d{6}', password)
        if len(password) < 8 and not valid_student_pin:
            return jsonify({'error': 'Password must be at least 8 characters, or a 6-digit student password'}), 400
        user.password = generate_password_hash(password)
    profile_fields = {
        'firstName': 'first_name',
        'lastName': 'last_name',
        'yearGroup': 'year_group',
        'tutorGroup': 'tutor_group',
    }
    for payload_key, model_field in profile_fields.items():
        if payload_key in data:
            setattr(user, model_field, str(data.get(payload_key) or '').strip() or None)

    db.session.commit()
    return jsonify({'account': user.to_dict()}), 200


@admin_bp.route('/accounts/<int:user_id>/school', methods=['PUT'])
@jwt_required()
def assign_account_to_school(user_id):
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    data = request.get_json() or {}
    group = Group.query.filter_by(group_id=str(data.get('groupId') or '').strip()).first()
    if not _admin_can_manage_school(admin, group):
        return jsonify({'error': 'You cannot manage this school'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Account not found'}), 404
    if not _admin_can_manage_account(admin, user):
        return jsonify({'error': 'You cannot assign this account'}), 403
    school_role = str(data.get('schoolRole') or SCHOOL_ROLE_FOR_ACCOUNT.get(user.account_role, '')).strip()
    allowed_roles = {'school-admin', 'headteacher'} if user.account_role == 'admin' else {SCHOOL_ROLE_FOR_ACCOUNT.get(user.account_role)}
    if school_role not in allowed_roles:
        return jsonify({'error': 'School role does not match the account type'}), 400

    _assign_account_to_school(user, group, school_role)
    db.session.commit()
    return jsonify({'account': user.to_dict(), 'assignment': SchoolRoleAssignment.query.filter_by(group_id=group.id, user_id=user.id).first().to_dict()}), 200


@admin_bp.route('/students/import/preview', methods=['POST'])
@jwt_required()
def preview_student_import():
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    group = Group.query.filter_by(group_id=str(request.form.get('groupId') or '').strip()).first()
    if not _admin_can_manage_school(admin, group):
        return jsonify({'error': 'Choose a school you can manage'}), 403

    upload = request.files.get('file')
    if not upload or not upload.filename:
        return jsonify({'error': 'Choose a CSV file'}), 400
    raw_bytes = upload.read()
    if len(raw_bytes) > 1_000_000:
        return jsonify({'error': 'CSV files must be 1 MB or smaller'}), 400
    try:
        csv_text = raw_bytes.decode('utf-8-sig')
    except UnicodeDecodeError:
        return jsonify({'error': 'The CSV file must use UTF-8 encoding'}), 400

    try:
        headers, records = parse_csv_document(csv_text)
        normalization_method = 'template'
        notes = []
        if is_expected_format(headers):
            normalized_students = normalize_expected_records(records)
        else:
            sample_rows = records[:5]
            raw_mapping = create_structured_response(
                model=OPENAI_STUDENT_IMPORT_MODEL,
                system_prompt=(
                    'You map school CSV columns into the Inner Performance student import format. '
                    'Return exact source header names only. Use an empty string when a field is unavailable. '
                    'Use either separate first and last name columns or one full name column. Never invent student data.'
                ),
                user_prompt=json.dumps({
                    'task': 'Map this unfamiliar CSV into first name, last name, year group, and tutor group columns.',
                    'sourceHeaders': headers,
                    'sampleRows': sample_rows,
                    'targetHeaders': list(EXPECTED_HEADERS),
                }),
                schema_name='student_csv_column_mapping',
                schema=build_column_mapping_schema(),
                max_output_tokens=700,
            )
            mapped_columns = [
                raw_mapping.get(key)
                for key in ('firstNameColumn', 'lastNameColumn', 'fullNameColumn', 'yearGroupColumn', 'tutorGroupColumn')
                if raw_mapping.get(key)
            ]
            unknown_columns = [column for column in mapped_columns if column not in headers]
            if unknown_columns:
                return jsonify({'error': 'OpenAI returned a column mapping that does not match this file. Try the CSV template instead.'}), 422
            if not raw_mapping.get('fullNameColumn') and not (
                raw_mapping.get('firstNameColumn') and raw_mapping.get('lastNameColumn')
            ):
                return jsonify({'error': 'OpenAI could not identify complete student names. Try the CSV template instead.'}), 422
            normalized_students = normalize_mapped_records(records, raw_mapping)
            normalization_method = 'ai'
            notes = raw_mapping.get('notes') or []

        existing_users = User.query.with_entities(User.username, User.email).all()
        existing_usernames = {row.username for row in existing_users}
        existing_emails = {row.email for row in existing_users}
        students = generate_student_credentials(normalized_students, existing_usernames, existing_emails)
        students, validation_errors = validate_import_students(students, existing_usernames, existing_emails)
        return jsonify({
            'school': {'groupId': group.group_id, 'name': group.name},
            'filename': upload.filename,
            'sourceHeaders': headers,
            'expectedHeaders': list(EXPECTED_HEADERS),
            'normalizationMethod': normalization_method,
            'notes': notes,
            'students': students,
            'validationErrors': validation_errors,
            'contract': (
                structured_contract_metadata('student_csv_column_mapping')
                if normalization_method == 'ai'
                else None
            ),
        }), 200
    except StudentImportError as exc:
        return jsonify({'error': str(exc)}), 400
    except OpenAIResponsesError as exc:
        status_code = 503 if 'OPENAI_API_KEY' in str(exc) else 502
        return jsonify({
            'error': str(exc),
            'templateRequired': status_code == 503,
            'expectedHeaders': list(EXPECTED_HEADERS),
        }), status_code


@admin_bp.route('/students/import', methods=['POST'])
@jwt_required()
def import_students():
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    data = request.get_json() or {}
    group = Group.query.filter_by(group_id=str(data.get('groupId') or '').strip()).first()
    if not _admin_can_manage_school(admin, group):
        return jsonify({'error': 'Choose a school you can manage'}), 403

    existing_users = User.query.with_entities(User.username, User.email).all()
    existing_usernames = {row.username for row in existing_users}
    existing_emails = {row.email for row in existing_users}
    students, validation_errors = validate_import_students(
        data.get('students'),
        existing_usernames,
        existing_emails,
    )
    if validation_errors:
        return jsonify({'error': 'Fix the highlighted rows before importing', 'validationErrors': validation_errors}), 400

    school_classes = SchoolClass.query.filter_by(group_id=group.id).all()
    class_by_tutor_group = {}
    for school_class in school_classes:
        for class_label in (school_class.tutor_group, school_class.name):
            if class_label:
                class_by_tutor_group.setdefault(class_label.strip().lower(), school_class)

    created = []
    try:
        for student in students:
            user = User(
                username=student['username'],
                email=student['email'],
                password=generate_password_hash(student['password']),
                account_role='student',
                managed_by_id=admin.id,
                is_active=True,
                first_name=student['firstName'] or None,
                last_name=student['lastName'] or None,
                year_group=student['yearGroup'] or None,
                tutor_group=student['tutorGroup'] or None,
            )
            db.session.add(user)
            db.session.flush()
            _assign_account_to_school(user, group, 'student')

            matched_class = class_by_tutor_group.get(student['tutorGroup'].lower()) if student['tutorGroup'] else None
            if matched_class:
                db.session.add(SchoolEnrollment(
                    group_id=group.id,
                    class_id=matched_class.id,
                    student_id=user.id,
                ))

            created.append({
                **user.to_dict(),
                'temporaryPassword': student['password'],
                'matchedClass': matched_class.name if matched_class else None,
            })

        db.session.commit()
        return jsonify({
            'message': f'{len(created)} students added to {group.name}',
            'school': {'groupId': group.group_id, 'name': group.name},
            'accounts': created,
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Student import failed: {str(exc)}'}), 500


def _school_students(group):
    assignments = SchoolRoleAssignment.query.filter_by(
        group_id=group.id,
        role='student',
    ).all()
    student_ids = [assignment.user_id for assignment in assignments]
    if not student_ids:
        return []
    return User.query.filter(
        User.id.in_(student_ids),
        User.account_role == 'student',
    ).order_by(
        User.last_name.asc(),
        User.first_name.asc(),
        User.username.asc(),
    ).all()


@admin_bp.route('/schools/<group_id>/students', methods=['GET'])
@jwt_required()
def list_school_students(group_id):
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    group = Group.query.filter_by(group_id=group_id).first()
    if not _admin_can_manage_school(admin, group):
        return jsonify({'error': 'You cannot manage this school'}), 403

    students = _school_students(group)
    return jsonify({
        'school': {'groupId': group.group_id, 'name': group.name},
        'students': [
            {
                **student.to_dict(),
                'schoolAssignments': [{'groupId': group.id, 'role': 'student'}],
            }
            for student in students
        ],
    }), 200


@admin_bp.route('/schools/<group_id>/student-logins', methods=['POST'])
@jwt_required()
def generate_school_student_logins(group_id):
    admin = _current_admin()
    if not admin:
        return jsonify({'error': 'Admin account required'}), 403

    group = Group.query.filter_by(group_id=group_id).first()
    if not _admin_can_manage_school(admin, group):
        return jsonify({'error': 'You cannot manage this school'}), 403

    data = request.get_json() or {}
    if data.get('confirmReset') is not True:
        return jsonify({'error': 'Confirm the password reset before generating a login CSV'}), 400

    students = _school_students(group)
    credentials = []
    for student in students:
        temporary_password = f"{secrets.randbelow(1_000_000):06d}"
        student.password = generate_password_hash(temporary_password)
        credentials.append({
            'firstName': student.first_name or '',
            'lastName': student.last_name or '',
            'username': student.username,
            'email': student.email,
            'temporaryPassword': temporary_password,
            'yearGroup': student.year_group or '',
            'tutorGroup': student.tutor_group or '',
            'isActive': bool(student.is_active),
        })

    db.session.commit()
    response = jsonify({
        'school': {'groupId': group.group_id, 'name': group.name},
        'credentials': credentials,
        'message': f'{len(credentials)} student login passwords regenerated',
    })
    response.headers['Cache-Control'] = 'no-store'
    return response, 200
