from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, decode_token, get_jwt, verify_jwt_in_request
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import timedelta, datetime, timezone
import os
import time
import threading
import click
from dotenv import load_dotenv
import logging
import json
from logging.handlers import RotatingFileHandler
from flask_migrate import Migrate

# Import routes
from routes.auth import auth_bp
from routes.admin import admin_bp
from routes.tasks import tasks_bp
from routes.analytics import analytics_bp
from routes.payments import payments_bp
from routes.groups import (
    groups_bp,
    get_chat_channel_context,
    mark_messages_read_for_user,
    school_group_dms_allowed,
)

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
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)
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


@app.cli.command('set-account-role')
@click.argument('username_or_email')
@click.argument('role', type=click.Choice(['admin', 'teacher', 'student']))
def set_account_role(username_or_email, role):
    """Set a platform account role for bootstrap or support."""
    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email.lower())
    ).first()
    if not user:
        raise click.ClickException('Account not found')
    user.account_role = role
    db.session.commit()
    click.echo(f'{user.username} is now a {role} account.')

# Add request logging middleware - log ALL requests including OPTIONS
# Only print to stdout in development to avoid cluttering production logs
DEBUG_MODE = os.getenv('FLASK_ENV') == 'development' or os.getenv('DEBUG') == 'True'
SENSITIVE_LOG_FIELDS = {'password', 'current_password', 'new_password', 'pin', 'access_token', 'token'}


def redact_request_data(value):
    if isinstance(value, dict):
        return {
            key: '[REDACTED]' if key.lower() in SENSITIVE_LOG_FIELDS else redact_request_data(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_request_data(item) for item in value]
    return value

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
        request_headers = dict(request.headers)
        if 'Authorization' in request_headers:
            request_headers['Authorization'] = '[REDACTED]'
        if 'Cookie' in request_headers:
            request_headers['Cookie'] = '[REDACTED]'
        app.logger.info(f'Request Headers: {request_headers}')
        if request.is_json:
            body_msg = f'Request Body: {redact_request_data(request.get_json(silent=True) or {})}'
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
if os.getenv('SKIP_DB_CREATE_ALL') != '1':
    with app.app_context():
        try:
            db.create_all()
            app.logger.info('Database tables created successfully')
        except Exception as e:
            app.logger.error('Error creating database tables: %s', str(e))
            raise

# Register blueprints without trailing slashes
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
app.register_blueprint(payments_bp, url_prefix='/api/payments')
app.register_blueprint(groups_bp, url_prefix='/api/groups')

chat_socket_users = {}
chat_socket_rooms = {}
chat_room_members = {}
chat_presence_lock = threading.Lock()


def get_socket_user():
    socket_user = chat_socket_users.get(request.sid)
    if not socket_user:
        return None
    return User.query.get(socket_user['id'])


def get_chat_room_name(group, class_id=None):
    return (
        f'class_chat_{group.group_id}_{class_id}'
        if class_id is not None
        else f'group_chat_{group.group_id}'
    )


def get_room_presence(room):
    with chat_presence_lock:
        members = chat_room_members.get(room, {})
        users = [
            {
                'userId': member['userId'],
                'username': member['username'],
                'connectionCount': len(member['sids'])
            }
            for member in members.values()
        ]
    users.sort(key=lambda item: item['username'].lower())
    return {'room': room, 'users': users, 'onlineCount': len(users)}


def add_socket_to_chat_room(room, user):
    with chat_presence_lock:
        chat_socket_rooms.setdefault(request.sid, set()).add(room)
        room_members = chat_room_members.setdefault(room, {})
        member = room_members.setdefault(user.id, {
            'userId': user.id,
            'username': user.username,
            'sids': set()
        })
        member['username'] = user.username
        member['sids'].add(request.sid)


def remove_socket_from_chat_rooms(socket_id, target_room=None):
    affected_rooms = []
    with chat_presence_lock:
        rooms = chat_socket_rooms.get(socket_id, set())
        rooms_to_remove = {target_room} if target_room in rooms else (set(rooms) if target_room is None else set())
        for room in rooms_to_remove:
            members = chat_room_members.get(room, {})
            for user_id, member in list(members.items()):
                member['sids'].discard(socket_id)
                if not member['sids']:
                    members.pop(user_id, None)
            if not members:
                chat_room_members.pop(room, None)
            affected_rooms.append(room)
            rooms.discard(room)
        if not rooms:
            chat_socket_rooms.pop(socket_id, None)
    return affected_rooms


def broadcast_room_presence(room):
    socketio.emit('group_presence', get_room_presence(room), room=room)


@socketio.on('connect')
def handle_connect(auth):
    try:
        token = (auth or {}).get('token', '').strip()
        if token.lower().startswith('bearer '):
            token = token[7:].strip()
        identity = decode_token(token).get('sub') if token else None
        user = User.query.get(int(identity)) if identity is not None else None
        if not user or not getattr(user, 'is_active', True):
            return False
        chat_socket_users[request.sid] = {'id': user.id, 'username': user.username}
        app.logger.info('Authenticated chat client connected: %s (user %s)', request.sid, user.id)
        return True
    except Exception as exc:
        app.logger.warning('Rejected chat connection %s: %s', request.sid, str(exc))
        return False

@socketio.on('disconnect')
def handle_disconnect():
    affected_rooms = remove_socket_from_chat_rooms(request.sid)
    chat_socket_users.pop(request.sid, None)
    for room in affected_rooms:
        broadcast_room_presence(room)
    app.logger.info('Client disconnected: %s', request.sid)

@socketio.on('join_group_chat')
def handle_join_group_chat(data):
    try:
        group_id = data.get('group_id')
        class_id = data.get('class_id')
        user = get_socket_user()
        if not user:
            emit('error', {'message': 'Chat session is not authenticated'})
            return {'ok': False, 'error': 'Chat session is not authenticated'}
        
        group = Group.query.filter_by(group_id=group_id).first() if not str(group_id).isdigit() else Group.query.get(group_id)
        if not group:
            emit('error', {'message': 'Group not found'})
            return {'ok': False, 'error': 'Group not found'}

        context, error_response, _ = get_chat_channel_context(group, user.id, class_id)
        if error_response:
            payload = error_response.get_json(silent=True) or {}
            emit('error', {'message': payload.get('error', 'Not authorized to join group chat')})
            return {'ok': False, 'error': payload.get('error', 'Not authorized to join group chat')}

        room = get_chat_room_name(group, context['class_id'])
        join_room(room)
        add_socket_to_chat_room(room, user)
        emit('joined_group_chat', {
            'group_id': group.group_id,
            'room': room,
            'channel': context['channel']
        })
        broadcast_room_presence(room)
        app.logger.info('User %s joined group chat %s (room: %s)', user.id, group.group_id, room)

        group_messages = Message.query.filter_by(
            group_id=group.id,
            recipient_id=None,
            class_id=context['class_id']
        ).all()
        updated = mark_messages_read_for_user(group_messages, user.id)
        db.session.commit()
        if updated:
            emit('group_messages_read', {
                'room': room,
                'userId': user.id,
                'username': user.username,
                'messageIds': [message.id for message in group_messages]
            }, room=room)
        return {'ok': True, 'room': room}
        
    except Exception as e:
        app.logger.error('Error joining group chat: %s', str(e))
        emit('error', {'message': 'Failed to join group chat'})
        return {'ok': False, 'error': 'Failed to join group chat'}

@socketio.on('leave_group_chat')
def handle_leave_group_chat(data):
    try:
        group_id = data.get('group_id')
        class_id = data.get('class_id')
        room = f'class_chat_{group_id}_{class_id}' if class_id not in (None, '', 'null', 'undefined') else f'group_chat_{group_id}'
        leave_room(room)
        remove_socket_from_chat_rooms(request.sid, room)
        emit('left_group_chat', {'group_id': group_id, 'class_id': class_id})
        broadcast_room_presence(room)
        app.logger.info('User left group chat %s', group_id)
        
    except Exception as e:
        app.logger.error('Error leaving group chat: %s', str(e))

@socketio.on('send_group_message')
def handle_send_group_message(data):
    try:
        group_id = data.get('group_id')
        class_id = data.get('class_id')
        content = data.get('content', '').strip()
        user = get_socket_user()

        if not user:
            emit('error', {'message': 'Chat session is not authenticated'})
            return {'ok': False, 'error': 'Chat session is not authenticated'}
        
        if not content:
            emit('error', {'message': 'Message content required'})
            return {'ok': False, 'error': 'Message content required'}
        if len(content) > 2000:
            emit('error', {'message': 'Messages can be at most 2,000 characters'})
            return {'ok': False, 'error': 'Messages can be at most 2,000 characters'}
        
        group = Group.query.filter_by(group_id=group_id).first() if not str(group_id).isdigit() else Group.query.get(group_id)
        if not group:
            emit('error', {'message': 'Group not found'})
            return {'ok': False, 'error': 'Group not found'}

        context, error_response, _ = get_chat_channel_context(group, user.id, class_id)
        if error_response:
            payload = error_response.get_json(silent=True) or {}
            emit('error', {'message': payload.get('error', 'Not authorized to send message')})
            return {'ok': False, 'error': payload.get('error', 'Not authorized to send message')}

        room = get_chat_room_name(group, context['class_id'])
        if room not in chat_socket_rooms.get(request.sid, set()):
            emit('error', {'message': 'Join this chat before sending a message'})
            return {'ok': False, 'error': 'Join this chat before sending a message'}

        msg = Message(
            group_id=group.id,
            sender_id=user.id,
            class_id=context['class_id'],
            content=content,
            read_by=json.dumps([user.id])
        )
        db.session.add(msg)
        db.session.commit()

        emit('receive_group_message', {
            **msg.to_dict(),
            'channel': context['channel']
        }, room=room)
        
        app.logger.info('Group message sent by user %s in group %s', user.id, group_id)
        return {'ok': True, 'message': msg.to_dict()}
        
    except Exception as e:
        app.logger.error('Error sending group message: %s', str(e))
        emit('error', {'message': 'Failed to send message'})
        return {'ok': False, 'error': 'Failed to send message'}


@socketio.on('group_typing')
def handle_group_typing(data):
    try:
        user = get_socket_user()
        group_id = data.get('group_id')
        class_id = data.get('class_id')
        group = Group.query.filter_by(group_id=group_id).first() if not str(group_id).isdigit() else Group.query.get(group_id)
        if not user or not group:
            return {'ok': False}
        context, error_response, _ = get_chat_channel_context(group, user.id, class_id)
        if error_response:
            return {'ok': False}
        room = get_chat_room_name(group, context['class_id'])
        if room not in chat_socket_rooms.get(request.sid, set()):
            return {'ok': False}
        emit('group_typing', {
            'room': room,
            'userId': user.id,
            'username': user.username,
            'isTyping': bool(data.get('is_typing'))
        }, room=room, skip_sid=request.sid)
        return {'ok': True}
    except Exception as exc:
        app.logger.error('Error broadcasting typing state: %s', str(exc))
        return {'ok': False}


@socketio.on('mark_group_messages_read')
def handle_mark_group_messages_read(data):
    try:
        user = get_socket_user()
        group_id = data.get('group_id')
        class_id = data.get('class_id')
        group = Group.query.filter_by(group_id=group_id).first() if not str(group_id).isdigit() else Group.query.get(group_id)
        if not user or not group:
            return {'ok': False}
        context, error_response, _ = get_chat_channel_context(group, user.id, class_id)
        if error_response:
            return {'ok': False}
        room = get_chat_room_name(group, context['class_id'])
        if room not in chat_socket_rooms.get(request.sid, set()):
            return {'ok': False}

        query = Message.query.filter_by(
            group_id=group.id,
            recipient_id=None,
            class_id=context['class_id']
        )
        requested_ids = []
        for raw_message_id in data.get('message_ids') or []:
            try:
                requested_ids.append(int(raw_message_id))
            except (TypeError, ValueError):
                continue
        if requested_ids:
            query = query.filter(Message.id.in_(requested_ids[:500]))
        messages = query.all()
        updated = mark_messages_read_for_user(messages, user.id)
        if updated:
            db.session.commit()
            emit('group_messages_read', {
                'room': room,
                'userId': user.id,
                'username': user.username,
                'messageIds': [message.id for message in messages]
            }, room=room)
        return {'ok': True, 'updated': updated}
    except Exception as exc:
        app.logger.error('Error marking live chat messages read: %s', str(exc))
        return {'ok': False}

@socketio.on('join_dm')
def handle_join_dm(data):
    try:
        group_id = data.get('group_id')
        user = get_socket_user()
        target_user_id = int(data.get('target_user_id'))
        if not user:
            emit('error', {'message': 'Chat session is not authenticated'})
            return {'ok': False}
        user_id = user.id
        
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            emit('error', {'message': 'Group not found'})
            return {'ok': False}
        if not school_group_dms_allowed(group):
            emit('error', {'message': 'Direct messages are disabled for school groups'})
            return {'ok': False}
        
        is_leader = user_id == group.leader_id
        is_member_dming_leader = target_user_id == group.leader_id and user_id in [m.id for m in group.members]
        
        if not is_leader and not is_member_dming_leader:
            emit('error', {'message': 'Not authorized to join DM'})
            return {'ok': False}
        
        if target_user_id != group.leader_id and target_user_id not in [m.id for m in group.members]:
            emit('error', {'message': 'User not in group'})
            return {'ok': False}
        
        room = f'dm_{group.group_id}_{min(user_id, target_user_id)}_{max(user_id, target_user_id)}'
        join_room(room)
        emit('joined_dm', {'group_id': group.group_id, 'target_user_id': target_user_id, 'room': room})
        app.logger.info('User %s joined DM with user %s in group %s', user_id, target_user_id, group.group_id)
        
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
        return {'ok': True, 'room': room}
        
    except Exception as e:
        app.logger.error('Error joining DM: %s', str(e))
        emit('error', {'message': 'Failed to join DM'})
        return {'ok': False}

@socketio.on('leave_dm')
def handle_leave_dm(data):
    try:
        group_id = data.get('group_id')
        user = get_socket_user()
        target_user_id = int(data.get('target_user_id'))
        if not user:
            return {'ok': False}
        user_id = user.id
        
        room = f'dm_{group_id}_{min(user_id, target_user_id)}_{max(user_id, target_user_id)}'
        leave_room(room)
        emit('left_dm', {'group_id': group_id, 'target_user_id': target_user_id})
        app.logger.info('User left DM with user %s in group %s', target_user_id, group_id)
        return {'ok': True}
        
    except Exception as e:
        app.logger.error('Error leaving DM: %s', str(e))
        return {'ok': False}

@socketio.on('send_dm')
def handle_send_dm(data):
    try:
        group_id = data.get('group_id')
        user = get_socket_user()
        target_user_id = int(data.get('target_user_id'))
        content = data.get('content', '').strip()
        if not user:
            emit('error', {'message': 'Chat session is not authenticated'})
            return {'ok': False}
        user_id = user.id
        
        if not content:
            emit('error', {'message': 'Message content required'})
            return {'ok': False}
        if len(content) > 2000:
            emit('error', {'message': 'Messages can be at most 2,000 characters'})
            return {'ok': False}
        
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            emit('error', {'message': 'Group not found'})
            return {'ok': False}
        if not school_group_dms_allowed(group):
            emit('error', {'message': 'Direct messages are disabled for school groups'})
            return {'ok': False}
        
        is_leader = user_id == group.leader_id
        is_member_dming_leader = target_user_id == group.leader_id and user_id in [m.id for m in group.members]
        
        if not is_leader and not is_member_dming_leader:
            emit('error', {'message': 'Not authorized to send DM'})
            return {'ok': False}
        
        if target_user_id != group.leader_id and target_user_id not in [m.id for m in group.members]:
            emit('error', {'message': 'User not in group'})
            return {'ok': False}
        
        recipient_id = target_user_id if user_id == group.leader_id else group.leader_id
        
        msg = Message(
            group_id=group.id,
            sender_id=user_id,
            recipient_id=recipient_id,
            content=content,
            read_by=json.dumps([user_id])
        )
        db.session.add(msg)
        db.session.commit()
        
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
        return {'ok': True}
        
    except Exception as e:
        app.logger.error('Error sending DM: %s', str(e))
        emit('error', {'message': 'Failed to send DM'})
        return {'ok': False}

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
