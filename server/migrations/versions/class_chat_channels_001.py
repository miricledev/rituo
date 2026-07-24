"""Add class chat channel support to messages

Revision ID: class_chat_channels_001
Revises: school_audit_001
Create Date: 2026-03-10 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'class_chat_channels_001'
down_revision = 'school_audit_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'messages' in tables:
      columns = {column['name'] for column in inspector.get_columns('messages')}
      if 'class_id' not in columns:
          op.add_column('messages', sa.Column('class_id', sa.Integer(), nullable=True))
          op.create_foreign_key('fk_messages_class_id', 'messages', 'school_classes', ['class_id'], ['id'])


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'messages' in tables:
        columns = {column['name'] for column in inspector.get_columns('messages')}
        if 'class_id' in columns:
            foreign_keys = inspector.get_foreign_keys('messages')
            for fk in foreign_keys:
                if fk.get('name') == 'fk_messages_class_id':
                    op.drop_constraint('fk_messages_class_id', 'messages', type_='foreignkey')
                    break
            op.drop_column('messages', 'class_id')
