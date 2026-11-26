import React from 'react';
import { FiCalendar, FiEdit3, FiUserPlus } from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import GroupProgressCharts from './GroupProgressCharts';
import MemberProgressSection from './MemberProgressSection';

const ActiveChallengeOverview = ({
  group,
  isLeader,
  membersNotInChallenge,
  setAddMembersToChallengeSelected,
  setShowAddMembersToChallengeModal,
  openEditChallengeHabitsModal,
  calculateScheduledAverageForDate,
  getDayName,
  formatDateLocal,
  calculateTodayScheduledProgress,
  groupId,
  timeUntilMidnight,
  collapsedMembers,
  toggleMemberCollapse,
  calculateTodayCompletionRate,
  isHabitAvailableToday,
  getPercentageColor,
  getNextAvailableDay,
  workspaceType = 'school'
}) => {
  const isFootballWorkspace = workspaceType === 'football';
  if (!group?.activeChallenge) {
    return (
      <section className="mb-8 overflow-hidden rounded-[2rem] border border-dashed border-slate-300 bg-white/90 p-5 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.035] sm:p-7">
        <img src="/images/empty-states/no-challenge.webp" alt="An Inner Performance pathway waiting for the next challenge" className="mx-auto h-48 w-full max-w-xl rounded-[1.5rem] object-cover shadow-lg dark:opacity-90" />
        <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">Between challenges</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">No active challenge right now</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">This workspace is ready for the next focused programme. Existing history and {isFootballWorkspace ? 'client' : 'student'} progress remain available.</p>
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-500/20">
          <HiOutlineSparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">Live programme</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Active Challenge</h2>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-black/10 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><FiCalendar /> Challenge window</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {new Date(group.activeChallenge.startDate).toLocaleDateString()} — {new Date(group.activeChallenge.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold capitalize text-emerald-700 dark:text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                {group.activeChallenge.status}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Today</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{new Date().toLocaleDateString()}</p>
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
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/15 transition hover:-translate-y-0.5"
                >
                  <FiUserPlus className="h-4 w-4" />
                  Add members to challenge
                </button>
              )}
              <button
                type="button"
                onClick={openEditChallengeHabitsModal}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200 dark:hover:text-cyan-200"
              >
                <FiEdit3 className="h-4 w-4" />
                Set habits
              </button>
            </div>
          )}
        </div>

        <GroupProgressCharts
          isLeader={isLeader}
          group={group}
          calculateScheduledAverageForDate={calculateScheduledAverageForDate}
          getDayName={getDayName}
          formatDateLocal={formatDateLocal}
          calculateTodayScheduledProgress={calculateTodayScheduledProgress}
          workspaceType={workspaceType}
        />

        <MemberProgressSection
          isLeader={isLeader}
          group={group}
          groupId={groupId}
          timeUntilMidnight={timeUntilMidnight}
          collapsedMembers={collapsedMembers}
          toggleMemberCollapse={toggleMemberCollapse}
          calculateTodayCompletionRate={calculateTodayCompletionRate}
          isHabitAvailableToday={isHabitAvailableToday}
          getPercentageColor={getPercentageColor}
          getNextAvailableDay={getNextAvailableDay}
        />
      </div>
    </section>
  );
};

export default ActiveChallengeOverview;
