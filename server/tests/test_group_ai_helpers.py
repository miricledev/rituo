import unittest
from unittest.mock import patch

from routes import groups as groups_routes
from utils.ai_school import (
    build_copilot_schema,
    build_habit_draft_schema,
    build_personalized_habit_draft_schema,
    build_test_goal_seed_schema,
    build_schedule_clarification_schema,
    build_school_timetable_schema,
    build_copilot_action_link,
    build_copilot_system_prompt,
    get_copilot_public_config,
    normalize_copilot_response,
    normalize_daily_schedule,
    normalize_schedule_clarification,
    normalize_habit_draft,
    normalize_personalized_habit_draft,
    normalize_test_goal_seed,
    normalize_school_timetable,
    normalize_student_plan,
)


class GroupAiHelperTests(unittest.TestCase):
    def test_school_timetable_contract_uses_only_explicit_ids(self):
        schema = build_school_timetable_schema()
        entry_schema = schema["properties"]["entries"]["items"]

        self.assertFalse(entry_schema["additionalProperties"])
        self.assertEqual(
            set(entry_schema["required"]),
            {"weekday", "startTime", "endTime", "classId", "subjectId", "teacherId", "roomId", "reason"},
        )

    def test_school_timetable_normalizer_rejects_unknown_ids(self):
        result = normalize_school_timetable(
            {
                "summary": "Draft",
                "entries": [
                    {
                        "weekday": "Monday",
                        "startTime": "09:00",
                        "endTime": "10:00",
                        "classId": 1,
                        "subjectId": 2,
                        "teacherId": 3,
                        "roomId": 4,
                        "reason": "Valid",
                    },
                    {
                        "weekday": "Tuesday",
                        "startTime": "09:00",
                        "endTime": "10:00",
                        "classId": 99,
                        "subjectId": 2,
                        "teacherId": 3,
                        "roomId": 4,
                        "reason": "Unknown class",
                    },
                ],
                "warnings": [],
            },
            {1},
            {2},
            {3},
            {4},
        )

        self.assertEqual(len(result["entries"]), 1)
        self.assertEqual(result["entries"][0]["classId"], 1)

    def test_normalize_habit_draft_includes_estimated_duration(self):
        draft = normalize_habit_draft({
            "summary": "A short routine.",
            "habits": [{
                "name": "Read",
                "description": "Read a book",
                "habitType": "boolean",
                "scheduleDays": ["Monday"],
                "durationMinutes": 25,
                "combatType": "neutral",
                "prompt": "",
                "minValue": 0,
                "maxValue": 1,
            }],
            "warnings": [],
        })

        self.assertEqual(draft["habits"][0]["durationMinutes"], 25)

    def test_periodic_habit_contract_includes_cadence_and_overlap(self):
        draft = normalize_habit_draft({
            "summary": "Hydration routine.",
            "habits": [{
                "name": "Drink 500ml water",
                "description": "Spread hydration through the day",
                "habitType": "periodic",
                "scheduleDays": ["Monday"],
                "durationMinutes": 5,
                "combatType": "defence",
                "periodicIntervalHours": 3,
                "periodicOccurrences": 6,
                "allowOverlap": True,
                "prompt": "",
                "minValue": 0,
                "maxValue": 1,
            }],
            "warnings": [],
        })

        habit = draft["habits"][0]
        self.assertEqual(habit["habitType"], "periodic")
        self.assertEqual(habit["periodicIntervalHours"], 3)
        self.assertEqual(habit["periodicOccurrences"], 6)
        self.assertTrue(habit["allowOverlap"])

    def test_personalized_habits_only_link_supplied_student_goals(self):
        draft = normalize_personalized_habit_draft(
            {
                "summary": "Personal plans",
                "studentHabitSets": [
                    {
                        "studentId": "7",
                        "studentName": "Student",
                        "habits": [
                            {
                                "name": "Revision block",
                                "description": "Revise science",
                                "habitType": "boolean",
                                "scheduleDays": ["Monday"],
                                "durationMinutes": 30,
                                "combatType": "attack",
                                "periodicIntervalHours": 4,
                                "periodicOccurrences": 4,
                                "allowOverlap": False,
                                "prompt": "",
                                "minValue": 0,
                                "maxValue": 1,
                                "linkedGoalId": "91",
                            }
                        ],
                    }
                ],
                "warnings": [],
            },
            [{"id": "7", "name": "Student", "goals": [{"id": "91", "title": "Improve science"}]}],
        )

        self.assertEqual(draft["studentHabitSets"][0]["habits"][0]["linkedGoalId"], "91")

    def test_habit_draft_schemas_require_attack_or_defence_and_periodic_fields(self):
        habit_schema = build_habit_draft_schema()["properties"]["habits"]["items"]
        personalized_schema = build_personalized_habit_draft_schema()["properties"]["studentHabitSets"]["items"]["properties"]["habits"]["items"]

        self.assertEqual(habit_schema["properties"]["combatType"]["enum"], ["attack", "defence"])
        self.assertIn("periodicIntervalHours", habit_schema["required"])
        self.assertIn("scheduleTime", habit_schema["required"])
        self.assertIn("linkedGoalId", personalized_schema["required"])

    def test_test_goal_seed_keeps_five_distinct_goals_for_each_student(self):
        raw_goals = [
            {
                "title": f"Goal {index}",
                "barrier": "A realistic barrier",
                "schoolGoal": "Make steady progress",
                "forSelf": "Build confidence",
                "forOthers": "Contribute positively",
            }
            for index in range(1, 6)
        ]
        seed = normalize_test_goal_seed(
            {
                "summary": "Five demonstration goals.",
                "studentGoalSets": [{
                    "studentId": "12",
                    "studentName": "Student",
                    "goals": raw_goals,
                }],
                "warnings": [],
            },
            [{"id": "12", "name": "Student", "existingGoalTitles": []}],
            goals_per_student=5,
        )

        self.assertEqual(len(seed["studentGoalSets"][0]["goals"]), 5)
        goals_schema = build_test_goal_seed_schema()["properties"]["studentGoalSets"]["items"]["properties"]["goals"]
        self.assertEqual(goals_schema["minItems"], 5)
        self.assertEqual(goals_schema["maxItems"], 5)

    def test_normalize_daily_schedule_sorts_and_clamps_items(self):
        plan = normalize_daily_schedule({
            "summary": "Evening plan",
            "items": [
                {"title": "Read", "itemType": "habit", "habitIndex": 0, "startTime": "18:00", "endTime": "18:30", "durationMinutes": 30, "locked": False, "reason": "Focus"},
                {"title": "Break", "itemType": "break", "habitIndex": -1, "startTime": "17:45", "endTime": "18:00", "durationMinutes": 15, "locked": False, "reason": "Reset"},
            ],
            "warnings": [],
        })

        self.assertEqual([item["title"] for item in plan["items"]], ["Break", "Read"])

    def test_schedule_clarification_contract_is_strict_and_normalized(self):
        schema = build_schedule_clarification_schema()
        self.assertFalse(schema["additionalProperties"])
        self.assertEqual(schema["properties"]["questions"]["maxItems"], 3)

        clarification = normalize_schedule_clarification({
            "needsClarification": True,
            "questions": [
                {"id": "meal time", "question": "When will you eat?", "placeholder": "Around 18:00"},
                {"id": "meal time", "question": "Do you need travel time?", "placeholder": "30 minutes"},
            ],
            "readyMessage": "Two details will improve the plan.",
        })

        self.assertTrue(clarification["needsClarification"])
        self.assertEqual([item["id"] for item in clarification["questions"]], ["mealtime", "question-2"])

    def test_clarification_without_questions_is_ready(self):
        clarification = normalize_schedule_clarification({
            "needsClarification": True,
            "questions": [],
            "readyMessage": "Ready.",
        })

        self.assertFalse(clarification["needsClarification"])
        self.assertEqual(clarification["questions"], [])

    def test_planner_layout_context_marks_recurrence_and_movability(self):
        context = groups_routes._planner_ai_layout_context([
            {'id': 'habit-1', 'title': 'Deep work', 'itemType': 'habit', 'startTime': '09:00', 'endTime': '10:00', 'locked': False},
            {'id': 'routine-1', 'title': 'Team call', 'itemType': 'routine', 'startTime': '10:00', 'endTime': '10:30', 'locked': True},
            {'id': 'manual-1', 'title': 'Doctor', 'itemType': 'manual', 'startTime': '15:00', 'endTime': '15:30', 'locked': False},
        ])

        self.assertTrue(context[0]['movableByPlanner'])
        self.assertEqual(context[0]['recurrence'], 'challenge-schedule')
        self.assertEqual(context[1]['recurrence'], 'weekly')
        self.assertEqual(context[2]['recurrence'], 'one-off')

    def test_planner_requests_unknown_gym_travel_time(self):
        question = groups_routes._planner_travel_clarification(
            'Keep my evening realistic.',
            [{'title': 'Gym session', 'reason': '', 'itemType': 'habit'}],
        )

        self.assertEqual(question['id'], 'travel-time')
        self.assertIn('minutes', question['question'])

    def test_planner_does_not_repeat_known_travel_information(self):
        question = groups_routes._planner_travel_clarification(
            'The gym is 20 minutes away.',
            [{'title': 'Gym session', 'reason': '', 'itemType': 'habit'}],
        )
        clarification = groups_routes._add_planner_clarification_question(
            {
                'needsClarification': True,
                'questions': [{'id': 'commute', 'question': 'How long is your commute?', 'placeholder': 'Minutes'}],
                'readyMessage': '',
            },
            {'id': 'travel-time', 'question': 'How long is the travel?', 'placeholder': 'Minutes'},
        )

        self.assertIsNone(question)
        self.assertEqual(len(clarification['questions']), 1)

    def test_planner_schedule_coverage_requires_every_occurrence(self):
        habits = [
            {'habitIndex': 3, 'habitType': 'boolean'},
            {'habitIndex': 5, 'habitType': 'periodic', 'periodicOccurrences': 4},
        ]
        items = [
            {'itemType': 'break', 'title': 'Dinner'},
            {'itemType': 'habit', 'habitIndex': 3},
            {'itemType': 'habit', 'habitIndex': 5},
            {'itemType': 'habit', 'habitIndex': 5},
            {'itemType': 'habit', 'habitIndex': 5},
        ]

        self.assertEqual(
            groups_routes._planner_schedule_coverage_issues(items, habits),
            [{'habitIndex': 5, 'requiredCount': 4, 'actualCount': 3}],
        )

    def test_planner_schedule_coverage_accepts_complete_plan(self):
        habits = [
            {'habitIndex': 1, 'habitType': 'boolean'},
            {'habitIndex': 2, 'habitType': 'periodic', 'periodicOccurrences': 2},
        ]
        items = [
            {'itemType': 'habit', 'habitIndex': 1},
            {'itemType': 'habit', 'habitIndex': 2},
            {'itemType': 'habit', 'habitIndex': 2},
        ]

        self.assertEqual(groups_routes._planner_schedule_coverage_issues(items, habits), [])

    def test_planner_removes_generated_break_overlapping_google_event(self):
        generated = [
            {'id': 'break-copy', 'title': 'Preply lesson', 'itemType': 'break', 'startTime': '14:00', 'endTime': '15:00'},
            {'id': 'break-real', 'title': 'Travel to gym', 'itemType': 'break', 'startTime': '18:00', 'endTime': '18:20'},
            {'id': 'habit-1', 'title': 'Train', 'itemType': 'habit', 'startTime': '18:30', 'endTime': '19:30'},
        ]
        fixed = [
            {'id': 'google-preply', 'title': 'Preply lesson', 'itemType': 'google', 'startTime': '14:00', 'endTime': '15:00'},
        ]

        filtered = groups_routes._filter_generated_breaks_against_fixed_items(generated, fixed)

        self.assertEqual([item['id'] for item in filtered], ['break-real', 'habit-1'])

    def test_google_disconnect_deletes_only_workspace_managed_events(self):
        listed_events = [{'id': 'ip-event-1'}, {'id': 'ip-event-2'}]
        with patch.object(groups_routes, '_list_google_calendar_events', return_value=listed_events) as list_events, patch.object(
            groups_routes,
            '_google_calendar_api_request',
            return_value={},
        ) as calendar_request:
            removal = groups_routes._delete_google_workspace_events(object(), 20, batch_size=1)

        self.assertEqual(removal, {'removed': 1, 'remaining': 1, 'complete': False})
        self.assertEqual(
            list_events.call_args.args[1]['privateExtendedProperty'],
            'ipkpWorkspace=20',
        )
        self.assertEqual(calendar_request.call_count, 1)

    def test_normalize_student_plan_clamps_invalid_values_and_links_habits(self):
        plan = normalize_student_plan(
            {
                "summary": "Focus on consistency.",
                "goals": [
                    {
                        "key": "goal-a",
                        "title": "Complete science homework",
                        "barrier": "Loses track of deadlines",
                        "schoolGoal": "Hand work in on time",
                        "forSelf": "Feel prepared",
                        "forOthers": "Contribute in class",
                    }
                ],
                "habits": [
                    {
                        "name": "Homework check",
                        "description": "Review tasks after school",
                        "linkedGoalKey": "missing-key",
                        "habitType": "unsupported",
                        "scheduleDays": ["Monday", "Nope"],
                        "scheduleTime": "16:00",
                        "durationMinutes": 999,
                        "combatType": "wild",
                        "prompt": "What is due tomorrow?",
                        "minValue": 5,
                        "maxValue": 1,
                    }
                ],
                "goalActivity": {
                    "activity": "",
                    "fallbackActivity": "",
                    "reason": "Keep the reward tied to homework follow-through.",
                },
                "notes": ["Keep it short."],
                "warnings": [],
            }
        )

        self.assertEqual(plan["goals"][0]["key"], "goal-a")
        self.assertEqual(plan["habits"][0]["linkedGoalKey"], "goal-a")
        self.assertEqual(plan["habits"][0]["habitType"], "boolean")
        self.assertEqual(plan["habits"][0]["combatType"], "neutral")
        self.assertEqual(plan["habits"][0]["scheduleDays"], ["Monday"])
        self.assertEqual(plan["habits"][0]["durationMinutes"], 120)
        self.assertEqual(plan["habits"][0]["maxValue"], 6)
        self.assertTrue(plan["goalActivity"]["activity"].startswith("Progress check-in"))

    def test_normalize_student_plan_warns_when_goals_or_habits_missing(self):
        plan = normalize_student_plan(
            {
                "summary": "",
                "goals": [],
                "habits": [],
                "goalActivity": {
                    "activity": "",
                    "fallbackActivity": "Reflection session",
                    "reason": "",
                },
                "notes": [],
                "warnings": [],
            }
        )

        self.assertIn("No usable goals were generated from the source text.", plan["warnings"])
        self.assertIn("No usable habits were generated from the source text.", plan["warnings"])

    def test_hydration_total_becomes_periodic_check_ins(self):
        draft = normalize_habit_draft(
            {
                "summary": "Build hydration consistency.",
                "habits": [
                    {
                        "name": "Drink 2L of water daily",
                        "description": "Finish two litres before bed.",
                        "habitType": "boolean",
                        "scheduleDays": ["Monday", "Tuesday"],
                        "scheduleTime": "14:00",
                        "durationMinutes": 15,
                        "combatType": "defence",
                        "periodicIntervalHours": 4,
                        "periodicOccurrences": 4,
                        "allowOverlap": False,
                        "prompt": "Did you drink 2L?",
                        "minValue": 0,
                        "maxValue": 10,
                    }
                ],
                "warnings": [],
            }
        )

        habit = draft["habits"][0]
        self.assertEqual(habit["habitType"], "periodic")
        self.assertEqual(habit["name"], "Drink 400 ml of water")
        self.assertEqual(habit["periodicOccurrences"], 5)
        self.assertEqual(habit["periodicIntervalHours"], 4)
        self.assertEqual(habit["scheduleTime"], "08:00")
        self.assertEqual(habit["durationMinutes"], 5)
        self.assertTrue(habit["allowOverlap"])
        self.assertIn("2000 ml in total", habit["description"])

    def test_single_timed_water_action_stays_boolean(self):
        plan = normalize_student_plan(
            {
                "summary": "Morning routine.",
                "goals": [],
                "habits": [
                    {
                        "name": "Drink a glass of water after waking",
                        "habitType": "boolean",
                        "scheduleDays": ["Monday"],
                        "combatType": "defence",
                    }
                ],
                "goalActivity": {},
                "notes": [],
                "warnings": [],
            }
        )

        self.assertEqual(plan["habits"][0]["habitType"], "boolean")

    def test_normalize_copilot_response_filters_invalid_actions(self):
        response = normalize_copilot_response(
            {
                "answer": "Start with the register.",
                "focusArea": "Teacher workflow",
                "nextActions": [
                    {"actionType": "teacher-register", "title": "Finish the register", "why": "Coverage is missing."},
                    {"actionType": "bad-value", "title": "Bad action", "why": "Should fallback to none."},
                    {"actionType": "students", "title": "", "why": "Missing title should drop."},
                ],
                "quickReplies": ["What is overdue?", ""],
            }
        )

        self.assertEqual(len(response["nextActions"]), 2)
        self.assertEqual(response["nextActions"][0]["actionType"], "teacher-register")
        self.assertEqual(response["nextActions"][1]["actionType"], "none")
        self.assertEqual(response["quickReplies"], ["What is overdue?"])

    def test_copilot_filters_actions_by_trusted_account_role(self):
        response = normalize_copilot_response(
            {
                "answer": "Focus on your own plan.",
                "focusArea": "Today",
                "nextActions": [
                    {"actionType": "teacher-register", "title": "Open register", "why": "Staff only."},
                    {"actionType": "group-dashboard", "title": "Open my school", "why": "Student-safe."},
                ],
                "quickReplies": [],
            },
            account_role="student",
        )

        self.assertEqual(response["nextActions"][0]["actionType"], "none")
        self.assertEqual(response["nextActions"][1]["actionType"], "group-dashboard")

    def test_copilot_role_configs_have_different_tones_and_faqs(self):
        admin_config = get_copilot_public_config("admin", "groups")
        teacher_config = get_copilot_public_config("teacher", "groups")
        student_config = get_copilot_public_config("student", "groups")

        self.assertNotEqual(admin_config["toneLabel"], teacher_config["toneLabel"])
        self.assertNotEqual(teacher_config["toneLabel"], student_config["toneLabel"])
        self.assertNotEqual(admin_config["starterPrompts"], teacher_config["starterPrompts"])
        self.assertNotEqual(teacher_config["starterPrompts"], student_config["starterPrompts"])
        self.assertIn("bulk import", " ".join(admin_config["starterPrompts"]).lower())

    def test_copilot_system_prompt_changes_by_role(self):
        admin_prompt = build_copilot_system_prompt("admin")
        student_prompt = build_copilot_system_prompt("student")

        self.assertIn("trusted operations adviser", admin_prompt)
        self.assertIn("warm, relatable performance coach for a teenager", student_prompt)
        self.assertIn("Never assume the student's gender", student_prompt)
        self.assertNotEqual(admin_prompt, student_prompt)

    def test_copilot_schema_enumerates_action_types(self):
        action_schema = build_copilot_schema()["properties"]["nextActions"]["items"]["properties"]["actionType"]

        self.assertIn("enum", action_schema)
        self.assertIn("teacher-register", action_schema["enum"])

    def test_build_copilot_action_link_returns_expected_routes(self):
        self.assertEqual(
            build_copilot_action_link("teacher-register", group_id="DEMOHS1", target_date="2026-03-30"),
            {"label": "Open Teacher Desk", "route": "/teacher-desk?group=DEMOHS1&date=2026-03-30"},
        )
        self.assertEqual(
            build_copilot_action_link("goal-plan", group_id="DEMOHS1"),
            {"label": "Open My Progress", "route": "/groups/DEMOHS1?tab=school&section=student-profiles"},
        )
        self.assertEqual(
            build_copilot_action_link("school-admin", group_id="DEMOHS1"),
            {"label": "Open School Admin", "route": "/groups/DEMOHS1?tab=admin"},
        )


if __name__ == "__main__":
    unittest.main()
