import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NotFound = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-secondary-900 dark:to-secondary-800 flex flex-col items-center justify-center px-4 py-12 transition-colors duration-200">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-600 dark:text-primary-400">404</h1>
        <h2 className="text-3xl font-semibold text-secondary-800 dark:text-white mt-4 mb-6">Page Not Found</h2>
        <p className="text-secondary-600 dark:text-secondary-300 mb-8 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          className="btn btn-primary px-8 py-3 hover:scale-105 transition-transform duration-200"
        >
          {isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;