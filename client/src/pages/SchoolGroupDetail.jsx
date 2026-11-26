import React, { useState } from 'react';
import {
  FaBookOpen,
  FaCalendarAlt,
  FaChartLine,
  FaChalkboardTeacher,
  FaClipboardCheck,
  FaComments,
  FaHome,
  FaSchool,
  FaUserGraduate,
  FaUsers
} from 'react-icons/fa';
import SchoolGroupShell from '../components/SchoolGroupShell';
import GroupDetailWorkspace from '../components/GroupDetailWorkspace';
import SchoolDashboardOverview from '../components/SchoolDashboardOverview';
import StudentCompetitionStrip from '../components/StudentCompetitionStrip';
import StudentChecklistSection from '../components/StudentChecklistSection';
import DailyHabitPlanner from '../components/DailyHabitPlanner';
import ColorChart from '../components/ColorChart';
import StudentRewardsPage from '../components/StudentRewardsPage';
import { HOMEWORK_ENABLED } from '../config/features';

const adminSchoolAreas = [
  {
    id: 'classes',
    label: 'Classes',
    description: 'Manage subjects, rosters, teaching teams, class chat, and lesson demand.',
    icon: FaSchool,
    defaultTab: 'school',
    defaultSection: 'school-classes'
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Student motivation, progress, and league visibility.',
    icon: FaHome,
    defaultTab: 'overview',
    defaultSection: null
  },
  {
    id: 'students',
    label: 'Students',
    description: 'Profiles, goals, attendance, and intervention detail.',
    icon: FaUsers,
    defaultTab: 'school',
    defaultSection: 'student-profiles'
  },
  {
    id: 'teaching',
    label: 'Teaching',
    description: 'Timetable, register-taking, and live classroom workflow.',
    icon: FaChalkboardTeacher,
    defaultTab: 'school',
    defaultSection: 'teacher-register'
  },
  {
    id: 'homework',
    label: 'Homework',
    description: 'Assignments, recovery points, and review queues.',
    icon: FaClipboardCheck,
    defaultTab: 'school',
    defaultSection: 'school-homework'
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Risk, interventions, staffing, and school ops data.',
    icon: FaSchool,
    defaultTab: 'school',
    defaultSection: 'school-operations'
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Exports, evidence, and leadership summaries.',
    icon: FaChartLine,
    defaultTab: 'school',
    defaultSection: 'school-reports'
  },
  {
    id: 'community',
    label: 'Community',
    description: 'School-wide chat, class channels, courses, and challenge culture.',
    icon: FaComments,
    defaultTab: 'chat',
    defaultSection: null
  }
];

const teacherSchoolAreas = [
  {
    id: 'classes',
    label: 'My classes',
    description: 'Open assigned classes, rosters, homework, and community channels.',
    icon: FaSchool,
    defaultTab: 'school',
    defaultSection: 'school-classes'
  },
  {
    id: 'dashboard',
    label: 'Teaching dashboard',
    description: 'See student progress, habits, recovery, and priorities for today.',
    icon: FaHome,
    defaultTab: 'overview',
    defaultSection: null
  },
  {
    id: 'students',
    label: 'My students',
    description: 'View the profiles, goals, points, and evidence you are allowed to support.',
    icon: FaUsers,
    defaultTab: 'school',
    defaultSection: 'student-profiles'
  },
  {
    id: 'teaching',
    label: 'Teaching',
    description: 'Use your timetable and take the register for assigned classes.',
    icon: FaChalkboardTeacher,
    defaultTab: 'school',
    defaultSection: 'teacher-register'
  },
  {
    id: 'homework',
    label: 'Homework',
    description: 'Set, review, and respond to homework for your students.',
    icon: FaClipboardCheck,
    defaultTab: 'school',
    defaultSection: 'school-homework'
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Review evidence and summaries for the students you can access.',
    icon: FaChartLine,
    defaultTab: 'school',
    defaultSection: 'school-reports'
  },
  {
    id: 'community',
    label: 'Community',
    description: 'Use visible school and class channels to coordinate learning.',
    icon: FaComments,
    defaultTab: 'chat',
    defaultSection: null
  }
];

const studentSchoolAreas = [
  {
    id: 'classes',
    label: 'My classes',
    description: 'See subjects, teachers, classmates, homework, and class communities.',
    icon: FaSchool,
    defaultTab: 'school',
    defaultSection: 'school-classes'
  },
  {
    id: 'my-day',
    label: 'My day',
    description: 'See today’s habits, points, goal focus, and progress at a glance.',
    icon: FaHome,
    defaultTab: 'overview',
    defaultSection: null
  },
  {
    id: 'homework',
    label: 'My homework',
    description: 'See pending work, submit completed tasks, and review feedback.',
    icon: FaClipboardCheck,
    defaultTab: 'school',
    defaultSection: 'school-homework'
  },
  {
    id: 'schedule',
    label: 'My schedule',
    description: 'Plan habits around lessons and organise your available time.',
    icon: FaCalendarAlt,
    defaultTab: 'calendar',
    defaultSection: null
  },
  {
    id: 'progress',
    label: 'My progress',
    description: 'Review your stats, attendance, points, goals, and weekly trend.',
    icon: FaChartLine,
    defaultTab: 'school',
    defaultSection: 'student-profiles'
  },
  {
    id: 'skills',
    label: 'My color chart',
    description: 'See and understand your own skill development chart.',
    icon: FaUserGraduate,
    defaultTab: 'colorChart',
    defaultSection: null
  },
  {
    id: 'learning',
    label: 'My learning',
    description: 'Continue the course connected to your current school challenge.',
    icon: FaBookOpen,
    requiresCourse: true,
    defaultTab: 'course',
    defaultSection: null
  },
  {
    id: 'community',
    label: 'School community',
    description: 'Use the school and class channels available to you.',
    icon: FaComments,
    defaultTab: 'chat',
    defaultSection: null
  }
];

function deriveSchoolArea(activeTab, currentSchoolSection, viewerType) {
  if (viewerType === 'student') {
    if (activeTab === 'calendar') return 'schedule';
    if (activeTab === 'colorChart') return 'skills';
    if (activeTab === 'course') return 'learning';
    if (activeTab === 'chat') return 'community';
    if (activeTab === 'school') {
      if (currentSchoolSection === 'school-classes') return 'classes';
      return currentSchoolSection === 'school-homework' ? 'homework' : 'progress';
    }
    return 'my-day';
  }

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

  if (currentSchoolSection === 'school-classes') {
    return 'classes';
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStudentId, setPreviewStudentId] = useState('');
  const [previewTab, setPreviewTab] = useState('day');
  const accountRole = workspaceProps.user?.accountRole || 'student';
  const studentCount = (workspaceProps.group?.members || []).filter(
    (member) => (member.accountRole || 'student') === 'student'
  ).length;
  const viewerType = shellProps.isLeader
    ? 'admin'
    : (accountRole === 'teacher' || workspaceProps.isCoach ? 'teacher' : 'student');
  const schoolAreas = (
    viewerType === 'admin'
      ? adminSchoolAreas
      : viewerType === 'teacher'
        ? teacherSchoolAreas
        : studentSchoolAreas
  )
    .filter((area) => !area.requiresCourse || !!workspaceProps.group?.activeChallenge?.courseId)
    .filter((area) => HOMEWORK_ENABLED || area.id !== 'homework')
    .filter((area) => viewerType !== 'student' || ['classes', 'homework', 'progress', 'community'].includes(area.id));
  const activeArea = deriveSchoolArea(shellProps.activeTab, currentSchoolSection, viewerType);
  const showWorkspaceNavigation = viewerType !== 'student';
  const resolvedShellProps = viewerType === 'student'
    ? {
        ...shellProps,
        compactForStudent: true,
        persistentContent: studentCount > 1
          ? <StudentCompetitionStrip group={workspaceProps.group} userId={workspaceProps.user?.id} />
          : null,
        setActiveTab: (tab) => {
          if (tab === 'school') {
            onSelectSchoolArea(studentSchoolAreas.find((area) => area.id === 'classes'));
            return;
          }
          shellProps.setActiveTab(tab);
        }
      }
    : shellProps;
  const overviewContent = (
    <SchoolDashboardOverview
      activeTab={workspaceProps.activeTab}
      isLeader={workspaceProps.isLeader}
      isCoach={workspaceProps.isCoach}
      accountRole={workspaceProps.user?.accountRole}
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
      onOpenPlanner={() => shellProps.setActiveTab('calendar')}
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
      fetchGroupDetails={workspaceProps.fetchGroupDetails}
      showPageToast={workspaceProps.showPageToast}
    />
  );
  const adminQuickLinks = [
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
  ];
  const teacherQuickLinks = [
    {
      id: 'student-color-charts',
      label: 'Student color charts',
      show: workspaceProps.isCoach,
      isActive: shellProps.activeTab === 'colorChart',
      onClick: () => shellProps.setActiveTab('colorChart')
    },
    {
      id: 'learning',
      label: 'Learning',
      show: !!workspaceProps.group?.activeChallenge?.courseId,
      isActive: shellProps.activeTab === 'course',
      onClick: () => shellProps.setActiveTab('course')
    },
    {
      id: 'reports',
      label: 'Student reports',
      show: true,
      isActive: shellProps.activeTab === 'school' && currentSchoolSection === 'school-reports',
      onClick: () => onSelectSchoolArea({ defaultTab: 'school', defaultSection: 'school-reports' })
    }
  ];
  const quickLinks = (
    viewerType === 'admin'
      ? adminQuickLinks
      : viewerType === 'teacher'
        ? teacherQuickLinks
        : []
  ).filter((item) => item.show);
  const workspaceCopy = {
    admin: {
      eyebrow: 'School control centre',
      title: 'Run the school from one place',
      description: 'Move between people, teaching, operations, reporting, and administration with full school oversight.',
      toolsTitle: 'Admin tools',
      toolsDescription: 'Management and reporting controls stay available without crowding the main navigation.'
    },
    teacher: {
      eyebrow: 'Teacher workspace',
      title: 'Support students from one place',
      description: 'Focus on your students, classes, homework, evidence, and the actions that need attention today.',
      toolsTitle: 'Teacher tools',
      toolsDescription: 'Open the student support and learning tools available to your role.'
    },
    student: {
      eyebrow: 'Student workspace',
      title: 'Your habits, learning, and progress',
      description: 'Everything here is about you: today’s habits, your schedule, homework, points, stats, goals, and skill development.',
      toolsTitle: 'My personal tools',
      toolsDescription: 'These areas only show your own learning and progress. There are no school management controls.'
    }
  }[viewerType];
  const visibleWorkspaceCopy = HOMEWORK_ENABLED
    ? workspaceCopy
    : {
        ...workspaceCopy,
        description: workspaceCopy.description.replace(/,? homework/gi, '')
      };

  const previewStudents = (workspaceProps.group?.members || []).filter(
    (member) => (member.accountRole || 'student') === 'student'
  );
  const selectedStudent = previewStudents.find((student) => String(student.id) === previewStudentId) || previewStudents[0];
  const selectedHabits = (workspaceProps.group?.activeChallenge?.memberHabits || []).find(
    (entry) => String(entry.member?.id ?? entry.member) === String(selectedStudent?.id)
  );

  if (previewOpen && viewerType === 'admin' && accountRole === 'admin') {
    return (
      <div className="relative mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-6 sm:py-8">
        <section className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-50 p-4 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-widest">Read-only student preview</p><p className="mt-1 text-sm">Previewing {workspaceProps.group.name}. Changes and purchases are disabled. Google Calendar events are not imported in preview.</p></div>
            <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white dark:bg-white dark:text-slate-950">Exit student view</button>
          </div>
          <label className="mt-4 block text-xs font-bold">Student
            <select value={String(selectedStudent?.id || '')} onChange={(event) => setPreviewStudentId(event.target.value)} className="mt-1 block w-full max-w-sm rounded-xl border border-amber-300 bg-white px-3 py-2 text-slate-950 dark:border-white/20 dark:bg-slate-900 dark:text-white">
              {previewStudents.map((student) => <option key={student.id} value={student.id}>{[student.firstName, student.lastName].filter(Boolean).join(' ') || student.username}</option>)}
            </select>
          </label>
        </section>
        <div className="mb-4 flex flex-wrap gap-2">{[['day', 'My Day'], ['planner', 'My Planner'], ['chart', 'My Colour Chart'], ['shop', 'IP Shop']].map(([key, label]) => <button key={key} type="button" onClick={() => setPreviewTab(key)} className={`rounded-xl px-4 py-2.5 text-sm font-black ${previewTab === key ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'}`}>{label}</button>)}</div>
        {!selectedStudent ? <p className="rounded-2xl bg-white p-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">Add a student to this school to preview their view.</p> : (
          previewTab === 'planner' ? <DailyHabitPlanner key={`planner-${selectedStudent.id}`} groupId={workspaceProps.groupId} profile={{ student: selectedStudent, linkedHabits: selectedHabits?.habits || [] }} canEdit={false} readOnlyPreview schoolTimetable={workspaceProps.group?.schoolTimetable || []} schoolDayConfig={workspaceProps.group?.schoolDayConfig || {}} activeChallenge={workspaceProps.group?.activeChallenge} challengeMember={selectedHabits} /> :
          previewTab === 'chart' ? <ColorChart key={`chart-${selectedStudent.id}`} groupId={workspaceProps.groupId} groupType="school" memberHabit={{ member: selectedStudent.id }} isLeader={false} isCoach={false} /> :
          previewTab === 'shop' ? <StudentRewardsPage key={`shop-${selectedStudent.id}`} groupId={workspaceProps.groupId} studentId={selectedStudent.id} readOnlyPreview /> :
          !selectedHabits ? <p className="rounded-2xl bg-white p-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">This student has no habits in the current challenge.</p> :
          <fieldset disabled aria-label="Read-only student habit preview" className="min-w-0">
            <StudentChecklistSection
              key={selectedStudent.id}
              readOnly
              isMember
              isLeader={false}
              myMemberHabit={selectedHabits}
              groupId={workspaceProps.groupId}
              studentId={selectedStudent.id}
              challengeId={workspaceProps.group?.activeChallenge?.id}
              schoolTimetable={workspaceProps.group?.schoolTimetable || []}
              timeUntilMidnight={workspaceProps.timeUntilMidnight}
              editingHabits={{}}
              ticking={{}}
              numericValues={{}}
              textValues={{}}
              tempNumericValues={{}}
              tempTextValues={{}}
              getLinkedGoalTitle={() => ''}
              isHabitAvailableToday={workspaceProps.isHabitAvailableToday}
              getNextAvailableDay={workspaceProps.getNextAvailableDay}
            />
          </fieldset>
        )}
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[1440px] overflow-x-hidden px-2 py-3 sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-cyan-50/40 dark:from-[#050816] dark:via-[#070b17] dark:to-[#091226]" />
      <div className="pointer-events-none fixed left-[-10rem] top-28 -z-10 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none fixed right-[-8rem] top-1/3 -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <SchoolGroupShell {...resolvedShellProps} />

      {viewerType === 'admin' && accountRole === 'admin' ? <div className="mb-4 flex justify-end"><button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-200"><FaUserGraduate /> View as student</button></div> : null}

      {showWorkspaceNavigation ? (
      <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.09)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-600 dark:text-cyan-300">{visibleWorkspaceCopy.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">{visibleWorkspaceCopy.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {visibleWorkspaceCopy.description}
            </p>
          </div>
          <div className="relative inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            Active area: {schoolAreas.find((area) => area.id === activeArea)?.label || schoolAreas[0]?.label}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {schoolAreas.map((area) => {
            const isActive = activeArea === area.id;
            const AreaIcon = area.icon;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => onSelectSchoolArea(area)}
                className={`group rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  isActive
                    ? 'border-violet-300 bg-gradient-to-br from-violet-50 to-cyan-50 text-violet-900 shadow-lg shadow-violet-500/10 dark:border-violet-400/30 dark:from-violet-500/15 dark:to-cyan-400/10 dark:text-white'
                    : 'border-slate-200 bg-white/70 text-slate-900 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.065]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-base font-semibold">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-violet-600 text-white dark:bg-white/10' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.055] dark:text-slate-300'}`}>
                      <AreaIcon className="text-sm" />
                    </span>
                    {area.label}
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                      Live
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm leading-5 ${isActive ? 'text-violet-700 dark:text-violet-100' : 'text-slate-500 dark:text-slate-400'}`}>
                  {area.description}
                </p>
              </button>
            );
          })}
        </div>

        {quickLinks.length ? <div className="relative mt-5 border-t border-slate-200 pt-5 dark:border-white/10">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{visibleWorkspaceCopy.toolsTitle}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {visibleWorkspaceCopy.toolsDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={link.onClick}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                    link.isActive
                      ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-100'
                      : 'border-slate-200 bg-white/60 text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-cyan-200'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </div> : null}
      </section>
      ) : null}

      <GroupDetailWorkspace {...workspaceProps} overviewContent={overviewContent} />
    </div>
  );
}

export default SchoolGroupDetail;
