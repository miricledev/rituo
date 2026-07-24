"""Add school timetable to groups

Revision ID: school_timetable_001
Revises: performance_cards_001
Create Date: 2026-03-09 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'school_timetable_001'
down_revision = 'performance_cards_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('groups')}
    if 'school_timetable' not in columns:
        op.add_column('groups', sa.Column('school_timetable', sa.JSON(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('groups')}
    if 'school_timetable' in columns:
        op.drop_column('groups', 'school_timetable')
