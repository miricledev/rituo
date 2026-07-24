import unittest
from datetime import date as real_date
from types import SimpleNamespace
from unittest.mock import patch

from routes import groups as groups_routes


class _FakeDate:
    @classmethod
    def today(cls):
        return real_date(2026, 3, 10)


class _FakeColumn:
    def __eq__(self, other):
        return ("eq", other)

    def __ge__(self, other):
        return ("ge", other)

    def in_(self, values):
        return ("in", tuple(values))

    def desc(self):
        return self


class _FakeInterventionRecord:
    query = None
    group_id = _FakeColumn()
    student_id = _FakeColumn()
    status = _FakeColumn()
    intervention_date = _FakeColumn()


class GroupSchoolHelperTests(unittest.TestCase):
    def test_calculate_performance_card_points_penalizes_missing_signature_and_refocus(self):
        checkpoints = [
            {
                "slot": "morning",
                "attended": True,
                "engagement": "green",
                "refocus": False,
                "teacherSignature": "Ms Smith",
            },
            {
                "slot": "midday",
                "attended": False,
                "engagement": "red",
                "refocus": True,
                "teacherSignature": "Mr Jones",
            },
            {
                "slot": "endOfDay",
                "attended": True,
                "engagement": "amber",
                "refocus": False,
                "teacherSignature": "",
            },
        ]

        normalized, total_points = groups_routes.calculate_performance_card_points(checkpoints)

        self.assertEqual(len(normalized), 3)
        self.assertEqual(normalized[0]["points"], 4)
        self.assertEqual(normalized[1]["points"], -13)
        self.assertEqual(normalized[2]["points"], -4)
        self.assertEqual(total_points, -13)

    def test_calculate_lesson_register_points_respects_attendance_engagement_and_refocus(self):
        self.assertEqual(
            groups_routes.calculate_lesson_register_points("present", "green", False),
            4,
        )
        self.assertEqual(
            groups_routes.calculate_lesson_register_points("late", "amber", False),
            0,
        )
        self.assertEqual(
            groups_routes.calculate_lesson_register_points("absent", "red", True),
            -13,
        )

    def test_build_school_trend_marks_worsening_when_net_score_drops(self):
        records = [
            SimpleNamespace(
                week_ending=groups_routes.date(2026, 3, 3),
                positive_points=10,
                negative_points=2,
                truancy_incidents=0,
            ),
            SimpleNamespace(
                week_ending=groups_routes.date(2026, 3, 10),
                positive_points=3,
                negative_points=5,
                truancy_incidents=1,
            ),
        ]

        trend = groups_routes.build_school_trend(records)

        self.assertEqual(trend["status"], "worsening")
        self.assertEqual(trend["points"][0]["netScore"], 8)
        self.assertEqual(trend["points"][1]["netScore"], -4)

    def test_normalize_timetable_entries_filters_invalid_rows_and_sorts(self):
        entries = [
            {
                "id": "b",
                "weekday": "Tuesday",
                "subject": "Science",
                "startTime": "11:00",
                "endTime": "12:00",
                "studentIds": [5, "3", "bad", 5],
            },
            {
                "id": "a",
                "weekday": "Monday",
                "subject": "Maths",
                "startTime": "09:00",
                "endTime": "10:00",
                "studentIds": ["7"],
            },
            {
                "id": "skip-me",
                "weekday": "Nope",
                "subject": "",
                "startTime": "",
                "endTime": "",
            },
        ]

        normalized = groups_routes.normalize_timetable_entries(entries)

        self.assertEqual(len(normalized), 2)
        self.assertEqual(normalized[0]["id"], "a")
        self.assertEqual(normalized[1]["id"], "b")
        self.assertEqual(normalized[1]["studentIds"], [3, 5])

    def test_build_daily_points_summary_marks_recovered_when_habits_offset_bad_school_day(self):
        group = SimpleNamespace(id=99)

        with patch.object(groups_routes, "calculate_today_lesson_register_metrics", return_value={
            "entries": [],
            "expectedLessons": 5,
            "loggedLessons": 5,
            "points": -2,
            "date": "2026-03-10",
        }), patch.object(groups_routes, "calculate_today_performance_card_metrics", return_value={
            "card": None,
            "points": 0,
            "logged": False,
        }), patch.object(groups_routes, "calculate_today_behaviour_metrics", return_value={
            "points": 0,
            "events": [],
            "count": 0,
        }), patch.object(groups_routes, "build_student_homework_summary", return_value={
            "dailyPoints": 0,
            "weeklyPoints": 0,
            "assignments": [],
            "upcomingCount": 0,
            "missingCount": 0,
            "dueTodayCount": 0,
            "submittedTodayCount": 0,
        }), patch.object(groups_routes, "calculate_today_habit_recovery_metrics", return_value={
            "completionRate": 100,
            "completedCount": 3,
            "scheduledCount": 3,
            "recoveryPoints": 3,
        }), patch.object(groups_routes, "date", _FakeDate):
            summary = groups_routes.build_daily_points_summary(group, student_id=7)

        self.assertEqual(summary["schoolSource"], "lesson-register")
        self.assertEqual(summary["schoolPoints"], -2)
        self.assertEqual(summary["combinedPoints"], 1)
        self.assertEqual(summary["status"], "recovered")
        self.assertEqual(summary["remainingRecoveryPotential"], 0)

    def test_build_daily_points_summary_uses_performance_card_when_no_lessons_logged(self):
        group = SimpleNamespace(id=99)

        with patch.object(groups_routes, "calculate_today_lesson_register_metrics", return_value={
            "entries": [],
            "expectedLessons": 4,
            "loggedLessons": 0,
            "points": 0,
            "date": "2026-03-10",
        }), patch.object(groups_routes, "calculate_today_performance_card_metrics", return_value={
            "card": {"id": 1},
            "points": 2,
            "logged": True,
        }), patch.object(groups_routes, "calculate_today_behaviour_metrics", return_value={
            "points": 0,
            "events": [],
            "count": 0,
        }), patch.object(groups_routes, "build_student_homework_summary", return_value={
            "dailyPoints": 0,
            "weeklyPoints": 0,
            "assignments": [],
            "upcomingCount": 0,
            "missingCount": 0,
            "dueTodayCount": 0,
            "submittedTodayCount": 0,
        }), patch.object(groups_routes, "calculate_today_habit_recovery_metrics", return_value={
            "completionRate": 50,
            "completedCount": 1,
            "scheduledCount": 2,
            "recoveryPoints": 1,
        }), patch.object(groups_routes, "date", _FakeDate):
            summary = groups_routes.build_daily_points_summary(group, student_id=7)

        self.assertEqual(summary["schoolSource"], "performance-card")
        self.assertEqual(summary["combinedPoints"], 3)
        self.assertEqual(summary["status"], "on-track")

    def test_calculate_goal_activity_status_unlocks_when_thresholds_are_met(self):
        group = SimpleNamespace(id=42)
        fake_query = SimpleNamespace(filter=lambda *args, **kwargs: fake_query)
        fake_query.order_by = lambda *args, **kwargs: fake_query
        fake_query.first = lambda: None
        fake_record = SimpleNamespace(
            query=fake_query,
            group_id=_FakeInterventionRecord.group_id,
            student_id=_FakeInterventionRecord.student_id,
            status=_FakeInterventionRecord.status,
            intervention_date=_FakeInterventionRecord.intervention_date,
        )

        with patch.object(groups_routes, "get_member_habit_entry", return_value={
            "goalActivity": "Boxing session",
            "fallbackActivity": "Mindset lesson",
        }), patch.object(groups_routes, "build_attendance_summary", return_value={
            "attendanceRate": 100,
        }), patch.object(groups_routes, "build_recent_student_risk_window", return_value={
            "negativeDays": 0,
            "absenceDays": 0,
            "latenessDays": 0,
        }), patch.object(groups_routes, "InterventionRecord", fake_record), patch.object(
            groups_routes, "date", _FakeDate
        ):
            status = groups_routes.calculate_goal_activity_status(
                group,
                student_id=5,
                latest_score=2,
                performance_card={"weeklyPoints": 8},
                habit_recovery={"recoveryPoints": 2},
            )

        self.assertTrue(status["unlocked"])
        self.assertEqual(status["statusLabel"], "Unlocked")
        self.assertEqual(status["activity"], "Boxing session")

    def test_calculate_goal_activity_status_locks_when_attendance_is_low(self):
        group = SimpleNamespace(id=42)
        fake_query = SimpleNamespace(filter=lambda *args, **kwargs: fake_query)
        fake_query.order_by = lambda *args, **kwargs: fake_query
        fake_query.first = lambda: None
        fake_record = SimpleNamespace(
            query=fake_query,
            group_id=_FakeInterventionRecord.group_id,
            student_id=_FakeInterventionRecord.student_id,
            status=_FakeInterventionRecord.status,
            intervention_date=_FakeInterventionRecord.intervention_date,
        )

        with patch.object(groups_routes, "get_member_habit_entry", return_value={
            "goalActivity": "Boxing session",
            "fallbackActivity": "Reflection session",
        }), patch.object(groups_routes, "build_attendance_summary", return_value={
            "attendanceRate": 72,
        }), patch.object(groups_routes, "build_recent_student_risk_window", return_value={
            "negativeDays": 0,
            "absenceDays": 0,
            "latenessDays": 0,
        }), patch.object(groups_routes, "InterventionRecord", fake_record), patch.object(
            groups_routes, "date", _FakeDate
        ):
            status = groups_routes.calculate_goal_activity_status(
                group,
                student_id=5,
                latest_score=4,
                performance_card={"weeklyPoints": 9},
                habit_recovery={"recoveryPoints": 3},
            )

        self.assertFalse(status["unlocked"])
        self.assertTrue(status["lockReasons"]["attendance"])
        self.assertIn("attendance", status["reason"].lower())


if __name__ == "__main__":
    unittest.main()
