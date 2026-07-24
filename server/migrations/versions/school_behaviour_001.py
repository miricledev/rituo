"""Add school behaviour catalogue and event tables

Revision ID: school_behaviour_001
Revises: school_structure_roles_001
Create Date: 2026-03-10 13:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'school_behaviour_001'
down_revision = 'school_structure_roles_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'school_behaviour_types' not in tables:
        op.create_table(
            'school_behaviour_types',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('kind', sa.String(length=40), nullable=False),
            sa.Column('severity', sa.String(length=20), nullable=False, server_default='low'),
            sa.Column('default_points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('note_type', sa.String(length=60), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'name', name='uq_school_behaviour_type_group_name')
        )

    if 'school_behaviour_events' not in tables:
        op.create_table(
            'school_behaviour_events',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('staff_id', sa.Integer(), nullable=False),
            sa.Column('lesson_register_id', sa.Integer(), nullable=True),
            sa.Column('behaviour_type_id', sa.Integer(), nullable=True),
            sa.Column('event_date', sa.Date(), nullable=False),
            sa.Column('subject', sa.String(length=120), nullable=True),
            sa.Column('class_name', sa.String(length=120), nullable=True),
            sa.Column('kind', sa.String(length=40), nullable=False),
            sa.Column('severity', sa.String(length=20), nullable=False, server_default='low'),
            sa.Column('title', sa.String(length=120), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('points_delta', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['behaviour_type_id'], ['school_behaviour_types.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['lesson_register_id'], ['lesson_registers.id']),
            sa.ForeignKeyConstraint(['staff_id'], ['users.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'school_behaviour_events' in tables:
        op.drop_table('school_behaviour_events')
    if 'school_behaviour_types' in tables:
        op.drop_table('school_behaviour_types')
