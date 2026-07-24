import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const GroupProgressCharts = ({
  isLeader,
  group,
  scheduledHabits,
  calculateScheduledAverageForDate,
  getDayName,
  formatDateLocal,
  calculateTodayScheduledProgress
}) => {
  if (!isLeader || !group?.activeChallenge) {
    return null;
  }

  const trendData = (() => {
    const start = new Date(group.activeChallenge.startDate);
    const challengeEnd = new Date(group.activeChallenge.endDate);
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

    return {
      name: member?.username || 'Unknown Member',
      value: scheduledHabits.length > 0 ? (totalProgress / scheduledHabits.length) : 0
    };
  });

  return (
    <div className="mt-8">
      <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Group Progress Overview</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-3 sm:p-4">
          <h4 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Average Overall Completion Rate</h4>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value) => [`${value.toFixed(1)}%`, 'Average Completion Rate']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line type="monotone" dataKey="rate" stroke="#3b82f6" name="Average Completion Rate" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-3 sm:p-4">
          <h4 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Member Progress Distribution</h4>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {distributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, props) => [
                    `${value.toFixed(1)}%`,
                    `${props.payload.name} - Completion Rate`
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupProgressCharts;
