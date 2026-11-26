"""Add Google Calendar planner sync preferences

Revision ID: google_calendar_sync_001
Revises: student_school_commute_001
Create Date: 2026-08-09 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'google_calendar_sync_001'
down_revision = 'student_school_commute_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'google_calendar_hidden_event_ids' not in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.add_column(sa.Column('google_calendar_hidden_event_ids', sa.JSON(), nullable=False, server_default='[]'))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' not in inspector.get_table_names():
        return
    columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
    if 'google_calendar_hidden_event_ids' in columns:
        with op.batch_alter_table('student_planner_settings') as batch_op:
            batch_op.drop_column('google_calendar_hidden_event_ids')
