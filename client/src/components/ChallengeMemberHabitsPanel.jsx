import { DAY_NAMES } from '../utils/habitScheduleUtils';

const WEEK_DAYS = DAY_NAMES;

const ChallengeMemberHabitsPanel = ({
  isEditingHabits,
  memberHabits,
  lockedHabits,
  expandAllMembersInModal,
  collapseAllMembersInModal,
  groupMembers,
  collapsedMembersInModal,
  editChallengeHabitsMode,
  lockedChallengeMemberIds,
  toggleMemberCollapseInModal,
  setMemberHabits,
  schoolProfileMap,
  selectedRetryMemberIds = [],
  onToggleRetryMember,
  onRetryMember,
  canRetryAi,
  retryingHabits,
  workspaceType = 'school'
}) => {
  const isFootballWorkspace = workspaceType === 'football';
  const memberLabel = isFootballWorkspace ? 'client' : 'student';
  const habitsToShow = isEditingHabits ? memberHabits : lockedHabits;
  const totalHabits = Object.values(habitsToShow).flat().length;
  const studentMembers = (groupMembers || []).filter((member) => !member.accountRole || member.accountRole === 'student');

  const removeHabit = (memberId, habitIndex) => {
    const nextMemberHabits = { ...memberHabits };
    nextMemberHabits[memberId] = nextMemberHabits[memberId].filter((_, idx) => idx !== habitIndex);
    if (nextMemberHabits[memberId].length === 0) {
      delete nextMemberHabits[memberId];
    }
    setMemberHabits(nextMemberHabits);
  };

  const updateHabit = (memberId, habitIndex, patch) => {
    const nextMemberHabits = { ...memberHabits };
    nextMemberHabits[memberId] = (nextMemberHabits[memberId] || []).map((habit, index) => (
      index === habitIndex ? { ...habit, ...patch } : habit
    ));
    setMemberHabits(nextMemberHabits);
  };

  return (
    <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-y-auto max-h-96 lg:max-h-none">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
          {isEditingHabits ? 'Assigned Habits' : 'Challenge Overview'}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {totalHabits} total habits
          </span>
          {isEditingHabits && Object.keys(memberHabits).length > 1 && (
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={expandAllMembersInModal}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Expand all"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={collapseAllMembersInModal}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Collapse all"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m16 0l-4-4m4 4l-4 4" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <details className="mb-4 overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/70 dark:border-violet-400/20 dark:bg-violet-500/5">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-violet-800 dark:text-violet-200">
          Open quick review table
        </summary>
        <div className="overflow-x-auto border-t border-violet-200 dark:border-violet-400/20">
          <table className="min-w-[920px] w-full text-left text-xs">
            <thead className="bg-white/70 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50">
              <tr>
                <th className="px-3 py-2">{isFootballWorkspace ? 'Client' : 'Student'}</th>
                <th className="px-3 py-2">Habit</th>
                <th className="px-3 py-2">Minutes</th>
                <th className="px-3 py-2">Purpose</th>
                <th className="px-3 py-2">Goal link</th>
                <th className="px-3 py-2">Schedule</th>
                <th className="px-3 py-2">AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-100 dark:divide-white/5">
              {studentMembers.flatMap((member) => {
                const memberId = String(member.id);
                const habits = habitsToShow[memberId] || [];
                const isLocked = editChallengeHabitsMode && lockedChallengeMemberIds.has(memberId);
                if (!habits.length) {
                  return [(
                    <tr key={`${memberId}-missing`} className="bg-rose-50/60 dark:bg-rose-500/5">
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{member.username}</td>
                      <td colSpan="5" className="px-3 py-3 font-semibold text-rose-600 dark:text-rose-300">No habit assigned</td>
                      <td className="px-3 py-3">
                        <button type="button" disabled={!canRetryAi || retryingHabits} onClick={() => onRetryMember?.(member.id)} className="rounded-lg border border-violet-200 px-2 py-1 font-bold text-violet-700 disabled:opacity-40 dark:border-violet-400/20 dark:text-violet-200">
                          Retry
                        </button>
                      </td>
                    </tr>
                  )];
                }
                return habits.map((habit, habitIndex) => (
                  <tr key={`${memberId}-${habitIndex}`} className="bg-white/55 dark:bg-slate-950/20">
                    <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{member.username}</td>
                    <td className="px-3 py-3">
                      {isEditingHabits && !isLocked ? (
                        <input value={habit.name || ''} onChange={(event) => updateHabit(memberId, habitIndex, { name: event.target.value })} className="w-52 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white" />
                      ) : (
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{habit.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isEditingHabits && !isLocked ? (
                        <input type="number" min="1" max="240" value={habit.durationMinutes || 30} onChange={(event) => updateHabit(memberId, habitIndex, { durationMinutes: Number(event.target.value) || 1 })} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-slate-900 dark:text-white" />
                      ) : (
                        habit.durationMinutes || 30
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isEditingHabits && !isLocked ? (
                        <select value={habit.combatType || 'attack'} onChange={(event) => updateHabit(memberId, habitIndex, { combatType: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                          <option value="attack">Attack</option>
                          <option value="defence">Defence</option>
                        </select>
                      ) : (
                        <span className="capitalize">{habit.combatType}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isEditingHabits && !isLocked ? (
                        <select value={habit.linkedGoalId || ''} onChange={(event) => updateHabit(memberId, habitIndex, { linkedGoalId: event.target.value || null })} className="w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                          <option value="">No linked goal</option>
                          {(schoolProfileMap?.[memberId]?.goals || []).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                        </select>
                      ) : (
                        (schoolProfileMap?.[memberId]?.goals || []).find((goal) => String(goal.id) === String(habit.linkedGoalId))?.title || 'Not linked'
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{habit.scheduleDays?.length || 0} days</td>
                    <td className="px-3 py-3">
                      <button type="button" disabled={!canRetryAi || retryingHabits} onClick={() => onRetryMember?.(member.id)} className="rounded-lg border border-violet-200 px-2 py-1 font-bold text-violet-700 disabled:opacity-40 dark:border-violet-400/20 dark:text-violet-200">
                        Retry {memberLabel}
                      </button>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </details>

      {!studentMembers.length ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👥</div>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            {isEditingHabits ? 'No habits assigned yet' : 'No habits in overview'}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {isEditingHabits ? 'Add habits and assign them to members' : 'Go back to editing to add habits'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {studentMembers.map((member) => {
            const memberId = String(member.id);
            const habits = habitsToShow[memberId] || [];
            const isCollapsed = collapsedMembersInModal[memberId];
            const isLocked = editChallengeHabitsMode && lockedChallengeMemberIds.has(String(memberId));

            return (
              <div key={memberId} className={`rounded-lg border ${isLocked ? 'bg-gray-100 dark:bg-gray-800 border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                <div
                  className={`flex items-center gap-3 p-4 ${isEditingHabits && !isLocked ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors' : ''}`}
                  onClick={isEditingHabits && !isLocked ? () => toggleMemberCollapseInModal(memberId) : undefined}
                >
                  {isEditingHabits && !isLocked && (
                    <button type="button" className="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <svg
                        className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  {isLocked ? (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center" title="Locked - already in challenge">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200 flex-shrink-0">
                      {member?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-secondary-900 dark:text-white">
                      {member?.username || 'Unknown Member'}
                      {isLocked && <span className="ml-1.5 text-amber-600 dark:text-amber-400 text-xs font-normal">(locked)</span>}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{habits.length} habit{habits.length !== 1 ? 's' : ''}</p>
                  </div>
                  {canRetryAi && (
                    <input
                      type="checkbox"
                      checked={selectedRetryMemberIds.includes(member.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onToggleRetryMember?.(member.id)}
                      className="h-4 w-4 accent-violet-600"
                      title="Select for AI regeneration"
                    />
                  )}
                  {canRetryAi && (
                    <button
                      type="button"
                      disabled={retryingHabits}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRetryMember?.(member.id);
                      }}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-[10px] font-bold text-violet-700 disabled:opacity-40 dark:border-violet-400/20 dark:text-violet-200"
                    >
                      Retry AI
                    </button>
                  )}
                  {!isEditingHabits && (
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        ✓ Locked
                      </span>
                    </div>
                  )}
                  {isLocked && isEditingHabits && (
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Locked
                      </span>
                    </div>
                  )}
                </div>

                <div className={`px-4 pb-4 transition-all duration-300 ease-in-out overflow-hidden ${isEditingHabits && !isLocked && isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
                  <div className="space-y-2">
                    {!habits.length && (
                      <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                        No habits assigned. Select this {memberLabel} and retry AI, or add a habit manually.
                      </div>
                    )}
                    {habits.map((habit, habitIndex) => (
                      <div key={habitIndex} className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-sm text-secondary-900 dark:text-white">{habit.name}</h5>
                            {habit.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{habit.description}</p>
                            )}
                            {isEditingHabits && !isLocked && (
                              <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/55 sm:grid-cols-2">
                                <input
                                  value={habit.name || ''}
                                  onChange={(event) => updateHabit(memberId, habitIndex, { name: event.target.value })}
                                  placeholder="Habit name"
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                />
                                <input
                                  type="number"
                                  min="1"
                                  max="240"
                                  value={habit.durationMinutes || 30}
                                  onChange={(event) => updateHabit(memberId, habitIndex, { durationMinutes: Number(event.target.value) || 1 })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                  title="Estimated minutes"
                                />
                                <select
                                  value={habit.combatType || 'attack'}
                                  onChange={(event) => updateHabit(memberId, habitIndex, { combatType: event.target.value })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                >
                                  <option value="attack">Attack</option>
                                  <option value="defence">Defence</option>
                                </select>
                                <select
                                  value={habit.linkedGoalId || ''}
                                  onChange={(event) => updateHabit(memberId, habitIndex, { linkedGoalId: event.target.value || null })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                >
                                  <option value="">No linked goal</option>
                                  {(schoolProfileMap?.[memberId]?.goals || []).map((goal) => (
                                    <option key={goal.id} value={goal.id}>{goal.title}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                {habit.habitType === 'boolean' ? 'Checkbox' : habit.habitType === 'numeric' ? 'Numeric' : habit.habitType === 'periodic' ? 'Periodic' : 'Text'}
                              </span>
                              {habit.habitType === 'numeric' && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{habit.minValue} - {habit.maxValue}</span>
                              )}
                              {habit.combatType === 'attack' && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                                    <path d="M21 3l-1 1M3 21l1-1M21 3l-10 10M3 21l10-10M9 3l3 3M15 21l-3-3M21 9l-3 3M3 15l3-3M21 21l-1-1M3 3l1 1" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Attack
                                </span>
                              )}
                              {habit.combatType === 'defence' && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Defence
                                </span>
                              )}
                              {habit.habitType === 'periodic' && (
                                <span className="rounded bg-cyan-100 px-2 py-1 text-xs text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200">
                                  {habit.periodicOccurrences || 4} times · every {habit.periodicIntervalHours || 4}h{habit.allowOverlap ? ' · may overlap' : ''}
                                </span>
                              )}
                              {habit.linkedGoalId && (
                                <span className="rounded bg-violet-100 px-2 py-1 text-xs text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                                  Goal: {(schoolProfileMap?.[String(memberId)]?.goals || []).find((goal) => String(goal.id) === String(habit.linkedGoalId))?.title || 'Linked goal'}
                                </span>
                              )}
                              <div className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-300">
                                Estimated time: {habit.durationMinutes || 30} minutes
                              </div>
                              {habit.scheduleDays && habit.scheduleDays.length > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded text-xs">
                                  <span className="text-gray-600 dark:text-gray-400 mr-1">Days:</span>
                                  {WEEK_DAYS.map((day) => {
                                    const isScheduled = habit.scheduleDays.includes(day);
                                    return (
                                      <span
                                        key={day}
                                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-medium transition-colors cursor-help ${isScheduled ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}
                                        title={day}
                                      >
                                        {day[0]}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          {isEditingHabits && !isLocked && (
                            <button
                              type="button"
                              onClick={() => removeHabit(memberId, habitIndex)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChallengeMemberHabitsPanel;
