from db.models import db, User, Group, GroupChallenge, Task, TaskCompletion, TaskNote
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta, date
import random
from flask import Flask
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/rituo_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

def seed_database():
    with app.app_context():
        # Delete all dependent records in the correct order
        TaskCompletion.query.delete()
        TaskNote.query.delete()
        Task.query.delete()
        db.session.execute('DELETE FROM user_active_challenges')
        db.session.execute('DELETE FROM user_groups')
        db.session.execute('DELETE FROM user_leading_groups')
        GroupChallenge.query.delete()
        Group.query.delete()
        User.query.delete()
        db.session.commit()

        # Create group owner
        owner = User(
            username="group_owner",
            email="owner@test.com",
            password=generate_password_hash("password123")
        )
        db.session.add(owner)
        db.session.commit()

        # Create group
        group = Group(
            name="Test Group",
            group_id="TEST123",
            password="group123",
            leader_id=owner.id
        )
        db.session.add(group)
        db.session.commit()

        # Create 10 members
        members = []
        for i in range(10):
            member = User(
                username=f"member{i+1}",
                email=f"member{i+1}@test.com",
                password=generate_password_hash("password123")
            )
            members.append(member)
            db.session.add(member)
        db.session.commit()

        # Add members to group
        group.members = members
        db.session.commit()

        # Create group challenge
        start_date = datetime.now() - timedelta(days=17)
        end_date = start_date + timedelta(days=30)
        
        # Define some sample habits
        habit_templates = [
            {"name": "Morning Meditation", "description": "15 minutes of meditation", "frequency": "daily"},
            {"name": "Exercise", "description": "30 minutes workout", "frequency": "daily"},
            {"name": "Reading", "description": "Read 20 pages", "frequency": "daily"},
            {"name": "Water Intake", "description": "Drink 2L of water", "frequency": "daily"},
            {"name": "Journaling", "description": "Write in journal", "frequency": "daily"},
            {"name": "Healthy Eating", "description": "Eat 3 balanced meals", "frequency": "daily"},
            {"name": "Learning", "description": "Learn something new", "frequency": "daily"},
            {"name": "Sleep", "description": "8 hours of sleep", "frequency": "daily"}
        ]

        # Create member habits with random progress
        member_habits = []
        for member in members:
            # Randomly select 3-5 habits for each member
            num_habits = random.randint(3, 5)
            selected_habits = random.sample(habit_templates, num_habits)
            
            habits_with_progress = []
            for habit in selected_habits:
                # Generate random progress for each day
                progress = []
                current_date = start_date
                while current_date <= datetime.now():
                    # 70-90% chance of completion
                    is_complete = random.random() < random.uniform(0.7, 0.9)
                    progress.append({
                        "date": current_date.isoformat(),
                        "completed": is_complete
                    })
                    current_date += timedelta(days=1)
                
                habits_with_progress.append({
                    **habit,
                    "progress": progress
                })
            
            member_habits.append({
                "member": str(member.id),
                "habits": habits_with_progress
            })

        # Create the challenge
        challenge = GroupChallenge(
            group_id=group.id,
            start_date=start_date,
            end_date=end_date,
            member_habits=member_habits,
            status="active"
        )
        db.session.add(challenge)
        
        # Update group's active challenge
        group.active_challenge = challenge
        
        # Update all members' active challenges
        for member in members:
            member.active_group_challenges.append(challenge)
        
        db.session.commit()

        print("Database seeded successfully!")
        print(f"Created group owner: {owner.username}")
        print(f"Created group: {group.name} (ID: {group.group_id})")
        print(f"Created {len(members)} members")
        print(f"Created challenge from {start_date} to {end_date}")

if __name__ == "__main__":
    seed_database() 