import React from 'react';
import StandardGroupShell from '../components/StandardGroupShell';
import GroupDetailWorkspace from '../components/GroupDetailWorkspace';
import OverviewTabSection from '../components/OverviewTabSection';

function StandardGroupDetail({ shellProps, workspaceProps }) {
  const overviewContent = (
    <OverviewTabSection
      activeTab={workspaceProps.activeTab}
      isLeader={workspaceProps.isLeader}
      mySchoolProfile={workspaceProps.mySchoolProfile}
      group={workspaceProps.group}
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
      isMember={workspaceProps.isMember}
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

  return (
    <div className="relative mx-auto w-full max-w-[1440px] overflow-x-hidden px-3 py-5 sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-violet-50/40 dark:from-[#050816] dark:via-[#070b17] dark:to-[#091226]" />
      <div className="pointer-events-none fixed left-[-10rem] top-28 -z-10 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none fixed right-[-8rem] top-1/3 -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <StandardGroupShell {...shellProps} />
      <GroupDetailWorkspace {...workspaceProps} overviewContent={overviewContent} />
    </div>
  );
}

export default StandardGroupDetail;
