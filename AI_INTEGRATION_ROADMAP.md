# Rituo AI Integration Roadmap

## What This Pass Adds

- A server-side OpenAI integration foundation using the Responses API and structured JSON schemas.
- AI-generated student goal plans from free-text notes, with linked habits and goal activity output.
- A floating in-app `Rituo Copilot` assistant that can answer from route-aware school context.
- No database schema changes. AI writes back into the existing `StudentGoal` and `member_habits` structures.

## Core Principles

- Keep AI server-side so API keys never touch the client.
- Use structured JSON outputs for all write paths.
- Preserve manual workflows and add AI as an alternative, not a replacement.
- Never let model output write directly to the database without normalization.
- Prefer context-aware assistants over generic chat.

## High-Value AI Surfaces

### Students

- Goal and habit generation from teacher notes, parent summaries, or meeting transcripts.
- Goal rewrites for different tones: clearer, more motivating, more measurable, more school-safe.
- Goal-to-habit linking with suggested cadence, duration, and check-in prompts.
- Planner generation that suggests the best order and time slots around the school timetable.
- Reflection drafting after missed homework, poor attendance, or repeated refocus flags.
- Parent update drafting from live attendance, homework, and behaviour context.

### Teacher Desk

- “What do I need to do now?” prioritization from live dashboard, register, interventions, and homework data.
- Auto-drafted register comments from short teacher notes.
- Behaviour log suggestion chips based on lesson patterns.
- Homework reminder drafting for class chat.
- Intervention recommendation summaries with rationale and follow-up order.
- End-of-day recap generation for staff.

### Homework

- AI homework creation from curriculum notes, lesson objectives, or exemplar text.
- Differentiated versions by support level or class profile.
- Auto-generated review feedback from submission text and rubric goals.
- Reminder message generation tuned for class chat.

### School Reports And Analytics

- Narrative report drafts from scorecards, attendance, homework, and behaviour trends.
- At-risk explanation cards that summarize “why this student is on the radar.”
- League table commentary that celebrates improvement, not just rank.
- Trend interpretation for score and colour-chart surfaces.

### Community And Support

- Floating app assistant for navigation, workflow help, and contextual explanations.
- Class chat helper for drafting school-safe announcements and reminders.
- Student study support prompts that reference current goals and homework load.
- Teacher onboarding assistant that explains the fastest route through school sections.

### Group And Challenge System

- Habit preset generation from a challenge outcome or coaching brief.
- Challenge setup drafting for leaders, including habit templates by member or class.
- AI-generated prompts for numeric and text habits.

### Skill Charts And Colour-Based Pages

- AI explanations for what a colour pattern means in plain language.
- Suggested next actions from weak cells or stagnant areas.
- Rubric-consistent draft scoring suggestions from teacher evidence.
- Safer colour copy so red/amber/green views explain action instead of only status.

## Recommended Build Order

1. Harden the shared OpenAI layer with logging, retry policy, and prompt versioning.
2. Expand student planning AI to support multi-student batch planning for heads of year or pastoral staff.
3. Add teacher-desk drafting flows for reminders, feedback, and interventions.
4. Add AI homework creation and review assistance.
5. Add report-writing and chart explanation features.
6. Add deeper student support flows inside homework, planner, and reflection surfaces.

## Safety And Data Rules

- Route all model writes through normalized schemas.
- Keep prompts explicit about using supplied facts only.
- Log AI-applied school changes in audit history.
- Show a draft first for higher-risk actions where silent overwrite would be unsafe.
- Treat attendance, behaviour, and parent-contact narratives as sensitive data.

## Configuration

- `OPENAI_API_KEY` is required on the server.
- Optional model overrides:
  - `OPENAI_MODEL`
  - `OPENAI_STUDENT_PLAN_MODEL`
  - `OPENAI_COPILOT_MODEL`

## Remaining Work After This Pass

- Batch AI tools for heads of year and pastoral leads.
- Teacher-desk action execution, not just advice.
- Homework authoring and feedback generation.
- Parent communication drafting.
- Skill-chart and report-writing copilots.
- Prompt observability, latency monitoring, and feature flags by surface.
