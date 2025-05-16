from datetime import date, timedelta
from db.models import db, User, Task, TaskCompletion
from server import app  # If your app is in server/server.py and named 'app'

# --- CONFIGURABLE ---
USERNAME = 'seeduser'
EMAIL = 'seeduser@example.com'
PASSWORD_HASH = 'pbkdf2:sha256:150000$dummy$dummyhash'  # Replace with a real hash if needed
START_OFFSET = 15  # Days ago the cycle started
CYCLE_LENGTH = 30
NUM_TASKS = 5

if __name__ == "__main__":
    with app.app_context():
        with db.session.begin():
            # 1. Create user
            user = User(
                username=USERNAME,
                email=EMAIL,
                password_hash=PASSWORD_HASH,
                current_cycle_start_date=date.today() - timedelta(days=START_OFFSET),
                current_cycle_end_date=date.today() + timedelta(days=(CYCLE_LENGTH - START_OFFSET))
            )
            db.session.add(user)
            db.session.flush()  # Get user.id

            # 2. Create tasks
            tasks = []
            for i in range(NUM_TASKS):
                task = Task(
                    user_id=user.id,
                    title=f"Daily Habit {i+1}",
                    description=f"Description for habit {i+1}",
                    cycle_start_date=user.current_cycle_start_date,
                    cycle_end_date=user.current_cycle_end_date
                )
                db.session.add(task)
                tasks.append(task)
            db.session.flush()  # Get task ids

            # 3. Create TaskCompletion records for the past 15 days
            for task in tasks:
                for day_offset in range(START_OFFSET):
                    completion_date = user.current_cycle_start_date + timedelta(days=day_offset)
                    is_complete = (day_offset % 2 == 0)  # Alternate complete/incomplete
                    completion = TaskCompletion(
                        task_id=task.id,
                        user_id=user.id,
                        completion_date=completion_date,
                        is_complete=is_complete
                    )
                    db.session.add(completion)

        print("Seeded user and tasks!") 