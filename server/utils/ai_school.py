import re


VALID_AI_HABIT_TYPES = ("boolean", "numeric", "text", "periodic")
VALID_AI_COMBAT_TYPES = ("attack", "defence", "neutral")
VALID_AI_DRAFT_COMBAT_TYPES = ("attack", "defence")
VALID_AI_SCHEDULE_DAYS = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)
VALID_AI_ACTION_TYPES = (
    "teacher-register",
    "homework",
    "students",
    "reports",
    "community",
    "group-dashboard",
    "group-teaching",
    "teacher-desk",
    "school-admin",
    "goal-plan",
    "none",
)

AI_HABIT_TYPE_GUIDANCE = """
Choose each habitType by how the student must complete and record the action:
- boolean: one clear yes/no action at one point in the day. Examples: make the bed, complete one revision block, pack tomorrow's school bag. Do not use boolean for a total that should be spread across the day.
- numeric: one daily result where the student enters a number. Examples: pages read, minutes practised, or a 1-10 focus rating. Do not use numeric when separate timed check-ins are needed.
- text: one written response. Examples: an evening reflection, gratitude entry, or lesson learned.
- periodic: the same short action must happen two or more times across waking hours. Examples: hydration, movement breaks, posture checks, breathing resets, and screen breaks. A daily hydration total must always be periodic, never one boolean event: "drink 2 litres of water daily" becomes five 400 ml check-ins spread through the day, not one 2 litre task at a single time.
For periodic habits, the name and prompt must describe ONE occurrence, while the description states the daily total. Set scheduleTime to the first occurrence, durationMinutes to the time for one occurrence, periodicOccurrences to the number of check-ins, periodicIntervalHours to realistic spacing, and allowOverlap true only when the short check-in can happen during another activity. Use safe default periodic values only on non-periodic habits because the response contract requires those fields.
""".strip()


_HYDRATION_PATTERN = re.compile(r"\b(?:water|hydrat(?:e|ed|ing|ion)|fluid intake)\b", re.IGNORECASE)
_SINGLE_HYDRATION_EVENT_PATTERN = re.compile(
    r"\b(?:after waking|on waking|with breakfast|at lunch|with lunch|before bed|after (?:the )?(?:gym|workout|training))\b",
    re.IGNORECASE,
)
_LITRE_AMOUNT_PATTERN = re.compile(r"(?<!\w)(\d+(?:\.\d+)?)\s*(?:l|litres?|liters?)(?!\w)", re.IGNORECASE)
_MILLILITRE_AMOUNT_PATTERN = re.compile(r"(?<!\w)(\d{2,4})\s*(?:ml|millilitres?|milliliters?)(?!\w)", re.IGNORECASE)


def _hydration_daily_total_ml(*values):
    text = " ".join(str(value or "") for value in values).strip()
    if not _HYDRATION_PATTERN.search(text):
        return None
    litre_match = _LITRE_AMOUNT_PATTERN.search(text)
    if litre_match and float(litre_match.group(1)) >= 1:
        return min(6000, round(float(litre_match.group(1)) * 1000))
    millilitre_match = _MILLILITRE_AMOUNT_PATTERN.search(text)
    if millilitre_match and int(millilitre_match.group(1)) >= 1000:
        return min(6000, int(millilitre_match.group(1)))
    if _SINGLE_HYDRATION_EVENT_PATTERN.search(text):
        return None
    if re.search(r"\b(?:throughout|across) (?:the )?day\b|\bdaily hydration\b|\bstay hydrated\b", text, re.IGNORECASE):
        return 2000
    return None


def _hydration_periodic_fields(raw_habit):
    total_ml = _hydration_daily_total_ml(
        (raw_habit or {}).get("name"),
        (raw_habit or {}).get("description"),
        (raw_habit or {}).get("prompt"),
    )
    if total_ml is None:
        return None
    occurrences = max(2, min(8, round(total_ml / 400)))
    serving_ml = max(100, round((total_ml / occurrences) / 50) * 50)
    interval_hours = max(2, min(6, round(15 / max(1, occurrences - 1))))
    return {
        "name": f"Drink {serving_ml} ml of water",
        "description": f"Complete {occurrences} hydration check-ins across the day for approximately {total_ml} ml in total.",
        "prompt": f"Log one {serving_ml} ml water check-in.",
        "scheduleTime": "08:00",
        "durationMinutes": 5,
        "periodicOccurrences": occurrences,
        "periodicIntervalHours": interval_hours,
    }

RITUO_APP_GUIDE = """
Rituo is a school-first app with these top-level school areas: Dashboard, Students, Teaching, Homework, Operations, Reports, and Community.
Administrators manage each school from its Admin tab. It includes generated student, teacher, and admin accounts; AI-assisted CSV student import; review before creation; people search and editing; password resets; student login packs; school access removal; setup shortcuts; and school settings.
Teacher Desk is the fastest daily workflow for staff. It combines my classes today, lesson register, behaviour logging, homework review, reminders, at-risk cards, interventions, coverage warnings, and recommended next actions.
The school dashboard summarizes live attendance, homework, behaviour, interventions, class coverage, and staff accountability.
Students are managed through profile panels that include goals, linked habits, planner scheduling, goal activity unlocks, attendance, behaviour, parent contacts, homework, and interventions.
Homework belongs to classes when possible. Homework activity posts into class chat, and reminders or reviews should stay aligned with the correct class.
Community includes school-wide chat and class chat. School direct messages are disabled for school groups.
When explaining the product, focus on concrete next clicks and the shortest route to action instead of broad theory.
""".strip()

COPILOT_ROLE_PROFILES = {
    "admin": {
        "assistantName": "Operations Copilot",
        "audienceLabel": "Administrator support",
        "toneLabel": "Strategic, direct, and concise",
        "description": "Prioritises school setup, account provisioning, risk, oversight, and the shortest operational next step.",
        "toneInstructions": (
            "Write like a trusted operations adviser. Be direct, concise, and prioritised. "
            "Lead with the decision or next action, identify operational risk when relevant, "
            "and avoid generic motivation or classroom-level explanations unless requested."
        ),
        "priorities": [
            "school setup and structure",
            "account provisioning and student imports",
            "attendance, behaviour, homework, intervention, and reporting risk",
            "clear delegation and operational next steps",
        ],
        "starterPrompts": [
            "How do I add a school and provision its accounts?",
            "How do I bulk import students and download their logins?",
            "Which school operations need attention today?",
            "Show me the fastest route to the report I need.",
        ],
    },
    "teacher": {
        "assistantName": "Teaching Copilot",
        "audienceLabel": "Teacher support",
        "toneLabel": "Calm, practical, and colleague-like",
        "description": "Focuses on today’s classes, student attention, registers, homework, behaviour, and manageable next actions.",
        "toneInstructions": (
            "Write like a calm, experienced teaching colleague. Be practical, respectful, and workload-aware. "
            "Use short steps in the order they should be completed. Acknowledge pressure without being verbose, "
            "and never sound judgemental about a teacher or student."
        ),
        "priorities": [
            "today's classes and registers",
            "students requiring timely support",
            "homework, behaviour, and intervention follow-up",
            "the smallest useful next action",
        ],
        "starterPrompts": [
            "What do I need to complete before my next class?",
            "Which students need my attention today?",
            "How do I record behaviour and follow it up?",
            "Show me the quickest way to review homework.",
        ],
    },
    "student": {
        "assistantName": "Performance Coach",
        "audienceLabel": "Student support",
        "toneLabel": "Positive, simple, and encouraging",
        "description": "Offers practical support with motivation, stress, focus, confidence, routines, and everyday setbacks.",
        "toneInstructions": (
            "Write like a warm, relatable performance coach for a teenager. Never assume the student's gender. "
            "Use natural, non-clinical language and short sentences without sounding childish or like a lecture. "
            "Start by briefly acknowledging how they feel, then give two to four realistic options that could work "
            "during an ordinary school day. End with one tiny action they can do in the next five minutes. Protect "
            "the student's autonomy, never shame or diagnose them, and frame setbacks as information they can recover from. "
            "If they mention being unsafe, self-harm, abuse, or a serious crisis, encourage immediate help from a trusted "
            "adult or appropriate emergency support rather than trying to handle the crisis alone."
        ),
        "priorities": [
            "motivation, overwhelm, stress, focus, confidence, and social pressure",
            "small actions that fit around school and home life",
            "recovering from missed habits or difficult days without guilt",
            "safe help-seeking when staff support is appropriate",
        ],
        "starterPrompts": [
            "I don't feel motivated today. What can I do?",
            "I feel overwhelmed and don't know where to start.",
            "I keep getting distracted by my phone. How can I focus?",
            "I messed up my routine. How do I reset?",
        ],
    },
}

COPILOT_PAGE_PROMPTS = {
    "admin": {
        "groups": ["How do I create a school and add its students?"],
        "group-detail": ["How do I use this school’s Admin tab to add people or import students?"],
        "teacher-desk": ["Which operational risks are visible in Teacher Desk?"],
    },
    "teacher": {
        "teacher-desk": ["What should I do first on Teacher Desk?"],
        "group-detail": ["How do I move from this school page to today’s teaching tasks?"],
        "groups": ["Which assigned school should I open for today’s work?"],
    },
    "student": {
        "group-detail": ["I feel overwhelmed. What should I do first?"],
        "groups": ["I don't feel motivated today. How can I get started?"],
        "settings": ["I keep comparing myself to other people. How do I refocus?"],
    },
}

COPILOT_ROLE_ACTION_TYPES = {
    "admin": set(VALID_AI_ACTION_TYPES),
    "teacher": {
        "teacher-register",
        "homework",
        "students",
        "reports",
        "community",
        "group-dashboard",
        "group-teaching",
        "teacher-desk",
        "goal-plan",
        "none",
    },
    "student": {
        "community",
        "group-dashboard",
        "goal-plan",
        "none",
    },
}


def get_copilot_role_profile(account_role):
    role = str(account_role or "student").strip().lower()
    return COPILOT_ROLE_PROFILES.get(role, COPILOT_ROLE_PROFILES["student"])


def get_copilot_starter_prompts(account_role, page=None):
    role = str(account_role or "student").strip().lower()
    if role not in COPILOT_ROLE_PROFILES:
        role = "student"
    profile = get_copilot_role_profile(role)
    page_prompts = COPILOT_PAGE_PROMPTS.get(role, {}).get(str(page or "").strip(), [])
    prompts = []
    for prompt in [*page_prompts, *profile["starterPrompts"]]:
        if prompt not in prompts:
            prompts.append(prompt)
    return prompts[:4]


def get_copilot_public_config(account_role, page=None):
    role = str(account_role or "student").strip().lower()
    if role not in COPILOT_ROLE_PROFILES:
        role = "student"
    profile = get_copilot_role_profile(role)
    return {
        "role": role,
        "assistantName": profile["assistantName"],
        "audienceLabel": profile["audienceLabel"],
        "toneLabel": profile["toneLabel"],
        "description": profile["description"],
        "starterPrompts": get_copilot_starter_prompts(role, page),
    }


def build_copilot_system_prompt(account_role):
    role = str(account_role or "student").strip().lower()
    if role not in COPILOT_ROLE_PROFILES:
        role = "student"
    profile = get_copilot_role_profile(role)
    allowed_actions = sorted(COPILOT_ROLE_ACTION_TYPES[role])
    return (
        f"You are {profile['assistantName']}, the Rituo in-app assistant for a {role} account. "
        f"{profile['toneInstructions']} "
        f"Prioritise: {', '.join(profile['priorities'])}. "
        "Use only the supplied app guide, route, and live school context. "
        "If live data is missing, say that clearly. Never invent records, scores, deadlines, or permissions. "
        "Do not recommend controls this account role cannot access. "
        f"Allowed nextActions actionType values for this role are: {', '.join(allowed_actions)}. "
        "Populate answer with the direct response, focusArea with a short category label, "
        "nextActions with ordered app actions only when useful, and quickReplies with short relevant follow-up questions."
    )


def build_student_plan_schema():
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "goals": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string"},
                        "title": {"type": "string"},
                        "barrier": {"type": "string"},
                        "schoolGoal": {"type": "string"},
                        "forSelf": {"type": "string"},
                        "forOthers": {"type": "string"},
                    },
                    "required": ["key", "title", "barrier", "schoolGoal", "forSelf", "forOthers"],
                    "additionalProperties": False,
                },
            },
            "habits": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "linkedGoalKey": {"type": "string"},
                        "habitType": {"type": "string", "enum": list(VALID_AI_HABIT_TYPES)},
                        "scheduleDays": {
                            "type": "array",
                            "items": {"type": "string", "enum": list(VALID_AI_SCHEDULE_DAYS)},
                        },
                        "scheduleTime": {"type": "string"},
                        "durationMinutes": {"type": "integer"},
                        "combatType": {"type": "string", "enum": list(VALID_AI_DRAFT_COMBAT_TYPES)},
                        "periodicIntervalHours": {"type": "integer"},
                        "periodicOccurrences": {"type": "integer"},
                        "allowOverlap": {"type": "boolean"},
                        "prompt": {"type": "string"},
                        "minValue": {"type": "integer"},
                        "maxValue": {"type": "integer"},
                    },
                    "required": [
                        "name",
                        "description",
                        "linkedGoalKey",
                        "habitType",
                        "scheduleDays",
                        "scheduleTime",
                        "durationMinutes",
                        "combatType",
                        "periodicIntervalHours",
                        "periodicOccurrences",
                        "allowOverlap",
                        "prompt",
                        "minValue",
                        "maxValue",
                    ],
                    "additionalProperties": False,
                },
            },
            "goalActivity": {
                "type": "object",
                "properties": {
                    "activity": {"type": "string"},
                    "fallbackActivity": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["activity", "fallbackActivity", "reason"],
                "additionalProperties": False,
            },
            "notes": {
                "type": "array",
                "items": {"type": "string"},
            },
            "warnings": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": ["summary", "goals", "habits", "goalActivity", "notes", "warnings"],
        "additionalProperties": False,
    }


def build_copilot_schema():
    return {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "focusArea": {"type": "string"},
            "nextActions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "actionType": {"type": "string", "enum": list(VALID_AI_ACTION_TYPES)},
                        "title": {"type": "string"},
                        "why": {"type": "string"},
                    },
                    "required": ["actionType", "title", "why"],
                    "additionalProperties": False,
                },
            },
            "quickReplies": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": ["answer", "focusArea", "nextActions", "quickReplies"],
        "additionalProperties": False,
    }


def build_habit_draft_schema():
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "habits": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "habitType": {"type": "string", "enum": list(VALID_AI_HABIT_TYPES)},
                        "scheduleDays": {"type": "array", "items": {"type": "string", "enum": list(VALID_AI_SCHEDULE_DAYS)}},
                        "scheduleTime": {"type": "string"},
                        "durationMinutes": {"type": "integer"},
                        "combatType": {"type": "string", "enum": list(VALID_AI_DRAFT_COMBAT_TYPES)},
                        "periodicIntervalHours": {"type": "integer"},
                        "periodicOccurrences": {"type": "integer"},
                        "allowOverlap": {"type": "boolean"},
                        "prompt": {"type": "string"},
                        "minValue": {"type": "integer"},
                        "maxValue": {"type": "integer"},
                    },
                    "required": [
                        "name",
                        "description",
                        "habitType",
                        "scheduleDays",
                        "scheduleTime",
                        "durationMinutes",
                        "combatType",
                        "periodicIntervalHours",
                        "periodicOccurrences",
                        "allowOverlap",
                        "prompt",
                        "minValue",
                        "maxValue",
                    ],
                    "additionalProperties": False,
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "habits", "warnings"],
        "additionalProperties": False,
    }


def build_personalized_habit_draft_schema():
    habit_schema = build_habit_draft_schema()["properties"]["habits"]["items"]
    personalized_habit_schema = {
        **habit_schema,
        "properties": {
            **habit_schema["properties"],
            "linkedGoalId": {"type": "string"},
        },
        "required": [*habit_schema["required"], "linkedGoalId"],
    }
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "studentHabitSets": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "studentId": {"type": "string"},
                        "studentName": {"type": "string"},
                        "habits": {"type": "array", "items": personalized_habit_schema},
                    },
                    "required": ["studentId", "studentName", "habits"],
                    "additionalProperties": False,
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "studentHabitSets", "warnings"],
        "additionalProperties": False,
    }


def build_test_goal_seed_schema():
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "studentGoalSets": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "studentId": {"type": "string"},
                        "studentName": {"type": "string"},
                        "goals": {
                            "type": "array",
                            "minItems": 5,
                            "maxItems": 5,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"},
                                    "barrier": {"type": "string"},
                                    "schoolGoal": {"type": "string"},
                                    "forSelf": {"type": "string"},
                                    "forOthers": {"type": "string"},
                                },
                                "required": ["title", "barrier", "schoolGoal", "forSelf", "forOthers"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["studentId", "studentName", "goals"],
                    "additionalProperties": False,
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "studentGoalSets", "warnings"],
        "additionalProperties": False,
    }


def build_daily_schedule_schema():
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "itemType": {"type": "string", "enum": ["habit", "break"]},
                        "habitIndex": {"type": "integer"},
                        "startTime": {"type": "string"},
                        "endTime": {"type": "string"},
                        "durationMinutes": {"type": "integer"},
                        "locked": {"type": "boolean"},
                        "allowOverlap": {"type": "boolean"},
                        "reason": {"type": "string"},
                    },
                    "required": [
                        "title",
                        "itemType",
                        "habitIndex",
                        "startTime",
                        "endTime",
                        "durationMinutes",
                        "locked",
                        "allowOverlap",
                        "reason",
                    ],
                    "additionalProperties": False,
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "items", "warnings"],
        "additionalProperties": False,
    }


def build_schedule_clarification_schema():
    return {
        "type": "object",
        "properties": {
            "needsClarification": {"type": "boolean"},
            "questions": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "question": {"type": "string"},
                        "placeholder": {"type": "string"},
                    },
                    "required": ["id", "question", "placeholder"],
                    "additionalProperties": False,
                },
            },
            "readyMessage": {"type": "string"},
        },
        "required": ["needsClarification", "questions", "readyMessage"],
        "additionalProperties": False,
    }


def build_school_timetable_schema():
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "weekday": {"type": "string", "enum": list(VALID_AI_SCHEDULE_DAYS[:5])},
                        "startTime": {"type": "string"},
                        "endTime": {"type": "string"},
                        "classId": {"type": "integer"},
                        "subjectId": {"type": "integer"},
                        "teacherId": {"type": "integer"},
                        "roomId": {"type": "integer"},
                        "reason": {"type": "string"},
                    },
                    "required": [
                        "weekday",
                        "startTime",
                        "endTime",
                        "classId",
                        "subjectId",
                        "teacherId",
                        "roomId",
                        "reason",
                    ],
                    "additionalProperties": False,
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "entries", "warnings"],
        "additionalProperties": False,
    }


def normalize_school_timetable(payload, valid_class_ids, valid_subject_ids, valid_teacher_ids, valid_room_ids):
    entries = []
    warnings = [
        str(item).strip()[:220]
        for item in ((payload or {}).get("warnings") or [])[:8]
        if str(item).strip()
    ]
    for index, raw_entry in enumerate(((payload or {}).get("entries") or [])[:300]):
        try:
            class_id = int((raw_entry or {}).get("classId") or 0)
            subject_id = int((raw_entry or {}).get("subjectId") or 0)
            teacher_id = int((raw_entry or {}).get("teacherId") or 0)
            room_id = int((raw_entry or {}).get("roomId") or 0)
        except (TypeError, ValueError):
            continue
        weekday = str((raw_entry or {}).get("weekday") or "").strip()
        start_time = str((raw_entry or {}).get("startTime") or "").strip()
        end_time = str((raw_entry or {}).get("endTime") or "").strip()
        if (
            weekday not in VALID_AI_SCHEDULE_DAYS[:5]
            or len(start_time) != 5
            or len(end_time) != 5
            or class_id not in valid_class_ids
            or subject_id not in valid_subject_ids
            or teacher_id not in valid_teacher_ids
            or room_id not in valid_room_ids
        ):
            continue
        entries.append(
            {
                "id": f"ai-slot-{index + 1}",
                "weekday": weekday,
                "startTime": start_time,
                "endTime": end_time,
                "classId": class_id,
                "subjectId": subject_id,
                "teacherId": teacher_id,
                "roomId": room_id,
                "reason": str((raw_entry or {}).get("reason") or "").strip()[:240],
            }
        )
    return {
        "summary": str((payload or {}).get("summary") or "").strip()[:500],
        "entries": entries,
        "warnings": warnings,
    }


def normalize_habit_draft(payload):
    plan = normalize_student_plan({
        "summary": (payload or {}).get("summary", ""),
        "goals": [],
        "habits": [
            {**habit, "linkedGoalKey": ""}
            for habit in ((payload or {}).get("habits") or [])
        ],
        "goalActivity": {"activity": "", "fallbackActivity": "", "reason": ""},
        "notes": [],
        "warnings": (payload or {}).get("warnings") or [],
    })
    return {
        "summary": plan["summary"],
        "habits": [
            {key: value for key, value in habit.items() if key not in {"linkedGoalKey", "orderIndex"}}
            for habit in plan["habits"]
        ],
        "warnings": [
            warning for warning in plan["warnings"]
            if warning != "No usable goals were generated from the source text."
        ],
    }


def normalize_personalized_habit_draft(payload, target_students):
    target_map = {str(student["id"]): student for student in target_students}
    normalized_sets = []
    seen_student_ids = set()
    warnings = [
        str(item).strip()[:220]
        for item in ((payload or {}).get("warnings") or [])
        if str(item).strip()
    ][:6]

    for raw_set in ((payload or {}).get("studentHabitSets") or []):
        student_id = str((raw_set or {}).get("studentId") or "").strip()
        student = target_map.get(student_id)
        if not student or student_id in seen_student_ids:
            continue
        raw_habits = (raw_set or {}).get("habits") or []
        normalized = normalize_habit_draft({
            "summary": "",
            "habits": raw_habits,
            "warnings": [],
        })
        valid_goal_ids = {str(goal["id"]) for goal in student.get("goals") or []}
        usable_raw_habits = [
            habit for habit in raw_habits
            if str((habit or {}).get("name") or "").strip()
        ]
        personalized_habits = []
        for index, habit in enumerate(normalized["habits"]):
            raw_habit = usable_raw_habits[index] if index < len(usable_raw_habits) else {}
            linked_goal_id = str((raw_habit or {}).get("linkedGoalId") or "").strip()
            if linked_goal_id not in valid_goal_ids:
                linked_goal_id = ""
            personalized_habits.append({
                **habit,
                "linkedGoalId": linked_goal_id or None,
            })
        normalized_sets.append({
            "studentId": student_id,
            "studentName": student["name"],
            "habits": personalized_habits,
        })
        seen_student_ids.add(student_id)

    for student_id, student in target_map.items():
        if student_id not in seen_student_ids:
            normalized_sets.append({
                "studentId": student_id,
                "studentName": student["name"],
                "habits": [],
            })
            warnings.append(f"No habits were generated for {student['name']}.")

    return {
        "summary": str((payload or {}).get("summary") or "").strip()[:400],
        "studentHabitSets": normalized_sets,
        "warnings": warnings[:8],
    }


def normalize_test_goal_seed(payload, target_students, goals_per_student=5):
    target_map = {str(student["id"]): student for student in target_students}
    normalized_sets = []
    seen_student_ids = set()
    warnings = [
        str(item).strip()[:220]
        for item in ((payload or {}).get("warnings") or [])
        if str(item).strip()
    ][:6]

    for raw_set in ((payload or {}).get("studentGoalSets") or []):
        student_id = str((raw_set or {}).get("studentId") or "").strip()
        student = target_map.get(student_id)
        if not student or student_id in seen_student_ids:
            continue
        goals = []
        seen_titles = set()
        for raw_goal in ((raw_set or {}).get("goals") or []):
            title = str((raw_goal or {}).get("title") or "").strip()[:255]
            title_key = title.lower()
            if not title or title_key in seen_titles:
                continue
            goals.append({
                "title": title,
                "barrier": str((raw_goal or {}).get("barrier") or "").strip()[:255],
                "schoolGoal": str((raw_goal or {}).get("schoolGoal") or "").strip()[:255],
                "forSelf": str((raw_goal or {}).get("forSelf") or "").strip()[:255],
                "forOthers": str((raw_goal or {}).get("forOthers") or "").strip()[:255],
            })
            seen_titles.add(title_key)
            if len(goals) >= goals_per_student:
                break
        normalized_sets.append({
            "studentId": student_id,
            "studentName": student["name"],
            "goals": goals,
        })
        seen_student_ids.add(student_id)
        if len(goals) < goals_per_student:
            warnings.append(f"Only {len(goals)} goals were generated for {student['name']}.")

    for student_id, student in target_map.items():
        if student_id not in seen_student_ids:
            normalized_sets.append({
                "studentId": student_id,
                "studentName": student["name"],
                "goals": [],
            })
            warnings.append(f"No goals were generated for {student['name']}.")

    return {
        "summary": str((payload or {}).get("summary") or "").strip()[:400],
        "studentGoalSets": normalized_sets,
        "warnings": warnings[:10],
    }


def normalize_daily_schedule(payload):
    normalized_items = []
    allowed_types = {"habit", "manual", "school", "break", "sleep"}
    for index, raw_item in enumerate(((payload or {}).get("items") or [])[:40]):
        title = str((raw_item or {}).get("title") or "").strip()
        start_time = str((raw_item or {}).get("startTime") or "").strip()
        end_time = str((raw_item or {}).get("endTime") or "").strip()
        if not title or len(start_time) != 5 or len(end_time) != 5:
            continue
        item_type = str((raw_item or {}).get("itemType") or "manual").strip().lower()
        if item_type not in allowed_types:
            item_type = "manual"
        try:
            habit_index = int((raw_item or {}).get("habitIndex", -1))
        except (TypeError, ValueError):
            habit_index = -1
        try:
            duration_minutes = int((raw_item or {}).get("durationMinutes") or 30)
        except (TypeError, ValueError):
            duration_minutes = 30
        normalized_items.append({
            "id": f"plan-{index + 1}",
            "title": title[:120],
            "itemType": item_type,
            "habitIndex": habit_index,
            "startTime": start_time,
            "endTime": end_time,
            "durationMinutes": max(5, min(480, duration_minutes)),
            "locked": bool((raw_item or {}).get("locked")),
            "allowOverlap": bool((raw_item or {}).get("allowOverlap")),
            "reason": str((raw_item or {}).get("reason") or "").strip()[:240],
            "source": "ai",
        })
    normalized_items.sort(key=lambda item: (item["startTime"], item["endTime"]))
    return {
        "summary": str((payload or {}).get("summary") or "").strip()[:500],
        "items": normalized_items,
        "warnings": [
            str(item).strip()[:220]
            for item in ((payload or {}).get("warnings") or [])[:6]
            if str(item).strip()
        ],
    }


def normalize_schedule_clarification(payload):
    questions = []
    used_ids = set()
    for index, raw_question in enumerate(((payload or {}).get("questions") or [])[:3]):
        question = str((raw_question or {}).get("question") or "").strip()[:240]
        if not question:
            continue
        question_id = str((raw_question or {}).get("id") or f"question-{index + 1}").strip()[:60]
        question_id = "".join(character for character in question_id if character.isalnum() or character in {"-", "_"})
        if not question_id or question_id in used_ids:
            question_id = f"question-{index + 1}"
        used_ids.add(question_id)
        questions.append({
            "id": question_id,
            "question": question,
            "placeholder": str((raw_question or {}).get("placeholder") or "Type your answer").strip()[:160],
        })

    needs_clarification = bool((payload or {}).get("needsClarification")) and bool(questions)
    return {
        "needsClarification": needs_clarification,
        "questions": questions if needs_clarification else [],
        "readyMessage": str((payload or {}).get("readyMessage") or "I have enough detail to organise this day.").strip()[:300],
    }


def normalize_student_plan(plan):
    normalized_goals = []
    raw_goals = (plan or {}).get("goals") or []
    for index, raw_goal in enumerate(raw_goals[:6]):
        key = str((raw_goal or {}).get("key") or f"goal-{index + 1}").strip() or f"goal-{index + 1}"
        title = str((raw_goal or {}).get("title") or "").strip()
        if not title:
            continue
        normalized_goals.append(
            {
                "key": key,
                "title": title[:255],
                "barrier": str((raw_goal or {}).get("barrier") or "").strip()[:255],
                "schoolGoal": str((raw_goal or {}).get("schoolGoal") or "").strip()[:255],
                "forSelf": str((raw_goal or {}).get("forSelf") or "").strip()[:255],
                "forOthers": str((raw_goal or {}).get("forOthers") or "").strip()[:255],
            }
        )

    goal_keys = [goal["key"] for goal in normalized_goals]
    fallback_goal_key = goal_keys[0] if goal_keys else ""

    normalized_habits = []
    raw_habits = (plan or {}).get("habits") or []
    for index, raw_habit in enumerate(raw_habits[:10]):
        name = str((raw_habit or {}).get("name") or "").strip()
        if not name:
            continue
        hydration_fields = _hydration_periodic_fields(raw_habit)
        habit_type = str((raw_habit or {}).get("habitType") or "boolean").strip().lower()
        if habit_type not in VALID_AI_HABIT_TYPES:
            habit_type = "boolean"
        if hydration_fields:
            habit_type = "periodic"
        combat_type = str((raw_habit or {}).get("combatType") or "neutral").strip().lower()
        if combat_type not in VALID_AI_COMBAT_TYPES:
            combat_type = "neutral"
        schedule_days = [
            day
            for day in (raw_habit or {}).get("scheduleDays") or []
            if day in VALID_AI_SCHEDULE_DAYS
        ]
        if not schedule_days:
            schedule_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        try:
            duration_minutes = int((raw_habit or {}).get("durationMinutes") or 20)
        except (TypeError, ValueError):
            duration_minutes = 20
        duration_minutes = max(5, min(120, duration_minutes))
        try:
            periodic_interval_hours = int((raw_habit or {}).get("periodicIntervalHours") or 4)
        except (TypeError, ValueError):
            periodic_interval_hours = 4
        periodic_interval_hours = max(1, min(12, periodic_interval_hours))
        try:
            periodic_occurrences = int((raw_habit or {}).get("periodicOccurrences") or 4)
        except (TypeError, ValueError):
            periodic_occurrences = 4
        periodic_occurrences = max(2, min(12, periodic_occurrences))
        if hydration_fields:
            duration_minutes = hydration_fields["durationMinutes"]
            periodic_interval_hours = hydration_fields["periodicIntervalHours"]
            periodic_occurrences = hydration_fields["periodicOccurrences"]
        try:
            min_value = int((raw_habit or {}).get("minValue") or 0)
        except (TypeError, ValueError):
            min_value = 0
        try:
            max_value = int((raw_habit or {}).get("maxValue") or max(min_value + 1, 10))
        except (TypeError, ValueError):
            max_value = max(min_value + 1, 10)
        if max_value <= min_value:
            max_value = min_value + 1
        linked_goal_key = str((raw_habit or {}).get("linkedGoalKey") or fallback_goal_key).strip()
        if linked_goal_key not in goal_keys:
            linked_goal_key = fallback_goal_key
        normalized_habits.append(
            {
                "name": (hydration_fields["name"] if hydration_fields else name)[:120],
                "description": (
                    hydration_fields["description"]
                    if hydration_fields
                    else str((raw_habit or {}).get("description") or "").strip()
                )[:255],
                "linkedGoalKey": linked_goal_key,
                "habitType": habit_type,
                "scheduleDays": schedule_days,
                "scheduleTime": (
                    hydration_fields["scheduleTime"]
                    if hydration_fields
                    else str((raw_habit or {}).get("scheduleTime") or "").strip()
                )[:10],
                "durationMinutes": duration_minutes,
                "combatType": combat_type,
                "periodicIntervalHours": periodic_interval_hours,
                "periodicOccurrences": periodic_occurrences,
                "allowOverlap": True if hydration_fields else bool((raw_habit or {}).get("allowOverlap")),
                "prompt": (
                    hydration_fields["prompt"]
                    if hydration_fields
                    else str((raw_habit or {}).get("prompt") or "").strip()
                )[:255],
                "minValue": min_value,
                "maxValue": max_value,
                "orderIndex": index,
            }
        )

    raw_goal_activity = (plan or {}).get("goalActivity") or {}
    goal_activity = {
        "activity": str(raw_goal_activity.get("activity") or "").strip()[:255],
        "fallbackActivity": str(raw_goal_activity.get("fallbackActivity") or "Reflection session").strip()[:255] or "Reflection session",
        "reason": str(raw_goal_activity.get("reason") or "").strip()[:400],
    }
    if not goal_activity["activity"] and normalized_goals:
        goal_activity["activity"] = f"Progress check-in for {normalized_goals[0]['title']}"[:255]

    notes = [str(item).strip()[:220] for item in ((plan or {}).get("notes") or []) if str(item).strip()][:4]
    warnings = [str(item).strip()[:220] for item in ((plan or {}).get("warnings") or []) if str(item).strip()][:4]
    if not normalized_goals:
        warnings.append("No usable goals were generated from the source text.")
    if not normalized_habits:
        warnings.append("No usable habits were generated from the source text.")

    return {
        "summary": str((plan or {}).get("summary") or "").strip()[:400],
        "goals": normalized_goals,
        "habits": normalized_habits,
        "goalActivity": goal_activity,
        "notes": notes,
        "warnings": warnings[:6],
    }


def normalize_copilot_response(payload, account_role="admin"):
    response = payload or {}
    role = str(account_role or "student").strip().lower()
    if role not in COPILOT_ROLE_ACTION_TYPES:
        role = "student"
    allowed_actions = COPILOT_ROLE_ACTION_TYPES[role]
    next_actions = []
    for item in (response.get("nextActions") or [])[:4]:
        action_type = str((item or {}).get("actionType") or "none").strip()
        if action_type not in VALID_AI_ACTION_TYPES or action_type not in allowed_actions:
            action_type = "none"
        title = str((item or {}).get("title") or "").strip()
        why = str((item or {}).get("why") or "").strip()
        if not title:
            continue
        next_actions.append(
            {
                "actionType": action_type,
                "title": title[:120],
                "why": why[:280],
            }
        )

    quick_replies = [
        str(item).strip()[:120]
        for item in (response.get("quickReplies") or [])[:4]
        if str(item).strip()
    ]

    return {
        "answer": str(response.get("answer") or "").strip()[:1000],
        "focusArea": str(response.get("focusArea") or "").strip()[:120],
        "nextActions": next_actions,
        "quickReplies": quick_replies,
    }


def build_copilot_action_link(action_type, group_id=None, target_date=None):
    if action_type == "teacher-register":
        suffix = f"?group={group_id}&date={target_date}" if group_id and target_date else ""
        return {"label": "Open Teacher Desk", "route": f"/teacher-desk{suffix}"}
    if action_type == "teacher-desk":
        suffix = f"?group={group_id}" if group_id else ""
        return {"label": "Open Teacher Desk", "route": f"/teacher-desk{suffix}"}
    if action_type == "school-admin" and group_id:
        return {"label": "Open School Admin", "route": f"/groups/{group_id}?tab=admin"}
    if action_type == "homework" and group_id:
        return {"label": "Open Homework", "route": f"/groups/{group_id}?tab=school&section=school-homework"}
    if action_type == "students" and group_id:
        return {"label": "Open Students", "route": f"/groups/{group_id}?tab=school&section=student-profiles"}
    if action_type == "reports" and group_id:
        return {"label": "Open Reports", "route": f"/groups/{group_id}?tab=school&section=school-reports"}
    if action_type == "community" and group_id:
        return {"label": "Open Community", "route": f"/groups/{group_id}?tab=chat"}
    if action_type == "group-dashboard" and group_id:
        return {"label": "Open Dashboard", "route": f"/groups/{group_id}?tab=overview"}
    if action_type == "group-teaching" and group_id:
        return {"label": "Open Teaching", "route": f"/groups/{group_id}?tab=school&section=teacher-register"}
    if action_type == "goal-plan" and group_id:
        return {"label": "Open My Progress", "route": f"/groups/{group_id}?tab=school&section=student-profiles"}
    return None
