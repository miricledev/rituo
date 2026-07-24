import unittest
from datetime import date as real_date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from routes import groups as groups_routes


class _FakeColumn:
    def __eq__(self, other):
        return self

    def __ne__(self, other):
        return self

    def __gt__(self, other):
        return self

    def __or__(self, other):
        return self

    def any(self, **kwargs):
        return self

    def in_(self, values):
        return self

    def desc(self):
        return self

    def asc(self):
        return self


class _FakeGroupQuery:
    def __init__(self, user_groups, role_groups=None, group=None):
        self.user_groups = user_groups
        self.role_groups = role_groups or []
        self.group = group or (user_groups[0] if user_groups else None)

    def filter(self, *args, **kwargs):
        return SimpleNamespace(all=lambda: list(self.user_groups))

    def join(self, *args, **kwargs):
        return SimpleNamespace(filter=lambda *a, **k: SimpleNamespace(all=lambda: list(self.role_groups)))

    def filter_by(self, **kwargs):
        return SimpleNamespace(first=lambda: self.group, first_or_404=lambda: self.group)

    def get(self, value):
        return self.group


class _FakeMessageQuery:
    def __init__(self, group_messages=None, dm_messages=None, system_messages=None):
        self.group_messages = group_messages or []
        self.dm_messages = dm_messages or []
        self.system_messages = system_messages or []
        self.kwargs = {}

    def filter_by(self, **kwargs):
        clone = _FakeMessageQuery(self.group_messages, self.dm_messages, self.system_messages)
        clone.kwargs = kwargs
        return clone

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def all(self):
        if self.kwargs.get("recipient_id") is None:
            return list(self.group_messages)
        if self.kwargs.get("message_type") == "system":
            return list(self.system_messages)
        return list(self.dm_messages)


class _FakeSchoolClassQuery:
    def __init__(self, class_map):
        self.class_map = class_map

    def filter_by(self, **kwargs):
        school_class = self.class_map.get(kwargs.get("id"))
        if school_class and kwargs.get("group_id") == school_class.group_id:
            return SimpleNamespace(first=lambda: school_class)
        return SimpleNamespace(first=lambda: None)

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return sorted(self.class_map.values(), key=lambda item: item.name)


class _FakeEnrollmentQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter_by(self, **kwargs):
        filtered = [
            row
            for row in self.rows
            if all(getattr(row, key) == value for key, value in kwargs.items())
        ]
        return SimpleNamespace(all=lambda: filtered)


class _FakeAssignmentQuery:
    def __init__(self, assignment):
        self.assignment = assignment

    def filter_by(self, **kwargs):
        return SimpleNamespace(first=lambda: self.assignment)


class _FakeSubmissionQuery:
    def __init__(self, submission):
        self.submission = submission

    def filter_by(self, **kwargs):
        return SimpleNamespace(first=lambda: self.submission)


class _FakeHomeworkAssignment:
    def __init__(self, **kwargs):
        self.id = None
        self.submissions = []
        for key, value in kwargs.items():
            setattr(self, key, value)


class _FakeHomeworkSubmission:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", 901)
        self.reviewed_by_id = kwargs.get("reviewed_by_id")
        self.reviewed_at = kwargs.get("reviewed_at")
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self):
        return {
            "id": self.id,
            "studentId": self.student_id,
            "status": self.status,
            "awardedPoints": self.awarded_points,
        }


class _FakeSession:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        for obj in self.added:
            if isinstance(obj, _FakeHomeworkAssignment) and obj.id is None:
                obj.id = 501

    def commit(self):
        return None

    def rollback(self):
        return None


class GroupClassChatTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)

    def test_get_accessible_class_ids_returns_teacher_assignments(self):
        group = SimpleNamespace(group_type="school", leader_id=1, id=9, coaches=[])

        with patch.object(groups_routes, "get_school_role", return_value="teacher"), patch.object(
            groups_routes, "get_teacher_class_ids", return_value={101, 102}
        ):
            result = groups_routes.get_accessible_class_ids(group, user_id=55)

        self.assertEqual(result, {101, 102})

    def test_get_accessible_class_ids_returns_student_enrollments(self):
        group = SimpleNamespace(group_type="school", leader_id=1, id=9, coaches=[])
        enrollments = [
            SimpleNamespace(group_id=9, student_id=77, class_id=201),
            SimpleNamespace(group_id=9, student_id=77, class_id=202),
            SimpleNamespace(group_id=9, student_id=88, class_id=999),
        ]

        with patch.object(groups_routes, "get_school_role", return_value="student"), patch.object(
            groups_routes, "SchoolEnrollment", SimpleNamespace(query=_FakeEnrollmentQuery(enrollments))
        ):
            result = groups_routes.get_accessible_class_ids(group, user_id=77)

        self.assertEqual(result, {201, 202})

    def test_get_group_chat_rejects_inaccessible_class_channel(self):
        group = SimpleNamespace(id=1, group_id="school-1", group_type="school", leader_id=9, members=[], coaches=[])
        target_class = SimpleNamespace(id=202, group_id=1, name="9B")

        fake_group_model = SimpleNamespace(query=_FakeGroupQuery([], group=group))
        fake_school_class_model = SimpleNamespace(query=_FakeSchoolClassQuery({202: target_class}))

        with self.app.test_request_context("/?classId=202"):
            with patch.object(groups_routes, "get_jwt_identity", return_value=55), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(groups_routes, "SchoolClass", fake_school_class_model), patch.object(
                groups_routes, "user_can_access_group", return_value=True
            ), patch.object(
                groups_routes, "get_accessible_class_ids", return_value={101}
            ):
                response, status_code = groups_routes.get_group_chat.__wrapped__("school-1")

        self.assertEqual(status_code, 403)
        self.assertEqual(response.get_json()["error"], "Not authorized for this class channel")

    def test_get_group_chat_returns_channel_unread_counts(self):
        group = SimpleNamespace(id=1, group_id="school-1", group_type="school", leader_id=9, members=[], coaches=[])
        class_a = SimpleNamespace(id=101, group_id=1, name="9A", to_dict=lambda: {"id": 101, "name": "9A"})
        class_b = SimpleNamespace(id=102, group_id=1, name="9B", to_dict=lambda: {"id": 102, "name": "9B"})
        school_wide_message = SimpleNamespace(
            id=1,
            sender_id=22,
            sender=SimpleNamespace(username="teacher-a"),
            recipient_id=None,
            class_id=None,
            school_class=None,
            content="School-wide update",
            created_at=datetime(2026, 3, 10, 8, 0, 0),
            message_type="user",
            read_by="[]",
            to_dict=lambda: {"id": 1, "content": "School-wide update"}
        )
        class_message = SimpleNamespace(
            id=2,
            sender_id=23,
            sender=SimpleNamespace(username="teacher-b"),
            recipient_id=None,
            class_id=101,
            school_class=SimpleNamespace(name="9A"),
            content="Class activity",
            created_at=datetime(2026, 3, 10, 9, 0, 0),
            message_type="system",
            read_by="[]",
            to_dict=lambda: {"id": 2, "content": "Class activity"}
        )
        own_message = SimpleNamespace(
            id=3,
            sender_id=55,
            sender=SimpleNamespace(username="current-user"),
            recipient_id=None,
            class_id=102,
            school_class=SimpleNamespace(name="9B"),
            content="My own post",
            created_at=datetime(2026, 3, 10, 10, 0, 0),
            message_type="user",
            read_by="[]",
            to_dict=lambda: {"id": 3, "content": "My own post"}
        )

        fake_group_model = SimpleNamespace(query=_FakeGroupQuery([], group=group))
        fake_school_class_model = SimpleNamespace(
            group_id=_FakeColumn(),
            id=_FakeColumn(),
            name=_FakeColumn(),
            query=_FakeSchoolClassQuery({101: class_a, 102: class_b})
        )
        fake_message_model = SimpleNamespace(
            created_at=_FakeColumn(),
            query=_FakeMessageQuery(group_messages=[school_wide_message, class_message, own_message])
        )

        with self.app.test_request_context("/?classId=101"):
            with patch.object(groups_routes, "get_jwt_identity", return_value=55), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(
                groups_routes, "SchoolClass", fake_school_class_model
            ), patch.object(
                groups_routes, "Message", fake_message_model
            ), patch.object(
                groups_routes, "user_can_access_group", return_value=True
            ), patch.object(
                groups_routes, "get_accessible_class_ids", return_value={101, 102}
            ):
                response = groups_routes.get_group_chat.__wrapped__("school-1")

        payload = response.get_json()
        self.assertEqual(payload["channel"]["classId"], 101)
        self.assertEqual(payload["channel"]["unreadCount"], 1)
        self.assertEqual(payload["channel"]["schoolWideUnreadCount"], 1)
        self.assertEqual(payload["channel"]["latestActivity"]["content"], "Class activity")
        self.assertEqual(payload["channel"]["schoolWideLatestActivity"]["content"], "School-wide update")
        unread_by_class = {item["id"]: item["unreadCount"] for item in payload["channel"]["accessibleClasses"]}
        latest_by_class = {item["id"]: item["latestActivity"]["content"] if item.get("latestActivity") else None for item in payload["channel"]["accessibleClasses"]}
        self.assertEqual(unread_by_class[101], 1)
        self.assertEqual(unread_by_class[102], 0)
        self.assertEqual(latest_by_class[101], "Class activity")
        self.assertEqual(latest_by_class[102], "My own post")

    def test_get_inbox_filters_class_chat_and_sets_class_deep_link(self):
        user = SimpleNamespace(id=55, created_at=datetime(2026, 3, 1))
        group = SimpleNamespace(id=1, group_id="school-1", name="Rituo High", group_type="school", leader_id=9, members=[], coaches=[])
        accessible_message = SimpleNamespace(
            id=11,
            sender_id=22,
            sender=SimpleNamespace(username="teacher-a"),
            content="Homework set: Algebra worksheet due 2026-03-12.",
            created_at=datetime(2026, 3, 10, 8, 0, 0),
            message_type="system",
            read_by="[]",
            class_id=101,
            school_class=SimpleNamespace(name="9A"),
        )
        hidden_message = SimpleNamespace(
            id=12,
            sender_id=23,
            sender=SimpleNamespace(username="teacher-b"),
            content="Hidden class note",
            created_at=datetime(2026, 3, 10, 9, 0, 0),
            message_type="user",
            read_by="[]",
            class_id=202,
            school_class=SimpleNamespace(name="9B"),
        )

        fake_group_model = SimpleNamespace(
            id=_FakeColumn(),
            leader_id=_FakeColumn(),
            members=_FakeColumn(),
            coaches=_FakeColumn(),
            query=_FakeGroupQuery([group], []),
        )
        fake_message_model = SimpleNamespace(
            created_at=_FakeColumn(),
            sender_id=_FakeColumn(),
            query=_FakeMessageQuery(group_messages=[accessible_message, hidden_message], dm_messages=[], system_messages=[])
        )

        with self.app.test_request_context("/"):
            with patch.object(groups_routes, "get_current_user", return_value=user), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(groups_routes, "Message", fake_message_model), patch.object(
                groups_routes, "SchoolRoleAssignment", SimpleNamespace(group_id=_FakeColumn(), user_id=_FakeColumn())
            ), patch.object(
                groups_routes, "get_accessible_class_ids", return_value={101}
            ):
                response = groups_routes.get_inbox.__wrapped__()

        payload = response.get_json()
        self.assertEqual(len(payload["messages"]), 1)
        self.assertEqual(payload["messages"][0]["class_id"], 101)
        self.assertEqual(payload["messages"][0]["deep_link"], "/groups/school-1?tab=chat&class=101")
        self.assertEqual(payload["counts"]["group"], 1)

    def test_get_unread_count_excludes_inaccessible_class_channels(self):
        user = SimpleNamespace(id=55, created_at=datetime(2026, 3, 1))
        group = SimpleNamespace(id=1, group_id="school-1", name="Rituo High", group_type="school", leader_id=9, members=[], coaches=[])
        accessible_message = SimpleNamespace(read_by="[]", class_id=101)
        hidden_message = SimpleNamespace(read_by="[]", class_id=202)

        fake_group_model = SimpleNamespace(
            id=_FakeColumn(),
            leader_id=_FakeColumn(),
            members=_FakeColumn(),
            coaches=_FakeColumn(),
            query=_FakeGroupQuery([group], []),
        )
        fake_message_model = SimpleNamespace(
            created_at=_FakeColumn(),
            sender_id=_FakeColumn(),
            query=_FakeMessageQuery(group_messages=[accessible_message, hidden_message], dm_messages=[], system_messages=[]),
        )

        with self.app.test_request_context("/"):
            with patch.object(groups_routes, "get_current_user", return_value=user), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(groups_routes, "Message", fake_message_model), patch.object(
                groups_routes, "SchoolRoleAssignment", SimpleNamespace(group_id=_FakeColumn(), user_id=_FakeColumn())
            ), patch.object(
                groups_routes, "get_accessible_class_ids", return_value={101}
            ):
                response = groups_routes.get_unread_count.__wrapped__()

        self.assertEqual(response.get_json()["unread_count"], 1)

    def test_school_group_dm_routes_are_blocked(self):
        group = SimpleNamespace(id=1, group_id="school-1", group_type="school", leader_id=9, members=[], coaches=[])
        fake_group_model = SimpleNamespace(query=_FakeGroupQuery([], group=group))

        with self.app.test_request_context("/"):
            with patch.object(groups_routes, "Group", fake_group_model):
                response, status_code = groups_routes.get_dm.__wrapped__("school-1", 55)

        self.assertEqual(status_code, 403)
        self.assertEqual(response.get_json()["error"], "Direct messages are disabled for school groups")

    def test_school_group_inbox_ignores_dm_messages(self):
        user = SimpleNamespace(id=55, created_at=datetime(2026, 3, 1))
        group = SimpleNamespace(id=1, group_id="school-1", name="Rituo High", group_type="school", leader_id=9, members=[], coaches=[])
        dm_message = SimpleNamespace(
            id=21,
            sender_id=9,
            sender=SimpleNamespace(username="leader"),
            recipient_id=55,
            content="Private note",
            created_at=datetime(2026, 3, 10, 9, 0, 0),
            read_by="[]",
        )

        fake_group_model = SimpleNamespace(
            id=_FakeColumn(),
            leader_id=_FakeColumn(),
            members=_FakeColumn(),
            coaches=_FakeColumn(),
            query=_FakeGroupQuery([group], []),
        )
        fake_message_model = SimpleNamespace(
            created_at=_FakeColumn(),
            sender_id=_FakeColumn(),
            query=_FakeMessageQuery(group_messages=[], dm_messages=[dm_message], system_messages=[]),
        )

        with self.app.test_request_context("/"):
            with patch.object(groups_routes, "get_current_user", return_value=user), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(groups_routes, "Message", fake_message_model), patch.object(
                groups_routes, "SchoolRoleAssignment", SimpleNamespace(group_id=_FakeColumn(), user_id=_FakeColumn())
            ), patch.object(
                groups_routes, "get_accessible_class_ids", return_value=set()
            ):
                response = groups_routes.get_inbox.__wrapped__()

        payload = response.get_json()
        self.assertEqual(payload["counts"]["dm"], 0)
        self.assertEqual(payload["messages"], [])

    def test_create_school_homework_posts_system_message_to_class_chat(self):
        group = SimpleNamespace(id=1, group_id="school-1", group_type="school", leader_id=9)
        assignment_query = _FakeAssignmentQuery(None)
        fake_group_model = SimpleNamespace(query=_FakeGroupQuery([], group=group))
        fake_session = _FakeSession()

        with self.app.test_request_context(
            "/",
            method="POST",
            json={
                "title": "Algebra worksheet",
                "classId": 101,
                "dueDate": "2026-03-12",
                "estimatedMinutes": 20,
                "maxPoints": 3,
            },
        ):
            with patch.object(groups_routes, "get_jwt_identity", return_value=11), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(
                groups_routes, "can_view_school_operations", return_value=True
            ), patch.object(
                groups_routes, "resolve_homework_student_ids", return_value=[31]
            ), patch.object(
                groups_routes, "SchoolHomeworkAssignment", _FakeHomeworkAssignment
            ), patch.object(
                groups_routes, "SchoolHomeworkSubmission", _FakeHomeworkSubmission
            ), patch.object(
                groups_routes, "db", SimpleNamespace(session=fake_session)
            ), patch.object(
                groups_routes, "create_homework_assignment_notifications"
            ), patch.object(
                groups_routes, "create_class_chat_message"
            ) as create_class_chat_message, patch.object(
                groups_routes, "log_school_audit"
            ), patch.object(
                groups_routes, "serialize_homework_assignment_for_user", return_value={"id": 501}
            ):
                response, status_code = groups_routes.create_school_homework.__wrapped__("school-1")

        self.assertEqual(status_code, 201)
        create_class_chat_message.assert_called_once_with(
            group,
            101,
            11,
            "Homework set: Algebra worksheet due 2026-03-12.",
            message_type="system",
        )

    def test_submit_school_homework_posts_submission_to_class_chat(self):
        group = SimpleNamespace(
            id=1,
            group_id="school-1",
            group_type="school",
            leader_id=9,
            members=[SimpleNamespace(id=31, username="Rohan")],
        )
        assignment = SimpleNamespace(
            id=501,
            class_id=101,
            title="Algebra worksheet",
            due_date=real_date(2026, 3, 12),
            allow_late=True,
            student_ids=[31],
        )
        submission = _FakeHomeworkSubmission(
            id=901,
            assignment_id=501,
            group_id=1,
            student_id=31,
            status="assigned",
            awarded_points=0,
        )
        fake_group_model = SimpleNamespace(query=_FakeGroupQuery([], group=group))
        fake_session = _FakeSession()

        with self.app.test_request_context(
            "/",
            method="POST",
            json={"studentId": 31, "completedDate": "2026-03-10"},
        ):
            with patch.object(groups_routes, "get_jwt_identity", return_value=31), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(
                groups_routes, "SchoolHomeworkAssignment", SimpleNamespace(query=_FakeAssignmentQuery(assignment))
            ), patch.object(
                groups_routes, "SchoolHomeworkSubmission", SimpleNamespace(query=_FakeSubmissionQuery(submission))
            ), patch.object(
                groups_routes, "db", SimpleNamespace(session=fake_session)
            ), patch.object(
                groups_routes, "calculate_homework_submission_points", return_value=3
            ), patch.object(
                groups_routes, "create_class_chat_message"
            ) as create_class_chat_message, patch.object(
                groups_routes, "log_school_audit"
            ), patch.object(
                groups_routes, "serialize_homework_assignment_for_user", return_value={"id": 501}
            ), patch.object(
                groups_routes, "serialize_school_profile", return_value={"student": {"id": 31}}
            ):
                response, status_code = groups_routes.submit_school_homework.__wrapped__("school-1", 501)

        self.assertEqual(status_code, 200)
        create_class_chat_message.assert_called_once_with(
            group,
            101,
            31,
            "Rohan submitted homework: Algebra worksheet.",
            message_type="system",
        )
        self.assertEqual(response.get_json()["submission"]["awardedPoints"], 3)

    def test_mark_school_homework_posts_review_to_class_chat(self):
        group = SimpleNamespace(
            id=1,
            group_id="school-1",
            group_type="school",
            leader_id=9,
            members=[SimpleNamespace(id=31, username="Rohan")],
        )
        assignment = SimpleNamespace(
            id=501,
            class_id=101,
            title="Algebra worksheet",
            student_ids=[31],
        )
        submission = _FakeHomeworkSubmission(
            id=901,
            assignment_id=501,
            group_id=1,
            student_id=31,
            status="submitted",
            awarded_points=3,
            completed_date=real_date(2026, 3, 10),
        )
        fake_group_model = SimpleNamespace(query=_FakeGroupQuery([], group=group))
        fake_session = _FakeSession()

        with self.app.test_request_context(
            "/",
            method="POST",
            json={"studentId": 31, "status": "reviewed", "awardedPoints": 4},
        ):
            with patch.object(groups_routes, "get_jwt_identity", return_value=11), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(
                groups_routes, "can_view_school_operations", return_value=True
            ), patch.object(
                groups_routes, "SchoolHomeworkAssignment", SimpleNamespace(query=_FakeAssignmentQuery(assignment))
            ), patch.object(
                groups_routes, "SchoolHomeworkSubmission", SimpleNamespace(query=_FakeSubmissionQuery(submission))
            ), patch.object(
                groups_routes, "db", SimpleNamespace(session=fake_session)
            ), patch.object(
                groups_routes, "create_class_chat_message"
            ) as create_class_chat_message, patch.object(
                groups_routes, "log_school_audit"
            ), patch.object(
                groups_routes, "serialize_homework_assignment_for_user", return_value={"id": 501}
            ), patch.object(
                groups_routes, "serialize_school_profile", return_value={"student": {"id": 31}}
            ):
                response, status_code = groups_routes.mark_school_homework.__wrapped__("school-1", 501)

        self.assertEqual(status_code, 200)
        create_class_chat_message.assert_called_once_with(
            group,
            101,
            11,
            "Homework reviewed: Rohan - Algebra worksheet (reviewed).",
            message_type="system",
        )
        self.assertEqual(response.get_json()["submission"]["awardedPoints"], 4)

    def test_remind_school_homework_posts_reminder_to_class_chat(self):
        group = SimpleNamespace(
            id=1,
            group_id="school-1",
            group_type="school",
            leader_id=9,
            members=[SimpleNamespace(id=31, username="Rohan")],
        )
        assignment = SimpleNamespace(
            id=501,
            class_id=101,
            title="Algebra worksheet",
            student_ids=[31],
        )
        fake_group_model = SimpleNamespace(query=_FakeGroupQuery([], group=group))
        fake_session = _FakeSession()

        with self.app.test_request_context(
            "/",
            method="POST",
            json={"studentId": 31},
        ):
            with patch.object(groups_routes, "get_jwt_identity", return_value=11), patch.object(
                groups_routes, "Group", fake_group_model
            ), patch.object(
                groups_routes, "can_view_school_operations", return_value=True
            ), patch.object(
                groups_routes, "SchoolHomeworkAssignment", SimpleNamespace(query=_FakeAssignmentQuery(assignment))
            ), patch.object(
                groups_routes, "db", SimpleNamespace(session=fake_session)
            ), patch.object(
                groups_routes, "create_homework_reminder_notifications", return_value=1
            ), patch.object(
                groups_routes, "create_class_chat_message"
            ) as create_class_chat_message, patch.object(
                groups_routes, "log_school_audit"
            ):
                response, status_code = groups_routes.remind_school_homework.__wrapped__("school-1", 501)

        self.assertEqual(status_code, 200)
        create_class_chat_message.assert_called_once_with(
            group,
            101,
            11,
            "Homework reminder sent: Algebra worksheet for Rohan.",
            message_type="system",
        )
        self.assertEqual(response.get_json()["remindedCount"], 1)


if __name__ == "__main__":
    unittest.main()
