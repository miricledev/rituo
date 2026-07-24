import { useMemo } from 'react';
import { buildLeaderboardData } from '../utils/groupLeaderboard';

const useGroupDetailViewModel = ({
  group,
  schoolProfiles,
  user,
  getDayName,
  conversations,
  searchQuery,
  getGoalForStudent,
  handleTempNumericUpdate,
  handleNumericHabitUpdate,
  handleEditNumericSubmit,
  handleNumericHabitSubmit,
  handleTempTextUpdate,
  handleTextHabitUpdate,
  handleEditTextSubmit,
  handleTextHabitSubmit
}) => {
  const membersNotInChallenge = useMemo(() => {
    if (!group?.members?.length || !group?.activeChallenge?.memberHabits?.length) return [];
    const inChallengeIds = new Set(
      group.activeChallenge.memberHabits.map((mh) => String(mh.member?.id ?? mh.member))
    );
    return group.members.filter((member) => !inChallengeIds.has(String(member.id)));
  }, [group]);

  const schoolProfileMap = useMemo(
    () => Object.fromEntries((schoolProfiles || []).map((profile) => [String(profile.student.id), profile])),
    [schoolProfiles]
  );

  const mySchoolProfile = schoolProfileMap[String(user?.id)];

  const leaderboardData = useMemo(() => buildLeaderboardData({
    activeChallenge: group?.activeChallenge,
    members: group?.members,
    leader: group?.leader,
    userId: user?.id,
    getDayName
  }), [group, user?.id, getDayName]);

  const filteredConversations = useMemo(
    () => conversations.filter((conv) => conv.username.toLowerCase().includes(searchQuery.toLowerCase())),
    [conversations, searchQuery]
  );

  const getLinkedGoalTitle = (habit) => getGoalForStudent(user?.id, habit.linkedGoalId)?.title;

  const handleStudentNumericUpdate = (habitIndex, value, isEditing) => {
    if (isEditing) {
      handleTempNumericUpdate(habitIndex, value);
      return;
    }
    handleNumericHabitUpdate(habitIndex, value);
  };

  const handleStudentNumericSubmit = (habitIndex, value, isEditing) => (
    isEditing
      ? handleEditNumericSubmit(habitIndex, value)
      : handleNumericHabitSubmit(habitIndex, value)
  );

  const handleStudentTextUpdate = (habitIndex, value, isEditing) => {
    if (isEditing) {
      handleTempTextUpdate(habitIndex, value);
      return;
    }
    handleTextHabitUpdate(habitIndex, value);
  };

  const handleStudentTextSubmit = (habitIndex, value, isEditing) => (
    isEditing
      ? handleEditTextSubmit(habitIndex, value)
      : handleTextHabitSubmit(habitIndex, value)
  );

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return messageTime.toLocaleDateString();
  };

  return {
    membersNotInChallenge,
    schoolProfileMap,
    mySchoolProfile,
    leaderboardData,
    filteredConversations,
    getLinkedGoalTitle,
    handleStudentNumericUpdate,
    handleStudentNumericSubmit,
    handleStudentTextUpdate,
    handleStudentTextSubmit,
    formatRelativeTime
  };
};

export default useGroupDetailViewModel;
