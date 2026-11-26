# MindHeartGut / Inner Performance

A React and Flask school performance platform for administrators, teachers, and students.

## Stack

- React 18, Vite, Tailwind CSS
- Flask, Flask-JWT-Extended, Flask-SQLAlchemy
- PostgreSQL and Alembic migrations
- OpenAI Responses API for structured habit drafts and student schedules

## Account Model

- **Admin:** creates schools and managed admin, teacher, or student accounts.
- **Teacher:** accesses assigned schools, classes, registers, homework, behaviour, and interventions.
- **Student:** accesses one assigned school, habits, goals, and the daily calendar.
- **Legacy:** existing owner-created groups remain available at `/legacy`; ownership and data are preserved.

## Local Setup (Windows CMD)

### Backend

```cmd
cd /d C:\Users\rohan\Documents\react\rituo-v1\server
venv\Scripts\activate.bat
set FLASK_APP=server.py
python -m flask db upgrade
python server.py
```

The API runs at `http://localhost:5000`.

### Frontend

Open a second CMD window:

```cmd
cd /d C:\Users\rohan\Documents\react\rituo-v1\client
npm run dev
```

The app runs at `http://localhost:5173`.

## Bootstrap an Admin

Existing production accounts intentionally remain student accounts with Legacy access. Promote the first platform admin explicitly:

```cmd
cd /d C:\Users\rohan\Documents\react\rituo-v1\server
venv\Scripts\activate.bat
set FLASK_APP=server.py
python -m flask set-account-role YOUR_USERNAME admin
```

You can also set `INITIAL_ADMIN_EMAILS` to a comma-separated allowlist before registering a new account.

## OpenAI

Add these values to `server\.env`:

```env
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_HABIT_DRAFT_MODEL=gpt-4o-mini
OPENAI_SCHEDULER_MODEL=gpt-4o-mini
OPENAI_STUDENT_IMPORT_MODEL=gpt-4o-mini
OPENAI_STUDENT_TOOLS_MODEL=gpt-5.6-luna
SCHOOL_TIMEZONE=Europe/London
```

The API key is used only by the Flask server and must never be added to the client environment.

## Google Calendar

Create a Google OAuth 2.0 Web application, enable the Google Calendar API, and add the exact backend callback URL to its authorised redirect URIs. For local development, use `http://localhost:5000/api/groups/google-calendar/callback`.

Add these values to `server\.env`:

```env
GOOGLE_CALENDAR_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5000/api/groups/google-calendar/callback
```

Production must use its HTTPS backend callback URL. The link button remains disabled until all three values are configured.

### Structured AI Contracts

Every OpenAI feature uses a named strict JSON Schema contract through `server\utils\openai_responses.py`. The schema is sent to the Responses API with strict mode enabled, the system prompt explicitly forbids prose or additional fields, and the returned JSON is validated again on the server before application code can use it.

## Guided Meditation Audio

The admin Feature Lab builds a detailed manual ChatGPT prompt, validates the pasted meditation JSON against a strict server contract, then sends only the narration text to ElevenLabs. Add these values to `server\.env`:

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
MEDITATION_MEDIA_DIR=C:\path\to\persistent\meditation-media
MEDITATION_DEFAULT_MUSIC_FILENAME=ip-meditation-background-15min.mp3
```

For the default local background track, place a 15-minute seamless instrumental MP3 at `server\uploads\meditations\ip-meditation-background-15min.mp3`. The same track loops automatically for the supported 5, 10, 15, 20, and 30-minute sessions. Keep it original or properly licensed, without vocals, and under 15 MB. Admins may still upload a different MP3, WAV, M4A, or OGG for an individual session. `MEDITATION_MEDIA_DIR` is optional locally, but production needs a persistent mounted directory because generated narration and uploaded music must survive application restarts and deploys.

Current contracts cover Copilot answers, student goal plans, habit drafts, daily schedules, and CSV column mapping. API responses include the contract name and version for predictable client handling.

Copilot configuration is account-role aware:

- **Administrators:** strategic, direct operations support with FAQs for schools, account provisioning, student imports, logins, risk, and reporting.
- **Teachers:** calm, practical colleague-style support with FAQs for classes, registers, homework, behaviour, and student follow-up.
- **Students:** positive, age-appropriate coaching with FAQs for habits, schedules, small next steps, and recovery after setbacks.

The server derives the role from the authenticated account, filters suggested actions to pages that role can access, and never trusts a role supplied by the client.

## Bulk Student CSV Import

Administrators can open the **Admin** tab inside any school to manage that school from one control centre. It includes account totals, automatic student/teacher/admin account generation, a searchable people directory, account editing and activation controls, individual password resets, school-access removal, roster exports, student login packs, school naming, setup shortcuts, and protected school deletion.

Administrators can upload a CSV from the school Admin tab or dashboard, review every generated account, edit the proposed details, and then import all students into one school. The exact template headers are:

```csv
first_name,last_name,year_group,tutor_group
Amina,Khan,Year 10,10AK
```

Exact-template files are handled locally. Other header layouts use OpenAI to identify the matching columns. Every proposed student receives a unique username, an `@innerperformance.co.uk` email, and a six-digit temporary password. Download the generated login CSV immediately after import because passwords are stored only as hashes.

The school Admin tab and admin dashboard include school-specific directories. Administrators can download a roster at any time or generate a fresh login CSV. Generating a fresh login CSV resets every listed student to a new six-digit password so readable passwords never need to be stored.

## Validation

```cmd
cd /d C:\Users\rohan\Documents\react\rituo-v1\server
venv\Scripts\activate.bat
python -m unittest discover -s tests -v

cd /d C:\Users\rohan\Documents\react\rituo-v1\client
npm run build
```
