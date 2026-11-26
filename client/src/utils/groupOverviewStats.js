import { calculateHabitProgress } from './habitProgressUtils';
import { formatDateLocal as formatLocalDate, isHabitScheduledForDay } from './habitScheduleUtils';

const matchesDate = (entryDate, dateStr, formatDateLocal) => {
  if (!entryDate) return false;

  if (entryDate.slice(0, 10) === dateStr) return true;
  const progressDate = new Date(entryDate);
  return Number.isFinite(progressDate.getTime()) && formatDateLocal(progressDate) === dateStr;
};

export const calculateUserTodayTotal = (memberHabit) => {
  if (!memberHabit?.habits?.length) return 0;

  const today = formatLocalDate(new Date());
  let userTotal = 0;

  memberHabit.habits.forEach((habit) => {
    const progress = (habit.progress || []).find((entry) => entry.date && entry.date.slice(0, 10) === today);
    userTotal += calculateHabitProgress(habit, progress);
  });

  return userTotal;
};

export const calculateMemberCompletionRate = (memberHabit) => {
  if (!memberHabit?.habits?.length) return 0;

  const todayDate = new Date();
  const today = formatLocalDate(todayDate);
  const scheduledHabits = memberHabit.habits.filter((habit) => isHabitScheduledForDay(habit, todayDate));
  const total = scheduledHabits.reduce((acc, habit) => {
    const progressEntry = (habit.progress || []).find((entry) => entry.date && entry.date.slice(0, 10) === today);
    return acc + calculateHabitProgress(habit, progressEntry);
  }, 0);

  return scheduledHabits.length ? total / scheduledHabits.length : 0;
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

    userTotal += calculateHabitProgress(habit, progress);
  });

  return scheduledCount > 0 ? userTotal / scheduledCount : null;
};

export const calculateTodayScheduledProgress = (memberHabit, getDayName) => {
  if (!memberHabit?.habits?.length) return 0;

  const today = new Date();
  const todayStr = formatLocalDate(today);
  const dayName = getDayName(today);
  const scheduledHabits = memberHabit.habits.filter((habit) => isHabitScheduledForDay(habit, dayName));

  return scheduledHabits.reduce((acc, habit) => {
    const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
    const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === todayStr);
    return acc + calculateHabitProgress(habit, progressEntry);
  }, 0);
};
