import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTask } from '../contexts/TaskContext';

// Components
import TaskList from '../components/TaskList';
import TaskProgress from '../components/TaskProgress';
import HeatmapChart from '../components/HeatmapChart';
import TrendsChart from '../components/TrendsChart';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { hasCycle, fetchTasks, loading } = useTask();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900">Dashboard</h1>
        <p className="text-secondary-600 mt-2">
          Welcome back, {currentUser?.username}! Track your daily progress and stay committed.
        </p>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Task list */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-card p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-secondary-800">Your 30-Day Tasks</h2>
              {!hasCycle && !loading && (
                <Link to="/create-tasks" className="btn btn-primary">
                  Create Tasks
                </Link>
              )}
            </div>
            <TaskList />
          </div>
        </div>

        {/* Right column - Stats and charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Progress stats */}
          <TaskProgress />
          
          {/* Heatmap chart */}
          {hasCycle && <HeatmapChart />}
          
          {/* Trends chart */}
          {hasCycle && <TrendsChart />}
          
          {/* Call to action if no tasks */}
          {!hasCycle && !loading && (
            <div className="bg-white rounded-lg shadow-card p-8 text-center">
              <h3 className="text-xl font-semibold mb-4">Ready to Start Your 30-Day Journey?</h3>
              <p className="text-secondary-600 mb-6">
                Create your 30-day commitment list to build lasting habits and track your progress.
              </p>
              <Link to="/create-tasks" className="btn btn-primary px-8 py-3">
                Create Your Task List
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* Motivation section */}
      <div className="mt-8 bg-primary-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Daily Inspiration</h3>
        <blockquote className="italic text-secondary-700">
          "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
          <footer className="mt-2 text-sm font-medium text-secondary-600">
            — Aristotle
          </footer>
        </blockquote>
      </div>
    </div>
  );
};

export default Dashboard;