import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NotFound = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-600">404</h1>
        <h2 className="text-3xl font-semibold text-secondary-800 mt-4 mb-6">Page Not Found</h2>
        <p className="text-secondary-600 mb-8 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          className="btn btn-primary px-8 py-3"
        >
          {isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;