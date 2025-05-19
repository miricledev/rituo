import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTask } from '../contexts/TaskContext';

const TaskList = () => {
  const { tasks, toggleTaskCompletion, loading, error } = useTask();
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  const handleTaskToggle = async (taskId) => {
    setUpdatingTaskId(taskId);
    try {
      await toggleTaskCompletion(taskId);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center my-8">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-md p-4 my-4 transition-colors duration-200">
        <p>{error}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded-md p-8 my-8 transition-colors duration-200 shadow-md">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-16 h-16 mb-4 text-yellow-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6l4 2m6 4.5A9 9 0 11.75 12 9 9 0 0121 18.5z"
          />
        </svg>
        <p className="text-lg font-semibold mb-2">You don't have any active tasks.</p>
        <p className="mb-4 text-center max-w-xs">Create your 30-day commitment list to get started on your journey of daily progress and self-improvement!</p>
        <Link
          to="/create-tasks"
          className="btn btn-primary px-6 py-2 rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 shadow"
        >
          Create Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-secondary-800 dark:text-white mb-4">Today's Tasks</h2>
      
      <div className="grid grid-cols-1 gap-3">
        {tasks.map(task => (
          <div 
            key={task.id}
            className={`task-item bg-white dark:bg-secondary-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 ${
              task.is_complete_today ? 'border-l-4 border-success-500' : ''
            }`}
          >
            <div
              onClick={() => handleTaskToggle(task.id)} 
              className={`checkbox-container w-6 h-6 rounded-md border-2 border-primary-500 flex items-center justify-center cursor-pointer transition-colors duration-200 ${
                task.is_complete_today ? 'bg-primary-500' : 'bg-transparent'
              }`}
            >
              {task.is_complete_today && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="white"
                  className="w-4 h-4"
                >
                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                </svg>
              )}
              
              {updatingTaskId === task.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-secondary-700 bg-opacity-75 rounded-md">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            <span className={`task-label ml-3 text-secondary-800 dark:text-white ${
              task.is_complete_today ? 'line-through text-secondary-400 dark:text-secondary-500' : ''
            }`}>
              {task.title}
            </span>
            
            <Link 
              to={`/task/${task.id}`} 
              className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 ml-2 transition-colors duration-200"
              title="View Task Stats"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2M8 17V9m4 8V5m4 12v-4" />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskList;