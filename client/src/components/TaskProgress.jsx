import React, { useState, useEffect } from 'react';
import { useTask } from '../contexts/TaskContext';

const TaskProgress = () => {
  const { analytics, fetchAnalytics, loading } = useTask();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!analytics) {
      fetchAnalytics();
    }
  }, [analytics, fetchAnalytics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAnalytics();
    } catch (err) {
      console.error('Failed to refresh analytics:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 animate-pulse transition-colors duration-200">
        <div className="h-6 bg-gray-200 dark:bg-secondary-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-secondary-700 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-secondary-700 rounded w-2/3 mb-6"></div>
        <div className="h-3 bg-gray-200 dark:bg-secondary-700 rounded-full mb-4"></div>
        <div className="h-20 bg-gray-200 dark:bg-secondary-700 rounded mb-2"></div>
      </div>
    );
  }

  if (!analytics.has_active_cycle) {
    return (
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 transition-colors duration-200">
        <h3 className="text-lg font-semibold mb-2 text-secondary-900 dark:text-white">No Active Cycle</h3>
        <p className="text-secondary-600 dark:text-secondary-300 mb-4">Create your 30-day commitment to start tracking your progress.</p>
      </div>
    );
  }

  // Format dates
  const startDate = new Date(analytics.cycle_start_date).toLocaleDateString();
  const endDate = new Date(analytics.cycle_end_date).toLocaleDateString();

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 transition-colors duration-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Current Progress</h3>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 focus:outline-none transition-colors duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="mb-4">
        <div className="text-sm text-secondary-600 dark:text-secondary-300 mb-1">Cycle Period:</div>
        <div className="font-medium text-secondary-900 dark:text-white">{startDate} - {endDate}</div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center transition-colors duration-200">
          <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{analytics.days_elapsed}</div>
          <div className="text-xs text-secondary-600 dark:text-secondary-300 mt-1">Days Completed</div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center transition-colors duration-200">
          <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{analytics.days_remaining}</div>
          <div className="text-xs text-secondary-600 dark:text-secondary-300 mt-1">Days Remaining</div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center transition-colors duration-200">
          <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{Math.round(analytics.overall_completion_rate)}%</div>
          <div className="text-xs text-secondary-600 dark:text-secondary-300 mt-1">Completion Rate</div>
        </div>
      </div>
      
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1 text-secondary-900 dark:text-white">
          <span>Cycle Progress</span>
          <span>{Math.round(analytics.progress_percentage)}%</span>
        </div>
        <div className="progress-bar bg-gray-200 dark:bg-secondary-700 rounded-full h-2.5">
          <div 
            className="progress-bar-fill bg-primary-500 rounded-full h-2.5 transition-all duration-300" 
            style={{ width: `${analytics.progress_percentage}%` }}
          ></div>
        </div>
      </div>
      
      <div className="mt-6">
        <h4 className="font-medium mb-3 text-secondary-900 dark:text-white">Task Statistics</h4>
        <div className="space-y-3">
          {analytics.tasks_stats.map(task => (
            <div key={task.task_id} className="bg-gray-50 dark:bg-secondary-700 rounded-md p-3 transition-colors duration-200">
              <div className="flex justify-between items-center">
                <div className="font-medium text-secondary-900 dark:text-white">{task.title}</div>
                <div className="streak-badge bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded-full text-xs flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-3 h-3 mr-1"
                  >
                    <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
                  </svg>
                  {task.current_streak} day{task.current_streak !== 1 ? 's' : ''} streak
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-secondary-600 dark:text-secondary-300 mb-1">
                  <span>Completion: {task.days_completed}/{analytics.days_elapsed} days</span>
                  <span>{Math.round(task.completion_rate * 100)}%</span>
                </div>
                <div className="progress-bar bg-gray-200 dark:bg-secondary-600 rounded-full h-2">
                  <div 
                    className="progress-bar-fill rounded-full h-2 transition-all duration-300" 
                    style={{ 
                      width: `${task.completion_rate * 100}%`,
                      backgroundColor: task.completion_rate >= 0.7 ? '#22c55e' : '#0ea5e9'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskProgress;