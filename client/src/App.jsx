import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import {
  getProtocolNameForPath,
  IPKP_TRANSITION_EVENT
} from './utils/protocolTransition';

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
const FeatureLab = lazy(() => import('./pages/FeatureLab'));

function App() {
  const { isAuthenticated, loading, postLoginStage, currentUser, completePostLogin } = useAuth();
  const location = useLocation();
  const [routeProtocol, setRouteProtocol] = useState(null);
  const routeTimerRef = useRef(null);
  const previousPathRef = useRef(location.pathname);
  const activeTransitionRef = useRef(null);
  const manualTransitionAtRef = useRef(0);

  const startProtocolTransition = useCallback((protocolName, duration = 1250) => {
    const normalizedProtocolName = protocolName || 'Workspace';
    const now = Date.now();
    if (
      activeTransitionRef.current?.protocolName === normalizedProtocolName
      && activeTransitionRef.current.expiresAt > now
    ) {
      return;
    }
    if (routeTimerRef.current) {
      window.clearTimeout(routeTimerRef.current);
    }
    activeTransitionRef.current = {
      protocolName: normalizedProtocolName,
      expiresAt: now + Math.max(650, Number(duration) || 1250)
    };
    setRouteProtocol(normalizedProtocolName);
    routeTimerRef.current = window.setTimeout(() => {
      setRouteProtocol(null);
      activeTransitionRef.current = null;
      routeTimerRef.current = null;
    }, Math.max(650, Number(duration) || 1250));
  }, []);

  useEffect(() => {
    const handleProtocolTransition = (event) => {
      manualTransitionAtRef.current = Date.now();
      startProtocolTransition(event.detail?.protocolName, event.detail?.duration);
    };
    window.addEventListener(IPKP_TRANSITION_EVENT, handleProtocolTransition);
    return () => {
      window.removeEventListener(IPKP_TRANSITION_EVENT, handleProtocolTransition);
      if (routeTimerRef.current) {
        window.clearTimeout(routeTimerRef.current);
      }
    };
  }, [startProtocolTransition]);

  useLayoutEffect(() => {
    const previousPath = previousPathRef.current;
    previousPathRef.current = location.pathname;
    if (!isAuthenticated || previousPath === location.pathname || postLoginStage) return;
    if (Date.now() - manualTransitionAtRef.current < 500) return;
    startProtocolTransition(getProtocolNameForPath(location.pathname), 1350);
  }, [isAuthenticated, location.pathname, postLoginStage, startProtocolTransition]);
  
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
    return <BrandLoadingScreen protocolName={loading ? 'Secure Access' : 'Authentication'} />;
  }

  if (postLoginStage === 'affirmations') {
    return <AffirmationGate username={currentUser?.username} onComplete={completePostLogin} />;
  }

  // Determine if we should show the navbar
  const showNavbar = isAuthenticated && location.pathname !== '/';

  const routeFallback = <BrandLoadingScreen protocolName={getProtocolNameForPath(location.pathname)} transitionMode />;

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-secondary-900 overflow-x-hidden w-full">
      {routeProtocol ? <BrandLoadingScreen protocolName={routeProtocol} transitionMode /> : null}
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
              path="/feature-lab"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <FeatureLab />
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
