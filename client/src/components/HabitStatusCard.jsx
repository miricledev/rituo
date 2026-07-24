import React from 'react';
import { calculateNumericProgress, getProgressColorClasses } from '../utils/habitProgressUtils';

const HabitStatusCard = ({
  habit,
  cardKey,
  isHabitAvailableToday,
  getNextAvailableDay
}) => {
  const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
  const today = new Date().toISOString().slice(0, 10);
  const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === today);
  const isComplete = progressEntry?.completed;
  const numericValue = progressEntry?.numericValue;
  const textValue = progressEntry?.textValue;

  let progressPercentage = 0;
  let colorClasses = {
    bg: 'bg-gray-100 dark:bg-secondary-700',
    border: 'border-gray-200 dark:border-secondary-600',
    text: 'text-gray-800 dark:text-gray-200'
  };

  if (isComplete) {
    if (habit.habitType === 'numeric') {
      progressPercentage = calculateNumericProgress(habit, progressEntry);
      colorClasses = getProgressColorClasses(progressPercentage);
    } else {
      progressPercentage = 100;
      colorClasses = {
        bg: 'bg-green-100 dark:bg-green-900/40',
        border: 'border-green-300 dark:border-green-700',
        text: 'text-green-800 dark:text-green-200'
      };
    }
  }

  const nextAvailableDay = getNextAvailableDay(habit);

  return (
    <div
      key={cardKey}
      className={`rounded-lg p-3 flex flex-col gap-2 border transition-colors duration-200 ${colorClasses.bg} ${colorClasses.border}`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-medium ${colorClasses.text}`}>{habit.name}</span>
        {isComplete && (
          <div className="flex items-center gap-1">
            {habit.habitType === 'numeric' && (
              <span className={`text-xs font-medium ${colorClasses.text}`}>
                {progressPercentage.toFixed(0)}%
              </span>
            )}
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {habit.description && (
        <span className={`text-xs ${colorClasses.text} opacity-80`}>{habit.description}</span>
      )}

      {isComplete && (
        <div className={`mt-2 p-2 rounded border ${colorClasses.border} ${colorClasses.bg} bg-opacity-50`}>
          {habit.habitType === 'numeric' && (
            <div className="space-y-1">
              <div className={`text-sm font-medium ${colorClasses.text}`}>
                Value: {numericValue !== undefined ? numericValue : (habit.minValue || 0)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Range: {habit.minValue || 0} - {habit.maxValue || 10}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className={`h-2 rounded-full ${
                    progressPercentage >= 80 ? 'bg-green-500' :
                    progressPercentage >= 50 ? 'bg-yellow-500' :
                    progressPercentage >= 20 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}

          {habit.habitType === 'text' && (
            <div className="space-y-1">
              <div className={`text-sm font-medium ${colorClasses.text}`}>
                Response:
              </div>
              <div className={`text-sm ${colorClasses.text} bg-white dark:bg-gray-800 p-2 rounded border`}>
                {textValue || 'No response provided'}
              </div>
            </div>
          )}

          {(habit.habitType === 'boolean' || !habit.habitType) && (
            <div className={`text-sm ${colorClasses.text}`}>
              Completed
            </div>
          )}
        </div>
      )}

      {!isComplete && (
        <div className="flex items-center gap-2">
          {!isHabitAvailableToday(habit) ? (
            <div className="flex flex-col items-center gap-1 opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-400">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
              {nextAvailableDay && (
                <span className="text-xs text-gray-400 text-center">
                  In {nextAvailableDay.hoursUntil}h
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Not completed today
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HabitStatusCard;
