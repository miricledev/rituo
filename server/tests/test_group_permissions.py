import unittest
from types import SimpleNamespace
from unittest.mock import patch

from routes import groups as groups_routes


class GroupPermissionTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
