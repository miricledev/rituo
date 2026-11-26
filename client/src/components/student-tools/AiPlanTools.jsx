import React, { useState } from 'react';
import { FiActivity, FiAlertTriangle, FiBookOpen, FiCalendar, FiCheck, FiFolder, FiLoader, FiRefreshCw, FiSave, FiShield, FiTarget, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:focus:ring-violet-400/10';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400';

function ToolFrame({ eyebrow, title, description, icon: Icon, accent = 'violet', heroImage, heroAlt = '', children }) {
  const tones = accent === 'emerald'
    ? 'from-emerald-500/15 via-cyan-500/5 to-transparent text-emerald-600 dark:text-emerald-300'
    : 'from-violet-500/15 via-cyan-500/5 to-transparent text-violet-600 dark:text-cyan-300';
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-[#0a1022]/95">
      <header className={`relative overflow-hidden bg-gradient-to-r ${tones} p-5 sm:p-7`}>
        {heroImage ? <img src={heroImage} alt={heroAlt} className="absolute inset-y-0 right-0 hidden h-full w-[42%] object-cover opacity-20 dark:opacity-35 md:block" /> : null}
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]"><Icon /> {eyebrow}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

const FEATURE_LAB_STUDY_PLANS_KEY = 'ip:feature-lab-study-plans:v1';

const readFeatureLabStudyPlans = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(FEATURE_LAB_STUDY_PLANS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const createLocalPlanId = () => window.crypto?.randomUUID?.() || `study-plan-${Date.now()}`;

export function StudyPlannerTool({ groupId, initialPlan = {}, initialPlans = [], activePlanId = '', testMode = false, aiEndpoint = '', onLibraryChange }) {
  const [form, setForm] = useState({ subjects: 'English, Maths, Science', examDate: '', goals: '', availability: 'Weekdays after 17:00; Saturday morning', preferredMethods: 'Active recall, exam questions', notes: '' });
  const [plan, setPlan] = useState(initialPlan || {});
  const [plans, setPlans] = useState(() => testMode ? readFeatureLabStudyPlans() : initialPlans);
  const [selectedPlanId, setSelectedPlanId] = useState(activePlanId || '');
  const [planName, setPlanName] = useState(initialPlan?.title || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialPlan?.title));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const generate = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post(aiEndpoint || `/groups/${groupId}/student-tools/ai`, { toolId: 'study-planner', inputs: form, testMode });
      const generatedPlan = response.data?.result || {};
      setPlan(generatedPlan);
      setPlanName(generatedPlan.title || 'My study plan');
      setSelectedPlanId('');
      setSaved(false);
      setMessage('Draft ready. Review it, choose a name, then save it to your library.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The study planner could not build a plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyServerLibrary = (state) => {
    const nextPlans = state?.studyPlans || [];
    setPlans(nextPlans);
    setSelectedPlanId(state?.activeStudyPlanId || '');
    setPlan(state?.studyPlan || {});
    setPlanName(state?.studyPlan?.title || '');
    setSaved(Boolean(state?.studyPlan?.title));
    onLibraryChange?.(state);
  };

  const savePlan = async () => {
    if (!plan?.title || saving) return;
    setSaving(true);
    setError('');
    try {
      if (testMode) {
        const now = new Date().toISOString();
        const existing = plans.find((item) => item.id === selectedPlanId);
        const entry = {
          id: existing?.id || createLocalPlanId(),
          name: planName.trim() || plan.title,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          plan
        };
        const nextPlans = [...plans.filter((item) => item.id !== entry.id), entry].slice(-12);
        localStorage.setItem(FEATURE_LAB_STUDY_PLANS_KEY, JSON.stringify(nextPlans));
        setPlans(nextPlans);
        setSelectedPlanId(entry.id);
        setSaved(true);
        setMessage('Saved to this browser’s Feature Lab test library.');
      } else {
        const response = await api.put(`/groups/${groupId}/student-tools/study-plans`, {
          plan,
          name: planName.trim() || plan.title,
          planId: selectedPlanId || undefined
        });
        applyServerLibrary(response.data?.state);
        setMessage('Saved to My Study Plans. You can reopen it whenever you return.');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The study plan could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openPlan = async (entry) => {
    setPlan(entry.plan || {});
    setPlanName(entry.name || entry.plan?.title || 'Study plan');
    setSelectedPlanId(entry.id);
    setSaved(true);
    setMessage('');
    if (testMode) return;
    try {
      const response = await api.put(`/groups/${groupId}/student-tools/study-plans/${entry.id}/active`);
      applyServerLibrary(response.data?.state);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The selected study plan could not be opened.');
    }
  };

  const deletePlan = async (entry) => {
    if (!window.confirm(`Delete “${entry.name}” from My Study Plans?`)) return;
    setError('');
    if (testMode) {
      const nextPlans = plans.filter((item) => item.id !== entry.id);
      localStorage.setItem(FEATURE_LAB_STUDY_PLANS_KEY, JSON.stringify(nextPlans));
      setPlans(nextPlans);
      if (selectedPlanId === entry.id) {
        setSelectedPlanId('');
        setPlan({});
        setPlanName('');
        setSaved(false);
      }
      setMessage('Removed from this browser’s Feature Lab test library.');
      return;
    }
    try {
      const response = await api.delete(`/groups/${groupId}/student-tools/study-plans/${entry.id}`);
      applyServerLibrary(response.data?.state);
      setMessage('Study plan deleted.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The study plan could not be deleted.');
    }
  };

  return (
    <ToolFrame eyebrow="AI study planner" title="Turn revision pressure into a clear week." description="Tell the planner what matters and when you are actually free. It will protect sleep and recovery while building a GCSE-focused plan." icon={FiBookOpen} heroImage="/images/tools/study-planner-hero.webp" heroAlt="Student building a colourful revision plan">
      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <label className={labelClass}>Subjects<input value={form.subjects} onChange={change('subjects')} className={inputClass} placeholder="Maths, Biology, English Literature" /></label>
          <label className={labelClass}>Main goals<textarea value={form.goals} onChange={change('goals')} className={`${inputClass} min-h-20`} placeholder="Improve algebra and prepare An Inspector Calls quotes" /></label>
          <label className={labelClass}>Availability<textarea value={form.availability} onChange={change('availability')} className={`${inputClass} min-h-20`} /></label>
          <label className={labelClass}>Exam or target date<input type="date" value={form.examDate} onChange={change('examDate')} className={inputClass} /></label>
          <label className={labelClass}>Methods you prefer<input value={form.preferredMethods} onChange={change('preferredMethods')} className={inputClass} /></label>
          <label className={labelClass}>Anything else<textarea value={form.notes} onChange={change('notes')} className={`${inputClass} min-h-16`} placeholder="Football Tuesday, no late sessions..." /></label>
          {error ? <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</p> : null}
          {message ? <p className={`rounded-xl p-3 text-xs font-bold ${saved ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200'}`}>{message}</p> : null}
          <button type="button" onClick={generate} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">{loading ? <FiLoader className="animate-spin" /> : plan?.title ? <FiRefreshCw /> : <FiTarget />} {loading ? 'Designing your week...' : plan?.title ? 'Rebuild plan' : 'Build my study plan'}</button>
          {plan?.title ? <div className="rounded-xl border border-violet-200 bg-white p-3 dark:border-violet-400/20 dark:bg-white/[0.04]"><label className={labelClass}>Plan name<input value={planName} onChange={(event) => { setPlanName(event.target.value); setSaved(false); }} maxLength={120} className={inputClass} /></label><button type="button" onClick={savePlan} disabled={saving || saved} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:cursor-default disabled:opacity-55">{saving ? <FiLoader className="animate-spin" /> : saved ? <FiCheck /> : <FiSave />} {saving ? 'Saving plan...' : saved ? 'Saved in My Study Plans' : 'Save to My Study Plans'}</button></div> : null}
        </div>
        <StudyPlanResult plan={plan} />
      </div>
      <StudyPlanLibrary plans={plans} selectedPlanId={selectedPlanId} testMode={testMode} onOpen={openPlan} onDelete={deletePlan} />
    </ToolFrame>
  );
}

function StudyPlanLibrary({ plans, selectedPlanId, testMode, onOpen, onDelete }) {
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-cyan-300"><FiFolder /> My Study Plans</p><h4 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Saved revision libraries</h4></div><p className="text-[10px] text-slate-500">{testMode ? 'Feature Lab plans are stored on this device.' : `${plans.length}/12 plans saved to your account.`}</p></div>
      {plans.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{plans.map((entry) => <article key={entry.id} className={`rounded-xl border p-3 ${selectedPlanId === entry.id ? 'border-violet-400 bg-violet-50 dark:border-cyan-400/40 dark:bg-cyan-400/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]'}`}><button type="button" onClick={() => onOpen(entry)} className="w-full text-left"><p className="truncate text-sm font-black text-slate-950 dark:text-white">{entry.name}</p><p className="mt-1 text-[10px] text-slate-500">{entry.updatedAt ? `Updated ${new Date(entry.updatedAt).toLocaleDateString()}` : 'Previously saved plan'}</p><p className="mt-2 text-[10px] font-black uppercase tracking-wide text-violet-600 dark:text-cyan-300">{selectedPlanId === entry.id ? 'Open now' : 'Open plan'}</p></button><button type="button" onClick={() => onDelete(entry)} className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-rose-600 dark:text-rose-300"><FiTrash2 /> Delete</button></article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.025]">Generate a study plan, review it, then save it here.</div>}
    </section>
  );
}

function StudyPlanResult({ plan }) {
  if (!plan?.title) return <EmptyPlan icon={FiCalendar} title="Your seven-day plan appears here" detail="The AI returns a strict weekly schedule with methods, success checks, checkpoints and a realistic wellbeing guardrail." />;
  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-400/20 dark:bg-violet-400/10"><h4 className="text-xl font-black text-violet-950 dark:text-violet-100">{plan.title}</h4><p className="mt-2 text-sm leading-6 text-violet-900/75 dark:text-violet-100/70">{plan.summary}</p></div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{(plan.weeklyPlan || []).map((day) => <article key={day.day} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]"><div className="flex items-center justify-between gap-2"><h5 className="font-black text-slate-950 dark:text-white">{day.day}</h5><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500 dark:bg-white/[0.07]">{day.blocks?.length || 0} blocks</span></div><p className="mt-1 text-xs text-slate-500">{day.focus}</p><div className="mt-3 space-y-2">{(day.blocks || []).map((block, index) => <div key={`${block.startTime}-${index}`} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.045]"><p className="text-[10px] font-black text-violet-700 dark:text-cyan-300">{block.startTime} · {block.durationMinutes} min · {block.subject}</p><p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">{block.task}</p><p className="mt-1 text-[10px] text-slate-500">{block.method} · Check: {block.successCheck}</p></div>)}{!day.blocks?.length ? <p className="text-[10px] italic text-slate-400">Protected recovery day</p> : null}</div></article>)}</div>
      <div className="grid gap-3 lg:grid-cols-2"><PlanList title="Plan strategy" items={plan.strategy} /><PlanList title="Checkpoints" items={(plan.checkpoints || []).map((item) => `${item.targetDate}: ${item.label} — ${item.evidence}`)} /></div>
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"><FiShield className="mr-2 inline" />{plan.wellbeingNote}</p>
    </div>
  );
}

export function FitnessCoachTool({ groupId, initialPlan = {}, testMode = false, aiEndpoint = '', onPlanSaved, workspaceType = 'school' }) {
  const isFootballWorkspace = workspaceType === 'football';
  const [form, setForm] = useState(() => ({ goal: isFootballWorkspace ? 'Improve football speed, strength and match fitness' : 'Improve general fitness and energy', experience: 'Beginner', equipment: 'Bodyweight only', daysPerWeek: '3', minutesPerSession: '30', limitations: 'None', activitiesEnjoyed: isFootballWorkspace ? 'Football, ball work and short sprints' : '' }));
  const [plan, setPlan] = useState(initialPlan || {});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialPlan?.title));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post(aiEndpoint || `/groups/${groupId}/student-tools/ai`, { toolId: 'fitness-coach', inputs: form, testMode });
      setPlan(response.data?.result || {});
      setSaved(false);
      setMessage(testMode ? '' : 'Review the draft. Save it only if it feels right for you.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The fitness coach could not build a plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!plan?.title || testMode || !groupId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.put(`/groups/${groupId}/student-tools/fitness-plan`, { plan });
      const savedPlan = response.data?.fitnessPlan || plan;
      setPlan(savedPlan);
      setSaved(true);
      setMessage('Plan saved. It will be here when you return.');
      onPlanSaved?.(savedPlan);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The fitness plan could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ToolFrame eyebrow={isFootballWorkspace ? 'AI personal trainer' : 'AI fitness coach'} title={isFootballWorkspace ? 'Build an engine for your game.' : 'Train with purpose, not punishment.'} description={isFootballWorkspace ? 'Build a safe plan around your position, football goals, training load, available equipment and real schedule. Stop if you feel pain, dizziness or illness.' : 'Build an age-appropriate plan around your goals, available equipment and real schedule. Stop if you feel pain, dizziness or illness.'} icon={FiActivity} accent="emerald" heroImage="/images/tools/fitness-coach-hero.webp" heroAlt={isFootballWorkspace ? 'Football client following a safe Inner Performance training session' : 'Students following a safe Inner Performance fitness session'}>
      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <label className={labelClass}>Goal<textarea value={form.goal} onChange={change('goal')} className={`${inputClass} min-h-20`} /></label>
          <label className={labelClass}>Experience<select value={form.experience} onChange={change('experience')} className={inputClass}><option>Beginner</option><option>Some experience</option><option>Regularly active</option></select></label>
          <label className={labelClass}>Equipment<input value={form.equipment} onChange={change('equipment')} className={inputClass} /></label>
          <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Days weekly<select value={form.daysPerWeek} onChange={change('daysPerWeek')} className={inputClass}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label><label className={labelClass}>Minutes<select value={form.minutesPerSession} onChange={change('minutesPerSession')} className={inputClass}>{[15, 20, 30, 40, 50, 60].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <label className={labelClass}>Limitations or injuries<input value={form.limitations} onChange={change('limitations')} className={inputClass} /></label>
          <label className={labelClass}>Activities you enjoy<input value={form.activitiesEnjoyed} onChange={change('activitiesEnjoyed')} className={inputClass} placeholder="Football, walking, dance..." /></label>
          {error ? <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</p> : null}
          {message ? <p className={`rounded-xl p-3 text-xs font-bold ${saved ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200'}`}>{message}</p> : null}
          <button type="button" onClick={generate} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? <FiLoader className="animate-spin" /> : <FiActivity />} {loading ? 'Building safe sessions...' : plan?.title ? 'Rebuild fitness plan' : 'Build fitness plan'}</button>
          {!testMode && plan?.title ? <button type="button" onClick={save} disabled={saving || saved} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-black text-emerald-700 disabled:cursor-default disabled:opacity-60 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">{saving ? <FiLoader className="animate-spin" /> : saved ? <FiCheck /> : <FiSave />} {saving ? 'Saving plan...' : saved ? 'Plan saved' : 'Save this plan'}</button> : null}
        </div>
        <FitnessPlanResult plan={plan} />
      </div>
    </ToolFrame>
  );
}

function FitnessPlanResult({ plan }) {
  if (!plan?.title) return <EmptyPlan icon={FiActivity} title="Your training week appears here" detail="Every result includes warm-up, technique guidance, easier alternatives, recovery and a safe progression rule." />;
  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10"><h4 className="text-xl font-black text-emerald-950 dark:text-emerald-100">{plan.title}</h4><p className="mt-2 text-sm leading-6 text-emerald-900/75 dark:text-emerald-100/70">{plan.overview}</p></div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"><FiAlertTriangle className="mr-2 inline" />{plan.safetyNote}</p>
      <div className="grid gap-3 lg:grid-cols-2">{(plan.sessions || []).map((session) => <article key={`${session.day}-${session.focus}`} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300">{session.day} · {session.durationMinutes} min</p><h5 className="mt-1 font-black text-slate-950 dark:text-white">{session.focus}</h5></div><FiActivity className="text-emerald-500" /></div><div className="mt-3 space-y-2">{(session.exercises || []).map((exercise) => <div key={exercise.name} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.045]"><p className="text-xs font-black text-slate-800 dark:text-slate-200">{exercise.name} · {exercise.sets} sets · {exercise.repsOrTime}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{exercise.technique}</p><p className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Easier: {exercise.easierOption} · Rest {exercise.restSeconds}s</p></div>)}</div></article>)}</div>
      <div className="grid gap-3 lg:grid-cols-2"><PlanList title="Warm-up" items={plan.warmup} /><PlanList title="Recovery" items={plan.recovery} /></div>
      <p className="rounded-xl bg-slate-950 p-4 text-xs leading-5 text-white dark:bg-white dark:text-slate-950"><strong>Progress safely:</strong> {plan.progressionRule}</p>
    </div>
  );
}

function EmptyPlan({ icon: Icon, title, detail }) {
  return <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center dark:border-white/15 dark:bg-white/[0.025]"><div><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-cyan-300"><Icon className="h-6 w-6" /></span><h4 className="mt-4 text-lg font-black text-slate-900 dark:text-white">{title}</h4><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{detail}</p></div></div>;
}

function PlanList({ title, items = [] }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]"><h5 className="font-black text-slate-950 dark:text-white">{title}</h5><div className="mt-3 space-y-2">{items.map((item, index) => <p key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><FiCheck className="mt-0.5 shrink-0 text-emerald-500" />{item}</p>)}</div></div>;
}
