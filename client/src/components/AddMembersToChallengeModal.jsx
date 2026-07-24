const AddMembersToChallengeModal = ({
  activeChallenge,
  membersNotInChallenge,
  selectedMemberIds,
  onToggleMember,
  onClose,
  onSubmit,
  submitting
}) => {
  if (!activeChallenge) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-secondary-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-2 text-secondary-900 dark:text-white">Add members to challenge</h2>
        <p className="text-secondary-700 dark:text-secondary-300 mb-3 text-sm">
          Same challenge dates: <strong>{new Date(activeChallenge.startDate).toLocaleDateString()}</strong> - <strong>{new Date(activeChallenge.endDate).toLocaleDateString()}</strong>. New members start with no habits; use <strong>Set habits</strong> after adding them to assign habits on the habit setting screen.
        </p>
        <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-4">
          {membersNotInChallenge.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No members available to add.</p>
          ) : (
            <ul className="space-y-2">
              {membersNotInChallenge.map((member) => (
                <li key={member.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`add-member-${member.id}`}
                    checked={selectedMemberIds.includes(member.id)}
                    onChange={() => onToggleMember(member.id)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor={`add-member-${member.id}`} className="cursor-pointer text-secondary-800 dark:text-white">
                    {member.username || member.email || `Member ${member.id}`}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 dark:bg-secondary-700 text-secondary-800 dark:text-white hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || selectedMemberIds.length === 0}
            className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding...' : `Add ${selectedMemberIds.length || ''} member(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMembersToChallengeModal;
