from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db.models import db, User, Task, TaskCompletion
from datetime import datetime, timedelta, date
from sqlalchemy import func, and_

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_summary():
    user_id = get_jwt_identity()
    
    # Get current date
    today = date.today()
    
    # Get active tasks
    active_tasks = Task.query.filter_by(user_id=user_id).filter(
        Task.cycle_end_date >= today
    ).all()
    
    if not active_tasks:
        return jsonify({
            'message': 'No active tasks found',
            'has_active_cycle': False
        }), 200
    
    # Extract basic cycle information
    cycle_start_date = active_tasks[0].cycle_start_date
    cycle_end_date = active_tasks[0].cycle_end_date
    
    # Calculate days elapsed and days remaining
    days_elapsed = (today - cycle_start_date).days + 1  # Include today
    days_remaining = (cycle_end_date - today).days
    total_days = (cycle_end_date - cycle_start_date).days + 1  # Total days in cycle
    
    # Calculate completion statistics
    task_ids = [task.id for task in active_tasks]
    
    # Get all completions for current tasks
    completions = TaskCompletion.query.filter(
        TaskCompletion.task_id.in_(task_ids),
        TaskCompletion.completion_date >= cycle_start_date,
        TaskCompletion.completion_date <= today
    ).all()
    
    # Group completions by task and date
    completion_map = {}
    for completion in completions:
        task_id = completion.task_id
        if task_id not in completion_map:
            completion_map[task_id] = {}
        completion_map[task_id][completion.completion_date.isoformat()] = completion.is_complete
    
    # Calculate stats per task
    tasks_stats = []
    total_possible_completions = days_elapsed * len(active_tasks)
    total_actual_completions = 0
    
    for task in active_tasks:
        completions_count = sum(1 for _, is_complete in completion_map.get(task.id, {}).items() if is_complete)
        total_actual_completions += completions_count
        
        completion_rate = completions_count / days_elapsed if days_elapsed > 0 else 0
        
        # Calculate current streak
        current_streak = 0
        date_to_check = today
        while date_to_check >= cycle_start_date:
            date_str = date_to_check.isoformat()
            is_complete = completion_map.get(task.id, {}).get(date_str, False)
            if is_complete:
                current_streak += 1
                date_to_check -= timedelta(days=1)
            else:
                break
        
        tasks_stats.append({
            'task_id': task.id,
            'title': task.title,
            'days_completed': completions_count,
            'completion_rate': completion_rate,
            'current_streak': current_streak
        })
    
    # Calculate overall stats
    overall_completion_rate = total_actual_completions / total_possible_completions if total_possible_completions > 0 else 0
    
    return jsonify({
        'has_active_cycle': True,
        'cycle_start_date': cycle_start_date.isoformat(),
        'cycle_end_date': cycle_end_date.isoformat(),
        'days_elapsed': days_elapsed,
        'days_remaining': days_remaining,
        'total_days': total_days,
        'progress_percentage': (days_elapsed / total_days) * 100 if total_days > 0 else 0,
        'overall_completion_rate': overall_completion_rate * 100,  # as percentage
        'tasks_stats': tasks_stats
    }), 200


@analytics_bp.route('/heatmap', methods=['GET'])
@jwt_required()
def get_heatmap_data():
    user_id = get_jwt_identity()
    
    # Get current date
    today = date.today()
    
    # Get active tasks
    active_tasks = Task.query.filter_by(user_id=user_id).filter(
        Task.cycle_end_date >= today
    ).all()
    
    if not active_tasks:
        return jsonify({
            'message': 'No active tasks found'
        }), 200
    
    # Extract basic cycle information
    cycle_start_date = active_tasks[0].cycle_start_date
    
    # Get all completions for current tasks
    task_ids = [task.id for task in active_tasks]
    completions = TaskCompletion.query.filter(
        TaskCompletion.task_id.in_(task_ids),
        TaskCompletion.user_id == user_id,
        TaskCompletion.completion_date >= cycle_start_date,
        TaskCompletion.completion_date <= today
    ).all()
    
    # Prepare heatmap data
    heatmap_data = {}
    
    # Initialize with all dates
    current_date = cycle_start_date
    while current_date <= today:
        date_str = current_date.isoformat()
        heatmap_data[date_str] = {
            'date': date_str,
            'total_tasks': len(active_tasks),
            'completed_tasks': 0,
            'completion_rate': 0
        }
        current_date += timedelta(days=1)
    
    # Fill in completion data
    for completion in completions:
        date_str = completion.completion_date.isoformat()
        if completion.is_complete:
            heatmap_data[date_str]['completed_tasks'] += 1
    
    # Calculate completion rates
    for date_str, data in heatmap_data.items():
        data['completion_rate'] = (data['completed_tasks'] / data['total_tasks']) * 100 if data['total_tasks'] > 0 else 0
    
    return jsonify({
        'heatmap_data': list(heatmap_data.values())
    }), 200


@analytics_bp.route('/trends', methods=['GET'])
@jwt_required()
def get_trends():
    user_id = get_jwt_identity()
    
    # Get current date
    today = date.today()
    
    # Get active tasks
    active_tasks = Task.query.filter_by(user_id=user_id).filter(
        Task.cycle_end_date >= today
    ).all()
    
    if not active_tasks:
        return jsonify({
            'message': 'No active tasks found'
        }), 200
    
    # Extract basic cycle information
    cycle_start_date = active_tasks[0].cycle_start_date
    
    # Get all completions for current tasks
    task_ids = [task.id for task in active_tasks]
    
    # Calculate completion trends by day of week
    day_of_week_data = db.session.query(
        func.extract('dow', TaskCompletion.completion_date).label('day_of_week'),
        func.count(TaskCompletion.id).label('total'),
        func.sum(func.cast(TaskCompletion.is_complete, db.Integer)).label('completed')
    ).filter(
        TaskCompletion.task_id.in_(task_ids),
        TaskCompletion.user_id == user_id,
        TaskCompletion.completion_date >= cycle_start_date,
        TaskCompletion.completion_date <= today
    ).group_by('day_of_week').all()
    
    # Prepare day of week data
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_of_week_trend = []
    
    for dow in range(7):  # 0-6 for Monday to Sunday
        dow_data = next((d for d in day_of_week_data if int(d.day_of_week) == dow), None)
        
        if dow_data:
            completion_rate = (dow_data.completed / dow_data.total) * 100 if dow_data.total > 0 else 0
            day_of_week_trend.append({
                'day': days[dow],
                'total': dow_data.total,
                'completed': dow_data.completed,
                'completion_rate': completion_rate
            })
        else:
            day_of_week_trend.append({
                'day': days[dow],
                'total': 0,
                'completed': 0,
                'completion_rate': 0
            })
    
    # Calculate completion trends by week
    weekly_data = []
    current_date = cycle_start_date
    week_start = current_date - timedelta(days=current_date.weekday())
    
    while week_start <= today:
        week_end = min(week_start + timedelta(days=6), today)
        
        # Count completions for this week
        week_completions = TaskCompletion.query.filter(
            TaskCompletion.task_id.in_(task_ids),
            TaskCompletion.user_id == user_id,
            TaskCompletion.completion_date >= week_start,
            TaskCompletion.completion_date <= week_end
        ).all()
        
        total_possible = len(active_tasks) * ((week_end - week_start).days + 1)
        total_completed = sum(1 for c in week_completions if c.is_complete)
        
        completion_rate = (total_completed / total_possible) * 100 if total_possible > 0 else 0
        
        weekly_data.append({
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'total_possible': total_possible,
            'total_completed': total_completed,
            'completion_rate': completion_rate
        })
        
        # Move to next week
        week_start += timedelta(days=7)
    
    return jsonify({
        'day_of_week_trend': day_of_week_trend,
        'weekly_trend': weekly_data
    }), 200


@analytics_bp.route('/task/<int:task_id>', methods=['GET'])
@jwt_required()
def get_task_analytics(task_id):
    user_id = get_jwt_identity()
    
    # Get the task
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    
    if not task:
        return jsonify({'message': 'Task not found'}), 404
    
    # Get current date
    today = date.today()
    
    # Get completions for the task
    completions = TaskCompletion.query.filter(
        TaskCompletion.task_id == task_id,
        TaskCompletion.user_id == user_id,
        TaskCompletion.completion_date >= task.cycle_start_date,
        TaskCompletion.completion_date <= today
    ).order_by(TaskCompletion.completion_date).all()
    
    # Calculate task statistics
    days_elapsed = (today - task.cycle_start_date).days + 1  # Include today
    days_completed = sum(1 for c in completions if c.is_complete)
    completion_rate = (days_completed / days_elapsed) * 100 if days_elapsed > 0 else 0
    
    # Calculate current streak
    current_streak = 0
    date_to_check = today
    
    while date_to_check >= task.cycle_start_date:
        completion = next((c for c in completions if c.completion_date == date_to_check), None)
        if completion and completion.is_complete:
            current_streak += 1
            date_to_check -= timedelta(days=1)
        else:
            break
    
    # Prepare daily data
    daily_data = []
    current_date = task.cycle_start_date
    
    while current_date <= today:
        completion = next((c for c in completions if c.completion_date == current_date), None)
        daily_data.append({
            'date': current_date.isoformat(),
            'is_complete': completion.is_complete if completion else False
        })
        current_date += timedelta(days=1)
    
    return jsonify({
        'task': task.to_dict(),
        'days_elapsed': days_elapsed,
        'days_completed': days_completed,
        'completion_rate': completion_rate,
        'current_streak': current_streak,
        'daily_data': daily_data
    }), 200