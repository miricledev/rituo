"""Add student AI tools and meditation sessions

Revision ID: student_tools_001
Revises: ip_bucks_avatar_001
Create Date: 2026-08-08 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'student_tools_001'
down_revision = 'ip_bucks_avatar_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if 'student_tool_states' not in tables:
        op.create_table(
            'student_tool_states',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('study_plan', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('fitness_plan', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('tutor_progress', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'student_id', name='uq_student_tool_state'),
        )

    tables = set(inspect(bind).get_table_names())
    if 'guided_meditation_sessions' not in tables:
        op.create_table(
            'guided_meditation_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('session_key', sa.String(length=64), nullable=False),
            sa.Column('session_data', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('alignment', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('narration_filename', sa.String(length=180), nullable=False),
            sa.Column('music_filename', sa.String(length=180), nullable=True),
            sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('session_key'),
        )


def downgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if 'guided_meditation_sessions' in tables:
        op.drop_table('guided_meditation_sessions')
    if 'student_tool_states' in tables:
        op.drop_table('student_tool_states')
