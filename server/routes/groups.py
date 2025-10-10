from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from db.models import db, User, Group, GroupChallenge, Message
import uuid
import stripe
import logging
import json
from datetime import datetime, date
import os
import traceback
from sqlalchemy.orm.attributes import flag_modified

groups_bp = Blueprint('groups', __name__)
stripe.api_key = os.getenv('STRIPE_TEST_SECRET_KEY')
logging.info(f"Stripe API key loaded: {'Yes' if stripe.api_key else 'No'}")

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)

@groups_bp.route('/create', methods=['POST'])
@jwt_required()
def create_group():
    try:
        data = request.get_json()
        name = data.get('name')
        password = data.get('password')
        group_id = str(uuid.uuid4())[:8]
        group = Group(
            name=name,
            group_id=group_id,
            password=password,
            leader_id=get_jwt_identity()
        )
        db.session.add(group)
        user = User.query.get(get_jwt_identity())
        user.leading_groups.append(group)
        db.session.commit()
        return jsonify({'group': group.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/join', methods=['POST'])
@jwt_required()
def join_group():
    try:
        data = request.get_json()
        group_id = data.get('groupId')
        password = data.get('password')
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        if group.password != password:
            return jsonify({'error': 'Invalid password'}), 401
        user = User.query.get(get_jwt_identity())
        if group in user.groups:
            return jsonify({'error': 'Already a member of this group'}), 400
        group.members.append(user)
        db.session.commit()
        return jsonify({'group': group.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/challenge', methods=['POST'])
@jwt_required()
def create_challenge():
    try:
        data = request.get_json()
        group_id = data.get('groupId')
        start_date = datetime.fromisoformat(data.get('startDate'))
        end_date = datetime.fromisoformat(data.get('endDate'))
        member_habits = data.get('memberHabits')
        group = Group.query.filter_by(group_id=group_id).first()
        # Debug logs
        print('group_id from request:', group_id)
        print('group.leader_id:', group.leader_id if group else None)
        print('jwt identity:', get_jwt_identity())
        if not group or str(group.leader_id) != str(get_jwt_identity()):
            return jsonify({'error': 'Group not found or unauthorized'}), 404
        
        challenge = GroupChallenge(
            group_id=group.id,
            start_date=start_date,
            end_date=end_date,
            member_habits=member_habits
        )
        db.session.add(challenge)
        group.active_challenge = challenge
        for member in group.members:
            member.active_group_challenges.append(challenge)
        db.session.commit()
        return jsonify({'challenge': challenge.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/my-groups', methods=['GET'])
@jwt_required()
def get_my_groups():
    try:
        user = User.query.get(get_jwt_identity())
        return jsonify({
            'memberOf': [group.to_dict() for group in user.groups],
            'leading': [group.to_dict() for group in user.leading_groups]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/<group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    try:
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        # Auto-finalize an overdue active challenge
        if group.active_challenge:
            try:
                challenge = group.active_challenge
                # Compare using dates to avoid tz issues
                challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
                if challenge_end and challenge_end < date.today():
                    challenge.status = 'completed'
                    group.active_challenge_id = None
                    db.session.commit()
            except Exception:
                # Do not fail the request if finalization throws
                db.session.rollback()
        return jsonify({'group': group.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/habit/<int:habit_index>/toggle', methods=['POST'])
@jwt_required()
def toggle_group_habit(group_id, challenge_id, habit_index):
    user_id = get_jwt_identity()
    group = Group.query.filter_by(group_id=group_id).first()
    if not group or not group.active_challenge or group.active_challenge.id != challenge_id:
        return jsonify({'error': 'Group or challenge not found'}), 404

    challenge = group.active_challenge
    # member_habits is a JSON field (list of dicts)
    member_habits = challenge.member_habits
    member_habit = next((mh for mh in member_habits if str(mh['member']) == str(user_id)), None)
    if not member_habit:
        return jsonify({'error': 'Member not found in challenge'}), 404

    # Find the habit by index
    try:
        habit = member_habit['habits'][habit_index]
    except IndexError:
        return jsonify({'error': 'Habit not found'}), 404

    # Find today's progress entry or create it
    today = datetime.utcnow().date().isoformat()
    progress_entry = next((p for p in habit.get('progress', []) if p['date'][:10] == today), None)
    if not progress_entry:
        progress_entry = {'date': today, 'completed': False}
        habit.setdefault('progress', []).append(progress_entry)

    # Get user info for the message
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Toggle completion
    was_completed = progress_entry['completed']
    progress_entry['completed'] = not progress_entry['completed']

    # Save back to the challenge
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    db.session.commit()

    # Post system message if habit was completed (not uncompleted)
    if progress_entry['completed'] and not was_completed:
        # Create system message
        system_message = Message(
            group_id=group.id,
            sender_id=user_id,  # Still need a sender_id for the foreign key
            content=f"{user.username} completed habit: {habit['name']}",
            message_type='system'
        )
        db.session.add(system_message)
        db.session.commit()

    return jsonify({'success': True, 'completed': progress_entry['completed']})

@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/habit/<int:habit_index>/numeric', methods=['POST'])
@jwt_required()
def update_numeric_habit(group_id, challenge_id, habit_index):
    user_id = get_jwt_identity()
    data = request.get_json()
    value = data.get('value')
    
    if value is None:
        return jsonify({'error': 'Value is required'}), 400

    group = Group.query.filter_by(group_id=group_id).first()
    if not group or not group.active_challenge or group.active_challenge.id != challenge_id:
        return jsonify({'error': 'Group or challenge not found'}), 404

    challenge = group.active_challenge
    member_habits = challenge.member_habits
    member_habit = next((mh for mh in member_habits if str(mh['member']) == str(user_id)), None)
    if not member_habit:
        return jsonify({'error': 'Member not found in challenge'}), 404

    try:
        habit = member_habit['habits'][habit_index]
    except IndexError:
        return jsonify({'error': 'Habit not found'}), 404

    # Validate value is within range
    min_value = habit.get('minValue', 0)
    max_value = habit.get('maxValue', 10)
    if value < min_value or value > max_value:
        return jsonify({'error': f'Value must be between {min_value} and {max_value}'}), 400

    # Find today's progress entry or create it
    today = datetime.utcnow().date().isoformat()
    progress_entry = next((p for p in habit.get('progress', []) if p['date'][:10] == today), None)
    if not progress_entry:
        progress_entry = {'date': today, 'completed': False, 'numericValue': None}
        habit.setdefault('progress', []).append(progress_entry)

    # Update numeric value and mark as completed
    progress_entry['numericValue'] = value
    progress_entry['completed'] = True

    # Save back to the challenge
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    db.session.commit()

    # Post system message for habit completion
    user = User.query.get(user_id)
    if user:
        system_message = Message(
            group_id=group.id,
            sender_id=user_id,
            content=f"{user.username} completed habit: {habit['name']}",
            message_type='system'
        )
        db.session.add(system_message)
        db.session.commit()

    return jsonify({'success': True, 'numericValue': value})

@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/habit/<int:habit_index>/text', methods=['POST'])
@jwt_required()
def update_text_habit(group_id, challenge_id, habit_index):
    user_id = get_jwt_identity()
    data = request.get_json()
    value = data.get('value')
    
    if not value or not value.strip():
        return jsonify({'error': 'Text value is required'}), 400

    group = Group.query.filter_by(group_id=group_id).first()
    if not group or not group.active_challenge or group.active_challenge.id != challenge_id:
        return jsonify({'error': 'Group or challenge not found'}), 404

    challenge = group.active_challenge
    member_habits = challenge.member_habits
    member_habit = next((mh for mh in member_habits if str(mh['member']) == str(user_id)), None)
    if not member_habit:
        return jsonify({'error': 'Member not found in challenge'}), 404

    try:
        habit = member_habit['habits'][habit_index]
    except IndexError:
        return jsonify({'error': 'Habit not found'}), 404

    # Find today's progress entry or create it
    today = datetime.utcnow().date().isoformat()
    progress_entry = next((p for p in habit.get('progress', []) if p['date'][:10] == today), None)
    if not progress_entry:
        progress_entry = {'date': today, 'completed': False, 'textValue': None}
        habit.setdefault('progress', []).append(progress_entry)

    # Update text value and mark as completed
    progress_entry['textValue'] = value.strip()
    progress_entry['completed'] = True

    # Save back to the challenge
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    db.session.commit()

    # Post system message for habit completion
    user = User.query.get(user_id)
    if user:
        system_message = Message(
            group_id=group.id,
            sender_id=user_id,
            content=f"{user.username} completed habit: {habit['name']}",
            message_type='system'
        )
        db.session.add(system_message)
        db.session.commit()

    return jsonify({'success': True, 'textValue': value.strip()}) 

@groups_bp.route('/<int:group_id>/chat', methods=['GET'])
@jwt_required()
def get_group_chat(group_id):
    group = Group.query.get_or_404(group_id)
    messages = Message.query.filter_by(group_id=group_id, recipient_id=None).order_by(Message.created_at.asc()).all()
    return jsonify([{
        'id': m.id,
        'sender_id': m.sender_id,
        'sender_username': m.sender.username if m.sender else None,
        'content': m.content,
        'created_at': m.created_at.isoformat(),
        'message_type': m.message_type
    } for m in messages])

@groups_bp.route('/<int:group_id>/chat', methods=['POST'])
@jwt_required()
def send_group_chat(group_id):
    group = Group.query.get_or_404(group_id)
    user = get_current_user()
    if not user or user.id not in [m.id for m in group.members] and user.id != group.leader_id:
        return jsonify({'error': 'Not a group member'}), 403
    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Message content required'}), 400
    msg = Message(group_id=group_id, sender_id=user.id, content=content)
    db.session.add(msg)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Message sent'})

@groups_bp.route('/<group_id>/dm/<int:user_id>', methods=['GET'])
@jwt_required()
def get_dm(group_id, user_id):
    group = Group.query.filter_by(group_id=group_id).first_or_404()
    user = get_current_user()
    is_leader = user.id == group.leader_id
    is_member = user.id in [m.id for m in group.members]
    is_dm_with_leader = (user_id == group.leader_id and is_member) or (is_leader and user_id in [m.id for m in group.members])
    if not is_dm_with_leader:
        return jsonify({'error': 'Not authorized'}), 403
    # Always use current user id and target user id for filtering
    messages = Message.query.filter_by(group_id=group.id).filter(
        ((Message.sender_id == user.id) & (Message.recipient_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.recipient_id == user.id))
    ).order_by(Message.created_at.asc()).all()
    return jsonify([{
        'id': m.id,
        'sender_id': m.sender_id,
        'sender_username': m.sender.username if m.sender else None,
        'recipient_id': m.recipient_id,
        'content': m.content,
        'created_at': m.created_at.isoformat()
    } for m in messages])

@groups_bp.route('/<group_id>/dm/<int:user_id>', methods=['POST'])
@jwt_required()
def send_dm(group_id, user_id):
    # Look up group by group_id (code) instead of assuming it's an integer
    group = Group.query.filter_by(group_id=group_id).first_or_404()
    user = get_current_user()
    is_leader = user.id == group.leader_id
    is_member = user.id in [m.id for m in group.members]
    is_dm_with_leader = (user_id == group.leader_id and is_member) or (is_leader and user_id in [m.id for m in group.members])
    if not is_dm_with_leader:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Message content required'}), 400
    # Determine recipient: if sender is leader, recipient is user_id; if sender is member, recipient is leader
    recipient_id = user_id if is_leader else group.leader_id
    msg = Message(group_id=group.id, sender_id=user.id, recipient_id=recipient_id, content=content)
    db.session.add(msg)
    db.session.commit()
    return jsonify({'success': True, 'message': 'DM sent'})

@groups_bp.route('/inbox', methods=['GET'])
@jwt_required()
def get_inbox():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get all groups the user is in
    user_groups = Group.query.filter(
        (Group.leader_id == user.id) | 
        (Group.members.any(id=user.id))
    ).all()
    
    inbox_messages = []
    
    for group in user_groups:
        # Get unread group chat messages
        group_messages = Message.query.filter_by(
            group_id=group.id, 
            recipient_id=None
        ).filter(
            Message.created_at > user.created_at  # Only messages after user joined
        ).order_by(Message.created_at.desc()).limit(10).all()
        
        for msg in group_messages:
            read_by = json.loads(msg.read_by or '[]')
            if user.id not in read_by:
                inbox_messages.append({
                    'id': msg.id,
                    'type': 'group_chat',
                    'group_id': group.group_id,  # Use public code
                    'group_name': group.name,
                    'sender_id': msg.sender_id,
                    'sender_username': msg.sender.username if msg.sender else None,
                    'content': msg.content,
                    'created_at': msg.created_at.isoformat(),
                    'message_type': msg.message_type,
                    'unread': True
                })
        
        # Get unread DMs
        if user.id == group.leader_id:
            # Leader: get DMs from all members
            for member in group.members:
                dm_messages = Message.query.filter_by(
                    group_id=group.id,
                    sender_id=member.id,
                    recipient_id=user.id
                ).order_by(Message.created_at.desc()).limit(5).all()
                
                for msg in dm_messages:
                    read_by = json.loads(msg.read_by or '[]')
                    if user.id not in read_by:
                        inbox_messages.append({
                            'id': msg.id,
                            'type': 'dm',
                            'group_id': group.group_id,  # Use public code
                            'group_name': group.name,
                            'sender_id': msg.sender_id,
                            'sender_username': msg.sender.username if msg.sender else None,
                            'content': msg.content,
                            'created_at': msg.created_at.isoformat(),
                            'unread': True
                        })
        else:
            # Member: get DMs from leader
            dm_messages = Message.query.filter_by(
                group_id=group.id,
                sender_id=group.leader_id,
                recipient_id=user.id
            ).order_by(Message.created_at.desc()).limit(5).all()
            
            for msg in dm_messages:
                read_by = json.loads(msg.read_by or '[]')
                if user.id not in read_by:
                    inbox_messages.append({
                        'id': msg.id,
                        'type': 'dm',
                        'group_id': group.group_id,  # Use public code
                        'group_name': group.name,
                        'sender_id': msg.sender_id,
                        'sender_username': msg.sender.username if msg.sender else None,
                        'content': msg.content,
                        'created_at': msg.created_at.isoformat(),
                        'unread': True
                    })
    
    # Sort by creation date (newest first)
    inbox_messages.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify(inbox_messages)

@groups_bp.route('/inbox/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get all groups the user is in
    user_groups = Group.query.filter(
        (Group.leader_id == user.id) | 
        (Group.members.any(id=user.id))
    ).all()
    
    total_unread = 0
    
    for group in user_groups:
        # Count unread group chat messages
        group_messages = Message.query.filter_by(
            group_id=group.id, 
            recipient_id=None
        ).filter(
            Message.created_at > user.created_at
        ).all()
        
        for msg in group_messages:
            read_by = json.loads(msg.read_by or '[]')
            if user.id not in read_by:
                total_unread += 1
        
        # Count unread DMs
        if user.id == group.leader_id:
            # Leader: count DMs from all members
            for member in group.members:
                dm_messages = Message.query.filter_by(
                    group_id=group.id,
                    sender_id=member.id,
                    recipient_id=user.id
                ).all()
                
                for msg in dm_messages:
                    read_by = json.loads(msg.read_by or '[]')
                    if user.id not in read_by:
                        total_unread += 1
        else:
            # Member: count DMs from leader
            dm_messages = Message.query.filter_by(
                group_id=group.id,
                sender_id=group.leader_id,
                recipient_id=user.id
            ).all()
            
            for msg in dm_messages:
                read_by = json.loads(msg.read_by or '[]')
                if user.id not in read_by:
                    total_unread += 1
    
    return jsonify({'unread_count': total_unread})

@groups_bp.route('/messages/<int:message_id>/mark-read', methods=['POST'])
@jwt_required()
def mark_message_read(message_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    message = Message.query.get_or_404(message_id)
    
    # Verify user has access to this message
    group = Group.query.get(message.group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    
    # Check if user is in the group
    if user.id != group.leader_id and user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Not authorized'}), 403
    
    # Mark message as read
    read_by = json.loads(message.read_by or '[]')
    if user.id not in read_by:
        read_by.append(user.id)
        message.read_by = json.dumps(read_by)
        db.session.commit()
    
    return jsonify({'success': True})

@groups_bp.route('/<group_id>/chat/mark-all-read', methods=['POST'])
@jwt_required()
def mark_all_group_chat_read(group_id):
    user_id = get_jwt_identity()
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    import json
    group_messages = Message.query.filter_by(group_id=group.id, recipient_id=None).all()
    updated = 0
    for msg in group_messages:
        read_by = json.loads(msg.read_by or '[]')
        if user_id not in read_by:
            read_by.append(user_id)
            msg.read_by = json.dumps(read_by)
            updated += 1
    db.session.commit()
    return jsonify({'success': True, 'updated': updated})

@groups_bp.route('/<group_id>/dm/<int:user_id>/mark-all-read', methods=['POST'])
@jwt_required()
def mark_all_dm_read(group_id, user_id):
    current_user_id = get_jwt_identity()
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    import json
    # Mark all DMs between current user and user_id as read for current user
    messages = Message.query.filter_by(group_id=group.id).filter(
        ((Message.sender_id == current_user_id) & (Message.recipient_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.recipient_id == current_user_id))
    ).all()
    updated = 0
    for msg in messages:
        read_by = json.loads(msg.read_by or '[]')
        if current_user_id not in read_by:
            read_by.append(current_user_id)
            msg.read_by = json.dumps(read_by)
            updated += 1
    db.session.commit()
    return jsonify({'success': True, 'updated': updated})