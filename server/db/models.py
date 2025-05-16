from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    current_cycle_start_date = db.Column(db.Date, nullable=True)
    current_cycle_end_date = db.Column(db.Date, nullable=True)
    
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