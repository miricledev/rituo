"""Add school audit logs

Revision ID: school_audit_001
Revises: parent_profiles_ack_001
Create Date: 2026-03-10 19:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'school_audit_001'
down_revision = 'parent_profiles_ack_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'school_audit_logs' not in tables:
        op.create_table(
            'school_audit_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('actor_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=True),
            sa.Column('action_type', sa.String(length=80), nullable=False),
            sa.Column('entity_type', sa.String(length=80), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('metadata_json', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'school_audit_logs' in tables:
        op.drop_table('school_audit_logs')
