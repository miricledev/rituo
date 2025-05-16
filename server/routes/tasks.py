from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db.models import db, User, Task, TaskCompletion
from datetime import datetime, timedelta, date
import json

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/', methods=['POST'])
@jwt_required()
def create_tasks():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    data = request.get_json()
    
    # Validate input data
    if not data or not data.get('tasks') or not isinstance(data.get('tasks'), list):
        return jsonify({'message': 'Invalid task data'}), 400
    
    # Check if user already has active tasks in a 30-day cycle
    today = date.today()
    active_tasks = Task.query.filter_by(user_id=user_id).filter(
        Task.cycle_end_date >= today
    ).first()
    
    if active_tasks:
        return jsonify({
            'message': 'You already have an active 30-day cycle. You must wait until it ends before creating a new set of tasks.'
        }), 409
    
    # Set cycle dates
    start_date = today
    end_date = start_date + timedelta(days=30)
    
    # Update user's current cycle dates
    user.current_cycle_start_date = start_date
    user.current_cycle_end_date = end_date
    
    # Create tasks
    task_list = []
    try:
        for task_data in data.get('tasks'):
            if not task_data.get('title'):
                continue  # Skip tasks without title
                
            new_task = Task(
                user_id=user_id,
                title=task_data.get('title'),
                description=task_data.get('description', ''),
                cycle_start_date=start_date,
                cycle_end_date=end_date
            )
            db.session.add(new_task)
            db.session.flush()  # To get the task ID
            
            # Create empty task completion records for today
            completion = TaskCompletion(
                task_id=new_task.id,
                user_id=user_id,
                completion_date=today,
                is_complete=False
            )
            db.session.add(completion)
            
            task_list.append(new_task.to_dict())
        
        db.session.commit()
        return jsonify({
            'message': 'Tasks created successfully',
            'tasks': task_list,
            'cycle_start_date': start_date.isoformat(),
            'cycle_end_date': end_date.isoformat()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to create tasks: {str(e)}'}), 500


@tasks_bp.route('/', methods=['GET'])
@jwt_required()
def get_tasks():
    user_id = get_jwt_identity()
    
    # Get all active tasks for the user
    today = date.today()
    tasks = Task.query.filter_by(user_id=user_id).filter(
        Task.cycle_end_date >= today
    ).all()
    
    # Get today's completion status
    task_ids = [task.id for task in tasks]
    completions = TaskCompletion.query.filter(
        TaskCompletion.task_id.in_(task_ids),
        TaskCompletion.completion_date == today
    ).all()
    
    # Create a map of task_id to completion status
    completion_map = {completion.task_id: completion.is_complete for completion in completions}
    
    # Prepare response data
    tasks_data = []
    for task in tasks:
        task_dict = task.to_dict()
        task_dict['is_complete_today'] = completion_map.get(task.id, False)
        tasks_data.append(task_dict)
    
    return jsonify({
        'tasks': tasks_data
    }), 200


@tasks_bp.route('/<int:task_id>/complete', methods=['POST'])
@jwt_required()
def toggle_task_completion(task_id):
    user_id = get_jwt_identity()
    
    # Get the task
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    
    if not task:
        return jsonify({'message': 'Task not found'}), 404
    
    # Check if task is still in active cycle
    today = date.today()
    if today > task.cycle_end_date:
        return jsonify({'message': 'Task cycle has ended'}), 400
    
    # Find or create today's completion record
    completion = TaskCompletion.query.filter_by(
        task_id=task_id,
        user_id=user_id,
        completion_date=today
    ).first()
    
    if not completion:
        completion = TaskCompletion(
            task_id=task_id,
            user_id=user_id,
            completion_date=today,
            is_complete=False
        )
        db.session.add(completion)
    
    # Toggle completion status
    completion.is_complete = not completion.is_complete
    
    try:
        db.session.commit()
        return jsonify({
            'message': 'Task completion updated',
            'is_complete': completion.is_complete
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to update task completion: {str(e)}'}), 500


@tasks_bp.route('/history/<int:task_id>', methods=['GET'])
@jwt_required()
def get_task_history(task_id):
    user_id = get_jwt_identity()
    
    # Get the task
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    
    if not task:
        return jsonify({'message': 'Task not found'}), 404
    
    # Get completion history
    completions = TaskCompletion.query.filter_by(
        task_id=task_id,
        user_id=user_id
    ).order_by(TaskCompletion.completion_date).all()
    
    history = [completion.to_dict() for completion in completions]
    
    return jsonify({
        'task': task.to_dict(),
        'history': history
    }), 200


@tasks_bp.route('/expired', methods=['GET'])
@jwt_required()
def get_expired_tasks():
    user_id = get_jwt_identity()
    
    # Get all expired tasks (cycles that have ended)
    today = date.today()
    tasks = Task.query.filter_by(user_id=user_id).filter(
        Task.cycle_end_date < today
    ).order_by(Task.cycle_end_date.desc()).all()
    
    tasks_data = [task.to_dict() for task in tasks]
    
    return jsonify({
        'expired_tasks': tasks_data
    }), 200