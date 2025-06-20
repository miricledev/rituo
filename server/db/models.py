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

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    reset_token = db.Column(db.String(100))
    reset_token_expiry = db.Column(db.DateTime)
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
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'current_cycle_start_date': self.current_cycle_start_date.isoformat() if self.current_cycle_start_date else None,
            'current_cycle_end_date': self.current_cycle_end_date.isoformat() if self.current_cycle_end_date else None
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    leader = db.relationship('User', foreign_keys=[leader_id])
    active_challenge = db.relationship('GroupChallenge', foreign_keys=[active_challenge_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'groupId': self.group_id,
            'leader': self.leader.to_dict() if self.leader else None,
            'members': [member.to_dict() for member in self.members],
            'activeChallenge': self.active_challenge.to_dict() if self.active_challenge else None,
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
    
    # Relationships
    group = db.relationship('Group', foreign_keys=[group_id], backref=db.backref('challenges', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'groupId': self.group_id,
            'startDate': self.start_date.isoformat(),
            'endDate': self.end_date.isoformat(),
            'memberHabits': self.member_habits,
            'status': self.status,
            'createdAt': self.created_at.isoformat()
        }