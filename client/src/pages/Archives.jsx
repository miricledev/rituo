import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FiArchive, FiCalendar, FiCheckCircle, FiInfo, FiTarget, FiZap } from 'react-icons/fi';

const percent = (value) => `${Math.round(Number(value || 0))}%`;

const Archives = () => {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArchives = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await axios.get('/analytics/archives');
        setArchives(response.data.archives || []);
      } catch (requestError) {
        setArchives([]);
        setError(requestError.response?.data?.error || 'Legacy archives could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    fetchArchives();
  }, []);

  if (loading) {
    return <div className="min-h-[70vh] bg-[#070b18] px-4 py-16 text-center text-white"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" /><p className="mt-4 text-sm font-bold text-slate-500">Loading archived challenges...</p></div>;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b18] text-white">
      <div className="pointer-events-none absolute inset-0"><div className="absolute -left-20 top-16 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" /><div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" /></div>
      <div className="relative mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-9 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 p-3 text-xl"><FiArchive /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Legacy analytics</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Personal challenge archives</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Historical personal tasks use their original binary complete/not-complete model. School challenge analytics use the newer scheduled, recurring and proportional model inside each school.</p></div>
          </div>
        </header>

        {error ? <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">{error}</div> : null}

        <div className="mt-5 space-y-5">
          {archives.length ? archives.map((archive, index) => (
            <article key={archive.cycle_id || index} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/15">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div><span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-violet-200">Completed legacy cycle</span><h2 className="mt-3 text-xl font-black sm:text-2xl">{archive.title || `Challenge ${index + 1}`}</h2><p className="mt-1 text-xs text-slate-500">{archive.cycle_start_date} - {archive.cycle_end_date}</p></div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-4"><p className="text-3xl font-black text-cyan-200">{percent(archive.completion_rate)}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100/60">Binary completion rate</p></div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <Stat icon={FiCalendar} label="Perfect days" value={archive.days_completed || 0} tone="text-emerald-200" />
                  <Stat icon={FiTarget} label="Average completion" value={percent(archive.completion_rate)} tone="text-cyan-200" />
                  <Stat icon={FiZap} label="Longest perfect streak" value={archive.current_streak || 0} tone="text-amber-200" />
                  <Stat icon={FiCheckCircle} label="Legacy tasks" value={archive.tasks?.length || 0} tone="text-violet-200" />
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <ChartCard title="Task completion" detail="Each bar is an independent task percentage.">
                    <BarChart data={archive.tasks || []} margin={{ top: 5, right: 10, left: -18, bottom: 12 }}><CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="title" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={45} /><YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [percent(value), 'Completion']} contentStyle={tooltipStyle} /><Bar dataKey="completion_rate" fill="#8b5cf6" radius={[7, 7, 0, 0]} /></BarChart>
                  </ChartCard>
                  <ChartCard title="Daily completion" detail="Percentage of legacy tasks marked complete on each day.">
                    <AreaChart data={archive.daily_data || []} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}><defs><linearGradient id={`legacyArchive-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.3} vertical={false} /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={25} /><YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [percent(value), 'Completion']} contentStyle={tooltipStyle} /><Area type="monotone" dataKey="is_complete" stroke="#22d3ee" strokeWidth={3} fill={`url(#legacyArchive-${index})`} /></AreaChart>
                  </ChartCard>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(archive.tasks || []).map((task, taskIndex) => <div key={`${task.title}-${taskIndex}`} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-black">{task.title}</p><p className="font-black text-cyan-200">{percent(task.completion_rate)}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: percent(task.completion_rate) }} /></div></div>)}
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.035] p-12 text-center"><FiArchive className="mx-auto text-4xl text-slate-600" /><h2 className="mt-4 text-xl font-black">No completed personal challenges</h2><p className="mt-2 text-sm text-slate-500">Completed legacy challenge cycles appear here.</p><Link to="/dashboard" className="mt-6 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950">Return to dashboard</Link></div>
          )}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-4 text-xs leading-5 text-slate-400"><FiInfo className="mt-0.5 shrink-0 text-cyan-200" /><p>This page intentionally preserves the original personal task calculations. For current school reporting, open a school student profile to see schedule-aware completion units, recurring occurrence coverage, attack/defence analysis and consistency detail.</p></div>
      </div>
    </main>
  );
};

const tooltipStyle = { background: '#0f172a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 };

const Stat = ({ icon: Icon, label, value, tone }) => <div className="rounded-2xl border border-white/10 bg-black/15 p-3.5"><Icon className={tone} /><p className={`mt-3 text-xl font-black ${tone}`}>{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">{label}</p></div>;

const ChartCard = ({ title, detail, children }) => <div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-5"><h3 className="text-sm font-black">{title}</h3><p className="mt-1 text-xs text-slate-500">{detail}</p><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>;

export default Archives;
