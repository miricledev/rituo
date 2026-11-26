import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FiChevronDown, FiChevronUp, FiDownload, FiUsers } from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import ChallengeMemberHabitsPanel from './ChallengeMemberHabitsPanel';
import ChallengeFormPanel from './ChallengeFormPanel';
import ChallengeSettingsSection from './ChallengeSettingsSection';
import ChallengeHabitBuilder from './ChallengeHabitBuilder';
import ChallengeCoveragePanel from './ChallengeCoveragePanel';
import { generatePersonalizedHabitBatches } from '../utils/challengeAiBatching';

const ChallengeEditorModal = ({
  show,
  editChallengeHabitsMode,
  hasHabitsAdded,
  isEditingHabits,
  memberHabits,
  lockedHabits,
  expandAllMembersInModal,
  collapseAllMembersInModal,
  group,
  collapsedMembersInModal,
  lockedChallengeMemberIds,
  toggleMemberCollapseInModal,
  setMemberHabits,
  newChallenge,
  goBackToEditing,
  challengeHandleCreateChallenge,
  habitPresets,
  challengeHandleLoadPreset,
  setNewChallenge,
  getDateString,
  groupCourses,
  currentHabit,
  setCurrentHabit,
  schoolProfileMap,
  challengeIsChallengeValid,
  challengeGetMissingMembers,
  handleCancel,
  lockHabitsAndShowOverview,
  fetchSchoolProfiles
}) => {
  const isFootballWorkspace = group?.groupType === 'football';
  const memberLabel = isFootballWorkspace ? 'client' : 'student';
  const memberLabelPlural = isFootballWorkspace ? 'clients' : 'students';
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetMemberIds, setPresetMemberIds] = useState(null);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [generatingTestGoals, setGeneratingTestGoals] = useState(false);
  const [goalSeedMessage, setGoalSeedMessage] = useState('');
  const [aiProgress, setAiProgress] = useState(null);
  const [lastAiRequest, setLastAiRequest] = useState(null);
  const [selectedRetryMemberIds, setSelectedRetryMemberIds] = useState([]);
  const [retryingHabits, setRetryingHabits] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const wasShown = useRef(false);
  const editableMembers = useMemo(
    () => (group?.members || []).filter(
      (member) => (!member.accountRole || member.accountRole === 'student')
        && (!editChallengeHabitsMode || !lockedChallengeMemberIds.has(String(member.id)))
    ),
    [editChallengeHabitsMode, group?.members, lockedChallengeMemberIds]
  );
  const selectedPresetMemberIds = presetMemberIds === null
    ? editableMembers.map((member) => member.id)
    : presetMemberIds;
  const studentMembers = useMemo(
    () => (group?.members || []).filter((member) => !member.accountRole || member.accountRole === 'student'),
    [group?.members]
  );
  const habitsForCoverage = isEditingHabits ? memberHabits : lockedHabits;
  const coverage = useMemo(() => {
    let totalHabits = 0;
    let weeklyMinutes = 0;
    let habitsWithoutSchedule = 0;
    let habitsWithoutGoalLink = 0;
    const missingMembers = [];
    const studentsWithoutGoals = [];

    studentMembers.forEach((member) => {
      const memberId = String(member.id);
      const habits = habitsForCoverage[memberId] || [];
      const goals = schoolProfileMap?.[memberId]?.goals || [];
      if (!habits.length) missingMembers.push(member);
      if (!goals.length) studentsWithoutGoals.push(member);
      habits.forEach((habit) => {
        totalHabits += 1;
        const scheduledDays = habit.scheduleDays?.length || 0;
        if (!scheduledDays) habitsWithoutSchedule += 1;
        if (goals.length && !habit.linkedGoalId) habitsWithoutGoalLink += 1;
        const occurrences = habit.habitType === 'periodic' ? Number(habit.periodicOccurrences) || 1 : 1;
        weeklyMinutes += (Number(habit.durationMinutes) || 30) * scheduledDays * occurrences;
      });
    });

    return {
      totalStudents: studentMembers.length,
      coveredStudents: studentMembers.length - missingMembers.length,
      missingMembers,
      studentsWithoutGoals,
      habitsWithoutSchedule,
      habitsWithoutGoalLink,
      totalHabits,
      averageWeeklyMinutes: studentMembers.length ? Math.round(weeklyMinutes / studentMembers.length) : 0,
    };
  }, [habitsForCoverage, schoolProfileMap, studentMembers]);
  const draftKey = `ipkp-challenge-draft:${group?.groupId || 'unknown'}`;

  useEffect(() => {
    if (!show) return;
    setSelectedPresetId('');
    setPresetMemberIds(null);
    setGoalSeedMessage('');
  }, [show]);

  useEffect(() => {
    const opening = show && !wasShown.current;
    wasShown.current = show;
    if (!opening || editChallengeHabitsMode) return;
    try {
      const savedDraft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (!savedDraft?.memberHabits || Object.values(memberHabits).flat().length) return;
      setMemberHabits(savedDraft.memberHabits);
      setNewChallenge((previous) => ({ ...previous, ...(savedDraft.newChallenge || {}) }));
      if (savedDraft.currentHabit) setCurrentHabit(savedDraft.currentHabit);
      if (savedDraft.lastAiRequest) setLastAiRequest(savedDraft.lastAiRequest);
      setDraftSavedAt(savedDraft.savedAt || null);
      setRetryMessage('Your autosaved challenge draft was restored.');
    } catch (_error) {
      localStorage.removeItem(draftKey);
    }
  }, [
    draftKey,
    editChallengeHabitsMode,
    memberHabits,
    setCurrentHabit,
    setMemberHabits,
    setNewChallenge,
    show,
  ]);

  useEffect(() => {
    if (!show || editChallengeHabitsMode) return undefined;
    const timer = setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(draftKey, JSON.stringify({
        newChallenge,
        memberHabits,
        currentHabit,
        lastAiRequest,
        savedAt,
      }));
      setDraftSavedAt(savedAt);
    }, 700);
    return () => clearTimeout(timer);
  }, [currentHabit, draftKey, editChallengeHabitsMode, lastAiRequest, memberHabits, newChallenge, show]);

  if (!show) {
    return null;
  }

  const applyPreset = async (aiMatchGoals) => {
    if (!selectedPresetId || !selectedPresetMemberIds.length) return;
    setApplyingPreset(true);
    try {
      const result = await challengeHandleLoadPreset(selectedPresetId, {
        memberIds: selectedPresetMemberIds,
        aiMatchGoals,
        onProgress: setAiProgress,
      });
      if (result?.aiRequest) setLastAiRequest(result.aiRequest);
      setSelectedPresetId('');
    } finally {
      setApplyingPreset(false);
    }
  };

  const toggleRetryMember = (memberId) => {
    setSelectedRetryMemberIds((previous) => (
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId]
    ));
  };

  const retryAiHabits = async (memberIds = selectedRetryMemberIds) => {
    if (!lastAiRequest || !memberIds.length) return;
    try {
      setRetryingHabits(true);
      setRetryMessage('');
      const draft = await generatePersonalizedHabitBatches({
        groupId: group?.groupId,
        text: lastAiRequest.text,
        presetHabits: lastAiRequest.presetHabits || [],
        memberIds,
        onProgress: setAiProgress,
      });
      setMemberHabits((previous) => {
        const next = { ...previous };
        draft.studentHabitSets.forEach((studentSet) => {
          next[String(studentSet.studentId)] = studentSet.habits || [];
        });
        return next;
      });
      setSelectedRetryMemberIds([]);
      setRetryMessage(`${memberIds.length} ${memberIds.length === 1 ? memberLabel : memberLabelPlural} regenerated successfully.`);
    } catch (error) {
      setRetryMessage(error.response?.data?.error || error.message || 'Selected habits could not be regenerated.');
    } finally {
      setRetryingHabits(false);
    }
  };

  const publishChallenge = async () => {
    const published = await challengeHandleCreateChallenge();
    if (published) {
      localStorage.removeItem(draftKey);
      setDraftSavedAt(null);
      window.refreshInboxUnreadCount?.();
    }
    return published;
  };

  const closeChallengeEditor = () => {
    if (!editChallengeHabitsMode) {
      const savedAt = new Date().toISOString();
      localStorage.setItem(draftKey, JSON.stringify({
        newChallenge,
        memberHabits,
        currentHabit,
        lastAiRequest,
        savedAt,
      }));
      setDraftSavedAt(savedAt);
    }
    handleCancel();
  };

  const generateTestGoals = async () => {
    if (!selectedPresetMemberIds.length) return;
    setGeneratingTestGoals(true);
    setGoalSeedMessage('');
    try {
      const response = await axios.post(`/groups/${group?.groupId}/students/goals/ai-seed`, {
        memberIds: selectedPresetMemberIds
      });
      await fetchSchoolProfiles?.();
      setGoalSeedMessage(`${response.data?.goalsCreated || 0} test goals added for ${response.data?.studentsProcessed || selectedPresetMemberIds.length} ${memberLabelPlural}.`);
    } catch (error) {
      setGoalSeedMessage(error.response?.data?.error || 'Test goals could not be generated.');
    } finally {
      setGeneratingTestGoals(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-md sm:p-4">
      <div className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/40 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-violet-950 to-slate-950 p-4 text-white sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Challenge studio</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">{editChallengeHabitsMode ? 'Edit challenge habits' : 'Create a new challenge'}</h2>
            </div>
            {hasHabitsAdded && (
              <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                {editChallengeHabitsMode
                  ? 'Unsaved changes'
                  : draftSavedAt
                    ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Saving draft...'}
              </div>
            )}
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={expandAllMembersInModal} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-violet-300 dark:border-white/10 dark:text-slate-200">
              <FiChevronDown /> Expand all
            </button>
            <button type="button" onClick={collapseAllMembersInModal} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-violet-300 dark:border-white/10 dark:text-slate-200">
              <FiChevronUp /> Collapse all
            </button>
            <div className="mx-1 hidden h-7 w-px bg-slate-200 dark:bg-white/10 sm:block" />
            <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)} className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white">
              <option value="">Import a preset...</option>
              {habitPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">
                <FiUsers /> {selectedPresetMemberIds.length === editableMembers.length ? 'Apply to all' : `${selectedPresetMemberIds.length} selected`}
              </summary>
              <div className="absolute left-0 top-11 z-20 max-h-72 w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-slate-900">
                <button type="button" onClick={() => setPresetMemberIds(selectedPresetMemberIds.length === editableMembers.length ? [] : null)} className="mb-2 w-full rounded-lg bg-violet-50 px-3 py-2 text-left text-xs font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                  {selectedPresetMemberIds.length === editableMembers.length ? 'Clear selection' : `Apply to all editable ${memberLabelPlural}`}
                </button>
                {editableMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={selectedPresetMemberIds.includes(member.id)}
                      onChange={() => {
                        const current = presetMemberIds === null ? editableMembers.map((item) => item.id) : presetMemberIds;
                        setPresetMemberIds(current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id]);
                      }}
                    />
                    {member.username}
                  </label>
                ))}
              </div>
            </details>
            <button type="button" onClick={() => applyPreset(false)} disabled={!selectedPresetId || !selectedPresetMemberIds.length || applyingPreset} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-950">
              <FiDownload /> Import
            </button>
            <button type="button" onClick={() => applyPreset(true)} disabled={!selectedPresetId || !selectedPresetMemberIds.length || applyingPreset} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-2 text-xs font-bold text-white shadow disabled:opacity-40">
              <HiOutlineSparkles /> {applyingPreset ? 'Matching...' : 'AI match goals'}
            </button>
            {!isFootballWorkspace ? <button type="button" onClick={generateTestGoals} disabled={!selectedPresetMemberIds.length || generatingTestGoals} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 shadow-sm disabled:opacity-40 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
              <HiOutlineSparkles /> {generatingTestGoals ? 'Generating 5 each...' : 'Generate 5 test goals each'}
            </button> : null}
          </div>
          {goalSeedMessage && <p className="mt-2 text-xs font-semibold text-violet-700 dark:text-cyan-200">{goalSeedMessage}</p>}
        </div>

        <ChallengeCoveragePanel
          coverage={coverage}
          aiProgress={aiProgress}
          canRetryAi={isEditingHabits && !!lastAiRequest}
          selectedRetryCount={selectedRetryMemberIds.length}
          retrying={retryingHabits}
          onRetrySelected={() => retryAiHabits()}
          onSelectMissing={() => setSelectedRetryMemberIds(coverage.missingMembers.map((member) => member.id))}
          onSelectAll={() => setSelectedRetryMemberIds(studentMembers.map((member) => member.id))}
          onClearSelection={() => setSelectedRetryMemberIds([])}
          retryMessage={retryMessage}
          memberLabel={memberLabel}
          memberLabelPlural={memberLabelPlural}
        />

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <ChallengeMemberHabitsPanel
            isEditingHabits={isEditingHabits}
            memberHabits={memberHabits}
            lockedHabits={lockedHabits}
            expandAllMembersInModal={expandAllMembersInModal}
            collapseAllMembersInModal={collapseAllMembersInModal}
            groupMembers={group?.members}
            collapsedMembersInModal={collapsedMembersInModal}
            editChallengeHabitsMode={editChallengeHabitsMode}
            lockedChallengeMemberIds={lockedChallengeMemberIds}
            toggleMemberCollapseInModal={toggleMemberCollapseInModal}
            setMemberHabits={setMemberHabits}
            schoolProfileMap={schoolProfileMap}
            selectedRetryMemberIds={selectedRetryMemberIds}
            onToggleRetryMember={toggleRetryMember}
            onRetryMember={(memberId) => retryAiHabits([memberId])}
            canRetryAi={isEditingHabits && !!lastAiRequest}
            retryingHabits={retryingHabits}
            workspaceType={isFootballWorkspace ? 'football' : 'school'}
          />

          <ChallengeFormPanel
            isEditingHabits={isEditingHabits}
            editChallengeHabitsMode={editChallengeHabitsMode}
            newChallenge={newChallenge}
            lockedHabits={lockedHabits}
            goBackToEditing={goBackToEditing}
            handleCreateChallenge={publishChallenge}
            groupMembers={studentMembers}
            coverage={coverage}
            workspaceType={isFootballWorkspace ? 'football' : 'school'}
            editor={(
              <form onSubmit={(event) => event.preventDefault()} className="space-y-6">
                {!editChallengeHabitsMode && (
                  <ChallengeSettingsSection
                    habitPresets={habitPresets}
                    handleLoadPreset={challengeHandleLoadPreset}
                    newChallenge={newChallenge}
                    setNewChallenge={setNewChallenge}
                    getDateString={getDateString}
                    groupCourses={groupCourses}
                    groupMembers={group?.members}
                    workspaceType={isFootballWorkspace ? 'football' : 'school'}
                  />
                )}

                <ChallengeHabitBuilder
                  groupId={group?.groupId}
                  currentHabit={currentHabit}
                  setCurrentHabit={setCurrentHabit}
                  editChallengeHabitsMode={editChallengeHabitsMode}
                  memberHabits={memberHabits}
                  lockedChallengeMemberIds={lockedChallengeMemberIds}
                  groupMembers={group?.members}
                  schoolProfileMap={schoolProfileMap}
                  setMemberHabits={setMemberHabits}
                  isChallengeValid={challengeIsChallengeValid}
                  getMissingMembers={challengeGetMissingMembers}
                  handleCancel={closeChallengeEditor}
                  hasHabitsAdded={hasHabitsAdded}
                  lockHabitsAndShowOverview={lockHabitsAndShowOverview}
                  onAiProgress={setAiProgress}
                  onAiGenerationComplete={setLastAiRequest}
                  workspaceType={isFootballWorkspace ? 'football' : 'school'}
                />
              </form>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default ChallengeEditorModal;
