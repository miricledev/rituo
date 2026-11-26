import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

const GroupProgressCharts = ({
  isLeader,
  group,
  calculateScheduledAverageForDate,
  getDayName,
  formatDateLocal,
  calculateTodayScheduledProgress,
  workspaceType = 'school'
}) => {
  if (!isLeader || !group?.activeChallenge) {
    return null;
  }

  const trendData = (() => {
    const start = new Date(`${String(group.activeChallenge.startDate).slice(0, 10)}T00:00:00`);
    const challengeEnd = new Date(`${String(group.activeChallenge.endDate).slice(0, 10)}T00:00:00`);
    const today = new Date();
    const end = today < challengeEnd ? today : challengeEnd;
    const allDates = [];
    let d = new Date(start);

    while (d <= end) {
      allDates.push(formatDateLocal(d));
      d.setDate(d.getDate() + 1);
    }

    return allDates.map((dateStr) => {
      const userAverages = (group.activeChallenge.memberHabits || [])
        .map((memberHabit) => {
          const habits = memberHabit.habits || [];
          if (habits.length === 0) return null;
          const joinedDate = String(memberHabit.joinedAt || '').slice(0, 10);
          if (joinedDate && dateStr < joinedDate) return null;
          return calculateScheduledAverageForDate(
            habits,
            dateStr,
            getDayName,
            formatDateLocal
          );
        })
        .filter((val) => val !== null);

      const dayAvg = userAverages.length > 0
        ? userAverages.reduce((a, b) => a + b, 0) / userAverages.length
        : 0;

      return {
        date: dateStr,
        rate: dayAvg
      };
    });
  })();

  const distributionData = (group.activeChallenge.memberHabits || []).map((memberHabit) => {
    const member = group.members?.find((m) =>
      String(m.id) === String(memberHabit.member) ||
      String(m.id) === String(memberHabit.member?.id)
    );
    const totalProgress = calculateTodayScheduledProgress(memberHabit, getDayName);
    const todayName = getDayName(new Date());
    const memberScheduledCount = (memberHabit.habits || []).filter((habit) => (
      !habit.scheduleDays?.length || habit.scheduleDays.includes(todayName)
    )).length;

    return {
      name: member?.username || 'Unknown Member',
      value: memberScheduledCount > 0 ? (totalProgress / memberScheduledCount) : 0
    };
  }).sort((left, right) => right.value - left.value);

  return (
    <div className="mt-8">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600 dark:text-cyan-300">Analytics</p>
        <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">Group Progress Overview</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-5">
          <h4 className="mb-4 text-base font-bold text-slate-900 dark:text-white sm:text-lg">Average Overall Completion Rate</h4>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${value.toFixed(1)}%`, 'Average Completion Rate']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line type="monotone" dataKey="rate" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#22d3ee', strokeWidth: 0, r: 3 }} name="Average Completion Rate" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-5">
          <h4 className="mb-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">Today by member</h4>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Each bar is that {workspaceType === 'football' ? "client's" : "student's"} percentage across habits scheduled today.</p>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} layout="vertical" margin={{ top: 0, right: 20, left: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" width={88} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Today completion']}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[0, 7, 7, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupProgressCharts;
