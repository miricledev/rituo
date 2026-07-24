export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateLocal = (dateStr) => {
  if (!dateStr) return new Date();

  const normalizedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [year, month, day] = normalizedDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getDayName = (date) => {
  let dateObj;

  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    dateObj = new Date(year, month - 1, day);
  } else {
    dateObj = date;
  }

  return DAY_NAMES[dateObj.getDay()];
};

export const isHabitAvailableToday = (habit) => {
  return isHabitScheduledForDay(habit, new Date());
};

export const isHabitScheduledForDay = (habit, date) => {
  if (!habit.scheduleDays || habit.scheduleDays.length === 0) {
    return true;
  }

  const dayName = DAY_NAMES.includes(date) ? date : getDayName(date);
  return habit.scheduleDays.includes(dayName);
};

export const getNextAvailableDayFromDate = (habit, fromDate) => {
  if (!habit.scheduleDays || habit.scheduleDays.length === 0) {
    return null;
  }

  const baseDate = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const todayIndex = baseDate.getDay();

  for (let i = 1; i <= 7; i += 1) {
    const nextDay = DAY_NAMES[(todayIndex + i) % 7];
    if (habit.scheduleDays.includes(nextDay)) {
      return { day: nextDay, hoursUntil: i * 24 };
    }
  }

  return null;
};

export const getNextAvailableDay = (habit) => getNextAvailableDayFromDate(habit, new Date());
