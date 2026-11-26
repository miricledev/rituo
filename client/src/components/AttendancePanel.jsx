import React from 'react';
import { FiActivity, FiCalendar, FiChevronDown, FiInfo, FiTarget, FiUsers } from 'react-icons/fi';

const parseDate = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

const dayTone = (score) => {
  if (score >= 100) return 'border-emerald-300/25 bg-emerald-300/15 text-emerald-200';
  if (score >= 50) return 'border-cyan-300/25 bg-cyan-300/15 text-cyan-200';
  if (score > 0) return 'border-amber-300/25 bg-amber-300/15 text-amber-200';
  return 'border-rose-300/20 bg-rose-300/10 text-rose-200';
};

const average = (rows, key) => rows.length
  ? rows.reduce((total, row) => total + Number(row[key] || 0), 0) / rows.length
  : 0;

const AttendancePanel = ({ attendance, attendanceLoading, expandedAttendance, setExpandedAttendance }) => {
  const rows = attendance || [];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#080d1d] text-white shadow-2xl shadow-black/20">
      <header className="relative border-b border-white/10 p-5 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 p-3 text-xl"><FiActivity /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Challenge engagement</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Scheduled participation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">This is habit engagement, not school-register attendance. Activity coverage counts scheduled days with any progress; performance rate measures how much of all scheduled work was completed.</p>
          </div>
        </div>
      </header>

      <div className="p-3 sm:p-6">
        {attendanceLoading ? (
          <div className="py-14 text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" /><p className="mt-4 text-sm font-bold text-slate-500">Calculating scheduled engagement...</p></div>
        ) : rows.length ? (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Summary icon={FiUsers} label="Students" value={rows.length} tone="text-violet-200" />
              <Summary icon={FiTarget} label="Average performance" value={`${Math.round(average(rows, 'completion_rate'))}%`} tone="text-cyan-200" />
              <Summary icon={FiCalendar} label="Average activity coverage" value={`${Math.round(average(rows, 'attendance_rate'))}%`} tone="text-emerald-200" />
              <Summary icon={FiActivity} label="Highest performance" value={rows[0]?.username || 'N/A'} tone="text-amber-200" />
            </div>

            <div className="mt-5 space-y-3">
              {rows.map((member, index) => {
                const expanded = Boolean(expandedAttendance[member.member_id]);
                return (
                  <article key={member.member_id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-black">#{index + 1}</div>
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-black">{member.username}</h3>
                            <p className="mt-1 text-xs text-slate-500">{member.days_active}/{member.total_days} scheduled days active - {member.perfect_days || 0} perfect - {member.partial_days || 0} partial</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          <Rate label="Performance" value={member.completion_rate} tone="text-cyan-200" />
                          <Rate label="Activity coverage" value={member.attendance_rate} tone="text-emerald-200" />
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Most recent scheduled days</p>
                          <div className="flex flex-wrap gap-2">
                            {(member.recent_activity || []).map((day) => {
                              const dateValue = parseDate(day.date);
                              return (
                                <div key={day.date} title={`${dateValue.toLocaleDateString()}: ${day.completion_rate}%`} className={`min-w-[3rem] rounded-xl border px-2 py-2 text-center ${dayTone(day.completion_rate)}`}>
                                  <p className="text-[9px] font-black uppercase opacity-60">{dateValue.toLocaleDateString([], { weekday: 'short' })}</p>
                                  <p className="mt-0.5 text-sm font-black">{Math.round(day.completion_rate)}%</p>
                                </div>
                              );
                            })}
                            {!member.recent_activity?.length ? <span className="text-xs text-slate-600">No scheduled days have elapsed.</span> : null}
                          </div>
                        </div>
                        <button type="button" onClick={() => setExpandedAttendance((current) => ({ ...current, [member.member_id]: !expanded }))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-slate-300 transition hover:border-cyan-300/25 hover:text-white">
                          {expanded ? 'Hide' : 'Open'} day audit <FiChevronDown className={`transition ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="border-t border-white/10 bg-black/10 p-4 sm:p-5">
                        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-14">
                          {(member.full_attendance || []).map((day) => {
                            const dateValue = parseDate(day.date);
                            return (
                              <div key={day.date} title={`${dateValue.toLocaleDateString()}: ${day.completion_rate}% from ${day.scheduled_count} scheduled habits`} className={`aspect-square rounded-xl border p-1 text-center ${dayTone(day.completion_rate)}`}>
                                <p className="text-[8px] font-black uppercase opacity-60">{dateValue.toLocaleDateString([], { month: 'short' })}</p>
                                <p className="text-xs font-black">{dateValue.getDate()}</p>
                                <p className="hidden text-[8px] font-bold opacity-70 sm:block">{Math.round(day.completion_rate)}%</p>
                              </div>
                            );
                          })}
                        </div>
                        {!member.full_attendance?.length ? <p className="py-5 text-center text-xs text-slate-600">No scheduled challenge days are available.</p> : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-white/10 py-14 text-center"><FiActivity className="mx-auto text-4xl text-slate-600" /><h3 className="mt-4 text-xl font-black">No active challenge data</h3><p className="mt-2 text-sm text-slate-500">Scheduled engagement appears once students receive habits.</p></div>
        )}

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-4 text-xs leading-5 text-slate-400"><FiInfo className="mt-0.5 shrink-0 text-cyan-200" /><p><strong className="text-slate-200">Activity coverage</strong> answers “On how many scheduled days did this student record any progress?” <strong className="text-slate-200">Performance</strong> answers “How much of all scheduled work did they complete?” Join dates and non-scheduled days are excluded.</p></div>
      </div>
    </section>
  );
};

const Summary = ({ icon: Icon, label, value, tone }) => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 sm:p-4"><Icon className={tone} /><p className={`mt-3 truncate text-lg font-black sm:text-xl ${tone}`}>{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">{label}</p></div>;

const Rate = ({ label, value, tone }) => <div className="min-w-[8rem] rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-center"><p className={`text-xl font-black ${tone}`}>{Math.round(Number(value || 0))}%</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</p></div>;

export default AttendancePanel;
