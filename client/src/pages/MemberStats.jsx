import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiBarChart2, FiCalendar, FiEdit3, FiShield, FiTarget, FiUser } from 'react-icons/fi';
import axios from 'axios';
import TaskProgress from '../components/TaskProgress';
import TaskStats from './TaskStats';

const HabitCalendar = lazy(() => import('../components/HabitCalendar'));

function getInitialSection(searchParams) {
  const requested = searchParams.get('section');
  if (requested === 'calendar') return 'calendar';
  if (requested?.startsWith('habit-')) {
    const habitIndex = Number(requested.slice(6));
    if (Number.isInteger(habitIndex) && habitIndex >= 0) return habitIndex;
  }
  return 'overview';
}

function initials(member) {
  const displayName = [member?.firstName, member?.lastName].filter(Boolean).join(' ') || member?.username || 'Student';
  return displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

const MemberStats = () => {
  const { groupId, memberId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [group, setGroup] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [selectedSection, setSelectedSection] = useState(() => getInitialSection(searchParams));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchStatistics = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const response = await axios.get(`/groups/${groupId}/students/${memberId}/habit-stats`);
      setGroup(response.data.group || null);
      setStatistics(response.data.statistics || null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Student statistics could not be loaded.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [groupId, memberId]);

  const memberHabit = useMemo(() => (
    group?.activeChallenge?.memberHabits?.find((entry) => (
      String(entry?.member?.id ?? entry?.member) === String(memberId)
    )) || null
  ), [group, memberId]);
  const member = group?.members?.find((entry) => String(entry.id) === String(memberId)) || null;
  const canManage = Boolean(group?.viewerCanManage);

  const selectSection = (section) => {
    setSelectedSection(section);
    setEditMode(false);
    if (section === 'calendar') setSearchParams({ section: 'calendar' });
    else if (Number.isInteger(section)) setSearchParams({ section: `habit-${section}` });
    else setSearchParams({});
  };

  const updateHabitDay = async (habitIndex, targetDate, updateData) => {
    try {
      setSaving(true);
      setError('');
      const response = await axios.post(
        `/groups/${groupId}/challenge/${group.activeChallenge.id}/member/${memberId}/habit/${habitIndex}/toggle-day`,
        { date: targetDate, ...updateData }
      );
      if (response.data?.wallet) {
        window.dispatchEvent(new CustomEvent('ip-bucks-updated', { detail: { balance: Number(response.data.wallet.balance) || 0 } }));
      }
      await fetchStatistics(false);
      return response.data;
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The historical habit entry could not be updated.');
      throw requestError;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-slate-950 px-4 py-10">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-48 rounded-[2rem] bg-white/5" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 rounded-2xl bg-white/5" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-[70vh] bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-400/20 bg-rose-400/10 p-8 text-center">
          <h1 className="text-2xl font-black">Statistics unavailable</h1>
          <p className="mt-3 text-sm text-rose-100/75">{error}</p>
          <button type="button" onClick={() => navigate(-1)} className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950">Go back</button>
        </div>
      </div>
    );
  }

  if (!member || !memberHabit || !statistics) {
    return (
      <div className="min-h-[70vh] bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-300/20 bg-amber-300/10 p-8 text-center">
          <h1 className="text-2xl font-black">No active habit data</h1>
          <p className="mt-3 text-sm text-amber-100/75">This student has not been assigned habits in the active challenge yet.</p>
          <button type="button" onClick={() => navigate(-1)} className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950">Return to school</button>
        </div>
      </div>
    );
  }

  const displayName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.username;
  const sectionTitle = selectedSection === 'overview'
    ? 'Performance overview'
    : selectedSection === 'calendar'
      ? 'Consistency calendar'
      : statistics.habits[selectedSection]?.name || 'Habit detail';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b18] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white">
          <FiArrowLeft /> Back to school
        </button>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[2.25rem]">
          <div className="relative p-5 sm:p-7 lg:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 text-xl font-black shadow-xl shadow-violet-950/40 sm:h-20 sm:w-20 sm:rounded-3xl sm:text-2xl">
                  {initials(member)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Student intelligence</span>
                    {statistics.challenge.todayIsLive ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live</span> : null}
                  </div>
                  <h1 className="mt-3 truncate text-2xl font-black tracking-tight sm:text-4xl">{displayName}</h1>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 sm:text-sm">
                    <span className="inline-flex items-center gap-1.5"><FiUser /> @{member.username}</span>
                    <span className="inline-flex items-center gap-1.5"><FiShield /> {group.name}</span>
                    {member.yearGroup ? <span>Year {member.yearGroup}</span> : null}
                    {member.tutorGroup ? <span>{member.tutorGroup}</span> : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-xl lg:justify-end">
                <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Challenge</p>
                  <p className="mt-1 text-xs font-bold text-slate-200">{statistics.challenge.startDate} — {statistics.challenge.endDate}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Viewing</p>
                  <p className="mt-1 text-xs font-bold text-slate-200">{sectionTitle}</p>
                </div>
              </div>
            </div>
          </div>

          <nav className="border-t border-white/10 bg-black/15 p-2 sm:p-3">
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button type="button" onClick={() => selectSection('overview')} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition sm:text-sm ${selectedSection === 'overview' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><FiBarChart2 /> Overview</button>
              <button type="button" onClick={() => selectSection('calendar')} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition sm:text-sm ${selectedSection === 'calendar' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><FiCalendar /> Consistency</button>
              <span className="my-1 w-px shrink-0 bg-white/10" />
              {statistics.habits.map((habit) => (
                <button key={habit.index} type="button" onClick={() => selectSection(habit.index)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition sm:text-sm ${selectedSection === habit.index ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-950/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  <FiTarget /> {habit.name}
                </button>
              ))}
            </div>
          </nav>
        </section>

        {error ? <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100">{error}</div> : null}

        <section className="mt-5 sm:mt-7">
          {selectedSection === 'overview' ? (
            <TaskProgress analytics={statistics} />
          ) : selectedSection === 'calendar' ? (
            <Suspense fallback={<div className="rounded-[2rem] border border-white/10 bg-white/5 px-4 py-16 text-center text-sm text-slate-400">Loading consistency calendar…</div>}>
              <HabitCalendar
                habits={memberHabit.habits}
                startDate={statistics.challenge.startDate}
                endDate={statistics.challenge.endDate}
                statistics={statistics}
              />
            </Suspense>
          ) : (
            <div>
              {canManage ? (
                <div className="mb-3 flex justify-end">
                  <button type="button" onClick={() => setEditMode((current) => !current)} disabled={saving} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${editMode ? 'bg-rose-500 text-white' : 'border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/30'}`}>
                    <FiEdit3 /> {saving ? 'Saving…' : editMode ? 'Exit correction mode' : 'Correct habit records'}
                  </button>
                </div>
              ) : null}
              <TaskStats
                key={selectedSection}
                taskData={statistics.habits[selectedSection]}
                habitData={memberHabit.habits[selectedSection]}
                editMode={editMode}
                onUpdateDay={(targetDate, updateData) => updateHabitDay(selectedSection, targetDate, updateData)}
                saving={saving}
                liveDate={statistics.challenge.studentToday}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default MemberStats;
