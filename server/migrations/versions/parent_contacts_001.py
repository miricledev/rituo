"""Add parent contact records

Revision ID: parent_contacts_001
Revises: interventions_001
Create Date: 2026-03-09 23:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'parent_contacts_001'
down_revision = 'interventions_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'parent_contact_records' not in tables:
        op.create_table(
            'parent_contact_records',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('staff_id', sa.Integer(), nullable=False),
            sa.Column('contact_date', sa.Date(), nullable=False),
            sa.Column('contact_type', sa.String(length=60), nullable=False),
            sa.Column('outcome', sa.String(length=120), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
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
    if 'parent_contact_records' in tables:
        op.drop_table('parent_contact_records')
