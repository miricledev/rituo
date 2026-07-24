import React from 'react';

const ColorChartPanel = ({
  isLeader,
  isCoach,
  selectedColorChartMember,
  setSelectedColorChartMember,
  availableMembers,
  group,
  user,
  renderColorChart
}) => {
  return (
    <div>
      {(isLeader || isCoach) ? (
        !selectedColorChartMember ? (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🎨 Skill Development Charts</h2>
              <p className="text-secondary-600 dark:text-secondary-400 mb-4">
                {isCoach ? 'Select a student to manage their skill development chart.' : 'Select a member to manage their skill development chart.'}
              </p>
            </div>

            {availableMembers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {availableMembers.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 cursor-pointer transition-transform transform hover:scale-105 hover:shadow-xl border border-gray-200 dark:border-secondary-700"
                    onClick={() => setSelectedColorChartMember(member)}
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                          {member.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
                        {member.username}
                      </h3>
                      <p className="text-sm text-secondary-600 dark:text-secondary-400">
                        Click to view skill chart
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                  No Members Yet
                </h3>
                <p className="text-secondary-600 dark:text-secondary-400">
                  {isCoach ? 'No students are assigned to you yet.' : 'There are no members in this group yet.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <button
                onClick={() => setSelectedColorChartMember(null)}
                className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-4"
              >
                <span>←</span>
                <span>Back to members</span>
              </button>
              <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
                🎨 {selectedColorChartMember.username}'s Skill Development Chart
              </h2>
              <p className="text-secondary-600 dark:text-secondary-400">
                Manage skill development chart for {selectedColorChartMember.username}.
              </p>
            </div>

            {renderColorChart({
              memberHabit: { member: selectedColorChartMember.id },
              group,
              selectedMember: selectedColorChartMember
            })}
          </div>
        )
      ) : (
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🎨 My Skill Development Chart</h2>
            <p className="text-secondary-600 dark:text-secondary-400 mb-4">
              Track and develop your personal skills.
            </p>
          </div>

          {renderColorChart({
            memberHabit: { member: user?.id },
            group,
            selectedMember: user
          })}
        </div>
      )}
    </div>
  );
};

export default ColorChartPanel;
