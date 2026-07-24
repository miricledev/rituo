const ChallengeFormPanel = ({
  isEditingHabits,
  editor,
  editChallengeHabitsMode,
  newChallenge,
  lockedHabits,
  goBackToEditing,
  handleCreateChallenge
}) => {
  if (isEditingHabits) {
    return <div className="w-full lg:w-1/2 p-4 sm:p-6 overflow-y-auto">{editor}</div>;
  }

  return (
    <div className="w-full lg:w-1/2 p-4 sm:p-6 overflow-y-auto">
      <div className="space-y-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Challenge Summary</h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{newChallenge.startDate}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{newChallenge.endDate}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Habits</label>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {Object.values(lockedHabits).flat().length} habits across {Object.keys(lockedHabits).length} members
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <button
            type="button"
            onClick={goBackToEditing}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ← Go Back and Edit Habits
          </button>
        </div>

        <div className="mb-6">
          {editChallengeHabitsMode ? (
            <button
              type="button"
              onClick={(e) => handleCreateChallenge(e)}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Save habits
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => handleCreateChallenge(e)}
                disabled={!newChallenge.startDate || !newChallenge.endDate || Object.values(lockedHabits).flat().length === 0}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                🚀 Create Challenge
              </button>
              {(!newChallenge.startDate || !newChallenge.endDate || Object.values(lockedHabits).flat().length === 0) && (
                <p className="text-sm text-red-500 dark:text-red-400 mt-2 text-center">
                  Please complete all fields above
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChallengeFormPanel;
