import React from 'react';
import { Link } from 'react-router-dom';
import HabitStatusCard from './HabitStatusCard';

const MemberProgressSection = ({
  isLeader,
  group,
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
  if (!isLeader || !group?.activeChallenge) {
    return null;
  }

  return (
    <div className="mt-6 sm:mt-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-lg sm:text-xl font-semibold">Member Progress</h3>
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 dark:text-blue-400">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
            {timeUntilMidnight}
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400">until reset</span>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4 italic">
        Click on a member&apos;s name to view their individual stats
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {(group.activeChallenge.memberHabits || []).map((memberHabit, index) => {
          const member = group.members?.find((m) =>
            String(m.id) === String(memberHabit.member) ||
            String(m.id) === String(memberHabit.member?.id)
          );
          const memberId = member?.id || memberHabit.member;
          const isCollapsed = collapsedMembers[memberId];
          const completionRate = calculateMemberCompletionRate(memberHabit);
          const todayCompletionRate = calculateTodayCompletionRate(memberHabit, isHabitAvailableToday);
          const hasCombatHabits = (memberHabit.habits || []).some((habit) => habit.combatType === 'attack' || habit.combatType === 'defence');
          const attackHabits = (memberHabit.habits || []).filter((habit) => habit.combatType === 'attack' || (!habit.combatType && !hasCombatHabits));
          const defenceHabits = (memberHabit.habits || []).filter((habit) => habit.combatType === 'defence');

          return (
            <div
              key={index}
              className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg border border-gray-200 dark:border-secondary-700 p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 transition-transform transform hover:scale-[1.02] hover:shadow-2xl group"
            >
              <div className="flex items-center gap-2 sm:gap-4 mb-2">
                <Link to={`/groups/${groupId}/member/${memberId}`} className="flex items-center gap-3 sm:gap-4 flex-1 hover:opacity-80 transition-opacity">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xl font-bold text-primary-700 dark:text-primary-200 group-hover:ring-4 group-hover:ring-primary-200/40">
                    {member?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-lg text-primary-600 dark:text-primary-300 truncate">
                        {member?.username || 'Unknown Member'}
                      </div>
                      <svg className="w-4 h-4 text-primary-500 dark:text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="text-xs text-secondary-500 dark:text-secondary-400 truncate">
                      {member?.email || ''}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {completionRate.toFixed(0)}% Complete
                    </div>
                  </div>
                </Link>
                <div className="flex flex-col items-center mr-1 sm:mr-3">
                  <div className={`text-3xl sm:text-5xl font-bold ${getPercentageColor(todayCompletionRate)}`}>
                    {todayCompletionRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">today</div>
                </div>
                <button
                  onClick={() => toggleMemberCollapse(memberId)}
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-secondary-700 transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                  aria-label={isCollapsed ? 'Expand habits' : 'Collapse habits'}
                >
                  <svg
                    className={`w-6 h-6 text-gray-600 dark:text-gray-300 transition-all duration-200 ${
                      isCollapsed ? 'rotate-180' : ''
                    }`}
                    style={{ filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className={`space-y-3 mt-2 transition-all duration-300 ease-in-out overflow-hidden ${
                isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
              }`}>
                {hasCombatHabits ? (
                  <div className="space-y-4">
                    {attackHabits.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path d="M21 3l-1 1M3 21l1-1M21 3l-10 10M3 21l10-10M9 3l3 3M15 21l-3-3M21 9l-3 3M3 15l3-3M21 21l-1-1M3 3l1 1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Attack Habits
                        </h4>
                        <div className="space-y-2">
                          {attackHabits.map((habit, habitIndex) => (
                            <HabitStatusCard
                              key={habitIndex}
                              cardKey={habitIndex}
                              habit={habit}
                              isHabitAvailableToday={isHabitAvailableToday}
                              getNextAvailableDay={getNextAvailableDay}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {defenceHabits.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Defence Habits
                        </h4>
                        <div className="space-y-2">
                          {defenceHabits.map((habit, habitIndex) => (
                            <HabitStatusCard
                              key={habitIndex}
                              cardKey={habitIndex}
                              habit={habit}
                              isHabitAvailableToday={isHabitAvailableToday}
                              getNextAvailableDay={getNextAvailableDay}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  (memberHabit.habits || []).map((habit, habitIndex) => (
                    <HabitStatusCard
                      key={habitIndex}
                      cardKey={habitIndex}
                      habit={habit}
                      isHabitAvailableToday={isHabitAvailableToday}
                      getNextAvailableDay={getNextAvailableDay}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MemberProgressSection;
