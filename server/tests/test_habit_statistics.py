import unittest
from datetime import date, datetime
from types import SimpleNamespace

from utils.habit_statistics import (
    build_member_habit_statistics,
    habit_progress_fraction,
    periodic_progress_counts,
)


class HabitStatisticsTests(unittest.TestCase):
    def test_periodic_three_of_four_scores_seventy_five_percent(self):
        habit = {'habitType': 'periodic', 'periodicOccurrences': 4}
        progress = {'completed': False, 'periodicCompleted': 3, 'periodicTarget': 4}

        self.assertEqual(periodic_progress_counts(habit, progress), (3, 4))
        self.assertEqual(habit_progress_fraction(habit, progress), 0.75)

    def test_periodic_historical_target_is_preserved(self):
        habit = {'habitType': 'periodic', 'periodicOccurrences': 6}
        progress = {'completed': False, 'periodicCompleted': 3, 'periodicTarget': 4}

        self.assertEqual(habit_progress_fraction(habit, progress), 0.75)

    def test_legacy_periodic_completion_without_counts_scores_full(self):
        habit = {'habitType': 'periodic', 'periodicOccurrences': 4}

        self.assertEqual(habit_progress_fraction(habit, {'completed': True}), 1.0)

    def test_numeric_habit_uses_range_progress(self):
        habit = {'habitType': 'numeric', 'minValue': 0, 'maxValue': 10}

        self.assertEqual(habit_progress_fraction(habit, {'completed': True, 'numericValue': 5}), 0.5)

    def test_member_statistics_respect_join_date_schedule_and_partial_progress(self):
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 1),
            end_date=datetime(2026, 8, 7),
        )
        member_habit = {
            'joinedAt': '2026-08-03',
            'habits': [{
                'name': 'Drink water',
                'habitType': 'periodic',
                'combatType': 'defence',
                'periodicOccurrences': 4,
                'scheduleDays': ['Monday', 'Wednesday', 'Friday'],
                'progress': [
                    {'date': '2026-08-03', 'completed': False, 'periodicCompleted': 3, 'periodicTarget': 4},
                    {'date': '2026-08-05', 'completed': True, 'periodicCompleted': 4, 'periodicTarget': 4},
                ],
            }],
        }

        stats = build_member_habit_statistics(challenge, member_habit, today_value=date(2026, 8, 7))

        self.assertEqual(stats['challenge']['startDate'], '2026-08-03')
        self.assertEqual(stats['summary']['possibleUnits'], 3)
        self.assertEqual(stats['summary']['earnedUnits'], 1.75)
        self.assertEqual(stats['summary']['completionRate'], 58.3)
        self.assertEqual(stats['summary']['partialCount'], 1)
        self.assertEqual(stats['summary']['periodicCompleted'], 7)
        self.assertEqual(stats['summary']['periodicTarget'], 12)

    def test_pending_today_does_not_break_existing_streak(self):
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 3),
            end_date=datetime(2026, 8, 7),
            status='active',
        )
        member_habit = {
            'joinedAt': '2026-08-03',
            'habits': [{
                'name': 'Read',
                'habitType': 'boolean',
                'scheduleDays': [],
                'progress': [
                    {'date': '2026-08-03', 'completed': True},
                    {'date': '2026-08-04', 'completed': True},
                    {'date': '2026-08-05', 'completed': True},
                    {'date': '2026-08-06', 'completed': True},
                ],
            }],
        }

        stats = build_member_habit_statistics(challenge, member_habit, today_value=date(2026, 8, 7))

        self.assertEqual(stats['habits'][0]['currentFullStreak'], 4)
        self.assertEqual(stats['summary']['currentPerfectStreak'], 4)
        self.assertEqual(stats['habits'][0]['missedCount'], 0)
        self.assertEqual(stats['habits'][0]['pendingCount'], 1)
        self.assertEqual(stats['summary']['missedDays'], 0)
        self.assertEqual(stats['summary']['pendingDays'], 1)

    def test_streak_restore_preserves_streak_but_keeps_missed_statistics(self):
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 3),
            end_date=datetime(2026, 8, 8),
            status='active',
        )
        member_habit = {
            'joinedAt': '2026-08-03',
            'habits': [{
                'name': 'Read',
                'habitType': 'boolean',
                'scheduleDays': [],
                'progress': [
                    {'date': '2026-08-03', 'completed': True},
                    {'date': '2026-08-04', 'completed': True},
                    {'date': '2026-08-05', 'completed': False, 'streakRestored': True, 'streakRestoreCost': 2},
                    {'date': '2026-08-06', 'completed': True},
                    {'date': '2026-08-07', 'completed': True},
                ],
            }],
        }

        stats = build_member_habit_statistics(challenge, member_habit, today_value=date(2026, 8, 8))
        habit = stats['habits'][0]

        self.assertEqual(habit['currentFullStreak'], 4)
        self.assertEqual(habit['longestFullStreak'], 4)
        self.assertEqual(habit['missedCount'], 1)
        self.assertTrue(habit['dailyData'][2]['streakRestored'])
        self.assertEqual(habit['dailyData'][2]['streakRestoreCost'], 2)

    def test_admin_correction_is_visible_in_daily_audit_data(self):
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 3),
            end_date=datetime(2026, 8, 3),
            status='completed',
        )
        member_habit = {
            'joinedAt': '2026-08-03',
            'habits': [{
                'name': 'Read',
                'habitType': 'boolean',
                'scheduleDays': [],
                'progress': [{
                    'date': '2026-08-03',
                    'completed': True,
                    'adminCorrections': [{
                        'actorId': 4,
                        'actorName': 'School Admin',
                        'correctedAt': '2026-08-03T18:00:00+00:00',
                        'reason': 'Verified from the student workbook.',
                    }],
                }],
            }],
        }

        stats = build_member_habit_statistics(challenge, member_habit, today_value=date(2026, 8, 3))
        day = stats['habits'][0]['dailyData'][0]

        self.assertTrue(day['adminCorrected'])
        self.assertEqual(day['adminCorrection']['actorName'], 'School Admin')
        self.assertEqual(day['adminCorrection']['reason'], 'Verified from the student workbook.')

    def test_first_day_exempts_habits_before_activation_and_reduces_periodic_target(self):
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 8),
            end_date=datetime(2026, 8, 10),
            status='active',
        )
        member_habit = {
            'joinedAt': '2026-08-08T21:52:00-05:00',
            'habits': [
                {
                    'name': 'Morning routine',
                    'habitType': 'boolean',
                    'scheduleDays': [],
                    'progress': [],
                },
                {
                    'name': 'Drink water',
                    'habitType': 'periodic',
                    'periodicOccurrences': 4,
                    'scheduleDays': [],
                    'progress': [],
                },
            ],
        }
        first_day_eligibility = {
            'date': '2026-08-08',
            'habits': {
                '0': {'eligibleOccurrenceCount': 0},
                '1': {'eligibleOccurrenceCount': 1},
            },
        }

        stats = build_member_habit_statistics(
            challenge,
            member_habit,
            today_value=date(2026, 8, 8),
            first_day_eligibility=first_day_eligibility,
        )

        self.assertEqual(stats['habits'][0]['possibleUnits'], 0)
        self.assertEqual(stats['habits'][0]['missedCount'], 0)
        self.assertEqual(stats['habits'][1]['possibleUnits'], 1)
        self.assertEqual(stats['habits'][1]['periodicTarget'], 1)
        self.assertEqual(stats['habits'][1]['pendingCount'], 1)
        self.assertEqual(stats['summary']['possibleUnits'], 1)
        self.assertEqual(stats['summary']['missedCount'], 0)

    def test_missed_final_day_breaks_completed_challenge_streak(self):
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 3),
            end_date=datetime(2026, 8, 7),
            status='completed',
        )
        member_habit = {
            'joinedAt': '2026-08-03',
            'habits': [{
                'name': 'Read',
                'habitType': 'boolean',
                'scheduleDays': [],
                'progress': [
                    {'date': '2026-08-03', 'completed': True},
                    {'date': '2026-08-04', 'completed': True},
                    {'date': '2026-08-05', 'completed': True},
                    {'date': '2026-08-06', 'completed': True},
                ],
            }],
        }

        stats = build_member_habit_statistics(challenge, member_habit, today_value=date(2026, 8, 7))

        self.assertFalse(stats['challenge']['todayIsLive'])
        self.assertEqual(stats['habits'][0]['currentFullStreak'], 0)
        self.assertEqual(stats['summary']['currentPerfectStreak'], 0)
        self.assertEqual(stats['habits'][0]['missedCount'], 1)
        self.assertEqual(stats['summary']['missedDays'], 1)


if __name__ == '__main__':
    unittest.main()
