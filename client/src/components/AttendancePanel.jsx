const AttendancePanel = ({
  attendance,
  attendanceLoading,
  expandedAttendance,
  setExpandedAttendance
}) => (
  <div>
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">Member Attendance</h2>
      <p className="text-secondary-600 dark:text-secondary-400 mb-4">Track member participation and activity in the current challenge.</p>
    </div>

    {attendanceLoading ? (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    ) : attendance && attendance.length > 0 ? (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
            <div className="text-sm text-primary-600 dark:text-primary-400 font-medium">Total Members</div>
            <div className="text-2xl font-semibold text-secondary-900 dark:text-white">
              {attendance.length}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">Average Attendance</div>
            <div className="text-2xl font-semibold text-secondary-900 dark:text-white">
              {attendance.length > 0 ? Math.round(attendance.reduce((sum, member) => sum + member.attendance_rate, 0) / attendance.length) : 0}%
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Most Active</div>
            <div className="text-2xl font-semibold text-secondary-900 dark:text-white">
              {attendance.length > 0 ? attendance[0].username : 'N/A'}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {attendance.map((member, index) => (
            <div key={member.member_id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200">
                      #{index + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-200 to-secondary-400 dark:from-secondary-900 dark:to-secondary-700 flex items-center justify-center text-sm font-bold text-secondary-700 dark:text-secondary-200">
                      {member.username[0].toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
                      {member.username}
                    </h3>
                    <div className="text-sm text-secondary-500 dark:text-secondary-400">
                      {member.days_active}/{member.total_days} days active
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-secondary-900 dark:text-white">
                    {member.attendance_rate}%
                  </div>
                  <div className="text-sm text-secondary-500 dark:text-secondary-400">
                    Attendance Rate
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Recent Activity {member.recent_activity.length > 0 && `(Last ${member.recent_activity.length} Day${member.recent_activity.length !== 1 ? 's' : ''})`}
                </h4>
                <div className="flex gap-2">
                  {member.recent_activity.map((day, idx) => {
                    const dateParts = day.date.split('-');
                    const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    return (
                      <div
                        key={idx}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                          day.active
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                        title={`${localDate.toLocaleDateString()}: ${day.active ? 'Active' : 'Inactive'}`}
                      >
                        {localDate.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {member.last_active && (
                <div className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                  Last active: {(() => {
                    const dateParts = member.last_active.split('-');
                    const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    return localDate.toLocaleDateString();
                  })()}
                </div>
              )}

              <button
                onClick={() => {
                  setExpandedAttendance((prev) => ({
                    ...prev,
                    [member.member_id]: !prev[member.member_id]
                  }));
                }}
                className="w-full mt-3 py-2 px-4 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {expandedAttendance[member.member_id] ? 'Hide' : 'View'} Full Attendance History
              </button>

              {expandedAttendance[member.member_id] && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-secondary-900/50 rounded-lg border border-gray-200 dark:border-secondary-700">
                  {member.full_attendance && member.full_attendance.length > 0 ? (
                    <>
                      <h4 className="text-sm font-semibold text-secondary-900 dark:text-white mb-3">
                        Complete Attendance ({member.full_attendance.length} days)
                      </h4>
                      <div className="overflow-x-auto -mx-2 px-2">
                        <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-2 min-w-max">
                          {member.full_attendance.map((day, idx) => {
                            const dateParts = day.date.split('-');
                            const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                            return (
                              <div
                                key={idx}
                                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium p-1 ${
                                  day.active
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-2 border-green-300 dark:border-green-700'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
                                }`}
                                title={`${localDate.toLocaleDateString()}: ${day.active ? 'Active' : 'Inactive'}`}
                              >
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {localDate.toLocaleDateString('en-US', { month: 'short' })}
                                </div>
                                <div className="font-bold">
                                  {localDate.getDate()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-secondary-500 dark:text-secondary-400 py-4">
                      <p>No attendance data available</p>
                      <p className="text-xs mt-2">Debug: {JSON.stringify(member.full_attendance)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">Attendance</div>
        <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
          No Active Challenge
        </h3>
        <p className="text-secondary-600 dark:text-secondary-400">
          Attendance tracking is only available during active challenges.
        </p>
      </div>
    )}
  </div>
);

export default AttendancePanel;
