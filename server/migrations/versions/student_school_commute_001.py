"""Add student school commute setting

Revision ID: student_school_commute_001
Revises: staff_personal_challenges_001
Create Date: 2026-08-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'student_school_commute_001'
down_revision = 'staff_personal_challenges_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'school_commute_minutes' not in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.add_column(sa.Column('school_commute_minutes', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'school_commute_minutes' in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.drop_column('school_commute_minutes')
