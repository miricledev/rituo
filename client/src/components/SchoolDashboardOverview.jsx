import React, { useMemo } from 'react';
import ActiveChallengeOverview from './ActiveChallengeOverview';
import StudentChecklistSection from './StudentChecklistSection';

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  return `${Math.round(value)}%`;
}

function SchoolDashboardOverview(props) {
  const {
    activeTab,
    isLeader,
    isCoach,
    isMember,
    group,
    mySchoolProfile,
    schoolProfiles,
    leagueTable,
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
    myMemberHabit,
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
    handleStudentTextSubmit
  } = props;

  const dashboardMetrics = useMemo(() => {
    const profiles = schoolProfiles || [];
    const attendanceRates = profiles
      .map((profile) => Number(profile.attendanceSummary?.attendanceRate ?? 0))
      .filter((value) => value > 0);
    const weeklyScores = profiles.map((profile) => Number(profile.scorecards?.combinedWeeklyScore ?? 0));
    const atRisk = profiles.filter((profile) => {
      const daily = Number(profile.scorecards?.daily?.combinedPoints ?? 0);
      return daily < 0 || (profile.interventions || []).some((item) => ['scheduled', 'monitoring'].includes(item.status));
    });
    const recoveredToday = profiles.filter((profile) => profile.scorecards?.daily?.status === 'recovered');

    return {
      totalStudents: profiles.length,
      averageAttendance: attendanceRates.length
        ? attendanceRates.reduce((sum, value) => sum + value, 0) / attendanceRates.length
        : 0,
      averageWeeklyScore: weeklyScores.length
        ? weeklyScores.reduce((sum, value) => sum + value, 0) / weeklyScores.length
        : 0,
      atRisk,
      recoveredToday
    };
  }, [schoolProfiles]);

  const topLeagueEntries = useMemo(() => (leagueTable || []).slice(0, 3), [leagueTable]);

  if (activeTab !== 'overview') {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card dark:border-secondary-700 dark:bg-secondary-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-600 dark:text-primary-300">School dashboard</p>
            <h2 className="mt-1 text-3xl font-bold text-secondary-900 dark:text-white">
              {isLeader || isCoach ? 'See who needs action and who is recovering' : 'See your score, your goal, and what to do next'}
            </h2>
            <p className="mt-2 text-secondary-600 dark:text-secondary-400">
              {isLeader || isCoach
                ? 'Track the school day, identify pressure points, and connect challenge habits back to recovery.'
                : 'Your school points, habits, and goal progress are all connected in one place.'}
            </p>
          </div>
          <div className="rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            Reset in {timeUntilMidnight}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Students</p>
            <p className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">{dashboardMetrics.totalStudents}</p>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">Active school profiles</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Average attendance</p>
            <p className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">{formatPercent(dashboardMetrics.averageAttendance)}</p>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">Across visible students</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">At risk today</p>
            <p className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">{dashboardMetrics.atRisk.length}</p>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">Negative score or open intervention</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Recovered today</p>
            <p className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">{dashboardMetrics.recoveredToday.length}</p>
            <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">Students who turned it around</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-secondary-700">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Your current focus</h3>
            <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">Goal</p>
            <p className="text-base font-semibold text-secondary-900 dark:text-white">
              {mySchoolProfile?.goals?.[0]?.title || 'No goal set yet'}
            </p>
            <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">Daily score</p>
            <p className="text-base font-semibold text-secondary-900 dark:text-white">
              {mySchoolProfile?.scorecards?.daily?.combinedPoints ?? 0} pts
            </p>
            <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">Weekly combined score</p>
            <p className="text-base font-semibold text-secondary-900 dark:text-white">
              {mySchoolProfile?.scorecards?.combinedWeeklyScore ?? 0} pts
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-secondary-700">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">League pulse</h3>
            <div className="mt-3 space-y-3">
              {topLeagueEntries.length ? topLeagueEntries.map((entry, index) => (
                <div key={`${entry.studentId || entry.username}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-secondary-900/40">
                  <div>
                    <p className="font-medium text-secondary-900 dark:text-white">{index + 1}. {entry.studentName || entry.username || 'Student'}</p>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400">{entry.league || 'League'}</p>
                  </div>
                  <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">{entry.totalPoints ?? entry.points ?? 0} pts</p>
                </div>
              )) : (
                <p className="text-sm text-secondary-500 dark:text-secondary-400">League standings will appear here once students are scored.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-secondary-700">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Recovery signal</h3>
            <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">
              Habits scheduled for today
            </p>
            <p className="text-2xl font-bold text-secondary-900 dark:text-white">{scheduledHabits.length}</p>
            <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">Average weekly score</p>
            <p className="text-base font-semibold text-secondary-900 dark:text-white">
              {dashboardMetrics.averageWeeklyScore.toFixed(1)} pts
            </p>
            <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">
              {isLeader || isCoach
                ? `${dashboardMetrics.atRisk.length} students need support today.`
                : mySchoolProfile?.scorecards?.daily?.recoveryPotential
                  ? `You can still recover ${mySchoolProfile.scorecards.daily.recoveryPotential} points today.`
                  : 'Keep your home habits moving to protect your weekly score.'}
            </p>
          </div>
        </div>
      </section>

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
      />

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
        handleStartEdit={handleStartEdit}
        handleCancelEdit={handleCancelEdit}
        handleToggleHabit={handleToggleHabit}
        handleStudentNumericUpdate={handleStudentNumericUpdate}
        handleStudentNumericSubmit={handleStudentNumericSubmit}
        handleStudentTextUpdate={handleStudentTextUpdate}
        handleStudentTextSubmit={handleStudentTextSubmit}
      />
    </div>
  );
}

export default SchoolDashboardOverview;
