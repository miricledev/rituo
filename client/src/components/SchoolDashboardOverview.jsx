import React, { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiAward, FiBookOpen, FiClock, FiTarget, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import ActiveChallengeOverview from './ActiveChallengeOverview';
import StudentChecklistSection from './StudentChecklistSection';
import { STUDENT_REWARD_THEME_STYLES } from './StudentRewardsPanel';
import IpAvatar from './IpAvatar';
import { HOMEWORK_ENABLED } from '../config/features';
import api from '../services/api';

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  return `${Math.round(value)}%`;
}

function SchoolDashboardOverview(props) {
  const {
    activeTab,
    isLeader,
    isCoach,
    accountRole,
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
    onOpenPlanner,
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
    handleStudentTextSubmit,
    fetchGroupDetails,
    showPageToast
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
  const isStaffView = isLeader || isCoach || accountRole === 'teacher';
  const [studentRewards, setStudentRewards] = useState(null);
  const studentId = mySchoolProfile?.student?.id ?? myMemberHabit?.member?.id ?? myMemberHabit?.member;

  useEffect(() => {
    if (activeTab !== 'overview' || isStaffView || !groupId || !studentId) return undefined;
    let active = true;
    api.get(`/groups/${groupId}/students/${studentId}/rewards`)
      .then((response) => {
        if (active) setStudentRewards(response.data?.rewards || null);
      })
      .catch(() => {
        if (active) setStudentRewards(null);
      });
    return () => { active = false; };
  }, [activeTab, groupId, isStaffView, studentId]);
  const selectedRewardTheme = STUDENT_REWARD_THEME_STYLES[
    studentRewards?.preferences?.selectedThemeId || 'ip-classic'
  ] || STUDENT_REWARD_THEME_STYLES['ip-classic'];
  const selectedRewardTitle = studentRewards?.titles?.find(
    (title) => title.id === studentRewards?.preferences?.selectedTitleId
  );
  const studentHomework = mySchoolProfile?.homework || {};
  const studentHomeworkAssignments = studentHomework.assignments || [];
  const completedHomeworkCount = studentHomeworkAssignments.filter((assignment) =>
    ['submitted', 'approved', 'completed'].includes(assignment.submission?.status)
  ).length;
  const pendingHomeworkCount = Math.max(studentHomeworkAssignments.length - completedHomeworkCount, 0);
  const summaryCards = isStaffView
    ? [
        {
          label: 'Students',
          value: dashboardMetrics.totalStudents,
          detail: 'Active school profiles',
          icon: FiUsers,
          iconClass: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300'
        },
        {
          label: 'Average attendance',
          value: formatPercent(dashboardMetrics.averageAttendance),
          detail: 'Across visible students',
          icon: FiTrendingUp,
          iconClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300'
        },
        {
          label: 'At risk today',
          value: dashboardMetrics.atRisk.length,
          detail: 'Negative score or open intervention',
          icon: FiActivity,
          iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
        },
        {
          label: 'Recovered today',
          value: dashboardMetrics.recoveredToday.length,
          detail: 'Students who turned it around',
          icon: FiTarget,
          iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
        }
      ]
    : [
        {
          label: 'My attendance',
          value: formatPercent(mySchoolProfile?.attendanceSummary?.attendanceRate),
          detail: 'Your current attendance rate',
          icon: FiTrendingUp,
          iconClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300'
        },
        {
          label: 'Today’s points',
          value: mySchoolProfile?.scorecards?.daily?.combinedPoints ?? 0,
          detail: 'Your combined score today',
          icon: FiActivity,
          iconClass: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300'
        },
        {
          label: 'Weekly points',
          value: mySchoolProfile?.scorecards?.combinedWeeklyScore ?? 0,
          detail: 'Your combined weekly score',
          icon: FiTarget,
          iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        },
        {
          label: 'Pending homework',
          value: pendingHomeworkCount,
          detail: `${completedHomeworkCount} completed`,
          icon: FiBookOpen,
          iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
        },
        {
          label: 'IP Bucks',
          value: studentRewards?.economy?.wallet?.balance ?? 0,
          detail: 'Earned through consistency',
          icon: FiAward,
          iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
        }
      ];
  const visibleSummaryCards = summaryCards.filter((card) => HOMEWORK_ENABLED || card.label !== 'Pending homework');
  const habitChecklist = (
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
      studentId={mySchoolProfile?.student?.id ?? myMemberHabit?.member?.id ?? myMemberHabit?.member}
      schoolTimetable={group?.schoolTimetable || []}
      onOpenPlanner={onOpenPlanner}
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
  );

  if (activeTab !== 'overview') {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {!isStaffView ? habitChecklist : null}

      <section className={`relative overflow-hidden rounded-[1.5rem] border border-slate-200/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur-2xl dark:border-white/10 sm:rounded-[2rem] sm:p-7 ${isStaffView ? 'bg-white/90 dark:bg-white/[0.045]' : selectedRewardTheme.hero}`}>
        <div className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl ${isStaffView ? 'bg-violet-500/15' : selectedRewardTheme.primaryGlow}`} />
        <div className={`pointer-events-none absolute -bottom-20 left-1/4 h-48 w-48 rounded-full blur-3xl ${isStaffView ? 'bg-cyan-400/10' : selectedRewardTheme.secondaryGlow}`} />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative flex min-w-0 items-start gap-3 sm:gap-5">
            {!isStaffView ? <IpAvatar avatar={studentRewards?.economy?.avatar} className="h-16 w-16 shrink-0 rounded-2xl shadow-lg sm:h-24 sm:w-24" /> : null}
            <div className="min-w-0">
              <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] ${isStaffView ? 'text-violet-600 dark:text-cyan-300' : selectedRewardTheme.accent}`}>
                <HiOutlineSparkles className="h-4 w-4" />
                School dashboard
              </p>
              {!isStaffView && selectedRewardTitle ? <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${selectedRewardTheme.chip}`}>{selectedRewardTitle.name}</span> : null}
              <h2 className="mt-2 max-w-4xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {isStaffView ? 'See who needs action and who is recovering' : 'See your score, your goal, and what to do next'}
              </h2>
              <p className="mt-3 hidden max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:block sm:text-base">
                {isStaffView
                  ? 'Track the school day, identify pressure points, and connect challenge habits back to recovery.'
                  : 'Your school points, habits, and goal progress are all connected in one place.'}
              </p>
            </div>
          </div>
          <div className="relative inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200">
            <FiClock className="h-4 w-4" />
            Reset in {timeUntilMidnight}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:mt-7 sm:gap-4 xl:grid-cols-4">
          {visibleSummaryCards.map((card) => {
            const CardIcon = card.icon;
            return (
              <div key={card.label} className="group rounded-xl border border-slate-200 bg-white/70 p-3 transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] sm:rounded-2xl sm:p-4 sm:hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
                  <span className={`rounded-xl p-2 ${card.iconClass}`}><CardIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white sm:mt-3 sm:text-3xl">{card.value}</p>
                <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">{card.detail}</p>
              </div>
            );
          })}
        </div>

        <div className="relative mt-4 grid grid-cols-1 gap-3 sm:mt-6 sm:gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-black/10">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Your current focus</h3>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Goal</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              {mySchoolProfile?.goals?.[0]?.title || 'No goal set yet'}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Daily score</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              {mySchoolProfile?.scorecards?.daily?.combinedPoints ?? 0} pts
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Weekly combined score</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              {mySchoolProfile?.scorecards?.combinedWeeklyScore ?? 0} pts
            </p>
          </div>

          {(isStaffView || HOMEWORK_ENABLED) ? <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-black/10">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">{isStaffView ? 'League pulse' : 'My homework'}</h3>
            {isStaffView ? (
              <div className="mt-3 space-y-3">
                {topLeagueEntries.length ? topLeagueEntries.map((entry, index) => (
                  <div key={`${entry.studentId || entry.username}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{index + 1}. {entry.studentName || entry.username || 'Student'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{entry.league || 'League'}</p>
                    </div>
                    <p className="text-sm font-bold text-violet-700 dark:text-cyan-300">{entry.totalPoints ?? entry.points ?? 0} pts</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">League standings will appear here once students are scored.</p>
                )}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Due today</p>
                  <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{studentHomework.dueTodayCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Missing</p>
                  <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{studentHomework.missingCount ?? 0}</p>
                </div>
                <p className="col-span-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Open My homework to review pending and completed work.
                </p>
              </div>
            )}
          </div> : null}

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-50 to-cyan-50 p-5 dark:border-white/10 dark:from-violet-500/10 dark:to-cyan-400/5">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Recovery signal</h3>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Habits scheduled for today
            </p>
            <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{scheduledHabits.length}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">{isStaffView ? 'Average weekly score' : 'My weekly score'}</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              {isStaffView
                ? `${dashboardMetrics.averageWeeklyScore.toFixed(1)} pts`
                : `${mySchoolProfile?.scorecards?.combinedWeeklyScore ?? 0} pts`}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {isStaffView
                ? `${dashboardMetrics.atRisk.length} students need support today.`
                : mySchoolProfile?.scorecards?.daily?.recoveryPotential
                  ? `You can still recover ${mySchoolProfile.scorecards.daily.recoveryPotential} points today.`
                  : 'Keep your home habits moving to protect your weekly score.'}
            </p>
          </div>
        </div>

        {!isStaffView && (mySchoolProfile?.classes || []).length ? (
          <div className="relative mt-5 rounded-2xl border border-slate-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">My classes</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your subjects and teaching teams for this school.</p>
              </div>
              <a href={`/groups/${groupId}?tab=school&section=school-classes`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950">Open all classes</a>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(mySchoolProfile.classes || []).slice(0, 6).map((schoolClass) => (
                <a key={schoolClass.id} href={`/groups/${groupId}?tab=chat&class=${schoolClass.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-white/10 dark:bg-black/10">
                  <div className="font-black text-slate-950 dark:text-white">{schoolClass.name}</div>
                  <div className="mt-1 text-sm font-semibold text-violet-700 dark:text-cyan-300">{schoolClass.subject?.name || schoolClass.yearGroup || 'Class'}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {(schoolClass.teachingAssignments || []).map((assignment) => assignment.teacher?.username).filter(Boolean).join(', ') || 'Teacher to be assigned'}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {isStaffView ? <ActiveChallengeOverview
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
      /> : null}

      {isStaffView ? habitChecklist : null}
    </div>
  );
}

export default SchoolDashboardOverview;
