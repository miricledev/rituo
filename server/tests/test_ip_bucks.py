import unittest
from datetime import date, datetime
from types import SimpleNamespace

from routes.groups import (
    _apply_admin_habit_correction,
    _habit_streak_awards_for_challenge,
    _habit_streak_restore_quote,
    _ip_bucks_for_streak,
    _ip_bucks_streak_restore_cost,
    _ip_shop_catalog_for_group,
    _normalize_ip_avatar,
)


class IpBucksTests(unittest.TestCase):
    def test_admin_boolean_correction_requires_explicit_result(self):
        progress = {'date': '2026-08-10', 'completed': False}

        with self.assertRaisesRegex(ValueError, 'Choose whether'):
            _apply_admin_habit_correction({'habitType': 'boolean'}, progress, {})

        result = _apply_admin_habit_correction({'habitType': 'boolean'}, progress, {'completed': True})
        self.assertTrue(progress['completed'])
        self.assertEqual(result['progressPercent'], 100)

    def test_admin_numeric_correction_uses_configured_target(self):
        habit = {'habitType': 'numeric', 'minValue': 0, 'maxValue': 10}
        progress = {'date': '2026-08-10', 'completed': False}

        partial = _apply_admin_habit_correction(habit, progress, {'numericValue': 7})
        self.assertFalse(progress['completed'])
        self.assertEqual(partial['progressPercent'], 70)

        complete = _apply_admin_habit_correction(habit, progress, {'numericValue': 10})
        self.assertTrue(progress['completed'])
        self.assertEqual(complete['progressPercent'], 100)

        with self.assertRaisesRegex(ValueError, 'between 0 and 10'):
            _apply_admin_habit_correction(habit, progress, {'numericValue': 11})

    def test_admin_periodic_correction_preserves_partial_credit(self):
        habit = {'habitType': 'periodic', 'periodicOccurrences': 5}
        progress = {'date': '2026-08-10', 'completed': False}

        result = _apply_admin_habit_correction(
            habit,
            progress,
            {'periodicCompleted': 3},
            periodic_target_override=5,
        )

        self.assertFalse(progress['completed'])
        self.assertEqual(progress['periodicLoggedOccurrences'], [0, 1, 2])
        self.assertEqual(result['progressPercent'], 60)

        with self.assertRaisesRegex(ValueError, 'between 0 and 2'):
            _apply_admin_habit_correction(
                habit,
                progress,
                {'periodicCompleted': 3},
                periodic_target_override=5,
                periodic_max_completed=2,
            )

    def test_admin_text_correction_requires_verified_evidence(self):
        habit = {'habitType': 'text'}
        progress = {'date': '2026-08-10', 'completed': False}

        with self.assertRaisesRegex(ValueError, 'written response'):
            _apply_admin_habit_correction(habit, progress, {'textValue': '  '})

        result = _apply_admin_habit_correction(habit, progress, {'textValue': 'Verified verbally with the student.'})
        self.assertTrue(progress['completed'])
        self.assertEqual(result['textValue'], 'Verified verbally with the student.')

        missed = _apply_admin_habit_correction(habit, progress, {'completed': False})
        self.assertFalse(progress['completed'])
        self.assertEqual(missed['textValue'], '')

    def test_fibonacci_rewards_start_on_second_completion(self):
        self.assertEqual([_ip_bucks_for_streak(streak) for streak in range(1, 8)], [0, 1, 2, 3, 5, 8, 13])

    def test_fibonacci_reward_is_capped_for_economy_safety(self):
        self.assertEqual(_ip_bucks_for_streak(10), 55)
        self.assertEqual(_ip_bucks_for_streak(25), 55)

    def test_streak_restore_price_rises_with_streak_value(self):
        self.assertEqual(
            [_ip_bucks_streak_restore_cost(streak) for streak in range(1, 8)],
            [1, 2, 3, 5, 8, 13, 21],
        )

    def test_restore_quote_requires_closed_incomplete_window_and_previous_streak(self):
        challenge = SimpleNamespace(start_date=datetime(2026, 8, 3))
        member_habit = {'joinedAt': '2026-08-03'}
        habit = {
            'habitType': 'periodic',
            'periodicOccurrences': 4,
            'scheduleDays': [],
            'progress': [
                {'date': '2026-08-03', 'completed': True, 'periodicCompleted': 4, 'periodicTarget': 4},
                {'date': '2026-08-04', 'completed': True, 'periodicCompleted': 4, 'periodicTarget': 4},
                {'date': '2026-08-05', 'completed': False, 'periodicCompleted': 3, 'periodicTarget': 4},
            ],
        }

        quote = _habit_streak_restore_quote(
            challenge,
            member_habit,
            habit,
            0,
            date(2026, 8, 5),
            {'status': 'closed', 'eligibleOccurrenceCount': 4},
        )

        self.assertTrue(quote['eligible'])
        self.assertEqual(quote['atRiskStreak'], 2)
        self.assertEqual(quote['cost'], 2)
        self.assertEqual(quote['progressPercent'], 75)

    def test_awards_follow_scheduled_occasions_not_calendar_days(self):
        challenge = SimpleNamespace(
            id=11,
            group_id=4,
            start_date=datetime(2026, 8, 3),
            end_date=datetime(2026, 8, 9),
            status='active',
        )
        member_habit = {
            'member': 7,
            'joinedAt': '2026-08-03',
            'habits': [{
                'name': 'Focused reading',
                'habitType': 'boolean',
                'scheduleDays': ['Monday', 'Wednesday', 'Friday'],
                'progress': [
                    {'date': '2026-08-03', 'completed': True},
                    {'date': '2026-08-05', 'completed': True},
                    {'date': '2026-08-07', 'completed': True},
                ],
            }],
        }

        awards = _habit_streak_awards_for_challenge(challenge, member_habit, 7, date(2026, 8, 7))

        self.assertEqual([award['amount'] for award in awards], [1, 2])
        self.assertEqual([award['streak'] for award in awards], [2, 3])

    def test_partial_periodic_day_breaks_full_completion_streak(self):
        challenge = SimpleNamespace(
            id=12,
            group_id=4,
            start_date=datetime(2026, 8, 3),
            end_date=datetime(2026, 8, 7),
            status='active',
        )
        member_habit = {
            'member': 7,
            'habits': [{
                'name': 'Drink water',
                'habitType': 'periodic',
                'periodicOccurrences': 4,
                'scheduleDays': [],
                'progress': [
                    {'date': '2026-08-03', 'completed': True, 'periodicCompleted': 4, 'periodicTarget': 4},
                    {'date': '2026-08-04', 'completed': False, 'periodicCompleted': 3, 'periodicTarget': 4},
                    {'date': '2026-08-05', 'completed': True, 'periodicCompleted': 4, 'periodicTarget': 4},
                    {'date': '2026-08-06', 'completed': True, 'periodicCompleted': 4, 'periodicTarget': 4},
                ],
            }],
        }

        awards = _habit_streak_awards_for_challenge(challenge, member_habit, 7, date(2026, 8, 6))

        self.assertEqual(len(awards), 1)
        self.assertEqual(awards[0]['date'], '2026-08-06')
        self.assertEqual(awards[0]['amount'], 1)

    def test_restored_miss_bridges_streak_without_earning_for_missed_day(self):
        challenge = SimpleNamespace(
            id=13,
            group_id=4,
            start_date=datetime(2026, 8, 3),
            end_date=datetime(2026, 8, 7),
            status='active',
        )
        member_habit = {
            'member': 7,
            'habits': [{
                'name': 'Focused reading',
                'habitType': 'boolean',
                'scheduleDays': [],
                'progress': [
                    {'date': '2026-08-03', 'completed': True},
                    {'date': '2026-08-04', 'completed': True},
                    {'date': '2026-08-05', 'completed': False, 'streakRestored': True, 'streakRestoreCost': 2},
                    {'date': '2026-08-06', 'completed': True},
                ],
            }],
        }

        awards = _habit_streak_awards_for_challenge(challenge, member_habit, 7, date(2026, 8, 6))

        self.assertEqual([award['date'] for award in awards], ['2026-08-04', '2026-08-06'])
        self.assertEqual([award['streak'] for award in awards], [2, 3])
        self.assertEqual([award['amount'] for award in awards], [1, 2])

    def test_avatar_cannot_equip_unowned_shop_items(self):
        avatar = _normalize_ip_avatar({
            'coreColor': 'cyan',
            'skinTone': 'deep-brown',
            'hairStyle': 'locs',
            'hairColor': 'midnight',
            'outfitStyle': 'varsity',
            'pose': 'confident',
            'expression': 'smile',
            'headwear': 'headwear-crown',
            'accessory': 'accessory-book',
        }, {'accessory-book'})

        self.assertEqual(avatar['coreColor'], 'cyan')
        self.assertEqual(avatar['skinTone'], 'deep-brown')
        self.assertEqual(avatar['hairStyle'], 'locs')
        self.assertEqual(avatar['hairColor'], 'midnight')
        self.assertEqual(avatar['outfitStyle'], 'varsity')
        self.assertEqual(avatar['pose'], 'confident')
        self.assertEqual(avatar['expression'], 'smile')
        self.assertEqual(avatar['headwear'], 'none')
        self.assertEqual(avatar['accessory'], 'accessory-book')

    def test_avatar_rejects_unknown_free_customisation_values(self):
        avatar = _normalize_ip_avatar({
            'skinTone': 'invalid',
            'hairStyle': 'invalid',
            'outfitStyle': 'invalid',
            'pose': 'invalid',
        }, set())

        self.assertEqual(avatar['skinTone'], 'warm-medium')
        self.assertEqual(avatar['hairStyle'], 'textured-crop')
        self.assertEqual(avatar['outfitStyle'], 'protocol-jacket')
        self.assertEqual(avatar['pose'], 'ready')

    def test_football_catalog_excludes_school_tools_and_renames_trainer(self):
        catalog = _ip_shop_catalog_for_group(SimpleNamespace(group_type='football'))
        catalog_by_id = {item['id']: item for item in catalog}

        self.assertNotIn('feature-study-planner-pro', catalog_by_id)
        self.assertNotIn('feature-gcse-spanish-tutor', catalog_by_id)
        self.assertNotIn('feature-gcse-french-tutor', catalog_by_id)
        self.assertEqual(catalog_by_id['feature-ai-fitness-coach']['name'], 'AI Personal Trainer')
        self.assertIn('outfit-ip-home-kit', catalog_by_id)
        self.assertTrue(catalog_by_id['feature-match-review']['comingSoon'])

    def test_football_avatar_requires_ownership_for_premium_kit(self):
        catalog = _ip_shop_catalog_for_group(SimpleNamespace(group_type='football'))
        locked_avatar = _normalize_ip_avatar(
            {'outfitStyle': 'outfit-ip-home-kit'},
            set(),
            catalog,
        )
        owned_avatar = _normalize_ip_avatar(
            {'outfitStyle': 'outfit-ip-home-kit'},
            {'outfit-ip-home-kit'},
            catalog,
        )

        self.assertEqual(locked_avatar['outfitStyle'], 'protocol-jacket')
        self.assertEqual(owned_avatar['outfitStyle'], 'outfit-ip-home-kit')

    def test_staff_catalog_contains_avatar_items_only(self):
        catalog = _ip_shop_catalog_for_group(SimpleNamespace(group_type='staff'))

        self.assertTrue(catalog)
        self.assertTrue(all(item['kind'] == 'avatar' for item in catalog))
        self.assertNotIn('feature-study-planner-pro', {item['id'] for item in catalog})

    def test_avatar_accepts_deeper_character_choices(self):
        avatar = _normalize_ip_avatar({
            'faceShape': 'angular',
            'eyeColor': 'green',
            'eyebrowStyle': 'arched',
            'facialHairStyle': 'short-beard',
            'glassesStyle': 'round',
            'bodyStyle': 'athletic',
        }, set())

        self.assertEqual(avatar['faceShape'], 'angular')
        self.assertEqual(avatar['eyeColor'], 'green')
        self.assertEqual(avatar['eyebrowStyle'], 'arched')
        self.assertEqual(avatar['facialHairStyle'], 'short-beard')
        self.assertEqual(avatar['glassesStyle'], 'round')
        self.assertEqual(avatar['bodyStyle'], 'athletic')


if __name__ == '__main__':
    unittest.main()
