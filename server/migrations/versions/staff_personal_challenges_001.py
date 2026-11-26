"""Add independent staff personal challenges

Revision ID: staff_personal_challenges_001
Revises: global_meditations_promote_001
Create Date: 2026-08-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'staff_personal_challenges_001'
down_revision = 'global_meditations_promote_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if 'staff_personal_challenges' not in tables:
        op.create_table(
            'staff_personal_challenges',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('member_id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=140), nullable=False, server_default='My personal challenge'),
            sa.Column('start_date', sa.DateTime(), nullable=False),
            sa.Column('end_date', sa.DateTime(), nullable=False),
            sa.Column('habits', sa.JSON(), nullable=False, server_default='[]'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['member_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            'ix_staff_personal_challenge_group_member',
            'staff_personal_challenges',
            ['group_id', 'member_id'],
            unique=False,
        )
        op.create_index(
            'ix_staff_personal_challenge_status',
            'staff_personal_challenges',
            ['group_id', 'status'],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if 'staff_personal_challenges' in tables:
        op.drop_index('ix_staff_personal_challenge_status', table_name='staff_personal_challenges')
        op.drop_index('ix_staff_personal_challenge_group_member', table_name='staff_personal_challenges')
        op.drop_table('staff_personal_challenges')
