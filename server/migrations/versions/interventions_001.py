"""Add intervention records

Revision ID: interventions_001
Revises: lesson_registers_001
Create Date: 2026-03-09 22:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'interventions_001'
down_revision = 'lesson_registers_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'intervention_records' not in tables:
        op.create_table(
            'intervention_records',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('staff_id', sa.Integer(), nullable=False),
            sa.Column('intervention_type', sa.String(length=80), nullable=False),
            sa.Column('status', sa.String(length=40), nullable=False, server_default='scheduled'),
            sa.Column('intervention_date', sa.Date(), nullable=False),
            sa.Column('summary', sa.Text(), nullable=True),
            sa.Column('next_step', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.ForeignKeyConstraint(['staff_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'intervention_records' in tables:
        op.drop_table('intervention_records')
