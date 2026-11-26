import json
import re

from utils.openai_responses import OpenAIResponsesError, validate_structured_output


GCSE_LANGUAGES = ('spanish', 'french')
GCSE_ACTIVITY_TYPES = ('gap-fill', 'word-order', 'conjugation', 'translation', 'multiple-choice', 'free-response')
GCSE_EXAM_SKILLS = ('reading', 'writing', 'translation', 'grammar', 'vocabulary')
GCSE_CORRECTION_CATEGORIES = ('grammar', 'vocabulary', 'spelling', 'word-order', 'accent', 'meaning')
TUTOR_DAILY_LIMIT = 15
STUDY_PLAN_LIBRARY_LIMIT = 12


def normalize_study_plan_library(value):
    if not isinstance(value, dict) or not value:
        return {'version': 2, 'activePlanId': '', 'plans': []}

    raw_plans = value.get('plans')
    if isinstance(raw_plans, list):
        plans = []
        for index, item in enumerate(raw_plans[-STUDY_PLAN_LIBRARY_LIMIT:]):
            if not isinstance(item, dict):
                continue
            plan = item.get('plan') if isinstance(item.get('plan'), dict) else {}
            if not plan.get('title'):
                continue
            plan_id = str(item.get('id') or f'imported-plan-{index + 1}')[:80]
            plans.append({
                'id': plan_id,
                'name': str(item.get('name') or plan.get('title') or 'Study plan')[:120],
                'createdAt': str(item.get('createdAt') or ''),
                'updatedAt': str(item.get('updatedAt') or item.get('createdAt') or ''),
                'plan': plan,
            })
        active_plan_id = str(value.get('activePlanId') or '')
        if active_plan_id not in {item['id'] for item in plans}:
            active_plan_id = plans[-1]['id'] if plans else ''
        return {'version': 2, 'activePlanId': active_plan_id, 'plans': plans}

    if value.get('title'):
        return {
            'version': 2,
            'activePlanId': 'legacy-study-plan',
            'plans': [{
                'id': 'legacy-study-plan',
                'name': str(value.get('title') or 'Saved study plan')[:120],
                'createdAt': '',
                'updatedAt': '',
                'plan': value,
            }],
        }

    return {'version': 2, 'activePlanId': '', 'plans': []}


def active_study_plan(library):
    normalized = normalize_study_plan_library(library)
    return next(
        (item.get('plan') or {} for item in normalized['plans'] if item['id'] == normalized['activePlanId']),
        {},
    )


GCSE_EXAM_BOARD_TOPICS = {
    'aqa': {
        'label': 'AQA',
        'description': 'The current AQA GCSE course, organised into three broad themes.',
        'topics': [
            {'id': 'identity-relationships', 'label': 'Identity and relationships with others', 'theme': 'People and lifestyle'},
            {'id': 'healthy-living', 'label': 'Healthy living and lifestyle', 'theme': 'People and lifestyle'},
            {'id': 'education-work', 'label': 'Education and work', 'theme': 'People and lifestyle'},
            {'id': 'free-time', 'label': 'Free-time activities', 'theme': 'Popular culture'},
            {'id': 'customs-festivals', 'label': 'Customs, festivals and celebrations', 'theme': 'Popular culture'},
            {'id': 'celebrity-culture', 'label': 'Celebrity culture', 'theme': 'Popular culture'},
            {'id': 'travel-tourism', 'label': 'Travel and tourism, including places of interest', 'theme': 'Communication and the world around us'},
            {'id': 'media-technology', 'label': 'Media and technology', 'theme': 'Communication and the world around us'},
            {'id': 'environment-home', 'label': 'The environment and where people live', 'theme': 'Communication and the world around us'},
        ],
    },
    'edexcel': {
        'label': 'Pearson Edexcel',
        'description': 'The current Pearson Edexcel GCSE course, organised into six thematic contexts.',
        'topics': [
            {'id': 'personal-world', 'label': 'My personal world', 'theme': 'Thematic context'},
            {'id': 'lifestyle-wellbeing', 'label': 'Lifestyle and wellbeing', 'theme': 'Thematic context'},
            {'id': 'neighbourhood', 'label': 'My neighbourhood', 'theme': 'Thematic context'},
            {'id': 'media-technology', 'label': 'Media and technology', 'theme': 'Thematic context'},
            {'id': 'studying-future', 'label': 'Studying and my future', 'theme': 'Thematic context'},
            {'id': 'travel-tourism', 'label': 'Travel and tourism', 'theme': 'Thematic context'},
        ],
    },
    'eduqas': {
        'label': 'Eduqas',
        'description': 'The current Eduqas GCSE course, using five broad topic areas to organise language practice.',
        'topics': [
            {'id': 'identity', 'label': 'Identity', 'theme': 'Broad theme'},
            {'id': 'everyday-life', 'label': 'Everyday life', 'theme': 'Broad theme'},
            {'id': 'my-future', 'label': 'My future', 'theme': 'Broad theme'},
            {'id': 'exploring', 'label': 'Exploring', 'theme': 'Broad theme'},
            {'id': 'global-matters', 'label': 'Global matters', 'theme': 'Broad theme'},
        ],
    },
    'mixed': {
        'label': 'Not sure / mixed GCSE',
        'description': 'Use broad GCSE language practice when the student does not know their exam board.',
        'topics': [
            {'id': 'identity-relationships', 'label': 'Identity, family and relationships', 'theme': 'General GCSE'},
            {'id': 'school-future', 'label': 'School, education and future plans', 'theme': 'General GCSE'},
            {'id': 'lifestyle-wellbeing', 'label': 'Lifestyle, health and wellbeing', 'theme': 'General GCSE'},
            {'id': 'free-time-culture', 'label': 'Free time, culture and celebrations', 'theme': 'General GCSE'},
            {'id': 'home-local-area', 'label': 'Home, neighbourhood and local area', 'theme': 'General GCSE'},
            {'id': 'media-technology', 'label': 'Media and technology', 'theme': 'General GCSE'},
            {'id': 'travel-tourism', 'label': 'Travel and tourism', 'theme': 'General GCSE'},
            {'id': 'environment-global', 'label': 'Environment and global matters', 'theme': 'General GCSE'},
        ],
    },
}
GCSE_GRAMMAR_FOCUSES = (
    'Mixed grammar',
    'Present tense',
    'Perfect / preterite past',
    'Imperfect tense',
    'Near future',
    'Simple future',
    'Conditional',
    'Irregular verbs',
    'Opinions and justifications',
    'Pronouns and word order',
    'Negatives and questions',
)
GCSE_ACTIVITY_PREFERENCES = (
    'Mixed practice',
    'Gap fills',
    'Word ordering',
    'Verb conjugation',
    'Translation',
    'Multiple choice',
    'Free response',
)
MEDITATION_DURATION_MINUTES = (5, 10, 15, 20, 30)
MEDITATION_DURATION_SECONDS = tuple(minutes * 60 for minutes in MEDITATION_DURATION_MINUTES)
MEDITATION_FOCUS_OPTIONS = {
    'goal-clarity': {
        'title': 'Goal clarity and next action',
        'purpose': 'Help a student reconnect with a meaningful goal, picture useful progress, and choose one realistic next action.',
    },
    'deep-study-focus': {
        'title': 'Deep focus before study',
        'purpose': 'Reduce distraction, settle attention, and prepare the student to begin one clearly defined study block.',
    },
    'improving-attention-span': {
        'title': 'Improving attention span',
        'purpose': 'Train sustained attention by helping the student notice distraction without judgement, return to one chosen focus, and gradually practise staying engaged for longer.',
    },
    'confidence-before-challenge': {
        'title': 'Confidence before a challenge',
        'purpose': 'Build grounded confidence before an exam, presentation, training session, difficult conversation, or new task.',
    },
    'reset-after-setback': {
        'title': 'Reset after a setback',
        'purpose': 'Help the student respond to a mistake or difficult day without shame and identify the next controllable action.',
    },
    'discipline-and-consistency': {
        'title': 'Discipline and consistency',
        'purpose': 'Strengthen identity-based consistency and help the student act even when motivation is low.',
    },
    'emotional-regulation': {
        'title': 'Calm and emotional regulation',
        'purpose': 'Lower immediate intensity, name what is controllable, and return to a steady state without making therapy claims.',
    },
    'exam-composure': {
        'title': 'Exam composure',
        'purpose': 'Settle exam nerves, improve attentional control, and rehearse a calm response to a difficult question.',
    },
    'evening-reflection': {
        'title': 'Evening reflection and recovery',
        'purpose': 'Review effort without judgement, release unfinished pressure, and prepare for restorative sleep.',
    },
}
MEDITATION_TIMING_PROFILES = {
    5: {'wordMin': 330, 'wordMax': 450, 'quietMin': 30, 'quietMax': 75},
    10: {'wordMin': 650, 'wordMax': 850, 'quietMin': 90, 'quietMax': 180},
    15: {'wordMin': 900, 'wordMax': 1200, 'quietMin': 180, 'quietMax': 300},
    20: {'wordMin': 1150, 'wordMax': 1500, 'quietMin': 300, 'quietMax': 480},
    30: {'wordMin': 1500, 'wordMax': 1950, 'quietMin': 600, 'quietMax': 900},
}
MEDITATION_DELIVERY_CUES = ('grounded', 'warm', 'encouraging', 'reflective', 'clear', 'energising-softly')


def _strict_object(properties):
    return {
        'type': 'object',
        'properties': properties,
        'required': list(properties),
        'additionalProperties': False,
    }


def build_study_plan_schema():
    study_block = _strict_object({
        'startTime': {'type': 'string', 'minLength': 5, 'maxLength': 5},
        'durationMinutes': {'type': 'integer', 'minimum': 10, 'maximum': 120},
        'subject': {'type': 'string', 'minLength': 1, 'maxLength': 80},
        'task': {'type': 'string', 'minLength': 1, 'maxLength': 220},
        'method': {'type': 'string', 'minLength': 1, 'maxLength': 120},
        'successCheck': {'type': 'string', 'minLength': 1, 'maxLength': 180},
    })
    day_plan = _strict_object({
        'day': {'type': 'string', 'enum': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']},
        'focus': {'type': 'string', 'minLength': 1, 'maxLength': 140},
        'blocks': {'type': 'array', 'items': study_block, 'minItems': 0, 'maxItems': 6},
    })
    checkpoint = _strict_object({
        'label': {'type': 'string', 'minLength': 1, 'maxLength': 120},
        'targetDate': {'type': 'string', 'minLength': 10, 'maxLength': 10},
        'evidence': {'type': 'string', 'minLength': 1, 'maxLength': 180},
    })
    return _strict_object({
        'title': {'type': 'string', 'minLength': 1, 'maxLength': 120},
        'summary': {'type': 'string', 'minLength': 1, 'maxLength': 500},
        'strategy': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 180}, 'minItems': 3, 'maxItems': 7},
        'weeklyPlan': {'type': 'array', 'items': day_plan, 'minItems': 7, 'maxItems': 7},
        'checkpoints': {'type': 'array', 'items': checkpoint, 'minItems': 1, 'maxItems': 8},
        'wellbeingNote': {'type': 'string', 'minLength': 1, 'maxLength': 280},
    })


def build_fitness_plan_schema():
    exercise = _strict_object({
        'name': {'type': 'string', 'minLength': 1, 'maxLength': 100},
        'sets': {'type': 'integer', 'minimum': 1, 'maximum': 6},
        'repsOrTime': {'type': 'string', 'minLength': 1, 'maxLength': 60},
        'restSeconds': {'type': 'integer', 'minimum': 0, 'maximum': 300},
        'technique': {'type': 'string', 'minLength': 1, 'maxLength': 220},
        'easierOption': {'type': 'string', 'minLength': 1, 'maxLength': 180},
    })
    session = _strict_object({
        'day': {'type': 'string', 'enum': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']},
        'focus': {'type': 'string', 'minLength': 1, 'maxLength': 100},
        'durationMinutes': {'type': 'integer', 'minimum': 10, 'maximum': 75},
        'exercises': {'type': 'array', 'items': exercise, 'minItems': 3, 'maxItems': 9},
        'cooldown': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 140}, 'minItems': 2, 'maxItems': 5},
    })
    return _strict_object({
        'title': {'type': 'string', 'minLength': 1, 'maxLength': 120},
        'overview': {'type': 'string', 'minLength': 1, 'maxLength': 450},
        'safetyNote': {'type': 'string', 'minLength': 1, 'maxLength': 350},
        'warmup': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 140}, 'minItems': 3, 'maxItems': 7},
        'sessions': {'type': 'array', 'items': session, 'minItems': 1, 'maxItems': 6},
        'recovery': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 160}, 'minItems': 3, 'maxItems': 7},
        'progressionRule': {'type': 'string', 'minLength': 1, 'maxLength': 260},
    })


def build_tutor_response_schema():
    correction = _strict_object({
        'original': {'type': 'string', 'minLength': 1, 'maxLength': 220},
        'corrected': {'type': 'string', 'minLength': 1, 'maxLength': 220},
        'explanationEnglish': {'type': 'string', 'minLength': 1, 'maxLength': 320},
        'category': {'type': 'string', 'enum': list(GCSE_CORRECTION_CATEGORIES)},
    })
    suggestion = _strict_object({
        'targetLanguage': {'type': 'string', 'minLength': 1, 'maxLength': 180},
        'englishMeaning': {'type': 'string', 'minLength': 1, 'maxLength': 180},
        'whyUsefulEnglish': {'type': 'string', 'minLength': 1, 'maxLength': 240},
    })
    feedback = _strict_object({
        'summaryEnglish': {'type': 'string', 'minLength': 1, 'maxLength': 500},
        'whatWasDoneWellEnglish': {
            'type': 'array',
            'items': {'type': 'string', 'minLength': 1, 'maxLength': 220},
            'minItems': 0,
            'maxItems': 4,
        },
        'corrections': {'type': 'array', 'items': correction, 'minItems': 0, 'maxItems': 6},
        'suggestions': {'type': 'array', 'items': suggestion, 'minItems': 0, 'maxItems': 4},
        'modelAnswer': {'type': 'string', 'minLength': 0, 'maxLength': 420},
        'modelAnswerEnglish': {'type': 'string', 'minLength': 0, 'maxLength': 420},
    })
    activity = _strict_object({
        'type': {'type': 'string', 'enum': list(GCSE_ACTIVITY_TYPES)},
        'instructionsEnglish': {'type': 'string', 'minLength': 1, 'maxLength': 280},
        'prompt': {'type': 'string', 'minLength': 1, 'maxLength': 500},
        'promptLanguage': {'type': 'string', 'enum': ['english', 'target-language', 'mixed']},
        'options': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 120}, 'minItems': 0, 'maxItems': 8},
        'tokens': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 80}, 'minItems': 0, 'maxItems': 16},
        'expectedAnswer': {'type': 'string', 'minLength': 1, 'maxLength': 300},
        'hintEnglish': {'type': 'string', 'minLength': 1, 'maxLength': 260},
        'skillTag': {'type': 'string', 'minLength': 1, 'maxLength': 100},
        'examSkill': {'type': 'string', 'enum': list(GCSE_EXAM_SKILLS)},
        'difficulty': {'type': 'string', 'enum': ['foundation', 'higher', 'stretch']},
        'focusWords': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 80}, 'minItems': 0, 'maxItems': 8},
    })
    return _strict_object({
        'replyEnglish': {'type': 'string', 'minLength': 1, 'maxLength': 850},
        'feedback': feedback,
        'score': {'type': 'integer', 'minimum': 0, 'maximum': 100},
        'activity': activity,
        'quickTipEnglish': {'type': 'string', 'minLength': 1, 'maxLength': 280},
    })


def build_tutor_config_payload():
    return {
        'dailyLimit': TUTOR_DAILY_LIMIT,
        'examBoards': [
            {
                'id': board_id,
                **board,
            }
            for board_id, board in GCSE_EXAM_BOARD_TOPICS.items()
        ],
        'grammarFocuses': list(GCSE_GRAMMAR_FOCUSES),
        'activityPreferences': list(GCSE_ACTIVITY_PREFERENCES),
        'tiers': ['foundation', 'higher', 'stretch'],
    }


def build_tutor_daily_usage(tutor_progress, tool_id, today_key, timezone_name):
    progress = tutor_progress if isinstance(tutor_progress, dict) else {}
    tool_progress = progress.get(tool_id) if isinstance(progress.get(tool_id), dict) else {}
    stored_date = str(tool_progress.get('dailyDate') or '')[:10]
    try:
        stored_count = max(0, int(tool_progress.get('dailyCount') or 0))
    except (TypeError, ValueError):
        stored_count = 0
    used = min(TUTOR_DAILY_LIMIT, stored_count) if stored_date == today_key else 0
    return {
        'used': used,
        'remaining': max(0, TUTOR_DAILY_LIMIT - used),
        'limit': TUTOR_DAILY_LIMIT,
        'date': today_key,
        'timezone': timezone_name,
    }


def build_meditation_schema():
    focus = _strict_object({
        'key': {'type': 'string', 'enum': list(MEDITATION_FOCUS_OPTIONS)},
        'title': {'type': 'string', 'minLength': 1, 'maxLength': 100},
        'studentOutcome': {'type': 'string', 'minLength': 20, 'maxLength': 300},
        'goalConnectionPrompt': {'type': 'string', 'minLength': 20, 'maxLength': 300},
        'whenToUse': {'type': 'string', 'minLength': 10, 'maxLength': 220},
    })
    voice_direction = _strict_object({
        'tone': {'type': 'string', 'minLength': 10, 'maxLength': 220},
        'paceWordsPerMinute': {'type': 'integer', 'minimum': 85, 'maximum': 115},
        'speed': {'type': 'number', 'minimum': 0.7, 'maximum': 1},
        'stability': {'type': 'number', 'minimum': 0.45, 'maximum': 0.9},
        'similarityBoost': {'type': 'number', 'minimum': 0.5, 'maximum': 0.95},
        'style': {'type': 'number', 'minimum': 0, 'maximum': 0.35},
        'useSpeakerBoost': {'type': 'boolean'},
        'pronunciationNotes': {'type': 'array', 'items': {'type': 'string', 'minLength': 1, 'maxLength': 120}, 'minItems': 0, 'maxItems': 8},
    })
    phase = _strict_object({
        'id': {'type': 'string', 'minLength': 1, 'maxLength': 40},
        'name': {'type': 'string', 'minLength': 1, 'maxLength': 80},
        'startSecond': {'type': 'integer', 'minimum': 0, 'maximum': 1800},
        'durationSeconds': {'type': 'integer', 'minimum': 15, 'maximum': 600},
        'guidance': {'type': 'string', 'minLength': 1, 'maxLength': 300},
        'breathPattern': {'type': 'string', 'minLength': 1, 'maxLength': 80},
        'visualCue': {'type': 'string', 'minLength': 1, 'maxLength': 120},
        'circleMode': {'type': 'string', 'enum': ['expand', 'hold', 'contract', 'steady']},
    })
    spoken_block = _strict_object({
        'text': {'type': 'string', 'minLength': 20, 'maxLength': 1800},
        'deliveryCue': {'type': 'string', 'enum': list(MEDITATION_DELIVERY_CUES)},
        'pauseAfterSeconds': {'type': 'number', 'minimum': 0, 'maximum': 3},
    })
    narration_segment = _strict_object({
        'phaseId': {'type': 'string', 'minLength': 1, 'maxLength': 40},
        'text': {'type': 'string', 'minLength': 20, 'maxLength': 2400},
        'deliveryCue': {'type': 'string', 'enum': list(MEDITATION_DELIVERY_CUES)},
        'pauseBeforeSeconds': {'type': 'number', 'minimum': 0, 'maximum': 3},
        'pauseAfterSeconds': {'type': 'number', 'minimum': 0, 'maximum': 3},
    })
    narration = _strict_object({
        'opening': spoken_block,
        'segments': {'type': 'array', 'items': narration_segment, 'minItems': 3, 'maxItems': 16},
        'closing': spoken_block,
        'quietIntegrationSeconds': {'type': 'integer', 'minimum': 0, 'maximum': 900},
    })
    timing_plan = _strict_object({
        'targetWordCountMin': {'type': 'integer', 'minimum': 200, 'maximum': 2200},
        'targetWordCountMax': {'type': 'integer', 'minimum': 250, 'maximum': 2400},
        'targetSpokenSeconds': {'type': 'integer', 'minimum': 120, 'maximum': 1800},
        'targetQuietSeconds': {'type': 'integer', 'minimum': 0, 'maximum': 900},
    })
    music = _strict_object({
        'title': {'type': 'string', 'minLength': 1, 'maxLength': 100},
        'mood': {'type': 'string', 'minLength': 1, 'maxLength': 120},
        'targetVolume': {'type': 'number', 'minimum': 0, 'maximum': 0.35},
        'loop': {'type': 'boolean'},
    })
    return _strict_object({
        'title': {'type': 'string', 'minLength': 1, 'maxLength': 120},
        'subtitle': {'type': 'string', 'minLength': 1, 'maxLength': 180},
        'description': {'type': 'string', 'minLength': 1, 'maxLength': 500},
        'durationSeconds': {'type': 'integer', 'enum': list(MEDITATION_DURATION_SECONDS)},
        'theme': {'type': 'string', 'enum': ['calm', 'focus', 'confidence', 'sleep', 'reset', 'performance']},
        'difficulty': {'type': 'string', 'enum': ['beginner', 'intermediate']},
        'accentColor': {'type': 'string', 'minLength': 4, 'maxLength': 9},
        'focus': focus,
        'voiceDirection': voice_direction,
        'timingPlan': timing_plan,
        'phases': {'type': 'array', 'items': phase, 'minItems': 3, 'maxItems': 12},
        'narration': narration,
        'music': music,
        'safetyNote': {'type': 'string', 'minLength': 1, 'maxLength': 300},
    })


def validate_meditation_payload(raw_payload):
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except json.JSONDecodeError as exc:
            raise OpenAIResponsesError(f'Meditation JSON is invalid: {exc.msg} at line {exc.lineno}.') from exc
    payload = validate_structured_output(raw_payload, build_meditation_schema())
    phase_ids = [phase['id'] for phase in payload['phases']]
    if len(phase_ids) != len(set(phase_ids)):
        raise OpenAIResponsesError('Meditation phase IDs must be unique.')
    expected_start = 0
    for phase in payload['phases']:
        if phase['startSecond'] != expected_start:
            raise OpenAIResponsesError(f"Phase {phase['id']} must start at second {expected_start}.")
        expected_start += phase['durationSeconds']
    if expected_start != payload['durationSeconds']:
        raise OpenAIResponsesError('Meditation phase durations must add up exactly to durationSeconds.')
    unknown_phase_ids = {
        segment['phaseId'] for segment in payload['narration']['segments']
        if segment['phaseId'] not in set(phase_ids)
    }
    if unknown_phase_ids:
        raise OpenAIResponsesError(f"Narration uses unknown phase IDs: {', '.join(sorted(unknown_phase_ids))}.")
    missing_phase_ids = set(phase_ids) - {segment['phaseId'] for segment in payload['narration']['segments']}
    if missing_phase_ids:
        raise OpenAIResponsesError(f"Narration is missing phase guidance for: {', '.join(sorted(missing_phase_ids))}.")
    if payload['timingPlan']['targetWordCountMin'] > payload['timingPlan']['targetWordCountMax']:
        raise OpenAIResponsesError('targetWordCountMin cannot exceed targetWordCountMax.')
    for block in [payload['narration']['opening'], payload['narration']['closing'], *payload['narration']['segments']]:
        if '<' in block['text'] or '>' in block['text']:
            raise OpenAIResponsesError('Narration text must be plain speech without HTML or SSML tags.')
    opening_text = payload['narration']['opening']['text']
    if 'inner performance meditation lounge' not in opening_text.lower():
        raise OpenAIResponsesError('The spoken opening must welcome the student to the Inner Performance Meditation Lounge.')
    if not re.search(r"\b(?:this|today['’]?s)\s+(?:guided\s+|meditation\s+)?session\b", opening_text, flags=re.IGNORECASE):
        raise OpenAIResponsesError('The spoken opening must briefly introduce the objective of this session before the meditation begins.')
    return payload


def estimate_meditation_duration(payload):
    narration = payload.get('narration') or {}
    opening = narration.get('opening') or {}
    closing = narration.get('closing') or {}
    opening = opening if isinstance(opening, dict) else {'text': str(opening), 'pauseAfterSeconds': 0}
    closing = closing if isinstance(closing, dict) else {'text': str(closing), 'pauseAfterSeconds': 0}
    segments = [segment for segment in (narration.get('segments') or []) if isinstance(segment, dict)]
    spoken_blocks = [opening, *segments, closing]
    word_count = sum(len(re.findall(r"\b[\w’'-]+\b", str(block.get('text') or ''), flags=re.UNICODE)) for block in spoken_blocks)
    pace = max(1, (payload.get('voiceDirection') or {}).get('paceWordsPerMinute') or 100)
    spoken_seconds = round((word_count / pace) * 60)
    ssml_pause_seconds = round(
        float(opening.get('pauseAfterSeconds') or 0)
        + float(closing.get('pauseAfterSeconds') or 0)
        + sum(float(segment.get('pauseBeforeSeconds') or 0) + float(segment.get('pauseAfterSeconds') or 0) for segment in segments)
    )
    quiet_seconds = int(narration.get('quietIntegrationSeconds') or 0)
    estimated_seconds = spoken_seconds + ssml_pause_seconds + quiet_seconds
    planned_seconds = int(payload.get('durationSeconds') or 0)
    difference_seconds = estimated_seconds - planned_seconds
    difference_ratio = abs(difference_seconds) / max(planned_seconds, 1)
    fit_status = 'on-target' if difference_ratio <= 0.1 else 'review' if difference_ratio <= 0.2 else 'off-target'
    return {
        'wordCount': word_count,
        'paceWordsPerMinute': pace,
        'spokenSeconds': spoken_seconds,
        'ssmlPauseSeconds': ssml_pause_seconds,
        'quietIntegrationSeconds': quiet_seconds,
        'estimatedSeconds': estimated_seconds,
        'plannedSeconds': planned_seconds,
        'differenceSeconds': difference_seconds,
        'fitStatus': fit_status,
    }


def build_study_plan_prompts(inputs):
    system_prompt = (
        'You are the Inner Performance GCSE study planner. Build realistic, specific revision plans for UK secondary students. '
        'Respect school, sleep, meals, exercise and recovery. Never overload a day. Prefer active recall, spaced practice, exam questions and short review loops. '
        'Use only the availability provided and return all seven weekdays in Monday-to-Sunday order.'
    )
    return system_prompt, f"Create a one-week study plan from this student brief:\n{json.dumps(inputs, ensure_ascii=False)}"


def build_fitness_plan_prompts(inputs):
    system_prompt = (
        'You are the Inner Performance youth fitness coach for students aged 14 to 18. Create age-appropriate general fitness sessions, not medical treatment. '
        'Do not prescribe weight loss, supplements, maximum lifts, punishment exercise or extreme training. Use available equipment only, include technique cues and easier options, '
        'and clearly tell the student to stop if they feel pain, dizziness or illness and to seek support from a trusted adult or qualified professional.'
    )
    return system_prompt, f"Create a safe weekly fitness plan from this brief:\n{json.dumps(inputs, ensure_ascii=False)}"


def build_tutor_prompts(language, inputs, history, answer, previous_activity):
    language_name = language.capitalize()
    system_prompt = (
        f'You are the Inner Performance GCSE {language_name} Tutor for a UK student aged 14 to 16. Use accurate {language_name} and align practice to the selected current GCSE exam board, topic and tier. '
        'ALL teaching, marking, correction explanations, encouragement, instructions, hints and tips must be written in clear English. '
        f'Use {language_name} only for the activity itself, corrected language, model answers, vocabulary and examples where the target language is educationally necessary. '
        'Keep the tone supportive, direct and age-appropriate rather than childish. Set exactly one interactive activity per response. '
        'Rotate naturally between gap fills, word ordering, conjugation, translation, multiple choice and free response unless the student selected a specific activity. '
        'If the selected topic is Random exam topic, choose one topic valid for the selected board and keep that topic coherent for the response. '
        'If an answer and previous activity are supplied, mark it accurately. Put every specific error in feedback.corrections with the exact original fragment, corrected fragment, category and a concise English explanation. '
        'Use an empty corrections array only when there is genuinely no correction. Never claim inaccurate work is correct. Do not invent official mark schemes or claim that a score is an official exam grade. '
        'Give useful praise only for work the student actually did well. Provide a target-language model answer and its English meaning after an attempted answer; for the first activity use empty strings for both model-answer fields. '
        'For multiple-choice activities provide plausible options. For word-order activities provide every token required. For other activities use empty arrays where options or tokens do not apply.'
    )
    prompt_payload = {
        'language': language,
        'sessionSettings': inputs,
        'recentConversation': history[-10:],
        'studentAnswer': answer or '',
        'previousActivity': previous_activity or {},
    }
    return system_prompt, json.dumps(prompt_payload, ensure_ascii=False)


def build_meditation_manual_prompt(focus_key, duration_minutes, audience, notes):
    if duration_minutes not in MEDITATION_DURATION_MINUTES:
        raise ValueError(f"Duration must be one of: {', '.join(map(str, MEDITATION_DURATION_MINUTES))} minutes")
    focus = MEDITATION_FOCUS_OPTIONS.get(focus_key)
    if not focus:
        raise ValueError('Unknown meditation focus')
    timing = MEDITATION_TIMING_PROFILES[duration_minutes]
    schema = build_meditation_schema()
    return (
        'You are an expert guided-meditation scriptwriter, youth performance coach, safeguarding-aware school practitioner, '
        'and professional voice director. Create one ORIGINAL guided meditation for the Inner Performance Key Protocols (IPKP) school app.\n\n'
        'SESSION BRIEF\n'
        f'- Focus key: {focus_key}\n'
        f'- Focus title: {focus["title"]}\n'
        f'- Intended purpose: {focus["purpose"]}\n'
        f'- Exact planned length: {duration_minutes} minutes ({duration_minutes * 60} seconds)\n'
        f'- Audience: {audience}\n'
        f'- Additional direction: {notes or "Use calm, inclusive, practical and non-religious language suitable for teenagers."}\n'
        f'- Target spoken-word range: {timing["wordMin"]} to {timing["wordMax"]} words\n'
        f'- Intentional quiet reflection allowance: {timing["quietMin"]} to {timing["quietMax"]} seconds\n\n'
        'PURPOSE AND TONE\n'
        '- The student should finish calmer, clearer and ready for one useful action connected to personal growth, learning, discipline, goals or recovery.\n'
        '- Sound professional and emotionally intelligent, but natural and interesting to a UK secondary-school student. Never sound childish, preachy, mystical or corporate.\n'
        '- Use inclusive, gender-neutral language. Offer choices such as closing the eyes or softening the gaze. Never shame, diagnose, pressure or promise an outcome.\n'
        '- This is performance and wellbeing guidance, not therapy or medical treatment. Do not include medical claims, therapy claims, trauma processing, body judgement, religious claims or breath holds longer than three seconds.\n'
        '- Connect visualisation to controllable behaviour: effort, attention, preparation, recovery, courage, consistency and the next realistic action.\n\n'
        'PROFESSIONAL SESSION ARC\n'
        '1. Branded welcome and objective: narration.opening must begin with a natural welcome to the “Inner Performance Meditation Lounge”. Immediately follow it with one or two brief spoken sentences explaining the objective of this specific session and what the student will practise or gain. Use wording such as “In this session...” or “Today’s session...” so the purpose is clear before any breathing, posture or visualisation instruction begins.\n'
        '2. Choice and arrival: invite a safe posture and make participation feel voluntary.\n'
        '3. Regulation: use comfortable breathing without forcing depth or pace.\n'
        '4. Focus-specific work: guide age-appropriate imagery, attention training or reflection that directly serves the selected focus.\n'
        '5. Goal connection: connect the internal exercise to a real goal, value or next action without assuming the student has already set a goal.\n'
        '6. Implementation intention: help the student form a specific “when this ends, I will...” action.\n'
        '7. Reorientation: return attention to the room gradually and finish with grounded encouragement.\n\n'
        'ELEVENLABS VOICE DIRECTION\n'
        '- Put all performance direction in voiceDirection and deliveryCue fields; never place stage directions inside spoken text because ElevenLabs would read them aloud.\n'
        '- Use plain, speakable British English with varied sentence length, natural punctuation and unhurried warmth. Do not include Markdown, brackets, SSML or XML inside text fields.\n'
        '- Set paceWordsPerMinute between 90 and 105 for a calm but engaging school-appropriate delivery. Use speed between 0.78 and 0.95, stable warmth, restrained style and clear similarity.\n'
        '- Explicit pauses are numeric. pauseBeforeSeconds and pauseAfterSeconds must each be 0 to 3 seconds. The server converts them into exact ElevenLabs SSML break tags.\n'
        '- Use quietIntegrationSeconds for longer music-backed reflection. Do not fake long silence with repeated punctuation or dozens of pause tags.\n'
        '- timingPlan must honestly match the actual script and the requested duration. Keep the complete spoken script inside the target word range.\n\n'
        'MACHINE CONTRACT\n'
        '- Return exactly one JSON object and nothing else: no introduction, explanation, code fence or trailing note.\n'
        '- Every property in the schema is required. Never add extra properties.\n'
        '- durationSeconds must exactly match the requested duration.\n'
        '- Phases must be sequential from second 0 with no gaps or overlaps, and their durations must add up exactly to durationSeconds.\n'
        '- Every phase ID must be unique and must be used by at least one narration segment.\n'
        '- focus.key must exactly equal the requested focus key. targetVolume must be between 0 and 0.35.\n'
        '- narration.opening must contain the exact brand name “Inner Performance Meditation Lounge” and must introduce this session’s focus-specific objective before giving meditation instructions.\n'
        '- Recheck arithmetic, word-count targets, enum values and JSON validity before responding.\n\n'
        'Return only JSON matching this exact JSON Schema:\n'
        f'{json.dumps(schema, indent=2)}'
    )
