"""Add student goals and school impact tables

Revision ID: school_goals_impact_001
Revises: courses_001
Create Date: 2026-03-09 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'school_goals_impact_001'
down_revision = 'courses_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'student_goals' not in existing_tables:
        op.create_table(
            'student_goals',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('barrier', sa.String(length=255), nullable=True),
            sa.Column('school_goal', sa.String(length=255), nullable=True),
            sa.Column('for_self', sa.String(length=255), nullable=True),
            sa.Column('for_others', sa.String(length=255), nullable=True),
            sa.Column('created_by_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )

    if 'school_impact_records' not in existing_tables:
        op.create_table(
            'school_impact_records',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('coach_id', sa.Integer(), nullable=False),
            sa.Column('week_ending', sa.Date(), nullable=False),
            sa.Column('truancy_incidents', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('positive_points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('negative_points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('coach_notes', sa.Text(), nullable=True),
            sa.Column('evidence_file_name', sa.String(length=255), nullable=True),
            sa.Column('evidence_original_name', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['coach_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    op.drop_table('school_impact_records')
    op.drop_table('student_goals')
