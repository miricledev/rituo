import { useCallback, useMemo } from 'react';
import axios from 'axios';

const useChallengeActions = ({
  group,
  groupId,
  habitPresets,
  editChallengeHabitsMode,
  memberHabits,
  setMemberHabits,
  lockedChallengeMemberIds,
  showCreateChallengeModal,
  openCreateChallengeModal,
  isEditingHabits,
  lockedHabits,
  newChallenge,
  setNewChallenge,
  groupCourses,
  resetChallengeModalState,
  fetchGroupDetails,
  showPageToast,
  setShowDeleteChallengeConfirm,
  addMembersToChallengeSelected,
  setAddMembersToChallengeSelected,
  setAddMembersToChallengeSubmitting,
  setShowAddMembersToChallengeModal,
  setGroup,
  openEditChallengeHabitsModal
}) => {
  const handleLoadPreset = useCallback((presetId) => {
    if (group?.activeChallenge && !editChallengeHabitsMode) {
      return;
    }

    const presetIdNum = typeof presetId === 'string' ? parseInt(presetId, 10) : presetId;
    const preset = habitPresets.find((item) => item.id === presetIdNum || item.id === presetId);
    if (!preset) return;

    const mappedHabits = preset.habits.map((habit) => ({
      ...habit,
      minValue: habit.habitType === 'numeric' ? (habit.minValue ?? 0) : habit.minValue,
      maxValue: habit.habitType === 'numeric' ? (habit.maxValue ?? 10) : habit.maxValue,
      scheduleDays: habit.scheduleDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      durationMinutes: Number(habit.durationMinutes) || 30,
      combatType: habit.combatType || 'neutral'
    }));

    if (editChallengeHabitsMode) {
      const newMemberHabits = { ...memberHabits };
      Object.keys(memberHabits).forEach((memberId) => {
        if (!lockedChallengeMemberIds.has(memberId)) {
          newMemberHabits[memberId] = [...mappedHabits];
        }
      });
      setMemberHabits(newMemberHabits);
      return;
    }

    const allMembers = group?.members || [];
    const newMemberHabitsMap = {};
    allMembers.forEach((member) => {
      newMemberHabitsMap[member.id] = [...mappedHabits];
    });
    setMemberHabits(newMemberHabitsMap);

    if (!showCreateChallengeModal) {
      openCreateChallengeModal();
    }
  }, [
    editChallengeHabitsMode,
    group,
    habitPresets,
    lockedChallengeMemberIds,
    memberHabits,
    openCreateChallengeModal,
    setMemberHabits,
    showCreateChallengeModal
  ]);

  const deleteActiveChallenge = useCallback(async () => {
    if (!group?.activeChallenge) return;
    try {
      await axios.delete(`/groups/${groupId}/challenge/${group.activeChallenge.id}`);
      await fetchGroupDetails();
      setShowDeleteChallengeConfirm(false);
      showPageToast('success', 'Challenge removed');
    } catch (error) {
      showPageToast('error', 'Failed to remove challenge');
    }
  }, [fetchGroupDetails, group, groupId, setShowDeleteChallengeConfirm, showPageToast]);

  const handleAddMembersToChallenge = useCallback(async () => {
    if (!group?.activeChallenge || !addMembersToChallengeSelected.length) return;
    setAddMembersToChallengeSubmitting(true);
    try {
      const response = await axios.post(
        `/groups/${groupId}/challenge/${group.activeChallenge.id}/add-members`,
        { memberIds: addMembersToChallengeSelected }
      );
      setShowAddMembersToChallengeModal(false);
      setAddMembersToChallengeSelected([]);
      if (response.data?.group) {
        setGroup(response.data.group);
        openEditChallengeHabitsModal(response.data.group);
      } else {
        await fetchGroupDetails();
      }
      showPageToast('success', 'Members added to challenge');
    } catch (error) {
      showPageToast('error', 'Failed to add members to challenge', error.response?.data?.error || 'Please try again.');
    } finally {
      setAddMembersToChallengeSubmitting(false);
    }
  }, [
    addMembersToChallengeSelected,
    fetchGroupDetails,
    group,
    groupId,
    openEditChallengeHabitsModal,
    setAddMembersToChallengeSelected,
    setAddMembersToChallengeSubmitting,
    setGroup,
    setShowAddMembersToChallengeModal,
    showPageToast
  ]);

  const toggleAddMemberToChallenge = useCallback((memberId) => {
    setAddMembersToChallengeSelected((prev) => (
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    ));
  }, [setAddMembersToChallengeSelected]);

  const handleCreateChallenge = useCallback(async (event) => {
    event.preventDefault();

    const habitsToSubmit = isEditingHabits ? memberHabits : lockedHabits;

    if (editChallengeHabitsMode) {
      try {
        const memberHabitsArray = Object.entries(habitsToSubmit).map(([memberId, habits]) => ({
          member: memberId,
          habits
        }));
        await axios.put(`/groups/${groupId}/challenge/${group.activeChallenge.id}/member-habits`, {
          memberHabits: memberHabitsArray
        });
        resetChallengeModalState();
        await fetchGroupDetails();
        showPageToast('success', 'Challenge habits saved');
      } catch (error) {
        console.error('Error updating challenge habits:', error);
        showPageToast('error', 'Failed to save habits', error.response?.data?.error || error.message);
      }
      return;
    }

    if (!newChallenge.startDate || !newChallenge.endDate) {
      showPageToast('error', 'Challenge dates required', 'Please select both start and end dates for the challenge.');
      return;
    }

    if (Object.keys(habitsToSubmit).length === 0) {
      showPageToast('error', 'No habits added', 'Please add at least one habit before creating the challenge.');
      return;
    }

    if (newChallenge.courseId) {
      const course = groupCourses.find((item) => item.id === newChallenge.courseId);
      if (course) {
        const sectionsCount = course.sections?.length || 0;
        const start = new Date(newChallenge.startDate);
        const end = new Date(newChallenge.endDate);
        const challengeWeeks = (end - start) / (7 * 24 * 60 * 60 * 1000);
        if (challengeWeeks < sectionsCount) {
          showPageToast('error', 'Challenge too short', `Challenge must be at least ${sectionsCount} weeks for this course (1 week per section).`);
          return;
        }
      }
    }

    try {
      const memberHabitsArray = Object.entries(habitsToSubmit).map(([memberId, habits]) => ({
        member: memberId,
        habits
      }));

      await axios.post('/groups/challenge', {
        groupId,
        startDate: newChallenge.startDate,
        endDate: newChallenge.endDate,
        memberHabits: memberHabitsArray,
        courseId: newChallenge.courseId || null,
        courseRequiredMemberIds: newChallenge.courseRequiredMemberIds || []
      });
      resetChallengeModalState();
      setNewChallenge((prev) => ({ ...prev, courseId: null, courseRequiredMemberIds: [] }));
      fetchGroupDetails();
      showPageToast('success', 'Challenge created');
    } catch (error) {
      console.error('Error creating challenge:', error);
      showPageToast('error', 'Failed to create challenge', error.response?.data?.error || error.message);
    }
  }, [
    editChallengeHabitsMode,
    fetchGroupDetails,
    group,
    groupCourses,
    groupId,
    isEditingHabits,
    lockedHabits,
    memberHabits,
    newChallenge,
    resetChallengeModalState,
    setNewChallenge,
    showPageToast
  ]);

  const membersWithHabits = useMemo(() => {
    const habitsToCheck = isEditingHabits ? memberHabits : lockedHabits;
    return Object.keys(habitsToCheck).filter((memberId) => habitsToCheck[memberId] && habitsToCheck[memberId].length > 0);
  }, [isEditingHabits, lockedHabits, memberHabits]);

  const getMissingMembers = useCallback(() => {
    const allMembers = group?.members || [];
    return allMembers.filter((member) => !membersWithHabits.includes(String(member.id)));
  }, [group, membersWithHabits]);

  const isChallengeValid = useCallback(() => {
    const allMembers = group?.members || [];
    return allMembers.length > 0 && allMembers.every((member) => membersWithHabits.includes(String(member.id)));
  }, [group, membersWithHabits]);

  return {
    handleLoadPreset,
    deleteActiveChallenge,
    handleAddMembersToChallenge,
    toggleAddMemberToChallenge,
    handleCreateChallenge,
    getMissingMembers,
    isChallengeValid
  };
};

export default useChallengeActions;
