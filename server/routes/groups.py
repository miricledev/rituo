from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from db.models import db, User, Group, GroupChallenge, Message
import uuid
import stripe
import logging
import json
from datetime import datetime, date, timedelta
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


@groups_bp.route('/<group_id>/archives', methods=['GET'])
@jwt_required()
def get_group_archives(group_id):
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        # Check if user is group leader (only leaders can view archives)
        if str(group.leader_id) != str(user_id):
            return jsonify({'error': 'Only group leaders can view archives'}), 403
        
        # Get all completed challenges for this group
        completed_challenges = GroupChallenge.query.filter_by(
            group_id=group.id, 
            status='completed'
        ).order_by(GroupChallenge.end_date.desc()).all()
        
        archives = []
        for challenge in completed_challenges:
            # Calculate challenge statistics
            total_days = (challenge.end_date - challenge.start_date).days + 1
            total_members = len(challenge.member_habits)
            
            # Calculate overall completion rate
            total_possible_completions = 0
            total_actual_completions = 0
            
            member_stats = []
            for member_habit in challenge.member_habits:
                member_id = member_habit['member']
                member = User.query.get(member_id)
                if not member:
                    continue
                    
                habits = member_habit.get('habits', [])
                habit_details = []
                
                # Track which days the member completed ANY habit
                completed_dates = set()
                
                # First, collect all progress data for all habits
                all_habit_progress = {}
                for habit in habits:
                    habit_name = habit.get('name', 'Unknown Habit')
                    habit_type = habit.get('habitType', 'boolean')
                    progress = habit.get('progress', [])
                    
                    # Create a map of progress entries for this habit
                    habit_progress_map = {}
                    for progress_entry in progress:
                        progress_date = datetime.fromisoformat(progress_entry['date']).date()
                        if challenge.start_date.date() <= progress_date <= challenge.end_date.date():
                            habit_progress_map[progress_date.isoformat()] = progress_entry.get('completed', False)
                    
                    all_habit_progress[habit_name] = {
                        'type': habit_type,
                        'progress_map': habit_progress_map
                    }
                
                # Now calculate individual habit performance and track daily participation
                for habit_name, habit_data in all_habit_progress.items():
                    habit_type = habit_data['type']
                    progress_map = habit_data['progress_map']
                    
                    # Count completions for this habit during challenge period
                    habit_completed_days = 0
                    habit_total_days = total_days  # Each habit should be done every day of the challenge
                    
                    # Check each day of the challenge for this habit
                    for day_offset in range(total_days):
                        current_date = challenge.start_date.date() + timedelta(days=day_offset)
                        date_str = current_date.isoformat()
                        
                        if date_str in progress_map and progress_map[date_str]:
                            habit_completed_days += 1
                    
                    habit_details.append({
                        'name': habit_name,
                        'type': habit_type,
                        'completed_days': habit_completed_days,
                        'total_days': habit_total_days,
                        'completion_rate': round((habit_completed_days / habit_total_days * 100) if habit_total_days > 0 else 0, 1)
                    })
                
                # Now calculate daily participation (days with ANY habit completed)
                for day_offset in range(total_days):
                    current_date = challenge.start_date.date() + timedelta(days=day_offset)
                    date_str = current_date.isoformat()
                    
                    # Check if ANY habit was completed on this day
                    day_has_completion = False
                    for habit_data in all_habit_progress.values():
                        if date_str in habit_data['progress_map'] and habit_data['progress_map'][date_str]:
                            day_has_completion = True
                            break
                    
                    if day_has_completion:
                        completed_dates.add(date_str)
                
                # Member performance: days with ANY habit completed / total challenge days
                member_days_completed = len(completed_dates)
                member_total_days = total_days
                member_completion_rate = (member_days_completed / member_total_days * 100) if member_total_days > 0 else 0
                
                # Debug logging
                print(f"Member {member.username}: {member_days_completed}/{member_total_days} days = {member_completion_rate:.1f}%")
                print(f"Completed dates: {sorted(completed_dates)}")
                
                # For overall stats, count total habit completions
                total_habit_completions = sum(h['completed_days'] for h in habit_details)
                total_possible_habit_completions = sum(h['total_days'] for h in habit_details)
                
                total_possible_completions += total_possible_habit_completions
                total_actual_completions += total_habit_completions
                
                member_stats.append({
                    'id': member_id,
                    'username': member.username,
                    'days_completed': member_days_completed,  # Days with ANY habit completed
                    'total_days': member_total_days,  # Total challenge days
                    'completion_rate': round(member_completion_rate, 1),  # Days with habits / total days
                    'habit_details': habit_details,
                    'total_habit_completions': total_habit_completions,  # Total individual habit completions
                    'total_possible_habit_completions': total_possible_habit_completions
                })
            
            overall_completion_rate = (total_actual_completions / total_possible_completions * 100) if total_possible_completions > 0 else 0
            
            # Generate daily progress data for graphs
            daily_progress = []
            for day_offset in range(total_days):
                current_date = challenge.start_date.date() + timedelta(days=day_offset)
                date_str = current_date.isoformat()
                
                # Calculate daily completion rate (average of user averages)
                user_daily_averages = []
                for member_habit in challenge.member_habits:
                    habits = member_habit.get('habits', [])
                    if not habits:
                        continue
                    
                    user_daily_total = 0
                    for habit in habits:
                        progress = habit.get('progress', [])
                        progress_entry = next((p for p in progress if p['date'][:10] == date_str), None)
                        if progress_entry and progress_entry.get('completed', False):
                            user_daily_total += 1
                    
                    user_daily_average = user_daily_total / len(habits) if habits else 0
                    user_daily_averages.append(user_daily_average)
                
                daily_avg = sum(user_daily_averages) / len(user_daily_averages) if user_daily_averages else 0
                
                daily_progress.append({
                    'date': date_str,
                    'completion_rate': round(daily_avg * 100, 1)
                })
            
            archives.append({
                'id': challenge.id,
                'title': f"{challenge.start_date.strftime('%b %d')} - {challenge.end_date.strftime('%b %d, %Y')} Challenge",
                'start_date': challenge.start_date.isoformat(),
                'end_date': challenge.end_date.isoformat(),
                'duration_days': total_days,
                'total_members': total_members,
                'overall_completion_rate': round(overall_completion_rate, 1),
                'total_completions': total_actual_completions,
                'total_possible': total_possible_completions,
                'member_stats': member_stats,
                'daily_progress': daily_progress,
                'created_at': challenge.created_at.isoformat()
            })
        
        return jsonify({'archives': archives}), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/attendance', methods=['GET'])
@jwt_required()
def get_group_attendance(group_id):
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        # Check if user is group leader (only leaders can view attendance)
        if str(group.leader_id) != str(user_id):
            return jsonify({'error': 'Only group leaders can view attendance'}), 403
        
        # Debug: Check what we have
        print(f"DEBUG - Group ID: {group_id}")
        print(f"DEBUG - Group name: {group.name}")
        print(f"DEBUG - Active challenge ID: {group.active_challenge_id}")
        print(f"DEBUG - Active challenge object: {group.active_challenge}")
        
        # Auto-finalize an overdue active challenge (same logic as get_group)
        if group.active_challenge:
            try:
                challenge = group.active_challenge
                print(f"DEBUG - Challenge found: {challenge.id}, Status: {challenge.status}")
                print(f"DEBUG - Challenge dates: {challenge.start_date} to {challenge.end_date}")
                # Compare using dates to avoid tz issues
                challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
                today = date.today()
                print(f"DEBUG - Challenge end: {challenge_end}, Today: {today}, Ended: {challenge_end < today}")
                if challenge_end and challenge_end < today:
                    print(f"DEBUG - Finalizing overdue challenge")
                    challenge.status = 'completed'
                    group.active_challenge_id = None
                    db.session.commit()
                    # Re-fetch group to reflect changes
                    group = Group.query.filter_by(group_id=group_id).first()
            except Exception as e:
                # Do not fail the request if finalization throws
                print(f"DEBUG - Error during finalization: {e}")
                db.session.rollback()
        
        if not group.active_challenge:
            print(f"DEBUG - No active challenge found, returning empty attendance")
            return jsonify({'error': 'No active challenge', 'attendance': []}), 200
        
        print(f"DEBUG - Proceeding with attendance calculation for challenge {group.active_challenge.id}")
        
        challenge = group.active_challenge
        total_days = (challenge.end_date - challenge.start_date).days + 1
        
        # Calculate attendance for each member
        attendance_data = []
        for member_habit in challenge.member_habits:
            member_id = member_habit['member']
            member = User.query.get(member_id)
            if not member:
                continue
                
            habits = member_habit.get('habits', [])
            
            # Track which days the member was active (completed ANY habit)
            active_dates = set()
            
            # Collect all progress data for this member
            for habit in habits:
                progress = habit.get('progress', [])
                for progress_entry in progress:
                    # Parse the date string consistently
                    progress_date_str = progress_entry['date']
                    # Handle both ISO datetime strings and date-only strings
                    if 'T' in progress_date_str:
                        progress_date = datetime.fromisoformat(progress_date_str.replace('Z', '+00:00')).date()
                    else:
                        progress_date = datetime.fromisoformat(progress_date_str).date()
                    
                    # Ensure challenge dates are date objects
                    challenge_start = challenge.start_date.date() if isinstance(challenge.start_date, datetime) else challenge.start_date
                    challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
                    
                    if challenge_start <= progress_date <= challenge_end:
                        if progress_entry.get('completed', False):
                            active_dates.add(progress_date.isoformat())
            
            # Calculate attendance statistics
            days_active = len(active_dates)
            attendance_rate = (days_active / total_days * 100) if total_days > 0 else 0
            
            # Get recent activity (last 7 days including today, but not before challenge start)
            recent_activity = []
            today = date.today()  # Use date.today() for consistent local date
            challenge_start = challenge.start_date.date() if isinstance(challenge.start_date, datetime) else challenge.start_date
            challenge_end = challenge.end_date.date() if isinstance(challenge.end_date, datetime) else challenge.end_date
            
            # Calculate how many days to show (min of 7 or days since challenge start)
            days_since_start = (today - challenge_start).days + 1  # +1 to include today
            days_to_show = min(7, days_since_start)
            
            for i in range(days_to_show):
                check_date = today - timedelta(days=i)
                # Don't show dates before challenge started
                if check_date >= challenge_start:
                    date_str = check_date.isoformat()
                    recent_activity.append({
                        'date': date_str,
                        'active': date_str in active_dates
                    })
            
            # Generate full attendance history (all days from challenge start to today or end date)
            full_attendance = []
            current_date = challenge_start
            end_date_for_display = min(today, challenge_end)
            
            while current_date <= end_date_for_display:
                date_str = current_date.isoformat()
                full_attendance.append({
                    'date': date_str,
                    'active': date_str in active_dates
                })
                current_date += timedelta(days=1)
            
            attendance_data.append({
                'member_id': member_id,
                'username': member.username,
                'days_active': days_active,
                'total_days': total_days,
                'attendance_rate': round(attendance_rate, 1),
                'recent_activity': recent_activity,
                'full_attendance': full_attendance,
                'last_active': max(active_dates) if active_dates else None
            })
        
        # Sort by attendance rate (highest first)
        attendance_data.sort(key=lambda x: x['attendance_rate'], reverse=True)
        
        return jsonify({
            'attendance': attendance_data,
            'challenge_info': {
                'start_date': challenge.start_date.isoformat(),
                'end_date': challenge.end_date.isoformat(),
                'total_days': total_days,
                'server_date': date.today().isoformat()  # For debugging
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>', methods=['DELETE'])
@jwt_required()
def delete_group_challenge(group_id, challenge_id):
    """Allow group leader to permanently remove an active challenge and all its data."""
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404

        # Only the group leader can delete a challenge
        if str(group.leader_id) != str(user_id):
            return jsonify({'error': 'Only group leaders can remove a challenge'}), 403

        challenge = GroupChallenge.query.get(challenge_id)
        if not challenge or challenge.group_id != group.id:
            return jsonify({'error': 'Challenge not found'}), 404

        # If this is the active challenge, clear the reference
        if group.active_challenge_id == challenge.id:
            group.active_challenge_id = None

        # Delete the challenge (member_habits data will be removed with it)
        db.session.delete(challenge)
        db.session.commit()

        return jsonify({'message': 'Challenge removed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@groups_bp.route('/<group_id>/challenge/<int:challenge_id>/member/<int:member_id>/habit/<int:habit_index>/toggle-day', methods=['POST'])
@jwt_required()
def toggle_habit_day_status(group_id, challenge_id, member_id, habit_index):
    """Allow group leader to manually toggle a member's habit completion status for a specific day"""
    try:
        user_id = get_jwt_identity()
        group = Group.query.filter_by(group_id=group_id).first()
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        # Only group leaders can modify member habits
        if str(group.leader_id) != str(user_id):
            return jsonify({'error': 'Only group leaders can modify member habits'}), 403
        
        challenge = GroupChallenge.query.get(challenge_id)
        if not challenge or challenge.group_id != group.id:
            return jsonify({'error': 'Challenge not found'}), 404
        
        data = request.get_json()
        target_date = data.get('date')  # Should be ISO date string YYYY-MM-DD
        new_status = data.get('completed')  # True or False (for boolean habits)
        numeric_value = data.get('numericValue')  # Number (for numeric habits)
        text_value = data.get('textValue')  # String (for text habits)
        
        print(f"DEBUG - Received update request: date={target_date}, completed={new_status}, numeric={numeric_value}, text={text_value}")
        
        if not target_date:
            return jsonify({'error': 'Missing date'}), 400
        
        # Prevent modification of today's data
        today = date.today().isoformat()
        if target_date == today:
            return jsonify({'error': 'Cannot modify today\'s data. Students must log their own progress for today.'}), 403
        
        # Find the member's habits
        member_habit = None
        for mh in challenge.member_habits:
            if str(mh.get('member')) == str(member_id):
                member_habit = mh
                break
        
        if not member_habit:
            return jsonify({'error': 'Member not found in challenge'}), 404
        
        habits = member_habit.get('habits', [])
        if habit_index < 0 or habit_index >= len(habits):
            return jsonify({'error': 'Invalid habit index'}), 400
        
        habit = habits[habit_index]
        habit_type = habit.get('habitType', 'boolean')
        progress = habit.get('progress', [])
        
        print(f"DEBUG - Habit type: {habit_type}, Habit name: {habit.get('name')}")
        print(f"DEBUG - Current progress entries: {len(progress)}")
        
        # Check if progress entry already exists for this date
        existing_entry = None
        for p in progress:
            if p['date'].startswith(target_date):  # Handle both date and datetime strings
                existing_entry = p
                print(f"DEBUG - Found existing entry: {existing_entry}")
                break
        
        if not existing_entry:
            print(f"DEBUG - No existing entry found for date {target_date}")
        
        if existing_entry:
            # Update existing entry based on habit type
            if habit_type == 'numeric' and numeric_value is not None:
                existing_entry['numericValue'] = numeric_value
                existing_entry['completed'] = True  # Auto-mark as completed when value is set
                print(f"DEBUG - Updated numeric value to {numeric_value}")
            elif habit_type == 'text' and text_value is not None:
                existing_entry['textValue'] = text_value
                existing_entry['completed'] = True  # Auto-mark as completed when value is set
                print(f"DEBUG - Updated text value to {text_value}")
            elif new_status is not None:
                print(f"DEBUG - Updating completed status from {existing_entry.get('completed')} to {new_status}")
                existing_entry['completed'] = new_status
        else:
            # Create new progress entry
            new_entry = {
                'date': f"{target_date}T00:00:00",  # Store as ISO datetime
                'completed': new_status if new_status is not None else False
            }
            
            if habit_type == 'numeric' and numeric_value is not None:
                new_entry['numericValue'] = numeric_value
                new_entry['completed'] = True
                print(f"DEBUG - Created new entry with numeric value {numeric_value}")
            elif habit_type == 'text' and text_value is not None:
                new_entry['textValue'] = text_value
                new_entry['completed'] = True
                print(f"DEBUG - Created new entry with text value {text_value}")
            else:
                print(f"DEBUG - Created new boolean entry with completed={new_entry['completed']}")
            
            progress.append(new_entry)
        
        habit['progress'] = progress
        
        # Mark the field as modified for SQLAlchemy to detect the change
        flag_modified(challenge, 'member_habits')
        db.session.commit()
        
        return jsonify({
            'message': 'Habit status updated successfully',
            'date': target_date,
            'completed': new_status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500