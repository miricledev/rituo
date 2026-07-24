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
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
      <StandardGroupShell {...shellProps} />
      <GroupDetailWorkspace {...workspaceProps} overviewContent={overviewContent} />
    </div>
  );
}

export default StandardGroupDetail;
