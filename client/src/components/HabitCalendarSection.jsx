import React from 'react';
import { FiCalendar } from 'react-icons/fi';
import DailyHabitPlanner from './DailyHabitPlanner';

const HabitCalendarSection = ({
  activeTab,
  isLeader,
  groupId,
  group,
  user,
  mySchoolProfile,
  myMemberHabit,
  renderLazyPanel,
  HabitCalendar
}) => {
  if (isLeader || activeTab !== 'calendar') {
    return null;
  }

  const isSchoolGroup = (group?.groupType || 'school') === 'school';
  const plannerProfile = mySchoolProfile || {
    student: user,
    linkedHabits: (myMemberHabit?.habits || []).map((habit, index) => ({
      ...habit,
      index: habit.index ?? index
    }))
  };

  return (
    <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:rounded-[2rem] sm:p-6">
      <div className="mb-3 px-2 pt-2 sm:mb-5 sm:px-0 sm:pt-0">
        <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isSchoolGroup ? 'text-violet-600 dark:text-cyan-300' : 'text-emerald-700 dark:text-emerald-300'}`}>My Planner</p>
        <h2 className="mb-2 mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:gap-3 sm:text-3xl">
          <FiCalendar className={isSchoolGroup ? 'text-violet-500 dark:text-cyan-300' : 'text-emerald-600 dark:text-emerald-300'} />
          Daily schedule
        </h2>
        <p className="hidden max-w-3xl text-slate-600 dark:text-slate-400 sm:block">
          {isSchoolGroup
            ? 'Arrange habits around lessons and commitments, or let AI build a realistic day for you.'
            : 'Arrange habits around training, matches, recovery and everyday commitments, or let AI build a realistic day for you.'}
        </p>
      </div>

      <DailyHabitPlanner
        groupId={groupId}
        profile={plannerProfile}
        canEdit
        schoolTimetable={isSchoolGroup ? (group?.schoolTimetable || []) : []}
        schoolDayConfig={isSchoolGroup ? (group?.schoolDayConfig || {}) : {}}
        activeChallenge={group?.activeChallenge || null}
        challengeMember={myMemberHabit || null}
        workspaceType={isSchoolGroup ? 'school' : 'football'}
      />
    </section>
  );
};

export default HabitCalendarSection;
