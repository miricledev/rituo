import { useMemo, useState } from 'react';
import { createEmptyCurrentHabit } from '../utils/groupDetailDefaults';

const useChallengeModal = ({ group }) => {
  const [showCreateChallengeModal, setShowCreateChallengeModal] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    startDate: '',
    endDate: '',
    memberHabits: [],
    courseId: null,
    courseRequiredMemberIds: []
  });
  const [currentHabit, setCurrentHabit] = useState(createEmptyCurrentHabit);
  const [memberHabits, setMemberHabits] = useState({});
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [collapsedMembersInModal, setCollapsedMembersInModal] = useState({});
  const [lockedHabits, setLockedHabits] = useState({});
  const [isEditingHabits, setIsEditingHabits] = useState(true);
  const [editChallengeHabitsMode, setEditChallengeHabitsMode] = useState(false);
  const [lockedChallengeMemberIds, setLockedChallengeMemberIds] = useState(new Set());

  const hasHabitsAdded = useMemo(
    () => Object.values(memberHabits).flat().length > 0 || Object.values(lockedHabits).flat().length > 0,
    [memberHabits, lockedHabits]
  );

  const resetChallengeModalState = () => {
    setShowCreateChallengeModal(false);
    setShowCancelConfirm(false);
    setEditChallengeHabitsMode(false);
    setLockedChallengeMemberIds(new Set());
    setMemberHabits({});
    setLockedHabits({});
    setCollapsedMembersInModal({});
    setIsEditingHabits(true);
    setCurrentHabit(createEmptyCurrentHabit());
  };

  const handleCancel = () => {
    if (hasHabitsAdded) {
      setShowCancelConfirm(true);
    } else {
      setShowCreateChallengeModal(false);
    }
  };

  const confirmCancel = () => {
    resetChallengeModalState();
  };

  const toggleMemberCollapseInModal = (memberId) => {
    setCollapsedMembersInModal((prev) => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  const expandAllMembersInModal = () => {
    setCollapsedMembersInModal({});
  };

  const collapseAllMembersInModal = () => {
    const allCollapsed = {};
    Object.keys(memberHabits).forEach((memberId) => {
      allCollapsed[memberId] = true;
    });
    setCollapsedMembersInModal(allCollapsed);
  };

  const lockHabitsAndShowOverview = () => {
    if (Object.values(memberHabits).flat().length > 0) {
      setLockedHabits({ ...memberHabits });
      setIsEditingHabits(false);
    }
  };

  const goBackToEditing = () => {
    setIsEditingHabits(true);
  };

  const openEditChallengeHabitsModal = (groupData) => {
    const data = groupData || group;
    const memberHabitsList = data?.activeChallenge?.memberHabits;
    if (!memberHabitsList) return;

    const fromChallenge = {};
    memberHabitsList.forEach((memberHabit) => {
      const memberId = memberHabit.member?.id ?? memberHabit.member;
      if (memberId != null) {
        fromChallenge[String(memberId)] = memberHabit.habits || [];
      }
    });

    setMemberHabits(fromChallenge);
    setLockedHabits({});
    setIsEditingHabits(true);
    setEditChallengeHabitsMode(true);
    setLockedChallengeMemberIds(
      new Set(Object.entries(fromChallenge).filter(([, habits]) => habits.length > 0).map(([id]) => id))
    );
    setShowCreateChallengeModal(true);
  };

  const openCreateChallengeModal = () => {
    setEditChallengeHabitsMode(false);
    setLockedChallengeMemberIds(new Set());
    setShowCreateChallengeModal(true);
  };

  return {
    showCreateChallengeModal,
    setShowCreateChallengeModal,
    newChallenge,
    setNewChallenge,
    currentHabit,
    setCurrentHabit,
    memberHabits,
    setMemberHabits,
    showCancelConfirm,
    setShowCancelConfirm,
    collapsedMembersInModal,
    lockedHabits,
    isEditingHabits,
    setIsEditingHabits,
    editChallengeHabitsMode,
    setEditChallengeHabitsMode,
    lockedChallengeMemberIds,
    setLockedChallengeMemberIds,
    hasHabitsAdded,
    resetChallengeModalState,
    handleCancel,
    confirmCancel,
    toggleMemberCollapseInModal,
    expandAllMembersInModal,
    collapseAllMembersInModal,
    lockHabitsAndShowOverview,
    goBackToEditing,
    openEditChallengeHabitsModal,
    openCreateChallengeModal
  };
};

export default useChallengeModal;
