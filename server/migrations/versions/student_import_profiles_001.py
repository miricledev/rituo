"""Add student profile fields for bulk account imports.

Revision ID: student_import_profiles_001
Revises: account_roles_planner_001
"""

from alembic import op
import sqlalchemy as sa


revision = 'student_import_profiles_001'
down_revision = 'account_roles_planner_001'
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    user_columns = {column['name'] for column in inspector.get_columns('users')}
    additions = (
        ('first_name', sa.Column('first_name', sa.String(length=80), nullable=True)),
        ('last_name', sa.Column('last_name', sa.String(length=80), nullable=True)),
        ('year_group', sa.Column('year_group', sa.String(length=40), nullable=True)),
        ('tutor_group', sa.Column('tutor_group', sa.String(length=120), nullable=True)),
    )
    with op.batch_alter_table('users') as batch_op:
        for column_name, column in additions:
            if column_name not in user_columns:
                batch_op.add_column(column)


def downgrade():
    inspector = sa.inspect(op.get_bind())
    user_columns = {column['name'] for column in inspector.get_columns('users')}
    with op.batch_alter_table('users') as batch_op:
        for column_name in ('tutor_group', 'year_group', 'last_name', 'first_name'):
            if column_name in user_columns:
                batch_op.drop_column(column_name)
