import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronDown, FiClock, FiShield, FiZap } from 'react-icons/fi';
import HabitStatusCard from './HabitStatusCard';

const MemberProgressSection = ({
  isLeader,
  group,
  groupId,
  timeUntilMidnight,
  collapsedMembers,
  toggleMemberCollapse,
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600 dark:text-cyan-300">People</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">Member Progress</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3.5 py-2 dark:border-cyan-400/20 dark:bg-cyan-400/10">
          <FiClock className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
          <span className="font-mono text-sm font-bold text-cyan-700 dark:text-cyan-200">
            {timeUntilMidnight}
          </span>
          <span className="text-xs text-cyan-600 dark:text-cyan-400">until reset</span>
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
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
          const todayCompletionRate = calculateTodayCompletionRate(memberHabit, isHabitAvailableToday);
          const hasCombatHabits = (memberHabit.habits || []).some((habit) => habit.combatType === 'attack' || habit.combatType === 'defence');
          const attackHabits = (memberHabit.habits || []).filter((habit) => habit.combatType === 'attack' || (!habit.combatType && !hasCombatHabits));
          const defenceHabits = (memberHabit.habits || []).filter((habit) => habit.combatType === 'defence');

          return (
            <div
              key={index}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/20 sm:gap-4 sm:p-5"
            >
              <div className="flex items-center gap-2 sm:gap-4 mb-2">
                <Link to={`/groups/${groupId}/member/${memberId}`} className="flex items-center gap-3 sm:gap-4 flex-1 hover:opacity-80 transition-opacity">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xl font-black text-white shadow-lg shadow-violet-500/20 transition group-hover:scale-105">
                    {member?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-lg font-bold text-slate-950 dark:text-white">
                        {member?.username || 'Unknown Member'}
                      </div>
                      <svg className="h-4 w-4 flex-shrink-0 text-violet-500 dark:text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {member?.email || ''}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Open verified challenge statistics</div>
                  </div>
                </Link>
                <div className="flex flex-col items-center mr-1 sm:mr-3">
                  <div className={`text-3xl sm:text-5xl font-bold ${getPercentageColor(todayCompletionRate)}`}>
                    {todayCompletionRate.toFixed(0)}%
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">today</div>
                </div>
                <button
                  onClick={() => toggleMemberCollapse(memberId)}
                  className="flex-shrink-0 rounded-xl border border-slate-200 bg-white/70 p-2 text-slate-500 transition-all hover:border-violet-300 hover:text-violet-600 active:scale-95 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:text-cyan-300"
                  aria-label={isCollapsed ? 'Expand habits' : 'Collapse habits'}
                >
                  <FiChevronDown
                    className={`h-5 w-5 transition-all duration-200 ${
                      isCollapsed ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
              <div className={`space-y-3 mt-2 transition-all duration-300 ease-in-out overflow-hidden ${
                isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
              }`}>
                {hasCombatHabits ? (
                  <div className="space-y-4">
                    {attackHabits.length > 0 && (
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-700 dark:text-cyan-300">
                          <FiZap className="h-4 w-4" />
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
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-300">
                          <FiShield className="h-4 w-4" />
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
