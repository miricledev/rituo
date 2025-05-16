import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateTasks from './pages/CreateTasks';
import TaskStats from './pages/TaskStats';
import NotFound from './pages/NotFound';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

function App() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Sync dark mode on initial load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Determine if we should show the navbar
  const showNavbar = isAuthenticated && location.pathname !== '/';

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-secondary-900">
      {showNavbar && <Navbar />}
      
      <div className={`${showNavbar ? 'pt-16' : ''}`}>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} 
          />
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} 
          />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create-tasks" 
            element={
              <ProtectedRoute>
                <CreateTasks />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/task/:taskId" 
            element={
              <ProtectedRoute>
                <TaskStats />
              </ProtectedRoute>
            } 
          />
          
          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;