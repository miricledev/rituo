import React from 'react';
import GroupProgressCharts from './GroupProgressCharts';
import MemberProgressSection from './MemberProgressSection';

const ActiveChallengeOverview = ({
  group,
  isLeader,
  membersNotInChallenge,
  setAddMembersToChallengeSelected,
  setShowAddMembersToChallengeModal,
  openEditChallengeHabitsModal,
  scheduledHabits,
  calculateScheduledAverageForDate,
  getDayName,
  formatDateLocal,
  calculateTodayScheduledProgress,
  groupId,
  timeUntilMidnight,
  collapsedMembers,
  toggleMemberCollapse,
  calculateMemberCompletionRate,
  calculateTodayCompletionRate,
  isHabitAvailableToday,
  getPercentageColor,
  getNextAvailableDay
}) => {
  if (!group?.activeChallenge) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Active Challenge</h2>
      <div className="border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
            <div>
              <p className="text-gray-600 dark:text-gray-400">
                Start Date: {new Date(group.activeChallenge.startDate).toLocaleDateString()}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                End Date: {new Date(group.activeChallenge.endDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Status: {group.activeChallenge.status}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">
                Today&apos;s Date: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          {isLeader && (
            <div className="flex flex-wrap items-center gap-2">
              {membersNotInChallenge.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAddMembersToChallengeSelected([]);
                    setShowAddMembersToChallengeModal(true);
                  }}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
                >
                  Add members to challenge
                </button>
              )}
              <button
                type="button"
                onClick={openEditChallengeHabitsModal}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium"
              >
                Set habits
              </button>
            </div>
          )}
        </div>

        <GroupProgressCharts
          isLeader={isLeader}
          group={group}
          scheduledHabits={scheduledHabits}
          calculateScheduledAverageForDate={calculateScheduledAverageForDate}
          getDayName={getDayName}
          formatDateLocal={formatDateLocal}
          calculateTodayScheduledProgress={calculateTodayScheduledProgress}
        />

        <MemberProgressSection
          isLeader={isLeader}
          group={group}
          groupId={groupId}
          timeUntilMidnight={timeUntilMidnight}
          collapsedMembers={collapsedMembers}
          toggleMemberCollapse={toggleMemberCollapse}
          calculateMemberCompletionRate={calculateMemberCompletionRate}
          calculateTodayCompletionRate={calculateTodayCompletionRate}
          isHabitAvailableToday={isHabitAvailableToday}
          getPercentageColor={getPercentageColor}
          getNextAvailableDay={getNextAvailableDay}
        />
      </div>
    </div>
  );
};

export default ActiveChallengeOverview;
