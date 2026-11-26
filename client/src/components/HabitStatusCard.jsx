import React from 'react';
import { FiCheck, FiLock } from 'react-icons/fi';
import { getHabitProgressState, getProgressColorClasses } from '../utils/habitProgressUtils';
import { formatDateLocal } from '../utils/habitScheduleUtils';

const HabitStatusCard = ({
  habit,
  cardKey,
  isHabitAvailableToday,
  getNextAvailableDay
}) => {
  const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
  const today = formatDateLocal(new Date());
  const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === today);
  const progressState = getHabitProgressState(habit, progressEntry);
  const isComplete = progressState.isComplete;
  const numericValue = progressEntry?.numericValue;
  const textValue = progressEntry?.textValue;

  const progressPercentage = progressState.percentage;
  let colorClasses = {
    bg: 'bg-gray-100 dark:bg-secondary-700',
    border: 'border-gray-200 dark:border-secondary-600',
    text: 'text-gray-800 dark:text-gray-200'
  };

  if (progressState.hasProgress) {
    colorClasses = getProgressColorClasses(progressPercentage);
  }

  const nextAvailableDay = getNextAvailableDay(habit);

  return (
    <div
      key={cardKey}
      className={`flex flex-col gap-2 rounded-xl border p-3.5 transition-all duration-200 ${colorClasses.bg} ${colorClasses.border}`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-medium ${colorClasses.text}`}>{habit.name}</span>
        {progressState.hasProgress && (
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium ${colorClasses.text}`}>{progressPercentage.toFixed(0)}%</span>
            {isComplete ? <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><FiCheck className="h-3 w-3" /></div> : null}
          </div>
        )}
      </div>

      {habit.description && (
        <span className={`text-xs ${colorClasses.text} opacity-80`}>{habit.description}</span>
      )}

      {progressState.hasProgress && (
        <div className={`mt-2 rounded-xl border p-2.5 ${colorClasses.border} ${colorClasses.bg} bg-opacity-50`}>
          {habit.habitType === 'numeric' && (
            <div className="space-y-1">
              <div className={`text-sm font-medium ${colorClasses.text}`}>
                Value: {numericValue !== undefined ? numericValue : (habit.minValue || 0)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Range: {habit.minValue || 0} - {habit.maxValue || 10}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
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
              <div className={`rounded-lg border border-slate-200 bg-white/70 p-2 text-sm dark:border-white/10 dark:bg-black/10 ${colorClasses.text}`}>
                {textValue || 'No response provided'}
              </div>
            </div>
          )}

          {(habit.habitType === 'boolean' || habit.habitType === 'periodic' || !habit.habitType) && (
            <div className={`text-sm ${colorClasses.text}`}>
              {habit.habitType === 'periodic'
                ? `${progressState.periodic.completed}/${progressState.periodic.target} occurrences completed`
                : isComplete ? 'Completed' : `${progressPercentage.toFixed(0)}% progress`}
            </div>
          )}
        </div>
      )}

      {!isComplete && (
        <div className="flex items-center gap-2">
          {!isHabitAvailableToday(habit) ? (
            <div className="flex flex-col items-center gap-1 opacity-50">
              <FiLock className="h-5 w-5 text-slate-400" />
              {nextAvailableDay && (
                <span className="text-xs text-gray-400 text-center">
                  In {nextAvailableDay.hoursUntil}h
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {progressState.isPartial ? `${progressPercentage.toFixed(0)}% completed today` : 'No progress recorded today'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HabitStatusCard;
