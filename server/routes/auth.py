from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from db.models import db, User
import re

auth_bp = Blueprint('auth', __name__)

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
    new_user = User(
        username=data.get('username'),
        email=data.get('email'),
        password_hash=hashed_password
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        
        # Generate access token
        access_token = create_access_token(identity=str(new_user.id))
        print(f"Generated token for new user {new_user.username}: {access_token}")
        
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
    
    # Check if password is correct
    if not check_password_hash(user.password_hash, data.get('password')):
        print(f"Login attempt failed: Invalid password for user - {data.get('username')}")
        return jsonify({'message': 'Invalid username or password'}), 401
    
    # Generate access token
    access_token = create_access_token(identity=str(user.id))
    print(f"Generated token for user {user.username}: {access_token}")
    
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
    if not check_password_hash(user.password_hash, data.get('current_password')):
        return jsonify({'message': 'Current password is incorrect'}), 401
    
    # Update password
    user.password_hash = generate_password_hash(data.get('new_password'))
    
    try:
        db.session.commit()
        return jsonify({'message': 'Password updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Password update failed: {str(e)}'}), 500