from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from db.models import db, User, Group, GroupChallenge
import uuid
import stripe
from datetime import datetime
import os
import logging
import traceback
from sqlalchemy.orm.attributes import flag_modified

groups_bp = Blueprint('groups', __name__)
stripe.api_key = os.getenv('STRIPE_TEST_SECRET_KEY')
logging.info(f"Stripe API key loaded: {'Yes' if stripe.api_key else 'No'}")

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
        member_count = len(list(group.members)) if group.members else 1
        total_cost = member_count * 1.99
        try:
            payment_intent = stripe.PaymentIntent.create(
                amount=int(total_cost * 100),
                currency='gbp',
                metadata={
                    'userId': get_jwt_identity(),
                    'groupName': group.name,
                    'groupId': group_id
                }
            )
        except stripe.error.StripeError as e:
            return jsonify({'error': 'Stripe error', 'details': str(e), 'type': type(e).__name__}), 500
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
        return jsonify({'challenge': challenge.to_dict(), 'clientSecret': payment_intent.client_secret}), 201
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

    # Toggle completion
    progress_entry['completed'] = not progress_entry['completed']

    # Save back to the challenge
    challenge.member_habits = member_habits
    flag_modified(challenge, 'member_habits')
    db.session.commit()
    return jsonify({'success': True, 'completed': progress_entry['completed']}) 