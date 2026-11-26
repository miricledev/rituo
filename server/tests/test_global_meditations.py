import unittest

from db.models import MeditationSession


class GlobalMeditationModelTests(unittest.TestCase):
    def test_guided_sessions_do_not_reuse_legacy_table(self):
        self.assertEqual(MeditationSession.__tablename__, 'guided_meditation_sessions')

    def test_global_publication_scope_is_serialized(self):
        global_session = MeditationSession(
            group_id=None,
            created_by_id=1,
            session_key='global-session',
            session_data={},
            alignment={},
            narration_filename='global-session.mp3',
            is_published=True,
            is_global=True,
        )
        school_session = MeditationSession(
            group_id=1,
            created_by_id=1,
            session_key='school-session',
            session_data={},
            alignment={},
            narration_filename='1-session.mp3',
            is_published=True,
        )

        self.assertTrue(global_session.to_dict()['isGlobal'])
        self.assertFalse(school_session.to_dict()['isGlobal'])


if __name__ == '__main__':
    unittest.main()
