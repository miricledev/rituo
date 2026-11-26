"""Add globally published meditation sessions

Revision ID: global_meditations_001
Revises: student_tools_001
Create Date: 2026-08-08 01:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'global_meditations_001'
down_revision = 'student_tools_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'guided_meditation_sessions' not in inspector.get_table_names():
        op.create_table(
            'guided_meditation_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=True),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('session_key', sa.String(length=64), nullable=False),
            sa.Column('session_data', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('alignment', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('narration_filename', sa.String(length=180), nullable=False),
            sa.Column('music_filename', sa.String(length=180), nullable=True),
            sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('is_global', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('session_key'),
        )
        return
    columns = {column['name']: column for column in inspector.get_columns('guided_meditation_sessions')}
    if 'is_global' not in columns:
        op.add_column('guided_meditation_sessions', sa.Column('is_global', sa.Boolean(), nullable=False, server_default=sa.false()))
    if not columns['group_id']['nullable']:
        op.alter_column('guided_meditation_sessions', 'group_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'guided_meditation_sessions' not in inspector.get_table_names():
        return
    columns = {column['name']: column for column in inspector.get_columns('guided_meditation_sessions')}
    op.execute(sa.text('DELETE FROM guided_meditation_sessions WHERE group_id IS NULL'))
    if columns['group_id']['nullable']:
        op.alter_column('guided_meditation_sessions', 'group_id', existing_type=sa.Integer(), nullable=False)
    if 'is_global' in columns:
        op.drop_column('guided_meditation_sessions', 'is_global')
