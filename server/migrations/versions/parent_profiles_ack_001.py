"""Add parent profiles and acknowledgement tracking

Revision ID: parent_profiles_ack_001
Revises: school_homework_001
Create Date: 2026-03-10 18:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'parent_profiles_ack_001'
down_revision = 'school_homework_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'parent_profiles' not in tables:
        op.create_table(
            'parent_profiles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('relationship', sa.String(length=60), nullable=True),
            sa.Column('phone', sa.String(length=40), nullable=True),
            sa.Column('email', sa.String(length=120), nullable=True),
            sa.Column('preferred_contact', sa.String(length=40), nullable=True),
            sa.Column('receives_updates', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )

    columns = {column['name'] for column in inspector.get_columns('parent_contact_records')} if 'parent_contact_records' in tables else set()
    if 'acknowledged' not in columns:
        op.add_column('parent_contact_records', sa.Column('acknowledged', sa.Boolean(), nullable=False, server_default=sa.false()))
    if 'acknowledged_at' not in columns:
        op.add_column('parent_contact_records', sa.Column('acknowledged_at', sa.DateTime(), nullable=True))
    if 'acknowledgement_note' not in columns:
        op.add_column('parent_contact_records', sa.Column('acknowledgement_note', sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'parent_contact_records' in tables:
        columns = {column['name'] for column in inspector.get_columns('parent_contact_records')}
        if 'acknowledgement_note' in columns:
            op.drop_column('parent_contact_records', 'acknowledgement_note')
        if 'acknowledged_at' in columns:
            op.drop_column('parent_contact_records', 'acknowledged_at')
        if 'acknowledged' in columns:
            op.drop_column('parent_contact_records', 'acknowledged')
    if 'parent_profiles' in tables:
        op.drop_table('parent_profiles')
