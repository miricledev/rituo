import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

axios.defaults.withCredentials = true;
// Create the task context
const TaskContext = createContext();

// API base URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Configure axios defaults
axios.defaults.headers.common['Content-Type'] = 'application/json';

export function TaskProvider({ children }) {
  const { isAuthenticated, currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [hasCycle, setHasCycle] = useState(false);
  const [cycleData, setCycleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);
  const [trendsData, setTrendsData] = useState(null);

  // Set up axios interceptor to add token to all requests
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [currentUser]);

  // Fetch tasks when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
      fetchAnalytics();
      fetchHeatmapData();
      fetchTrends();
    } else {
      // Reset state when user logs out
      setTasks([]);
      setHasCycle(false);
      setCycleData(null);
      setAnalytics(null);
      setHeatmapData([]);
      setTrendsData(null);
    }
  }, [isAuthenticated]);

  // Fetch user's tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/tasks`);
      setTasks(response.data.tasks || []);
      setHasCycle(response.data.tasks && response.data.tasks.length > 0);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch tasks');
      setLoading(false);
    }
  }, [API_URL]);

  // Create new tasks for a 30-day cycle
  const createTasks = async (taskList) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_URL}/tasks`, {
        tasks: taskList
      });
      
      setTasks(response.data.tasks || []);
      setHasCycle(true);
      setCycleData({
        startDate: response.data.cycle_start_date,
        endDate: response.data.cycle_end_date
      });
      
      setLoading(false);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create tasks');
      setLoading(false);
      throw err;
    }
  };

  // Toggle task completion for the current day
  const toggleTaskCompletion = async (taskId) => {
    try {
      setError(null);
      
      const response = await axios.post(`${API_URL}/tasks/${taskId}/complete`);
      
      // Update the tasks state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, is_complete_today: response.data.is_complete } 
            : task
        )
      );
      
      // Update all analytics data after toggling completion
      await Promise.all([
        fetchAnalytics(),
        fetchHeatmapData(),
        fetchTrends()
      ]);
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task completion');
      throw err;
    }
  };

  // Fetch task history for a specific task
  const fetchTaskHistory = useCallback(async (taskId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/tasks/history/${taskId}`);
      setLoading(false);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch task history');
      setLoading(false);
      throw err;
    }
  }, [API_URL]);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get(`${API_URL}/analytics/summary`);
      setAnalytics(response.data);
      setHasCycle(response.data.has_active_cycle);
      if (response.data.has_active_cycle) {
        setCycleData({
          startDate: response.data.cycle_start_date,
          endDate: response.data.cycle_end_date,
          daysElapsed: response.data.days_elapsed,
          daysRemaining: response.data.days_remaining
        });
      }
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics');
      throw err;
    }
  }, [API_URL]);

  // Fetch heatmap data for visualization
  const fetchHeatmapData = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get(`${API_URL}/analytics/heatmap`);
      setHeatmapData(response.data.heatmap_data || []);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch heatmap data');
      throw err;
    }
  }, [API_URL]);

  // Fetch trends data
  const fetchTrends = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get(`${API_URL}/analytics/trends`);
      setTrendsData(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch trends');
      throw err;
    }
  }, [API_URL]);

  // Fetch specific task analytics
  const fetchTaskAnalytics = useCallback(async (taskId) => {
    try {
      setError(null);
      const response = await axios.get(`${API_URL}/analytics/task/${taskId}`);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch task analytics');
      throw err;
    }
  }, [API_URL]);

  // Clear any error
  const clearError = () => {
    setError(null);
  };

  // Prepare the value object with all functions and state
  const value = {
    tasks,
    hasCycle,
    cycleData,
    loading,
    error,
    analytics,
    heatmapData,
    trendsData,
    fetchTasks,
    createTasks,
    toggleTaskCompletion,
    fetchTaskHistory,
    fetchAnalytics,
    fetchHeatmapData,
    fetchTrends,
    fetchTaskAnalytics,
    clearError
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}

// Custom hook to use the task context
export function useTask() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
}