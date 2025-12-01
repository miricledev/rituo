# Skill Chart Data Loss Bug - Fix and Recovery Guide

## The Problem

A critical bug was discovered where skill chart data could be lost when switching between terms. Here's what happened:

1. **The Bug**: When a coach/leader switched from one term to another, the auto-save mechanism would save ALL skill levels (from all terms) to the NEW term, overwriting that term's existing data.

2. **Root Cause**: 
   - The `skillLevels` state contains data for ALL terms mixed together (keys like `autumn1-Skill-1`, `spring1-Skill-1`, etc.)
   - When `activeTerm` changed, the auto-save effect would trigger
   - `saveSkillChartData()` would save the entire `skillLevels` object to the new term
   - This overwrote the new term's data with a mix of all terms' data
   - When switching back, the original term's data was gone

3. **The Race Condition**:
   - Term A → Switch to Term B → Auto-save saves Term A's data to Term B (overwrites Term B)
   - Term B → Switch back to Term A → Auto-save saves Term B's corrupted data to Term A (overwrites Term A)
   - Result: Both terms lose their original data

## The Fix

### Changes Made to `client/src/components/ColorChart.jsx`:

1. **Filter by Term When Saving**: Modified `saveSkillChartData()` to only save skill levels that belong to the specific term being saved:
   ```javascript
   // Filter skillLevels to only include data for the specified term
   const termSpecificSkillLevels = {};
   Object.keys(skillLevels).forEach(key => {
     if (key.startsWith(`${term}-`)) {
       termSpecificSkillLevels[key] = skillLevels[key];
     }
   });
   ```

2. **Save Before Switching**: Added logic to save the previous term's data before loading a new term:
   - Track the previous term using `previousTermRef`
   - When switching terms, save the previous term's data first
   - Then load the new term's data

3. **Prevent Auto-Save During Term Switch**: Added `isSwitchingTermRef` flag to prevent auto-save from interfering during term switches

4. **Removed `activeTerm` from Auto-Save Dependencies**: The auto-save effect now only triggers when `skillLevels` or `colorScheme` change, not when `activeTerm` changes

## Data Recovery

### Step 1: Run the Recovery Script

A recovery script has been created at `server/recover_skill_chart_data.py`. To run it:

```bash
cd server
python recover_skill_chart_data.py
```

This script will:
- Show all skill charts in the database
- List recent updates (last 7 days)
- Identify charts with empty `skill_levels` (potentially lost data)
- Show all unique group/member/term combinations

### Step 2: Check Database Backups

If you have database backups, you may be able to recover the data:

1. **Render Database Backups**: If using Render, check the database dashboard for automatic backups
2. **PostgreSQL Point-in-Time Recovery**: If WAL archiving is enabled, you can recover to a specific point in time
3. **Manual Backups**: Check if you have any manual database dumps

### Step 3: Manual Recovery (if backups exist)

If you have a backup from before the data loss:

1. Identify the affected group, member, and term
2. Extract the `skill_levels` JSON from the backup
3. Update the database record:
   ```sql
   UPDATE skill_development_charts 
   SET skill_levels = '{"autumn1-Skill-1": "excellent", ...}'::jsonb
   WHERE group_id = <group_id> 
     AND member_id = <member_id> 
     AND term = '<term>';
   ```

### Step 4: Check Application Logs

Check the application logs around the time of the data loss for any error messages:

```bash
# On Render, check the logs
# Or locally:
tail -f server/logs/rituo.log
```

Look for:
- Error messages during save operations
- CORS or network errors
- Database connection issues

## Prevention

The fix ensures that:
1. ✅ Each term's data is saved separately (filtered by term)
2. ✅ Previous term's data is saved before switching to a new term
3. ✅ Auto-save doesn't interfere with term switching
4. ✅ Data from one term can't overwrite another term's data

## Testing the Fix

To verify the fix works:

1. **Test Term Switching**:
   - Fill in skill chart data for Term A
   - Switch to Term B
   - Fill in data for Term B
   - Switch back to Term A
   - Verify Term A's data is still intact

2. **Test Auto-Save**:
   - Make changes to a skill level
   - Wait 1 second (auto-save delay)
   - Switch terms
   - Switch back
   - Verify changes were saved

3. **Test Edit Mode**:
   - Enter edit mode
   - Make changes
   - Switch terms without exiting edit mode
   - Verify data is saved correctly

## Next Steps

1. ✅ Run the recovery script to identify lost data
2. ✅ Check for database backups
3. ✅ Deploy the fix to production
4. ⚠️ Monitor for any future data loss issues
5. ⚠️ Consider adding database-level backups if not already in place

## Questions?

If you need help recovering data or have questions about the fix, check:
- The recovery script output
- Application logs
- Database backup availability

