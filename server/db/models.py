from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

# Association tables
user_groups = db.Table('user_groups',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True)
)

user_leading_groups = db.Table('user_leading_groups',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True)
)

user_active_challenges = db.Table('user_active_challenges',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('challenge_id', db.Integer, db.ForeignKey('group_challenges.id'), primary_key=True)
)

# Association table for coaches (co-leaders) in groups
group_coaches = db.Table('group_coaches',
    db.Column('coach_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True)
)

# Table for coach-student assignments
class CoachAssignment(db.Model):
    __tablename__ = 'coach_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    coach_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    coach = db.relationship('User', foreign_keys=[coach_id])
    group = db.relationship('Group', foreign_keys=[group_id], back_populates='coach_assignments')
    student = db.relationship('User', foreign_keys=[student_id])
    
    __table_args__ = (db.UniqueConstraint('coach_id', 'group_id', 'student_id', name='uq_coach_assignment'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'coachId': self.coach_id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'coach': self.coach.to_dict() if self.coach else None,
            'student': self.student.to_dict() if self.student else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    reset_token = db.Column(db.String(100))
    reset_token_expiry = db.Column(db.DateTime)
    account_role = db.Column(db.String(20), nullable=False, default='student')
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    managed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    year_group = db.Column(db.String(40), nullable=True)
    tutor_group = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    current_cycle_start_date = db.Column(db.Date, nullable=True)
    current_cycle_end_date = db.Column(db.Date, nullable=True)
    
    # Group relationships
    groups = db.relationship('Group', secondary=user_groups, backref=db.backref('members', lazy='dynamic'))
    leading_groups = db.relationship('Group', secondary=user_leading_groups, backref=db.backref('leaders', lazy='dynamic'))
    active_group_challenges = db.relationship('GroupChallenge', secondary=user_active_challenges, backref=db.backref('active_members', lazy='dynamic'))
    
    # Relationships
    tasks = db.relationship('Task', backref='user', lazy=True, cascade='all, delete-orphan')
    task_completions = db.relationship('TaskCompletion', backref='user', lazy=True, cascade='all, delete-orphan')
    managed_by = db.relationship('User', remote_side=[id], foreign_keys=[managed_by_id], backref='managed_accounts')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'accountRole': self.account_role or 'student',
            'isActive': bool(self.is_active),
            'managedById': self.managed_by_id,
            'firstName': self.first_name or '',
            'lastName': self.last_name or '',
            'yearGroup': self.year_group or '',
            'tutorGroup': self.tutor_group or '',
            'hasLegacyAccess': any(getattr(group, 'is_legacy', True) for group in self.leading_groups)
                or any(getattr(group, 'is_legacy', True) for group in self.groups),
            'created_at': self.created_at.isoformat(),
            'current_cycle_start_date': self.current_cycle_start_date.isoformat() if self.current_cycle_start_date else None,
            'current_cycle_end_date': self.current_cycle_end_date.isoformat() if self.current_cycle_end_date else None,
            'groups': [{'groupId': group.group_id, 'name': group.name, 'groupType': getattr(group, 'group_type', 'school')} for group in self.groups]
        }


class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    cycle_start_date = db.Column(db.Date, nullable=False)
    cycle_end_date = db.Column(db.Date, nullable=False)
    
    # Relationships
    completions = db.relationship('TaskCompletion', backref='task', lazy=True, cascade='all, delete-orphan')
    notes = db.relationship('TaskNote', backref='task', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'cycle_start_date': self.cycle_start_date.isoformat(),
            'cycle_end_date': self.cycle_end_date.isoformat()
        }


class TaskCompletion(db.Model):
    __tablename__ = 'task_completion'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    completion_date = db.Column(db.Date, nullable=False)
    is_complete = db.Column(db.Boolean, default=False)
    
    __table_args__ = (db.UniqueConstraint('task_id', 'completion_date', name='uq_task_completion_date'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'completion_date': self.completion_date.isoformat(),
            'is_complete': self.is_complete
        }


class TaskNote(db.Model):
    __tablename__ = 'task_notes'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    note = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'note': self.note,
            'created_at': self.created_at.isoformat()
        }


class Group(db.Model):
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    group_id = db.Column(db.String(8), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    leader_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    active_challenge_id = db.Column(db.Integer, db.ForeignKey('group_challenges.id'))
    group_type = db.Column(db.String(20), nullable=False, default='school')
    is_legacy = db.Column(db.Boolean, nullable=False, default=False)
    school_timetable = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    leader = db.relationship('User', foreign_keys=[leader_id])
    active_challenge = db.relationship('GroupChallenge', foreign_keys=[active_challenge_id])
    messages = db.relationship('Message', back_populates='group', cascade='all, delete-orphan')
    coaches = db.relationship('User', secondary=group_coaches, backref=db.backref('coaching_groups', lazy='dynamic'))
    coach_assignments = db.relationship('CoachAssignment', back_populates='group', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'groupId': self.group_id,
            'leader': self.leader.to_dict() if self.leader else None,
            'members': [member.to_dict() for member in self.members],
            'coaches': [coach.to_dict() for coach in self.coaches],
            'activeChallenge': self.active_challenge.to_dict() if self.active_challenge else None,
            'groupType': self.group_type or 'school',
            'isLegacy': bool(self.is_legacy),
            'schoolTimetable': self.school_timetable or [],
            'createdAt': self.created_at.isoformat()
        }


class GroupChallenge(db.Model):
    __tablename__ = 'group_challenges'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    member_habits = db.Column(db.JSON, nullable=False)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Course: optional course attached to challenge; course_required_member_ids = [] means all, else specific IDs
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    course_required_member_ids = db.Column(db.JSON, nullable=True)  # [] = all members, else [id, ...]
    
    # Relationships
    group = db.relationship('Group', foreign_keys=[group_id], backref=db.backref('challenges', lazy='dynamic'))
    course = db.relationship('Course', foreign_keys=[course_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'startDate': self.start_date.isoformat(),
            'endDate': self.end_date.isoformat(),
            'memberHabits': self.member_habits,
            'status': self.status,
            'createdAt': self.created_at.isoformat(),
            'courseId': self.course_id,
            'courseRequiredMemberIds': self.course_required_member_ids if self.course_required_member_ids is not None else [],
            'course': self.course.to_dict() if self.course else None
        }


class StudentSchedulePlan(db.Model):
    __tablename__ = 'student_schedule_plans'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    plan_date = db.Column(db.Date, nullable=False)
    constraints_text = db.Column(db.Text, nullable=True)
    items = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'student_id', 'plan_date', name='uq_student_schedule_plan_day'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'planDate': self.plan_date.isoformat() if self.plan_date else None,
            'constraintsText': self.constraints_text or '',
            'items': self.items or [],
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('school_classes.id'), nullable=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Null for group chat, set for DMs
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_by = db.Column(db.Text, default='[]')  # JSON array of user IDs who have read this message
    message_type = db.Column(db.String(20), default='user')  # 'user' for regular messages, 'system' for system messages

    group = db.relationship('Group', back_populates='messages')
    sender = db.relationship('User', foreign_keys=[sender_id])
    recipient = db.relationship('User', foreign_keys=[recipient_id])
    school_class = db.relationship('SchoolClass', foreign_keys=[class_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'senderId': self.sender_id,
            'senderUsername': self.sender.username if self.sender else None,
            'recipientId': self.recipient_id,
            'classId': self.class_id,
            'className': self.school_class.name if self.school_class else None,
            'content': self.content,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'readBy': self.read_by,
            'messageType': self.message_type
        }


class SkillDevelopmentChart(db.Model):
    __tablename__ = 'skill_development_charts'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    term = db.Column(db.String(20), nullable=False)  # 'easter' or 'summer'
    skill_levels = db.Column(db.JSON, nullable=False)  # Store skill level data as JSON
    color_scheme = db.Column(db.JSON, nullable=True)  # Store custom color scheme as JSON
    edit_history = db.Column(db.JSON, nullable=True)  # Store edit history: {cellKey: {editorId, editorName, editedAt}}
    last_edited_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    last_edited_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    group = db.relationship('Group', foreign_keys=[group_id])
    member = db.relationship('User', foreign_keys=[member_id])
    last_edited_by = db.relationship('User', foreign_keys=[last_edited_by_id])
    
    __table_args__ = (db.UniqueConstraint('group_id', 'member_id', 'term', name='uq_skill_chart_group_member_term'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group.group_id if self.group else None,  # Return the string group_id
            'memberId': self.member_id,
            'term': self.term,
            'skillLevels': self.skill_levels,
            'colorScheme': self.color_scheme,
            'editHistory': self.edit_history or {},
            'lastEditedBy': self.last_edited_by.to_dict() if self.last_edited_by else None,
            'lastEditedAt': self.last_edited_at.isoformat() if self.last_edited_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class StudentGoal(db.Model):
    __tablename__ = 'student_goals'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    barrier = db.Column(db.String(255), nullable=True)
    school_goal = db.Column(db.String(255), nullable=True)
    for_self = db.Column(db.String(255), nullable=True)
    for_others = db.Column(db.String(255), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    created_by = db.relationship('User', foreign_keys=[created_by_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'title': self.title,
            'barrier': self.barrier or '',
            'schoolGoal': self.school_goal or '',
            'forSelf': self.for_self or '',
            'forOthers': self.for_others or '',
            'createdBy': self.created_by.to_dict() if self.created_by else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolImpactRecord(db.Model):
    __tablename__ = 'school_impact_records'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    coach_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    week_ending = db.Column(db.Date, nullable=False)
    truancy_incidents = db.Column(db.Integer, nullable=False, default=0)
    positive_points = db.Column(db.Integer, nullable=False, default=0)
    negative_points = db.Column(db.Integer, nullable=False, default=0)
    coach_notes = db.Column(db.Text, nullable=True)
    evidence_file_name = db.Column(db.String(255), nullable=True)
    evidence_original_name = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    coach = db.relationship('User', foreign_keys=[coach_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'coachId': self.coach_id,
            'weekEnding': self.week_ending.isoformat() if self.week_ending else None,
            'truancyIncidents': self.truancy_incidents or 0,
            'positivePoints': self.positive_points or 0,
            'negativePoints': self.negative_points or 0,
            'coachNotes': self.coach_notes or '',
            'evidenceFileName': self.evidence_file_name,
            'evidenceOriginalName': self.evidence_original_name,
            'coach': self.coach.to_dict() if self.coach else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class PerformanceCard(db.Model):
    __tablename__ = 'performance_cards'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    coach_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    card_date = db.Column(db.Date, nullable=False)
    checkpoints = db.Column(db.JSON, nullable=False, default=list)
    total_points = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    coach = db.relationship('User', foreign_keys=[coach_id])

    __table_args__ = (db.UniqueConstraint('group_id', 'student_id', 'card_date', name='uq_performance_card_student_day'),)

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'coachId': self.coach_id,
            'cardDate': self.card_date.isoformat() if self.card_date else None,
            'checkpoints': self.checkpoints or [],
            'totalPoints': self.total_points or 0,
            'coach': self.coach.to_dict() if self.coach else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class LessonRegister(db.Model):
    __tablename__ = 'lesson_registers'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_date = db.Column(db.Date, nullable=False)
    timetable_slot_id = db.Column(db.String(64), nullable=False)
    weekday = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.String(10), nullable=False)
    end_time = db.Column(db.String(10), nullable=False)
    subject = db.Column(db.String(120), nullable=False)
    teacher_name = db.Column(db.String(120), nullable=True)
    room = db.Column(db.String(60), nullable=True)
    class_name = db.Column(db.String(120), nullable=True)
    attendance_status = db.Column(db.String(40), nullable=False, default='present')
    lateness_minutes = db.Column(db.Integer, nullable=False, default=0)
    attended = db.Column(db.Boolean, nullable=False, default=True)
    engagement = db.Column(db.String(20), nullable=False, default='green')
    refocus = db.Column(db.Boolean, nullable=False, default=False)
    teacher_comment = db.Column(db.Text, nullable=True)
    points = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    teacher = db.relationship('User', foreign_keys=[teacher_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'student_id', 'lesson_date', 'timetable_slot_id', name='uq_lesson_register_student_slot_day'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'teacherId': self.teacher_id,
            'lessonDate': self.lesson_date.isoformat() if self.lesson_date else None,
            'timetableSlotId': self.timetable_slot_id,
            'weekday': self.weekday,
            'startTime': self.start_time,
            'endTime': self.end_time,
            'subject': self.subject,
            'teacherName': self.teacher_name or '',
            'room': self.room or '',
            'className': self.class_name or '',
            'attendanceStatus': self.attendance_status or 'present',
            'latenessMinutes': self.lateness_minutes or 0,
            'attended': self.attended,
            'engagement': self.engagement,
            'refocus': self.refocus,
            'teacherComment': self.teacher_comment or '',
            'points': self.points or 0,
            'teacher': self.teacher.to_dict() if self.teacher else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class InterventionRecord(db.Model):
    __tablename__ = 'intervention_records'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    intervention_type = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(40), nullable=False, default='scheduled')
    intervention_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    auto_created = db.Column(db.Boolean, nullable=False, default=False)
    summary = db.Column(db.Text, nullable=True)
    next_step = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    staff = db.relationship('User', foreign_keys=[staff_id])
    owner = db.relationship('User', foreign_keys=[owner_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'staffId': self.staff_id,
            'ownerId': self.owner_id,
            'interventionType': self.intervention_type,
            'status': self.status,
            'interventionDate': self.intervention_date.isoformat() if self.intervention_date else None,
            'dueDate': self.due_date.isoformat() if self.due_date else None,
            'autoCreated': self.auto_created,
            'summary': self.summary or '',
            'nextStep': self.next_step or '',
            'staff': self.staff.to_dict() if self.staff else None,
            'owner': self.owner.to_dict() if self.owner else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class ParentContactRecord(db.Model):
    __tablename__ = 'parent_contact_records'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contact_date = db.Column(db.Date, nullable=False)
    contact_type = db.Column(db.String(60), nullable=False)
    outcome = db.Column(db.String(120), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    acknowledged = db.Column(db.Boolean, nullable=False, default=False)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    acknowledgement_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    staff = db.relationship('User', foreign_keys=[staff_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'staffId': self.staff_id,
            'contactDate': self.contact_date.isoformat() if self.contact_date else None,
            'contactType': self.contact_type,
            'outcome': self.outcome or '',
            'notes': self.notes or '',
            'acknowledged': self.acknowledged,
            'acknowledgedAt': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'acknowledgementNote': self.acknowledgement_note or '',
            'staff': self.staff.to_dict() if self.staff else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class ParentProfile(db.Model):
    __tablename__ = 'parent_profiles'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    relationship = db.Column(db.String(60), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    preferred_contact = db.Column(db.String(40), nullable=True)
    receives_updates = db.Column(db.Boolean, nullable=False, default=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    created_by = db.relationship('User', foreign_keys=[created_by_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'createdById': self.created_by_id,
            'name': self.name,
            'relationship': self.relationship or '',
            'phone': self.phone or '',
            'email': self.email or '',
            'preferredContact': self.preferred_contact or '',
            'receivesUpdates': self.receives_updates,
            'notes': self.notes or '',
            'createdBy': self.created_by.to_dict() if self.created_by else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolAuditLog(db.Model):
    __tablename__ = 'school_audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action_type = db.Column(db.String(80), nullable=False)
    entity_type = db.Column(db.String(80), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    metadata_json = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    actor = db.relationship('User', foreign_keys=[actor_id])
    student = db.relationship('User', foreign_keys=[student_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'actorId': self.actor_id,
            'studentId': self.student_id,
            'actionType': self.action_type,
            'entityType': self.entity_type,
            'title': self.title,
            'description': self.description or '',
            'metadata': self.metadata_json or {},
            'actor': self.actor.to_dict() if self.actor else None,
            'student': self.student.to_dict() if self.student else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class SchoolRoleAssignment(db.Model):
    __tablename__ = 'school_role_assignments'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(40), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'user_id', name='uq_school_role_assignment_group_user'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'userId': self.user_id,
            'role': self.role,
            'user': self.user.to_dict() if self.user else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolSubject(db.Model):
    __tablename__ = 'school_subjects'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'name', name='uq_school_subject_group_name'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'name': self.name,
            'code': self.code or '',
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolRoom(db.Model):
    __tablename__ = 'school_rooms'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    name = db.Column(db.String(80), nullable=False)
    block = db.Column(db.String(80), nullable=True)
    capacity = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'name', name='uq_school_room_group_name'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'name': self.name,
            'block': self.block or '',
            'capacity': self.capacity,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolClass(db.Model):
    __tablename__ = 'school_classes'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    tutor_group = db.Column(db.String(120), nullable=True)
    year_group = db.Column(db.String(40), nullable=True)
    room_id = db.Column(db.Integer, db.ForeignKey('school_rooms.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    room = db.relationship('SchoolRoom', foreign_keys=[room_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'name', name='uq_school_class_group_name'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'name': self.name,
            'tutorGroup': self.tutor_group or '',
            'yearGroup': self.year_group or '',
            'roomId': self.room_id,
            'room': self.room.to_dict() if self.room else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolEnrollment(db.Model):
    __tablename__ = 'school_enrollments'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('school_classes.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    school_class = db.relationship('SchoolClass', foreign_keys=[class_id])
    student = db.relationship('User', foreign_keys=[student_id])

    __table_args__ = (
        db.UniqueConstraint('class_id', 'student_id', name='uq_school_enrollment_class_student'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'classId': self.class_id,
            'studentId': self.student_id,
            'student': self.student.to_dict() if self.student else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class SchoolTeachingAssignment(db.Model):
    __tablename__ = 'school_teaching_assignments'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('school_classes.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('school_subjects.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    school_class = db.relationship('SchoolClass', foreign_keys=[class_id])
    subject = db.relationship('SchoolSubject', foreign_keys=[subject_id])
    teacher = db.relationship('User', foreign_keys=[teacher_id])

    __table_args__ = (
        db.UniqueConstraint('class_id', 'subject_id', 'teacher_id', name='uq_school_teaching_assignment'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'classId': self.class_id,
            'subjectId': self.subject_id,
            'teacherId': self.teacher_id,
            'schoolClass': self.school_class.to_dict() if self.school_class else None,
            'subject': self.subject.to_dict() if self.subject else None,
            'teacher': self.teacher.to_dict() if self.teacher else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolBehaviourType(db.Model):
    __tablename__ = 'school_behaviour_types'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    kind = db.Column(db.String(40), nullable=False)
    severity = db.Column(db.String(20), nullable=False, default='low')
    default_points = db.Column(db.Integer, nullable=False, default=0)
    note_type = db.Column(db.String(60), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'name', name='uq_school_behaviour_type_group_name'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'name': self.name,
            'kind': self.kind,
            'severity': self.severity,
            'defaultPoints': self.default_points,
            'noteType': self.note_type or '',
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolBehaviourEvent(db.Model):
    __tablename__ = 'school_behaviour_events'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_register_id = db.Column(db.Integer, db.ForeignKey('lesson_registers.id'), nullable=True)
    behaviour_type_id = db.Column(db.Integer, db.ForeignKey('school_behaviour_types.id'), nullable=True)
    event_date = db.Column(db.Date, nullable=False)
    subject = db.Column(db.String(120), nullable=True)
    class_name = db.Column(db.String(120), nullable=True)
    kind = db.Column(db.String(40), nullable=False)
    severity = db.Column(db.String(20), nullable=False, default='low')
    title = db.Column(db.String(120), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    points_delta = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    staff = db.relationship('User', foreign_keys=[staff_id])
    lesson_register = db.relationship('LessonRegister', foreign_keys=[lesson_register_id])
    behaviour_type = db.relationship('SchoolBehaviourType', foreign_keys=[behaviour_type_id])

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'staffId': self.staff_id,
            'lessonRegisterId': self.lesson_register_id,
            'behaviourTypeId': self.behaviour_type_id,
            'eventDate': self.event_date.isoformat() if self.event_date else None,
            'subject': self.subject or '',
            'className': self.class_name or '',
            'kind': self.kind,
            'severity': self.severity,
            'title': self.title,
            'notes': self.notes or '',
            'pointsDelta': self.points_delta,
            'staff': self.staff.to_dict() if self.staff else None,
            'behaviourType': self.behaviour_type.to_dict() if self.behaviour_type else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolHomeworkAssignment(db.Model):
    __tablename__ = 'school_homework_assignments'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('school_classes.id'), nullable=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('school_subjects.id'), nullable=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=True)
    instructions = db.Column(db.Text, nullable=True)
    homework_type = db.Column(db.String(40), nullable=False, default='practice')
    complexity = db.Column(db.String(20), nullable=False, default='medium')
    assigned_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    estimated_minutes = db.Column(db.Integer, nullable=False, default=30)
    max_points = db.Column(db.Integer, nullable=False, default=3)
    late_penalty = db.Column(db.Integer, nullable=False, default=1)
    missing_penalty = db.Column(db.Integer, nullable=False, default=2)
    allow_late = db.Column(db.Boolean, nullable=False, default=True)
    requires_evidence = db.Column(db.Boolean, nullable=False, default=False)
    student_ids = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id])
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    school_class = db.relationship('SchoolClass', foreign_keys=[class_id])
    subject = db.relationship('SchoolSubject', foreign_keys=[subject_id])
    submissions = db.relationship('SchoolHomeworkSubmission', back_populates='assignment', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'createdById': self.created_by_id,
            'classId': self.class_id,
            'subjectId': self.subject_id,
            'title': self.title,
            'description': self.description or '',
            'instructions': self.instructions or '',
            'homeworkType': self.homework_type,
            'complexity': self.complexity,
            'assignedDate': self.assigned_date.isoformat() if self.assigned_date else None,
            'dueDate': self.due_date.isoformat() if self.due_date else None,
            'estimatedMinutes': self.estimated_minutes,
            'maxPoints': self.max_points,
            'latePenalty': self.late_penalty,
            'missingPenalty': self.missing_penalty,
            'allowLate': self.allow_late,
            'requiresEvidence': self.requires_evidence,
            'studentIds': self.student_ids or [],
            'schoolClass': self.school_class.to_dict() if self.school_class else None,
            'subject': self.subject.to_dict() if self.subject else None,
            'createdBy': self.created_by.to_dict() if self.created_by else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class SchoolHomeworkSubmission(db.Model):
    __tablename__ = 'school_homework_submissions'

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('school_homework_assignments.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    submitted_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    status = db.Column(db.String(40), nullable=False, default='assigned')
    submitted_at = db.Column(db.DateTime, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    completed_date = db.Column(db.Date, nullable=True)
    response_text = db.Column(db.Text, nullable=True)
    evidence_link = db.Column(db.String(255), nullable=True)
    teacher_feedback = db.Column(db.Text, nullable=True)
    awarded_points = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignment = db.relationship('SchoolHomeworkAssignment', foreign_keys=[assignment_id], back_populates='submissions')
    group = db.relationship('Group', foreign_keys=[group_id])
    student = db.relationship('User', foreign_keys=[student_id])
    submitted_by = db.relationship('User', foreign_keys=[submitted_by_id])
    reviewed_by = db.relationship('User', foreign_keys=[reviewed_by_id])

    __table_args__ = (
        db.UniqueConstraint('assignment_id', 'student_id', name='uq_homework_assignment_student'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'assignmentId': self.assignment_id,
            'groupId': self.group_id,
            'studentId': self.student_id,
            'submittedById': self.submitted_by_id,
            'reviewedById': self.reviewed_by_id,
            'status': self.status,
            'submittedAt': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewedAt': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'completedDate': self.completed_date.isoformat() if self.completed_date else None,
            'responseText': self.response_text or '',
            'evidenceLink': self.evidence_link or '',
            'teacherFeedback': self.teacher_feedback or '',
            'awardedPoints': self.awarded_points,
            'student': self.student.to_dict() if self.student else None,
            'submittedBy': self.submitted_by.to_dict() if self.submitted_by else None,
            'reviewedBy': self.reviewed_by.to_dict() if self.reviewed_by else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


# Course models for group education (TikTok-style videos + quizzes)
class Course(db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    settings = db.Column(db.JSON, nullable=True)  # Gen Z options: verticalScroll, autoplay, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = db.relationship('Group', foreign_keys=[group_id], backref=db.backref('courses', lazy='dynamic'))
    sections = db.relationship('CourseSection', back_populates='course', order_by='CourseSection.order_index', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'name': self.name,
            'description': self.description or '',
            'settings': self.settings or {},
            'sections': [s.to_dict() for s in self.sections],
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat()
        }


class CourseSection(db.Model):
    __tablename__ = 'course_sections'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    course = db.relationship('Course', foreign_keys=[course_id], back_populates='sections')
    items = db.relationship('CourseItem', back_populates='section', order_by='CourseItem.order_index', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'courseId': self.course_id,
            'title': self.title,
            'description': self.description or '',
            'orderIndex': self.order_index,
            'items': [i.to_dict() for i in self.items],
            'createdAt': self.created_at.isoformat()
        }


class CourseItem(db.Model):
    __tablename__ = 'course_items'

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey('course_sections.id'), nullable=False)
    item_type = db.Column(db.String(20), nullable=False)  # 'video' | 'quiz'
    order_index = db.Column(db.Integer, nullable=False, default=0)
    data = db.Column(db.JSON, nullable=False)  # video: {url, durationSeconds, thumbnailUrl} | quiz: {questions: [{question, options[], correctIndex}]}
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    section = db.relationship('CourseSection', foreign_keys=[section_id], back_populates='items')

    def to_dict(self):
        return {
            'id': self.id,
            'sectionId': self.section_id,
            'itemType': self.item_type,
            'orderIndex': self.order_index,
            'data': self.data or {},
            'createdAt': self.created_at.isoformat()
        }


class CourseProgress(db.Model):
    """Tracks user progress per section: watch time, quiz scores"""
    __tablename__ = 'course_progress'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    challenge_id = db.Column(db.Integer, db.ForeignKey('group_challenges.id'), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey('course_sections.id'), nullable=False)
    watch_time_seconds = db.Column(db.Integer, default=0)
    quiz_scores = db.Column(db.JSON, nullable=True)  # {itemId: {score, total, answeredAt}}
    last_activity_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])
    challenge = db.relationship('GroupChallenge', foreign_keys=[challenge_id])
    section = db.relationship('CourseSection', foreign_keys=[section_id])

    __table_args__ = (db.UniqueConstraint('user_id', 'challenge_id', 'section_id', name='uq_course_progress_user_challenge_section'),)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'challengeId': self.challenge_id,
            'sectionId': self.section_id,
            'watchTimeSeconds': self.watch_time_seconds,
            'quizScores': self.quiz_scores or {},
            'lastActivityAt': self.last_activity_at.isoformat() if self.last_activity_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class HabitPreset(db.Model):
    __tablename__ = 'habit_presets'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    habits = db.Column(db.JSON, nullable=False)  # Store habits as JSON array
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'name': self.name,
            'habits': self.habits,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }
