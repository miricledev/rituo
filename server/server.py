from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt, verify_jwt_in_request
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import timedelta, datetime, timezone
import os
import time
import threading
from dotenv import load_dotenv
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
from db.models import db, User, Group, Message

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure logging - always log to console for debugging
# Force stdout for PowerShell compatibility
import sys
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
))
console_handler.setLevel(logging.INFO)
app.logger.addHandler(console_handler)
app.logger.setLevel(logging.INFO)

# Also log to file in production
if not app.debug:
    os.makedirs('logs', exist_ok=True)
    file_handler = RotatingFileHandler('logs/rituo.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)

# Print to stdout only in development (helps with PowerShell debugging)
# In production, rely on proper logging
if os.getenv('FLASK_ENV') == 'development' or os.getenv('DEBUG') == 'True':
    print("=" * 60)
    print("Rituo Server Starting...")
    print("=" * 60)
app.logger.info('Rituo startup')

# Configure app
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
app.config["JWT_TOKEN_LOCATION"] = ["headers"]
app.config["JWT_HEADER_NAME"] = "Authorization"
app.config["JWT_HEADER_TYPE"] = "Bearer"
# Handle PostgreSQL URL format for Render
database_url = os.getenv('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize extensions
jwt = JWTManager(app)

# Configure CORS - must be before any route handlers
# Explicitly list all allowed origins for development and production
allowed_origins = [
    "http://localhost:5173",  # Development
    "http://localhost:5174",  # Development (alternate port)
    "http://localhost:4173",  # Production preview
]

# Add production URL if it exists
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

# Apply CORS to all routes - use simple origins list
# This ensures Flask-CORS handles ALL routes including OPTIONS preflight
CORS(app, 
     origins=allowed_origins,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
     allow_headers=["Content-Type", "Authorization"],
     expose_headers=["Content-Type", "Authorization"],
     max_age=3600,
     supports_credentials=True,
     automatic_options=True)

# Initialize SocketIO with CORS support
socketio = SocketIO(app, cors_allowed_origins=[
    "http://localhost:5173",  # Development
    "http://localhost:5174",  # Development (alternate port)
    "http://localhost:4173",  # Production preview
    os.getenv("FRONTEND_URL", "https://rituo-client.onrender.com")
])

# Initialize database and migrations
db.init_app(app)
migrate = Migrate(app, db)

# Add request logging middleware - log ALL requests including OPTIONS
# Only print to stdout in development to avoid cluttering production logs
DEBUG_MODE = os.getenv('FLASK_ENV') == 'development' or os.getenv('DEBUG') == 'True'

@app.before_request
def log_request_info():
    origin = request.headers.get('Origin', 'No Origin')
    log_msg = f'[{request.method}] {request.path} - Origin: {origin}'
    if DEBUG_MODE:
        print(log_msg)  # Print to stdout only in development
    app.logger.info(log_msg)
    
    if request.method == 'OPTIONS':
        preflight_msg = f'CORS Preflight: {request.headers.get("Access-Control-Request-Method")} from {origin}'
        if DEBUG_MODE:
            print(preflight_msg)
        app.logger.info(preflight_msg)
        headers_msg = f'Request Headers: Access-Control-Request-Method: {request.headers.get("Access-Control-Request-Method")}, Access-Control-Request-Headers: {request.headers.get("Access-Control-Request-Headers")}'
        if DEBUG_MODE:
            print(headers_msg)
        app.logger.info(headers_msg)
        # Don't manually add headers - let Flask-CORS handle it
        if DEBUG_MODE:
            print(f'✓ Letting Flask-CORS handle preflight for origin: {origin}')
        # Don't return - let Flask-CORS handle the OPTIONS request
    
    if request.method != 'OPTIONS':
        app.logger.info(f'Request Headers: {dict(request.headers)}')
        if request.is_json:
            body_msg = f'Request Body: {request.get_json()}'
            if DEBUG_MODE:
                print(body_msg)
            app.logger.info(body_msg)
        else:
            body_msg = f'Request Body (raw): {request.get_data()}'
            if DEBUG_MODE:
                print(body_msg)
            app.logger.info(body_msg)

# Add CORS headers manually ONLY if Flask-CORS didn't add them (as a fallback)
@app.after_request
def add_cors_headers(response):
    # Only add if Flask-CORS didn't already add the header
    if 'Access-Control-Allow-Origin' not in response.headers:
        origin = request.headers.get('Origin')
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '3600'
            if DEBUG_MODE:
                print(f'✓ Added fallback CORS headers for origin: {origin}')
    return response

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

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    app.logger.info('Client connected: %s', request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    app.logger.info('Client disconnected: %s', request.sid)

@socketio.on('join_group_chat')
def handle_join_group_chat(data):
    try:
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        
        # Verify user is in the group
        group = Group.query.filter_by(group_id=group_id).first() if not str(group_id).isdigit() else Group.query.get(group_id)
        if not group:
            emit('error', {'message': 'Group not found'})
            return
        
        user = User.query.get(user_id)
        if not user or (user_id not in [m.id for m in group.members] and user_id != group.leader_id):
            emit('error', {'message': 'Not authorized to join group chat'})
            return
        
        # Always use the public group code for the room name
        room = f'group_chat_{group.group_id}'
        join_room(room)
        emit('joined_group_chat', {'group_id': group.group_id, 'room': room})
        app.logger.info('User %s joined group chat %s (room: %s)', user_id, group.group_id, room)
        
        # Mark all group chat messages as read for this user
        import json
        group_messages = Message.query.filter_by(group_id=group.id, recipient_id=None).all()
        for msg in group_messages:
            read_by = json.loads(msg.read_by or '[]')
            if user_id not in read_by:
                read_by.append(user_id)
                msg.read_by = json.dumps(read_by)
        db.session.commit()
        
    except Exception as e:
        app.logger.error('Error joining group chat: %s', str(e))
        emit('error', {'message': 'Failed to join group chat'})

@socketio.on('leave_group_chat')
def handle_leave_group_chat(data):
    try:
        group_id = data.get('group_id')
        room = f'group_chat_{group_id}'
        leave_room(room)
        emit('left_group_chat', {'group_id': group_id})
        app.logger.info('User left group chat %s', group_id)
        
    except Exception as e:
        app.logger.error('Error leaving group chat: %s', str(e))

@socketio.on('send_group_message')
def handle_send_group_message(data):
    try:
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        content = data.get('content', '').strip()
        
        if not content:
            emit('error', {'message': 'Message content required'})
            return
        
        # Verify user is in the group
        group = Group.query.filter_by(group_id=group_id).first() if not str(group_id).isdigit() else Group.query.get(group_id)
        if not group:
            emit('error', {'message': 'Group not found'})
            return
        
        user = User.query.get(user_id)
        if not user or (user_id not in [m.id for m in group.members] and user_id != group.leader_id):
            emit('error', {'message': 'Not authorized to send message'})
            return
        
        # Save message to database
        msg = Message(group_id=group.id, sender_id=user_id, content=content)
        db.session.add(msg)
        db.session.commit()
        
        # Broadcast to all users in the group chat
        room = f'group_chat_{group.group_id}'
        emit('receive_group_message', {
            'id': msg.id,
            'sender_id': msg.sender_id,
            'sender_username': user.username,
            'content': msg.content,
            'created_at': msg.created_at.isoformat(),
            'message_type': msg.message_type
        }, room=room)
        
        app.logger.info('Group message sent by user %s in group %s', user_id, group_id)
        
    except Exception as e:
        app.logger.error('Error sending group message: %s', str(e))
        emit('error', {'message': 'Failed to send message'})

@socketio.on('join_dm')
def handle_join_dm(data):
    try:
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        target_user_id = data.get('target_user_id')
        
        # Verify permissions
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            emit('error', {'message': 'Group not found'})
            return
        
        # Check if current user is the leader
        is_leader = user_id == group.leader_id
        # Check if current user is the member trying to DM the leader
        is_member_dming_leader = target_user_id == group.leader_id and user_id in [m.id for m in group.members]
        
        # Only leader or the member trying to DM the leader can join
        if not is_leader and not is_member_dming_leader:
            emit('error', {'message': 'Not authorized to join DM'})
            return
        
        # Only allow DMs between leader and member
        if target_user_id == group.leader_id:
            # This is a member trying to DM the leader - this is allowed
            pass
        elif target_user_id not in [m.id for m in group.members]:
            emit('error', {'message': 'User not in group'})
            return
        
        room = f'dm_{group.group_id}_{min(user_id, target_user_id)}_{max(user_id, target_user_id)}'
        join_room(room)
        emit('joined_dm', {'group_id': group.group_id, 'target_user_id': target_user_id, 'room': room})
        app.logger.info('User %s joined DM with user %s in group %s', user_id, target_user_id, group.group_id)
        
        # Mark DM messages as read for this user
        import json
        dm_messages = Message.query.filter_by(
            group_id=group.id,
            sender_id=target_user_id,
            recipient_id=user_id
        ).all()
        for msg in dm_messages:
            read_by = json.loads(msg.read_by or '[]')
            if user_id not in read_by:
                read_by.append(user_id)
                msg.read_by = json.dumps(read_by)
        db.session.commit()
        
    except Exception as e:
        app.logger.error('Error joining DM: %s', str(e))
        emit('error', {'message': 'Failed to join DM'})

@socketio.on('leave_dm')
def handle_leave_dm(data):
    try:
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        target_user_id = data.get('target_user_id')
        
        room = f'dm_{group_id}_{min(user_id, target_user_id)}_{max(user_id, target_user_id)}'
        leave_room(room)
        emit('left_dm', {'group_id': group_id, 'target_user_id': target_user_id})
        app.logger.info('User left DM with user %s in group %s', target_user_id, group_id)
        
    except Exception as e:
        app.logger.error('Error leaving DM: %s', str(e))

@socketio.on('send_dm')
def handle_send_dm(data):
    try:
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        target_user_id = data.get('target_user_id')
        content = data.get('content', '').strip()
        
        if not content:
            emit('error', {'message': 'Message content required'})
            return
        
        # Verify permissions
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            emit('error', {'message': 'Group not found'})
            return
        
        # Check if current user is the leader
        is_leader = user_id == group.leader_id
        # Check if current user is the member trying to DM the leader
        is_member_dming_leader = target_user_id == group.leader_id and user_id in [m.id for m in group.members]
        
        # Only leader or the member trying to DM the leader can send
        if not is_leader and not is_member_dming_leader:
            emit('error', {'message': 'Not authorized to send DM'})
            return
        
        # Only allow DMs between leader and member
        if target_user_id == group.leader_id:
            # This is a member trying to DM the leader - this is allowed
            pass
        elif target_user_id not in [m.id for m in group.members]:
            emit('error', {'message': 'User not in group'})
            return
        
        user = User.query.get(user_id)
        if not user:
            emit('error', {'message': 'User not found'})
            return
        
        # Determine recipient
        recipient_id = target_user_id if user_id == group.leader_id else group.leader_id
        
        # Save message to database
        msg = Message(group_id=group.id, sender_id=user_id, recipient_id=recipient_id, content=content)
        db.session.add(msg)
        db.session.commit()
        
        # Send to DM room
        room = f'dm_{group.group_id}_{min(user_id, target_user_id)}_{max(user_id, target_user_id)}'
        emit('receive_dm', {
            'id': msg.id,
            'sender_id': msg.sender_id,
            'sender_username': user.username,
            'recipient_id': msg.recipient_id,
            'content': msg.content,
            'created_at': msg.created_at.isoformat()
        }, room=room)
        
        app.logger.info('DM sent by user %s to user %s in group %s', user_id, target_user_id, group.group_id)
        
    except Exception as e:
        app.logger.error('Error sending DM: %s', str(e))
        emit('error', {'message': 'Failed to send DM'})

# Daily task reset at midnight UTC (stdlib only – no APScheduler/pkg_resources)
def _seconds_until_midnight_utc():
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return (tomorrow - now).total_seconds()

def _midnight_reset_loop():
    while True:
        try:
            secs = _seconds_until_midnight_utc()
            time.sleep(secs)
            reset_daily_tasks()
        except Exception as e:
            try:
                app.logger.exception('Midnight reset job failed: %s', e)
            except Exception:
                logging.exception('Midnight reset job failed: %s', e)

_midnight_thread = threading.Thread(target=_midnight_reset_loop, daemon=True)
_midnight_thread.start()

@app.route('/')
def index():
    if DEBUG_MODE:
        print("Root endpoint accessed")
    app.logger.info('Root endpoint accessed')
    return jsonify({"message": "Welcome to Rituo API"})

# 404 error handler to debug routing issues
@app.errorhandler(404)
def not_found(error):
    if DEBUG_MODE:
        print(f"404 Error: Requested path was: {request.path}")
        print(f"404 Error: Request method: {request.method}")
    app.logger.warning(f'404 Not Found: {request.method} {request.path}')
    return jsonify({
        "error": "Not found",
        "path": request.path if DEBUG_MODE else None,  # Hide path in production for security
        "method": request.method if DEBUG_MODE else None,
        "message": f"The endpoint {request.path} does not exist" if DEBUG_MODE else "Not found"
    }), 404

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    if DEBUG_MODE:
        print("Health check endpoint accessed")
    app.logger.info('Health check accessed')
    return jsonify({
        "service": "rituo-backend",
        "status": "healthy",
        "allowed_origins": allowed_origins if DEBUG_MODE else ["production-url-hidden"],
        "message": "Rituo server is running"
    }), 200

@app.route('/api/health', methods=['GET'])
def api_health():
    """Health check endpoint under /api"""
    if DEBUG_MODE:
        print("API health check endpoint accessed")
    app.logger.info('API health check accessed')
    return jsonify({
        "status": "ok",
        "allowed_origins": allowed_origins if DEBUG_MODE else ["production-url-hidden"],
        "message": "Server is running"
    }), 200

if __name__ == '__main__':
    if DEBUG_MODE:
        print("✓ Midnight reset thread started")
    app.logger.info('Midnight reset thread started')

    # Run the Flask app with SocketIO
    port = int(os.getenv("PORT", 5000))
    if DEBUG_MODE:
        print("=" * 60)
        print(f"Starting Rituo Server")
        print(f"Port: {port}")
        print(f"Host: 0.0.0.0 (accessible from localhost:{port})")
        print(f"Allowed CORS origins: {allowed_origins}")
        print(f"Test endpoint: http://localhost:{port}/health")
        print("=" * 60)
        print(f"\n🚀 Server is running! Waiting for requests...\n")
    
    app.logger.info('=' * 60)
    app.logger.info(f'Starting Rituo Server')
    app.logger.info(f'Port: {port}')
    app.logger.info(f'Host: 0.0.0.0')
    # Only log CORS origins in development (security: don't expose in production logs)
    if DEBUG_MODE:
        app.logger.info(f'Allowed CORS origins: {allowed_origins}')
    else:
        app.logger.info(f'CORS configured with {len(allowed_origins)} allowed origins')
    app.logger.info('=' * 60)
    
    try:
        socketio.run(app, host='0.0.0.0', port=port, debug=False)
    except Exception as e:
        if DEBUG_MODE:
            print(f"ERROR starting server: {e}")
            import traceback
            traceback.print_exc()
        app.logger.error(f"ERROR starting server: {e}")
        raise