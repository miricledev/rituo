import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles, requireLegacyAccess = false }) => {
  const { isAuthenticated, loading, currentUser } = useAuth();

  // Show loading indicator while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser?.accountRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireLegacyAccess && !currentUser?.hasLegacyAccess) {
    return <Navigate to="/groups" replace />;
  }

  // Render children if authenticated
  return children;
};

export default ProtectedRoute;
