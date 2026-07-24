"""Add courses, sections, items, progress tables and extend group_challenges

Revision ID: courses_001
Revises: coaches_edit_history
Create Date: 2025-02-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'courses_001'
down_revision = 'coaches_edit_history'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('courses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('course_sections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('course_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.Integer(), nullable=False),
        sa.Column('item_type', sa.String(length=20), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['section_id'], ['course_sections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('course_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('challenge_id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.Integer(), nullable=False),
        sa.Column('watch_time_seconds', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('quiz_scores', sa.JSON(), nullable=True),
        sa.Column('last_activity_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['challenge_id'], ['group_challenges.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['course_sections.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'challenge_id', 'section_id', name='uq_course_progress_user_challenge_section')
    )

    op.add_column('group_challenges', sa.Column('course_id', sa.Integer(), nullable=True))
    op.add_column('group_challenges', sa.Column('course_required_member_ids', sa.JSON(), nullable=True))
    op.create_foreign_key('fk_challenge_course', 'group_challenges', 'courses', ['course_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_challenge_course', 'group_challenges', type_='foreignkey')
    op.drop_column('group_challenges', 'course_required_member_ids')
    op.drop_column('group_challenges', 'course_id')
    op.drop_table('course_progress')
    op.drop_table('course_items')
    op.drop_table('course_sections')
    op.drop_table('courses')
