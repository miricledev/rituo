from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from db.models import db, User
import re
import os



auth_bp = Blueprint('auth', __name__)
VALID_ACCOUNT_ROLES = {'admin', 'teacher', 'student'}

# Helper function to validate email format
def is_valid_email(email):
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validate input data
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if email is valid
    if not is_valid_email(data.get('email')):
        return jsonify({'message': 'Invalid email format'}), 400
    
    # Check if username or email already exists
    existing_user = User.query.filter(
        (User.username == data.get('username')) | (User.email == data.get('email'))
    ).first()
    
    if existing_user:
        if existing_user.username == data.get('username'):
            return jsonify({'message': 'Username already exists'}), 409
        else:
            return jsonify({'message': 'Email already exists'}), 409
    
    # Create new user
    hashed_password = generate_password_hash(data.get('password'))
    initial_admin_emails = {
        value.strip().lower()
        for value in os.getenv('INITIAL_ADMIN_EMAILS', '').split(',')
        if value.strip()
    }
    account_role = 'admin' if data.get('email', '').strip().lower() in initial_admin_emails else 'student'
    new_user = User(
        username=data.get('username'),
        email=data.get('email'),
        password=hashed_password,
        account_role=account_role
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        
        # Generate access token
        access_token = create_access_token(identity=str(new_user.id))
        return jsonify({
            'message': 'User registered successfully',
            'user': new_user.to_dict(),
            'access_token': access_token
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Registration failed: {str(e)}'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Validate input data
    if not data or not data.get('username') or not data.get('password'):
        print("Login attempt failed: Missing username or password")
        return jsonify({'message': 'Missing username or password'}), 400
    
    # Find user by username
    user = User.query.filter_by(username=data.get('username')).first()
    
    if not user:
        print(f"Login attempt failed: User not found - {data.get('username')}")
        return jsonify({'message': 'Invalid username or password'}), 401

    if not user.is_active:
        return jsonify({'message': 'This account has been deactivated'}), 403
    
    # Check if password is correct
    if not check_password_hash(user.password, data.get('password')):
        print(f"Login attempt failed: Invalid password for user - {data.get('username')}")
        return jsonify({'message': 'Invalid username or password'}), 401
    
    # Generate access token
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict(),
        'access_token': access_token
    }), 200


@auth_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user():
    try:
        # Get the JWT token data
        jwt_data = get_jwt()
        print(f"JWT data: {jwt_data}")
        
        # Get user ID from token and convert to integer
        user_id = int(get_jwt_identity())
        print(f"Getting user data for ID: {user_id}")
        
        # Get user from database
        user = User.query.get(user_id)
        
        if not user:
            print(f"User not found for ID: {user_id}")
            return jsonify({
                'message': 'User not found',
                'error': 'user_not_found'
            }), 404
        
        # Convert user to dictionary
        user_data = user.to_dict()
        print(f"Returning user data: {user_data}")
        
        return jsonify({
            'user': user_data,
            'message': 'User data retrieved successfully'
        }), 200
    except Exception as e:
        print(f"Error in get_user: {str(e)}")
        return jsonify({
            'message': f'Error getting user data: {str(e)}',
            'error': 'server_error'
        }), 500


@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    data = request.get_json()
    
    # Validate input data
    if not data or not data.get('current_password') or not data.get('new_password'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if current password is correct
    if not check_password_hash(user.password, data.get('current_password')):
        return jsonify({'message': 'Current password is incorrect'}), 401
    
    # Update password
    user.password = generate_password_hash(data.get('new_password'))
    
    try:
        db.session.commit()
        return jsonify({'message': 'Password updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Password update failed: {str(e)}'}), 500


# PIN used for keypad verification (same as create group / register flow)
VERIFY_PIN = '302185'


def _verify_request(data):
    """Accept either account password or keypad PIN 302185."""
    if not data:
        return False, 'Password or PIN required'
    if data.get('pin') == VERIFY_PIN:
        return True, None
    return False, None  # Caller must check password if pin not used


@auth_bp.route('/update-username', methods=['PUT'])
@jwt_required()
def update_username():
    """Update username; requires keypad PIN (302185) or current password."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    data = request.get_json()
    if not data or not data.get('username'):
        return jsonify({'message': 'Username is required'}), 400
    
    pin_ok, _ = _verify_request(data)
    if pin_ok:
        pass
    elif data.get('password'):
        if not check_password_hash(user.password, data.get('password')):
            return jsonify({'message': 'Password is incorrect'}), 401
    else:
        return jsonify({'message': 'Password or PIN is required'}), 400
    
    new_username = data.get('username').strip()
    if not new_username:
        return jsonify({'message': 'Username cannot be empty'}), 400
    
    existing = User.query.filter_by(username=new_username).first()
    if existing and existing.id != user_id:
        return jsonify({'message': 'Username already exists'}), 409
    
    user.username = new_username
    try:
        db.session.commit()
        return jsonify({
            'message': 'Username updated successfully',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Update failed: {str(e)}'}), 500


@auth_bp.route('/update-email', methods=['PUT'])
@jwt_required()
def update_email():
    """Update email; requires keypad PIN (302185) or current password."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    data = request.get_json()
    if not data or not data.get('email'):
        return jsonify({'message': 'Email is required'}), 400
    
    pin_ok, _ = _verify_request(data)
    if pin_ok:
        pass
    elif data.get('password'):
        if not check_password_hash(user.password, data.get('password')):
            return jsonify({'message': 'Password is incorrect'}), 401
    else:
        return jsonify({'message': 'Password or PIN is required'}), 400
    
    new_email = data.get('email').strip().lower()
    if not is_valid_email(new_email):
        return jsonify({'message': 'Invalid email format'}), 400
    
    existing = User.query.filter_by(email=new_email).first()
    if existing and existing.id != user_id:
        return jsonify({'message': 'Email already in use'}), 409
    
    user.email = new_email
    try:
        db.session.commit()
        return jsonify({
            'message': 'Email updated successfully',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Update failed: {str(e)}'}), 500
