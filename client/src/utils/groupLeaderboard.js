import {
  formatDateLocal,
  isHabitScheduledForDay
} from './habitScheduleUtils.js';
import { calculateHabitProgress } from './habitProgressUtils.js';

const getMemberId = (memberHabit) => memberHabit?.member?.id ?? memberHabit?.member;

const getProgressEntry = (habit, dateKey) => (
  (habit?.progress || []).find((entry) => entry.date?.slice(0, 10) === dateKey)
);

const getHabitProgressOnDate = (habit, date) => (
  calculateHabitProgress(habit, getProgressEntry(habit, formatDateLocal(date)))
);

const isHabitCompleteOnDate = (habit, date) => getHabitProgressOnDate(habit, date) >= 100;

const startOfDay = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseDateKey = (value) => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const shiftDate = (date, amount) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
};

export const calculateHabitStreak = (habit, referenceDate = new Date(), minimumDate = null) => {
  const today = startOfDay(referenceDate);
  const earliestDate = minimumDate ? startOfDay(minimumDate) : null;
  const completedToday = isHabitCompleteOnDate(habit, today);
  let cursor = completedToday ? today : shiftDate(today, -1);
  let streak = 0;
  let scannedDays = 0;

  while (scannedDays < 3660) {
    if (earliestDate && cursor < earliestDate) break;
    if (isHabitScheduledForDay(habit, cursor)) {
      const progressEntry = getProgressEntry(habit, formatDateLocal(cursor));
      if (isHabitCompleteOnDate(habit, cursor)) {
        streak += 1;
      } else if (!progressEntry?.streakRestored) {
        break;
      }
    }

    cursor = shiftDate(cursor, -1);
    scannedDays += 1;
  }

  return streak;
};

const buildPeriodStanding = ({ students, memberHabitMap, userId, dates, referenceDate, challengeStart }) => students
  .map((member) => {
    const memberHabit = memberHabitMap.get(String(member.id));
    const habits = memberHabit?.habits || [];
    const joinedAt = parseDateKey(memberHabit?.joinedAt);
    const effectiveStart = joinedAt && challengeStart && joinedAt > challengeStart ? joinedAt : (joinedAt || challengeStart);
    let completed = 0;
    let opportunities = 0;

    dates.forEach((date) => {
      if (effectiveStart && date < effectiveStart) return;
      habits.forEach((habit) => {
        if (!isHabitScheduledForDay(habit, date)) return;
        opportunities += 1;
        completed += getHabitProgressOnDate(habit, date) / 100;
      });
    });

    const streak = Math.max(0, ...habits.map((habit) => calculateHabitStreak(habit, referenceDate, effectiveStart)));
    const displayName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.username || 'Student';

    return {
      member,
      displayName,
      completed: Math.round(completed * 100) / 100,
      opportunities,
      percentage: opportunities ? Math.round((completed / opportunities) * 100) : 0,
      streak,
      isCurrentUser: String(member.id) === String(userId)
    };
  })
  .sort((left, right) => (
    right.percentage - left.percentage
    || right.completed - left.completed
    || right.streak - left.streak
    || left.displayName.localeCompare(right.displayName)
  ));

export const buildStudentCompetitionData = ({
  activeChallenge,
  members = [],
  userId,
  referenceDate = new Date()
}) => {
  const students = members.filter((member) => (member.accountRole || 'student') === 'student');
  const memberHabitMap = new Map(
    (activeChallenge?.memberHabits || []).map((memberHabit) => [String(getMemberId(memberHabit)), memberHabit])
  );
  const today = startOfDay(referenceDate);
  const challengeStart = parseDateKey(activeChallenge?.startDate);
  const mondayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = shiftDate(today, -mondayOffset);
  const weekDates = Array.from({ length: mondayOffset + 1 }, (_, index) => shiftDate(monday, index))
    .filter((day) => !challengeStart || day >= challengeStart);
  const dailyDates = !challengeStart || today >= challengeStart ? [today] : [];

  return {
    studentCount: students.length,
    daily: buildPeriodStanding({ students, memberHabitMap, userId, dates: dailyDates, referenceDate: today, challengeStart }),
    weekly: buildPeriodStanding({ students, memberHabitMap, userId, dates: weekDates, referenceDate: today, challengeStart })
  };
};

export const buildLeaderboardData = ({ activeChallenge, members, leader, userId, getDayName }) => {
  if (!activeChallenge?.memberHabits?.length) return [];

  return activeChallenge.memberHabits
    .map((memberHabit) => {
      const member = members?.find((item) => String(item.id) === String(getMemberId(memberHabit)));
      if (!member) return null;

      const challengeStart = parseDateKey(activeChallenge.startDate);
      const joinedAt = parseDateKey(memberHabit.joinedAt);
      const effectiveStart = joinedAt && challengeStart && joinedAt > challengeStart ? joinedAt : (joinedAt || challengeStart);

      const habitStreaks = memberHabit.habits?.map((habit) => ({
        habitName: habit.name,
        streak: calculateHabitStreak(habit, new Date(), effectiveStart),
        habitType: habit.habitType
      })) || [];

      const today = new Date();
      const todayKey = formatDateLocal(today);
      const dayName = getDayName(todayKey);
      const scheduledHabits = memberHabit.habits?.filter(
        (habit) => !habit.scheduleDays || habit.scheduleDays.length === 0 || habit.scheduleDays.includes(dayName)
      ) || [];

      const maxStreak = Math.max(...habitStreaks.map((habit) => habit.streak), 0);
      const totalHabits = scheduledHabits.length;
      const completedToday = scheduledHabits.reduce(
        (sum, habit) => sum + (calculateHabitProgress(habit, getProgressEntry(habit, todayKey)) / 100),
        0
      );
      const totalCompleted = (memberHabit.habits || []).reduce(
        (sum, habit) => sum + (habit.progress || []).reduce(
          (habitSum, progressEntry) => habitSum + (calculateHabitProgress(habit, progressEntry) / 100),
          0
        ),
        0
      );

      const maxPossibleStreak = 30;
      const streakScore = Math.min((maxStreak / maxPossibleStreak) * 100, 100);
      const completionScore = totalHabits
        ? Math.min((completedToday / totalHabits) * 100, 100)
        : 0;
      const weightedScore = (streakScore * 0.6) + (completionScore * 0.4);

      return {
        member,
        maxStreak,
        totalHabits,
        completedToday: Math.round(completedToday * 100) / 100,
        totalCompleted: Math.round(totalCompleted * 100) / 100,
        weightedScore,
        habitStreaks,
        isLeader: leader && String(leader.id) === String(member.id),
        isCurrentUser: userId && String(userId) === String(member.id)
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.weightedScore - left.weightedScore);
};
