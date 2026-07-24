const useChallengeValidation = ({
  group,
  isEditingHabits,
  memberHabits,
  lockedHabits
}) => {
  const getDateString = (daysFromToday) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    return date.toISOString().slice(0, 10);
  };

  const getAllMembers = () => {
    return group?.members || [];
  };

  const getMembersWithHabits = () => {
    const habitsToCheck = isEditingHabits ? memberHabits : lockedHabits;
    return Object.keys(habitsToCheck).filter((memberId) =>
      habitsToCheck[memberId] && habitsToCheck[memberId].length > 0
    );
  };

  const getMissingMembers = () => {
    const allMembers = getAllMembers();
    const membersWithHabits = getMembersWithHabits();
    return allMembers.filter((member) => !membersWithHabits.includes(String(member.id)));
  };

  const isChallengeValid = () => {
    const allMembers = getAllMembers();
    const membersWithHabits = getMembersWithHabits();
    return allMembers.length > 0 && allMembers.every((member) => membersWithHabits.includes(String(member.id)));
  };

  return {
    getDateString,
    getMissingMembers,
    isChallengeValid
  };
};

export default useChallengeValidation;
