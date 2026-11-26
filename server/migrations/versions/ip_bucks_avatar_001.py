"""Add IP Bucks wallet, ledger and purchases

Revision ID: ip_bucks_avatar_001
Revises: student_device_timezone_001
Create Date: 2026-08-07 15:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'ip_bucks_avatar_001'
down_revision = 'student_device_timezone_001'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if 'student_ip_wallets' not in tables:
        op.create_table(
            'student_ip_wallets',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('balance', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('lifetime_earned', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('lifetime_spent', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('student_id'),
        )

    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'student_ip_transactions' not in tables:
        op.create_table(
            'student_ip_transactions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('wallet_id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=True),
            sa.Column('amount', sa.Integer(), nullable=False),
            sa.Column('kind', sa.String(length=40), nullable=False),
            sa.Column('reference_key', sa.String(length=180), nullable=False),
            sa.Column('description', sa.String(length=240), nullable=False, server_default=''),
            sa.Column('details', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
            sa.ForeignKeyConstraint(['wallet_id'], ['student_ip_wallets.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('reference_key'),
        )
        op.create_index('ix_student_ip_transactions_wallet_created', 'student_ip_transactions', ['wallet_id', 'created_at'])

    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'student_ip_purchases' not in tables:
        op.create_table(
            'student_ip_purchases',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('wallet_id', sa.Integer(), nullable=False),
            sa.Column('item_id', sa.String(length=80), nullable=False),
            sa.Column('item_type', sa.String(length=30), nullable=False),
            sa.Column('price', sa.Integer(), nullable=False),
            sa.Column('purchased_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['wallet_id'], ['student_ip_wallets.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('wallet_id', 'item_id', name='uq_student_ip_purchase_item'),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if 'student_ip_purchases' in tables:
        op.drop_table('student_ip_purchases')
    if 'student_ip_transactions' in tables:
        op.drop_index('ix_student_ip_transactions_wallet_created', table_name='student_ip_transactions')
        op.drop_table('student_ip_transactions')
    if 'student_ip_wallets' in tables:
        op.drop_table('student_ip_wallets')
