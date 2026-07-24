import { DAY_NAMES } from '../utils/habitScheduleUtils';

const DAYS = DAY_NAMES;

const HabitPresetModal = ({
  editingPresetId,
  onAddPresetHabit,
  onClose,
  onRemovePresetHabit,
  onSavePreset,
  onUpdatePresetHabit,
  presetFormData,
  setPresetFormData
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
    <div className="bg-white dark:bg-secondary-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900 dark:text-white">
            {editingPresetId ? 'Edit Preset' : 'Create Preset'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preset Name</label>
          <input
            type="text"
            value={presetFormData.name}
            onChange={(event) => setPresetFormData({ ...presetFormData, name: event.target.value })}
            placeholder="e.g., Morning Routine, Daily Fitness"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
              Habits ({presetFormData.habits.length})
            </h3>
            <button
              onClick={onAddPresetHabit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + Add Habit
            </button>
          </div>

          {presetFormData.habits.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">No habits yet. Click "Add Habit" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {presetFormData.habits.map((habit, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Habit Name</label>
                        <input
                          type="text"
                          value={habit.name}
                          onChange={(event) => onUpdatePresetHabit(index, 'name', event.target.value)}
                          placeholder="e.g., Drink Water"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['boolean', 'numeric', 'text'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => onUpdatePresetHabit(index, 'habitType', type)}
                              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                habit.habitType === type
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`}
                            >
                              {type === 'boolean' ? 'Checkbox' : type === 'numeric' ? 'Numeric' : 'Text'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {habit.habitType === 'numeric' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Min</label>
                            <input
                              type="number"
                              value={habit.minValue ?? ''}
                              onChange={(event) => onUpdatePresetHabit(index, 'minValue', event.target.value === '' ? undefined : parseInt(event.target.value, 10) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Max</label>
                            <input
                              type="number"
                              value={habit.maxValue ?? ''}
                              onChange={(event) => onUpdatePresetHabit(index, 'maxValue', event.target.value === '' ? undefined : parseInt(event.target.value, 10) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                            />
                          </div>
                        </div>
                      )}

                      {habit.habitType === 'text' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt</label>
                          <input
                            type="text"
                            value={habit.prompt || ''}
                            onChange={(event) => onUpdatePresetHabit(index, 'prompt', event.target.value)}
                            placeholder="e.g., What did you learn today?"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated minutes</label>
                        <input
                          type="number"
                          min="5"
                          max="240"
                          step="5"
                          value={habit.durationMinutes || 30}
                          onChange={(event) => onUpdatePresetHabit(index, 'durationMinutes', Number(event.target.value) || 30)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Combat Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['neutral', 'attack', 'defence'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => onUpdatePresetHabit(index, 'combatType', type)}
                              className={`px-2 py-1 text-xs rounded border transition-colors ${
                                habit.combatType === type
                                  ? type === 'attack'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                    : type === 'defence'
                                      ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                      : 'border-gray-500 bg-gray-100 dark:bg-gray-600'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule Days</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => onUpdatePresetHabit(index, 'scheduleDays', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])}
                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                              habit.scheduleDays?.length === 7
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Everyday
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePresetHabit(index, 'scheduleDays', ['Monday', 'Wednesday', 'Friday'])}
                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                              JSON.stringify((habit.scheduleDays || []).sort()) === JSON.stringify(['Friday', 'Monday', 'Wednesday'].sort())
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Mon, Wed, Fri
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePresetHabit(index, 'scheduleDays', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                              JSON.stringify((habit.scheduleDays || []).sort()) === JSON.stringify(['Friday', 'Monday', 'Thursday', 'Tuesday', 'Wednesday'].sort())
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Weekdays
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {DAYS.map((day) => (
                            <label
                              key={day}
                              className={`flex flex-col items-center p-1.5 border rounded-lg cursor-pointer transition-colors ${
                                (habit.scheduleDays || []).includes(day)
                                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                                  : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={(habit.scheduleDays || []).includes(day)}
                                onChange={(event) => {
                                  const currentDays = habit.scheduleDays || [];
                                  if (event.target.checked) {
                                    onUpdatePresetHabit(index, 'scheduleDays', [...currentDays, day]);
                                  } else {
                                    onUpdatePresetHabit(index, 'scheduleDays', currentDays.filter((scheduledDay) => scheduledDay !== day));
                                  }
                                }}
                                className="sr-only"
                              />
                              <span className="text-xs font-medium">{day.slice(0, 3)}</span>
                            </label>
                          ))}
                        </div>

                        {(!habit.scheduleDays || habit.scheduleDays.length === 0) && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                            Please select at least one day for the habit schedule
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onRemovePresetHabit(index)}
                      className="ml-4 text-red-500 hover:text-red-700 dark:text-red-400"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSavePreset}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          {editingPresetId ? 'Update Preset' : 'Save Preset'}
        </button>
      </div>
    </div>
  </div>
);

export default HabitPresetModal;
