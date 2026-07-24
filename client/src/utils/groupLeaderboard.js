const getCurrentHabitStreak = (habit) => {
  const today = new Date().toISOString().slice(0, 10);
  let currentStreak = 0;
  let lastDate = new Date(today);

  while (true) {
    const dateStr = lastDate.toISOString().slice(0, 10);
    const progressEntry = (habit.progress || []).find((entry) => entry.date && entry.date.slice(0, 10) === dateStr);

    if (progressEntry && progressEntry.completed) {
      currentStreak += 1;
      lastDate.setDate(lastDate.getDate() - 1);
    } else {
      break;
    }
  }

  return currentStreak;
};

export const buildLeaderboardData = ({ activeChallenge, members, leader, userId, getDayName }) => {
  if (!activeChallenge?.memberHabits?.length) return [];

  return activeChallenge.memberHabits
    .map((memberHabit) => {
      const member = members?.find(
        (item) => String(item.id) === String(memberHabit.member) || String(item.id) === String(memberHabit.member?.id)
      );
      if (!member) return null;

      const habitStreaks = memberHabit.habits?.map((habit) => ({
        habitName: habit.name,
        streak: getCurrentHabitStreak(habit),
        habitType: habit.habitType
      })) || [];

      const today = new Date();
      const dayName = getDayName(today.toISOString().slice(0, 10));
      const scheduledHabits = memberHabit.habits?.filter(
        (habit) => !habit.scheduleDays || habit.scheduleDays.length === 0 || habit.scheduleDays.includes(dayName)
      ) || [];

      const maxStreak = Math.max(...habitStreaks.map((habit) => habit.streak), 0);
      const totalHabits = scheduledHabits.length;
      const completedToday = habitStreaks.filter((habit, idx) => {
        const sourceHabit = memberHabit.habits[idx];
        const isScheduled = !sourceHabit.scheduleDays || sourceHabit.scheduleDays.length === 0 || sourceHabit.scheduleDays.includes(dayName);
        return isScheduled && habit.streak > 0;
      }).length;
      const totalCompleted = habitStreaks.reduce((sum, habit) => sum + habit.streak, 0);

      const maxPossibleStreak = 30;
      const maxPossibleCompletions = totalHabits * 30;
      const streakScore = Math.min((maxStreak / maxPossibleStreak) * 100, 100);
      const completionScore = Math.min((totalCompleted / maxPossibleCompletions) * 100, 100);
      const weightedScore = (streakScore * 0.6) + (completionScore * 0.4);

      return {
        member,
        maxStreak,
        totalHabits,
        completedToday,
        totalCompleted,
        weightedScore,
        habitStreaks,
        isLeader: leader && String(leader.id) === String(member.id),
        isCurrentUser: userId && String(userId) === String(member.id)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weightedScore - a.weightedScore);
};
