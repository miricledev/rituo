const ChallengeSettingsSection = ({
  habitPresets,
  handleLoadPreset,
  newChallenge,
  setNewChallenge,
  getDateString,
  groupCourses,
  groupMembers
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Challenge Settings</h3>
        {habitPresets.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleLoadPreset(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <option value="">Load Preset...</option>
              {habitPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
          <div className="space-y-2">
            <input
              type="date"
              value={newChallenge.startDate}
              onChange={(e) => setNewChallenge({ ...newChallenge, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newChallenge.startDate === getDateString(0)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setNewChallenge({ ...newChallenge, startDate: getDateString(0) });
                  }
                }}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-gray-700 dark:text-gray-300">Start today</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
          <div className="space-y-2">
            <input
              type="date"
              value={newChallenge.endDate}
              onChange={(e) => setNewChallenge({ ...newChallenge, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
            <div className="flex flex-wrap gap-3">
              {[7, 14, 30].map((days) => (
                <label key={days} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newChallenge.endDate === getDateString(days)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewChallenge({ ...newChallenge, endDate: getDateString(days) });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{days} days</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <label className="flex items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-200 mb-3">
          <input
            type="checkbox"
            checked={!!newChallenge.courseId}
            onChange={(e) => {
              if (e.target.checked && groupCourses.length > 0) {
                setNewChallenge({ ...newChallenge, courseId: groupCourses[0].id, courseRequiredMemberIds: [] });
              } else {
                setNewChallenge({ ...newChallenge, courseId: null, courseRequiredMemberIds: [] });
              }
            }}
            className="w-4 h-4 text-purple-600 rounded"
          />
          Add course (TikTok-style videos + quizzes)
        </label>

        {newChallenge.courseId && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Course</label>
              <select
                value={newChallenge.courseId || ''}
                onChange={(e) => setNewChallenge({ ...newChallenge, courseId: e.target.value ? parseInt(e.target.value, 10) : null })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                {groupCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.sections?.length || 0} sections{course.groupName ? ` · ${course.groupName}` : ''})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Who must complete</label>
              <select
                value={newChallenge.courseRequiredMemberIds === null || (Array.isArray(newChallenge.courseRequiredMemberIds) && newChallenge.courseRequiredMemberIds.length === 0) ? 'all' : 'select'}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setNewChallenge({ ...newChallenge, courseRequiredMemberIds: [] });
                  } else {
                    setNewChallenge({ ...newChallenge, courseRequiredMemberIds: (groupMembers || []).map((member) => member.id) });
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="all">All members</option>
                <option value="select">Select specific members</option>
              </select>

              {Array.isArray(newChallenge.courseRequiredMemberIds) && newChallenge.courseRequiredMemberIds.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {(groupMembers || []).map((member) => (
                    <label key={member.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newChallenge.courseRequiredMemberIds.includes(member.id)}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...(newChallenge.courseRequiredMemberIds || []), member.id]
                            : (newChallenge.courseRequiredMemberIds || []).filter((id) => id !== member.id);
                          setNewChallenge({ ...newChallenge, courseRequiredMemberIds: ids });
                        }}
                        className="rounded"
                      />
                      {member.username}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Challenge must be at least as many weeks as course sections. Students need 75% to pass each section.
            </p>
          </div>
        )}

        {groupCourses.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">Create a course in the Course tab first.</p>
        )}
      </div>
    </div>
  );
};

export default ChallengeSettingsSection;
