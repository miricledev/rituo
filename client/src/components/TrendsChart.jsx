import React from 'react';
import { useTask } from '../contexts/TaskContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TrendsChart = () => {
  const { trendsData, loading } = useTask();

  if (loading || !trendsData) {
    return (
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 animate-pulse transition-colors duration-200">
        <div className="h-6 bg-gray-200 dark:bg-secondary-700 rounded w-1/2 mb-6"></div>
        <div className="h-64 bg-gray-200 dark:bg-secondary-700 rounded w-full"></div>
      </div>
    );
  }

  // Format daily trend data
  const dayOfWeekData = trendsData.day_of_week_trend.map(day => ({
    name: day.day.substring(0, 3),
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

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 transition-colors duration-200">
      <h3 className="text-lg font-semibold mb-6 text-secondary-900 dark:text-white">Completion Trends</h3>
      
      <div className="mb-8">
        <h4 className="text-md font-medium mb-4 text-secondary-800 dark:text-white">Daily Performance</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dayOfWeekData}
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
                labelFormatter={(label) => `Day: ${label}`}
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