import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTask } from '../contexts/TaskContext';

const TaskStats = () => {
  const { taskId } = useParams();
  const { fetchTaskAnalytics, loading } = useTask();
  
  const [taskData, setTaskData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTaskData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchTaskAnalytics(taskId);
        setTaskData(data);
        setError('');
      } catch (err) {
        setError('Failed to load task data. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (taskId) {
      loadTaskData();
    }
  }, [taskId, fetchTaskAnalytics]);

  if (isLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/4 mb-8"></div>
          <div className="bg-white rounded-lg shadow-card p-6 mb-6">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-card p-6 h-64"></div>
        </div>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mb-6">
          {error || 'Task not found. Please go back to the dashboard and try again.'}
        </div>
        <Link to="/dashboard" className="btn btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Format chart data
  const chartData = taskData.daily_data.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    completed: day.is_complete ? 1 : 0,
    originalDate: day.date // Keep the original date for sorting
  }));

  // Sort chart data by date
  chartData.sort((a, b) => new Date(a.originalDate) - new Date(b.originalDate));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors duration-200">
      {/* Header with back button */}
      <div className="flex items-center mb-2">
        <Link to="/dashboard" className="mr-4 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Task Statistics</h1>
      </div>
      
      <h2 className="text-xl font-semibold text-primary-600 dark:text-primary-400 mb-6">{taskData.task.title}</h2>
      
      {/* Task overview */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 mb-8 transition-colors duration-200">
        <h3 className="text-lg font-semibold mb-4 text-secondary-900 dark:text-white">Overview</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center transition-colors duration-200">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{taskData.days_completed}</div>
            <div className="text-sm text-secondary-600 dark:text-secondary-300">Days Completed</div>
          </div>
          
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center transition-colors duration-200">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{Math.round(taskData.completion_rate)}%</div>
            <div className="text-sm text-secondary-600 dark:text-secondary-300">Completion Rate</div>
          </div>
          
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center transition-colors duration-200">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{taskData.current_streak}</div>
            <div className="text-sm text-secondary-600 dark:text-secondary-300">Current Streak</div>
          </div>
        </div>
        
        {taskData.task.description && (
          <div className="mt-4">
            <h4 className="font-medium text-secondary-800 mb-1">Description:</h4>
            <p className="text-secondary-600">{taskData.task.description}</p>
          </div>
        )}
        
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Overall Progress</span>
            <span>{Math.round(taskData.completion_rate)}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${taskData.completion_rate}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Completion chart */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 mb-8 transition-colors duration-200">
        <h3 className="text-lg font-semibold mb-6 text-secondary-900 dark:text-white">Daily Completion History</h3>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#6B7280' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={[0, 1]}
                ticks={[0, 1]}
                tickFormatter={(tick) => tick === 1 ? 'Completed' : 'Missed'}
                tick={{ fill: '#6B7280' }}
              />
              <Tooltip 
                formatter={(value) => [value === 1 ? 'Completed' : 'Missed', 'Status']}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#F3F4F6'
                }}
              />
              <Line 
                type="monotone"
                dataKey="completed" 
                stroke="#0ea5e9" 
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Daily completion list */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 transition-colors duration-200">
        <h3 className="text-lg font-semibold mb-4 text-secondary-900 dark:text-white">Completion Log</h3>
        
        <div className="overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-secondary-700">
              <thead className="bg-gray-50 dark:bg-secondary-700 sticky top-0">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-secondary-800 divide-y divide-gray-200 dark:divide-secondary-700">
                {taskData.daily_data.map((day, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-700 dark:text-secondary-300">
                      {new Date(day.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {day.is_complete ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                          Completed
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300">
                          Missed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskStats;