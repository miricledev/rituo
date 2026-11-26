import React from 'react';
import { FiActivity, FiCalendar, FiClock, FiTarget, FiUser } from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import ActiveChallengeOverview from './ActiveChallengeOverview';
import StudentChecklistSection from './StudentChecklistSection';

function FootballDashboardOverview(props) {
  const {
    activeTab,
    isLeader,
    group,
    myMemberHabit,
    setActiveTab,
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
    getNextAvailableDay,
    isMember,
    editingHabits,
    ticking,
    numericValues,
    textValues,
    tempNumericValues,
    tempTextValues,
    getLinkedGoalTitle,
    handleStartEdit,
    handleCancelEdit,
    handleToggleHabit,
    handleStudentNumericUpdate,
    handleStudentNumericSubmit,
    handleStudentTextUpdate,
    handleStudentTextSubmit,
    fetchGroupDetails,
    showPageToast
  } = props;

  if (activeTab !== 'overview') return null;

  const clients = (group?.members || []).filter((member) => String(member.id) !== String(group?.leader?.id));
  const clientHabits = myMemberHabit?.habits || [];
  const challengeStatus = group?.activeChallenge ? 'Programme live' : 'Between programmes';

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-emerald-200/70 bg-gradient-to-br from-[#061712] via-[#08251d] to-[#101846] p-5 text-white shadow-[0_28px_80px_rgba(5,46,36,0.26)] sm:rounded-[2rem] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] text-emerald-300 sm:text-xs">
              <HiOutlineSparkles className="h-4 w-4" /> Inner Performance Football
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
              {isLeader ? 'Your 1-to-1 client control room.' : 'Train the person behind the player.'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {isLeader
                ? 'Set the performance programme, monitor consistency and keep every coaching conversation connected to the client.'
                : 'See what is due, protect your habits and organise training, recovery and everyday commitments in one place.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(isLeader ? [
              [clients.length, clients.length === 1 ? 'Client' : 'Clients', FiUser],
              [group?.activeChallenge ? 'Live' : 'Ready', 'Programme', FiTarget],
              [group?.activeChallenge?.memberHabits?.reduce((total, member) => total + (member.habits?.length || 0), 0) || 0, 'Habits set', FiActivity]
            ] : [
              [clientHabits.length, 'Habits', FiActivity],
              [challengeStatus, 'Status', FiTarget],
              ['Synced', 'Planner', FiCalendar]
            ]).map(([value, label, Icon]) => (
              <div key={label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.07] px-2 py-3 backdrop-blur-sm sm:min-w-[7.5rem] sm:px-4">
                <Icon className="mx-auto h-4 w-4 text-emerald-300" />
                <p className="mt-2 truncate text-sm font-black sm:text-lg">{value}</p>
                <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!isLeader ? (
        <StudentChecklistSection
          isMember={isMember}
          isLeader={isLeader}
          myMemberHabit={myMemberHabit}
          timeUntilMidnight={timeUntilMidnight}
          editingHabits={editingHabits}
          ticking={ticking}
          numericValues={numericValues}
          textValues={textValues}
          tempNumericValues={tempNumericValues}
          tempTextValues={tempTextValues}
          getLinkedGoalTitle={getLinkedGoalTitle}
          isHabitAvailableToday={isHabitAvailableToday}
          getNextAvailableDay={getNextAvailableDay}
          groupId={groupId}
          challengeId={group?.activeChallenge?.id}
          studentId={myMemberHabit?.member?.id ?? myMemberHabit?.member}
          schoolTimetable={[]}
          workspaceType="football"
          onOpenPlanner={() => setActiveTab('calendar')}
          onRefresh={fetchGroupDetails}
          showPageToast={showPageToast}
          handleStartEdit={handleStartEdit}
          handleCancelEdit={handleCancelEdit}
          handleToggleHabit={handleToggleHabit}
          handleStudentNumericUpdate={handleStudentNumericUpdate}
          handleStudentNumericSubmit={handleStudentNumericSubmit}
          handleStudentTextUpdate={handleStudentTextUpdate}
          handleStudentTextSubmit={handleStudentTextSubmit}
        />
      ) : (
        <ActiveChallengeOverview
          group={group}
          isLeader={isLeader}
          membersNotInChallenge={membersNotInChallenge}
          setAddMembersToChallengeSelected={setAddMembersToChallengeSelected}
          setShowAddMembersToChallengeModal={setShowAddMembersToChallengeModal}
          openEditChallengeHabitsModal={openEditChallengeHabitsModal}
          scheduledHabits={scheduledHabits}
          calculateScheduledAverageForDate={calculateScheduledAverageForDate}
          getDayName={getDayName}
          formatDateLocal={formatDateLocal}
          calculateTodayScheduledProgress={calculateTodayScheduledProgress}
          groupId={groupId}
          timeUntilMidnight={timeUntilMidnight}
          collapsedMembers={collapsedMembers}
          toggleMemberCollapse={toggleMemberCollapse}
          calculateMemberCompletionRate={calculateMemberCompletionRate}
          calculateTodayCompletionRate={calculateTodayCompletionRate}
          isHabitAvailableToday={isHabitAvailableToday}
          getPercentageColor={getPercentageColor}
          getNextAvailableDay={getNextAvailableDay}
          workspaceType="football"
        />
      )}

      {!isLeader && !group?.activeChallenge ? (
        <section className="rounded-[1.5rem] border border-dashed border-emerald-300 bg-emerald-50/70 p-6 text-center dark:border-emerald-400/25 dark:bg-emerald-400/10">
          <FiClock className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-300" />
          <h3 className="mt-3 text-xl font-black text-slate-950 dark:text-white">Your next programme is being prepared</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">Your coach can still message you and update your Football Chart while the next challenge is being built.</p>
        </section>
      ) : null}
    </div>
  );
}

export default FootballDashboardOverview;
