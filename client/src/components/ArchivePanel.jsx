import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { getArchiveBestPerformer } from '../utils/archiveHelpers';

const ArchivePanel = ({ archivesLoading, archives }) => {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">📚 Challenge Archives</h2>
        <p className="text-secondary-600 dark:text-secondary-400 mb-4">View completed challenges and their statistics.</p>
      </div>

      <div className="space-y-6">
        {archivesLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : archives && archives.length > 0 ? (
          archives.map((archive) => (
            <div key={archive.id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                    {archive.title}
                  </h3>
                  <p className="text-secondary-600 dark:text-secondary-400">
                    {new Date(archive.start_date).toLocaleDateString()} - {new Date(archive.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {archive.overall_completion_rate}%
                  </div>
                  <div className="text-sm text-secondary-500 dark:text-secondary-400">
                    Overall Completion
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                  <div className="text-sm text-primary-600 dark:text-primary-400 font-medium">Duration</div>
                  <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                    {archive.duration_days} days
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">Members</div>
                  <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                    {archive.total_members}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Completions</div>
                  <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                    {archive.total_completions}/{archive.total_possible}
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Best Performer</div>
                  <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                    {getArchiveBestPerformer(archive)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {archive.daily_progress && archive.daily_progress.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Daily Progress</h4>
                    <div className="bg-white dark:bg-secondary-800 rounded-lg p-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={archive.daily_progress}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          />
                          <YAxis domain={[0, 100]} />
                          <Tooltip
                            formatter={(value) => [`${value}%`, 'Completion Rate']}
                            labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="completion_rate"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {archive.member_stats && archive.member_stats.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Daily Participation Comparison</h4>
                    <div className="bg-white dark:bg-secondary-800 rounded-lg p-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={archive.member_stats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="username"
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis domain={[0, 100]} />
                          <Tooltip
                            formatter={(value) => [`${value}%`, 'Daily Participation']}
                            labelFormatter={(label) => `Member: ${label}`}
                          />
                          <Bar
                            dataKey="completion_rate"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Member Performance</h4>
                <div className="space-y-4">
                  {archive.member_stats.map((member) => (
                    <div key={member.id} className="bg-gray-50 dark:bg-secondary-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200">
                            {member.username[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-secondary-900 dark:text-white">
                              {member.username}
                            </span>
                            <div className="text-sm text-secondary-500 dark:text-secondary-400">
                              Daily Participation: {member.completion_rate}% ({member.days_completed}/{member.total_days} days)
                            </div>
                            {member.total_habit_completions !== undefined && (
                              <div className="text-xs text-secondary-400 dark:text-secondary-500">
                                Total Habit Completions: {member.total_habit_completions}/{member.total_possible_habit_completions}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-secondary-900 dark:text-white">
                            {member.completion_rate}%
                          </div>
                        </div>
                      </div>

                      {member.habit_details && member.habit_details.length > 0 && (
                        <div className="ml-13">
                          <div className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">Individual Habit Performance (vs Total Challenge Days):</div>
                          <div className="space-y-2">
                            {member.habit_details.map((habit, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-white dark:bg-secondary-800 rounded p-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-secondary-600 dark:text-secondary-400">
                                    {habit.name}
                                  </span>
                                  <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-secondary-600 rounded text-secondary-600 dark:text-secondary-400">
                                    {habit.type}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold text-secondary-900 dark:text-white">
                                    {habit.completion_rate}%
                                  </div>
                                  <div className="text-xs text-secondary-500 dark:text-secondary-400">
                                    {habit.completed_days}/{habit.total_days}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
              No Completed Challenges Yet
            </h3>
            <p className="text-secondary-600 dark:text-secondary-400">
              Completed challenges will appear here once they finish.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivePanel;
