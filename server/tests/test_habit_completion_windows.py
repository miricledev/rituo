import unittest
from datetime import date, datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from routes import groups as groups_routes
from utils.habit_completion import (
    build_completion_window_access,
    build_default_habit_schedule_items,
    normalize_habit_schedule_items,
)


class HabitCompletionWindowTests(unittest.TestCase):
    def setUp(self):
        self.timezone = ZoneInfo('Europe/London')
        self.plan_date = date(2026, 8, 6)
        self.schedule_items = [{
            'itemType': 'habit',
            'habitIndex': 0,
            'startTime': '17:00',
            'endTime': '17:15',
        }]

    def access_at(self, hour, minute):
        return build_completion_window_access(
            self.plan_date,
            self.schedule_items,
            datetime(2026, 8, 6, hour, minute, tzinfo=self.timezone),
            timezone_name='Europe/London',
        )

    def test_window_opens_one_hour_before_start(self):
        self.assertFalse(self.access_at(15, 59)['canComplete'])
        self.assertEqual(self.access_at(15, 59)['status'], 'upcoming')
        self.assertTrue(self.access_at(16, 0)['canComplete'])

    def test_window_closes_one_hour_after_end(self):
        self.assertTrue(self.access_at(18, 15)['canComplete'])
        self.assertFalse(self.access_at(18, 16)['canComplete'])
        self.assertEqual(self.access_at(18, 16)['status'], 'closed')

    def test_occurrence_closed_before_challenge_activation_is_exempt(self):
        access = build_completion_window_access(
            self.plan_date,
            [{
                'itemType': 'habit',
                'habitIndex': 0,
                'startTime': '07:00',
                'endTime': '07:15',
            }],
            datetime(2026, 8, 6, 21, 52, tzinfo=self.timezone),
            timezone_name='Europe/London',
            eligible_after=datetime(2026, 8, 6, 21, 52, tzinfo=self.timezone),
        )

        self.assertEqual(access['status'], 'not-applicable')
        self.assertEqual(access['eligibleOccurrenceCount'], 0)
        self.assertEqual(access['exemptOccurrenceCount'], 1)

    def test_occurrence_scheduled_before_activation_is_exempt_while_window_is_open(self):
        peru_timezone = ZoneInfo('America/Lima')
        access = build_completion_window_access(
            date(2026, 8, 6),
            [{'startTime': '21:45', 'endTime': '22:00'}],
            datetime(2026, 8, 6, 21, 52, tzinfo=peru_timezone),
            timezone_name='America/Lima',
            eligible_after=datetime(2026, 8, 6, 21, 52, tzinfo=peru_timezone),
        )

        self.assertEqual(access['status'], 'not-applicable')
        self.assertEqual(access['eligibleOccurrenceCount'], 0)
        self.assertEqual(access['exemptOccurrenceCount'], 1)
        self.assertFalse(access['canComplete'])

    def test_late_start_periodic_habit_counts_only_remaining_occurrences(self):
        access = build_completion_window_access(
            self.plan_date,
            [
                {'startTime': '07:00', 'endTime': '07:05'},
                {'startTime': '14:00', 'endTime': '14:05'},
                {'startTime': '22:30', 'endTime': '22:35'},
            ],
            datetime(2026, 8, 6, 21, 52, tzinfo=self.timezone),
            timezone_name='Europe/London',
            periodic=True,
            eligible_after=datetime(2026, 8, 6, 21, 52, tzinfo=self.timezone),
        )

        self.assertEqual(access['status'], 'open')
        self.assertEqual(access['activeOccurrenceIndex'], 2)
        self.assertEqual(access['eligibleOccurrenceIndexes'], [2])
        self.assertEqual(access['eligibleOccurrenceCount'], 1)

    def test_naive_utc_creation_time_converts_to_member_device_timezone(self):
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 8),
            created_at=datetime(2026, 8, 9, 2, 52),
        )
        activation = groups_routes._challenge_activation_at(
            challenge,
            {'joinedAt': '2026-08-08'},
            ZoneInfo('America/Lima'),
        )

        self.assertEqual(activation.isoformat(), '2026-08-08T21:52:00-05:00')

    def test_saved_planner_time_overrides_habit_default(self):
        habit = {'durationMinutes': 30, 'scheduleTime': '09:00'}
        items = normalize_habit_schedule_items(self.schedule_items, habit, 0)

        self.assertEqual(items[0]['startTime'], '17:00')
        self.assertEqual(items[0]['endTime'], '17:15')

    def test_periodic_occurrence_can_only_be_logged_once(self):
        periodic_items = [
            {'itemType': 'habit', 'habitIndex': 0, 'startTime': '08:30', 'endTime': '08:35'},
            {'itemType': 'habit', 'habitIndex': 0, 'startTime': '12:00', 'endTime': '12:05'},
            {'itemType': 'habit', 'habitIndex': 0, 'startTime': '16:00', 'endTime': '16:05'},
            {'itemType': 'habit', 'habitIndex': 0, 'startTime': '20:00', 'endTime': '20:05'},
        ]
        first_log = build_completion_window_access(
            self.plan_date,
            periodic_items,
            datetime(2026, 8, 6, 8, 30, tzinfo=self.timezone),
            periodic=True,
        )
        duplicate_log = build_completion_window_access(
            self.plan_date,
            periodic_items,
            datetime(2026, 8, 6, 8, 30, tzinfo=self.timezone),
            periodic=True,
            logged_occurrence_indexes=[0],
        )

        self.assertEqual(first_log['activeOccurrenceIndex'], 0)
        self.assertTrue(first_log['canComplete'])
        self.assertFalse(duplicate_log['canComplete'])
        self.assertEqual(duplicate_log['status'], 'upcoming')

    def test_periodic_defaults_create_separate_occurrences(self):
        items = build_default_habit_schedule_items({
            'habitType': 'periodic',
            'scheduleTime': '08:30',
            'durationMinutes': 5,
            'periodicOccurrences': 4,
            'periodicIntervalHours': 4,
        }, 0)

        self.assertEqual([item['startTime'] for item in items], ['08:30', '12:30', '16:30', '20:30'])
        self.assertEqual([item['occurrenceIndex'] for item in items], [0, 1, 2, 3])

    def test_same_day_schedule_freezes_when_completion_window_opens(self):
        group = SimpleNamespace(
            id=1,
            school_day_config={'timezone': 'Europe/London'},
            active_challenge=SimpleNamespace(member_habits=[{
                'member': 7,
                'habits': [{
                    'name': 'Focused reading',
                    'habitType': 'boolean',
                    'scheduleDays': ['Thursday'],
                    'durationMinutes': 15,
                    'progress': [],
                }],
            }]),
        )
        existing_plan = SimpleNamespace(plan_date=self.plan_date, items=self.schedule_items)
        existing_settings = SimpleNamespace(
            timezone_name='Europe/London',
            ai_weekly_templates={},
        )
        proposed_items = [{
            'itemType': 'habit',
            'habitIndex': 0,
            'startTime': '22:00',
            'endTime': '22:15',
        }]

        before_window = groups_routes._validate_same_day_habit_schedule_changes(
            group,
            7,
            self.plan_date,
            proposed_items,
            existing_plan=existing_plan,
            existing_settings=existing_settings,
            now=datetime(2026, 8, 6, 15, 59, tzinfo=self.timezone),
        )
        after_window_opens = groups_routes._validate_same_day_habit_schedule_changes(
            group,
            7,
            self.plan_date,
            proposed_items,
            existing_plan=existing_plan,
            existing_settings=existing_settings,
            now=datetime(2026, 8, 6, 16, 0, tzinfo=self.timezone),
        )

        self.assertIsNone(before_window)
        self.assertIn('can no longer be rescheduled today', after_window_opens)

    def test_same_day_habit_cannot_be_moved_before_challenge_activation_to_escape_it(self):
        group = SimpleNamespace(
            id=1,
            school_day_config={'timezone': 'Europe/London'},
            active_challenge=SimpleNamespace(
                start_date=datetime(2026, 8, 6),
                created_at=datetime(2026, 8, 6, 14, 0),
                member_habits=[{
                    'member': 7,
                    'joinedAt': '2026-08-06',
                    'habits': [{
                        'name': 'Evening training',
                        'habitType': 'boolean',
                        'scheduleDays': ['Thursday'],
                        'durationMinutes': 15,
                        'progress': [],
                    }],
                }],
            ),
        )
        existing_plan = SimpleNamespace(
            plan_date=self.plan_date,
            items=[{'itemType': 'habit', 'habitIndex': 0, 'startTime': '18:00', 'endTime': '18:15'}],
        )
        settings = SimpleNamespace(timezone_name='Europe/London', ai_weekly_templates={})
        proposed_items = [{'itemType': 'habit', 'habitIndex': 0, 'startTime': '07:00', 'endTime': '07:15'}]

        error = groups_routes._validate_same_day_habit_schedule_changes(
            group,
            7,
            self.plan_date,
            proposed_items,
            existing_plan=existing_plan,
            existing_settings=settings,
            now=datetime(2026, 8, 6, 15, 10, tzinfo=self.timezone),
        )

        self.assertIn('cannot be moved before the challenge began', error)

    def test_student_device_timezone_controls_completion_window(self):
        habit = {
            'name': 'Evening focus',
            'habitType': 'boolean',
            'scheduleDays': ['Thursday'],
            'durationMinutes': 15,
            'progress': [],
        }
        group = SimpleNamespace(
            id=2,
            school_day_config={'timezone': 'Europe/London'},
            active_challenge=SimpleNamespace(member_habits=[{
                'member': 8,
                'habits': [habit],
            }]),
        )
        plan = SimpleNamespace(
            plan_date=self.plan_date,
            items=[{
                'itemType': 'habit',
                'habitIndex': 0,
                'startTime': '17:15',
                'endTime': '17:30',
            }],
        )
        settings = SimpleNamespace(
            timezone_name='America/Lima',
            ai_weekly_templates={},
        )
        peru_timezone = ZoneInfo('America/Lima')

        before_window = groups_routes._habit_completion_access(
            group,
            8,
            habit,
            0,
            now=datetime(2026, 8, 6, 11, 57, tzinfo=peru_timezone),
            preferred_date=self.plan_date,
            plan=plan,
            settings=settings,
        )
        window_open = groups_routes._habit_completion_access(
            group,
            8,
            habit,
            0,
            now=datetime(2026, 8, 6, 16, 15, tzinfo=peru_timezone),
            preferred_date=self.plan_date,
            plan=plan,
            settings=settings,
        )

        self.assertEqual(before_window['timezone'], 'America/Lima')
        self.assertEqual(before_window['status'], 'upcoming')
        self.assertFalse(before_window['canComplete'])
        self.assertEqual(window_open['status'], 'open')
        self.assertTrue(window_open['canComplete'])


if __name__ == '__main__':
    unittest.main()
