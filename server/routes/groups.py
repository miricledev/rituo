from collections import defaultdict
from flask import Blueprint, jsonify, request, send_from_directory, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from db.models import db, User, Group, GroupChallenge, StaffPersonalChallenge, StudentSchedulePlan, StudentPlannerSettings, StudentIpWallet, StudentIpTransaction, StudentIpPurchase, StudentToolState, MeditationSession, Message, SkillDevelopmentChart, HabitPreset, CoachAssignment, Course, CourseSection, CourseItem, CourseProgress, StudentGoal, SchoolImpactRecord, PerformanceCard, LessonRegister, InterventionRecord, ParentContactRecord, ParentProfile, SchoolAuditLog, SchoolRoleAssignment, SchoolSubject, SchoolRoom, SchoolClass, SchoolEnrollment, SchoolTeachingAssignment, SchoolBehaviourType, SchoolBehaviourEvent, SchoolHomeworkAssignment, SchoolHomeworkSubmission
import base64
import html
import uuid
import stripe
import logging
import json
import csv
import re
import math
from io import StringIO
from datetime import datetime, date, timedelta, timezone
import os
import traceback
import threading
import time
from urllib.parse import quote, urlencode
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import HTTPError, URLError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.attributes import flag_modified
from werkzeug.utils import secure_filename
from utils.ai_school import (
    RITUO_APP_GUIDE,
    AI_HABIT_TYPE_GUIDANCE,
    build_student_plan_schema,
    build_copilot_schema,
    build_habit_draft_schema,
    build_personalized_habit_draft_schema,
    build_test_goal_seed_schema,
    build_daily_schedule_schema,
    build_schedule_clarification_schema,
    build_school_timetable_schema,
    normalize_student_plan,
    normalize_copilot_response,
    normalize_habit_draft,
    normalize_personalized_habit_draft,
    normalize_test_goal_seed,
    normalize_daily_schedule,
    normalize_schedule_clarification,
    normalize_school_timetable,
    build_copilot_action_link,
    build_copilot_system_prompt,
    get_copilot_public_config,
)
from utils.openai_responses import (
    OpenAIResponsesError,
    create_structured_response,
    structured_contract_metadata,
    validate_structured_output,
)
from utils.habit_completion import (
    DEFAULT_SCHOOL_TIMEZONE,
    build_completion_window_access,
    build_default_habit_schedule_items,
    normalize_habit_schedule_items,
    resolve_timezone,
)
from utils.google_calendar import GOOGLE_SYNC_MAX_DAYS, build_google_challenge_horizon_days, build_managed_google_events, normalize_external_google_events, reconcile_managed_google_events
from utils.habit_statistics import build_member_habit_statistics, effective_challenge_start, habit_progress_fraction, periodic_progress_counts
from utils.student_tools import (
    GCSE_LANGUAGES,
    MEDITATION_DURATION_MINUTES,
    MEDITATION_FOCUS_OPTIONS,
    STUDY_PLAN_LIBRARY_LIMIT,
    active_study_plan,
    build_tutor_config_payload,
    build_tutor_daily_usage,
    build_fitness_plan_prompts,
    build_fitness_plan_schema,
    build_meditation_manual_prompt,
    build_study_plan_prompts,
    build_study_plan_schema,
    build_tutor_prompts,
    build_tutor_response_schema,
    estimate_meditation_duration,
    normalize_study_plan_library,
    validate_meditation_payload,
)

groups_bp = Blueprint('groups', __name__)
_google_calendar_refresh_locks = defaultdict(threading.Lock)
stripe.api_key = os.getenv('STRIPE_TEST_SECRET_KEY')
logging.info(f"Stripe API key loaded: {'Yes' if stripe.api_key else 'No'}")

ALLOWED_GROUP_TYPES = {'school', 'football', 'staff'}
STAFF_ACCOUNT_ROLES = {'admin', 'teacher'}
ALLOWED_EVIDENCE_EXTENSIONS = {'pdf'}
CHECKPOINT_SLOTS = ('morning', 'midday', 'endOfDay')
VALID_WEEKDAYS = ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
VALID_ENGAGEMENT_COLORS = ('green', 'amber', 'red')
VALID_INTERVENTION_TYPES = ('reflection-session', 'mindset-lesson', 'behaviour-coaching', 'pastoral-follow-up', 'parent-call')
VALID_INTERVENTION_STATUSES = ('scheduled', 'delivered', 'monitoring', 'closed')
VALID_PARENT_CONTACT_TYPES = ('phone-call', 'email', 'meeting', 'text-message')
VALID_SCHOOL_ROLES = (
    'student',
    'teacher',
    'subject-teacher',
    'assistant-teacher',
    'head-of-department',
    'head-of-year',
    'senco',
    'pastoral-lead',
    'slt',
    'assistant-headteacher',
    'deputy-headteacher',
    'headteacher',
    'school-admin',
    'coach'
)
FULL_SCHOOL_ACCESS_ROLES = {
    'school-admin',
    'headteacher',
    'deputy-headteacher',
    'assistant-headteacher',
    'slt',
}
GROUP_MANAGEMENT_ROLES = {'school-admin', 'headteacher'}
SCHOOL_WIDE_STUDENT_SUPPORT_ROLES = {
    'pastoral-lead',
    'senco',
}
CLASS_SCOPED_TEACHER_ROLES = {
    'teacher',
    'subject-teacher',
    'assistant-teacher',
}
SCHOOL_LEADERSHIP_ROLES = FULL_SCHOOL_ACCESS_ROLES | {
    'head-of-department',
    'head-of-year',
}
SCHOOL_STAFF_ROLES = SCHOOL_LEADERSHIP_ROLES | SCHOOL_WIDE_STUDENT_SUPPORT_ROLES | CLASS_SCOPED_TEACHER_ROLES | {'coach'}
VALID_TEACHING_ASSIGNMENT_ROLES = ('lead-teacher', 'subject-teacher', 'assistant-teacher')
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
OPENAI_STUDENT_TOOLS_MODEL = os.getenv('OPENAI_STUDENT_TOOLS_MODEL', 'gpt-5.6-luna')
AI_HABIT_STUDENT_BATCH_SIZE = 8
AI_HABIT_RETRY_BATCH_SIZE = 4

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)


def get_group_members_list(group):
    members = group.members if group else []
    return members.all() if hasattr(members, 'all') else list(members or [])


def get_staff_group_members(group):
    members_by_id = {}
    if group and group.leader and group.leader.is_active and group.leader.account_role in STAFF_ACCOUNT_ROLES:
        members_by_id[group.leader.id] = group.leader
    for member in get_group_members_list(group):
        if member.is_active and member.account_role in STAFF_ACCOUNT_ROLES:
            members_by_id[member.id] = member
    return sorted(members_by_id.values(), key=lambda member: ((member.first_name or member.username or '').lower(), member.id))


def is_staff_group_member(group, user):
    return bool(
        group
        and user
        and getattr(group, 'group_type', 'school') == 'staff'
        and getattr(user, 'is_active', True)
        and getattr(user, 'account_role', 'student') in STAFF_ACCOUNT_ROLES
        and any(member.id == user.id for member in get_staff_group_members(group))
    )


def is_planner_member(group, member_id):
    if any(member.id == member_id for member in get_group_members_list(group)):
        return True
    return bool(
        getattr(group, 'group_type', 'school') == 'staff'
        and any(member.id == member_id for member in get_staff_group_members(group))
    )


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
    if not user or not user.is_active:
        return False
    if getattr(group, 'group_type', 'school') == 'staff':
        return user.account_role in STAFF_ACCOUNT_ROLES and str(group.leader_id) == str(user.id)
    return user_has_school_role(group.id, user.id, GROUP_MANAGEMENT_ROLES)


def serialize_group_for_user(group, user_id):
    payload = group.to_dict()
    school_role = get_school_role(group.id, int(user_id))
    if group.group_type == 'school' and not can_manage_school_timetable(group, int(user_id)):
        accessible_class_ids = get_accessible_class_ids(group, int(user_id))
        filtered_timetable = []
        for entry in payload.get('schoolTimetable') or []:
            try:
                class_id = int(entry.get('classId')) if entry.get('classId') not in (None, '') else None
            except (TypeError, ValueError):
                class_id = None
            student_ids = {
                int(value)
                for value in (entry.get('studentIds') or [])
                if str(value).isdigit()
            }
            if class_id in accessible_class_ids or int(user_id) in student_ids:
                filtered_timetable.append(entry)
        payload['schoolTimetable'] = filtered_timetable
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
            'periodicIntervalHours': habit.get('periodicIntervalHours') or 4,
            'periodicOccurrences': habit.get('periodicOccurrences') or 4,
            'allowOverlap': bool(habit.get('allowOverlap')),
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
    if school_role in FULL_SCHOOL_ACCESS_ROLES | SCHOOL_WIDE_STUDENT_SUPPORT_ROLES:
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

    if school_role in CLASS_SCOPED_TEACHER_ROLES:
        return any(student.id == student_id for student in get_students_for_teacher(group, current_user_id))

    if school_role in {'head-of-department', 'head-of-year'}:
        accessible_class_ids = get_accessible_class_ids(group, current_user_id)
        return SchoolEnrollment.query.filter(
            SchoolEnrollment.group_id == group.id,
            SchoolEnrollment.student_id == student_id,
            SchoolEnrollment.class_id.in_(accessible_class_ids) if accessible_class_ids else False
        ).first() is not None

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


def get_teacher_subject_ids(group_id, teacher_id):
    assignments = SchoolTeachingAssignment.query.filter_by(
        group_id=group_id,
        teacher_id=teacher_id
    ).all()
    return {assignment.subject_id for assignment in assignments}


def get_department_class_ids(group_id, teacher_id):
    subject_ids = get_teacher_subject_ids(group_id, teacher_id)
    if not subject_ids:
        return set()
    assignments = SchoolTeachingAssignment.query.filter(
        SchoolTeachingAssignment.group_id == group_id,
        SchoolTeachingAssignment.subject_id.in_(subject_ids)
    ).all()
    return {assignment.class_id for assignment in assignments}


def get_year_class_ids(group_id, teacher_id):
    assigned_class_ids = get_teacher_class_ids(group_id, teacher_id)
    if not assigned_class_ids:
        return set()
    year_groups = {
        school_class.year_group
        for school_class in SchoolClass.query.filter(
            SchoolClass.group_id == group_id,
            SchoolClass.id.in_(assigned_class_ids)
        ).all()
        if school_class.year_group
    }
    if not year_groups:
        return assigned_class_ids
    return {
        school_class.id
        for school_class in SchoolClass.query.filter(
            SchoolClass.group_id == group_id,
            SchoolClass.year_group.in_(year_groups)
        ).all()
    }


def get_all_school_class_ids(group):
    classes = SchoolClass.query.filter_by(group_id=group.id).all()
    return {school_class.id for school_class in classes}


def get_accessible_class_ids(group, user_id):
    if not group or getattr(group, 'group_type', 'school') != 'school':
        return set()

    if can_manage_group(group, user_id):
        return get_all_school_class_ids(group)

    if any(coach.id == user_id for coach in getattr(group, 'coaches', []) or []):
        return get_all_school_class_ids(group)

    school_role = get_school_role(group.id, user_id)
    if school_role in FULL_SCHOOL_ACCESS_ROLES | SCHOOL_WIDE_STUDENT_SUPPORT_ROLES | {'coach'}:
        return get_all_school_class_ids(group)

    if school_role == 'head-of-department':
        return get_department_class_ids(group.id, user_id)

    if school_role == 'head-of-year':
        return get_year_class_ids(group.id, user_id)

    if school_role in CLASS_SCOPED_TEACHER_ROLES:
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
    if can_manage_group(group, current_user_id):
        return True
    return user_has_school_role(group.id, current_user_id, FULL_SCHOOL_ACCESS_ROLES)


def can_manage_school_timetable(group, current_user_id):
    if can_manage_school(group, current_user_id):
        return True
    return get_school_role(group.id, current_user_id) in SCHOOL_LEADERSHIP_ROLES


def can_manage_class_roster(group, current_user_id, class_id):
    if can_manage_school(group, current_user_id):
        return True
    school_role = get_school_role(group.id, current_user_id)
    if school_role in SCHOOL_LEADERSHIP_ROLES:
        return class_id in get_accessible_class_ids(group, current_user_id)
    if school_role in CLASS_SCOPED_TEACHER_ROLES:
        return class_id in get_teacher_class_ids(group.id, current_user_id)
    return False


def can_manage_class_staff(group, current_user_id, class_id):
    if can_manage_school(group, current_user_id):
        return True
    school_role = get_school_role(group.id, current_user_id)
    return school_role in {'head-of-department', 'head-of-year'} and class_id in get_accessible_class_ids(group, current_user_id)


def can_view_school_operations(group, current_user_id):
    if can_manage_school(group, current_user_id):
        return True
    if any(coach.id == current_user_id for coach in group.coaches):
        return True
    return user_has_school_role(
        group.id,
        current_user_id,
        SCHOOL_STAFF_ROLES
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
            'fullyCompletedCount': 0,
            'partialCount': 0,
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
            'fullyCompletedCount': 0,
            'partialCount': 0,
            'scheduledCount': 0,
            'recoveryPoints': 0
        }

    today = datetime.now(_student_timezone(group, student_id)[1]).date()
    week_start = today - timedelta(days=today.weekday())
    stats = _build_group_member_habit_statistics(
        group,
        group.active_challenge,
        member_habit,
        student_id,
        today_value=today,
    )
    weekly_rows = [
        row
        for habit in stats['habits']
        for row in habit['dailyData']
        if row['date'] >= week_start.isoformat()
    ]
    completed_count = sum(row['progressFraction'] for row in weekly_rows)
    scheduled_count = len(weekly_rows)
    fully_completed_count = sum(1 for row in weekly_rows if row['status'] == 'complete')
    partial_count = sum(1 for row in weekly_rows if row['status'] == 'partial')

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
        'completedCount': round(completed_count, 2),
        'fullyCompletedCount': fully_completed_count,
        'partialCount': partial_count,
        'scheduledCount': scheduled_count,
        'recoveryPoints': recovery_points
    }


def calculate_today_habit_recovery_metrics(group, student_id):
    member_habit = get_member_habit_entry(group, student_id)
    if not member_habit:
        return {
            'completionRate': 0,
            'completedCount': 0,
            'fullyCompletedCount': 0,
            'partialCount': 0,
            'scheduledCount': 0,
            'recoveryPoints': 0
        }

    today = datetime.now(_student_timezone(group, student_id)[1]).date()
    today_iso = today.isoformat()
    stats = _build_group_member_habit_statistics(
        group,
        group.active_challenge,
        member_habit,
        student_id,
        today_value=today,
    )
    today_rows = [
        row
        for habit in stats['habits']
        for row in habit['dailyData']
        if row['date'] == today_iso
    ]
    completed_count = sum(row['progressFraction'] for row in today_rows)
    scheduled_count = len(today_rows)
    fully_completed_count = sum(1 for row in today_rows if row['status'] == 'complete')
    partial_count = sum(1 for row in today_rows if row['status'] == 'partial')

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
        'completedCount': round(completed_count, 2),
        'fullyCompletedCount': fully_completed_count,
        'partialCount': partial_count,
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


def create_challenge_published_notifications(group, challenge, member_habits):
    student_member_ids = {
        member.id
        for member in get_group_members_list(group)
        if (member.account_role or 'student') == 'student'
    }
    notified_ids = set()
    for member_habit in member_habits or []:
        if not isinstance(member_habit, dict):
            continue
        member_value = member_habit.get('member')
        member_id = member_value.get('id') if isinstance(member_value, dict) else member_value
        try:
            member_id = int(member_id)
        except (TypeError, ValueError):
            continue
        habits = member_habit.get('habits') or []
        if member_id not in student_member_ids or member_id in notified_ids or not habits:
            continue
        create_system_alert(
            group,
            member_id,
            (
                f"New challenge published: {len(habits)} habit{'s' if len(habits) != 1 else ''} "
                f"from {challenge.start_date.date().isoformat()} to {challenge.end_date.date().isoformat()}. "
                "Open your school dashboard to review your plan."
            ),
        )
        notified_ids.add(member_id)
    return len(notified_ids)


def normalize_challenge_member_habits(
    group,
    member_habits,
    joined_at_by_member=None,
    default_joined_at=None,
    activation_at_by_member=None,
    default_activation_at=None,
):
    if not isinstance(member_habits, list) or not member_habits:
        raise ValueError('memberHabits must contain at least one student')

    group_member_ids = {member.id for member in get_group_members_list(group)}
    joined_at_by_member = joined_at_by_member or {}
    activation_at_by_member = activation_at_by_member or {}
    normalized = []
    seen_member_ids = set()

    for entry in member_habits:
        if not isinstance(entry, dict):
            raise ValueError('Every member habit entry must be an object')
        raw_member = entry.get('member')
        if isinstance(raw_member, dict):
            raw_member = raw_member.get('id')
        try:
            member_id = int(raw_member)
        except (TypeError, ValueError):
            raise ValueError('Every member habit entry requires a valid student ID')
        if member_id not in group_member_ids:
            raise ValueError(f'Student {member_id} does not belong to this group')
        if member_id in seen_member_ids:
            raise ValueError(f'Student {member_id} was submitted more than once')

        habits = entry.get('habits')
        if not isinstance(habits, list) or not habits:
            raise ValueError(f'Student {member_id} requires at least one habit')

        joined_at = (
            entry.get('joinedAt')
            or joined_at_by_member.get(member_id)
            or default_joined_at
            or date.today().isoformat()
        )
        joined_at_text = str(joined_at).strip()
        try:
            parsed_joined_at = datetime.fromisoformat(joined_at_text.replace('Z', '+00:00'))
            joined_at_text = parsed_joined_at.date().isoformat()
        except (TypeError, ValueError):
            joined_at_text = str(joined_at)[:10]
        activation_at = (
            entry.get('activationAt')
            or activation_at_by_member.get(member_id)
            or default_activation_at
        )
        normalized_entry = {
            'member': member_id,
            'habits': habits,
            'joinedAt': joined_at_text,
        }
        if activation_at:
            try:
                parsed_activation = datetime.fromisoformat(str(activation_at).replace('Z', '+00:00'))
                if parsed_activation.tzinfo is None:
                    parsed_activation = parsed_activation.replace(tzinfo=timezone.utc)
                normalized_entry['activationAt'] = parsed_activation.astimezone(timezone.utc).isoformat()
            except (TypeError, ValueError):
                pass
        normalized.append(normalized_entry)
        seen_member_ids.add(member_id)

    return normalized


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


def _member_habit_user_id(member_habit):
    member = (member_habit or {}).get('member')
    return member.get('id') if isinstance(member, dict) else member


def get_member_habit_entry(group, student_id):
    if not group.active_challenge or not group.active_challenge.member_habits:
        return None
    return next(
        (mh for mh in group.active_challenge.member_habits if str(_member_habit_user_id(mh)) == str(student_id)),
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
        'habitCompletionUnits': today_habits['completedCount'],
        'habitsFullyCompleted': today_habits.get('fullyCompletedCount', today_habits['completedCount']),
        'habitsPartiallyCompleted': today_habits.get('partialCount', 0),
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


def normalize_school_day_config(config):
    source = config or {}
    timezone_name, _ = resolve_timezone(
        source.get('timezone') or os.getenv('SCHOOL_TIMEZONE', DEFAULT_SCHOOL_TIMEZONE)
    )
    defaults = {
        'startTime': '08:30',
        'endTime': '15:30',
        'lessonMinutes': 60,
        'breaks': [
            {'name': 'Morning break', 'startTime': '10:30', 'endTime': '10:50'},
            {'name': 'Lunch', 'startTime': '12:30', 'endTime': '13:15'},
        ],
    }
    start_time = str(source.get('startTime') or defaults['startTime']).strip()
    end_time = str(source.get('endTime') or defaults['endTime']).strip()
    if len(start_time) != 5:
        start_time = defaults['startTime']
    if len(end_time) != 5:
        end_time = defaults['endTime']
    try:
        lesson_minutes = max(20, min(180, int(source.get('lessonMinutes') or defaults['lessonMinutes'])))
    except (TypeError, ValueError):
        lesson_minutes = defaults['lessonMinutes']
    breaks = []
    for item in source.get('breaks', defaults['breaks']) or []:
        name = str((item or {}).get('name') or '').strip()
        break_start = str((item or {}).get('startTime') or '').strip()
        break_end = str((item or {}).get('endTime') or '').strip()
        if name and len(break_start) == 5 and len(break_end) == 5 and break_start < break_end:
            breaks.append({
                'name': name[:80],
                'startTime': break_start,
                'endTime': break_end,
            })
    return {
        'timezone': timezone_name,
        'startTime': start_time,
        'endTime': end_time,
        'lessonMinutes': lesson_minutes,
        'breaks': breaks[:6],
    }


def _time_ranges_overlap(start_a, end_a, start_b, end_b):
    return bool(start_a < end_b and start_b < end_a)


def find_timetable_conflicts(entries, day_config=None):
    config = normalize_school_day_config(day_config)
    conflicts = []
    for entry in entries:
        start_time = entry.get('startTime') or ''
        end_time = entry.get('endTime') or ''
        label = f"{entry.get('weekday')} {start_time}-{end_time} {entry.get('className') or entry.get('subject')}"
        if len(start_time) != 5 or len(end_time) != 5 or start_time >= end_time:
            conflicts.append({'type': 'invalid-time', 'entryIds': [entry.get('id')], 'message': f'Invalid lesson time: {label}'})
            continue
        if start_time < config['startTime'] or end_time > config['endTime']:
            conflicts.append({'type': 'outside-school-day', 'entryIds': [entry.get('id')], 'message': f'Lesson is outside school hours: {label}'})
        for school_break in config['breaks']:
            if _time_ranges_overlap(start_time, end_time, school_break['startTime'], school_break['endTime']):
                conflicts.append({
                    'type': 'break-overlap',
                    'entryIds': [entry.get('id')],
                    'message': f"{label} overlaps {school_break['name']}.",
                })

    for index, left in enumerate(entries):
        for right in entries[index + 1:]:
            if left.get('weekday') != right.get('weekday'):
                continue
            if not _time_ranges_overlap(
                left.get('startTime') or '',
                left.get('endTime') or '',
                right.get('startTime') or '',
                right.get('endTime') or ''
            ):
                continue
            reasons = []
            if left.get('classId') and str(left.get('classId')) == str(right.get('classId')):
                reasons.append('class')
            if left.get('teacherId') and str(left.get('teacherId')) == str(right.get('teacherId')):
                reasons.append('teacher')
            if left.get('roomId') and str(left.get('roomId')) == str(right.get('roomId')):
                reasons.append('room')
            left_students = {int(value) for value in (left.get('studentIds') or []) if str(value).isdigit()}
            right_students = {int(value) for value in (right.get('studentIds') or []) if str(value).isdigit()}
            if left_students & right_students:
                reasons.append('students')
            if reasons:
                conflicts.append({
                    'type': 'collision',
                    'entryIds': [left.get('id'), right.get('id')],
                    'message': (
                        f"{left.get('weekday')} {left.get('startTime')}: "
                        f"{left.get('className') or left.get('subject')} conflicts with "
                        f"{right.get('className') or right.get('subject')} ({', '.join(reasons)})."
                    ),
                })
    return conflicts


def serialize_school_structure(group, user_id=None):
    roles = SchoolRoleAssignment.query.filter_by(group_id=group.id).all()
    subjects = SchoolSubject.query.filter_by(group_id=group.id).order_by(SchoolSubject.name.asc()).all()
    rooms = SchoolRoom.query.filter_by(group_id=group.id).order_by(SchoolRoom.name.asc()).all()
    classes = SchoolClass.query.filter_by(group_id=group.id).order_by(SchoolClass.name.asc()).all()
    enrollments = SchoolEnrollment.query.filter_by(group_id=group.id).all()
    teaching_assignments = SchoolTeachingAssignment.query.filter_by(group_id=group.id).all()
    behaviour_types = SchoolBehaviourType.query.filter_by(group_id=group.id).order_by(SchoolBehaviourType.kind.asc(), SchoolBehaviourType.name.asc()).all()
    accessible_class_ids = get_all_school_class_ids(group) if user_id is None else get_accessible_class_ids(group, user_id)
    can_edit_structure = bool(user_id is not None and can_manage_school(group, user_id))
    visible_classes = classes if user_id is None or can_edit_structure else [
        school_class for school_class in classes if school_class.id in accessible_class_ids
    ]
    visible_class_ids = {school_class.id for school_class in visible_classes}
    if user_id is not None and not can_edit_structure:
        visible_staff_ids = {
            assignment.teacher_id
            for assignment in teaching_assignments
            if assignment.class_id in visible_class_ids
        } | {user_id}
        roles = [assignment for assignment in roles if assignment.user_id in visible_staff_ids]
        teaching_assignments = [
            assignment for assignment in teaching_assignments if assignment.class_id in visible_class_ids
        ]
        enrollments = [enrollment for enrollment in enrollments if enrollment.class_id in visible_class_ids]

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
        'schoolDayConfig': group.school_day_config or {},
        'viewerRole': get_school_role(group.id, user_id) if user_id is not None else None,
        'permissions': {
            'canEditStructure': can_edit_structure,
            'canManageTimetable': bool(user_id is not None and can_manage_school_timetable(group, user_id)),
            'canViewAllClasses': bool(user_id is not None and accessible_class_ids == get_all_school_class_ids(group)),
        },
        'classes': [
            {
                **school_class.to_dict(),
                'enrollments': enrollment_map.get(school_class.id, []),
                'teachingAssignments': teaching_map.get(school_class.id, []),
                'permissions': {
                    'canManageRoster': bool(user_id is not None and can_manage_class_roster(group, user_id, school_class.id)),
                    'canManageStaff': bool(user_id is not None and can_manage_class_staff(group, user_id, school_class.id)),
                    'canManageDetails': bool(user_id is not None and can_manage_class_staff(group, user_id, school_class.id)),
                    'canManageTimetable': bool(user_id is not None and can_manage_school_timetable(group, user_id) and school_class.id in accessible_class_ids),
                }
            }
            for school_class in visible_classes
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
    habit_statistics = profile.get('habitStatistics') or {}
    habit_summary = habit_statistics.get('summary') or {}
    behaviour_rows = ''.join(
        f"<tr><td>{item.get('subject','')}</td><td>{item.get('reward',0)}</td><td>{item.get('sanction',0)}</td><td>{item.get('referral',0)}</td><td>{item.get('onCall',0)}</td><td>{item.get('removal',0)}</td><td>{item.get('pointsDelta',0)}</td></tr>"
        for item in (behaviour_summary.get('subjects') or [])[:8]
    ) or '<tr><td colspan="7">No behaviour events this week.</td></tr>'
    goal_rows = ''.join(
        f"<li><strong>{goal.get('title','')}</strong> | Barrier: {goal.get('barrier','')} | School goal: {goal.get('schoolGoal','')}</li>"
        for goal in (profile.get('goals') or [])
    ) or '<li>No goals set.</li>'
    habit_rows = ''.join(
        (
            f"<tr><td>{habit.get('name','')}</td><td>{habit.get('habitType','')}</td>"
            f"<td>{habit.get('combatType','')}</td><td>{habit.get('completionRate',0)}%</td>"
            f"<td>{habit.get('fullCount',0)}</td><td>{habit.get('partialCount',0)}</td>"
            f"<td>{habit.get('earnedUnits',0)}/{habit.get('possibleUnits',0)}</td>"
            f"<td>{habit.get('linkedGoalTitle') or 'No linked goal'}</td></tr>"
        )
        for habit in (habit_statistics.get('habits') or [])
    ) or '<tr><td colspan="8">No habit statistics are available.</td></tr>'
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
    <div class="card"><div>Habit completion</div><h2>{habit_summary.get('completionRate', 0)}%</h2></div>
    <div class="card"><div>Habit units earned</div><h2>{habit_summary.get('earnedUnits', 0)}/{habit_summary.get('possibleUnits', 0)}</h2></div>
    <div class="card"><div>Perfect / partial days</div><h2>{habit_summary.get('perfectDays', 0)} / {habit_summary.get('partialDays', 0)}</h2></div>
  </div>
  <h2>Goal plan</h2>
  <ul>{goal_rows}</ul>
  <h2>Habit performance</h2>
  <p>Completion rate is the average progress across scheduled habit-days. Recurring habits contribute proportionally, so three of four occurrences counts as 75%.</p>
  <table>
    <thead><tr><th>Habit</th><th>Type</th><th>Purpose</th><th>Rate</th><th>Full</th><th>Partial</th><th>Units</th><th>Linked goal</th></tr></thead>
    <tbody>{habit_rows}</tbody>
  </table>
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
    habit_statistics = None
    if member_habit:
        student_today = datetime.now(_student_timezone(group, student.id)[1]).date()
        habit_statistics = _build_group_member_habit_statistics(
            group,
            group.active_challenge,
            member_habit,
            student.id,
            today_value=student_today,
            goal_titles={str(goal.id): goal.title for goal in goals},
        ) if group.active_challenge else None
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
                'combatType': habit.get('combatType') or 'neutral',
                'periodicIntervalHours': habit.get('periodicIntervalHours') or 4,
                'periodicOccurrences': habit.get('periodicOccurrences') or 4,
                'allowOverlap': bool(habit.get('allowOverlap'))
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
    class_ids = {
        enrollment.class_id
        for enrollment in SchoolEnrollment.query.filter_by(
            group_id=group.id,
            student_id=student.id
        ).all()
    }
    student_classes = []
    if class_ids:
        school_classes = SchoolClass.query.filter(
            SchoolClass.group_id == group.id,
            SchoolClass.id.in_(class_ids)
        ).order_by(SchoolClass.name.asc()).all()
        teaching_assignments = SchoolTeachingAssignment.query.filter(
            SchoolTeachingAssignment.group_id == group.id,
            SchoolTeachingAssignment.class_id.in_(class_ids)
        ).all()
        teaching_map = defaultdict(list)
        for assignment in teaching_assignments:
            teaching_map[assignment.class_id].append(assignment.to_dict())
        student_classes = [
            {
                **school_class.to_dict(),
                'teachingAssignments': teaching_map.get(school_class.id, []),
            }
            for school_class in school_classes
        ]

    profile = {
        'student': student.to_dict(),
        'goals': [goal.to_dict() for goal in goals],
        'linkedHabits': linked_habits,
        'habitStatistics': habit_statistics,
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
        'classes': student_classes,
        'schoolTimetable': group.school_timetable or []
    }
    profile['leagueStanding'] = league_standing
    return profile


def get_school_students_for_user(group, current_user_id, members=None):
    members = members if members is not None else get_group_members_list(group)
    school_role = get_school_role(group.id, current_user_id)

    if group.leader_id == current_user_id or school_role in FULL_SCHOOL_ACCESS_ROLES | SCHOOL_WIDE_STUDENT_SUPPORT_ROLES:
        return list(members)

    if school_role in CLASS_SCOPED_TEACHER_ROLES | {'head-of-department', 'head-of-year'}:
        class_ids = get_accessible_class_ids(group, current_user_id)
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
        if not can_manage_group(group, current_user_id):
            accessible_class_ids = get_accessible_class_ids(group, current_user_id)
            try:
                entry_class_id = int(entry.get('classId')) if entry.get('classId') not in (None, '') else None
            except (TypeError, ValueError):
                entry_class_id = None
            if entry_class_id not in accessible_class_ids:
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

        if not can_manage_school_timetable(group, current_user_id):
            return jsonify({'error': 'Only school leaders can update the school timetable'}), 403

        data = request.get_json() or {}
        entries = data.get('entries', [])
        if not isinstance(entries, list):
            return jsonify({'error': 'entries must be an array'}), 400
        day_config = normalize_school_day_config(data.get('dayConfig') or group.school_day_config)
        accessible_class_ids = get_accessible_class_ids(group, current_user_id)
        has_full_access = can_manage_school(group, current_user_id)

        allowed_teacher_ids = {group.leader_id, *[coach.id for coach in group.coaches]}
        school_roles = SchoolRoleAssignment.query.filter(
            SchoolRoleAssignment.group_id == group.id,
            SchoolRoleAssignment.role.in_(tuple(SCHOOL_STAFF_ROLES))
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
            if not has_full_access and (not school_class or school_class.id not in accessible_class_ids):
                return jsonify({'error': 'You can only timetable classes within your assigned scope'}), 403
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

        normalized_entries = normalize_timetable_entries(sanitized_entries)
        if not has_full_access:
            preserved_entries = []
            for existing_entry in group.school_timetable or []:
                try:
                    existing_class_id = int(existing_entry.get('classId')) if existing_entry.get('classId') not in (None, '') else None
                except (TypeError, ValueError):
                    existing_class_id = None
                if existing_class_id not in accessible_class_ids:
                    preserved_entries.append(existing_entry)
            normalized_entries = normalize_timetable_entries(preserved_entries + normalized_entries)
        conflicts = find_timetable_conflicts(normalized_entries, day_config)
        if conflicts:
            return jsonify({
                'error': 'Resolve timetable collisions before saving.',
                'conflicts': conflicts,
            }), 400

        group.school_timetable = normalized_entries
        group.school_day_config = day_config
        flag_modified(group, 'school_timetable')
        flag_modified(group, 'school_day_config')
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
        return jsonify({
            'schoolTimetable': group.school_timetable or [],
            'schoolDayConfig': group.school_day_config or {},
            'conflicts': [],
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/school-timetable/ai', methods=['POST'])
@jwt_required()
def generate_school_timetable(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_school_timetable(group, current_user_id):
            return jsonify({'error': 'Only school leaders can generate a timetable'}), 403

        data = request.get_json() or {}
        day_config = normalize_school_day_config(data.get('dayConfig') or group.school_day_config)
        accessible_class_ids = get_accessible_class_ids(group, current_user_id)
        classes = SchoolClass.query.filter(
            SchoolClass.group_id == group.id,
            SchoolClass.id.in_(accessible_class_ids) if accessible_class_ids else False
        ).order_by(SchoolClass.name.asc()).all()
        subjects = {subject.id: subject for subject in SchoolSubject.query.filter_by(group_id=group.id).all()}
        rooms = {room.id: room for room in SchoolRoom.query.filter_by(group_id=group.id).all()}
        assignments = SchoolTeachingAssignment.query.filter(
            SchoolTeachingAssignment.group_id == group.id,
            SchoolTeachingAssignment.class_id.in_(accessible_class_ids) if accessible_class_ids else False
        ).all()
        if not classes:
            return jsonify({'error': 'Create or assign at least one class before generating a timetable'}), 400
        if not rooms:
            return jsonify({'error': 'Add at least one room before generating a timetable'}), 400

        assignments_by_class = defaultdict(list)
        valid_teacher_ids = set()
        valid_assignment_keys = set()
        for assignment in assignments:
            assignments_by_class[assignment.class_id].append({
                'teacherId': assignment.teacher_id,
                'teacherName': assignment.teacher.username if assignment.teacher else '',
                'subjectId': assignment.subject_id,
                'subjectName': assignment.subject.name if assignment.subject else '',
                'assignmentRole': assignment.assignment_role or 'lead-teacher',
            })
            valid_teacher_ids.add(assignment.teacher_id)
            valid_assignment_keys.add((assignment.class_id, assignment.subject_id, assignment.teacher_id))

        class_payload = []
        for school_class in classes:
            class_assignments = assignments_by_class.get(school_class.id, [])
            if not class_assignments:
                continue
            roster_size = SchoolEnrollment.query.filter_by(
                group_id=group.id,
                class_id=school_class.id
            ).count()
            class_payload.append({
                'classId': school_class.id,
                'className': school_class.name,
                'yearGroup': school_class.year_group or '',
                'weeklyLessons': school_class.weekly_lessons or 5,
                'preferredRoomId': school_class.room_id or 0,
                'rosterSize': roster_size,
                'teachingAssignments': class_assignments,
            })
        if not class_payload:
            return jsonify({'error': 'Assign teachers and subjects to classes before generating a timetable'}), 400

        raw_plan = create_structured_response(
            model=OPENAI_SCHEDULER_MODEL,
            system_prompt=(
                "You are a UK school timetable planner. Produce a Monday-to-Friday lesson timetable using only "
                "the supplied numeric class, subject, teacher, and room IDs. Meet each class weeklyLessons target. "
                "Use only a teachingAssignments combination belonging to that class. Never double-book a class, "
                "teacher, room, or overlapping student cohort. Keep every lesson inside school hours and outside "
                "all break and lunch windows. Prefer the class room when it is available and respect room capacity. "
                "Spread lessons across the week rather than clustering them. Return a reviewable draft only."
            ),
            user_prompt=json.dumps({
                'task': 'Generate a collision-free weekly school timetable draft.',
                'schoolDay': day_config,
                'classes': class_payload,
                'rooms': [
                    {
                        'roomId': room.id,
                        'name': room.name,
                        'block': room.block or '',
                        'capacity': room.capacity or 0,
                    }
                    for room in rooms.values()
                ],
                'additionalInstructions': str(data.get('instructions') or '').strip()[:3000],
            }),
            schema_name='rituo_school_timetable',
            schema=build_school_timetable_schema(),
            max_output_tokens=6000,
        )
        normalized_plan = normalize_school_timetable(
            raw_plan,
            {school_class.id for school_class in classes},
            set(subjects),
            valid_teacher_ids,
            set(rooms),
        )
        class_map = {school_class.id: school_class for school_class in classes}
        sanitized_entries = []
        invalid_assignment_count = 0
        for entry in normalized_plan['entries']:
            assignment_key = (entry['classId'], entry['subjectId'], entry['teacherId'])
            if assignment_key not in valid_assignment_keys:
                invalid_assignment_count += 1
                continue
            school_class = class_map[entry['classId']]
            subject = subjects[entry['subjectId']]
            room = rooms[entry['roomId']]
            teacher = User.query.get(entry['teacherId'])
            student_ids = [
                enrollment.student_id
                for enrollment in SchoolEnrollment.query.filter_by(
                    group_id=group.id,
                    class_id=school_class.id
                ).all()
            ]
            sanitized_entries.append({
                **entry,
                'subject': subject.name,
                'teacherName': teacher.username if teacher else '',
                'room': room.name,
                'className': school_class.name,
                'studentIds': student_ids,
            })
        timetable_entries = normalize_timetable_entries(sanitized_entries)
        conflicts = find_timetable_conflicts(timetable_entries, day_config)
        warnings = list(normalized_plan['warnings'])
        if invalid_assignment_count:
            warnings.append(f'{invalid_assignment_count} lesson(s) used invalid class teaching assignments and were removed.')
        if conflicts:
            warnings.append(f'{len(conflicts)} collision(s) need review before this draft can be saved.')
        return jsonify({
            'summary': normalized_plan['summary'],
            'entries': timetable_entries,
            'schoolDayConfig': day_config,
            'warnings': warnings,
            'conflicts': conflicts,
            'contract': structured_contract_metadata('rituo_school_timetable'),
        }), 200
    except OpenAIResponsesError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/create', methods=['POST'])
@jwt_required()
def create_group():
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.is_active or user.account_role != 'admin':
            return jsonify({'error': 'Only admin accounts can create workspaces'}), 403

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
        if group_type == 'staff':
            group.members.append(user)
        else:
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
        user = User.query.get(get_jwt_identity())
        if not user or not user.is_active:
            return jsonify({'error': 'An active account is required'}), 403
        if not group.is_legacy:
            if group.group_type != 'staff':
                return jsonify({'error': 'New school and client accounts are created and assigned by an admin'}), 403
            if user.account_role not in STAFF_ACCOUNT_ROLES:
                return jsonify({'error': 'Coaches HQ workspaces are only available to admin and teacher accounts'}), 403
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
        data = request.get_json() or {}
        group_id = str(data.get('groupId') or '').strip()
        course_id = data.get('courseId')
        course_required_member_ids = data.get('courseRequiredMemberIds')  # [] = all, else [id,...]
        group = Group.query.filter_by(group_id=group_id).first()
        current_user_id = int(get_jwt_identity())
        if not group or not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Group not found or unauthorized'}), 404
        if group.group_type == 'staff':
            return jsonify({'error': 'Every Coaches HQ member creates their own independent challenge'}), 400
        if group.active_challenge:
            return jsonify({'error': 'Finish or remove the active challenge before publishing another'}), 409

        try:
            start_date = datetime.fromisoformat(str(data.get('startDate') or ''))
            end_date = datetime.fromisoformat(str(data.get('endDate') or ''))
        except ValueError:
            return jsonify({'error': 'Valid startDate and endDate values are required'}), 400
        if end_date < start_date:
            return jsonify({'error': 'Challenge endDate must be on or after startDate'}), 400

        start_iso = start_date.date().isoformat()
        published_at = datetime.now(timezone.utc).isoformat()
        try:
            member_habits = normalize_challenge_member_habits(
                group,
                data.get('memberHabits'),
                default_joined_at=start_iso,
                default_activation_at=published_at,
            )
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400

        expected_student_ids = {
            member.id
            for member in get_group_members_list(group)
            if (member.account_role or 'student') == 'student'
        }
        submitted_student_ids = {entry['member'] for entry in member_habits}
        missing_student_ids = sorted(expected_student_ids - submitted_student_ids)
        if missing_student_ids:
            return jsonify({
                'error': (
                    f'Every student requires at least one habit before publishing. '
                    f'Missing student IDs: {", ".join(map(str, missing_student_ids))}'
                )
            }), 400

        if course_required_member_ids is not None:
            if not isinstance(course_required_member_ids, list):
                return jsonify({'error': 'courseRequiredMemberIds must be an array'}), 400
            try:
                course_required_member_ids = sorted({int(member_id) for member_id in course_required_member_ids})
            except (TypeError, ValueError):
                return jsonify({'error': 'courseRequiredMemberIds must contain valid student IDs'}), 400
            invalid_course_member_ids = set(course_required_member_ids) - submitted_student_ids
            if invalid_course_member_ids:
                return jsonify({'error': 'Course students must be included in this challenge'}), 400

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
        notifications_created = create_challenge_published_notifications(group, challenge, member_habits)
        db.session.commit()
        return jsonify({
            'challenge': challenge.to_dict(),
            'notificationsCreated': notifications_created,
        }), 201
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
            joined_now = datetime.now(_student_timezone(group, user.id)[1])
            member_habits.append({
                'member': user.id,
                'habits': [],
                'joinedAt': joined_now.date().isoformat(),
                'activationAt': joined_now.astimezone(timezone.utc).isoformat(),
            })
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
        joined_at_by_member = {}
        activation_at_by_member = {}
        for entry in challenge.member_habits or []:
            if not isinstance(entry, dict):
                continue
            raw_member = entry.get('member')
            if isinstance(raw_member, dict):
                raw_member = raw_member.get('id')
            try:
                member_id = int(raw_member)
            except (TypeError, ValueError):
                continue
            joined_at_by_member[member_id] = entry.get('joinedAt')
            activation_at_by_member[member_id] = entry.get('activationAt')
        try:
            member_habits = normalize_challenge_member_habits(
                group,
                data.get('memberHabits'),
                joined_at_by_member=joined_at_by_member,
                default_joined_at=challenge.start_date.date().isoformat(),
                activation_at_by_member=activation_at_by_member,
                default_activation_at=(
                    challenge.created_at.replace(tzinfo=timezone.utc).isoformat()
                    if challenge.created_at and challenge.created_at.tzinfo is None
                    else challenge.created_at.isoformat()
                    if challenge.created_at
                    else None
                ),
            )
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400

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


@groups_bp.route('/<group_id>/students/goals/ai-seed', methods=['POST'])
@jwt_required()
def seed_test_student_goals(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not can_manage_group(group, current_user_id):
            return jsonify({'error': 'Only school admins or legacy owners can generate test goals'}), 403

        data = request.get_json() or {}
        requested_member_ids = {
            int(member_id)
            for member_id in (data.get('memberIds') or [])
            if str(member_id).isdigit()
        }
        student_members = [
            member for member in get_group_members_list(group)
            if (member.account_role or 'student') == 'student'
            and (not requested_member_ids or member.id in requested_member_ids)
        ]
        if requested_member_ids and len(student_members) != len(requested_member_ids):
            return jsonify({'error': 'One or more selected students are not student members of this school'}), 400
        if not student_members:
            return jsonify({'error': 'Select at least one student'}), 400
        if len(student_members) > 60:
            return jsonify({'error': 'Generate goals for no more than 60 students at a time'}), 400

        existing_goals = StudentGoal.query.filter(
            StudentGoal.group_id == group.id,
            StudentGoal.student_id.in_([member.id for member in student_members]),
        ).order_by(StudentGoal.student_id, StudentGoal.id).all()
        existing_by_student = defaultdict(list)
        for goal in existing_goals:
            existing_by_student[goal.student_id].append(goal.title)

        target_students = [
            {
                'id': str(member.id),
                'name': member.username,
                'existingGoalTitles': existing_by_student[member.id],
            }
            for member in student_members
        ]
        generated_sets = []
        warnings = []
        summaries = []
        batch_size = 8
        for batch_start in range(0, len(target_students), batch_size):
            student_batch = target_students[batch_start:batch_start + batch_size]
            raw_seed = create_structured_response(
                model=OPENAI_STUDENT_PLAN_MODEL,
                system_prompt=(
                    "You create safe demonstration goals for testing a school performance app. "
                    "Return exactly five distinct, realistic, age-appropriate goals for every supplied student. "
                    "Vary the set across academic progress, organisation, healthy routine, contribution or kindness, and personal development. "
                    "These are test records, so do not infer diagnoses, protected traits, family circumstances, or sensitive personal facts. "
                    "Avoid duplicating supplied existingGoalTitles. Keep every field concise and useful for linking practical habits."
                ),
                user_prompt=json.dumps({
                    'task': 'Generate exactly five student-style demonstration goals for each student.',
                    'school': group.name,
                    'students': student_batch,
                    'goalsPerStudent': 5,
                }),
                schema_name='rituo_test_goal_seed',
                schema=build_test_goal_seed_schema(),
                max_output_tokens=6000,
            )
            normalized_seed = normalize_test_goal_seed(raw_seed, student_batch, goals_per_student=5)
            generated_sets.extend(normalized_seed['studentGoalSets'])
            warnings.extend(normalized_seed['warnings'])
            if normalized_seed['summary']:
                summaries.append(normalized_seed['summary'])

        created_goals = []
        existing_title_keys = {
            (goal.student_id, goal.title.strip().lower())
            for goal in existing_goals
            if goal.title and goal.title.strip()
        }
        for student_set in generated_sets:
            student_id = int(student_set['studentId'])
            for goal in student_set['goals']:
                title_key = (student_id, goal['title'].strip().lower())
                if title_key in existing_title_keys:
                    continue
                goal_record = StudentGoal(
                    group_id=group.id,
                    student_id=student_id,
                    title=goal['title'],
                    barrier=goal['barrier'] or None,
                    school_goal=goal['schoolGoal'] or None,
                    for_self=goal['forSelf'] or None,
                    for_others=goal['forOthers'] or None,
                    created_by_id=current_user_id,
                )
                db.session.add(goal_record)
                db.session.flush()
                created_goals.append(goal_record.to_dict())
                existing_title_keys.add(title_key)

        log_school_audit(
            group.id,
            current_user_id,
            'ai-test-goals-generated',
            'student-goals',
            'AI demonstration goals generated',
            description=f"Created {len(created_goals)} demonstration goals for {len(student_members)} students.",
            metadata={
                'studentIds': [member.id for member in student_members],
                'goalsCreated': len(created_goals),
            },
        )
        db.session.commit()
        return jsonify({
            'summary': ' '.join(summaries)[:600],
            'studentsProcessed': len(student_members),
            'goalsCreated': len(created_goals),
            'goals': created_goals,
            'warnings': warnings[:12],
            'contract': structured_contract_metadata('rituo_test_goal_seed'),
        }), 201
    except OpenAIResponsesError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def generate_personalized_habit_draft(school_name, source_text, preset_habits, target_students):
    system_prompt = (
        "You design personalised school challenge habits for individual students. "
        "Return exactly one studentHabitSets entry for every supplied student ID, in the same order, and give every student at least one habit. "
        "Never omit a student and never return an empty habits array. "
        "ATTACK means a habit that moves the student toward a goal or a new achievement. "
        "DEFENCE means a habit that protects an existing positive state, standard, discipline, kindness, health, or achievement. "
        "Every habit must use exactly attack or defence; never return neutral. "
        "Use each student's supplied goals to customise wording and choose linkedGoalId only when the habit genuinely supports that goal. "
        "If a student has no goals, linkedGoalId must be an empty string. Never invent a goal ID. "
        "Habits must be measurable, age-appropriate, concise, and include realistic schedules and completion times. "
        + AI_HABIT_TYPE_GUIDANCE
    )
    preset_habit_count = max(1, len(preset_habits))
    initial_batch_size = min(AI_HABIT_STUDENT_BATCH_SIZE, max(1, 24 // preset_habit_count))
    habits_by_student = {}
    summaries = []
    warnings = []

    def generate_batch(student_batch, retry=False):
        raw_draft = create_structured_response(
            model=OPENAI_HABIT_DRAFT_MODEL,
            system_prompt=system_prompt,
            user_prompt=json.dumps({
                'task': (
                    'Adapt every supplied preset habit for every supplied student and match them to goals.'
                    if preset_habits
                    else 'Create a customised set of challenge habits for every supplied student.'
                ),
                'completionRequirement': (
                    'This is a retry for omitted students. Return one non-empty studentHabitSets entry for every expectedStudentId.'
                    if retry
                    else 'Return one non-empty studentHabitSets entry for every expectedStudentId.'
                ),
                'school': school_name,
                'brief': source_text,
                'sourcePresetHabits': preset_habits,
                'expectedStudentIds': [student['id'] for student in student_batch],
                'expectedStudentCount': len(student_batch),
                'students': student_batch,
                'allowedHabitTypes': ['boolean', 'numeric', 'text', 'periodic'],
                'allowedCombatTypes': ['attack', 'defence'],
                'allowedDays': list(VALID_WEEKDAYS),
                'durationRangeMinutes': [5, 120],
            }),
            schema_name='rituo_personalized_habit_draft',
            schema=build_personalized_habit_draft_schema(),
            max_output_tokens=8000,
        )
        return normalize_personalized_habit_draft(raw_draft, student_batch)

    for batch_start in range(0, len(target_students), initial_batch_size):
        student_batch = target_students[batch_start:batch_start + initial_batch_size]
        normalized_batch = generate_batch(student_batch)
        if normalized_batch['summary']:
            summaries.append(normalized_batch['summary'])
        warnings.extend(normalized_batch['warnings'])
        for student_set in normalized_batch['studentHabitSets']:
            if student_set['habits']:
                habits_by_student[student_set['studentId']] = student_set

    missing_students = [
        student for student in target_students
        if student['id'] not in habits_by_student
    ]
    for batch_start in range(0, len(missing_students), AI_HABIT_RETRY_BATCH_SIZE):
        student_batch = missing_students[batch_start:batch_start + AI_HABIT_RETRY_BATCH_SIZE]
        normalized_batch = generate_batch(student_batch, retry=True)
        if normalized_batch['summary']:
            summaries.append(normalized_batch['summary'])
        warnings.extend(normalized_batch['warnings'])
        for student_set in normalized_batch['studentHabitSets']:
            if student_set['habits']:
                habits_by_student[student_set['studentId']] = student_set

    still_missing = [
        student for student in target_students
        if student['id'] not in habits_by_student
    ]
    if still_missing:
        missing_names = ', '.join(student['name'] for student in still_missing[:8])
        if len(still_missing) > 8:
            missing_names += f" and {len(still_missing) - 8} more"
        raise OpenAIResponsesError(
            f"AI did not return habits for {missing_names}. No partial habits were applied; please retry."
        )

    return {
        'summary': ' '.join(summaries).strip()[:400],
        'studentHabitSets': [
            habits_by_student[student['id']]
            for student in target_students
        ],
        'warnings': [
            warning for warning in warnings
            if not warning.startswith('No habits were generated for ')
        ][:8],
    }


@groups_bp.route('/<group_id>/ai-habits', methods=['POST'])
@jwt_required()
def draft_habits_from_text(group_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Workspace not found'}), 404
        current_user = User.query.get(current_user_id)
        staff_self_service = is_staff_group_member(group, current_user)
        if not can_manage_group(group, current_user_id) and not staff_self_service:
            return jsonify({'error': 'Only school admins or legacy owners can generate habits'}), 403

        data = request.get_json() or {}
        source_text = str(data.get('text') or '').strip()
        preset_habits = data.get('presetHabits') or []
        if len(source_text) < 10 and not preset_habits:
            return jsonify({'error': 'Add a little more detail so habits can be generated'}), 400
        if len(source_text) > 8000:
            return jsonify({'error': 'Habit brief must be 8,000 characters or fewer'}), 400
        if not isinstance(preset_habits, list) or len(preset_habits) > 30:
            return jsonify({'error': 'A maximum of 30 preset habits can be adapted at once'}), 400

        requested_member_ids = {
            int(member_id)
            for member_id in (data.get('memberIds') or [])
            if str(member_id).isdigit()
        }
        group_members = get_group_members_list(group)
        target_members = [] if staff_self_service else [
            member for member in group_members
            if (member.account_role or 'student') == 'student'
            and (not requested_member_ids or member.id in requested_member_ids)
        ]
        if requested_member_ids and len(target_members) != len(requested_member_ids):
            return jsonify({'error': 'One or more selected students are not members of this school'}), 400
        if len(target_members) > 60:
            return jsonify({'error': 'Generate habits for no more than 60 students at a time'}), 400

        if target_members:
            goals_by_student = defaultdict(list)
            goals = StudentGoal.query.filter(
                StudentGoal.group_id == group.id,
                StudentGoal.student_id.in_([member.id for member in target_members]),
            ).order_by(StudentGoal.student_id, StudentGoal.id).all()
            for goal in goals:
                goals_by_student[goal.student_id].append({
                    'id': str(goal.id),
                    'title': goal.title,
                    'barrier': goal.barrier or '',
                    'schoolGoal': goal.school_goal or '',
                    'forSelf': goal.for_self or '',
                    'forOthers': goal.for_others or '',
                })
            target_students = [
                {
                    'id': str(member.id),
                    'name': member.username,
                    'goals': goals_by_student[member.id],
                }
                for member in target_members
            ]
            normalized_draft = generate_personalized_habit_draft(
                group.name,
                source_text,
                preset_habits,
                target_students,
            )
            return jsonify({
                'draft': normalized_draft,
                'contract': structured_contract_metadata('rituo_personalized_habit_draft'),
            }), 200

        raw_draft = create_structured_response(
            model=OPENAI_HABIT_DRAFT_MODEL,
            system_prompt=(
                "You turn a person's free-form personal challenge brief into clear performance habits. "
                "Every habit must be measurable, practical, concise, and include a realistic estimated completion time. "
                "ATTACK moves the person toward a goal or new achievement. DEFENCE protects an existing positive state or standard. "
                "Every habit must be attack or defence, never neutral. "
                "Never add names or make sensitive inferences. "
                + AI_HABIT_TYPE_GUIDANCE
            ),
            user_prompt=json.dumps({
                'task': 'Draft personal challenge habits for the requesting staff member.' if staff_self_service else 'Draft reusable challenge habits from this administrator brief.',
                'workspace': group.name,
                'brief': source_text,
                'allowedHabitTypes': ['boolean', 'numeric', 'text', 'periodic'],
                'allowedCombatTypes': ['attack', 'defence'],
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


@groups_bp.route('/<group_id>/students/<int:student_id>/habit-stats', methods=['GET'])
@jwt_required()
def get_student_habit_stats(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not can_view_student(group, current_user_id, student_id):
            return jsonify({'error': 'You do not have access to this student'}), 403

        student = next(
            (member for member in get_group_members_list(group) if member.id == student_id),
            None,
        )
        if not student:
            return jsonify({'error': 'Student not found in school'}), 404

        challenge = group.active_challenge
        member_habit = get_member_habit_entry(group, student_id) if challenge else None
        goals = StudentGoal.query.filter_by(
            group_id=group.id,
            student_id=student_id,
        ).order_by(StudentGoal.created_at.asc()).all()
        statistics = None
        challenge_payload = None
        if challenge:
            challenge_payload = {
                'id': challenge.id,
                'startDate': challenge.start_date.isoformat(),
                'endDate': challenge.end_date.isoformat(),
                'status': challenge.status,
                'memberHabits': [member_habit] if member_habit else [],
            }
            if member_habit:
                student_today = datetime.now(_student_timezone(group, student_id)[1]).date()
                statistics = _build_group_member_habit_statistics(
                    group,
                    challenge,
                    member_habit,
                    student_id,
                    today_value=student_today,
                    goal_titles={str(goal.id): goal.title for goal in goals},
                )

        return jsonify({
            'statistics': statistics,
            'group': {
                'groupId': group.group_id,
                'name': group.name,
                'members': [student.to_dict()],
                'activeChallenge': challenge_payload,
                'viewerCanManage': can_manage_group(group, current_user_id),
            }
        }), 200
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
        if not user_can_access_group(group, current_user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        return jsonify({'structure': serialize_school_structure(group, current_user_id)}), 200
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
        existing_roles = {
            assignment.user_id: assignment
            for assignment in SchoolRoleAssignment.query.filter_by(group_id=group.id).all()
        }
        existing_subjects = {
            subject.id: subject
            for subject in SchoolSubject.query.filter_by(group_id=group.id).all()
        }
        existing_rooms = {
            room.id: room
            for room in SchoolRoom.query.filter_by(group_id=group.id).all()
        }
        existing_classes = {
            school_class.id: school_class
            for school_class in SchoolClass.query.filter_by(group_id=group.id).all()
        }
        existing_behaviour_types = {
            behaviour_type.id: behaviour_type
            for behaviour_type in SchoolBehaviourType.query.filter_by(group_id=group.id).all()
        }

        def submitted_existing_ids(items, existing_records, label):
            result = set()
            for item in items:
                raw_id = item.get('id')
                if raw_id in (None, '') or not str(raw_id).isdigit():
                    continue
                record_id = int(raw_id)
                if record_id not in existing_records:
                    raise ValueError(f'{label} {record_id} does not belong to this school')
                if record_id in result:
                    raise ValueError(f'{label} {record_id} was submitted more than once')
                result.add(record_id)
            return result

        def duplicate_name(items):
            names = [
                str(item.get('name') or '').strip().lower()
                for item in items
                if str(item.get('name') or '').strip()
            ]
            return next((name for name in names if names.count(name) > 1), None)

        for label, items in (
            ('Subject', subjects),
            ('Room', rooms),
            ('Class', classes),
            ('Behaviour type', behaviour_types),
        ):
            repeated_name = duplicate_name(items)
            if repeated_name:
                return jsonify({'error': f'{label} names must be unique within a school'}), 400

        try:
            submitted_subject_ids = submitted_existing_ids(subjects, existing_subjects, 'Subject')
            submitted_room_ids = submitted_existing_ids(rooms, existing_rooms, 'Room')
            submitted_class_ids = submitted_existing_ids(classes, existing_classes, 'Class')
            submitted_behaviour_type_ids = submitted_existing_ids(
                behaviour_types,
                existing_behaviour_types,
                'Behaviour type',
            )
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400

        submitted_roles = {}
        school_participant_ids = {
            member.id for member in get_group_members_list(group)
        } | {
            coach.id for coach in (group.coaches.all() if hasattr(group.coaches, 'all') else group.coaches)
        } | set(existing_roles)
        school_participant_ids.add(group.leader_id)
        for item in roles:
            try:
                role_user_id = int(item.get('userId'))
            except (TypeError, ValueError):
                continue
            role = (item.get('role') or '').strip()
            role_user = User.query.get(role_user_id)
            if not role_user or role_user_id not in school_participant_ids:
                return jsonify({'error': 'Every role assignment must belong to an existing account in this school'}), 400
            if role not in VALID_SCHOOL_ROLES:
                return jsonify({'error': f'Invalid school role for {role_user.username}'}), 400
            if role_user.account_role == 'admin' and role not in FULL_SCHOOL_ACCESS_ROLES:
                return jsonify({'error': f'{role_user.username} requires an administrator school role'}), 400
            if role_user.account_role == 'teacher' and role not in (SCHOOL_STAFF_ROLES - {'school-admin'}):
                return jsonify({'error': f'{role_user.username} requires a teacher school role'}), 400
            if role_user.account_role == 'student' and role != 'student':
                return jsonify({'error': f'{role_user.username} requires the student school role'}), 400
            submitted_roles[role_user_id] = role
        current_role = get_school_role(group.id, current_user_id)
        current_user = User.query.get(current_user_id)
        submitted_roles[current_user_id] = submitted_roles.get(
            current_user_id,
            current_role or ('school-admin' if current_user.account_role == 'admin' else 'headteacher')
        )

        removed_class_ids = set(existing_classes) - submitted_class_ids
        removed_subject_ids = set(existing_subjects) - submitted_subject_ids
        removed_room_ids = set(existing_rooms) - submitted_room_ids
        removed_behaviour_type_ids = set(existing_behaviour_types) - submitted_behaviour_type_ids
        timetable = group.school_timetable or []
        deletion_conflicts = []

        for class_id in removed_class_ids:
            has_timetable = any(str(entry.get('classId') or '') == str(class_id) for entry in timetable)
            has_messages = Message.query.filter_by(group_id=group.id, class_id=class_id).first() is not None
            has_homework = SchoolHomeworkAssignment.query.filter_by(group_id=group.id, class_id=class_id).first() is not None
            if has_timetable or has_messages or has_homework:
                deletion_conflicts.append(f"class '{existing_classes[class_id].name}'")

        submitted_subject_references = {
            str(item.get('subjectId'))
            for item in classes
            if item.get('subjectId') not in (None, '')
        } | {
            str(assignment.get('subjectId'))
            for item in classes
            for assignment in item.get('teachingAssignments', [])
            if assignment.get('subjectId') not in (None, '')
        }
        for subject_id in removed_subject_ids:
            has_timetable = any(str(entry.get('subjectId') or '') == str(subject_id) for entry in timetable)
            has_homework = SchoolHomeworkAssignment.query.filter_by(group_id=group.id, subject_id=subject_id).first() is not None
            if has_timetable or has_homework or str(subject_id) in submitted_subject_references:
                deletion_conflicts.append(f"subject '{existing_subjects[subject_id].name}'")

        submitted_room_references = {
            str(item.get('roomId'))
            for item in classes
            if item.get('roomId') not in (None, '')
        }
        for room_id in removed_room_ids:
            has_timetable = any(str(entry.get('roomId') or '') == str(room_id) for entry in timetable)
            if has_timetable or str(room_id) in submitted_room_references:
                deletion_conflicts.append(f"room '{existing_rooms[room_id].name}'")

        for behaviour_type_id in removed_behaviour_type_ids:
            has_events = SchoolBehaviourEvent.query.filter_by(
                group_id=group.id,
                behaviour_type_id=behaviour_type_id,
            ).first() is not None
            if has_events:
                deletion_conflicts.append(
                    f"behaviour type '{existing_behaviour_types[behaviour_type_id].name}'"
                )

        if deletion_conflicts:
            return jsonify({
                'error': (
                    'Cannot remove referenced school data: '
                    f"{', '.join(deletion_conflicts)}. Remove its timetable, homework, chat, or behaviour references first."
                )
            }), 409

        subject_id_map = {}
        room_id_map = {}
        class_id_map = {}

        for item in subjects:
            name = (item.get('name') or '').strip()
            if not name:
                continue
            raw_id = item.get('id')
            existing_id = int(raw_id) if str(raw_id).isdigit() else None
            subject = existing_subjects.get(existing_id)
            if not subject:
                subject = SchoolSubject(group_id=group.id)
                db.session.add(subject)
            subject.name = name
            subject.code = (item.get('code') or '').strip() or None
            db.session.flush()
            subject_id_map[str(raw_id or f"subject-{subject.id}")] = subject.id

        for item in rooms:
            name = (item.get('name') or '').strip()
            if not name:
                continue
            capacity = item.get('capacity')
            try:
                capacity = int(capacity) if capacity not in (None, '') else None
            except (TypeError, ValueError):
                capacity = None
            raw_id = item.get('id')
            existing_id = int(raw_id) if str(raw_id).isdigit() else None
            room = existing_rooms.get(existing_id)
            if not room:
                room = SchoolRoom(group_id=group.id)
                db.session.add(room)
            room.name = name
            room.block = (item.get('block') or '').strip() or None
            room.capacity = capacity
            db.session.flush()
            room_id_map[str(raw_id or f"room-{room.id}")] = room.id

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
            raw_id = item.get('id')
            existing_id = int(raw_id) if str(raw_id).isdigit() else None
            behaviour_type = existing_behaviour_types.get(existing_id)
            if not behaviour_type:
                behaviour_type = SchoolBehaviourType(group_id=group.id)
                db.session.add(behaviour_type)
            behaviour_type.name = name
            behaviour_type.kind = kind
            behaviour_type.severity = severity
            behaviour_type.default_points = default_points
            behaviour_type.note_type = (item.get('noteType') or '').strip() or None

        for item in classes:
            name = (item.get('name') or '').strip()
            if not name:
                continue
            room_key = str(item.get('roomId')) if item.get('roomId') is not None else None
            subject_key = str(item.get('subjectId')) if item.get('subjectId') is not None else None
            try:
                weekly_lessons = max(1, min(20, int(item.get('weeklyLessons') or 5)))
            except (TypeError, ValueError):
                weekly_lessons = 5
            raw_id = item.get('id')
            existing_id = int(raw_id) if str(raw_id).isdigit() else None
            school_class = existing_classes.get(existing_id)
            if not school_class:
                school_class = SchoolClass(group_id=group.id)
                db.session.add(school_class)
            school_class.name = name
            school_class.tutor_group = (item.get('tutorGroup') or '').strip() or None
            school_class.year_group = (item.get('yearGroup') or '').strip() or None
            school_class.description = (item.get('description') or '').strip() or None
            school_class.subject_id = subject_id_map.get(subject_key) if subject_key else None
            school_class.room_id = room_id_map.get(room_key) if room_key else None
            school_class.weekly_lessons = weekly_lessons
            db.session.flush()
            class_id_map[str(raw_id or f"class-{school_class.id}")] = school_class.id

            SchoolEnrollment.query.filter_by(
                group_id=group.id,
                class_id=school_class.id,
            ).delete(synchronize_session=False)
            SchoolTeachingAssignment.query.filter_by(
                group_id=group.id,
                class_id=school_class.id,
            ).delete(synchronize_session=False)

            for enrollment in item.get('enrollments', []):
                student_id = enrollment.get('studentId')
                try:
                    student_id = int(student_id)
                except (TypeError, ValueError):
                    continue
                if submitted_roles.get(student_id) != 'student':
                    continue
                db.session.add(SchoolEnrollment(group_id=group.id, class_id=school_class.id, student_id=student_id))

            for assignment in item.get('teachingAssignments', []):
                teacher_id = assignment.get('teacherId')
                subject_key = str(assignment.get('subjectId')) if assignment.get('subjectId') is not None else None
                try:
                    teacher_id = int(teacher_id)
                except (TypeError, ValueError):
                    continue
                if submitted_roles.get(teacher_id) not in SCHOOL_STAFF_ROLES:
                    continue
                subject_id = subject_id_map.get(subject_key)
                if not subject_id:
                    continue
                assignment_role = (assignment.get('assignmentRole') or 'lead-teacher').strip()
                if assignment_role not in VALID_TEACHING_ASSIGNMENT_ROLES:
                    assignment_role = 'lead-teacher'
                db.session.add(SchoolTeachingAssignment(
                    group_id=group.id,
                    class_id=school_class.id,
                    subject_id=subject_id,
                    teacher_id=teacher_id,
                    assignment_role=assignment_role
                ))

        for class_id in removed_class_ids:
            SchoolEnrollment.query.filter_by(
                group_id=group.id,
                class_id=class_id,
            ).delete(synchronize_session=False)
            SchoolTeachingAssignment.query.filter_by(
                group_id=group.id,
                class_id=class_id,
            ).delete(synchronize_session=False)
            db.session.delete(existing_classes[class_id])

        for subject_id in removed_subject_ids:
            db.session.delete(existing_subjects[subject_id])
        for room_id in removed_room_ids:
            db.session.delete(existing_rooms[room_id])
        for behaviour_type_id in removed_behaviour_type_ids:
            db.session.delete(existing_behaviour_types[behaviour_type_id])

        for role_user_id, role in submitted_roles.items():
            assignment = existing_roles.get(role_user_id)
            if assignment:
                assignment.role = role
            else:
                db.session.add(SchoolRoleAssignment(group_id=group.id, user_id=role_user_id, role=role))
        for role_user_id, assignment in existing_roles.items():
            if role_user_id not in submitted_roles:
                db.session.delete(assignment)

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
        return jsonify({'structure': serialize_school_structure(group, current_user_id)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/classes/<int:class_id>', methods=['PATCH'])
@jwt_required()
def update_school_class(group_id, class_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id if group else None).first()
        if not group or not school_class:
            return jsonify({'error': 'Class not found'}), 404
        if not can_manage_class_staff(group, current_user_id, school_class.id):
            return jsonify({'error': 'You cannot edit this class'}), 403

        data = request.get_json() or {}
        if 'name' in data:
            name = str(data.get('name') or '').strip()
            if not name:
                return jsonify({'error': 'Class name is required'}), 400
            school_class.name = name[:120]
        if 'tutorGroup' in data:
            school_class.tutor_group = str(data.get('tutorGroup') or '').strip()[:120] or None
        if 'yearGroup' in data:
            school_class.year_group = str(data.get('yearGroup') or '').strip()[:40] or None
        if 'description' in data:
            school_class.description = str(data.get('description') or '').strip()[:2000] or None
        if 'weeklyLessons' in data:
            try:
                school_class.weekly_lessons = max(1, min(20, int(data.get('weeklyLessons') or 5)))
            except (TypeError, ValueError):
                return jsonify({'error': 'weeklyLessons must be a number between 1 and 20'}), 400
        if 'subjectId' in data:
            try:
                subject_id = int(data.get('subjectId')) if data.get('subjectId') not in (None, '') else None
            except (TypeError, ValueError):
                subject_id = None
            if subject_id and not SchoolSubject.query.filter_by(id=subject_id, group_id=group.id).first():
                return jsonify({'error': 'Subject not found in this school'}), 400
            school_class.subject_id = subject_id
        if 'roomId' in data:
            try:
                room_id = int(data.get('roomId')) if data.get('roomId') not in (None, '') else None
            except (TypeError, ValueError):
                room_id = None
            if room_id and not SchoolRoom.query.filter_by(id=room_id, group_id=group.id).first():
                return jsonify({'error': 'Room not found in this school'}), 400
            school_class.room_id = room_id

        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'class',
            f'Updated class {school_class.name}',
            metadata={'classId': school_class.id}
        )
        db.session.commit()
        return jsonify({'structure': serialize_school_structure(group, current_user_id)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/classes/<int:class_id>/available-students', methods=['GET'])
@jwt_required()
def get_available_class_students(group_id, class_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id if group else None).first()
        if not group or not school_class:
            return jsonify({'error': 'Class not found'}), 404
        if not can_manage_class_roster(group, current_user_id, school_class.id):
            return jsonify({'error': 'You cannot manage this class roster'}), 403

        query = str(request.args.get('query') or '').strip().lower()
        students = [
            member for member in get_group_members_list(group)
            if member.account_role == 'student'
            and (
                not query
                or query in (member.username or '').lower()
                or query in (member.email or '').lower()
            )
        ]
        enrolled_ids = {
            enrollment.student_id
            for enrollment in SchoolEnrollment.query.filter_by(group_id=group.id, class_id=school_class.id).all()
        }
        return jsonify({
            'students': [
                {
                    **serialize_school_user_brief(student),
                    'enrolled': student.id in enrolled_ids,
                }
                for student in sorted(students, key=lambda item: (item.username or '').lower())[:250]
            ]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/classes/<int:class_id>/roster', methods=['PUT'])
@jwt_required()
def update_school_class_roster(group_id, class_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id if group else None).first()
        if not group or not school_class:
            return jsonify({'error': 'Class not found'}), 404
        if not can_manage_class_roster(group, current_user_id, school_class.id):
            return jsonify({'error': 'You cannot manage this class roster'}), 403

        data = request.get_json() or {}
        requested_ids = set()
        for value in data.get('studentIds') or []:
            try:
                requested_ids.add(int(value))
            except (TypeError, ValueError):
                continue
        valid_student_ids = {
            member.id
            for member in get_group_members_list(group)
            if member.account_role == 'student'
        }
        invalid_ids = requested_ids - valid_student_ids
        if invalid_ids:
            return jsonify({'error': 'One or more students do not belong to this school'}), 400

        SchoolEnrollment.query.filter_by(group_id=group.id, class_id=school_class.id).delete()
        for student_id in sorted(requested_ids):
            db.session.add(SchoolEnrollment(
                group_id=group.id,
                class_id=school_class.id,
                student_id=student_id
            ))

        timetable = []
        for entry in group.school_timetable or []:
            if str(entry.get('classId') or '') == str(school_class.id):
                entry = {**entry, 'studentIds': sorted(requested_ids)}
            timetable.append(entry)
        group.school_timetable = timetable
        flag_modified(group, 'school_timetable')
        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'class-roster',
            f'Updated roster for {school_class.name}',
            description=f'{len(requested_ids)} student(s) assigned.',
            metadata={'classId': school_class.id, 'studentCount': len(requested_ids)}
        )
        db.session.commit()
        return jsonify({'structure': serialize_school_structure(group, current_user_id)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/classes/<int:class_id>/staff', methods=['PUT'])
@jwt_required()
def update_school_class_staff(group_id, class_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id if group else None).first()
        if not group or not school_class:
            return jsonify({'error': 'Class not found'}), 404
        if not can_manage_class_staff(group, current_user_id, school_class.id):
            return jsonify({'error': 'You cannot manage staff for this class'}), 403

        assignments = request.get_json().get('assignments', []) if request.get_json() else []
        valid_staff_ids = {
            assignment.user_id
            for assignment in SchoolRoleAssignment.query.filter(
                SchoolRoleAssignment.group_id == group.id,
                SchoolRoleAssignment.role.in_(tuple(SCHOOL_STAFF_ROLES))
            ).all()
        }
        valid_subject_ids = {
            subject.id for subject in SchoolSubject.query.filter_by(group_id=group.id).all()
        }
        normalized_assignments = []
        seen = set()
        for item in assignments:
            try:
                teacher_id = int(item.get('teacherId'))
                subject_id = int(item.get('subjectId'))
            except (TypeError, ValueError):
                continue
            assignment_role = str(item.get('assignmentRole') or 'lead-teacher').strip()
            if assignment_role not in VALID_TEACHING_ASSIGNMENT_ROLES:
                assignment_role = 'lead-teacher'
            key = (teacher_id, subject_id)
            if teacher_id not in valid_staff_ids or subject_id not in valid_subject_ids or key in seen:
                continue
            normalized_assignments.append((teacher_id, subject_id, assignment_role))
            seen.add(key)

        SchoolTeachingAssignment.query.filter_by(group_id=group.id, class_id=school_class.id).delete()
        for teacher_id, subject_id, assignment_role in normalized_assignments:
            db.session.add(SchoolTeachingAssignment(
                group_id=group.id,
                class_id=school_class.id,
                subject_id=subject_id,
                teacher_id=teacher_id,
                assignment_role=assignment_role
            ))
        log_school_audit(
            group.id,
            current_user_id,
            'updated',
            'class-staff',
            f'Updated teaching team for {school_class.name}',
            description=f'{len(normalized_assignments)} staff assignment(s) saved.',
            metadata={'classId': school_class.id, 'staffCount': len(normalized_assignments)}
        )
        db.session.commit()
        return jsonify({'structure': serialize_school_structure(group, current_user_id)}), 200
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
            accessible_class_ids = get_accessible_class_ids(group, current_user_id)
            slots = [
                entry for entry in slots
                if str(entry.get('classId') or '').isdigit()
                and int(entry.get('classId')) in accessible_class_ids
            ]

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
        if class_id:
            school_class = SchoolClass.query.filter_by(id=class_id, group_id=group.id).first()
            if not school_class:
                return jsonify({'error': 'Class not found'}), 404
            if class_id not in get_accessible_class_ids(group, current_user_id):
                return jsonify({'error': 'You can only set homework for classes within your assigned scope'}), 403
        if subject_id and not SchoolSubject.query.filter_by(id=subject_id, group_id=group.id).first():
            return jsonify({'error': 'Subject not found'}), 404
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
            "Classify goal-building habits as attack and habits protecting an existing positive state or standard as defence. "
            "Keep suggestions school-safe, realistic, and easy to act on this week. "
            "Use the provided student context, and if context is missing, say so in warnings instead of inventing facts. "
            + AI_HABIT_TYPE_GUIDANCE
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


def _planner_time_to_minutes(time_value):
    try:
        hours, minutes = [int(value) for value in str(time_value).split(':')]
        if not 0 <= hours <= 23 or not 0 <= minutes <= 59:
            return None
        return (hours * 60) + minutes
    except (TypeError, ValueError):
        return None


def _planner_time_with_offset(time_value, offset_minutes):
    try:
        hours, minutes = [int(value) for value in str(time_value).split(':')]
        total_minutes = max(0, min((23 * 60) + 59, (hours * 60) + minutes + int(offset_minutes)))
        return f'{total_minutes // 60:02d}:{total_minutes % 60:02d}'
    except (TypeError, ValueError):
        return str(time_value or '')


def _planner_school_day_context(group, weekday, settings=None):
    if getattr(group, 'group_type', 'school') != 'school' or not (group.school_day_config or {}):
        return {}, []
    has_school_day = weekday in VALID_WEEKDAYS[:5] or any(
        entry.get('weekday') == weekday for entry in (group.school_timetable or [])
    )
    if not has_school_day:
        return {}, []
    day_config = normalize_school_day_config(group.school_day_config)
    commute_minutes = max(0, min(180, int(getattr(settings, 'school_commute_minutes', 0) or 0)))
    context = {
        'weekday': weekday,
        'startTime': day_config['startTime'],
        'endTime': day_config['endTime'],
        'breaks': day_config['breaks'],
        'commuteMinutesEachWay': commute_minutes,
    }
    if not commute_minutes:
        return context, []
    commute_items = [
        {
            'id': 'school-commute-in',
            'title': 'Travel to school',
            'itemType': 'school',
            'habitIndex': -1,
            'startTime': _planner_time_with_offset(day_config['startTime'], -commute_minutes),
            'endTime': day_config['startTime'],
            'durationMinutes': commute_minutes,
            'locked': True,
            'reason': f'{commute_minutes} minute school commute',
            'source': 'school-commute',
        },
        {
            'id': 'school-commute-home',
            'title': 'Travel home',
            'itemType': 'school',
            'habitIndex': -1,
            'startTime': day_config['endTime'],
            'endTime': _planner_time_with_offset(day_config['endTime'], commute_minutes),
            'durationMinutes': commute_minutes,
            'locked': True,
            'reason': f'{commute_minutes} minute school commute',
            'source': 'school-commute',
        },
    ]
    return context, commute_items


def _normalize_saved_schedule_items(items):
    normalized = []
    allowed_types = {'habit', 'manual', 'school', 'break', 'sleep', 'routine', 'google'}
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
        source = str((raw_item or {}).get('source') or 'manual').strip()[:20]
        routine_id = str((raw_item or {}).get('routineId') or '').strip()[:80]
        routine_override = bool(
            item_type == 'routine'
            and routine_id
            and (raw_item or {}).get('routineOverride')
        )
        normalized_item = {
            'id': str((raw_item or {}).get('id') or f"item-{index + 1}")[:80],
            'title': title[:120],
            'itemType': item_type,
            'habitIndex': habit_index,
            'startTime': start_time,
            'endTime': end_time,
            'durationMinutes': _minutes_between(start_time, end_time),
            'locked': bool(
                (raw_item or {}).get('locked')
                or item_type in {'school', 'sleep', 'google'}
                or (item_type == 'routine' and not routine_override)
            ),
            'allowOverlap': bool((raw_item or {}).get('allowOverlap')),
            'reason': str((raw_item or {}).get('reason') or '').strip()[:240],
            'source': 'routine-override' if routine_override else source,
        }
        if item_type == 'routine':
            normalized_item['routineId'] = routine_id
            normalized_item['routineOverride'] = routine_override
        normalized.append(normalized_item)
    normalized.sort(key=lambda item: (item['startTime'], item['endTime']))
    return normalized


def _planner_ai_layout_context(items):
    context = []
    for item in items or []:
        item_type = item.get('itemType') or 'manual'
        routine_override = bool(item.get('routineOverride') or item.get('source') == 'routine-override')
        recurrence = (
            'weekly'
            if item_type == 'routine' and not routine_override
            else 'one-off'
            if item_type in {'manual', 'routine'}
            else 'daily-boundary'
            if item_type == 'sleep'
            else 'authoritative-timetable'
            if item_type == 'school'
            else 'external-calendar'
            if item_type == 'google'
            else 'challenge-schedule'
            if item_type == 'habit'
            else 'flexible'
        )
        context.append({
            'id': item.get('id') or '',
            'title': item.get('title') or '',
            'itemType': item_type,
            'habitIndex': item.get('habitIndex', -1),
            'startTime': item.get('startTime') or '',
            'endTime': item.get('endTime') or '',
            'durationMinutes': item.get('durationMinutes') or 0,
            'locked': bool(item.get('locked')),
            'allowOverlap': bool(item.get('allowOverlap')),
            'reason': item.get('reason') or '',
            'recurrence': recurrence,
            'movableByPlanner': bool(not item.get('locked') and item_type in {'habit', 'break'}),
        })
    return context


def _filter_generated_breaks_against_fixed_items(items, fixed_items):
    fixed_ranges = []
    for fixed_item in fixed_items or []:
        start_minutes = _planner_time_to_minutes(fixed_item.get('startTime'))
        end_minutes = _planner_time_to_minutes(fixed_item.get('endTime'))
        if start_minutes is None or end_minutes is None or end_minutes <= start_minutes:
            continue
        fixed_ranges.append((start_minutes, end_minutes))
    filtered = []
    for item in items or []:
        if item.get('itemType') != 'break':
            filtered.append(item)
            continue
        start_minutes = _planner_time_to_minutes(item.get('startTime'))
        end_minutes = _planner_time_to_minutes(item.get('endTime'))
        overlaps_fixed = (
            start_minutes is not None
            and end_minutes is not None
            and any(start_minutes < fixed_end and end_minutes > fixed_start for fixed_start, fixed_end in fixed_ranges)
        )
        if not overlaps_fixed:
            filtered.append(item)
    return filtered


def _planner_travel_clarification(constraints_text, current_layout):
    layout_text = ' '.join(
        f"{item.get('title') or ''} {item.get('reason') or ''}"
        for item in current_layout or []
    )
    combined_text = f'{constraints_text or ""} {layout_text}'.lower()
    place_patterns = (
        (r'\bgym\b', 'gym'),
        (r'\btraining\b', 'training venue'),
        (r'\bpitch\b', 'pitch'),
        (r'\bclub\b', 'club'),
        (r'\boffice\b', 'workplace'),
        (r'\bwork\b', 'workplace'),
        (r'\bdoctor\b', 'appointment'),
        (r'\bhospital\b', 'appointment'),
        (r'\bappointment\b', 'appointment'),
    )
    place_match = next(
        ((pattern, label, re.search(pattern, combined_text)) for pattern, label in place_patterns if re.search(pattern, combined_text)),
        None,
    )
    if not place_match:
        return None
    travel_terms = ('travel', 'commute', 'journey', 'drive to', 'walk to', 'cycle to', 'bus to', 'train to')
    if any(
        any(term in f"{item.get('title') or ''} {item.get('reason') or ''}".lower() for term in travel_terms)
        for item in current_layout or []
    ):
        return None
    _, place_label, match = place_match
    nearby_text = combined_text[max(0, match.start() - 80):match.end() + 100]
    if re.search(r'\b\d{1,3}\s*(?:min|mins|minute|minutes|hour|hours)\b', nearby_text):
        return None
    return {
        'id': 'travel-time',
        'question': f'Does going to the {place_label} require travel? If so, how many minutes should I allow each way?',
        'placeholder': 'Example: 20 minutes each way, or no travel needed',
    }


def _add_planner_clarification_question(clarification, question):
    if not question:
        return clarification
    existing_questions = list((clarification or {}).get('questions') or [])
    travel_words = ('travel', 'commute', 'journey')
    already_asked = any(
        item.get('id') == question['id']
        or any(word in str(item.get('question') or '').lower() for word in travel_words)
        for item in existing_questions
    )
    if not already_asked:
        existing_questions.insert(0, question)
    return {
        **(clarification or {}),
        'needsClarification': True,
        'questions': existing_questions[:3],
        'readyMessage': 'A few practical details will make this plan realistic.',
    }


def _planner_schedule_coverage_issues(items, habits):
    required_counts = {
        int(habit['habitIndex']): (
            max(2, int(habit.get('periodicOccurrences') or 4))
            if habit.get('habitType') == 'periodic'
            else 1
        )
        for habit in habits or []
    }
    actual_counts = defaultdict(int)
    for item in items or []:
        if item.get('itemType') != 'habit':
            continue
        try:
            actual_counts[int(item.get('habitIndex'))] += 1
        except (TypeError, ValueError):
            continue
    return [
        {
            'habitIndex': habit_index,
            'requiredCount': required_count,
            'actualCount': actual_counts.get(habit_index, 0),
        }
        for habit_index, required_count in required_counts.items()
        if actual_counts.get(habit_index, 0) != required_count
    ]


def _is_valid_planner_time(value):
    try:
        hours, minutes = [int(part) for part in str(value).split(':')]
        return 0 <= hours <= 23 and 0 <= minutes <= 59 and len(str(value)) == 5
    except (TypeError, ValueError):
        return False


def _normalize_recurring_reminders(reminders, default_created_date=None):
    normalized = []
    fallback_created_date = str(default_created_date or date.today().isoformat())[:10]
    for index, raw_reminder in enumerate((reminders or [])[:30]):
        title = str((raw_reminder or {}).get('title') or '').strip()[:120]
        start_time = str((raw_reminder or {}).get('startTime') or '').strip()
        end_time = str((raw_reminder or {}).get('endTime') or '').strip()
        weekdays = [
            day for day in ((raw_reminder or {}).get('weekdays') or [])
            if day in VALID_WEEKDAYS
        ]
        if (
            not title
            or not weekdays
            or not _is_valid_planner_time(start_time)
            or not _is_valid_planner_time(end_time)
            or start_time >= end_time
        ):
            continue
        created_date = str((raw_reminder or {}).get('createdDate') or fallback_created_date)[:10]
        try:
            created_date = date.fromisoformat(created_date).isoformat()
        except ValueError:
            created_date = fallback_created_date
        normalized.append({
            'id': str((raw_reminder or {}).get('id') or f"routine-{uuid.uuid4().hex[:12]}")[:80],
            'title': title,
            'startTime': start_time,
            'endTime': end_time,
            'weekdays': list(dict.fromkeys(weekdays)),
            'createdDate': created_date,
        })
    return normalized


def _normalize_ai_weekly_templates(templates):
    if not isinstance(templates, dict):
        return {}
    normalized = {}
    for weekday in VALID_WEEKDAYS:
        items = [
            item for item in _normalize_saved_schedule_items(templates.get(weekday))
            if item.get('itemType') in {'habit', 'break'}
        ]
        if items:
            normalized[weekday] = items[:40]
    return normalized


def normalize_staff_challenge_habits(raw_habits, existing_habits=None):
    if not isinstance(raw_habits, list) or not raw_habits:
        raise ValueError('Add at least one habit to your personal challenge')
    if len(raw_habits) > 12:
        raise ValueError('A personal challenge can contain no more than 12 habits')

    existing_by_id = {
        str(habit.get('id')): habit
        for habit in (existing_habits or [])
        if isinstance(habit, dict) and habit.get('id')
    }
    normalized = []
    for index, raw_habit in enumerate(raw_habits):
        if not isinstance(raw_habit, dict):
            raise ValueError(f'Habit {index + 1} must be an object')
        name = str(raw_habit.get('name') or '').strip()[:120]
        if not name:
            raise ValueError(f'Habit {index + 1} needs a name')
        habit_type = str(raw_habit.get('habitType') or 'boolean').strip().lower()
        if habit_type not in {'boolean', 'numeric', 'text', 'periodic'}:
            raise ValueError(f'{name} has an unsupported habit type')
        combat_type = str(raw_habit.get('combatType') or 'attack').strip().lower()
        if combat_type not in {'attack', 'defence'}:
            combat_type = 'attack'
        schedule_days = list(dict.fromkeys(
            day for day in (raw_habit.get('scheduleDays') or []) if day in VALID_WEEKDAYS
        ))
        if not schedule_days:
            raise ValueError(f'{name} needs at least one scheduled day')
        schedule_time = str(raw_habit.get('scheduleTime') or '17:00').strip()
        if not _is_valid_planner_time(schedule_time):
            raise ValueError(f'{name} needs a valid start time')
        try:
            duration_minutes = max(5, min(240, int(raw_habit.get('durationMinutes') or 30)))
            minimum_value = int(raw_habit.get('minValue') or 0)
            maximum_value = int(raw_habit.get('maxValue') or 10)
            periodic_occurrences = max(2, min(12, int(raw_habit.get('periodicOccurrences') or 4)))
            periodic_interval_hours = max(1, min(12, int(raw_habit.get('periodicIntervalHours') or 4)))
        except (TypeError, ValueError):
            raise ValueError(f'{name} contains invalid numeric settings')
        if maximum_value <= minimum_value:
            maximum_value = minimum_value + 1
        habit_id = str(raw_habit.get('id') or f'staff-habit-{uuid.uuid4().hex[:12]}')[:80]
        previous = existing_by_id.get(habit_id) or {}
        progress = previous.get('progress') if isinstance(previous.get('progress'), list) else []
        normalized.append({
            'id': habit_id,
            'name': name,
            'description': str(raw_habit.get('description') or '').strip()[:500],
            'habitType': habit_type,
            'combatType': combat_type,
            'scheduleDays': schedule_days,
            'scheduleTime': schedule_time,
            'durationMinutes': duration_minutes,
            'minValue': minimum_value,
            'maxValue': maximum_value,
            'prompt': str(raw_habit.get('prompt') or '').strip()[:300],
            'periodicOccurrences': periodic_occurrences,
            'periodicIntervalHours': periodic_interval_hours,
            'allowOverlap': bool(raw_habit.get('allowOverlap')),
            'progress': progress,
        })
    return normalized


def _staff_challenge_member_entry(challenge):
    created_at = challenge.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {
        'member': challenge.member_id,
        'joinedAt': challenge.start_date.date().isoformat(),
        'activationAt': created_at.isoformat() if created_at else None,
        'habits': challenge.habits or [],
    }


def _planner_challenge_context(group, member_id, challenge_id=None):
    if getattr(group, 'group_type', 'school') == 'staff':
        query = StaffPersonalChallenge.query.filter_by(
            group_id=group.id,
            member_id=member_id,
            status='active',
        )
        if challenge_id not in (None, ''):
            try:
                query = query.filter_by(id=int(challenge_id))
            except (TypeError, ValueError):
                return None, None
        challenge = query.order_by(StaffPersonalChallenge.created_at.desc()).first()
        return challenge, _staff_challenge_member_entry(challenge) if challenge else None
    return group.active_challenge, get_member_habit_entry(group, member_id)


def _staff_habit_completion_access(group, challenge, member_id, habit, habit_index, current_time):
    return _habit_completion_access(
        group,
        member_id,
        habit,
        habit_index,
        now=current_time,
        challenge=challenge,
        member_habit=_staff_challenge_member_entry(challenge),
    )


def build_staff_slacker_callout(member_rows):
    active_rows = [row for row in member_rows if row.get('challenge')]
    missing_rows = [row for row in member_rows if not row.get('challenge')]
    if active_rows and missing_rows:
        slacker = sorted(missing_rows, key=lambda row: (row['name'].lower(), row['memberId']))[0]
        return {
            'active': True,
            'memberId': slacker['memberId'],
            'name': slacker['name'],
            'rate': 0,
            'headline': f"ACCOUNTABILITY KLAXON: {slacker['name']} is still in spectator mode",
            'message': 'Everyone else has put a challenge on the board. The group chat is now accepting motivational allegations.',
            'reason': 'no-challenge',
        }

    eligible = [
        row for row in active_rows
        if int((row.get('stats') or {}).get('summary', {}).get('possibleUnits') or 0) >= 2
    ]
    if not eligible:
        return {
            'active': False,
            'headline': 'Slacker radar is warming up',
            'message': 'Complete a few scheduled habits and the accountability department will have enough evidence.',
        }

    ranked = sorted(eligible, key=lambda row: (row['score'], row['name'].lower(), row['memberId']))
    slacker = ranked[0]
    leader_score = max(row['score'] for row in eligible)
    if slacker['score'] >= 85 and leader_score - slacker['score'] < 12:
        return {
            'active': False,
            'headline': 'No exposé today. Standards are annoyingly high.',
            'message': 'The accountability department searched for a slacker and found an administrative error instead.',
        }

    messages = (
        'The consistency spreadsheet has requested a formal explanation and possibly a strong coffee.',
        'Sources close to the leaderboard describe the current effort level as “under active investigation”.',
        'A late surge is still possible. Unfortunately, so are screenshots from the rest of the group.',
        'The standards committee has opened the curtains. Time to put some completions on the board.',
    )
    message_index = (slacker['memberId'] + date.today().toordinal()) % len(messages)
    return {
        'active': True,
        'memberId': slacker['memberId'],
        'name': slacker['name'],
        'rate': slacker['score'],
        'headline': f"SLACKER WATCH: {slacker['name']} is holding the table upside down",
        'message': messages[message_index],
        'reason': 'lowest-consistency',
    }


IP_BUCKS_FIBONACCI_CAP = 55
IP_AVATAR_DEFAULTS = {
    'coreColor': 'violet',
    'skinTone': 'warm-medium',
    'faceShape': 'oval',
    'eyeColor': 'deep-brown',
    'eyebrowStyle': 'natural',
    'facialHairStyle': 'none',
    'glassesStyle': 'none',
    'bodyStyle': 'balanced',
    'hairStyle': 'textured-crop',
    'hairColor': 'espresso',
    'outfitStyle': 'protocol-jacket',
    'pose': 'ready',
    'expression': 'focused',
    'aura': 'aura-classic',
    'headwear': 'none',
    'accessory': 'none',
    'backdrop': 'backdrop-grid',
    'companion': 'none',
}
IP_AVATAR_FREE_CHOICES = {
    'coreColors': [
        {'id': 'violet', 'name': 'Protocol Violet', 'color': '#7c3aed'},
        {'id': 'cyan', 'name': 'Clarity Cyan', 'color': '#06b6d4'},
        {'id': 'emerald', 'name': 'Growth Emerald', 'color': '#10b981'},
        {'id': 'amber', 'name': 'Energy Amber', 'color': '#f59e0b'},
        {'id': 'rose', 'name': 'Courage Rose', 'color': '#f43f5e'},
        {'id': 'slate', 'name': 'Focus Slate', 'color': '#475569'},
    ],
    'skinTones': [
        {'id': 'porcelain', 'name': 'Porcelain', 'color': '#f5d0b5'},
        {'id': 'warm-light', 'name': 'Warm Light', 'color': '#e8b98f'},
        {'id': 'warm-medium', 'name': 'Warm Medium', 'color': '#c8895f'},
        {'id': 'golden-brown', 'name': 'Golden Brown', 'color': '#a9673f'},
        {'id': 'deep-brown', 'name': 'Deep Brown', 'color': '#75442e'},
        {'id': 'rich-deep', 'name': 'Rich Deep', 'color': '#4b2a20'},
    ],
    'faceShapes': [
        {'id': 'oval', 'name': 'Oval'},
        {'id': 'round', 'name': 'Round'},
        {'id': 'square', 'name': 'Square'},
        {'id': 'heart', 'name': 'Heart'},
        {'id': 'angular', 'name': 'Angular'},
    ],
    'eyeColors': [
        {'id': 'deep-brown', 'name': 'Deep Brown', 'color': '#3f2416'},
        {'id': 'hazel', 'name': 'Hazel', 'color': '#8a6a35'},
        {'id': 'blue', 'name': 'Blue', 'color': '#3b82f6'},
        {'id': 'green', 'name': 'Green', 'color': '#4d7c55'},
        {'id': 'grey', 'name': 'Grey', 'color': '#64748b'},
    ],
    'eyebrowStyles': [
        {'id': 'natural', 'name': 'Natural'},
        {'id': 'straight', 'name': 'Straight'},
        {'id': 'arched', 'name': 'Arched'},
        {'id': 'bold', 'name': 'Bold'},
    ],
    'facialHairStyles': [
        {'id': 'none', 'name': 'Clean Shaven'},
        {'id': 'stubble', 'name': 'Stubble'},
        {'id': 'moustache', 'name': 'Moustache'},
        {'id': 'short-beard', 'name': 'Short Beard'},
    ],
    'glassesStyles': [
        {'id': 'none', 'name': 'No Glasses'},
        {'id': 'round', 'name': 'Round Frames'},
        {'id': 'square', 'name': 'Square Frames'},
        {'id': 'aviator', 'name': 'Aviator Frames'},
    ],
    'bodyStyles': [
        {'id': 'balanced', 'name': 'Balanced'},
        {'id': 'athletic', 'name': 'Athletic'},
        {'id': 'broad', 'name': 'Broad'},
        {'id': 'slim', 'name': 'Slim'},
    ],
    'hairStyles': [
        {'id': 'textured-crop', 'name': 'Textured Crop'},
        {'id': 'soft-curls', 'name': 'Soft Curls'},
        {'id': 'high-top', 'name': 'High Top'},
        {'id': 'side-sweep', 'name': 'Side Sweep'},
        {'id': 'tied-back', 'name': 'Tied Back'},
        {'id': 'locs', 'name': 'Short Locs'},
        {'id': 'none', 'name': 'No Hair'},
    ],
    'hairColors': [
        {'id': 'midnight', 'name': 'Midnight', 'color': '#111827'},
        {'id': 'espresso', 'name': 'Espresso', 'color': '#3f251a'},
        {'id': 'chestnut', 'name': 'Chestnut', 'color': '#7c3f24'},
        {'id': 'golden', 'name': 'Golden', 'color': '#d6a84b'},
        {'id': 'silver', 'name': 'Silver', 'color': '#cbd5e1'},
        {'id': 'protocol-violet', 'name': 'Protocol Violet', 'color': '#7c3aed'},
    ],
    'outfitStyles': [
        {'id': 'protocol-jacket', 'name': 'Protocol Jacket'},
        {'id': 'varsity', 'name': 'IP Varsity'},
        {'id': 'performance-hoodie', 'name': 'Performance Hoodie'},
        {'id': 'training-kit', 'name': 'Training Kit'},
    ],
    'poses': [
        {'id': 'ready', 'name': 'Ready'},
        {'id': 'confident', 'name': 'Confident'},
        {'id': 'victory', 'name': 'Victory'},
    ],
    'expressions': [
        {'id': 'focused', 'name': 'Focused'},
        {'id': 'smile', 'name': 'Positive'},
        {'id': 'determined', 'name': 'Determined'},
    ],
}
IP_SHOP_CATALOG = (
    {'id': 'aura-pulse', 'name': 'Focus Pulse', 'description': 'A cyan pulse around your IP Core.', 'kind': 'avatar', 'slot': 'aura', 'price': 5, 'rarity': 'common'},
    {'id': 'backdrop-midnight', 'name': 'Midnight Grid', 'description': 'A deep focus grid for your avatar card.', 'kind': 'avatar', 'slot': 'backdrop', 'price': 5, 'rarity': 'common'},
    {'id': 'headwear-focus-band', 'name': 'Focus Band', 'description': 'A clean performance headband.', 'kind': 'avatar', 'slot': 'headwear', 'price': 8, 'rarity': 'common'},
    {'id': 'accessory-book', 'name': 'Knowledge Book', 'description': 'Carry the symbol of deliberate learning.', 'kind': 'avatar', 'slot': 'accessory', 'price': 8, 'rarity': 'common'},
    {'id': 'aura-sunrise', 'name': 'Sunrise Aura', 'description': 'Warm energy for an early start.', 'kind': 'avatar', 'slot': 'aura', 'price': 13, 'rarity': 'rare'},
    {'id': 'headwear-headphones', 'name': 'Deep Focus Headphones', 'description': 'Built for distraction-free sessions.', 'kind': 'avatar', 'slot': 'headwear', 'price': 13, 'rarity': 'rare'},
    {'id': 'accessory-shield', 'name': 'Discipline Shield', 'description': 'Protect the standards you have built.', 'kind': 'avatar', 'slot': 'accessory', 'price': 13, 'rarity': 'rare'},
    {'id': 'backdrop-sunrise', 'name': 'Sunrise Protocol', 'description': 'A bright gradient for momentum.', 'kind': 'avatar', 'slot': 'backdrop', 'price': 13, 'rarity': 'rare'},
    {'id': 'accessory-lightning', 'name': 'Attack Lightning', 'description': 'Show that you move toward your goals.', 'kind': 'avatar', 'slot': 'accessory', 'price': 21, 'rarity': 'epic'},
    {'id': 'companion-mind', 'name': 'Mind Orb', 'description': 'A small focus companion beside your avatar.', 'kind': 'avatar', 'slot': 'companion', 'price': 21, 'rarity': 'epic'},
    {'id': 'headwear-crown', 'name': 'Consistency Crown', 'description': 'A crown earned through patient repetition.', 'kind': 'avatar', 'slot': 'headwear', 'price': 34, 'rarity': 'legendary'},
    {'id': 'backdrop-nebula', 'name': 'Protocol Nebula', 'description': 'A premium cosmic IP backdrop.', 'kind': 'avatar', 'slot': 'backdrop', 'price': 34, 'rarity': 'legendary'},
    {'id': 'companion-triad', 'name': 'Mind Heart Gut Triad', 'description': 'Three orbiting protocol companions.', 'kind': 'avatar', 'slot': 'companion', 'price': 55, 'rarity': 'legendary'},
    {'id': 'feature-pomodoro', 'toolId': 'pomodoro', 'name': 'Protocol Focus Timer', 'description': 'Custom Pomodoro rounds with guided focus and recovery intervals.', 'kind': 'feature', 'slot': 'feature', 'price': 34, 'rarity': 'rare'},
    {'id': 'feature-meditation', 'toolId': 'meditation', 'name': 'Guided Meditation', 'description': 'Immersive school-safe guided sessions with breathing visuals and music.', 'kind': 'feature', 'slot': 'feature', 'price': 55, 'rarity': 'epic'},
    {'id': 'feature-study-planner-pro', 'toolId': 'study-planner', 'name': 'Study Planner Pro', 'description': 'AI revision plans, exam checkpoints and realistic weekly study blocks.', 'kind': 'feature', 'slot': 'feature', 'price': 89, 'rarity': 'epic'},
    {'id': 'feature-ai-fitness-coach', 'toolId': 'fitness-coach', 'name': 'AI Fitness Coach', 'description': 'Age-appropriate movement plans based on goals, time and available equipment.', 'kind': 'feature', 'slot': 'feature', 'price': 144, 'rarity': 'legendary'},
    {'id': 'feature-gcse-spanish-tutor', 'toolId': 'spanish-tutor', 'name': 'GCSE Spanish Tutor', 'description': 'Interactive Spanish practice across topics, tenses and irregular verbs.', 'kind': 'feature', 'slot': 'feature', 'price': 89, 'rarity': 'epic'},
    {'id': 'feature-gcse-french-tutor', 'toolId': 'french-tutor', 'name': 'GCSE French Tutor', 'description': 'Interactive French practice across topics, tenses and irregular verbs.', 'kind': 'feature', 'slot': 'feature', 'price': 89, 'rarity': 'epic'},
    {'id': 'feature-focus-soundscapes', 'toolId': 'soundscapes', 'name': 'Focus Soundscapes', 'description': 'Adaptive audio for deep work sessions.', 'kind': 'feature', 'slot': 'feature', 'price': 55, 'rarity': 'future', 'comingSoon': True},
)

FOOTBALL_IP_SHOP_CATALOG = (
    {'id': 'outfit-ip-home-kit', 'name': 'IP Home Kit', 'description': 'The signature violet and cyan Inner Performance football top.', 'kind': 'avatar', 'slot': 'outfitStyle', 'price': 13, 'rarity': 'rare'},
    {'id': 'outfit-ip-away-kit', 'name': 'IP Away Kit', 'description': 'A clean ice-white away strip with IP performance detailing.', 'kind': 'avatar', 'slot': 'outfitStyle', 'price': 21, 'rarity': 'epic'},
    {'id': 'outfit-goalkeeper-kit', 'name': 'Goalkeeper Kit', 'description': 'A bold emerald goalkeeper strip for players who own the box.', 'kind': 'avatar', 'slot': 'outfitStyle', 'price': 34, 'rarity': 'legendary'},
    {'id': 'accessory-captain-armband', 'name': "Captain's Armband", 'description': 'Show leadership, standards and responsibility on your avatar.', 'kind': 'avatar', 'slot': 'accessory', 'price': 13, 'rarity': 'rare'},
    {'id': 'accessory-match-ball', 'name': 'IP Match Ball', 'description': 'A match-ready IP football beside your player avatar.', 'kind': 'avatar', 'slot': 'accessory', 'price': 21, 'rarity': 'epic'},
    {'id': 'backdrop-floodlights', 'name': 'Floodlit Pitch', 'description': 'Put your player under the lights on a night-match pitch.', 'kind': 'avatar', 'slot': 'backdrop', 'price': 21, 'rarity': 'epic'},
    {'id': 'backdrop-stadium-tunnel', 'name': 'Stadium Tunnel', 'description': 'A premium matchday tunnel backdrop before the walkout.', 'kind': 'avatar', 'slot': 'backdrop', 'price': 34, 'rarity': 'legendary'},
    {'id': 'companion-football', 'name': 'Orbit Football', 'description': 'A mini IP football that travels with your player avatar.', 'kind': 'avatar', 'slot': 'companion', 'price': 34, 'rarity': 'legendary'},
    {'id': 'feature-pre-match-visualiser', 'toolId': 'pre-match-visualiser', 'name': 'Pre-Match Visualiser', 'description': 'Build a calm, confident matchday routine with guided visualisation.', 'kind': 'feature', 'slot': 'feature', 'price': 55, 'rarity': 'future', 'comingSoon': True},
    {'id': 'feature-recovery-room', 'toolId': 'recovery-room', 'name': 'Recovery Room', 'description': 'Log soreness, energy and sleep to receive a simple recovery focus.', 'kind': 'feature', 'slot': 'feature', 'price': 55, 'rarity': 'future', 'comingSoon': True},
    {'id': 'feature-match-review', 'toolId': 'match-review', 'name': 'Match Review Journal', 'description': 'Reflect on decisions, confidence and key moments after each match.', 'kind': 'feature', 'slot': 'feature', 'price': 89, 'rarity': 'future', 'comingSoon': True},
    {'id': 'feature-solo-session-builder', 'toolId': 'solo-session-builder', 'name': 'Solo Session Builder', 'description': 'Create technical ball-work sessions around your position and available space.', 'kind': 'feature', 'slot': 'feature', 'price': 89, 'rarity': 'future', 'comingSoon': True},
)

FOOTBALL_SHARED_SHOP_ITEM_IDS = {
    'aura-pulse',
    'backdrop-midnight',
    'headwear-focus-band',
    'aura-sunrise',
    'headwear-headphones',
    'accessory-shield',
    'backdrop-sunrise',
    'accessory-lightning',
    'companion-mind',
    'headwear-crown',
    'backdrop-nebula',
    'companion-triad',
    'feature-pomodoro',
    'feature-meditation',
    'feature-ai-fitness-coach',
    'feature-focus-soundscapes',
}


def _ip_shop_catalog_for_group(group):
    group_type = getattr(group, 'group_type', 'school')
    if group_type == 'staff':
        return tuple(item for item in IP_SHOP_CATALOG if item['kind'] == 'avatar')
    if group_type != 'football':
        return IP_SHOP_CATALOG
    shared_items = []
    for item in IP_SHOP_CATALOG:
        if item['id'] not in FOOTBALL_SHARED_SHOP_ITEM_IDS:
            continue
        football_item = dict(item)
        if item['id'] == 'feature-ai-fitness-coach':
            football_item.update({
                'name': 'AI Personal Trainer',
                'description': 'Build safe football-focused strength, speed, mobility and conditioning sessions.',
            })
        elif item['id'] == 'feature-meditation':
            football_item.update({
                'name': 'Matchday Mindset Sessions',
                'description': 'Guided focus, confidence and recovery sessions for training and matchdays.',
            })
        elif item['id'] == 'feature-pomodoro':
            football_item.update({
                'name': 'Performance Focus Timer',
                'description': 'Focused work and recovery rounds for analysis, study or individual practice.',
            })
        shared_items.append(football_item)
    return tuple(shared_items) + FOOTBALL_IP_SHOP_CATALOG


def _ip_bucks_for_streak(streak_length):
    try:
        streak_length = int(streak_length)
    except (TypeError, ValueError):
        return 0
    if streak_length < 2:
        return 0
    reward, next_reward = 1, 2
    for _ in range(streak_length - 2):
        reward, next_reward = next_reward, reward + next_reward
    return min(reward, IP_BUCKS_FIBONACCI_CAP)


def _ip_bucks_streak_restore_cost(streak_length):
    try:
        streak_length = int(streak_length)
    except (TypeError, ValueError):
        return 0
    if streak_length < 1:
        return 0
    return max(1, _ip_bucks_for_streak(streak_length + 1))


def _habit_full_streak_before_date(habit, target_date, minimum_date=None):
    cursor = target_date - timedelta(days=1)
    streak = 0
    scanned_days = 0
    while scanned_days < 3660 and (minimum_date is None or cursor >= minimum_date):
        if _habit_is_scheduled_on(habit, cursor):
            progress_entry = _habit_progress_for_date(habit, cursor)
            if habit_progress_fraction(habit, progress_entry) >= 1:
                streak += 1
            elif (progress_entry or {}).get('streakRestored'):
                pass
            else:
                break
        cursor -= timedelta(days=1)
        scanned_days += 1
    return streak


def _habit_streak_restore_quote(challenge, member_habit, habit, habit_index, target_date, completion_access):
    progress_entry = _habit_progress_for_date(habit, target_date)
    at_risk_streak = _habit_full_streak_before_date(
        habit,
        target_date,
        minimum_date=effective_challenge_start(challenge, member_habit),
    )
    already_restored = bool((progress_entry or {}).get('streakRestored'))
    progress_fraction = habit_progress_fraction(habit, progress_entry)
    is_closed = completion_access.get('status') == 'closed'
    has_eligible_window = int(completion_access.get('eligibleOccurrenceCount') or 0) > 0
    eligible = bool(
        is_closed
        and has_eligible_window
        and progress_fraction < 1
        and at_risk_streak > 0
        and not already_restored
    )
    return {
        'eligible': eligible,
        'alreadyRestored': already_restored,
        'atRiskStreak': at_risk_streak,
        'cost': _ip_bucks_streak_restore_cost(at_risk_streak),
        'habitIndex': habit_index,
        'date': target_date.isoformat(),
        'progressPercent': round(progress_fraction * 100, 1),
    }


def _habit_streak_awards_for_challenge(challenge, member_habit, student_id, today_value, group=None):
    statistics = (
        _build_group_member_habit_statistics(
            group,
            challenge,
            member_habit,
            student_id,
            today_value=today_value,
        )
        if group is not None
        else build_member_habit_statistics(challenge, member_habit, today_value=today_value)
    )
    awards = []
    challenge_id = getattr(challenge, 'id', None)
    group_id = getattr(challenge, 'group_id', None)
    reference_prefix = 'habit-streak:staff:v1' if isinstance(challenge, StaffPersonalChallenge) else 'habit-streak:v1'
    for habit in statistics['habits']:
        streak = 0
        for row in habit['dailyData']:
            if row['status'] == 'complete':
                streak += 1
                amount = _ip_bucks_for_streak(streak)
                if amount:
                    awards.append({
                        'referenceKey': f"{reference_prefix}:g{group_id}:c{challenge_id}:s{student_id}:h{habit['index']}:d{row['date']}",
                        'amount': amount,
                        'date': row['date'],
                        'streak': streak,
                        'habitIndex': habit['index'],
                        'habitName': habit['name'],
                        'challengeId': challenge_id,
                    })
            elif row.get('streakRestored'):
                continue
            elif row['status'] != 'pending':
                streak = 0
    return awards


def _get_or_create_ip_wallet(student_id):
    wallet = StudentIpWallet.query.filter_by(student_id=student_id).with_for_update().first()
    if not wallet:
        wallet = StudentIpWallet(student_id=student_id, balance=0, lifetime_earned=0, lifetime_spent=0)
        db.session.add(wallet)
        db.session.flush()
    return wallet


def _sync_student_ip_bucks(group, student_id, today_value=None):
    today_value = today_value or datetime.now(_student_timezone(group, student_id)[1]).date()
    wallet = _get_or_create_ip_wallet(student_id)
    if getattr(group, 'group_type', 'school') == 'staff':
        challenges = StaffPersonalChallenge.query.filter_by(
            group_id=group.id,
            member_id=student_id,
        ).order_by(StaffPersonalChallenge.start_date.asc()).all()
    else:
        challenges = GroupChallenge.query.filter_by(group_id=group.id).order_by(GroupChallenge.start_date.asc()).all()
    expected_awards = []
    for challenge in challenges:
        member_habit = (
            _staff_challenge_member_entry(challenge)
            if isinstance(challenge, StaffPersonalChallenge)
            else next((entry for entry in (challenge.member_habits or []) if str((entry.get('member') or {}).get('id') if isinstance(entry.get('member'), dict) else entry.get('member')) == str(student_id)), None)
        )
        if not member_habit:
            continue
        challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
        stats_date = min(today_value, challenge_end) if challenge_end else today_value
        expected_awards.extend(_habit_streak_awards_for_challenge(
            challenge,
            member_habit,
            student_id,
            stats_date,
            group=group,
        ))

    existing_transactions = {
        row.reference_key: row
        for row in StudentIpTransaction.query.filter_by(wallet_id=wallet.id, kind='habit_streak').all()
    }
    credited = []
    for award in expected_awards:
        existing_transaction = existing_transactions.get(award['referenceKey'])
        if existing_transaction:
            corrected_amount = int(award['amount'])
            previous_amount = int(existing_transaction.amount or 0)
            if corrected_amount <= previous_amount:
                continue
            adjustment = corrected_amount - previous_amount
            existing_transaction.amount = corrected_amount
            existing_transaction.description = f"{award['habitName']} reached a {award['streak']}-occasion full streak"
            existing_transaction.details = {
                **(existing_transaction.details or {}),
                'habitIndex': award['habitIndex'],
                'habitName': award['habitName'],
                'streak': award['streak'],
                'completionDate': award['date'],
                'challengeId': award['challengeId'],
                'rewardAdjusted': True,
            }
            wallet.balance = (wallet.balance or 0) + adjustment
            wallet.lifetime_earned = (wallet.lifetime_earned or 0) + adjustment
            wallet.updated_at = datetime.utcnow()
            credited.append({**award, 'amount': adjustment, 'rewardAdjusted': True})
            continue
        db.session.add(StudentIpTransaction(
            wallet_id=wallet.id,
            group_id=group.id,
            amount=award['amount'],
            kind='habit_streak',
            reference_key=award['referenceKey'],
            description=f"{award['habitName']} reached a {award['streak']}-occasion full streak",
            details={
                'habitIndex': award['habitIndex'],
                'habitName': award['habitName'],
                'streak': award['streak'],
                'completionDate': award['date'],
                'challengeId': award['challengeId'],
            },
        ))
        wallet.balance = (wallet.balance or 0) + award['amount']
        wallet.lifetime_earned = (wallet.lifetime_earned or 0) + award['amount']
        wallet.updated_at = datetime.utcnow()
        credited.append(award)
    if credited:
        db.session.flush()
    return wallet, credited


@groups_bp.route('/ip-wallet', methods=['GET'])
@jwt_required()
def current_user_ip_wallet():
    try:
        current_user_id = int(get_jwt_identity())
        credited_total = 0
        eligible_groups = [
            group for group in Group.query.all()
            if is_planner_member(group, current_user_id)
        ]
        wallet = None
        for group in eligible_groups:
            wallet, credited = _sync_student_ip_bucks(group, current_user_id)
            credited_total += sum(int(item.get('amount') or 0) for item in credited)
        if wallet is None:
            wallet = _get_or_create_ip_wallet(current_user_id)
        db.session.commit()
        return jsonify({
            'wallet': wallet.to_dict(),
            'newEarnings': credited_total,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def _normalize_ip_avatar(raw_avatar, owned_item_ids, catalog=None):
    raw_avatar = raw_avatar if isinstance(raw_avatar, dict) else {}
    avatar = dict(IP_AVATAR_DEFAULTS)
    catalog = catalog or IP_SHOP_CATALOG
    free_choice_fields = {
        'coreColor': 'coreColors',
        'skinTone': 'skinTones',
        'faceShape': 'faceShapes',
        'eyeColor': 'eyeColors',
        'eyebrowStyle': 'eyebrowStyles',
        'facialHairStyle': 'facialHairStyles',
        'glassesStyle': 'glassesStyles',
        'bodyStyle': 'bodyStyles',
        'hairStyle': 'hairStyles',
        'hairColor': 'hairColors',
        'outfitStyle': 'outfitStyles',
        'pose': 'poses',
        'expression': 'expressions',
    }
    for field, choices_key in free_choice_fields.items():
        valid_values = {item['id'] for item in IP_AVATAR_FREE_CHOICES[choices_key]}
        if raw_avatar.get(field) in valid_values:
            avatar[field] = raw_avatar[field]

    catalog_map = {item['id']: item for item in catalog if item['kind'] == 'avatar'}
    for slot in ('outfitStyle', 'aura', 'headwear', 'accessory', 'backdrop', 'companion'):
        requested = str(raw_avatar.get(slot) or IP_AVATAR_DEFAULTS[slot])
        if requested == IP_AVATAR_DEFAULTS[slot]:
            avatar[slot] = requested
            continue
        if slot == 'outfitStyle' and requested in {
            item['id'] for item in IP_AVATAR_FREE_CHOICES['outfitStyles']
        }:
            avatar[slot] = requested
            continue
        item = catalog_map.get(requested)
        if item and item['slot'] == slot and requested in owned_item_ids:
            avatar[slot] = requested
    return avatar


def _build_ip_economy(group, student_id, settings, habit_momentum, read_only=False):
    if read_only:
        wallet = StudentIpWallet.query.filter_by(student_id=student_id).first()
        credited = []
    else:
        wallet, credited = _sync_student_ip_bucks(group, student_id)
    purchases = StudentIpPurchase.query.filter_by(wallet_id=wallet.id).order_by(StudentIpPurchase.purchased_at.desc()).all() if wallet else []
    owned_item_ids = {purchase.item_id for purchase in purchases}
    preferences = (settings.reward_preferences if settings else None) or {}
    catalog = _ip_shop_catalog_for_group(group)
    avatar = _normalize_ip_avatar(preferences.get('avatar'), owned_item_ids, catalog)
    shop = [{
        **item,
        'owned': item['id'] in owned_item_ids,
        'equipped': item.get('slot') != 'feature' and avatar.get(item.get('slot')) == item['id'],
        'purchasable': not item.get('comingSoon', False),
    } for item in catalog]
    activity = StudentIpTransaction.query.filter_by(wallet_id=wallet.id).order_by(StudentIpTransaction.created_at.desc()).limit(16).all() if wallet else []
    return {
        'wallet': wallet.to_dict() if wallet else {'balance': 0, 'lifetimeEarned': 0, 'lifetimeSpent': 0},
        'newEarnings': sum(item['amount'] for item in credited),
        'avatar': avatar,
        'avatarChoices': IP_AVATAR_FREE_CHOICES,
        'shop': shop,
        'purchases': [purchase.to_dict() for purchase in purchases],
        'activity': [transaction.to_dict() for transaction in activity],
        'habitMomentum': habit_momentum,
        'fibonacci': {
            'ladder': [{'streak': streak, 'reward': _ip_bucks_for_streak(streak)} for streak in range(2, 11)],
            'startsAt': 2,
            'awardCap': IP_BUCKS_FIBONACCI_CAP,
            'rule': 'A habit must reach 100% on consecutive scheduled occasions. The first completion starts the streak; rewards begin on the second.',
        },
        'entitlements': [purchase.item_id for purchase in purchases if purchase.item_type == 'feature'],
    }


def _student_reward_metrics(group, student_id, today_value=None, impact_records=None, recovered_today=None):
    today_value = today_value or datetime.now(_student_timezone(group, student_id)[1]).date()
    if getattr(group, 'group_type', 'school') == 'staff':
        challenge = StaffPersonalChallenge.query.filter_by(
            group_id=group.id,
            member_id=student_id,
            status='active',
        ).order_by(StaffPersonalChallenge.created_at.desc()).first()
        member_habit = _staff_challenge_member_entry(challenge) if challenge else None
    else:
        member_habit = get_member_habit_entry(group, student_id)
        challenge = group.active_challenge
    successful_dates = set()
    bounceback_dates = set()
    total_completions = 0.0
    longest_streak = 0
    habit_momentum = []

    if member_habit and challenge:
        statistics = _build_group_member_habit_statistics(
            group,
            challenge,
            member_habit,
            student_id,
            today_value=today_value,
        )
        total_completions = statistics['summary']['earnedUnits']
        successful_dates = {
            datetime.fromisoformat(row['date']).date()
            for row in statistics['daily']
            if row['completionRate'] > 0
        }
        for habit in statistics['habits']:
            longest_streak = max(longest_streak, habit['longestFullStreak'])
            next_streak = max(2, habit['currentFullStreak'] + 1)
            habit_momentum.append({
                'habitIndex': habit['index'],
                'habitName': habit['name'],
                'currentStreak': habit['currentFullStreak'],
                'nextStreak': next_streak,
                'nextReward': _ip_bucks_for_streak(next_streak),
            })
            has_progress = False
            missed_since_progress = False
            for row in habit['dailyData']:
                target_date = datetime.fromisoformat(row['date']).date()
                if row['progressFraction'] > 0:
                    if has_progress and missed_since_progress:
                        bounceback_dates.add(target_date)
                    has_progress = True
                    missed_since_progress = False
                elif target_date < today_value:
                    if has_progress:
                        missed_since_progress = True

    if impact_records is None and getattr(group, 'group_type', 'school') == 'school':
        impact_records = SchoolImpactRecord.query.filter_by(
            group_id=group.id,
            student_id=student_id,
        ).order_by(SchoolImpactRecord.week_ending.asc()).all()
    weekly_scores = [
        (record.positive_points or 0)
        - (record.negative_points or 0)
        - ((record.truancy_incidents or 0) * 2)
        for record in impact_records or []
    ]
    improvement_steps = sum(
        1 for index in range(1, len(weekly_scores))
        if weekly_scores[index] > weekly_scores[index - 1]
    )

    if recovered_today is None and getattr(group, 'group_type', 'school') == 'school':
        recovered_today = build_daily_points_summary(group, student_id).get('status') == 'recovered'
    if recovered_today:
        bounceback_dates.add(today_value)

    successful_days = len(successful_dates)
    bouncebacks = len(bounceback_dates)
    growth_score = round(successful_days + (bouncebacks * 3) + (improvement_steps * 3) + min(longest_streak, 10), 2)
    return {
        'successfulDays': successful_days,
        'totalCompletions': round(total_completions, 2),
        'longestStreak': longest_streak,
        'bouncebacks': bouncebacks,
        'improvementSteps': improvement_steps,
        'growthScore': growth_score,
        'habitMomentum': habit_momentum,
    }


def _student_reward_catalog(metrics, group_type='school'):
    def successful_days_reward(reward_id, name, description, target):
        value = metrics['successfulDays']
        return {
            'id': reward_id,
            'name': name,
            'description': description,
            'unlocked': value >= target,
            'unlockText': f'Show up on {target} different days',
            'progress': min(value, target),
            'target': target,
        }

    def metric_reward(reward_id, name, description, metric_key, target, unlock_text):
        value = metrics[metric_key]
        return {
            'id': reward_id,
            'name': name,
            'description': description,
            'unlocked': value >= target,
            'unlockText': unlock_text,
            'progress': min(value, target),
            'target': target,
        }

    themes = [
        {
            'id': 'ip-classic',
            'name': 'IP Classic',
            'description': 'The original violet and cyan Inner Performance look.',
            'unlocked': True,
            'unlockText': 'Unlocked from the start',
            'progress': 1,
            'target': 1,
        },
        successful_days_reward('focus-blue', 'Focus Blue', 'A calm blue workspace for focused days.', 2),
        metric_reward('growth-green', 'Growth Green', 'A fresh green theme earned by getting back on track.', 'bouncebacks', 1, 'Complete a habit after a missed scheduled day'),
        successful_days_reward('momentum-violet', 'Momentum Violet', 'A deeper violet theme for sustained momentum.', 7),
        {
            'id': 'sunrise-gold',
            'name': 'Sunrise Gold',
            'description': 'A warm gold theme for consistency or clear improvement.',
            'unlocked': metrics['longestStreak'] >= 7 or metrics['improvementSteps'] >= 2,
            'unlockText': 'Reach a 7-day scheduled streak or improve twice',
            'progress': max(min(metrics['longestStreak'], 7) / 7, min(metrics['improvementSteps'], 2) / 2),
            'target': 1,
        },
    ]
    titles = [
        {
            'id': 'steady-starter',
            'name': 'Steady Starter',
            'description': 'Ready to begin and build at your own pace.',
            'unlocked': True,
            'unlockText': 'Unlocked from the start',
            'progress': 1,
            'target': 1,
        },
        successful_days_reward('first-step', 'First Step', 'You showed up and completed something meaningful.', 1),
        successful_days_reward('momentum-maker', 'Momentum Maker', 'You are building progress across different days.', 5),
        metric_reward('comeback-builder', 'Comeback Builder', 'You returned after a difficult or missed day.', 'bouncebacks', 1, 'Complete a habit after a missed scheduled day'),
        metric_reward('consistency-crafter', 'Consistency Crafter', 'You protected a five-day scheduled streak.', 'longestStreak', 5, 'Reach a 5-day scheduled streak'),
        (
            metric_reward('training-standard', 'Training Standard', 'You protected a high standard across eight scheduled occasions.', 'longestStreak', 8, 'Reach an 8-occasion scheduled streak')
            if group_type == 'football'
            else metric_reward('growth-navigator', 'Growth Navigator', 'Your school impact improved more than once.', 'improvementSteps', 2, 'Improve your impact score twice')
        ),
    ]
    return {'themes': themes, 'titles': titles}


def _build_student_rewards(group, student_id, settings=None, read_only=False):
    metrics = _student_reward_metrics(group, student_id)
    catalog = _student_reward_catalog(metrics, getattr(group, 'group_type', 'school'))
    preferences = (settings.reward_preferences if settings else None) or {}
    unlocked_theme_ids = {item['id'] for item in catalog['themes'] if item['unlocked']}
    unlocked_title_ids = {item['id'] for item in catalog['titles'] if item['unlocked']}
    selected_theme_id = preferences.get('selectedThemeId')
    selected_title_id = preferences.get('selectedTitleId')
    if selected_theme_id not in unlocked_theme_ids:
        selected_theme_id = 'ip-classic'
    if selected_title_id not in unlocked_title_ids:
        selected_title_id = 'steady-starter'
    locked_rewards = [
        {**item, 'kind': kind}
        for kind in ('themes', 'titles')
        for item in catalog[kind]
        if not item['unlocked']
    ]
    locked_rewards.sort(
        key=lambda item: -(float(item['progress']) / max(float(item['target']), 1))
    )
    economy = _build_ip_economy(group, student_id, settings, metrics.get('habitMomentum') or [], read_only=read_only)
    return {
        'metrics': metrics,
        'preferences': {
            'selectedThemeId': selected_theme_id,
            'selectedTitleId': selected_title_id,
        },
        'themes': catalog['themes'],
        'titles': catalog['titles'],
        'earnedCount': len(unlocked_theme_ids) + len(unlocked_title_ids),
        'totalCount': len(catalog['themes']) + len(catalog['titles']),
        'nextUnlock': locked_rewards[0] if locked_rewards else None,
        'economy': economy,
    }


def _get_student_planner_settings(group_id, student_id, create=False):
    settings = StudentPlannerSettings.query.filter_by(group_id=group_id, student_id=student_id).first()
    if not settings and create:
        settings = StudentPlannerSettings(group_id=group_id, student_id=student_id)
        db.session.add(settings)
    return settings


def _group_school_timezone(group):
    configured_timezone = (group.school_day_config or {}).get('timezone')
    fallback_timezone = os.getenv('SCHOOL_TIMEZONE', DEFAULT_SCHOOL_TIMEZONE)
    return resolve_timezone(configured_timezone or fallback_timezone)


def _student_timezone(group, student_id, settings=None):
    settings = settings if settings is not None else _get_student_planner_settings(group.id, student_id)
    timezone_name = getattr(settings, 'timezone_name', None) if settings else None
    if timezone_name:
        return resolve_timezone(timezone_name)
    return _group_school_timezone(group)


def _habit_is_scheduled_on(habit, target_date):
    schedule_days = habit.get('scheduleDays') or []
    return not schedule_days or target_date.strftime('%A') in schedule_days


def _habit_progress_for_date(habit, target_date):
    target_key = target_date.isoformat()
    return next(
        (entry for entry in (habit.get('progress') or []) if str(entry.get('date') or '')[:10] == target_key),
        None,
    )


def _habit_correction_snapshot(habit, progress_entry):
    progress_entry = progress_entry or {}
    habit_type = habit.get('habitType') or 'boolean'
    snapshot = {
        'habitType': habit_type,
        'completed': bool(progress_entry.get('completed')),
        'progressPercent': round(habit_progress_fraction(habit, progress_entry) * 100, 1),
    }
    if habit_type == 'numeric':
        snapshot['numericValue'] = progress_entry.get('numericValue')
    elif habit_type == 'text':
        snapshot['textValue'] = progress_entry.get('textValue') or ''
    elif habit_type == 'periodic':
        completed, target = periodic_progress_counts(habit, progress_entry)
        snapshot.update({'periodicCompleted': completed, 'periodicTarget': target})
    return snapshot


def _apply_admin_habit_correction(
    habit,
    progress_entry,
    data,
    periodic_target_override=None,
    periodic_max_completed=None,
):
    habit_type = habit.get('habitType') or 'boolean'
    if habit_type == 'numeric':
        try:
            numeric_value = float(data.get('numericValue'))
        except (TypeError, ValueError):
            raise ValueError('A numeric result is required for this habit')
        if not math.isfinite(numeric_value):
            raise ValueError('The numeric result must be finite')
        minimum = float(habit.get('minValue') if habit.get('minValue') is not None else 0)
        maximum = float(habit.get('maxValue') if habit.get('maxValue') is not None else 10)
        if numeric_value < minimum or numeric_value > maximum:
            raise ValueError(f'Numeric result must be between {minimum:g} and {maximum:g}')
        progress_entry['numericValue'] = int(numeric_value) if numeric_value.is_integer() else numeric_value
        progress_entry['completed'] = numeric_value >= maximum
    elif habit_type == 'text':
        if data.get('completed') is False:
            progress_entry.pop('textValue', None)
            progress_entry['completed'] = False
            progress_entry.pop('completedAt', None)
            return _habit_correction_snapshot(habit, progress_entry)
        text_value = str(data.get('textValue') or '').strip()
        if not text_value:
            raise ValueError('A verified written response is required for this habit')
        progress_entry['textValue'] = text_value[:2000]
        progress_entry['completed'] = True
    elif habit_type == 'periodic':
        target = max(1, int(periodic_target_override or habit.get('periodicOccurrences') or 4))
        raw_completed = data.get('periodicCompleted')
        if isinstance(raw_completed, bool):
            raise ValueError('Periodic progress must be a whole number')
        try:
            completed_occurrences = int(raw_completed)
        except (TypeError, ValueError):
            raise ValueError('Periodic progress must be a whole number')
        maximum_completed = min(target, int(periodic_max_completed)) if periodic_max_completed is not None else target
        if completed_occurrences < 0 or completed_occurrences > maximum_completed:
            raise ValueError(f'Periodic progress must be between 0 and {maximum_completed} for this point in the day')
        progress_entry['periodicCompleted'] = completed_occurrences
        progress_entry['periodicTarget'] = target
        progress_entry['periodicLoggedOccurrences'] = list(range(completed_occurrences))
        progress_entry['completed'] = completed_occurrences >= target
    else:
        completed = data.get('completed')
        if not isinstance(completed, bool):
            raise ValueError('Choose whether this habit was completed')
        progress_entry['completed'] = completed

    if progress_entry.get('completed'):
        progress_entry['completedAt'] = datetime.now(timezone.utc).isoformat()
    else:
        progress_entry.pop('completedAt', None)
    return _habit_correction_snapshot(habit, progress_entry)


def _completion_schedule_items(group, student_id, target_date, habit, habit_index, plan=None, settings=None):
    if plan is None:
        plan = StudentSchedulePlan.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            plan_date=target_date,
        ).first()
    source_items = list(plan.items or []) if plan and plan.items else []
    if not source_items:
        settings = settings if settings is not None else _get_student_planner_settings(group.id, student_id)
        weekday = target_date.strftime('%A')
        source_items = list(((settings.ai_weekly_templates or {}).get(weekday) or [])) if settings else []
    return normalize_habit_schedule_items(source_items, habit, habit_index)


def _challenge_activation_at(challenge, member_habit, member_timezone):
    if not challenge:
        return None
    challenge_start = getattr(challenge, 'start_date', None)
    if isinstance(challenge_start, datetime):
        challenge_start_date = challenge_start.date()
    elif isinstance(challenge_start, date):
        challenge_start_date = challenge_start
    else:
        try:
            challenge_start_date = datetime.fromisoformat(str(challenge_start).replace('Z', '+00:00')).date()
        except (TypeError, ValueError):
            return None
    candidates = [datetime.combine(challenge_start_date, datetime.min.time(), tzinfo=member_timezone)]

    created_at = getattr(challenge, 'created_at', None)
    if created_at:
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except ValueError:
                created_at = None
        if isinstance(created_at, datetime):
            created_at = created_at.replace(tzinfo=timezone.utc) if created_at.tzinfo is None else created_at
            candidates.append(created_at.astimezone(member_timezone))

    joined_at = (member_habit or {}).get('activationAt') or (member_habit or {}).get('joinedAt')
    if joined_at:
        joined_text = str(joined_at).strip()
        try:
            if len(joined_text) <= 10:
                joined_value = datetime.combine(
                    datetime.fromisoformat(joined_text[:10]).date(),
                    datetime.min.time(),
                    tzinfo=member_timezone,
                )
            else:
                joined_value = datetime.fromisoformat(joined_text.replace('Z', '+00:00'))
                if joined_value.tzinfo is None:
                    joined_value = joined_value.replace(tzinfo=timezone.utc)
                joined_value = joined_value.astimezone(member_timezone)
            candidates.append(joined_value)
        except (TypeError, ValueError):
            pass
    return max(candidates)


def _first_day_habit_eligibility(group, challenge, member_habit, student_id):
    exact_activation = (member_habit or {}).get('activationAt') or getattr(challenge, 'created_at', None)
    if not exact_activation:
        return None
    timezone_name, member_timezone = _student_timezone(group, student_id)
    activation_at = _challenge_activation_at(challenge, member_habit, member_timezone)
    if not activation_at:
        return None
    activation_date = activation_at.date()
    settings = _get_student_planner_settings(group.id, student_id)
    plan = StudentSchedulePlan.query.filter_by(
        group_id=group.id,
        student_id=student_id,
        plan_date=activation_date,
    ).first()

    habits = {}
    for habit_index, habit in enumerate((member_habit or {}).get('habits') or []):
        if not _habit_is_scheduled_on(habit, activation_date):
            continue
        schedule_items = _completion_schedule_items(
            group,
            student_id,
            activation_date,
            habit,
            habit_index,
            plan=plan,
            settings=settings,
        )
        access = build_completion_window_access(
            activation_date,
            schedule_items,
            activation_at,
            timezone_name=timezone_name,
            periodic=habit.get('habitType') == 'periodic',
            eligible_after=activation_at,
        )
        habits[str(habit_index)] = {
            'eligibleOccurrenceCount': access.get('eligibleOccurrenceCount', len(schedule_items)),
            'eligibleOccurrenceIndexes': access.get('eligibleOccurrenceIndexes', []),
            'scheduledOccurrenceCount': len(schedule_items),
        }
    return {
        'date': activation_date.isoformat(),
        'activationAt': activation_at.isoformat(),
        'timezone': timezone_name,
        'habits': habits,
    }


def _build_group_member_habit_statistics(
    group,
    challenge,
    member_habit,
    student_id,
    today_value=None,
    goal_titles=None,
):
    return build_member_habit_statistics(
        challenge,
        member_habit,
        today_value=today_value,
        goal_titles=goal_titles,
        first_day_eligibility=_first_day_habit_eligibility(
            group,
            challenge,
            member_habit,
            student_id,
        ),
    )


def _habit_completion_access(
    group,
    student_id,
    habit,
    habit_index,
    now=None,
    preferred_date=None,
    plan=None,
    settings=None,
    challenge=None,
    member_habit=None,
):
    settings = settings if settings is not None else _get_student_planner_settings(group.id, student_id)
    timezone_name, school_timezone = _student_timezone(group, student_id, settings)
    current_time = now or datetime.now(school_timezone)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=school_timezone)
    else:
        current_time = current_time.astimezone(school_timezone)
    if challenge is None and member_habit is None:
        challenge, member_habit = _planner_challenge_context(group, student_id)
    activation_at = _challenge_activation_at(challenge, member_habit, school_timezone)
    target_dates = [preferred_date] if preferred_date else [current_time.date(), current_time.date() - timedelta(days=1)]
    accesses = []

    for target_date in target_dates:
        if not _habit_is_scheduled_on(habit, target_date):
            continue
        target_plan = plan if plan and plan.plan_date == target_date else None
        schedule_items = _completion_schedule_items(
            group,
            student_id,
            target_date,
            habit,
            habit_index,
            plan=target_plan,
            settings=settings,
        )
        progress_entry = _habit_progress_for_date(habit, target_date)
        periodic = habit.get('habitType') == 'periodic'
        logged_occurrences = list((progress_entry or {}).get('periodicLoggedOccurrences') or [])
        if periodic and not logged_occurrences:
            legacy_count = max(0, int((progress_entry or {}).get('periodicCompleted') or 0))
            logged_occurrences = list(range(min(legacy_count, len(schedule_items))))
        access = build_completion_window_access(
            target_date,
            schedule_items,
            current_time,
            timezone_name=timezone_name,
            completed=bool((progress_entry or {}).get('completed')),
            periodic=periodic,
            logged_occurrence_indexes=logged_occurrences,
            eligible_after=activation_at,
        )
        access['challengeActivationAt'] = activation_at.isoformat() if activation_at else None
        accesses.append(access)

    active_access = next((access for access in accesses if access.get('windowOpen')), None)
    if active_access:
        return active_access
    if accesses:
        return accesses[0]
    target_date = preferred_date or current_time.date()
    return {
        'date': target_date.isoformat(),
        'timezone': timezone_name,
        'status': 'not-scheduled',
        'windowOpen': False,
        'canComplete': False,
        'activeOccurrenceIndex': None,
        'eligibleOccurrenceIndexes': [],
        'eligibleOccurrenceCount': 0,
        'exemptOccurrenceCount': 0,
        'activeWindow': None,
        'nextWindow': None,
        'windows': [],
        'challengeActivationAt': activation_at.isoformat() if activation_at else None,
    }


def _completion_window_error(access):
    if access.get('status') == 'upcoming' and access.get('nextWindow'):
        next_window = access['nextWindow']
        message = (
            f"This habit opens at {next_window['opensTime']} and can be completed until "
            f"{next_window['closesTime']}."
        )
    elif access.get('status') == 'not-scheduled':
        message = 'This habit is not scheduled for today.'
    elif access.get('status') == 'not-applicable':
        message = 'This habit happened before your challenge began and is not counted today.'
    else:
        message = 'The completion window for this habit has closed.'
    return jsonify({
        'error': message,
        'code': 'HABIT_COMPLETION_WINDOW_CLOSED',
        'completionWindow': access,
    }), 403


def _validate_same_day_habit_schedule_changes(
    group,
    student_id,
    target_date,
    proposed_source_items,
    existing_plan=None,
    existing_settings=None,
    now=None,
):
    timezone_name, school_timezone = _student_timezone(group, student_id, existing_settings)
    school_now = now or datetime.now(school_timezone)
    if school_now.tzinfo is None:
        school_now = school_now.replace(tzinfo=school_timezone)
    else:
        school_now = school_now.astimezone(school_timezone)
    if target_date < school_now.date():
        return 'Past planner days cannot be changed.'
    if target_date > school_now.date():
        return None

    challenge, member_habit = _planner_challenge_context(group, student_id)
    activation_at = _challenge_activation_at(challenge, member_habit, school_now.tzinfo)
    for habit_index, habit in enumerate((member_habit or {}).get('habits') or []):
        if not _habit_is_scheduled_on(habit, target_date):
            continue
        existing_items = _completion_schedule_items(
            group,
            student_id,
            target_date,
            habit,
            habit_index,
            plan=existing_plan,
            settings=existing_settings,
        )
        proposed_items = normalize_habit_schedule_items(proposed_source_items, habit, habit_index)
        existing_access = build_completion_window_access(
            target_date,
            existing_items,
            school_now,
            timezone_name=timezone_name,
            periodic=habit.get('habitType') == 'periodic',
            eligible_after=activation_at,
        )
        proposed_access = build_completion_window_access(
            target_date,
            proposed_items,
            school_now,
            timezone_name=timezone_name,
            periodic=habit.get('habitType') == 'periodic',
            eligible_after=activation_at,
        )
        if (
            proposed_access.get('eligibleOccurrenceCount', 0)
            < existing_access.get('eligibleOccurrenceCount', 0)
        ):
            return 'A habit cannot be moved before the challenge began to remove it from today.'
        for occurrence_index, existing_window in enumerate(existing_access.get('windows') or []):
            if existing_window.get('eligible') is False:
                continue
            existing_signature = (
                existing_window.get('startTime'),
                existing_window.get('endTime'),
            )
            proposed_signature = (
                proposed_items[occurrence_index].get('startTime'),
                proposed_items[occurrence_index].get('endTime'),
            ) if occurrence_index < len(proposed_items) else None
            window_opened_at = datetime.fromisoformat(existing_window['opensAt'])
            if proposed_signature != existing_signature and school_now >= window_opened_at:
                habit_name = str(habit.get('name') or f'Habit {habit_index + 1}')
                return (
                    f"{habit_name} can no longer be rescheduled today because its completion "
                    f"window opened at {existing_window['opensTime']}."
                )
    return None


def _google_calendar_can_list_calendars(settings):
    granted_scopes = set(str(settings.google_calendar_scopes or '').split()) if settings else set()
    return bool(granted_scopes.intersection({
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.calendarlist',
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    }))


def _planner_settings_response(settings):
    payload = settings.to_dict() if settings else {
        'wakeTime': '07:00',
        'bedtime': '22:00',
        'schoolCommuteMinutes': 0,
        'timezone': 'Europe/London',
        'recurringReminders': [],
        'aiWeeklyTemplates': {},
        'rewardPreferences': {},
        'googleCalendarConnected': False,
        'googleCalendarHiddenEventCount': 0,
    }
    payload['googleCalendarConfigured'] = bool(
        os.getenv('GOOGLE_CALENDAR_CLIENT_ID')
        and os.getenv('GOOGLE_CALENDAR_CLIENT_SECRET')
        and os.getenv('GOOGLE_CALENDAR_REDIRECT_URI')
    )
    payload['googleCalendarNeedsReconnect'] = bool(
        payload.get('googleCalendarConnected')
        and not _google_calendar_can_list_calendars(settings)
    )
    return payload


@groups_bp.route('/<group_id>/students/<int:student_id>/preview', methods=['GET'])
@jwt_required()
def preview_student_workspace(group_id, student_id):
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return jsonify({'error': 'School not found'}), 404
    viewer_id = int(get_jwt_identity())
    viewer = User.query.get(viewer_id)
    if not viewer or not viewer.is_active or viewer.account_role != 'admin' or not can_manage_group(group, viewer_id):
        return jsonify({'error': 'Only school administrators can preview student workspaces'}), 403
    student = next((member for member in get_group_members_list(group) if member.id == student_id and member.account_role == 'student'), None)
    if not student:
        return jsonify({'error': 'Student not found in this school'}), 404
    settings = _get_student_planner_settings(group.id, student_id)
    source = settings.to_dict() if settings else {}
    settings_preview = {
        'wakeTime': source.get('wakeTime') or '07:00',
        'bedtime': source.get('bedtime') or '22:00',
        'schoolCommuteMinutes': source.get('schoolCommuteMinutes') or 0,
        'timezone': source.get('timezone') or 'Europe/London',
        'recurringReminders': source.get('recurringReminders') or [],
        'aiWeeklyTemplates': source.get('aiWeeklyTemplates') or {},
        'googleCalendarConnected': False,
    }
    return jsonify({'settings': settings_preview, 'rewards': _build_student_rewards(group, student_id, settings, read_only=True)}), 200


@groups_bp.route('/<group_id>/students/<int:student_id>/planner-settings', methods=['GET', 'PUT'])
@jwt_required()
def student_planner_settings(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only manage their own planner settings'}), 403
        if not is_planner_member(group, student_id):
            return jsonify({'error': 'Account not found in workspace'}), 404

        settings = _get_student_planner_settings(group.id, student_id, create=request.method == 'PUT')
        if request.method == 'GET':
            if settings and any(
                not (reminder or {}).get('createdDate')
                for reminder in (settings.recurring_reminders or [])
            ):
                _, student_timezone = _student_timezone(group, student_id, settings)
                settings.recurring_reminders = _normalize_recurring_reminders(
                    settings.recurring_reminders,
                    default_created_date=datetime.now(student_timezone).date().isoformat(),
                )
                flag_modified(settings, 'recurring_reminders')
                settings.updated_at = datetime.utcnow()
                db.session.commit()
            return jsonify({'settings': _planner_settings_response(settings)}), 200

        data = request.get_json() or {}
        wake_time = str(data.get('wakeTime') or settings.wake_time or '07:00').strip()
        bedtime = str(data.get('bedtime') or settings.bedtime or '22:00').strip()
        if not _is_valid_planner_time(wake_time) or not _is_valid_planner_time(bedtime):
            return jsonify({'error': 'Wake time and bedtime must use HH:MM format'}), 400
        settings.wake_time = wake_time
        settings.bedtime = bedtime
        if 'schoolCommuteMinutes' in data:
            try:
                settings.school_commute_minutes = max(0, min(180, int(data.get('schoolCommuteMinutes') or 0)))
            except (TypeError, ValueError):
                return jsonify({'error': 'School commute must be a number of minutes between 0 and 180'}), 400
        if 'timezone' in data:
            requested_timezone = str(data.get('timezone') or '').strip()
            timezone_name, _ = resolve_timezone(requested_timezone)
            if not requested_timezone or timezone_name != requested_timezone:
                return jsonify({'error': 'A valid IANA device timezone is required'}), 400
            settings.timezone_name = timezone_name
        if 'recurringReminders' in data:
            _, student_timezone = _student_timezone(group, student_id, settings)
            settings.recurring_reminders = _normalize_recurring_reminders(
                data.get('recurringReminders'),
                default_created_date=datetime.now(student_timezone).date().isoformat(),
            )
            flag_modified(settings, 'recurring_reminders')
        if 'aiWeeklyTemplates' in data:
            next_templates = _normalize_ai_weekly_templates(data.get('aiWeeklyTemplates'))
            _, school_timezone = _student_timezone(group, student_id, settings)
            today_value = datetime.now(school_timezone).date()
            today_plan = StudentSchedulePlan.query.filter_by(
                group_id=group.id,
                student_id=student_id,
                plan_date=today_value,
            ).first()
            if not today_plan or not today_plan.items:
                schedule_error = _validate_same_day_habit_schedule_changes(
                    group,
                    student_id,
                    today_value,
                    next_templates.get(today_value.strftime('%A')) or [],
                    existing_plan=today_plan,
                    existing_settings=settings,
                )
                if schedule_error:
                    return jsonify({'error': schedule_error, 'code': 'HABIT_SCHEDULE_WINDOW_LOCKED'}), 403
            settings.ai_weekly_templates = next_templates
            flag_modified(settings, 'ai_weekly_templates')
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'settings': _planner_settings_response(settings)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/rewards', methods=['GET', 'PUT'])
@jwt_required()
def student_rewards(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Workspace not found'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Clients can only customise their own rewards'}), 403
        current_user = User.query.get(current_user_id)
        if not any(member.id == student_id for member in get_group_members_list(group)) and not is_staff_group_member(group, current_user):
            return jsonify({'error': 'Client not found in workspace'}), 404

        settings = _get_student_planner_settings(group.id, student_id, create=request.method == 'PUT')
        rewards = _build_student_rewards(group, student_id, settings)
        if request.method == 'GET':
            db.session.commit()
            return jsonify({'rewards': rewards}), 200

        data = request.get_json() or {}
        selected_theme_id = str(
            data.get('selectedThemeId') or rewards['preferences']['selectedThemeId']
        ).strip()
        selected_title_id = str(
            data.get('selectedTitleId') or rewards['preferences']['selectedTitleId']
        ).strip()
        unlocked_theme_ids = {item['id'] for item in rewards['themes'] if item['unlocked']}
        unlocked_title_ids = {item['id'] for item in rewards['titles'] if item['unlocked']}
        if selected_theme_id not in unlocked_theme_ids:
            return jsonify({'error': 'That theme has not been unlocked yet'}), 400
        if selected_title_id not in unlocked_title_ids:
            return jsonify({'error': 'That title has not been unlocked yet'}), 400

        current_preferences = dict(settings.reward_preferences or {})
        owned_item_ids = {
            purchase.get('itemId')
            for purchase in rewards.get('economy', {}).get('purchases', [])
        }
        requested_avatar = data.get('avatar') if 'avatar' in data else current_preferences.get('avatar')
        current_preferences.update({
            'selectedThemeId': selected_theme_id,
            'selectedTitleId': selected_title_id,
            'avatar': _normalize_ip_avatar(requested_avatar, owned_item_ids, _ip_shop_catalog_for_group(group)),
        })
        settings.reward_preferences = current_preferences
        flag_modified(settings, 'reward_preferences')
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'rewards': _build_student_rewards(group, student_id, settings)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/rewards/shop/purchase', methods=['POST'])
@jwt_required()
def purchase_student_reward(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Workspace not found'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only spend their own IP Bucks'}), 403
        current_user = User.query.get(current_user_id)
        if not any(member.id == student_id for member in get_group_members_list(group)) and not is_staff_group_member(group, current_user):
            return jsonify({'error': 'Client not found in workspace'}), 404

        data = request.get_json() or {}
        item_id = str(data.get('itemId') or '').strip()
        item = next((catalog_item for catalog_item in _ip_shop_catalog_for_group(group) if catalog_item['id'] == item_id), None)
        if not item:
            return jsonify({'error': 'Shop item not found'}), 404
        if item.get('comingSoon'):
            return jsonify({'error': 'This reward is coming soon and cannot be purchased yet'}), 409

        wallet, _ = _sync_student_ip_bucks(group, student_id)
        existing_purchase = StudentIpPurchase.query.filter_by(wallet_id=wallet.id, item_id=item_id).first()
        if existing_purchase:
            settings = _get_student_planner_settings(group.id, student_id)
            db.session.commit()
            return jsonify({'rewards': _build_student_rewards(group, student_id, settings), 'alreadyOwned': True}), 200
        price = int(item['price'])
        if (wallet.balance or 0) < price:
            return jsonify({
                'error': f"You need {price - (wallet.balance or 0)} more IP Bucks for {item['name']}",
                'balance': wallet.balance or 0,
                'price': price,
            }), 400

        wallet.balance -= price
        wallet.lifetime_spent = (wallet.lifetime_spent or 0) + price
        wallet.updated_at = datetime.utcnow()
        db.session.add(StudentIpPurchase(
            wallet_id=wallet.id,
            item_id=item['id'],
            item_type=item['kind'],
            price=price,
        ))
        db.session.add(StudentIpTransaction(
            wallet_id=wallet.id,
            group_id=group.id,
            amount=-price,
            kind='shop_purchase',
            reference_key=f"shop-purchase:v1:s{student_id}:i{item['id']}",
            description=f"Purchased {item['name']}",
            details={'itemId': item['id'], 'itemName': item['name'], 'itemType': item['kind']},
        ))
        db.session.commit()
        settings = _get_student_planner_settings(group.id, student_id)
        return jsonify({
            'message': f"{item['name']} added to your collection",
            'rewards': _build_student_rewards(group, student_id, settings),
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


STUDENT_TOOL_FEATURE_ITEMS = {
    'pomodoro': 'feature-pomodoro',
    'meditation': 'feature-meditation',
    'study-planner': 'feature-study-planner-pro',
    'fitness-coach': 'feature-ai-fitness-coach',
    'spanish-tutor': 'feature-gcse-spanish-tutor',
    'french-tutor': 'feature-gcse-french-tutor',
}
MEDITATION_MUSIC_EXTENSIONS = {'mp3', 'wav', 'm4a', 'ogg'}
MEDITATION_DEFAULT_MUSIC_FILENAME = 'ip-meditation-background-15min.mp3'


def _student_tool_media_dir():
    configured_dir = os.getenv('MEDITATION_MEDIA_DIR')
    media_dir = configured_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'meditations')
    os.makedirs(media_dir, exist_ok=True)
    return media_dir


def _default_meditation_music_filename():
    return secure_filename(os.getenv('MEDITATION_DEFAULT_MUSIC_FILENAME', MEDITATION_DEFAULT_MUSIC_FILENAME)) or MEDITATION_DEFAULT_MUSIC_FILENAME


def _default_meditation_music_path():
    return os.path.join(_student_tool_media_dir(), _default_meditation_music_filename())


def _default_meditation_music_available():
    music_path = _default_meditation_music_path()
    return os.path.isfile(music_path) and os.path.getsize(music_path) <= 15 * 1024 * 1024


def _owned_student_feature_ids(student_id):
    wallet = StudentIpWallet.query.filter_by(student_id=student_id).first()
    if not wallet:
        return set()
    return {
        purchase.item_id
        for purchase in StudentIpPurchase.query.filter_by(wallet_id=wallet.id, item_type='feature').all()
    }


def _get_or_create_student_tool_state(group_id, student_id):
    state = StudentToolState.query.filter_by(group_id=group_id, student_id=student_id).first()
    if not state:
        state = StudentToolState(group_id=group_id, student_id=student_id)
        db.session.add(state)
        db.session.flush()
    return state


def _student_tool_state_payload(state):
    payload = state.to_dict()
    study_library = normalize_study_plan_library(state.study_plan)
    payload['studyPlan'] = active_study_plan(study_library)
    payload['studyPlans'] = study_library['plans']
    payload['activeStudyPlanId'] = study_library['activePlanId']
    return payload


def _student_tutor_timezone(group, student_id, requested_timezone=None):
    candidate = str(requested_timezone or '').strip()
    if candidate:
        timezone_name, timezone_value = resolve_timezone(candidate)
        if timezone_name == candidate:
            return timezone_name, timezone_value
    return _student_timezone(group, student_id)


def _student_tutor_usage(group, state, tool_id, requested_timezone=None):
    timezone_name, timezone_value = _student_tutor_timezone(group, state.student_id, requested_timezone)
    today_key = datetime.now(timezone_value).date().isoformat()
    return build_tutor_daily_usage(state.tutor_progress, tool_id, today_key, timezone_name)


def _is_feature_lab_admin(group, user):
    return bool(user and user.account_role == 'admin' and can_manage_group(group, user.id))


def _student_tool_request_context(group_id):
    current_user_id = int(get_jwt_identity())
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return None, None, (jsonify({'error': 'Workspace not found'}), 404)
    user = User.query.get(current_user_id)
    if not user or not user.is_active or not user_can_access_group(group, current_user_id):
        return None, None, (jsonify({'error': 'Workspace access denied'}), 403)
    return group, user, None


def _student_has_tool_access(student_id, tool_id):
    feature_item_id = STUDENT_TOOL_FEATURE_ITEMS.get(tool_id)
    return bool(feature_item_id and feature_item_id in _owned_student_feature_ids(student_id))


def _can_use_performance_tools(group, user):
    return bool(user and (user.account_role == 'student' or is_staff_group_member(group, user)))


def _user_has_performance_tool_access(group, user, tool_id):
    if is_staff_group_member(group, user):
        return tool_id in STUDENT_TOOL_FEATURE_ITEMS
    return bool(user and user.account_role == 'student' and _student_has_tool_access(user.id, tool_id))


def _meditation_media_serializer():
    return URLSafeTimedSerializer(os.getenv('JWT_SECRET_KEY', 'dev-secret-key'), salt='meditation-media')


def _meditation_media_url(group, filename):
    if not filename:
        return None
    group_id = group.id if group else None
    token = _meditation_media_serializer().dumps({'groupId': group_id, 'filename': filename})
    media_path = (
        f'/api/groups/{group.group_id}/student-tools/media/{filename}'
        if group
        else f'/api/groups/global-feature-lab/media/{filename}'
    )
    return f"{request.host_url.rstrip('/')}{media_path}?token={quote(token, safe='')}"


def _serialize_meditation_session(group, session):
    payload = session.to_dict()
    alignment = session.alignment or {}
    end_times = alignment.get('character_end_times_seconds') or []
    media_group = None if payload['isGlobal'] else group
    return {
        'id': payload['id'],
        'sessionKey': payload['sessionKey'],
        'session': payload['session'],
        'narrationUrl': _meditation_media_url(media_group, payload['narrationFilename']),
        'musicUrl': _meditation_media_url(media_group, payload['musicFilename']),
        'narrationDurationSeconds': round(float(end_times[-1]), 2) if end_times else None,
        'durationEstimate': estimate_meditation_duration(payload['session']),
        'isPublished': payload['isPublished'],
        'isGlobal': payload['isGlobal'],
        'createdAt': payload['createdAt'],
    }


def _elevenlabs_break(seconds):
    seconds = max(0, min(3, float(seconds or 0)))
    return f' <break time="{seconds:.1f}s" /> ' if seconds else ' '


def _elevenlabs_meditation_audio(session_payload, group):
    api_key = os.getenv('ELEVENLABS_API_KEY')
    voice_id = os.getenv('ELEVENLABS_VOICE_ID')
    if not api_key or not voice_id:
        raise RuntimeError('ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be configured on the server.')
    narration = session_payload['narration']
    opening = narration['opening']
    closing = narration['closing']
    spoken_parts = [html.escape(opening['text'], quote=False), _elevenlabs_break(opening['pauseAfterSeconds'])]
    for segment in narration['segments']:
        spoken_parts.extend([
            _elevenlabs_break(segment['pauseBeforeSeconds']),
            html.escape(segment['text'], quote=False),
            _elevenlabs_break(segment['pauseAfterSeconds']),
        ])
    spoken_parts.extend([html.escape(closing['text'], quote=False), _elevenlabs_break(closing['pauseAfterSeconds'])])
    spoken_text = ''.join(spoken_parts)
    voice_direction = session_payload['voiceDirection']
    request_payload = {
        'text': spoken_text,
        'model_id': os.getenv('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2'),
        'voice_settings': {
            'stability': voice_direction['stability'],
            'similarity_boost': voice_direction['similarityBoost'],
            'style': voice_direction['style'],
            'use_speaker_boost': voice_direction['useSpeakerBoost'],
            'speed': voice_direction['speed'],
        },
    }
    request_url = (
        f'https://api.elevenlabs.io/v1/text-to-speech/{quote(voice_id, safe="")}/with-timestamps'
        '?output_format=mp3_44100_128'
    )
    request_obj = UrlRequest(
        request_url,
        data=json.dumps(request_payload).encode('utf-8'),
        headers={'xi-api-key': api_key, 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request_obj, timeout=120) as response:
            response_payload = json.loads(response.read().decode('utf-8'))
    except HTTPError as exc:
        error_body = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'ElevenLabs rejected the narration request: {error_body[:600]}') from exc
    except URLError as exc:
        raise RuntimeError(f'ElevenLabs could not be reached: {exc.reason}') from exc

    encoded_audio = response_payload.get('audio_base64')
    if not encoded_audio:
        raise RuntimeError('ElevenLabs returned no narration audio.')
    try:
        audio_bytes = base64.b64decode(encoded_audio, validate=True)
    except ValueError as exc:
        raise RuntimeError('ElevenLabs returned invalid audio data.') from exc
    if not audio_bytes:
        raise RuntimeError('ElevenLabs returned an empty narration file.')
    filename = f'{group.id if group else "global"}-{uuid.uuid4().hex}.mp3'
    with open(os.path.join(_student_tool_media_dir(), filename), 'wb') as audio_file:
        audio_file.write(audio_bytes)
    return filename, response_payload.get('alignment') or {}


@groups_bp.route('/<group_id>/student-tools/state', methods=['GET'])
@jwt_required()
def get_student_tool_state(group_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        if not _can_use_performance_tools(group, user):
            return jsonify({'error': 'Performance tools are unavailable for this account in this workspace'}), 403
        state = _get_or_create_student_tool_state(group.id, user.id)
        requested_timezone = request.args.get('timezone')
        staff_access = is_staff_group_member(group, user)
        owned_item_ids = (
            {item_id for item_id in STUDENT_TOOL_FEATURE_ITEMS.values()}
            if staff_access
            else _owned_student_feature_ids(user.id)
        )
        source_catalog = IP_SHOP_CATALOG if staff_access else _ip_shop_catalog_for_group(group)
        feature_catalog = [
            {
                **item,
                'owned': item['id'] in owned_item_ids,
            }
            for item in source_catalog
            if item['kind'] == 'feature'
        ]
        db.session.commit()
        return jsonify({
            'state': _student_tool_state_payload(state),
            'features': feature_catalog,
            'entitlements': sorted(owned_item_ids),
            'allToolsIncluded': staff_access,
            'aiConfigured': bool(os.getenv('OPENAI_API_KEY')),
            'tutorConfig': build_tutor_config_payload(),
            'tutorUsage': {
                tool_id: _student_tutor_usage(group, state, tool_id, requested_timezone)
                for tool_id in ('spanish-tutor', 'french-tutor')
            },
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/student-tools/study-plans', methods=['PUT'])
@jwt_required()
def save_student_study_plan(group_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        if not _can_use_performance_tools(group, user):
            return jsonify({'error': 'Study plans are unavailable for this account'}), 403
        if not _user_has_performance_tool_access(group, user, 'study-planner'):
            return jsonify({'error': 'Unlock Study Planner Pro in the IP Shop first', 'code': 'FEATURE_LOCKED'}), 403
        data = request.get_json() or {}
        if len(json.dumps(data.get('plan') or {})) > 30000:
            return jsonify({'error': 'Study plan is too large'}), 400
        plan = validate_structured_output(data.get('plan'), build_study_plan_schema())
        state = _get_or_create_student_tool_state(group.id, user.id)
        library = normalize_study_plan_library(state.study_plan)
        requested_plan_id = str(data.get('planId') or '').strip()[:80]
        now_iso = datetime.utcnow().isoformat()
        existing = next((item for item in library['plans'] if item['id'] == requested_plan_id), None)
        plan_id = existing['id'] if existing else uuid.uuid4().hex
        entry = {
            'id': plan_id,
            'name': str(data.get('name') or plan.get('title') or 'Study plan').strip()[:120] or 'Study plan',
            'createdAt': existing.get('createdAt') if existing else now_iso,
            'updatedAt': now_iso,
            'plan': plan,
        }
        library['plans'] = [item for item in library['plans'] if item['id'] != plan_id]
        library['plans'].append(entry)
        library['plans'] = library['plans'][-STUDY_PLAN_LIBRARY_LIMIT:]
        library['activePlanId'] = plan_id
        state.study_plan = library
        state.updated_at = datetime.utcnow()
        flag_modified(state, 'study_plan')
        db.session.commit()
        return jsonify({
            'message': 'Study plan saved',
            'entry': entry,
            'state': _student_tool_state_payload(state),
        }), 200
    except OpenAIResponsesError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 422
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/student-tools/study-plans/<plan_id>/active', methods=['PUT'])
@jwt_required()
def select_student_study_plan(group_id, plan_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        if not _can_use_performance_tools(group, user):
            return jsonify({'error': 'Study plans are unavailable for this account'}), 403
        state = _get_or_create_student_tool_state(group.id, user.id)
        library = normalize_study_plan_library(state.study_plan)
        if plan_id not in {item['id'] for item in library['plans']}:
            return jsonify({'error': 'Study plan not found'}), 404
        library['activePlanId'] = plan_id
        state.study_plan = library
        state.updated_at = datetime.utcnow()
        flag_modified(state, 'study_plan')
        db.session.commit()
        return jsonify({'state': _student_tool_state_payload(state)}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/student-tools/study-plans/<plan_id>', methods=['DELETE'])
@jwt_required()
def delete_student_study_plan(group_id, plan_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        if not _can_use_performance_tools(group, user):
            return jsonify({'error': 'Study plans are unavailable for this account'}), 403
        state = _get_or_create_student_tool_state(group.id, user.id)
        library = normalize_study_plan_library(state.study_plan)
        if plan_id not in {item['id'] for item in library['plans']}:
            return jsonify({'error': 'Study plan not found'}), 404
        library['plans'] = [item for item in library['plans'] if item['id'] != plan_id]
        if library['activePlanId'] == plan_id:
            library['activePlanId'] = library['plans'][-1]['id'] if library['plans'] else ''
        state.study_plan = library
        state.updated_at = datetime.utcnow()
        flag_modified(state, 'study_plan')
        db.session.commit()
        return jsonify({'message': 'Study plan deleted', 'state': _student_tool_state_payload(state)}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/student-tools/fitness-plan', methods=['PUT'])
@jwt_required()
def save_student_fitness_plan(group_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        if not _can_use_performance_tools(group, user):
            return jsonify({'error': 'Fitness plans are unavailable for this account'}), 403
        if not _user_has_performance_tool_access(group, user, 'fitness-coach'):
            return jsonify({'error': 'Unlock AI Fitness Coach in the IP Shop first', 'code': 'FEATURE_LOCKED'}), 403
        data = request.get_json() or {}
        if len(json.dumps(data.get('plan') or {})) > 24000:
            return jsonify({'error': 'Fitness plan is too large'}), 400
        plan = validate_structured_output(data.get('plan'), build_fitness_plan_schema())
        state = _get_or_create_student_tool_state(group.id, user.id)
        state.fitness_plan = plan
        state.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'message': 'Fitness plan saved',
            'fitnessPlan': state.fitness_plan,
            'updatedAt': state.updated_at.isoformat(),
        }), 200
    except OpenAIResponsesError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 422
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/student-tools/ai', methods=['POST'])
@jwt_required()
def generate_student_tool_content(group_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        data = request.get_json() or {}
        tool_id = str(data.get('toolId') or '').strip()
        admin_test = bool(data.get('testMode')) and _is_feature_lab_admin(group, user)
        if tool_id not in STUDENT_TOOL_FEATURE_ITEMS:
            return jsonify({'error': 'Unknown student tool'}), 400
        if not admin_test:
            if not _can_use_performance_tools(group, user):
                return jsonify({'error': 'This tool is unavailable for this account'}), 403
            if not _user_has_performance_tool_access(group, user, tool_id):
                return jsonify({'error': 'Unlock this tool in the IP Shop first', 'code': 'FEATURE_LOCKED'}), 403
        inputs = data.get('inputs') if isinstance(data.get('inputs'), dict) else {}
        if len(json.dumps(inputs)) > 12000:
            return jsonify({'error': 'Tool inputs are too large'}), 400

        state = None
        tutor_usage = None
        if not admin_test and tool_id in {'spanish-tutor', 'french-tutor'}:
            state = _get_or_create_student_tool_state(group.id, user.id)
            tutor_usage = _student_tutor_usage(group, state, tool_id, inputs.get('deviceTimezone'))
            if tutor_usage['remaining'] <= 0:
                return jsonify({
                    'error': f"You have used today's {tutor_usage['limit']} {tool_id.split('-')[0].capitalize()} tutor messages. Come back tomorrow for a fresh session.",
                    'code': 'DAILY_TUTOR_LIMIT',
                    'tutorUsage': tutor_usage,
                }), 429

        schema = None
        schema_name = None
        max_output_tokens = 3000
        if tool_id == 'study-planner':
            schema = build_study_plan_schema()
            schema_name = 'ip_study_plan_v1'
            system_prompt, user_prompt = build_study_plan_prompts(inputs)
            max_output_tokens = 5200
        elif tool_id == 'fitness-coach':
            schema = build_fitness_plan_schema()
            schema_name = 'ip_youth_fitness_plan_v1'
            system_prompt, user_prompt = build_fitness_plan_prompts(inputs)
            max_output_tokens = 4800
        elif tool_id in {'spanish-tutor', 'french-tutor'}:
            language = tool_id.split('-')[0]
            if language not in GCSE_LANGUAGES:
                return jsonify({'error': 'Unsupported tutor language'}), 400
            schema = build_tutor_response_schema()
            schema_name = f'ip_gcse_{language}_tutor_v2'
            history = data.get('history') if isinstance(data.get('history'), list) else []
            previous_activity = data.get('previousActivity') if isinstance(data.get('previousActivity'), dict) else {}
            system_prompt, user_prompt = build_tutor_prompts(
                language,
                inputs,
                history,
                str(data.get('answer') or '')[:1200],
                previous_activity,
            )
            max_output_tokens = 3200
        else:
            return jsonify({'error': 'This tool does not use AI generation'}), 400

        result = create_structured_response(
            model=OPENAI_STUDENT_TOOLS_MODEL,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema_name=schema_name,
            schema=schema,
            max_output_tokens=max_output_tokens,
        )
        if not admin_test and tool_id in {'spanish-tutor', 'french-tutor'}:
            state = state or _get_or_create_student_tool_state(group.id, user.id)
            tutor_progress = dict(state.tutor_progress or {})
            previous_progress = tutor_progress.get(tool_id) if isinstance(tutor_progress.get(tool_id), dict) else {}
            tutor_usage = tutor_usage or _student_tutor_usage(group, state, tool_id, inputs.get('deviceTimezone'))
            tutor_usage = {
                **tutor_usage,
                'used': min(tutor_usage['limit'], tutor_usage['used'] + 1),
                'remaining': max(0, tutor_usage['remaining'] - 1),
            }
            tutor_progress[tool_id] = {
                **previous_progress,
                'lastScore': result.get('score', 0),
                'lastSkillTag': result.get('activity', {}).get('skillTag', ''),
                'examBoard': inputs.get('examBoard', ''),
                'topic': inputs.get('topic', ''),
                'dailyDate': tutor_usage['date'],
                'dailyCount': tutor_usage['used'],
                'dailyTimezone': tutor_usage['timezone'],
                'updatedAt': datetime.utcnow().isoformat(),
            }
            state.tutor_progress = tutor_progress
            flag_modified(state, 'tutor_progress')
            state.updated_at = datetime.utcnow()
            db.session.commit()
        return jsonify({
            'result': result,
            'contract': structured_contract_metadata(schema_name),
            'testMode': admin_test,
            'saved': bool(not admin_test and tool_id in {'spanish-tutor', 'french-tutor'}),
            'tutorUsage': tutor_usage,
        }), 200
    except OpenAIResponsesError as exc:
        db.session.rollback()
        status_code = 503 if 'OPENAI_API_KEY' in str(exc) else 502
        return jsonify({'error': str(exc)}), status_code
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/student-tools/meditations', methods=['GET'])
@jwt_required()
def get_student_meditations(group_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        admin_test = _is_feature_lab_admin(group, user)
        if not admin_test and not _user_has_performance_tool_access(group, user, 'meditation'):
            return jsonify({'error': 'Unlock Guided Meditation in the IP Shop first', 'code': 'FEATURE_LOCKED'}), 403
        sessions = MeditationSession.query.filter(
            MeditationSession.is_published.is_(True),
            or_(MeditationSession.group_id == group.id, MeditationSession.is_global.is_(True)),
        ).order_by(MeditationSession.created_at.desc()).all()
        return jsonify({'sessions': [_serialize_meditation_session(group, session) for session in sessions]}), 200
    except Exception as exc:
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/student-tools/media/<path:filename>', methods=['GET'])
def get_student_tool_media(group_id, filename):
    group = Group.query.filter_by(group_id=group_id).first()
    safe_name = secure_filename(filename)
    allowed_name = bool(group and (safe_name.startswith(f'{group.id}-') or safe_name == _default_meditation_music_filename()))
    if not group or safe_name != filename or not allowed_name:
        return jsonify({'error': 'Media not found'}), 404
    try:
        token_payload = _meditation_media_serializer().loads(request.args.get('token') or '', max_age=6 * 60 * 60)
    except (BadSignature, SignatureExpired):
        return jsonify({'error': 'Media link is invalid or has expired'}), 403
    if token_payload.get('groupId') != group.id or token_payload.get('filename') != safe_name:
        return jsonify({'error': 'Media link is invalid'}), 403
    return send_from_directory(_student_tool_media_dir(), safe_name, conditional=True)


@groups_bp.route('/global-feature-lab/media/<path:filename>', methods=['GET'])
def get_global_student_tool_media(filename):
    safe_name = secure_filename(filename)
    if safe_name != filename:
        return jsonify({'error': 'Media not found'}), 404
    try:
        token_payload = _meditation_media_serializer().loads(request.args.get('token') or '', max_age=6 * 60 * 60)
    except (BadSignature, SignatureExpired):
        return jsonify({'error': 'Media link is invalid or has expired'}), 403
    if token_payload.get('groupId') is not None or token_payload.get('filename') != safe_name:
        return jsonify({'error': 'Media link is invalid'}), 403
    session_owns_media = MeditationSession.query.filter(
        MeditationSession.is_global.is_(True),
        or_(
            MeditationSession.narration_filename == safe_name,
            MeditationSession.music_filename == safe_name,
        ),
    ).first()
    allowed_name = bool(
        safe_name.startswith('global-')
        or safe_name == _default_meditation_music_filename()
        or session_owns_media
    )
    if not allowed_name:
        return jsonify({'error': 'Media not found'}), 404
    return send_from_directory(_student_tool_media_dir(), safe_name, conditional=True)


@groups_bp.route('/<group_id>/feature-lab/config', methods=['GET'])
@jwt_required()
def get_feature_lab_config(group_id):
    group, user, error = _student_tool_request_context(group_id)
    if error:
        return error
    if not _is_feature_lab_admin(group, user):
        return jsonify({'error': 'Admin Feature Lab access required'}), 403
    default_music_path = _default_meditation_music_path()
    return jsonify({
        'openAiConfigured': bool(os.getenv('OPENAI_API_KEY')),
        'elevenLabsConfigured': bool(os.getenv('ELEVENLABS_API_KEY') and os.getenv('ELEVENLABS_VOICE_ID')),
        'studentToolsModel': OPENAI_STUDENT_TOOLS_MODEL,
        'tutorConfig': build_tutor_config_payload(),
        'meditationRequirements': [
            'ELEVENLABS_API_KEY in the backend environment',
            'ELEVENLABS_VOICE_ID copied from ElevenLabs My Voices',
            f'One loopable MP3 background track named {_default_meditation_music_filename()}',
        ],
        'meditationDurations': list(MEDITATION_DURATION_MINUTES),
        'meditationFocuses': [
            {'key': key, **details}
            for key, details in MEDITATION_FOCUS_OPTIONS.items()
        ],
        'defaultMusic': {
            'filename': _default_meditation_music_filename(),
            'path': os.path.abspath(default_music_path),
            'available': _default_meditation_music_available(),
            'sizeMb': round(os.path.getsize(default_music_path) / (1024 * 1024), 2) if os.path.isfile(default_music_path) else None,
            'maxSizeMb': 15,
        },
        'meditationContract': structured_contract_metadata('ip_meditation_session_v1'),
    }), 200


@groups_bp.route('/<group_id>/feature-lab/meditation/prompt', methods=['POST'])
@jwt_required()
def create_meditation_manual_prompt(group_id):
    group, user, error = _student_tool_request_context(group_id)
    if error:
        return error
    if not _is_feature_lab_admin(group, user):
        return jsonify({'error': 'Admin Feature Lab access required'}), 403
    data = request.get_json() or {}
    try:
        duration_minutes = int(data.get('durationMinutes') or 10)
    except (TypeError, ValueError):
        return jsonify({'error': 'Duration must be 5, 10, 15, 20 or 30 minutes'}), 400
    focus_key = str(data.get('focusKey') or 'deep-study-focus').strip()
    try:
        prompt = build_meditation_manual_prompt(
            focus_key,
            duration_minutes,
            str(data.get('audience') or 'UK secondary school students aged 14 to 18')[:220],
            str(data.get('notes') or '')[:1000],
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'prompt': prompt, 'contract': structured_contract_metadata('ip_meditation_session_v1')}), 200


@groups_bp.route('/<group_id>/feature-lab/meditation/validate', methods=['POST'])
@jwt_required()
def validate_meditation_json(group_id):
    group, user, error = _student_tool_request_context(group_id)
    if error:
        return error
    if not _is_feature_lab_admin(group, user):
        return jsonify({'error': 'Admin Feature Lab access required'}), 403
    try:
        data = request.get_json() or {}
        session_payload = validate_meditation_payload(data.get('sessionJson') or data.get('session'))
        duration_estimate = estimate_meditation_duration(session_payload)
        return jsonify({
            'session': session_payload,
            'contract': structured_contract_metadata('ip_meditation_session_v1'),
            'narrationCharacters': sum(
                len(block['text'])
                for block in [session_payload['narration']['opening'], *session_payload['narration']['segments'], session_payload['narration']['closing']]
            ),
            'durationEstimate': duration_estimate,
        }), 200
    except OpenAIResponsesError as exc:
        return jsonify({'error': str(exc)}), 422


@groups_bp.route('/<group_id>/feature-lab/meditation/music', methods=['POST'])
@jwt_required()
def upload_meditation_music(group_id):
    group, user, error = _student_tool_request_context(group_id)
    if error:
        return error
    if not _is_feature_lab_admin(group, user):
        return jsonify({'error': 'Admin Feature Lab access required'}), 403
    upload = request.files.get('file')
    if not upload or not upload.filename:
        return jsonify({'error': 'Choose a background audio file'}), 400
    if request.content_length and request.content_length > 15 * 1024 * 1024:
        return jsonify({'error': 'Background audio must be under 15 MB'}), 413
    extension = upload.filename.rsplit('.', 1)[-1].lower() if '.' in upload.filename else ''
    if extension not in MEDITATION_MUSIC_EXTENSIONS:
        return jsonify({'error': 'Use MP3, WAV, M4A or OGG audio'}), 400
    filename = f'{group.id}-{uuid.uuid4().hex}.{extension}'
    upload.save(os.path.join(_student_tool_media_dir(), filename))
    return jsonify({'filename': filename, 'url': _meditation_media_url(group, filename)}), 201


@groups_bp.route('/<group_id>/feature-lab/meditations', methods=['POST'])
@jwt_required()
def create_meditation_session(group_id):
    try:
        group, user, error = _student_tool_request_context(group_id)
        if error:
            return error
        if not _is_feature_lab_admin(group, user):
            return jsonify({'error': 'Admin Feature Lab access required'}), 403
        data = request.get_json() or {}
        session_payload = validate_meditation_payload(data.get('sessionJson') or data.get('session'))
        duration_estimate = estimate_meditation_duration(session_payload)
        if duration_estimate['fitStatus'] == 'off-target':
            return jsonify({
                'error': 'The estimated narration length is too far from the planned session length. Regenerate or adjust the JSON before using ElevenLabs credits.',
                'durationEstimate': duration_estimate,
            }), 422
        music_filename = secure_filename(str(data.get('musicFilename') or '')) or None
        if not music_filename and _default_meditation_music_available():
            music_filename = _default_meditation_music_filename()
        if music_filename:
            music_path = os.path.join(_student_tool_media_dir(), music_filename)
            valid_music_name = music_filename.startswith(f'{group.id}-') or music_filename == _default_meditation_music_filename()
            if not valid_music_name or not os.path.isfile(music_path):
                return jsonify({'error': 'Uploaded background audio could not be found'}), 400
        narration_filename, alignment = _elevenlabs_meditation_audio(session_payload, group)
        session = MeditationSession(
            group_id=group.id,
            created_by_id=user.id,
            session_key=uuid.uuid4().hex,
            session_data=session_payload,
            alignment=alignment,
            narration_filename=narration_filename,
            music_filename=music_filename,
            is_published=bool(data.get('publish', True)),
        )
        db.session.add(session)
        db.session.commit()
        return jsonify({
            'message': 'Guided meditation generated and published',
            'session': _serialize_meditation_session(group, session),
        }), 201
    except OpenAIResponsesError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 422
    except RuntimeError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 503
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


def _global_feature_lab_user():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user or not user.is_active or user.account_role != 'admin':
        return None, (jsonify({'error': 'Platform admin Feature Lab access required'}), 403)
    return user, None


def _global_feature_lab_config_payload():
    default_music_path = _default_meditation_music_path()
    return {
        'openAiConfigured': bool(os.getenv('OPENAI_API_KEY')),
        'elevenLabsConfigured': bool(os.getenv('ELEVENLABS_API_KEY') and os.getenv('ELEVENLABS_VOICE_ID')),
        'studentToolsModel': OPENAI_STUDENT_TOOLS_MODEL,
        'tutorConfig': build_tutor_config_payload(),
        'meditationRequirements': [
            'ELEVENLABS_API_KEY in the backend environment',
            'ELEVENLABS_VOICE_ID copied from ElevenLabs My Voices',
            f'One loopable MP3 background track named {_default_meditation_music_filename()}',
        ],
        'meditationDurations': list(MEDITATION_DURATION_MINUTES),
        'meditationFocuses': [
            {'key': key, **details}
            for key, details in MEDITATION_FOCUS_OPTIONS.items()
        ],
        'defaultMusic': {
            'filename': _default_meditation_music_filename(),
            'path': os.path.abspath(default_music_path),
            'available': _default_meditation_music_available(),
            'sizeMb': round(os.path.getsize(default_music_path) / (1024 * 1024), 2) if os.path.isfile(default_music_path) else None,
            'maxSizeMb': 15,
        },
        'meditationContract': structured_contract_metadata('ip_meditation_session_v1'),
        'publishingScope': 'global',
    }


@groups_bp.route('/global-feature-lab/config', methods=['GET'])
@jwt_required()
def get_global_feature_lab_config():
    _, error = _global_feature_lab_user()
    if error:
        return error
    return jsonify(_global_feature_lab_config_payload()), 200


@groups_bp.route('/global-feature-lab/ai', methods=['POST'])
@jwt_required()
def generate_global_feature_lab_ai():
    try:
        _, error = _global_feature_lab_user()
        if error:
            return error
        data = request.get_json() or {}
        tool_id = str(data.get('toolId') or '').strip()
        inputs = data.get('inputs') if isinstance(data.get('inputs'), dict) else {}
        if len(json.dumps(inputs)) > 12000:
            return jsonify({'error': 'Tool inputs are too large'}), 400

        if tool_id == 'study-planner':
            schema = build_study_plan_schema()
            schema_name = 'ip_study_plan_v1'
            system_prompt, user_prompt = build_study_plan_prompts(inputs)
            max_output_tokens = 5200
        elif tool_id == 'fitness-coach':
            schema = build_fitness_plan_schema()
            schema_name = 'ip_youth_fitness_plan_v1'
            system_prompt, user_prompt = build_fitness_plan_prompts(inputs)
            max_output_tokens = 4800
        elif tool_id in {'spanish-tutor', 'french-tutor'}:
            language = tool_id.split('-')[0]
            schema = build_tutor_response_schema()
            schema_name = f'ip_gcse_{language}_tutor_v2'
            history = data.get('history') if isinstance(data.get('history'), list) else []
            previous_activity = data.get('previousActivity') if isinstance(data.get('previousActivity'), dict) else {}
            system_prompt, user_prompt = build_tutor_prompts(
                language,
                inputs,
                history,
                str(data.get('answer') or '')[:1200],
                previous_activity,
            )
            max_output_tokens = 3200
        else:
            return jsonify({'error': 'This Feature Lab tool does not use AI generation'}), 400

        result = create_structured_response(
            model=OPENAI_STUDENT_TOOLS_MODEL,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema_name=schema_name,
            schema=schema,
            max_output_tokens=max_output_tokens,
        )
        return jsonify({
            'result': result,
            'contract': structured_contract_metadata(schema_name),
            'testMode': True,
            'publishingScope': 'global',
        }), 200
    except OpenAIResponsesError as exc:
        status_code = 503 if 'OPENAI_API_KEY' in str(exc) else 502
        return jsonify({'error': str(exc)}), status_code
    except Exception as exc:
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/global-feature-lab/meditation/prompt', methods=['POST'])
@jwt_required()
def create_global_meditation_manual_prompt():
    _, error = _global_feature_lab_user()
    if error:
        return error
    data = request.get_json() or {}
    try:
        prompt = build_meditation_manual_prompt(
            str(data.get('focusKey') or 'deep-study-focus').strip(),
            int(data.get('durationMinutes') or 10),
            str(data.get('audience') or 'UK secondary school students aged 14 to 18')[:220],
            str(data.get('notes') or '')[:1000],
        )
    except (TypeError, ValueError) as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'prompt': prompt, 'contract': structured_contract_metadata('ip_meditation_session_v1')}), 200


@groups_bp.route('/global-feature-lab/meditation/validate', methods=['POST'])
@jwt_required()
def validate_global_meditation_json():
    _, error = _global_feature_lab_user()
    if error:
        return error
    try:
        data = request.get_json() or {}
        session_payload = validate_meditation_payload(data.get('sessionJson') or data.get('session'))
        return jsonify({
            'session': session_payload,
            'contract': structured_contract_metadata('ip_meditation_session_v1'),
            'narrationCharacters': sum(
                len(block['text'])
                for block in [session_payload['narration']['opening'], *session_payload['narration']['segments'], session_payload['narration']['closing']]
            ),
            'durationEstimate': estimate_meditation_duration(session_payload),
        }), 200
    except OpenAIResponsesError as exc:
        return jsonify({'error': str(exc)}), 422


@groups_bp.route('/global-feature-lab/meditation/music', methods=['POST'])
@jwt_required()
def upload_global_meditation_music():
    _, error = _global_feature_lab_user()
    if error:
        return error
    upload = request.files.get('file')
    if not upload or not upload.filename:
        return jsonify({'error': 'Choose a background audio file'}), 400
    if request.content_length and request.content_length > 15 * 1024 * 1024:
        return jsonify({'error': 'Background audio must be under 15 MB'}), 413
    extension = upload.filename.rsplit('.', 1)[-1].lower() if '.' in upload.filename else ''
    if extension not in MEDITATION_MUSIC_EXTENSIONS:
        return jsonify({'error': 'Use MP3, WAV, M4A or OGG audio'}), 400
    filename = f'global-{uuid.uuid4().hex}.{extension}'
    upload.save(os.path.join(_student_tool_media_dir(), filename))
    return jsonify({'filename': filename, 'url': _meditation_media_url(None, filename)}), 201


@groups_bp.route('/global-feature-lab/meditations', methods=['GET', 'POST'])
@jwt_required()
def global_meditation_sessions():
    user, error = _global_feature_lab_user()
    if error:
        return error
    if request.method == 'GET':
        sessions = MeditationSession.query.filter_by(is_global=True, is_published=True).order_by(MeditationSession.created_at.desc()).all()
        return jsonify({'sessions': [_serialize_meditation_session(None, session) for session in sessions]}), 200
    try:
        data = request.get_json() or {}
        session_payload = validate_meditation_payload(data.get('sessionJson') or data.get('session'))
        duration_estimate = estimate_meditation_duration(session_payload)
        if duration_estimate['fitStatus'] == 'off-target':
            return jsonify({
                'error': 'The estimated narration length is too far from the planned session length. Regenerate or adjust the JSON before using ElevenLabs credits.',
                'durationEstimate': duration_estimate,
            }), 422
        music_filename = secure_filename(str(data.get('musicFilename') or '')) or None
        if not music_filename and _default_meditation_music_available():
            music_filename = _default_meditation_music_filename()
        if music_filename:
            music_path = os.path.join(_student_tool_media_dir(), music_filename)
            valid_music_name = music_filename.startswith('global-') or music_filename == _default_meditation_music_filename()
            if not valid_music_name or not os.path.isfile(music_path):
                return jsonify({'error': 'Uploaded background audio could not be found'}), 400
        narration_filename, alignment = _elevenlabs_meditation_audio(session_payload, None)
        session = MeditationSession(
            group_id=None,
            created_by_id=user.id,
            session_key=uuid.uuid4().hex,
            session_data=session_payload,
            alignment=alignment,
            narration_filename=narration_filename,
            music_filename=music_filename,
            is_published=bool(data.get('publish', True)),
            is_global=True,
        )
        db.session.add(session)
        db.session.commit()
        return jsonify({
            'message': 'Guided meditation generated and published globally',
            'session': _serialize_meditation_session(None, session),
        }), 201
    except OpenAIResponsesError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 422
    except RuntimeError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 503
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


def _google_calendar_state_serializer():
    return URLSafeTimedSerializer(os.getenv('JWT_SECRET_KEY', 'dev-secret-key'), salt='google-calendar-link')


def _google_calendar_popup_response(status, message):
    frontend_origin = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    event_payload = json.dumps({'source': 'rituo-google-calendar', 'status': status, 'message': message})
    response = make_response(f"""<!doctype html><html><body style="font-family:sans-serif;padding:32px;background:#081024;color:white"><h2>{'Google Calendar connected' if status == 'connected' else 'Connection unsuccessful'}</h2><p>You can close this window and return to your planner.</p><script>if(window.opener){{window.opener.postMessage({event_payload},{json.dumps(frontend_origin)});window.close();}}</script></body></html>""")
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response


class GoogleCalendarApiError(RuntimeError):
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = 409 if status_code == 401 else status_code


def _google_calendar_access_token(settings, force_refresh=False):
    if not settings or not settings.google_calendar_refresh_token:
        raise GoogleCalendarApiError('Google Calendar is not connected', 409)
    expiry = settings.google_calendar_token_expiry
    if (
        not force_refresh
        and settings.google_calendar_access_token
        and expiry
        and expiry > datetime.utcnow() + timedelta(seconds=60)
    ):
        return settings.google_calendar_access_token
    initial_access_token = settings.google_calendar_access_token
    with _google_calendar_refresh_locks[settings.id or f'{settings.group_id}:{settings.student_id}']:
        db.session.refresh(settings)
        expiry = settings.google_calendar_token_expiry
        token_is_current = bool(
            settings.google_calendar_access_token
            and expiry
            and expiry > datetime.utcnow() + timedelta(seconds=60)
        )
        if token_is_current and (
            not force_refresh
            or settings.google_calendar_access_token != initial_access_token
        ):
            return settings.google_calendar_access_token
        token_request = UrlRequest(
            'https://oauth2.googleapis.com/token',
            data=urlencode({
                'client_id': os.getenv('GOOGLE_CALENDAR_CLIENT_ID', ''),
                'client_secret': os.getenv('GOOGLE_CALENDAR_CLIENT_SECRET', ''),
                'refresh_token': settings.google_calendar_refresh_token,
                'grant_type': 'refresh_token',
            }).encode('utf-8'),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            method='POST',
        )
        try:
            with urlopen(token_request, timeout=20) as token_response:
                token_payload = json.loads(token_response.read().decode('utf-8'))
        except HTTPError as exc:
            try:
                error_payload = json.loads(exc.read().decode('utf-8'))
                detail = error_payload.get('error_description') or error_payload.get('error')
            except (ValueError, AttributeError):
                detail = None
            raise GoogleCalendarApiError(detail or 'Google Calendar authorization expired. Reconnect your calendar.', 409) from exc
        except (OSError, ValueError) as exc:
            raise GoogleCalendarApiError('Google Calendar could not be reached') from exc
        access_token = token_payload.get('access_token')
        if not access_token:
            raise GoogleCalendarApiError('Google did not return a calendar access token')
        settings.google_calendar_access_token = access_token
        settings.google_calendar_token_expiry = datetime.utcnow() + timedelta(seconds=max(0, int(token_payload.get('expires_in') or 0)))
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        return access_token


def _google_calendar_api_request(settings, method, path, query=None, payload=None, retry_auth=True, rate_limit_retries=4):
    query_string = urlencode(query or {}, doseq=True)
    url = f"https://www.googleapis.com/calendar/v3{path}"
    if query_string:
        url += f'?{query_string}'
    access_token = _google_calendar_access_token(settings)
    request_data = json.dumps(payload).encode('utf-8') if payload is not None else None
    calendar_request = UrlRequest(
        url,
        data=request_data,
        headers={
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
            **({'Content-Type': 'application/json'} if payload is not None else {}),
        },
        method=method,
    )
    try:
        with urlopen(calendar_request, timeout=25) as calendar_response:
            response_body = calendar_response.read().decode('utf-8')
            return json.loads(response_body) if response_body else {}
    except HTTPError as exc:
        if exc.code == 401 and retry_auth:
            _google_calendar_access_token(settings, force_refresh=True)
            return _google_calendar_api_request(
                settings,
                method,
                path,
                query=query,
                payload=payload,
                retry_auth=False,
                rate_limit_retries=rate_limit_retries,
            )
        try:
            error_payload = json.loads(exc.read().decode('utf-8'))
            detail = ((error_payload.get('error') or {}).get('message') or '').strip()
            reasons = {
                str(error.get('reason') or '')
                for error in ((error_payload.get('error') or {}).get('errors') or [])
            }
        except (ValueError, AttributeError):
            detail = ''
            reasons = set()
        is_rate_limit = exc.code == 429 or bool(
            reasons.intersection({'rateLimitExceeded', 'userRateLimitExceeded'})
            or 'rate limit' in detail.lower()
        )
        if is_rate_limit and rate_limit_retries > 0:
            retry_after = exc.headers.get('Retry-After') if exc.headers else None
            try:
                wait_seconds = max(1.0, min(12.0, float(retry_after)))
            except (TypeError, ValueError):
                wait_seconds = min(12.0, 2 ** (5 - rate_limit_retries))
            time.sleep(wait_seconds)
            return _google_calendar_api_request(
                settings,
                method,
                path,
                query=query,
                payload=payload,
                retry_auth=retry_auth,
                rate_limit_retries=rate_limit_retries - 1,
            )
        raise GoogleCalendarApiError(detail or 'Google Calendar rejected the request', exc.code) from exc
    except (OSError, ValueError) as exc:
        raise GoogleCalendarApiError('Google Calendar could not be reached') from exc


def _list_google_calendar_events(settings, query, calendar_id='primary'):
    events = []
    next_page_token = None
    while True:
        page_query = {**query}
        if next_page_token:
            page_query['pageToken'] = next_page_token
        payload = _google_calendar_api_request(
            settings,
            'GET',
            f"/calendars/{quote(str(calendar_id), safe='')}/events",
            query=page_query,
        )
        events.extend(payload.get('items') or [])
        next_page_token = payload.get('nextPageToken')
        if not next_page_token or len(events) >= 2500:
            return events[:2500]


def _delete_google_workspace_events(settings, group_id, batch_size=20):
    managed_events = _list_google_calendar_events(settings, {
        'privateExtendedProperty': f'ipkpWorkspace={group_id}',
        'showDeleted': 'false',
        'maxResults': 2500,
    })
    removable_events = managed_events[:max(1, min(40, int(batch_size or 20)))]
    removed = 0
    for event in removable_events:
        event_id = str((event or {}).get('id') or '').strip()
        if not event_id:
            continue
        try:
            _google_calendar_api_request(
                settings,
                'DELETE',
                f"/calendars/primary/events/{quote(event_id, safe='')}",
            )
            removed += 1
            time.sleep(0.25)
        except GoogleCalendarApiError as exc:
            if exc.status_code not in {404, 410}:
                raise
    return {
        'removed': removed,
        'remaining': max(0, len(managed_events) - removed),
        'complete': len(managed_events) <= removed,
    }


def _list_google_calendars(settings):
    calendars = []
    next_page_token = None
    while True:
        query = {
            'maxResults': 250,
            'showDeleted': 'false',
            'showHidden': 'false',
        }
        if next_page_token:
            query['pageToken'] = next_page_token
        payload = _google_calendar_api_request(
            settings,
            'GET',
            '/users/me/calendarList',
            query=query,
        )
        calendars.extend(payload.get('items') or [])
        next_page_token = payload.get('nextPageToken')
        if not next_page_token or len(calendars) >= 1000:
            return calendars[:1000]


def _list_visible_google_calendar_events(settings, query):
    calendars = _list_google_calendars(settings)
    visible_calendars = [
        calendar for calendar in calendars
        if (
            calendar.get('primary') is True
            or calendar.get('selected') is True
        ) and calendar.get('accessRole') in {'reader', 'writer', 'owner'}
    ]
    events = []
    seen_calendar_ids = set()
    for calendar in visible_calendars:
        calendar_id = str(calendar.get('id') or '').strip()
        if not calendar_id or calendar_id in seen_calendar_ids:
            continue
        seen_calendar_ids.add(calendar_id)
        calendar_name = str(calendar.get('summaryOverride') or calendar.get('summary') or 'Google Calendar')
        calendar_color = str(calendar.get('backgroundColor') or '')
        for event in _list_google_calendar_events(settings, query, calendar_id=calendar_id):
            events.append({
                **event,
                '_ipkpCalendarId': calendar_id,
                '_ipkpCalendarName': calendar_name,
                '_ipkpCalendarColor': calendar_color,
            })
            if len(events) >= 5000:
                return events
    return events


def _google_calendar_range_query(start_date, end_date, member_timezone):
    return {
        'timeMin': datetime.combine(start_date, datetime.min.time(), tzinfo=member_timezone).isoformat(),
        'timeMax': datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=member_timezone).isoformat(),
        'singleEvents': 'true',
        'orderBy': 'startTime',
        'maxResults': 2500,
    }


def _google_calendar_member_context(group_id, student_id):
    current_user_id = int(get_jwt_identity())
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        raise GoogleCalendarApiError('Workspace not found', 404)
    if current_user_id != student_id:
        raise GoogleCalendarApiError('Accounts can only manage their own Google Calendar', 403)
    if not is_planner_member(group, student_id):
        raise GoogleCalendarApiError('Account not found in workspace', 404)
    settings = _get_student_planner_settings(group.id, student_id)
    if not settings or not settings.google_calendar_refresh_token:
        raise GoogleCalendarApiError('Google Calendar is not connected', 409)
    return group, settings


@groups_bp.route('/<group_id>/students/<int:student_id>/google-calendar/events', methods=['GET'])
@jwt_required()
def get_google_calendar_events(group_id, student_id):
    try:
        group, settings = _google_calendar_member_context(group_id, student_id)
        start_date = _parse_plan_date(request.args.get('start'))
        end_date = _parse_plan_date(request.args.get('end'))
        if end_date < start_date or (end_date - start_date).days > 62:
            return jsonify({'error': 'Choose a Google Calendar range of 63 days or fewer'}), 400
        timezone_name, member_timezone = _student_timezone(group, student_id, settings)
        range_query = _google_calendar_range_query(start_date, end_date, member_timezone)
        can_list_calendars = _google_calendar_can_list_calendars(settings)
        events = (
            _list_visible_google_calendar_events(settings, range_query)
            if can_list_calendars
            else _list_google_calendar_events(settings, range_query)
        )
        normalized = normalize_external_google_events(
            events,
            member_timezone,
            start_date,
            end_date,
            settings.google_calendar_hidden_event_ids or [],
        )
        return jsonify({
            'events': normalized,
            'timezone': timezone_name,
            'hiddenCount': len(settings.google_calendar_hidden_event_ids or []),
            'needsReconnect': not can_list_calendars,
        }), 200
    except GoogleCalendarApiError as exc:
        return jsonify({'error': str(exc)}), exc.status_code
    except Exception as exc:
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/google-calendar/sync', methods=['POST'])
@jwt_required()
def sync_google_calendar_events(group_id, student_id):
    try:
        group, settings = _google_calendar_member_context(group_id, student_id)
        data = request.get_json() or {}
        days = data.get('days') or []
        if not isinstance(days, list) or not days or len(days) > GOOGLE_SYNC_MAX_DAYS:
            return jsonify({'error': f'Sync between 1 and {GOOGLE_SYNC_MAX_DAYS} planner days at a time'}), 400
        valid_dates = []
        for raw_day in days:
            try:
                valid_dates.append(date.fromisoformat(str((raw_day or {}).get('date') or '')[:10]))
            except ValueError:
                continue
        if not valid_dates:
            return jsonify({'error': 'No valid planner dates were supplied'}), 400
        timezone_name, member_timezone = _student_timezone(group, student_id, settings)
        if data.get('includeChallengeHorizon'):
            challenge, member_habit = _planner_challenge_context(group, student_id)
            if challenge and member_habit:
                raw_start = challenge.start_date if hasattr(challenge, 'start_date') else (challenge or {}).get('startDate') or (challenge or {}).get('start_date')
                raw_end = challenge.end_date if hasattr(challenge, 'end_date') else (challenge or {}).get('endDate') or (challenge or {}).get('end_date')
                try:
                    challenge_start = raw_start.date() if isinstance(raw_start, datetime) else date.fromisoformat(str(raw_start)[:10])
                    challenge_end = raw_end.date() if isinstance(raw_end, datetime) else date.fromisoformat(str(raw_end)[:10])
                    joined_at = str(member_habit.get('joinedAt') or '')[:10]
                    if joined_at:
                        challenge_start = max(challenge_start, date.fromisoformat(joined_at))
                    today_value = datetime.now(member_timezone).date()
                    horizon_end = min(challenge_end, today_value + timedelta(days=30))
                    saved_plans = StudentSchedulePlan.query.filter(
                        StudentSchedulePlan.group_id == group.id,
                        StudentSchedulePlan.student_id == student_id,
                        StudentSchedulePlan.plan_date >= today_value,
                        StudentSchedulePlan.plan_date <= horizon_end,
                    ).all()
                    days = build_google_challenge_horizon_days(
                        days,
                        member_habit.get('habits') or [],
                        [{
                            'date': plan.plan_date.isoformat(),
                            'constraintsText': plan.constraints_text or '',
                            'items': plan.items or [],
                        } for plan in saved_plans],
                        settings.recurring_reminders or [],
                        settings.ai_weekly_templates or {},
                        challenge_start,
                        challenge_end,
                        today_value,
                    )
                    valid_dates = [
                        date.fromisoformat(str((raw_day or {}).get('date') or '')[:10])
                        for raw_day in days
                    ]
                except (TypeError, ValueError):
                    pass
        managed_events = build_managed_google_events(group.id, student_id, days, timezone_name)
        range_query = _google_calendar_range_query(min(valid_dates), max(valid_dates), member_timezone)
        range_query['privateExtendedProperty'] = f'ipkpWorkspace={group.id}'
        existing_events = _list_google_calendar_events(settings, range_query)
        existing_by_id = {
            str(event.get('id')): event
            for event in existing_events
            if event.get('id')
        }
        desired_ids = {event['id'] for event in managed_events}
        created = 0
        updated = 0
        for event in managed_events:
            payload = {
                **event['payload'],
                'extendedProperties': {
                    'private': {
                        **event['payload']['extendedProperties']['private'],
                        'ipkpWorkspace': str(group.id),
                    },
                },
            }
            event_path = f"/calendars/primary/events/{quote(event['id'], safe='')}"
            if event['id'] in existing_by_id:
                payload.pop('id', None)
                _google_calendar_api_request(settings, 'PUT', event_path, payload=payload)
                updated += 1
            else:
                try:
                    _google_calendar_api_request(settings, 'POST', '/calendars/primary/events', payload=payload)
                    created += 1
                except GoogleCalendarApiError as exc:
                    if exc.status_code != 409:
                        raise
                    payload.pop('id', None)
                    _google_calendar_api_request(settings, 'PUT', event_path, payload=payload)
                    updated += 1
        deleted = 0
        for event_id in set(existing_by_id) - desired_ids:
            _google_calendar_api_request(
                settings,
                'DELETE',
                f"/calendars/primary/events/{quote(event_id, safe='')}",
            )
            deleted += 1
        return jsonify({
            'message': 'Google Calendar is in sync',
            'created': created,
            'updated': updated,
            'removed': deleted,
            'managed': len(managed_events),
        }), 200
    except GoogleCalendarApiError as exc:
        return jsonify({'error': str(exc)}), exc.status_code
    except Exception as exc:
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/google-calendar/pull', methods=['POST'])
@jwt_required()
def pull_google_calendar_changes(group_id, student_id):
    try:
        group, settings = _google_calendar_member_context(group_id, student_id)
        data = request.get_json() or {}
        days = data.get('days') or []
        if not isinstance(days, list) or not days or len(days) > 14:
            return jsonify({'error': 'Pull between 1 and 14 planner days at a time'}), 400
        valid_dates = []
        for raw_day in days:
            try:
                valid_dates.append(date.fromisoformat(str((raw_day or {}).get('date') or '')[:10]))
            except ValueError:
                continue
        if not valid_dates:
            return jsonify({'error': 'No valid planner dates were supplied'}), 400

        timezone_name, member_timezone = _student_timezone(group, student_id, settings)
        range_query = _google_calendar_range_query(min(valid_dates), max(valid_dates), member_timezone)
        range_query['privateExtendedProperty'] = f'ipkpWorkspace={group.id}'
        managed_google_events = _list_google_calendar_events(settings, range_query)
        reconciliation = reconcile_managed_google_events(
            group.id,
            student_id,
            days,
            managed_google_events,
            member_timezone,
        )
        changed_dates = set(reconciliation['changedDates'])
        saved_days = []
        for raw_day in reconciliation['days']:
            plan_date = date.fromisoformat(str((raw_day or {}).get('date') or '')[:10])
            if plan_date.isoformat() not in changed_dates:
                continue
            plan = StudentSchedulePlan.query.filter_by(
                group_id=group.id,
                student_id=student_id,
                plan_date=plan_date,
            ).first()
            normalized_items = _normalize_saved_schedule_items((raw_day or {}).get('items'))
            schedule_error = _validate_same_day_habit_schedule_changes(
                group,
                student_id,
                plan_date,
                normalized_items,
                existing_plan=plan,
                existing_settings=settings,
            )
            if schedule_error:
                continue
            if not plan:
                plan = StudentSchedulePlan(group_id=group.id, student_id=student_id, plan_date=plan_date)
                db.session.add(plan)
            plan.constraints_text = str((raw_day or {}).get('constraintsText') or '').strip()[:4000] or None
            plan.items = normalized_items
            plan.updated_at = datetime.utcnow()
            saved_days.append({
                'date': plan_date.isoformat(),
                'constraintsText': plan.constraints_text or '',
                'items': normalized_items,
            })
        corrected_dates = 0
        correction_ids = set(reconciliation['dateCorrectionEventIds'])
        if correction_ids:
            corrected_events = {
                event['id']: event
                for event in build_managed_google_events(
                    group.id,
                    student_id,
                    reconciliation['days'],
                    timezone_name,
                )
                if event['id'] in correction_ids
            }
            for event_id, event in corrected_events.items():
                payload = {
                    **event['payload'],
                    'extendedProperties': {
                        'private': {
                            **event['payload']['extendedProperties']['private'],
                            'ipkpWorkspace': str(group.id),
                        },
                    },
                }
                payload.pop('id', None)
                _google_calendar_api_request(
                    settings,
                    'PUT',
                    f"/calendars/primary/events/{quote(event_id, safe='')}",
                    payload=payload,
                )
                corrected_dates += 1
        db.session.commit()
        return jsonify({
            'message': 'Google Calendar changes checked',
            'pulled': len(saved_days),
            'days': saved_days,
            'movedAcrossDates': reconciliation['movedAcrossDates'],
            'correctedDates': corrected_dates,
        }), 200
    except GoogleCalendarApiError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), exc.status_code
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/google-calendar/hidden-events', methods=['POST', 'DELETE'])
@jwt_required()
def manage_hidden_google_calendar_events(group_id, student_id):
    try:
        _, settings = _google_calendar_member_context(group_id, student_id)
        if request.method == 'DELETE':
            settings.google_calendar_hidden_event_ids = []
        else:
            event_id = str((request.get_json() or {}).get('eventId') or '').strip()[:1024]
            if not event_id:
                return jsonify({'error': 'Google event ID is required'}), 400
            hidden_ids = [str(value) for value in (settings.google_calendar_hidden_event_ids or []) if str(value)]
            hidden_ids = [value for value in hidden_ids if value != event_id]
            hidden_ids.append(event_id)
            settings.google_calendar_hidden_event_ids = hidden_ids[-500:]
        flag_modified(settings, 'google_calendar_hidden_event_ids')
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'hiddenCount': len(settings.google_calendar_hidden_event_ids or [])}), 200
    except GoogleCalendarApiError as exc:
        return jsonify({'error': str(exc)}), exc.status_code
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/google-calendar/connect', methods=['POST'])
@jwt_required()
def connect_student_google_calendar(group_id, student_id):
    current_user_id = int(get_jwt_identity())
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return jsonify({'error': 'School not found'}), 404
    if current_user_id != student_id:
        return jsonify({'error': 'Students can only link their own calendar'}), 403
    if not is_planner_member(group, student_id):
        return jsonify({'error': 'Account not found in workspace'}), 404
    client_id = os.getenv('GOOGLE_CALENDAR_CLIENT_ID')
    redirect_uri = os.getenv('GOOGLE_CALENDAR_REDIRECT_URI')
    if not client_id or not os.getenv('GOOGLE_CALENDAR_CLIENT_SECRET') or not redirect_uri:
        return jsonify({'error': 'Google Calendar has not been configured by the platform administrator'}), 503

    state = _google_calendar_state_serializer().dumps({'groupId': group.id, 'studentId': student_id})
    authorization_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode({
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': (
            'https://www.googleapis.com/auth/calendar.events '
            'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
        ),
        'access_type': 'offline',
        'include_granted_scopes': 'true',
        'prompt': 'consent',
        'state': state,
    })
    return jsonify({'authorizationUrl': authorization_url}), 200


@groups_bp.route('/google-calendar/callback', methods=['GET'])
def google_calendar_callback():
    if request.args.get('error'):
        return _google_calendar_popup_response('error', 'Google Calendar access was not granted')
    try:
        state_data = _google_calendar_state_serializer().loads(request.args.get('state') or '', max_age=600)
    except SignatureExpired:
        return _google_calendar_popup_response('error', 'The connection request expired'), 400
    except BadSignature:
        return _google_calendar_popup_response('error', 'The connection request was invalid'), 400

    code = request.args.get('code')
    if not code:
        return _google_calendar_popup_response('error', 'Google did not return an authorization code'), 400
    token_request = UrlRequest(
        'https://oauth2.googleapis.com/token',
        data=urlencode({
            'code': code,
            'client_id': os.getenv('GOOGLE_CALENDAR_CLIENT_ID', ''),
            'client_secret': os.getenv('GOOGLE_CALENDAR_CLIENT_SECRET', ''),
            'redirect_uri': os.getenv('GOOGLE_CALENDAR_REDIRECT_URI', ''),
            'grant_type': 'authorization_code',
        }).encode('utf-8'),
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST',
    )
    try:
        with urlopen(token_request, timeout=20) as token_response:
            token_payload = json.loads(token_response.read().decode('utf-8'))
    except (HTTPError, OSError, ValueError):
        return _google_calendar_popup_response('error', 'Google token exchange failed'), 502

    group = Group.query.get(int(state_data['groupId']))
    student = User.query.get(int(state_data['studentId']))
    if not group or not student or not is_planner_member(group, student.id):
        return _google_calendar_popup_response('error', 'The workspace or account is no longer available'), 404
    settings = _get_student_planner_settings(group.id, student.id, create=True)
    refresh_token = token_payload.get('refresh_token') or settings.google_calendar_refresh_token
    if not refresh_token:
        db.session.rollback()
        return _google_calendar_popup_response('error', 'Google did not provide offline calendar access'), 502
    settings.google_calendar_refresh_token = refresh_token
    settings.google_calendar_access_token = token_payload.get('access_token')
    settings.google_calendar_token_expiry = datetime.utcnow() + timedelta(seconds=max(0, int(token_payload.get('expires_in') or 0)))
    settings.google_calendar_scopes = token_payload.get('scope') or (
        'https://www.googleapis.com/auth/calendar.events '
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
    )
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    return _google_calendar_popup_response('connected', 'Google Calendar connected')


@groups_bp.route('/<group_id>/students/<int:student_id>/google-calendar', methods=['DELETE'])
@jwt_required()
def disconnect_student_google_calendar(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only unlink their own calendar'}), 403
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not is_planner_member(group, student_id):
            return jsonify({'error': 'Account not found in workspace'}), 404
        settings = _get_student_planner_settings(group.id, student_id)
        removal = {'removed': 0, 'remaining': 0, 'complete': True}
        if settings:
            if settings.google_calendar_refresh_token:
                removal = _delete_google_workspace_events(settings, group.id)
            if removal['complete']:
                settings.google_calendar_refresh_token = None
                settings.google_calendar_access_token = None
                settings.google_calendar_token_expiry = None
                settings.google_calendar_scopes = None
                settings.google_calendar_hidden_event_ids = []
                flag_modified(settings, 'google_calendar_hidden_event_ids')
                settings.updated_at = datetime.utcnow()
                db.session.commit()
        return jsonify({
            'message': (
                'Google Calendar disconnected and IP planner events removed'
                if removal['complete']
                else 'IP planner event cleanup is still in progress'
            ),
            **removal,
        }), 200 if removal['complete'] else 202
    except GoogleCalendarApiError as exc:
        db.session.rollback()
        return jsonify({
            'error': f'IP planner events could not be removed from Google Calendar: {str(exc)}',
        }), exc.status_code
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/students/<int:student_id>/schedule', methods=['GET'])
@jwt_required()
def get_student_schedule(group_id, student_id):
    try:
        current_user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'School not found'}), 404
        if not is_planner_member(group, student_id):
            return jsonify({'error': 'Account not found in workspace'}), 404
        if current_user_id != student_id and not can_view_student(group, current_user_id, student_id):
            return jsonify({'error': 'Unauthorized'}), 403

        plan_date = _parse_plan_date(request.args.get('date'))
        plan = StudentSchedulePlan.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            plan_date=plan_date,
        ).first()
        settings = _get_student_planner_settings(group.id, student_id)
        timezone_name, school_timezone = _student_timezone(group, student_id, settings)
        school_now = datetime.now(school_timezone)
        challenge, member_habit = _planner_challenge_context(group, student_id)
        completion_windows = {}
        for habit_index, habit in enumerate((member_habit or {}).get('habits') or []):
            completion_access = _habit_completion_access(
                group,
                student_id,
                habit,
                habit_index,
                now=school_now,
                preferred_date=plan_date,
                plan=plan,
                settings=settings,
                challenge=challenge,
                member_habit=member_habit,
            )
            completion_access['streakRestore'] = _habit_streak_restore_quote(
                challenge,
                member_habit,
                habit,
                habit_index,
                plan_date,
                completion_access,
            )
            completion_windows[str(habit_index)] = completion_access
        return jsonify({
            'plan': plan.to_dict() if plan else {
                'groupId': group.id,
                'studentId': student_id,
                'planDate': plan_date.isoformat(),
                'constraintsText': '',
                'items': [],
            },
            'completionWindows': completion_windows,
            'completionPolicy': {
                'minutesBefore': 60,
                'minutesAfter': 60,
                'timezone': timezone_name,
                'serverNow': school_now.isoformat(),
            },
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
        if not is_planner_member(group, student_id):
            return jsonify({'error': 'Account not found in workspace'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only edit their own calendar'}), 403

        data = request.get_json() or {}
        plan_date = _parse_plan_date(data.get('date'))
        plan = StudentSchedulePlan.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            plan_date=plan_date,
        ).first()
        normalized_items = _normalize_saved_schedule_items(data.get('items'))
        settings = _get_student_planner_settings(group.id, student_id)
        schedule_error = _validate_same_day_habit_schedule_changes(
            group,
            student_id,
            plan_date,
            normalized_items,
            existing_plan=plan,
            existing_settings=settings,
        )
        if schedule_error:
            return jsonify({'error': schedule_error, 'code': 'HABIT_SCHEDULE_WINDOW_LOCKED'}), 403
        if not plan:
            plan = StudentSchedulePlan(group_id=group.id, student_id=student_id, plan_date=plan_date)
            db.session.add(plan)
        plan.constraints_text = str(data.get('constraintsText') or '').strip()[:4000] or None
        plan.items = normalized_items
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
        if not is_planner_member(group, student_id):
            return jsonify({'error': 'Account not found in workspace'}), 404
        if current_user_id != student_id:
            return jsonify({'error': 'Students can only generate their own calendar'}), 403

        data = request.get_json() or {}
        plan_date = _parse_plan_date(data.get('date'))
        constraints_text = str(data.get('constraintsText') or '').strip()[:4000]
        phase = str(data.get('phase') or 'generate').strip().lower()
        repeat_weekly = bool(data.get('repeatWeekly'))
        planning_scope = str(data.get('planningScope') or 'selected').strip()[:40]
        planner_settings = _get_student_planner_settings(group.id, student_id)
        _, member_habit = _planner_challenge_context(group, student_id)
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
                'habitType': habit.get('habitType') or 'boolean',
                'periodicIntervalHours': max(1, int(habit.get('periodicIntervalHours') or 4)),
                'periodicOccurrences': max(2, int(habit.get('periodicOccurrences') or 4)),
                'allowOverlap': bool(habit.get('allowOverlap')),
            })

        school_day_context, school_commute_items = _planner_school_day_context(
            group,
            plan_date.strftime('%A'),
            planner_settings,
        )
        school_items = list(school_commute_items)
        for entry in group.school_timetable or []:
            if entry.get('weekday') != plan_date.strftime('%A'):
                continue
            student_ids = [int(value) for value in (entry.get('studentIds') or []) if str(value).isdigit()]
            if student_ids and student_id not in student_ids:
                continue
            school_items.append({
                'id': f"school-{entry.get('id')}",
                'title': ' · '.join(filter(None, [entry.get('subject') or 'School', entry.get('className') or ''])),
                'itemType': 'school',
                'habitIndex': -1,
                'startTime': entry.get('startTime') or '',
                'endTime': entry.get('endTime') or '',
                'durationMinutes': _minutes_between(entry.get('startTime'), entry.get('endTime')),
                'locked': True,
                'reason': ' · '.join(filter(None, [entry.get('teacherName') or '', entry.get('room') or ''])) or 'School timetable',
                'source': 'school',
            })
        submitted_fixed_items = data.get('fixedItems')
        if not isinstance(submitted_fixed_items, list):
            submitted_fixed_items = data.get('manualItems')
        personal_fixed_items = [
            item for item in _normalize_saved_schedule_items(submitted_fixed_items)
            if item['itemType'] in {'manual', 'sleep', 'routine', 'google'}
        ]
        fixed_commitments = school_items + personal_fixed_items
        submitted_current_items = data.get('currentItems')
        current_personal_items = [
            item for item in _normalize_saved_schedule_items(submitted_current_items)
            if item['itemType'] != 'school'
        ]
        current_layout = school_items + current_personal_items
        if not current_layout:
            current_layout = fixed_commitments
        current_layout_context = _planner_ai_layout_context(current_layout)
        wake_time = next(
            (item['endTime'] for item in personal_fixed_items if item['itemType'] == 'sleep' and item['id'] == 'sleep-morning'),
            planner_settings.wake_time if planner_settings else '07:00',
        )
        bedtime = next(
            (item['startTime'] for item in personal_fixed_items if item['itemType'] == 'sleep' and item['id'] == 'sleep-evening'),
            planner_settings.bedtime if planner_settings else '22:00',
        )

        if phase == 'clarify':
            raw_clarification = create_structured_response(
                model=OPENAI_SCHEDULER_MODEL,
                system_prompt=(
                    "You are a concise time-planning coach. You can see the complete current layout, including movable "
                    "habits and breaks, plus fixed sleep, timetable, recurring reminders, one-off appointments, and Google Calendar events. "
                    "Interpret references such as 'move that later' from item titles and current times. Decide whether "
                    "missing information would materially change the result. Ask zero to three short questions only when "
                    "necessary. Ask about travel time, departure buffers, or transitions when an activity involves going "
                    "to a place and that information is unknown. Other useful topics include meals, deadlines, fixed "
                    "commitments, and energy preferences. Never ask for information already present in the notes, current "
                    "layout, habits, fixed commitments, wake time, or bedtime. If repeatWeekly is true, distinguish weekly "
                    "routines from one-off appointments. The schoolDay context is authoritative and already includes the "
                    "student's normal commute, so never ask for school travel information that it provides. If enough detail exists, return no questions."
                ),
                user_prompt=json.dumps({
                    'task': 'Check whether clarification is needed before organising this day.',
                    'date': plan_date.isoformat(),
                    'weekday': plan_date.strftime('%A'),
                    'studentConstraints': constraints_text,
                    'habits': habits,
                    'currentLayout': current_layout_context,
                    'fixedCommitments': fixed_commitments,
                    'schoolDay': school_day_context,
                    'wakeTime': wake_time,
                    'bedtime': bedtime,
                    'repeatWeekly': repeat_weekly,
                    'planningScope': planning_scope,
                }),
                schema_name='rituo_schedule_clarification',
                schema=build_schedule_clarification_schema(),
                max_output_tokens=900,
            )
            clarification = normalize_schedule_clarification(raw_clarification)
            clarification = _add_planner_clarification_question(
                clarification,
                _planner_travel_clarification(constraints_text, current_layout_context),
            )
            return jsonify({
                'clarification': clarification,
                'contract': structured_contract_metadata('rituo_schedule_clarification'),
            }), 200

        raw_answers = data.get('clarificationAnswers') or {}
        clarification_answers = {
            str(question_id)[:60]: str(answer or '').strip()[:500]
            for question_id, answer in raw_answers.items()
            if str(answer or '').strip()
        } if isinstance(raw_answers, dict) else {}

        schedule_system_prompt = (
            "You are a time-planning assistant. Build a realistic single-day plan using the complete current layout "
            "as the baseline. Preserve sensible existing placements unless the user's notes, clarification answers, "
            "conflicts, or wellbeing needs justify changing them. Resolve references to existing blocks from their "
            "titles and current times. "
            "Schedule every non-periodic habit exactly once around locked school, sleep, and manual commitments. "
            "For periodic habits, create the requested number of occurrences, spaced by the requested interval across waking hours. "
            "Respect durations and avoid overlaps unless a habit has allowOverlap true; those short occurrences may overlap another block. "
            "Use clarification answers, including commute times, and add realistic travel or transition buffers as break blocks when needed. "
            "When schoolDay is supplied, protect the full school day and its commute from ordinary habit scheduling. Only use a listed "
            "school break or lunch for a short suitable habit when the user explicitly requests it or a periodic overlapping habit allows it. "
            "Never move, copy, rename, or reproduce fixed commitments, including imported Google Calendar events. Never output a break block that represents an existing "
            "lesson, appointment, meeting, class, routine, sleep block, or Google event. Break blocks are only for genuine free transition, travel, meal, or recovery time. "
            "Weekly routines recur; manual appointments are one-off. When repeatWeekly is true, "
            "create a stable repeatable pattern and do not assume one-off appointments recur. "
            "Every habit item's reason must briefly explain why its time suits the user's request, answers, and surrounding commitments. "
            "Return the complete replacement set of habit and break items, not only the blocks that changed. Fixed commitments are merged by the application."
        )
        schedule_request_payload = {
            'task': 'Schedule the habits for this day.',
            'date': plan_date.isoformat(),
            'weekday': plan_date.strftime('%A'),
            'studentConstraints': constraints_text,
            'clarificationAnswers': clarification_answers,
            'habits': habits,
            'currentLayout': current_layout_context,
            'fixedCommitments': fixed_commitments,
            'schoolDay': school_day_context,
            'dayBounds': {'earliest': wake_time, 'latest': bedtime},
            'repeatWeekly': repeat_weekly,
            'planningScope': planning_scope,
        }
        raw_plan = create_structured_response(
            model=OPENAI_SCHEDULER_MODEL,
            system_prompt=schedule_system_prompt,
            user_prompt=json.dumps(schedule_request_payload),
            schema_name='rituo_daily_schedule',
            schema=build_daily_schedule_schema(),
            max_output_tokens=2200,
        )
        normalized_plan = normalize_daily_schedule(raw_plan)
        coverage_issues = _planner_schedule_coverage_issues(normalized_plan['items'], habits)
        if coverage_issues:
            repair_payload = {
                **schedule_request_payload,
                'task': 'Repair the incomplete schedule and return a complete replacement schedule.',
                'previousIncompletePlan': normalized_plan,
                'coverageIssues': coverage_issues,
            }
            raw_plan = create_structured_response(
                model=OPENAI_SCHEDULER_MODEL,
                system_prompt=(
                    f"{schedule_system_prompt} The previous response omitted or duplicated required habits. "
                    "Correct every listed coverage issue and return the whole day again."
                ),
                user_prompt=json.dumps(repair_payload),
                schema_name='rituo_daily_schedule',
                schema=build_daily_schedule_schema(),
                max_output_tokens=2200,
            )
            normalized_plan = normalize_daily_schedule(raw_plan)
            coverage_issues = _planner_schedule_coverage_issues(normalized_plan['items'], habits)
        if coverage_issues:
            return jsonify({
                'error': 'The AI returned an incomplete schedule, so no planner changes were applied. Please try again.',
                'code': 'AI_SCHEDULE_INCOMPLETE',
                'coverageIssues': coverage_issues,
            }), 422
        allowed_habit_indexes = {habit['habitIndex'] for habit in habits}
        generated_items = [
            item for item in normalized_plan['items']
            if item['itemType'] == 'break' or (
                item['itemType'] == 'habit' and item['habitIndex'] in allowed_habit_indexes
            )
        ]
        generated_items = _filter_generated_breaks_against_fixed_items(generated_items, fixed_commitments)
        persisted_fixed_items = [item for item in fixed_commitments if item['itemType'] != 'routine']
        combined_items = _normalize_saved_schedule_items(persisted_fixed_items + generated_items)

        return jsonify({
            'plan': {
                'groupId': group.id,
                'studentId': student_id,
                'planDate': plan_date.isoformat(),
                'constraintsText': constraints_text,
                'items': combined_items,
            },
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

        data = request.get_json() or {}
        habits_payload = data.get('habits', [])
        challenge, member_habit = _planner_challenge_context(
            group,
            student_id,
            challenge_id=data.get('challengeId'),
        )
        if not member_habit:
            if not habits_payload:
                return jsonify({'memberHabit': None}), 200
            return jsonify({'error': 'You are not in an active challenge'}), 404

        habits_by_index = {int(item.get('index')): item for item in habits_payload if item.get('index') is not None}

        _, school_timezone = _student_timezone(
            group,
            student_id,
            _get_student_planner_settings(group.id, student_id),
        )
        today_value = datetime.now(school_timezone).date()
        today_plan = StudentSchedulePlan.query.filter_by(
            group_id=group.id,
            student_id=student_id,
            plan_date=today_value,
        ).first()
        if not today_plan or not today_plan.items:
            proposed_default_items = []
            for index, habit in enumerate(member_habit.get('habits', [])):
                proposed_habit = dict(habit)
                update = habits_by_index.get(index)
                if update:
                    proposed_habit['scheduleTime'] = (update.get('scheduleTime') or '').strip()
                    try:
                        proposed_habit['durationMinutes'] = max(5, int(update.get('durationMinutes', 30) or 30))
                    except (TypeError, ValueError):
                        proposed_habit['durationMinutes'] = 30
                proposed_default_items.extend({
                    **item,
                    'itemType': 'habit',
                } for item in build_default_habit_schedule_items(proposed_habit, index))
            schedule_error = _validate_same_day_habit_schedule_changes(
                group,
                student_id,
                today_value,
                proposed_default_items,
                existing_plan=today_plan,
                existing_settings=_get_student_planner_settings(group.id, student_id),
            )
            if schedule_error:
                return jsonify({'error': schedule_error, 'code': 'HABIT_SCHEDULE_WINDOW_LOCKED'}), 403

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

        if getattr(group, 'group_type', 'school') == 'staff':
            challenge.habits = member_habit.get('habits') or []
            flag_modified(challenge, 'habits')
        else:
            flag_modified(group.active_challenge, 'member_habits')
        db.session.commit()

        if getattr(group, 'group_type', 'school') == 'staff':
            return jsonify({'memberHabit': member_habit}), 200
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


def _staff_workspace_context(group_id):
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return None, None, (jsonify({'error': 'Workspace not found'}), 404)
    user = User.query.get(int(get_jwt_identity()))
    if getattr(group, 'group_type', 'school') != 'staff':
        return None, None, (jsonify({'error': 'This is not a Coaches HQ workspace'}), 400)
    if not is_staff_group_member(group, user):
        return None, None, (jsonify({'error': 'Coaches HQ access is restricted to its admin and coach members'}), 403)
    return group, user, None


def _staff_member_display_name(user):
    full_name = ' '.join(part for part in (user.first_name, user.last_name) if part).strip()
    return full_name or user.username


def _staff_member_timezone(group, member_id, requested_timezone=None):
    candidate = str(requested_timezone or '').strip()
    if candidate:
        timezone_name, timezone_value = resolve_timezone(candidate)
        if timezone_name == candidate:
            return timezone_name, timezone_value
    return _student_timezone(group, member_id)


def _finalize_staff_challenges(group):
    updated = False
    challenges = StaffPersonalChallenge.query.filter_by(group_id=group.id, status='active').all()
    for challenge in challenges:
        _, member_timezone = _staff_member_timezone(group, challenge.member_id)
        member_today = datetime.now(member_timezone).date()
        end_date = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
        if end_date and end_date < member_today:
            challenge.status = 'completed'
            challenge.updated_at = datetime.utcnow()
            updated = True
    return updated


def build_chat_reader_profiles(messages):
    reader_ids = set()
    for message in messages:
        try:
            reader_ids.update(int(user_id) for user_id in json.loads(message.read_by or '[]'))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
    if not reader_ids:
        return {}
    users = User.query.filter(User.id.in_(reader_ids)).all()
    return {
        str(user.id): {
            'userId': user.id,
            'username': user.username
        }
        for user in users
    }


def _build_staff_hub_payload(group, viewer, requested_timezone=None):
    members = get_staff_group_members(group)
    challenges = StaffPersonalChallenge.query.filter_by(group_id=group.id).order_by(
        StaffPersonalChallenge.created_at.desc()
    ).all()
    challenges_by_member = defaultdict(list)
    for challenge in challenges:
        challenges_by_member[challenge.member_id].append(challenge)

    member_rows = []
    for member in members:
        member_challenges = challenges_by_member.get(member.id) or []
        current_challenge = next((challenge for challenge in member_challenges if challenge.status == 'active'), None)
        member_timezone_name, member_timezone = _staff_member_timezone(
            group,
            member.id,
            requested_timezone if member.id == viewer.id else None,
        )
        member_today = datetime.now(member_timezone).date()
        challenge_payload = None
        stats = None
        completion_windows = {}
        score = 0.0
        today_rate = None
        if current_challenge:
            stats = _build_group_member_habit_statistics(
                group,
                current_challenge,
                _staff_challenge_member_entry(current_challenge),
                member.id,
                today_value=member_today,
            )
            summary = stats.get('summary') or {}
            score = float(summary.get('completionRate') or 0)
            today_row = summary.get('today') or {}
            today_rate = today_row.get('completionRate') if today_row else None
            challenge_payload = current_challenge.to_dict()
            challenge_start = current_challenge.start_date.date()
            challenge_end = current_challenge.end_date.date()
            if member.id == viewer.id and challenge_start <= member_today <= challenge_end:
                current_time = datetime.now(member_timezone)
                staff_member_habit = _staff_challenge_member_entry(current_challenge)
                for index, habit in enumerate(current_challenge.habits or []):
                    completion_access = _staff_habit_completion_access(
                        group,
                        current_challenge,
                        member.id,
                        habit,
                        index,
                        current_time,
                    )
                    completion_access['streakRestore'] = _habit_streak_restore_quote(
                        current_challenge,
                        staff_member_habit,
                        habit,
                        index,
                        member_today,
                        completion_access,
                    )
                    completion_windows[str(index)] = completion_access
        member_rows.append({
            'memberId': member.id,
            'username': member.username,
            'name': _staff_member_display_name(member),
            'accountRole': member.account_role,
            'isLeader': member.id == group.leader_id,
            'isViewer': member.id == viewer.id,
            'timezone': member_timezone_name,
            'today': member_today.isoformat(),
            'challenge': challenge_payload,
            'stats': stats,
            'completionWindows': completion_windows,
            'score': round(score, 1),
            'todayRate': round(float(today_rate), 1) if today_rate is not None else None,
            'historyCount': sum(1 for challenge in member_challenges if challenge.status == 'completed'),
        })

    leaderboard = sorted(
        member_rows,
        key=lambda row: (
            0 if row.get('challenge') else 1,
            -row['score'],
            -int((row.get('stats') or {}).get('summary', {}).get('currentActiveStreak') or 0),
            row['name'].lower(),
        ),
    )
    for rank, row in enumerate(leaderboard, start=1):
        row['rank'] = rank

    viewer_history = [
        challenge.to_dict()
        for challenge in challenges_by_member.get(viewer.id, [])
        if challenge.status == 'completed'
    ][:12]
    return {
        'group': {
            'id': group.id,
            'groupId': group.group_id,
            'name': group.name,
            'leaderId': group.leader_id,
        },
        'viewerId': viewer.id,
        'members': member_rows,
        'leaderboard': leaderboard,
        'slackerCallout': build_staff_slacker_callout(member_rows),
        'history': viewer_history,
        'rules': {
            'independentChallenges': True,
            'completionWindowMinutesBefore': 60,
            'completionWindowMinutesAfter': 60,
            'featuresIncluded': True,
            'avatarItemsUseIpBucks': True,
        },
    }


@groups_bp.route('/<group_id>/staff-hub', methods=['GET'])
@jwt_required()
def get_staff_hub(group_id):
    try:
        group, user, error = _staff_workspace_context(group_id)
        if error:
            return error
        if _finalize_staff_challenges(group):
            db.session.commit()
        return jsonify({'hub': _build_staff_hub_payload(group, user, request.args.get('timezone'))}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/staff-challenges', methods=['POST'])
@jwt_required()
def create_staff_personal_challenge(group_id):
    try:
        group, user, error = _staff_workspace_context(group_id)
        if error:
            return error
        data = request.get_json() or {}
        timezone_name, member_timezone = _staff_member_timezone(group, user.id, data.get('deviceTimezone'))
        member_today = datetime.now(member_timezone).date()
        try:
            start_date = date.fromisoformat(str(data.get('startDate') or '')[:10])
            end_date = date.fromisoformat(str(data.get('endDate') or '')[:10])
        except ValueError:
            return jsonify({'error': 'Valid start and end dates are required'}), 400
        if start_date < member_today:
            return jsonify({'error': 'A new personal challenge cannot start in the past'}), 400
        if end_date < start_date:
            return jsonify({'error': 'The challenge end date must be on or after its start date'}), 400
        if (end_date - start_date).days > 365:
            return jsonify({'error': 'Keep a personal challenge to 365 days or fewer'}), 400
        _finalize_staff_challenges(group)
        existing = StaffPersonalChallenge.query.filter_by(
            group_id=group.id,
            member_id=user.id,
            status='active',
        ).first()
        if existing:
            return jsonify({'error': 'Finish your current personal challenge before starting another'}), 409
        habits = normalize_staff_challenge_habits(data.get('habits'))
        settings = _get_student_planner_settings(group.id, user.id, create=True)
        settings.timezone_name = timezone_name
        settings.updated_at = datetime.utcnow()
        challenge = StaffPersonalChallenge(
            group_id=group.id,
            member_id=user.id,
            title=str(data.get('title') or 'My personal challenge').strip()[:140] or 'My personal challenge',
            start_date=datetime.fromisoformat(f'{start_date.isoformat()}T00:00:00'),
            end_date=datetime.fromisoformat(f'{end_date.isoformat()}T23:59:59'),
            habits=habits,
            status='active',
        )
        db.session.add(challenge)
        db.session.commit()
        return jsonify({
            'message': 'Personal challenge started',
            'hub': _build_staff_hub_payload(group, user, timezone_name),
        }), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/staff-challenges/<int:challenge_id>', methods=['PUT'])
@jwt_required()
def update_staff_personal_challenge(group_id, challenge_id):
    try:
        group, user, error = _staff_workspace_context(group_id)
        if error:
            return error
        challenge = StaffPersonalChallenge.query.filter_by(
            id=challenge_id,
            group_id=group.id,
            member_id=user.id,
            status='active',
        ).first()
        if not challenge:
            return jsonify({'error': 'Active personal challenge not found'}), 404
        data = request.get_json() or {}
        if 'title' in data:
            challenge.title = str(data.get('title') or '').strip()[:140] or challenge.title
        if 'endDate' in data:
            try:
                end_date = date.fromisoformat(str(data.get('endDate') or '')[:10])
            except ValueError:
                return jsonify({'error': 'A valid end date is required'}), 400
            if end_date < challenge.start_date.date():
                return jsonify({'error': 'The end date cannot be before the start date'}), 400
            challenge.end_date = datetime.fromisoformat(f'{end_date.isoformat()}T23:59:59')
        if 'habits' in data:
            challenge.habits = normalize_staff_challenge_habits(data.get('habits'), challenge.habits)
            flag_modified(challenge, 'habits')
        challenge.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'message': 'Personal challenge updated',
            'hub': _build_staff_hub_payload(group, user, data.get('deviceTimezone')),
        }), 200
    except ValueError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/staff-challenges/<int:challenge_id>/complete', methods=['POST'])
@jwt_required()
def complete_staff_personal_challenge(group_id, challenge_id):
    try:
        group, user, error = _staff_workspace_context(group_id)
        if error:
            return error
        challenge = StaffPersonalChallenge.query.filter_by(
            id=challenge_id,
            group_id=group.id,
            member_id=user.id,
            status='active',
        ).first()
        if not challenge:
            return jsonify({'error': 'Active personal challenge not found'}), 404
        challenge.status = 'completed'
        challenge.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'message': 'Challenge moved to your history',
            'hub': _build_staff_hub_payload(group, user, (request.get_json() or {}).get('deviceTimezone')),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/staff-challenges/<int:challenge_id>/habits/<int:habit_index>/progress', methods=['POST'])
@jwt_required()
def update_staff_personal_habit_progress(group_id, challenge_id, habit_index):
    try:
        group, user, error = _staff_workspace_context(group_id)
        if error:
            return error
        challenge = StaffPersonalChallenge.query.filter_by(
            id=challenge_id,
            group_id=group.id,
            member_id=user.id,
            status='active',
        ).first()
        if not challenge:
            return jsonify({'error': 'Active personal challenge not found'}), 404
        try:
            habit = (challenge.habits or [])[habit_index]
        except IndexError:
            return jsonify({'error': 'Habit not found'}), 404
        data = request.get_json() or {}
        timezone_name, member_timezone = _staff_member_timezone(group, user.id, data.get('deviceTimezone'))
        settings = _get_student_planner_settings(group.id, user.id, create=True)
        settings.timezone_name = timezone_name
        settings.updated_at = datetime.utcnow()
        current_time = datetime.now(member_timezone)
        completion_access = _staff_habit_completion_access(group, challenge, user.id, habit, habit_index, current_time)
        progress_date = date.fromisoformat(completion_access['date'])
        if progress_date < challenge.start_date.date() or progress_date > challenge.end_date.date():
            return jsonify({'error': 'This habit is outside your challenge dates'}), 403
        if not completion_access.get('windowOpen'):
            return _completion_window_error(completion_access)
        progress_entry = _habit_progress_for_date(habit, progress_date)
        if not progress_entry:
            progress_entry = {'date': progress_date.isoformat(), 'completed': False}
            habit.setdefault('progress', []).append(progress_entry)

        habit_type = habit.get('habitType') or 'boolean'
        was_completed = bool(progress_entry.get('completed'))
        if habit_type == 'numeric':
            try:
                value = float(data.get('value'))
            except (TypeError, ValueError):
                return jsonify({'error': 'A numeric value is required'}), 400
            minimum = float(habit.get('minValue') or 0)
            maximum = float(habit.get('maxValue') or 10)
            if value < minimum or value > maximum:
                return jsonify({'error': f'Value must be between {minimum:g} and {maximum:g}'}), 400
            progress_entry['numericValue'] = value
            progress_entry['completed'] = value >= maximum
        elif habit_type == 'text':
            value = str(data.get('value') or '').strip()
            if not value:
                return jsonify({'error': 'Write a response before saving'}), 400
            progress_entry['textValue'] = value[:2000]
            progress_entry['completed'] = True
        elif habit_type == 'periodic':
            target = max(1, int(
                completion_access.get('eligibleOccurrenceCount')
                or habit.get('periodicOccurrences')
                or 4
            ))
            logged = list(progress_entry.get('periodicLoggedOccurrences') or [])
            occurrence_index = completion_access.get('activeOccurrenceIndex')
            if occurrence_index is None or occurrence_index in logged:
                return _completion_window_error(completion_access)
            logged = sorted(set(logged + [occurrence_index]))
            progress_entry['periodicLoggedOccurrences'] = logged
            progress_entry['periodicCompleted'] = min(target, len(logged))
            progress_entry['periodicTarget'] = target
            progress_entry['completed'] = len(logged) >= target
        else:
            progress_entry['completed'] = not was_completed

        if progress_entry.get('completed'):
            progress_entry['completedAt'] = datetime.now(timezone.utc).isoformat()
        else:
            progress_entry.pop('completedAt', None)
        challenge.habits = list(challenge.habits or [])
        flag_modified(challenge, 'habits')
        challenge.updated_at = datetime.utcnow()
        if progress_entry.get('completed') and not was_completed:
            db.session.add(Message(
                group_id=group.id,
                sender_id=user.id,
                content=f"{_staff_member_display_name(user)} completed {habit.get('name') or 'a personal habit'} — receipts officially filed.",
                message_type='system',
            ))
        db.session.commit()
        return jsonify({
            'message': 'Progress recorded',
            'completionWindow': _staff_habit_completion_access(group, challenge, user.id, habit, habit_index, current_time),
            'hub': _build_staff_hub_payload(group, user, timezone_name),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/staff-challenges/<int:challenge_id>/habits/<int:habit_index>/restore-streak', methods=['POST'])
@jwt_required()
def restore_staff_personal_habit_streak(group_id, challenge_id, habit_index):
    try:
        group, user, error = _staff_workspace_context(group_id)
        if error:
            return error
        challenge = StaffPersonalChallenge.query.filter_by(
            id=challenge_id,
            group_id=group.id,
            member_id=user.id,
            status='active',
        ).first()
        if not challenge:
            return jsonify({'error': 'Active personal challenge not found'}), 404
        try:
            habit = (challenge.habits or [])[habit_index]
        except IndexError:
            return jsonify({'error': 'Habit not found'}), 404

        data = request.get_json() or {}
        timezone_name, member_timezone = _staff_member_timezone(group, user.id, data.get('deviceTimezone'))
        current_time = datetime.now(member_timezone)
        target_date = current_time.date()
        member_habit = _staff_challenge_member_entry(challenge)
        completion_access = _staff_habit_completion_access(
            group,
            challenge,
            user.id,
            habit,
            habit_index,
            current_time,
        )
        quote = _habit_streak_restore_quote(
            challenge,
            member_habit,
            habit,
            habit_index,
            target_date,
            completion_access,
        )
        wallet, _ = _sync_student_ip_bucks(group, user.id, today_value=target_date)
        if quote['alreadyRestored']:
            db.session.commit()
            return jsonify({
                'message': 'This streak is already protected',
                'alreadyRestored': True,
                'wallet': wallet.to_dict(),
                'streakRestore': quote,
                'hub': _build_staff_hub_payload(group, user, timezone_name),
            }), 200
        if not quote['eligible']:
            if completion_access.get('status') != 'closed':
                message = 'A streak can only be protected after every completion window for today has closed.'
            elif quote['progressPercent'] >= 100:
                message = 'This habit was completed, so its streak does not need restoring.'
            elif quote['atRiskStreak'] < 1:
                message = 'There is no previous streak to restore for this habit.'
            else:
                message = 'This streak cannot be restored.'
            db.session.rollback()
            return jsonify({'error': message, 'wallet': wallet.to_dict(), 'streakRestore': quote}), 409

        cost = int(quote['cost'])
        if int(wallet.balance or 0) < cost:
            db.session.rollback()
            return jsonify({
                'error': f'You need {cost - int(wallet.balance or 0)} more IP Bucks to protect this streak.',
                'wallet': wallet.to_dict(),
                'streakRestore': quote,
            }), 409

        reference_key = f'streak-restore:staff:v1:g{group.id}:c{challenge.id}:s{user.id}:h{habit_index}:d{target_date.isoformat()}'
        if StudentIpTransaction.query.filter_by(reference_key=reference_key).first():
            db.session.rollback()
            return jsonify({'error': 'This streak restoration has already been processed.'}), 409

        progress_entry = _habit_progress_for_date(habit, target_date)
        if not progress_entry:
            progress_entry = {'date': target_date.isoformat(), 'completed': False}
            habit.setdefault('progress', []).append(progress_entry)
        progress_entry['streakRestored'] = True
        progress_entry['streakRestoredAt'] = datetime.now(timezone.utc).isoformat()
        progress_entry['streakRestoreCost'] = cost
        progress_entry['streakRestoredFrom'] = quote['atRiskStreak']

        wallet.balance = int(wallet.balance or 0) - cost
        wallet.lifetime_spent = int(wallet.lifetime_spent or 0) + cost
        wallet.updated_at = datetime.utcnow()
        db.session.add(StudentIpTransaction(
            wallet_id=wallet.id,
            group_id=group.id,
            amount=-cost,
            kind='streak_restore',
            reference_key=reference_key,
            description=f"Protected a {quote['atRiskStreak']}-occasion streak for {habit.get('name') or 'a habit'}",
            details={
                'challengeId': challenge.id,
                'habitIndex': habit_index,
                'habitName': habit.get('name') or f'Habit {habit_index + 1}',
                'date': target_date.isoformat(),
                'restoredStreak': quote['atRiskStreak'],
                'cost': cost,
                'timezone': timezone_name,
            },
        ))
        challenge.habits = list(challenge.habits or [])
        flag_modified(challenge, 'habits')
        challenge.updated_at = datetime.utcnow()
        settings = _get_student_planner_settings(group.id, user.id, create=True)
        settings.timezone_name = timezone_name
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'message': f"Your {quote['atRiskStreak']}-occasion streak is protected.",
            'wallet': wallet.to_dict(),
            'streakRestore': {
                **quote,
                'eligible': False,
                'alreadyRestored': True,
            },
            'hub': _build_staff_hub_payload(group, user, timezone_name),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


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
            if 'staff' in {group.group_type, new_group_type} and group.group_type != new_group_type:
                return jsonify({'error': 'Coaches HQ workspaces must be created as new workspaces'}), 400
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

        StaffPersonalChallenge.query.filter_by(group_id=group.id).delete()

        # 6. Delete challenges (member habits will be cascade deleted)
        GroupChallenge.query.filter_by(group_id=group.id).delete()

        # 7. Delete the group itself
        db.session.delete(group)
        db.session.commit()
        
        return jsonify({'message': 'Group deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/habit/<int:habit_index>/restore-streak', methods=['POST'])
@jwt_required()
def restore_group_habit_streak(group_id, challenge_id, habit_index):
    try:
        user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group or not group.active_challenge or group.active_challenge.id != challenge_id:
            return jsonify({'error': 'Group or active challenge not found'}), 404

        challenge = group.active_challenge
        member_habits = list(challenge.member_habits or [])
        member_habit = next(
            (
                entry for entry in member_habits
                if str(
                    (entry.get('member') or {}).get('id')
                    if isinstance(entry.get('member'), dict)
                    else entry.get('member')
                ) == str(user_id)
            ),
            None,
        )
        if not member_habit:
            return jsonify({'error': 'Member not found in challenge'}), 404
        try:
            habit = (member_habit.get('habits') or [])[habit_index]
        except IndexError:
            return jsonify({'error': 'Habit not found'}), 404

        timezone_name, member_timezone = _student_timezone(group, user_id)
        current_time = datetime.now(member_timezone)
        target_date = current_time.date()
        completion_access = _habit_completion_access(
            group,
            user_id,
            habit,
            habit_index,
            now=current_time,
            preferred_date=target_date,
            challenge=challenge,
            member_habit=member_habit,
        )
        quote = _habit_streak_restore_quote(
            challenge,
            member_habit,
            habit,
            habit_index,
            target_date,
            completion_access,
        )
        wallet, _ = _sync_student_ip_bucks(group, user_id, today_value=target_date)
        if quote['alreadyRestored']:
            db.session.commit()
            return jsonify({
                'message': 'This streak is already protected',
                'alreadyRestored': True,
                'wallet': wallet.to_dict(),
                'streakRestore': quote,
            }), 200
        if not quote['eligible']:
            if completion_access.get('status') != 'closed':
                message = 'A streak can only be protected after every completion window for today has closed.'
            elif quote['progressPercent'] >= 100:
                message = 'This habit was completed, so its streak does not need restoring.'
            elif quote['atRiskStreak'] < 1:
                message = 'There is no previous streak to restore for this habit.'
            else:
                message = 'This streak cannot be restored.'
            db.session.rollback()
            return jsonify({'error': message, 'streakRestore': quote}), 409

        cost = int(quote['cost'])
        if int(wallet.balance or 0) < cost:
            db.session.rollback()
            return jsonify({
                'error': f'You need {cost - int(wallet.balance or 0)} more IP Bucks to protect this streak.',
                'wallet': wallet.to_dict(),
                'streakRestore': quote,
            }), 409

        reference_key = f'streak-restore:v1:g{group.id}:c{challenge.id}:s{user_id}:h{habit_index}:d{target_date.isoformat()}'
        existing_transaction = StudentIpTransaction.query.filter_by(reference_key=reference_key).first()
        if existing_transaction:
            db.session.rollback()
            return jsonify({'error': 'This streak restoration has already been processed.'}), 409

        progress_entry = _habit_progress_for_date(habit, target_date)
        if not progress_entry:
            progress_entry = {'date': target_date.isoformat(), 'completed': False}
            habit.setdefault('progress', []).append(progress_entry)
        progress_entry['streakRestored'] = True
        progress_entry['streakRestoredAt'] = datetime.now(timezone.utc).isoformat()
        progress_entry['streakRestoreCost'] = cost
        progress_entry['streakRestoredFrom'] = quote['atRiskStreak']

        wallet.balance = int(wallet.balance or 0) - cost
        wallet.lifetime_spent = int(wallet.lifetime_spent or 0) + cost
        wallet.updated_at = datetime.utcnow()
        db.session.add(StudentIpTransaction(
            wallet_id=wallet.id,
            group_id=group.id,
            amount=-cost,
            kind='streak_restore',
            reference_key=reference_key,
            description=f"Protected a {quote['atRiskStreak']}-occasion streak for {habit.get('name') or 'a habit'}",
            details={
                'challengeId': challenge.id,
                'habitIndex': habit_index,
                'habitName': habit.get('name') or f'Habit {habit_index + 1}',
                'date': target_date.isoformat(),
                'restoredStreak': quote['atRiskStreak'],
                'cost': cost,
                'timezone': timezone_name,
            },
        ))
        challenge.member_habits = member_habits
        flag_modified(challenge, 'member_habits')
        db.session.commit()
        return jsonify({
            'message': f"Your {quote['atRiskStreak']}-occasion streak is protected.",
            'wallet': wallet.to_dict(),
            'streakRestore': {
                **quote,
                'eligible': False,
                'alreadyRestored': True,
            },
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc), 'traceback': traceback.format_exc()}), 500


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

    # Get user info for the message
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    school_now = datetime.now(_student_timezone(group, int(user_id))[1])
    completion_access = _habit_completion_access(group, int(user_id), habit, habit_index, now=school_now)
    progress_date = completion_access['date']
    progress_entry = next(
        (entry for entry in (habit.get('progress') or []) if str(entry.get('date') or '')[:10] == progress_date),
        None,
    )
    if not progress_entry:
        if not completion_access.get('windowOpen'):
            return _completion_window_error(completion_access)
        progress_entry = {'date': progress_date, 'completed': False}
        habit.setdefault('progress', []).append(progress_entry)

    # Toggle completion, or advance one occurrence for periodic habits.
    was_completed = progress_entry['completed']
    if habit.get('habitType') == 'periodic':
        target_occurrences = max(1, int(
            completion_access.get('eligibleOccurrenceCount')
            or habit.get('periodicOccurrences')
            or 4
        ))
        if progress_entry['completed']:
            logged_occurrences = []
            progress_entry['periodicLoggedAt'] = {}
        else:
            if not completion_access.get('windowOpen'):
                return _completion_window_error(completion_access)
            logged_occurrences = list(progress_entry.get('periodicLoggedOccurrences') or [])
            if not logged_occurrences:
                legacy_count = max(0, int(progress_entry.get('periodicCompleted') or 0))
                eligible_indexes = completion_access.get('eligibleOccurrenceIndexes') or list(range(target_occurrences))
                logged_occurrences = eligible_indexes[:legacy_count]
            occurrence_index = completion_access.get('activeOccurrenceIndex')
            if occurrence_index is None or occurrence_index in logged_occurrences:
                return _completion_window_error(completion_access)
            logged_occurrences.append(occurrence_index)
            logged_occurrences = sorted(set(logged_occurrences))
            logged_at = dict(progress_entry.get('periodicLoggedAt') or {})
            logged_at[str(occurrence_index)] = datetime.now(timezone.utc).isoformat()
            progress_entry['periodicLoggedAt'] = logged_at
        current_occurrences = min(target_occurrences, len(logged_occurrences))
        progress_entry['periodicLoggedOccurrences'] = logged_occurrences
        progress_entry['periodicCompleted'] = current_occurrences
        progress_entry['periodicTarget'] = target_occurrences
        progress_entry['completed'] = current_occurrences >= target_occurrences
    else:
        if not progress_entry['completed'] and not completion_access.get('windowOpen'):
            return _completion_window_error(completion_access)
        progress_entry['completed'] = not progress_entry['completed']
    if progress_entry['completed']:
        progress_entry['completedAt'] = datetime.now(timezone.utc).isoformat()
    else:
        progress_entry.pop('completedAt', None)

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

    return jsonify({
        'success': True,
        'completed': progress_entry['completed'],
        'periodicCompleted': progress_entry.get('periodicCompleted'),
        'periodicTarget': progress_entry.get('periodicTarget'),
        'completionWindow': _habit_completion_access(group, int(user_id), habit, habit_index, now=school_now),
    })

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

    school_now = datetime.now(_student_timezone(group, int(user_id))[1])
    completion_access = _habit_completion_access(group, int(user_id), habit, habit_index, now=school_now)
    if not completion_access.get('windowOpen'):
        return _completion_window_error(completion_access)
    progress_date = completion_access['date']
    progress_entry = next(
        (entry for entry in (habit.get('progress') or []) if str(entry.get('date') or '')[:10] == progress_date),
        None,
    )
    if not progress_entry:
        progress_entry = {'date': progress_date, 'completed': False, 'numericValue': None}
        habit.setdefault('progress', []).append(progress_entry)

    # Update numeric value and mark as completed
    progress_entry['numericValue'] = value
    progress_entry['completed'] = True
    progress_entry['completedAt'] = datetime.now(timezone.utc).isoformat()

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

    return jsonify({
        'success': True,
        'numericValue': value,
        'completionWindow': _habit_completion_access(group, int(user_id), habit, habit_index, now=school_now),
    })

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

    school_now = datetime.now(_student_timezone(group, int(user_id))[1])
    completion_access = _habit_completion_access(group, int(user_id), habit, habit_index, now=school_now)
    if not completion_access.get('windowOpen'):
        return _completion_window_error(completion_access)
    progress_date = completion_access['date']
    progress_entry = next(
        (entry for entry in (habit.get('progress') or []) if str(entry.get('date') or '')[:10] == progress_date),
        None,
    )
    if not progress_entry:
        progress_entry = {'date': progress_date, 'completed': False, 'textValue': None}
        habit.setdefault('progress', []).append(progress_entry)

    # Update text value and mark as completed
    progress_entry['textValue'] = value.strip()
    progress_entry['completed'] = True
    progress_entry['completedAt'] = datetime.now(timezone.utc).isoformat()

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

    return jsonify({
        'success': True,
        'textValue': value.strip(),
        'completionWindow': _habit_completion_access(group, int(user_id), habit, habit_index, now=school_now),
    })

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
        'channel': context['channel'],
        'readers': build_chat_reader_profiles(messages)
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
    if len(content) > 2000:
        return jsonify({'error': 'Messages can be at most 2,000 characters'}), 400
    msg = Message(
        group_id=group.id,
        sender_id=user.id,
        class_id=context['class_id'],
        content=content,
        read_by=json.dumps([user.id])
    )
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
            total_days = (challenge.end_date - challenge.start_date).days + 1
            total_members = len(challenge.member_habits)
            total_possible_completions = 0
            total_actual_completions = 0.0
            member_stats = []
            member_statistics = []
            for member_habit in challenge.member_habits:
                raw_member_id = member_habit.get('member')
                member_id = raw_member_id.get('id') if isinstance(raw_member_id, dict) else raw_member_id
                member = User.query.get(member_id)
                if not member:
                    continue
                statistics = _build_group_member_habit_statistics(
                    group,
                    challenge,
                    member_habit,
                    member_id,
                    today_value=challenge.end_date.date(),
                )
                member_statistics.append(statistics)
                summary = statistics['summary']
                habit_details = [{
                    'name': habit['name'],
                    'type': habit['habitType'],
                    'combat_type': habit['combatType'],
                    'completed_days': habit['fullCount'],
                    'partial_days': habit['partialCount'],
                    'missed_days': habit['missedCount'],
                    'earned_units': habit['earnedUnits'],
                    'total_days': habit['possibleUnits'],
                    'completion_rate': habit['completionRate'],
                    'periodic_completed': habit['periodicCompleted'],
                    'periodic_target': habit['periodicTarget'],
                } for habit in statistics['habits']]
                total_possible_completions += summary['possibleUnits']
                total_actual_completions += summary['earnedUnits']
                member_stats.append({
                    'id': member_id,
                    'username': member.username,
                    'days_completed': summary['activeDays'],
                    'perfect_days': summary['perfectDays'],
                    'partial_days': summary['partialDays'],
                    'total_days': summary['scheduledDays'],
                    'completion_rate': summary['completionRate'],
                    'habit_details': habit_details,
                    'total_habit_completions': summary['earnedUnits'],
                    'total_possible_habit_completions': summary['possibleUnits'],
                    'periodic_completed': summary['periodicCompleted'],
                    'periodic_target': summary['periodicTarget'],
                })

            overall_completion_rate = (total_actual_completions / total_possible_completions * 100) if total_possible_completions > 0 else 0
            daily_progress = []
            for day_offset in range(total_days):
                current_date = challenge.start_date.date() + timedelta(days=day_offset)
                date_str = current_date.isoformat()
                user_daily_averages = [
                    row['completionRate']
                    for statistics in member_statistics
                    for row in statistics['daily']
                    if row['date'] == date_str
                ]
                daily_avg = sum(user_daily_averages) / len(user_daily_averages) if user_daily_averages else 0
                daily_progress.append({
                    'date': date_str,
                    'completion_rate': round(daily_avg, 1)
                })

            archives.append({
                'id': challenge.id,
                'title': f"{challenge.start_date.strftime('%b %d')} - {challenge.end_date.strftime('%b %d, %Y')} Challenge",
                'start_date': challenge.start_date.isoformat(),
                'end_date': challenge.end_date.isoformat(),
                'duration_days': total_days,
                'total_members': total_members,
                'overall_completion_rate': round(overall_completion_rate, 1),
                'total_completions': round(total_actual_completions, 2),
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

        # This endpoint describes challenge engagement, not physical school attendance.
        # Use the canonical habit statistics so schedules, join dates, recurring
        # occurrences and numeric progress have the same meaning everywhere.
        attendance_data = []
        for member_habit in challenge.member_habits:
            raw_member_id = member_habit.get('member')
            member_id = raw_member_id.get('id') if isinstance(raw_member_id, dict) else raw_member_id
            member = User.query.get(member_id)
            if not member:
                continue
            student_today = datetime.now(_student_timezone(group, member_id)[1]).date()
            statistics = _build_group_member_habit_statistics(
                group,
                challenge,
                member_habit,
                member_id,
                today_value=student_today,
            )
            summary = statistics['summary']
            full_attendance = [{
                'date': row['date'],
                'active': row['completionRate'] > 0,
                'perfect': row['completionRate'] >= 100,
                'partial': 0 < row['completionRate'] < 100,
                'completion_rate': row['completionRate'],
                'earned_units': row['earnedUnits'],
                'scheduled_count': row['scheduledCount'],
            } for row in statistics['daily']]
            active_dates = [row['date'] for row in full_attendance if row['active']]
            days_active = summary['activeDays']
            total_days = summary['scheduledDays']
            attendance_rate = (days_active / total_days * 100) if total_days else 0

            attendance_data.append({
                'member_id': member_id,
                'username': member.username,
                'days_active': days_active,
                'total_days': total_days,
                'attendance_rate': round(attendance_rate, 1),
                'completion_rate': summary['completionRate'],
                'completion_units': summary['earnedUnits'],
                'possible_units': summary['possibleUnits'],
                'perfect_days': summary['perfectDays'],
                'partial_days': summary['partialDays'],
                'missed_days': summary['missedDays'],
                'recent_activity': list(reversed(full_attendance[-7:])),
                'full_attendance': full_attendance,
                'last_active': max(active_dates) if active_dates else None,
                'metric_definition': 'Active scheduled days divided by all scheduled days since the student joined the challenge.',
            })
        
        attendance_data.sort(key=lambda row: (row['completion_rate'], row['attendance_rate']), reverse=True)
        
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
    try:
        user_id = int(get_jwt_identity())
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if not can_manage_group(group, user_id):
            return jsonify({'error': 'Only school admins or legacy group owners can correct habit records'}), 403

        student = next((member for member in get_group_members_list(group) if member.id == member_id), None)
        if not student:
            return jsonify({'error': 'Student not found in this group'}), 404
        challenge = GroupChallenge.query.get(challenge_id)
        if not challenge or challenge.group_id != group.id:
            return jsonify({'error': 'Challenge not found'}), 404

        data = request.get_json() or {}
        reason = str(data.get('reason') or '').strip()
        if len(reason) < 5:
            return jsonify({'error': 'Add a short reason explaining how the completion was verified'}), 400
        if len(reason) > 500:
            return jsonify({'error': 'Keep the correction reason to 500 characters or fewer'}), 400
        try:
            target_date = date.fromisoformat(str(data.get('date') or '')[:10])
        except ValueError:
            return jsonify({'error': 'A valid correction date is required'}), 400

        member_habit = next(
            (
                entry for entry in (challenge.member_habits or [])
                if str(_member_habit_user_id(entry)) == str(member_id)
            ),
            None,
        )
        if not member_habit:
            return jsonify({'error': 'Member not found in challenge'}), 404

        habits = member_habit.get('habits', [])
        if habit_index < 0 or habit_index >= len(habits):
            return jsonify({'error': 'Invalid habit index'}), 400
        habit = habits[habit_index]

        timezone_name, student_timezone = _student_timezone(group, member_id)
        student_today = datetime.now(student_timezone).date()
        challenge_start = effective_challenge_start(challenge, member_habit)
        challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
        if target_date > student_today:
            return jsonify({'error': 'Future habit records cannot be corrected'}), 400
        if not challenge_start or target_date < challenge_start or (challenge_end and target_date > challenge_end):
            return jsonify({'error': 'The selected date is outside this student\'s challenge period'}), 400
        if not _habit_is_scheduled_on(habit, target_date):
            return jsonify({'error': 'This habit was not scheduled on the selected date'}), 400

        current_time = datetime.now(student_timezone)
        completion_access = _habit_completion_access(
            group,
            member_id,
            habit,
            habit_index,
            now=current_time,
            preferred_date=target_date,
            challenge=challenge,
            member_habit=member_habit,
        )
        eligible_occurrences = int(completion_access.get('eligibleOccurrenceCount') or 0)
        if eligible_occurrences < 1:
            return jsonify({'error': 'This habit had no eligible completion window on the selected date'}), 400
        correctable_occurrences = eligible_occurrences
        if target_date == student_today:
            correctable_occurrences = sum(
                1
                for window in (completion_access.get('windows') or [])
                if window.get('eligible') is not False
                and datetime.fromisoformat(str(window.get('opensAt')).replace('Z', '+00:00')) <= current_time
            )
            if correctable_occurrences < 1:
                return jsonify({'error': 'Today\'s completion window has not opened yet'}), 400

        progress = habit.setdefault('progress', [])
        existing_entry = _habit_progress_for_date(habit, target_date)
        if not existing_entry:
            existing_entry = {
                'date': target_date.isoformat(),
                'completed': False,
            }
            progress.append(existing_entry)

        previous_result = _habit_correction_snapshot(habit, existing_entry)
        restored_streak_cost = max(0, int(existing_entry.get('streakRestoreCost') or 0))
        had_streak_restore = bool(existing_entry.get('streakRestored'))
        new_result = _apply_admin_habit_correction(
            habit,
            existing_entry,
            data,
            periodic_target_override=(eligible_occurrences if habit.get('habitType') == 'periodic' else None),
            periodic_max_completed=(correctable_occurrences if habit.get('habitType') == 'periodic' else None),
        )

        corrected_at = datetime.now(timezone.utc).isoformat()
        actor = User.query.get(user_id)
        actor_name = ' '.join(filter(None, [getattr(actor, 'first_name', ''), getattr(actor, 'last_name', '')])).strip()
        actor_name = actor_name or getattr(actor, 'username', '') or 'Administrator'
        correction_record = {
            'actorId': user_id,
            'actorName': actor_name,
            'correctedAt': corrected_at,
            'reason': reason,
            'previousResult': previous_result,
            'newResult': new_result,
        }
        correction_history = list(existing_entry.get('adminCorrections') or [])
        existing_entry['adminCorrections'] = (correction_history + [correction_record])[-20:]

        refund_amount = 0
        if new_result['progressPercent'] >= 100 and had_streak_restore:
            for key in ('streakRestored', 'streakRestoredAt', 'streakRestoreCost', 'streakRestoredFrom'):
                existing_entry.pop(key, None)
            spend_reference = f'streak-restore:v1:g{group.id}:c{challenge.id}:s{member_id}:h{habit_index}:d{target_date.isoformat()}'
            refund_reference = f'streak-restore-refund:v1:g{group.id}:c{challenge.id}:s{member_id}:h{habit_index}:d{target_date.isoformat()}'
            original_spend = StudentIpTransaction.query.filter_by(reference_key=spend_reference).first()
            existing_refund = StudentIpTransaction.query.filter_by(reference_key=refund_reference).first()
            if restored_streak_cost and original_spend and not existing_refund:
                wallet = _get_or_create_ip_wallet(member_id)
                refund_amount = restored_streak_cost
                wallet.balance = int(wallet.balance or 0) + refund_amount
                wallet.lifetime_spent = max(0, int(wallet.lifetime_spent or 0) - refund_amount)
                wallet.updated_at = datetime.utcnow()
                db.session.add(StudentIpTransaction(
                    wallet_id=wallet.id,
                    group_id=group.id,
                    amount=refund_amount,
                    kind='streak_restore_refund',
                    reference_key=refund_reference,
                    description=f"Refunded streak protection after an admin verified {habit.get('name') or 'a habit'}",
                    details={
                        'challengeId': challenge.id,
                        'habitIndex': habit_index,
                        'habitName': habit.get('name') or f'Habit {habit_index + 1}',
                        'date': target_date.isoformat(),
                        'reason': reason,
                        'correctedBy': user_id,
                    },
                ))

        habit['progress'] = progress
        challenge.member_habits = list(challenge.member_habits or [])
        flag_modified(challenge, 'member_habits')
        wallet, credited = _sync_student_ip_bucks(group, member_id, today_value=student_today)
        earned_adjustment = sum(int(item.get('amount') or 0) for item in credited)
        student_name = ' '.join(filter(None, [student.first_name, student.last_name])).strip() or student.username
        log_school_audit(
            group.id,
            user_id,
            'habit_progress_corrected',
            'habit_progress',
            f"Corrected {habit.get('name') or f'Habit {habit_index + 1}'} for {student_name}",
            description=reason,
            student_id=member_id,
            metadata={
                'challengeId': challenge.id,
                'habitIndex': habit_index,
                'habitType': habit.get('habitType') or 'boolean',
                'date': target_date.isoformat(),
                'timezone': timezone_name,
                'previousResult': previous_result,
                'newResult': new_result,
                'ipBucksEarnedAdjustment': earned_adjustment,
                'ipBucksRefunded': refund_amount,
            },
        )
        db.session.commit()

        return jsonify({
            'message': 'Verified habit correction saved and statistics recalculated',
            'date': target_date.isoformat(),
            'result': new_result,
            'wallet': wallet.to_dict(),
            'ipBucksEarnedAdjustment': earned_adjustment,
            'ipBucksRefunded': refund_amount,
        }), 200
    except ValueError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400
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
