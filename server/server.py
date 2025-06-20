from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt, verify_jwt_in_request
from datetime import timedelta
import os
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
from logging.handlers import RotatingFileHandler
from flask_migrate import Migrate

# Import routes
from routes.auth import auth_bp
from routes.tasks import tasks_bp
from routes.analytics import analytics_bp
from routes.payments import payments_bp
from routes.groups import groups_bp

# Import utils
from utils.reset_tasks import reset_daily_tasks

# Import database
from db.models import db

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure logging
if not app.debug:
    if not os.path.exists('logs'):
        os.mkdir('logs')
    file_handler = RotatingFileHandler('logs/rituo.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Rituo startup')

# Configure app
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
app.config["JWT_TOKEN_LOCATION"] = ["headers"]
app.config["JWT_HEADER_NAME"] = "Authorization"
app.config["JWT_HEADER_TYPE"] = "Bearer"
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv('DATABASE_URL')
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize extensions
jwt = JWTManager(app)
CORS(app, 
     resources={r"/*": {
         "origins": [
             "http://localhost:5173",  # Development
             "http://localhost:4173",  # Production preview
             os.getenv("FRONTEND_URL", "https://rituo-client.onrender.com")
         ],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type", "Authorization"],
         "max_age": 3600,
         "send_wildcard": False,
         "vary_header": True,
         "automatic_options": True
     }},
     supports_credentials=True)

# Initialize database and migrations
db.init_app(app)
migrate = Migrate(app, db)

# Add request logging middleware
@app.before_request
def log_request_info():
    app.logger.info('Headers: %s', dict(request.headers))
    app.logger.info('Body: %s', request.get_data())

# JWT error handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    app.logger.warning("Token expired: %s, %s", jwt_header, jwt_payload)
    return jsonify({
        'message': 'The token has expired',
        'error': 'token_expired'
    }), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    app.logger.warning("Invalid token: %s", error)
    return jsonify({
        'message': 'Invalid token',
        'error': 'invalid_token'
    }), 401

@jwt.unauthorized_loader
def unauthorized_callback(error):
    app.logger.warning("Unauthorized: %s", error)
    return jsonify({
        'message': 'Missing token',
        'error': 'missing_token'
    }), 401

# Create database tables if they don't exist
with app.app_context():
    try:
        db.create_all()
        app.logger.info('Database tables created successfully')
    except Exception as e:
        app.logger.error('Error creating database tables: %s', str(e))
        raise

# Register blueprints without trailing slashes
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
app.register_blueprint(payments_bp, url_prefix='/api/payments')
app.register_blueprint(groups_bp, url_prefix='/api/groups')

# Set up scheduler for daily task reset at midnight
scheduler = BackgroundScheduler(timezone='UTC')
scheduler.add_job(
    reset_daily_tasks,
    trigger=CronTrigger(hour=0, minute=0, timezone='UTC'),
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
    app.run(host='0.0.0.0', port=port, debug=False)