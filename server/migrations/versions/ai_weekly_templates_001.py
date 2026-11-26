"""Add recurring AI planner weekday templates

Revision ID: ai_weekly_templates_001
Revises: student_planner_settings_001
Create Date: 2026-08-05 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'ai_weekly_templates_001'
down_revision = 'student_planner_settings_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'ai_weekly_templates' not in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.add_column(sa.Column('ai_weekly_templates', sa.JSON(), nullable=False, server_default='{}'))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'ai_weekly_templates' in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.drop_column('ai_weekly_templates')
