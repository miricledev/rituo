# Render Deployment Guide - Database Migration

## Overview
This guide covers deploying the latest changes to production on Render, specifically focusing on the new `habit_presets` table that needs to be created in the database.

## New Database Table: `habit_presets`

The `HabitPreset` model has been added to `server/db/models.py`. This table stores habit templates that group leaders can create and reuse when setting up challenges.

### Table Schema:
- `id` (Integer, Primary Key)
- `user_id` (Integer, Foreign Key to `users.id`)
- `name` (String 100 chars)
- `habits` (JSON) - stores array of habit objects
- `created_at` (DateTime)
- `updated_at` (DateTime)

---

## 🚀 Deployment Steps for Render

### Step 1: Push Code to Git
Make sure all changes are committed and pushed to your repository:
```bash
git add .
git commit -m "Add habit presets feature with database migration"
git push origin main  # or your branch name
```

### Step 2: Database Migration on Render

**Option A: Using Render Shell (Recommended)**

1. Go to your Render dashboard
2. Navigate to your **Web Service** (backend service)
3. Click on **"Shell"** tab (or open the shell from your service)
4. Run the following commands:

```bash
# Navigate to parent directory (where server/ is located)
cd /opt/render/project/src

# Set Flask app environment variable (required)
export FLASK_APP=server.server:app

# Run the migration
flask db upgrade

# Or if you're already in the server directory, add PYTHONPATH:
# export PYTHONPATH=/opt/render/project/src/server:$PYTHONPATH
# export FLASK_APP=server:app
# flask db upgrade
```

**Option B: Using Render Build Command**

You can add the migration to your build command. In your Render service settings:

1. Go to **Settings** → **Build Command**
2. Add migration to your build command:
```bash
cd server && pip install -r requirements.txt && FLASK_APP=server:app flask db upgrade && gunicorn server:app --timeout 120 --workers 2 --bind 0.0.0.0:$PORT
```

**Option C: Manual SQL (If migrations fail)**

If for some reason Flask-Migrate doesn't work, you can run the SQL directly:

1. Go to your **PostgreSQL Database** service in Render
2. Click on **"Connect"** or **"Info"** to get connection details
3. Use `psql` or Render's built-in PostgreSQL admin:
   - Go to **PostgreSQL** → **Info** → Click **"Connect"** or use external client
4. Run this SQL:

```sql
CREATE TABLE habit_presets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    habits JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create an index on user_id for faster queries
CREATE INDEX idx_habit_presets_user_id ON habit_presets(user_id);
```

---

## ✅ Verification Steps

After deployment, verify the migration worked:

### 1. Check Table Exists
Connect to your Render PostgreSQL database and run:
```sql
\dt habit_presets
-- or
SELECT * FROM habit_presets LIMIT 1;
```

### 2. Test API Endpoints
Test the new habit presets endpoints:
```bash
# Get presets (requires authentication)
curl -X GET https://your-backend-url.onrender.com/api/groups/habit-presets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create a preset (requires authentication and being a group leader)
curl -X POST https://your-backend-url.onrender.com/api/groups/habit-presets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Preset",
    "habits": [
      {
        "name": "Test Habit",
        "description": "Test",
        "habitType": "boolean",
        "scheduleDays": ["Monday", "Tuesday"],
        "combatType": "attack"
      }
    ]
  }'
```

### 3. Check Logs
Monitor your Render service logs for any errors:
- Go to your Web Service → **Logs** tab
- Look for any database connection errors or migration errors

---

## 🔧 Troubleshooting

### Migration Fails: "Target database is not up to date"
**Solution**: The migration might be trying to upgrade from the wrong revision. Check the current migration status:
```bash
flask db current
flask db heads
```

If needed, you can manually set the revision:
```bash
flask db stamp 0ecbce9af45e  # Set to current production state
flask db upgrade  # Then upgrade to head
```

### Migration Fails: "Table already exists"
**Solution**: If the table already exists (maybe created manually), you can mark it as done:
```bash
flask db stamp head  # Mark current migration as complete
```

### Connection Errors
**Solution**: Make sure your `DATABASE_URL` environment variable is set correctly in Render:
- Go to your Web Service → **Environment**
- Verify `DATABASE_URL` is set to your PostgreSQL database URL
- It should look like: `postgresql://user:password@host:port/database`

---

## 📋 Pre-Deployment Checklist

Before deploying:
- [ ] Code is committed and pushed to Git
- [ ] All migrations are tested locally
- [ ] `HabitPreset` model is imported in `server/db/models.py`
- [ ] Migration file exists: `server/migrations/versions/add_habit_presets_table.py`
- [ ] API routes are tested: `server/routes/groups.py` has `/habit-presets` endpoints
- [ ] Frontend is built and ready: `client/dist/` contains latest build
- [ ] Environment variables are set in Render dashboard

---

## 🎯 Post-Deployment

After successful deployment:
1. **Monitor logs** for the first few minutes
2. **Test habit presets feature** in the UI:
   - Create a preset as a group leader
   - Load a preset when creating a challenge
   - Verify preset is saved and retrievable
3. **Check database** for any unexpected errors
4. **Verify frontend** can communicate with backend

---

## 🔄 Rollback Plan

If something goes wrong and you need to rollback:

### Rollback Migration:
```bash
flask db downgrade -1  # Go back one migration
```

### Or manually drop the table:
```sql
DROP TABLE IF EXISTS habit_presets CASCADE;
```

Then revert your code:
```bash
git revert HEAD
git push origin main
```

---

## 📝 Additional Notes

- **Zero Downtime**: This migration creates a new table, so it won't affect existing functionality
- **No Data Loss**: Existing data is not modified
- **Backward Compatible**: Old code will continue to work (new table is optional feature)
- **Future Migrations**: If you add more migrations later, just run `flask db upgrade` again

---

**Last Updated**: 2025-01-27
**Migration File**: `server/migrations/versions/add_habit_presets_table.py`
**Related Changes**: Habit Presets feature in `GroupDetail.jsx` and `server/routes/groups.py`

