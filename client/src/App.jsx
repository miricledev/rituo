import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TaskStats from './pages/TaskStats';
import PomodoroTimer from './pages/PomodoroTimer';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import ResetPassword from './pages/ResetPassword';
import Archives from './pages/Archives';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import MemberStats from './pages/MemberStats';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import GoldParticlesBackground from './components/GoldParticlesBackground';

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
    <div className="min-h-screen bg-primary-50 dark:bg-secondary-900 overflow-x-hidden w-full">
      <GoldParticlesBackground />
      {showNavbar && <Navbar />}
      
      <div className={`${showNavbar ? 'pt-16' : ''} w-full overflow-x-hidden`}>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/groups" replace /> : <Landing />} 
          />
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/groups" replace /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated ? <Navigate to="/groups" replace /> : <Register />} 
          />
          
          {/* Protected routes */}
          <Route 
            path="/groups" 
            element={
              <ProtectedRoute>
                <Groups />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/groups/:groupId" 
            element={
              <ProtectedRoute>
                <GroupDetail />
              </ProtectedRoute>
            } 
          />
          <Route path="/groups/:groupId/member/:memberId" element={<ProtectedRoute><MemberStats /></ProtectedRoute>} />
          <Route 
            path="/task/:taskId" 
            element={
              <ProtectedRoute>
                <TaskStats />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/pomodoro" 
            element={
              <ProtectedRoute>
                <PomodoroTimer />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reset-password/:token" 
            element={
              <ProtectedRoute>
                <ResetPassword />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/archives" 
            element={
              <ProtectedRoute>
                <Archives />
              </ProtectedRoute>
            } 
          />
          
          {/* 404 Not Found */}
          <Route path="*" element={<Navigate to="/groups" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;