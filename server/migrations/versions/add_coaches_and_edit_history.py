"""Add coaches and edit history

Revision ID: coaches_edit_history
Revises: c1d2e3f4g5h6
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'coaches_edit_history'
down_revision = 'c1d2e3f4g5h6'
branch_labels = None
depends_on = None


def upgrade():
    # Create group_coaches association table (using IF NOT EXISTS check)
    connection = op.get_bind()
    
    # Check if group_coaches table exists
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'group_coaches'
        );
    """))
    table_exists = result.scalar()
    
    if not table_exists:
        op.create_table('group_coaches',
            sa.Column('coach_id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint('coach_id', 'group_id'),
            sa.ForeignKeyConstraint(['coach_id'], ['users.id'], ),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id'], )
        )
    
    # Check if coach_assignments table exists
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'coach_assignments'
        );
    """))
    table_exists = result.scalar()
    
    if not table_exists:
        op.create_table('coach_assignments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('coach_id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('coach_id', 'group_id', 'student_id', name='uq_coach_assignment'),
            sa.ForeignKeyConstraint(['coach_id'], ['users.id'], ),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ),
            sa.ForeignKeyConstraint(['student_id'], ['users.id'], )
        )
    
    # Add edit history columns to skill_development_charts (check if columns exist first)
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'skill_development_charts'
            AND column_name = 'edit_history'
        );
    """))
    column_exists = result.scalar()
    
    if not column_exists:
        op.add_column('skill_development_charts', sa.Column('edit_history', sa.JSON(), nullable=True))
        # Set default empty JSON for existing rows
        op.execute(sa.text("UPDATE skill_development_charts SET edit_history = '{}' WHERE edit_history IS NULL"))
    
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'skill_development_charts'
            AND column_name = 'last_edited_by_id'
        );
    """))
    column_exists = result.scalar()
    
    if not column_exists:
        op.add_column('skill_development_charts', sa.Column('last_edited_by_id', sa.Integer(), nullable=True))
    
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'skill_development_charts'
            AND column_name = 'last_edited_at'
        );
    """))
    column_exists = result.scalar()
    
    if not column_exists:
        op.add_column('skill_development_charts', sa.Column('last_edited_at', sa.DateTime(), nullable=True))
    
    # Check if foreign key constraint exists
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'skill_development_charts'
            AND constraint_name LIKE '%last_edited_by_id%'
            AND constraint_type = 'FOREIGN KEY'
        );
    """))
    fk_exists = result.scalar()
    
    if not fk_exists:
        try:
            op.create_foreign_key('fk_skill_chart_last_editor', 'skill_development_charts', 'users', ['last_edited_by_id'], ['id'])
        except Exception as e:
            # Foreign key might already exist, skip if so
            pass


def downgrade():
    # Remove edit history columns
    connection = op.get_bind()
    
    # Drop foreign key constraint
    try:
        op.drop_constraint('fk_skill_chart_last_editor', 'skill_development_charts', type_='foreignkey')
    except:
        pass
    
    # Check if columns exist before dropping
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'skill_development_charts'
            AND column_name = 'last_edited_at'
        );
    """))
    if result.scalar():
        op.drop_column('skill_development_charts', 'last_edited_at')
    
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'skill_development_charts'
            AND column_name = 'last_edited_by_id'
        );
    """))
    if result.scalar():
        op.drop_column('skill_development_charts', 'last_edited_by_id')
    
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'skill_development_charts'
            AND column_name = 'edit_history'
        );
    """))
    if result.scalar():
        op.drop_column('skill_development_charts', 'edit_history')
    
    # Drop coach_assignments table
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'coach_assignments'
        );
    """))
    if result.scalar():
        op.drop_table('coach_assignments')
    
    # Drop group_coaches table
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'group_coaches'
        );
    """))
    if result.scalar():
        op.drop_table('group_coaches')
