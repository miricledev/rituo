"""Add digital performance cards

Revision ID: performance_cards_001
Revises: school_goals_impact_001
Create Date: 2026-03-09 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'performance_cards_001'
down_revision = 'school_goals_impact_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'performance_cards' not in existing_tables:
        op.create_table(
            'performance_cards',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('coach_id', sa.Integer(), nullable=False),
            sa.Column('card_date', sa.Date(), nullable=False),
            sa.Column('checkpoints', sa.JSON(), nullable=False),
            sa.Column('total_points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['coach_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'student_id', 'card_date', name='uq_performance_card_student_day')
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())
    if 'performance_cards' in existing_tables:
        op.drop_table('performance_cards')
