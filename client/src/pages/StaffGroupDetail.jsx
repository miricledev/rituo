import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiEdit3,
  FiFlag,
  FiLoader,
  FiMessageCircle,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiZap
} from 'react-icons/fi';
import { HiOutlineFire, HiOutlineSparkles, HiOutlineTrophy } from 'react-icons/hi2';
import api from '../services/api';
import GroupChat from '../components/GroupChat';
import GroupWorkspaceShell from '../components/GroupWorkspaceShell';
import InlineToast from '../components/InlineToast';
import DailyHabitPlanner from '../components/DailyHabitPlanner';
import StudentRewardsPage from '../components/StudentRewardsPage';
import StudentToolsHub from '../components/student-tools/StudentToolsHub';
import IpBuck from '../components/IpBuck';
import { getDeviceTimezone } from '../utils/deviceTimezone';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY_STAFF_TIMETABLE = [];

const localDateInput = (dateValue = new Date()) => {
  const local = new Date(dateValue.getTime() - (dateValue.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 10);
};

const addDays = (days) => {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return localDateInput(result);
};

const shiftDate = (dateValue, days) => {
  const result = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  result.setDate(result.getDate() + days);
  return localDateInput(result);
};

const createHabit = (index = 0) => ({
  id: '',
  name: '',
  description: '',
  habitType: 'boolean',
  combatType: 'attack',
  scheduleDays: [...WEEKDAYS],
  scheduleTime: `${String(Math.min(20, 7 + index * 2)).padStart(2, '0')}:00`,
  durationMinutes: 30,
  minValue: 0,
  maxValue: 10,
  prompt: '',
  periodicOccurrences: 4,
  periodicIntervalHours: 4,
  allowOverlap: false,
  progress: []
});

const createChallengeForm = () => ({
  title: 'My next standards challenge',
  startDate: localDateInput(),
  endDate: addDays(27),
  habits: [createHabit(0)]
});

const formatDate = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
  : 'Not set';

const formatTime = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value || '';
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const timeToMinutes = (value, fallback = 7 * 60) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? (hours * 60) + minutes : fallback;
};

const progressForDate = (habit, dateValue) => (habit.progress || []).find((entry) => String(entry.date || '').slice(0, 10) === dateValue);

const habitProgressPercent = (habit, progress) => {
  if (!progress) return 0;
  if (habit.habitType === 'periodic') {
    const target = Math.max(1, Number(progress.periodicTarget || habit.periodicOccurrences || 4));
    return Math.min(100, Math.round((Number(progress.periodicCompleted || 0) / target) * 100));
  }
  if (habit.habitType === 'numeric' && progress.numericValue != null) {
    const minimum = Number(habit.minValue || 0);
    const maximum = Number(habit.maxValue || 10);
    return Math.min(100, Math.max(0, Math.round(((Number(progress.numericValue) - minimum) / Math.max(1, maximum - minimum)) * 100)));
  }
  return progress.completed ? 100 : 0;
};

function StaffGroupDetail({ shellProps, workspaceProps }) {
  const { group, activeTab, setActiveTab, isLeader } = shellProps;
  const { user, handleKickMember } = workspaceProps;
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [challengeForm, setChallengeForm] = useState(createChallengeForm);
  const [aiBrief, setAiBrief] = useState('');
  const [saving, setSaving] = useState('');
  const [numericDrafts, setNumericDrafts] = useState({});
  const [textDrafts, setTextDrafts] = useState({});
  const [todayPlannerItems, setTodayPlannerItems] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [walletBalance, setWalletBalance] = useState(0);
  const [restoreConfirmIndex, setRestoreConfirmIndex] = useState(null);

  const fetchHub = useCallback(async () => {
    try {
      setError('');
      const [hubResult, walletResult] = await Promise.allSettled([
        api.get(`/groups/${group.groupId}/staff-hub`, {
          params: { timezone: getDeviceTimezone() }
        }),
        api.get('/groups/ip-wallet')
      ]);
      if (hubResult.status === 'rejected') throw hubResult.reason;
      setHub(hubResult.value.data.hub);
      if (walletResult.status === 'fulfilled') {
        setWalletBalance(Number(walletResult.value.data?.wallet?.balance) || 0);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The Coaches HQ could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [group.groupId]);

  useEffect(() => {
    fetchHub();
  }, [fetchHub]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const viewer = useMemo(
    () => hub?.members?.find((member) => String(member.memberId) === String(user?.id)),
    [hub, user?.id]
  );
  const currentChallenge = viewer?.challenge;

  useEffect(() => {
    if (!group.groupId || !user?.id || !viewer?.today || !currentChallenge) {
      setTodayPlannerItems([]);
      return undefined;
    }
    let cancelled = false;
    const loadTodayPlanner = async () => {
      try {
        const response = await api.get(`/groups/${group.groupId}/students/${user.id}/schedule`, {
          params: { date: viewer.today }
        });
        if (!cancelled) setTodayPlannerItems(response.data?.plan?.items || []);
      } catch (_error) {
        if (!cancelled) setTodayPlannerItems([]);
      }
    };
    loadTodayPlanner();
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentChallenge, group.groupId, user?.id, viewer?.today]);

  const openCreateEditor = () => {
    setChallengeForm(createChallengeForm());
    setAiBrief('');
    setEditing(false);
    setEditorOpen(true);
  };

  const openEditEditor = () => {
    if (!currentChallenge) return;
    setChallengeForm({
      title: currentChallenge.title,
      startDate: String(currentChallenge.startDate).slice(0, 10),
      endDate: String(currentChallenge.endDate).slice(0, 10),
      habits: (currentChallenge.habits || []).map((habit) => ({ ...createHabit(), ...habit }))
    });
    setAiBrief('');
    setEditing(true);
    setEditorOpen(true);
  };

  const updateHabit = (index, patchValue) => {
    setChallengeForm((current) => ({
      ...current,
      habits: current.habits.map((habit, habitIndex) => habitIndex === index ? { ...habit, ...patchValue } : habit)
    }));
  };

  const addHabit = () => {
    setChallengeForm((current) => ({
      ...current,
      habits: [...current.habits, createHabit(current.habits.length)]
    }));
  };

  const removeHabit = (index) => {
    setChallengeForm((current) => ({
      ...current,
      habits: current.habits.filter((_, habitIndex) => habitIndex !== index)
    }));
  };

  const generateHabits = async () => {
    if (aiBrief.trim().length < 10) {
      setToast({ type: 'error', title: 'Add more detail', message: 'Explain what you want to improve, protect, or achieve.' });
      return;
    }
    try {
      setSaving('ai');
      const response = await api.post(`/groups/${group.groupId}/ai-habits`, { text: aiBrief.trim() });
      const generated = response.data.draft?.habits || [];
      if (!generated.length) throw new Error('No usable habits were returned.');
      setChallengeForm((current) => ({
        ...current,
        habits: generated.map((habit, index) => ({
          ...createHabit(index),
          ...habit,
          scheduleTime: habit.scheduleTime || createHabit(index).scheduleTime,
          progress: []
        }))
      }));
      setToast({ type: 'success', title: 'AI draft ready', message: 'Review the timings and days before starting your challenge.' });
    } catch (requestError) {
      setToast({ type: 'error', title: 'AI draft failed', message: requestError.response?.data?.error || requestError.message });
    } finally {
      setSaving('');
    }
  };

  const saveChallenge = async (event) => {
    event.preventDefault();
    try {
      setSaving('challenge');
      const payload = { ...challengeForm, deviceTimezone: getDeviceTimezone() };
      const response = editing
        ? await api.put(`/groups/${group.groupId}/staff-challenges/${currentChallenge.id}`, payload)
        : await api.post(`/groups/${group.groupId}/staff-challenges`, payload);
      setHub(response.data.hub);
      setEditorOpen(false);
      setToast({ type: 'success', title: editing ? 'Challenge updated' : 'Challenge started', message: response.data.message });
    } catch (requestError) {
      setToast({ type: 'error', title: 'Challenge not saved', message: requestError.response?.data?.error || requestError.message });
    } finally {
      setSaving('');
    }
  };

  const finishChallenge = async () => {
    if (!currentChallenge || !window.confirm('Finish this challenge and move it to your history?')) return;
    try {
      setSaving('finish');
      const response = await api.post(`/groups/${group.groupId}/staff-challenges/${currentChallenge.id}/complete`, {
        deviceTimezone: getDeviceTimezone()
      });
      setHub(response.data.hub);
      setToast({ type: 'success', title: 'Challenge archived', message: 'Your results remain visible in My History.' });
    } catch (requestError) {
      setToast({ type: 'error', title: 'Could not finish challenge', message: requestError.response?.data?.error || requestError.message });
    } finally {
      setSaving('');
    }
  };

  const saveProgress = async (habitIndex, value) => {
    if (!currentChallenge) return;
    try {
      setSaving(`habit-${habitIndex}`);
      const response = await api.post(
        `/groups/${group.groupId}/staff-challenges/${currentChallenge.id}/habits/${habitIndex}/progress`,
        { value, deviceTimezone: getDeviceTimezone() }
      );
      setHub(response.data.hub);
      setToast({ type: 'success', title: 'Receipt filed', message: response.data.message });
    } catch (requestError) {
      setToast({ type: 'error', title: 'Progress not recorded', message: requestError.response?.data?.error || requestError.message });
    } finally {
      setSaving('');
    }
  };

  const restoreStreak = async (habitIndex) => {
    if (!currentChallenge || saving) return;
    try {
      setSaving(`restore-${habitIndex}`);
      const response = await api.post(
        `/groups/${group.groupId}/staff-challenges/${currentChallenge.id}/habits/${habitIndex}/restore-streak`,
        { deviceTimezone: getDeviceTimezone() }
      );
      const nextBalance = Number(response.data?.wallet?.balance) || 0;
      setWalletBalance(nextBalance);
      setHub(response.data.hub);
      setRestoreConfirmIndex(null);
      window.dispatchEvent(new CustomEvent('ip-bucks-updated', { detail: { balance: nextBalance } }));
      setToast({ type: 'success', title: 'Streak protected', message: response.data.message });
    } catch (requestError) {
      if (requestError.response?.data?.wallet) {
        const nextBalance = Number(requestError.response.data.wallet.balance) || 0;
        setWalletBalance(nextBalance);
        window.dispatchEvent(new CustomEvent('ip-bucks-updated', { detail: { balance: nextBalance } }));
      }
      setToast({ type: 'error', title: 'Could not protect streak', message: requestError.response?.data?.error || requestError.message });
    } finally {
      setSaving('');
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.name} from this Coaches HQ?`)) return;
    await handleKickMember(member.memberId);
    await fetchHub();
  };

  const openTool = (toolId) => {
    sessionStorage.setItem('ip:selected-tool', toolId);
    setActiveTab('tools');
  };

  const callout = hub?.slackerCallout;
  const shell = (
    <GroupWorkspaceShell
      {...shellProps}
      persistentContent={callout ? <SlackerCallout callout={callout} /> : null}
      workspaceVariant="staff"
      allowTypeEditing={false}
      showChallengeAction={false}
    />
  );

  if (loading) {
    return <StaffPageFrame shell={shell}><div className="flex min-h-[28rem] items-center justify-center"><FiLoader className="h-8 w-8 animate-spin text-fuchsia-500" /></div></StaffPageFrame>;
  }
  if (error) {
    return <StaffPageFrame shell={shell}><section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-400/20 dark:bg-rose-500/10"><FiAlertTriangle className="mx-auto h-8 w-8 text-rose-500" /><h2 className="mt-3 text-xl font-black">Coaches HQ unavailable</h2><p className="mt-2 text-sm text-rose-700 dark:text-rose-200">{error}</p><button type="button" onClick={fetchHub} className="mt-5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white">Try again</button></section></StaffPageFrame>;
  }

  return (
    <StaffPageFrame shell={shell}>
      <InlineToast toast={toast} onClose={() => setToast(null)} />
      {activeTab === 'overview' ? <AccountabilityOverview hub={hub} viewer={viewer} clock={clock} onOpenChallenge={() => currentChallenge ? setActiveTab('challenge') : openCreateEditor()} /> : null}
      {activeTab === 'challenge' ? (
        <MyChallenge
          viewer={viewer}
          clock={clock}
          saving={saving}
          numericDrafts={numericDrafts}
          textDrafts={textDrafts}
          plannerItems={todayPlannerItems}
          walletBalance={walletBalance}
          restoreConfirmIndex={restoreConfirmIndex}
          setNumericDrafts={setNumericDrafts}
          setTextDrafts={setTextDrafts}
          setRestoreConfirmIndex={setRestoreConfirmIndex}
          onSaveProgress={saveProgress}
          onRestoreStreak={restoreStreak}
          onCreate={openCreateEditor}
          onEdit={openEditEditor}
          onFinish={finishChallenge}
        />
      ) : null}
      {activeTab === 'calendar' ? <StaffPlanner group={group} user={user} challenge={currentChallenge} onSaved={fetchHub} /> : null}
      {activeTab === 'leaderboard' ? <StandardsLeaderboard rows={hub.leaderboard || []} /> : null}
      {activeTab === 'chat' ? <GroupChat groupId={group.groupId} groupName={group.name} isSchoolGroup={false} chatTitle="Coaches HQ Banter Room" showChannelPicker={false} /> : null}
      {activeTab === 'rewards' ? <StudentRewardsPage groupId={group.groupId} studentId={user?.id} workspaceType="staff" onOpenFeature={openTool} /> : null}
      {activeTab === 'tools' ? <StudentToolsHub groupId={group.groupId} workspaceType="staff" onOpenShop={() => setActiveTab('rewards')} /> : null}
      {activeTab === 'history' ? <ChallengeHistory challenges={hub.history || []} /> : null}
      {activeTab === 'admin' && isLeader ? <StaffMembersPanel hub={hub} onRemove={removeMember} /> : null}
      {editorOpen ? (
        <ChallengeEditor
          editing={editing}
          form={challengeForm}
          setForm={setChallengeForm}
          aiBrief={aiBrief}
          setAiBrief={setAiBrief}
          saving={saving}
          onGenerate={generateHabits}
          onUpdateHabit={updateHabit}
          onAddHabit={addHabit}
          onRemoveHabit={removeHabit}
          onClose={() => setEditorOpen(false)}
          onSubmit={saveChallenge}
        />
      ) : null}
    </StaffPageFrame>
  );
}

function StaffPageFrame({ shell, children }) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[1440px] overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-fuchsia-50/70 via-white to-amber-50/50 dark:from-[#100513] dark:via-[#070915] dark:to-[#101006]" />
      <div className="pointer-events-none fixed -left-28 top-24 -z-10 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -right-24 top-1/3 -z-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
      {shell}
      {children}
    </div>
  );
}

function StaffPlanner({ group, user, challenge, onSaved }) {
  const linkedHabits = useMemo(
    () => (challenge?.habits || []).map((habit, index) => ({
      ...habit,
      index: habit.index ?? index
    })),
    [challenge]
  );
  const plannerProfile = useMemo(
    () => ({ student: user, linkedHabits }),
    [linkedHabits, user]
  );
  const challengeMember = useMemo(
    () => challenge ? {
      member: user?.id,
      joinedAt: String(challenge.startDate || '').slice(0, 10),
      activationAt: challenge.createdAt,
      habits: linkedHabits
    } : null,
    [challenge, linkedHabits, user?.id]
  );
  return (
    <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:rounded-[2rem] sm:p-6">
      <div className="mb-3 px-2 pt-2 sm:mb-5 sm:px-0 sm:pt-0">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-600 dark:text-cyan-300">My Planner</p>
        <h2 className="mb-2 mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:gap-3 sm:text-3xl"><FiCalendar className="text-fuchsia-500 dark:text-cyan-300" />Daily schedule</h2>
        <p className="hidden max-w-3xl text-slate-600 dark:text-slate-400 sm:block">Arrange your challenge habits around work, coaching, training, recovery, and personal commitments—or let AI organise the week.</p>
      </div>
      <DailyHabitPlanner
        groupId={group.groupId}
        profile={plannerProfile}
        canEdit
        schoolTimetable={EMPTY_STAFF_TIMETABLE}
        activeChallenge={challenge || null}
        challengeMember={challengeMember}
        workspaceType="staff"
        onSaved={onSaved}
      />
    </section>
  );
}

function SlackerCallout({ callout }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${callout.active ? 'border-rose-300 bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/20' : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${callout.active ? 'bg-white/15' : 'bg-emerald-500/10'}`}>{callout.active ? <FiAlertTriangle /> : <FiShield />}</span>
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-75">Live accountability desk</p><p className="mt-1 text-sm font-black leading-5 sm:text-base">{callout.headline}</p><p className="mt-1 hidden text-xs leading-5 opacity-85 sm:block">{callout.message}</p></div>
      </div>
    </div>
  );
}

function AccountabilityOverview({ hub, viewer, clock, onOpenChallenge }) {
  const summary = viewer?.stats?.summary || {};
  const activeMembers = (hub.members || []).filter((member) => member.challenge).length;
  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-200/70 bg-gradient-to-br from-[#16091d] via-[#251046] to-[#073344] p-5 text-white shadow-[0_28px_90px_rgba(126,34,206,0.22)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-amber-300"><FiActivity /> Personal standards, shared receipts</p><h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Nobody needs the same challenge. Everybody sees the standard.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Start on your own date, choose your own habits, and let the table expose the gap between intention and evidence.</p></div><button type="button" onClick={onOpenChallenge} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5">{viewer?.challenge ? <FiTarget /> : <FiPlus />}{viewer?.challenge ? 'Open my challenge' : 'Start my challenge'}</button></div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Your consistency', `${Math.round(summary.completionRate || 0)}%`, FiTrendingUp],
        ['Current streak', summary.currentActiveStreak || 0, HiOutlineFire],
        ['Challenges live', `${activeMembers}/${hub.members?.length || 0}`, FiFlag],
        ['Your local time', clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), FiClock]
      ].map(([label, value, Icon]) => <MetricCard key={label} label={label} value={value} icon={Icon} />)}</div>
      <TodaySnapshot viewer={viewer} />
      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-300">The squad</p><h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Live standards board</h3></div><span className="text-xs font-bold text-slate-400">Independent dates · shared visibility</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(hub.leaderboard || []).map((member) => <MemberPulseCard key={member.memberId} member={member} />)}</div></section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"><Icon className="h-5 w-5 text-fuchsia-600 dark:text-amber-300" /><p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p></div>;
}

function TodaySnapshot({ viewer }) {
  const challenge = viewer?.challenge;
  if (!challenge) return <EmptyChallengeCard onCreate={null} compact />;
  if (!viewer?.stats?.challenge?.todayIsLive) {
    return <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 dark:border-amber-400/20 dark:bg-amber-500/10"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Challenge queued</p><h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Your evidence window opens {formatDate(challenge.startDate)}</h3><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The habits stay visible in My Challenge, but nothing can be logged before the official start date.</p></section>;
  }
  const dayName = new Date(`${viewer.today}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  const habits = (challenge.habits || []).filter((habit) => (habit.scheduleDays || []).includes(dayName)).sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));
  return <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-white/[0.04] sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Today’s evidence</p><h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{habits.length ? `${habits.length} scheduled habit${habits.length === 1 ? '' : 's'}` : 'Recovery day — nothing scheduled'}</h3></div><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{formatDate(viewer.today)}</span></div><div className="mt-4 grid gap-2 md:grid-cols-2">{habits.map((habit) => { const progress = progressForDate(habit, viewer.today); const percent = habitProgressPercent(habit, progress); return <div key={habit.id || habit.name} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.035]"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${percent >= 100 ? 'bg-emerald-500 text-white' : 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200'}`}>{percent >= 100 ? <FiCheck /> : <FiClock />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900 dark:text-white">{habit.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatTime(habit.scheduleTime)} · {percent}% recorded</p></div></div>; })}</div></section>;
}

function MemberPulseCard({ member }) {
  const streak = member.stats?.summary?.currentActiveStreak || 0;
  return <motion.article whileHover={{ y: -3 }} className={`rounded-2xl border p-4 ${member.isViewer ? 'border-fuchsia-300 bg-fuchsia-50/80 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/10' : 'border-slate-200 bg-white/90 dark:border-white/10 dark:bg-white/[0.04]'}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-sm font-black text-white">{member.name?.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-black text-slate-950 dark:text-white">{member.name}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{member.isLeader ? 'HQ founder' : member.accountRole}</p></div></div><span className="text-lg font-black text-fuchsia-700 dark:text-amber-300">#{member.rank}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400" style={{ width: `${member.score}%` }} /></div><div className="mt-3 flex items-center justify-between text-xs"><span className="font-black text-slate-700 dark:text-slate-200">{member.challenge ? `${member.score}% consistency` : 'No challenge yet'}</span><span className="flex items-center gap-1 text-amber-600 dark:text-amber-300"><HiOutlineFire /> {streak}</span></div></motion.article>;
}

function MyChallenge(props) {
  const [viewMode, setViewMode] = useState('today');
  if (!props.viewer?.challenge) return <MyChallengeToday {...props} />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:w-auto">
          <button type="button" onClick={() => setViewMode('today')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition sm:flex-none ${viewMode === 'today' ? 'bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950' : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}><FiTarget /> Today's challenge</button>
          <button type="button" onClick={() => setViewMode('tomorrow')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition sm:flex-none ${viewMode === 'tomorrow' ? 'bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}><FiCalendar /> Tomorrow's challenge</button>
        </div>
      </div>
      {viewMode === 'tomorrow' ? <TomorrowChallengePreview viewer={props.viewer} clock={props.clock} onBack={() => setViewMode('today')} /> : <MyChallengeToday {...props} />}
    </div>
  );
}

function TomorrowChallengePreview({ viewer, clock, onBack }) {
  const challenge = viewer.challenge;
  const tomorrow = shiftDate(viewer.today, 1);
  const dayName = new Date(`${tomorrow}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  const startDate = String(challenge.startDate || '').slice(0, 10);
  const endDate = String(challenge.endDate || '').slice(0, 10);
  const challengeIsLive = tomorrow >= startDate && tomorrow <= endDate;
  const scheduled = (challenge.habits || [])
    .filter((habit) => (habit.scheduleDays || []).includes(dayName))
    .sort((first, second) => first.scheduleTime.localeCompare(second.scheduleTime));

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-[#071a2c] via-[#15204b] to-[#3b1458] p-5 text-white shadow-xl shadow-cyan-950/10 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300"><FiCalendar /> Tomorrow preview · {dayName}</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Prepare the next day's standards</h2>
            <p className="mt-2 text-sm text-slate-300">{formatDate(tomorrow)} · {scheduled.length} scheduled habit{scheduled.length === 1 ? '' : 's'} · local time {clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          <button type="button" onClick={onBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15"><FiTarget /> Back to today's challenge</button>
        </div>
      </section>
      {!challengeIsLive ? (
        <section className="rounded-[2rem] border border-dashed border-amber-300 bg-amber-50 p-10 text-center dark:border-amber-400/20 dark:bg-amber-500/10">
          <FiClock className="mx-auto h-8 w-8 text-amber-500" />
          <h3 className="mt-3 text-xl font-black text-slate-950 dark:text-white">No active challenge tomorrow</h3>
          <p className="mt-2 text-sm text-slate-500">Your current challenge runs from {formatDate(challenge.startDate)} to {formatDate(challenge.endDate)}.</p>
        </section>
      ) : scheduled.length ? (
        <div className="space-y-3">{scheduled.map((habit, index) => <TomorrowHabitCard key={habit.id || `${habit.name}-${index}`} habit={habit} />)}</div>
      ) : (
        <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
          <FiCalendar className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-xl font-black text-slate-950 dark:text-white">Tomorrow is a recovery day</h3>
          <p className="mt-2 text-sm text-slate-500">Nothing is scheduled, so the day protects rather than breaks your streak.</p>
        </section>
      )}
    </div>
  );
}

function TomorrowHabitCard({ habit }) {
  const combatDefence = habit.combatType === 'defence';
  return (
    <article className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <div className="w-24 lg:text-center"><p className="text-lg font-black text-slate-950 dark:text-white">{formatTime(habit.scheduleTime)}</p><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{habit.durationMinutes} min</p></div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${combatDefence ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200' : 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200'}`}>{combatDefence ? <FiShield /> : <FiZap />}{habit.combatType}</span><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">Preview only</span></div><h3 className="mt-3 text-lg font-black text-slate-950 dark:text-white">{habit.name}</h3>{habit.description ? <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{habit.description}</p> : null}</div>
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-center dark:border-cyan-400/20 dark:bg-cyan-500/10"><p className="text-sm font-black text-cyan-800 dark:text-cyan-200">{habit.habitType === 'periodic' ? `${habit.periodicOccurrences || 4} occurrences` : 'Scheduled'}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-cyan-600 dark:text-cyan-300">Available tomorrow</p></div>
    </article>
  );
}

function MyChallengeToday({ viewer, clock, saving, numericDrafts, textDrafts, plannerItems = [], walletBalance = 0, restoreConfirmIndex, setNumericDrafts, setTextDrafts, setRestoreConfirmIndex, onSaveProgress, onRestoreStreak, onCreate, onEdit, onFinish }) {
  if (!viewer?.challenge) return <EmptyChallengeCard onCreate={onCreate} />;
  const challenge = viewer.challenge;
  const today = viewer.today;
  const challengeIsLive = Boolean(viewer?.stats?.challenge?.todayIsLive);
  const dayName = new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  const plannerTimesByHabit = plannerItems
    .filter((item) => item.itemType === 'habit' && Number(item.habitIndex) >= 0 && item.startTime)
    .reduce((result, item) => {
      const habitIndex = Number(item.habitIndex);
      result[habitIndex] = [...(result[habitIndex] || []), item.startTime].sort();
      return result;
    }, {});
  const currentTime = clock.getTime();
  const completionWindowPhase = (completionWindow = {}) => {
    const eligibleWindows = (completionWindow.windows || []).filter((window) => window.eligible !== false);
    if (!eligibleWindows.length) return completionWindow.status || 'not-applicable';
    if (eligibleWindows.some((window) => {
      const opensAt = Date.parse(window.opensAt || '');
      const closesAt = Date.parse(window.closesAt || '');
      return Number.isFinite(opensAt) && Number.isFinite(closesAt) && opensAt <= currentTime && currentTime <= closesAt;
    })) return 'open';
    if (eligibleWindows.some((window) => {
      const opensAt = Date.parse(window.opensAt || '');
      return Number.isFinite(opensAt) && currentTime < opensAt;
    })) return 'upcoming';
    return 'closed';
  };
  const scheduledHabits = (challenge.habits || [])
    .map((habit, index) => ({ habit, index }))
    .filter(({ habit }) => (habit.scheduleDays || []).includes(dayName))
    .map(({ habit, index }) => {
      const progress = progressForDate(habit, today);
      const percent = habitProgressPercent(habit, progress);
      const completionWindow = viewer.completionWindows?.[String(index)] || {};
      const phase = completionWindowPhase(completionWindow);
      const plannerTimes = plannerTimesByHabit[index] || [];
      const fallbackTimes = habit.habitType === 'periodic'
        ? Array.from({ length: Math.max(2, Number(habit.periodicOccurrences) || 4) }, (_, occurrenceIndex) => {
          const startMinutes = timeToMinutes(habit.scheduleTime) + (occurrenceIndex * Math.max(1, Number(habit.periodicIntervalHours) || 4) * 60);
          return `${String(Math.floor(startMinutes / 60) % 24).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;
        })
        : [habit.scheduleTime];
      const occurrenceTimes = plannerTimes.length ? plannerTimes : fallbackTimes;
      const completedOccurrences = Math.max(0, Number(progress?.periodicCompleted) || 0);
      const eligibleWindows = (completionWindow.windows || []).filter((window) => window.eligible !== false);
      const currentWindow = eligibleWindows.find((window) => {
        const opensAt = Date.parse(window.opensAt || '');
        const closesAt = Date.parse(window.closesAt || '');
        return Number.isFinite(opensAt) && Number.isFinite(closesAt) && opensAt <= currentTime && currentTime <= closesAt;
      });
      const nextWindow = eligibleWindows.find((window) => {
        const opensAt = Date.parse(window.opensAt || '');
        return Number.isFinite(opensAt) && currentTime < opensAt;
      });
      const windowOccurrenceIndex = Number(
        currentWindow?.occurrenceIndex
        ?? nextWindow?.occurrenceIndex
        ?? completionWindow.activeWindow?.occurrenceIndex
        ?? completionWindow.nextWindow?.occurrenceIndex
      );
      const activeOccurrenceIndex = habit.habitType === 'periodic'
        ? Math.min(
          Number.isFinite(windowOccurrenceIndex) ? windowOccurrenceIndex : completedOccurrences,
          Math.max(0, occurrenceTimes.length - 1)
        )
        : 0;
      const timelineTime = occurrenceTimes[activeOccurrenceIndex] || habit.scheduleTime;
      return {
        kind: 'habit',
        habit,
        index,
        percent,
        timelineTime,
        startMinutes: timeToMinutes(timelineTime),
        occurrenceNumber: habit.habitType === 'periodic' ? activeOccurrenceIndex + 1 : null,
        occurrenceTarget: habit.habitType === 'periodic' ? occurrenceTimes.length : null,
        phase,
        completionWindow: {
          ...completionWindow,
          status: phase,
          windowOpen: phase === 'open',
          activeWindow: currentWindow || completionWindow.activeWindow,
          nextWindow: nextWindow || completionWindow.nextWindow,
        },
      };
    });
  const closedHabits = scheduledHabits.filter((entry) => entry.phase === 'closed');
  const liveHabits = scheduledHabits.filter((entry) => entry.phase !== 'closed');
  const nextHabitIndex = (
    liveHabits.find((entry) => entry.percent < 100 && entry.phase === 'open')
    || liveHabits.find((entry) => entry.percent < 100 && entry.phase === 'upcoming')
    || liveHabits.find((entry) => entry.percent < 100)
  )?.index;
  const scheduleEvents = plannerItems
    .filter((item) => item.itemType !== 'habit' && item.startTime)
    .map((item) => {
      const isWake = item.itemType === 'sleep' && item.id === 'sleep-morning';
      const isBedtime = item.itemType === 'sleep' && item.id === 'sleep-evening';
      const timelineTime = isWake ? item.endTime : item.startTime;
      return {
        kind: 'event',
        event: {
          ...item,
          title: isWake ? 'Wake up' : isBedtime ? 'Go to sleep' : item.title,
          eventType: isWake ? 'wake' : isBedtime ? 'bedtime' : item.itemType,
        },
        timelineTime,
        startMinutes: timeToMinutes(timelineTime),
      };
    });
  const timelineEntries = [...liveHabits, ...scheduleEvents]
    .sort((first, second) => first.startMinutes - second.startMinutes || (first.index ?? 999) - (second.index ?? 999));
  const completionUnits = scheduledHabits.reduce((total, entry) => total + (entry.percent / 100), 0);
  const completionPercent = scheduledHabits.length ? Math.round((completionUnits / scheduledHabits.length) * 100) : 0;
  const unscheduledHabits = (challenge.habits || []).filter((habit) => !(habit.scheduleDays || []).includes(dayName));

  const eventTone = (eventType) => {
    if (eventType === 'school') return 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-50';
    if (['wake', 'bedtime'].includes(eventType)) return 'border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-300/20 dark:bg-yellow-400/10 dark:text-yellow-50';
    if (eventType === 'break') return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-50';
    if (eventType === 'routine') return 'border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-400/20 dark:bg-teal-500/10 dark:text-teal-50';
    return 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-50';
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-fuchsia-200 bg-gradient-to-br from-white via-fuchsia-50 to-amber-50 p-5 dark:border-fuchsia-400/20 dark:from-white/[0.05] dark:via-fuchsia-500/10 dark:to-amber-500/5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-600 dark:text-fuchsia-300">Your independent protocol</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">{challenge.title}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{formatDate(challenge.startDate)} → {formatDate(challenge.endDate)} · {challenge.habits?.length || 0} habits · local time {clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-white px-4 py-2.5 text-sm font-black text-fuchsia-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-fuchsia-200"><FiEdit3 /> Edit</button>
            <button type="button" onClick={onFinish} disabled={saving === 'finish'} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-950 px-4 py-2.5 text-sm font-black text-white dark:border-white/10 dark:bg-white dark:text-slate-950"><FiFlag /> Finish</button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-fuchsia-50 via-white to-cyan-50 p-5 dark:border-white/10 dark:from-fuchsia-500/10 dark:via-transparent dark:to-cyan-500/10 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">My Day timeline · {dayName}</p>
              <h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Move through today’s evidence in order</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Planner changes, personal commitments and active periodic occurrences all appear at their real times.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-400/20 dark:bg-white/5 dark:text-emerald-200">{completionPercent}% complete</span>
              <span className="rounded-full border border-cyan-200 bg-white/80 px-3 py-2 text-xs font-black text-cyan-700 dark:border-cyan-400/20 dark:bg-white/5 dark:text-cyan-200">{formatTime(`${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`)} now</span>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80 shadow-inner dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-cyan-500 transition-all" style={{ width: `${completionPercent}%` }} /></div>
        </div>

        <div className="p-3 sm:p-6">
          {!challengeIsLive ? (
            <div className="rounded-[2rem] border border-dashed border-amber-300 bg-amber-50 p-10 text-center dark:border-amber-400/20 dark:bg-amber-500/10"><FiClock className="mx-auto h-8 w-8 text-amber-500" /><h4 className="mt-3 font-black text-slate-900 dark:text-white">Challenge starts {formatDate(challenge.startDate)}</h4><p className="mt-1 text-sm text-slate-500">Your habits are locked until the official start date.</p></div>
          ) : timelineEntries.length ? (
            <div className="space-y-1">
              {timelineEntries.map((entry, timelineIndex) => {
                const isEvent = entry.kind === 'event';
                const isNext = !isEvent && entry.index === nextHabitIndex;
                return (
                  <div key={isEvent ? `event-${entry.event.id}-${timelineIndex}` : `habit-${entry.index}`} className="grid grid-cols-[58px_14px_minmax(0,1fr)] gap-2 sm:grid-cols-[92px_22px_minmax(0,1fr)] sm:gap-3">
                    <div className="pt-4 text-right"><p className="text-xs font-black text-slate-950 dark:text-white sm:text-base">{formatTime(entry.timelineTime)}</p><p className={`mt-1 text-[9px] font-black uppercase tracking-wider ${isNext ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400'}`}>{isEvent ? entry.event.eventType : isNext ? entry.habit.habitType === 'periodic' ? `${entry.occurrenceNumber}/${entry.occurrenceTarget} next` : 'Next up' : `${entry.habit.durationMinutes || 30}m`}</p></div>
                    <div className="relative flex justify-center">{timelineIndex < timelineEntries.length - 1 ? <span className="absolute bottom-0 top-7 w-px bg-gradient-to-b from-fuchsia-300 to-cyan-200 dark:from-fuchsia-400/40 dark:to-cyan-400/20" /> : null}<span className={`relative mt-5 h-3 w-3 rounded-full border-[3px] bg-white ring-4 dark:bg-slate-950 ${isNext ? 'border-amber-500 ring-amber-100 dark:ring-amber-500/20' : isEvent ? 'border-cyan-500 ring-cyan-100 dark:ring-cyan-500/15' : 'border-fuchsia-600 ring-fuchsia-100 dark:ring-fuchsia-500/15'}`} /></div>
                    <div className={`pb-4 transition-transform ${isNext ? 'my-2 rounded-[1.5rem] ring-2 ring-amber-300/70 ring-offset-4 ring-offset-white shadow-xl shadow-amber-500/10 sm:scale-[1.015] dark:ring-amber-400/30 dark:ring-offset-[#080b18]' : ''}`}>
                      {isEvent ? (
                        <article className={`rounded-2xl border p-4 shadow-sm ${eventTone(entry.event.eventType)}`}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm dark:bg-white/10"><FiCalendar /></span><div><p className="font-black">{entry.event.title}</p><p className="mt-1 text-xs font-semibold opacity-75">Until {formatTime(entry.event.endTime)}{entry.event.reason ? ` · ${entry.event.reason}` : ''}</p></div></div></article>
                      ) : (
                        <StaffHabitCard
                          habit={{ ...entry.habit, scheduleTime: entry.timelineTime }}
                          habitIndex={entry.index}
                          today={today}
                          completionWindow={entry.completionWindow}
                          saving={saving === `habit-${entry.index}`}
                          numericValue={numericDrafts[entry.index]}
                          textValue={textDrafts[entry.index]}
                          onNumericChange={(value) => setNumericDrafts((current) => ({ ...current, [entry.index]: value }))}
                          onTextChange={(value) => setTextDrafts((current) => ({ ...current, [entry.index]: value }))}
                          onSave={onSaveProgress}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]"><FiCalendar className="mx-auto h-8 w-8 text-slate-400" /><h4 className="mt-3 font-black text-slate-900 dark:text-white">{closedHabits.length ? 'No more open habits today' : 'Nothing scheduled today'}</h4><p className="mt-1 text-sm text-slate-500">{closedHabits.length ? 'Review completed and missed windows in the closed section.' : 'Unscheduled days protect your streak. They do not count as misses.'}</p></div>
          )}
          <ClosedStaffHabitWindows
            entries={closedHabits}
            today={today}
            walletBalance={walletBalance}
            saving={saving}
            restoreConfirmIndex={restoreConfirmIndex}
            setRestoreConfirmIndex={setRestoreConfirmIndex}
            onRestoreStreak={onRestoreStreak}
          />
          {unscheduledHabits.length ? <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.025]"><summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">Not scheduled today · {unscheduledHabits.length}</summary><div className="border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">{unscheduledHabits.map((habit) => habit.name).join(' · ')}</div></details> : null}
        </div>
      </section>
    </div>
  );
}

function LegacyMyChallengeToday({ viewer, clock, saving, numericDrafts, textDrafts, setNumericDrafts, setTextDrafts, onSaveProgress, onCreate, onEdit, onFinish }) {
  if (!viewer?.challenge) return <EmptyChallengeCard onCreate={onCreate} />;
  const challenge = viewer.challenge;
  const today = viewer.today;
  const challengeIsLive = Boolean(viewer?.stats?.challenge?.todayIsLive);
  const dayName = new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  const scheduled = (challenge.habits || []).map((habit, index) => ({ habit, index })).filter(({ habit }) => (habit.scheduleDays || []).includes(dayName)).sort((a, b) => a.habit.scheduleTime.localeCompare(b.habit.scheduleTime));
  return <div className="space-y-5"><section className="rounded-[2rem] border border-fuchsia-200 bg-gradient-to-br from-white via-fuchsia-50 to-amber-50 p-5 dark:border-fuchsia-400/20 dark:from-white/[0.05] dark:via-fuchsia-500/10 dark:to-amber-500/5 sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-600 dark:text-fuchsia-300">Your independent protocol</p><h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">{challenge.title}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{formatDate(challenge.startDate)} → {formatDate(challenge.endDate)} · {challenge.habits?.length || 0} habits · local time {clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-white px-4 py-2.5 text-sm font-black text-fuchsia-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-fuchsia-200"><FiEdit3 /> Edit</button><button type="button" onClick={onFinish} disabled={saving === 'finish'} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-950 px-4 py-2.5 text-sm font-black text-white dark:border-white/10 dark:bg-white dark:text-slate-950"><FiFlag /> Finish</button></div></div></section><section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Today · {dayName}</p><h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Evidence window</h3></div><span className="text-xs font-bold text-slate-400">Log only 1h before → 1h after</span></div>{!challengeIsLive ? <div className="rounded-[2rem] border border-dashed border-amber-300 bg-amber-50 p-10 text-center dark:border-amber-400/20 dark:bg-amber-500/10"><FiClock className="mx-auto h-8 w-8 text-amber-500" /><h4 className="mt-3 font-black text-slate-900 dark:text-white">Challenge starts {formatDate(challenge.startDate)}</h4><p className="mt-1 text-sm text-slate-500">Your habits are locked until the official start date.</p></div> : scheduled.length ? <div className="space-y-3">{scheduled.map(({ habit, index }) => <StaffHabitCard key={habit.id || index} habit={habit} habitIndex={index} today={today} completionWindow={viewer.completionWindows?.[String(index)]} saving={saving === `habit-${index}`} numericValue={numericDrafts[index]} textValue={textDrafts[index]} onNumericChange={(value) => setNumericDrafts((current) => ({ ...current, [index]: value }))} onTextChange={(value) => setTextDrafts((current) => ({ ...current, [index]: value }))} onSave={onSaveProgress} />)}</div> : <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]"><FiCalendar className="mx-auto h-8 w-8 text-slate-400" /><h4 className="mt-3 font-black text-slate-900 dark:text-white">Nothing scheduled today</h4><p className="mt-1 text-sm text-slate-500">Unscheduled days protect your streak. They do not count as misses.</p></div>}</section></div>;
}

function ClosedStaffHabitWindows({ entries, today, walletBalance, saving, restoreConfirmIndex, setRestoreConfirmIndex, onRestoreStreak }) {
  if (!entries.length) return null;
  const completedCount = entries.filter((entry) => entry.percent >= 100).length;
  return (
    <details className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.025]">
      <summary className="group flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="font-black text-slate-800 dark:text-white">Closed habit windows · {entries.length}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{completedCount} completed · {entries.length - completedCount} missed or partial</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm transition group-open:rotate-180 dark:bg-white/[0.06] dark:text-slate-300"><FiChevronDown /></span>
      </summary>
      <div className="space-y-2 border-t border-slate-200 p-3 dark:border-white/10 sm:p-4">
        {entries.map((entry) => {
          const progress = progressForDate(entry.habit, today);
          const completed = entry.percent >= 100;
          const restoreOffer = entry.completionWindow?.streakRestore || {};
          const restored = Boolean(progress?.streakRestored || restoreOffer.alreadyRestored);
          const restoreCost = Number(restoreOffer.cost) || 0;
          const canRestore = !completed && !restored && Number(restoreOffer.atRiskStreak) > 0 && restoreCost > 0;
          const canAfford = walletBalance >= restoreCost;
          const confirming = restoreConfirmIndex === entry.index;
          const restoring = saving === `restore-${entry.index}`;
          const statusDetail = completed
            ? 'Completed inside the verified window'
            : entry.percent > 0
              ? `${entry.percent}% completed before the window closed`
              : 'Not completed before the window closed';
          return (
            <div key={`closed-${entry.index}`} className={`rounded-2xl border p-3 sm:p-4 ${completed ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/20 dark:bg-emerald-500/10' : 'border-rose-200 bg-rose-50/80 dark:border-rose-400/20 dark:bg-rose-500/10'}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${completed ? 'bg-emerald-500' : 'bg-rose-500'}`}>{completed ? <FiCheck className="h-5 w-5" /> : <FiX className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="font-black text-slate-950 dark:text-white">{entry.habit.name}</p><p className={`mt-1 text-xs font-bold ${completed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{statusDetail}</p></div>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm dark:bg-white/[0.07] dark:text-slate-300">{formatTime(entry.timelineTime)}</span>
                  </div>
                  {restored ? <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200"><HiOutlineFire /> Streak protected · result remains {completed ? 'complete' : entry.percent > 0 ? 'partial' : 'missed'}</div> : null}
                  {canRestore ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-300/20 dark:bg-black/10">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div><p className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200"><HiOutlineFire /> Protect your {restoreOffer.atRiskStreak}-occasion streak</p><p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Momentum is protected, while the missed or partial result remains honest.</p></div>
                        {confirming ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <button type="button" onClick={() => setRestoreConfirmIndex(null)} disabled={restoring} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">Cancel</button>
                            <button type="button" onClick={() => onRestoreStreak(entry.index)} disabled={restoring || !canAfford} className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45">{restoring ? 'Protecting…' : 'Confirm spend'}</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setRestoreConfirmIndex(entry.index)} disabled={!canAfford || Boolean(saving)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-slate-950">{canAfford ? <>Protect for <IpBuck amount={restoreCost} compact /></> : <>Need {restoreCost - walletBalance} more IP Bucks</>}</button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function StaffHabitCard({ habit, habitIndex, today, completionWindow, saving, numericValue, textValue, onNumericChange, onTextChange, onSave }) {
  const progress = progressForDate(habit, today);
  const percent = habitProgressPercent(habit, progress);
  const windowOpen = Boolean(completionWindow?.windowOpen);
  let windowMessage = completionWindow?.status === 'upcoming' && completionWindow.nextWindow
    ? `Opens ${formatTime(completionWindow.nextWindow.opensTime)}`
    : windowOpen
      ? `Open now · closes ${formatTime(completionWindow.activeWindow?.closesTime)}`
      : percent >= 100
        ? 'Completion verified'
        : 'Window closed';
  if (completionWindow?.status === 'not-applicable') {
    windowMessage = 'Not counted · challenge began later';
  }
  const combatDefence = habit.combatType === 'defence';
  const periodicCompleted = Number(progress?.periodicCompleted || 0);
  const periodicTarget = Number(progress?.periodicTarget ?? completionWindow?.eligibleOccurrenceCount ?? habit.periodicOccurrences ?? 4);
  return <article className={`relative overflow-hidden rounded-[1.5rem] border p-4 shadow-sm sm:p-5 ${percent >= 100 ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-500/10' : 'border-slate-200 bg-white/90 dark:border-white/10 dark:bg-white/[0.04]'}`}><div className="grid gap-4 lg:grid-cols-[auto_1fr_minmax(230px,.55fr)] lg:items-center"><div className="hidden w-20 text-center lg:block"><p className="text-lg font-black text-slate-950 dark:text-white">{formatTime(habit.scheduleTime)}</p><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{habit.durationMinutes} min</p></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${combatDefence ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200' : 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200'}`}>{combatDefence ? <FiShield /> : <FiZap />}{habit.combatType}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${windowOpen ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{windowMessage}</span><span className="lg:hidden rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-500 dark:bg-white/[0.06]">{formatTime(habit.scheduleTime)}</span></div><h4 className="mt-3 text-lg font-black text-slate-950 dark:text-white">{habit.name}</h4>{habit.description ? <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{habit.description}</p> : null}<div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400" style={{ width: `${percent}%` }} /></div><span className="text-xs font-black text-slate-600 dark:text-slate-300">{percent}%</span></div></div><div>{habit.habitType === 'numeric' ? <div className="space-y-2"><div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>{habit.minValue}</span><span>{numericValue ?? progress?.numericValue ?? habit.minValue}</span><span>{habit.maxValue}</span></div><input type="range" min={habit.minValue} max={habit.maxValue} value={numericValue ?? progress?.numericValue ?? habit.minValue} onChange={(event) => onNumericChange(Number(event.target.value))} className="w-full accent-fuchsia-600" /><ActionButton disabled={!windowOpen || saving} onClick={() => onSave(habitIndex, numericValue ?? progress?.numericValue ?? habit.minValue)}>{saving ? 'Saving…' : 'Record value'}</ActionButton></div> : habit.habitType === 'text' ? <div className="space-y-2"><textarea value={textValue ?? progress?.textValue ?? ''} onChange={(event) => onTextChange(event.target.value)} placeholder={habit.prompt || 'Write the evidence…'} className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 dark:border-white/10 dark:bg-slate-950/50" /><ActionButton disabled={!windowOpen || saving} onClick={() => onSave(habitIndex, textValue ?? progress?.textValue ?? '')}>{saving ? 'Saving…' : 'File reflection'}</ActionButton></div> : habit.habitType === 'periodic' ? <div className="space-y-2"><p className="text-center text-sm font-black text-slate-700 dark:text-slate-200">{periodicCompleted}/{periodicTarget} occurrences</p><ActionButton disabled={!windowOpen || saving || periodicCompleted >= periodicTarget} onClick={() => onSave(habitIndex)}>{saving ? 'Saving…' : periodicCompleted >= periodicTarget ? 'All logged' : 'Log this occurrence'}</ActionButton></div> : <ActionButton disabled={!windowOpen || saving} onClick={() => onSave(habitIndex)}>{saving ? 'Saving…' : percent >= 100 ? 'Undo completion' : 'Mark complete'}</ActionButton>}</div></div></article>;
}

function ActionButton({ children, ...props }) {
  return <button type="button" {...props} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 px-4 py-2.5 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-35">{children}</button>;
}

function EmptyChallengeCard({ onCreate, compact = false }) {
  return <section className={`rounded-[2rem] border border-dashed border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-amber-50 text-center dark:border-fuchsia-400/25 dark:from-fuchsia-500/10 dark:to-amber-500/5 ${compact ? 'p-6' : 'p-10 sm:p-16'}`}><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-cyan-500 text-white shadow-xl shadow-fuchsia-500/20"><FiTarget className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">Your standards are currently off the record</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">Build a challenge around your own priorities, dates, days, and timings. Everyone sees the consistency — nobody controls your habits.</p>{onCreate ? <button type="button" onClick={onCreate} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950"><FiPlus /> Create my challenge</button> : null}</section>;
}

function StandardsLeaderboard({ rows }) {
  return <div className="space-y-5"><section className="rounded-[2rem] border border-amber-200 bg-gradient-to-br from-[#1b1025] via-[#2d1648] to-[#4a2706] p-6 text-white sm:p-8"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300"><HiOutlineTrophy /> The standards table</p><h2 className="mt-2 text-3xl font-black sm:text-5xl">Different challenges. Same lack of excuses.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Rankings use completion-equivalent progress across each person’s own scheduled habit days. Periodic habits count proportionally.</p></section><div className="space-y-3">{rows.map((member, index) => { const summary = member.stats?.summary || {}; return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} key={member.memberId} className={`grid gap-4 rounded-2xl border p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5 ${index === 0 ? 'border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10' : 'border-slate-200 bg-white/90 dark:border-white/10 dark:bg-white/[0.04]'}`}><div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black ${index === 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-200'}`}>#{member.rank}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-slate-950 dark:text-white">{member.name}</h3>{member.isViewer ? <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-[8px] font-black uppercase text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200">You</span> : null}</div><p className="mt-1 truncate text-xs text-slate-500">{member.challenge?.title || 'Yet to submit themselves to public accountability'}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400" style={{ width: `${member.score}%` }} /></div></div><div className="grid grid-cols-3 gap-2 text-center sm:min-w-[260px]"><MiniMetric label="Consistency" value={`${member.score}%`} /><MiniMetric label="Today" value={member.todayRate == null ? '—' : `${member.todayRate}%`} /><MiniMetric label="Streak" value={summary.currentActiveStreak || 0} /></div></motion.article>; })}</div></div>;
}

function MiniMetric({ label, value }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.04]"><p className="font-black text-slate-950 dark:text-white">{value}</p><p className="text-[8px] font-black uppercase tracking-wide text-slate-400">{label}</p></div>;
}

function ChallengeHistory({ challenges }) {
  return <div><section className="mb-5 rounded-[2rem] border border-slate-200 bg-white/90 p-6 dark:border-white/10 dark:bg-white/[0.04]"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-300">Your receipts archive</p><h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Completed personal challenges</h2><p className="mt-2 text-sm text-slate-500">History stays private to your account view while current standards remain visible to the group.</p></section>{challenges.length ? <div className="grid gap-3 md:grid-cols-2">{challenges.map((challenge) => <article key={challenge.id} className="rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-white/10 dark:bg-white/[0.04]"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-950 dark:text-white">{challenge.title}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(challenge.startDate)} → {formatDate(challenge.endDate)}</p></div><FiCheck className="text-emerald-500" /></div><p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">{challenge.habits?.length || 0} habits preserved</p></article>)}</div> : <div className="rounded-[2rem] border border-dashed border-slate-300 p-12 text-center dark:border-white/15"><FiRefreshCw className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-black">No completed challenges yet</h3></div>}</div>;
}

function StaffMembersPanel({ hub, onRemove }) {
  return <div className="space-y-5"><section className="rounded-[2rem] border border-fuchsia-200 bg-gradient-to-br from-white to-fuchsia-50 p-6 dark:border-fuchsia-400/20 dark:from-white/[0.05] dark:to-fuchsia-500/10"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-300">Invite protocol</p><h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Bring another coach into the firing line</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Share the HQ ID and workspace password. Only active admin or teacher accounts can join this group.</p><div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 font-mono text-xl font-black text-white dark:border-white/10"><FiUsers className="text-cyan-300" />{hub.group.groupId}</div></section><div className="grid gap-3 sm:grid-cols-2">{(hub.members || []).map((member) => <article key={member.memberId} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]"><div className="min-w-0"><p className="truncate font-black text-slate-950 dark:text-white">{member.name}</p><p className="mt-1 text-xs text-slate-500">{member.isLeader ? 'HQ founder' : member.accountRole} · {member.challenge ? `${member.score}% consistency` : 'No challenge'}</p></div>{!member.isLeader ? <button type="button" onClick={() => onRemove(member)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300"><FiTrash2 /></button> : <FiShield className="shrink-0 text-amber-500" />}</article>)}</div></div>;
}

function ChallengeEditor({ editing, form, setForm, aiBrief, setAiBrief, saving, onGenerate, onUpdateHabit, onAddHabit, onRemoveHabit, onClose, onSubmit }) {
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"><form onSubmit={onSubmit} className="mx-auto w-full max-w-6xl rounded-[2rem] border border-white/10 bg-[#0a0d1c] text-white shadow-2xl"><div className="sticky top-0 z-20 flex items-start justify-between gap-4 rounded-t-[2rem] border-b border-white/10 bg-[#0a0d1c]/95 p-5 backdrop-blur sm:p-7"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300">Personal challenge builder</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{editing ? 'Edit your protocol' : 'Put your standards on the record'}</h2></div><button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-3 text-slate-400 hover:bg-white/5 hover:text-white"><FiX /></button></div><div className="space-y-6 p-5 sm:p-7"><section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-3"><label className="sm:col-span-3"><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-400">Challenge title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-lg font-black outline-none focus:border-fuchsia-400" /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-400">Start date</span><input type="date" value={form.startDate} min={editing ? form.startDate : localDateInput()} onChange={(event) => setForm({ ...form, startDate: event.target.value })} disabled={editing} required className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-fuchsia-400 disabled:opacity-50" /></label><label><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-400">End date</span><input type="date" value={form.endDate} min={form.startDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-fuchsia-400" /></label><div className="rounded-xl border border-amber-300/15 bg-amber-300/10 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wide text-amber-300">Independence rule</p><p className="mt-1 text-xs leading-5 text-slate-300">Your dates and habits never need to match anybody else’s.</p></div></section><section className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 p-4 sm:p-5"><div className="flex items-center gap-2 text-fuchsia-200"><HiOutlineSparkles /><h3 className="font-black">AI challenge starter</h3></div><p className="mt-1 text-xs leading-5 text-slate-400">Describe your goal, current reality, time constraints, and standards to protect. The response is forced into the app’s habit schema.</p><div className="mt-4 flex flex-col gap-3 lg:flex-row"><textarea value={aiBrief} onChange={(event) => setAiBrief(event.target.value)} placeholder="Example: I want better energy, consistent training, less late-night phone use, and protected deep-work time…" className="min-h-28 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-fuchsia-400" /><button type="button" onClick={onGenerate} disabled={saving === 'ai'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 px-5 py-3 font-black text-white disabled:opacity-50"><HiOutlineSparkles />{saving === 'ai' ? 'Thinking…' : 'Draft habits'}</button></div></section><section><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Your habits</p><h3 className="mt-1 text-xl font-black">Specific enough to measure. Realistic enough to repeat.</h3></div><button type="button" onClick={onAddHabit} disabled={form.habits.length >= 12} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black hover:bg-white/10 disabled:opacity-40"><FiPlus /> Add habit</button></div><div className="space-y-4">{form.habits.map((habit, index) => <HabitEditorCard key={habit.id || `habit-${index}`} habit={habit} index={index} canRemove={form.habits.length > 1} onUpdate={(patchValue) => onUpdateHabit(index, patchValue)} onRemove={() => onRemoveHabit(index)} />)}</div></section></div><div className="sticky bottom-0 flex flex-col-reverse gap-3 rounded-b-[2rem] border-t border-white/10 bg-[#0a0d1c]/95 p-5 backdrop-blur sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/5">Cancel</button><button disabled={saving === 'challenge'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-slate-950 disabled:opacity-50"><FiSave />{saving === 'challenge' ? 'Saving…' : editing ? 'Save changes' : 'Start challenge'}</button></div></form></div>;
}

function HabitEditorCard({ habit, index, canRemove, onUpdate, onRemove }) {
  const toggleDay = (day) => onUpdate({ scheduleDays: habit.scheduleDays.includes(day) ? habit.scheduleDays.filter((item) => item !== day) : [...habit.scheduleDays, day] });
  return <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 font-black text-fuchsia-200">{index + 1}</span><input value={habit.name} onChange={(event) => onUpdate({ name: event.target.value })} placeholder="Habit name" required className="min-w-0 flex-1 border-b border-white/10 bg-transparent py-2 text-lg font-black outline-none focus:border-fuchsia-400" /></div>{canRemove ? <button type="button" onClick={onRemove} className="rounded-xl border border-rose-400/20 p-3 text-rose-300 hover:bg-rose-500/10"><FiTrash2 /></button> : null}</div><textarea value={habit.description} onChange={(event) => onUpdate({ description: event.target.value })} placeholder="What does success look like?" className="mt-4 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-fuchsia-400" /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><EditorSelect label="Tracking" value={habit.habitType} onChange={(value) => onUpdate({ habitType: value })} options={[['boolean', 'Done / not done'], ['numeric', 'Numeric target'], ['text', 'Written evidence'], ['periodic', 'Periodic']]} /><EditorSelect label="Purpose" value={habit.combatType} onChange={(value) => onUpdate({ combatType: value })} options={[['attack', 'Attack · gain'], ['defence', 'Defence · protect']]} /><EditorInput label="Start time" type="time" value={habit.scheduleTime} onChange={(value) => onUpdate({ scheduleTime: value })} /><EditorInput label="Duration (min)" type="number" min="5" max="240" value={habit.durationMinutes} onChange={(value) => onUpdate({ durationMinutes: Number(value) })} /></div>{habit.habitType === 'numeric' ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><EditorInput label="Minimum" type="number" value={habit.minValue} onChange={(value) => onUpdate({ minValue: Number(value) })} /><EditorInput label="Target" type="number" value={habit.maxValue} onChange={(value) => onUpdate({ maxValue: Number(value) })} /></div> : null}{habit.habitType === 'text' ? <div className="mt-3"><EditorInput label="Reflection prompt" value={habit.prompt} onChange={(value) => onUpdate({ prompt: value })} /></div> : null}{habit.habitType === 'periodic' ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><EditorInput label="Occurrences" type="number" min="2" max="12" value={habit.periodicOccurrences} onChange={(value) => onUpdate({ periodicOccurrences: Number(value) })} /><EditorInput label="Interval (hours)" type="number" min="1" max="12" value={habit.periodicIntervalHours} onChange={(value) => onUpdate({ periodicIntervalHours: Number(value) })} /></div> : null}<div className="mt-4"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Scheduled days</p><div className="mt-2 grid grid-cols-7 gap-1">{WEEKDAYS.map((day, dayIndex) => <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-lg border px-1 py-2 text-[9px] font-black sm:text-xs ${habit.scheduleDays.includes(day) ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/10 text-slate-500'}`}>{SHORT_DAYS[dayIndex]}</button>)}</div></div></article>;
}

function EditorInput({ label, onChange, ...props }) {
  return <label><span className="mb-2 block text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400" /></label>;
}

function EditorSelect({ label, value, onChange, options }) {
  return <label><span className="mb-2 block text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

export default StaffGroupDetail;
