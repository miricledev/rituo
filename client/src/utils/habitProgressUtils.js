import { formatDateLocal, isHabitScheduledForDay } from './habitScheduleUtils';

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value) || 0));

export const calculateNumericProgress = (habit, progressEntry) => {
  if (!progressEntry || progressEntry.numericValue === undefined) return 0;
  const min = Number(habit.minValue ?? 0);
  const max = Number(habit.maxValue ?? 10);
  const value = Number(progressEntry.numericValue);
  if (max === min) return value >= max ? 100 : 0;
  return clampPercentage(((value - min) / (max - min)) * 100);
};

export const getPeriodicProgress = (habit, progressEntry) => {
  const target = Math.max(1, Number(progressEntry?.periodicTarget ?? habit?.periodicOccurrences) || 4);
  const loggedOccurrences = Array.isArray(progressEntry?.periodicLoggedOccurrences)
    ? new Set(progressEntry.periodicLoggedOccurrences.map(String)).size
    : 0;
  const recordedOccurrences = Math.max(0, Number(progressEntry?.periodicCompleted) || 0);
  const hasGranularProgress = Boolean(progressEntry) && (
    Object.prototype.hasOwnProperty.call(progressEntry, 'periodicCompleted')
    || Object.prototype.hasOwnProperty.call(progressEntry, 'periodicLoggedOccurrences')
    || Object.prototype.hasOwnProperty.call(progressEntry, 'periodicTarget')
  );
  const completed = progressEntry?.completed && !hasGranularProgress
    ? target
    : Math.min(target, Math.max(loggedOccurrences, recordedOccurrences));
  return { completed, target, percentage: clampPercentage((completed / target) * 100) };
};

export const calculateHabitProgress = (habit, progressEntry) => {
  if (!progressEntry) return 0;
  if (habit?.habitType === 'periodic') return getPeriodicProgress(habit, progressEntry).percentage;
  if (habit?.habitType === 'numeric') {
    if (progressEntry.numericValue === undefined || progressEntry.numericValue === null) {
      return progressEntry.completed ? 100 : 0;
    }
    return calculateNumericProgress(habit, progressEntry);
  }
  return progressEntry.completed ? 100 : 0;
};

export const getHabitProgressState = (habit, progressEntry) => {
  const percentage = calculateHabitProgress(habit, progressEntry);
  return {
    percentage,
    isComplete: percentage >= 100,
    isPartial: percentage > 0 && percentage < 100,
    hasProgress: percentage > 0,
    periodic: habit?.habitType === 'periodic' ? getPeriodicProgress(habit, progressEntry) : null
  };
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
      const todayDate = new Date();
      if (!isHabitScheduledForDay(habit, todayDate)) return;
      const today = formatDateLocal(todayDate);
      const progressEntry = (habit.progress || []).find((entry) => entry.date && entry.date.slice(0, 10) === today);

      totalWeight += 100;
      totalProgress += calculateHabitProgress(habit, progressEntry);
    });
  });

  return totalWeight > 0 ? totalProgress / totalWeight : 0;
};

export const calculateTodayCompletionRate = (memberHabit, isHabitAvailableToday) => {
  if (!memberHabit?.habits || memberHabit.habits.length === 0) return 0;

  const today = formatDateLocal(new Date());
  let totalProgress = 0;
  let scheduledCount = 0;

  memberHabit.habits.forEach((habit) => {
    if (!isHabitAvailableToday(habit)) {
      return;
    }

    scheduledCount += 1;
    const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
    const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === today);

    totalProgress += calculateHabitProgress(habit, progressEntry);
  });

  return scheduledCount > 0 ? totalProgress / scheduledCount : 0;
};

export const getPercentageColor = (percentage) => {
  if (percentage === 0) return 'text-red-500 dark:text-red-400';
  if (percentage < 50) return 'text-orange-500 dark:text-orange-400';
  if (percentage < 100) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-green-500 dark:text-green-400';
};
