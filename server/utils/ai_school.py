VALID_AI_HABIT_TYPES = ("boolean", "numeric", "text")
VALID_AI_COMBAT_TYPES = ("attack", "defence", "neutral")
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
    "goal-plan",
    "none",
)

RITUO_APP_GUIDE = """
Rituo is a school-first app with these top-level school areas: Dashboard, Students, Teaching, Homework, Operations, Reports, and Community.
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
        "description": "Helps students plan habits, understand their day, recover from setbacks, and take one achievable next step.",
        "toneInstructions": (
            "Write like a positive, age-appropriate performance coach. Use simple language, short sentences, "
            "and one achievable step at a time. Protect the student's autonomy, never shame or diagnose them, "
            "and frame setbacks as information they can recover from."
        ),
        "priorities": [
            "today's habits and schedule",
            "clear explanations of goals and school commitments",
            "confidence-building recovery steps",
            "safe help-seeking when staff support is appropriate",
        ],
        "starterPrompts": [
            "What should I focus on today?",
            "Help me plan my habits around school.",
            "What is one small step I can take right now?",
            "How can I recover if I missed a habit?",
        ],
    },
}

COPILOT_PAGE_PROMPTS = {
    "admin": {
        "groups": ["How do I create a school and add its students?"],
        "group-detail": ["What should I review first in this school?"],
        "teacher-desk": ["Which operational risks are visible in Teacher Desk?"],
    },
    "teacher": {
        "teacher-desk": ["What should I do first on Teacher Desk?"],
        "group-detail": ["How do I move from this school page to today’s teaching tasks?"],
        "groups": ["Which assigned school should I open for today’s work?"],
    },
    "student": {
        "group-detail": ["Where can I see my habits and plan today?"],
        "groups": ["What can I do inside my school workspace?"],
        "settings": ["How do I update my account safely?"],
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
                        "habitType": {"type": "string"},
                        "scheduleDays": {
                            "type": "array",
                            "items": {"type": "string", "enum": list(VALID_AI_SCHEDULE_DAYS)},
                        },
                        "scheduleTime": {"type": "string"},
                        "durationMinutes": {"type": "integer"},
                        "combatType": {"type": "string"},
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
                        "durationMinutes": {"type": "integer"},
                        "combatType": {"type": "string", "enum": list(VALID_AI_COMBAT_TYPES)},
                        "prompt": {"type": "string"},
                        "minValue": {"type": "integer"},
                        "maxValue": {"type": "integer"},
                    },
                    "required": [
                        "name",
                        "description",
                        "habitType",
                        "scheduleDays",
                        "durationMinutes",
                        "combatType",
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
            {key: value for key, value in habit.items() if key not in {"linkedGoalKey", "scheduleTime", "orderIndex"}}
            for habit in plan["habits"]
        ],
        "warnings": [
            warning for warning in plan["warnings"]
            if warning != "No usable goals were generated from the source text."
        ],
    }


def normalize_daily_schedule(payload):
    normalized_items = []
    allowed_types = {"habit", "manual", "school", "break"}
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
        habit_type = str((raw_habit or {}).get("habitType") or "boolean").strip().lower()
        if habit_type not in VALID_AI_HABIT_TYPES:
            habit_type = "boolean"
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
                "name": name[:120],
                "description": str((raw_habit or {}).get("description") or "").strip()[:255],
                "linkedGoalKey": linked_goal_key,
                "habitType": habit_type,
                "scheduleDays": schedule_days,
                "scheduleTime": str((raw_habit or {}).get("scheduleTime") or "").strip()[:10],
                "durationMinutes": duration_minutes,
                "combatType": combat_type,
                "prompt": str((raw_habit or {}).get("prompt") or "").strip()[:255],
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
    if action_type == "homework" and group_id:
        return {"label": "Open Homework", "route": f"/groups/{group_id}?section=school-homework"}
    if action_type == "students" and group_id:
        return {"label": "Open Students", "route": f"/groups/{group_id}?section=student-profiles"}
    if action_type == "reports" and group_id:
        return {"label": "Open Reports", "route": f"/groups/{group_id}?section=school-reports"}
    if action_type == "community" and group_id:
        return {"label": "Open Community", "route": f"/groups/{group_id}?section=community"}
    if action_type == "group-dashboard" and group_id:
        return {"label": "Open Dashboard", "route": f"/groups/{group_id}?section=dashboard"}
    if action_type == "group-teaching" and group_id:
        return {"label": "Open Teaching", "route": f"/groups/{group_id}?section=teaching"}
    if action_type == "goal-plan" and group_id:
        return {"label": "Open Students", "route": f"/groups/{group_id}?section=student-profiles"}
    return None
