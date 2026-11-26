import { useMemo, useState } from 'react';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiClock,
  FiPlus,
  FiShield,
  FiTarget,
  FiUsers
} from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import { DAY_NAMES } from '../utils/habitScheduleUtils';
import { createEmptyCurrentHabit } from '../utils/groupDetailDefaults';
import { generatePersonalizedHabitBatches } from '../utils/challengeAiBatching';

const DEFAULT_SCHEDULE = [...DAY_NAMES];
const STEPS = [
  { id: 'basics', label: 'Basics', icon: FiTarget },
  { id: 'tracking', label: 'Tracking', icon: FiClock },
  { id: 'students', label: 'Students', icon: FiUsers },
  { id: 'schedule', label: 'Schedule', icon: FiShield }
];

const sameDays = (left, right) => JSON.stringify([...(left || [])].sort()) === JSON.stringify([...right].sort());

const ChallengeHabitBuilder = ({
  groupId,
  currentHabit,
  setCurrentHabit,
  editChallengeHabitsMode,
  memberHabits,
  lockedChallengeMemberIds,
  groupMembers,
  schoolProfileMap,
  setMemberHabits,
  isChallengeValid,
  getMissingMembers,
  handleCancel,
  hasHabitsAdded,
  lockHabitsAndShowOverview,
  onAiGenerationComplete,
  onAiProgress,
  workspaceType = 'school'
}) => {
  const isFootballWorkspace = workspaceType === 'football';
  const memberLabel = isFootballWorkspace ? 'client' : 'student';
  const memberLabelPlural = isFootballWorkspace ? 'clients' : 'students';
  const [studioMode, setStudioMode] = useState('ai');
  const [manualStep, setManualStep] = useState(0);
  const [aiBrief, setAiBrief] = useState('');
  const [aiMemberIds, setAiMemberIds] = useState(null);
  const [generatingHabits, setGeneratingHabits] = useState(false);
  const [message, setMessage] = useState('');
  const [aiProgress, setAiProgress] = useState(null);

  const editableMembers = useMemo(
    () => (groupMembers || []).filter(
      (member) => (!member.accountRole || member.accountRole === 'student')
        && (!editChallengeHabitsMode || !lockedChallengeMemberIds.has(String(member.id)))
    ),
    [editChallengeHabitsMode, groupMembers, lockedChallengeMemberIds]
  );
  const selectedAiMemberIds = aiMemberIds === null ? editableMembers.map((member) => member.id) : aiMemberIds;
  const updateCurrentHabit = (patch) => setCurrentHabit({ ...currentHabit, ...patch });

  const resetCurrentHabit = () => {
    setCurrentHabit({
      ...createEmptyCurrentHabit(),
      combatType: 'attack'
    });
    setManualStep(0);
  };

  const validateStep = () => {
    if (manualStep === 0 && !currentHabit.name.trim()) return 'Give the habit a clear name before continuing.';
    if (manualStep === 1 && currentHabit.habitType === 'periodic' && Number(currentHabit.periodicOccurrences) < 2) {
      return 'A periodic habit needs at least two occurrences.';
    }
    if (manualStep === 2 && !currentHabit.assignedMembers.length) return `Select at least one ${memberLabel}.`;
    if (manualStep === 3 && !currentHabit.scheduleDays.length) return 'Choose at least one scheduled day.';
    return '';
  };

  const nextStep = () => {
    const validationMessage = validateStep();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    setMessage('');
    setManualStep((previous) => Math.min(STEPS.length - 1, previous + 1));
  };

  const addHabit = () => {
    const validationMessage = validateStep();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    const nextMemberHabits = { ...memberHabits };
    currentHabit.assignedMembers.forEach((memberId) => {
      const memberKey = String(memberId);
      nextMemberHabits[memberKey] = [...(nextMemberHabits[memberKey] || []), {
        name: currentHabit.name.trim(),
        description: currentHabit.description.trim(),
        habitType: currentHabit.habitType,
        minValue: Number(currentHabit.minValue) || 0,
        maxValue: Number(currentHabit.maxValue) || 10,
        prompt: currentHabit.prompt,
        scheduleDays: currentHabit.scheduleDays,
        durationMinutes: Number(currentHabit.durationMinutes) || 30,
        combatType: currentHabit.combatType === 'defence' ? 'defence' : 'attack',
        periodicIntervalHours: Number(currentHabit.periodicIntervalHours) || 4,
        periodicOccurrences: Number(currentHabit.periodicOccurrences) || 4,
        allowOverlap: !!currentHabit.allowOverlap,
        linkedGoalId: currentHabit.linkedGoalIds?.[memberId] || null
      }];
    });
    setMemberHabits(nextMemberHabits);
    setMessage(`“${currentHabit.name.trim()}” added. You can build the next habit now.`);
    resetCurrentHabit();
  };

  const generateHabits = async () => {
    if (aiBrief.trim().length < 10 || !selectedAiMemberIds.length) {
      setMessage(`Add a fuller brief and select at least one editable ${memberLabel}.`);
      return;
    }
    try {
      setGeneratingHabits(true);
      setMessage('');
      const draft = await generatePersonalizedHabitBatches({
        groupId,
        text: aiBrief,
        memberIds: selectedAiMemberIds,
        onProgress: (progress) => {
          setAiProgress(progress);
          onAiProgress?.(progress);
        },
      });
      const studentHabitSets = draft.studentHabitSets || [];
      setMemberHabits((previous) => {
        const next = { ...previous };
        studentHabitSets.forEach((studentSet) => {
          const memberKey = String(studentSet.studentId);
          next[memberKey] = [
            ...(next[memberKey] || []),
            ...(studentSet.habits || [])
          ];
        });
        return next;
      });
      const totalHabits = studentHabitSets.reduce((sum, studentSet) => sum + (studentSet.habits?.length || 0), 0);
      setMessage(`${totalHabits} personalised habits added across ${studentHabitSets.length} ${memberLabelPlural}. Review them on the left.`);
      onAiGenerationComplete?.({
        text: aiBrief,
        presetHabits: [],
        memberIds: selectedAiMemberIds,
      });
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'OpenAI could not generate habits.');
      setAiProgress((previous) => previous ? { ...previous, status: 'error' } : null);
    } finally {
      setGeneratingHabits(false);
    }
  };

  const handleDone = () => {
    if (currentHabit.name.trim()) {
      setMessage('This habit has not been added yet. Add it or clear the form before finishing.');
      return;
    }
    if (!isChallengeValid()) {
      const missingMembers = getMissingMembers();
      setMessage(
        missingMembers.length
          ? `Add at least one habit for: ${missingMembers.map((member) => member.username).join(', ')}.`
          : `Every ${memberLabel} needs at least one habit.`
      );
      return;
    }
    setMessage('');
    lockHabitsAndShowOverview();
  };

  const toggleAiMember = (memberId) => {
    const allSelected = aiMemberIds === null;
    const current = allSelected ? editableMembers.map((member) => member.id) : aiMemberIds;
    setAiMemberIds(
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  };

  const renderBasics = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Habit name</label>
        <input
          value={currentHabit.name}
          onChange={(event) => updateCurrentHabit({ name: event.target.value })}
          placeholder="e.g. Complete a focused revision block"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />
      </div>
      <div>
        <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Why and how</label>
        <textarea
          value={currentHabit.description}
          onChange={(event) => updateCurrentHabit({ description: event.target.value })}
          rows={4}
          placeholder="Explain what good completion looks like."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />
      </div>
      <div>
        <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Minutes per completion</label>
        <input
          type="number"
          min="5"
          max="240"
          step="5"
          value={currentHabit.durationMinutes || 30}
          onChange={(event) => updateCurrentHabit({ durationMinutes: Number(event.target.value) || 30 })}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />
      </div>
    </div>
  );

  const renderTracking = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          ['boolean', 'Checkbox', 'One clear completion'],
          ['numeric', 'Numeric', 'Measure a value or total'],
          ['text', 'Reflection', 'Write a short response'],
          ['periodic', 'Periodic', 'Repeat through waking hours']
        ].map(([value, label, detail]) => (
          <button
            key={value}
            type="button"
            onClick={() => updateCurrentHabit({ habitType: value })}
            className={`rounded-2xl border p-4 text-left transition ${currentHabit.habitType === value ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-500/10 dark:bg-violet-500/10' : 'border-slate-200 hover:border-violet-300 dark:border-white/10'}`}
          >
            <p className="font-bold text-slate-950 dark:text-white">{label}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
          </button>
        ))}
      </div>
      {currentHabit.habitType === 'numeric' && (
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={currentHabit.minValue} onChange={(event) => updateCurrentHabit({ minValue: Number(event.target.value) })} placeholder="Minimum" className="rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
          <input type="number" value={currentHabit.maxValue} onChange={(event) => updateCurrentHabit({ maxValue: Number(event.target.value) })} placeholder="Target" className="rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
        </div>
      )}
      {currentHabit.habitType === 'text' && (
        <input value={currentHabit.prompt} onChange={(event) => updateCurrentHabit({ prompt: event.target.value })} placeholder="Reflection prompt" className="w-full rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
      )}
      {currentHabit.habitType === 'periodic' && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-400/20 dark:bg-cyan-400/5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
              Repeat every
              <span className="mt-2 flex items-center gap-2">
                <input type="number" min="1" max="12" value={currentHabit.periodicIntervalHours || 4} onChange={(event) => updateCurrentHabit({ periodicIntervalHours: Number(event.target.value) || 4 })} className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 dark:border-cyan-400/20 dark:bg-slate-950" />
                hours
              </span>
            </label>
            <label className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
              Times per day
              <input type="number" min="2" max="12" value={currentHabit.periodicOccurrences || 4} onChange={(event) => updateCurrentHabit({ periodicOccurrences: Number(event.target.value) || 4 })} className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 dark:border-cyan-400/20 dark:bg-slate-950" />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-white/80 p-3 text-sm text-cyan-950 dark:bg-slate-950/50 dark:text-cyan-100">
            <input type="checkbox" checked={!!currentHabit.allowOverlap} onChange={(event) => updateCurrentHabit({ allowOverlap: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-cyan-300 text-cyan-600" />
            <span><strong>Allow overlap.</strong> A short occurrence may sit inside another block, such as a five-minute water break during study.</span>
          </label>
        </div>
      )}
    </div>
  );

  const renderStudents = () => {
    const editableIds = editableMembers.map((member) => member.id);
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => updateCurrentHabit({
            applyToAll: currentHabit.assignedMembers.length !== editableIds.length,
            assignedMembers: currentHabit.assignedMembers.length === editableIds.length ? [] : editableIds
          })}
          className="w-full rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left dark:border-violet-400/20 dark:bg-violet-500/10"
        >
          <p className="font-bold text-violet-950 dark:text-violet-100">Apply to all editable {memberLabelPlural}</p>
          <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">{currentHabit.assignedMembers.length}/{editableIds.length} selected</p>
        </button>
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {editableMembers.map((member) => (
            <label key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <input
                type="checkbox"
                checked={currentHabit.assignedMembers.includes(member.id)}
                onChange={() => updateCurrentHabit({
                  assignedMembers: currentHabit.assignedMembers.includes(member.id)
                    ? currentHabit.assignedMembers.filter((id) => id !== member.id)
                    : [...currentHabit.assignedMembers, member.id]
                })}
                className="h-4 w-4 rounded text-violet-600"
              />
              <span className="font-semibold text-slate-900 dark:text-white">{member.username}</span>
            </label>
          ))}
        </div>
        {!!currentHabit.assignedMembers.length && (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.035]">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Link each {memberLabel}’s goal</p>
              <p className="text-xs text-slate-500">Leave blank when the {memberLabel} has no relevant goal.</p>
            </div>
            {currentHabit.assignedMembers.map((memberId) => {
              const member = groupMembers?.find((item) => String(item.id) === String(memberId));
              const goals = schoolProfileMap[String(memberId)]?.goals || [];
              return (
                <label key={memberId} className="grid gap-2 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{member?.username}</span>
                  <select
                    value={currentHabit.linkedGoalIds?.[memberId] || ''}
                    onChange={(event) => updateCurrentHabit({ linkedGoalIds: { ...(currentHabit.linkedGoalIds || {}), [memberId]: event.target.value } })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">{goals.length ? 'No linked goal' : 'No goals set'}</option>
                    {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSchedule = () => (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Scheduled days</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['Every day', DEFAULT_SCHEDULE],
            ['Weekdays', DAY_NAMES.slice(0, 5)],
            ['Mon / Wed / Fri', ['Monday', 'Wednesday', 'Friday']]
          ].map(([label, days]) => (
            <button key={label} type="button" onClick={() => updateCurrentHabit({ scheduleDays: days })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${sameDays(currentHabit.scheduleDays, days) ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}>{label}</button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DAY_NAMES.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => updateCurrentHabit({
                scheduleDays: currentHabit.scheduleDays.includes(day)
                  ? currentHabit.scheduleDays.filter((item) => item !== day)
                  : [...currentHabit.scheduleDays, day]
              })}
              className={`rounded-xl border px-2 py-3 text-xs font-bold ${currentHabit.scheduleDays.includes(day) ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-200' : 'border-slate-200 text-slate-500 dark:border-white/10'}`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Purpose type</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ['attack', 'Attack', 'Moves toward a goal or a new achievement.', 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'],
            ['defence', 'Defence', 'Protects discipline, kindness, health, or an existing achievement.', 'border-rose-500 bg-rose-50 dark:bg-rose-500/10']
          ].map(([value, label, detail, activeClass]) => (
            <button key={value} type="button" onClick={() => updateCurrentHabit({ combatType: value })} className={`rounded-2xl border-2 p-4 text-left ${currentHabit.combatType === value ? activeClass : 'border-slate-200 dark:border-white/10'}`}>
              <p className="font-black text-slate-950 dark:text-white">{label}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const stepContent = [renderBasics, renderTracking, renderStudents, renderSchedule][manualStep]();

  return (
    <div className="space-y-5">
      <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-black/15">
        <button type="button" onClick={() => setStudioMode('ai')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${studioMode === 'ai' ? 'bg-white text-violet-700 shadow dark:bg-white/10 dark:text-cyan-200' : 'text-slate-500'}`}>
          <span className="inline-flex items-center gap-2"><HiOutlineSparkles /> AI personalised</span>
        </button>
        <button type="button" onClick={() => setStudioMode('manual')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${studioMode === 'manual' ? 'bg-white text-violet-700 shadow dark:bg-white/10 dark:text-cyan-200' : 'text-slate-500'}`}>
          <span className="inline-flex items-center gap-2"><FiPlus /> Manual stepper</span>
        </button>
      </div>

      {studioMode === 'ai' ? (
        <section className="overflow-hidden rounded-[1.75rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 dark:border-violet-400/20 dark:from-violet-500/10 dark:via-white/[0.03] dark:to-cyan-400/5">
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-600 dark:text-cyan-300">OpenAI habit studio</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Build for each {memberLabel}, not the average {memberLabel}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              AI reads each selected {memberLabel}’s goals, writes customised habits, links the relevant goal, and classifies every habit as attack or defence.
            </p>
            <textarea value={aiBrief} onChange={(event) => setAiBrief(event.target.value)} rows={7} maxLength={8000} placeholder="Describe the outcomes, standards, routines, age group, and any limits..." className="mt-4 w-full rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 text-sm text-slate-950 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-violet-400/20 dark:bg-slate-950/80 dark:text-white" />
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{isFootballWorkspace ? 'Clients' : 'Students'} receiving this AI draft</p>
                <button type="button" onClick={() => setAiMemberIds(selectedAiMemberIds.length === editableMembers.length ? [] : null)} className="text-xs font-bold text-violet-700 dark:text-cyan-300">
                  {selectedAiMemberIds.length === editableMembers.length ? 'Clear all' : 'Apply to all'}
                </button>
              </div>
              <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {editableMembers.map((member) => {
                  const selected = selectedAiMemberIds.includes(member.id);
                  const goals = schoolProfileMap[String(member.id)]?.goals || [];
                  return (
                    <button key={member.id} type="button" onClick={() => toggleAiMember(member.id)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/[0.04]'}`}>
                      {member.username} · {goals.length} goal{goals.length === 1 ? '' : 's'}
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={generateHabits} disabled={generatingHabits || aiBrief.trim().length < 10 || !selectedAiMemberIds.length} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3.5 font-black text-white shadow-xl shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
              {generatingHabits
                ? `Generating batch ${aiProgress?.batchNumber || 1} of ${aiProgress?.totalBatches || Math.ceil(selectedAiMemberIds.length / 8)}...`
                : `Generate personalised ${memberLabel} habits`}
            </button>
            {generatingHabits && aiProgress && (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-white/80 p-4 dark:border-cyan-400/20 dark:bg-slate-950/55">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-800 dark:text-cyan-200">
                  <span>{aiProgress.completedStudents}/{aiProgress.totalStudents} {memberLabelPlural} complete</span>
                  <span>{Math.round((aiProgress.completedStudents / aiProgress.totalStudents) * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-cyan-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${(aiProgress.completedStudents / aiProgress.totalStudents) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Keep this window open while each {memberLabel} batch is safely completed.</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-6 grid grid-cols-4 gap-2">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <button key={step.id} type="button" onClick={() => index <= manualStep && setManualStep(index)} className={`rounded-xl p-2 text-center text-xs font-bold ${index === manualStep ? 'bg-violet-600 text-white' : index < manualStep ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-white/[0.04]'}`}>
                  <StepIcon className="mx-auto mb-1 h-4 w-4" />
                  {step.id === 'students' ? (isFootballWorkspace ? 'Clients' : 'Students') : step.label}
                </button>
              );
            })}
          </div>
          {stepContent}
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
            <button type="button" onClick={() => setManualStep((previous) => Math.max(0, previous - 1))} disabled={manualStep === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-40 dark:border-white/10 dark:text-slate-300">
              <FiArrowLeft /> Back
            </button>
            {manualStep < STEPS.length - 1 ? (
              <button type="button" onClick={nextStep} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white dark:bg-cyan-500 dark:text-slate-950">
                Next <FiArrowRight />
              </button>
            ) : (
              <button type="button" onClick={addHabit} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-2.5 text-sm font-black text-white shadow-lg">
                <FiPlus /> Add habit
              </button>
            )}
          </div>
        </section>
      )}

      {message && <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">{message}</div>}

      {!isChallengeValid() && Object.values(memberHabits).flat().length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
          Every {memberLabel} needs at least one habit before review.
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <button type="button" onClick={handleCancel} className={`rounded-xl px-5 py-2.5 text-sm font-bold ${hasHabitsAdded ? 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}>
          {hasHabitsAdded ? (editChallengeHabitsMode ? 'Cancel unsaved changes' : 'Close autosaved draft') : 'Cancel'}
        </button>
        <button type="button" onClick={handleDone} disabled={!Object.values(memberHabits).flat().length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
          <FiCheck /> Done adding habits
        </button>
      </div>
    </div>
  );
};

export default ChallengeHabitBuilder;
