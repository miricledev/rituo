import unittest

from utils.ai_school import (
    build_copilot_schema,
    build_copilot_action_link,
    build_copilot_system_prompt,
    get_copilot_public_config,
    normalize_copilot_response,
    normalize_daily_schedule,
    normalize_habit_draft,
    normalize_student_plan,
)


class GroupAiHelperTests(unittest.TestCase):
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
        self.assertIn("positive, age-appropriate performance coach", student_prompt)
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
            {"label": "Open Students", "route": "/groups/DEMOHS1?section=student-profiles"},
        )
        self.assertEqual(
            build_copilot_action_link("school-admin", group_id="DEMOHS1"),
            {"label": "Open School Admin", "route": "/groups/DEMOHS1?tab=admin"},
        )


if __name__ == "__main__":
    unittest.main()
