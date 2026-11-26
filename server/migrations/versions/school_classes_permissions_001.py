"""Extend school classes, teacher assignments, and day configuration

Revision ID: school_classes_permissions_001
Revises: student_import_profiles_001
Create Date: 2026-07-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'school_classes_permissions_001'
down_revision = 'student_import_profiles_001'
branch_labels = None
depends_on = None


def _column_names(inspector, table_name):
    return {column['name'] for column in inspector.get_columns(table_name)}


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'groups' in tables:
        columns = _column_names(inspector, 'groups')
        if 'school_day_config' not in columns:
            op.add_column('groups', sa.Column('school_day_config', sa.JSON(), nullable=True))

    if 'school_classes' in tables:
        columns = _column_names(inspector, 'school_classes')
        if 'description' not in columns:
            op.add_column('school_classes', sa.Column('description', sa.Text(), nullable=True))
        if 'subject_id' not in columns:
            op.add_column('school_classes', sa.Column('subject_id', sa.Integer(), nullable=True))
            op.create_foreign_key(
                'fk_school_classes_subject_id',
                'school_classes',
                'school_subjects',
                ['subject_id'],
                ['id']
            )
        if 'weekly_lessons' not in columns:
            op.add_column(
                'school_classes',
                sa.Column('weekly_lessons', sa.Integer(), nullable=False, server_default='5')
            )

    if 'school_teaching_assignments' in tables:
        columns = _column_names(inspector, 'school_teaching_assignments')
        if 'assignment_role' not in columns:
            op.add_column(
                'school_teaching_assignments',
                sa.Column('assignment_role', sa.String(length=40), nullable=False, server_default='lead-teacher')
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'school_teaching_assignments' in tables:
        columns = _column_names(inspector, 'school_teaching_assignments')
        if 'assignment_role' in columns:
            op.drop_column('school_teaching_assignments', 'assignment_role')

    if 'school_classes' in tables:
        columns = _column_names(inspector, 'school_classes')
        if 'weekly_lessons' in columns:
            op.drop_column('school_classes', 'weekly_lessons')
        if 'subject_id' in columns:
            op.drop_constraint('fk_school_classes_subject_id', 'school_classes', type_='foreignkey')
            op.drop_column('school_classes', 'subject_id')
        if 'description' in columns:
            op.drop_column('school_classes', 'description')

    if 'groups' in tables:
        columns = _column_names(inspector, 'groups')
        if 'school_day_config' in columns:
            op.drop_column('groups', 'school_day_config')
