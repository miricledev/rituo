import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { FiActivity, FiCheckCircle, FiClock, FiInfo, FiRepeat, FiTarget, FiTrendingDown, FiTrendingUp, FiZap } from 'react-icons/fi';
import { parseDateLocal } from '../utils/habitScheduleUtils';

const formatShortDate = (value) => parseDateLocal(value).toLocaleDateString([], { day: 'numeric', month: 'short' });
const formatUnits = (value) => Number(value || 0).toLocaleString([], { maximumFractionDigits: 2 });

function metricTone(tone) {
  const tones = {
    violet: 'border-violet-300/15 bg-violet-400/10 text-violet-200',
    cyan: 'border-cyan-300/15 bg-cyan-400/10 text-cyan-200',
    emerald: 'border-emerald-300/15 bg-emerald-400/10 text-emerald-200',
    amber: 'border-amber-300/15 bg-amber-400/10 text-amber-200'
  };
  return tones[tone] || tones.violet;
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <article className={`rounded-2xl border p-4 backdrop-blur-xl sm:p-5 ${metricTone(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.17em] opacity-65">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{value}</p>
        </div>
        <span className="rounded-xl border border-white/10 bg-white/5 p-2.5"><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

function BreakdownCard({ title, rows }) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 sm:p-5">
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-300">{title}</h3>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-bold capitalize text-slate-200">{row.key.replaceAll('-', ' ')}</span>
              <span className="font-black text-white">{Math.round(row.completionRate)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-400 to-cyan-400" style={{ width: `${Math.min(100, row.completionRate)}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
              <span>{row.habitCount} habit{row.habitCount === 1 ? '' : 's'}</span>
              <span>{formatUnits(row.earnedUnits)}/{row.possibleUnits} units</span>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-slate-500">No breakdown data is available yet.</p> : null}
      </div>
    </article>
  );
}

const TaskProgress = ({ analytics }) => {
  if (!analytics) return null;

  const summary = analytics.summary || {};
  const challenge = analytics.challenge || {};
  const habits = analytics.habits || [];
  const daily = analytics.daily || [];
  const trendUp = Number(summary.trendDelta || 0) >= 0;
  const TrendIcon = trendUp ? FiTrendingUp : FiTrendingDown;
  const periodicCoverage = summary.periodicTarget
    ? (summary.periodicCompleted / summary.periodicTarget) * 100
    : null;
  const todayRate = summary.today?.completionRate;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Completion rate"
          value={`${Math.round(summary.completionRate || 0)}%`}
          detail="Average progress across every scheduled habit-day, including partial recurring and numeric progress."
          icon={FiActivity}
          tone="violet"
        />
        <MetricCard
          label="Completion units"
          value={`${formatUnits(summary.earnedUnits)}/${summary.possibleUnits || 0}`}
          detail="One full habit-day equals one unit. Three of four recurring occurrences earns 0.75 units."
          icon={FiTarget}
          tone="cyan"
        />
        <MetricCard
          label="Active days"
          value={`${summary.activeDays || 0}/${summary.scheduledDays || 0}`}
          detail={`${summary.perfectDays || 0} perfect, ${summary.partialDays || 0} partial, ${summary.missedDays || 0} missed${summary.pendingDays ? ` and ${summary.pendingDays} live pending` : ''}.`}
          icon={FiCheckCircle}
          tone="emerald"
        />
        <MetricCard
          label="Active streak"
          value={`${summary.currentActiveStreak || 0}`}
          detail={`${summary.currentPerfectStreak || 0}-day perfect streak. Unscheduled days never break either streak.`}
          icon={FiZap}
          tone="amber"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
        <article className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Daily consistency</p>
              <h2 className="mt-2 text-xl font-black sm:text-2xl">Progress across scheduled days</h2>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Each point is the average percentage earned across habits scheduled that day. Today remains live until its completion windows close.</p>
            </div>
            <div className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-black ${trendUp ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/20 bg-rose-300/10 text-rose-200'}`}>
              <TrendIcon /> {Math.abs(Number(summary.trendDelta || 0)).toFixed(1)} pts vs prior period
            </div>
          </div>

          <div className="mt-5 h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="studentStatsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Completion']}
                  labelFormatter={(value) => parseDateLocal(value).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, color: '#fff' }}
                />
                <Area type="monotone" dataKey="completionRate" stroke="#22d3ee" strokeWidth={3} fill="url(#studentStatsGradient)" dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#22d3ee' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-violet-500/15 to-cyan-400/5 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Challenge position</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-4xl font-black">{Math.round(challenge.progressPercent || 0)}%</p>
              <p className="text-right text-xs leading-5 text-slate-400">Day {challenge.elapsedDays || 0} of {challenge.totalDays || 0}<br />{challenge.daysRemaining || 0} days remaining</p>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(100, challenge.progressPercent || 0)}%` }} /></div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-center gap-2 text-cyan-200"><FiClock /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Today so far</p></div>
            <p className="mt-3 text-3xl font-black">{todayRate === undefined ? 'Not scheduled' : `${Math.round(todayRate)}%`}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">This is live progress, not a final day result, while today’s habit windows remain open.</p>
          </article>

          {periodicCoverage !== null ? (
            <article className="rounded-[1.5rem] border border-cyan-300/15 bg-cyan-300/10 p-5">
              <div className="flex items-center gap-2 text-cyan-200"><FiRepeat /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Recurring coverage</p></div>
              <p className="mt-3 text-3xl font-black">{Math.round(periodicCoverage)}%</p>
              <p className="mt-2 text-xs text-cyan-100/65">{summary.periodicCompleted}/{summary.periodicTarget} logged occurrences across scheduled recurring habit-days.</p>
            </article>
          ) : null}
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <BreakdownCard title="Attack / defence performance" rows={analytics.combatTypeBreakdown || []} />
        <BreakdownCard title="Habit type performance" rows={analytics.habitTypeBreakdown || []} />
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Habit-by-habit</p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">What is driving the result</h2>
          </div>
          {summary.bestDay ? <p className="text-xs text-slate-400">Best day: <span className="font-bold text-white">{formatShortDate(summary.bestDay.date)} · {Math.round(summary.bestDay.completionRate)}%</span></p> : null}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {habits.map((habit) => (
            <article key={habit.index} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{habit.habitType}</span>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{habit.combatType}</span>
                  </div>
                  <h3 className="mt-3 truncate font-black text-white">{habit.name}</h3>
                  {habit.linkedGoalTitle ? <p className="mt-1 truncate text-xs text-violet-200">Goal: {habit.linkedGoalTitle}</p> : null}
                </div>
                <p className="text-2xl font-black text-cyan-200">{Math.round(habit.completionRate)}%</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(100, habit.completionRate)}%` }} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-lg bg-emerald-400/10 px-2 py-2"><p className="font-black text-emerald-200">{habit.fullCount}</p><p className="text-[9px] uppercase tracking-wide text-slate-500">Full</p></div>
                <div className="rounded-lg bg-amber-400/10 px-2 py-2"><p className="font-black text-amber-200">{habit.partialCount}</p><p className="text-[9px] uppercase tracking-wide text-slate-500">Partial</p></div>
                <div className="rounded-lg bg-rose-400/10 px-2 py-2"><p className="font-black text-rose-200">{habit.missedCount}</p><p className="text-[9px] uppercase tracking-wide text-slate-500">Missed</p></div>
                {habit.pendingCount ? <div className="rounded-lg bg-sky-400/10 px-2 py-2"><p className="font-black text-sky-200">{habit.pendingCount}</p><p className="text-[9px] uppercase tracking-wide text-slate-500">Pending</p></div> : null}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>{formatUnits(habit.earnedUnits)}/{habit.possibleUnits} units</span><span>{habit.currentFullStreak} full streak</span></div>
              {habit.habitType === 'periodic' ? <p className="mt-2 text-[10px] font-semibold text-cyan-300">{habit.periodicCompleted}/{habit.periodicTarget} occurrences logged</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-cyan-300/10 p-2 text-cyan-200"><FiInfo /></span>
          <div>
            <h3 className="text-sm font-black text-cyan-100">How these figures are calculated</h3>
            <p className="mt-2 text-xs leading-6 text-slate-400">{analytics.definitions?.completionRate}</p>
            <p className="text-xs leading-6 text-slate-400">{analytics.definitions?.fullStreak}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TaskProgress;
