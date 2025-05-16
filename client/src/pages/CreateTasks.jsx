import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTask } from '../contexts/TaskContext';

const CreateTasks = () => {
  const [tasks, setTasks] = useState([{ title: '', description: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(1);
  const [accepted, setAccepted] = useState(false);
  
  const { hasCycle, cycleData, createTasks } = useTask();
  const navigate = useNavigate();

  // Redirect if user already has an active cycle
  useEffect(() => {
    if (hasCycle && cycleData) {
      navigate('/dashboard');
    }
  }, [hasCycle, cycleData, navigate]);

  // Add new empty task
  const addTask = () => {
    if (tasks.length < 10) {
      setTasks([...tasks, { title: '', description: '' }]);
    }
  };

  // Remove a task
  const removeTask = (index) => {
    if (tasks.length > 1) {
      const updatedTasks = [...tasks];
      updatedTasks.splice(index, 1);
      setTasks(updatedTasks);
    }
  };

  // Handle task input change
  const handleTaskChange = (index, field, value) => {
    const updatedTasks = [...tasks];
    updatedTasks[index][field] = value;
    setTasks(updatedTasks);
  };

  // Move to next step
  const nextStep = () => {
    // Validate first step - all tasks must have a title
    if (activeStep === 1) {
      const emptyTasks = tasks.filter(task => !task.title.trim());
      if (emptyTasks.length > 0) {
        setError('All tasks must have a title. Please fill in all required fields.');
        return;
      }
      setError('');
    }
    
    setActiveStep(activeStep + 1);
  };

  // Move to previous step
  const prevStep = () => {
    setActiveStep(activeStep - 1);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Final validation
    if (!accepted) {
      setError('You must acknowledge the 30-day commitment to continue.');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      // Filter out any empty tasks (shouldn't happen with validation)
      const validTasks = tasks.filter(task => task.title.trim());
      
      if (validTasks.length === 0) {
        setError('You must create at least one task.');
        setLoading(false);
        return;
      }
      
      await createTasks(validTasks);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create tasks. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900">Create Your 30-Day Commitment</h1>
        <p className="text-secondary-600 mt-2">
          Set up the tasks you want to commit to for the next 30 days. Once created, these tasks cannot be changed until the cycle ends.
        </p>
      </div>
      
      {/* Step progress */}
      <div className="flex mb-8">
        <div className={`flex-1 h-2 ${activeStep >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
        <div className={`flex-1 h-2 ${activeStep >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
        <div className={`flex-1 h-2 ${activeStep >= 3 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mb-6">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-card p-6">
        <form onSubmit={handleSubmit}>
          {/* Step 1: Create tasks */}
          {activeStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Step 1: Create Your Tasks</h2>
              
              <div className="space-y-4 mb-6">
                {tasks.map((task, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium">Task {index + 1}</span>
                      
                      {tasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTask(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <label htmlFor={`task-title-${index}`} className="block text-sm font-medium text-secondary-700 mb-1">
                        Task Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        id={`task-title-${index}`}
                        type="text"
                        value={task.title}
                        onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                        className="input-field"
                        placeholder="e.g., Read for 30 minutes"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor={`task-description-${index}`} className="block text-sm font-medium text-secondary-700 mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        id={`task-description-${index}`}
                        value={task.description}
                        onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                        className="input-field"
                        placeholder="Add any details or notes about this task"
                        rows="2"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
              
              {tasks.length < 10 && (
                <button
                  type="button"
                  onClick={addTask}
                  className="flex items-center text-primary-600 hover:text-primary-800 font-medium mb-8"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Another Task
                </button>
              )}
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={nextStep}
                  className="btn btn-primary"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
          
          {/* Step 2: Preview and guidelines */}
          {activeStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Step 2: Review Your Tasks</h2>
              
              <div className="bg-primary-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium mb-2">Tips for Success:</h3>
                <ul className="list-disc pl-5 space-y-1 text-secondary-700">
                  <li>Start with manageable tasks that you can realistically complete daily</li>
                  <li>Be specific about what counts as completing each task</li>
                  <li>Consider including a mix of physical, mental, and personal growth activities</li>
                  <li>Remember, these tasks will reset daily for 30 days</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
                <div className="bg-gray-50 p-3 border-b border-gray-200">
                  <h3 className="font-semibold">Your 30-Day Tasks</h3>
                </div>
                <ul className="divide-y divide-gray-200">
                  {tasks.map((task, index) => (
                    <li key={index} className="p-4">
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-secondary-600 mt-1">{task.description}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  className="btn btn-outline"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="btn btn-primary"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
          
          {/* Step 3: Confirmation and commitment */}
          {activeStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Step 3: Commit to Your 30-Day Journey</h2>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-yellow-800 mb-2">Important:</h3>
                <p className="text-yellow-700">
                  Once created, your task list will be locked for 30 days. You won't be able to add, remove, or modify these tasks until the cycle ends.
                </p>
              </div>
              
              <div className="mb-8">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <span>
                    I understand that I am committing to these tasks for the next 30 days, and I cannot modify them during this period.
                  </span>
                </label>
              </div>
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  className="btn btn-outline"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !accepted}
                  className={`btn btn-primary ${(loading || !accepted) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    'Start My 30-Day Commitment'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateTasks;