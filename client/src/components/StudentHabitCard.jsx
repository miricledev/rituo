import React from 'react';

const StudentHabitCard = ({
  habit,
  habitIndex,
  isEditing,
  ticking,
  numericValue,
  textValue,
  tempNumericValue,
  tempTextValue,
  linkedGoalTitle,
  isHabitAvailableToday,
  getNextAvailableDay,
  onStartEdit,
  onCancelEdit,
  onToggleHabit,
  onNumericUpdate,
  onNumericSubmit,
  onTextUpdate,
  onTextSubmit
}) => {
  const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
  const today = new Date().toISOString().slice(0, 10);
  const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === today);
  const isComplete = progressEntry?.completed;
  const savedNumericValue = progressEntry?.numericValue;
  const savedTextValue = progressEntry?.textValue;
  const isAvailableToday = isHabitAvailableToday(habit);
  const nextAvailableDay = getNextAvailableDay(habit);

  return (
    <div
      className={`rounded-lg shadow-md p-3 sm:p-4 border transition-transform hover:scale-[1.01] ${
        isComplete
          ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700'
          : 'bg-white dark:bg-secondary-800 border-gray-200 dark:border-secondary-700'
      }`}
    >
      <div className="flex-1 min-w-0 mb-2 sm:mb-3">
        <div className="font-medium text-sm sm:text-base text-secondary-900 dark:text-white">{habit.name}</div>
        {habit.description && (
          <div className="text-sm text-secondary-500 dark:text-secondary-300 mt-1">{habit.description}</div>
        )}
        {linkedGoalTitle && (
          <div className="mt-2 inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
            Why: {linkedGoalTitle}
          </div>
        )}
      </div>

      {isComplete && !isEditing && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Completed</span>
          </div>
          <button
            onClick={() => onStartEdit(habitIndex, habit)}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Edit
          </button>
        </div>
      )}

      {isComplete && !isEditing && (
        <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
          {habit.habitType === 'numeric' && (
            <div className="text-sm text-green-800 dark:text-green-200">
              Value: {savedNumericValue !== undefined ? savedNumericValue : (habit.minValue || 0)}
            </div>
          )}
          {habit.habitType === 'text' && (
            <div className="text-sm text-green-800 dark:text-green-200">
              Response: {savedTextValue || 'No response'}
            </div>
          )}
        </div>
      )}

      {(!isComplete || isEditing) && (
        <>
          {(habit.habitType === 'boolean' || !habit.habitType) && (
            <>
              {isAvailableToday ? (
                <button
                  onClick={() => onToggleHabit(habitIndex)}
                  disabled={ticking}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${isComplete ? 'bg-primary-500 border-primary-500' : 'bg-transparent border-primary-400'} ${ticking ? 'opacity-60' : ''}`}
                >
                  {isComplete && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                    </svg>
                  )}
                  {ticking && (
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400">
                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                  </svg>
                  {nextAvailableDay && (
                    <span className="text-xs text-gray-400 text-center">
                      Available in {nextAvailableDay.hoursUntil}h
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {habit.habitType === 'numeric' && (
            <div className="space-y-2">
              {!isAvailableToday ? (
                <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                  </svg>
                  {nextAvailableDay && (
                    <span className="text-sm text-gray-400 text-center">
                      Available in {nextAvailableDay.hoursUntil}h
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-sm text-secondary-600 dark:text-secondary-400">
                    Range: {habit.minValue || 0} - {habit.maxValue || 10}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Value: {isEditing
                          ? (tempNumericValue !== undefined ? tempNumericValue : (habit.minValue || 0))
                          : (numericValue !== undefined ? numericValue : (habit.minValue || 0))}
                      </span>
                      <span className="text-sm text-secondary-500">
                        {habit.minValue || 0} - {habit.maxValue || 10}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={habit.minValue || 0}
                      max={habit.maxValue || 10}
                      step="1"
                      value={isEditing
                        ? (tempNumericValue !== undefined ? tempNumericValue : (habit.minValue || 0))
                        : (numericValue !== undefined ? numericValue : (habit.minValue || 0))}
                      onChange={(e) => onNumericUpdate(habitIndex, parseInt(e.target.value, 10), isEditing)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex gap-2">
                      {isEditing && (
                        <button
                          onClick={() => onCancelEdit(habitIndex)}
                          className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => onNumericSubmit(habitIndex, isEditing ? tempNumericValue : numericValue, isEditing)}
                        disabled={ticking || (isEditing ? tempNumericValue === undefined : numericValue === undefined)}
                        className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                      >
                        {ticking ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {habit.habitType === 'text' && (
            <div className="space-y-2">
              {!isAvailableToday ? (
                <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                  </svg>
                  {nextAvailableDay && (
                    <span className="text-sm text-gray-400 text-center">
                      Available in {nextAvailableDay.hoursUntil}h
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-sm text-secondary-600 dark:text-secondary-400">
                    {habit.prompt || 'Enter your response'}
                  </div>
                  <textarea
                    value={isEditing ? (tempTextValue || '') : (textValue || '')}
                    onChange={(e) => onTextUpdate(habitIndex, e.target.value, isEditing)}
                    placeholder="Enter your response..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <div className="flex gap-2">
                    {isEditing && (
                      <button
                        onClick={() => onCancelEdit(habitIndex)}
                        className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => onTextSubmit(habitIndex, isEditing ? tempTextValue : textValue, isEditing)}
                      disabled={ticking || (isEditing ? !tempTextValue?.trim() : !textValue?.trim())}
                      className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                      {ticking ? 'Saving...' : (isEditing ? 'Update' : 'Submit')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentHabitCard;
