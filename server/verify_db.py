from server import app
from db.models import db, User
import os

def verify_database():
    with app.app_context():
        try:
            # Check if tables exist
            print("Checking database tables...")
            db.create_all()
            print("Database tables verified!")
            
            # Check if we can query users
            print("\nChecking user table...")
            users = User.query.all()
            print(f"Found {len(users)} users in the database")
            
            # Print database URL (without password)
            db_url = os.getenv('DATABASE_URL', 'Not set')
            if db_url != 'Not set':
                # Mask the password in the URL
                masked_url = db_url.replace(db_url.split('@')[0].split(':')[-1], '****')
                print(f"\nDatabase URL: {masked_url}")
            else:
                print("\nDATABASE_URL environment variable is not set!")
            
            return True
        except Exception as e:
            print(f"Error verifying database: {str(e)}")
            return False

if __name__ == "__main__":
    verify_database() 