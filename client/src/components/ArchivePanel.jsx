import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FiArchive, FiAward, FiCalendar, FiInfo, FiRepeat, FiTarget, FiUsers } from 'react-icons/fi';
import { getArchiveBestPerformer } from '../utils/archiveHelpers';

const formatDate = (value) => {
  if (!value) return 'Unknown';
  const dateValue = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return dateValue.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

const numberValue = (value, digits = 1) => Number(value || 0).toFixed(digits).replace(/\.0$/, '');

const ArchivePanel = ({ archivesLoading, archives, workspaceType = 'school' }) => {
  const isFootballWorkspace = workspaceType === 'football';
  const memberLabel = isFootballWorkspace ? 'client' : 'student';
  const memberLabelPlural = isFootballWorkspace ? 'clients' : 'students';
  if (archivesLoading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-12 text-center text-white">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
        <p className="mt-4 text-sm font-bold text-slate-400">Rebuilding historical performance...</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#080d1d] text-white shadow-2xl shadow-black/20">
      <header className="relative border-b border-white/10 p-5 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 p-3 text-xl shadow-lg shadow-violet-950/30"><FiArchive /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Historical intelligence</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Challenge archives</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Completed challenges use the same proportional scoring as live statistics. Three of four recurring occurrences contributes 75%, not a failed habit-day.</p>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-3 sm:p-6">
        {archives?.length ? archives.map((archive) => {
          const memberChart = [...(archive.member_stats || [])].sort((left, right) => right.completion_rate - left.completion_rate);
          return (
            <article key={archive.id} className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045]">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-violet-200">Completed challenge</span>
                      <span className="text-xs font-bold text-slate-500">{formatDate(archive.start_date)} - {formatDate(archive.end_date)}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-black sm:text-2xl">{archive.title}</h3>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-4 text-left lg:text-right">
                    <p className="text-3xl font-black text-cyan-200">{numberValue(archive.overall_completion_rate)}%</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100/60">Average scheduled progress</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {[
                    [FiCalendar, 'Duration', `${archive.duration_days} days`, 'text-violet-200'],
                    [FiUsers, isFootballWorkspace ? 'Clients' : 'Students', archive.total_members, 'text-emerald-200'],
                    [FiTarget, 'Completion units', `${numberValue(archive.total_completions, 2)} / ${archive.total_possible}`, 'text-cyan-200'],
                    [FiAward, 'Top performer', getArchiveBestPerformer(archive), 'text-amber-200'],
                  ].map(([Icon, label, value, tone]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-black/15 p-3.5 sm:p-4">
                      <Icon className={tone} />
                      <p className={`mt-3 text-lg font-black ${tone}`}>{value}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-5">
                    <h4 className="text-sm font-black">Daily average completion</h4>
                    <p className="mt-1 text-xs text-slate-500">Average scheduled progress across {memberLabelPlural} for each challenge day.</p>
                    <div className="mt-4 h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={archive.daily_progress || []} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                          <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="date" tickFormatter={(value) => formatDate(value).replace(/ \d{4}$/, '')} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(value) => [`${numberValue(value)}%`, 'Scheduled progress']} labelFormatter={formatDate} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }} />
                          <Line type="monotone" dataKey="completion_rate" stroke="#22d3ee" strokeWidth={3} dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-5">
                    <h4 className="text-sm font-black">{isFootballWorkspace ? 'Client' : 'Student'} completion comparison</h4>
                    <p className="mt-1 text-xs text-slate-500">Independent {memberLabel} percentages, shown as bars rather than slices of a whole.</p>
                    <div className="mt-4 h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={memberChart} layout="vertical" margin={{ top: 0, right: 12, left: 18, bottom: 0 }}>
                          <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="username" width={82} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(value) => [`${numberValue(value)}%`, 'Scheduled progress']} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }} />
                          <Bar dataKey="completion_rate" fill="#8b5cf6" radius={[0, 7, 7, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <details className="border-t border-white/10 bg-black/10">
                <summary className="cursor-pointer px-4 py-4 text-sm font-black text-slate-200 sm:px-6">Open {memberLabel} and habit audit</summary>
                <div className="space-y-3 border-t border-white/10 p-3 sm:p-6">
                  {(archive.member_stats || []).map((member) => (
                    <details key={member.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                      <summary className="cursor-pointer p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-black text-white">{member.username}</p>
                            <p className="mt-1 text-xs text-slate-500">{member.perfect_days || 0} perfect - {member.partial_days || 0} partial - {member.days_completed || 0}/{member.total_days || 0} active days</p>
                          </div>
                          <p className="shrink-0 text-xl font-black text-cyan-200">{numberValue(member.completion_rate)}%</p>
                        </div>
                      </summary>
                      <div className="border-t border-white/10 p-3 sm:p-5">
                        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Metric label="Completion units" value={`${numberValue(member.total_habit_completions, 2)} / ${member.total_possible_habit_completions || 0}`} />
                          <Metric label="Perfect days" value={member.perfect_days || 0} />
                          <Metric label="Partial days" value={member.partial_days || 0} />
                          <Metric label="Recurring events" value={`${member.periodic_completed || 0} / ${member.periodic_target || 0}`} />
                        </div>
                        <div className="space-y-2">
                          {(member.habit_details || []).map((habit, index) => (
                            <div key={`${habit.name}-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black">{habit.name}</p><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">{habit.type}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">{habit.combat_type}</span></div>
                                <p className="mt-1 text-[11px] text-slate-500">{habit.completed_days || 0} full - {habit.partial_days || 0} partial - {habit.missed_days || 0} missed - {numberValue(habit.earned_units, 2)}/{habit.total_days || 0} units</p>
                                {habit.type === 'periodic' ? <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-300"><FiRepeat /> {habit.periodic_completed || 0}/{habit.periodic_target || 0} occurrences logged</p> : null}
                              </div>
                              <p className="text-lg font-black text-cyan-200">{numberValue(habit.completion_rate)}%</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            </article>
          );
        }) : (
          <div className="rounded-[1.75rem] border border-dashed border-white/10 p-12 text-center">
            <FiArchive className="mx-auto text-4xl text-slate-600" />
            <h3 className="mt-4 text-xl font-black">No completed challenges yet</h3>
            <p className="mt-2 text-sm text-slate-500">Historical analytics appear here after a challenge is completed.</p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-4 text-xs leading-5 text-slate-400">
          <FiInfo className="mt-0.5 shrink-0 text-cyan-200" />
          <p><strong className="text-slate-200">Completion units</strong> are completion-equivalent scheduled habit-days. A 75% recurring habit contributes 0.75 units. Unscheduled days are excluded, so every percentage describes only work that was actually expected.</p>
        </div>
      </div>
    </section>
  );
};

const Metric = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-black/15 p-3">
    <p className="text-base font-black text-slate-100">{value}</p>
    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</p>
  </div>
);

export default ArchivePanel;
