import React, { useState } from 'react';
import { useTask } from '../contexts/TaskContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TrendsChart = () => {
  const { trendsData, loading } = useTask();
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(() => {
    // Default to the most recent week
    if (trendsData && trendsData.weekly_trend) {
      return trendsData.weekly_trend.length - 1;
    }
    return 0;
  });

  if (loading || !trendsData) {
    return (
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 animate-pulse transition-colors duration-200">
        <div className="h-6 bg-gray-200 dark:bg-secondary-700 rounded w-1/2 mb-6"></div>
        <div className="h-64 bg-gray-200 dark:bg-secondary-700 rounded w-full"></div>
      </div>
    );
  }

  // Helper to get the days in the selected week
  const getCurrentWeekDays = () => {
    if (!trendsData.weekly_trend || trendsData.weekly_trend.length === 0) return [];
    const week = trendsData.weekly_trend[selectedWeekIndex];
    const start = new Date(week.week_start);
    const end = new Date(week.week_end);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  // Filter daily_trend for the selected week
  const currentWeekDays = getCurrentWeekDays();
  const weekStart = currentWeekDays[0];
  const weekEnd = currentWeekDays[currentWeekDays.length - 1];
  const dailyTrend = trendsData.daily_trend || [];
  const dailyData = dailyTrend.filter(day => {
    const date = new Date(day.date);
    return date >= weekStart && date <= weekEnd;
  }).map(day => ({
    name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
    completionRate: Math.round(day.completion_rate)
  }));

  // Format weekly trend data
  const weeklyData = trendsData.weekly_trend.map(week => {
    const startDate = new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(week.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      name: `${startDate} - ${endDate}`,
      completionRate: Math.round(week.completion_rate)
    };
  });

  // Handlers for week navigation
  const handlePrevWeek = () => {
    setSelectedWeekIndex(i => Math.max(0, i - 1));
  };
  const handleNextWeek = () => {
    setSelectedWeekIndex(i => Math.min(trendsData.weekly_trend.length - 1, i + 1));
  };

  // Get current week label
  const currentWeekLabel = weeklyData[selectedWeekIndex]?.name || '';

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 transition-colors duration-200">
      <h3 className="text-lg font-semibold mb-6 text-secondary-900 dark:text-white">Completion Trends</h3>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-md font-medium text-secondary-800 dark:text-white">Daily Performance</h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevWeek}
              disabled={selectedWeekIndex === 0}
              className="px-2 py-1 rounded bg-gray-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-200 disabled:opacity-50"
              aria-label="Previous Week"
            >
              &#8592;
            </button>
            <span className="text-sm font-medium text-secondary-700 dark:text-secondary-200">{currentWeekLabel}</span>
            <button
              onClick={handleNextWeek}
              disabled={selectedWeekIndex === trendsData.weekly_trend.length - 1}
              className="px-2 py-1 rounded bg-gray-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-200 disabled:opacity-50"
              aria-label="Next Week"
            >
              &#8594;
            </button>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dailyData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#6B7280' }}
              />
              <YAxis 
                domain={[0, 100]} 
                tickFormatter={(tick) => `${tick}%`}
                tickCount={6}
                tick={{ fill: '#6B7280' }}
              />
              <Tooltip 
                formatter={(value) => [`${value}%`, 'Completion Rate']} 
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#F3F4F6'
                }}
              />
              <Bar 
                dataKey="completionRate" 
                name="Completion Rate" 
                fill="#0ea5e9" 
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationBegin={0}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {weeklyData.length > 1 && (
        <div>
          <h4 className="text-md font-medium mb-4 text-secondary-800 dark:text-white">Weekly Performance</h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tickFormatter={(tick) => `${tick}%`}
                  tickCount={6}
                  tick={{ fill: '#6B7280' }}
                />
                <Tooltip 
                  formatter={(value) => [`${value}%`, 'Completion Rate']} 
                  labelFormatter={(label) => `Week: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6'
                  }}
                />
                <Bar 
                  dataKey="completionRate" 
                  name="Completion Rate" 
                  fill="#22c55e" 
                  radius={[4, 4, 0, 0]}
                  animationDuration={500}
                  animationBegin={0}
                  isAnimationActive={true}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendsChart;