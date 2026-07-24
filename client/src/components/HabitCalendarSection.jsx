import React from 'react';

const HabitCalendarSection = ({
  activeTab,
  isLeader,
  group,
  myMemberHabit,
  renderLazyPanel,
  HabitCalendar
}) => {
  if (isLeader || activeTab !== 'calendar') {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">Habit Calendar</h2>
        <p className="text-secondary-600 dark:text-secondary-400 mb-4">
          View your habit completion calendar
        </p>
      </div>

      {group.activeChallenge && myMemberHabit ? (
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
          {renderLazyPanel(
            <HabitCalendar
              habits={myMemberHabit.habits}
              startDate={group.activeChallenge.startDate}
              endDate={group.activeChallenge.endDate}
              memberHabit={myMemberHabit}
            />
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-secondary-800 rounded-lg shadow-card">
          <div className="text-6xl mb-4">Calendar</div>
          <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
            No Active Challenge
          </h3>
          <p className="text-secondary-600 dark:text-secondary-400">
            Join an active challenge to see your habit completion calendar.
          </p>
        </div>
      )}
    </div>
  );
};

export default HabitCalendarSection;
