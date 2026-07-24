"""Add lesson registers for school timetable scoring

Revision ID: lesson_registers_001
Revises: school_timetable_001
Create Date: 2026-03-09 22:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'lesson_registers_001'
down_revision = 'school_timetable_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'lesson_registers' not in tables:
        op.create_table(
            'lesson_registers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('teacher_id', sa.Integer(), nullable=False),
            sa.Column('lesson_date', sa.Date(), nullable=False),
            sa.Column('timetable_slot_id', sa.String(length=64), nullable=False),
            sa.Column('weekday', sa.String(length=20), nullable=False),
            sa.Column('start_time', sa.String(length=10), nullable=False),
            sa.Column('end_time', sa.String(length=10), nullable=False),
            sa.Column('subject', sa.String(length=120), nullable=False),
            sa.Column('teacher_name', sa.String(length=120), nullable=True),
            sa.Column('room', sa.String(length=60), nullable=True),
            sa.Column('class_name', sa.String(length=120), nullable=True),
            sa.Column('attended', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('engagement', sa.String(length=20), nullable=False, server_default='green'),
            sa.Column('refocus', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('teacher_comment', sa.Text(), nullable=True),
            sa.Column('points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.ForeignKeyConstraint(['teacher_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'student_id', 'lesson_date', 'timetable_slot_id', name='uq_lesson_register_student_slot_day')
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'lesson_registers' in tables:
        op.drop_table('lesson_registers')
