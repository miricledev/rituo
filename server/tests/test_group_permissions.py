import json
import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import Mock, patch

from routes import groups as groups_routes


class GroupPermissionTests(unittest.TestCase):
    @staticmethod
    def _ai_habit(student_id):
        return {
            "name": f"Focused routine {student_id}",
            "description": "Complete a focused activity",
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
            "linkedGoalId": "",
        }

    def test_personalized_habits_batch_all_31_students(self):
        students = [
            {"id": str(student_id), "name": f"student-{student_id}", "goals": []}
            for student_id in range(1, 32)
        ]

        def fake_structured_response(**kwargs):
            payload = json.loads(kwargs["user_prompt"])
            return {
                "summary": "Batch complete.",
                "studentHabitSets": [
                    {
                        "studentId": student["id"],
                        "studentName": student["name"],
                        "habits": [self._ai_habit(student["id"])],
                    }
                    for student in payload["students"]
                ],
                "warnings": [],
            }

        with patch.object(
            groups_routes,
            "create_structured_response",
            side_effect=fake_structured_response,
        ) as create_response:
            draft = groups_routes.generate_personalized_habit_draft(
                "Test School",
                "Create focused routines for every student.",
                [],
                students,
            )

        self.assertEqual(create_response.call_count, 4)
        self.assertEqual(len(draft["studentHabitSets"]), 31)
        self.assertTrue(all(student_set["habits"] for student_set in draft["studentHabitSets"]))
        for call in create_response.call_args_list:
            payload = json.loads(call.kwargs["user_prompt"])
            self.assertLessEqual(payload["expectedStudentCount"], groups_routes.AI_HABIT_STUDENT_BATCH_SIZE)

    def test_personalized_habits_reject_permanently_missing_students(self):
        students = [
            {"id": str(student_id), "name": f"student-{student_id}", "goals": []}
            for student_id in range(1, 4)
        ]

        with patch.object(
            groups_routes,
            "create_structured_response",
            return_value={
                "summary": "",
                "studentHabitSets": [],
                "warnings": [],
            },
        ):
            with self.assertRaises(groups_routes.OpenAIResponsesError):
                groups_routes.generate_personalized_habit_draft(
                    "Test School",
                    "Create focused routines for every student.",
                    [],
                    students,
                )

    def test_challenge_member_habits_preserve_existing_joined_date(self):
        group = SimpleNamespace(members=[SimpleNamespace(id=11), SimpleNamespace(id=12)])

        normalized = groups_routes.normalize_challenge_member_habits(
            group,
            [
                {"member": 11, "habits": [{"name": "Read"}]},
                {"member": {"id": 12}, "habits": [{"name": "Train"}]},
            ],
            joined_at_by_member={11: "2026-01-15"},
            default_joined_at="2026-02-01",
            activation_at_by_member={11: "2026-01-16T02:52:00+00:00"},
            default_activation_at="2026-02-02T02:52:00+00:00",
        )

        self.assertEqual(normalized[0]["joinedAt"], "2026-01-15")
        self.assertEqual(normalized[1]["joinedAt"], "2026-02-01")
        self.assertEqual(normalized[0]["activationAt"], "2026-01-16T02:52:00+00:00")
        self.assertEqual(normalized[1]["activationAt"], "2026-02-02T02:52:00+00:00")
        self.assertEqual([entry["member"] for entry in normalized], [11, 12])

    def test_challenge_member_habits_reject_students_outside_group(self):
        group = SimpleNamespace(members=[SimpleNamespace(id=11)])

        with self.assertRaisesRegex(ValueError, "does not belong"):
            groups_routes.normalize_challenge_member_habits(
                group,
                [{"member": 99, "habits": [{"name": "Invalid"}]}],
            )

    def test_challenge_member_habits_require_nonempty_habits(self):
        group = SimpleNamespace(members=[SimpleNamespace(id=11)])

        with self.assertRaisesRegex(ValueError, "requires at least one habit"):
            groups_routes.normalize_challenge_member_habits(
                group,
                [{"member": 11, "habits": []}],
            )

    def test_staff_habits_preserve_progress_when_edited(self):
        existing = [{
            'id': 'habit-one',
            'name': 'Old name',
            'progress': [{'date': '2026-08-08', 'completed': True}],
        }]
        normalized = groups_routes.normalize_staff_challenge_habits([{
            'id': 'habit-one',
            'name': 'Updated name',
            'habitType': 'boolean',
            'combatType': 'defence',
            'scheduleDays': ['Monday', 'Wednesday'],
            'scheduleTime': '17:30',
            'durationMinutes': 20,
        }], existing)

        self.assertEqual(normalized[0]['name'], 'Updated name')
        self.assertEqual(normalized[0]['progress'], existing[0]['progress'])
        self.assertEqual(normalized[0]['combatType'], 'defence')

    def test_staff_slacker_callout_prioritizes_member_without_challenge(self):
        callout = groups_routes.build_staff_slacker_callout([
            {'memberId': 1, 'name': 'Alex', 'challenge': {'id': 1}, 'score': 80, 'stats': {'summary': {'possibleUnits': 3}}},
            {'memberId': 2, 'name': 'Jordan', 'challenge': None, 'score': 0, 'stats': None},
        ])

        self.assertTrue(callout['active'])
        self.assertEqual(callout['memberId'], 2)
        self.assertEqual(callout['reason'], 'no-challenge')

    def test_planner_member_includes_staff_group_founder(self):
        founder = SimpleNamespace(
            id=41,
            is_active=True,
            account_role='admin',
            first_name='Rohan',
            username='rohan',
        )
        group = SimpleNamespace(group_type='staff', leader=founder, members=[])

        self.assertTrue(groups_routes.is_planner_member(group, founder.id))

    def test_planner_context_uses_staff_members_personal_challenge(self):
        challenge = SimpleNamespace(
            member_id=41,
            start_date=datetime(2026, 8, 8),
            created_at=datetime(2026, 8, 9, 2, 52),
            habits=[{'name': 'Plan tomorrow'}],
        )
        query = Mock()
        query.filter_by.return_value.order_by.return_value.first.return_value = challenge
        model = Mock()
        model.query = query

        with patch.object(groups_routes, 'StaffPersonalChallenge', model):
            selected_challenge, member_habit = groups_routes._planner_challenge_context(
                SimpleNamespace(id=7, group_type='staff'),
                41,
            )

        self.assertIs(selected_challenge, challenge)
        self.assertEqual(member_habit['member'], 41)
        self.assertEqual(member_habit['habits'][0]['name'], 'Plan tomorrow')

    def test_planner_context_targets_submitted_staff_challenge(self):
        challenge = SimpleNamespace(
            member_id=41,
            start_date=datetime(2026, 8, 8),
            created_at=datetime(2026, 8, 9, 2, 52),
            habits=[{'name': 'Gym'}],
        )
        base_query = Mock()
        member_query = Mock()
        challenge_query = Mock()
        base_query.filter_by.return_value = member_query
        member_query.filter_by.return_value = challenge_query
        challenge_query.order_by.return_value.first.return_value = challenge
        model = Mock()
        model.query = base_query

        with patch.object(groups_routes, 'StaffPersonalChallenge', model):
            selected_challenge, _ = groups_routes._planner_challenge_context(
                SimpleNamespace(id=7, group_type='staff'),
                41,
                challenge_id='23',
            )

        member_query.filter_by.assert_called_once_with(id=23)
        self.assertIs(selected_challenge, challenge)

    def test_planner_school_context_adds_commute_around_configured_day(self):
        group = SimpleNamespace(
            group_type='school',
            school_day_config={
                'timezone': 'Europe/London',
                'startTime': '08:30',
                'endTime': '15:30',
                'lessonMinutes': 60,
                'breaks': [{'name': 'Lunch', 'startTime': '12:30', 'endTime': '13:15'}],
            },
            school_timetable=[],
        )

        context, commute_items = groups_routes._planner_school_day_context(
            group,
            'Monday',
            SimpleNamespace(school_commute_minutes=25),
        )

        self.assertEqual(context['commuteMinutesEachWay'], 25)
        self.assertEqual(context['breaks'][0]['name'], 'Lunch')
        self.assertEqual(commute_items[0]['startTime'], '08:05')
        self.assertEqual(commute_items[1]['endTime'], '15:55')

    def test_planner_school_context_does_not_create_default_weekend(self):
        group = SimpleNamespace(
            group_type='school',
            school_day_config={'startTime': '08:30', 'endTime': '15:30'},
            school_timetable=[],
        )

        context, commute_items = groups_routes._planner_school_day_context(
            group,
            'Sunday',
            SimpleNamespace(school_commute_minutes=30),
        )

        self.assertEqual(context, {})
        self.assertEqual(commute_items, [])

    def test_challenge_publication_notifies_each_assigned_student_once(self):
        group = SimpleNamespace(
            members=[
                SimpleNamespace(id=11, account_role="student"),
                SimpleNamespace(id=12, account_role="student"),
                SimpleNamespace(id=13, account_role="teacher"),
            ],
        )
        challenge = SimpleNamespace(
            start_date=datetime(2026, 8, 1),
            end_date=datetime(2026, 8, 14),
        )
        member_habits = [
            {"member": 11, "habits": [{"name": "Read"}]},
            {"member": {"id": 11}, "habits": [{"name": "Duplicate"}]},
            {"member": 12, "habits": []},
            {"member": 13, "habits": [{"name": "Teacher habit"}]},
        ]

        with patch.object(groups_routes, "create_system_alert") as create_alert:
            notified_count = groups_routes.create_challenge_published_notifications(
                group,
                challenge,
                member_habits,
            )

        self.assertEqual(notified_count, 1)
        create_alert.assert_called_once()
        self.assertEqual(create_alert.call_args.args[1], 11)
        self.assertIn("New challenge published", create_alert.call_args.args[2])

    def test_timetable_conflicts_detect_teacher_room_and_student_collisions(self):
        entries = [
            {
                "id": "one",
                "weekday": "Monday",
                "startTime": "09:00",
                "endTime": "10:00",
                "classId": 1,
                "className": "10A Maths",
                "teacherId": 4,
                "roomId": 7,
                "studentIds": [20, 21],
            },
            {
                "id": "two",
                "weekday": "Monday",
                "startTime": "09:30",
                "endTime": "10:30",
                "classId": 2,
                "className": "10B Science",
                "teacherId": 4,
                "roomId": 7,
                "studentIds": [21, 22],
            },
        ]

        conflicts = groups_routes.find_timetable_conflicts(entries, {
            "startTime": "08:30",
            "endTime": "15:30",
            "lessonMinutes": 60,
            "breaks": [],
        })

        collision = next(item for item in conflicts if item["type"] == "collision")
        self.assertIn("teacher", collision["message"])
        self.assertIn("room", collision["message"])
        self.assertIn("students", collision["message"])

    def test_timetable_conflicts_detect_break_overlap(self):
        conflicts = groups_routes.find_timetable_conflicts(
            [{
                "id": "one",
                "weekday": "Monday",
                "startTime": "10:20",
                "endTime": "11:00",
                "classId": 1,
                "className": "10A Maths",
                "studentIds": [],
            }],
            {
                "startTime": "08:30",
                "endTime": "15:30",
                "lessonMinutes": 60,
                "breaks": [{"name": "Morning break", "startTime": "10:30", "endTime": "10:50"}],
            },
        )

        self.assertTrue(any(item["type"] == "break-overlap" for item in conflicts))

    def test_can_manage_student_allows_leader(self):
        group = SimpleNamespace(
            leader_id=10,
            id=5,
            members=[SimpleNamespace(id=21)],
            coaches=[],
        )

        self.assertTrue(groups_routes.can_manage_student(group, current_user_id=10, student_id=21))

    def test_can_manage_student_allows_same_student_member(self):
        group = SimpleNamespace(
            leader_id=10,
            id=5,
            members=[SimpleNamespace(id=21)],
            coaches=[],
        )

        with patch.object(groups_routes, "user_has_school_role", return_value=False):
            self.assertTrue(groups_routes.can_manage_student(group, current_user_id=21, student_id=21))

    def test_can_manage_student_allows_teacher_for_enrolled_student(self):
        group = SimpleNamespace(
            leader_id=10,
            id=5,
            members=[SimpleNamespace(id=21), SimpleNamespace(id=22)],
            coaches=[],
        )

        with patch.object(groups_routes, "get_school_role", return_value="teacher"), patch.object(
            groups_routes, "user_has_school_role", side_effect=lambda group_id, user_id, roles: "teacher" in roles
        ), patch.object(
            groups_routes,
            "get_students_for_teacher",
            return_value=[SimpleNamespace(id=22)],
        ):
            self.assertTrue(groups_routes.can_manage_student(group, current_user_id=99, student_id=22))
            self.assertFalse(groups_routes.can_manage_student(group, current_user_id=99, student_id=21))

    def test_can_manage_student_allows_assigned_coach_only(self):
        group = SimpleNamespace(
            leader_id=10,
            id=5,
            members=[SimpleNamespace(id=21), SimpleNamespace(id=22)],
            coaches=[SimpleNamespace(id=77)],
        )
        fake_assignment_query = SimpleNamespace(
            filter_by=lambda **kwargs: SimpleNamespace(
                first=lambda: SimpleNamespace(student_id=22) if kwargs.get("student_id") == 22 else None
            )
        )

        with patch.object(groups_routes, "get_school_role", return_value=None), patch.object(
            groups_routes, "user_has_school_role", return_value=False
        ), patch.object(
            groups_routes, "CoachAssignment", SimpleNamespace(query=fake_assignment_query)
        ):
            self.assertTrue(groups_routes.can_manage_student(group, current_user_id=77, student_id=22))
            self.assertFalse(groups_routes.can_manage_student(group, current_user_id=77, student_id=21))

    def test_can_manage_student_allows_pastoral_lead(self):
        group = SimpleNamespace(
            leader_id=10,
            id=5,
            members=[SimpleNamespace(id=21)],
            coaches=[],
        )

        with patch.object(groups_routes, "can_manage_group", return_value=False), patch.object(
            groups_routes, "get_school_role", return_value="pastoral-lead"
        ):
            self.assertTrue(groups_routes.can_manage_student(group, current_user_id=66, student_id=21))

    def test_can_manage_student_allows_school_role_coach_assignment(self):
        group = SimpleNamespace(
            leader_id=10,
            id=5,
            members=[SimpleNamespace(id=21), SimpleNamespace(id=22)],
            coaches=[],
        )
        fake_assignment_query = SimpleNamespace(
            filter_by=lambda **kwargs: SimpleNamespace(
                first=lambda: SimpleNamespace(student_id=22) if kwargs.get("student_id") == 22 else None
            )
        )

        with patch.object(groups_routes, "can_manage_group", return_value=False), patch.object(
            groups_routes, "get_school_role", return_value="coach"
        ), patch.object(
            groups_routes, "CoachAssignment", SimpleNamespace(query=fake_assignment_query)
        ):
            self.assertTrue(groups_routes.can_manage_student(group, current_user_id=77, student_id=22))
            self.assertFalse(groups_routes.can_manage_student(group, current_user_id=77, student_id=21))

    def test_can_manage_school_allows_headteacher_but_not_plain_teacher(self):
        group = SimpleNamespace(leader_id=10, id=5, is_legacy=False)
        admin_user = SimpleNamespace(id=55, is_active=True, account_role="admin")
        teacher_user = SimpleNamespace(id=56, is_active=True, account_role="teacher")

        with patch.object(groups_routes, "User", SimpleNamespace(query=SimpleNamespace(get=lambda user_id: admin_user))), patch.object(
            groups_routes, "user_has_school_role", side_effect=lambda group_id, user_id, roles: "headteacher" in roles
        ):
            self.assertTrue(groups_routes.can_manage_school(group, current_user_id=55))

        with patch.object(groups_routes, "User", SimpleNamespace(query=SimpleNamespace(get=lambda user_id: teacher_user))), patch.object(
            groups_routes, "user_has_school_role", side_effect=lambda group_id, user_id, roles: "teacher" in roles
        ):
            self.assertFalse(groups_routes.can_manage_school(group, current_user_id=56))

    def test_can_view_school_operations_allows_teacher_and_coach(self):
        teacher_group = SimpleNamespace(leader_id=10, id=5, coaches=[])
        with patch.object(groups_routes, "can_manage_school", return_value=False), patch.object(
            groups_routes, "user_has_school_role", side_effect=lambda group_id, user_id, roles: "teacher" in roles
        ):
            self.assertTrue(groups_routes.can_view_school_operations(teacher_group, current_user_id=44))

        coach_group = SimpleNamespace(leader_id=10, id=5, coaches=[SimpleNamespace(id=88)])
        with patch.object(groups_routes, "can_manage_school", return_value=False), patch.object(
            groups_routes, "user_has_school_role", return_value=False
        ):
            self.assertTrue(groups_routes.can_view_school_operations(coach_group, current_user_id=88))

        pastoral_group = SimpleNamespace(leader_id=10, id=5, coaches=[])
        with patch.object(groups_routes, "can_manage_school", return_value=False), patch.object(
            groups_routes,
            "user_has_school_role",
            side_effect=lambda group_id, user_id, roles: "pastoral-lead" in roles,
        ):
            self.assertTrue(groups_routes.can_view_school_operations(pastoral_group, current_user_id=89))

    def test_ai_weekly_templates_keep_only_plannable_items(self):
        templates = groups_routes._normalize_ai_weekly_templates({
            "Monday": [
                {
                    "title": "Focused study",
                    "itemType": "habit",
                    "habitIndex": 3,
                    "startTime": "16:00",
                    "endTime": "17:00",
                },
                {
                    "title": "Private appointment",
                    "itemType": "manual",
                    "startTime": "17:00",
                    "endTime": "18:00",
                },
            ],
            "Notaday": [
                {
                    "title": "Wrong day",
                    "itemType": "habit",
                    "habitIndex": 1,
                    "startTime": "12:00",
                    "endTime": "12:30",
                },
            ],
        })

        self.assertEqual(list(templates), ["Monday"])
        self.assertEqual(len(templates["Monday"]), 1)
        self.assertEqual(templates["Monday"][0]["habitIndex"], 3)


if __name__ == "__main__":
    unittest.main()
