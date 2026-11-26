import React, { useMemo, useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiCheck, FiClock, FiInfo, FiRepeat, FiTarget, FiX } from 'react-icons/fi';
import { formatDateLocal, isHabitScheduledForDay, parseDateLocal } from '../utils/habitScheduleUtils';
import { getHabitProgressState } from '../utils/habitProgressUtils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = (value) => new Date(value.getFullYear(), value.getMonth(), 1);
const monthKey = (value) => (value.getFullYear() * 12) + value.getMonth();

function scoreTone(score, future = false) {
  if (future) return 'border-sky-300/15 bg-sky-300/10 text-sky-200';
  if (score >= 100) return 'border-emerald-300/25 bg-emerald-300/15 text-emerald-200';
  if (score >= 75) return 'border-cyan-300/25 bg-cyan-300/15 text-cyan-200';
  if (score >= 50) return 'border-amber-300/25 bg-amber-300/15 text-amber-200';
  if (score > 0) return 'border-orange-300/25 bg-orange-300/15 text-orange-200';
  return 'border-rose-300/20 bg-rose-300/10 text-rose-200';
}

function scoreLabel(score, future = false) {
  if (future) return 'Upcoming';
  if (score >= 100) return 'Perfect';
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Partial';
  if (score > 0) return 'Started';
  return 'Missed';
}

const HabitCalendar = ({ habits = [], startDate, endDate, statistics }) => {
  const studentToday = statistics?.challenge?.studentToday || formatDateLocal(new Date());
  const today = useMemo(() => parseDateLocal(studentToday), [studentToday]);
  const challengeStart = parseDateLocal(startDate);
  const challengeEnd = parseDateLocal(endDate);
  const initialMonth = parseDateLocal(statistics?.challenge?.dataThrough || formatDateLocal(today));
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(initialMonth));
  const [selectedDate, setSelectedDate] = useState(null);

  const dailyMap = useMemo(() => new Map(
    (statistics?.daily || []).map((row) => [row.date, row])
  ), [statistics?.daily]);
  const habitStatsMap = useMemo(() => new Map(
    (statistics?.habits || []).map((habit) => [habit.index, habit])
  ), [statistics?.habits]);
  const summary = statistics?.summary || {};

  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(currentMonth);
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateKey = formatDateLocal(date);
      const inChallenge = date >= challengeStart && date <= challengeEnd;
      const future = date > today;
      const daily = dailyMap.get(dateKey) || null;
      return {
        date,
        dateKey,
        inCurrentMonth: date.getMonth() === currentMonth.getMonth(),
        inChallenge,
        future,
        pending: daily?.status === 'pending',
        isToday: date.getTime() === today.getTime(),
        score: daily?.completionRate ?? null,
        daily,
      };
    });
  }, [challengeEnd, challengeStart, currentMonth, dailyMap, today]);

  const selectedDetails = useMemo(() => {
    if (!selectedDate) return null;
    const dateKey = formatDateLocal(selectedDate);
    const future = selectedDate > today;
    const dayStatistics = dailyMap.get(dateKey);
    const rows = habits.map((habit, index) => {
      if (!isHabitScheduledForDay(habit, selectedDate)) return null;
      const canonical = habitStatsMap.get(index)?.dailyData?.find((row) => row.date === dateKey);
      if (canonical) return { index, habit, ...canonical };
      const progressEntry = (habit.progress || []).find((entry) => entry.date?.slice(0, 10) === dateKey);
      const state = getHabitProgressState(habit, progressEntry);
      return {
        index,
        habit,
        date: dateKey,
        isScheduled: true,
        status: future ? 'upcoming' : state.isComplete ? 'complete' : state.isPartial ? 'partial' : 'missed',
        progressPercent: future ? null : state.percentage,
        periodicCompleted: state.periodic?.completed,
        periodicTarget: state.periodic?.target,
        numericValue: progressEntry?.numericValue,
        textValue: progressEntry?.textValue,
      };
    }).filter(Boolean);
    return {
      dateKey,
      future,
      pending: dayStatistics?.status === 'pending',
      score: dayStatistics?.completionRate ?? (future ? null : 0),
      rows,
    };
  }, [dailyMap, habitStatsMap, habits, selectedDate, today]);

  const canMovePrevious = monthKey(currentMonth) > monthKey(startOfMonth(challengeStart));
  const canMoveNext = monthKey(currentMonth) < monthKey(startOfMonth(challengeEnd));
  const changeMonth = (amount) => setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + amount, 1));

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] text-white shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-200"><FiCalendar /><p className="text-[10px] font-black uppercase tracking-[0.2em]">Consistency intelligence</p></div>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Scheduled-day calendar</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400 sm:text-sm">Colours use the true percentage earned that day. Partial recurring and numeric progress appears proportionally instead of being shown as a complete miss.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Perfect', summary.perfectDays || 0, 'text-emerald-200'],
              ['Partial', summary.partialDays || 0, 'text-amber-200'],
              ['Missed', summary.missedDays || 0, 'text-rose-200'],
              ['Average', `${Math.round(summary.completionRate || 0)}%`, 'text-cyan-200'],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-center">
                <p className={`text-xl font-black ${tone}`}>{value}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => changeMonth(-1)} disabled={!canMovePrevious} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:border-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-25"><FiChevronLeft /></button>
          <div className="text-center"><p className="text-lg font-black sm:text-xl">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</p><button type="button" onClick={() => setCurrentMonth(startOfMonth(initialMonth))} className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">Latest data</button></div>
          <button type="button" onClick={() => changeMonth(1)} disabled={!canMoveNext} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:border-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-25"><FiChevronRight /></button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((weekday) => <div key={weekday} className="py-2 text-center text-[9px] font-black uppercase tracking-wider text-slate-600 sm:text-[10px]">{weekday}</div>)}
          {calendarDays.map((day) => {
            const hasResult = day.inChallenge && !day.future;
            const score = day.score ?? 0;
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => day.inChallenge && setSelectedDate(day.date)}
                disabled={!day.inChallenge}
                className={`relative min-h-[4.5rem] rounded-xl border p-1.5 text-left transition sm:min-h-[6.25rem] sm:p-2.5 ${day.inChallenge ? `${scoreTone(score, day.future || day.pending)} hover:-translate-y-0.5 hover:shadow-lg` : 'border-white/[0.035] bg-black/10 text-slate-700'} ${day.inCurrentMonth ? '' : 'opacity-35'} ${day.isToday ? 'ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-[#070b18]' : ''}`}
              >
                <span className="text-xs font-black sm:text-sm">{day.date.getDate()}</span>
                {day.inChallenge ? (
                  <div className="mt-2 sm:mt-4">
                    <p className="text-sm font-black sm:text-xl">{day.future ? '—' : `${Math.round(score)}%`}</p>
                    <p className="mt-0.5 hidden text-[9px] font-black uppercase tracking-wide opacity-70 sm:block">{day.pending ? 'Live pending' : scoreLabel(score, day.future)}</p>
                    {hasResult && day.daily ? <p className="mt-1 hidden text-[9px] opacity-60 sm:block">{day.daily.fullCount} full · {day.daily.partialCount} partial</p> : null}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
          {[[100, 'Perfect'], [75, '75%+'], [50, '50%+'], [25, '1–49%'], [0, '0%']].map(([score, label]) => <span key={label} className={`rounded-full border px-2.5 py-1 ${scoreTone(score)}`}>{label}</span>)}
          <span className={`rounded-full border px-2.5 py-1 ${scoreTone(0, true)}`}>Upcoming</span>
        </div>
      </div>

      {selectedDetails ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[1.75rem] border border-white/10 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-900/95 p-5 backdrop-blur-xl sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Day detail</p>
                <h3 className="mt-2 text-xl font-black sm:text-2xl">{parseDateLocal(selectedDetails.dateKey).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <div className="mt-2 flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${scoreTone(selectedDetails.score || 0, selectedDetails.future || selectedDetails.pending)}`}>{selectedDetails.future ? 'Upcoming' : selectedDetails.pending ? '0% · Live pending' : `${Math.round(selectedDetails.score || 0)}% · ${scoreLabel(selectedDetails.score || 0)}`}</span>{selectedDetails.dateKey === formatDateLocal(today) ? <span className="text-xs font-bold text-cyan-300">Live today</span> : null}</div>
              </div>
              <button type="button" onClick={() => setSelectedDate(null)} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300"><FiX /></button>
            </div>

            <div className="space-y-3 p-4 sm:p-6">
              {selectedDetails.rows.map((row) => {
                const score = row.progressPercent ?? 0;
                const future = selectedDetails.future;
                const pending = row.status === 'pending';
                return (
                  <article key={row.index} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5"><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{row.habit.habitType || 'boolean'}</span><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{row.habit.combatType || 'unclassified'}</span></div>
                        <h4 className="mt-2 font-black text-white">{row.habit.name}</h4>
                        {row.habit.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{row.habit.description}</p> : null}
                      </div>
                      <div className={`shrink-0 rounded-xl border px-4 py-3 text-center ${scoreTone(score, future || pending)}`}>
                        <p className="text-xl font-black">{future ? '—' : `${Math.round(score)}%`}</p>
                        <p className="text-[9px] font-black uppercase tracking-wide opacity-70">{future ? 'Scheduled' : pending ? 'Live pending' : scoreLabel(score)}</p>
                      </div>
                    </div>
                    {!future ? <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(100, score)}%` }} /></div> : null}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                      {row.habit.habitType === 'periodic' ? <span className="inline-flex items-center gap-1.5 text-cyan-200"><FiRepeat /> {row.periodicCompleted || 0}/{row.periodicTarget || row.habit.periodicOccurrences || 4} occurrences</span> : null}
                      {row.numericValue !== null && row.numericValue !== undefined ? <span>Value: {row.numericValue}</span> : null}
                      {row.textValue ? <span>Response: {row.textValue}</span> : null}
                      {future ? <span className="inline-flex items-center gap-1.5"><FiClock /> Awaiting scheduled date</span> : row.progressPercent >= 100 ? <span className="inline-flex items-center gap-1.5 text-emerald-200"><FiCheck /> Target reached</span> : null}
                    </div>
                  </article>
                );
              })}
              {!selectedDetails.rows.length ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No habits were scheduled for this day.</div> : null}
              <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-4 text-xs leading-5 text-slate-400"><FiInfo className="mt-0.5 shrink-0 text-cyan-200" /><p>Day consistency is the average of the percentages earned by habits scheduled on this date. Habits not scheduled on this date are excluded completely.</p></div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default HabitCalendar;
