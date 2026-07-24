from datetime import date, datetime, timedelta
import os
import random

from dotenv import load_dotenv
from flask import Flask
from werkzeug.security import generate_password_hash

from db.models import (
    db,
    user_active_challenges,
    user_groups,
    user_leading_groups,
    group_coaches,
    User,
    Group,
    GroupChallenge,
    Message,
    CoachAssignment,
    StudentGoal,
    SchoolImpactRecord,
    PerformanceCard,
    LessonRegister,
    InterventionRecord,
    ParentContactRecord,
    ParentProfile,
    SchoolAuditLog,
    SchoolRoleAssignment,
    SchoolSubject,
    SchoolRoom,
    SchoolClass,
    SchoolEnrollment,
    SchoolTeachingAssignment,
    SchoolBehaviourType,
    SchoolBehaviourEvent,
    SchoolHomeworkAssignment,
    SchoolHomeworkSubmission,
)


load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/rituo_db",
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)


DEMO_GROUP_ID = "DEMOHS1"
DEMO_GROUP_NAME = "Northfield Demo Academy"
DEMO_DOMAIN = "@northfield.demo"
DEFAULT_PASSWORD = "password123"
RANDOM_SEED = 20260310


SUBJECT_NAMES = [
    ("Mathematics", "MATH"),
    ("English", "ENG"),
    ("Science", "SCI"),
    ("History", "HIS"),
    ("Geography", "GEO"),
    ("Computing", "COMP"),
    ("Art", "ART"),
    ("Physical Education", "PE"),
]

ROOM_NAMES = [
    ("A101", "A Block", 30),
    ("A102", "A Block", 30),
    ("A201", "A Block", 28),
    ("B104", "B Block", 28),
    ("B201", "B Block", 32),
    ("C110", "C Block", 30),
    ("C205", "C Block", 30),
    ("D103", "D Block", 26),
    ("Sports Hall", "Sports", 50),
    ("Studio 2", "Creative", 24),
]

STAFF_BLUEPRINT = [
    ("nora.keen", "Nora Keen", "school-admin"),
    ("owen.reid", "Owen Reid", "pastoral-lead"),
    ("maya.shah", "Maya Shah", "teacher"),
    ("liam.carter", "Liam Carter", "teacher"),
    ("sophia.green", "Sophia Green", "teacher"),
]

STUDENT_FIRST_NAMES = [
    "Aiden", "Amelia", "Aria", "Ben", "Bella", "Caleb", "Chloe", "Daniel", "Daisy", "Ethan",
    "Eva", "Finn", "Freya", "George", "Grace", "Harry", "Hazel", "Isaac", "Ivy", "Jack",
    "Jasmine", "Jacob", "Layla", "Leo", "Lily", "Lucas", "Mia", "Mila", "Noah", "Nora",
    "Oliver", "Olivia", "Oscar", "Poppy", "Rosie", "Ryan", "Sienna", "Theo", "Thomas", "Violet",
    "William", "Zara", "Elijah", "Ruby", "Hudson", "Ava", "Mason", "Alice", "Samuel", "Lucy",
]

STUDENT_LAST_NAMES = [
    "Adams", "Bailey", "Bennett", "Brooks", "Campbell", "Carter", "Collins", "Cooper", "Edwards", "Evans",
    "Foster", "Gray", "Green", "Hall", "Harris", "Howard", "Hughes", "James", "Kelly", "King",
    "Lewis", "Marshall", "Miller", "Mitchell", "Morgan", "Murphy", "Parker", "Patel", "Powell", "Price",
    "Reed", "Richardson", "Roberts", "Robinson", "Scott", "Shaw", "Simpson", "Smith", "Taylor", "Thomas",
    "Turner", "Walker", "Ward", "Watson", "White", "Williams", "Wilson", "Wood", "Young", "Clarke",
]

HABIT_TEMPLATES = [
    ("Arrive on time", "Arrive before first bell and be ready to learn."),
    ("Read for 20 minutes", "Build a daily reading streak after school."),
    ("Complete homework plan", "Check the planner and finish priority tasks."),
    ("Pack for tomorrow", "Prepare books, kit, and equipment the night before."),
]

GOAL_TEMPLATES = [
    ("Improve lesson focus", "Too many low-engagement lessons"),
    ("Build homework consistency", "Missing work and late submissions"),
]


def calculate_lesson_points(attendance_status, engagement, refocus):
    points = 0
    attended = attendance_status in ("present", "late")
    if attendance_status == "late":
        points -= 1
    elif not attended:
        points -= 5
    if engagement == "green":
        points += 4
    elif engagement == "amber":
        points += 1
    elif engagement == "red":
        points -= 3
    if refocus:
        points -= 5
    return points


def school_days_back(today_value, count):
    values = []
    cursor = today_value
    while len(values) < count:
        if cursor.weekday() < 5:
            values.append(cursor)
        cursor -= timedelta(days=1)
    return list(reversed(values))


def clear_existing_demo_school():
    demo_group = Group.query.filter_by(group_id=DEMO_GROUP_ID).first()
    demo_users = User.query.filter(User.email.like(f"%{DEMO_DOMAIN}")).all()
    demo_user_ids = [user.id for user in demo_users]

    if demo_group:
        group_id = demo_group.id
        demo_class_ids = [
            school_class.id
            for school_class in SchoolClass.query.with_entities(SchoolClass.id).filter_by(group_id=group_id).all()
        ]
        demo_challenge_ids = [
            challenge.id
            for challenge in GroupChallenge.query.with_entities(GroupChallenge.id).filter_by(group_id=group_id).all()
        ]
        SchoolHomeworkSubmission.query.filter_by(group_id=group_id).delete()
        SchoolHomeworkAssignment.query.filter_by(group_id=group_id).delete()
        ParentContactRecord.query.filter_by(group_id=group_id).delete()
        ParentProfile.query.filter_by(group_id=group_id).delete()
        InterventionRecord.query.filter_by(group_id=group_id).delete()
        SchoolBehaviourEvent.query.filter_by(group_id=group_id).delete()
        SchoolBehaviourType.query.filter_by(group_id=group_id).delete()
        LessonRegister.query.filter_by(group_id=group_id).delete()
        PerformanceCard.query.filter_by(group_id=group_id).delete()
        SchoolImpactRecord.query.filter_by(group_id=group_id).delete()
        StudentGoal.query.filter_by(group_id=group_id).delete()
        SchoolAuditLog.query.filter_by(group_id=group_id).delete()
        SchoolRoleAssignment.query.filter_by(group_id=group_id).delete()
        SchoolTeachingAssignment.query.filter_by(group_id=group_id).delete()
        SchoolEnrollment.query.filter_by(group_id=group_id).delete()
        if demo_class_ids:
            Message.query.filter(Message.class_id.in_(demo_class_ids)).delete(synchronize_session=False)
        Message.query.filter_by(group_id=group_id).delete(synchronize_session=False)
        if demo_challenge_ids:
            db.session.execute(
                user_active_challenges.delete().where(
                    user_active_challenges.c.challenge_id.in_(demo_challenge_ids)
                )
            )
            demo_group.active_challenge_id = None
            db.session.flush()
        SchoolClass.query.filter_by(group_id=group_id).delete()
        SchoolRoom.query.filter_by(group_id=group_id).delete()
        SchoolSubject.query.filter_by(group_id=group_id).delete()
        CoachAssignment.query.filter_by(group_id=group_id).delete()
        GroupChallenge.query.filter_by(group_id=group_id).delete()
        db.session.execute(user_active_challenges.delete())
        db.session.execute(user_groups.delete().where(user_groups.c.group_id == group_id))
        db.session.execute(user_leading_groups.delete().where(user_leading_groups.c.group_id == group_id))
        db.session.execute(group_coaches.delete().where(group_coaches.c.group_id == group_id))
        db.session.delete(demo_group)
        db.session.flush()

    if demo_user_ids:
        db.session.execute(user_active_challenges.delete().where(user_active_challenges.c.user_id.in_(demo_user_ids)))
        db.session.execute(user_groups.delete().where(user_groups.c.user_id.in_(demo_user_ids)))
        db.session.execute(user_leading_groups.delete().where(user_leading_groups.c.user_id.in_(demo_user_ids)))
        db.session.execute(group_coaches.delete().where(group_coaches.c.coach_id.in_(demo_user_ids)))
        User.query.filter(User.id.in_(demo_user_ids)).delete(synchronize_session=False)

    db.session.commit()


def seed_demo_school():
    rng = random.Random(RANDOM_SEED)
    today_value = date.today()
    recent_school_days = school_days_back(today_value, 5)

    clear_existing_demo_school()

    leader = User(
        username="northfield.head",
        email=f"northfield.head{DEMO_DOMAIN}",
        password=generate_password_hash(DEFAULT_PASSWORD),
        account_role="admin",
    )
    db.session.add(leader)
    db.session.flush()

    staff_users = []
    for username, display_name, school_role in STAFF_BLUEPRINT:
        user = User(
            username=username,
            email=f"{username}{DEMO_DOMAIN}",
            password=generate_password_hash(DEFAULT_PASSWORD),
            account_role="admin" if school_role == "school-admin" else "teacher",
        )
        staff_users.append((user, display_name))
        db.session.add(user)
    db.session.flush()

    students = []
    for index in range(50):
        username = f"student{index + 1:02d}"
        student = User(
            username=username,
            email=f"{username}{DEMO_DOMAIN}",
            password=generate_password_hash(DEFAULT_PASSWORD),
        )
        students.append(student)
        db.session.add(student)
    db.session.flush()

    group = Group(
        name=DEMO_GROUP_NAME,
        group_id=DEMO_GROUP_ID,
        password="northfield2026",
        leader_id=leader.id,
        group_type="school",
        is_legacy=False,
        school_timetable=[],
    )
    db.session.add(group)
    db.session.flush()

    leader.leading_groups.append(group)
    group.members = students
    group.coaches = [user for user, _display_name in staff_users]
    db.session.flush()

    role_rows = [
        SchoolRoleAssignment(group_id=group.id, user_id=leader.id, role="school-admin"),
        SchoolRoleAssignment(group_id=group.id, user_id=staff_users[0][0].id, role="school-admin"),
        SchoolRoleAssignment(group_id=group.id, user_id=staff_users[1][0].id, role="pastoral-lead"),
        SchoolRoleAssignment(group_id=group.id, user_id=staff_users[2][0].id, role="teacher"),
        SchoolRoleAssignment(group_id=group.id, user_id=staff_users[3][0].id, role="teacher"),
        SchoolRoleAssignment(group_id=group.id, user_id=staff_users[4][0].id, role="teacher"),
    ]
    db.session.add_all(role_rows)

    subjects = []
    for name, code in SUBJECT_NAMES:
        subject = SchoolSubject(group_id=group.id, name=name, code=code)
        subjects.append(subject)
        db.session.add(subject)
    db.session.flush()

    rooms = []
    for name, block, capacity in ROOM_NAMES:
        room = SchoolRoom(group_id=group.id, name=name, block=block, capacity=capacity)
        rooms.append(room)
        db.session.add(room)
    db.session.flush()

    class_rows = []
    enrollments = []
    teaching_assignments = []
    coach_assignments = []
    student_classes = {}
    student_goals_map = {}
    class_subject_sets = [
        ["Mathematics", "English", "Science"],
        ["English", "History", "Geography"],
        ["Mathematics", "Science", "Computing"],
        ["English", "Art", "History"],
        ["Mathematics", "Geography", "Physical Education"],
    ]

    for class_index in range(10):
        year_group = f"Year {7 + (class_index // 2)}"
        class_name = f"{year_group} - {chr(65 + class_index)}"
        school_class = SchoolClass(
            group_id=group.id,
            name=class_name,
            tutor_group=f"TG-{7 + (class_index // 2)}{chr(65 + class_index)}",
            year_group=year_group,
            room_id=rooms[class_index % len(rooms)].id,
        )
        class_rows.append(school_class)
        db.session.add(school_class)
    db.session.flush()

    subject_map = {subject.name: subject for subject in subjects}
    for class_index, school_class in enumerate(class_rows):
        class_students = students[class_index * 5:(class_index + 1) * 5]
        student_classes[school_class.id] = class_students
        for student in class_students:
            enrollments.append(SchoolEnrollment(group_id=group.id, class_id=school_class.id, student_id=student.id))
        teacher_pool = [staff_users[2][0], staff_users[3][0], staff_users[4][0], staff_users[1][0], staff_users[0][0]]
        for subject_name in class_subject_sets[class_index % len(class_subject_sets)]:
            teacher = teacher_pool[(class_index + len(subject_name)) % len(teacher_pool)]
            teaching_assignments.append(
                SchoolTeachingAssignment(
                    group_id=group.id,
                    class_id=school_class.id,
                    subject_id=subject_map[subject_name].id,
                    teacher_id=teacher.id,
                )
            )
    db.session.add_all(enrollments + teaching_assignments)

    for index, student in enumerate(students):
        coach = staff_users[index % 2][0]
        coach_assignments.append(
            CoachAssignment(
                coach_id=coach.id,
                group_id=group.id,
                student_id=student.id,
            )
        )
    db.session.add_all(coach_assignments)

    behaviour_types = [
        SchoolBehaviourType(group_id=group.id, name="Excellent contribution", kind="reward", severity="low", default_points=2, note_type="praise"),
        SchoolBehaviourType(group_id=group.id, name="Focused start", kind="reward", severity="low", default_points=1, note_type="praise"),
        SchoolBehaviourType(group_id=group.id, name="Missed equipment", kind="sanction", severity="low", default_points=-1, note_type="equipment"),
        SchoolBehaviourType(group_id=group.id, name="Disruption", kind="sanction", severity="medium", default_points=-3, note_type="conduct"),
        SchoolBehaviourType(group_id=group.id, name="Referral", kind="referral", severity="high", default_points=-4, note_type="referral"),
    ]
    db.session.add_all(behaviour_types)
    db.session.flush()

    timetable_entries = []
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    period_times = [
        ("08:40", "09:35"),
        ("09:50", "10:45"),
        ("11:05", "12:00"),
        ("13:10", "14:05"),
    ]
    subject_rotation = [subject.name for subject in subjects]
    for weekday_index, weekday_name in enumerate(weekdays):
        for class_index, school_class in enumerate(class_rows):
            roster = student_classes[school_class.id]
            for period_index, (start_time, end_time) in enumerate(period_times[:2]):
                subject_name = subject_rotation[(class_index + period_index + weekday_index) % len(subject_rotation)]
                subject = subject_map[subject_name]
                assignment = next(
                    (item for item in teaching_assignments if item.class_id == school_class.id and item.subject_id == subject.id),
                    None,
                )
                if not assignment:
                    assignment = teaching_assignments[(class_index + period_index) % len(teaching_assignments)]
                teacher = next(user for user, _display_name in staff_users if user.id == assignment.teacher_id)
                room = rooms[(class_index + period_index) % len(rooms)]
                timetable_entries.append({
                    "id": f"{weekday_name.lower()}-{class_index + 1}-{period_index + 1}",
                    "weekday": weekday_name,
                    "startTime": start_time,
                    "endTime": end_time,
                    "subjectId": subject.id,
                    "subject": subject.name,
                    "teacherId": teacher.id,
                    "teacherName": teacher.username,
                    "roomId": room.id,
                    "room": room.name,
                    "classId": school_class.id,
                    "className": school_class.name,
                    "studentIds": [student.id for student in roster],
                })
    group.school_timetable = timetable_entries

    student_goals = []
    member_habits = []
    for index, student in enumerate(students):
        created_goals = []
        for title, barrier in GOAL_TEMPLATES:
            goal = StudentGoal(
                group_id=group.id,
                student_id=student.id,
                title=title,
                barrier=barrier,
                school_goal=f"{title} by half-term",
                for_self="Build better routines",
                for_others="Help the class stay focused",
                created_by_id=leader.id,
            )
            student_goals.append(goal)
            created_goals.append(goal)
            db.session.add(goal)
        student_goals_map[student.id] = created_goals
    db.session.flush()

    challenge_start = datetime.combine(today_value - timedelta(days=14), datetime.min.time())
    challenge_end = datetime.combine(today_value + timedelta(days=14), datetime.min.time())
    habit_window_start = today_value - timedelta(days=14)
    for index, student in enumerate(students):
        goal_options = student_goals_map[student.id]
        habits = []
        for habit_index, (habit_name, habit_description) in enumerate(HABIT_TEMPLATES):
            progress = []
            for day_offset in range(15):
                progress_date = habit_window_start + timedelta(days=day_offset)
                completed = rng.random() > (0.18 + (0.03 * (index % 4)))
                progress.append({
                    "date": datetime.combine(progress_date, datetime.min.time()).isoformat(),
                    "completed": completed,
                })
            habits.append({
                "name": habit_name,
                "description": habit_description,
                "frequency": "daily",
                "habitType": "boolean",
                "linkedGoalId": goal_options[habit_index % len(goal_options)].id,
                "scheduleDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "scheduleTime": ["07:30", "16:30", "17:00", "20:15"][habit_index % 4],
                "durationMinutes": 20 + (habit_index * 10),
                "orderIndex": habit_index,
                "combatType": ["discipline", "focus", "consistency", "recovery"][habit_index % 4],
                "progress": progress,
            })
        member_habits.append({
            "member": str(student.id),
            "goalActivity": "Leadership responsibility" if index % 4 else "Peer mentoring",
            "fallbackActivity": "Reflection session",
            "habits": habits,
        })

    challenge = GroupChallenge(
        group_id=group.id,
        start_date=challenge_start,
        end_date=challenge_end,
        member_habits=member_habits,
        status="active",
    )
    db.session.add(challenge)
    db.session.flush()
    group.active_challenge_id = challenge.id
    for student in students:
        student.active_group_challenges.append(challenge)

    impact_records = []
    performance_cards = []
    parent_profiles = []
    parent_contacts = []
    interventions = []
    lesson_registers = []
    behaviour_events = []
    audit_logs = []
    class_messages = []
    school_messages = []

    for student_index, student in enumerate(students):
        coach = staff_users[student_index % 2][0]
        parent_profiles.append(
            ParentProfile(
                group_id=group.id,
                student_id=student.id,
                created_by_id=coach.id,
                name=f"{STUDENT_FIRST_NAMES[student_index]} {STUDENT_LAST_NAMES[student_index]} Parent",
                relationship="Parent / carer",
                phone=f"07123{student_index:05d}",
                email=f"parent{student_index + 1:02d}{DEMO_DOMAIN}",
                preferred_contact="email" if student_index % 2 else "phone-call",
                receives_updates=True,
                notes="Demo parent profile for seeded school data.",
            )
        )
        for week_offset in range(3):
            week_ending = today_value - timedelta(days=(today_value.weekday() + 2)) - timedelta(days=week_offset * 7)
            positive_points = rng.randint(4, 12)
            negative_points = rng.randint(0, 6)
            truancy_incidents = 1 if student_index % 11 == 0 and week_offset == 0 else 0
            impact_records.append(
                SchoolImpactRecord(
                    group_id=group.id,
                    student_id=student.id,
                    coach_id=coach.id,
                    week_ending=week_ending,
                    truancy_incidents=truancy_incidents,
                    positive_points=positive_points,
                    negative_points=negative_points,
                    coach_notes="Demo weekly impact notes showing coaching and safeguarding follow-up.",
                )
            )
        for school_day in recent_school_days:
            checkpoints = []
            total_points = 0
            for slot in ("morning", "midday", "endOfDay"):
                engagement = ["green", "green", "amber", "red"][(student_index + len(slot) + school_day.day) % 4]
                refocus = engagement == "red" or ((student_index + school_day.day) % 9 == 0 and slot == "midday")
                attended = not (student_index % 14 == 0 and school_day == recent_school_days[-1] and slot == "morning")
                checkpoints.append({
                    "slot": slot,
                    "attended": attended,
                    "engagement": engagement,
                    "refocus": refocus,
                    "teacherSignature": coach.username,
                })
                if attended:
                    total_points += 4 if engagement == "green" else 1 if engagement == "amber" else -2
                else:
                    total_points -= 3
                if refocus:
                    total_points -= 1
            performance_cards.append(
                PerformanceCard(
                    group_id=group.id,
                    student_id=student.id,
                    coach_id=coach.id,
                    card_date=school_day,
                    checkpoints=checkpoints,
                    total_points=total_points,
                )
            )
        if student_index % 4 == 0:
            interventions.append(
                InterventionRecord(
                    group_id=group.id,
                    student_id=student.id,
                    staff_id=staff_users[1][0].id,
                    owner_id=coach.id,
                    intervention_type="reflection-session" if student_index % 8 else "parent-call",
                    status="monitoring" if student_index % 8 else "scheduled",
                    intervention_date=today_value - timedelta(days=1),
                    due_date=today_value + timedelta(days=3),
                    auto_created=student_index % 8 == 0,
                    summary="Seeded intervention for demo risk workflow.",
                    next_step="Review after next homework cycle.",
                )
            )
        if student_index % 2 == 0:
            parent_contacts.append(
                ParentContactRecord(
                    group_id=group.id,
                    student_id=student.id,
                    staff_id=staff_users[1][0].id,
                    contact_date=today_value - timedelta(days=student_index % 5),
                    contact_type="phone-call" if student_index % 3 else "email",
                    outcome="Supportive and engaged",
                    notes="Seeded parent contact to populate acknowledgement and contact history.",
                    acknowledged=student_index % 6 == 0,
                    acknowledged_at=datetime.utcnow() if student_index % 6 == 0 else None,
                    acknowledgement_note="Acknowledged during demo seeding." if student_index % 6 == 0 else None,
                )
            )

    db.session.add_all(impact_records + performance_cards + parent_profiles + parent_contacts + interventions)
    db.session.flush()

    timetable_lookup = {}
    for entry in timetable_entries:
        timetable_lookup.setdefault(entry["weekday"], []).append(entry)

    for school_day in recent_school_days:
        weekday_name = school_day.strftime("%A")
        for slot in timetable_lookup.get(weekday_name, []):
            class_students = student_classes.get(slot["classId"], [])
            teacher = next((user for user, _display_name in staff_users if user.id == slot["teacherId"]), staff_users[0][0])
            for student in class_students:
                attendance_status = "present"
                roll = (student.id + school_day.day + len(slot["subject"])) % 17
                if roll == 0:
                    attendance_status = "absent"
                elif roll in (1, 2):
                    attendance_status = "late"
                engagement = ["green", "green", "amber", "red"][(student.id + school_day.day + len(slot["id"])) % 4]
                refocus = engagement == "red" or ((student.id + school_day.day) % 13 == 0)
                lateness_minutes = 5 if attendance_status == "late" else 0
                points = calculate_lesson_points(attendance_status, engagement, refocus)
                record = LessonRegister(
                    group_id=group.id,
                    student_id=student.id,
                    teacher_id=teacher.id,
                    lesson_date=school_day,
                    timetable_slot_id=slot["id"],
                    weekday=weekday_name,
                    start_time=slot["startTime"],
                    end_time=slot["endTime"],
                    subject=slot["subject"],
                    teacher_name=teacher.username,
                    room=slot["room"],
                    class_name=slot["className"],
                    attendance_status=attendance_status,
                    lateness_minutes=lateness_minutes,
                    attended=attendance_status in ("present", "late"),
                    engagement=engagement,
                    refocus=refocus,
                    teacher_comment="Seeded register note for realistic dashboard coverage.",
                    points=points,
                )
                lesson_registers.append(record)
                if points < 0 or (student.id + school_day.day) % 10 == 0:
                    behaviour_type = behaviour_types[(student.id + school_day.day) % len(behaviour_types)]
                    behaviour_events.append(
                        SchoolBehaviourEvent(
                            group_id=group.id,
                            student_id=student.id,
                            staff_id=teacher.id,
                            lesson_register=record,
                            behaviour_type_id=behaviour_type.id,
                            event_date=school_day,
                            subject=slot["subject"],
                            class_name=slot["className"],
                            kind=behaviour_type.kind,
                            severity=behaviour_type.severity,
                            title=behaviour_type.name,
                            notes="Seeded behaviour entry linked to register data.",
                            points_delta=behaviour_type.default_points,
                        )
                    )
    db.session.add_all(lesson_registers)
    db.session.flush()
    db.session.add_all(behaviour_events)
    db.session.flush()

    homework_assignments = []
    homework_submissions = []
    for assignment_index in range(12):
        school_class = class_rows[assignment_index % len(class_rows)]
        class_students = student_classes[school_class.id]
        created_by = staff_users[(assignment_index + 2) % len(staff_users)][0]
        subject = subjects[assignment_index % len(subjects)]
        assigned_date = today_value - timedelta(days=assignment_index % 9)
        due_date = assigned_date + timedelta(days=2 + (assignment_index % 3))
        assignment = SchoolHomeworkAssignment(
            group_id=group.id,
            created_by_id=created_by.id,
            class_id=school_class.id,
            subject_id=subject.id,
            title=f"{subject.name} task {assignment_index + 1}",
            description=f"Seeded homework for {school_class.name}.",
            instructions="Complete the task, upload evidence if needed, and use the class channel for clarification.",
            homework_type=["practice", "revision", "quiz", "reading"][assignment_index % 4],
            complexity=["low", "medium", "high"][assignment_index % 3],
            assigned_date=assigned_date,
            due_date=due_date,
            estimated_minutes=20 + (assignment_index % 4) * 10,
            max_points=3 + (assignment_index % 2),
            late_penalty=1,
            missing_penalty=2,
            allow_late=True,
            requires_evidence=assignment_index % 3 == 0,
            student_ids=[student.id for student in class_students],
        )
        homework_assignments.append(assignment)
    db.session.add_all(homework_assignments)
    db.session.flush()

    for assignment in homework_assignments:
        class_students = student_classes[assignment.class_id]
        reviewer = next((item.teacher for item in teaching_assignments if item.class_id == assignment.class_id and item.subject_id == assignment.subject_id), staff_users[2][0])
        for student in class_students:
            status_roll = (student.id + assignment.id) % 5
            if status_roll == 0:
                status = "missing"
                awarded_points = -assignment.missing_penalty
                submitted_at = None
                reviewed_at = datetime.utcnow()
                completed_date = None
            elif status_roll == 1:
                status = "late"
                awarded_points = max(0, assignment.max_points - assignment.late_penalty)
                submitted_at = datetime.utcnow() - timedelta(days=1)
                reviewed_at = None
                completed_date = assignment.due_date + timedelta(days=1)
            elif status_roll == 2:
                status = "submitted"
                awarded_points = assignment.max_points
                submitted_at = datetime.utcnow() - timedelta(hours=6)
                reviewed_at = None
                completed_date = assignment.due_date
            else:
                status = "reviewed"
                awarded_points = assignment.max_points
                submitted_at = datetime.utcnow() - timedelta(days=2)
                reviewed_at = datetime.utcnow() - timedelta(days=1)
                completed_date = assignment.due_date - timedelta(days=1)
            homework_submissions.append(
                SchoolHomeworkSubmission(
                    assignment_id=assignment.id,
                    group_id=group.id,
                    student_id=student.id,
                    submitted_by_id=student.id if status in ("late", "submitted", "reviewed") else None,
                    reviewed_by_id=reviewer.id if status in ("reviewed", "missing") else None,
                    status=status,
                    submitted_at=submitted_at,
                    reviewed_at=reviewed_at,
                    completed_date=completed_date,
                    response_text="Seeded homework response." if status in ("late", "submitted", "reviewed") else None,
                    evidence_link="https://example.com/evidence/demo" if assignment.requires_evidence and status in ("late", "submitted", "reviewed") else None,
                    teacher_feedback="Good effort. Focus on method accuracy next time." if status == "reviewed" else None,
                    awarded_points=awarded_points,
                )
            )
        class_messages.append(
            Message(
                group_id=group.id,
                sender_id=assignment.created_by_id,
                class_id=assignment.class_id,
                content=f"Homework set: {assignment.title} due {assignment.due_date.isoformat()}.",
                message_type="system",
                read_by="[]",
            )
        )
    db.session.add_all(homework_submissions)

    for class_index, school_class in enumerate(class_rows):
        teacher = staff_users[(class_index + 2) % len(staff_users)][0]
        class_messages.append(
            Message(
                group_id=group.id,
                sender_id=teacher.id,
                class_id=school_class.id,
                content=f"Good work in {school_class.name} today. Use this channel for questions before tomorrow's lesson.",
                message_type="user",
                read_by="[]",
            )
        )
        student = student_classes[school_class.id][0]
        class_messages.append(
            Message(
                group_id=group.id,
                sender_id=student.id,
                class_id=school_class.id,
                content="Can we get a reminder of the key questions for tomorrow?",
                message_type="user",
                read_by="[]",
            )
        )

    for index in range(6):
        sender = leader if index % 2 == 0 else staff_users[index % len(staff_users)][0]
        school_messages.append(
            Message(
                group_id=group.id,
                sender_id=sender.id,
                class_id=None,
                content=[
                    "Whole-school reminder: uniform checks happen at line-up tomorrow.",
                    "Staff briefing: focus on homework completion before Thursday.",
                    "Celebration: Year 9 attendance improved again this week.",
                    "Reminder: use class channels instead of private DMs for student follow-up.",
                    "Heads-up: parent contact review is due by Friday.",
                    "Well done on improving register coverage across the school.",
                ][index],
                message_type="user",
                read_by="[]",
            )
        )
    db.session.add_all(class_messages + school_messages)

    for index, student in enumerate(students[:18]):
        actor = staff_users[index % len(staff_users)][0]
        audit_logs.append(
            SchoolAuditLog(
                group_id=group.id,
                actor_id=actor.id,
                student_id=student.id,
                action_type=["updated", "created", "reviewed"][index % 3],
                entity_type=["lesson-register", "homework", "intervention", "behaviour-event"][index % 4],
                title=f"Seeded audit event {index + 1}",
                description="Demo audit entry so the operations feed has recent activity.",
                metadata_json={"seeded": True, "index": index + 1},
            )
        )
    db.session.add_all(audit_logs)
    db.session.commit()

    print("Demo school seeded successfully.")
    print(f"School: {DEMO_GROUP_NAME} ({DEMO_GROUP_ID})")
    print(f"Leader login: northfield.head{DEMO_DOMAIN} / {DEFAULT_PASSWORD}")
    print("Teacher logins:")
    for user, display_name in staff_users:
        print(f"  - {display_name}: {user.email} / {DEFAULT_PASSWORD}")
    print("Student logins:")
    for student in students[:5]:
        print(f"  - {student.email} / {DEFAULT_PASSWORD}")
    print(f"Created {len(students)} students, {len(staff_users)} staff, {len(class_rows)} classes, {len(homework_assignments)} homework assignments.")


if __name__ == "__main__":
    with app.app_context():
        seed_demo_school()
