import React from 'react';

const HabitPresetsPanel = ({
  activeTab,
  isLeader,
  habitPresets,
  group,
  onCreatePreset,
  onEditPreset,
  onDeletePreset,
  onLoadPreset
}) => {
  if (!(activeTab === 'presets' && isLeader)) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">Habit Presets</h2>
            <p className="text-secondary-600 dark:text-secondary-400">Create and manage habit templates to quickly set up challenges</p>
          </div>
          <button
            onClick={onCreatePreset}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
          >
            + Create Preset
          </button>
        </div>
      </div>

      {habitPresets.length === 0 ? (
        <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-12 text-center border border-gray-200 dark:border-secondary-700">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">No Presets Yet</h3>
          <p className="text-secondary-500 dark:text-secondary-400 mb-6">Create your first habit preset to save time when setting up challenges</p>
          <button
            onClick={onCreatePreset}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Your First Preset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {habitPresets.map((preset) => (
            <div key={preset.id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700 hover:shadow-2xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-secondary-900 dark:text-white">{preset.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditPreset(preset.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit preset"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeletePreset(preset.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete preset"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{preset.habits.length} {preset.habits.length === 1 ? 'habit' : 'habits'}</span>
                </div>
              </div>

              <div className="mb-4 max-h-32 overflow-y-auto">
                <div className="space-y-2">
                  {preset.habits.slice(0, 3).map((habit, idx) => (
                    <div key={idx} className="text-sm text-secondary-700 dark:text-secondary-300 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        habit.combatType === 'attack' ? 'bg-blue-500' :
                        habit.combatType === 'defence' ? 'bg-red-500' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="truncate">{habit.name || 'Untitled habit'}</span>
                    </div>
                  ))}
                  {preset.habits.length > 3 && (
                    <div className="text-xs text-secondary-500 dark:text-secondary-400">
                      + {preset.habits.length - 3} more
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => onLoadPreset(preset.id)}
                disabled={!!group?.activeChallenge}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  group?.activeChallenge
                    ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                {group?.activeChallenge ? 'Challenge Active' : 'Load Preset'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HabitPresetsPanel;
