import unittest
from datetime import date as real_date
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

from routes import groups as groups_routes


class _FakeDate:
    @classmethod
    def today(cls):
        return real_date(2026, 3, 10)


def _query_with_rows(rows):
    class _Query:
        def filter_by(self, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def all(self):
            return rows

    return _Query()


class GroupSchoolReportTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)

    def test_build_homework_analytics_counts_due_today_and_missing(self):
        students = [SimpleNamespace(id=1), SimpleNamespace(id=2)]
        assignment_due_today = SimpleNamespace(
            id=101,
            title="Maths sheet",
            due_date=real_date(2026, 3, 10),
            created_at=real_date(2026, 3, 9),
            student_ids=[1, 2],
            submissions=[
                SimpleNamespace(student_id=1, status="submitted", completed_date=real_date(2026, 3, 10)),
                SimpleNamespace(student_id=2, status="assigned", completed_date=None),
            ],
            subject=SimpleNamespace(name="Maths"),
            school_class=SimpleNamespace(name="9A"),
            max_points=3,
        )
        assignment_missing = SimpleNamespace(
            id=102,
            title="Science quiz",
            due_date=real_date(2026, 3, 8),
            created_at=real_date(2026, 3, 8),
            student_ids=[1],
            submissions=[],
            subject=SimpleNamespace(name="Science"),
            school_class=SimpleNamespace(name="9A"),
            max_points=4,
        )
        fake_assignment_model = SimpleNamespace(
            query=_query_with_rows([assignment_due_today, assignment_missing]),
            due_date=SimpleNamespace(asc=lambda: None),
            created_at=SimpleNamespace(desc=lambda: None),
        )

        with patch.object(groups_routes, "SchoolHomeworkAssignment", fake_assignment_model), patch.object(groups_routes, "date", _FakeDate):
            result = groups_routes.build_homework_analytics(SimpleNamespace(id=1), students)

        self.assertEqual(result["overview"]["assignmentCount"], 2)
        self.assertEqual(result["overview"]["dueTodayCount"], 2)
        self.assertEqual(result["overview"]["submittedTodayCount"], 1)
        self.assertEqual(result["overview"]["missingCount"], 1)

    def test_export_parent_report_builds_rows_from_profiles_and_latest_contact(self):
        group = SimpleNamespace(id=7)
        student = SimpleNamespace(id=21, username="alex")
        latest_contact = SimpleNamespace(
            contact_type="phone-call",
            contact_date=real_date(2026, 3, 9),
            acknowledged=True,
        )
        parent_profile = SimpleNamespace(
            name="Jordan",
            relationship="Parent",
            preferred_contact="phone-call",
            receives_updates=True,
        )
        fake_group_query = SimpleNamespace(filter_by=lambda **kwargs: SimpleNamespace(first=lambda: group))

        with self.app.test_request_context("/"):
            with patch.object(groups_routes, "get_jwt_identity", return_value=55), patch.object(
                groups_routes, "Group", SimpleNamespace(query=fake_group_query)
            ), patch.object(groups_routes, "can_view_school_operations", return_value=True), patch.object(
                groups_routes, "get_school_students_for_user", return_value=[student]
            ), patch.object(
                groups_routes, "get_parent_profiles", return_value=[parent_profile]
            ), patch.object(
                groups_routes, "get_parent_contact_records", return_value=[latest_contact]
            ), patch.object(
                groups_routes, "csv_response", side_effect=lambda filename, rows, headers: {"filename": filename, "rows": rows, "headers": headers}
            ):
                response = groups_routes.export_parent_report.__wrapped__("group-1")

        self.assertEqual(response["filename"], "parent-summary-report.csv")
        self.assertEqual(len(response["rows"]), 1)
        self.assertEqual(response["rows"][0]["student"], "alex")
        self.assertEqual(response["rows"][0]["parent_name"], "Jordan")
        self.assertEqual(response["rows"][0]["latest_contact_type"], "phone-call")
        self.assertTrue(response["rows"][0]["latest_contact_acknowledged"])

    def test_export_audit_report_filters_out_non_visible_students_for_non_leader(self):
        group = SimpleNamespace(id=9, leader_id=1)
        visible_record = SimpleNamespace(
            student_id=21,
            created_at=SimpleNamespace(isoformat=lambda: "2026-03-10T10:00:00"),
            actor=SimpleNamespace(username="teacher1"),
            student=SimpleNamespace(username="alex"),
            action_type="updated",
            entity_type="lesson-register",
            title="Updated register for alex",
            description="Maths marked green.",
        )
        hidden_record = SimpleNamespace(
            student_id=22,
            created_at=SimpleNamespace(isoformat=lambda: "2026-03-10T11:00:00"),
            actor=SimpleNamespace(username="teacher1"),
            student=SimpleNamespace(username="blake"),
            action_type="created",
            entity_type="intervention",
            title="Logged intervention for blake",
            description="Reflection scheduled.",
        )
        fake_group_query = SimpleNamespace(filter_by=lambda **kwargs: SimpleNamespace(first=lambda: group))

        with self.app.test_request_context("/"):
            with patch.object(groups_routes, "get_jwt_identity", return_value=55), patch.object(
                groups_routes, "Group", SimpleNamespace(query=fake_group_query)
            ), patch.object(groups_routes, "can_view_school_operations", return_value=True), patch.object(
                groups_routes, "get_school_audit_logs", return_value=[visible_record, hidden_record]
            ), patch.object(
                groups_routes, "can_view_student", side_effect=lambda group_obj, current_user_id, student_id: student_id == 21
            ), patch.object(
                groups_routes, "csv_response", side_effect=lambda filename, rows, headers: {"filename": filename, "rows": rows, "headers": headers}
            ):
                response = groups_routes.export_audit_report.__wrapped__("group-9")

        self.assertEqual(response["filename"], "audit-report.csv")
        self.assertEqual(len(response["rows"]), 1)
        self.assertEqual(response["rows"][0]["student"], "alex")
        self.assertEqual(response["rows"][0]["entity_type"], "lesson-register")


if __name__ == "__main__":
    unittest.main()
