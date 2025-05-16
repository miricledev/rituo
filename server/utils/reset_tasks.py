from db.models import db, User, Task, TaskCompletion
from datetime import date
import logging
from flask import current_app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_daily_tasks():
    """
    Reset all task completions for the new day.
    This function is scheduled to run at midnight.
    """
    try:
        with current_app.app_context():
            logger.info("Starting daily task reset...")
            
            # Get today's date
            today = date.today()
            
            # Get all active tasks
            active_tasks = Task.query.filter(Task.cycle_end_date >= today).all()
            
            if not active_tasks:
                logger.info("No active tasks found. Nothing to reset.")
                return
            
            logger.info(f"Found {len(active_tasks)} active tasks to process.")
            
            # Create new completion records for today for each active task
            new_completions = []
            task_count = 0
            
            for task in active_tasks:
                # Check if a record already exists for today (shouldn't happen, but just in case)
                existing = TaskCompletion.query.filter_by(
                    task_id=task.id,
                    user_id=task.user_id,
                    completion_date=today
                ).first()
                
                if not existing:
                    new_completion = TaskCompletion(
                        task_id=task.id,
                        user_id=task.user_id,
                        completion_date=today,
                        is_complete=False
                    )
                    new_completions.append(new_completion)
                    task_count += 1
            
            # Add all new completions to the database
            if new_completions:
                db.session.bulk_save_objects(new_completions)
                db.session.commit()
                logger.info(f"Successfully created {task_count} new task completion records for today.")
            else:
                logger.info("No new completion records needed to be created.")
            
            logger.info("Daily task reset completed successfully.")
            
    except Exception as e:
        logger.error(f"Error during daily task reset: {str(e)}")
        db.session.rollback()
        
if __name__ == "__main__":
    # This can be used to test the reset function manually
    # Note: This won't work as a standalone script without app context
    # It's meant to be imported and used within the Flask app
    pass