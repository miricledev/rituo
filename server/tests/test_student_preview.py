import unittest
from datetime import timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flask import Flask

from routes import groups


class StudentPreviewTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)

    def test_non_admin_cannot_preview(self):
        group = SimpleNamespace(id=3)
        viewer = SimpleNamespace(is_active=True, account_role='teacher')
        with self.app.test_request_context():
            with patch.object(groups, 'Group') as group_model, patch.object(groups, 'User') as user_model, patch.object(groups, 'get_jwt_identity', return_value='4'):
                group_model.query.filter_by.return_value.first.return_value = group
                user_model.query.get.return_value = viewer
                response, status = groups.preview_student_workspace.__wrapped__('school', 8)
        self.assertEqual(status, 403)
        self.assertIn('administrators', response.get_json()['error'])

    def test_admin_preview_does_not_create_settings_or_sync_rewards(self):
        group = SimpleNamespace(id=3)
        viewer = SimpleNamespace(is_active=True, account_role='admin')
        student = SimpleNamespace(id=8, account_role='student')
        with self.app.test_request_context():
            with patch.object(groups, 'Group') as group_model, patch.object(groups, 'User') as user_model, patch.object(groups, 'get_jwt_identity', return_value='4'), patch.object(groups, 'can_manage_group', return_value=True), patch.object(groups, 'get_group_members_list', return_value=[student]), patch.object(groups, '_get_student_planner_settings', return_value=None) as get_settings, patch.object(groups, '_build_student_rewards', return_value={'economy': {}}) as build_rewards:
                group_model.query.filter_by.return_value.first.return_value = group
                user_model.query.get.return_value = viewer
                response, status = groups.preview_student_workspace.__wrapped__('school', 8)
        self.assertEqual(status, 200)
        self.assertFalse(response.get_json()['settings']['googleCalendarConnected'])
        get_settings.assert_called_once_with(3, 8)
        build_rewards.assert_called_once_with(group, 8, None, read_only=True)

    def test_read_only_economy_does_not_create_or_credit_wallet(self):
        group = SimpleNamespace(id=3, group_type='school')
        wallet_model = SimpleNamespace(query=Mock())
        wallet_model.query.filter_by.return_value.first.return_value = None
        challenge_model = SimpleNamespace(query=Mock())
        challenge_model.query.filter_by.return_value.all.return_value = []
        with patch.object(groups, 'StudentIpWallet', wallet_model), patch.object(groups, 'GroupChallenge', challenge_model), patch.object(groups, '_student_timezone', return_value=('UTC', timezone.utc)), patch.object(groups, '_sync_student_ip_bucks') as sync_wallet:
            economy = groups._build_ip_economy(group, 8, None, [], read_only=True)
        sync_wallet.assert_not_called()
        self.assertEqual(economy['wallet']['balance'], 0)
        self.assertEqual(economy['purchases'], [])


if __name__ == '__main__':
    unittest.main()
