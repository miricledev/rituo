import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTask } from '../contexts/TaskContext';
import { parseDateLocal } from '../utils/habitScheduleUtils';
import InlineToast from '../components/InlineToast';

const TaskStats = ({ taskData: taskDataProp, habitData, loading: loadingProp, editMode = false, onUpdateDay, saving = false }) => {
  const { taskId } = useParams();
  const { fetchTaskAnalytics, loading: loadingContext } = useTask ? useTask() : {};
  const [taskData, setTaskData] = useState(taskDataProp || null);
  const [isLoading, setIsLoading] = useState(!taskDataProp);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [editingDay, setEditingDay] = useState(null);  // {date, currentValue}
  const [editValue, setEditValue] = useState('');

  // Update local state when prop changes
  useEffect(() => {
    if (taskDataProp) {
      setTaskData(taskDataProp);
    }
  }, [taskDataProp]);

  useEffect(() => {
    if (!taskDataProp && taskId && fetchTaskAnalytics) {
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
      loadTaskData();
    }
  }, [taskId, fetchTaskAnalytics, taskDataProp]);

  const loading = typeof loadingProp === 'boolean' ? loadingProp : isLoading || loadingContext;

  // Handler for clicking on a day to edit
  const handleDayClick = (day) => {
    if (!editMode || !onUpdateDay) return;
    
    // Check if it's today - can't edit today
    const today = new Date().toISOString().slice(0, 10);
    if (day.date === today) {
      setToast({
        type: 'info',
        title: 'Today cannot be edited',
        message: 'Students must log their own progress for today.'
      });
      return;
    }
    
    const habitType = habitData?.habitType || 'boolean';
    
    if (habitType === 'numeric') {
      // Open modal for numeric input
      const progressEntry = habitData?.progress?.find(p => p.date.startsWith(day.date));
      setEditingDay({ date: day.date, currentValue: progressEntry?.numericValue || habitData?.minValue || 0 });
      setEditValue(progressEntry?.numericValue?.toString() || '');
    } else if (habitType === 'text') {
      // Open modal for text input
      const progressEntry = habitData?.progress?.find(p => p.date.startsWith(day.date));
      setEditingDay({ date: day.date, currentValue: progressEntry?.textValue || '' });
      setEditValue(progressEntry?.textValue || '');
    } else {
      // Boolean: just toggle
      onUpdateDay(day.date, { completed: !day.is_complete });
    }
  };

  const handleSaveEdit = () => {
    if (!editingDay || !onUpdateDay) return;
    
    const habitType = habitData?.habitType || 'boolean';
    
    if (habitType === 'numeric') {
      const numValue = parseFloat(editValue);
      if (isNaN(numValue)) {
        setToast({
          type: 'error',
          title: 'Invalid number',
          message: 'Please enter a valid number.'
        });
        return;
      }
      onUpdateDay(editingDay.date, { numericValue: numValue });
    } else if (habitType === 'text') {
      onUpdateDay(editingDay.date, { textValue: editValue });
    }
    
    setEditingDay(null);
    setEditValue('');
  };

  if (loading) {
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
  const chartData = (taskData.daily_data || []).map(day => ({
    date: parseDateLocal(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    completed: day.is_complete ? 1 : 0,
    originalDate: day.date // Keep the original date for sorting
  }));

  // Sort chart data by date
  chartData.sort((a, b) => parseDateLocal(a.originalDate) - parseDateLocal(b.originalDate));

  // Convert ratio (0..1) to percentage for display
  const completionRatePct = Math.round(((taskData.completion_rate ?? 0) * 100));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors duration-200">
      {toast && (
        <div className="mb-6">
          <InlineToast toast={toast} onClose={() => setToast(null)} />
        </div>
      )}

      {/* Header with back button */}
      {!taskDataProp && (
        <div className="flex items-center mb-2">
          <Link to="/dashboard" className="mr-4 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Task Statistics</h1>
        </div>
      )}
      
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
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{completionRatePct}%</div>
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
            <span>{completionRatePct}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${completionRatePct}%` }}
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
        
        {editMode && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
              ✏️ <strong>Edit Mode Active:</strong> Click on any row to edit past days. Today's entry cannot be modified - students must log their own progress.
            </p>
          </div>
        )}
        
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
                {taskData.daily_data.map((day, index) => {
                  const isToday = day.date === new Date().toISOString().slice(0, 10);
                  const isEditable = editMode && !isToday;
                  
                  return (
                    <tr 
                      key={index}
                      className={`${isEditable ? 'hover:bg-gray-50 dark:hover:bg-secondary-700 cursor-pointer transition-colors' : ''} ${isToday && editMode ? 'opacity-50' : ''}`}
                      onClick={() => handleDayClick(day)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-700 dark:text-secondary-300">
                        {parseDateLocal(day.date).toLocaleDateString()}
                        {isToday && (
                          <span className="ml-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                            (Today)
                          </span>
                        )}
                        {isEditable && !isToday && (
                          <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">
                            (click to edit)
                          </span>
                        )}
                        {isToday && editMode && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            (not editable)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!day.isScheduled ? (
                          <div className="flex flex-col items-center gap-1 opacity-60">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-400">
                              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                            </svg>
                            {day.nextAvailable && (
                              <span className="text-xs text-gray-400 text-center">
                                In {day.nextAvailable.hoursUntil}h
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            disabled={!isEditable || saving}
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              day.is_complete
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                            } ${isEditable ? 'cursor-pointer hover:opacity-75' : ''}`}
                          >
                            {day.is_complete ? 'Completed' : 'Missed'}
                            {isEditable && ' ✏️'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal for Numeric/Text Habits */}
      {editingDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
              Edit Value for {parseDateLocal(editingDay.date).toLocaleDateString()}
            </h3>
            
            {habitData?.habitType === 'numeric' ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Value ({habitData.minValue || 0} - {habitData.maxValue || 100})
                </label>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  min={habitData.minValue || 0}
                  max={habitData.maxValue || 100}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-secondary-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
            ) : habitData?.habitType === 'text' ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Text Entry
                </label>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-secondary-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
            ) : null}
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setEditingDay(null);
                  setEditValue('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-secondary-700 dark:text-secondary-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskStats;
