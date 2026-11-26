import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { FiActivity, FiCheckCircle, FiEdit3, FiInfo, FiRepeat, FiShield, FiTarget, FiTrendingUp, FiXCircle, FiZap } from 'react-icons/fi';
import { useTask } from '../contexts/TaskContext';
import { formatDateLocal, parseDateLocal } from '../utils/habitScheduleUtils';
import InlineToast from '../components/InlineToast';

const formatDate = (value, options = { day: 'numeric', month: 'short' }) => parseDateLocal(value).toLocaleDateString([], options);
const formatUnits = (value) => Number(value || 0).toLocaleString([], { maximumFractionDigits: 2 });

function normalizeTaskData(taskData, habitData) {
  if (!taskData) return null;
  if (Array.isArray(taskData.dailyData)) return taskData;

  const dailyData = (taskData.daily_data || []).map((row) => {
    const percentage = row.is_complete ? 100 : 0;
    return {
      date: row.date,
      isScheduled: row.isScheduled !== false,
      progressPercent: percentage,
      progressFraction: percentage / 100,
      status: percentage >= 100 ? 'complete' : 'missed',
      isComplete: percentage >= 100,
      hasProgress: percentage > 0,
      numericValue: row.numericValue,
      textValue: row.textValue,
      periodicCompleted: row.periodicCompleted,
      periodicTarget: row.periodicTarget,
    };
  });
  const rawRate = Number(taskData.completion_rate || 0);
  const completionRate = rawRate <= 1 ? rawRate * 100 : rawRate;
  return {
    index: Number(taskData.task_id || 0),
    name: taskData.task?.title || habitData?.name || 'Habit',
    description: taskData.task?.description || habitData?.description || '',
    habitType: habitData?.habitType || 'boolean',
    combatType: habitData?.combatType || 'unclassified',
    completionRate,
    earnedUnits: Number(taskData.days_completed || 0),
    possibleUnits: dailyData.filter((row) => row.isScheduled).length,
    fullCount: Number(taskData.days_completed || 0),
    partialCount: 0,
    missedCount: Math.max(0, dailyData.filter((row) => row.isScheduled).length - Number(taskData.days_completed || 0)),
    currentFullStreak: Number(taskData.current_streak || 0),
    longestFullStreak: Number(taskData.current_streak || 0),
    currentActiveStreak: Number(taskData.current_streak || 0),
    longestActiveStreak: Number(taskData.current_streak || 0),
    dailyData,
  };
}

function statusMeta(row) {
  if (!row.isScheduled) return { label: 'Not scheduled', tone: 'border-slate-300/15 bg-slate-300/10 text-slate-400' };
  if (row.status === 'complete' || row.progressPercent >= 100) return { label: 'Complete', tone: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' };
  if (row.status === 'partial' || row.progressPercent > 0) return { label: 'Partial', tone: 'border-amber-300/20 bg-amber-300/10 text-amber-200' };
  if (row.status === 'pending') return { label: 'Live pending', tone: 'border-sky-300/20 bg-sky-300/10 text-sky-200' };
  return { label: 'Missed', tone: 'border-rose-300/20 bg-rose-300/10 text-rose-200' };
}

const TaskStats = ({
  taskData: taskDataProp,
  habitData,
  loading: loadingProp,
  editMode = false,
  onUpdateDay,
  saving = false,
  liveDate = ''
}) => {
  const { taskId } = useParams();
  const taskContext = useTask ? useTask() : {};
  const [taskData, setTaskData] = useState(taskDataProp || null);
  const [isLoading, setIsLoading] = useState(!taskDataProp);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [textCorrectionStatus, setTextCorrectionStatus] = useState('complete');

  useEffect(() => {
    if (taskDataProp) setTaskData(taskDataProp);
  }, [taskDataProp]);

  useEffect(() => {
    if (taskDataProp || !taskId || !taskContext.fetchTaskAnalytics) return;
    const loadTaskData = async () => {
      try {
        setIsLoading(true);
        setTaskData(await taskContext.fetchTaskAnalytics(taskId));
        setError('');
      } catch (requestError) {
        setError('Task statistics could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    };
    loadTaskData();
  }, [taskContext.fetchTaskAnalytics, taskDataProp, taskId]);

  const normalized = useMemo(() => normalizeTaskData(taskData, habitData), [habitData, taskData]);
  const loading = typeof loadingProp === 'boolean' ? loadingProp : isLoading || taskContext.loading;
  const studentToday = liveDate || formatDateLocal(new Date());

  const handleDayClick = (day) => {
    if (!editMode || !onUpdateDay || !day.isScheduled) return;
    const progressEntry = habitData?.progress?.find((entry) => entry.date?.startsWith(day.date));
    const habitType = habitData?.habitType || normalized?.habitType || 'boolean';
    if (habitType === 'numeric') {
      setEditingDay({ date: day.date, type: habitType });
      setEditValue(String(progressEntry?.numericValue ?? habitData?.minValue ?? 0));
    } else if (habitType === 'text') {
      setEditingDay({ date: day.date, type: habitType });
      setEditValue(progressEntry?.textValue || '');
      setTextCorrectionStatus(day.isComplete ? 'complete' : 'missed');
    } else if (habitType === 'periodic') {
      setEditingDay({ date: day.date, type: habitType, target: Number(day.periodicTarget) || Number(habitData?.periodicOccurrences) || 4 });
      setEditValue(String(progressEntry?.periodicCompleted ?? day.periodicCompleted ?? 0));
    } else {
      setEditingDay({ date: day.date, type: habitType });
      setEditValue(day.isComplete ? 'complete' : 'missed');
    }
    setCorrectionReason('');
  };

  const handleSaveEdit = async () => {
    if (!editingDay || !onUpdateDay) return;
    const reason = correctionReason.trim();
    if (reason.length < 5) {
      setToast({ type: 'error', title: 'Verification reason required', message: 'Briefly explain how the completion was verified.' });
      return;
    }
    let updateData;
    if (editingDay.type === 'numeric') {
      const numericValue = Number(editValue);
      if (!Number.isFinite(numericValue)) {
        setToast({ type: 'error', title: 'Invalid number', message: 'Enter a valid numeric result.' });
        return;
      }
      updateData = { numericValue };
    } else if (editingDay.type === 'text') {
      if (textCorrectionStatus === 'missed') {
        updateData = { completed: false };
      } else if (!editValue.trim()) {
        setToast({ type: 'error', title: 'Verified response required', message: 'Add the response or evidence confirmed by the administrator.' });
        return;
      } else {
        updateData = { textValue: editValue.trim() };
      }
    } else if (editingDay.type === 'periodic') {
      const target = Math.max(1, Number(editingDay.target) || Number(habitData?.periodicOccurrences) || 4);
      const completed = Number(editValue);
      if (!Number.isInteger(completed) || completed < 0 || completed > target) {
        setToast({ type: 'error', title: 'Invalid occurrence count', message: `Enter a whole number from 0 to ${target}.` });
        return;
      }
      updateData = { periodicCompleted: completed };
    } else {
      updateData = { completed: editValue === 'complete' };
    }
    try {
      const result = await onUpdateDay(editingDay.date, { ...updateData, reason });
      const rewardNote = Number(result?.ipBucksRefunded) > 0
        ? ` ${result.ipBucksRefunded} IP Bucks used for streak protection were refunded.`
        : Number(result?.ipBucksEarnedAdjustment) > 0
          ? ` The corrected streak earned ${result.ipBucksEarnedAdjustment} additional IP Bucks.`
          : '';
      setToast({ type: 'success', title: 'Verified correction saved', message: `Statistics and streaks were recalculated.${rewardNote}` });
      setEditingDay(null);
      setEditValue('');
      setCorrectionReason('');
      setTextCorrectionStatus('complete');
    } catch (requestError) {
      setToast({ type: 'error', title: 'Correction not saved', message: requestError.response?.data?.error || 'The habit record could not be corrected.' });
    }
  };

  if (loading) return <div className="h-96 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />;
  if (error || !normalized) {
    return <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/10 p-6 text-rose-100">{error || 'Habit statistics are unavailable.'}</div>;
  }

  const chartData = [...(normalized.dailyData || [])]
    .filter((row) => row.isScheduled !== false)
    .sort((left, right) => left.date.localeCompare(right.date));
  const historyRows = [...(normalized.dailyData || [])].sort((left, right) => right.date.localeCompare(left.date));
  const periodicTarget = Number(habitData?.periodicOccurrences || normalized.periodicOccurrences || 4);

  return (
    <div className="space-y-5 text-white">
      {toast ? <InlineToast toast={toast} onClose={() => setToast(null)} /> : null}
      {!taskDataProp ? <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300">← Return to dashboard</Link> : null}

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-violet-200">{normalized.habitType}</span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-200">{normalized.combatType}</span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{normalized.name}</h2>
            {normalized.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{normalized.description}</p> : null}
            {normalized.linkedGoalTitle ? <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/10 px-3 py-1.5 text-xs font-bold text-violet-200"><FiTarget /> Goal: {normalized.linkedGoalTitle}</p> : null}
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-5 py-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/65">Average completion</p>
            <p className="mt-1 text-4xl font-black text-white">{Math.round(normalized.completionRate || 0)}%</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Completion units', `${formatUnits(normalized.earnedUnits)}/${normalized.possibleUnits || 0}`, FiActivity, 'text-violet-200'],
            ['Full / partial', `${normalized.fullCount || 0} / ${normalized.partialCount || 0}`, FiCheckCircle, 'text-emerald-200'],
            [normalized.pendingCount ? 'Missed / pending' : 'Missed occasions', normalized.pendingCount ? `${normalized.missedCount || 0} / ${normalized.pendingCount}` : normalized.missedCount || 0, FiXCircle, 'text-rose-200'],
            ['Full streak', normalized.currentFullStreak || 0, FiZap, 'text-amber-200'],
          ].map(([label, value, Icon, tone]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <Icon className={`h-5 w-5 ${tone}`} />
              <p className="mt-3 text-2xl font-black">{value}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {normalized.habitType === 'periodic' ? (
          <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-gradient-to-r from-cyan-300/10 to-violet-300/10 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-black text-cyan-100"><FiRepeat /> Recurring occurrence coverage</div>
              <div className="text-sm font-black">{normalized.periodicCompleted || 0}/{normalized.periodicTarget || 0} occurrences · {Math.round(((normalized.periodicCompleted || 0) / Math.max(normalized.periodicTarget || 1, 1)) * 100)}%</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Every occurrence contributes proportionally. For example, 3 of 4 occurrences records 75% for that scheduled habit-day.</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">History</p><h3 className="mt-2 text-xl font-black">Completion percentage by scheduled day</h3></div>
            <FiTrendingUp className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="mt-5 h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs><linearGradient id={`habitStats-${normalized.index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Progress']} labelFormatter={(value) => formatDate(value, { weekday: 'long', day: 'numeric', month: 'long' })} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, color: '#fff' }} />
                <Area type="monotone" dataKey="progressPercent" stroke="#a78bfa" strokeWidth={3} fill={`url(#habitStats-${normalized.index})`} dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-center gap-2 text-amber-200"><FiZap /><p className="text-[10px] font-black uppercase tracking-[0.17em]">Streak detail</p></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-3"><p className="text-2xl font-black">{normalized.currentFullStreak || 0}</p><p className="mt-1 text-[10px] text-slate-500">Current full</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-2xl font-black">{normalized.longestFullStreak || 0}</p><p className="mt-1 text-[10px] text-slate-500">Best full</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-2xl font-black">{normalized.currentActiveStreak || 0}</p><p className="mt-1 text-[10px] text-slate-500">Current active</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-2xl font-black">{normalized.longestActiveStreak || 0}</p><p className="mt-1 text-[10px] text-slate-500">Best active</p></div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">A full streak requires 100%. An active streak recognises any progress above 0%. Unscheduled days do not break either.</p>
          </article>
          <article className="rounded-[1.5rem] border border-violet-300/15 bg-violet-300/[0.08] p-5">
            <div className="flex items-center gap-2 text-violet-200"><FiShield /><p className="text-[10px] font-black uppercase tracking-[0.17em]">Schedule context</p></div>
            <p className="mt-3 text-sm font-bold">{normalized.scheduleDays?.length ? normalized.scheduleDays.join(', ') : 'Every day'}</p>
            <p className="mt-2 text-xs text-slate-400">{normalized.scheduleTime || 'Flexible time'} · {normalized.durationMinutes || 30} minutes</p>
          </article>
        </aside>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Audit trail</p><h3 className="mt-2 text-xl font-black">Scheduled-day record</h3></div>
          {editMode ? <p className="inline-flex items-center gap-2 text-xs font-bold text-amber-200"><FiEdit3 /> Select any elapsed scheduled day, including today</p> : null}
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="max-h-[32rem] overflow-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 backdrop-blur-xl">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Recorded detail</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {historyRows.map((day) => {
                  const status = statusMeta(day);
                  const isLive = day.date === studentToday;
                  const isEditable = editMode && day.isScheduled;
                  return (
                    <tr key={day.date} onClick={() => isEditable && handleDayClick(day)} className={`${isEditable ? 'cursor-pointer hover:bg-white/[0.055]' : ''} transition`}>
                      <td className="px-4 py-3"><p className="font-bold text-slate-200">{formatDate(day.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p><div className="mt-0.5 flex flex-wrap gap-2">{isLive ? <span className="text-[10px] font-black uppercase tracking-wide text-cyan-300">Live today</span> : null}{isEditable ? <span className="text-[10px] text-violet-300">Click to correct</span> : null}</div></td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${status.tone}`}>{status.label}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-2 w-24 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(100, day.progressPercent || 0)}%` }} /></div><span className="font-black">{Math.round(day.progressPercent || 0)}%</span></div></td>
                      <td className="px-4 py-3 text-xs text-slate-400"><p>{normalized.habitType === 'periodic' ? `${day.periodicCompleted || 0}/${day.periodicTarget || periodicTarget} occurrences` : normalized.habitType === 'numeric' && day.numericValue !== null ? `Value: ${day.numericValue}` : normalized.habitType === 'text' && day.textValue ? day.textValue : day.hasProgress ? 'Progress recorded' : 'No entry'}</p>{day.adminCorrected ? <div className="mt-2 rounded-lg border border-amber-300/15 bg-amber-300/10 px-2.5 py-2 text-[10px] leading-4 text-amber-100"><span className="font-black">Admin verified by {day.adminCorrection?.actorName || 'administrator'}</span>{day.adminCorrection?.reason ? <p className="mt-0.5 text-amber-100/70">{day.adminCorrection.reason}</p> : null}</div> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-4 text-xs leading-6 text-slate-400"><div className="flex items-start gap-3"><FiInfo className="mt-1 shrink-0 text-cyan-200" /><p><strong className="text-cyan-100">Accuracy note:</strong> completion rate uses only days this habit was scheduled. Numeric values use their configured range, and recurring habits use completed occurrences divided by the target stored for that day.</p></div></section>

      {editingDay ? (
        <div className="fixed inset-0 z-[100] flex overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto w-full max-w-md rounded-[1.75rem] border border-white/10 bg-slate-900 p-5 shadow-2xl sm:mx-auto sm:p-6">
            <h3 className="text-xl font-black">Correct {formatDate(editingDay.date, { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">Use this only when the student completed the habit but could not log it, or when an incorrect record needs fixing. Statistics, streaks and eligible IP Bucks recalculate immediately.</p>
            <label className="mt-5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {editingDay.type === 'periodic' ? `Completed occurrences (0–${editingDay.target || periodicTarget})` : editingDay.type === 'numeric' ? `Recorded value (${habitData?.minValue ?? 0}–${habitData?.maxValue ?? 10})` : editingDay.type === 'text' ? 'Verified response or evidence' : 'Verified result'}
            </label>
            {!['numeric', 'text', 'periodic'].includes(editingDay.type) ? <select value={editValue} onChange={(event) => setEditValue(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300/40" autoFocus><option value="complete">Completed</option><option value="missed">Not completed</option></select> : editingDay.type === 'text' ? <div className="mt-2 space-y-2"><select value={textCorrectionStatus} onChange={(event) => setTextCorrectionStatus(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300/40"><option value="complete">Completed with verified response</option><option value="missed">Not completed</option></select>{textCorrectionStatus === 'complete' ? <textarea value={editValue} onChange={(event) => setEditValue(event.target.value)} rows={4} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40" autoFocus /> : null}</div> : <input type="number" value={editValue} onChange={(event) => setEditValue(event.target.value)} min={editingDay.type === 'periodic' ? 0 : habitData?.minValue} max={editingDay.type === 'periodic' ? editingDay.target || periodicTarget : habitData?.maxValue} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40" autoFocus />}
            <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Why is this correction being made?</label>
            <textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={3} maxLength={500} placeholder="Example: Student showed their completed work after their phone battery died." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" />
            <p className="mt-2 text-[11px] leading-5 text-slate-500">The reason and before/after values are saved in the school audit trail. For today, only windows that have already opened can be corrected. If this verifies a protected missed habit, the streak protection cost is refunded.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => { setEditingDay(null); setEditValue(''); setCorrectionReason(''); setTextCorrectionStatus('complete'); }} disabled={saving} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300">Cancel</button>
              <button type="button" onClick={handleSaveEdit} disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save correction'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TaskStats;
