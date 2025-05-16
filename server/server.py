from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta
import os
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Import routes
from routes.auth import auth_bp
from routes.tasks import tasks_bp
from routes.analytics import analytics_bp

# Import utils
from utils.reset_tasks import reset_daily_tasks

# Import database
from db.models import db

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure app
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/rituo_db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize extensions
jwt = JWTManager(app)
CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:5173"],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "max_age": 3600,
         "send_wildcard": False,
         "vary_header": True,
         "automatic_options": True
     }},
     supports_credentials=True)

# Initialize database
db.init_app(app)

# Create database tables if they don't exist
with app.app_context():
    db.create_all()

# Register blueprints without trailing slashes
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')

# Set up scheduler for daily task reset at midnight
scheduler = BackgroundScheduler()
scheduler.add_job(
    reset_daily_tasks,
    trigger=CronTrigger(hour=0, minute=0),
    id='reset_daily_tasks',
    name='Reset all task completions at midnight',
    replace_existing=True
)

@app.route('/')
def index():
    return {"message": "Welcome to Rituo API"}

if __name__ == '__main__':
    # Start the scheduler
    scheduler.start()
    
    # Run the Flask app
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)