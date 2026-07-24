import React from 'react';
import ChallengeMemberHabitsPanel from './ChallengeMemberHabitsPanel';
import ChallengeFormPanel from './ChallengeFormPanel';
import ChallengeSettingsSection from './ChallengeSettingsSection';
import ChallengeHabitBuilder from './ChallengeHabitBuilder';

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
  lockHabitsAndShowOverview
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-secondary-800 rounded-lg w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900 dark:text-white">
              {editChallengeHabitsMode ? 'Edit challenge habits' : 'Create New Challenge'}
            </h2>
            {hasHabitsAdded && (
              <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>Unsaved changes</span>
              </div>
            )}
          </div>
        </div>

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
          />

          <ChallengeFormPanel
            isEditingHabits={isEditingHabits}
            editChallengeHabitsMode={editChallengeHabitsMode}
            newChallenge={newChallenge}
            lockedHabits={lockedHabits}
            goBackToEditing={goBackToEditing}
            handleCreateChallenge={challengeHandleCreateChallenge}
            editor={(
              <form onSubmit={challengeHandleCreateChallenge} className="space-y-6">
                {editChallengeHabitsMode && habitPresets.length > 0 && (
                  <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <label className="block text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      Load preset for new members only
                    </label>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                      Applies only to editable (newly added) members. Existing challenge members are not changed.
                    </p>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          challengeHandleLoadPreset(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 text-secondary-900 dark:text-white"
                    >
                      <option value="">Choose preset...</option>
                      {habitPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {!editChallengeHabitsMode && (
                  <ChallengeSettingsSection
                    habitPresets={habitPresets}
                    handleLoadPreset={challengeHandleLoadPreset}
                    newChallenge={newChallenge}
                    setNewChallenge={setNewChallenge}
                    getDateString={getDateString}
                    groupCourses={groupCourses}
                    groupMembers={group?.members}
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
                  handleCancel={handleCancel}
                  hasHabitsAdded={hasHabitsAdded}
                  lockHabitsAndShowOverview={lockHabitsAndShowOverview}
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
