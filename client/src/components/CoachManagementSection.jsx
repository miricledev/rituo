import CoachAssignmentModal from './CoachAssignmentModal';

const CoachManagementSection = ({
  coaches,
  coachAssignments,
  group,
  selectedCoachForAssignment,
  setCoachAssignments,
  setSelectedCoachForAssignment,
  setShowCoachAssignmentModal,
  showCoachAssignmentModal,
  onAssignStudents,
  onDemoteCoach,
  onPromoteCoach
}) => {
  const promotableMembers = group?.members?.filter((member) => {
    const isLeader = group.leader && String(group.leader.id) === String(member.id);
    const isCoach = coaches.some((coach) => coach.id === member.id);
    return !isLeader && !isCoach;
  }) || [];

  const closeCoachAssignmentModal = () => {
    setShowCoachAssignmentModal(false);
    setSelectedCoachForAssignment(null);
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">Coach Management</h2>
            <p className="text-secondary-600 dark:text-secondary-400">
              Promote members to coaches and assign them specific students to monitor
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Current Coaches</h3>
        {coaches.length === 0 ? (
          <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-8 text-center border border-gray-200 dark:border-secondary-700">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">No Coaches Yet</h3>
            <p className="text-secondary-500 dark:text-secondary-400">Promote members to coaches to help manage students</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => {
              const assignedStudents = coachAssignments[coach.id] || [];
              const studentCount = assignedStudents.length;

              return (
                <div key={coach.id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xl font-bold text-primary-700 dark:text-primary-200">
                        {coach.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">{coach.username}</h4>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400">{coach.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onDemoteCoach(coach.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove coach"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400 mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>{studentCount} {studentCount === 1 ? 'student' : 'students'} assigned</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCoachForAssignment(coach);
                      setShowCoachAssignmentModal(true);
                    }}
                    className="w-full py-2 px-4 rounded-lg font-medium transition-colors bg-primary-600 hover:bg-primary-700 text-white"
                  >
                    Manage Students
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Promote Members to Coaches</h3>
        <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700">
          {promotableMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {promotableMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-secondary-700 rounded-lg hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200">
                      {member.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-secondary-900 dark:text-white">{member.username}</div>
                      <div className="text-xs text-secondary-500 dark:text-secondary-400">{member.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onPromoteCoach(member.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    Promote
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary-500 dark:text-secondary-400">No members available to promote</p>
          )}
        </div>
      </div>

      {showCoachAssignmentModal && selectedCoachForAssignment && (
        <CoachAssignmentModal
          coach={selectedCoachForAssignment}
          group={group}
          coachAssignments={coachAssignments}
          setCoachAssignments={setCoachAssignments}
          onClose={closeCoachAssignmentModal}
          onSave={onAssignStudents}
        />
      )}
    </div>
  );
};

export default CoachManagementSection;
