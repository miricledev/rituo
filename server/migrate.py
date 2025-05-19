from server import app
from db.models import db
from seed_halfway_user import seed_user

def init_db():
    with app.app_context():
        # Create all tables
        db.create_all()
        print("Database tables created successfully!")

        # Seed initial user if needed
        try:
            seed_user()
            print("Initial user seeded successfully!")
        except Exception as e:
            print(f"Error seeding user: {e}")

if __name__ == "__main__":
    init_db() 