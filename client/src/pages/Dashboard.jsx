import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTask } from '../contexts/TaskContext';

// Components
import TaskList from '../components/TaskList';
import TaskProgress from '../components/TaskProgress';
import HeatmapChart from '../components/HeatmapChart';
import TrendsChart from '../components/TrendsChart';
import ColorChart from '../components/ColorChart';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { hasCycle, fetchTasks, loading } = useTask();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-primary-50 dark:bg-secondary-900 transition-colors duration-200">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Dashboard</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mt-2">
          Welcome back, {currentUser?.username}! Track your daily progress and stay committed.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-secondary-700 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('colorChart')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'colorChart'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Skill Development Chart
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Task list */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 mb-8 transition-colors duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-secondary-800 dark:text-white">Your 30-Day Tasks</h2>
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
          
        </div>
      </div>
      
          {/* Motivation section */}
          <div className="mt-8 bg-primary-50 dark:bg-secondary-800 rounded-lg p-6 transition-colors duration-200">
            <h3 className="text-lg font-semibold mb-3 text-secondary-900 dark:text-white">Daily Inspiration</h3>
            <blockquote className="italic text-secondary-700 dark:text-secondary-300">
              "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
              <footer className="mt-2 text-sm font-medium text-secondary-600 dark:text-secondary-400">
                — Aristotle
              </footer>
            </blockquote>
          </div>
        </div>
      )}

      {/* Color Chart Tab */}
      {activeTab === 'colorChart' && (
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🎨 Your Skill Development Chart</h2>
            <p className="text-secondary-600 dark:text-secondary-400 mb-4">Track your skill development progress across different areas.</p>
          </div>
          
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
            <ColorChart 
              memberHabit={{ member: currentUser?.id }}
              isLeader={false}
              groupId={null}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;