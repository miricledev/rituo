from server import app
from db.models import db

def add_read_by_column():
    with app.app_context():
        try:
            # Add the read_by column using raw SQL
            db.engine.execute('ALTER TABLE messages ADD COLUMN read_by TEXT DEFAULT \'[]\'')
            print("Successfully added read_by column to messages table")
        except Exception as e:
            if "duplicate column name" in str(e) or "already exists" in str(e):
                print("Column read_by already exists")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    add_read_by_column() 