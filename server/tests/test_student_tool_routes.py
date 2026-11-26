import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flask import Flask

from routes import groups as groups_routes


class StudentToolRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)

    @staticmethod
    def fitness_plan():
        return {
            'title': 'My fitness week',
            'overview': 'A realistic beginner plan.',
            'safetyNote': 'Stop if you feel pain, dizziness or illness.',
            'warmup': ['Walk gently', 'Move shoulders', 'Mobilise ankles'],
            'sessions': [
                {
                    'day': 'Monday',
                    'focus': 'Whole body',
                    'durationMinutes': 30,
                    'exercises': [
                        {'name': 'Squat', 'sets': 2, 'repsOrTime': '8 reps', 'restSeconds': 60, 'technique': 'Move with control.', 'easierOption': 'Sit to a chair.'},
                        {'name': 'Wall press', 'sets': 2, 'repsOrTime': '8 reps', 'restSeconds': 60, 'technique': 'Keep a straight line.', 'easierOption': 'Stand closer.'},
                        {'name': 'March', 'sets': 2, 'repsOrTime': '30 seconds', 'restSeconds': 45, 'technique': 'Stay tall.', 'easierOption': 'Slow the pace.'},
                    ],
                    'cooldown': ['Walk slowly', 'Breathe naturally'],
                },
            ],
            'recovery': ['Sleep consistently', 'Drink water', 'Take an easy day'],
            'progressionRule': 'Increase only one small element after the current plan feels comfortable.',
        }

    @staticmethod
    def tutor_response():
        return {
            'replyEnglish': 'Your answer is nearly there. Review the corrected tense below.',
            'feedback': {
                'summaryEnglish': 'Use the completed past tense for yesterday.',
                'whatWasDoneWellEnglish': ['The sentence meaning was clear.'],
                'corrections': [{
                    'original': 'je joue hier',
                    'corrected': "j'ai joué hier",
                    'explanationEnglish': 'Hier describes a completed past action, so use the perfect tense.',
                    'category': 'grammar',
                }],
                'suggestions': [],
                'modelAnswer': "Hier, j'ai joué au tennis.",
                'modelAnswerEnglish': 'Yesterday, I played tennis.',
            },
            'score': 70,
            'activity': {
                'type': 'translation',
                'instructionsEnglish': 'Translate this sentence into French.',
                'prompt': 'Yesterday I watched a film.',
                'promptLanguage': 'english',
                'options': [],
                'tokens': [],
                'expectedAnswer': "Hier, j'ai regardé un film.",
                'hintEnglish': 'Use the perfect tense with avoir.',
                'skillTag': 'Perfect tense translation',
                'examSkill': 'translation',
                'difficulty': 'foundation',
                'focusWords': ['hier', 'regardé', 'film'],
            },
            'quickTipEnglish': 'The French perfect tense usually needs an auxiliary and past participle.',
        }

    def test_fitness_generation_returns_draft_without_saving(self):
        plan = self.fitness_plan()
        get_state = Mock()
        fake_db = SimpleNamespace(session=SimpleNamespace(commit=Mock(), rollback=Mock()))
        with self.app.test_request_context(json={'toolId': 'fitness-coach', 'inputs': {}}):
            with patch.object(groups_routes, '_student_tool_request_context', return_value=(SimpleNamespace(id=7), SimpleNamespace(id=11, account_role='student'), None)), \
                    patch.object(groups_routes, '_student_has_tool_access', return_value=True), \
                    patch.object(groups_routes, 'create_structured_response', return_value=plan), \
                    patch.object(groups_routes, '_get_or_create_student_tool_state', get_state), \
                    patch.object(groups_routes, 'db', fake_db):
                response, status_code = groups_routes.generate_student_tool_content.__wrapped__('school-1')

        self.assertEqual(status_code, 200)
        self.assertFalse(response.get_json()['saved'])
        get_state.assert_not_called()
        fake_db.session.commit.assert_not_called()

    def test_student_can_explicitly_save_valid_fitness_plan(self):
        plan = self.fitness_plan()
        state = SimpleNamespace(fitness_plan={}, updated_at=None)
        fake_db = SimpleNamespace(session=SimpleNamespace(commit=Mock(), rollback=Mock()))
        with self.app.test_request_context(json={'plan': plan}):
            with patch.object(groups_routes, '_student_tool_request_context', return_value=(SimpleNamespace(id=7), SimpleNamespace(id=11, account_role='student'), None)), \
                    patch.object(groups_routes, '_student_has_tool_access', return_value=True), \
                    patch.object(groups_routes, '_get_or_create_student_tool_state', return_value=state), \
                    patch.object(groups_routes, 'db', fake_db):
                response, status_code = groups_routes.save_student_fitness_plan.__wrapped__('school-1')

        self.assertEqual(status_code, 200)
        self.assertEqual(response.get_json()['fitnessPlan']['title'], plan['title'])
        self.assertEqual(state.fitness_plan, plan)
        fake_db.session.commit.assert_called_once()

    def test_tutor_turn_reaches_daily_limit_after_fifteenth_response(self):
        result = self.tutor_response()
        state = SimpleNamespace(student_id=11, tutor_progress={}, updated_at=None)
        fake_db = SimpleNamespace(session=SimpleNamespace(commit=Mock(), rollback=Mock()))
        usage = {'used': 14, 'remaining': 1, 'limit': 15, 'date': '2026-08-08', 'timezone': 'America/Bogota'}
        with self.app.test_request_context(json={
            'toolId': 'french-tutor',
            'inputs': {'deviceTimezone': 'America/Bogota', 'examBoard': 'aqa', 'topic': 'Free-time activities'},
            'answer': "je joue hier",
            'previousActivity': result['activity'],
        }):
            with patch.object(groups_routes, '_student_tool_request_context', return_value=(SimpleNamespace(id=7), SimpleNamespace(id=11, account_role='student'), None)), \
                    patch.object(groups_routes, '_student_has_tool_access', return_value=True), \
                    patch.object(groups_routes, '_get_or_create_student_tool_state', return_value=state), \
                    patch.object(groups_routes, '_student_tutor_usage', return_value=usage), \
                    patch.object(groups_routes, 'create_structured_response', return_value=result), \
                    patch.object(groups_routes, 'flag_modified'), \
                    patch.object(groups_routes, 'db', fake_db):
                response, status_code = groups_routes.generate_student_tool_content.__wrapped__('school-1')

        self.assertEqual(status_code, 200)
        self.assertEqual(response.get_json()['tutorUsage']['used'], 15)
        self.assertEqual(response.get_json()['tutorUsage']['remaining'], 0)
        self.assertEqual(state.tutor_progress['french-tutor']['dailyCount'], 15)

    def test_tutor_rejects_a_sixteenth_daily_turn_before_calling_ai(self):
        state = SimpleNamespace(student_id=11, tutor_progress={}, updated_at=None)
        usage = {'used': 15, 'remaining': 0, 'limit': 15, 'date': '2026-08-08', 'timezone': 'America/Bogota'}
        create_response = Mock()
        with self.app.test_request_context(json={
            'toolId': 'spanish-tutor',
            'inputs': {'deviceTimezone': 'America/Bogota'},
        }):
            with patch.object(groups_routes, '_student_tool_request_context', return_value=(SimpleNamespace(id=7), SimpleNamespace(id=11, account_role='student'), None)), \
                    patch.object(groups_routes, '_student_has_tool_access', return_value=True), \
                    patch.object(groups_routes, '_get_or_create_student_tool_state', return_value=state), \
                    patch.object(groups_routes, '_student_tutor_usage', return_value=usage), \
                    patch.object(groups_routes, 'create_structured_response', create_response):
                response, status_code = groups_routes.generate_student_tool_content.__wrapped__('school-1')

        self.assertEqual(status_code, 429)
        self.assertEqual(response.get_json()['code'], 'DAILY_TUTOR_LIMIT')
        create_response.assert_not_called()


if __name__ == '__main__':
    unittest.main()
