"""Promote existing guided meditations to global publication

Revision ID: global_meditations_promote_001
Revises: global_meditations_001
Create Date: 2026-08-08 02:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'global_meditations_promote_001'
down_revision = 'global_meditations_001'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text(
        'UPDATE guided_meditation_sessions '
        'SET is_global = TRUE '
        'WHERE group_id IS NOT NULL'
    ))


def downgrade():
    op.execute(sa.text(
        'UPDATE guided_meditation_sessions '
        'SET is_global = FALSE '
        'WHERE group_id IS NOT NULL'
    ))
