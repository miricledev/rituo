import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment
database_url = os.getenv('DATABASE_URL')

if not database_url:
    print("DATABASE_URL not found in environment variables")
    exit(1)

try:
    # Connect to PostgreSQL database
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    # Add the read_by column
    cursor.execute('ALTER TABLE messages ADD COLUMN read_by TEXT DEFAULT \'[]\'')
    conn.commit()
    print("Successfully added read_by column to messages table")
    
except psycopg2.OperationalError as e:
    if "duplicate column name" in str(e):
        print("Column read_by already exists")
    else:
        print(f"Error: {e}")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close() 