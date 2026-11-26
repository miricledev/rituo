import hashlib
from copy import deepcopy
from datetime import date, datetime, time, timedelta

from utils.habit_completion import build_default_habit_schedule_items


GOOGLE_SYNC_ITEM_TYPES = {'habit', 'manual', 'routine', 'break'}
GOOGLE_DAY_START = time(6, 0)
GOOGLE_DAY_END = time(23, 0)
GOOGLE_SYNC_MAX_DAYS = 45


def build_managed_google_events(group_id, student_id, days, timezone_name):
    managed_events = []
    seen_ids = set()
    for raw_day in (days or [])[:GOOGLE_SYNC_MAX_DAYS]:
        try:
            plan_date = date.fromisoformat(str((raw_day or {}).get('date') or '')[:10])
        except ValueError:
            continue
        for raw_item in ((raw_day or {}).get('items') or [])[:80]:
            item_type = str((raw_item or {}).get('itemType') or '').strip().lower()
            if item_type not in GOOGLE_SYNC_ITEM_TYPES or (raw_item or {}).get('source') == 'google-calendar':
                continue
            title = str((raw_item or {}).get('title') or '').strip()[:120]
            start_time = str((raw_item or {}).get('startTime') or '').strip()
            end_time = str((raw_item or {}).get('endTime') or '').strip()
            try:
                start_value = datetime.fromisoformat(f'{plan_date.isoformat()}T{start_time}:00')
                end_value = datetime.fromisoformat(f'{plan_date.isoformat()}T{end_time}:00')
            except ValueError:
                continue
            if not title or end_value <= start_value:
                continue
            planner_item_id = str((raw_item or {}).get('id') or f'{item_type}-{start_time}-{title}')[:160]
            planner_key = f'{group_id}:{student_id}:{plan_date.isoformat()}:{planner_item_id}'
            event_id = f"ipkp{hashlib.sha256(planner_key.encode('utf-8')).hexdigest()[:40]}"
            if event_id in seen_ids:
                continue
            seen_ids.add(event_id)
            is_habit = item_type == 'habit'
            managed_events.append({
                'id': event_id,
                'plannerKey': planner_key,
                'planDate': plan_date.isoformat(),
                'payload': {
                    'id': event_id,
                    'summary': title,
                    'description': (
                        'Inner Performance habit. Complete and log this inside IPKP.'
                        if is_habit
                        else 'Inner Performance planner block. Manage this inside IPKP.'
                    ),
                    'start': {
                        'dateTime': start_value.isoformat(),
                        'timeZone': timezone_name,
                    },
                    'end': {
                        'dateTime': end_value.isoformat(),
                        'timeZone': timezone_name,
                    },
                    'reminders': {
                        'useDefault': False,
                        'overrides': [{'method': 'popup', 'minutes': 10}],
                    },
                    'extendedProperties': {
                        'private': {
                            'ipkpManaged': 'true',
                            'ipkpPlannerKey': planner_key,
                            'ipkpItemType': item_type,
                        },
                    },
                },
            })
    return managed_events


def build_google_challenge_horizon_days(
    initial_days,
    habits,
    saved_days,
    recurring_reminders,
    weekly_templates,
    challenge_start,
    challenge_end,
    today,
    horizon_days=30,
):
    days_by_date = {
        str((raw_day or {}).get('date') or '')[:10]: deepcopy(raw_day)
        for raw_day in initial_days or []
        if (raw_day or {}).get('date')
    }
    saved_by_date = {
        str((raw_day or {}).get('date') or '')[:10]: deepcopy(raw_day)
        for raw_day in saved_days or []
        if (raw_day or {}).get('date')
    }
    horizon_start = max(today, challenge_start)
    horizon_end = min(challenge_end, today + timedelta(days=max(1, horizon_days)))
    cursor = horizon_start
    while cursor <= horizon_end:
        date_key = cursor.isoformat()
        if date_key in days_by_date:
            cursor += timedelta(days=1)
            continue
        if date_key in saved_by_date:
            days_by_date[date_key] = saved_by_date[date_key]
            cursor += timedelta(days=1)
            continue

        weekday = cursor.strftime('%A')
        items = []
        for habit_index, habit in enumerate(habits or []):
            schedule_days = habit.get('scheduleDays') or []
            if schedule_days and weekday not in schedule_days:
                continue
            for occurrence_index, schedule_item in enumerate(build_default_habit_schedule_items(habit, habit_index)):
                items.append({
                    'id': f'habit-{habit_index}-{occurrence_index}',
                    'title': str(habit.get('name') or f'Habit {habit_index + 1}')[:120],
                    'itemType': 'habit',
                    'habitIndex': habit_index,
                    'locked': False,
                    'allowOverlap': bool(habit.get('allowOverlap')),
                    'reason': 'Challenge habit',
                    **schedule_item,
                })
        for template_index, template_item in enumerate((weekly_templates or {}).get(weekday) or []):
            if str((template_item or {}).get('itemType') or '').lower() != 'break':
                continue
            items.append({
                **deepcopy(template_item),
                'id': str((template_item or {}).get('id') or f'weekly-break-{template_index}')[:80],
                'itemType': 'break',
            })
        for reminder in recurring_reminders or []:
            if weekday not in (reminder.get('weekdays') or []) or date_key < str(reminder.get('createdDate') or date_key)[:10]:
                continue
            items.append({
                'id': f"routine-{str(reminder.get('id') or '')[:70]}",
                'title': str(reminder.get('title') or 'Reminder')[:120],
                'itemType': 'routine',
                'habitIndex': -1,
                'startTime': reminder.get('startTime'),
                'endTime': reminder.get('endTime'),
                'durationMinutes': 0,
                'locked': False,
                'source': 'routine',
            })
        days_by_date[date_key] = {
            'date': date_key,
            'constraintsText': '',
            'items': sorted(items, key=lambda item: str(item.get('startTime') or '')),
        }
        cursor += timedelta(days=1)
    return [days_by_date[key] for key in sorted(days_by_date)][:GOOGLE_SYNC_MAX_DAYS]


def _parse_google_datetime(value, target_timezone):
    parsed = datetime.fromisoformat(str(value or '').replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=target_timezone)
    return parsed.astimezone(target_timezone)


def reconcile_managed_google_events(group_id, student_id, days, events, target_timezone):
    reconciled_days = deepcopy(days or [])
    items_by_key = {}
    for raw_day in reconciled_days:
        plan_date = str((raw_day or {}).get('date') or '')[:10]
        for item in (raw_day or {}).get('items') or []:
            item_id = str((item or {}).get('id') or '')
            if plan_date and item_id:
                items_by_key[(plan_date, item_id)] = item

    expected_prefix = f'{group_id}:{student_id}:'
    changed_dates = set()
    moved_across_dates = 0
    date_correction_event_ids = []
    for raw_event in events or []:
        private_properties = (((raw_event or {}).get('extendedProperties') or {}).get('private') or {})
        planner_key = str(private_properties.get('ipkpPlannerKey') or '')
        if (
            (raw_event or {}).get('status') == 'cancelled'
            or str(private_properties.get('ipkpManaged') or '').lower() != 'true'
            or not planner_key.startswith(expected_prefix)
        ):
            continue
        key_remainder = planner_key[len(expected_prefix):]
        if len(key_remainder) < 12 or key_remainder[10] != ':':
            continue
        plan_date = key_remainder[:10]
        planner_item_id = key_remainder[11:]
        planner_item = items_by_key.get((plan_date, planner_item_id))
        if not planner_item:
            continue
        start_payload = (raw_event or {}).get('start') or {}
        end_payload = (raw_event or {}).get('end') or {}
        if not start_payload.get('dateTime') or not end_payload.get('dateTime'):
            continue
        try:
            event_start = _parse_google_datetime(start_payload['dateTime'], target_timezone)
            event_end = _parse_google_datetime(end_payload['dateTime'], target_timezone)
        except (TypeError, ValueError):
            continue
        if event_end <= event_start or event_end - event_start > timedelta(hours=12):
            continue
        if event_start.date().isoformat() != plan_date:
            moved_across_dates += 1
            event_id = str((raw_event or {}).get('id') or '').strip()
            if event_id:
                date_correction_event_ids.append(event_id)
        start_time = event_start.strftime('%H:%M')
        end_time = event_end.strftime('%H:%M')
        if (
            planner_item.get('startTime') == start_time
            and planner_item.get('endTime') == end_time
        ):
            continue
        planner_item['startTime'] = start_time
        planner_item['endTime'] = end_time
        planner_item['durationMinutes'] = max(1, int((event_end - event_start).total_seconds() // 60))
        changed_dates.add(plan_date)

    return {
        'days': reconciled_days,
        'changedDates': sorted(changed_dates),
        'movedAcrossDates': moved_across_dates,
        'dateCorrectionEventIds': date_correction_event_ids,
    }


def normalize_external_google_events(events, target_timezone, start_date, end_date, hidden_event_ids=None):
    hidden_ids = {str(event_id) for event_id in (hidden_event_ids or [])}
    normalized = []
    for raw_event in events or []:
        event_id = str((raw_event or {}).get('id') or '').strip()
        calendar_id = str((raw_event or {}).get('_ipkpCalendarId') or 'primary').strip()
        calendar_name = str((raw_event or {}).get('_ipkpCalendarName') or 'Google Calendar').strip()[:120]
        calendar_color = str((raw_event or {}).get('_ipkpCalendarColor') or '').strip()[:32]
        external_event_id = f'{calendar_id}::{event_id}'
        private_properties = (((raw_event or {}).get('extendedProperties') or {}).get('private') or {})
        if (
            not event_id
            or event_id in hidden_ids
            or external_event_id in hidden_ids
            or (raw_event or {}).get('status') == 'cancelled'
            or str(private_properties.get('ipkpManaged') or '').lower() == 'true'
        ):
            continue
        planner_event_id = hashlib.sha256(external_event_id.encode('utf-8')).hexdigest()[:24]
        title = str((raw_event or {}).get('summary') or 'Busy').strip()[:120]
        start_payload = (raw_event or {}).get('start') or {}
        end_payload = (raw_event or {}).get('end') or {}
        html_link = str((raw_event or {}).get('htmlLink') or '').strip()[:1000]
        location = str((raw_event or {}).get('location') or '').strip()[:180]

        if start_payload.get('date'):
            try:
                first_date = date.fromisoformat(start_payload['date'])
                exclusive_end = date.fromisoformat(end_payload.get('date') or start_payload['date'])
            except ValueError:
                continue
            cursor = max(first_date, start_date)
            final_date = min(exclusive_end - timedelta(days=1), end_date)
            while cursor <= final_date:
                normalized.append({
                    'id': f'google-{planner_event_id}-{cursor.isoformat()}',
                    'googleEventId': external_event_id,
                    'googleRawEventId': event_id,
                    'googleCalendarId': calendar_id,
                    'googleCalendarName': calendar_name,
                    'googleCalendarColor': calendar_color,
                    'title': title,
                    'itemType': 'google',
                    'habitIndex': -1,
                    'date': cursor.isoformat(),
                    'startTime': '06:00',
                    'endTime': '07:00',
                    'durationMinutes': 60,
                    'locked': True,
                    'allowOverlap': False,
                    'reason': 'All-day Google Calendar event',
                    'source': 'google-calendar',
                    'external': True,
                    'allDay': True,
                    'htmlLink': html_link,
                    'location': location,
                })
                cursor += timedelta(days=1)
            continue

        try:
            event_start = _parse_google_datetime(start_payload.get('dateTime'), target_timezone)
            event_end = _parse_google_datetime(end_payload.get('dateTime'), target_timezone)
        except (TypeError, ValueError):
            continue
        if event_end <= event_start:
            continue
        cursor = max(event_start.date(), start_date)
        final_date = min(event_end.date(), end_date)
        while cursor <= final_date:
            display_start = datetime.combine(cursor, GOOGLE_DAY_START, tzinfo=target_timezone)
            display_end = datetime.combine(cursor, GOOGLE_DAY_END, tzinfo=target_timezone)
            segment_start = max(event_start, display_start)
            segment_end = min(event_end, display_end)
            if segment_end > segment_start:
                normalized.append({
                    'id': f'google-{planner_event_id}-{cursor.isoformat()}',
                    'googleEventId': external_event_id,
                    'googleRawEventId': event_id,
                    'googleCalendarId': calendar_id,
                    'googleCalendarName': calendar_name,
                    'googleCalendarColor': calendar_color,
                    'title': title,
                    'itemType': 'google',
                    'habitIndex': -1,
                    'date': cursor.isoformat(),
                    'startTime': segment_start.strftime('%H:%M'),
                    'endTime': segment_end.strftime('%H:%M'),
                    'durationMinutes': max(1, int((segment_end - segment_start).total_seconds() // 60)),
                    'locked': True,
                    'allowOverlap': False,
                    'reason': location or 'Google Calendar event',
                    'source': 'google-calendar',
                    'external': True,
                    'allDay': False,
                    'htmlLink': html_link,
                    'location': location,
                })
            cursor += timedelta(days=1)
    return sorted(normalized, key=lambda item: (item['date'], item['startTime'], item['title'].lower()))
