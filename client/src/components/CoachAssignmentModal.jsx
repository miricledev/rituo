const CoachAssignmentModal = ({
  coach,
  group,
  coachAssignments,
  setCoachAssignments,
  onClose,
  onSave
}) => {
  if (!coach) {
    return null;
  }

  const availableMembers = group?.members?.filter((member) => {
    const isLeader = group.leader && String(group.leader.id) === String(member.id);
    const isCoach = member.id === coach.id;
    return !isLeader && !isCoach;
  }) || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-secondary-700">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-secondary-900 dark:text-white">
              Assign Students to {coach.username}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-secondary-600 dark:text-secondary-400 mb-4">
            Select which students this coach can monitor and edit. Coaches can only see and edit color charts for their assigned students.
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availableMembers.map((member) => {
              const currentAssignments = coachAssignments[coach.id] || [];
              const isAssigned = currentAssignments.includes(member.id);

              return (
                <label
                  key={member.id}
                  className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    onChange={(e) => {
                      setCoachAssignments({
                        ...coachAssignments,
                        [coach.id]: e.target.checked
                          ? [...currentAssignments, member.id]
                          : currentAssignments.filter((id) => id !== member.id)
                      });
                    }}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200">
                      {member.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-secondary-900 dark:text-white">{member.username}</div>
                      <div className="text-xs text-secondary-500 dark:text-secondary-400">{member.email}</div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-secondary-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-secondary-700 dark:text-secondary-300 hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(coach.id, coachAssignments[coach.id] || [])}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
          >
            Save Assignments
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachAssignmentModal;
