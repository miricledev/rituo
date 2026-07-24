const GroupManagementSection = ({
  deleteGroupConfirmText,
  group,
  setDeleteGroupConfirmText,
  setShowDeleteGroupStep,
  showDeleteGroupStep,
  onDeleteGroup
}) => {
  const workspaceLabel = group?.groupType === 'school' ? 'School' : 'Group';

  return (
  <div>
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">{workspaceLabel} Management</h2>
      <p className="text-secondary-600 dark:text-secondary-400">Manage workspace settings and delete the {workspaceLabel.toLowerCase()}</p>
    </div>

    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg border border-gray-200 dark:border-secondary-700 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Danger Zone</h3>
        <div className="border-2 border-red-300 dark:border-red-700 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
          <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">Delete {workspaceLabel}</h4>
          <p className="text-sm text-red-700 dark:text-red-400 mb-4">
            Permanently delete this {workspaceLabel.toLowerCase()} and all its data. This action cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteGroupStep(1)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Delete {workspaceLabel}
          </button>
        </div>
      </div>
    </div>

    {showDeleteGroupStep > 0 && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-2xl max-w-md w-full p-6">
          {showDeleteGroupStep === 1 && (
            <>
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Step 1: Confirm Deletion</h3>
              <p className="text-secondary-600 dark:text-secondary-400 mb-6">
                You are about to delete the group <strong>{group?.name}</strong>. This will permanently remove:
              </p>
              <ul className="list-disc list-inside text-secondary-600 dark:text-secondary-400 mb-6 space-y-2">
                <li>All group members and their data</li>
                <li>All challenges and habit tracking</li>
                <li>All messages and conversations</li>
                <li>All skill development charts</li>
                <li>All coach assignments</li>
              </ul>
              <p className="text-red-600 dark:text-red-400 font-semibold mb-6">This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteGroupStep(0);
                    setDeleteGroupConfirmText('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-secondary-700 dark:text-secondary-300 hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowDeleteGroupStep(2)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                >
                  I Understand, Continue
                </button>
              </div>
            </>
          )}

          {showDeleteGroupStep === 2 && (
            <>
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Step 2: Type to Confirm</h3>
              <p className="text-secondary-600 dark:text-secondary-400 mb-4">
                Type <strong>DELETE</strong> to confirm you want to permanently delete this group:
              </p>
              <input
                type="text"
                value={deleteGroupConfirmText}
                onChange={(event) => setDeleteGroupConfirmText(event.target.value)}
                placeholder="Type DELETE"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white mb-6 focus:ring-2 focus:ring-red-500"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteGroupStep(1);
                    setDeleteGroupConfirmText('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-secondary-700 dark:text-secondary-300 hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (deleteGroupConfirmText === 'DELETE') {
                      setShowDeleteGroupStep(3);
                    }
                  }}
                  disabled={deleteGroupConfirmText !== 'DELETE'}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    deleteGroupConfirmText === 'DELETE'
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {showDeleteGroupStep === 3 && (
            <>
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Step 3: Final Confirmation</h3>
              <p className="text-secondary-600 dark:text-secondary-400 mb-6">
                This is your last chance to cancel. Are you absolutely sure you want to delete <strong>{group?.name}</strong>?
              </p>
              <p className="text-red-600 dark:text-red-400 font-semibold mb-6">
                All data will be permanently lost and cannot be recovered.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteGroupStep(2)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-secondary-700 dark:text-secondary-300 hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setShowDeleteGroupStep(0);
                    setDeleteGroupConfirmText('');
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onDeleteGroup}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Yes, Delete Forever
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  </div>
  );
};

export default GroupManagementSection;
