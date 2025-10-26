import React, { useState, useMemo } from 'react';

const HabitCalendar = ({ habits, startDate, endDate, memberHabit }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Helper to get day name from date
  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Helper to check if a habit is scheduled for a specific day
  const isHabitScheduledForDay = (habit, date) => {
    // If no scheduleDays specified, treat as everyday (backward compatibility)
    if (!habit.scheduleDays || habit.scheduleDays.length === 0) {
      return true;
    }
    const dayName = getDayName(date);
    return habit.scheduleDays.includes(dayName);
  };
  
  // Generate all dates in the challenge period
  const challengeDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    const dates = [];
    let d = new Date(startDate);
    const end = new Date(endDate);
    
    while (d <= end) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  // Get habit completion data for each date
  const getHabitDataForDate = (date) => {
    const dateStr = date.toISOString().slice(0, 10);
    const habitData = {};
    
    habits.forEach((habit, idx) => {
      const isScheduled = isHabitScheduledForDay(habit, date);
      const progress = habit.progress || [];
      const dayProgress = progress.find(p => p.date.startsWith(dateStr));
      
      if (dayProgress) {
        habitData[idx] = {
          completed: dayProgress.completed,
          numericValue: dayProgress.numericValue,
          textValue: dayProgress.textValue,
          habitType: habit.habitType,
          isScheduled: isScheduled
        };
      } else {
        habitData[idx] = {
          completed: false,
          numericValue: null,
          textValue: null,
          habitType: habit.habitType,
          isScheduled: isScheduled
        };
      }
    });
    
    return habitData;
  };

  // Calculate consistency score for a date (percentage of habits completed)
  const getConsistencyScore = (date) => {
    const habitData = getHabitDataForDate(date);
    // Only count habits that are scheduled for this day
    const scheduledHabits = habits.filter((habit, idx) => isHabitScheduledForDay(habit, date));
    const completedCount = Object.entries(habitData).filter(([idx, h]) => 
      h.completed && isHabitScheduledForDay(habits[parseInt(idx)], date)
    ).length;
    return scheduledHabits.length > 0 ? (completedCount / scheduledHabits.length) * 100 : 0;
  };

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.toDateString() === today.toDateString();
      const isInChallenge = challengeDates.some(d => d.toDateString() === date.toDateString());
      const consistencyScore = isInChallenge ? getConsistencyScore(date) : null;
      
      days.push({
        date,
        isCurrentMonth,
        isToday,
        isInChallenge,
        consistencyScore,
        habitData: isInChallenge ? getHabitDataForDate(date) : {}
      });
    }
    
    return days;
  };

  const calendarDays = getCalendarDays();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const challengeDays = challengeDates.filter(date => {
      const dateStr = date.toISOString().slice(0, 10);
      return dateStr >= startDate && dateStr <= endDate;
    });

    let totalDays = 0; // Only count days where at least one habit is scheduled
    let perfectDays = 0;
    let goodDays = 0; // 75% or more
    let fairDays = 0; // 50% or more
    let poorDays = 0; // 25% or more
    let missedDays = 0;

    challengeDays.forEach(date => {
      const score = getConsistencyScore(date);
      // Only count days where at least one habit is scheduled
      const scheduledHabits = habits.filter(habit => isHabitScheduledForDay(habit, date));
      if (scheduledHabits.length > 0) {
        totalDays++;
        if (score === 100) perfectDays++;
        else if (score >= 75) goodDays++;
        else if (score >= 50) fairDays++;
        else if (score >= 25) poorDays++;
        else missedDays++;
      }
    });

    const averageConsistency = totalDays > 0 
      ? challengeDays.reduce((sum, date) => {
          const scheduledHabits = habits.filter(habit => isHabitScheduledForDay(habit, date));
          return scheduledHabits.length > 0 ? sum + getConsistencyScore(date) : sum;
        }, 0) / totalDays 
      : 0;

    return {
      totalDays,
      perfectDays,
      goodDays,
      fairDays,
      poorDays,
      missedDays,
      averageConsistency
    };
  }, [challengeDates, startDate, endDate, habits]);

  const getConsistencyColor = (score) => {
    if (score === null) return 'bg-gray-100 dark:bg-gray-700';
    if (score === 100) return 'bg-green-500';
    if (score >= 75) return 'bg-green-400';
    if (score >= 50) return 'bg-yellow-400';
    if (score >= 25) return 'bg-orange-400';
    if (score > 0) return 'bg-red-400';
    return 'bg-red-500';
  };

  const getConsistencyText = (score) => {
    if (score === null) return '';
    if (score === 100) return 'Perfect';
    if (score >= 75) return 'Great';
    if (score >= 50) return 'Good';
    if (score >= 25) return 'Fair';
    if (score > 0) return 'Poor';
    return 'None';
  };

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-secondary-900 dark:text-white">
          Habit Consistency Calendar
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-lg font-medium text-secondary-900 dark:text-white">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h4>
      </div>

      {/* Statistics Summary */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Challenge Summary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{overallStats.perfectDays}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Perfect Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{overallStats.goodDays + overallStats.fairDays}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Good Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{overallStats.poorDays}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Poor Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{overallStats.missedDays}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Missed Days</div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Average Consistency: {Math.round(overallStats.averageConsistency)}%
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Perfect (100%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-400"></div>
            <span className="text-gray-600 dark:text-gray-400">Great (75%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-400"></div>
            <span className="text-gray-600 dark:text-gray-400">Good (50%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-400"></div>
            <span className="text-gray-600 dark:text-gray-400">Fair (25%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-400"></div>
            <span className="text-gray-600 dark:text-gray-400">Poor (1%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-gray-600 dark:text-gray-400">None (0%)</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`
              aspect-square p-1 rounded-lg border-2 transition-all duration-200 cursor-pointer
              ${day.isCurrentMonth 
                ? 'border-gray-200 dark:border-gray-600' 
                : 'border-gray-100 dark:border-gray-700 opacity-50'
              }
              ${day.isToday ? 'ring-2 ring-primary-500' : ''}
              ${day.isInChallenge ? 'hover:shadow-md' : ''}
              ${selectedDate && selectedDate.toDateString() === day.date.toDateString() ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
            `}
            onClick={() => day.isInChallenge && setSelectedDate(day.date)}
            title={day.isInChallenge ? `${day.date.toLocaleDateString()}: ${getConsistencyText(day.consistencyScore)} (${Math.round(day.consistencyScore || 0)}%)` : ''}
          >
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {day.date.getDate()}
              </div>
              {day.isInChallenge && (
                <div className={`w-3 h-3 rounded-full ${getConsistencyColor(day.consistencyScore)}`}></div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h4>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Consistency:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                getConsistencyScore(selectedDate) === 100 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                getConsistencyScore(selectedDate) >= 75 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                getConsistencyScore(selectedDate) >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                getConsistencyScore(selectedDate) >= 25 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                getConsistencyScore(selectedDate) > 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {getConsistencyText(getConsistencyScore(selectedDate))} ({Math.round(getConsistencyScore(selectedDate))}%)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {habits.map((habit, idx) => {
              const habitData = getHabitDataForDate(selectedDate)[idx];
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-1">
                    <h5 className="font-medium text-secondary-900 dark:text-white">{habit.name}</h5>
                    {habit.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{habit.description}</p>
                    )}
                    {habitData.completed && habitData.numericValue !== null && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Value: {habitData.numericValue}
                      </p>
                    )}
                    {habitData.completed && habitData.textValue && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Note: {habitData.textValue}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {!habitData.isScheduled ? (
                      <div className="flex flex-col items-center gap-1 opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400">
                          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        habitData.completed 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      }`}>
                        {habitData.completed ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile: Show habit details for selected date */}
      <div className="mt-6 lg:hidden">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Tap a date to see habit details
        </div>
      </div>
    </div>
  );
};

export default HabitCalendar;
