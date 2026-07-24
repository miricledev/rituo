import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import InlineToast from './InlineToast';

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const addMinutes = (time, minutes) => {
  const [hour, minute] = (time || '16:00').split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, hour * 60 + minute + Number(minutes || 30)));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const itemStyles = {
  school: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100',
  habit: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100',
  manual: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
  break: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
};

const DailyHabitPlanner = ({ groupId, profile, canEdit, schoolTimetable = [] }) => {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [items, setItems] = useState([]);
  const [constraintsText, setConstraintsText] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [toast, setToast] = useState(null);

  const weekday = useMemo(
    () => new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    [selectedDate]
  );

  const scheduledHabits = useMemo(
    () => (profile?.linkedHabits || []).filter((habit) => {
      const days = habit.scheduleDays || [];
      return !days.length || days.includes(weekday);
    }),
    [profile?.linkedHabits, weekday]
  );

  const buildDefaultItems = () => {
    const schoolItems = schoolTimetable
      .filter((entry) => entry.weekday === weekday)
      .filter((entry) => {
        const studentIds = (entry.studentIds || []).map(Number);
        return !studentIds.length || studentIds.includes(Number(profile?.student?.id));
      })
      .map((entry) => ({
        id: `school-${entry.id}`,
        title: entry.subject || 'School',
        itemType: 'school',
        habitIndex: -1,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationMinutes: 30,
        locked: true,
        reason: entry.room || 'School timetable',
        source: 'school'
      }));
    const habitItems = scheduledHabits.map((habit, index) => {
      const startTime = habit.scheduleTime || addMinutes('16:00', index * 45);
      return {
        id: `habit-${habit.index}`,
        title: habit.name,
        itemType: 'habit',
        habitIndex: habit.index,
        startTime,
        endTime: addMinutes(startTime, habit.durationMinutes || 30),
        durationMinutes: Number(habit.durationMinutes) || 30,
        locked: false,
        reason: 'Habit target',
        source: 'default'
      };
    });
    return [...schoolItems, ...habitItems].sort((left, right) => left.startTime.localeCompare(right.startTime));
  };

  useEffect(() => {
    if (!groupId || !profile?.student?.id) return;
    let cancelled = false;
    const loadPlan = async () => {
      try {
        setLoadingPlan(true);
        const response = await axios.get(`/groups/${groupId}/students/${profile.student.id}/schedule`, {
          params: { date: selectedDate }
        });
        if (cancelled) return;
        const plan = response.data?.plan;
        setConstraintsText(plan?.constraintsText || '');
        setItems(plan?.items?.length ? plan.items : buildDefaultItems());
      } catch (error) {
        if (!cancelled) {
          setItems(buildDefaultItems());
          setToast({ type: 'error', title: 'Calendar not loaded', message: error.response?.data?.error || 'Using the default habit plan.' });
        }
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    };
    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [groupId, profile?.student?.id, selectedDate, weekday]);

  const totalMinutes = useMemo(
    () => items.filter((item) => item.itemType === 'habit').reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0),
    [items]
  );

  const updateItem = (itemId, patch) => {
    setItems((previous) => previous
      .map((item) => {
        if (item.id !== itemId || item.locked) return item;
        const next = { ...item, ...patch };
        if (patch.startTime && !patch.endTime) {
          next.endTime = addMinutes(patch.startTime, item.durationMinutes || 30);
        }
        if (patch.durationMinutes) {
          next.endTime = addMinutes(next.startTime, patch.durationMinutes);
        }
        return next;
      })
      .sort((left, right) => left.startTime.localeCompare(right.startTime)));
  };

  const swapTimes = (sourceId, targetId) => {
    const source = items.find((item) => item.id === sourceId);
    const target = items.find((item) => item.id === targetId);
    if (!source || !target || source.locked || target.locked) return;
    setItems((previous) => previous.map((item) => {
      if (item.id === sourceId) {
        return { ...item, startTime: target.startTime, endTime: addMinutes(target.startTime, item.durationMinutes) };
      }
      if (item.id === targetId) {
        return { ...item, startTime: source.startTime, endTime: addMinutes(source.startTime, item.durationMinutes) };
      }
      return item;
    }).sort((left, right) => left.startTime.localeCompare(right.startTime)));
  };

  const addManualBlock = () => {
    const startTime = '17:00';
    setItems((previous) => [...previous, {
      id: `manual-${Date.now()}`,
      title: 'New commitment',
      itemType: 'manual',
      habitIndex: -1,
      startTime,
      endTime: addMinutes(startTime, 60),
      durationMinutes: 60,
      locked: false,
      reason: '',
      source: 'manual'
    }].sort((left, right) => left.startTime.localeCompare(right.startTime)));
  };

  const saveCalendar = async () => {
    try {
      setSaving(true);
      await axios.put(`/groups/${groupId}/students/${profile.student.id}/schedule`, {
        date: selectedDate,
        constraintsText,
        items
      });
      const habitItems = items.filter((item) => item.itemType === 'habit' && item.habitIndex >= 0);
      await axios.put(`/groups/${groupId}/students/${profile.student.id}/planner`, {
        habits: habitItems.map((item, orderIndex) => ({
          index: item.habitIndex,
          orderIndex,
          scheduleTime: item.startTime,
          durationMinutes: item.durationMinutes
        }))
      });
      setToast({ type: 'success', title: 'Calendar saved', message: 'Your timetable and habit times are now in sync.' });
    } catch (error) {
      setToast({ type: 'error', title: 'Calendar not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const generateWithAi = async () => {
    try {
      setGenerating(true);
      const response = await axios.post(`/groups/${groupId}/students/${profile.student.id}/schedule/ai`, {
        date: selectedDate,
        constraintsText,
        manualItems: items.filter((item) => item.itemType === 'manual')
      });
      setItems(response.data?.plan?.items || []);
      setToast({
        type: 'success',
        title: 'Your day is planned',
        message: response.data?.summary || 'OpenAI fitted your habits around fixed commitments.'
      });
    } catch (error) {
      setToast({ type: 'error', title: 'AI plan unavailable', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 p-5 text-white dark:border-slate-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">MindHeartGut day planner</p>
            <h4 className="mt-1 text-2xl font-semibold">Shape a day that actually fits</h4>
            <p className="mt-1 text-sm text-slate-300">School stays fixed. Habits and personal commitments move around it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
            <span className="rounded-full bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-200">{totalMinutes} habit mins</span>
          </div>
        </div>
      </div>

      <div className="p-5">
        <InlineToast toast={toast} onClose={() => setToast(null)} />

        {canEdit && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/20">
            <label className="text-sm font-semibold text-violet-950 dark:text-violet-100">Tell the planner what your day looks like</label>
            <textarea
              value={constraintsText}
              onChange={(event) => setConstraintsText(event.target.value)}
              rows={4}
              placeholder="I get home at 4:15, need dinner at 6:30, football training is 7–8, and I focus best before dinner..."
              className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-violet-800 dark:bg-slate-950 dark:text-white"
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={addManualBlock} className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-white dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950">
                + Add commitment
              </button>
              <button type="button" onClick={generateWithAi} disabled={generating || !scheduledHabits.length} className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50">
                {generating ? 'Planning your day...' : 'Plan my day with OpenAI'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5">
          {loadingPlan ? (
            <div className="flex min-h-48 items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>
          ) : !items.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Nothing is scheduled for {weekday}. Add a commitment or ask OpenAI to build the day.
            </div>
          ) : (
            <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[54px] before:top-4 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
              {items.map((item) => (
                <div
                  key={item.id}
                  draggable={canEdit && !item.locked}
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={(event) => canEdit && !item.locked && event.preventDefault()}
                  onDrop={() => {
                    if (draggedId && draggedId !== item.id) swapTimes(draggedId, item.id);
                    setDraggedId(null);
                  }}
                  className="relative grid grid-cols-[46px_minmax(0,1fr)] gap-4"
                >
                  <div className="pt-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400">{item.startTime}</div>
                  <div className={`rounded-2xl border p-4 transition ${itemStyles[item.itemType] || itemStyles.manual} ${canEdit && !item.locked ? 'cursor-grab hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {canEdit && item.itemType === 'manual' ? (
                            <input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-current/20 bg-white/70 px-2 py-1 font-semibold text-inherit dark:bg-slate-950/40" />
                          ) : (
                            <span className="font-semibold">{item.title}</span>
                          )}
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider dark:bg-slate-950/40">{item.itemType}</span>
                          {item.locked && <span className="text-xs opacity-70">Locked</span>}
                        </div>
                        {item.reason && <p className="mt-1 truncate text-xs opacity-70">{item.reason}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="time" value={item.startTime} disabled={!canEdit || item.locked} onChange={(event) => updateItem(item.id, { startTime: event.target.value })} className="rounded-lg border border-current/20 bg-white/70 px-2 py-1.5 text-sm text-inherit disabled:opacity-70 dark:bg-slate-950/40" />
                        <span className="text-xs opacity-60">to</span>
                        <input type="time" value={item.endTime} disabled={!canEdit || item.locked} onChange={(event) => updateItem(item.id, { endTime: event.target.value })} className="rounded-lg border border-current/20 bg-white/70 px-2 py-1.5 text-sm text-inherit disabled:opacity-70 dark:bg-slate-950/40" />
                        {canEdit && !item.locked && (
                          <button type="button" onClick={() => setItems((previous) => previous.filter((entry) => entry.id !== item.id))} className="rounded-lg px-2 py-1 text-lg opacity-60 hover:bg-white/70 hover:opacity-100 dark:hover:bg-slate-950/40" aria-label={`Remove ${item.title}`}>×</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={saveCalendar} disabled={saving} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">
              {saving ? 'Saving...' : 'Save calendar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyHabitPlanner;
