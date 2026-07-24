import { useMemo } from 'react';

const useColorChartAccess = ({ group, user, coaches, coachAssignments, isLeader }) => {
  const isCoach = useMemo(() => {
    return ['teacher', 'pastoral-lead', 'coach'].includes(group?.viewerSchoolRole) || (group?.coaches && user
      ? group.coaches.some((coach) => String(coach.id) === String(user.id))
      : false) || (
      coaches && user
        ? coaches.some((coach) => String(coach.id) === String(user.id))
        : false
    );
  }, [coaches, group?.coaches, group?.viewerSchoolRole, user]);

  const assignedStudents = useMemo(() => {
    if (!isCoach || !user || !coachAssignments) return [];
    return coachAssignments[user.id] || [];
  }, [coachAssignments, isCoach, user]);

  const availableMembers = useMemo(() => {
    if (!group?.members) return [];
    if (isLeader) return group.members;
    if (isCoach) {
      return group.members.filter((member) => assignedStudents.includes(member.id));
    }
    return [];
  }, [assignedStudents, group?.members, isCoach, isLeader]);

  return {
    isCoach,
    assignedStudents,
    availableMembers
  };
};

export default useColorChartAccess;
