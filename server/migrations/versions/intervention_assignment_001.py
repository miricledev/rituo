"""Add intervention owner and due date

Revision ID: intervention_assignment_001
Revises: parent_contacts_001
Create Date: 2026-03-09 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'intervention_assignment_001'
down_revision = 'parent_contacts_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('intervention_records')}
    if 'owner_id' not in columns:
        op.add_column('intervention_records', sa.Column('owner_id', sa.Integer(), nullable=True))
        op.create_foreign_key(None, 'intervention_records', 'users', ['owner_id'], ['id'])
    if 'due_date' not in columns:
        op.add_column('intervention_records', sa.Column('due_date', sa.Date(), nullable=True))
    if 'auto_created' not in columns:
        op.add_column('intervention_records', sa.Column('auto_created', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('intervention_records')}
    if 'auto_created' in columns:
        op.drop_column('intervention_records', 'auto_created')
    if 'due_date' in columns:
        op.drop_column('intervention_records', 'due_date')
    if 'owner_id' in columns:
        op.drop_constraint(op.f('intervention_records_owner_id_fkey'), 'intervention_records', type_='foreignkey')
        op.drop_column('intervention_records', 'owner_id')
