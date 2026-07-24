from collections import defaultdict
from flask import Blueprint, jsonify, request, send_from_directory, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from db.models import db, User, Group, GroupChallenge, StudentSchedulePlan, Message, SkillDevelopmentChart, HabitPreset, CoachAssignment, Course, CourseSection, CourseItem, CourseProgress, StudentGoal, SchoolImpactRecord, PerformanceCard, LessonRegister, InterventionRecord, ParentContactRecord, ParentProfile, SchoolAuditLog, SchoolRoleAssignment, SchoolSubject, SchoolRoom, SchoolClass, SchoolEnrollment, SchoolTeachingAssignment, SchoolBehaviourType, SchoolBehaviourEvent, SchoolHomeworkAssignment, SchoolHomeworkSubmission
import uuid
import stripe
import logging
import json
import csv
from io import StringIO
from datetime import datetime, date, timedelta, timezone
import os
import traceback
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.attributes import flag_modified
from werkzeug.utils import secure_filename
from utils.ai_school import (
    RITUO_APP_GUIDE,
    build_student_plan_schema,
    build_copilot_schema,
    build_habit_draft_schema,
    build_daily_schedule_schema,
    normalize_student_plan,
    normalize_copilot_response,
    normalize_habit_draft,
    normalize_daily_schedule,
    build_copilot_action_link,
    build_copilot_system_prompt,
    get_copilot_public_config,
)
from utils.openai_responses import (
    OpenAIResponsesError,
    create_structured_response,
    structured_contract_metadata,
)

groups_bp = Blueprint('groups', __name__)
stripe.api_key = os.getenv('STRIPE_TEST_SECRET_KEY')
logging.info(f"Stripe API key loaded: {'Yes' if stripe.api_key else 'No'}")

ALLOWED_GROUP_TYPES = {'school', 'football'}
ALLOWED_EVIDENCE_EXTENSIONS = {'pdf'}
CHECKPOINT_SLOTS = ('morning', 'midday', 'endOfDay')
VALID_WEEKDAYS = ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
VALID_ENGAGEMENT_COLORS = ('green', 'amber', 'red')
VALID_INTERVENTION_TYPES = ('reflection-session', 'mindset-lesson', 'behaviour-coaching', 'pastoral-follow-up', 'parent-call')
VALID_INTERVENTION_STATUSES = ('scheduled', 'delivered', 'monitoring', 'closed')
VALID_PARENT_CONTACT_TYPES = ('phone-call', 'email', 'meeting', 'text-message')
VALID_SCHOOL_ROLES = ('student', 'teacher', 'headteacher', 'pastoral-lead', 'school-admin', 'coach')
VALID_ATTENDANCE_STATUSES = ('present', 'late', 'absent', 'authorised-absence')
VALID_BEHAVIOUR_KINDS = ('reward', 'sanction', 'referral', 'on-call', 'removal')
VALID_BEHAVIOUR_SEVERITIES = ('low', 'medium', 'high')
VALID_HOMEWORK_TYPES = ('practice', 'essay', 'revision', 'project', 'quiz', 'reading')
VALID_HOMEWORK_COMPLEXITIES = ('low', 'medium', 'high')
VALID_HOMEWORK_STATUSES = ('assigned', 'submitted', 'reviewed', 'late', 'missing')
OPENAI_DEFAULT_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
OPENAI_STUDENT_PLAN_MODEL = os.getenv('OPENAI_STUDENT_PLAN_MODEL', OPENAI_DEFAULT_MODEL)
OPENAI_COPILOT_MODEL = os.getenv('OPENAI_COPILOT_MODEL', OPENAI_DEFAULT_MODEL)
OPENAI_HABIT_DRAFT_MODEL = os.getenv('OPENAI_HABIT_DRAFT_MODEL', OPENAI_DEFAULT_MODEL)
OPENAI_SCHEDULER_MODEL = os.getenv('OPENAI_SCHEDULER_MODEL', OPENAI_DEFAULT_MODEL)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)


def get_group_members_list(group):
    members = group.members if group else []
    return members.all() if hasattr(members, 'all') else list(members or [])


def is_legacy_group_manager(group, user_id):
    return bool(group and getattr(group, 'is_legacy', True) and str(group.leader_id) == str(user_id))


def can_manage_group(group, user_id):
    if not group:
        return False
    if is_legacy_group_manager(group, user_id):
        return True
    if getattr(group, 'is_legacy', True):
        return False
    user = User.query.get(int(user_id))
    if not user or not user.is_active or user.account_role != 'admin':
        return False
    return user_has_school_role(group.id, user.id, {'school-admin', 'headteacher'})


def serialize_group_for_user(group, user_id):
    payload = group.to_dict()
    school_role = get_school_role(group.id, int(user_id))
    payload.update({
        'viewerSchoolRole': school_role,
        'viewerCanManage': can_manage_group(group, user_id),
        'viewerIsLegacyOwner': is_legacy_group_manager(group, user_id),
    })
    return payload


def serialize_school_user_brief(user):
    if not user:
        return None
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'created_at': user.created_at.isoformat() if user.created_at else None,
        'current_cycle_start_date': user.current_cycle_start_date.isoformat() if user.current_cycle_start_date else None,
        'current_cycle_end_date': user.current_cycle_end_date.isoformat() if user.current_cycle_end_date else None
    }


def ensure_member_habit_entry(group, student_id):
    member_habit = get_member_habit_entry(group, student_id)
    if member_habit or not group.active_challenge:
        return member_habit
    challenge = group.active_challenge
    member_habits = list(challenge.member_habits or [])
    member_habit = {
        'member': student_id,
        'habits': [],
        'goalActivity': None,
        'fallbackActivity': 'Reflection session'
    }
    member_habits.append(member_habit)
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    return member_habit


def build_ai_student_context(profile):
    return {
        'student': profile.get('student'),
        'goals': profile.get('goals', []),
        'linkedHabits': profile.get('linkedHabits', []),
        'goalActivity': profile.get('goalActivity'),
        'attendanceSummary': profile.get('attendanceSummary'),
        'homework': {
            'missingCount': profile.get('homework', {}).get('missingCount', 0),
            'dueTodayCount': profile.get('homework', {}).get('dueTodayCount', 0),
            'upcomingCount': profile.get('homework', {}).get('upcomingCount', 0),
            'weeklyPoints': profile.get('homework', {}).get('weeklyPoints', 0),
        },
        'scorecards': {
            'combinedWeeklyScore': profile.get('scorecards', {}).get('combinedWeeklyScore', 0),
            'daily': profile.get('scorecards', {}).get('daily', {}),
            'habitRecovery': profile.get('scorecards', {}).get('habitRecovery', {}),
            'performanceCard': profile.get('scorecards', {}).get('performanceCard', {}),
        },
        'interventions': [
            {
                'interventionType': item.get('interventionType'),
                'status': item.get('status'),
                'dueDate': item.get('dueDate'),
                'summary': item.get('summary'),
                'nextStep': item.get('nextStep'),
            }
            for item in (profile.get('interventions') or [])[:3]
        ],
    }


def apply_ai_student_plan(group, student, normalized_plan, current_user_id):
    StudentGoal.query.filter_by(group_id=group.id, student_id=student.id).delete()
    goal_id_map = {}
    for goal in normalized_plan.get('goals', []):
        goal_record = StudentGoal(
            group_id=group.id,
            student_id=student.id,
            title=goal.get('title'),
            barrier=goal.get('barrier') or None,
            school_goal=goal.get('schoolGoal') or None,
            for_self=goal.get('forSelf') or None,
            for_others=goal.get('forOthers') or None,
            created_by_id=current_user_id
        )
        db.session.add(goal_record)
        db.session.flush()
        goal_id_map[goal.get('key')] = goal_record.id

    warnings = list(normalized_plan.get('warnings') or [])
    member_habit = ensure_member_habit_entry(group, student.id)
    if not member_habit:
        warnings.append('No active challenge is available, so habits and goal activity were not saved.')
        normalized_plan['warnings'] = warnings[:6]
        return normalized_plan

    existing_habits = {
        str(habit.get('name') or '').strip().lower(): habit
        for habit in (member_habit.get('habits') or [])
        if str(habit.get('name') or '').strip()
    }
    next_habits = []
    for index, habit in enumerate(normalized_plan.get('habits') or []):
        linked_goal_id = goal_id_map.get(habit.get('linkedGoalKey'))
        existing_habit = existing_habits.get(str(habit.get('name') or '').strip().lower())
        next_habit = {
            'name': habit.get('name'),
            'description': habit.get('description') or '',
            'habitType': habit.get('habitType') or 'boolean',
            'minValue': habit.get('minValue', 0),
            'maxValue': habit.get('maxValue', 10),
            'prompt': habit.get('prompt') or '',
            'scheduleDays': habit.get('scheduleDays') or [],
            'scheduleTime': habit.get('scheduleTime') or (existing_habit.get('scheduleTime') if existing_habit else ''),
            'durationMinutes': habit.get('durationMinutes') or 20,
            'combatType': habit.get('combatType') or 'neutral',
            'linkedGoalId': linked_goal_id,
            'orderIndex': habit.get('orderIndex', index),
            'progress': list(existing_habit.get('progress') or []) if existing_habit else []
        }
        next_habits.append(next_habit)

    member_habit['habits'] = next_habits
    member_habit['goalActivity'] = normalized_plan.get('goalActivity', {}).get('activity') or None
    member_habit['fallbackActivity'] = normalized_plan.get('goalActivity', {}).get('fallbackActivity') or 'Reflection session'
    flag_modified(group.active_challenge, 'member_habits')

    normalized_plan['warnings'] = warnings[:6]
    return normalized_plan


def build_teacher_copilot_context(group, current_user_id):
    dashboard = build_school_operations_dashboard_fast(group, current_user_id)
    return {
        'overview': dashboard.get('overview', {}),
        'myClassesToday': dashboard.get('myClassesToday', [])[:4],
        'myStudentsAtRisk': dashboard.get('myStudentsAtRisk', [])[:5],
        'overdueInterventions': dashboard.get('overdueInterventions', [])[:5],
        'homeworkWatchlist': dashboard.get('homework', {}).get('watchlist', [])[:5],
        'notifications': (dashboard.get('notifications') or {}).get('items', [])[:5],
    }


def build_copilot_group_context(group, current_user_id):
    members = get_group_members_list(group)
    context = {
        'group': {
            'groupId': group.group_id,
            'name': group.name,
            'groupType': group.group_type or 'school',
        }
    }
    if group.group_type != 'school':
        return context
    if can_view_school_operations(group, current_user_id):
        context['teacherDesk'] = build_teacher_copilot_context(group, current_user_id)
        return context
    current_member = next((member for member in members if member.id == current_user_id), None)
    if current_member:
        context['studentProfile'] = build_ai_student_context(serialize_school_profile(group, current_member))
    return context

def serialize_school_room_brief(room):
    if not room:
        return None
    return {
        'id': room.id,
        'groupId': room.group_id,
        'name': room.name,
        'block': room.block or '',
        'capacity': room.capacity,
        'createdAt': room.created_at.isoformat() if room.created_at else None,
        'updatedAt': room.updated_at.isoformat() if room.updated_at else None
    }


def serialize_school_class_brief(school_class):
    if not school_class:
        return None
    return {
        'id': school_class.id,
        'groupId': school_class.group_id,
        'name': school_class.name,
        'tutorGroup': school_class.tutor_group or '',
        'yearGroup': school_class.year_group or '',
        'roomId': school_class.room_id,
        'room': serialize_school_room_brief(school_class.room),
        'createdAt': school_class.created_at.isoformat() if school_class.created_at else None,
        'updatedAt': school_class.updated_at.isoformat() if school_class.updated_at else None
    }


def serialize_school_subject_brief(subject):
    if not subject:
        return None
    return {
        'id': subject.id,
        'groupId': subject.group_id,
        'name': subject.name,
        'code': subject.code or '',
        'createdAt': subject.created_at.isoformat() if subject.created_at else None,
        'updatedAt': subject.updated_at.isoformat() if subject.updated_at else None
    }


def serialize_lesson_teacher_brief(teacher):
    return serialize_school_user_brief(teacher)


def serialize_intervention_record_brief(record):
    if not record:
        return None
    return {
        'id': record.id,
        'groupId': record.group_id,
        'studentId': record.student_id,
        'staffId': record.staff_id,
        'ownerId': record.owner_id,
        'interventionType': record.intervention_type,
        'status': record.status,
        'interventionDate': record.intervention_date.isoformat() if record.intervention_date else None,
        'dueDate': record.due_date.isoformat() if record.due_date else None,
        'autoCreated': record.auto_created,
        'summary': record.summary or '',
        'nextStep': record.next_step or '',
        'staff': serialize_school_user_brief(record.staff),
        'owner': serialize_school_user_brief(record.owner),
        'createdAt': record.created_at.isoformat() if record.created_at else None,
        'updatedAt': record.updated_at.isoformat() if record.updated_at else None
    }


def serialize_audit_log_brief(record):
    if not record:
        return None
    return {
        'id': record.id,
        'groupId': record.group_id,
        'actorId': record.actor_id,
        'studentId': record.student_id,
        'actionType': record.action_type,
        'entityType': record.entity_type,
        'title': record.title,
        'description': record.description or '',
        'metadata': record.metadata_json or {},
        'actor': serialize_school_user_brief(record.actor),
        'student': serialize_school_user_brief(record.student),
        'createdAt': record.created_at.isoformat() if record.created_at else None
    }


def can_manage_student(group, current_user_id, student_id):
    if not group:
        return False
    if can_manage_group(group, current_user_id):
        return True
    if current_user_id == student_id and any(member.id == student_id for member in group.members):
        return True

    school_role = get_school_role(group.id, current_user_id)
    if school_role == 'pastoral-lead':
        return True

    is_group_coach = any(coach.id == current_user_id for coach in group.coaches)
    if is_group_coach or school_role == 'coach':
        assignment = CoachAssignment.query.filter_by(
            coach_id=current_user_id,
            group_id=group.id,
            student_id=student_id
        ).first()
        if assignment is not None:
            return True

    if user_has_school_role(group.id, current_user_id, {'teacher'}):
        return any(student.id == student_id for student in get_students_for_teacher(group, current_user_id))

    return False


def can_view_student(group, current_user_id, student_id):
    return can_manage_student(group, current_user_id, student_id)


def get_school_role(group_id, user_id):
    assignment = SchoolRoleAssignment.query.filter_by(group_id=group_id, user_id=user_id).first()
    return assignment.role if assignment else None


def user_has_school_role(group_id, user_id, allowed_roles):
    return get_school_role(group_id, user_id) in allowed_roles


def get_teacher_class_ids(group_id, teacher_id):
    assignments = SchoolTeachingAssignment.query.filter_by(
        group_id=group_id,
        teacher_id=teacher_id
    ).all()
    return {assignment.class_id for assignment in assignments}


def get_all_school_class_ids(group):
    classes = SchoolClass.query.filter_by(group_id=group.id).all()
    return {school_class.id for school_class in classes}


def get_accessible_class_ids(group, user_id):
    if not group or group.group_type != 'school':
        return set()

    if can_manage_group(group, user_id):
        return get_all_school_class_ids(group)

    if any(coach.id == user_id for coach in group.coaches):
        return get_all_school_class_ids(group)

    school_role = get_school_role(group.id, user_id)
    if school_role in {'school-admin', 'headteacher', 'pastoral-lead', 'coach'}:
        return get_all_school_class_ids(group)

    if school_role == 'teacher':
        return get_teacher_class_ids(group.id, user_id)

    enrollment_class_ids = {
        enrollment.class_id
        for enrollment in SchoolEnrollment.query.filter_by(group_id=group.id, student_id=user_id).all()
    }
    if enrollment_class_ids:
        return enrollment_class_ids

    if school_role in {'student', 'member'}:
        return set()

    return set()


def user_can_access_group(group, user_id):
    if not group:
        return False
    if group.leader_id == user_id:
        return True
    if any(member.id == user_id for member in group.members):
        return True
    if any(coach.id == user_id for coach in group.coaches):
        return True
    return get_school_role(group.id, user_id) is not None


def school_group_dms_allowed(group):
    return bool(group) and group.group_type != 'school'


def parse_chat_class_id(raw_value):
    try:
        return int(raw_value) if raw_value not in (None, '', 'null', 'undefined') else None
    except (TypeError, ValueError):
        return None


def build_chat_unread_map(group, user_id, accessible_class_ids=None):
    accessible_class_ids = accessible_class_ids or set()
    unread_map = {'school-wide': 0}
    for accessible_class_id in accessible_class_ids:
        unread_map[accessible_class_id] = 0

    messages = Message.query.filter_by(group_id=group.id, recipient_id=None).all()
    for message in messages:
        if message.sender_id == user_id:
            continue
        channel_key = message.class_id if message.class_id is not None else 'school-wide'
        if channel_key != 'school-wide' and channel_key not in accessible_class_ids:
            continue
        read_by = json.loads(message.read_by or '[]')
        if user_id not in read_by:
            unread_map[channel_key] = unread_map.get(channel_key, 0) + 1

    return unread_map


def build_chat_latest_map(group, accessible_class_ids=None):
    accessible_class_ids = accessible_class_ids or set()
    latest_map = {'school-wide': None}
    for accessible_class_id in accessible_class_ids:
        latest_map[accessible_class_id] = None

    messages = Message.query.filter_by(group_id=group.id, recipient_id=None).all()
    for message in messages:
        channel_key = message.class_id if message.class_id is not None else 'school-wide'
        if channel_key != 'school-wide' and channel_key not in accessible_class_ids:
            continue
        current_latest = latest_map.get(channel_key)
        if current_latest is None or (message.created_at and message.created_at > current_latest.created_at):
            latest_map[channel_key] = message

    return latest_map


def serialize_chat_activity(message):
    if not message:
        return None
    return {
        'content': message.content,
        'createdAt': message.created_at.isoformat() if message.created_at else None,
        'messageType': message.message_type,
        'senderUsername': message.sender.username if message.sender else None
    }


def build_chat_channel_payload(group, class_id=None, accessible_class_ids=None, user_id=None):
    accessible_class_ids = accessible_class_ids or set()
    unread_map = build_chat_unread_map(group, user_id, accessible_class_ids) if group and user_id is not None else {'school-wide': 0}
    latest_map = build_chat_latest_map(group, accessible_class_ids) if group else {'school-wide': None}
    accessible_classes = []
    if group and group.group_type == 'school' and accessible_class_ids:
        classes = SchoolClass.query.filter(
            SchoolClass.group_id == group.id,
            SchoolClass.id.in_(accessible_class_ids)
        ).order_by(SchoolClass.name.asc()).all()
        accessible_classes = [
            {
                **school_class.to_dict(),
                'unreadCount': unread_map.get(school_class.id, 0),
                'latestActivity': serialize_chat_activity(latest_map.get(school_class.id))
            }
            for school_class in classes
        ]

    school_class = None
    if class_id is not None:
        school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id).first()

    return {
        'type': 'class' if school_class else 'school-wide',
        'classId': school_class.id if school_class else None,
        'className': school_class.name if school_class else None,
        'unreadCount': unread_map.get(school_class.id if school_class else 'school-wide', 0),
        'schoolWideUnreadCount': unread_map.get('school-wide', 0),
        'latestActivity': serialize_chat_activity(latest_map.get(school_class.id if school_class else 'school-wide')),
        'schoolWideLatestActivity': serialize_chat_activity(latest_map.get('school-wide')),
        'accessibleClasses': accessible_classes
    }


def get_chat_channel_context(group, user_id, class_id=None):
    if not user_can_access_group(group, user_id):
        return None, jsonify({'error': 'Not authorized'}), 403

    class_id = parse_chat_class_id(class_id)
    accessible_class_ids = get_accessible_class_ids(group, user_id)

    if class_id is None:
        return {
            'class_id': None,
            'accessible_class_ids': accessible_class_ids,
            'channel': build_chat_channel_payload(group, None, accessible_class_ids, user_id=user_id)
        }, None, None

    school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id).first()
    if not school_class:
        return None, jsonify({'error': 'Class channel not found'}), 404

    if class_id not in accessible_class_ids:
        return None, jsonify({'error': 'Not authorized for this class channel'}), 403

    return {
        'class_id': school_class.id,
        'school_class': school_class,
        'accessible_class_ids': accessible_class_ids,
        'channel': build_chat_channel_payload(group, school_class.id, accessible_class_ids, user_id=user_id)
    }, None, None


def mark_messages_read_for_user(messages, user_id):
    updated = 0
    for msg in messages:
        read_by = json.loads(msg.read_by or '[]')
        if user_id not in read_by:
            read_by.append(user_id)
            msg.read_by = json.dumps(read_by)
            updated += 1
    return updated


def get_students_for_teacher(group, teacher_id, members=None, class_ids=None):
    class_ids = class_ids if class_ids is not None else get_teacher_class_ids(group.id, teacher_id)
    if not class_ids:
        return []
    enrollments = SchoolEnrollment.query.filter(
        SchoolEnrollment.group_id == group.id,
        SchoolEnrollment.class_id.in_(class_ids)
    ).all()
    student_ids = {enrollment.student_id for enrollment in enrollments}
    members = members if members is not None else get_group_members_list(group)
    return [member for member in members if member.id in student_ids]


def can_manage_school(group, current_user_id):
    return can_manage_group(group, current_user_id)


def can_view_school_operations(group, current_user_id):
    if can_manage_school(group, current_user_id):
        return True
    if any(coach.id == current_user_id for coach in group.coaches):
        return True
    return user_has_school_role(
        group.id,
        current_user_id,
        {'teacher', 'headteacher', 'pastoral-lead', 'school-admin', 'coach'}
    )


def build_school_trend(records):
    ordered = sorted(records, key=lambda record: record.week_ending)
    trend_points = []
    for record in ordered:
        net_score = (record.positive_points or 0) - ((record.negative_points or 0) + ((record.truancy_incidents or 0) * 2))
        trend_points.append({
            'weekEnding': record.week_ending.isoformat() if record.week_ending else None,
            'positivePoints': record.positive_points or 0,
            'negativePoints': record.negative_points or 0,
            'truancyIncidents': record.truancy_incidents or 0,
            'netScore': net_score
        })

    status = 'inconsistent'
    if len(trend_points) >= 2:
        previous = trend_points[-2]['netScore']
        current = trend_points[-1]['netScore']
        if current > previous:
            status = 'improving'
        elif current < previous:
            status = 'worsening'
    elif len(trend_points) == 1:
        status = 'improving' if trend_points[0]['netScore'] >= 0 else 'inconsistent'

    return {
        'status': status,
        'points': trend_points
    }


def calculate_habit_recovery_metrics(group, student_id):
    if not group.active_challenge or not group.active_challenge.member_habits:
        return {
            'completionRate': 0,
            'completedCount': 0,
            'scheduledCount': 0,
            'recoveryPoints': 0
        }

    member_habit = next(
        (mh for mh in group.active_challenge.member_habits if str(mh.get('member')) == str(student_id)),
        None
    )
    if not member_habit:
        return {
            'completionRate': 0,
            'completedCount': 0,
            'scheduledCount': 0,
            'recoveryPoints': 0
        }

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    completed_count = 0
    scheduled_count = 0

    for habit in member_habit.get('habits', []):
        progress = habit.get('progress') or []
        schedule_days = habit.get('scheduleDays') or []
        for offset in range(7):
            target_day = week_start + timedelta(days=offset)
            if target_day > today:
                break

            day_name = target_day.strftime('%A')
            is_scheduled = not schedule_days or day_name in schedule_days
            if not is_scheduled:
                continue

            scheduled_count += 1
            progress_entry = next(
                (entry for entry in progress if str(entry.get('date', ''))[:10] == target_day.isoformat()),
                None
            )
            if progress_entry and progress_entry.get('completed'):
                completed_count += 1

    completion_rate = round((completed_count / scheduled_count) * 100, 1) if scheduled_count else 0
    if scheduled_count == 0:
        recovery_points = 0
    elif completed_count == 0:
        recovery_points = -2
    elif completion_rate >= 100:
        recovery_points = 3
    elif completion_rate >= 66:
        recovery_points = 2
    elif completion_rate >= 33:
        recovery_points = 1
    else:
        recovery_points = 0

    return {
        'completionRate': completion_rate,
        'completedCount': completed_count,
        'scheduledCount': scheduled_count,
        'recoveryPoints': recovery_points
    }


def calculate_today_habit_recovery_metrics(group, student_id):
    member_habit = get_member_habit_entry(group, student_id)
    if not member_habit:
        return {
            'completionRate': 0,
            'completedCount': 0,
            'scheduledCount': 0,
            'recoveryPoints': 0
        }

    today = date.today()
    today_iso = today.isoformat()
    day_name = today.strftime('%A')
    completed_count = 0
    scheduled_count = 0

    for habit in member_habit.get('habits', []):
        schedule_days = habit.get('scheduleDays') or []
        is_scheduled = not schedule_days or day_name in schedule_days
        if not is_scheduled:
            continue

        scheduled_count += 1
        progress_entry = next(
            (entry for entry in (habit.get('progress') or []) if str(entry.get('date', ''))[:10] == today_iso),
            None
        )
        if progress_entry and progress_entry.get('completed'):
            completed_count += 1

    completion_rate = round((completed_count / scheduled_count) * 100, 1) if scheduled_count else 0
    if scheduled_count == 0:
        recovery_points = 0
    elif completed_count == 0:
        recovery_points = -2
    elif completion_rate >= 100:
        recovery_points = 3
    elif completion_rate >= 66:
        recovery_points = 2
    elif completion_rate >= 33:
        recovery_points = 1
    else:
        recovery_points = 0

    return {
        'completionRate': completion_rate,
        'completedCount': completed_count,
        'scheduledCount': scheduled_count,
        'recoveryPoints': recovery_points
    }


def calculate_performance_card_points(checkpoints):
    total_points = 0
    normalized = []
    for checkpoint in checkpoints or []:
        slot = checkpoint.get('slot')
        attended = bool(checkpoint.get('attended'))
        engagement = checkpoint.get('engagement')
        refocus = bool(checkpoint.get('refocus'))
        teacher_signature = checkpoint.get('teacherSignature')

        checkpoint_points = 0
        if not teacher_signature:
            checkpoint_points -= 5
        elif not attended:
            checkpoint_points -= 5

        if engagement == 'green':
            checkpoint_points += 4
        elif engagement == 'amber':
            checkpoint_points += 1
        elif engagement == 'red':
            checkpoint_points -= 3

        if refocus:
            checkpoint_points -= 5

        total_points += checkpoint_points
        normalized.append({
            'slot': slot,
            'attended': attended,
            'engagement': engagement,
            'refocus': refocus,
            'teacherSignature': teacher_signature or '',
            'points': checkpoint_points
        })

    return normalized, total_points


def calculate_weekly_performance_card_metrics(group, student_id):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_cards = PerformanceCard.query.filter(
        PerformanceCard.group_id == group.id,
        PerformanceCard.student_id == student_id,
        PerformanceCard.card_date >= week_start,
        PerformanceCard.card_date <= today
    ).order_by(PerformanceCard.card_date.asc()).all()

    return {
        'cards': [card.to_dict() for card in week_cards],
        'weeklyPoints': sum(card.total_points or 0 for card in week_cards),
        'daysCompleted': len(week_cards)
    }


def calculate_today_performance_card_metrics(group, student_id):
    today = date.today()
    card = PerformanceCard.query.filter_by(
        group_id=group.id,
        student_id=student_id,
        card_date=today
    ).first()

    return {
        'card': card.to_dict() if card else None,
        'points': card.total_points if card else 0,
        'logged': bool(card)
    }


def calculate_lesson_register_points(attendance_status, engagement, refocus):
    points = 0
    attended = attendance_status in ('present', 'late')
    if attendance_status == 'late':
        points -= 1
    elif not attended:
        points -= 5

    if engagement == 'green':
        points += 4
    elif engagement == 'amber':
        points += 1
    elif engagement == 'red':
        points -= 3

    if refocus:
        points -= 5

    return points


def build_lesson_slots_for_date(group, target_date, student_id=None):
    weekday = target_date.strftime('%A')
    entries = []
    for entry in group.school_timetable or []:
        if entry.get('weekday') != weekday:
            continue
        student_ids = [int(value) for value in (entry.get('studentIds') or []) if str(value).isdigit()]
        if student_id is not None and student_ids and int(student_id) not in student_ids:
            continue
        entries.append({
            'id': entry.get('id'),
            'weekday': weekday,
            'startTime': entry.get('startTime') or '',
            'endTime': entry.get('endTime') or '',
            'subjectId': entry.get('subjectId'),
            'subject': entry.get('subject') or '',
            'teacherId': entry.get('teacherId'),
            'teacherName': entry.get('teacherName') or '',
            'roomId': entry.get('roomId'),
            'room': entry.get('room') or '',
            'classId': entry.get('classId'),
            'className': entry.get('className') or '',
            'studentIds': student_ids
        })
    entries.sort(key=lambda item: (item['startTime'], item['subject'].lower()))
    return entries


def build_lesson_register_summary(group, student_id, target_date=None):
    target_date = target_date or date.today()
    slots = build_lesson_slots_for_date(group, target_date, student_id)
    existing = LessonRegister.query.filter_by(
        group_id=group.id,
        student_id=student_id,
        lesson_date=target_date
    ).all()
    existing_map = {record.timetable_slot_id: record for record in existing}

    entries = []
    total_points = 0
    for slot in slots:
        record = existing_map.get(slot['id'])
        lesson_entry = {
            **slot,
            'lessonDate': target_date.isoformat(),
            'attendanceStatus': record.attendance_status if record else 'present',
            'latenessMinutes': record.lateness_minutes if record else 0,
            'attended': record.attended if record else True,
            'engagement': record.engagement if record else 'green',
            'refocus': record.refocus if record else False,
            'teacherComment': record.teacher_comment if record else '',
            'points': record.points if record else 0,
            'teacher': record.teacher.to_dict() if record and record.teacher else None,
            'logged': bool(record)
        }
        total_points += lesson_entry['points']
        entries.append(lesson_entry)

    return {
        'date': target_date.isoformat(),
        'weekday': target_date.strftime('%A'),
        'entries': entries,
        'expectedLessons': len(slots),
        'loggedLessons': len(existing),
        'points': total_points
    }


def get_student_interventions(group_id, student_id):
    return InterventionRecord.query.filter_by(
        group_id=group_id,
        student_id=student_id
    ).order_by(InterventionRecord.intervention_date.desc(), InterventionRecord.created_at.desc()).all()


def get_parent_contact_records(group_id, student_id):
    return ParentContactRecord.query.filter_by(
        group_id=group_id,
        student_id=student_id
    ).order_by(ParentContactRecord.contact_date.desc(), ParentContactRecord.created_at.desc()).all()


def get_parent_profiles(group_id, student_id):
    return ParentProfile.query.filter_by(
        group_id=group_id,
        student_id=student_id
    ).order_by(ParentProfile.created_at.asc()).all()


def log_school_audit(group_id, actor_id, action_type, entity_type, title, description=None, student_id=None, metadata=None):
    if not group_id or not actor_id or not action_type or not entity_type or not title:
        return
    db.session.add(SchoolAuditLog(
        group_id=group_id,
        actor_id=actor_id,
        student_id=student_id,
        action_type=action_type,
        entity_type=entity_type,
        title=title[:255],
        description=(description or '').strip() or None,
        metadata_json=metadata or None
    ))


def get_school_audit_logs(group_id, limit=20):
    return SchoolAuditLog.query.options(
        joinedload(SchoolAuditLog.actor),
        joinedload(SchoolAuditLog.student)
    ).filter_by(group_id=group_id).order_by(
        SchoolAuditLog.created_at.desc(),
        SchoolAuditLog.id.desc()
    ).limit(limit).all()


def resolve_homework_student_ids(group, class_id=None, explicit_student_ids=None):
    resolved_ids = set()
    if class_id:
        enrollments = SchoolEnrollment.query.filter_by(group_id=group.id, class_id=class_id).all()
        resolved_ids.update(enrollment.student_id for enrollment in enrollments)
    for raw_value in explicit_student_ids or []:
        try:
            resolved_ids.add(int(raw_value))
        except (TypeError, ValueError):
            continue
    valid_member_ids = {member.id for member in group.members}
    return sorted(student_id for student_id in resolved_ids if student_id in valid_member_ids)


def calculate_homework_submission_points(assignment, submission, today_value=None):
    today_value = today_value or date.today()
    due_date = assignment.due_date
    reviewed_points = submission.awarded_points if submission and submission.status == 'reviewed' else None
    if reviewed_points is not None:
        return reviewed_points

    if not submission or submission.status not in {'submitted', 'late', 'reviewed'}:
        if due_date and due_date < today_value:
            return -(assignment.missing_penalty or 0)
        return 0

    submitted_date = submission.completed_date
    base_points = assignment.max_points or 0
    if submitted_date and due_date and submitted_date > due_date:
        return max(0, base_points - (assignment.late_penalty or 0))
    return base_points


def serialize_homework_submission_for_school(submission):
    if not submission:
        return None
    return {
        'id': submission.id,
        'assignmentId': submission.assignment_id,
        'groupId': submission.group_id,
        'studentId': submission.student_id,
        'submittedById': submission.submitted_by_id,
        'reviewedById': submission.reviewed_by_id,
        'status': submission.status,
        'submittedAt': submission.submitted_at.isoformat() if submission.submitted_at else None,
        'reviewedAt': submission.reviewed_at.isoformat() if submission.reviewed_at else None,
        'completedDate': submission.completed_date.isoformat() if submission.completed_date else None,
        'responseText': submission.response_text or '',
        'evidenceLink': submission.evidence_link or '',
        'teacherFeedback': submission.teacher_feedback or '',
        'awardedPoints': submission.awarded_points,
        'student': serialize_school_user_brief(submission.student),
        'submittedBy': serialize_school_user_brief(submission.submitted_by),
        'reviewedBy': serialize_school_user_brief(submission.reviewed_by),
        'createdAt': submission.created_at.isoformat() if submission.created_at else None,
        'updatedAt': submission.updated_at.isoformat() if submission.updated_at else None
    }


def serialize_homework_assignment_for_user(assignment, current_user_id=None):
    payload = {
        'id': assignment.id,
        'groupId': assignment.group_id,
        'createdById': assignment.created_by_id,
        'classId': assignment.class_id,
        'subjectId': assignment.subject_id,
        'title': assignment.title,
        'description': assignment.description or '',
        'instructions': assignment.instructions or '',
        'homeworkType': assignment.homework_type,
        'complexity': assignment.complexity,
        'assignedDate': assignment.assigned_date.isoformat() if assignment.assigned_date else None,
        'dueDate': assignment.due_date.isoformat() if assignment.due_date else None,
        'estimatedMinutes': assignment.estimated_minutes,
        'maxPoints': assignment.max_points,
        'latePenalty': assignment.late_penalty,
        'missingPenalty': assignment.missing_penalty,
        'allowLate': assignment.allow_late,
        'requiresEvidence': assignment.requires_evidence,
        'studentIds': assignment.student_ids or [],
        'schoolClass': serialize_school_class_brief(assignment.school_class),
        'className': assignment.school_class.name if assignment.school_class else '',
        'subject': serialize_school_subject_brief(assignment.subject),
        'subjectName': assignment.subject.name if assignment.subject else '',
        'createdBy': serialize_school_user_brief(assignment.created_by),
        'createdAt': assignment.created_at.isoformat() if assignment.created_at else None,
        'updatedAt': assignment.updated_at.isoformat() if assignment.updated_at else None
    }
    submissions = [serialize_homework_submission_for_school(submission) for submission in assignment.submissions]
    payload['submissionCount'] = len(submissions)
    payload['studentCount'] = len(assignment.student_ids or [])
    payload['submissions'] = submissions
    if current_user_id is not None:
        payload['mySubmission'] = next((item for item in submissions if item.get('studentId') == current_user_id), None)
    return payload


def get_homework_assignments_for_user(group, current_user_id):
    assignments = SchoolHomeworkAssignment.query.options(
        joinedload(SchoolHomeworkAssignment.school_class).joinedload(SchoolClass.room),
        joinedload(SchoolHomeworkAssignment.subject),
        joinedload(SchoolHomeworkAssignment.created_by),
        selectinload(SchoolHomeworkAssignment.submissions).joinedload(SchoolHomeworkSubmission.student),
        selectinload(SchoolHomeworkAssignment.submissions).joinedload(SchoolHomeworkSubmission.submitted_by),
        selectinload(SchoolHomeworkAssignment.submissions).joinedload(SchoolHomeworkSubmission.reviewed_by)
    ).filter_by(group_id=group.id).order_by(
        SchoolHomeworkAssignment.due_date.asc(),
        SchoolHomeworkAssignment.created_at.desc()
    ).all()
    if can_view_school_operations(group, current_user_id):
        return assignments
    return [assignment for assignment in assignments if current_user_id in (assignment.student_ids or [])]


def build_student_homework_summary(group, student_id):
    assignments = SchoolHomeworkAssignment.query.filter_by(group_id=group.id).order_by(
        SchoolHomeworkAssignment.due_date.asc(),
        SchoolHomeworkAssignment.created_at.desc()
    ).all()
    visible_assignments = [assignment for assignment in assignments if student_id in (assignment.student_ids or [])]
    today_value = date.today()
    week_start = today_value - timedelta(days=today_value.weekday())
    summary_rows = []
    total_weekly_points = 0
    total_daily_points = 0

    for assignment in visible_assignments:
        submission = next((item for item in assignment.submissions if item.student_id == student_id), None)
        points = calculate_homework_submission_points(assignment, submission, today_value=today_value)
        due_key = assignment.due_date.isoformat() if assignment.due_date else None
        submitted_today = bool(submission and submission.completed_date == today_value)
        due_today = bool(assignment.due_date == today_value)
        if assignment.due_date and week_start <= assignment.due_date <= today_value:
            total_weekly_points += points
        if submitted_today or due_today:
            total_daily_points += points
        summary_rows.append({
            **assignment.to_dict(),
            'pointsImpact': points,
            'submission': submission.to_dict() if submission else None,
            'isDueToday': due_today,
            'isSubmittedToday': submitted_today,
            'isOverdue': bool(assignment.due_date and assignment.due_date < today_value and not submission),
            'dueKey': due_key
        })

    upcoming = [row for row in summary_rows if row['dueDate'] and row['dueDate'] >= today_value.isoformat()]
    missing = [row for row in summary_rows if row['isOverdue']]
    return {
        'assignments': summary_rows,
        'dailyPoints': total_daily_points,
        'weeklyPoints': total_weekly_points,
        'upcomingCount': len(upcoming),
        'missingCount': len(missing),
        'dueTodayCount': sum(1 for row in summary_rows if row['isDueToday']),
        'submittedTodayCount': sum(1 for row in summary_rows if row['isSubmittedToday'])
    }


def calculate_today_behaviour_metrics(group, student_id):
    today_value = date.today()
    events = SchoolBehaviourEvent.query.filter_by(
        group_id=group.id,
        student_id=student_id,
        event_date=today_value
    ).all()
    return {
        'points': sum(event.points_delta or 0 for event in events),
        'events': [event.to_dict() for event in events],
        'count': len(events)
    }


def calculate_weekly_behaviour_metrics(group, student_id):
    today_value = date.today()
    week_start = today_value - timedelta(days=today_value.weekday())
    events = SchoolBehaviourEvent.query.filter(
        SchoolBehaviourEvent.group_id == group.id,
        SchoolBehaviourEvent.student_id == student_id,
        SchoolBehaviourEvent.event_date >= week_start,
        SchoolBehaviourEvent.event_date <= today_value
    ).all()
    return {
        'points': sum(event.points_delta or 0 for event in events),
        'count': len(events)
    }


def build_homework_analytics(group, students, assignments=None):
    visible_student_ids = {student.id for student in students}
    if assignments is None:
        assignment_query = SchoolHomeworkAssignment.query
        if hasattr(assignment_query, 'options'):
            assignment_query = assignment_query.options(
                joinedload(SchoolHomeworkAssignment.school_class),
                joinedload(SchoolHomeworkAssignment.subject),
                selectinload(SchoolHomeworkAssignment.submissions)
            )
        assignments = assignment_query.filter_by(group_id=group.id).order_by(
            SchoolHomeworkAssignment.due_date.asc(),
            SchoolHomeworkAssignment.created_at.desc()
        ).all()
    today_value = date.today()
    due_today = 0
    missing_total = 0
    submitted_today = 0
    rows = []

    for assignment in assignments:
        targeted_ids = [student_id for student_id in (assignment.student_ids or []) if student_id in visible_student_ids]
        if not targeted_ids:
            continue
        submissions = [submission for submission in assignment.submissions if submission.student_id in visible_student_ids]
        completed_count = sum(1 for submission in submissions if submission.status in {'submitted', 'late', 'reviewed'})
        missing_count = sum(
            1
            for student_id in targeted_ids
            if not next((submission for submission in submissions if submission.student_id == student_id and submission.status in {'submitted', 'late', 'reviewed'}), None)
            and assignment.due_date
            and assignment.due_date < today_value
        )
        if assignment.due_date == today_value:
            due_today += len(targeted_ids)
        submitted_today += sum(1 for submission in submissions if submission.completed_date == today_value)
        missing_total += missing_count
        rows.append({
            'assignmentId': assignment.id,
            'title': assignment.title,
            'dueDate': assignment.due_date.isoformat() if assignment.due_date else None,
            'subject': assignment.subject.name if assignment.subject else '',
            'className': assignment.school_class.name if assignment.school_class else '',
            'studentCount': len(targeted_ids),
            'completedCount': completed_count,
            'missingCount': missing_count,
            'maxPoints': assignment.max_points
        })

    rows.sort(key=lambda item: ((item['dueDate'] or ''), item['title'].lower()))
    return {
        'overview': {
            'assignmentCount': len(rows),
            'dueTodayCount': due_today,
            'submittedTodayCount': submitted_today,
            'missingCount': missing_total
        },
        'assignments': rows[:12]
    }


def get_preferred_staff_owner(group, student_id):
    assignment = CoachAssignment.query.filter_by(
        group_id=group.id,
        student_id=student_id
    ).order_by(CoachAssignment.created_at.asc()).first()
    if assignment:
        return assignment.coach_id
    return group.leader_id


def create_intervention_notification(group, student_id, owner_id, intervention_type, due_date=None):
    student = next((member for member in group.members if member.id == student_id), None)
    if not student or not owner_id:
        return
    due_text = f" Due {due_date.isoformat()}." if due_date else ''
    db.session.add(Message(
        group_id=group.id,
        sender_id=group.leader_id,
        recipient_id=owner_id,
        content=f"System alert: {student.username} has a new {intervention_type} intervention.{due_text}",
        message_type='system'
    ))


def create_system_alert(group, recipient_id, content):
    if not recipient_id or not content:
        return
    db.session.add(Message(
        group_id=group.id,
        sender_id=group.leader_id,
        recipient_id=recipient_id,
        content=content,
        message_type='system'
    ))


def create_class_chat_message(group, class_id, sender_id, content, message_type='system'):
    if not group or not class_id or not content:
        return None
    school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id).first()
    if not school_class:
        return None
    message = Message(
        group_id=group.id,
        sender_id=sender_id or group.leader_id,
        class_id=school_class.id,
        content=content,
        message_type=message_type
    )
    db.session.add(message)
    return message


def create_homework_assignment_notifications(group, assignment):
    for student_id in assignment.student_ids or []:
        create_system_alert(
            group,
            student_id,
            f"Homework set: {assignment.title} is due on {assignment.due_date.isoformat()} and can help recover points."
        )


def create_homework_reminder_notifications(group, assignment, staff_user_id=None, student_id=None):
    target_ids = [student_id] if student_id else list(assignment.student_ids or [])
    submissions_by_student = {submission.student_id: submission for submission in assignment.submissions}
    reminded_count = 0
    for target_id in target_ids:
        submission = submissions_by_student.get(target_id)
        if submission and submission.status in {'submitted', 'late', 'reviewed'}:
            continue
        create_system_alert(
            group,
            target_id,
            f"Homework reminder: {assignment.title} is due on {assignment.due_date.isoformat()}. Complete it to recover points."
        )
        reminded_count += 1
    if staff_user_id and reminded_count:
        create_system_alert(
            group,
            staff_user_id,
            f"System alert: homework reminder sent for {assignment.title} to {reminded_count} student(s)."
        )
    return reminded_count


def maybe_create_homework_trigger_alert(group, student_id, homework_summary):
    missing_count = homework_summary.get('missingCount', 0) or 0
    if missing_count < 2:
        return
    owner_id = get_preferred_staff_owner(group, student_id)
    student = next((member for member in group.members if member.id == student_id), None)
    if not owner_id or not student:
        return
    recent_trigger = Message.query.filter(
        Message.group_id == group.id,
        Message.recipient_id == owner_id,
        Message.message_type == 'system',
        Message.content.like(f"%homework trigger for {student.username}%")
    ).order_by(Message.created_at.desc()).first()
    if recent_trigger and recent_trigger.created_at and recent_trigger.created_at.date() >= date.today() - timedelta(days=3):
        return
    create_system_alert(
        group,
        owner_id,
        f"System alert: homework trigger for {student.username}. Repeated missing homework means parent contact should be considered."
    )


def build_recent_student_risk_window(group, student_id, days=5):
    today = date.today()
    start_date = today - timedelta(days=max(days - 1, 0))
    lesson_rows = LessonRegister.query.filter(
        LessonRegister.group_id == group.id,
        LessonRegister.student_id == student_id,
        LessonRegister.lesson_date >= start_date,
        LessonRegister.lesson_date <= today
    ).all()
    by_day = {}
    for row in lesson_rows:
        bucket = by_day.setdefault(row.lesson_date.isoformat(), {
            'date': row.lesson_date.isoformat(),
            'schoolPoints': 0,
            'absent': 0,
            'late': 0,
            'loggedLessons': 0
        })
        bucket['schoolPoints'] += row.points or 0
        bucket['loggedLessons'] += 1
        if row.attendance_status == 'absent':
            bucket['absent'] += 1
        elif row.attendance_status == 'late':
            bucket['late'] += 1

    ordered_days = [by_day[key] for key in sorted(by_day.keys())]
    negative_days = sum(1 for item in ordered_days if item['schoolPoints'] < 0)
    absence_days = sum(1 for item in ordered_days if item['absent'] > 0)
    lateness_days = sum(1 for item in ordered_days if item['late'] > 0)
    return {
        'days': ordered_days,
        'negativeDays': negative_days,
        'absenceDays': absence_days,
        'latenessDays': lateness_days
    }


def update_overdue_intervention_escalation(group, student_id):
    today = date.today()
    overdue_items = InterventionRecord.query.filter(
        InterventionRecord.group_id == group.id,
        InterventionRecord.student_id == student_id,
        InterventionRecord.status.in_(('scheduled', 'monitoring')),
        InterventionRecord.due_date.isnot(None),
        InterventionRecord.due_date < today
    ).all()
    if not overdue_items:
        return

    for item in overdue_items:
        if item.status != 'monitoring':
            item.status = 'monitoring'
            item.next_step = item.next_step or 'Escalated because the action is overdue'
            item.updated_at = datetime.utcnow()
            if item.owner_id:
                create_system_alert(
                    group,
                    item.owner_id,
                    f"System alert: intervention overdue for {item.student.username if item.student else 'student'}. Update the action today."
                )


def get_school_system_notifications(group, current_user_id, limit=8):
    notifications = []
    messages = Message.query.options(
        joinedload(Message.sender)
    ).filter_by(
        group_id=group.id,
        recipient_id=current_user_id,
        message_type='system'
    ).order_by(Message.created_at.desc()).limit(limit).all()

    for message in messages:
        read_by = json.loads(message.read_by or '[]')
        notifications.append({
            'id': message.id,
            'content': message.content,
            'createdAt': message.created_at.isoformat() if message.created_at else None,
            'unread': current_user_id not in read_by,
            'sender': serialize_school_user_brief(message.sender)
        })

    unread_count = sum(1 for item in notifications if item['unread'])
    return {
        'items': notifications,
        'unreadCount': unread_count
    }


def ensure_automatic_intervention(group, student_id):
    student = next((member for member in group.members if member.id == student_id), None)
    if not student:
        return

    daily = build_daily_points_summary(group, student_id)
    latest_impact = SchoolImpactRecord.query.filter_by(
        group_id=group.id,
        student_id=student_id
    ).order_by(SchoolImpactRecord.week_ending.desc()).first()
    risk_window = build_recent_student_risk_window(group, student_id, days=5)

    reasons = []
    if daily['combinedPoints'] < 0:
        reasons.append('Daily points below zero')
    if daily['schoolPoints'] < 0:
        reasons.append('School lesson score is negative')
    if daily.get('lessonRegisterExpectedLessons', 0) > daily.get('lessonRegisterLoggedLessons', 0):
        reasons.append('Lesson registers missing')
    if latest_impact and (latest_impact.truancy_incidents or 0) > 0:
        reasons.append('Recent truancy incidents')
    if risk_window['negativeDays'] >= 2:
        reasons.append('Multiple negative school days this week')
    if risk_window['absenceDays'] >= 2:
        reasons.append('Repeated absence this week')
    if risk_window['latenessDays'] >= 3:
        reasons.append('Repeated lateness this week')
    homework = build_student_homework_summary(group, student_id)
    if (homework.get('missingCount') or 0) > 0:
        reasons.append('Missing homework needs follow-up')
    if (homework.get('dueTodayCount') or 0) > 0 and (homework.get('submittedTodayCount') or 0) == 0 and daily['combinedPoints'] < 0:
        reasons.append('Homework still available to recover points today')
    maybe_create_homework_trigger_alert(group, student_id, homework)

    if not reasons:
        update_overdue_intervention_escalation(group, student_id)
        return

    today = date.today()
    existing = InterventionRecord.query.filter(
        InterventionRecord.group_id == group.id,
        InterventionRecord.student_id == student_id,
        InterventionRecord.intervention_date == today,
        InterventionRecord.status.in_(('scheduled', 'monitoring'))
    ).first()
    if existing:
        update_overdue_intervention_escalation(group, student_id)
        return

    if (homework.get('missingCount') or 0) >= 2:
        intervention_type = 'behaviour-coaching'
    elif risk_window['absenceDays'] >= 2:
        intervention_type = 'parent-call'
    elif risk_window['negativeDays'] >= 2:
        intervention_type = 'mindset-lesson'
    else:
        intervention_type = 'reflection-session' if daily['combinedPoints'] < 0 else 'behaviour-coaching'
    owner_id = get_preferred_staff_owner(group, student_id)
    due_date = today + timedelta(days=1 if daily['combinedPoints'] < 0 or risk_window['absenceDays'] >= 2 else 3)
    db.session.add(InterventionRecord(
        group_id=group.id,
        student_id=student_id,
        staff_id=group.leader_id,
        owner_id=owner_id,
        intervention_type=intervention_type,
        status='scheduled',
        intervention_date=today,
        due_date=due_date,
        auto_created=True,
        summary='Auto-created from school risk thresholds.',
        next_step='Review student and update intervention outcome'
    ))
    create_intervention_notification(group, student_id, owner_id, intervention_type, due_date)
    update_overdue_intervention_escalation(group, student_id)


def calculate_today_lesson_register_metrics(group, student_id):
    summary = build_lesson_register_summary(group, student_id, date.today())
    return {
        'entries': summary['entries'],
        'expectedLessons': summary['expectedLessons'],
        'loggedLessons': summary['loggedLessons'],
        'points': summary['points'],
        'date': summary['date']
    }


def build_group_league_table(group):
    standings = []
    for student in group.members:
        profile = serialize_school_profile(group, student)
        standings.append({
            'studentId': student.id,
            'username': student.username,
            'combinedWeeklyScore': profile['scorecards']['combinedWeeklyScore'],
            'behaviourScore': profile['scorecards']['latestBehaviourScore'],
            'habitRecoveryPoints': profile['scorecards']['habitRecovery']['recoveryPoints'],
            'performanceCardPoints': profile['scorecards']['performanceCard']['weeklyPoints']
        })

    standings.sort(key=lambda entry: (-entry['combinedWeeklyScore'], -entry['performanceCardPoints'], entry['username'].lower()))
    for index, standing in enumerate(standings):
        standing['position'] = index + 1
        if index == 0:
            standing['league'] = 'Premier League'
        elif index < 3:
            standing['league'] = 'Championship'
        else:
            standing['league'] = 'League One'
    return standings


def get_member_habit_entry(group, student_id):
    if not group.active_challenge or not group.active_challenge.member_habits:
        return None
    return next(
        (mh for mh in group.active_challenge.member_habits if str(mh.get('member')) == str(student_id)),
        None
    )


def calculate_goal_activity_status(group, student_id, latest_score, performance_card, habit_recovery):
    member_habit = get_member_habit_entry(group, student_id)
    configured_activity = None
    fallback_activity = 'Reflection session'
    if member_habit:
        configured_activity = member_habit.get('goalActivity')
        fallback_activity = member_habit.get('fallbackActivity') or fallback_activity

    active_intervention = InterventionRecord.query.filter(
        InterventionRecord.group_id == group.id,
        InterventionRecord.student_id == student_id,
        InterventionRecord.status.in_(('scheduled', 'monitoring')),
        InterventionRecord.intervention_date >= date.today() - timedelta(days=7)
    ).order_by(InterventionRecord.intervention_date.desc()).first()
    attendance_summary = build_attendance_summary(group, student_id)
    risk_window = build_recent_student_risk_window(group, student_id, days=5)
    has_attendance_lock = attendance_summary.get('attendanceRate', 0) < 80 or risk_window['absenceDays'] >= 2
    has_risk_lock = risk_window['negativeDays'] >= 2 or risk_window['latenessDays'] >= 3
    unlocked = (performance_card.get('weeklyPoints', 0) > 0) and latest_score >= 0 and not active_intervention and not has_attendance_lock and not has_risk_lock
    if unlocked and configured_activity:
        reason = 'Performance card completed successfully this week.'
    elif active_intervention:
        reason = 'Goal activity locked because there is an active intervention.'
    elif has_attendance_lock:
        reason = 'Goal activity locked because attendance is below the required level.'
    elif has_risk_lock:
        reason = 'Goal activity locked because behaviour or punctuality thresholds were hit repeatedly this week.'
    else:
        reason = 'Goal activity removed this week. Use reflection, behaviour coaching, or mindset lesson.'
    return {
        'activity': configured_activity or 'Goal activity not set',
        'fallbackActivity': fallback_activity,
        'unlocked': unlocked and bool(configured_activity),
        'statusLabel': 'Unlocked' if unlocked and configured_activity else 'Reflection required',
        'reason': reason,
        'lockReasons': {
            'activeIntervention': bool(active_intervention),
            'attendance': has_attendance_lock,
            'behaviour': has_risk_lock
        }
    }


def build_daily_points_summary(group, student_id):
    today_lessons = calculate_today_lesson_register_metrics(group, student_id)
    today_performance = calculate_today_performance_card_metrics(group, student_id)
    today_habits = calculate_today_habit_recovery_metrics(group, student_id)
    today_behaviour = calculate_today_behaviour_metrics(group, student_id)
    today_homework = build_student_homework_summary(group, student_id)
    school_points = today_lessons['points'] if today_lessons['loggedLessons'] else today_performance['points']
    school_source = 'lesson-register' if today_lessons['loggedLessons'] else 'performance-card'
    combined_points = school_points + today_habits['recoveryPoints'] + today_behaviour['points'] + today_homework['dailyPoints']
    recovery_status = 'on-track'
    if school_points < 0 and combined_points >= 0:
        recovery_status = 'recovered'
    elif combined_points < 0:
        recovery_status = 'needs-action'

    return {
        'schoolPoints': school_points,
        'habitRecoveryPoints': today_habits['recoveryPoints'],
        'behaviourPoints': today_behaviour['points'],
        'homeworkPoints': today_homework['dailyPoints'],
        'combinedPoints': combined_points,
        'status': recovery_status,
        'habitsCompleted': today_habits['completedCount'],
        'habitsScheduled': today_habits['scheduledCount'],
        'habitCompletionRate': today_habits['completionRate'],
        'performanceLogged': today_performance['logged'],
        'lessonRegisterLogged': bool(today_lessons['loggedLessons']),
        'lessonRegisterPoints': today_lessons['points'],
        'lessonRegisterExpectedLessons': today_lessons['expectedLessons'],
        'lessonRegisterLoggedLessons': today_lessons['loggedLessons'],
        'schoolSource': school_source,
        'remainingRecoveryPotential': max(0, 3 - today_habits['recoveryPoints']) + max(0, today_homework['dueTodayCount'] * 3 - today_homework['dailyPoints']),
        'homeworkDueTodayCount': today_homework['dueTodayCount'],
        'homeworkSubmittedTodayCount': today_homework['submittedTodayCount'],
        'behaviourEventCount': today_behaviour['count'],
        'date': date.today().isoformat()
    }


def normalize_timetable_entries(entries):
    normalized = []
    for index, entry in enumerate(entries or []):
        weekday = (entry.get('weekday') or '').strip()
        subject = (entry.get('subject') or '').strip()
        start_time = (entry.get('startTime') or '').strip()
        end_time = (entry.get('endTime') or '').strip()
        if weekday not in VALID_WEEKDAYS or not subject or not start_time or not end_time:
            continue

        student_ids = []
        for value in entry.get('studentIds') or []:
            try:
                student_ids.append(int(value))
            except (TypeError, ValueError):
                continue

        normalized.append({
            'id': entry.get('id') or f"slot-{index + 1}",
            'weekday': weekday,
            'startTime': start_time,
            'endTime': end_time,
            'subjectId': entry.get('subjectId'),
            'subject': subject,
            'teacherId': entry.get('teacherId'),
            'teacherName': (entry.get('teacherName') or '').strip(),
            'roomId': entry.get('roomId'),
            'room': (entry.get('room') or '').strip(),
            'classId': entry.get('classId'),
            'className': (entry.get('className') or '').strip(),
            'studentIds': sorted(set(student_ids))
        })

    weekday_order = {name: idx for idx, name in enumerate(VALID_WEEKDAYS)}
    normalized.sort(key=lambda item: (weekday_order.get(item['weekday'], 99), item['startTime'], item['subject'].lower()))
    return normalized


def serialize_school_structure(group):
    roles = SchoolRoleAssignment.query.filter_by(group_id=group.id).all()
    subjects = SchoolSubject.query.filter_by(group_id=group.id).order_by(SchoolSubject.name.asc()).all()
    rooms = SchoolRoom.query.filter_by(group_id=group.id).order_by(SchoolRoom.name.asc()).all()
    classes = SchoolClass.query.filter_by(group_id=group.id).order_by(SchoolClass.name.asc()).all()
    enrollments = SchoolEnrollment.query.filter_by(group_id=group.id).all()
    teaching_assignments = SchoolTeachingAssignment.query.filter_by(group_id=group.id).all()
    behaviour_types = SchoolBehaviourType.query.filter_by(group_id=group.id).order_by(SchoolBehaviourType.kind.asc(), SchoolBehaviourType.name.asc()).all()

    enrollment_map = {}
    for enrollment in enrollments:
        enrollment_map.setdefault(enrollment.class_id, []).append(enrollment.to_dict())

    teaching_map = {}
    for assignment in teaching_assignments:
        teaching_map.setdefault(assignment.class_id, []).append(assignment.to_dict())

    return {
        'roles': [assignment.to_dict() for assignment in roles],
        'subjects': [subject.to_dict() for subject in subjects],
        'rooms': [room.to_dict() for room in rooms],
        'behaviourTypes': [item.to_dict() for item in behaviour_types],
        'classes': [
            {
                **school_class.to_dict(),
                'enrollments': enrollment_map.get(school_class.id, []),
                'teachingAssignments': teaching_map.get(school_class.id, [])
            }
            for school_class in classes
        ]
    }


def build_attendance_summary(group, student_id):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    rows = LessonRegister.query.filter(
        LessonRegister.group_id == group.id,
        LessonRegister.student_id == student_id,
        LessonRegister.lesson_date >= week_start,
        LessonRegister.lesson_date <= today
    ).all()
    if not rows:
        return {
            'todayStatus': 'No lessons logged',
            'present': 0,
            'late': 0,
            'absent': 0,
            'authorisedAbsence': 0,
            'attendanceRate': 0
        }

    present = sum(1 for row in rows if row.attendance_status == 'present')
    late = sum(1 for row in rows if row.attendance_status == 'late')
    absent = sum(1 for row in rows if row.attendance_status == 'absent')
    authorised = sum(1 for row in rows if row.attendance_status == 'authorised-absence')
    attended_count = present + late
    attendance_rate = round((attended_count / len(rows)) * 100, 1) if rows else 0
    today_rows = [row for row in rows if row.lesson_date == today]
    today_status = 'On time'
    if any(row.attendance_status == 'absent' for row in today_rows):
        today_status = 'Absent'
    elif any(row.attendance_status == 'late' for row in today_rows):
        today_status = 'Late'
    elif any(row.attendance_status == 'authorised-absence' for row in today_rows):
        today_status = 'Authorised absence'

    return {
        'todayStatus': today_status,
        'present': present,
        'late': late,
        'absent': absent,
        'authorisedAbsence': authorised,
        'attendanceRate': attendance_rate
    }


def build_attendance_summary_from_rows(rows, today_value=None):
    today_value = today_value or date.today()
    if not rows:
        return {
            'todayStatus': 'No lessons logged',
            'present': 0,
            'late': 0,
            'absent': 0,
            'authorisedAbsence': 0,
            'attendanceRate': 0
        }

    present = sum(1 for row in rows if row.attendance_status == 'present')
    late = sum(1 for row in rows if row.attendance_status == 'late')
    absent = sum(1 for row in rows if row.attendance_status == 'absent')
    authorised = sum(1 for row in rows if row.attendance_status == 'authorised-absence')
    attended_count = present + late
    attendance_rate = round((attended_count / len(rows)) * 100, 1) if rows else 0
    today_rows = [row for row in rows if row.lesson_date == today_value]
    today_status = 'On time'
    if any(row.attendance_status == 'absent' for row in today_rows):
        today_status = 'Absent'
    elif any(row.attendance_status == 'late' for row in today_rows):
        today_status = 'Late'
    elif any(row.attendance_status == 'authorised-absence' for row in today_rows):
        today_status = 'Authorised absence'

    return {
        'todayStatus': today_status,
        'present': present,
        'late': late,
        'absent': absent,
        'authorisedAbsence': authorised,
        'attendanceRate': attendance_rate
    }


def build_attendance_analytics(group, current_user_id, students, lesson_rows=None):
    today = date.today()
    window_start = today - timedelta(days=13)
    visible_student_ids = {student.id for student in students}
    if lesson_rows is None:
        lesson_rows = LessonRegister.query.filter(
            LessonRegister.group_id == group.id,
            LessonRegister.lesson_date >= window_start,
            LessonRegister.lesson_date <= today
        ).all()
    lesson_rows = [
        row for row in lesson_rows
        if row.student_id in visible_student_ids and window_start <= row.lesson_date <= today
    ]

    student_map = {student.id: student for student in students}
    attendance_by_student = []
    student_rows_map = {}
    for row in lesson_rows:
        student_rows_map.setdefault(row.student_id, []).append(row)

    for student in students:
        rows = student_rows_map.get(student.id, [])
        present = sum(1 for row in rows if row.attendance_status == 'present')
        late = sum(1 for row in rows if row.attendance_status == 'late')
        absent = sum(1 for row in rows if row.attendance_status == 'absent')
        authorised = sum(1 for row in rows if row.attendance_status == 'authorised-absence')
        attended = present + late
        attendance_rate = round((attended / len(rows)) * 100, 1) if rows else 0
        attendance_by_student.append({
            'studentId': student.id,
            'username': student.username,
            'attendanceRate': attendance_rate,
            'present': present,
            'late': late,
            'absent': absent,
            'authorisedAbsence': authorised,
            'lessons': len(rows)
        })

    class_name_lookup = {}
    subject_name_lookup = {}
    for entry in group.school_timetable or []:
        if entry.get('classId') is not None:
            class_name_lookup[str(entry.get('classId'))] = entry.get('className') or 'Unassigned class'
        if entry.get('subjectId') is not None:
            subject_name_lookup[str(entry.get('subjectId'))] = entry.get('subject') or 'Unknown subject'

    class_buckets = {}
    subject_buckets = {}
    for row in lesson_rows:
        class_key = row.class_name or 'Unassigned class'
        class_bucket = class_buckets.setdefault(class_key, {'className': class_key, 'present': 0, 'late': 0, 'absent': 0, 'authorisedAbsence': 0, 'lessons': 0})
        subject_key = row.subject or 'Unknown subject'
        subject_bucket = subject_buckets.setdefault(subject_key, {'subject': subject_key, 'present': 0, 'late': 0, 'absent': 0, 'authorisedAbsence': 0, 'lessons': 0})
        for bucket in (class_bucket, subject_bucket):
            bucket['lessons'] += 1
            if row.attendance_status == 'present':
                bucket['present'] += 1
            elif row.attendance_status == 'late':
                bucket['late'] += 1
            elif row.attendance_status == 'absent':
                bucket['absent'] += 1
            elif row.attendance_status == 'authorised-absence':
                bucket['authorisedAbsence'] += 1

    attendance_by_class = []
    for bucket in class_buckets.values():
        attended = bucket['present'] + bucket['late']
        bucket['attendanceRate'] = round((attended / bucket['lessons']) * 100, 1) if bucket['lessons'] else 0
        attendance_by_class.append(bucket)

    attendance_by_subject = []
    for bucket in subject_buckets.values():
        attended = bucket['present'] + bucket['late']
        bucket['attendanceRate'] = round((attended / bucket['lessons']) * 100, 1) if bucket['lessons'] else 0
        attendance_by_subject.append(bucket)

    attendance_trend_map = {}
    for row in lesson_rows:
        day_key = row.lesson_date.isoformat()
        day_bucket = attendance_trend_map.setdefault(day_key, {'date': day_key, 'present': 0, 'late': 0, 'absent': 0, 'authorisedAbsence': 0, 'attendanceRate': 0, 'lessons': 0})
        day_bucket['lessons'] += 1
        if row.attendance_status == 'present':
            day_bucket['present'] += 1
        elif row.attendance_status == 'late':
            day_bucket['late'] += 1
        elif row.attendance_status == 'absent':
            day_bucket['absent'] += 1
        elif row.attendance_status == 'authorised-absence':
            day_bucket['authorisedAbsence'] += 1
    attendance_trend = []
    for item in sorted(attendance_trend_map.values(), key=lambda row: row['date']):
        attended = item['present'] + item['late']
        item['attendanceRate'] = round((attended / item['lessons']) * 100, 1) if item['lessons'] else 0
        attendance_trend.append(item)

    return {
        'students': sorted(attendance_by_student, key=lambda row: (row['attendanceRate'], row['username'].lower())),
        'classes': sorted(attendance_by_class, key=lambda row: (row['attendanceRate'], row['className'].lower())),
        'subjects': sorted(attendance_by_subject, key=lambda row: (row['attendanceRate'], row['subject'].lower())),
        'trend': attendance_trend
    }


def csv_response(filename, rows, headers):
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in rows:
        writer.writerow({header: row.get(header, '') for header in headers})
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def build_weekly_student_report_html(group, student):
    profile = serialize_school_profile(group, student)
    attendance = profile.get('attendanceSummary') or {}
    behaviour_summary = profile.get('behaviourSummary') or {}
    goal_activity = profile.get('goalActivity') or {}
    scorecards = profile.get('scorecards') or {}
    homework = profile.get('homework') or {}
    behaviour_rows = ''.join(
        f"<tr><td>{item.get('subject','')}</td><td>{item.get('reward',0)}</td><td>{item.get('sanction',0)}</td><td>{item.get('referral',0)}</td><td>{item.get('onCall',0)}</td><td>{item.get('removal',0)}</td><td>{item.get('pointsDelta',0)}</td></tr>"
        for item in (behaviour_summary.get('subjects') or [])[:8]
    ) or '<tr><td colspan="7">No behaviour events this week.</td></tr>'
    goal_rows = ''.join(
        f"<li><strong>{goal.get('title','')}</strong> | Barrier: {goal.get('barrier','')} | School goal: {goal.get('schoolGoal','')}</li>"
        for goal in (profile.get('goals') or [])
    ) or '<li>No goals set.</li>'
    habit_rows = ''.join(
        f"<li>{habit.get('name','')} | Why: {next((goal.get('title') for goal in (profile.get('goals') or []) if str(goal.get('id')) == str(habit.get('linkedGoalId'))), 'No linked goal')}</li>"
        for habit in (profile.get('linkedHabits') or [])
    ) or '<li>No linked habits set.</li>'
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Weekly Student Report - {student.username}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 32px; color: #111827; }}
    h1, h2 {{ margin-bottom: 8px; }}
    .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }}
    .card {{ border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
    th, td {{ border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 14px; }}
    th {{ background: #f3f4f6; }}
    ul {{ margin-top: 8px; }}
  </style>
</head>
<body>
  <h1>{group.name} Weekly Student Report</h1>
  <p><strong>Student:</strong> {student.username}</p>
    <div class="grid">
    <div class="card"><div>Combined weekly score</div><h2>{scorecards.get('combinedWeeklyScore', 0)}</h2></div>
    <div class="card"><div>Attendance rate</div><h2>{attendance.get('attendanceRate', 0)}%</h2></div>
    <div class="card"><div>Behaviour score</div><h2>{scorecards.get('latestBehaviourScore', 0)}</h2></div>
    <div class="card"><div>Goal activity</div><h2>{goal_activity.get('statusLabel', 'Unknown')}</h2></div>
    <div class="card"><div>Homework points</div><h2>{homework.get('weeklyPoints', 0)}</h2></div>
  </div>
  <h2>Goal plan</h2>
  <ul>{goal_rows}</ul>
  <h2>Linked habits</h2>
  <ul>{habit_rows}</ul>
  <h2>Attendance summary</h2>
  <p>Today status: {attendance.get('todayStatus', 'No lessons logged')} | Present: {attendance.get('present',0)} | Late: {attendance.get('late',0)} | Absent: {attendance.get('absent',0)} | Authorised absence: {attendance.get('authorisedAbsence',0)}</p>
  <h2>Behaviour by subject</h2>
  <table>
    <thead><tr><th>Subject</th><th>Rewards</th><th>Sanctions</th><th>Referrals</th><th>On-call</th><th>Removal</th><th>Points</th></tr></thead>
    <tbody>{behaviour_rows}</tbody>
  </table>
  <h2>Homework summary</h2>
  <p>Due today: {homework.get('dueTodayCount', 0)} | Missing: {homework.get('missingCount', 0)} | Weekly homework points: {homework.get('weeklyPoints', 0)}</p>
  <h2>Goal activity status</h2>
  <p>{goal_activity.get('reason', '')}</p>
</body>
</html>"""


def build_class_report_rows(group, class_id):
    school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id).first()
    if not school_class:
        return None, []
    enrollments = SchoolEnrollment.query.filter_by(group_id=group.id, class_id=class_id).all()
    rows = []
    for enrollment in enrollments:
        student = enrollment.student
        if not student:
            continue
        profile = serialize_school_profile(group, student)
        attendance = profile.get('attendanceSummary') or {}
        rows.append({
            'student': student.username,
            'attendance_rate': attendance.get('attendanceRate', 0),
            'today_status': attendance.get('todayStatus', ''),
            'combined_weekly_score': profile.get('scorecards', {}).get('combinedWeeklyScore', 0),
            'daily_points': profile.get('scorecards', {}).get('daily', {}).get('combinedPoints', 0),
            'goal_activity_status': profile.get('goalActivity', {}).get('statusLabel', ''),
            'latest_behaviour_score': profile.get('scorecards', {}).get('latestBehaviourScore', 0),
            'homework_points': profile.get('homework', {}).get('weeklyPoints', 0),
            'missing_homework': profile.get('homework', {}).get('missingCount', 0)
        })
    return school_class, rows


def get_student_behaviour_events(group_id, student_id, limit=20):
    return SchoolBehaviourEvent.query.filter_by(
        group_id=group_id,
        student_id=student_id
    ).order_by(SchoolBehaviourEvent.event_date.desc(), SchoolBehaviourEvent.created_at.desc()).limit(limit).all()


def build_student_behaviour_summary(group_id, student_id):
    events = get_student_behaviour_events(group_id, student_id, limit=50)
    subject_map = {}
    totals = {'reward': 0, 'sanction': 0, 'referral': 0, 'on-call': 0, 'removal': 0}
    for event in events:
        totals[event.kind] = totals.get(event.kind, 0) + 1
        subject_key = event.subject or 'General'
        bucket = subject_map.setdefault(subject_key, {'subject': subject_key, 'reward': 0, 'sanction': 0, 'referral': 0, 'onCall': 0, 'removal': 0, 'pointsDelta': 0})
        if event.kind == 'reward':
            bucket['reward'] += 1
        elif event.kind == 'sanction':
            bucket['sanction'] += 1
        elif event.kind == 'referral':
            bucket['referral'] += 1
        elif event.kind == 'on-call':
            bucket['onCall'] += 1
        elif event.kind == 'removal':
            bucket['removal'] += 1
        bucket['pointsDelta'] += event.points_delta or 0

    return {
        'totals': totals,
        'subjects': sorted(subject_map.values(), key=lambda item: (item['pointsDelta'], item['subject'].lower()))
    }


def serialize_school_profile(group, student, league_standing=None):
    goals = StudentGoal.query.filter_by(
        group_id=group.id,
        student_id=student.id
    ).order_by(StudentGoal.created_at.asc()).all()

    impact_records = SchoolImpactRecord.query.filter_by(
        group_id=group.id,
        student_id=student.id
    ).order_by(SchoolImpactRecord.week_ending.asc()).all()

    linked_habits = []
    member_habit = get_member_habit_entry(group, student.id)
    if member_habit:
        for index, habit in enumerate(member_habit.get('habits', [])):
            linked_habits.append({
                'index': index,
                'name': habit.get('name'),
                'description': habit.get('description') or '',
                'linkedGoalId': habit.get('linkedGoalId'),
                'habitType': habit.get('habitType') or 'boolean',
                'scheduleDays': habit.get('scheduleDays') or [],
                'scheduleTime': habit.get('scheduleTime') or '',
                'durationMinutes': habit.get('durationMinutes') or 30,
                'orderIndex': habit.get('orderIndex', index),
                'combatType': habit.get('combatType') or 'neutral'
            })

    latest_impact = impact_records[-1].to_dict() if impact_records else None
    latest_score = 0
    if impact_records:
        latest_record = impact_records[-1]
        latest_score = (latest_record.positive_points or 0) - (latest_record.negative_points or 0) - ((latest_record.truancy_incidents or 0) * 5)
    habit_recovery = calculate_habit_recovery_metrics(group, student.id)
    performance_card = calculate_weekly_performance_card_metrics(group, student.id)
    weekly_behaviour = calculate_weekly_behaviour_metrics(group, student.id)
    homework_summary = build_student_homework_summary(group, student.id)
    combined_weekly_score = latest_score + habit_recovery['recoveryPoints'] + performance_card['weeklyPoints'] + weekly_behaviour['points'] + homework_summary['weeklyPoints']
    daily_points = build_daily_points_summary(group, student.id)
    lesson_register = build_lesson_register_summary(group, student.id, date.today())
    goal_activity = calculate_goal_activity_status(group, student.id, latest_score, performance_card, habit_recovery)
    interventions = get_student_interventions(group.id, student.id)
    parent_contacts = get_parent_contact_records(group.id, student.id)
    parent_profiles = get_parent_profiles(group.id, student.id)
    attendance_summary = build_attendance_summary(group, student.id)
    behaviour_events = get_student_behaviour_events(group.id, student.id)
    behaviour_summary = build_student_behaviour_summary(group.id, student.id)

    profile = {
        'student': student.to_dict(),
        'goals': [goal.to_dict() for goal in goals],
        'linkedHabits': linked_habits,
        'latestImpact': latest_impact,
        'impactRecords': [record.to_dict() for record in reversed(impact_records)],
        'trend': build_school_trend(impact_records),
        'scorecards': {
            'latestBehaviourScore': latest_score,
            'liveBehaviourPoints': weekly_behaviour['points'],
            'habitRecovery': habit_recovery,
            'performanceCard': performance_card,
            'combinedWeeklyScore': combined_weekly_score,
            'daily': daily_points
        },
        'homework': homework_summary,
        'goalActivity': goal_activity,
        'lessonRegister': lesson_register,
        'attendanceSummary': attendance_summary,
        'behaviourEvents': [event.to_dict() for event in behaviour_events],
        'behaviourSummary': behaviour_summary,
        'interventions': [record.to_dict() for record in interventions],
        'parentProfiles': [record.to_dict() for record in parent_profiles],
        'parentContacts': [record.to_dict() for record in parent_contacts],
        'schoolTimetable': group.school_timetable or []
    }
    profile['leagueStanding'] = league_standing
    return profile


def get_school_students_for_user(group, current_user_id, members=None):
    members = members if members is not None else get_group_members_list(group)

    if group.leader_id == current_user_id or user_has_school_role(group.id, current_user_id, {'school-admin', 'headteacher', 'pastoral-lead'}):
        return list(members)

    if user_has_school_role(group.id, current_user_id, {'teacher'}):
        class_ids = get_teacher_class_ids(group.id, current_user_id)
        return get_students_for_teacher(group, current_user_id, members=members, class_ids=class_ids)

    if any(coach.id == current_user_id for coach in group.coaches):
        assignments = CoachAssignment.query.filter_by(
            coach_id=current_user_id,
            group_id=group.id
        ).all()
        assigned_student_ids = {assignment.student_id for assignment in assignments}
        return [member for member in members if member.id in assigned_student_ids]

    student = next((member for member in members if member.id == current_user_id), None)
    return [student] if student else []


def build_recent_student_risk_window_from_rows(rows):
    by_day = {}
    for row in rows:
        day_key = row.lesson_date.isoformat()
        bucket = by_day.setdefault(day_key, {
            'date': day_key,
            'schoolPoints': 0,
            'absent': 0,
            'late': 0,
            'loggedLessons': 0
        })
        bucket['schoolPoints'] += row.points or 0
        bucket['loggedLessons'] += 1
        if row.attendance_status == 'absent':
            bucket['absent'] += 1
        elif row.attendance_status == 'late':
            bucket['late'] += 1

    ordered_days = [by_day[key] for key in sorted(by_day.keys())]
    return {
        'days': ordered_days,
        'negativeDays': sum(1 for item in ordered_days if item['schoolPoints'] < 0),
        'absenceDays': sum(1 for item in ordered_days if item['absent'] > 0),
        'latenessDays': sum(1 for item in ordered_days if item['late'] > 0)
    }


def build_goal_activity_status_from_snapshot(student_id, latest_score, performance_card, habit_recovery, attendance_summary, risk_window, member_habit=None, active_intervention=None):
    configured_activity = None
    fallback_activity = 'Reflection session'
    if member_habit:
        configured_activity = member_habit.get('goalActivity')
        fallback_activity = member_habit.get('fallbackActivity') or fallback_activity

    has_attendance_lock = attendance_summary.get('attendanceRate', 0) < 80 or risk_window['absenceDays'] >= 2
    has_risk_lock = risk_window['negativeDays'] >= 2 or risk_window['latenessDays'] >= 3
    unlocked = (
        (performance_card.get('weeklyPoints', 0) > 0)
        and latest_score >= 0
        and not active_intervention
        and not has_attendance_lock
        and not has_risk_lock
    )
    if unlocked and configured_activity:
        reason = 'Performance card completed successfully this week.'
    elif active_intervention:
        reason = 'Goal activity locked because there is an active intervention.'
    elif has_attendance_lock:
        reason = 'Goal activity locked because attendance is below the required level.'
    elif has_risk_lock:
        reason = 'Goal activity locked because behaviour or punctuality thresholds were hit repeatedly this week.'
    else:
        reason = 'Goal activity removed this week. Use reflection, behaviour coaching, or mindset lesson.'

    return {
        'activity': configured_activity or 'Goal activity not set',
        'fallbackActivity': fallback_activity,
        'unlocked': unlocked and bool(configured_activity),
        'statusLabel': 'Unlocked' if unlocked and configured_activity else 'Reflection required',
        'reason': reason,
        'lockReasons': {
            'activeIntervention': bool(active_intervention),
            'attendance': has_attendance_lock,
            'behaviour': has_risk_lock
        }
    }


def build_dashboard_lesson_entry(slot, record, lesson_date):
    return {
        **slot,
        'lessonDate': lesson_date.isoformat(),
        'attendanceStatus': record.attendance_status if record else 'present',
        'latenessMinutes': record.lateness_minutes if record else 0,
        'attended': record.attended if record else True,
        'engagement': record.engagement if record else 'green',
        'refocus': record.refocus if record else False,
        'teacherComment': record.teacher_comment if record else '',
        'points': record.points if record else 0,
        'teacher': serialize_lesson_teacher_brief(record.teacher) if record and record.teacher else None,
        'logged': bool(record)
    }


def build_student_homework_summary_maps(assignments, student_ids, today_value=None):
    today_value = today_value or date.today()
    week_start = today_value - timedelta(days=today_value.weekday())
    completed_statuses = {'submitted', 'late', 'reviewed'}
    summary_map = {
        student_id: {
            'dailyPoints': 0,
            'weeklyPoints': 0,
            'upcomingCount': 0,
            'missingCount': 0,
            'dueTodayCount': 0,
            'submittedTodayCount': 0
        }
        for student_id in student_ids
    }
    due_today = 0
    missing_total = 0
    submitted_today = 0
    rows = []

    for assignment in assignments:
        targeted_ids = [student_id for student_id in (assignment.student_ids or []) if student_id in student_ids]
        if not targeted_ids:
            continue

        submissions = [submission for submission in assignment.submissions if submission.student_id in student_ids]
        submission_map = {submission.student_id: submission for submission in submissions}
        completed_map = {
            submission.student_id: submission
            for submission in submissions
            if submission.status in completed_statuses
        }
        completed_count = len(completed_map)
        missing_count = 0

        for student_id in targeted_ids:
            summary = summary_map[student_id]
            submission = submission_map.get(student_id)
            points = calculate_homework_submission_points(assignment, submission, today_value=today_value)
            due_today_flag = bool(assignment.due_date == today_value)
            submitted_today_flag = bool(submission and submission.completed_date == today_value)
            is_overdue = bool(
                assignment.due_date
                and assignment.due_date < today_value
                and student_id not in completed_map
            )

            if assignment.due_date and week_start <= assignment.due_date <= today_value:
                summary['weeklyPoints'] += points
            if due_today_flag or submitted_today_flag:
                summary['dailyPoints'] += points
            if assignment.due_date and assignment.due_date >= today_value:
                summary['upcomingCount'] += 1
            if is_overdue:
                summary['missingCount'] += 1
                missing_count += 1
            if due_today_flag:
                summary['dueTodayCount'] += 1
            if submitted_today_flag:
                summary['submittedTodayCount'] += 1

        if assignment.due_date == today_value:
            due_today += len(targeted_ids)
        submitted_today += sum(1 for submission in submissions if submission.completed_date == today_value)
        missing_total += missing_count
        rows.append({
            'assignmentId': assignment.id,
            'title': assignment.title,
            'dueDate': assignment.due_date.isoformat() if assignment.due_date else None,
            'subject': assignment.subject.name if assignment.subject else '',
            'className': assignment.school_class.name if assignment.school_class else '',
            'studentCount': len(targeted_ids),
            'completedCount': completed_count,
            'missingCount': missing_count,
            'maxPoints': assignment.max_points
        })

    rows.sort(key=lambda item: ((item['dueDate'] or ''), item['title'].lower()))
    return summary_map, {
        'overview': {
            'assignmentCount': len(rows),
            'dueTodayCount': due_today,
            'submittedTodayCount': submitted_today,
            'missingCount': missing_total
        },
        'assignments': rows[:12]
    }


def ensure_automatic_interventions_bulk(group, students, student_metrics, today_value=None):
    today_value = today_value or date.today()
    student_ids = [student.id for student in students]
    if not student_ids:
        return

    student_map = {student.id: student for student in students}
    coach_assignments = CoachAssignment.query.filter(
        CoachAssignment.group_id == group.id,
        CoachAssignment.student_id.in_(student_ids)
    ).order_by(CoachAssignment.student_id.asc(), CoachAssignment.created_at.asc()).all()
    coach_owner_map = {}
    for assignment in coach_assignments:
        coach_owner_map.setdefault(assignment.student_id, assignment.coach_id)

    interventions = InterventionRecord.query.options(
        joinedload(InterventionRecord.owner),
        joinedload(InterventionRecord.staff),
        joinedload(InterventionRecord.student)
    ).filter(
        InterventionRecord.group_id == group.id,
        InterventionRecord.student_id.in_(student_ids)
    ).order_by(
        InterventionRecord.student_id.asc(),
        InterventionRecord.intervention_date.desc(),
        InterventionRecord.created_at.desc()
    ).all()

    latest_by_student = {}
    active_today_by_student = {}
    overdue_by_student = defaultdict(list)
    active_recent_by_student = {}
    for record in interventions:
        latest_by_student.setdefault(record.student_id, record)
        if (
            record.status in {'scheduled', 'monitoring'}
            and record.intervention_date == today_value
        ):
            active_today_by_student.setdefault(record.student_id, record)
        if (
            record.status in {'scheduled', 'monitoring'}
            and record.intervention_date >= today_value - timedelta(days=7)
        ):
            active_recent_by_student.setdefault(record.student_id, record)
        if (
            record.status in {'scheduled', 'monitoring'}
            and record.due_date is not None
            and record.due_date < today_value
        ):
            overdue_by_student[record.student_id].append(record)

    recent_trigger_messages = Message.query.filter(
        Message.group_id == group.id,
        Message.message_type == 'system',
        Message.created_at >= datetime.combine(today_value - timedelta(days=3), datetime.min.time())
    ).all()

    for student in students:
        metrics = student_metrics.get(student.id) or {}
        daily = metrics.get('daily') or {}
        risk_window = metrics.get('riskWindow') or {'negativeDays': 0, 'absenceDays': 0, 'latenessDays': 0}
        latest_impact = metrics.get('latestImpact')
        homework = metrics.get('homework') or {}

        reasons = []
        if daily.get('combinedPoints', 0) < 0:
            reasons.append('Daily points below zero')
        if daily.get('schoolPoints', 0) < 0:
            reasons.append('School lesson score is negative')
        if daily.get('lessonRegisterExpectedLessons', 0) > daily.get('lessonRegisterLoggedLessons', 0):
            reasons.append('Lesson registers missing')
        if latest_impact and (latest_impact.truancy_incidents or 0) > 0:
            reasons.append('Recent truancy incidents')
        if risk_window['negativeDays'] >= 2:
            reasons.append('Multiple negative school days this week')
        if risk_window['absenceDays'] >= 2:
            reasons.append('Repeated absence this week')
        if risk_window['latenessDays'] >= 3:
            reasons.append('Repeated lateness this week')
        if (homework.get('missingCount') or 0) > 0:
            reasons.append('Missing homework needs follow-up')
        if (
            (homework.get('dueTodayCount') or 0) > 0
            and (homework.get('submittedTodayCount') or 0) == 0
            and daily.get('combinedPoints', 0) < 0
        ):
            reasons.append('Homework still available to recover points today')

        owner_id = coach_owner_map.get(student.id) or group.leader_id
        if (homework.get('missingCount') or 0) >= 2:
            has_recent_trigger = any(
                f"homework trigger for {student.username}" in (message.content or '')
                for message in recent_trigger_messages
            )
            if owner_id and not has_recent_trigger:
                create_system_alert(
                    group,
                    owner_id,
                    f"System alert: homework trigger for {student.username}. Repeated missing homework means parent contact should be considered."
                )

        for item in overdue_by_student.get(student.id, []):
            if item.status != 'monitoring':
                item.status = 'monitoring'
                item.next_step = item.next_step or 'Escalated because the action is overdue'
                item.updated_at = datetime.utcnow()
                if item.owner_id:
                    create_system_alert(
                        group,
                        item.owner_id,
                        f"System alert: intervention overdue for {student.username}. Update the action today."
                    )

        if not reasons or student.id in active_today_by_student:
            continue

        if (homework.get('missingCount') or 0) >= 2:
            intervention_type = 'behaviour-coaching'
        elif risk_window['absenceDays'] >= 2:
            intervention_type = 'parent-call'
        elif risk_window['negativeDays'] >= 2:
            intervention_type = 'mindset-lesson'
        else:
            intervention_type = 'reflection-session' if daily.get('combinedPoints', 0) < 0 else 'behaviour-coaching'

        due_date = today_value + timedelta(days=1 if daily.get('combinedPoints', 0) < 0 or risk_window['absenceDays'] >= 2 else 3)
        db.session.add(InterventionRecord(
            group_id=group.id,
            student_id=student.id,
            staff_id=group.leader_id,
            owner_id=owner_id,
            intervention_type=intervention_type,
            status='scheduled',
            intervention_date=today_value,
            due_date=due_date,
            auto_created=True,
            summary='Auto-created from school risk thresholds.',
            next_step='Review student and update intervention outcome'
        ))
        create_intervention_notification(group, student.id, owner_id, intervention_type, due_date)

def build_school_operations_dashboard(group, current_user_id):
    students = get_school_students_for_user(group, current_user_id)
    can_view_ops = can_view_school_operations(group, current_user_id)
    for student in students:
        ensure_automatic_intervention(group, student.id)
    db.session.flush()
    today = date.today()
    weekday = today.strftime('%A')
    timetable_entries = [entry for entry in (group.school_timetable or []) if entry.get('weekday') == weekday]
    lesson_registers = LessonRegister.query.filter_by(
        group_id=group.id,
        lesson_date=today
    ).all()

    visible_student_ids = {student.id for student in students}
    if not can_manage_group(group, current_user_id):
        lesson_registers = [record for record in lesson_registers if record.student_id in visible_student_ids]

    class_map = {}
    subject_map = {}
    for entry in timetable_entries:
        class_key = f"{entry.get('className') or 'Unassigned class'}::{entry.get('subject') or 'Unknown subject'}::{entry.get('startTime') or ''}"
        roster_ids = {int(value) for value in (entry.get('studentIds') or []) if str(value).isdigit()}
        class_students = [student for student in students if not roster_ids or student.id in roster_ids]
        teacher_id = entry.get('teacherId')
        if not can_manage_group(group, current_user_id) and teacher_id and int(teacher_id) != current_user_id:
            continue
        if not class_students:
            continue
        slot_registers = [record for record in lesson_registers if record.timetable_slot_id == entry.get('id')]
        subject_key = entry.get('subject') or 'Unknown subject'
        class_map[class_key] = {
            'slotId': entry.get('id'),
            'className': entry.get('className') or 'Unassigned class',
            'subject': entry.get('subject') or 'Unknown subject',
            'teacherId': teacher_id,
            'teacherName': entry.get('teacherName') or '',
            'room': entry.get('room') or '',
            'startTime': entry.get('startTime') or '',
            'endTime': entry.get('endTime') or '',
            'studentIds': [student.id for student in class_students],
            'students': [student.to_dict() for student in class_students],
            'expectedStudents': len(class_students),
            'loggedStudents': len(slot_registers),
            'missingStudents': max(0, len(class_students) - len(slot_registers)),
            'points': sum(record.points or 0 for record in slot_registers)
        }
        subject_bucket = subject_map.setdefault(subject_key, {
            'subject': subject_key,
            'teacherName': entry.get('teacherName') or '',
            'teacherId': teacher_id,
            'lessons': 0,
            'points': 0,
            'loggedStudents': 0,
            'expectedStudents': 0,
            'negativeLessons': 0,
            'missingStudents': 0
        })
        subject_bucket['lessons'] += 1
        subject_bucket['points'] += sum(record.points or 0 for record in slot_registers)
        subject_bucket['loggedStudents'] += len(slot_registers)
        subject_bucket['expectedStudents'] += len(class_students)
        subject_bucket['missingStudents'] += max(0, len(class_students) - len(slot_registers))
        if sum(record.points or 0 for record in slot_registers) < 0:
            subject_bucket['negativeLessons'] += 1

    interventions = []
    recovered_today = 0
    total_combined = 0
    total_school_points = 0
    total_homework_points = 0
    for student in students:
        profile = serialize_school_profile(group, student)
        daily = profile['scorecards']['daily']
        attendance = profile.get('attendanceSummary') or {}
        homework = profile.get('homework') or {}
        risk_window = build_recent_student_risk_window(group, student.id, days=5)
        total_combined += daily['combinedPoints']
        total_school_points += daily['schoolPoints']
        total_homework_points += homework.get('weeklyPoints', 0)
        if daily['status'] == 'recovered':
            recovered_today += 1

        reasons = []
        if daily['combinedPoints'] < 0:
            reasons.append('Daily points below zero')
        if daily['schoolPoints'] < 0:
            reasons.append('School lesson score is negative')
        if daily.get('lessonRegisterExpectedLessons', 0) > daily.get('lessonRegisterLoggedLessons', 0):
            reasons.append('Lesson registers missing')
        if (profile.get('latestImpact') or {}).get('truancyIncidents', 0) > 0:
            reasons.append('Recent truancy incidents')
        if not profile['goalActivity'].get('unlocked'):
            reasons.append('Goal activity not unlocked')
        if risk_window['negativeDays'] >= 2:
            reasons.append('Repeated negative days')
        if risk_window['absenceDays'] >= 2:
            reasons.append('Repeated absence')
        if attendance.get('attendanceRate', 0) < 80 and attendance.get('attendanceRate', 0) > 0:
            reasons.append('Attendance below 80%')
        if (homework.get('missingCount') or 0) > 0:
            reasons.append('Homework missing')
        if (homework.get('dueTodayCount') or 0) > 0 and (homework.get('submittedTodayCount') or 0) == 0:
            reasons.append('Homework due today')

        auto_flags = []
        if daily['combinedPoints'] < 0:
            auto_flags.append('negative-day')
        if daily['schoolPoints'] < 0:
            auto_flags.append('school-negative')
        if daily.get('lessonRegisterExpectedLessons', 0) > daily.get('lessonRegisterLoggedLessons', 0):
            auto_flags.append('missing-registers')
        if (profile.get('latestImpact') or {}).get('truancyIncidents', 0) > 0:
            auto_flags.append('truancy-risk')
        if not profile['goalActivity'].get('unlocked'):
            auto_flags.append('goal-activity-locked')
        if risk_window['negativeDays'] >= 2:
            auto_flags.append('repeated-negative-days')
        if risk_window['absenceDays'] >= 2:
            auto_flags.append('repeated-absence')
        if risk_window['latenessDays'] >= 3:
            auto_flags.append('repeated-lateness')
        if attendance.get('attendanceRate', 0) < 80 and attendance.get('attendanceRate', 0) > 0:
            auto_flags.append('attendance-below-threshold')
        if (homework.get('missingCount') or 0) > 0:
            auto_flags.append('homework-missing')
        if (homework.get('dueTodayCount') or 0) > 0 and (homework.get('submittedTodayCount') or 0) == 0:
            auto_flags.append('homework-due-today')

        if reasons:
            student_interventions = get_student_interventions(group.id, student.id)
            latest_intervention = student_interventions[0].to_dict() if student_interventions else None
            interventions.append({
                'studentId': student.id,
                'username': student.username,
                'dailyScore': daily['combinedPoints'],
                'schoolScore': daily['schoolPoints'],
                'habitRecoveryPoints': daily['habitRecoveryPoints'],
                'goalActivityStatus': profile['goalActivity']['statusLabel'],
                'attendanceRate': attendance.get('attendanceRate', 0),
                'homeworkMissingCount': homework.get('missingCount', 0),
                'homeworkDueTodayCount': homework.get('dueTodayCount', 0),
                'homeworkWeeklyPoints': homework.get('weeklyPoints', 0),
                'riskWindow': risk_window,
                'latestIntervention': latest_intervention,
                'autoFlags': auto_flags,
                'reasons': reasons[:3],
                'assignedOwner': latest_intervention.get('owner') if latest_intervention else None,
                'recommendedAction': (
                    'Schedule reflection and coach check-in'
                    if daily['combinedPoints'] < 0
                    else 'Monitor lesson engagement and goal follow-through'
                )
            })

    interventions.sort(key=lambda item: (item['dailyScore'], item['schoolScore'], item['username'].lower()))

    visible_registers = len(lesson_registers)
    expected_registers = sum(item['expectedStudents'] for item in class_map.values())
    my_classes_today = [
        class_data for class_data in class_map.values()
        if can_manage_group(group, current_user_id) or (class_data['teacherId'] and int(class_data['teacherId']) == current_user_id)
    ]

    subject_history = []
    seven_days_ago = today - timedelta(days=6)
    history_rows = LessonRegister.query.filter(
        LessonRegister.group_id == group.id,
        LessonRegister.lesson_date >= seven_days_ago,
        LessonRegister.lesson_date <= today
    ).all()
    if not can_manage_group(group, current_user_id):
        history_rows = [row for row in history_rows if row.student_id in visible_student_ids]
    history_map = {}
    for row in history_rows:
        key = (row.subject or 'Unknown subject', row.lesson_date.isoformat())
        history_map.setdefault(key, {'subject': row.subject or 'Unknown subject', 'date': row.lesson_date.isoformat(), 'points': 0, 'entries': 0})
        history_map[key]['points'] += row.points or 0
        history_map[key]['entries'] += 1
    subject_history = sorted(history_map.values(), key=lambda item: (item['date'], item['subject']))
    attendance_analytics = build_attendance_analytics(group, current_user_id, students)
    homework_analytics = build_homework_analytics(group, students)
    behaviour_rows = SchoolBehaviourEvent.query.filter(
        SchoolBehaviourEvent.group_id == group.id,
        SchoolBehaviourEvent.event_date >= today - timedelta(days=13),
        SchoolBehaviourEvent.student_id.in_([student.id for student in students]) if students else False
    ).all() if students else []
    behaviour_subject_map = {}
    for row in behaviour_rows:
        subject_key = row.subject or 'General'
        bucket = behaviour_subject_map.setdefault(subject_key, {'subject': subject_key, 'reward': 0, 'sanction': 0, 'referral': 0, 'onCall': 0, 'removal': 0, 'pointsDelta': 0})
        if row.kind == 'reward':
            bucket['reward'] += 1
        elif row.kind == 'sanction':
            bucket['sanction'] += 1
        elif row.kind == 'referral':
            bucket['referral'] += 1
        elif row.kind == 'on-call':
            bucket['onCall'] += 1
        elif row.kind == 'removal':
            bucket['removal'] += 1
        bucket['pointsDelta'] += row.points_delta or 0
    behaviour_subject_summary = sorted(behaviour_subject_map.values(), key=lambda item: (item['pointsDelta'], item['subject'].lower()))
    overdue_interventions = []
    for item in interventions:
        latest_intervention = item.get('latestIntervention') or {}
        due_date = latest_intervention.get('dueDate')
        if due_date and str(due_date)[:10] < today.isoformat():
            overdue_interventions.append(item)
    staff_accountability = []
    accountability_map = {}
    for class_item in my_classes_today if not can_manage_group(group, current_user_id) else class_map.values():
        teacher_id = class_item.get('teacherId')
        teacher_name = class_item.get('teacherName') or 'Staff'
        key = str(teacher_id or teacher_name)
        bucket = accountability_map.setdefault(key, {
            'teacherId': teacher_id,
            'teacherName': teacher_name,
            'expectedRegisters': 0,
            'loggedRegisters': 0,
            'missingRegisters': 0
        })
        bucket['expectedRegisters'] += class_item.get('expectedStudents', 0)
        bucket['loggedRegisters'] += class_item.get('loggedStudents', 0)
        bucket['missingRegisters'] += class_item.get('missingStudents', 0)
    for bucket in accountability_map.values():
        expected = bucket['expectedRegisters']
        bucket['coverageRate'] = round((bucket['loggedRegisters'] / expected) * 100, 1) if expected else 0
        staff_accountability.append(bucket)
    staff_accountability.sort(key=lambda item: (item['coverageRate'], item['teacherName'].lower()))
    recent_activity = [record.to_dict() for record in get_school_audit_logs(group.id, limit=20)] if can_view_ops else []

    return {
        'date': today.isoformat(),
        'weekday': weekday,
        'overview': {
            'studentCount': len(students),
            'atRiskCount': len([item for item in interventions if item['dailyScore'] < 0]),
            'recoveredTodayCount': recovered_today,
            'overdueActionsCount': len(overdue_interventions),
            'expectedLessonMarks': expected_registers,
            'loggedLessonMarks': visible_registers,
            'averageCombinedDailyScore': round(total_combined / len(students), 1) if students else 0,
            'averageSchoolScore': round(total_school_points / len(students), 1) if students else 0,
            'averageAttendanceRate': round(sum(item['attendanceRate'] for item in attendance_analytics['students']) / len(attendance_analytics['students']), 1) if attendance_analytics['students'] else 0,
            'averageHomeworkPoints': round(total_homework_points / len(students), 1) if students else 0
        },
        'notifications': get_school_system_notifications(group, current_user_id),
        'myClassesToday': sorted(my_classes_today, key=lambda item: (item['startTime'], item['className'].lower(), item['subject'].lower())),
        'myStudentsAtRisk': [item for item in interventions if item['dailyScore'] < 0][:8],
        'overdueInterventions': overdue_interventions[:10],
        'staffAccountability': staff_accountability[:12],
        'attendance': attendance_analytics,
        'homework': homework_analytics,
        'behaviour': {
            'bySubject': behaviour_subject_summary[:12]
        },
        'recentActivity': recent_activity,
        'classSummaries': sorted(class_map.values(), key=lambda item: (item['startTime'], item['className'].lower(), item['subject'].lower())),
        'subjectSummaries': sorted(
            [
                {
                    **item,
                    'averagePointsPerLesson': round(item['points'] / item['lessons'], 1) if item['lessons'] else 0,
                    'coverageRate': round((item['loggedStudents'] / item['expectedStudents']) * 100, 1) if item['expectedStudents'] else 0
                }
                for item in subject_map.values()
            ],
            key=lambda item: (item['averagePointsPerLesson'], item['subject'].lower())
        ),
        'subjectHistory': subject_history,
        'interventions': interventions[:12]
    }


def build_school_operations_dashboard_fast(group, current_user_id):
    all_members = get_group_members_list(group)
    students = get_school_students_for_user(group, current_user_id, members=all_members)
    can_view_ops = can_view_school_operations(group, current_user_id)
    today = date.today()
    weekday = today.strftime('%A')
    week_start = today - timedelta(days=today.weekday())
    risk_start = today - timedelta(days=4)
    fourteen_day_start = today - timedelta(days=13)
    seven_days_ago = today - timedelta(days=6)
    visible_student_ids = {student.id for student in students}
    member_habit_map = {}
    if group.active_challenge and group.active_challenge.member_habits:
        for member_habit in group.active_challenge.member_habits:
            raw_member = member_habit.get('member')
            if str(raw_member).isdigit():
                member_habit_map[int(raw_member)] = member_habit

    lesson_rows = LessonRegister.query.options(
        joinedload(LessonRegister.teacher)
    ).filter(
        LessonRegister.group_id == group.id,
        LessonRegister.student_id.in_(visible_student_ids) if visible_student_ids else False,
        LessonRegister.lesson_date >= fourteen_day_start,
        LessonRegister.lesson_date <= today
    ).all() if visible_student_ids else []

    performance_cards = PerformanceCard.query.filter(
        PerformanceCard.group_id == group.id,
        PerformanceCard.student_id.in_(visible_student_ids) if visible_student_ids else False,
        PerformanceCard.card_date >= week_start,
        PerformanceCard.card_date <= today
    ).all() if visible_student_ids else []

    behaviour_rows = SchoolBehaviourEvent.query.filter(
        SchoolBehaviourEvent.group_id == group.id,
        SchoolBehaviourEvent.student_id.in_(visible_student_ids) if visible_student_ids else False,
        SchoolBehaviourEvent.event_date >= fourteen_day_start,
        SchoolBehaviourEvent.event_date <= today
    ).all() if visible_student_ids else []

    impact_records = SchoolImpactRecord.query.filter(
        SchoolImpactRecord.group_id == group.id,
        SchoolImpactRecord.student_id.in_(visible_student_ids) if visible_student_ids else False
    ).order_by(
        SchoolImpactRecord.student_id.asc(),
        SchoolImpactRecord.week_ending.asc()
    ).all() if visible_student_ids else []

    homework_assignments = SchoolHomeworkAssignment.query.options(
        joinedload(SchoolHomeworkAssignment.school_class).joinedload(SchoolClass.room),
        joinedload(SchoolHomeworkAssignment.subject),
        joinedload(SchoolHomeworkAssignment.created_by),
        selectinload(SchoolHomeworkAssignment.submissions).joinedload(SchoolHomeworkSubmission.student),
        selectinload(SchoolHomeworkAssignment.submissions).joinedload(SchoolHomeworkSubmission.submitted_by),
        selectinload(SchoolHomeworkAssignment.submissions).joinedload(SchoolHomeworkSubmission.reviewed_by)
    ).filter_by(group_id=group.id).order_by(
        SchoolHomeworkAssignment.due_date.asc(),
        SchoolHomeworkAssignment.created_at.desc()
    ).all()

    lesson_rows_by_student = defaultdict(list)
    lesson_rows_today_by_student = defaultdict(list)
    lesson_rows_today_by_slot = defaultdict(list)
    for row in lesson_rows:
        lesson_rows_by_student[row.student_id].append(row)
        if row.lesson_date == today:
            lesson_rows_today_by_student[row.student_id].append(row)
            lesson_rows_today_by_slot[row.timetable_slot_id].append(row)

    performance_cards_by_student = defaultdict(list)
    today_card_by_student = {}
    for card in performance_cards:
        performance_cards_by_student[card.student_id].append(card)
        if card.card_date == today:
            today_card_by_student[card.student_id] = card

    behaviour_rows_by_student = defaultdict(list)
    for row in behaviour_rows:
        behaviour_rows_by_student[row.student_id].append(row)

    latest_impact_by_student = {}
    for record in impact_records:
        latest_impact_by_student[record.student_id] = record

    homework_summary_map, homework_analytics = build_student_homework_summary_maps(
        homework_assignments,
        visible_student_ids,
        today_value=today
    )

    student_metrics = {}
    for student in students:
        student_lesson_rows = lesson_rows_by_student.get(student.id, [])
        today_lesson_rows = lesson_rows_today_by_student.get(student.id, [])
        week_lesson_rows = [row for row in student_lesson_rows if row.lesson_date >= week_start]
        risk_window_rows = [row for row in student_lesson_rows if row.lesson_date >= risk_start]
        attendance_summary = build_attendance_summary_from_rows(week_lesson_rows, today_value=today)
        risk_window = build_recent_student_risk_window_from_rows(risk_window_rows)
        latest_impact = latest_impact_by_student.get(student.id)
        latest_score = 0
        if latest_impact:
            latest_score = (
                (latest_impact.positive_points or 0)
                - (latest_impact.negative_points or 0)
                - ((latest_impact.truancy_incidents or 0) * 5)
            )

        today_performance_card = today_card_by_student.get(student.id)
        today_performance = {
            'points': today_performance_card.total_points if today_performance_card else 0,
            'logged': bool(today_performance_card)
        }
        today_behaviour_rows = [row for row in behaviour_rows_by_student.get(student.id, []) if row.event_date == today]
        weekly_behaviour_rows = [row for row in behaviour_rows_by_student.get(student.id, []) if row.event_date >= week_start]
        today_habit = calculate_today_habit_recovery_metrics(group, student.id)
        weekly_habit = calculate_habit_recovery_metrics(group, student.id)
        homework_summary = homework_summary_map.get(student.id, {
            'dailyPoints': 0,
            'weeklyPoints': 0,
            'upcomingCount': 0,
            'missingCount': 0,
            'dueTodayCount': 0,
            'submittedTodayCount': 0
        })

        school_points = sum(row.points or 0 for row in today_lesson_rows) if today_lesson_rows else today_performance['points']
        school_source = 'lesson-register' if today_lesson_rows else 'performance-card'
        combined_points = (
            school_points
            + today_habit['recoveryPoints']
            + sum(row.points_delta or 0 for row in today_behaviour_rows)
            + homework_summary.get('dailyPoints', 0)
        )
        recovery_status = 'on-track'
        if school_points < 0 and combined_points >= 0:
            recovery_status = 'recovered'
        elif combined_points < 0:
            recovery_status = 'needs-action'

        student_metrics[student.id] = {
            'attendanceSummary': attendance_summary,
            'riskWindow': risk_window,
            'latestImpact': latest_impact,
            'latestScore': latest_score,
            'performanceCard': {
                'weeklyPoints': sum(card.total_points or 0 for card in performance_cards_by_student.get(student.id, [])),
                'daysCompleted': len(performance_cards_by_student.get(student.id, []))
            },
            'habitRecovery': weekly_habit,
            'homework': homework_summary,
            'daily': {
                'schoolPoints': school_points,
                'habitRecoveryPoints': today_habit['recoveryPoints'],
                'behaviourPoints': sum(row.points_delta or 0 for row in today_behaviour_rows),
                'homeworkPoints': homework_summary.get('dailyPoints', 0),
                'combinedPoints': combined_points,
                'status': recovery_status,
                'habitsCompleted': today_habit['completedCount'],
                'habitsScheduled': today_habit['scheduledCount'],
                'habitCompletionRate': today_habit['completionRate'],
                'performanceLogged': today_performance['logged'],
                'lessonRegisterLogged': bool(today_lesson_rows),
                'lessonRegisterPoints': sum(row.points or 0 for row in today_lesson_rows),
                'lessonRegisterExpectedLessons': 0,
                'lessonRegisterLoggedLessons': len(today_lesson_rows),
                'schoolSource': school_source,
                'remainingRecoveryPotential': max(0, 3 - today_habit['recoveryPoints']) + max(0, homework_summary.get('dueTodayCount', 0) * 3 - homework_summary.get('dailyPoints', 0)),
                'homeworkDueTodayCount': homework_summary.get('dueTodayCount', 0),
                'homeworkSubmittedTodayCount': homework_summary.get('submittedTodayCount', 0),
                'behaviourEventCount': len(today_behaviour_rows),
                'date': today.isoformat()
            },
            'weeklyBehaviourPoints': sum(row.points_delta or 0 for row in weekly_behaviour_rows)
        }

    timetable_entries = [entry for entry in (group.school_timetable or []) if entry.get('weekday') == weekday]
    class_map = {}
    subject_map = {}
    for entry in timetable_entries:
        class_key = f"{entry.get('className') or 'Unassigned class'}::{entry.get('subject') or 'Unknown subject'}::{entry.get('startTime') or ''}"
        roster_ids = {int(value) for value in (entry.get('studentIds') or []) if str(value).isdigit()}
        class_students = [student for student in students if not roster_ids or student.id in roster_ids]
        teacher_id = entry.get('teacherId')
        try:
            teacher_id_int = int(teacher_id) if teacher_id not in (None, '') else None
        except (TypeError, ValueError):
            teacher_id_int = None
        if not can_manage_group(group, current_user_id) and teacher_id_int and teacher_id_int != current_user_id:
            continue
        if not class_students:
            continue

        class_student_ids = {student.id for student in class_students}
        slot_registers = [record for record in lesson_rows_today_by_slot.get(entry.get('id'), []) if record.student_id in class_student_ids]
        slot_points = sum(record.points or 0 for record in slot_registers)
        class_map[class_key] = {
            'slotId': entry.get('id'),
            'className': entry.get('className') or 'Unassigned class',
            'subject': entry.get('subject') or 'Unknown subject',
            'teacherId': teacher_id,
            'teacherName': entry.get('teacherName') or '',
            'room': entry.get('room') or '',
            'startTime': entry.get('startTime') or '',
            'endTime': entry.get('endTime') or '',
            'studentIds': [student.id for student in class_students],
            'students': [serialize_school_user_brief(student) for student in class_students],
            'expectedStudents': len(class_students),
            'loggedStudents': len(slot_registers),
            'missingStudents': max(0, len(class_students) - len(slot_registers)),
            'points': slot_points
        }

        subject_key = entry.get('subject') or 'Unknown subject'
        subject_bucket = subject_map.setdefault(subject_key, {
            'subject': subject_key,
            'teacherName': entry.get('teacherName') or '',
            'teacherId': teacher_id,
            'lessons': 0,
            'points': 0,
            'loggedStudents': 0,
            'expectedStudents': 0,
            'negativeLessons': 0,
            'missingStudents': 0
        })
        subject_bucket['lessons'] += 1
        subject_bucket['points'] += slot_points
        subject_bucket['loggedStudents'] += len(slot_registers)
        subject_bucket['expectedStudents'] += len(class_students)
        subject_bucket['missingStudents'] += max(0, len(class_students) - len(slot_registers))
        if slot_points < 0:
            subject_bucket['negativeLessons'] += 1

        for student in class_students:
            student_metrics[student.id]['daily']['lessonRegisterExpectedLessons'] += 1

    ensure_automatic_interventions_bulk(group, students, student_metrics, today_value=today)
    db.session.flush()

    intervention_rows = InterventionRecord.query.options(
        joinedload(InterventionRecord.owner),
        joinedload(InterventionRecord.staff)
    ).filter(
        InterventionRecord.group_id == group.id,
        InterventionRecord.student_id.in_(visible_student_ids) if visible_student_ids else False
    ).order_by(
        InterventionRecord.student_id.asc(),
        InterventionRecord.intervention_date.desc(),
        InterventionRecord.created_at.desc()
    ).all() if visible_student_ids else []

    latest_intervention_map = {}
    active_recent_intervention_map = {}
    for record in intervention_rows:
        latest_intervention_map.setdefault(record.student_id, record)
        if record.status in {'scheduled', 'monitoring'} and record.intervention_date >= today - timedelta(days=7):
            active_recent_intervention_map.setdefault(record.student_id, record)

    interventions = []
    recovered_today = 0
    total_combined = 0
    total_school_points = 0
    total_homework_points = 0
    for student in students:
        metrics = student_metrics.get(student.id) or {}
        daily = metrics.get('daily') or {}
        attendance = metrics.get('attendanceSummary') or {}
        homework = metrics.get('homework') or {}
        risk_window = metrics.get('riskWindow') or {'negativeDays': 0, 'absenceDays': 0, 'latenessDays': 0}
        latest_impact = metrics.get('latestImpact')
        latest_intervention_record = latest_intervention_map.get(student.id)
        goal_activity = build_goal_activity_status_from_snapshot(
            student.id,
            metrics.get('latestScore', 0),
            metrics.get('performanceCard') or {'weeklyPoints': 0},
            metrics.get('habitRecovery') or {'recoveryPoints': 0},
            attendance,
            risk_window,
            member_habit=member_habit_map.get(student.id),
            active_intervention=active_recent_intervention_map.get(student.id)
        )

        total_combined += daily.get('combinedPoints', 0)
        total_school_points += daily.get('schoolPoints', 0)
        total_homework_points += homework.get('weeklyPoints', 0)
        if daily.get('status') == 'recovered':
            recovered_today += 1

        reasons = []
        if daily.get('combinedPoints', 0) < 0:
            reasons.append('Daily points below zero')
        if daily.get('schoolPoints', 0) < 0:
            reasons.append('School lesson score is negative')
        if daily.get('lessonRegisterExpectedLessons', 0) > daily.get('lessonRegisterLoggedLessons', 0):
            reasons.append('Lesson registers missing')
        if latest_impact and (latest_impact.truancy_incidents or 0) > 0:
            reasons.append('Recent truancy incidents')
        if not goal_activity.get('unlocked'):
            reasons.append('Goal activity not unlocked')
        if risk_window['negativeDays'] >= 2:
            reasons.append('Repeated negative days')
        if risk_window['absenceDays'] >= 2:
            reasons.append('Repeated absence')
        if attendance.get('attendanceRate', 0) < 80 and attendance.get('attendanceRate', 0) > 0:
            reasons.append('Attendance below 80%')
        if (homework.get('missingCount') or 0) > 0:
            reasons.append('Homework missing')
        if (homework.get('dueTodayCount') or 0) > 0 and (homework.get('submittedTodayCount') or 0) == 0:
            reasons.append('Homework due today')

        auto_flags = []
        if daily.get('combinedPoints', 0) < 0:
            auto_flags.append('negative-day')
        if daily.get('schoolPoints', 0) < 0:
            auto_flags.append('school-negative')
        if daily.get('lessonRegisterExpectedLessons', 0) > daily.get('lessonRegisterLoggedLessons', 0):
            auto_flags.append('missing-registers')
        if latest_impact and (latest_impact.truancy_incidents or 0) > 0:
            auto_flags.append('truancy-risk')
        if not goal_activity.get('unlocked'):
            auto_flags.append('goal-activity-locked')
        if risk_window['negativeDays'] >= 2:
            auto_flags.append('repeated-negative-days')
        if risk_window['absenceDays'] >= 2:
            auto_flags.append('repeated-absence')
        if risk_window['latenessDays'] >= 3:
            auto_flags.append('repeated-lateness')
        if attendance.get('attendanceRate', 0) < 80 and attendance.get('attendanceRate', 0) > 0:
            auto_flags.append('attendance-below-threshold')
        if (homework.get('missingCount') or 0) > 0:
            auto_flags.append('homework-missing')
        if (homework.get('dueTodayCount') or 0) > 0 and (homework.get('submittedTodayCount') or 0) == 0:
            auto_flags.append('homework-due-today')

        if reasons:
            serialized_latest = serialize_intervention_record_brief(latest_intervention_record)
            interventions.append({
                'studentId': student.id,
                'username': student.username,
                'dailyScore': daily.get('combinedPoints', 0),
                'schoolScore': daily.get('schoolPoints', 0),
                'habitRecoveryPoints': daily.get('habitRecoveryPoints', 0),
                'goalActivityStatus': goal_activity.get('statusLabel'),
                'attendanceRate': attendance.get('attendanceRate', 0),
                'homeworkMissingCount': homework.get('missingCount', 0),
                'homeworkDueTodayCount': homework.get('dueTodayCount', 0),
                'homeworkWeeklyPoints': homework.get('weeklyPoints', 0),
                'riskWindow': risk_window,
                'latestIntervention': serialized_latest,
                'autoFlags': auto_flags,
                'reasons': reasons[:3],
                'assignedOwner': serialized_latest.get('owner') if serialized_latest else None,
                'recommendedAction': (
                    'Schedule reflection and coach check-in'
                    if daily.get('combinedPoints', 0) < 0
                    else 'Monitor lesson engagement and goal follow-through'
                )
            })

    interventions.sort(key=lambda item: (item['dailyScore'], item['schoolScore'], item['username'].lower()))
    visible_registers = sum(len(rows) for rows in lesson_rows_today_by_student.values())
    expected_registers = sum(item['expectedStudents'] for item in class_map.values())
    my_classes_today = [
        class_data for class_data in class_map.values()
        if can_manage_group(group, current_user_id) or str(class_data.get('teacherId') or '') == str(current_user_id)
    ]

    history_map = {}
    for row in lesson_rows:
        if row.lesson_date < seven_days_ago:
            continue
        key = (row.subject or 'Unknown subject', row.lesson_date.isoformat())
        history_map.setdefault(key, {
            'subject': row.subject or 'Unknown subject',
            'date': row.lesson_date.isoformat(),
            'points': 0,
            'entries': 0
        })
        history_map[key]['points'] += row.points or 0
        history_map[key]['entries'] += 1
    subject_history = sorted(history_map.values(), key=lambda item: (item['date'], item['subject']))

    behaviour_subject_map = {}
    for row in behaviour_rows:
        subject_key = row.subject or 'General'
        bucket = behaviour_subject_map.setdefault(subject_key, {
            'subject': subject_key,
            'reward': 0,
            'sanction': 0,
            'referral': 0,
            'onCall': 0,
            'removal': 0,
            'pointsDelta': 0
        })
        if row.kind == 'reward':
            bucket['reward'] += 1
        elif row.kind == 'sanction':
            bucket['sanction'] += 1
        elif row.kind == 'referral':
            bucket['referral'] += 1
        elif row.kind == 'on-call':
            bucket['onCall'] += 1
        elif row.kind == 'removal':
            bucket['removal'] += 1
        bucket['pointsDelta'] += row.points_delta or 0
    behaviour_subject_summary = sorted(behaviour_subject_map.values(), key=lambda item: (item['pointsDelta'], item['subject'].lower()))

    overdue_interventions = []
    for item in interventions:
        latest_intervention = item.get('latestIntervention') or {}
        due_date = latest_intervention.get('dueDate')
        if due_date and str(due_date)[:10] < today.isoformat():
            overdue_interventions.append(item)

    accountability_map = {}
    accountability_source = my_classes_today if not can_manage_group(group, current_user_id) else class_map.values()
    for class_item in accountability_source:
        teacher_id = class_item.get('teacherId')
        teacher_name = class_item.get('teacherName') or 'Staff'
        key = str(teacher_id or teacher_name)
        bucket = accountability_map.setdefault(key, {
            'teacherId': teacher_id,
            'teacherName': teacher_name,
            'expectedRegisters': 0,
            'loggedRegisters': 0,
            'missingRegisters': 0
        })
        bucket['expectedRegisters'] += class_item.get('expectedStudents', 0)
        bucket['loggedRegisters'] += class_item.get('loggedStudents', 0)
        bucket['missingRegisters'] += class_item.get('missingStudents', 0)

    staff_accountability = []
    for bucket in accountability_map.values():
        expected = bucket['expectedRegisters']
        bucket['coverageRate'] = round((bucket['loggedRegisters'] / expected) * 100, 1) if expected else 0
        staff_accountability.append(bucket)
    staff_accountability.sort(key=lambda item: (item['coverageRate'], item['teacherName'].lower()))

    attendance_analytics = build_attendance_analytics(group, current_user_id, students, lesson_rows=lesson_rows)
    recent_activity = [serialize_audit_log_brief(record) for record in get_school_audit_logs(group.id, limit=20)] if can_view_ops else []

    return {
        'date': today.isoformat(),
        'weekday': weekday,
        'overview': {
            'studentCount': len(students),
            'atRiskCount': len([item for item in interventions if item['dailyScore'] < 0]),
            'recoveredTodayCount': recovered_today,
            'overdueActionsCount': len(overdue_interventions),
            'expectedLessonMarks': expected_registers,
            'loggedLessonMarks': visible_registers,
            'averageCombinedDailyScore': round(total_combined / len(students), 1) if students else 0,
            'averageSchoolScore': round(total_school_points / len(students), 1) if students else 0,
            'averageAttendanceRate': round(sum(item['attendanceRate'] for item in attendance_analytics['students']) / len(attendance_analytics['students']), 1) if attendance_analytics['students'] else 0,
            'averageHomeworkPoints': round(total_homework_points / len(students), 1) if students else 0
        },
        'notifications': get_school_system_notifications(group, current_user_id),
        'myClassesToday': sorted(my_classes_today, key=lambda item: (item['startTime'], item['className'].lower(), item['subject'].lower())),
        'myStudentsAtRisk': [item for item in interventions if item['dailyScore'] < 0][:8],
        'overdueInterventions': overdue_interventions[:10],
        'staffAccountability': staff_accountability[:12],
        'attendance': attendance_analytics,
        'homework': homework_analytics,
        'behaviour': {
            'bySubject': behaviour_subject_summary[:12]
        },
        'recentActivity': recent_activity,
        'classSummaries': sorted(class_map.values(), key=lambda item: (item['startTime'], item['className'].lower(), item['subject'].lower())),
        'subjectSummaries': sorted(
            [
                {
                    **item,
                    'averagePointsPerLesson': round(item['points'] / item['lessons'], 1) if item['lessons'] else 0,
                    'coverageRate': round((item['loggedStudents'] / item['expectedStudents']) * 100, 1) if item['expectedStudents'] else 0
                }
                for item in subject_map.values()
            ],
            key=lambda item: (item['averagePointsPerLesson'], item['subject'].lower())
        ),
        'subjectHistory': subject_history,
        'interventions': interventions[:12]
    }


@groups_bp.route('/<group_id>/school-timetable', methods=['PUT'])
@jwt_required()
def update_school_timetable(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        is_group_coach = any(coach.id == current_user_id for coach in group.coaches)
        if not can_manage_school(group, current_user_id) and not is_group_coach:
            return jsonify({'error': 'Only school managers or coaches can update the school timetable'}), 403

        data = request.get_json() or {}
        entries = data.get('entries', [])
        if not isinstance(entries, list):
            return jsonify({'error': 'entries must be an array'}), 400

        allowed_teacher_ids = {group.leader_id, *[coach.id for coach in group.coaches]}
        school_roles = SchoolRoleAssignment.query.filter(
            SchoolRoleAssignment.group_id == group.id,
            SchoolRoleAssignment.role.in_(('teacher', 'headteacher', 'pastoral-lead', 'school-admin'))
        ).all()
        allowed_teacher_ids.update(assignment.user_id for assignment in school_roles)
        subjects = {subject.id: subject for subject in SchoolSubject.query.filter_by(group_id=group.id).all()}
        rooms = {room.id: room for room in SchoolRoom.query.filter_by(group_id=group.id).all()}
        classes = {school_class.id: school_class for school_class in SchoolClass.query.filter_by(group_id=group.id).all()}
        sanitized_entries = []
        for entry in entries:
            teacher_id = entry.get('teacherId')
            if teacher_id is not None:
                try:
                    teacher_id = int(teacher_id)
                except (TypeError, ValueError):
                    teacher_id = None
            if teacher_id not in allowed_teacher_ids:
                teacher_id = None
            subject_id = entry.get('subjectId')
            room_id = entry.get('roomId')
            class_id = entry.get('classId')
            try:
                subject_id = int(subject_id) if subject_id is not None and str(subject_id) != '' else None
            except (TypeError, ValueError):
                subject_id = None
            try:
                room_id = int(room_id) if room_id is not None and str(room_id) != '' else None
            except (TypeError, ValueError):
                room_id = None
            try:
                class_id = int(class_id) if class_id is not None and str(class_id) != '' else None
            except (TypeError, ValueError):
                class_id = None

            subject = subjects.get(subject_id)
            room = rooms.get(room_id)
            school_class = classes.get(class_id)
            student_ids = entry.get('studentIds') or []
            if school_class:
                student_ids = [
                    enrollment.student_id
                    for enrollment in SchoolEnrollment.query.filter_by(group_id=group.id, class_id=school_class.id).all()
                ]

            sanitized_entries.append({
                **entry,
                'teacherId': teacher_id,
                'teacherName': User.query.get(teacher_id).username if teacher_id and User.query.get(teacher_id) else entry.get('teacherName'),
                'subjectId': subject_id,
                'subject': subject.name if subject else entry.get('subject'),
                'roomId': room_id,
                'room': room.name if room else entry.get('room'),
                'classId': class_id,
                'className': school_class.name if school_class else entry.get('className'),
                'studentIds': student_ids
            })

        group.school_timetable = normalize_timetable_entries(sanitized_entries)
        flag_modified(group, 'school_timetable')
        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'timetable',
            'Updated school timetable',
            description=f"Saved {len(sanitized_entries)} timetable slot(s).",
            metadata={'slotCount': len(sanitized_entries)}
        )
        db.session.commit()
        return jsonify({'schoolTimetable': group.school_timetable or []}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/create', methods=['POST'])
@jwt_required()
def create_group():
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.is_active or user.account_role != 'admin':
            return jsonify({'error': 'Only admin accounts can create schools'}), 403

        data = request.get_json() or {}
        name = data.get('name')
        password = data.get('password')
        group_type = data.get('groupType', 'school')

        if not name or not password:
            return jsonify({'error': 'Name and password are required'}), 400

        if group_type not in ALLOWED_GROUP_TYPES:
            return jsonify({'error': 'Invalid group type'}), 400

        group_id = str(uuid.uuid4())[:8]
        group = Group(
            name=name,
            group_id=group_id,
            password=password,
            leader_id=current_user_id,
            group_type=group_type,
            is_legacy=False,
        )
        db.session.add(group)
        db.session.flush()
        user.leading_groups.append(group)
        db.session.add(SchoolRoleAssignment(
            group_id=group.id,
            user_id=user.id,
            role='school-admin',
        ))
        db.session.commit()
        return jsonify({'group': serialize_group_for_user(group, current_user_id)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/join', methods=['POST'])
@jwt_required()
def join_group():
    try:
        data = request.get_json()
        group_id = data.get('groupId')
        password = data.get('password')
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if group.password != password:
            return jsonify({'error': 'Invalid password'}), 401
        if not group.is_legacy:
            return jsonify({'error': 'New school accounts are created and assigned by an admin'}), 403
        user = User.query.get(get_jwt_identity())
        if group in user.groups:
            return jsonify({'error': 'Already a member of this group'}), 400
        group.members.append(user)
        db.session.commit()
        return jsonify({'group': serialize_group_for_user(group, user.id)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/challenge', methods=['POST'])
@jwt_required()
def create_challenge():
    try:
        data = request.get_json()
        group_id = data.get('groupId')
        start_date = datetime.fromisoformat(data.get('startDate'))
        end_date = datetime.fromisoformat(data.get('endDate'))
        member_habits = data.get('memberHabits')
        course_id = data.get('courseId')
        course_required_member_ids = data.get('courseRequiredMemberIds')  # [] = all, else [id,...]
        group = Group.query.filter_by(group_id=group_id).first()
        current_user_id = int(get_jwt_identity())
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Group not found or unauthorized'}), 404

        # Validate course: if course attached, challenge must be >= course sections in weeks. Course can be from any group the leader leads.
        if course_id:
            course = Course.query.get(course_id)
            if not course:
                return jsonify({'error': 'Course not found'}), 400
            course_group = Group.query.get(course.group_id)
            if not course_group or not can_manage_group(course_group, current_user_id):
                return jsonify({'error': 'Course not found or you do not lead the group that owns it'}), 400
            sections_count = CourseSection.query.filter_by(course_id=course_id).count()
            challenge_weeks = (end_date - start_date).days / 7.0
            if challenge_weeks < sections_count:
                return jsonify({'error': f'Challenge must be at least {sections_count} weeks for this course'}), 400

        # Add joinedAt to each member_habits entry (for late joiner logic)
        start_iso = start_date.date().isoformat() if hasattr(start_date, 'date') else start_date.isoformat()[:10]
        for mh in (member_habits or []):
            if isinstance(mh, dict) and 'joinedAt' not in mh:
                mh['joinedAt'] = start_iso

        challenge = GroupChallenge(
            group_id=group.id,
            start_date=start_date,
            end_date=end_date,
            member_habits=member_habits,
            course_id=course_id or None,
            course_required_member_ids=course_required_member_ids if course_required_member_ids is not None else []
        )
        db.session.add(challenge)
        group.active_challenge = challenge
        for member in group.members:
            member.active_group_challenges.append(challenge)
        db.session.commit()
        return jsonify({'challenge': challenge.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/add-members', methods=['POST'])
@jwt_required()
def add_members_to_challenge(group_id, challenge_id):
    """Add group members to the active challenge (same dates as original). Only leader. Members already in challenge are ignored."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only the group leader can add members to the challenge'}), 403
        if not group.active_challenge or group.active_challenge.id != challenge_id:
            return jsonify({'error': 'Challenge not found or not the active challenge'}), 404

        challenge = group.active_challenge
        data = request.get_json() or {}
        member_ids = data.get('memberIds', [])
        if not member_ids:
            return jsonify({'error': 'memberIds array is required'}), 400

        # Existing challenge member ids (from member_habits)
        existing_member_ids = {str(mh.get('member')) for mh in (challenge.member_habits or [])}
        existing_member_ids |= {str(mh.get('member', {}).get('id')) for mh in (challenge.member_habits or []) if isinstance(mh.get('member'), dict)}

        member_habits = list(challenge.member_habits or [])
        added = []

        for mid in member_ids:
            mid_str = str(mid)
            if mid_str in existing_member_ids:
                continue
            user = User.query.get(mid)
            if not user:
                continue
            # Must be a member of the group
            if not any(m.id == user.id for m in group.members):
                continue
            # Only add to user_active_challenges if not already in this challenge (avoids UniqueViolation)
            if challenge not in user.active_group_challenges:
                user.active_group_challenges.append(challenge)
            # Add member_habits entry with empty habits; joinedAt = now for late joiner logic
            member_habits.append({'member': user.id, 'habits': [], 'joinedAt': date.today().isoformat()})
            existing_member_ids.add(mid_str)
            added.append(user.id)

        if not added:
            return jsonify({
                'message': 'No new members added (none selected or all already in challenge)',
                'group': serialize_group_for_user(group, current_user_id)
            }), 200

        challenge.member_habits = member_habits
        flag_modified(challenge, 'member_habits')
        db.session.commit()
        return jsonify({
            'message': f'Added {len(added)} member(s) to the challenge',
            'group': serialize_group_for_user(group, current_user_id)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/member-habits', methods=['PUT'])
@jwt_required()
def update_challenge_member_habits(group_id, challenge_id):
    """Update member_habits for the active challenge (leader only). Use this to set habits for new members or edit existing ones."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only the group leader can update challenge habits'}), 403
        if not group.active_challenge or group.active_challenge.id != challenge_id:
            return jsonify({'error': 'Challenge not found or not the active challenge'}), 404

        challenge = group.active_challenge
        data = request.get_json() or {}
        member_habits = data.get('memberHabits')
        if member_habits is None:
            return jsonify({'error': 'memberHabits array is required'}), 400

        challenge.member_habits = member_habits
        flag_modified(challenge, 'member_habits')
        db.session.commit()
        return jsonify({'message': 'Challenge habits updated', 'group': serialize_group_for_user(group, current_user_id)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/my-groups', methods=['GET'])
@jwt_required()
def get_my_groups():
    try:
        user = User.query.get(int(get_jwt_identity()))
        role_groups = Group.query.join(
            SchoolRoleAssignment,
            SchoolRoleAssignment.group_id == Group.id
        ).filter(
            SchoolRoleAssignment.user_id == user.id
        ).all()
        coaching_groups = list(user.coaching_groups) if hasattr(user, 'coaching_groups') else []
        member_groups = {group.id: group for group in user.groups}
        for group in role_groups + coaching_groups:
            if group.id not in member_groups and group not in user.leading_groups:
                member_groups[group.id] = group
        legacy_groups = {}
        current_groups = {}
        for group in list(member_groups.values()) + list(user.leading_groups):
            target = legacy_groups if group.is_legacy else current_groups
            target[group.id] = group

        if user.account_role == 'student':
            current_school_ids = {
                group.id
                for group in current_groups.values()
                if getattr(group, 'group_type', 'school') == 'school'
            }
            if len(current_school_ids) > 1:
                preferred_assignment = SchoolRoleAssignment.query.filter(
                    SchoolRoleAssignment.user_id == user.id,
                    SchoolRoleAssignment.role == 'student',
                    SchoolRoleAssignment.group_id.in_(current_school_ids),
                ).order_by(
                    SchoolRoleAssignment.updated_at.desc(),
                    SchoolRoleAssignment.id.desc(),
                ).first()
                preferred_school_id = (
                    preferred_assignment.group_id
                    if preferred_assignment
                    else sorted(current_school_ids)[0]
                )
                current_groups = {
                    group_id: group
                    for group_id, group in current_groups.items()
                    if group_id not in current_school_ids or group_id == preferred_school_id
                }

        leading_current = [
            group
            for group in user.leading_groups
            if not group.is_legacy and group.id in current_groups
        ]
        leading_legacy = [group for group in user.leading_groups if group.is_legacy]
        return jsonify({
            'memberOf': [
                serialize_group_for_user(group, user.id)
                for group in current_groups.values()
                if group not in leading_current
            ],
            'leading': [serialize_group_for_user(group, user.id) for group in leading_current],
            'legacy': {
                'memberOf': [
                    serialize_group_for_user(group, user.id)
                    for group in legacy_groups.values()
                    if group not in leading_legacy
                ],
                'leading': [serialize_group_for_user(group, user.id) for group in leading_legacy],
            },
        }), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/ai-assistant/config', methods=['GET'])
@jwt_required()
def get_ai_assistant_config():
    current_user = User.query.get(int(get_jwt_identity()))
    if not current_user or not current_user.is_active:
        return jsonify({'error': 'Active account required'}), 403
    page = str(request.args.get('page') or 'app').strip()
    return jsonify({
        'config': get_copilot_public_config(current_user.account_role, page),
        'contract': structured_contract_metadata('rituo_copilot_response'),
    }), 200


@groups_bp.route('/ai-assistant', methods=['POST'])
@jwt_required()
def get_ai_assistant_response():
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        if not current_user or not current_user.is_active:
            return jsonify({'error': 'Active account required'}), 403
        data = request.get_json() or {}
        message = (data.get('message') or '').strip()
        if not message:
            return jsonify({'error': 'message is required'}), 400

        group_id = (data.get('groupId') or '').strip()
        pathname = (data.get('pathname') or '').strip()
        page = (data.get('page') or '').strip() or 'app'
        target_date = (data.get('date') or date.today().isoformat()).strip()

        group_context = None
        if group_id:
            group = Group.query.filter_by(group_id=group_id).first()
            if not group:
                return jsonify({'error': 'Group not found'}), 404
            if not user_can_access_group(group, current_user_id):
                return jsonify({'error': 'Unauthorized'}), 403
            group_context = build_copilot_group_context(group, current_user_id)

        role_config = get_copilot_public_config(current_user.account_role, page)
        system_prompt = build_copilot_system_prompt(current_user.account_role)
        user_prompt = json.dumps(
            {
                'task': 'Answer the in-app copilot request using the supplied route and school context.',
                'message': message,
                'route': {
                    'page': page,
                    'pathname': pathname,
                    'date': target_date,
                },
                'user': {
                    'id': current_user.id if current_user else None,
                    'username': current_user.username if current_user else None,
                    'accountRole': current_user.account_role,
                },
                'responseAudience': role_config,
                'appGuide': RITUO_APP_GUIDE,
                'groupContext': group_context,
            }
        )
        raw_response = create_structured_response(
            model=OPENAI_COPILOT_MODEL,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema_name='rituo_copilot_response',
            schema=build_copilot_schema(),
            max_output_tokens=1200,
        )
        normalized = normalize_copilot_response(raw_response, current_user.account_role)
        resolved_group_id = group_context.get('group', {}).get('groupId') if group_context else None
        next_actions = []
        for item in normalized.get('nextActions') or []:
            next_item = dict(item)
            next_item['link'] = build_copilot_action_link(
                item.get('actionType'),
                group_id=resolved_group_id,
                target_date=target_date,
            )
            next_actions.append(next_item)
        normalized['nextActions'] = next_actions
        return jsonify({
            'response': normalized,
            'assistant': role_config,
            'contract': structured_contract_metadata('rituo_copilot_response'),
        }), 200
    except OpenAIResponsesError as e:
        status_code = 503 if 'OPENAI_API_KEY' in str(e) else 502
        return jsonify({'error': str(e)}), status_code
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/ai-habits', methods=['POST'])
@jwt_required()
def draft_habits_from_text(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only school admins or legacy owners can generate habits'}), 403

        source_text = str((request.get_json() or {}).get('text') or '').strip()
        if len(source_text) < 10:
            return jsonify({'error': 'Add a little more detail so habits can be generated'}), 400
        if len(source_text) > 8000:
            return jsonify({'error': 'Habit brief must be 8,000 characters or fewer'}), 400

        raw_draft = create_structured_response(
            model=OPENAI_HABIT_DRAFT_MODEL,
            system_prompt=(
                "You turn a school administrator's free-form brief into clear student habits. "
                "Every habit must be measurable, age-appropriate, concise, and include a realistic estimated completion time. "
                "Use boolean habits unless numeric tracking or a written reflection is clearly better. "
                "Never add student names or sensitive inferences."
            ),
            user_prompt=json.dumps({
                'task': 'Draft reusable challenge habits from this administrator brief.',
                'school': group.name,
                'brief': source_text,
                'allowedHabitTypes': ['boolean', 'numeric', 'text'],
                'allowedDays': list(VALID_WEEKDAYS),
                'durationRangeMinutes': [5, 120],
            }),
            schema_name='rituo_habit_draft',
            schema=build_habit_draft_schema(),
            max_output_tokens=1800,
        )
        return jsonify({
            'draft': normalize_habit_draft(raw_draft),
            'contract': structured_contract_metadata('rituo_habit_draft'),
        }), 200
    except OpenAIResponsesError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


# Habit Preset endpoints (must be before /<group_id> routes)
@groups_bp.route('/habit-presets', methods=['GET'])
@jwt_required()
def get_habit_presets():
    """Get all habit presets for the current user"""
    try:
        user_id = get_jwt_identity()
        presets = HabitPreset.query.filter_by(user_id=user_id).all()
        return jsonify({'presets': [preset.to_dict() for preset in presets]}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/habit-presets', methods=['POST'])
@jwt_required()
def create_habit_preset():
    """Create a new habit preset"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        name = data.get('name')
        habits = data.get('habits', [])

        if not name or not habits:
            return jsonify({'error': 'Name and habits are required'}), 400

        preset = HabitPreset(
            user_id=user_id,
            name=name,
            habits=habits
        )
        db.session.add(preset)
        db.session.commit()

        return jsonify({'preset': preset.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/habit-presets/<int:preset_id>', methods=['PUT'])
@jwt_required()
def update_habit_preset(preset_id):
    """Update an existing habit preset"""
    try:
        user_id = get_jwt_identity()
        preset = HabitPreset.query.get(preset_id)

        if not preset:
            return jsonify({'error': 'Preset not found'}), 404

        if str(preset.user_id) != str(user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        preset.name = data.get('name', preset.name)
        preset.habits = data.get('habits', preset.habits)
        preset.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify({'preset': preset.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/habit-presets/<int:preset_id>', methods=['DELETE'])
@jwt_required()
def delete_habit_preset(preset_id):
    """Delete a habit preset"""
    try:
        user_id = get_jwt_identity()
        preset = HabitPreset.query.get(preset_id)

        if not preset:
            return jsonify({'error': 'Preset not found'}), 404

        if str(preset.user_id) != str(user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        db.session.delete(preset)
        db.session.commit()

        return jsonify({'message': 'Preset deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


# Course endpoints (group owner creates courses; students take them in challenge)
@groups_bp.route('/leader/courses', methods=['GET'])
@jwt_required()
def get_leader_courses():
    """List all courses from all groups the current user leads. For use when creating challenges in any group."""
    try:
        current_user_id = int(get_jwt_identity())
        led_groups = Group.query.filter_by(leader_id=current_user_id).all()
        all_courses = []
        for g in led_groups:
            courses = Course.query.filter_by(group_id=g.id).order_by(Course.created_at.desc()).all()
            for c in courses:
                d = c.to_dict()
                d['groupName'] = g.name
                d['groupId'] = g.group_id
                all_courses.append(d)
        return jsonify({'courses': all_courses}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses', methods=['GET'])
@jwt_required()
def get_group_courses(group_id):
    """List all courses for a group. Leader and members can view."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not user_can_access_group(group, current_user_id):
            return jsonify({'error': 'Not a member of this group'}), 403
        courses = Course.query.filter_by(group_id=group.id).order_by(Course.created_at.desc()).all()
        return jsonify({'courses': [c.to_dict() for c in courses]}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses', methods=['POST'])
@jwt_required()
def create_course(group_id):
    """Create a course (group leader only)."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only group leader can create courses'}), 403
        data = request.get_json() or {}
        name = data.get('name') or 'Untitled Course'
        description = data.get('description', '')
        settings = data.get('settings', {})
        course = Course(group_id=group.id, name=name, description=description, settings=settings)
        db.session.add(course)
        db.session.commit()
        return jsonify({'course': course.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses/<int:course_id>', methods=['GET'])
@jwt_required()
def get_course(group_id, course_id):
    """Get a course with sections and items."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not user_can_access_group(group, current_user_id):
            return jsonify({'error': 'Not a member of this group'}), 403
        course = Course.query.filter_by(id=course_id, group_id=group.id).first()
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        return jsonify({'course': course.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses/<int:course_id>', methods=['PUT'])
@jwt_required()
def update_course(group_id, course_id):
    """Update a course (leader only)."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        course = Course.query.filter_by(id=course_id, group_id=group.id).first()
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        data = request.get_json() or {}
        if 'name' in data:
            course.name = data['name']
        if 'description' in data:
            course.description = data['description']
        if 'settings' in data:
            course.settings = data['settings']
        db.session.commit()
        return jsonify({'course': course.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses/<int:course_id>', methods=['DELETE'])
@jwt_required()
def delete_course(group_id, course_id):
    """Delete a course (leader only)."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        course = Course.query.filter_by(id=course_id, group_id=group.id).first()
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        db.session.delete(course)
        db.session.commit()
        return jsonify({'message': 'Course deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses/<int:course_id>/sections', methods=['POST'])
@jwt_required()
def create_course_section(group_id, course_id):
    """Add a section to a course."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        course = Course.query.filter_by(id=course_id, group_id=group.id).first()
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        data = request.get_json() or {}
        title = data.get('title') or 'New Section'
        description = data.get('description', '')
        order_index = CourseSection.query.filter_by(course_id=course_id).count()
        section = CourseSection(course_id=course_id, title=title, description=description, order_index=order_index)
        db.session.add(section)
        db.session.commit()
        return jsonify({'section': section.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses/<int:course_id>/sections/<int:section_id>', methods=['PUT'])
@jwt_required()
def update_course_section(group_id, course_id, section_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        section = CourseSection.query.filter_by(id=section_id, course_id=course_id).first()
        if not section:
            return jsonify({'error': 'Section not found'}), 404
        data = request.get_json() or {}
        if 'title' in data:
            section.title = data['title']
        if 'description' in data:
            section.description = data['description']
        if 'orderIndex' in data:
            section.order_index = data['orderIndex']
        db.session.commit()
        return jsonify({'section': section.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/courses/<int:course_id>/sections/<int:section_id>', methods=['DELETE'])
@jwt_required()
def delete_course_section(group_id, course_id, section_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        section = CourseSection.query.filter_by(id=section_id, course_id=course_id).first()
        if not section:
            return jsonify({'error': 'Section not found'}), 404
        db.session.delete(section)
        db.session.commit()
        return jsonify({'message': 'Section deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/sections/<int:section_id>/items', methods=['POST'])
@jwt_required()
def create_course_item(group_id, section_id):
    """Add a video or quiz item to a section."""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        section = CourseSection.query.filter_by(id=section_id).first()
        if not section or section.course.group_id != group.id:
            return jsonify({'error': 'Section not found'}), 404
        data = request.get_json() or {}
        item_type = data.get('itemType', 'video')
        if item_type not in ('video', 'quiz'):
            return jsonify({'error': 'itemType must be video or quiz'}), 400
        item_data = data.get('data', {})
        if item_type == 'video':
            item_data = {'url': item_data.get('url', ''), 'durationSeconds': item_data.get('durationSeconds', 0), 'thumbnailUrl': item_data.get('thumbnailUrl', '')}
        else:
            item_data = {'questions': item_data.get('questions', [])}
        order_index = CourseItem.query.filter_by(section_id=section_id).count()
        item = CourseItem(section_id=section_id, item_type=item_type, data=item_data, order_index=order_index)
        db.session.add(item)
        db.session.commit()
        return jsonify({'item': item.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/items/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_course_item(group_id, item_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        item = CourseItem.query.get(item_id)
        if not item or item.section.course.group_id != group.id:
            return jsonify({'error': 'Item not found'}), 404
        data = request.get_json() or {}
        if 'data' in data:
            item.data = data['data']
        if 'orderIndex' in data:
            item.order_index = data['orderIndex']
        db.session.commit()
        return jsonify({'item': item.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_course_item(group_id, item_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        item = CourseItem.query.get(item_id)
        if not item or item.section.course.group_id != group.id:
            return jsonify({'error': 'Item not found'}), 404
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Item deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def _user_must_do_course(challenge, user_id, course_required_member_ids):
    """Check if user is required to complete the course."""
    if not challenge.course_id:
        return False
    req = course_required_member_ids if course_required_member_ids is not None else []
    if len(req) == 0:
        return True  # All members
    return user_id in [int(x) for x in req]


def _get_user_joined_at(challenge, user_id):
    """Get when user joined the challenge (for late joiner logic)."""
    for mh in (challenge.member_habits or []):
        raw = mh.get('member')
        mid = (raw.get('id') if isinstance(raw, dict) else raw) if raw is not None else None
        if mid is None:
            continue
        if str(mid) == str(user_id):
            joined = mh.get('joinedAt')
            if joined:
                try:
                    s = str(joined)[:10]
                    return datetime.fromisoformat(s).date()
                except Exception:
                    pass
    start = challenge.start_date
    return start.date() if hasattr(start, 'date') else datetime.fromisoformat(str(start)[:10]).date()


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/course/progress', methods=['GET'])
@jwt_required()
def get_course_progress(group_id, challenge_id):
    """Get current user's course progress for a challenge."""
    try:
        user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not user_can_access_group(group, user_id):
            return jsonify({'error': 'Not in group'}), 403
        challenge = GroupChallenge.query.filter_by(id=challenge_id, group_id=group.id).first()
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
        if not challenge.course_id:
            return jsonify({'error': 'Challenge has no course'}), 400
        if not _user_must_do_course(challenge, user_id, challenge.course_required_member_ids):
            return jsonify({'progress': [], 'course': None, 'mustComplete': False}), 200
        course = challenge.course
        joined_at = _get_user_joined_at(challenge, user_id)
        end_date = challenge.end_date.date() if hasattr(challenge.end_date, 'date') else datetime.fromisoformat(str(challenge.end_date)[:10]).date()
        total_days = (end_date - joined_at).days
        total_sections = len(course.sections)
        section_duration_days = total_days / total_sections if total_sections else 0
        progress_list = []
        for idx, section in enumerate(course.sections):
            section_end = joined_at + timedelta(days=int((idx + 1) * section_duration_days))
            prog = CourseProgress.query.filter_by(user_id=user_id, challenge_id=challenge_id, section_id=section.id).first()
            total_sec = sum(i.data.get('durationSeconds', 0) for i in section.items if i.item_type == 'video')
            quiz_items = [i for i in section.items if i.item_type == 'quiz']
            quiz_total = sum(len(q.data.get('questions', [])) for q in quiz_items)
            watched = (prog.watch_time_seconds if prog else 0)
            quiz_scores = prog.quiz_scores if prog and prog.quiz_scores else {}
            quiz_correct = sum(s.get('correct', 0) for s in quiz_scores.values())
            quiz_score_pct = (quiz_correct / quiz_total * 100) if quiz_total else 0
            watch_pct = (min(watched, total_sec) / total_sec * 100) if total_sec else 0  # Cap at 100% (no over-watching)
            section_score = (watch_pct * 0.5 + quiz_score_pct * 0.5) if (total_sec or quiz_total) else 0
            progress_list.append({
                'sectionId': section.id,
                'sectionTitle': section.title,
                'orderIndex': section.order_index,
                'watchTimeSeconds': prog.watch_time_seconds if prog else 0,
                'quizScores': prog.quiz_scores if prog and prog.quiz_scores else {},
                'sectionScore': round(section_score, 1),
                'sectionEnd': section_end.isoformat(),
                'passed': section_score >= 75
            })
        return jsonify({
            'progress': progress_list,
            'course': course.to_dict(),
            'mustComplete': True,
            'joinedAt': joined_at.isoformat(),
            'endDate': end_date.isoformat(),
            'minutesRemaining': max(0, int((end_date - date.today()).total_seconds() // 60)) if end_date else 0
        }), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def _calc_minutes_remaining(end_date, joined_at):
    try:
        end = end_date.date() if hasattr(end_date, 'date') else end_date
        j = joined_at if isinstance(joined_at, date) else datetime.fromisoformat(str(joined_at)[:10]).date()
        delta = end - date.today()
        return max(0, delta.days * 24 * 60 + delta.seconds // 60) if hasattr(delta, 'seconds') else max(0, delta.days * 24 * 60)
    except Exception:
        return 0


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/course/progress', methods=['POST'])
@jwt_required()
def record_course_progress(group_id, challenge_id):
    """Record watch time or quiz score."""
    try:
        user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        challenge = GroupChallenge.query.filter_by(id=challenge_id, group_id=group.id).first()
        if not challenge or not challenge.course_id:
            return jsonify({'error': 'Challenge/course not found'}), 404
        if not _user_must_do_course(challenge, user_id, challenge.course_required_member_ids):
            return jsonify({'error': 'You are not required to complete this course'}), 403
        data = request.get_json() or {}
        action = data.get('action')  # 'watch' | 'quiz'
        section_id = data.get('sectionId')
        if not section_id:
            return jsonify({'error': 'sectionId required'}), 400
        section = CourseSection.query.filter_by(id=section_id, course_id=challenge.course_id).first()
        if not section:
            return jsonify({'error': 'Section not found'}), 404
        prog, _ = _get_or_create_progress(user_id, challenge_id, section_id)
        if action == 'watch':
            seconds = data.get('seconds', 0)
            prog.watch_time_seconds = max(prog.watch_time_seconds, int(seconds))
        elif action == 'quiz':
            item_id = data.get('itemId')
            correct = data.get('correct', 0)
            total = max(data.get('total', 1), 1)
            scores = prog.quiz_scores or {}
            existing = scores.get(str(item_id))
            new_ratio = correct / total
            old_ratio = (existing['correct'] / max(existing['total'], 1)) if existing else -1
            if new_ratio > old_ratio:
                scores[str(item_id)] = {'correct': correct, 'total': total, 'answeredAt': datetime.utcnow().isoformat()}
                prog.quiz_scores = scores
                flag_modified(prog, 'quiz_scores')
        prog.last_activity_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'success': True, 'progress': prog.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def _get_or_create_progress(user_id, challenge_id, section_id):
    prog = CourseProgress.query.filter_by(user_id=user_id, challenge_id=challenge_id, section_id=section_id).first()
    if not prog:
        prog = CourseProgress(user_id=user_id, challenge_id=challenge_id, section_id=section_id)
        db.session.add(prog)
    return prog, None


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/course/students', methods=['GET'])
@jwt_required()
def get_course_students_progress(group_id, challenge_id):
    """Leader: get all students' course progress (for failure list)."""
    try:
        user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not can_manage_group(group, user_id):
            return jsonify({'error': 'Only group leader can view'}), 403
        challenge = GroupChallenge.query.filter_by(id=challenge_id, group_id=group.id).first()
        if not challenge or not challenge.course_id:
            return jsonify({'error': 'Challenge/course not found'}), 404
        course = challenge.course
        req_ids = challenge.course_required_member_ids or []
        if len(req_ids) == 0:
            member_ids = [m.id for m in group.members]
        else:
            member_ids = [int(x) for x in req_ids]
        students = []
        for mid in member_ids:
            user = User.query.get(mid)
            if not user:
                continue
            joined_at = _get_user_joined_at(challenge, mid)
            end_date = challenge.end_date.date() if hasattr(challenge.end_date, 'date') else datetime.fromisoformat(str(challenge.end_date)[:10]).date()
            total_sections = len(course.sections)
            total_days = (end_date - joined_at).days
            section_days = total_days / total_sections if total_sections else 0
            section_scores = []
            for idx, section in enumerate(course.sections):
                prog = CourseProgress.query.filter_by(user_id=mid, challenge_id=challenge_id, section_id=section.id).first()
                total_sec = sum(i.data.get('durationSeconds', 0) for i in section.items if i.item_type == 'video')
                quiz_items = [i for i in section.items if i.item_type == 'quiz']
                quiz_total = sum(len(q.data.get('questions', [])) for q in quiz_items)
                watched = prog.watch_time_seconds if prog else 0
                quiz_scores = prog.quiz_scores if prog and prog.quiz_scores else {}
                quiz_correct = sum(s.get('correct', 0) for s in quiz_scores.values())
                quiz_pct = (quiz_correct / quiz_total * 100) if quiz_total else 0
                watch_pct = (min(watched, total_sec) / total_sec * 100) if total_sec else 0  # Cap at 100% (no over-watching)
                score = (watch_pct * 0.5 + quiz_pct * 0.5) if (total_sec or quiz_total) else 0
                section_scores.append(score)
            overall = sum(section_scores) / len(section_scores) if section_scores else 0
            students.append({
                'memberId': mid,
                'username': user.username,
                'overallScore': round(overall, 1) if section_scores else 0,
                'sectionScores': section_scores,
                'passed': overall >= 75,
                'joinedAt': joined_at.isoformat()
            })
        return jsonify({'students': students, 'course': course.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/my-course-enrollments', methods=['GET'])
@jwt_required()
def get_my_course_enrollments():
    """Get all challenges with courses the current user must complete (for dashboard)."""
    try:
        user_id = int(get_jwt_identity())
        challenges = GroupChallenge.query.join(Group).filter(
            GroupChallenge.status == 'active',
            GroupChallenge.course_id.isnot(None)
        ).all()
        result = []
        for ch in challenges:
            group = ch.group
            if user_id != group.leader_id and user_id not in [m.id for m in group.members]:
                continue
            if not _user_must_do_course(ch, user_id, ch.course_required_member_ids):
                continue
            joined_at = _get_user_joined_at(ch, user_id)
            end_date = ch.end_date.date() if hasattr(ch.end_date, 'date') else datetime.fromisoformat(str(ch.end_date)[:10]).date()
            total_sections = len(ch.course.sections)
            progress_records = CourseProgress.query.filter_by(user_id=user_id, challenge_id=ch.id).all()
            section_scores = []
            for section in ch.course.sections:
                prog = next((p for p in progress_records if p.section_id == section.id), None)
                total_sec = sum(i.data.get('durationSeconds', 0) for i in section.items if i.item_type == 'video')
                quiz_items = [i for i in section.items if i.item_type == 'quiz']
                quiz_total = sum(len(q.data.get('questions', [])) for q in quiz_items)
                watched = prog.watch_time_seconds if prog else 0
                quiz_scores = prog.quiz_scores if prog and prog.quiz_scores else {}
                quiz_correct = sum(s.get('correct', 0) for s in quiz_scores.values())
                quiz_pct = (quiz_correct / quiz_total * 100) if quiz_total else 0
                watch_pct = (min(watched, total_sec) / total_sec * 100) if total_sec else 0  # Cap at 100% (no over-watching)
                score = (watch_pct * 0.5 + quiz_pct * 0.5) if (total_sec or quiz_total) else 0
                section_scores.append(score)
            overall = (sum(section_scores) / len(section_scores)) if section_scores else 0
            result.append({
                'groupId': group.group_id,
                'groupName': group.name,
                'challengeId': ch.id,
                'courseId': ch.course_id,
                'courseName': ch.course.name,
                'overallScore': round(overall, 1),
                'totalSections': total_sections,
                'endDate': end_date.isoformat(),
                'joinedAt': joined_at.isoformat(),
                'passed': overall >= 75
            })
        return jsonify({'enrollments': result}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


# Coach Management Endpoints
@groups_bp.route('/<group_id>/coaches', methods=['GET'])
@jwt_required()
def get_coaches(group_id):
    """Get all coaches for a group"""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()

        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only group leader can view coaches
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only group leader can view coaches'}), 403

        coaches = [coach.to_dict() for coach in group.coaches]
        return jsonify({'coaches': coaches}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/coaches', methods=['POST'])
@jwt_required()
def promote_to_coach(group_id):
    """Promote a member to coach (co-leader)"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        member_id = data.get('memberId')

        if not member_id:
            return jsonify({'error': 'memberId is required'}), 400

        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only group leader can promote coaches
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only group leader can promote coaches'}), 403

        # Check if member is in the group
        member = User.query.get(member_id)
        if not member or member not in group.members:
            return jsonify({'error': 'Member not found in group'}), 404

        # Check if already a coach
        if member in group.coaches:
            return jsonify({'error': 'Member is already a coach'}), 400

        # Add as coach
        group.coaches.append(member)
        db.session.commit()

        return jsonify({'message': 'Member promoted to coach successfully', 'coach': member.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/coaches/<int:coach_id>', methods=['DELETE'])
@jwt_required()
def demote_coach(group_id, coach_id):
    """Demote a coach back to regular member"""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()

        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only group leader can demote coaches
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only group leader can demote coaches'}), 403

        coach = User.query.get(coach_id)
        if not coach or coach not in group.coaches:
            return jsonify({'error': 'Coach not found'}), 404

        # Remove coach status
        group.coaches.remove(coach)

        # Remove all coach assignments for this coach
        CoachAssignment.query.filter_by(
            coach_id=coach_id,
            group_id=group.id
        ).delete()

        db.session.commit()

        return jsonify({'message': 'Coach demoted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/coaches/<int:coach_id>/assignments', methods=['GET'])
@jwt_required()
def get_coach_assignments(group_id, coach_id):
    """Get all students assigned to a coach"""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()

        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only group leader or the coach themselves can view assignments
        if not can_manage_group(group, current_user_id) and coach_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        assignments = CoachAssignment.query.filter_by(
            coach_id=coach_id,
            group_id=group.id
        ).all()

        students = [assignment.student.to_dict() for assignment in assignments]
        return jsonify({'students': students}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/coaches/<int:coach_id>/assignments', methods=['POST'])
@jwt_required()
def assign_students_to_coach(group_id, coach_id):
    """Assign students to a coach"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        student_ids = data.get('studentIds', [])

        if not student_ids:
            return jsonify({'error': 'studentIds array is required'}), 400

        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only group leader can assign students
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only group leader can assign students to coaches'}), 403

        # Verify coach is a coach in this group
        coach = User.query.get(coach_id)
        if not coach or coach not in group.coaches:
            return jsonify({'error': 'Coach not found in group'}), 404

        # Remove existing assignments for this coach
        CoachAssignment.query.filter_by(
            coach_id=coach_id,
            group_id=group.id
        ).delete()

        # Create new assignments
        for student_id in student_ids:
            # Verify student is in the group
            student = User.query.get(student_id)
            if student and student in group.members:
                assignment = CoachAssignment(
                    coach_id=coach_id,
                    group_id=group.id,
                    student_id=student_id
                )
                db.session.add(assignment)

        db.session.commit()

        return jsonify({'message': 'Students assigned to coach successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/coaches/<int:coach_id>/assignments/<int:student_id>', methods=['DELETE'])
@jwt_required()
def unassign_student_from_coach(group_id, coach_id, student_id):
    """Unassign a student from a coach"""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()

        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only group leader can unassign students
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only group leader can unassign students from coaches'}), 403

        assignment = CoachAssignment.query.filter_by(
            coach_id=coach_id,
            group_id=group.id,
            student_id=student_id
        ).first()

        if not assignment:
            return jsonify({'error': 'Assignment not found'}), 404

        db.session.delete(assignment)
        db.session.commit()

        return jsonify({'message': 'Student unassigned from coach successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/school-profiles', methods=['GET'])
@jwt_required()
def get_school_profiles(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        students = get_school_students_for_user(group, current_user_id)
        if not students:
            return jsonify({'error': 'Unauthorized'}), 403

        league_table = build_group_league_table(group)
        league_map = {entry['studentId']: entry for entry in league_table}
        profiles = [serialize_school_profile(group, student, league_map.get(student.id)) for student in students]
        return jsonify({'profiles': profiles, 'leagueTable': league_table}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/school-dashboard', methods=['GET'])
@jwt_required()
def get_school_dashboard(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        is_member = any(member.id == current_user_id for member in group.members)
        if not is_member and not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        return jsonify({'dashboard': build_school_operations_dashboard_fast(group, current_user_id)}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/school-structure', methods=['GET'])
@jwt_required()
def get_school_structure(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        return jsonify({'structure': serialize_school_structure(group)}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/school-structure', methods=['PUT'])
@jwt_required()
def update_school_structure(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_school(group, current_user_id):
            return jsonify({'error': 'Only school managers can update school structure'}), 403

        data = request.get_json() or {}
        roles = data.get('roles', [])
        subjects = data.get('subjects', [])
        rooms = data.get('rooms', [])
        classes = data.get('classes', [])
        behaviour_types = data.get('behaviourTypes', [])
        submitted_roles = {}
        for item in roles:
            try:
                role_user_id = int(item.get('userId'))
            except (TypeError, ValueError):
                continue
            role = (item.get('role') or '').strip()
            role_user = User.query.get(role_user_id)
            if not role_user or role not in VALID_SCHOOL_ROLES:
                continue
            if role_user.account_role == 'admin' and role not in {'school-admin', 'headteacher'}:
                continue
            if role_user.account_role == 'teacher' and role not in {'teacher', 'pastoral-lead', 'coach'}:
                continue
            if role_user.account_role == 'student' and role != 'student':
                continue
            submitted_roles[role_user_id] = role
        submitted_roles[current_user_id] = submitted_roles.get(current_user_id, 'school-admin')

        SchoolRoleAssignment.query.filter_by(group_id=group.id).delete()
        SchoolEnrollment.query.filter_by(group_id=group.id).delete()
        SchoolTeachingAssignment.query.filter_by(group_id=group.id).delete()
        SchoolClass.query.filter_by(group_id=group.id).delete()
        SchoolRoom.query.filter_by(group_id=group.id).delete()
        SchoolSubject.query.filter_by(group_id=group.id).delete()
        SchoolBehaviourType.query.filter_by(group_id=group.id).delete()
        db.session.flush()

        subject_id_map = {}
        room_id_map = {}
        class_id_map = {}

        for item in subjects:
            name = (item.get('name') or '').strip()
            if not name:
                continue
            subject = SchoolSubject(group_id=group.id, name=name, code=(item.get('code') or '').strip() or None)
            db.session.add(subject)
            db.session.flush()
            subject_id_map[str(item.get('id') or f"subject-{subject.id}")] = subject.id

        for item in rooms:
            name = (item.get('name') or '').strip()
            if not name:
                continue
            capacity = item.get('capacity')
            try:
                capacity = int(capacity) if capacity not in (None, '') else None
            except (TypeError, ValueError):
                capacity = None
            room = SchoolRoom(group_id=group.id, name=name, block=(item.get('block') or '').strip() or None, capacity=capacity)
            db.session.add(room)
            db.session.flush()
            room_id_map[str(item.get('id') or f"room-{room.id}")] = room.id

        for item in behaviour_types:
            name = (item.get('name') or '').strip()
            kind = (item.get('kind') or '').strip()
            severity = (item.get('severity') or 'low').strip()
            if not name or kind not in VALID_BEHAVIOUR_KINDS or severity not in VALID_BEHAVIOUR_SEVERITIES:
                continue
            try:
                default_points = int(item.get('defaultPoints') or 0)
            except (TypeError, ValueError):
                default_points = 0
            db.session.add(SchoolBehaviourType(
                group_id=group.id,
                name=name,
                kind=kind,
                severity=severity,
                default_points=default_points,
                note_type=(item.get('noteType') or '').strip() or None
            ))

        for item in classes:
            name = (item.get('name') or '').strip()
            if not name:
                continue
            room_key = str(item.get('roomId')) if item.get('roomId') is not None else None
            school_class = SchoolClass(
                group_id=group.id,
                name=name,
                tutor_group=(item.get('tutorGroup') or '').strip() or None,
                year_group=(item.get('yearGroup') or '').strip() or None,
                room_id=room_id_map.get(room_key) if room_key else None
            )
            db.session.add(school_class)
            db.session.flush()
            class_id_map[str(item.get('id') or f"class-{school_class.id}")] = school_class.id

            for enrollment in item.get('enrollments', []):
                student_id = enrollment.get('studentId')
                try:
                    student_id = int(student_id)
                except (TypeError, ValueError):
                    continue
                if not any(member.id == student_id for member in group.members):
                    continue
                db.session.add(SchoolEnrollment(group_id=group.id, class_id=school_class.id, student_id=student_id))

            for assignment in item.get('teachingAssignments', []):
                teacher_id = assignment.get('teacherId')
                subject_key = str(assignment.get('subjectId')) if assignment.get('subjectId') is not None else None
                try:
                    teacher_id = int(teacher_id)
                except (TypeError, ValueError):
                    continue
                if submitted_roles.get(teacher_id) not in {'teacher', 'headteacher', 'pastoral-lead', 'school-admin', 'coach'}:
                    continue
                subject_id = subject_id_map.get(subject_key)
                if not subject_id:
                    continue
                db.session.add(SchoolTeachingAssignment(group_id=group.id, class_id=school_class.id, subject_id=subject_id, teacher_id=teacher_id))

        for role_user_id, role in submitted_roles.items():
            db.session.add(SchoolRoleAssignment(group_id=group.id, user_id=role_user_id, role=role))

        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'school-structure',
            'Updated school structure',
            description='Saved school roles, classes, subjects, rooms, and behaviour catalogue.',
            metadata={
                'roles': len(roles),
                'subjects': len(subjects),
                'rooms': len(rooms),
                'classes': len(classes),
                'behaviourTypes': len(behaviour_types)
            }
        )
        db.session.commit()
        return jsonify({'structure': serialize_school_structure(group)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/teacher-register', methods=['GET'])
@jwt_required()
def get_teacher_register(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        date_raw = request.args.get('date')
        target_date = datetime.fromisoformat(date_raw).date() if date_raw else date.today()
        weekday = target_date.strftime('%A')
        slots = [entry for entry in (group.school_timetable or []) if entry.get('weekday') == weekday]
        if not can_manage_group(group, current_user_id):
            slots = [entry for entry in slots if str(entry.get('teacherId') or '') == str(current_user_id)]

        all_members = get_group_members_list(group)
        member_map = {member.id: member for member in all_members}
        student_ids = set()
        slot_students = {}
        for slot in slots:
            roster_ids = [int(value) for value in (slot.get('studentIds') or []) if str(value).isdigit()]
            students = [member_map[student_id] for student_id in roster_ids if student_id in member_map] if roster_ids else list(all_members)
            slot_students[slot.get('id')] = students
            student_ids.update(student.id for student in students)

        register_rows = LessonRegister.query.options(
            joinedload(LessonRegister.teacher)
        ).filter(
            LessonRegister.group_id == group.id,
            LessonRegister.lesson_date == target_date,
            LessonRegister.student_id.in_(student_ids) if student_ids else False
        ).all() if student_ids else []
        register_map = {
            (row.student_id, row.timetable_slot_id): row
            for row in register_rows
        }

        today_value = date.today()
        week_start = today_value - timedelta(days=today_value.weekday())
        attendance_rows = LessonRegister.query.filter(
            LessonRegister.group_id == group.id,
            LessonRegister.lesson_date >= week_start,
            LessonRegister.lesson_date <= today_value,
            LessonRegister.student_id.in_(student_ids) if student_ids else False
        ).all() if student_ids else []
        attendance_rows_map = defaultdict(list)
        for row in attendance_rows:
            attendance_rows_map[row.student_id].append(row)

        register_classes = []
        for slot in slots:
            students = slot_students.get(slot.get('id'), [])
            rows = []
            for student in students:
                lesson = build_dashboard_lesson_entry(
                    slot,
                    register_map.get((student.id, slot.get('id'))),
                    target_date
                )
                rows.append({
                    'student': serialize_school_user_brief(student),
                    'lesson': lesson,
                    'attendanceSummary': build_attendance_summary_from_rows(
                        attendance_rows_map.get(student.id, []),
                        today_value=today_value
                    )
                })
            register_classes.append({
                'slotId': slot.get('id'),
                'date': target_date.isoformat(),
                'weekday': weekday,
                'startTime': slot.get('startTime') or '',
                'endTime': slot.get('endTime') or '',
                'subject': slot.get('subject') or '',
                'subjectId': slot.get('subjectId'),
                'className': slot.get('className') or '',
                'classId': slot.get('classId'),
                'room': slot.get('room') or '',
                'teacherId': slot.get('teacherId'),
                'teacherName': slot.get('teacherName') or '',
                'students': rows
            })

        return jsonify({'register': register_classes}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/teacher-register', methods=['POST'])
@jwt_required()
def save_teacher_register(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json() or {}
        student_id = data.get('studentId')
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'studentId is required'}), 400

        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized for this student'}), 403

        lesson_date_raw = data.get('lessonDate')
        lesson_date = datetime.fromisoformat(lesson_date_raw).date() if lesson_date_raw else date.today()
        entry = data.get('entry') or {}
        slot_id = entry.get('timetableSlotId')
        slot_map = {slot['id']: slot for slot in build_lesson_slots_for_date(group, lesson_date, student_id)}
        slot = slot_map.get(slot_id)
        if not slot:
            return jsonify({'error': 'Timetable slot not found for this student'}), 404

        attendance_status = (entry.get('attendanceStatus') or 'present').strip().lower()
        if attendance_status not in VALID_ATTENDANCE_STATUSES:
            attendance_status = 'present'
        try:
            lateness_minutes = int(entry.get('latenessMinutes') or 0)
        except (TypeError, ValueError):
            lateness_minutes = 0
        engagement = (entry.get('engagement') or 'green').strip().lower()
        if engagement not in VALID_ENGAGEMENT_COLORS:
            engagement = 'green'
        refocus = bool(entry.get('refocus'))
        teacher_comment = (entry.get('teacherComment') or '').strip() or None
        attended = attendance_status in ('present', 'late')
        points = calculate_lesson_register_points(attendance_status, engagement, refocus)

        record = LessonRegister.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            lesson_date=lesson_date,
            timetable_slot_id=slot_id
        ).first()
        if not record:
            record = LessonRegister(
                group_id=group.id,
                student_id=student_id,
                teacher_id=current_user_id,
                lesson_date=lesson_date,
                timetable_slot_id=slot_id,
                weekday=slot['weekday'],
                start_time=slot['startTime'],
                end_time=slot['endTime'],
                subject=slot['subject'],
                teacher_name=slot.get('teacherName') or '',
                room=slot.get('room') or '',
                class_name=slot.get('className') or '',
                attendance_status=attendance_status,
                lateness_minutes=lateness_minutes,
                attended=attended,
                engagement=engagement,
                refocus=refocus,
                teacher_comment=teacher_comment,
                points=points
            )
            db.session.add(record)
        else:
            record.teacher_id = current_user_id
            record.attendance_status = attendance_status
            record.lateness_minutes = lateness_minutes
            record.attended = attended
            record.engagement = engagement
            record.refocus = refocus
            record.teacher_comment = teacher_comment
            record.points = points
            record.updated_at = datetime.utcnow()

        ensure_automatic_intervention(group, student_id)
        student = next((member for member in group.members if member.id == student_id), None)
        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'lesson-register',
            f"Updated register for {student.username if student else f'Student {student_id}'}",
            description=f"{slot.get('subject') or 'Lesson'} on {lesson_date.isoformat()} marked {attendance_status} with {engagement} engagement.",
            student_id=student_id,
            metadata={
                'lessonDate': lesson_date.isoformat(),
                'slotId': slot_id,
                'subject': slot.get('subject') or '',
                'attendanceStatus': attendance_status,
                'engagement': engagement,
                'refocus': refocus,
                'points': points
            }
        )
        db.session.commit()
        return jsonify({'lessonRegister': build_lesson_register_summary(group, student_id, lesson_date)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/teacher-behaviour-log', methods=['POST'])
@jwt_required()
def create_teacher_behaviour_log(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json() or {}
        student_id = data.get('studentId')
        slot_id = data.get('slotId')
        behaviour_type_id = data.get('behaviourTypeId')
        lesson_date_raw = data.get('lessonDate')
        title = (data.get('title') or '').strip()
        notes = (data.get('notes') or '').strip() or None
        if not slot_id:
            return jsonify({'error': 'slotId is required'}), 400
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'studentId is required'}), 400
        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized for this student'}), 403
        lesson_date = datetime.fromisoformat(lesson_date_raw).date() if lesson_date_raw else date.today()
        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        behaviour_type = None
        if behaviour_type_id not in (None, ''):
            try:
                behaviour_type_id = int(behaviour_type_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid behaviourTypeId'}), 400
            behaviour_type = SchoolBehaviourType.query.filter_by(id=behaviour_type_id, group_id=group.id).first()
            if not behaviour_type:
                return jsonify({'error': 'Behaviour type not found'}), 404

        slot_map = {slot['id']: slot for slot in build_lesson_slots_for_date(group, lesson_date, student_id)}
        slot = slot_map.get(slot_id)
        if not slot:
            return jsonify({'error': 'Timetable slot not found for this student'}), 404

        lesson_record = LessonRegister.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            lesson_date=lesson_date,
            timetable_slot_id=slot_id
        ).first()

        if not lesson_record:
            default_attendance = 'present'
            default_engagement = 'green'
            lesson_record = LessonRegister(
                group_id=group.id,
                student_id=student_id,
                teacher_id=current_user_id,
                lesson_date=lesson_date,
                timetable_slot_id=slot['id'],
                weekday=slot['weekday'],
                start_time=slot['startTime'],
                end_time=slot['endTime'],
                subject=slot['subject'],
                teacher_name=slot.get('teacherName') or '',
                room=slot.get('room') or '',
                class_name=slot.get('className') or '',
                attendance_status=default_attendance,
                lateness_minutes=0,
                attended=True,
                engagement=default_engagement,
                refocus=False,
                teacher_comment=None,
                points=calculate_lesson_register_points(default_attendance, default_engagement, False)
            )
            db.session.add(lesson_record)
            db.session.flush()

        kind = (data.get('kind') or (behaviour_type.kind if behaviour_type else '')).strip()
        severity = (data.get('severity') or (behaviour_type.severity if behaviour_type else 'low')).strip()
        if kind not in VALID_BEHAVIOUR_KINDS:
            return jsonify({'error': 'Invalid behaviour kind'}), 400
        if severity not in VALID_BEHAVIOUR_SEVERITIES:
            severity = 'low'
        if not title:
            title = behaviour_type.name if behaviour_type else ''
        if not title:
            return jsonify({'error': 'title is required'}), 400
        try:
            points_delta = int(data.get('pointsDelta')) if data.get('pointsDelta') not in (None, '') else (behaviour_type.default_points if behaviour_type else 0)
        except (TypeError, ValueError):
            points_delta = behaviour_type.default_points if behaviour_type else 0

        event = SchoolBehaviourEvent(
            group_id=group.id,
            student_id=student_id,
            staff_id=current_user_id,
            lesson_register_id=lesson_record.id,
            behaviour_type_id=behaviour_type.id if behaviour_type else None,
            event_date=lesson_date,
            subject=slot.get('subject') or None,
            class_name=slot.get('className') or None,
            kind=kind,
            severity=severity,
            title=title,
            notes=notes,
            points_delta=points_delta
        )
        db.session.add(event)
        ensure_automatic_intervention(group, student_id)
        log_school_audit(
            group.id,
            current_user_id,
            'created',
            'behaviour-event',
            f"Logged behaviour event for {student.username}",
            description=f"{title} ({kind}) in {slot.get('subject') or 'General'} with {points_delta} points.",
            student_id=student_id,
            metadata={
                'lessonDate': lesson_date.isoformat(),
                'slotId': slot_id,
                'kind': kind,
                'severity': severity,
                'title': title,
                'subject': slot.get('subject') or '',
                'pointsDelta': points_delta
            }
        )
        db.session.commit()
        return jsonify({
            'event': event.to_dict(),
            'profile': serialize_school_profile(group, student)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/homework', methods=['GET'])
@jwt_required()
def get_school_homework(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        is_member = any(member.id == current_user_id for member in group.members)
        if not is_member and not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        assignments = get_homework_assignments_for_user(group, current_user_id)
        return jsonify({'homework': [serialize_homework_assignment_for_user(assignment, current_user_id=current_user_id) for assignment in assignments]}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/homework', methods=['POST'])
@jwt_required()
def create_school_homework(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        if not title:
            return jsonify({'error': 'title is required'}), 400
        homework_type = (data.get('homeworkType') or 'practice').strip()
        complexity = (data.get('complexity') or 'medium').strip()
        if homework_type not in VALID_HOMEWORK_TYPES:
            homework_type = 'practice'
        if complexity not in VALID_HOMEWORK_COMPLEXITIES:
            complexity = 'medium'
        class_id = data.get('classId')
        subject_id = data.get('subjectId')
        try:
            class_id = int(class_id) if class_id not in (None, '') else None
        except (TypeError, ValueError):
            class_id = None
        try:
            subject_id = int(subject_id) if subject_id not in (None, '') else None
        except (TypeError, ValueError):
            subject_id = None
        due_date_raw = data.get('dueDate')
        if not due_date_raw:
            return jsonify({'error': 'dueDate is required'}), 400
        due_date = datetime.fromisoformat(due_date_raw).date()
        assigned_date_raw = data.get('assignedDate')
        assigned_date = datetime.fromisoformat(assigned_date_raw).date() if assigned_date_raw else min(date.today(), due_date)
        if due_date < assigned_date:
            return jsonify({'error': 'dueDate cannot be before assignedDate'}), 400

        student_ids = resolve_homework_student_ids(group, class_id=class_id, explicit_student_ids=data.get('studentIds') or [])
        if not student_ids:
            return jsonify({'error': 'Select at least one student or class'}), 400

        assignment = SchoolHomeworkAssignment(
            group_id=group.id,
            created_by_id=current_user_id,
            class_id=class_id,
            subject_id=subject_id,
            title=title,
            description=(data.get('description') or '').strip() or None,
            instructions=(data.get('instructions') or '').strip() or None,
            homework_type=homework_type,
            complexity=complexity,
            assigned_date=assigned_date,
            due_date=due_date,
            estimated_minutes=max(5, int(data.get('estimatedMinutes') or 30)),
            max_points=max(0, int(data.get('maxPoints') or 3)),
            late_penalty=max(0, int(data.get('latePenalty') or 1)),
            missing_penalty=max(0, int(data.get('missingPenalty') or 2)),
            allow_late=bool(data.get('allowLate', True)),
            requires_evidence=bool(data.get('requiresEvidence')),
            student_ids=student_ids
        )
        db.session.add(assignment)
        db.session.flush()

        for student_id in student_ids:
            db.session.add(SchoolHomeworkSubmission(
                assignment_id=assignment.id,
                group_id=group.id,
                student_id=student_id,
                status='assigned',
                awarded_points=0
            ))

        create_homework_assignment_notifications(group, assignment)
        if assignment.class_id:
            create_class_chat_message(
                group,
                assignment.class_id,
                current_user_id,
                f"Homework set: {assignment.title} due {assignment.due_date.isoformat()}.",
                message_type='system'
            )
        log_school_audit(
            group.id,
            current_user_id,
            'created',
            'homework',
            f"Created homework: {assignment.title}",
            description=f"Due {assignment.due_date.isoformat()} for {len(student_ids)} student(s).",
            metadata={
                'assignmentId': assignment.id,
                'title': assignment.title,
                'dueDate': assignment.due_date.isoformat(),
                'studentCount': len(student_ids),
                'classId': class_id,
                'subjectId': subject_id
            }
        )
        db.session.commit()
        return jsonify({'assignment': serialize_homework_assignment_for_user(assignment, current_user_id=current_user_id)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/homework/<int:assignment_id>/submit', methods=['POST'])
@jwt_required()
def submit_school_homework(group_id, assignment_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        assignment = SchoolHomeworkAssignment.query.filter_by(id=assignment_id, group_id=group.id).first()
        if not assignment:
            return jsonify({'error': 'Homework assignment not found'}), 404

        data = request.get_json() or {}
        student_id = data.get('studentId', current_user_id)
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'studentId is required'}), 400

        if current_user_id != student_id and not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized'}), 403
        if student_id not in (assignment.student_ids or []):
            return jsonify({'error': 'Student is not assigned to this homework'}), 403

        submission = SchoolHomeworkSubmission.query.filter_by(assignment_id=assignment.id, student_id=student_id).first()
        if not submission:
            submission = SchoolHomeworkSubmission(
                assignment_id=assignment.id,
                group_id=group.id,
                student_id=student_id,
                status='assigned',
                awarded_points=0
            )
            db.session.add(submission)

        completed_date_raw = data.get('completedDate')
        completed_date = datetime.fromisoformat(completed_date_raw).date() if completed_date_raw else date.today()
        submission.completed_date = completed_date
        submission.response_text = (data.get('responseText') or '').strip() or None
        submission.evidence_link = (data.get('evidenceLink') or '').strip() or None
        submission.submitted_by_id = current_user_id
        submission.submitted_at = datetime.now(timezone.utc)
        is_late = bool(assignment.due_date and completed_date > assignment.due_date)
        if is_late and not assignment.allow_late:
            submission.status = 'missing'
            submission.awarded_points = -(assignment.missing_penalty or 0)
        else:
            submission.status = 'late' if is_late else 'submitted'
            submission.awarded_points = calculate_homework_submission_points(assignment, submission, today_value=completed_date)

        student = next((member for member in group.members if member.id == student_id), None)
        if assignment.class_id and student:
            create_class_chat_message(
                group,
                assignment.class_id,
                current_user_id,
                f"{student.username} submitted homework: {assignment.title}.",
                message_type='system'
            )
        log_school_audit(
            group.id,
            current_user_id,
            'submitted',
            'homework',
            f"Submitted homework for {student.username if student else f'Student {student_id}'}",
            description=f"{assignment.title} marked as {submission.status}.",
            student_id=student_id,
            metadata={
                'assignmentId': assignment.id,
                'submissionId': submission.id,
                'status': submission.status,
                'awardedPoints': submission.awarded_points or 0
            }
        )
        db.session.commit()
        return jsonify({
            'submission': submission.to_dict(),
            'assignment': serialize_homework_assignment_for_user(assignment, current_user_id=current_user_id),
            'profile': serialize_school_profile(group, student) if student else None
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/homework/<int:assignment_id>/mark', methods=['POST'])
@jwt_required()
def mark_school_homework(group_id, assignment_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        assignment = SchoolHomeworkAssignment.query.filter_by(id=assignment_id, group_id=group.id).first()
        if not assignment:
            return jsonify({'error': 'Homework assignment not found'}), 404

        data = request.get_json() or {}
        student_id = data.get('studentId')
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'studentId is required'}), 400
        if student_id not in (assignment.student_ids or []):
            return jsonify({'error': 'Student is not assigned to this homework'}), 403

        submission = SchoolHomeworkSubmission.query.filter_by(assignment_id=assignment.id, student_id=student_id).first()
        if not submission:
            submission = SchoolHomeworkSubmission(
                assignment_id=assignment.id,
                group_id=group.id,
                student_id=student_id,
                status='assigned',
                awarded_points=0
            )
            db.session.add(submission)

        status = (data.get('status') or 'reviewed').strip()
        if status not in VALID_HOMEWORK_STATUSES:
            status = 'reviewed'
        try:
            awarded_points = int(data.get('awardedPoints')) if data.get('awardedPoints') not in (None, '') else calculate_homework_submission_points(assignment, submission)
        except (TypeError, ValueError):
            awarded_points = calculate_homework_submission_points(assignment, submission)
        submission.status = status
        submission.awarded_points = awarded_points
        submission.teacher_feedback = (data.get('teacherFeedback') or '').strip() or None
        submission.reviewed_by_id = current_user_id
        submission.reviewed_at = datetime.now(timezone.utc)
        if not submission.completed_date:
            submission.completed_date = date.today()

        student = next((member for member in group.members if member.id == student_id), None)
        if assignment.class_id and student:
            create_class_chat_message(
                group,
                assignment.class_id,
                current_user_id,
                f"Homework reviewed: {student.username} - {assignment.title} ({status}).",
                message_type='system'
            )
        log_school_audit(
            group.id,
            current_user_id,
            'reviewed',
            'homework',
            f"Reviewed homework for {student.username if student else f'Student {student_id}'}",
            description=f"{assignment.title} set to {status} with {awarded_points} points.",
            student_id=student_id,
            metadata={
                'assignmentId': assignment.id,
                'submissionId': submission.id,
                'status': status,
                'awardedPoints': awarded_points
            }
        )
        db.session.commit()
        return jsonify({
            'submission': submission.to_dict(),
            'assignment': serialize_homework_assignment_for_user(assignment, current_user_id=current_user_id),
            'profile': serialize_school_profile(group, student) if student else None
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/homework/<int:assignment_id>/remind', methods=['POST'])
@jwt_required()
def remind_school_homework(group_id, assignment_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403

        assignment = SchoolHomeworkAssignment.query.filter_by(id=assignment_id, group_id=group.id).first()
        if not assignment:
            return jsonify({'error': 'Homework assignment not found'}), 404

        data = request.get_json() or {}
        student_id = data.get('studentId')
        if student_id not in (None, ''):
            try:
                student_id = int(student_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid studentId'}), 400
            if student_id not in (assignment.student_ids or []):
                return jsonify({'error': 'Student is not assigned to this homework'}), 403
        else:
            student_id = None

        reminded_count = create_homework_reminder_notifications(
            group,
            assignment,
            staff_user_id=current_user_id,
            student_id=student_id
        )
        if assignment.class_id and reminded_count:
            reminder_target = None
            if student_id:
                reminder_student = next((member for member in group.members if member.id == student_id), None)
                reminder_target = reminder_student.username if reminder_student else f"Student {student_id}"
            create_class_chat_message(
                group,
                assignment.class_id,
                current_user_id,
                (
                    f"Homework reminder sent: {assignment.title} for {reminder_target}."
                    if reminder_target
                    else f"Homework reminder sent: {assignment.title} for {reminded_count} student(s)."
                ),
                message_type='system'
            )
        log_school_audit(
            group.id,
            current_user_id,
            'created',
            'homework-reminder',
            f"Sent homework reminder for {assignment.title}",
            description=f"Reminder sent to {reminded_count} student(s).",
            student_id=student_id,
            metadata={'assignmentId': assignment.id, 'studentId': student_id, 'remindedCount': reminded_count}
        )
        db.session.commit()
        return jsonify({'remindedCount': reminded_count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/student/<int:student_id>', methods=['GET'])
@jwt_required()
def export_student_report(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized'}), 403
        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        html = build_weekly_student_report_html(group, student)
        response = make_response(html)
        response.headers['Content-Type'] = 'text/html; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename=\"weekly-student-report-{student.username}.html\"'
        return response
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/class/<int:class_id>', methods=['GET'])
@jwt_required()
def export_class_report(group_id, class_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        school_class, rows = build_class_report_rows(group, class_id)
        if not school_class:
            return jsonify({'error': 'Class not found'}), 404
        return csv_response(
            f"class-report-{school_class.name.replace(' ', '-').lower()}.csv",
            rows,
            ['student', 'attendance_rate', 'today_status', 'combined_weekly_score', 'daily_points', 'goal_activity_status', 'latest_behaviour_score', 'homework_points', 'missing_homework']
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/homework', methods=['GET'])
@jwt_required()
def export_homework_report(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        rows = []
        assignments = SchoolHomeworkAssignment.query.filter_by(group_id=group.id).order_by(
            SchoolHomeworkAssignment.due_date.asc(),
            SchoolHomeworkAssignment.created_at.desc()
        ).all()
        for assignment in assignments:
            for submission in assignment.submissions:
                if not can_manage_group(group, current_user_id) and not can_view_student(group, current_user_id, submission.student_id):
                    continue
                rows.append({
                    'title': assignment.title,
                    'subject': assignment.subject.name if assignment.subject else '',
                    'class_name': assignment.school_class.name if assignment.school_class else '',
                    'student': submission.student.username if submission.student else '',
                    'due_date': assignment.due_date.isoformat() if assignment.due_date else '',
                    'status': submission.status,
                    'awarded_points': submission.awarded_points,
                    'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else '',
                    'reviewed_at': submission.reviewed_at.isoformat() if submission.reviewed_at else '',
                    'teacher_feedback': submission.teacher_feedback or ''
                })
        return csv_response(
            'homework-report.csv',
            rows,
            ['title', 'subject', 'class_name', 'student', 'due_date', 'status', 'awarded_points', 'submitted_at', 'reviewed_at', 'teacher_feedback']
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/interventions', methods=['GET'])
@jwt_required()
def export_intervention_report(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        rows = []
        for record in InterventionRecord.query.filter_by(group_id=group.id).order_by(InterventionRecord.intervention_date.desc()).all():
            if not can_manage_group(group, current_user_id) and not can_view_student(group, current_user_id, record.student_id):
                continue
            rows.append({
                'student': record.student.username if record.student else '',
                'intervention_type': record.intervention_type,
                'status': record.status,
                'owner': record.owner.username if record.owner else '',
                'due_date': record.due_date.isoformat() if record.due_date else '',
                'intervention_date': record.intervention_date.isoformat() if record.intervention_date else '',
                'auto_created': record.auto_created,
                'summary': record.summary or '',
                'next_step': record.next_step or ''
            })
        return csv_response(
            'intervention-report.csv',
            rows,
            ['student', 'intervention_type', 'status', 'owner', 'due_date', 'intervention_date', 'auto_created', 'summary', 'next_step']
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/parents', methods=['GET'])
@jwt_required()
def export_parent_report(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        rows = []
        students = get_school_students_for_user(group, current_user_id)
        for student in students:
            parent_profiles = get_parent_profiles(group.id, student.id)
            parent_contacts = get_parent_contact_records(group.id, student.id)
            latest_contact = parent_contacts[0] if parent_contacts else None
            if not parent_profiles:
                rows.append({
                    'student': student.username,
                    'parent_name': '',
                    'relationship': '',
                    'preferred_contact': '',
                    'receives_updates': '',
                    'latest_contact_type': latest_contact.contact_type if latest_contact else '',
                    'latest_contact_date': latest_contact.contact_date.isoformat() if latest_contact and latest_contact.contact_date else '',
                    'latest_contact_acknowledged': latest_contact.acknowledged if latest_contact else False
                })
                continue
            for profile in parent_profiles:
                rows.append({
                    'student': student.username,
                    'parent_name': profile.name,
                    'relationship': profile.relationship or '',
                    'preferred_contact': profile.preferred_contact or '',
                    'receives_updates': profile.receives_updates,
                    'latest_contact_type': latest_contact.contact_type if latest_contact else '',
                    'latest_contact_date': latest_contact.contact_date.isoformat() if latest_contact and latest_contact.contact_date else '',
                    'latest_contact_acknowledged': latest_contact.acknowledged if latest_contact else False
                })
        return csv_response(
            'parent-summary-report.csv',
            rows,
            ['student', 'parent_name', 'relationship', 'preferred_contact', 'receives_updates', 'latest_contact_type', 'latest_contact_date', 'latest_contact_acknowledged']
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/subjects', methods=['GET'])
@jwt_required()
def export_subject_report(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        dashboard = build_school_operations_dashboard(group, current_user_id)
        rows = []
        attendance_subjects = {item['subject']: item for item in dashboard.get('attendance', {}).get('subjects', [])}
        behaviour_subjects = {item['subject']: item for item in dashboard.get('behaviour', {}).get('bySubject', [])}
        for subject in dashboard.get('subjectSummaries', []):
            attendance_item = attendance_subjects.get(subject['subject'], {})
            behaviour_item = behaviour_subjects.get(subject['subject'], {})
            rows.append({
                'subject': subject['subject'],
                'teacher_name': subject.get('teacherName', ''),
                'avg_points_per_lesson': subject.get('averagePointsPerLesson', 0),
                'coverage_rate': subject.get('coverageRate', 0),
                'attendance_rate': attendance_item.get('attendanceRate', 0),
                'rewards': behaviour_item.get('reward', 0),
                'sanctions': behaviour_item.get('sanction', 0),
                'referrals': behaviour_item.get('referral', 0),
                'removals': behaviour_item.get('removal', 0),
                'behaviour_points_delta': behaviour_item.get('pointsDelta', 0)
            })
        return csv_response(
            'subject-report.csv',
            rows,
            ['subject', 'teacher_name', 'avg_points_per_lesson', 'coverage_rate', 'attendance_rate', 'rewards', 'sanctions', 'referrals', 'removals', 'behaviour_points_delta']
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/audit', methods=['GET'])
@jwt_required()
def export_audit_report(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        rows = []
        for record in get_school_audit_logs(group.id, limit=500):
            if record.student_id and not can_manage_group(group, current_user_id) and not can_view_student(group, current_user_id, record.student_id):
                continue
            rows.append({
                'created_at': record.created_at.isoformat() if record.created_at else '',
                'actor': record.actor.username if record.actor else '',
                'student': record.student.username if record.student else '',
                'action_type': record.action_type,
                'entity_type': record.entity_type,
                'title': record.title,
                'description': record.description or ''
            })
        return csv_response(
            'audit-report.csv',
            rows,
            ['created_at', 'actor', 'student', 'action_type', 'entity_type', 'title', 'description']
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/reports/leadership', methods=['GET'])
@jwt_required()
def export_leadership_report(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_view_school_operations(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        dashboard = build_school_operations_dashboard(group, current_user_id)
        rows = [{
            'date': dashboard.get('date', ''),
            'student_count': dashboard.get('overview', {}).get('studentCount', 0),
            'at_risk_count': dashboard.get('overview', {}).get('atRiskCount', 0),
            'recovered_today_count': dashboard.get('overview', {}).get('recoveredTodayCount', 0),
            'overdue_actions_count': dashboard.get('overview', {}).get('overdueActionsCount', 0),
            'expected_lesson_marks': dashboard.get('overview', {}).get('expectedLessonMarks', 0),
            'logged_lesson_marks': dashboard.get('overview', {}).get('loggedLessonMarks', 0),
            'average_attendance_rate': dashboard.get('overview', {}).get('averageAttendanceRate', 0),
            'average_school_score': dashboard.get('overview', {}).get('averageSchoolScore', 0),
            'average_homework_points': dashboard.get('overview', {}).get('averageHomeworkPoints', 0)
        }]
        return csv_response(
            'leadership-summary.csv',
            rows,
            ['date', 'student_count', 'at_risk_count', 'recovered_today_count', 'overdue_actions_count', 'expected_lesson_marks', 'logged_lesson_marks', 'average_attendance_rate', 'average_school_score', 'average_homework_points']
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/goal-plan', methods=['PUT'])
@jwt_required()
def update_student_goal_plan(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        data = request.get_json() or {}
        goals = data.get('goals', [])
        if not isinstance(goals, list):
            return jsonify({'error': 'goals must be an array'}), 400

        StudentGoal.query.filter_by(group_id=group.id, student_id=student_id).delete()
        for goal in goals:
            title = (goal.get('title') or '').strip()
            if not title:
                continue
            db.session.add(StudentGoal(
                group_id=group.id,
                student_id=student_id,
                title=title,
                barrier=(goal.get('barrier') or '').strip() or None,
                school_goal=(goal.get('schoolGoal') or '').strip() or None,
                for_self=(goal.get('forSelf') or '').strip() or None,
                for_others=(goal.get('forOthers') or '').strip() or None,
                created_by_id=current_user_id
            ))

        db.session.commit()
        return jsonify({'profile': serialize_school_profile(group, student)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/ai-goal-plan', methods=['POST'])
@jwt_required()
def generate_ai_student_goal_plan(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized'}), 403

        student = next((member for member in get_group_members_list(group) if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        data = request.get_json() or {}
        source_text = (data.get('sourceText') or '').strip()
        apply_plan = bool(data.get('apply'))
        if len(source_text) < 20:
            return jsonify({'error': 'Please provide a fuller note or paragraph for the AI plan.'}), 400

        profile = serialize_school_profile(group, student)
        student_context = build_ai_student_context(profile)
        planning_context = {
            'group': {
                'groupId': group.group_id,
                'name': group.name,
                'groupType': group.group_type or 'school',
            },
            'studentContext': student_context,
            'hasActiveChallenge': bool(group.active_challenge),
        }

        system_prompt = (
            "You are the Rituo school planning copilot. "
            "Turn teacher notes into a practical student goal plan. "
            "Create 2 to 4 concise goals and 3 to 6 habits when the notes support them. "
            "Every habit must clearly support one goal through linkedGoalKey. "
            "Keep suggestions school-safe, realistic, and easy to act on this week. "
            "Prefer boolean habits unless numeric or text tracking is clearly useful. "
            "Use the provided student context, and if context is missing, say so in warnings instead of inventing facts."
        )
        user_prompt = json.dumps(
            {
                'task': 'Generate a student goal plan, linked habits, and a motivating goal activity from the provided notes.',
                'sourceText': source_text,
                'context': planning_context,
            }
        )
        raw_plan = create_structured_response(
            model=OPENAI_STUDENT_PLAN_MODEL,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema_name='rituo_student_goal_plan',
            schema=build_student_plan_schema(),
            max_output_tokens=1800,
        )
        normalized_plan = normalize_student_plan(raw_plan)

        if apply_plan:
            normalized_plan = apply_ai_student_plan(group, student, normalized_plan, current_user_id)
            log_school_audit(
                group.id,
                current_user_id,
                'updated',
                'ai-goal-plan',
                f"Applied AI plan for {student.username}",
                description='Generated goals, linked habits, and goal activity from free-text notes.',
                student_id=student.id,
                metadata={
                    'goalCount': len(normalized_plan.get('goals') or []),
                    'habitCount': len(normalized_plan.get('habits') or []),
                    'sourceLength': len(source_text),
                }
            )
            db.session.commit()
            return jsonify({
                'applied': True,
                'plan': normalized_plan,
                'profile': serialize_school_profile(group, student),
                'contract': structured_contract_metadata('rituo_student_goal_plan'),
            }), 200

        return jsonify({
            'applied': False,
            'plan': normalized_plan,
            'contract': structured_contract_metadata('rituo_student_goal_plan'),
        }), 200
    except OpenAIResponsesError as e:
        status_code = 503 if 'OPENAI_API_KEY' in str(e) else 502
        return jsonify({'error': str(e)}), status_code
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/school-impact', methods=['POST'])
@jwt_required()
def create_school_impact_record(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if not can_manage_group(group, current_user_id) and not (
            any(coach.id == current_user_id for coach in group.coaches) and
            CoachAssignment.query.filter_by(
                coach_id=current_user_id,
                group_id=group.id,
                student_id=student_id
            ).first()
        ):
            return jsonify({'error': 'Only the group leader or assigned coach can add school impact data'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        week_ending_raw = request.form.get('weekEnding')
        if not week_ending_raw:
            return jsonify({'error': 'weekEnding is required'}), 400

        week_ending = datetime.fromisoformat(week_ending_raw).date()
        truancy_incidents = int(request.form.get('truancyIncidents', 0) or 0)
        positive_points = int(request.form.get('positivePoints', 0) or 0)
        negative_points = int(request.form.get('negativePoints', 0) or 0)
        coach_notes = (request.form.get('coachNotes') or '').strip() or None

        evidence = request.files.get('evidence')
        evidence_file_name = None
        evidence_original_name = None

        if evidence and evidence.filename:
            extension = evidence.filename.rsplit('.', 1)[-1].lower() if '.' in evidence.filename else ''
            if extension not in ALLOWED_EVIDENCE_EXTENSIONS:
                return jsonify({'error': 'Only PDF evidence files are supported'}), 400

            upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'school-impact')
            os.makedirs(upload_dir, exist_ok=True)
            stored_name = f"{group.group_id}_{student_id}_{uuid.uuid4().hex}.pdf"
            evidence.save(os.path.join(upload_dir, stored_name))
            evidence_file_name = stored_name
            evidence_original_name = secure_filename(evidence.filename)

        record = SchoolImpactRecord(
            group_id=group.id,
            student_id=student_id,
            coach_id=current_user_id,
            week_ending=week_ending,
            truancy_incidents=truancy_incidents,
            positive_points=positive_points,
            negative_points=negative_points,
            coach_notes=coach_notes,
            evidence_file_name=evidence_file_name,
            evidence_original_name=evidence_original_name
        )
        db.session.add(record)
        ensure_automatic_intervention(group, student_id)
        db.session.commit()

        return jsonify({
            'record': record.to_dict(),
            'profile': serialize_school_profile(group, student)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/performance-card', methods=['POST'])
@jwt_required()
def upsert_performance_card(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if not can_manage_group(group, current_user_id) and not (
            any(coach.id == current_user_id for coach in group.coaches) and
            CoachAssignment.query.filter_by(
                coach_id=current_user_id,
                group_id=group.id,
                student_id=student_id
            ).first()
        ):
            return jsonify({'error': 'Only the group leader or assigned coach can edit performance cards'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        data = request.get_json() or {}
        card_date_raw = data.get('cardDate')
        checkpoints = data.get('checkpoints', [])
        if not card_date_raw:
            return jsonify({'error': 'cardDate is required'}), 400
        card_date = datetime.fromisoformat(card_date_raw).date()

        normalized_checkpoints, total_points = calculate_performance_card_points(checkpoints)
        card = PerformanceCard.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            card_date=card_date
        ).first()

        if not card:
            card = PerformanceCard(
                group_id=group.id,
                student_id=student_id,
                coach_id=current_user_id,
                card_date=card_date,
                checkpoints=normalized_checkpoints,
                total_points=total_points
            )
            db.session.add(card)
        else:
            card.coach_id = current_user_id
            card.checkpoints = normalized_checkpoints
            card.total_points = total_points
            card.updated_at = datetime.utcnow()
            flag_modified(card, 'checkpoints')

        ensure_automatic_intervention(group, student_id)
        db.session.commit()
        return jsonify({
            'card': card.to_dict(),
            'profile': serialize_school_profile(group, student)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/lesson-register', methods=['POST'])
@jwt_required()
def upsert_lesson_register(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Only school staff responsible for this student can update lesson registers'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        data = request.get_json() or {}
        lesson_date_raw = data.get('lessonDate')
        entries = data.get('entries', [])
        if not lesson_date_raw:
            return jsonify({'error': 'lessonDate is required'}), 400
        if not isinstance(entries, list):
            return jsonify({'error': 'entries must be an array'}), 400

        lesson_date = datetime.fromisoformat(lesson_date_raw).date()
        slot_map = {slot['id']: slot for slot in build_lesson_slots_for_date(group, lesson_date, student_id)}

        for entry in entries:
            slot_id = entry.get('timetableSlotId')
            slot = slot_map.get(slot_id)
            if not slot:
                continue

            attendance_status = (entry.get('attendanceStatus') or ('present' if entry.get('attended', True) else 'absent')).strip().lower()
            if attendance_status not in VALID_ATTENDANCE_STATUSES:
                attendance_status = 'present'
            try:
                lateness_minutes = int(entry.get('latenessMinutes') or 0)
            except (TypeError, ValueError):
                lateness_minutes = 0
            attended = attendance_status in ('present', 'late')
            engagement = (entry.get('engagement') or 'green').strip().lower()
            if engagement not in VALID_ENGAGEMENT_COLORS:
                engagement = 'green'
            refocus = bool(entry.get('refocus'))
            teacher_comment = (entry.get('teacherComment') or '').strip() or None
            points = calculate_lesson_register_points(attendance_status, engagement, refocus)

            record = LessonRegister.query.filter_by(
                group_id=group.id,
                student_id=student_id,
                lesson_date=lesson_date,
                timetable_slot_id=slot_id
            ).first()

            if not record:
                record = LessonRegister(
                    group_id=group.id,
                    student_id=student_id,
                    teacher_id=current_user_id,
                    lesson_date=lesson_date,
                    timetable_slot_id=slot_id,
                    weekday=slot['weekday'],
                    start_time=slot['startTime'],
                    end_time=slot['endTime'],
                    subject=slot['subject'],
                    teacher_name=slot.get('teacherName') or '',
                    room=slot.get('room') or '',
                    class_name=slot.get('className') or '',
                    attendance_status=attendance_status,
                    lateness_minutes=lateness_minutes,
                    attended=attended,
                    engagement=engagement,
                    refocus=refocus,
                    teacher_comment=teacher_comment,
                    points=points
                )
                db.session.add(record)
            else:
                record.teacher_id = current_user_id
                record.weekday = slot['weekday']
                record.start_time = slot['startTime']
                record.end_time = slot['endTime']
                record.subject = slot['subject']
                record.teacher_name = slot.get('teacherName') or ''
                record.room = slot.get('room') or ''
                record.class_name = slot.get('className') or ''
                record.attendance_status = attendance_status
                record.lateness_minutes = lateness_minutes
                record.attended = attended
                record.engagement = engagement
                record.refocus = refocus
                record.teacher_comment = teacher_comment
                record.points = points
                record.updated_at = datetime.utcnow()

        ensure_automatic_intervention(group, student_id)
        db.session.commit()
        return jsonify({
            'lessonRegister': build_lesson_register_summary(group, student_id, lesson_date),
            'profile': serialize_school_profile(group, student)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def _parse_plan_date(raw_value):
    try:
        return datetime.fromisoformat(str(raw_value)).date()
    except (TypeError, ValueError):
        return date.today()


def _minutes_between(start_time, end_time):
    try:
        start_hour, start_minute = [int(value) for value in start_time.split(':')]
        end_hour, end_minute = [int(value) for value in end_time.split(':')]
        return max(5, (end_hour * 60 + end_minute) - (start_hour * 60 + start_minute))
    except (AttributeError, TypeError, ValueError):
        return 30


def _normalize_saved_schedule_items(items):
    normalized = []
    allowed_types = {'habit', 'manual', 'school', 'break'}
    for index, raw_item in enumerate((items or [])[:60]):
        title = str((raw_item or {}).get('title') or '').strip()
        start_time = str((raw_item or {}).get('startTime') or '').strip()
        end_time = str((raw_item or {}).get('endTime') or '').strip()
        if not title or len(start_time) != 5 or len(end_time) != 5:
            continue
        item_type = str((raw_item or {}).get('itemType') or 'manual').strip().lower()
        if item_type not in allowed_types:
            item_type = 'manual'
        try:
            habit_index = int((raw_item or {}).get('habitIndex', -1))
        except (TypeError, ValueError):
            habit_index = -1
        normalized.append({
            'id': str((raw_item or {}).get('id') or f"item-{index + 1}")[:80],
            'title': title[:120],
            'itemType': item_type,
            'habitIndex': habit_index,
            'startTime': start_time,
            'endTime': end_time,
            'durationMinutes': _minutes_between(start_time, end_time),
            'locked': bool((raw_item or {}).get('locked') or item_type == 'school'),
            'reason': str((raw_item or {}).get('reason') or '').strip()[:240],
            'source': str((raw_item or {}).get('source') or 'manual').strip()[:20],
        })
    normalized.sort(key=lambda item: (item['startTime'], item['endTime']))
    return normalized


@groups_bp.route('/<group_id>/students/<int:student_id>/schedule', methods=['GET'])
@jwt_required()
def get_student_schedule(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not any(member.id == student_id for member in get_group_members_list(group)):
            return jsonify({'error': 'Student not found in school'}), 404
        if current_user_id != student_id and not can_view_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized'}), 403

        plan_date = _parse_plan_date(request.args.get('date'))
        plan = StudentSchedulePlan.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            plan_date=plan_date,
        ).first()
        return jsonify({
            'plan': plan.to_dict() if plan else {
                'groupId': group.id,
                'studentId': student_id,
                'planDate': plan_date.isoformat(),
                'constraintsText': '',
                'items': [],
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/schedule', methods=['PUT'])
@jwt_required()
def save_student_schedule(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not any(member.id == student_id for member in get_group_members_list(group)):
            return jsonify({'error': 'Student not found in school'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only edit their own calendar'}), 403

        data = request.get_json() or {}
        plan_date = _parse_plan_date(data.get('date'))
        plan = StudentSchedulePlan.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            plan_date=plan_date,
        ).first()
        if not plan:
            plan = StudentSchedulePlan(group_id=group.id, student_id=student_id, plan_date=plan_date)
            db.session.add(plan)
        plan.constraints_text = str(data.get('constraintsText') or '').strip()[:4000] or None
        plan.items = _normalize_saved_schedule_items(data.get('items'))
        plan.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'plan': plan.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/schedule/ai', methods=['POST'])
@jwt_required()
def generate_student_schedule(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not any(member.id == student_id for member in get_group_members_list(group)):
            return jsonify({'error': 'Student not found in school'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only generate their own calendar'}), 403

        data = request.get_json() or {}
        plan_date = _parse_plan_date(data.get('date'))
        constraints_text = str(data.get('constraintsText') or '').strip()[:4000]
        member_habit = get_member_habit_entry(group, student_id)
        habits = []
        for index, habit in enumerate((member_habit or {}).get('habits', [])):
            schedule_days = habit.get('scheduleDays') or []
            if schedule_days and plan_date.strftime('%A') not in schedule_days:
                continue
            habits.append({
                'habitIndex': index,
                'title': habit.get('name') or f'Habit {index + 1}',
                'description': habit.get('description') or '',
                'durationMinutes': max(5, int(habit.get('durationMinutes') or 30)),
                'preferredTime': habit.get('scheduleTime') or '',
            })

        school_items = []
        for entry in group.school_timetable or []:
            if entry.get('weekday') != plan_date.strftime('%A'):
                continue
            student_ids = [int(value) for value in (entry.get('studentIds') or []) if str(value).isdigit()]
            if student_ids and student_id not in student_ids:
                continue
            school_items.append({
                'id': f"school-{entry.get('id')}",
                'title': entry.get('subject') or 'School',
                'itemType': 'school',
                'habitIndex': -1,
                'startTime': entry.get('startTime') or '',
                'endTime': entry.get('endTime') or '',
                'durationMinutes': _minutes_between(entry.get('startTime'), entry.get('endTime')),
                'locked': True,
                'reason': entry.get('room') or 'School timetable',
                'source': 'school',
            })
        manual_items = [
            item for item in _normalize_saved_schedule_items(data.get('manualItems'))
            if item['itemType'] == 'manual'
        ]

        raw_plan = create_structured_response(
            model=OPENAI_SCHEDULER_MODEL,
            system_prompt=(
                "You are a student time-planning assistant. Build a realistic single-day plan. "
                "Schedule every supplied habit exactly once around locked school and manual commitments. "
                "Respect durations, avoid overlaps, include short breaks when useful, and never move fixed commitments. "
                "Return only habit and break items; fixed commitments are merged by the application."
            ),
            user_prompt=json.dumps({
                'task': 'Schedule the habits for this day.',
                'date': plan_date.isoformat(),
                'weekday': plan_date.strftime('%A'),
                'studentConstraints': constraints_text,
                'habits': habits,
                'fixedCommitments': school_items + manual_items,
                'dayBounds': {'earliest': '06:00', 'latest': '22:00'},
            }),
            schema_name='rituo_daily_schedule',
            schema=build_daily_schedule_schema(),
            max_output_tokens=2200,
        )
        normalized_plan = normalize_daily_schedule(raw_plan)
        generated_items = [
            item for item in normalized_plan['items']
            if item['itemType'] in {'habit', 'break'}
        ]
        combined_items = _normalize_saved_schedule_items(school_items + manual_items + generated_items)

        plan = StudentSchedulePlan.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            plan_date=plan_date,
        ).first()
        if not plan:
            plan = StudentSchedulePlan(group_id=group.id, student_id=student_id, plan_date=plan_date)
            db.session.add(plan)
        plan.constraints_text = constraints_text or None
        plan.items = combined_items
        plan.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'plan': plan.to_dict(),
            'summary': normalized_plan['summary'],
            'warnings': normalized_plan['warnings'],
            'contract': structured_contract_metadata('rituo_daily_schedule'),
        }), 200
    except OpenAIResponsesError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/planner', methods=['PUT'])
@jwt_required()
def update_student_planner(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only edit their own planner'}), 403

        member_habit = get_member_habit_entry(group, student_id)
        if not member_habit:
            return jsonify({'error': 'Student is not in the active challenge'}), 404

        habits_payload = (request.get_json() or {}).get('habits', [])
        habits_by_index = {int(item.get('index')): item for item in habits_payload if item.get('index') is not None}

        for index, habit in enumerate(member_habit.get('habits', [])):
            update = habits_by_index.get(index)
            if not update:
                continue
            habit['scheduleTime'] = (update.get('scheduleTime') or '').strip()
            try:
                habit['durationMinutes'] = max(5, int(update.get('durationMinutes', 30) or 30))
            except (TypeError, ValueError):
                habit['durationMinutes'] = 30
            habit['orderIndex'] = int(update.get('orderIndex', index) or index)

        member_habit['habits'] = sorted(member_habit.get('habits', []), key=lambda habit: (habit.get('orderIndex', 999), habit.get('scheduleTime') or '99:99'))
        flag_modified(group.active_challenge, 'member_habits')
        db.session.commit()

        student = next((member for member in group.members if member.id == student_id), None)
        return jsonify({'profile': serialize_school_profile(group, student)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/goal-activity', methods=['PUT'])
@jwt_required()
def update_goal_activity(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if not can_manage_group(group, current_user_id) and not (
            any(coach.id == current_user_id for coach in group.coaches) and
            CoachAssignment.query.filter_by(
                coach_id=current_user_id,
                group_id=group.id,
                student_id=student_id
            ).first()
        ):
            return jsonify({'error': 'Only the group leader or assigned coach can set goal activities'}), 403

        member_habit = get_member_habit_entry(group, student_id)
        if not member_habit:
            return jsonify({'error': 'Student is not in the active challenge'}), 404

        data = request.get_json() or {}
        member_habit['goalActivity'] = (data.get('activity') or '').strip() or None
        member_habit['fallbackActivity'] = (data.get('fallbackActivity') or 'Reflection session').strip()
        flag_modified(group.active_challenge, 'member_habits')
        db.session.commit()

        student = next((member for member in group.members if member.id == student_id), None)
        return jsonify({'profile': serialize_school_profile(group, student)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/interventions', methods=['POST'])
@jwt_required()
def create_intervention_record(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Only responsible school staff can log interventions'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        data = request.get_json() or {}
        intervention_type = (data.get('interventionType') or '').strip()
        status = (data.get('status') or 'scheduled').strip()
        summary = (data.get('summary') or '').strip() or None
        next_step = (data.get('nextStep') or '').strip() or None
        intervention_date_raw = data.get('interventionDate')
        owner_id = data.get('ownerId')
        due_date_raw = data.get('dueDate')
        if intervention_type not in VALID_INTERVENTION_TYPES:
            return jsonify({'error': 'Invalid intervention type'}), 400
        if status not in VALID_INTERVENTION_STATUSES:
            return jsonify({'error': 'Invalid intervention status'}), 400
        if not intervention_date_raw:
            return jsonify({'error': 'interventionDate is required'}), 400
        if owner_id is not None:
            try:
                owner_id = int(owner_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid ownerId'}), 400
        else:
            owner_id = get_preferred_staff_owner(group, student_id)

        intervention_date = datetime.fromisoformat(intervention_date_raw).date()
        due_date = datetime.fromisoformat(due_date_raw).date() if due_date_raw else None
        record = InterventionRecord(
            group_id=group.id,
            student_id=student_id,
            staff_id=current_user_id,
            owner_id=owner_id,
            intervention_type=intervention_type,
            status=status,
            intervention_date=intervention_date,
            due_date=due_date,
            summary=summary,
            next_step=next_step
        )
        db.session.add(record)
        create_intervention_notification(group, student_id, owner_id, intervention_type, due_date)
        log_school_audit(
            group.id,
            current_user_id,
            'created',
            'intervention',
            f"Logged intervention for {student.username}",
            description=f"{intervention_type} set to {status}.",
            student_id=student_id,
            metadata={
                'interventionType': intervention_type,
                'status': status,
                'dueDate': due_date.isoformat() if due_date else None,
                'ownerId': owner_id
            }
        )
        db.session.commit()

        return jsonify({
            'record': record.to_dict(),
            'profile': serialize_school_profile(group, student)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/behaviour-events', methods=['POST'])
@jwt_required()
def create_behaviour_event(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Only responsible school staff can log behaviour events'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        data = request.get_json() or {}
        behaviour_type_id = data.get('behaviourTypeId')
        behaviour_type = None
        if behaviour_type_id not in (None, ''):
            try:
                behaviour_type_id = int(behaviour_type_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid behaviourTypeId'}), 400
            behaviour_type = SchoolBehaviourType.query.filter_by(id=behaviour_type_id, group_id=group.id).first()
            if not behaviour_type:
                return jsonify({'error': 'Behaviour type not found'}), 404

        event_date_raw = data.get('eventDate')
        event_date = datetime.fromisoformat(event_date_raw).date() if event_date_raw else date.today()
        kind = (data.get('kind') or (behaviour_type.kind if behaviour_type else '')).strip()
        severity = (data.get('severity') or (behaviour_type.severity if behaviour_type else 'low')).strip()
        title = (data.get('title') or (behaviour_type.name if behaviour_type else '')).strip()
        if kind not in VALID_BEHAVIOUR_KINDS:
            return jsonify({'error': 'Invalid behaviour kind'}), 400
        if severity not in VALID_BEHAVIOUR_SEVERITIES:
            severity = 'low'
        if not title:
            return jsonify({'error': 'title is required'}), 400

        lesson_register_id = data.get('lessonRegisterId')
        lesson_record = None
        if lesson_register_id not in (None, ''):
            try:
                lesson_register_id = int(lesson_register_id)
            except (TypeError, ValueError):
                lesson_register_id = None
            if lesson_register_id:
                lesson_record = LessonRegister.query.filter_by(id=lesson_register_id, group_id=group.id, student_id=student_id).first()

        subject = (data.get('subject') or (lesson_record.subject if lesson_record else '')).strip() or None
        class_name = (data.get('className') or (lesson_record.class_name if lesson_record else '')).strip() or None
        notes = (data.get('notes') or '').strip() or None
        try:
            points_delta = int(data.get('pointsDelta')) if data.get('pointsDelta') not in (None, '') else (behaviour_type.default_points if behaviour_type else 0)
        except (TypeError, ValueError):
            points_delta = behaviour_type.default_points if behaviour_type else 0

        event = SchoolBehaviourEvent(
            group_id=group.id,
            student_id=student_id,
            staff_id=current_user_id,
            lesson_register_id=lesson_record.id if lesson_record else None,
            behaviour_type_id=behaviour_type.id if behaviour_type else None,
            event_date=event_date,
            subject=subject,
            class_name=class_name,
            kind=kind,
            severity=severity,
            title=title,
            notes=notes,
            points_delta=points_delta
        )
        db.session.add(event)
        log_school_audit(
            group.id,
            current_user_id,
            'created',
            'behaviour-event',
            f"Logged behaviour event for {student.username}",
            description=f"{title} ({kind}) with {points_delta} points.",
            student_id=student_id,
            metadata={
                'eventDate': event_date.isoformat(),
                'kind': kind,
                'severity': severity,
                'subject': subject or '',
                'className': class_name or '',
                'pointsDelta': points_delta
            }
        )
        db.session.commit()
        return jsonify({'event': event.to_dict(), 'profile': serialize_school_profile(group, student)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/parent-contacts', methods=['POST'])
@jwt_required()
def create_parent_contact_record(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        if not can_manage_group(group, current_user_id) and not (
            any(coach.id == current_user_id for coach in group.coaches) and
            CoachAssignment.query.filter_by(
                coach_id=current_user_id,
                group_id=group.id,
                student_id=student_id
            ).first()
        ):
            return jsonify({'error': 'Only the group leader or assigned coach can log parent contact'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        data = request.get_json() or {}
        contact_date_raw = data.get('contactDate')
        contact_type = (data.get('contactType') or '').strip()
        if not contact_date_raw:
            return jsonify({'error': 'contactDate is required'}), 400
        if contact_type not in VALID_PARENT_CONTACT_TYPES:
            return jsonify({'error': 'Invalid contact type'}), 400

        record = ParentContactRecord(
            group_id=group.id,
            student_id=student_id,
            staff_id=current_user_id,
            contact_date=datetime.fromisoformat(contact_date_raw).date(),
            contact_type=contact_type,
            outcome=(data.get('outcome') or '').strip() or None,
            notes=(data.get('notes') or '').strip() or None
        )
        db.session.add(record)
        log_school_audit(
            group.id,
            current_user_id,
            'created',
            'parent-contact',
            f"Logged parent contact for {student.username}",
            description=f"{contact_type} on {contact_date_raw}.",
            student_id=student_id,
            metadata={
                'contactType': contact_type,
                'contactDate': contact_date_raw,
                'outcome': record.outcome or ''
            }
        )
        db.session.commit()
        return jsonify({
            'record': record.to_dict(),
            'profile': serialize_school_profile(group, student)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/parent-profiles', methods=['PUT'])
@jwt_required()
def update_parent_profiles(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized'}), 403

        student = next((member for member in group.members if member.id == student_id), None)
        if not student:
            return jsonify({'error': 'Student not found in group'}), 404

        profiles = (request.get_json() or {}).get('profiles', [])
        if not isinstance(profiles, list):
            return jsonify({'error': 'profiles must be an array'}), 400

        ParentProfile.query.filter_by(group_id=group.id, student_id=student_id).delete()
        saved_count = 0
        for item in profiles:
            name = (item.get('name') or '').strip()
            if not name:
                continue
            db.session.add(ParentProfile(
                group_id=group.id,
                student_id=student_id,
                created_by_id=current_user_id,
                name=name,
                relationship=(item.get('relationship') or '').strip() or None,
                phone=(item.get('phone') or '').strip() or None,
                email=(item.get('email') or '').strip() or None,
                preferred_contact=(item.get('preferredContact') or '').strip() or None,
                receives_updates=bool(item.get('receivesUpdates', True)),
                notes=(item.get('notes') or '').strip() or None
            ))
            saved_count += 1

        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'parent-profile',
            f"Updated parent profiles for {student.username}",
            description=f"Saved {saved_count} parent/carer profile(s).",
            student_id=student_id,
            metadata={'profileCount': saved_count}
        )
        db.session.commit()
        return jsonify({'profile': serialize_school_profile(group, student)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/parent-contacts/<int:contact_id>/acknowledge', methods=['POST'])
@jwt_required()
def acknowledge_parent_contact(group_id, contact_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        contact = ParentContactRecord.query.filter_by(id=contact_id, group_id=group.id).first()
        if not contact:
            return jsonify({'error': 'Parent contact record not found'}), 404
        if not can_manage_student(group, current_user_id, contact.student_id):
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json() or {}
        contact.acknowledged = bool(data.get('acknowledged', True))
        contact.acknowledged_at = datetime.utcnow() if contact.acknowledged else None
        contact.acknowledgement_note = (data.get('acknowledgementNote') or '').strip() or None
        contact.updated_at = datetime.utcnow()

        student = next((member for member in group.members if member.id == contact.student_id), None)
        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'parent-contact',
            f"{'Acknowledged' if contact.acknowledged else 'Removed acknowledgement for'} parent contact",
            description=f"{contact.contact_type} on {contact.contact_date.isoformat()} for {student.username if student else f'Student {contact.student_id}'}",
            student_id=contact.student_id,
            metadata={
                'contactId': contact.id,
                'acknowledged': contact.acknowledged,
                'acknowledgementNote': contact.acknowledgement_note or ''
            }
        )
        db.session.commit()
        return jsonify({
            'record': contact.to_dict(),
            'profile': serialize_school_profile(group, student) if student else None
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/league-table', methods=['GET'])
@jwt_required()
def get_league_table(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        is_member = any(member.id == current_user_id for member in group.members)
        is_leader = can_manage_group(group, current_user_id)
        is_coach = any(coach.id == current_user_id for coach in group.coaches)
        if not is_member and not is_leader and not is_coach:
            return jsonify({'error': 'Unauthorized'}), 403

        return jsonify({'standings': build_group_league_table(group)}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/school-impact/<int:record_id>/evidence', methods=['GET'])
@jwt_required()
def download_school_impact_evidence(record_id):
    try:
        current_user_id = int(get_jwt_identity())
        record = SchoolImpactRecord.query.get(record_id)
        if not record:
            return jsonify({'error': 'Record not found'}), 404

        group = Group.query.get(record.group_id)
        if not group or not can_view_student(group, current_user_id, record.student_id):
            return jsonify({'error': 'Unauthorized'}), 403

        if not record.evidence_file_name:
            return jsonify({'error': 'No evidence file attached'}), 404

        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'school-impact')
        download_mode = request.args.get('download', '0') == '1'
        return send_from_directory(
            upload_dir,
            record.evidence_file_name,
            as_attachment=download_mode,
            download_name=record.evidence_original_name or record.evidence_file_name
        )
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not user_can_access_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        # Auto-finalize an overdue active challenge
        if group.active_challenge:
            try:
                challenge = group.active_challenge
                # Compare using dates to avoid tz issues
                challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
                if challenge_end and challenge_end < date.today():
                    challenge.status = 'completed'
                    group.active_challenge_id = None
                    db.session.commit()
            except Exception:
                # Do not fail the request if finalization throws
                db.session.rollback()
        return jsonify({'group': serialize_group_for_user(group, current_user_id)}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/<group_id>', methods=['PUT'])
@jwt_required()
def update_group(group_id):
    """Update group name - only group leader can update"""
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        if not can_manage_group(group, user_id):
            return jsonify({'error': 'Only school admins or legacy owners can update this workspace'}), 403
        
        data = request.get_json() or {}
        new_name = data.get('name')
        new_group_type = data.get('groupType')
        updated = False

        if new_name is not None:
            if not new_name.strip():
                return jsonify({'error': 'Group name cannot be empty'}), 400
            if group.name != new_name.strip():
                group.name = new_name.strip()
                updated = True

        if new_group_type is not None:
            if new_group_type not in ALLOWED_GROUP_TYPES:
                return jsonify({'error': 'Invalid group type'}), 400
            if group.active_challenge and group.group_type != new_group_type:
                return jsonify({'error': 'Cannot change group type while a challenge is active'}), 400
            if group.group_type != new_group_type:
                group.group_type = new_group_type
                updated = True

        if not updated and new_name is None and new_group_type is None:
            return jsonify({'error': 'No updates provided'}), 400

        db.session.commit()
        
        return jsonify({'group': serialize_group_for_user(group, user_id)}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/<group_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_member(group_id, member_id):
    """Remove a member from the group - only group leader can do this"""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only school admins or legacy owners can remove members'}), 403
        
        # Cannot remove the leader
        if member_id == group.leader_id:
            return jsonify({'error': 'Cannot remove the group leader'}), 400
        
        # Check if member is in the group
        member = User.query.get(member_id)
        if not member or member not in group.members:
            return jsonify({'error': 'Member not found in group'}), 404
        
        # Remove member from group
        group.members.remove(member)
        
        # If member is a coach, remove coach status and assignments
        if member in group.coaches:
            group.coaches.remove(member)
            CoachAssignment.query.filter_by(
                coach_id=member_id,
                group_id=group.id
            ).delete()
        
        db.session.commit()
        
        return jsonify({'message': 'Member removed from group successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/<group_id>', methods=['DELETE'])
@jwt_required()
def delete_group(group_id):
    """Delete a group and all its data - only group leader can do this"""
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only school admins or legacy owners can delete this workspace'}), 403
        
        # Get all challenges for this group first
        challenges = GroupChallenge.query.filter_by(group_id=group.id).all()
        challenge_ids = [challenge.id for challenge in challenges]
        
        # Delete all related data in the correct order
        # 1. Delete user_active_challenges associations first (must be before deleting challenges)
        if challenge_ids:
            from sqlalchemy import text
            db.session.execute(
                text('DELETE FROM user_active_challenges WHERE challenge_id IN :challenge_ids'),
                {'challenge_ids': tuple(challenge_ids)}
            )
        
        # 2. Delete coach assignments
        CoachAssignment.query.filter_by(group_id=group.id).delete()
        
        # 3. Delete student goals and school impact data
        StudentGoal.query.filter_by(group_id=group.id).delete()
        SchoolImpactRecord.query.filter_by(group_id=group.id).delete()

        # 4. Delete skill charts
        SkillDevelopmentChart.query.filter_by(group_id=group.id).delete()

        # 5. Delete messages
        Message.query.filter_by(group_id=group.id).delete()

        # 6. Delete challenges (member habits will be cascade deleted)
        GroupChallenge.query.filter_by(group_id=group.id).delete()

        # 7. Delete the group itself
        db.session.delete(group)
        db.session.commit()
        
        return jsonify({'message': 'Group deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/habit/<int:habit_index>/toggle', methods=['POST'])
@jwt_required()
def toggle_group_habit(group_id, challenge_id, habit_index):
    user_id = get_jwt_identity()
    group = Group.query.filter_by(group_id=group_id).first()
    if not group or not group.active_challenge or group.active_challenge.id != challenge_id:
        return jsonify({'error': 'Group or challenge not found'}), 404

    challenge = group.active_challenge
    # member_habits is a JSON field (list of dicts)
    member_habits = challenge.member_habits
    member_habit = next((mh for mh in member_habits if str(mh['member']) == str(user_id)), None)
    if not member_habit:
        return jsonify({'error': 'Member not found in challenge'}), 404

    # Find the habit by index
    try:
        habit = member_habit['habits'][habit_index]
    except IndexError:
        return jsonify({'error': 'Habit not found'}), 404

    # Find today's progress entry or create it
    today = datetime.utcnow().date().isoformat()
    progress_entry = next((p for p in habit.get('progress', []) if p['date'][:10] == today), None)
    if not progress_entry:
        progress_entry = {'date': today, 'completed': False}
        habit.setdefault('progress', []).append(progress_entry)

    # Get user info for the message
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Toggle completion
    was_completed = progress_entry['completed']
    progress_entry['completed'] = not progress_entry['completed']

    # Save back to the challenge
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    db.session.commit()

    # Post system message if habit was completed (not uncompleted)
    if progress_entry['completed'] and not was_completed:
        # Create system message
        system_message = Message(
            group_id=group.id,
            sender_id=user_id,  # Still need a sender_id for the foreign key
            content=f"{user.username} completed habit: {habit['name']}",
            message_type='system'
        )
        db.session.add(system_message)
        db.session.commit()

    return jsonify({'success': True, 'completed': progress_entry['completed']})

@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/habit/<int:habit_index>/numeric', methods=['POST'])
@jwt_required()
def update_numeric_habit(group_id, challenge_id, habit_index):
    user_id = get_jwt_identity()
    data = request.get_json()
    value = data.get('value')
    
    if value is None:
        return jsonify({'error': 'Value is required'}), 400

    group = Group.query.filter_by(group_id=group_id).first()
    if not group or not group.active_challenge or group.active_challenge.id != challenge_id:
        return jsonify({'error': 'Group or challenge not found'}), 404

    challenge = group.active_challenge
    member_habits = challenge.member_habits
    member_habit = next((mh for mh in member_habits if str(mh['member']) == str(user_id)), None)
    if not member_habit:
        return jsonify({'error': 'Member not found in challenge'}), 404

    try:
        habit = member_habit['habits'][habit_index]
    except IndexError:
        return jsonify({'error': 'Habit not found'}), 404

    # Validate value is within range
    min_value = habit.get('minValue', 0)
    max_value = habit.get('maxValue', 10)
    if value < min_value or value > max_value:
        return jsonify({'error': f'Value must be between {min_value} and {max_value}'}), 400

    # Find today's progress entry or create it
    today = datetime.utcnow().date().isoformat()
    progress_entry = next((p for p in habit.get('progress', []) if p['date'][:10] == today), None)
    if not progress_entry:
        progress_entry = {'date': today, 'completed': False, 'numericValue': None}
        habit.setdefault('progress', []).append(progress_entry)

    # Update numeric value and mark as completed
    progress_entry['numericValue'] = value
    progress_entry['completed'] = True

    # Save back to the challenge
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    db.session.commit()

    # Post system message for habit completion
    user = User.query.get(user_id)
    if user:
        system_message = Message(
            group_id=group.id,
            sender_id=user_id,
            content=f"{user.username} completed habit: {habit['name']}",
            message_type='system'
        )
        db.session.add(system_message)
        db.session.commit()

    return jsonify({'success': True, 'numericValue': value})

@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/habit/<int:habit_index>/text', methods=['POST'])
@jwt_required()
def update_text_habit(group_id, challenge_id, habit_index):
    user_id = get_jwt_identity()
    data = request.get_json()
    value = data.get('value')
    
    if not value or not value.strip():
        return jsonify({'error': 'Text value is required'}), 400

    group = Group.query.filter_by(group_id=group_id).first()
    if not group or not group.active_challenge or group.active_challenge.id != challenge_id:
        return jsonify({'error': 'Group or challenge not found'}), 404

    challenge = group.active_challenge
    member_habits = challenge.member_habits
    member_habit = next((mh for mh in member_habits if str(mh['member']) == str(user_id)), None)
    if not member_habit:
        return jsonify({'error': 'Member not found in challenge'}), 404

    try:
        habit = member_habit['habits'][habit_index]
    except IndexError:
        return jsonify({'error': 'Habit not found'}), 404

    # Find today's progress entry or create it
    today = datetime.utcnow().date().isoformat()
    progress_entry = next((p for p in habit.get('progress', []) if p['date'][:10] == today), None)
    if not progress_entry:
        progress_entry = {'date': today, 'completed': False, 'textValue': None}
        habit.setdefault('progress', []).append(progress_entry)

    # Update text value and mark as completed
    progress_entry['textValue'] = value.strip()
    progress_entry['completed'] = True

    # Save back to the challenge
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    db.session.commit()

    # Post system message for habit completion
    user = User.query.get(user_id)
    if user:
        system_message = Message(
            group_id=group.id,
            sender_id=user_id,
            content=f"{user.username} completed habit: {habit['name']}",
            message_type='system'
        )
        db.session.add(system_message)
        db.session.commit()

    return jsonify({'success': True, 'textValue': value.strip()}) 

@groups_bp.route('/<group_id>/chat', methods=['GET'])
@jwt_required()
def get_group_chat(group_id):
    current_user_id = int(get_jwt_identity())
    group = Group.query.filter_by(group_id=group_id).first()
    if not group and str(group_id).isdigit():
        group = Group.query.get(int(group_id))
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    context, error_response, status_code = get_chat_channel_context(group, current_user_id, request.args.get('classId'))
    if error_response:
        return error_response, status_code

    messages = Message.query.filter_by(
        group_id=group.id,
        recipient_id=None,
        class_id=context['class_id']
    ).order_by(Message.created_at.asc()).all()
    return jsonify({
        'messages': [message.to_dict() for message in messages],
        'channel': context['channel']
    })


@groups_bp.route('/<group_id>/chat', methods=['POST'])
@jwt_required()
def send_group_chat(group_id):
    user = get_current_user()
    group = Group.query.filter_by(group_id=group_id).first()
    if not group and str(group_id).isdigit():
        group = Group.query.get(int(group_id))
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    context, error_response, status_code = get_chat_channel_context(group, user.id, data.get('classId'))
    if error_response:
        return error_response, status_code

    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Message content required'}), 400
    msg = Message(group_id=group.id, sender_id=user.id, class_id=context['class_id'], content=content)
    db.session.add(msg)
    db.session.commit()
    return jsonify({'success': True, 'message': msg.to_dict(), 'channel': context['channel']})

@groups_bp.route('/<group_id>/dm/<int:user_id>', methods=['GET'])
@jwt_required()
def get_dm(group_id, user_id):
    group = Group.query.filter_by(group_id=group_id).first_or_404()
    if not school_group_dms_allowed(group):
        return jsonify({'error': 'Direct messages are disabled for school groups'}), 403
    user = get_current_user()
    is_leader = user.id == group.leader_id
    is_member = user.id in [m.id for m in group.members]
    is_dm_with_leader = (user_id == group.leader_id and is_member) or (is_leader and user_id in [m.id for m in group.members])
    if not is_dm_with_leader:
        return jsonify({'error': 'Not authorized'}), 403
    # Always use current user id and target user id for filtering
    messages = Message.query.filter_by(group_id=group.id).filter(
        ((Message.sender_id == user.id) & (Message.recipient_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.recipient_id == user.id))
    ).order_by(Message.created_at.asc()).all()
    return jsonify([{
        'id': m.id,
        'sender_id': m.sender_id,
        'sender_username': m.sender.username if m.sender else None,
        'recipient_id': m.recipient_id,
        'content': m.content,
        'created_at': m.created_at.isoformat()
    } for m in messages])

@groups_bp.route('/<group_id>/dm/<int:user_id>', methods=['POST'])
@jwt_required()
def send_dm(group_id, user_id):
    # Look up group by group_id (code) instead of assuming it's an integer
    group = Group.query.filter_by(group_id=group_id).first_or_404()
    if not school_group_dms_allowed(group):
        return jsonify({'error': 'Direct messages are disabled for school groups'}), 403
    user = get_current_user()
    is_leader = user.id == group.leader_id
    is_member = user.id in [m.id for m in group.members]
    is_dm_with_leader = (user_id == group.leader_id and is_member) or (is_leader and user_id in [m.id for m in group.members])
    if not is_dm_with_leader:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Message content required'}), 400
    # Determine recipient: if sender is leader, recipient is user_id; if sender is member, recipient is leader
    recipient_id = user_id if is_leader else group.leader_id
    msg = Message(group_id=group.id, sender_id=user.id, recipient_id=recipient_id, content=content)
    db.session.add(msg)
    db.session.commit()
    return jsonify({'success': True, 'message': 'DM sent'})

@groups_bp.route('/inbox', methods=['GET'])
@jwt_required()
def get_inbox():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get all groups the user is in or staff on
    user_groups = Group.query.filter(
        (Group.leader_id == user.id) | 
        (Group.members.any(id=user.id)) |
        (Group.coaches.any(id=user.id))
    ).all()
    role_groups = Group.query.join(SchoolRoleAssignment, SchoolRoleAssignment.group_id == Group.id).filter(
        SchoolRoleAssignment.user_id == user.id
    ).all()
    group_map = {group.id: group for group in user_groups}
    for group in role_groups:
        group_map[group.id] = group
    user_groups = list(group_map.values())
    
    inbox_messages = []
    
    for group in user_groups:
        accessible_class_ids = get_accessible_class_ids(group, user.id)
        # Get unread group chat messages
        group_messages = Message.query.filter_by(
            group_id=group.id, 
            recipient_id=None
        ).filter(
            Message.created_at > user.created_at  # Only messages after user joined
        ).order_by(Message.created_at.desc()).limit(10).all()
        
        for msg in group_messages:
            if msg.class_id is not None and msg.class_id not in accessible_class_ids:
                continue
            read_by = json.loads(msg.read_by or '[]')
            if user.id not in read_by:
                deep_link = f"/groups/{group.group_id}?tab=chat"
                if msg.class_id:
                    deep_link = f"/groups/{group.group_id}?tab=chat&class={msg.class_id}"
                inbox_messages.append({
                    'id': msg.id,
                    'type': 'group_chat',
                    'category': 'group',
                    'group_id': group.group_id,  # Use public code
                    'group_name': group.name,
                    'sender_id': msg.sender_id,
                    'sender_username': msg.sender.username if msg.sender else None,
                    'class_id': msg.class_id,
                    'class_name': msg.school_class.name if msg.school_class else None,
                    'content': msg.content,
                    'created_at': msg.created_at.isoformat(),
                    'message_type': msg.message_type,
                    'deep_link': deep_link,
                    'unread': True
                })
        
        # Get unread DMs
        if school_group_dms_allowed(group) and user.id == group.leader_id:
            # Leader: get DMs from all members
            for member in group.members:
                dm_messages = Message.query.filter_by(
                    group_id=group.id,
                    sender_id=member.id,
                    recipient_id=user.id
                ).order_by(Message.created_at.desc()).limit(5).all()
                
                for msg in dm_messages:
                    read_by = json.loads(msg.read_by or '[]')
                    if user.id not in read_by:
                        inbox_messages.append({
                            'id': msg.id,
                            'type': 'dm',
                            'category': 'dm',
                            'group_id': group.group_id,  # Use public code
                            'group_name': group.name,
                            'sender_id': msg.sender_id,
                            'sender_username': msg.sender.username if msg.sender else None,
                            'content': msg.content,
                            'created_at': msg.created_at.isoformat(),
                            'deep_link': f"/groups/{group.group_id}?tab=dms&user={msg.sender_id}",
                            'unread': True
                        })
        elif school_group_dms_allowed(group):
            # Member or staff: get DMs sent to this user
            dm_messages = Message.query.filter_by(
                group_id=group.id,
                recipient_id=user.id
            ).filter(Message.sender_id != user.id).order_by(Message.created_at.desc()).limit(10).all()
            
            for msg in dm_messages:
                read_by = json.loads(msg.read_by or '[]')
                if user.id not in read_by:
                    sender_target = msg.sender_id if msg.sender_id != user.id else group.leader_id
                    inbox_messages.append({
                        'id': msg.id,
                        'type': 'dm',
                        'category': 'dm',
                        'group_id': group.group_id,  # Use public code
                        'group_name': group.name,
                        'sender_id': msg.sender_id,
                        'sender_username': msg.sender.username if msg.sender else None,
                        'content': msg.content,
                        'created_at': msg.created_at.isoformat(),
                        'deep_link': f"/groups/{group.group_id}?tab=dm&user={sender_target}",
                        'unread': True
                    })

        system_messages = Message.query.filter_by(
            group_id=group.id,
            recipient_id=user.id,
            message_type='system'
        ).order_by(Message.created_at.desc()).limit(10).all()
        for msg in system_messages:
            read_by = json.loads(msg.read_by or '[]')
            if user.id in read_by:
                continue
            content_lower = (msg.content or '').lower()
            deep_link = f"/groups/{group.group_id}?tab=school-impact"
            alert_date = msg.created_at.date().isoformat() if msg.created_at else date.today().isoformat()
            if 'intervention' in content_lower or 'homework trigger' in content_lower or 'overdue' in content_lower:
                deep_link = f"/teacher-desk?group={group.group_id}&date={alert_date}"
            elif 'homework set:' in content_lower:
                deep_link = f"/groups/{group.group_id}?tab=school-impact&section=school-homework"
            elif 'lesson register' in content_lower or 'register' in content_lower:
                deep_link = f"/teacher-desk?group={group.group_id}&date={alert_date}"
            elif 'habit' in content_lower:
                deep_link = f"/groups/{group.group_id}"
            inbox_messages.append({
                'id': msg.id,
                'type': 'system',
                'category': 'system',
                'group_id': group.group_id,
                'group_name': group.name,
                'sender_id': msg.sender_id,
                'sender_username': msg.sender.username if msg.sender else None,
                'content': msg.content,
                'created_at': msg.created_at.isoformat(),
                'message_type': msg.message_type,
                'deep_link': deep_link,
                'unread': True
            })
    
    # Sort by creation date (newest first)
    inbox_messages.sort(key=lambda x: x['created_at'], reverse=True)
    
    counts = {
        'all': len(inbox_messages),
        'system': len([item for item in inbox_messages if item.get('category') == 'system']),
        'group': len([item for item in inbox_messages if item.get('category') == 'group']),
        'dm': len([item for item in inbox_messages if item.get('category') == 'dm'])
    }
    return jsonify({'messages': inbox_messages, 'counts': counts})

@groups_bp.route('/inbox/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get all groups the user is in or staff on
    user_groups = Group.query.filter(
        (Group.leader_id == user.id) | 
        (Group.members.any(id=user.id)) |
        (Group.coaches.any(id=user.id))
    ).all()
    role_groups = Group.query.join(SchoolRoleAssignment, SchoolRoleAssignment.group_id == Group.id).filter(
        SchoolRoleAssignment.user_id == user.id
    ).all()
    group_map = {group.id: group for group in user_groups}
    for group in role_groups:
        group_map[group.id] = group
    user_groups = list(group_map.values())
    
    total_unread = 0
    
    for group in user_groups:
        accessible_class_ids = get_accessible_class_ids(group, user.id)
        # Count unread group chat messages
        group_messages = Message.query.filter_by(
            group_id=group.id, 
            recipient_id=None
        ).filter(
            Message.created_at > user.created_at
        ).all()
        
        for msg in group_messages:
            if msg.class_id is not None and msg.class_id not in accessible_class_ids:
                continue
            read_by = json.loads(msg.read_by or '[]')
            if user.id not in read_by:
                total_unread += 1
        
        # Count unread DMs
        if school_group_dms_allowed(group) and user.id == group.leader_id:
            # Leader: count DMs from all members
            for member in group.members:
                dm_messages = Message.query.filter_by(
                    group_id=group.id,
                    sender_id=member.id,
                    recipient_id=user.id
                ).all()
                
                for msg in dm_messages:
                    read_by = json.loads(msg.read_by or '[]')
                    if user.id not in read_by:
                        total_unread += 1
        elif school_group_dms_allowed(group):
            dm_messages = Message.query.filter_by(
                group_id=group.id,
                recipient_id=user.id
            ).filter(Message.sender_id != user.id).all()
            
            for msg in dm_messages:
                read_by = json.loads(msg.read_by or '[]')
                if user.id not in read_by:
                    total_unread += 1

        system_messages = Message.query.filter_by(
            group_id=group.id,
            recipient_id=user.id,
            message_type='system'
        ).all()
        for msg in system_messages:
            read_by = json.loads(msg.read_by or '[]')
            if user.id not in read_by:
                total_unread += 1
    
    return jsonify({'unread_count': total_unread})

@groups_bp.route('/messages/<int:message_id>/mark-read', methods=['POST'])
@jwt_required()
def mark_message_read(message_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    message = Message.query.get_or_404(message_id)
    
    # Verify user has access to this message
    group = Group.query.get(message.group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    
    # Check if user is in the group
    if not user_can_access_group(group, user.id):
        return jsonify({'error': 'Not authorized'}), 403
    if message.class_id is not None and message.class_id not in get_accessible_class_ids(group, user.id):
        return jsonify({'error': 'Not authorized'}), 403

    # Mark message as read
    if mark_messages_read_for_user([message], user.id):
        db.session.commit()
    
    return jsonify({'success': True})

@groups_bp.route('/<group_id>/chat/mark-all-read', methods=['POST'])
@jwt_required()
def mark_all_group_chat_read(group_id):
    user_id = get_jwt_identity()
    group = Group.query.filter_by(group_id=group_id).first()
    if not group and str(group_id).isdigit():
        group = Group.query.get(int(group_id))
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    context, error_response, status_code = get_chat_channel_context(group, int(user_id), request.args.get('classId'))
    if error_response:
        return error_response, status_code
    group_messages = Message.query.filter_by(
        group_id=group.id,
        recipient_id=None,
        class_id=context['class_id']
    ).all()
    updated = mark_messages_read_for_user(group_messages, int(user_id))
    db.session.commit()
    return jsonify({'success': True, 'updated': updated})

@groups_bp.route('/<group_id>/dm/<int:user_id>/mark-all-read', methods=['POST'])
@jwt_required()
def mark_all_dm_read(group_id, user_id):
    current_user_id = get_jwt_identity()
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if not school_group_dms_allowed(group):
        return jsonify({'error': 'Direct messages are disabled for school groups'}), 403
    import json
    # Mark all DMs between current user and user_id as read for current user
    messages = Message.query.filter_by(group_id=group.id).filter(
        ((Message.sender_id == current_user_id) & (Message.recipient_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.recipient_id == current_user_id))
    ).all()
    updated = 0
    for msg in messages:
        read_by = json.loads(msg.read_by or '[]')
        if current_user_id not in read_by:
            read_by.append(current_user_id)
            msg.read_by = json.dumps(read_by)
            updated += 1
    db.session.commit()
    return jsonify({'success': True, 'updated': updated})


@groups_bp.route('/<group_id>/archives', methods=['GET'])
@jwt_required()
def get_group_archives(group_id):
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        # Check if user is group leader (only leaders can view archives)
        if not can_manage_group(group, user_id):
            return jsonify({'error': 'Only group leaders can view archives'}), 403
        
        # Get all completed challenges for this group
        completed_challenges = GroupChallenge.query.filter_by(
            group_id=group.id, 
            status='completed'
        ).order_by(GroupChallenge.end_date.desc()).all()
        
        archives = []
        for challenge in completed_challenges:
            # Calculate challenge statistics
            total_days = (challenge.end_date - challenge.start_date).days + 1
            total_members = len(challenge.member_habits)
            
            # Calculate overall completion rate
            total_possible_completions = 0
            total_actual_completions = 0
            
            member_stats = []
            for member_habit in challenge.member_habits:
                member_id = member_habit['member']
                member = User.query.get(member_id)
                if not member:
                    continue
                    
                habits = member_habit.get('habits', [])
                habit_details = []
                
                # Track which days the member completed ANY habit
                completed_dates = set()
                
                # First, collect all progress data for all habits
                all_habit_progress = {}
                for habit in habits:
                    habit_name = habit.get('name', 'Unknown Habit')
                    habit_type = habit.get('habitType', 'boolean')
                    progress = habit.get('progress', [])
                    
                    # Create a map of progress entries for this habit
                    habit_progress_map = {}
                    for progress_entry in progress:
                        progress_date = datetime.fromisoformat(progress_entry['date']).date()
                        if challenge.start_date.date() <= progress_date <= challenge.end_date.date():
                            habit_progress_map[progress_date.isoformat()] = progress_entry.get('completed', False)
                    
                    all_habit_progress[habit_name] = {
                        'type': habit_type,
                        'progress_map': habit_progress_map
                    }
                
                # Now calculate individual habit performance and track daily participation
                for habit_name, habit_data in all_habit_progress.items():
                    habit_type = habit_data['type']
                    progress_map = habit_data['progress_map']
                    
                    # Count completions for this habit during challenge period
                    habit_completed_days = 0
                    habit_total_days = total_days  # Each habit should be done every day of the challenge
                    
                    # Check each day of the challenge for this habit
                    for day_offset in range(total_days):
                        current_date = challenge.start_date.date() + timedelta(days=day_offset)
                        date_str = current_date.isoformat()
                        
                        if date_str in progress_map and progress_map[date_str]:
                            habit_completed_days += 1
                    
                    habit_details.append({
                        'name': habit_name,
                        'type': habit_type,
                        'completed_days': habit_completed_days,
                        'total_days': habit_total_days,
                        'completion_rate': round((habit_completed_days / habit_total_days * 100) if habit_total_days > 0 else 0, 1)
                    })
                
                # Now calculate daily participation (days with ANY habit completed)
                for day_offset in range(total_days):
                    current_date = challenge.start_date.date() + timedelta(days=day_offset)
                    date_str = current_date.isoformat()
                    
                    # Check if ANY habit was completed on this day
                    day_has_completion = False
                    for habit_data in all_habit_progress.values():
                        if date_str in habit_data['progress_map'] and habit_data['progress_map'][date_str]:
                            day_has_completion = True
                            break
                    
                    if day_has_completion:
                        completed_dates.add(date_str)
                
                # Member performance: days with ANY habit completed / total challenge days
                member_days_completed = len(completed_dates)
                member_total_days = total_days
                member_completion_rate = (member_days_completed / member_total_days * 100) if member_total_days > 0 else 0
                
                # For overall stats, count total habit completions
                total_habit_completions = sum(h['completed_days'] for h in habit_details)
                total_possible_habit_completions = sum(h['total_days'] for h in habit_details)
                
                total_possible_completions += total_possible_habit_completions
                total_actual_completions += total_habit_completions
                
                member_stats.append({
                    'id': member_id,
                    'username': member.username,
                    'days_completed': member_days_completed,  # Days with ANY habit completed
                    'total_days': member_total_days,  # Total challenge days
                    'completion_rate': round(member_completion_rate, 1),  # Days with habits / total days
                    'habit_details': habit_details,
                    'total_habit_completions': total_habit_completions,  # Total individual habit completions
                    'total_possible_habit_completions': total_possible_habit_completions
                })
            
            overall_completion_rate = (total_actual_completions / total_possible_completions * 100) if total_possible_completions > 0 else 0
            
            # Generate daily progress data for graphs
            daily_progress = []
            for day_offset in range(total_days):
                current_date = challenge.start_date.date() + timedelta(days=day_offset)
                date_str = current_date.isoformat()
                
                # Calculate daily completion rate (average of user averages)
                user_daily_averages = []
                for member_habit in challenge.member_habits:
                    habits = member_habit.get('habits', [])
                    if not habits:
                        continue
                    
                    user_daily_total = 0
                    for habit in habits:
                        progress = habit.get('progress', [])
                        progress_entry = next((p for p in progress if p['date'][:10] == date_str), None)
                        if progress_entry and progress_entry.get('completed', False):
                            user_daily_total += 1
                    
                    user_daily_average = user_daily_total / len(habits) if habits else 0
                    user_daily_averages.append(user_daily_average)
                
                daily_avg = sum(user_daily_averages) / len(user_daily_averages) if user_daily_averages else 0
                
                daily_progress.append({
                    'date': date_str,
                    'completion_rate': round(daily_avg * 100, 1)
                })
            
            archives.append({
                'id': challenge.id,
                'title': f"{challenge.start_date.strftime('%b %d')} - {challenge.end_date.strftime('%b %d, %Y')} Challenge",
                'start_date': challenge.start_date.isoformat(),
                'end_date': challenge.end_date.isoformat(),
                'duration_days': total_days,
                'total_members': total_members,
                'overall_completion_rate': round(overall_completion_rate, 1),
                'total_completions': total_actual_completions,
                'total_possible': total_possible_completions,
                'member_stats': member_stats,
                'daily_progress': daily_progress,
                'created_at': challenge.created_at.isoformat()
            })
        
        return jsonify({'archives': archives}), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/attendance', methods=['GET'])
@jwt_required()
def get_group_attendance(group_id):
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        # Check if user is group leader (only leaders can view attendance)
        if not can_manage_group(group, user_id):
            return jsonify({'error': 'Only group leaders can view attendance'}), 403
        
        # Auto-finalize an overdue active challenge (same logic as get_group)
        if group.active_challenge:
            try:
                challenge = group.active_challenge
                # Compare using dates to avoid tz issues
                challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
                today = date.today()
                if challenge_end and challenge_end < today:
                    challenge.status = 'completed'
                    group.active_challenge_id = None
                    db.session.commit()
                    # Re-fetch group to reflect changes
                    group = Group.query.filter_by(group_id=group_id).first()
            except Exception:
                # Do not fail the request if finalization throws
                db.session.rollback()
        
        if not group.active_challenge:
            return jsonify({'error': 'No active challenge', 'attendance': []}), 200

        challenge = group.active_challenge
        total_days = (challenge.end_date - challenge.start_date).days + 1
        
        # Calculate attendance for each member
        attendance_data = []
        for member_habit in challenge.member_habits:
            member_id = member_habit['member']
            member = User.query.get(member_id)
            if not member:
                continue
                
            habits = member_habit.get('habits', [])
            
            # Track which days the member was active (completed ANY habit)
            active_dates = set()
            
            # Collect all progress data for this member
            for habit in habits:
                progress = habit.get('progress', [])
                for progress_entry in progress:
                    # Parse the date string consistently
                    progress_date_str = progress_entry['date']
                    # Handle both ISO datetime strings and date-only strings
                    if 'T' in progress_date_str:
                        progress_date = datetime.fromisoformat(progress_date_str.replace('Z', '+00:00')).date()
                    else:
                        progress_date = datetime.fromisoformat(progress_date_str).date()
                    
                    # Ensure challenge dates are date objects
                    challenge_start = challenge.start_date.date() if isinstance(challenge.start_date, datetime) else challenge.start_date
                    challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
                    
                    if challenge_start <= progress_date <= challenge_end:
                        if progress_entry.get('completed', False):
                            active_dates.add(progress_date.isoformat())
            
            # Calculate attendance statistics
            days_active = len(active_dates)
            attendance_rate = (days_active / total_days * 100) if total_days > 0 else 0
            
            # Get recent activity (last 7 days including today, but not before challenge start)
            recent_activity = []
            today = date.today()  # Use date.today() for consistent local date
            challenge_start = challenge.start_date.date() if isinstance(challenge.start_date, datetime) else challenge.start_date
            challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
            
            # Calculate how many days to show (min of 7 or days since challenge start)
            days_since_start = (today - challenge_start).days + 1  # +1 to include today
            days_to_show = min(7, days_since_start)
            
            for i in range(days_to_show):
                check_date = today - timedelta(days=i)
                # Don't show dates before challenge started
                if check_date >= challenge_start:
                    date_str = check_date.isoformat()
                    recent_activity.append({
                        'date': date_str,
                        'active': date_str in active_dates
                    })
            
            # Generate full attendance history (all days from challenge start to today or end date)
            full_attendance = []
            current_date = challenge_start
            end_date_for_display = min(today, challenge_end)
            
            while current_date <= end_date_for_display:
                date_str = current_date.isoformat()
                full_attendance.append({
                    'date': date_str,
                    'active': date_str in active_dates
                })
                current_date += timedelta(days=1)
            
            attendance_data.append({
                'member_id': member_id,
                'username': member.username,
                'days_active': days_active,
                'total_days': total_days,
                'attendance_rate': round(attendance_rate, 1),
                'recent_activity': recent_activity,
                'full_attendance': full_attendance,
                'last_active': max(active_dates) if active_dates else None
            })
        
        # Sort by attendance rate (highest first)
        attendance_data.sort(key=lambda x: x['attendance_rate'], reverse=True)
        
        return jsonify({
            'attendance': attendance_data,
            'challenge_info': {
                'start_date': challenge.start_date.isoformat(),
                'end_date': challenge.end_date.isoformat(),
                'total_days': total_days,
                'server_date': date.today().isoformat()  # For debugging
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>', methods=['DELETE'])
@jwt_required()
def delete_group_challenge(group_id, challenge_id):
    """Allow group leader to permanently remove an active challenge and all its data."""
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only the group leader can delete a challenge
        if not can_manage_group(group, user_id):
            return jsonify({'error': 'Only group leaders can remove a challenge'}), 403

        challenge = GroupChallenge.query.get(challenge_id)
        if not challenge or challenge.group_id != group.id:
            return jsonify({'error': 'Challenge not found'}), 404

        # If this is the active challenge, clear the reference
        if group.active_challenge_id == challenge.id:
            group.active_challenge_id = None

        # Delete the challenge (member_habits data will be removed with it)
        db.session.delete(challenge)
        db.session.commit()

        return jsonify({'message': 'Challenge removed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/member/<int:member_id>/habit/<int:habit_index>/toggle-day', methods=['POST'])
@jwt_required()
def toggle_habit_day_status(group_id, challenge_id, member_id, habit_index):
    """Allow group leader to manually toggle a member's habit completion status for a specific day"""
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        # Only group leaders can modify member habits
        if not can_manage_group(group, user_id):
            return jsonify({'error': 'Only group leaders can modify member habits'}), 403
        
        challenge = GroupChallenge.query.get(challenge_id)
        if not challenge or challenge.group_id != group.id:
            return jsonify({'error': 'Challenge not found'}), 404
        
        data = request.get_json()
        target_date = data.get('date')  # Should be ISO date string YYYY-MM-DD
        new_status = data.get('completed')  # True or False (for boolean habits)
        numeric_value = data.get('numericValue')  # Number (for numeric habits)
        text_value = data.get('textValue')  # String (for text habits)
        
        if not target_date:
            return jsonify({'error': 'Missing date'}), 400
        
        # Prevent modification of today's data
        today = date.today().isoformat()
        if target_date == today:
            return jsonify({'error': 'Cannot modify today\'s data. Students must log their own progress for today.'}), 403
        
        # Find the member's habits
        member_habit = None
        for mh in challenge.member_habits:
            if str(mh.get('member')) == str(member_id):
                member_habit = mh
                break
        
        if not member_habit:
            return jsonify({'error': 'Member not found in challenge'}), 404
        
        habits = member_habit.get('habits', [])
        if habit_index < 0 or habit_index >= len(habits):
            return jsonify({'error': 'Invalid habit index'}), 400
        
        habit = habits[habit_index]
        habit_type = habit.get('habitType', 'boolean')
        progress = habit.get('progress', [])
        
        # Check if progress entry already exists for this date
        existing_entry = None
        for p in progress:
            if p['date'].startswith(target_date):  # Handle both date and datetime strings
                existing_entry = p
                break
        
        if existing_entry:
            # Update existing entry based on habit type
            if habit_type == 'numeric' and numeric_value is not None:
                existing_entry['numericValue'] = numeric_value
                existing_entry['completed'] = True  # Auto-mark as completed when value is set
            elif habit_type == 'text' and text_value is not None:
                existing_entry['textValue'] = text_value
                existing_entry['completed'] = True  # Auto-mark as completed when value is set
            elif new_status is not None:
                existing_entry['completed'] = new_status
        else:
            # Create new progress entry
            new_entry = {
                'date': f"{target_date}T00:00:00",  # Store as ISO datetime
                'completed': new_status if new_status is not None else False
            }
            
            if habit_type == 'numeric' and numeric_value is not None:
                new_entry['numericValue'] = numeric_value
                new_entry['completed'] = True
            elif habit_type == 'text' and text_value is not None:
                new_entry['textValue'] = text_value
                new_entry['completed'] = True
            
            progress.append(new_entry)
        
        habit['progress'] = progress
        
        # Mark the field as modified for SQLAlchemy to detect the change
        flag_modified(challenge, 'member_habits')
        db.session.commit()
        
        return jsonify({
            'message': 'Habit status updated successfully',
            'date': target_date,
            'completed': new_status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


# Skill Development Chart endpoints
@groups_bp.route('/<group_id>/members/<int:member_id>/skill-charts/<term>', methods=['GET'])
@jwt_required()
def get_skill_chart(group_id, member_id, term):
    """Get skill development chart for a specific member and term"""
    try:
        current_user_id = int(get_jwt_identity())
        
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        # Check authorization: group leader, coach assigned to this student, or the student themselves
        is_leader = can_manage_group(group, current_user_id)
        is_coach = any(coach.id == current_user_id for coach in group.coaches)
        is_student = member_id == current_user_id
        
        # If coach, check if assigned to this student
        if is_coach and not is_leader:
            assignment = CoachAssignment.query.filter_by(
                coach_id=current_user_id,
                group_id=group.id,
                student_id=member_id
            ).first()
            if not assignment:
                return jsonify({'error': 'You are not assigned to monitor this student'}), 403
        
        if not is_leader and not is_coach and not is_student:
            return jsonify({'error': 'Unauthorized to view this skill chart'}), 403
            
        # Check if member is in the group
        if not any(member.id == member_id for member in group.members):
            return jsonify({'error': 'Member not found in group'}), 404
            
        # Get or create skill chart
        skill_chart = SkillDevelopmentChart.query.filter_by(
            group_id=group.id,  # Use the integer id for the database query
            member_id=member_id,
            term=term
        ).first()
        
        if not skill_chart:
            # Return default empty chart (don't create it in DB yet)
            return jsonify({
                'skillLevels': {},
                'colorScheme': {
                    'unstarted': '#ffffff',
                    'urgent': '#ef4444',      # red
                    'development': '#f97316', # orange
                    'growth': '#eab308',      # yellow
                    'aboveAverage': '#22c55e', # green
                    'excellent': '#15803d'    # dark green
                },
                'editHistory': {},
                'lastEditedBy': None,
                'lastEditedAt': None
            }), 200
        
        return jsonify(skill_chart.to_dict()), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/members/<int:member_id>/skill-charts/<term>', methods=['PUT'])
@jwt_required()
def update_skill_chart(group_id, member_id, term):
    """Update skill development chart for a specific member and term"""
    try:
        current_user_id = int(get_jwt_identity())
        
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        # Check authorization: group leader or coach assigned to this student
        is_leader = can_manage_group(group, current_user_id)
        is_coach = any(coach.id == current_user_id for coach in group.coaches)
        
        # If coach, check if assigned to this student
        if is_coach and not is_leader:
            assignment = CoachAssignment.query.filter_by(
                coach_id=current_user_id,
                group_id=group.id,
                student_id=member_id
            ).first()
            if not assignment:
                return jsonify({'error': 'You are not assigned to monitor this student'}), 403
        
        if not is_leader and not is_coach:
            return jsonify({'error': 'Only group leaders and assigned coaches can edit skill charts'}), 403
            
        # Check if member is in the group
        if not any(member.id == member_id for member in group.members):
            return jsonify({'error': 'Member not found in group'}), 404
        
        data = request.get_json()
        skill_levels = data.get('skillLevels', {})
        color_scheme = data.get('colorScheme', {})
        edited_cells = data.get('editedCells', [])  # Array of cell keys that were edited
        
        # Get current user info for edit history
        current_user = User.query.get(current_user_id)
        current_time = datetime.utcnow()
        
        # Get or create skill chart
        skill_chart = SkillDevelopmentChart.query.filter_by(
            group_id=group.id,  # Use the integer id for the database query
            member_id=member_id,
            term=term
        ).first()
        
        # Initialize edit_history if it doesn't exist
        edit_history = skill_chart.edit_history if skill_chart and skill_chart.edit_history else {}
        
        # Update edit history for edited cells
        for cell_key in edited_cells:
            edit_history[cell_key] = {
                'editorId': current_user_id,
                'editorName': current_user.username if current_user else 'Unknown',
                'editedAt': current_time.isoformat()
            }
        
        if not skill_chart:
            skill_chart = SkillDevelopmentChart(
                group_id=group.id,  # Use the integer id for the database query
                member_id=member_id,
                term=term,
                skill_levels=skill_levels,
                color_scheme=color_scheme,
                edit_history=edit_history,
                last_edited_by_id=current_user_id,
                last_edited_at=current_time
            )
            db.session.add(skill_chart)
        else:
            skill_chart.skill_levels = skill_levels
            skill_chart.color_scheme = color_scheme
            skill_chart.edit_history = edit_history
            skill_chart.last_edited_by_id = current_user_id
            skill_chart.last_edited_at = current_time
            skill_chart.updated_at = current_time
            flag_modified(skill_chart, 'edit_history')  # Mark JSON field as modified
        
        db.session.commit()
        
        return jsonify({
            'message': 'Skill chart updated successfully',
            'skillChart': skill_chart.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/members/<int:member_id>/skill-charts/<term>/reset', methods=['POST'])
@jwt_required()
def reset_skill_chart(group_id, member_id, term):
    """Reset skill development chart to default values"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Verify user is group owner
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only group owners can reset skill charts'}), 403
            
        # Check if member is in the group
        if not any(member.id == member_id for member in group.members):
            return jsonify({'error': 'Member not found in group'}), 404
        
        # Get skill chart
        skill_chart = SkillDevelopmentChart.query.filter_by(
            group_id=group.id,  # Use the integer id for the database query
            member_id=member_id,
            term=term
        ).first()
        
        if skill_chart:
            # Reset to default values
            skill_chart.skill_levels = {}
            skill_chart.color_scheme = {
                'unstarted': '#ffffff',
                'urgent': '#ef4444',      # red
                'development': '#f97316', # orange
                'growth': '#eab308',      # yellow
                'aboveAverage': '#22c55e', # green
                'excellent': '#15803d'    # dark green
            }
            skill_chart.updated_at = datetime.utcnow()
            db.session.commit()
        
        return jsonify({
            'message': 'Skill chart reset successfully',
            'skillChart': skill_chart.to_dict() if skill_chart else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500
