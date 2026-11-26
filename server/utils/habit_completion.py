from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


DEFAULT_SCHOOL_TIMEZONE = 'Europe/London'
PERIODIC_DAY_START_MINUTES = 7 * 60
PERIODIC_DAY_END_MINUTES = 22 * 60


def resolve_timezone(timezone_name):
    candidate = str(timezone_name or DEFAULT_SCHOOL_TIMEZONE).strip()
    try:
        return candidate, ZoneInfo(candidate)
    except ZoneInfoNotFoundError:
        return DEFAULT_SCHOOL_TIMEZONE, ZoneInfo(DEFAULT_SCHOOL_TIMEZONE)


def time_to_minutes(value, fallback=None):
    try:
        hours, minutes = str(value or '').split(':', 1)
        hours = int(hours)
        minutes = int(minutes)
        if not 0 <= hours <= 23 or not 0 <= minutes <= 59:
            raise ValueError
        return (hours * 60) + minutes
    except (TypeError, ValueError):
        return fallback


def minutes_to_time(value):
    safe_minutes = max(0, min((23 * 60) + 59, int(round(value))))
    return f'{safe_minutes // 60:02d}:{safe_minutes % 60:02d}'


def build_default_habit_schedule_items(habit, habit_index):
    is_periodic = habit.get('habitType') == 'periodic'
    suggested_start = (8 * 60) if is_periodic else (16 * 60) + (habit_index * 45)
    duration_minutes = max(5, int(habit.get('durationMinutes') or 30))
    requested_start = time_to_minutes(habit.get('scheduleTime'), suggested_start)

    if not is_periodic:
        start_time = minutes_to_time(requested_start)
        return [{
            'habitIndex': habit_index,
            'startTime': start_time,
            'endTime': minutes_to_time(requested_start + duration_minutes),
            'durationMinutes': duration_minutes,
            'source': 'habit-default',
        }]

    occurrences = max(2, int(habit.get('periodicOccurrences') or 4))
    requested_interval = max(30, int(float(habit.get('periodicIntervalHours') or 4) * 60))
    maximum_interval = max(
        30,
        (PERIODIC_DAY_END_MINUTES - PERIODIC_DAY_START_MINUTES) // max(1, occurrences - 1),
    )
    interval_minutes = min(requested_interval, maximum_interval)
    latest_start = PERIODIC_DAY_END_MINUTES - (interval_minutes * (occurrences - 1))
    adjusted_start = min(
        max(PERIODIC_DAY_START_MINUTES, requested_start),
        max(PERIODIC_DAY_START_MINUTES, latest_start),
    )
    return [{
        'habitIndex': habit_index,
        'startTime': minutes_to_time(adjusted_start + (occurrence_index * interval_minutes)),
        'endTime': minutes_to_time(adjusted_start + (occurrence_index * interval_minutes) + duration_minutes),
        'durationMinutes': duration_minutes,
        'occurrenceIndex': occurrence_index,
        'source': 'habit-default',
    } for occurrence_index in range(occurrences)]


def normalize_habit_schedule_items(items, habit, habit_index):
    matches = []
    for item in items or []:
        try:
            item_habit_index = int(item.get('habitIndex'))
        except (AttributeError, TypeError, ValueError):
            continue
        if item.get('itemType') != 'habit' or item_habit_index != int(habit_index):
            continue
        start_minutes = time_to_minutes(item.get('startTime'))
        end_minutes = time_to_minutes(item.get('endTime'))
        if start_minutes is None:
            continue
        if end_minutes is None or end_minutes <= start_minutes:
            end_minutes = min((23 * 60) + 59, start_minutes + max(5, int(habit.get('durationMinutes') or 30)))
        matches.append({
            **item,
            'habitIndex': int(habit_index),
            'startTime': minutes_to_time(start_minutes),
            'endTime': minutes_to_time(end_minutes),
        })
    matches.sort(key=lambda item: (item['startTime'], item['endTime']))
    return matches or build_default_habit_schedule_items(habit, int(habit_index))


def build_completion_window_access(
    plan_date,
    schedule_items,
    current_time,
    timezone_name=DEFAULT_SCHOOL_TIMEZONE,
    completed=False,
    periodic=False,
    logged_occurrence_indexes=None,
    eligible_after=None,
):
    resolved_name, school_timezone = resolve_timezone(timezone_name)
    now = current_time
    if now.tzinfo is None:
        now = now.replace(tzinfo=school_timezone)
    else:
        now = now.astimezone(school_timezone)
    activation_time = eligible_after
    if activation_time is not None:
        if activation_time.tzinfo is None:
            activation_time = activation_time.replace(tzinfo=school_timezone)
        else:
            activation_time = activation_time.astimezone(school_timezone)

    logged_indexes = {
        int(value)
        for value in (logged_occurrence_indexes or [])
        if str(value).lstrip('-').isdigit()
    }
    windows = []
    for occurrence_index, item in enumerate(schedule_items or []):
        start_minutes = time_to_minutes(item.get('startTime'))
        end_minutes = time_to_minutes(item.get('endTime'))
        if start_minutes is None or end_minutes is None:
            continue
        start_at = datetime.combine(
            plan_date,
            time(hour=start_minutes // 60, minute=start_minutes % 60),
            tzinfo=school_timezone,
        )
        end_date = plan_date + timedelta(days=1) if end_minutes < start_minutes else plan_date
        end_at = datetime.combine(
            end_date,
            time(hour=end_minutes // 60, minute=end_minutes % 60),
            tzinfo=school_timezone,
        )
        opens_at = start_at - timedelta(hours=1)
        closes_at = end_at + timedelta(hours=1)
        logged = occurrence_index in logged_indexes
        eligible = activation_time is None or start_at >= activation_time
        windows.append({
            'occurrenceIndex': occurrence_index,
            'startTime': item.get('startTime'),
            'endTime': item.get('endTime'),
            'opensAt': opens_at.isoformat(),
            'closesAt': closes_at.isoformat(),
            'opensTime': opens_at.strftime('%H:%M'),
            'closesTime': closes_at.strftime('%H:%M'),
            'logged': logged,
            'eligible': eligible,
            'exemptReason': None if eligible else 'challenge-not-started',
            '_opensAt': opens_at,
            '_closesAt': closes_at,
        })

    eligible_windows = [window for window in windows if window['eligible']]
    available_windows = [window for window in eligible_windows if not (periodic and window['logged'])]
    active_window = next(
        (window for window in available_windows if window['_opensAt'] <= now <= window['_closesAt']),
        None,
    )
    upcoming_window = next(
        (window for window in available_windows if now < window['_opensAt']),
        None,
    )
    if completed:
        status = 'completed'
    elif active_window:
        status = 'open'
    elif upcoming_window:
        status = 'upcoming'
    elif windows and not eligible_windows:
        status = 'not-applicable'
    else:
        status = 'closed'

    public_windows = [
        {key: value for key, value in window.items() if not key.startswith('_')}
        for window in windows
    ]
    active_public = next(
        (window for window in public_windows if active_window and window['occurrenceIndex'] == active_window['occurrenceIndex']),
        None,
    )
    next_public = next(
        (window for window in public_windows if upcoming_window and window['occurrenceIndex'] == upcoming_window['occurrenceIndex']),
        None,
    )
    return {
        'date': plan_date.isoformat(),
        'timezone': resolved_name,
        'status': status,
        'windowOpen': bool(active_window),
        'canComplete': bool(active_window and not completed),
        'activeOccurrenceIndex': active_window['occurrenceIndex'] if active_window else None,
        'eligibleOccurrenceIndexes': [window['occurrenceIndex'] for window in eligible_windows],
        'eligibleOccurrenceCount': len(eligible_windows),
        'exemptOccurrenceCount': len(windows) - len(eligible_windows),
        'activeWindow': active_public,
        'nextWindow': next_public,
        'windows': public_windows,
    }
