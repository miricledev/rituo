import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import GoldParticlesBackground from './components/GoldParticlesBackground';
import AppCopilot from './components/AppCopilot';
import BrandLoadingScreen from './components/BrandLoadingScreen';
import AffirmationGate from './components/AffirmationGate';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const TaskStats = lazy(() => import('./pages/TaskStats'));
const PomodoroTimer = lazy(() => import('./pages/PomodoroTimer'));
const Settings = lazy(() => import('./pages/Settings'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Archives = lazy(() => import('./pages/Archives'));
const Groups = lazy(() => import('./pages/Groups'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const MemberStats = lazy(() => import('./pages/MemberStats'));
const TeacherDesk = lazy(() => import('./pages/TeacherDesk'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  const { isAuthenticated, loading, postLoginStage, currentUser, completePostLogin } = useAuth();
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
  if (loading || postLoginStage === 'loading') {
    return <BrandLoadingScreen />;
  }

  if (postLoginStage === 'affirmations') {
    return <AffirmationGate username={currentUser?.username} onComplete={completePostLogin} />;
  }

  // Determine if we should show the navbar
  const showNavbar = isAuthenticated && location.pathname !== '/';

  const routeFallback = (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-secondary-900 overflow-x-hidden w-full">
      <GoldParticlesBackground />
      {showNavbar && <Navbar />}
      {isAuthenticated ? <AppCopilot /> : null}
      
      <div className={`${showNavbar ? 'pt-16' : ''} w-full overflow-x-hidden`}>
        <Suspense fallback={routeFallback}>
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
              path="/groups"
              element={
                <ProtectedRoute>
                  <Groups />
                </ProtectedRoute>
              }
            />
            <Route
              path="/legacy"
              element={
                <ProtectedRoute requireLegacyAccess>
                  <Groups legacyMode />
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
            <Route
              path="/groups/:groupId/member/:memberId"
              element={
                <ProtectedRoute>
                  <MemberStats />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher-desk"
              element={
                <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                  <TeacherDesk />
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

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default App;
