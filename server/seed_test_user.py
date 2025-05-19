from datetime import date, timedelta
from db.models import db, User, Task, TaskCompletion
from server import app
import random

# --- CONFIGURABLE ---
USERNAME = 'testuser'
EMAIL = 'testuser@example.com'
PASSWORD_HASH = 'pbkdf2:sha256:150000$dummy$dummyhash'  # Replace with a real hash if needed

# Challenge dates
FIVE_MONTHS_AGO = date.today() - timedelta(days=150)  # ~5 months ago
THREE_MONTHS_AGO = date.today() - timedelta(days=90)  # ~3 months ago
CURRENT_CHALLENGE_START = date.today() - timedelta(days=22)  # 3/4 through current challenge

# Task lists for each challenge
FIVE_MONTH_TASKS = [
    "Morning Meditation",
    "Read 30 Minutes",
    "Exercise",
    "Journal Writing"
]

THREE_MONTH_TASKS = [
    "Cold Shower",
    "Learn New Skill",
    "Practice Gratitude",
    "Healthy Meal Prep",
    "Digital Detox",
    "Evening Reflection"
]

CURRENT_TASKS = [
    "Morning Workout",
    "Study Programming",
    "Practice Piano",
    "Read Non-Fiction",
    "Evening Meditation"
]

def create_challenge(user, start_date, tasks, completion_rate=0.85):
    """Create a challenge with tasks and completions"""
    cycle_end_date = start_date + timedelta(days=29)
    
    # Create tasks
    created_tasks = []
    for task_title in tasks:
        task = Task(
            user_id=user.id,
            title=task_title,
            description=f"Description for {task_title}",
            cycle_start_date=start_date,
            cycle_end_date=cycle_end_date
        )
        db.session.add(task)
        created_tasks.append(task)
    db.session.flush()

    # Create completions
    for task in created_tasks:
        for day_offset in range(30):
            completion_date = start_date + timedelta(days=day_offset)
            # Random completion with bias towards completion_rate
            is_complete = random.random() < completion_rate
            
            completion = TaskCompletion(
                task_id=task.id,
                user_id=user.id,
                completion_date=completion_date,
                is_complete=is_complete
            )
            db.session.add(completion)

if __name__ == "__main__":
    with app.app_context():
        with db.session.begin():
            # Create user
            user = User(
                username=USERNAME,
                email=EMAIL,
                password_hash=PASSWORD_HASH,
                current_cycle_start_date=CURRENT_CHALLENGE_START,
                current_cycle_end_date=CURRENT_CHALLENGE_START + timedelta(days=29)
            )
            db.session.add(user)
            db.session.flush()

            # Create past challenges
            create_challenge(user, FIVE_MONTHS_AGO, FIVE_MONTH_TASKS, completion_rate=0.85)
            create_challenge(user, THREE_MONTHS_AGO, THREE_MONTH_TASKS, completion_rate=0.80)
            
            # Create current challenge (only 22 days of data)
            create_challenge(user, CURRENT_CHALLENGE_START, CURRENT_TASKS, completion_rate=0.90)

        print("Successfully seeded test user with multiple challenges!") 