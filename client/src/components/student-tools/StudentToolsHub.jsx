import React, { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiBookOpen, FiClock, FiHeadphones, FiLoader, FiLock, FiShoppingBag, FiTool } from 'react-icons/fi';
import { HiOutlineLanguage, HiOutlineSparkles } from 'react-icons/hi2';
import api from '../../services/api';
import { getDeviceTimezone } from '../../utils/deviceTimezone';
import FocusTimerTool from './FocusTimerTool';
import { FitnessCoachTool, StudyPlannerTool } from './AiPlanTools';
import LanguageTutorTool from './LanguageTutorTool';
import { MeditationLibrary } from './MeditationExperience';

const TOOL_META = {
  pomodoro: { icon: FiClock, color: 'cyan', summary: 'Run distraction-free focus and recovery rounds.' },
  meditation: { icon: FiHeadphones, color: 'indigo', summary: 'Use immersive guided resets with breathing visuals.' },
  'study-planner': { icon: FiBookOpen, color: 'violet', summary: 'Turn subjects, goals and availability into a revision week.' },
  'fitness-coach': { icon: FiActivity, color: 'emerald', summary: 'Build safe, age-appropriate sessions around real equipment.' },
  'spanish-tutor': { icon: HiOutlineLanguage, color: 'amber', summary: 'Practise GCSE Spanish through marked interactive activities.' },
  'french-tutor': { icon: HiOutlineLanguage, color: 'blue', summary: 'Practise GCSE French through marked interactive activities.' },
  soundscapes: { icon: HiOutlineSparkles, color: 'fuchsia', summary: 'Adaptive background audio for deep focus.' },
  'pre-match-visualiser': { icon: HiOutlineSparkles, color: 'emerald', summary: 'Prepare confidence, focus and decisions before matchday.' },
  'recovery-room': { icon: FiHeadphones, color: 'cyan', summary: 'Turn recovery signals into a simple action for today.' },
  'match-review': { icon: FiActivity, color: 'indigo', summary: 'Capture key moments and turn reflection into the next target.' },
  'solo-session-builder': { icon: FiActivity, color: 'emerald', summary: 'Build focused technical sessions around position and space.' }
};

const toneByColor = {
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200',
  violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200',
  fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-200'
};

function StudentToolsHub({ groupId, onOpenShop, workspaceType = 'school' }) {
  const isFootballWorkspace = workspaceType === 'football';
  const isStaffWorkspace = workspaceType === 'staff';
  const [toolState, setToolState] = useState({ state: {}, features: [] });
  const [selectedTool, setSelectedTool] = useState(() => sessionStorage.getItem('ip:selected-tool') || 'pomodoro');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/groups/${groupId}/student-tools/state`, { params: { timezone: getDeviceTimezone() } })
      .then((response) => { if (active) setToolState(response.data || { state: {}, features: [] }); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.error || 'IP Tools could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [groupId]);

  const features = toolState.features || [];
  const selectedFeature = useMemo(() => features.find((item) => item.toolId === selectedTool), [features, selectedTool]);
  const ownedCount = features.filter((item) => item.owned && !item.comingSoon).length;
  const selectTool = (toolId) => {
    sessionStorage.setItem('ip:selected-tool', toolId);
    setSelectedTool(toolId);
  };
  const saveFitnessPlanLocally = (fitnessPlan) => {
    setToolState((current) => ({
      ...current,
      state: {
        ...(current.state || {}),
        fitnessPlan,
      },
    }));
  };
  const saveStudyLibraryLocally = (studyState) => {
    setToolState((current) => ({
      ...current,
      state: {
        ...(current.state || {}),
        studyPlan: studyState?.studyPlan || {},
        studyPlans: studyState?.studyPlans || [],
        activeStudyPlanId: studyState?.activeStudyPlanId || ''
      }
    }));
  };
  const updateTutorUsage = (toolId, usage) => {
    if (!usage) return;
    setToolState((current) => ({
      ...current,
      tutorUsage: {
        ...(current.tutorUsage || {}),
        [toolId]: usage,
      },
    }));
  };

  useEffect(() => {
    if (!features.length || features.some((feature) => feature.toolId === selectedTool)) return;
    selectTool(features[0].toolId);
  }, [features, selectedTool]);

  if (loading) return <div className="flex min-h-[28rem] items-center justify-center rounded-[2rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]"><FiLoader className="h-7 w-7 animate-spin text-violet-600" /></div>;
  if (error) return <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-400/20 dark:bg-rose-400/10"><h3 className="font-black text-rose-900 dark:text-rose-100">IP Tools unavailable</h3><p className="mt-2 text-sm text-rose-700 dark:text-rose-200">{error}</p></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-violet-200/70 bg-gradient-to-br from-slate-950 via-violet-950 to-cyan-950 p-5 text-white shadow-[0_30px_90px_rgba(76,29,149,0.22)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <img src="/images/tools/ip-tools-hub.webp" alt="" aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[45%] object-cover opacity-25 lg:block" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300"><FiTool /> {isFootballWorkspace ? 'IP football tools' : isStaffWorkspace ? 'Coaches HQ toolkit' : 'IP performance tools'}</p><h2 className="mt-2 text-3xl font-black sm:text-5xl">{isFootballWorkspace ? 'Build the edge behind your game.' : isStaffWorkspace ? 'Use the same tools you expect others to use.' : 'Build the skill behind the result.'}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{isFootballWorkspace ? 'Train, recover, focus and prepare for matchday with tools earned through consistency—not real money.' : isStaffWorkspace ? 'Every live performance tool is included for staff members. IP Bucks stay focused on avatar customisation.' : 'Focus, revise, move, reset and practise languages with tools earned through consistency—not real money.'}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4 backdrop-blur"><p className="text-3xl font-black">{ownedCount}<span className="text-base text-cyan-300">/{features.filter((item) => !item.comingSoon).length}</span></p><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{isStaffWorkspace ? 'Included tools' : 'Tools unlocked'}</p></div></div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-2">{features.map((feature) => { const meta = TOOL_META[feature.toolId] || TOOL_META.pomodoro; const Icon = meta.icon; const selected = feature.toolId === selectedTool; return <button key={feature.id} type="button" onClick={() => selectTool(feature.toolId)} className={`min-w-[10.5rem] rounded-2xl border p-3 text-left transition ${selected ? `${toneByColor[meta.color]} shadow-sm` : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300'}`}><div className="flex items-center justify-between"><Icon className="h-5 w-5" />{feature.comingSoon ? <FiClock className="h-3.5 w-3.5 opacity-60" /> : !feature.owned ? <FiLock className="h-3.5 w-3.5 opacity-60" /> : null}</div><p className="mt-3 text-xs font-black">{feature.name}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wide opacity-60">{feature.comingSoon ? 'Coming soon' : feature.owned ? 'Unlocked' : `${feature.price} IP Bucks`}</p></button>; })}</div>

      {selectedFeature?.owned && !selectedFeature.comingSoon ? <ToolExperience toolId={selectedTool} groupId={groupId} state={toolState.state} tutorConfig={toolState.tutorConfig} tutorUsage={toolState.tutorUsage} onFitnessPlanSaved={saveFitnessPlanLocally} onTutorUsageChange={updateTutorUsage} onStudyLibraryChange={saveStudyLibraryLocally} workspaceType={workspaceType} /> : <LockedTool feature={selectedFeature} onOpenShop={onOpenShop} />}
    </div>
  );
}

function ToolExperience({ toolId, groupId, state, tutorConfig, tutorUsage, onFitnessPlanSaved, onTutorUsageChange, onStudyLibraryChange, workspaceType }) {
  if (toolId === 'pomodoro') return <FocusTimerTool />;
  if (toolId === 'meditation') return <MeditationLibrary groupId={groupId} />;
  if (toolId === 'study-planner') return <StudyPlannerTool groupId={groupId} initialPlan={state?.studyPlan} initialPlans={state?.studyPlans} activePlanId={state?.activeStudyPlanId} onLibraryChange={onStudyLibraryChange} />;
  if (toolId === 'fitness-coach') return <FitnessCoachTool groupId={groupId} initialPlan={state?.fitnessPlan} onPlanSaved={onFitnessPlanSaved} workspaceType={workspaceType} />;
  if (toolId === 'spanish-tutor') return <LanguageTutorTool groupId={groupId} language="Spanish" tutorConfig={tutorConfig} initialUsage={tutorUsage?.[toolId]} onUsageChange={(usage) => onTutorUsageChange(toolId, usage)} />;
  if (toolId === 'french-tutor') return <LanguageTutorTool groupId={groupId} language="French" tutorConfig={tutorConfig} initialUsage={tutorUsage?.[toolId]} onUsageChange={(usage) => onTutorUsageChange(toolId, usage)} />;
  return null;
}

function LockedTool({ feature, onOpenShop }) {
  if (!feature) return null;
  const meta = TOOL_META[feature.toolId] || TOOL_META.pomodoro;
  const Icon = meta.icon;
  return <section className="flex min-h-[26rem] items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50 p-6 text-center dark:border-white/15 dark:from-white/[0.04] dark:to-white/[0.015]"><div className="max-w-lg"><span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${toneByColor[meta.color]}`}><Icon className="h-7 w-7" /></span><p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{feature.comingSoon ? 'Future protocol' : 'Consistency unlock'}</p><h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{feature.name}</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{meta.summary}</p>{feature.comingSoon ? <span className="mt-5 inline-flex rounded-full bg-fuchsia-50 px-4 py-2 text-xs font-black text-fuchsia-700 dark:bg-fuchsia-400/10 dark:text-fuchsia-200">In development</span> : <button type="button" onClick={onOpenShop} className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950"><FiShoppingBag /> Unlock for {feature.price} IP Bucks</button>}</div></section>;
}

export default StudentToolsHub;
