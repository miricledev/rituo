"""Add school homework assignments and submissions

Revision ID: school_homework_001
Revises: school_behaviour_001
Create Date: 2026-03-10 16:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'school_homework_001'
down_revision = 'school_behaviour_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'school_homework_assignments' not in tables:
        op.create_table(
            'school_homework_assignments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('class_id', sa.Integer(), nullable=True),
            sa.Column('subject_id', sa.Integer(), nullable=True),
            sa.Column('title', sa.String(length=160), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('instructions', sa.Text(), nullable=True),
            sa.Column('homework_type', sa.String(length=40), nullable=False, server_default='practice'),
            sa.Column('complexity', sa.String(length=20), nullable=False, server_default='medium'),
            sa.Column('assigned_date', sa.Date(), nullable=False),
            sa.Column('due_date', sa.Date(), nullable=False),
            sa.Column('estimated_minutes', sa.Integer(), nullable=False, server_default='30'),
            sa.Column('max_points', sa.Integer(), nullable=False, server_default='3'),
            sa.Column('late_penalty', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('missing_penalty', sa.Integer(), nullable=False, server_default='2'),
            sa.Column('allow_late', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('requires_evidence', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('student_ids', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['class_id'], ['school_classes.id']),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['subject_id'], ['school_subjects.id']),
            sa.PrimaryKeyConstraint('id')
        )

    if 'school_homework_submissions' not in tables:
        op.create_table(
            'school_homework_submissions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('assignment_id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('submitted_by_id', sa.Integer(), nullable=True),
            sa.Column('reviewed_by_id', sa.Integer(), nullable=True),
            sa.Column('status', sa.String(length=40), nullable=False, server_default='assigned'),
            sa.Column('submitted_at', sa.DateTime(), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('completed_date', sa.Date(), nullable=True),
            sa.Column('response_text', sa.Text(), nullable=True),
            sa.Column('evidence_link', sa.String(length=255), nullable=True),
            sa.Column('teacher_feedback', sa.Text(), nullable=True),
            sa.Column('awarded_points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['assignment_id'], ['school_homework_assignments.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.ForeignKeyConstraint(['submitted_by_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('assignment_id', 'student_id', name='uq_homework_assignment_student')
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'school_homework_submissions' in tables:
        op.drop_table('school_homework_submissions')
    if 'school_homework_assignments' in tables:
        op.drop_table('school_homework_assignments')
