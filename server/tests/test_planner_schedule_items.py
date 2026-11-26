import unittest

from routes import groups as groups_routes


class PlannerScheduleItemTests(unittest.TestCase):
    def test_recurring_reminder_keeps_its_creation_date(self):
        reminders = groups_routes._normalize_recurring_reminders([{
            'id': 'personal-123',
            'title': 'Pack school bag',
            'startTime': '20:00',
            'endTime': '20:15',
            'weekdays': ['Monday', 'Tuesday'],
            'createdDate': '2026-08-06',
        }], default_created_date='2026-08-10')

        self.assertEqual(reminders[0]['createdDate'], '2026-08-06')

    def test_legacy_recurring_reminder_starts_on_normalization_date(self):
        reminders = groups_routes._normalize_recurring_reminders([{
            'id': 'personal-legacy',
            'title': 'Prepare uniform',
            'startTime': '19:30',
            'endTime': '19:45',
            'weekdays': ['Sunday'],
        }], default_created_date='2026-08-06')

        self.assertEqual(reminders[0]['createdDate'], '2026-08-06')

    def test_routine_override_remains_moveable_and_keeps_its_reminder_id(self):
        items = groups_routes._normalize_saved_schedule_items([{
            'id': 'routine-personal-123',
            'routineId': 'personal-123',
            'title': 'Leave for school',
            'itemType': 'routine',
            'startTime': '08:15',
            'endTime': '08:30',
            'routineOverride': True,
            'source': 'routine-override',
        }])

        self.assertEqual(items[0]['routineId'], 'personal-123')
        self.assertTrue(items[0]['routineOverride'])
        self.assertEqual(items[0]['source'], 'routine-override')
        self.assertFalse(items[0]['locked'])

    def test_regular_routine_item_remains_locked(self):
        items = groups_routes._normalize_saved_schedule_items([{
            'id': 'routine-personal-123',
            'routineId': 'personal-123',
            'title': 'Leave for school',
            'itemType': 'routine',
            'startTime': '08:00',
            'endTime': '08:15',
            'source': 'routine',
        }])

        self.assertFalse(items[0]['routineOverride'])
        self.assertTrue(items[0]['locked'])


if __name__ == '__main__':
    unittest.main()
