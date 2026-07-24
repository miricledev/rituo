import { useState } from 'react';
import axios from 'axios';
import { DAY_NAMES } from '../utils/habitScheduleUtils';

const DAY_OPTIONS = DAY_NAMES;
const DEFAULT_SCHEDULE = [...DAY_NAMES];

const sameDays = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

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
  lockHabitsAndShowOverview
}) => {
  const [aiBrief, setAiBrief] = useState('');
  const [generatingHabits, setGeneratingHabits] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  const updateCurrentHabit = (patch) => {
    setCurrentHabit({ ...currentHabit, ...patch });
  };

  const resetCurrentHabit = () => {
    setCurrentHabit({
      name: '',
      description: '',
      habitType: 'boolean',
      minValue: 0,
      maxValue: 10,
      prompt: '',
      assignedMembers: [],
      applyToAll: false,
      scheduleDays: DEFAULT_SCHEDULE,
      durationMinutes: 30,
      combatType: 'neutral',
      linkedGoalIds: {}
    });
  };

  const addHabit = () => {
    if (!currentHabit.name.trim() || currentHabit.assignedMembers.length === 0) {
      return;
    }

    const nextMemberHabits = { ...memberHabits };
    currentHabit.assignedMembers.forEach((memberId) => {
      if (!nextMemberHabits[memberId]) {
        nextMemberHabits[memberId] = [];
      }
      nextMemberHabits[memberId].push({
        name: currentHabit.name,
        description: currentHabit.description,
        habitType: currentHabit.habitType,
        minValue: currentHabit.minValue,
        maxValue: currentHabit.maxValue,
        prompt: currentHabit.prompt,
        scheduleDays: currentHabit.scheduleDays,
        durationMinutes: Number(currentHabit.durationMinutes) || 30,
        combatType: currentHabit.combatType,
        linkedGoalId: currentHabit.linkedGoalIds?.[memberId] || null
      });
    });

    setMemberHabits(nextMemberHabits);
    resetCurrentHabit();
  };

  const editableMembers = editChallengeHabitsMode
    ? Object.keys(memberHabits)
      .map((id) => groupMembers?.find((member) => String(member.id) === id))
      .filter(Boolean)
    : (groupMembers || []);

  const generateHabits = async () => {
    const targetMembers = editableMembers
      .filter((member) => !editChallengeHabitsMode || !lockedChallengeMemberIds.has(String(member.id)))
      .map((member) => member.id);
    if (!aiBrief.trim() || !targetMembers.length) {
      setAiMessage('Add a brief and make sure there are editable students.');
      return;
    }

    try {
      setGeneratingHabits(true);
      setAiMessage('');
      const response = await axios.post(`/groups/${groupId}/ai-habits`, { text: aiBrief });
      const generated = response.data?.draft?.habits || [];
      setMemberHabits((previous) => {
        const next = { ...previous };
        targetMembers.forEach((memberId) => {
          next[memberId] = [
            ...(next[memberId] || []),
            ...generated.map((habit) => ({ ...habit, linkedGoalId: null }))
          ];
        });
        return next;
      });
      setAiMessage(`${generated.length} habits added to ${targetMembers.length} student${targetMembers.length === 1 ? '' : 's'}.`);
      setAiBrief('');
    } catch (error) {
      setAiMessage(error.response?.data?.error || 'OpenAI could not generate habits.');
    } finally {
      setGeneratingHabits(false);
    }
  };

  return (
    <>
      <div className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50 p-5 dark:border-violet-800 dark:from-violet-950/40 dark:to-cyan-950/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600 dark:text-violet-300">OpenAI habit studio</p>
            <h3 className="mt-1 text-lg font-semibold text-secondary-900 dark:text-white">Describe the outcome, not every field</h3>
            <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">
              Paste notes, expectations, or a rough programme. Estimated times and schedules are included automatically.
            </p>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm dark:bg-secondary-900/70 dark:text-violet-200">AI draft</span>
        </div>
        <textarea
          value={aiBrief}
          onChange={(event) => setAiBrief(event.target.value)}
          rows={6}
          maxLength={8000}
          placeholder="Example: Build a weekday morning routine focused on arriving prepared, reading for 20 minutes, and a short evening reflection..."
          className="mt-4 w-full rounded-xl border border-violet-200 bg-white/90 px-4 py-3 text-sm text-secondary-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-violet-800 dark:bg-secondary-900/80 dark:text-white dark:focus:ring-violet-900"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-secondary-500 dark:text-secondary-400">Generated habits apply to all editable students and can be changed before saving.</p>
          <button
            type="button"
            onClick={generateHabits}
            disabled={generatingHabits || aiBrief.trim().length < 10}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generatingHabits ? 'Generating...' : 'Generate habits'}
          </button>
        </div>
        {aiMessage && <p className="mt-3 text-sm font-medium text-violet-700 dark:text-violet-200">{aiMessage}</p>}
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Add New Habit</h3>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Habit Name</label>
              <input
                type="text"
                value={currentHabit.name}
                onChange={(e) => updateCurrentHabit({ name: e.target.value })}
                placeholder="e.g., Drink 8 glasses of water"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (Optional)</label>
              <input
                type="text"
                value={currentHabit.description}
                onChange={(e) => updateCurrentHabit({ description: e.target.value })}
                placeholder="Brief description of the habit"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estimated completion time</label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="240"
                  step="5"
                  value={currentHabit.durationMinutes || 30}
                  onChange={(event) => updateCurrentHabit({ durationMinutes: Number(event.target.value) || 30 })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                  required
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500 dark:text-gray-300">minutes</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Habit Type</label>
            <div className="grid grid-cols-1 gap-3">
              {[
                ['boolean', 'Checkbox', 'Simple yes/no completion'],
                ['numeric', 'Numeric Range', 'Track numbers with min/max values'],
                ['text', 'Text Entry', 'Written response or journal entry']
              ].map(([value, title, description]) => (
                <label key={value} className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <input
                    type="radio"
                    name="habit-type"
                    value={value}
                    checked={currentHabit.habitType === value}
                    onChange={(e) => updateCurrentHabit({ habitType: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-secondary-900 dark:text-white">{title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Assign to Members</label>
            <div className="mb-4">
              <label className={`flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors ${editChallengeHabitsMode ? '' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={currentHabit.applyToAll}
                  onChange={(e) => {
                    const applyToAll = e.target.checked;
                    const membersToAssign = editChallengeHabitsMode
                      ? editableMembers.filter((member) => !lockedChallengeMemberIds.has(String(member.id))).map((member) => member.id)
                      : editableMembers.map((member) => member.id);
                    updateCurrentHabit({
                      applyToAll,
                      assignedMembers: applyToAll ? membersToAssign : []
                    });
                  }}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <div className="font-medium text-secondary-900 dark:text-white">
                    Apply to All {editChallengeHabitsMode ? 'Editable Members' : 'Members'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {editChallengeHabitsMode ? 'Assign this habit to all members you can edit (newly added)' : 'Assign this habit to all group members'}
                  </div>
                </div>
              </label>
            </div>

            {!currentHabit.applyToAll && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {editableMembers.map((member) => {
                  const memberIdStr = String(member.id);
                  const isMemberLocked = editChallengeHabitsMode && lockedChallengeMemberIds.has(memberIdStr);
                  return (
                    <label
                      key={member.id}
                      className={`flex items-center gap-3 p-2 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors ${isMemberLocked ? 'opacity-75 bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                    >
                      <input
                        type="checkbox"
                        checked={currentHabit.assignedMembers.includes(member.id)}
                        onChange={(e) => {
                          if (isMemberLocked) return;
                          const isChecked = e.target.checked;
                          updateCurrentHabit({
                            assignedMembers: isChecked
                              ? [...currentHabit.assignedMembers, member.id]
                              : currentHabit.assignedMembers.filter((id) => id !== member.id)
                          });
                        }}
                        disabled={isMemberLocked}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-200">
                          {member.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium text-secondary-900 dark:text-white">{member.username}</span>
                        {isMemberLocked && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            Locked
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {!currentHabit.applyToAll && currentHabit.assignedMembers.length === 0 && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                Please select at least one member or choose "Apply to All Members"
              </p>
            )}

            {currentHabit.assignedMembers.length > 0 && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Link habit to a goal</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose the goal each student should see behind this habit.</p>
                </div>
                {currentHabit.assignedMembers.map((memberId) => {
                  const member = groupMembers?.find((groupMember) => String(groupMember.id) === String(memberId));
                  const goals = schoolProfileMap[String(memberId)]?.goals || [];
                  return (
                    <div key={`goal-link-${memberId}`} className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-3 items-center">
                      <div className="text-sm font-medium text-secondary-900 dark:text-white">{member?.username || `Member ${memberId}`}</div>
                      <select
                        value={currentHabit.linkedGoalIds?.[memberId] || ''}
                        onChange={(e) => updateCurrentHabit({
                          linkedGoalIds: {
                            ...(currentHabit.linkedGoalIds || {}),
                            [memberId]: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">No linked goal</option>
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>{goal.title}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Schedule Days</label>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => updateCurrentHabit({ scheduleDays: DEFAULT_SCHEDULE })}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${currentHabit.scheduleDays.length === 7 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
              >
                Everyday
              </button>
              <button
                type="button"
                onClick={() => updateCurrentHabit({ scheduleDays: ['Monday', 'Wednesday', 'Friday'] })}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${sameDays(currentHabit.scheduleDays, ['Monday', 'Wednesday', 'Friday']) ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
              >
                Mon, Wed, Fri
              </button>
              <button
                type="button"
                onClick={() => updateCurrentHabit({ scheduleDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] })}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${sameDays(currentHabit.scheduleDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
              >
                Weekdays
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {DAY_OPTIONS.map((day) => (
                <label
                  key={day}
                  className={`flex flex-col items-center p-2 border rounded-lg cursor-pointer transition-colors ${currentHabit.scheduleDays.includes(day) ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                >
                  <input
                    type="checkbox"
                    checked={currentHabit.scheduleDays.includes(day)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateCurrentHabit({ scheduleDays: [...currentHabit.scheduleDays, day] });
                      } else {
                        updateCurrentHabit({ scheduleDays: currentHabit.scheduleDays.filter((selectedDay) => selectedDay !== day) });
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="text-xs font-medium mt-1">{day.slice(0, 3)}</span>
                </label>
              ))}
            </div>

            {currentHabit.scheduleDays.length === 0 && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                Please select at least one day for the habit schedule
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Combat Type</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['attack', 'Attack', 'border-blue-500 bg-blue-50 dark:bg-blue-900/20', 'hover:border-blue-300 dark:hover:border-blue-700', 'text-blue-600 dark:text-blue-400'],
                ['defence', 'Defence', 'border-red-500 bg-red-50 dark:bg-red-900/20', 'hover:border-red-300 dark:hover:border-red-700', 'text-red-600 dark:text-red-400'],
                ['neutral', 'Neutral', 'border-gray-500 bg-gray-50 dark:bg-gray-700', 'hover:border-gray-400 dark:hover:border-gray-500', 'text-gray-600 dark:text-gray-300']
              ].map(([value, label, activeClasses, hoverClasses, activeText]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateCurrentHabit({ combatType: value })}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${currentHabit.combatType === value ? activeClasses : `border-gray-300 dark:border-gray-600 ${hoverClasses}`}`}
                >
                  <span className={`text-sm font-medium ${currentHabit.combatType === value ? activeText : 'text-gray-500 dark:text-gray-400'}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {currentHabit.habitType === 'numeric' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Minimum Value</label>
                <input
                  type="number"
                  value={currentHabit.minValue ?? ''}
                  onChange={(e) => updateCurrentHabit({ minValue: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Maximum Value</label>
                <input
                  type="number"
                  value={currentHabit.maxValue ?? ''}
                  onChange={(e) => updateCurrentHabit({ maxValue: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                  required
                />
              </div>
            </div>
          )}

          {currentHabit.habitType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prompt/Question</label>
              <input
                type="text"
                value={currentHabit.prompt}
                onChange={(e) => updateCurrentHabit({ prompt: e.target.value })}
                placeholder="e.g., What did you learn today?"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                required
              />
            </div>
          )}

          <button
            type="button"
            onClick={addHabit}
            disabled={!currentHabit.name.trim() || currentHabit.assignedMembers.length === 0}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add Habit to Challenge
          </button>
        </div>
      </div>

      {!isChallengeValid() && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-yellow-800 dark:text-yellow-200">Challenge Setup Incomplete</span>
          </div>
          <p className="text-yellow-700 dark:text-yellow-300 text-sm">
            {getMissingMembers().length > 0
              ? `${getMissingMembers().length} member(s) still need habits assigned: ${getMissingMembers().map((member) => member.username).join(', ')}`
              : 'All members need at least one habit assigned.'}
          </p>
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 gap-4">
        <button
          type="button"
          onClick={handleCancel}
          className={`px-6 py-2 rounded-lg transition-colors ${hasHabitsAdded ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
        >
          {hasHabitsAdded ? 'Cancel (Unsaved)' : 'Cancel'}
        </button>

        {Object.values(memberHabits).flat().length > 0 && (
          <button
            type="button"
            onClick={lockHabitsAndShowOverview}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg border-2 border-green-500"
          >
            ✓ Done Adding Habits
          </button>
        )}
      </div>
    </>
  );
};

export default ChallengeHabitBuilder;
