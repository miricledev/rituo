"""Add student reward preferences

Revision ID: student_rewards_001
Revises: ai_weekly_templates_001
Create Date: 2026-08-06 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'student_rewards_001'
down_revision = 'ai_weekly_templates_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'reward_preferences' not in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.add_column(sa.Column('reward_preferences', sa.JSON(), nullable=False, server_default='{}'))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'reward_preferences' in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.drop_column('reward_preferences')
