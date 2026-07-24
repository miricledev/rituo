import React from 'react';
import OverviewIntroSection from './OverviewIntroSection';
import ActiveChallengeOverview from './ActiveChallengeOverview';
import StudentChecklistSection from './StudentChecklistSection';

const OverviewTabSection = ({
  activeTab,
  isLeader,
  mySchoolProfile,
  group,
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
}) => {
  if (activeTab !== 'overview') {
    return null;
  }

  return (
    <div>
      <OverviewIntroSection
        activeTab={activeTab}
        isLeader={isLeader}
        mySchoolProfile={mySchoolProfile}
        group={group}
      />

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
};

export default OverviewTabSection;
