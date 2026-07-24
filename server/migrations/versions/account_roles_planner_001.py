"""Add platform account roles, legacy groups, and student schedule plans

Revision ID: account_roles_planner_001
Revises: class_chat_channels_001
Create Date: 2026-07-24 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'account_roles_planner_001'
down_revision = 'class_chat_channels_001'
branch_labels = None
depends_on = None


def _column_names(inspector, table_name):
    return {column['name'] for column in inspector.get_columns(table_name)}


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    user_columns = _column_names(inspector, 'users')
    if 'account_role' not in user_columns:
        op.add_column('users', sa.Column('account_role', sa.String(length=20), nullable=False, server_default='student'))
    if 'is_active' not in user_columns:
        op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))
    if 'managed_by_id' not in user_columns:
        op.add_column('users', sa.Column('managed_by_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_users_managed_by_id', 'users', 'users', ['managed_by_id'], ['id'])

    group_columns = _column_names(inspector, 'groups')
    if 'is_legacy' not in group_columns:
        op.add_column('groups', sa.Column('is_legacy', sa.Boolean(), nullable=False, server_default=sa.true()))

    if 'student_schedule_plans' not in inspector.get_table_names():
        op.create_table(
            'student_schedule_plans',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('plan_date', sa.Date(), nullable=False),
            sa.Column('constraints_text', sa.Text(), nullable=True),
            sa.Column('items', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'student_id', 'plan_date', name='uq_student_schedule_plan_day')
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'student_schedule_plans' in tables:
        op.drop_table('student_schedule_plans')

    group_columns = _column_names(inspector, 'groups')
    if 'is_legacy' in group_columns:
        op.drop_column('groups', 'is_legacy')

    user_columns = _column_names(inspector, 'users')
    if 'managed_by_id' in user_columns:
        op.drop_constraint('fk_users_managed_by_id', 'users', type_='foreignkey')
        op.drop_column('users', 'managed_by_id')
    if 'is_active' in user_columns:
        op.drop_column('users', 'is_active')
    if 'account_role' in user_columns:
        op.drop_column('users', 'account_role')
