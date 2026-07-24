import React from 'react';
import SchoolGroupShell from '../components/SchoolGroupShell';
import GroupDetailWorkspace from '../components/GroupDetailWorkspace';
import SchoolDashboardOverview from '../components/SchoolDashboardOverview';

const schoolAreas = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Student motivation, progress, and league visibility.',
    defaultTab: 'overview',
    defaultSection: null
  },
  {
    id: 'students',
    label: 'Students',
    description: 'Profiles, goals, attendance, and intervention detail.',
    defaultTab: 'school',
    defaultSection: 'student-profiles'
  },
  {
    id: 'teaching',
    label: 'Teaching',
    description: 'Timetable, register-taking, and live classroom workflow.',
    defaultTab: 'school',
    defaultSection: 'teacher-register'
  },
  {
    id: 'homework',
    label: 'Homework',
    description: 'Assignments, recovery points, and review queues.',
    defaultTab: 'school',
    defaultSection: 'school-homework'
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Risk, interventions, staffing, and school ops data.',
    defaultTab: 'school',
    defaultSection: 'school-operations'
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Exports, evidence, and leadership summaries.',
    defaultTab: 'school',
    defaultSection: 'school-reports'
  },
  {
    id: 'community',
    label: 'Community',
    description: 'School-wide chat, class channels, courses, and challenge culture.',
    defaultTab: 'chat',
    defaultSection: null
  }
];

function deriveSchoolArea(activeTab, currentSchoolSection) {
  if (activeTab === 'overview' || activeTab === 'leaderboard' || activeTab === 'colorChart') {
    return 'dashboard';
  }

  if (activeTab === 'chat' || activeTab === 'dms' || activeTab === 'dm' || activeTab === 'course' || activeTab === 'archives' || activeTab === 'presets') {
    return 'community';
  }

  if (activeTab !== 'school') {
    return 'dashboard';
  }

  if (currentSchoolSection === 'student-profiles' || currentSchoolSection === 'school-league-table') {
    return 'students';
  }

  if (currentSchoolSection === 'teacher-register' || currentSchoolSection === 'school-timetable' || currentSchoolSection === 'school-structure') {
    return 'teaching';
  }

  if (currentSchoolSection === 'school-homework') {
    return 'homework';
  }

  if (currentSchoolSection === 'school-reports') {
    return 'reports';
  }

  return 'operations';
}

function SchoolGroupDetail({ shellProps, workspaceProps, currentSchoolSection, onSelectSchoolArea }) {
  const activeArea = deriveSchoolArea(shellProps.activeTab, currentSchoolSection);
  const overviewContent = (
    <SchoolDashboardOverview
      activeTab={workspaceProps.activeTab}
      isLeader={workspaceProps.isLeader}
      isCoach={workspaceProps.isCoach}
      isMember={workspaceProps.isMember}
      group={workspaceProps.group}
      mySchoolProfile={workspaceProps.mySchoolProfile}
      schoolProfiles={workspaceProps.schoolProfiles}
      leagueTable={workspaceProps.leagueTable}
      membersNotInChallenge={workspaceProps.membersNotInChallenge}
      setAddMembersToChallengeSelected={workspaceProps.setAddMembersToChallengeSelected}
      setShowAddMembersToChallengeModal={workspaceProps.setShowAddMembersToChallengeModal}
      openEditChallengeHabitsModal={workspaceProps.openEditChallengeHabitsModal}
      scheduledHabits={workspaceProps.scheduledHabits}
      calculateScheduledAverageForDate={workspaceProps.calculateScheduledAverageForDate}
      getDayName={workspaceProps.getDayName}
      formatDateLocal={workspaceProps.formatDateLocal}
      calculateTodayScheduledProgress={workspaceProps.calculateTodayScheduledProgress}
      groupId={workspaceProps.groupId}
      timeUntilMidnight={workspaceProps.timeUntilMidnight}
      collapsedMembers={workspaceProps.collapsedMembers}
      toggleMemberCollapse={workspaceProps.toggleMemberCollapse}
      calculateMemberCompletionRate={workspaceProps.calculateMemberCompletionRate}
      calculateTodayCompletionRate={workspaceProps.calculateTodayCompletionRate}
      isHabitAvailableToday={workspaceProps.isHabitAvailableToday}
      getPercentageColor={workspaceProps.getPercentageColor}
      getNextAvailableDay={workspaceProps.getNextAvailableDay}
      myMemberHabit={workspaceProps.myMemberHabit}
      editingHabits={workspaceProps.editingHabits}
      ticking={workspaceProps.ticking}
      numericValues={workspaceProps.numericValues}
      textValues={workspaceProps.textValues}
      tempNumericValues={workspaceProps.tempNumericValues}
      tempTextValues={workspaceProps.tempTextValues}
      getLinkedGoalTitle={workspaceProps.getLinkedGoalTitle}
      handleStartEdit={workspaceProps.handleStartEdit}
      handleCancelEdit={workspaceProps.handleCancelEdit}
      handleToggleHabit={workspaceProps.handleToggleHabit}
      handleStudentNumericUpdate={workspaceProps.handleStudentNumericUpdate}
      handleStudentNumericSubmit={workspaceProps.handleStudentNumericSubmit}
      handleStudentTextUpdate={workspaceProps.handleStudentTextUpdate}
      handleStudentTextSubmit={workspaceProps.handleStudentTextSubmit}
    />
  );
  const quickLinks = [
    {
      id: 'league',
      label: 'League table',
      show: true,
      isActive: shellProps.activeTab === 'leaderboard',
      onClick: () => shellProps.setActiveTab('leaderboard')
    },
    {
      id: 'color-chart',
      label: 'Color chart',
      show: true,
      isActive: shellProps.activeTab === 'colorChart',
      onClick: () => shellProps.setActiveTab('colorChart')
    },
    {
      id: 'planner',
      label: 'Planner',
      show: !shellProps.isLeader && !workspaceProps.isCoach,
      isActive: shellProps.activeTab === 'calendar',
      onClick: () => shellProps.setActiveTab('calendar')
    },
    {
      id: 'attendance',
      label: 'Attendance ops',
      show: shellProps.isLeader,
      isActive: shellProps.activeTab === 'attendance',
      onClick: () => shellProps.setActiveTab('attendance')
    },
    {
      id: 'archives',
      label: 'Archives',
      show: shellProps.isLeader,
      isActive: shellProps.activeTab === 'archives',
      onClick: () => shellProps.setActiveTab('archives')
    },
    {
      id: 'presets',
      label: 'Presets',
      show: shellProps.isLeader,
      isActive: shellProps.activeTab === 'presets',
      onClick: () => shellProps.setActiveTab('presets')
    },
    {
      id: 'admin',
      label: 'Admin',
      show: shellProps.isLeader,
      isActive: shellProps.activeTab === 'admin',
      onClick: () => shellProps.setActiveTab('admin')
    }
  ].filter((item) => item.show);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
      <SchoolGroupShell {...shellProps} />

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-card backdrop-blur dark:border-secondary-700 dark:bg-secondary-800/80">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-600 dark:text-primary-300">School workspace</p>
            <h2 className="mt-1 text-2xl font-bold text-secondary-900 dark:text-white">Run the school from one place</h2>
            <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
              Switch between operational areas without losing the habit, goal, and challenge system underneath.
            </p>
          </div>
          <div className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            Active area: {schoolAreas.find((area) => area.id === activeArea)?.label || 'Dashboard'}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {schoolAreas.map((area) => {
            const isActive = activeArea === area.id;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => onSelectSchoolArea(area)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 text-primary-800 shadow-sm dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-200'
                    : 'border-gray-200 bg-white text-secondary-900 hover:border-primary-300 hover:bg-primary-50/60 dark:border-secondary-700 dark:bg-secondary-800 dark:text-white dark:hover:border-primary-700 dark:hover:bg-primary-900/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold">{area.label}</span>
                  {isActive && (
                    <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Live
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm ${isActive ? 'text-primary-700 dark:text-primary-200' : 'text-secondary-600 dark:text-secondary-400'}`}>
                  {area.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-secondary-700">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">Quick school tools</h3>
              <p className="text-xs text-secondary-500 dark:text-secondary-400">
                Secondary tools stay available without bloating the top nav.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={link.onClick}
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                    link.isActive
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-gray-200 text-secondary-600 hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <GroupDetailWorkspace {...workspaceProps} overviewContent={overviewContent} />
    </div>
  );
}

export default SchoolGroupDetail;
