export const calculateNumericProgress = (habit, progressEntry) => {
  if (!progressEntry || progressEntry.numericValue === undefined) return 0;
  const min = habit.minValue || 0;
  const max = habit.maxValue || 10;
  const value = progressEntry.numericValue;
  if (max === min) return value >= max ? 100 : 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
};

export const getProgressColorClasses = (percentage) => {
  if (percentage >= 80) {
    return {
      bg: 'bg-green-100 dark:bg-green-900/40',
      border: 'border-green-300 dark:border-green-700',
      text: 'text-green-800 dark:text-green-200'
    };
  }
  if (percentage >= 50) {
    return {
      bg: 'bg-yellow-100 dark:bg-yellow-900/40',
      border: 'border-yellow-300 dark:border-yellow-700',
      text: 'text-yellow-800 dark:text-yellow-200'
    };
  }
  if (percentage >= 20) {
    return {
      bg: 'bg-orange-100 dark:bg-orange-900/40',
      border: 'border-orange-300 dark:border-orange-700',
      text: 'text-orange-800 dark:text-orange-200'
    };
  }
  return {
    bg: 'bg-red-100 dark:bg-red-900/40',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-800 dark:text-red-200'
  };
};

export const calculateOverallCompletionRate = (memberHabits) => {
  let totalWeight = 0;
  let totalProgress = 0;

  memberHabits.forEach((memberHabit) => {
    memberHabit.habits.forEach((habit) => {
      const today = new Date().toISOString().slice(0, 10);
      const progressEntry = (habit.progress || []).find((entry) => entry.date && entry.date.slice(0, 10) === today);

      totalWeight += 100;

      if (progressEntry) {
        if (habit.habitType === 'numeric') {
          totalProgress += calculateNumericProgress(habit, progressEntry);
        } else {
          totalProgress += progressEntry.completed ? 100 : 0;
        }
      }
    });
  });

  return totalWeight > 0 ? totalProgress / totalWeight : 0;
};

export const calculateTodayCompletionRate = (memberHabit, isHabitAvailableToday) => {
  if (!memberHabit?.habits || memberHabit.habits.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let totalProgress = 0;
  let scheduledCount = 0;

  memberHabit.habits.forEach((habit) => {
    if (!isHabitAvailableToday(habit)) {
      return;
    }

    scheduledCount += 1;
    const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
    const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === today);

    if (progressEntry && progressEntry.completed) {
      if (habit.habitType === 'numeric') {
        totalProgress += calculateNumericProgress(habit, progressEntry);
      } else {
        totalProgress += 100;
      }
    }
  });

  return scheduledCount > 0 ? totalProgress / scheduledCount : 0;
};

export const getPercentageColor = (percentage) => {
  if (percentage === 0) return 'text-red-500 dark:text-red-400';
  if (percentage < 50) return 'text-orange-500 dark:text-orange-400';
  if (percentage < 100) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-green-500 dark:text-green-400';
};
