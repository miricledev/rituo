import React from 'react';
import StudentHabitCard from './StudentHabitCard';

const StudentChecklistSection = ({
  isMember,
  isLeader,
  myMemberHabit,
  timeUntilMidnight,
  editingHabits,
  ticking,
  numericValues,
  textValues,
  tempNumericValues,
  tempTextValues,
  getLinkedGoalTitle,
  isHabitAvailableToday,
  getNextAvailableDay,
  handleStartEdit,
  handleCancelEdit,
  handleToggleHabit,
  handleStudentNumericUpdate,
  handleStudentNumericSubmit,
  handleStudentTextUpdate,
  handleStudentTextSubmit
}) => {
  if (!(isMember && !isLeader && myMemberHabit)) {
    return null;
  }

  const hasCombatHabits = myMemberHabit.habits.some((habit) => habit.combatType === 'attack' || habit.combatType === 'defence');

  return (
    <div className="mb-8 sm:mb-10">
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
        <h2 className="text-lg sm:text-xl font-semibold">Today&apos;s Group Habits</h2>
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 dark:text-blue-400">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
            {timeUntilMidnight}
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400">until reset</span>
        </div>
      </div>

      {hasCombatHabits ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M21 3l-1 1M3 21l1-1M21 3l-10 10M3 21l10-10M9 3l3 3M15 21l-3-3M21 9l-3 3M3 15l3-3M21 21l-1-1M3 3l1 1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Attack Habits
            </h3>
            <div className="space-y-3">
              {myMemberHabit.habits.map((habit, originalIdx) => {
                if (habit.combatType !== 'attack' && habit.combatType) return null;
                const idx = originalIdx;
                return (
                  <StudentHabitCard
                    key={idx}
                    habit={habit}
                    habitIndex={idx}
                    isEditing={editingHabits[idx]}
                    ticking={ticking[idx]}
                    numericValue={numericValues[idx]}
                    textValue={textValues[idx]}
                    tempNumericValue={tempNumericValues[idx]}
                    tempTextValue={tempTextValues[idx]}
                    linkedGoalTitle={getLinkedGoalTitle(habit)}
                    isHabitAvailableToday={isHabitAvailableToday}
                    getNextAvailableDay={getNextAvailableDay}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onToggleHabit={handleToggleHabit}
                    onNumericUpdate={handleStudentNumericUpdate}
                    onNumericSubmit={handleStudentNumericSubmit}
                    onTextUpdate={handleStudentTextUpdate}
                    onTextSubmit={handleStudentTextSubmit}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Defence Habits
            </h3>
            <div className="space-y-3">
              {myMemberHabit.habits.map((habit, originalIdx) => {
                if (habit.combatType !== 'defence') return null;
                const idx = originalIdx;
                return (
                  <StudentHabitCard
                    key={idx}
                    habit={habit}
                    habitIndex={idx}
                    isEditing={editingHabits[idx]}
                    ticking={ticking[idx]}
                    numericValue={numericValues[idx]}
                    textValue={textValues[idx]}
                    tempNumericValue={tempNumericValues[idx]}
                    tempTextValue={tempTextValues[idx]}
                    linkedGoalTitle={getLinkedGoalTitle(habit)}
                    isHabitAvailableToday={isHabitAvailableToday}
                    getNextAvailableDay={getNextAvailableDay}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onToggleHabit={handleToggleHabit}
                    onNumericUpdate={handleStudentNumericUpdate}
                    onNumericSubmit={handleStudentNumericSubmit}
                    onTextUpdate={handleStudentTextUpdate}
                    onTextSubmit={handleStudentTextSubmit}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {myMemberHabit.habits.map((habit, idx) => (
            <StudentHabitCard
              key={idx}
              habit={habit}
              habitIndex={idx}
              isEditing={editingHabits[idx]}
              ticking={ticking[idx]}
              numericValue={numericValues[idx]}
              textValue={textValues[idx]}
              tempNumericValue={tempNumericValues[idx]}
              tempTextValue={tempTextValues[idx]}
              linkedGoalTitle={getLinkedGoalTitle(habit)}
              isHabitAvailableToday={isHabitAvailableToday}
              getNextAvailableDay={getNextAvailableDay}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onToggleHabit={handleToggleHabit}
              onNumericUpdate={handleStudentNumericUpdate}
              onNumericSubmit={handleStudentNumericSubmit}
              onTextUpdate={handleStudentTextUpdate}
              onTextSubmit={handleStudentTextSubmit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentChecklistSection;
