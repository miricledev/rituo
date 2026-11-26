import React, { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiArrowLeft,
  FiBookOpen,
  FiCheck,
  FiClipboard,
  FiClock,
  FiCode,
  FiCopy,
  FiFolder,
  FiHeadphones,
  FiLoader,
  FiMusic,
  FiPlay,
  FiRefreshCw,
  FiTarget,
  FiUploadCloud
} from 'react-icons/fi';
import { HiOutlineLanguage, HiOutlineSparkles } from 'react-icons/hi2';
import api from '../../services/api';
import FocusTimerTool from './FocusTimerTool';
import { FitnessCoachTool, StudyPlannerTool } from './AiPlanTools';
import LanguageTutorTool from './LanguageTutorTool';
import { MeditationLibrary } from './MeditationExperience';

const LAB_TABS = [
  ['overview', 'Overview', HiOutlineSparkles],
  ['study', 'Study planner', FiBookOpen],
  ['fitness', 'Fitness coach', FiActivity],
  ['spanish', 'Spanish tutor', HiOutlineLanguage],
  ['french', 'French tutor', HiOutlineLanguage],
  ['meditation', 'Meditation studio', FiHeadphones],
  ['pomodoro', 'Focus timer', FiClock]
];

const DEFAULT_FOCUSES = [
  { key: 'goal-clarity', title: 'Goal clarity and next action', purpose: 'Reconnect with a meaningful goal and choose the next realistic action.' },
  { key: 'deep-study-focus', title: 'Deep focus before study', purpose: 'Settle distractions and prepare for one defined study block.' },
  { key: 'improving-attention-span', title: 'Improving attention span', purpose: 'Practise noticing distraction, returning attention and gradually staying engaged for longer.' },
  { key: 'confidence-before-challenge', title: 'Confidence before a challenge', purpose: 'Build grounded confidence before an exam, presentation or difficult task.' },
  { key: 'reset-after-setback', title: 'Reset after a setback', purpose: 'Respond to a mistake without shame and return to what is controllable.' },
  { key: 'discipline-and-consistency', title: 'Discipline and consistency', purpose: 'Act from standards and identity when motivation is low.' },
  { key: 'emotional-regulation', title: 'Calm and emotional regulation', purpose: 'Lower immediate intensity and return to a steady state.' },
  { key: 'exam-composure', title: 'Exam composure', purpose: 'Settle nerves and rehearse a calm response to difficult questions.' },
  { key: 'evening-reflection', title: 'Evening reflection and recovery', purpose: 'Review effort without judgement and release unfinished pressure.' }
];

const DURATION_GUIDANCE = {
  5: 'Rapid reset before one task',
  10: 'Goal clarity or exam composure',
  15: 'Deep focus and visualisation',
  20: 'Resilience and behaviour change',
  30: 'Extended reflection and integration'
};

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:focus:ring-violet-400/10';

function AdminFeatureLab({ groupId }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const featureLabBase = groupId ? `/groups/${groupId}/feature-lab` : '/groups/global-feature-lab';
  const aiEndpoint = groupId ? `/groups/${groupId}/student-tools/ai` : '/groups/global-feature-lab/ai';

  const refreshConfig = () => {
    setError('');
    api.get(`${featureLabBase}/config`)
      .then((response) => setConfig(response.data))
      .catch((requestError) => setError(requestError.response?.data?.error || 'Feature Lab configuration could not be loaded.'));
  };

  useEffect(refreshConfig, [featureLabBase]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-200/50 bg-gradient-to-br from-[#080d1d] via-violet-950 to-fuchsia-950 p-5 text-white shadow-[0_30px_90px_rgba(88,28,135,0.25)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-300"><FiCode /> Admin Feature Lab</p>
            <h2 className="mt-2 text-3xl font-black sm:text-5xl">Test every student tool safely.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Create and test platform-wide student tools. Published meditation sessions become available across every school.</p>
          </div>
          <div className="flex flex-wrap gap-2"><StatusPill label="OpenAI" ready={config?.openAiConfigured} /><StatusPill label="ElevenLabs" ready={config?.elevenLabsConfigured} /></div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{error}</p> : null}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {LAB_TABS.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex min-w-max items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black transition ${activeTab === id ? 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-200' : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300'}`}><Icon />{label}</button>
        ))}
      </div>

      {activeTab !== 'overview' ? (
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-x-0.5 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200 dark:hover:border-violet-400/40 dark:hover:text-violet-200"
        >
          <FiArrowLeft /> Back to all features
        </button>
      ) : null}

      {activeTab === 'overview' ? <LabOverview config={config} onSelect={setActiveTab} /> : null}
      {activeTab === 'study' ? <StudyPlannerTool groupId={groupId} testMode aiEndpoint={aiEndpoint} /> : null}
      {activeTab === 'fitness' ? <FitnessCoachTool groupId={groupId} testMode aiEndpoint={aiEndpoint} /> : null}
      {activeTab === 'spanish' ? <LanguageTutorTool groupId={groupId} language="Spanish" testMode aiEndpoint={aiEndpoint} tutorConfig={config?.tutorConfig} /> : null}
      {activeTab === 'french' ? <LanguageTutorTool groupId={groupId} language="French" testMode aiEndpoint={aiEndpoint} tutorConfig={config?.tutorConfig} /> : null}
      {activeTab === 'meditation' ? <MeditationStudio groupId={groupId} featureLabBase={featureLabBase} config={config} onRefreshConfig={refreshConfig} /> : null}
      {activeTab === 'pomodoro' ? <FocusTimerTool /> : null}
    </div>
  );
}

function StatusPill({ label, ready }) {
  return <span className={`rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-wide ${ready ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-200'}`}>{label}: {ready ? 'ready' : 'setup needed'}</span>;
}

function LabOverview({ config, onSelect }) {
  const cards = [
    ['study', 'Study Planner Pro', 'Generate a strict seven-day revision plan.', FiBookOpen],
    ['fitness', 'AI Fitness Coach', 'Review youth-safe sessions and progression.', FiActivity],
    ['spanish', 'GCSE Spanish Tutor', 'Test marked topic and tense practice.', HiOutlineLanguage],
    ['french', 'GCSE French Tutor', 'Test adaptive French activities.', HiOutlineLanguage],
    ['meditation', 'Meditation Studio', 'Prompt, validate, voice and publish a session.', FiHeadphones],
    ['pomodoro', 'Protocol Focus Timer', 'Preview focus and recovery rounds.', FiClock]
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([id, title, detail, Icon]) => (
          <button key={id} type="button" onClick={() => onSelect(id)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.035]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200"><Icon /></span>
            <h3 className="mt-4 font-black text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p><p className="mt-4 text-[10px] font-black uppercase tracking-wide text-violet-600 dark:text-cyan-300">Open test <FiPlay className="ml-1 inline" /></p>
          </button>
        ))}
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.035]">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Runtime configuration</p>
        <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">Student tools model: <strong>{config?.studentToolsModel || 'Loading...'}</strong></p>
        <div className="mt-4 space-y-2">{(config?.meditationRequirements || []).map((item) => <p key={item} className="flex gap-2 text-xs leading-5 text-slate-500"><FiCheck className="mt-0.5 shrink-0 text-emerald-500" />{item}</p>)}</div>
      </aside>
    </div>
  );
}

function MeditationStudio({ groupId, featureLabBase, config, onRefreshConfig }) {
  const durations = config?.meditationDurations || [5, 10, 15, 20, 30];
  const focuses = config?.meditationFocuses || DEFAULT_FOCUSES;
  const [form, setForm] = useState({ focusKey: 'deep-study-focus', durationMinutes: 10, audience: 'UK secondary school students aged 14 to 18', notes: 'Calm, practical and non-religious. Finish ready to begin one useful action.' });
  const [prompt, setPrompt] = useState('');
  const [sessionJson, setSessionJson] = useState('');
  const [music, setMusic] = useState(null);
  const [validated, setValidated] = useState(null);
  const [durationEstimate, setDurationEstimate] = useState(null);
  const [createdSession, setCreatedSession] = useState(null);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const selectedFocus = useMemo(() => focuses.find((item) => item.key === form.focusKey), [focuses, form.focusKey]);

  useEffect(() => {
    if (!sessionJson.trim()) return undefined;
    try {
      JSON.parse(sessionJson);
    } catch {
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      api.post(`${featureLabBase}/meditation/validate`, { sessionJson })
        .then((response) => {
          if (!active) return;
          setValidated(response.data?.session);
          setDurationEstimate(response.data?.durationEstimate);
        })
        .catch(() => {
          if (!active) return;
          setValidated(null);
          setDurationEstimate(null);
        });
    }, 650);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [featureLabBase, sessionJson]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const reportError = (error) => setMessage({ type: 'error', text: error.response?.data?.error || 'That request could not be completed.' });

  const generatePrompt = async () => {
    setBusy('prompt'); setMessage(null);
    try {
      const response = await api.post(`${featureLabBase}/meditation/prompt`, { ...form, durationMinutes: Number(form.durationMinutes) });
      setPrompt(response.data?.prompt || '');
      setMessage({ type: 'success', text: 'Professional prompt ready. Send it to ChatGPT exactly as shown.' });
    } catch (error) { reportError(error); } finally { setBusy(''); }
  };

  const validate = async () => {
    setBusy('validate'); setMessage(null);
    try {
      const response = await api.post(`${featureLabBase}/meditation/validate`, { sessionJson });
      setValidated(response.data?.session);
      setDurationEstimate(response.data?.durationEstimate);
      setMessage({ type: 'success', text: 'JSON passed the strict meditation contract.' });
    } catch (error) {
      setValidated(null); setDurationEstimate(null); reportError(error);
    } finally { setBusy(''); }
  };

  const uploadMusic = async (file) => {
    if (!file) return;
    setBusy('music'); setMessage(null);
    const payload = new FormData(); payload.append('file', file);
    try {
      const response = await api.post(`${featureLabBase}/meditation/music`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMusic(response.data);
      setMessage({ type: 'success', text: `${file.name} uploaded as this session's background track.` });
    } catch (error) { reportError(error); } finally { setBusy(''); }
  };

  const create = async () => {
    setBusy('create'); setMessage(null);
    try {
      const response = await api.post(`${featureLabBase}/meditations`, { sessionJson, musicFilename: music?.filename || '', publish: true });
      setCreatedSession(response.data?.session);
      setLibraryRevision((current) => current + 1);
      setMessage({ type: 'success', text: 'Narration generated and session published across all schools.' });
    } catch (error) { reportError(error); } finally { setBusy(''); }
  };

  const canCreate = validated && durationEstimate?.fitStatus !== 'off-target' && !busy && config?.elevenLabsConfigured;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-indigo-200 bg-white shadow-[0_25px_80px_rgba(49,46,129,0.1)] dark:border-white/10 dark:bg-[#0a1022]">
        <header className="bg-gradient-to-r from-indigo-950 via-violet-950 to-fuchsia-950 p-5 text-white sm:p-7">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300"><FiHeadphones /> Manual AI → strict JSON → ElevenLabs</p>
          <h3 className="mt-2 text-3xl font-black">Guided Meditation Studio</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Create focused, safeguarding-aware sessions that help students regulate attention, reconnect with goals and finish ready for one useful action.</p>
        </header>

        <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-2">
          <div className="space-y-5">
            <StepHeading number="1" title="Choose the student outcome" detail="The prompt changes substantially for each focus and duration." />
            <Field label="Session focus">
              <select value={form.focusKey} onChange={update('focusKey')} className={inputClass}>{focuses.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</select>
            </Field>
            <p className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200"><FiTarget className="mr-2 inline" />{selectedFocus?.purpose}</p>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Exact session length</p>
              <div className="mt-2 grid grid-cols-5 gap-1.5">{durations.map((minutes) => <button key={minutes} type="button" onClick={() => setForm((current) => ({ ...current, durationMinutes: minutes }))} className={`rounded-xl border px-2 py-3 text-xs font-black ${Number(form.durationMinutes) === minutes ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04]'}`}>{minutes}m</button>)}</div>
              <p className="mt-2 text-[10px] text-slate-500">{DURATION_GUIDANCE[Number(form.durationMinutes)]}</p>
            </div>

            <Field label="Audience"><input value={form.audience} onChange={update('audience')} className={inputClass} /></Field>
            <Field label="Creative direction"><textarea value={form.notes} onChange={update('notes')} className={`${inputClass} min-h-24`} /></Field>
            <button type="button" onClick={generatePrompt} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy === 'prompt' ? <FiLoader className="animate-spin" /> : <FiClipboard />} Generate detailed ChatGPT prompt</button>

            {prompt ? <div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Copy this entire prompt</p><button type="button" onClick={() => navigator.clipboard?.writeText(prompt)} className="flex items-center gap-1 text-xs font-black text-violet-600"><FiCopy /> Copy</button></div><textarea readOnly value={prompt} className="h-96 w-full rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-[10px] leading-5 text-cyan-100 dark:border-white/10" /></div> : null}
          </div>

          <div className="space-y-5">
            <StepHeading number="2" title="Paste and validate the JSON" detail="Validation checks structure, focus, phases, pauses, voice direction and timing." />
            <textarea value={sessionJson} onChange={(event) => { setSessionJson(event.target.value); setValidated(null); setDurationEstimate(null); }} className="h-[27rem] w-full rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-[10px] leading-5 text-cyan-100 outline-none focus:border-violet-400 dark:border-white/10" placeholder="Paste the JSON object from ChatGPT here..." />
            <button type="button" onClick={validate} disabled={!sessionJson.trim() || !!busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700 disabled:opacity-40 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-200">{busy === 'validate' ? <FiLoader className="animate-spin" /> : <FiCode />} Validate JSON and estimate length</button>
            {durationEstimate ? <DurationEstimate estimate={durationEstimate} /> : null}

            <StepHeading number="3" title="Background music" detail="The default 15-minute track loops automatically for every session length." />
            <DefaultMusicCard music={config?.defaultMusic} onRefresh={onRefreshConfig} />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-black text-slate-600 dark:border-white/15 dark:bg-white/[0.035] dark:text-slate-300"><FiUploadCloud />{busy === 'music' ? 'Uploading...' : music ? 'Replace this session’s uploaded track' : 'Or upload a different track for this session'}<input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg" className="hidden" onChange={(event) => uploadMusic(event.target.files?.[0])} /></label>
            {music ? <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"><FiMusic /> Session-specific background track ready</p> : null}

            <button type="button" onClick={create} disabled={!canCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">{busy === 'create' ? <FiLoader className="animate-spin" /> : <FiHeadphones />} Generate ElevenLabs voice and publish</button>
            {!config?.elevenLabsConfigured ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">Add <strong>ELEVENLABS_API_KEY</strong> and <strong>ELEVENLABS_VOICE_ID</strong> to the backend environment, then restart it.</p> : null}
          </div>
        </div>

        {message ? <p className={`mx-4 mb-5 rounded-xl p-3 text-xs font-bold sm:mx-6 ${message.type === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>{message.text}</p> : null}
      </section>

      {createdSession ? <div><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-slate-950 dark:text-white">Published student preview</h3><button type="button" onClick={() => setCreatedSession(null)} className="flex items-center gap-1 text-xs font-black text-slate-500"><FiRefreshCw /> Clear preview</button></div><MeditationLibrary groupId={groupId} previewSession={createdSession} /></div> : null}
      <MeditationLibrary
        endpoint={groupId ? `/groups/${groupId}/student-tools/meditations` : `${featureLabBase}/meditations`}
        refreshKey={libraryRevision}
        eyebrow="Published meditation library"
        title="Saved sessions"
        description="These sessions are stored on the server and remain available after refresh. Globally published sessions appear across every school."
      />
    </div>
  );
}

function DurationEstimate({ estimate }) {
  const format = (seconds) => `${Math.floor(Math.abs(seconds) / 60)}m ${Math.abs(seconds) % 60}s`;
  const differenceCopy = estimate.differenceSeconds === 0
    ? 'The estimate exactly matches the planned duration.'
    : `The estimate is ${format(estimate.differenceSeconds)} ${estimate.differenceSeconds > 0 ? 'over' : 'under'} the planned duration.`;
  const tone = estimate.fitStatus === 'on-target' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200' : estimate.fitStatus === 'review' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200';
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-70">Estimated finished session</p><p className="mt-1 text-2xl font-black">{format(estimate.estimatedSeconds)}</p></div><span className="rounded-full bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase dark:bg-black/15">{estimate.fitStatus.replace('-', ' ')}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><EstimateMetric label="Planned" value={format(estimate.plannedSeconds)} /><EstimateMetric label="Words" value={estimate.wordCount} /><EstimateMetric label="Spoken" value={format(estimate.spokenSeconds)} /><EstimateMetric label="Quiet" value={format(estimate.quietIntegrationSeconds + estimate.ssmlPauseSeconds)} /></div>
      <p className="mt-3 text-[10px] leading-5 opacity-80">{differenceCopy} Off-target scripts cannot use ElevenLabs credits.</p>
    </div>
  );
}

function EstimateMetric({ label, value }) {
  return <div className="rounded-xl bg-white/60 p-2.5 dark:bg-black/10"><p className="text-[8px] font-black uppercase opacity-55">{label}</p><p className="mt-1 text-xs font-black">{value}</p></div>;
}

function DefaultMusicCard({ music, onRefresh }) {
  return (
    <div className={`rounded-2xl border p-4 ${music?.available ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/10' : 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10'}`}>
      <div className="flex items-start gap-3"><FiFolder className={music?.available ? 'text-emerald-600' : 'text-amber-600'} /><div className="min-w-0"><p className="text-sm font-black text-slate-900 dark:text-white">{music?.available ? 'Default music found' : 'Add your default 15-minute MP3 here'}</p><p className="mt-1 break-all font-mono text-[10px] leading-5 text-slate-600 dark:text-slate-300">{music?.path || 'server/uploads/meditations/ip-meditation-background-15min.mp3'}</p><p className="mt-2 text-[10px] leading-5 text-slate-500">Name it exactly <strong>{music?.filename || 'ip-meditation-background-15min.mp3'}</strong>. Keep it instrumental, seamless, properly licensed and under {music?.maxSizeMb || 15} MB.</p></div></div>
      <button type="button" onClick={onRefresh} className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-violet-600 dark:text-cyan-300"><FiRefreshCw /> Check folder again</button>
    </div>
  );
}

function StepHeading({ number, title, detail }) {
  return <div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">{number}</span><div><h4 className="font-black text-slate-950 dark:text-white">{title}</h4><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div></div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}</label>;
}

export default AdminFeatureLab;
