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
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 my-4">
        <p>{error}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-4 my-4">
        <p>You don't have any active tasks. Create your 30-day commitment list to get started!</p>
        <Link to="/create-tasks" className="mt-3 inline-block btn btn-primary">
          Create Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-secondary-800 mb-4">Today's Tasks</h2>
      
      <div className="grid grid-cols-1 gap-3">
        {tasks.map(task => (
          <div 
            key={task.id}
            className={`task-item ${task.is_complete_today ? 'border-l-4 border-success-500' : ''}`}
          >
            <div
              onClick={() => handleTaskToggle(task.id)} 
              className={`checkbox-container ${task.is_complete_today ? 'checked' : ''}`}
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
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            <span className={`task-label ${task.is_complete_today ? 'line-through text-secondary-400' : ''}`}>
              {task.title}
            </span>
            
            <Link 
              to={`/task/${task.id}`} 
              className="text-primary-600 hover:text-primary-800 ml-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskList;