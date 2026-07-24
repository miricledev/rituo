import { calculateNumericProgress } from './habitProgressUtils';
import { isHabitScheduledForDay } from './habitScheduleUtils';

const matchesDate = (entryDate, dateStr, formatDateLocal) => {
  if (!entryDate) return false;

  const progressDate = new Date(entryDate);
  const targetDate = new Date(dateStr);

  return (
    progressDate.toDateString() === targetDate.toDateString()
    || entryDate.slice(0, 10) === dateStr
    || formatDateLocal(progressDate) === dateStr
  );
};

export const calculateUserTodayTotal = (memberHabit) => {
  if (!memberHabit?.habits?.length) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let userTotal = 0;

  memberHabit.habits.forEach((habit) => {
    const progress = (habit.progress || []).find((entry) => entry.date && entry.date.slice(0, 10) === today);
    if (!progress?.completed) return;

    if (habit.habitType === 'numeric') {
      userTotal += calculateNumericProgress(habit, progress);
    } else {
      userTotal += 100;
    }
  });

  return userTotal;
};

export const calculateMemberCompletionRate = (memberHabit) => {
  if (!memberHabit?.habits?.length) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const total = memberHabit.habits.reduce((acc, habit) => {
    const progressEntry = (habit.progress || []).find((entry) => entry.date && entry.date.slice(0, 10) === today);
    if (!progressEntry?.completed) return acc;

    if (habit.habitType === 'numeric') {
      return acc + calculateNumericProgress(habit, progressEntry);
    }

    return acc + 100;
  }, 0);

  return total / memberHabit.habits.length;
};

export const calculateScheduledAverageForDate = (habits, dateStr, getDayName, formatDateLocal) => {
  if (!habits?.length) return null;

  const dayName = getDayName(dateStr);
  let userTotal = 0;
  let scheduledCount = 0;

  habits.forEach((habit) => {
    if (!isHabitScheduledForDay(habit, dayName)) {
      return;
    }

    scheduledCount += 1;
    const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
    const progress = habitProgress.find((entry) => matchesDate(entry.date, dateStr, formatDateLocal));

    if (!progress) {
      return;
    }

    if (habit.habitType === 'numeric') {
      userTotal += calculateNumericProgress(habit, progress);
    } else {
      userTotal += progress.completed ? 100 : 0;
    }
  });

  return scheduledCount > 0 ? userTotal / scheduledCount : null;
};

export const calculateTodayScheduledProgress = (memberHabit, getDayName) => {
  if (!memberHabit?.habits?.length) return 0;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayName = getDayName(today);
  const scheduledHabits = memberHabit.habits.filter((habit) => isHabitScheduledForDay(habit, dayName));

  return scheduledHabits.reduce((acc, habit) => {
    const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
    const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === todayStr);
    if (!progressEntry) return acc;

    if (habit.habitType === 'numeric') {
      return acc + calculateNumericProgress(habit, progressEntry);
    }

    return acc + (progressEntry.completed ? 100 : 0);
  }, 0);
};
