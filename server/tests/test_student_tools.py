import unittest

from utils.openai_responses import OpenAIResponsesError, validate_structured_output
from utils.student_tools import (
    MEDITATION_FOCUS_OPTIONS,
    active_study_plan,
    build_tutor_config_payload,
    build_tutor_daily_usage,
    build_fitness_plan_schema,
    build_meditation_manual_prompt,
    build_study_plan_schema,
    build_tutor_response_schema,
    build_tutor_prompts,
    estimate_meditation_duration,
    normalize_study_plan_library,
    validate_meditation_payload,
)


class StudentToolContractTests(unittest.TestCase):
    @staticmethod
    def valid_tutor_response():
        return {
            'replyEnglish': 'Good attempt. Your meaning was clear, and there is one tense correction to make.',
            'feedback': {
                'summaryEnglish': 'Use the preterite for this completed action.',
                'whatWasDoneWellEnglish': ['You chose the correct subject pronoun.'],
                'corrections': [{
                    'original': 'yo juego ayer',
                    'corrected': 'yo jugué ayer',
                    'explanationEnglish': 'A completed action yesterday needs the preterite form jugué.',
                    'category': 'grammar',
                }],
                'suggestions': [{
                    'targetLanguage': 'después del colegio',
                    'englishMeaning': 'after school',
                    'whyUsefulEnglish': 'This adds useful time detail to the answer.',
                }],
                'modelAnswer': 'Ayer jugué al fútbol después del colegio.',
                'modelAnswerEnglish': 'Yesterday I played football after school.',
            },
            'score': 72,
            'activity': {
                'type': 'translation',
                'instructionsEnglish': 'Translate the sentence into Spanish using the preterite.',
                'prompt': 'Yesterday I visited my grandparents.',
                'promptLanguage': 'english',
                'options': [],
                'tokens': [],
                'expectedAnswer': 'Ayer visité a mis abuelos.',
                'hintEnglish': 'Use the first-person preterite of visitar.',
                'skillTag': 'Preterite translation',
                'examSkill': 'translation',
                'difficulty': 'foundation',
                'focusWords': ['ayer', 'visité', 'abuelos'],
            },
            'quickTipEnglish': 'Time phrases such as ayer often signal a completed past action.',
        }

    def valid_meditation(self):
        return {
            'title': 'Focus reset',
            'subtitle': 'Return to the next useful action',
            'description': 'A short guided reset before focused work.',
            'durationSeconds': 300,
            'theme': 'focus',
            'difficulty': 'beginner',
            'accentColor': '#22d3ee',
            'focus': {
                'key': 'deep-study-focus',
                'title': 'Deep focus before study',
                'studentOutcome': 'The student feels settled and ready to begin one clearly defined study task.',
                'goalConnectionPrompt': 'Connect this study block to one result or personal goal that genuinely matters to you.',
                'whenToUse': 'Use immediately before a focused revision or homework block.',
            },
            'voiceDirection': {
                'tone': 'Warm, grounded, unhurried and encouraging without sounding childish.',
                'paceWordsPerMinute': 95,
                'speed': 0.88,
                'stability': 0.72,
                'similarityBoost': 0.78,
                'style': 0.12,
                'useSpeakerBoost': True,
                'pronunciationNotes': ['Say IPKP as I P K P.'],
            },
            'timingPlan': {
                'targetWordCountMin': 330,
                'targetWordCountMax': 450,
                'targetSpokenSeconds': 225,
                'targetQuietSeconds': 75,
            },
            'phases': [
                {'id': 'arrive', 'name': 'Arrive', 'startSecond': 0, 'durationSeconds': 60, 'guidance': 'Settle into the chair.', 'breathPattern': 'Natural breathing', 'visualCue': 'Soft cyan pulse', 'circleMode': 'steady'},
                {'id': 'breathe', 'name': 'Breathe', 'startSecond': 60, 'durationSeconds': 120, 'guidance': 'Slow the exhale.', 'breathPattern': 'In four, out five', 'visualCue': 'Expanding circle', 'circleMode': 'expand'},
                {'id': 'focus', 'name': 'Focus', 'startSecond': 180, 'durationSeconds': 120, 'guidance': 'Choose the next useful action.', 'breathPattern': 'Natural breathing', 'visualCue': 'Bright centre', 'circleMode': 'contract'},
            ],
            'narration': {
                'opening': {'text': 'Welcome to the Inner Performance Meditation Lounge. In this session, you will practise settling your attention before beginning one useful task. Take a comfortable position and allow your attention to arrive here without forcing anything.', 'deliveryCue': 'grounded', 'pauseAfterSeconds': 2},
                'segments': [
                    {'phaseId': 'arrive', 'text': 'Notice the support beneath you and let your shoulders soften as your attention arrives in this moment.', 'deliveryCue': 'warm', 'pauseBeforeSeconds': 0, 'pauseAfterSeconds': 2},
                    {'phaseId': 'breathe', 'text': 'Breathe in gently, then let the out breath become a little longer while keeping the breath comfortable.', 'deliveryCue': 'grounded', 'pauseBeforeSeconds': 1, 'pauseAfterSeconds': 3},
                    {'phaseId': 'focus', 'text': 'Picture the one useful action you will take when this session finishes and see yourself beginning calmly.', 'deliveryCue': 'encouraging', 'pauseBeforeSeconds': 1, 'pauseAfterSeconds': 2},
                ],
                'closing': {'text': 'Bring your attention back to the room and begin that next action calmly, one step at a time.', 'deliveryCue': 'clear', 'pauseAfterSeconds': 1},
                'quietIntegrationSeconds': 150,
            },
            'music': {'title': 'Quiet horizon', 'mood': 'calm ambient', 'targetVolume': 0.14, 'loop': True},
            'safetyNote': 'Stop the session and speak to a trusted adult if you feel uncomfortable.',
        }

    def test_meditation_contract_accepts_sequential_phases(self):
        payload = validate_meditation_payload(self.valid_meditation())
        self.assertEqual(payload['durationSeconds'], 300)

    def test_meditation_contract_rejects_phase_timing_gaps(self):
        payload = self.valid_meditation()
        payload['phases'][1]['startSecond'] = 65
        with self.assertRaisesRegex(OpenAIResponsesError, 'must start at second 60'):
            validate_meditation_payload(payload)

    def test_meditation_duration_estimate_includes_voice_and_quiet_time(self):
        payload = validate_meditation_payload(self.valid_meditation())
        estimate = estimate_meditation_duration(payload)
        self.assertGreater(estimate['wordCount'], 40)
        self.assertEqual(estimate['quietIntegrationSeconds'], 150)
        self.assertIn(estimate['fitStatus'], {'on-target', 'review', 'off-target'})

    def test_all_ai_tool_contracts_are_strict_at_root(self):
        for schema in (build_study_plan_schema(), build_fitness_plan_schema(), build_tutor_response_schema()):
            self.assertFalse(schema['additionalProperties'])
            self.assertEqual(set(schema['required']), set(schema['properties']))

    def test_legacy_study_plan_becomes_a_library_entry(self):
        legacy_plan = {'title': 'GCSE revision week', 'summary': 'A focused week.'}
        library = normalize_study_plan_library(legacy_plan)
        self.assertEqual(library['activePlanId'], 'legacy-study-plan')
        self.assertEqual(library['plans'][0]['plan'], legacy_plan)
        self.assertEqual(active_study_plan(library), legacy_plan)

    def test_study_plan_library_falls_back_to_latest_active_plan(self):
        first = {'title': 'First plan'}
        latest = {'title': 'Latest plan'}
        library = normalize_study_plan_library({
            'activePlanId': 'missing',
            'plans': [
                {'id': 'first', 'name': 'First', 'plan': first},
                {'id': 'latest', 'name': 'Latest', 'plan': latest},
            ],
        })
        self.assertEqual(library['activePlanId'], 'latest')
        self.assertEqual(active_study_plan(library), latest)

    def test_tutor_contract_accepts_structured_english_corrections(self):
        payload = validate_structured_output(self.valid_tutor_response(), build_tutor_response_schema())
        self.assertEqual(payload['feedback']['corrections'][0]['category'], 'grammar')
        self.assertEqual(payload['activity']['examSkill'], 'translation')

    def test_tutor_prompt_requires_english_feedback_and_board_alignment(self):
        system_prompt, user_prompt = build_tutor_prompts(
            'spanish',
            {'examBoard': 'aqa', 'topic': 'Healthy living and lifestyle', 'tier': 'foundation'},
            [],
            'Yo como bien.',
            {'type': 'free-response'},
        )
        self.assertIn('ALL teaching, marking, correction explanations', system_prompt)
        self.assertIn('written in clear English', system_prompt)
        self.assertIn('selected current GCSE exam board', system_prompt)
        self.assertIn('aqa', user_prompt)

    def test_tutor_config_contains_current_supported_boards(self):
        config = build_tutor_config_payload()
        board_ids = {board['id'] for board in config['examBoards']}
        self.assertEqual(board_ids, {'aqa', 'edexcel', 'eduqas', 'mixed'})
        self.assertEqual(config['dailyLimit'], 15)

    def test_tutor_daily_usage_resets_on_a_new_local_date(self):
        progress = {'spanish-tutor': {'dailyDate': '2026-08-08', 'dailyCount': 11}}
        same_day = build_tutor_daily_usage(progress, 'spanish-tutor', '2026-08-08', 'America/Bogota')
        next_day = build_tutor_daily_usage(progress, 'spanish-tutor', '2026-08-09', 'America/Bogota')
        self.assertEqual(same_day['used'], 11)
        self.assertEqual(same_day['remaining'], 4)
        self.assertEqual(next_day['used'], 0)
        self.assertEqual(next_day['remaining'], 15)

    def test_manual_prompt_contains_machine_contract_and_safety(self):
        prompt = build_meditation_manual_prompt('goal-clarity', 10, 'GCSE students', 'Keep it practical.')
        self.assertIn('JSON Schema', prompt)
        self.assertIn('durationSeconds', prompt)
        self.assertIn('do not include medical claims', prompt.lower())
        self.assertIn('pauseAfterSeconds', prompt)
        self.assertIn('Return exactly one JSON object', prompt)
        self.assertIn('Inner Performance Meditation Lounge', prompt)
        self.assertIn('explaining the objective of this specific session', prompt)

    def test_improving_attention_span_is_an_available_focus(self):
        self.assertIn('improving-attention-span', MEDITATION_FOCUS_OPTIONS)
        prompt = build_meditation_manual_prompt('improving-attention-span', 10, 'GCSE students', '')
        self.assertIn('Improving attention span', prompt)

    def test_meditation_contract_requires_branded_objective_intro(self):
        payload = self.valid_meditation()
        payload['narration']['opening']['text'] = 'Take a comfortable position and allow your attention to settle here without forcing anything.'
        with self.assertRaisesRegex(OpenAIResponsesError, 'Inner Performance Meditation Lounge'):
            validate_meditation_payload(payload)

    def test_meditation_objective_intro_accepts_curly_apostrophe(self):
        payload = self.valid_meditation()
        payload['narration']['opening']['text'] = 'Welcome to the Inner Performance Meditation Lounge. Today’s session will help you practise returning your attention to one chosen focus before you begin.'
        self.assertEqual(validate_meditation_payload(payload)['focus']['key'], 'deep-study-focus')

    def test_manual_prompt_rejects_unsupported_duration(self):
        with self.assertRaisesRegex(ValueError, '5, 10, 15, 20, 30'):
            build_meditation_manual_prompt('goal-clarity', 8, 'GCSE students', '')

    def test_meditation_contract_rejects_ssml_inside_spoken_text(self):
        payload = self.valid_meditation()
        payload['narration']['opening']['text'] = 'Settle into the chair now. <break time="1.0s" /> Keep breathing naturally and comfortably.'
        with self.assertRaisesRegex(OpenAIResponsesError, 'plain speech'):
            validate_meditation_payload(payload)


if __name__ == '__main__':
    unittest.main()
