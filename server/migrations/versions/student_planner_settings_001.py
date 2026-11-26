"""Add persistent student planner settings

Revision ID: student_planner_settings_001
Revises: school_classes_permissions_001
Create Date: 2026-08-05 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'student_planner_settings_001'
down_revision = 'school_classes_permissions_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' in inspector.get_table_names():
        columns = {column['name'] for column in inspector.get_columns('student_planner_settings')}
        if 'ai_weekly_templates' not in columns:
            with op.batch_alter_table('student_planner_settings') as batch_op:
                batch_op.add_column(sa.Column('ai_weekly_templates', sa.JSON(), nullable=False, server_default='{}'))
        return
    op.create_table(
        'student_planner_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('wake_time', sa.String(length=5), nullable=False, server_default='07:00'),
        sa.Column('bedtime', sa.String(length=5), nullable=False, server_default='22:00'),
        sa.Column('recurring_reminders', sa.JSON(), nullable=False),
        sa.Column('ai_weekly_templates', sa.JSON(), nullable=False),
        sa.Column('google_calendar_refresh_token', sa.Text(), nullable=True),
        sa.Column('google_calendar_access_token', sa.Text(), nullable=True),
        sa.Column('google_calendar_token_expiry', sa.DateTime(), nullable=True),
        sa.Column('google_calendar_scopes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('group_id', 'student_id', name='uq_student_planner_settings'),
    )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'student_planner_settings' in inspector.get_table_names():
        op.drop_table('student_planner_settings')
