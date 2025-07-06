import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const TaskForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    due_date: '',
    is_30_day_challenge: false
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (formData.is_30_day_challenge) {
        // Show payment modal for 30-day challenge
        // setIsPaymentModalOpen(true); // This line is removed
      } else {
        // Regular task creation
        await createTask();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating task');
    }
  };

  const createTask = async () => {
    const response = await axios.post('/api/tasks', formData);
    navigate('/tasks');
  };

  // const handlePaymentSuccess = async () => { // This function is removed
  //   try {
  //     await createTask();
  //     setIsPaymentModalOpen(false);
  //   } catch (err) {
  //     setError(err.response?.data?.message || 'Error creating task after payment');
  //   }
  // };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-6">
        Create New Task
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
            Title
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
            Category
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
          >
            <option value="personal">Personal</option>
            <option value="work">Work</option>
            <option value="health">Health</option>
            <option value="learning">Learning</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
            Priority
          </label>
          <select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
            Due Date
          </label>
          <input
            type="date"
            name="due_date"
            value={formData.due_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_30_day_challenge"
            checked={formData.is_30_day_challenge}
            onChange={handleChange}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
          />
          <label className="ml-2 block text-sm text-secondary-700 dark:text-secondary-300">
            30-Day Challenge (£2.99)
          </label>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="px-4 py-2 text-sm font-medium text-secondary-600 dark:text-secondary-300 hover:text-secondary-800 dark:hover:text-secondary-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
          >
            {formData.is_30_day_challenge ? 'Start 30-Day Challenge (£2.99)' : 'Create Task'}
          </button>
        </div>
      </form>

      {/* PaymentModal component is removed */}
    </div>
  );
};

export default TaskForm; 