"""Add school structure tables, staff roles, and attendance status

Revision ID: school_structure_roles_001
Revises: intervention_assignment_001
Create Date: 2026-03-10 11:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'school_structure_roles_001'
down_revision = 'intervention_assignment_001'
branch_labels = None
depends_on = None


def _table_names(inspector):
    return set(inspector.get_table_names())


def _column_names(inspector, table_name):
    return {column['name'] for column in inspector.get_columns(table_name)}


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = _table_names(inspector)

    if 'school_role_assignments' not in tables:
        op.create_table(
            'school_role_assignments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('role', sa.String(length=40), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'user_id', name='uq_school_role_assignment_group_user')
        )

    if 'school_subjects' not in tables:
        op.create_table(
            'school_subjects',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('code', sa.String(length=30), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'name', name='uq_school_subject_group_name')
        )

    if 'school_rooms' not in tables:
        op.create_table(
            'school_rooms',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=80), nullable=False),
            sa.Column('block', sa.String(length=80), nullable=True),
            sa.Column('capacity', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'name', name='uq_school_room_group_name')
        )

    if 'school_classes' not in tables:
        op.create_table(
            'school_classes',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('tutor_group', sa.String(length=120), nullable=True),
            sa.Column('year_group', sa.String(length=40), nullable=True),
            sa.Column('room_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['room_id'], ['school_rooms.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'name', name='uq_school_class_group_name')
        )

    if 'school_enrollments' not in tables:
        op.create_table(
            'school_enrollments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('class_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['class_id'], ['school_classes.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('class_id', 'student_id', name='uq_school_enrollment_class_student')
        )

    if 'school_teaching_assignments' not in tables:
        op.create_table(
            'school_teaching_assignments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('class_id', sa.Integer(), nullable=False),
            sa.Column('subject_id', sa.Integer(), nullable=False),
            sa.Column('teacher_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['class_id'], ['school_classes.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['subject_id'], ['school_subjects.id']),
            sa.ForeignKeyConstraint(['teacher_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('class_id', 'subject_id', 'teacher_id', name='uq_school_teaching_assignment')
        )

    if 'lesson_registers' in tables:
        lesson_columns = _column_names(inspector, 'lesson_registers')
        if 'attendance_status' not in lesson_columns:
            op.add_column('lesson_registers', sa.Column('attendance_status', sa.String(length=40), nullable=False, server_default='present'))
        if 'lateness_minutes' not in lesson_columns:
            op.add_column('lesson_registers', sa.Column('lateness_minutes', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = _table_names(inspector)

    if 'lesson_registers' in tables:
        lesson_columns = _column_names(inspector, 'lesson_registers')
        if 'lateness_minutes' in lesson_columns:
            op.drop_column('lesson_registers', 'lateness_minutes')
        if 'attendance_status' in lesson_columns:
            op.drop_column('lesson_registers', 'attendance_status')

    if 'school_teaching_assignments' in tables:
        op.drop_table('school_teaching_assignments')
    if 'school_enrollments' in tables:
        op.drop_table('school_enrollments')
    if 'school_classes' in tables:
        op.drop_table('school_classes')
    if 'school_rooms' in tables:
        op.drop_table('school_rooms')
    if 'school_subjects' in tables:
        op.drop_table('school_subjects')
    if 'school_role_assignments' in tables:
        op.drop_table('school_role_assignments')
