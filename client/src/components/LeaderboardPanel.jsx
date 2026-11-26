import React from 'react';

const LeaderboardPanel = ({ leaderboardData, isLeader }) => {
  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🏆 Habit Streaks Leaderboard</h2>
        <p className="mb-4 text-slate-600 dark:text-slate-400">Ranking combines the strongest current full-completion streak (60%) and today&apos;s scheduled progress (40%). Recurring progress contributes proportionally.</p>

        <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-cyan-50 p-4 dark:border-violet-400/20 dark:from-violet-500/10 dark:to-cyan-400/5">
          <h3 className="font-semibold text-secondary-900 dark:text-white mb-2">📊 How Ranking Works:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-primary-600 dark:text-primary-400">60% - Current Streak:</span>
              <span className="text-secondary-600 dark:text-secondary-400 ml-2">Your strongest current 100% scheduled-occurrence streak</span>
            </div>
            <div>
              <span className="font-medium text-primary-600 dark:text-primary-400">40% - Today:</span>
              <span className="text-secondary-600 dark:text-secondary-400 ml-2">Progress across habits scheduled today</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {leaderboardData.map((entry, index) => (
          <div
            key={entry.member.id}
            className={`relative rounded-2xl border-2 bg-white/80 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl dark:bg-white/[0.035] ${
              entry.isCurrentUser ? 'ring-4 ring-primary-500/30 border-primary-500' :
              index === 0 ? 'border-yellow-400 dark:border-yellow-500 shadow-yellow-200/20' :
              index === 1 ? 'border-gray-300 dark:border-gray-600 shadow-gray-200/20' :
              index === 2 ? 'border-orange-400 dark:border-orange-500 shadow-orange-200/20' :
              'border-gray-200 dark:border-secondary-700'
            }`}
          >
            {entry.isCurrentUser && (
              <div className="absolute -top-3 left-6 bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                YOU
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                    index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600 text-white' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                    'bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 text-primary-700 dark:text-primary-200'
                  }`}>
                    {index + 1}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-2xl font-bold text-primary-700 dark:text-primary-200 shadow-lg">
                      {entry.member.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-secondary-900 dark:text-white">
                          {entry.member.username}
                        </h3>
                        {entry.isLeader && (
                          <span className="px-3 py-1 text-xs rounded-full bg-gradient-to-r from-primary-100 to-primary-300 dark:from-primary-900 dark:to-primary-700 text-primary-800 dark:text-primary-200 font-semibold shadow-sm">
                            LEADER
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-secondary-600 dark:text-secondary-400">
                          {entry.completedToday}/{entry.totalHabits} completion units today
                        </span>
                        <span className="text-sm text-secondary-600 dark:text-secondary-400">
                          {entry.totalCompleted} completion units total
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    {entry.maxStreak > 0 && (
                      <div className="text-3xl animate-pulse">🔥</div>
                    )}
                    <div>
                      <div className="text-4xl font-bold text-secondary-900 dark:text-white">
                        {entry.maxStreak}
                      </div>
                      <div className="text-sm font-medium text-secondary-600 dark:text-secondary-400 uppercase tracking-wide">
                        Scheduled occasion{entry.maxStreak !== 1 ? 's' : ''} streak
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-secondary-700">
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {Math.round(entry.weightedScore)}
                    </div>
                    <div className="text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wide">
                      Score
                    </div>
                  </div>
                </div>
              </div>

              {(isLeader || entry.isCurrentUser) && entry.habitStreaks.length > 0 && (
                <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
                  <h4 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-3 uppercase tracking-wide">
                    {entry.isCurrentUser ? 'Your Habit Details:' : 'Habit Breakdown:'}
                  </h4>

                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-black/10">
                    <h5 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-2 uppercase tracking-wide">
                      Score Breakdown:
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                          {Math.round(entry.weightedScore)}
                        </div>
                        <div className="text-xs text-secondary-500 dark:text-secondary-400">Total Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {Math.round((entry.maxStreak / 30) * 100 * 0.6)}
                        </div>
                        <div className="text-xs text-secondary-500 dark:text-secondary-400">Streak Points (60%)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {entry.totalHabits ? Math.round((entry.completedToday / entry.totalHabits) * 100 * 0.4) : 0}
                        </div>
                        <div className="text-xs text-secondary-500 dark:text-secondary-400">Today Points (40%)</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {entry.habitStreaks.map((habit, habitIndex) => (
                      <div
                        key={habitIndex}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          habit.streak > 0
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-secondary-900 dark:text-white truncate">
                            {habit.habitName}
                          </div>
                          <div className="text-xs text-secondary-500 dark:text-secondary-400 uppercase tracking-wide">
                            {habit.habitType}
                          </div>
                        </div>
                        <div className="ml-3 text-right">
                          <div className={`text-lg font-bold ${
                            habit.streak > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {habit.streak}
                          </div>
                          <div className="text-xs text-secondary-500 dark:text-secondary-400">
                            scheduled occasions
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default LeaderboardPanel;
