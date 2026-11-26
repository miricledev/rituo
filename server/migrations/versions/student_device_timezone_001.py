"""Add student device timezone

Revision ID: student_device_timezone_001
Revises: student_rewards_001
Create Date: 2026-08-06 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'student_device_timezone_001'
down_revision = 'student_rewards_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'timezone_name' not in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.add_column(sa.Column(
                'timezone_name',
                sa.String(length=64),
                nullable=False,
                server_default='Europe/London',
            ))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'timezone_name' in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.drop_column('timezone_name')
