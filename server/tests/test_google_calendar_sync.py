import unittest
from datetime import date
from zoneinfo import ZoneInfo

from utils.google_calendar import build_google_challenge_horizon_days, build_managed_google_events, normalize_external_google_events, reconcile_managed_google_events


class GoogleCalendarSyncTests(unittest.TestCase):
    def test_challenge_horizon_builds_future_scheduled_habits(self):
        days = build_google_challenge_horizon_days(
            [{'date': '2026-08-09', 'items': []}],
            [{
                'name': 'Weekday study',
                'habitType': 'boolean',
                'scheduleDays': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                'scheduleTime': '17:00',
                'durationMinutes': 30,
            }],
            [],
            [],
            {},
            date(2026, 8, 8),
            date(2026, 9, 4),
            date(2026, 8, 9),
            horizon_days=7,
        )

        future_days = {day['date']: day['items'] for day in days}
        self.assertIn('2026-08-10', future_days)
        self.assertEqual(future_days['2026-08-10'][0]['title'], 'Weekday study')
        self.assertEqual(future_days['2026-08-15'], [])

    def test_managed_events_are_stable_and_include_popup_reminders(self):
        days = [{
            'date': '2026-08-10',
            'items': [
                {
                    'id': 'habit-2-0',
                    'title': 'Drink 400 ml of water',
                    'itemType': 'habit',
                    'startTime': '08:00',
                    'endTime': '08:05',
                },
                {
                    'id': 'routine-school-bag',
                    'title': 'Pack school bag',
                    'itemType': 'routine',
                    'startTime': '20:00',
                    'endTime': '20:15',
                },
                {
                    'id': 'sleep-evening',
                    'title': 'Sleep',
                    'itemType': 'sleep',
                    'startTime': '22:00',
                    'endTime': '23:00',
                },
                {
                    'id': 'google-external',
                    'title': 'External event',
                    'itemType': 'google',
                    'source': 'google-calendar',
                    'startTime': '12:00',
                    'endTime': '13:00',
                },
            ],
        }]

        first = build_managed_google_events(7, 12, days, 'Europe/London')
        second = build_managed_google_events(7, 12, days, 'Europe/London')

        self.assertEqual(len(first), 2)
        self.assertEqual([event['id'] for event in first], [event['id'] for event in second])
        self.assertTrue(all(event['id'].startswith('ipkp') for event in first))
        habit = first[0]['payload']
        self.assertEqual(habit['reminders']['overrides'], [{'method': 'popup', 'minutes': 10}])
        self.assertEqual(habit['extendedProperties']['private']['ipkpManaged'], 'true')
        self.assertEqual(habit['extendedProperties']['private']['ipkpItemType'], 'habit')

    def test_external_events_convert_to_planner_timezone_and_filter_hidden_or_managed(self):
        events = [
            {
                'id': 'external-1',
                'summary': 'Gym session',
                'start': {'dateTime': '2026-08-10T20:00:00Z'},
                'end': {'dateTime': '2026-08-10T21:00:00Z'},
                'htmlLink': 'https://calendar.google.com/event?eid=external-1',
            },
            {
                'id': 'hidden-1',
                'summary': 'Hidden appointment',
                'start': {'dateTime': '2026-08-10T12:00:00Z'},
                'end': {'dateTime': '2026-08-10T13:00:00Z'},
            },
            {
                'id': 'managed-1',
                'summary': 'IP habit duplicate',
                'start': {'dateTime': '2026-08-10T15:00:00Z'},
                'end': {'dateTime': '2026-08-10T15:30:00Z'},
                'extendedProperties': {'private': {'ipkpManaged': 'true'}},
            },
        ]

        normalized = normalize_external_google_events(
            events,
            ZoneInfo('America/Bogota'),
            date(2026, 8, 10),
            date(2026, 8, 10),
            ['hidden-1'],
        )

        self.assertEqual(len(normalized), 1)
        self.assertEqual(normalized[0]['googleEventId'], 'primary::external-1')
        self.assertEqual(normalized[0]['startTime'], '15:00')
        self.assertEqual(normalized[0]['endTime'], '16:00')
        self.assertTrue(normalized[0]['locked'])
        self.assertEqual(normalized[0]['itemType'], 'google')

    def test_all_day_google_event_appears_on_each_covered_day(self):
        normalized = normalize_external_google_events(
            [{
                'id': 'all-day-1',
                'summary': 'Tournament',
                'start': {'date': '2026-08-10'},
                'end': {'date': '2026-08-12'},
            }],
            ZoneInfo('Europe/London'),
            date(2026, 8, 10),
            date(2026, 8, 16),
        )

        self.assertEqual([event['date'] for event in normalized], ['2026-08-10', '2026-08-11'])
        self.assertTrue(all(event['allDay'] for event in normalized))

    def test_same_event_id_from_different_calendars_stays_distinct(self):
        event = {
            'id': 'shared-event-id',
            'summary': 'Lesson',
            'start': {'dateTime': '2026-08-10T15:00:00+01:00'},
            'end': {'dateTime': '2026-08-10T16:00:00+01:00'},
        }
        normalized = normalize_external_google_events(
            [
                {**event, '_ipkpCalendarId': 'primary@example.com', '_ipkpCalendarName': 'Hans K'},
                {**event, '_ipkpCalendarId': 'teaching@example.com', '_ipkpCalendarName': 'Teaching'},
            ],
            ZoneInfo('Europe/London'),
            date(2026, 8, 10),
            date(2026, 8, 10),
        )

        self.assertEqual(len(normalized), 2)
        self.assertEqual(len({item['id'] for item in normalized}), 2)
        self.assertEqual(
            {item['googleEventId'] for item in normalized},
            {'primary@example.com::shared-event-id', 'teaching@example.com::shared-event-id'},
        )
        self.assertEqual({item['googleCalendarName'] for item in normalized}, {'Hans K', 'Teaching'})

    def test_google_managed_event_time_updates_matching_ip_item(self):
        days = [{
            'date': '2026-08-10',
            'constraintsText': '',
            'items': [{
                'id': 'habit-2-0',
                'title': 'Meditate',
                'itemType': 'habit',
                'habitIndex': 2,
                'startTime': '08:00',
                'endTime': '08:15',
                'durationMinutes': 15,
            }],
        }]
        events = [{
            'id': 'ipkp-event',
            'start': {'dateTime': '2026-08-10T09:30:00+01:00'},
            'end': {'dateTime': '2026-08-10T09:45:00+01:00'},
            'extendedProperties': {'private': {
                'ipkpManaged': 'true',
                'ipkpPlannerKey': '7:12:2026-08-10:habit-2-0',
            }},
        }]

        result = reconcile_managed_google_events(7, 12, days, events, ZoneInfo('Europe/London'))

        self.assertEqual(result['changedDates'], ['2026-08-10'])
        self.assertEqual(result['days'][0]['items'][0]['startTime'], '09:30')
        self.assertEqual(result['days'][0]['items'][0]['endTime'], '09:45')
        self.assertEqual(days[0]['items'][0]['startTime'], '08:00')

    def test_google_date_move_keeps_habit_on_assigned_ip_day(self):
        days = [{
            'date': '2026-08-10',
            'items': [{
                'id': 'habit-0-0',
                'title': 'Train',
                'startTime': '17:00',
                'endTime': '18:00',
            }],
        }]
        events = [{
            'id': 'ipkp-cross-date',
            'start': {'dateTime': '2026-08-11T19:00:00+01:00'},
            'end': {'dateTime': '2026-08-11T20:00:00+01:00'},
            'extendedProperties': {'private': {
                'ipkpManaged': 'true',
                'ipkpPlannerKey': '7:12:2026-08-10:habit-0-0',
            }},
        }]

        result = reconcile_managed_google_events(7, 12, days, events, ZoneInfo('Europe/London'))

        self.assertEqual(result['changedDates'], ['2026-08-10'])
        self.assertEqual(result['movedAcrossDates'], 1)
        self.assertEqual(result['dateCorrectionEventIds'], ['ipkp-cross-date'])
        self.assertEqual(result['days'][0]['items'][0]['startTime'], '19:00')


if __name__ == '__main__':
    unittest.main()
