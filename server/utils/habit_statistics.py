from datetime import date, datetime, timedelta


VALID_WEEKDAYS = (
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
)


def _as_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).date()
    except (TypeError, ValueError):
        return None


def _as_float(value, fallback=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(fallback)


def _as_int(value, fallback=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(fallback)


def _clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def _rounded(value, digits=2):
    return round(float(value or 0), digits)


def habit_is_scheduled_on(habit, target_date):
    schedule_days = habit.get('scheduleDays') or []
    return not schedule_days or target_date.strftime('%A') in schedule_days


def progress_entry_for_date(habit, target_date):
    target_key = target_date.isoformat() if isinstance(target_date, date) else str(target_date)[:10]
    return next(
        (
            entry for entry in (habit.get('progress') or [])
            if str(entry.get('date') or '')[:10] == target_key
        ),
        None,
    )


def periodic_progress_counts(habit, progress_entry, target_override=None):
    progress_entry = progress_entry or {}
    target_source = target_override
    if target_source in (None, ''):
        target_source = progress_entry.get('periodicTarget')
    if target_source in (None, ''):
        target_source = habit.get('periodicOccurrences')
    target = max(1, _as_int(target_source, 4))

    logged_occurrences = progress_entry.get('periodicLoggedOccurrences')
    logged_count = 0
    if isinstance(logged_occurrences, list):
        logged_count = len({str(value) for value in logged_occurrences})

    recorded_count = max(0, _as_int(progress_entry.get('periodicCompleted'), 0))
    completed = max(logged_count, recorded_count)
    has_granular_progress = (
        'periodicCompleted' in progress_entry
        or 'periodicLoggedOccurrences' in progress_entry
        or 'periodicTarget' in progress_entry
    )
    if progress_entry.get('completed') and not has_granular_progress:
        completed = target

    return min(completed, target), target


def habit_progress_fraction(habit, progress_entry, periodic_target_override=None):
    if not progress_entry:
        return 0.0

    habit_type = habit.get('habitType') or 'boolean'
    if habit_type == 'periodic':
        completed, target = periodic_progress_counts(habit, progress_entry, periodic_target_override)
        return _clamp(completed / target if target else 0)

    if habit_type == 'numeric':
        if progress_entry.get('numericValue') is None:
            return 1.0 if progress_entry.get('completed') else 0.0
        minimum = _as_float(habit.get('minValue'), 0)
        maximum = _as_float(habit.get('maxValue'), 10)
        value = _as_float(progress_entry.get('numericValue'), minimum)
        if maximum == minimum:
            return 1.0 if value >= maximum else 0.0
        return _clamp((value - minimum) / (maximum - minimum))

    return 1.0 if progress_entry.get('completed') else 0.0


def habit_progress_detail(habit, progress_entry, periodic_target_override=None):
    fraction = habit_progress_fraction(habit, progress_entry, periodic_target_override)
    habit_type = habit.get('habitType') or 'boolean'
    correction_history = (progress_entry or {}).get('adminCorrections') or []
    last_correction = correction_history[-1] if correction_history else None
    periodic_completed = None
    periodic_target = None
    if habit_type == 'periodic':
        periodic_completed, periodic_target = periodic_progress_counts(habit, progress_entry, periodic_target_override)

    status = 'missed'
    if fraction >= 1:
        status = 'complete'
    elif fraction > 0:
        status = 'partial'

    return {
        'progressFraction': _rounded(fraction, 4),
        'progressPercent': _rounded(fraction * 100, 1),
        'status': status,
        'isComplete': fraction >= 1,
        'hasProgress': fraction > 0,
        'numericValue': (progress_entry or {}).get('numericValue'),
        'textValue': (progress_entry or {}).get('textValue'),
        'periodicCompleted': periodic_completed,
        'periodicTarget': periodic_target,
        'streakRestored': bool((progress_entry or {}).get('streakRestored')),
        'streakRestoreCost': max(0, _as_int((progress_entry or {}).get('streakRestoreCost'), 0)),
        'adminCorrected': bool(last_correction),
        'adminCorrection': last_correction,
    }


def effective_challenge_start(challenge, member_habit):
    challenge_start = _as_date(getattr(challenge, 'start_date', None))
    joined_at = _as_date((member_habit or {}).get('joinedAt'))
    if challenge_start and joined_at:
        return max(challenge_start, joined_at)
    return challenge_start or joined_at


def _date_range(start_date, end_date):
    if not start_date or not end_date or end_date < start_date:
        return []
    dates = []
    cursor = start_date
    while cursor <= end_date:
        dates.append(cursor)
        cursor += timedelta(days=1)
    return dates


def _current_streak(daily_rows, field, today_value, threshold):
    rows = list(daily_rows or [])
    if (
        rows
        and _as_date(rows[-1].get('date')) == today_value
        and not threshold(rows[-1].get(field, 0))
        and not rows[-1].get('streakRestored')
    ):
        rows = rows[:-1]
    streak = 0
    for row in reversed(rows):
        if row.get('streakRestored') and not threshold(row.get(field, 0)):
            continue
        if not threshold(row.get(field, 0)):
            break
        streak += 1
    return streak


def _longest_streak(daily_rows, field, threshold):
    longest = 0
    current = 0
    for row in daily_rows or []:
        if row.get('streakRestored') and not threshold(row.get(field, 0)):
            continue
        if threshold(row.get(field, 0)):
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest


def _breakdown(habit_rows, key):
    buckets = {}
    for habit in habit_rows:
        bucket_key = habit.get(key) or 'unclassified'
        bucket = buckets.setdefault(bucket_key, {
            'key': bucket_key,
            'earnedUnits': 0.0,
            'possibleUnits': 0,
            'fullCount': 0,
            'partialCount': 0,
            'missedCount': 0,
            'pendingCount': 0,
            'habitCount': 0,
        })
        bucket['earnedUnits'] += habit.get('earnedUnits', 0)
        bucket['possibleUnits'] += habit.get('possibleUnits', 0)
        bucket['fullCount'] += habit.get('fullCount', 0)
        bucket['partialCount'] += habit.get('partialCount', 0)
        bucket['missedCount'] += habit.get('missedCount', 0)
        bucket['pendingCount'] += habit.get('pendingCount', 0)
        bucket['habitCount'] += 1

    rows = []
    for bucket in buckets.values():
        possible = bucket['possibleUnits']
        rows.append({
            **bucket,
            'earnedUnits': _rounded(bucket['earnedUnits']),
            'completionRate': _rounded((bucket['earnedUnits'] / possible) * 100 if possible else 0, 1),
        })
    return sorted(rows, key=lambda item: item['key'])


def build_member_habit_statistics(
    challenge,
    member_habit,
    today_value=None,
    goal_titles=None,
    first_day_eligibility=None,
):
    today_value = _as_date(today_value) or date.today()
    goal_titles = goal_titles or {}
    start_date = effective_challenge_start(challenge, member_habit)
    challenge_end = _as_date(getattr(challenge, 'end_date', None))
    challenge_status = str(getattr(challenge, 'status', '') or '').lower()
    today_is_live = bool(
        challenge_status != 'completed'
        and start_date
        and challenge_end
        and start_date <= today_value <= challenge_end
    )
    pending_streak_date = today_value if today_is_live else None
    data_end = min(today_value, challenge_end) if challenge_end else today_value
    elapsed_dates = _date_range(start_date, data_end)
    total_challenge_days = len(_date_range(start_date, challenge_end))
    elapsed_challenge_days = len(elapsed_dates)

    habit_rows = []
    for index, habit in enumerate((member_habit or {}).get('habits') or []):
        daily_rows = []
        for target_date in elapsed_dates:
            if not habit_is_scheduled_on(habit, target_date):
                continue
            eligibility = None
            if (
                first_day_eligibility
                and first_day_eligibility.get('date') == target_date.isoformat()
            ):
                eligibility = (first_day_eligibility.get('habits') or {}).get(str(index))
            eligible_occurrence_count = None
            if eligibility is not None:
                eligible_occurrence_count = max(0, _as_int(eligibility.get('eligibleOccurrenceCount'), 0))
                if eligible_occurrence_count == 0:
                    continue
            progress_entry = progress_entry_for_date(habit, target_date)
            detail = habit_progress_detail(
                habit,
                progress_entry,
                periodic_target_override=(
                    eligible_occurrence_count
                    if habit.get('habitType') == 'periodic'
                    else None
                ),
            )
            if today_is_live and target_date == today_value and detail['status'] == 'missed':
                detail['status'] = 'pending'
            daily_rows.append({
                'date': target_date.isoformat(),
                'isScheduled': True,
                **detail,
            })

        earned_units = sum(row['progressFraction'] for row in daily_rows)
        possible_units = len(daily_rows)
        full_count = sum(1 for row in daily_rows if row['status'] == 'complete')
        partial_count = sum(1 for row in daily_rows if row['status'] == 'partial')
        missed_count = sum(1 for row in daily_rows if row['status'] == 'missed')
        pending_count = sum(1 for row in daily_rows if row['status'] == 'pending')
        habit_type = habit.get('habitType') or 'boolean'
        combat_type = habit.get('combatType') or 'unclassified'
        linked_goal_id = habit.get('linkedGoalId')
        periodic_completed = sum(
            row.get('periodicCompleted') or 0
            for row in daily_rows
            if habit_type == 'periodic'
        )
        periodic_target = sum(
            row.get('periodicTarget') or 0
            for row in daily_rows
            if habit_type == 'periodic'
        )

        habit_rows.append({
            'index': index,
            'name': habit.get('name') or f'Habit {index + 1}',
            'description': habit.get('description') or '',
            'habitType': habit_type,
            'combatType': combat_type,
            'linkedGoalId': linked_goal_id,
            'linkedGoalTitle': goal_titles.get(str(linked_goal_id), ''),
            'scheduleDays': habit.get('scheduleDays') or [],
            'scheduleTime': habit.get('scheduleTime') or '',
            'durationMinutes': max(1, _as_int(habit.get('durationMinutes'), 30)),
            'periodicOccurrences': max(1, _as_int(habit.get('periodicOccurrences'), 4)),
            'periodicIntervalHours': max(1, _as_int(habit.get('periodicIntervalHours'), 4)),
            'allowOverlap': bool(habit.get('allowOverlap')),
            'earnedUnits': _rounded(earned_units),
            'possibleUnits': possible_units,
            'completionRate': _rounded((earned_units / possible_units) * 100 if possible_units else 0, 1),
            'fullCount': full_count,
            'partialCount': partial_count,
            'missedCount': missed_count,
            'pendingCount': pending_count,
            'activeCount': full_count + partial_count,
            'currentFullStreak': _current_streak(daily_rows, 'progressFraction', pending_streak_date, lambda value: value >= 1),
            'longestFullStreak': _longest_streak(daily_rows, 'progressFraction', lambda value: value >= 1),
            'currentActiveStreak': _current_streak(daily_rows, 'progressFraction', pending_streak_date, lambda value: value > 0),
            'longestActiveStreak': _longest_streak(daily_rows, 'progressFraction', lambda value: value > 0),
            'periodicCompleted': periodic_completed if habit_type == 'periodic' else None,
            'periodicTarget': periodic_target if habit_type == 'periodic' else None,
            'dailyData': daily_rows,
        })

    daily_rows = []
    for target_date in elapsed_dates:
        scheduled_habits = []
        for habit in habit_rows:
            day_row = next((row for row in habit['dailyData'] if row['date'] == target_date.isoformat()), None)
            if day_row:
                scheduled_habits.append({
                    'habitIndex': habit['index'],
                    'name': habit['name'],
                    'habitType': habit['habitType'],
                    'combatType': habit['combatType'],
                    **day_row,
                })
        if not scheduled_habits:
            continue
        average_fraction = sum(row['progressFraction'] for row in scheduled_habits) / len(scheduled_habits)
        status = 'pending' if today_is_live and target_date == today_value else 'missed'
        if average_fraction >= 1:
            status = 'perfect'
        elif average_fraction > 0:
            status = 'partial'
        daily_rows.append({
            'date': target_date.isoformat(),
            'scheduledCount': len(scheduled_habits),
            'earnedUnits': _rounded(sum(row['progressFraction'] for row in scheduled_habits)),
            'completionRate': _rounded(average_fraction * 100, 1),
            'status': status,
            'fullCount': sum(1 for row in scheduled_habits if row['status'] == 'complete'),
            'partialCount': sum(1 for row in scheduled_habits if row['status'] == 'partial'),
            'missedCount': sum(1 for row in scheduled_habits if row['status'] == 'missed'),
            'pendingCount': sum(1 for row in scheduled_habits if row['status'] == 'pending'),
            'habits': scheduled_habits,
        })

    earned_units = sum(habit['earnedUnits'] for habit in habit_rows)
    possible_units = sum(habit['possibleUnits'] for habit in habit_rows)
    full_count = sum(habit['fullCount'] for habit in habit_rows)
    partial_count = sum(habit['partialCount'] for habit in habit_rows)
    missed_count = sum(habit['missedCount'] for habit in habit_rows)
    pending_count = sum(habit['pendingCount'] for habit in habit_rows)
    periodic_completed = sum(habit.get('periodicCompleted') or 0 for habit in habit_rows)
    periodic_target = sum(habit.get('periodicTarget') or 0 for habit in habit_rows)
    active_days = sum(1 for row in daily_rows if row['completionRate'] > 0)
    perfect_days = sum(1 for row in daily_rows if row['completionRate'] >= 100)
    partial_days = sum(1 for row in daily_rows if 0 < row['completionRate'] < 100)
    pending_days = sum(1 for row in daily_rows if row['status'] == 'pending')
    missed_days = sum(1 for row in daily_rows if row['status'] == 'missed')
    finalized_rows = [row for row in daily_rows if row['status'] != 'pending']
    recent_rows = finalized_rows[-7:]
    previous_rows = finalized_rows[-14:-7]
    recent_average = sum(row['completionRate'] for row in recent_rows) / len(recent_rows) if recent_rows else 0
    previous_average = sum(row['completionRate'] for row in previous_rows) / len(previous_rows) if previous_rows else 0
    best_day = max(daily_rows, key=lambda row: (row['completionRate'], row['date']), default=None)
    today_row = next((row for row in daily_rows if row['date'] == today_value.isoformat()), None)

    return {
        'challenge': {
            'startDate': start_date.isoformat() if start_date else None,
            'endDate': challenge_end.isoformat() if challenge_end else None,
            'dataThrough': data_end.isoformat() if data_end else None,
            'studentToday': today_value.isoformat(),
            'totalDays': total_challenge_days,
            'elapsedDays': elapsed_challenge_days,
            'daysRemaining': max(0, (challenge_end - today_value).days) if challenge_end else 0,
            'progressPercent': _rounded((elapsed_challenge_days / total_challenge_days) * 100 if total_challenge_days else 0, 1),
            'todayIsLive': today_is_live,
        },
        'summary': {
            'completionRate': _rounded((earned_units / possible_units) * 100 if possible_units else 0, 1),
            'earnedUnits': _rounded(earned_units),
            'possibleUnits': possible_units,
            'fullCount': full_count,
            'partialCount': partial_count,
            'missedCount': missed_count,
            'pendingCount': pending_count,
            'activeDays': active_days,
            'perfectDays': perfect_days,
            'partialDays': partial_days,
            'missedDays': missed_days,
            'pendingDays': pending_days,
            'scheduledDays': len(daily_rows),
            'currentPerfectStreak': _current_streak(daily_rows, 'completionRate', pending_streak_date, lambda value: value >= 100),
            'longestPerfectStreak': _longest_streak(daily_rows, 'completionRate', lambda value: value >= 100),
            'currentActiveStreak': _current_streak(daily_rows, 'completionRate', pending_streak_date, lambda value: value > 0),
            'longestActiveStreak': _longest_streak(daily_rows, 'completionRate', lambda value: value > 0),
            'periodicCompleted': periodic_completed,
            'periodicTarget': periodic_target,
            'recentAverage': _rounded(recent_average, 1),
            'previousAverage': _rounded(previous_average, 1),
            'trendDelta': _rounded(recent_average - previous_average, 1) if previous_rows else 0,
            'bestDay': {
                'date': best_day['date'],
                'completionRate': best_day['completionRate'],
            } if best_day else None,
            'today': today_row,
        },
        'habits': habit_rows,
        'daily': daily_rows,
        'habitTypeBreakdown': _breakdown(habit_rows, 'habitType'),
        'combatTypeBreakdown': _breakdown(habit_rows, 'combatType'),
        'definitions': {
            'completionRate': 'Average progress across scheduled habit-days. Each habit-day has equal weight; periodic occurrences form a fraction of that habit-day.',
            'earnedUnits': 'Completion-equivalent habit-days earned. For example, three of four periodic occurrences earns 0.75 units.',
            'activeDay': 'A scheduled day with any recorded habit progress.',
            'perfectDay': 'A scheduled day where every scheduled habit reached 100%.',
            'pendingDay': 'The current live day when no progress has been recorded yet. It is not counted as missed until the day is final.',
            'fullStreak': 'Consecutive scheduled occasions completed at 100%. Unscheduled days do not break the streak.',
            'activeStreak': 'Consecutive scheduled occasions with any progress above 0%. Unscheduled days do not break the streak.',
        },
    }
