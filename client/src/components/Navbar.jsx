import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTask } from '../contexts/TaskContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const { tasks } = useTask();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
    } else {
      setIsDarkMode(false);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Navigation items
  const navItems = [
    { title: 'Dashboard', path: '/dashboard' },
    ...(tasks && tasks.length === 0 ? [{ title: 'Create Tasks', path: '/create-tasks' }] : [])
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-secondary-800 shadow-md z-10 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and navigation links */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="font-display text-xl font-bold text-primary-600 dark:text-primary-400 hover:scale-105 transition-transform duration-200">
                Rituo
              </Link>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/50'
                      : 'text-secondary-600 dark:text-secondary-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-secondary-700'
                  }`}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
          
          {/* User dropdown menu and dark mode toggle */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-secondary-700 transition-colors duration-200"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            <div className="relative">
              <button
                onClick={toggleMenu}
                className="flex items-center gap-2 text-sm font-medium focus:outline-none hover:scale-105 transition-transform duration-200"
              >
                <span className="hidden md:block text-secondary-800 dark:text-secondary-200">{currentUser?.username}</span>
                <div className="h-8 w-8 rounded-full bg-primary-500 dark:bg-primary-400 flex items-center justify-center text-white transform hover:scale-110 transition-transform duration-200">
                  {currentUser?.username?.charAt(0).toUpperCase()}
                </div>
              </button>
              
              {/* Dropdown menu */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-secondary-800 rounded-md shadow-lg py-1 animate-fade-in">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-secondary-700 dark:text-secondary-300 hover:bg-gray-100 dark:hover:bg-secondary-700 transition-colors duration-200"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden space-x-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-secondary-700 transition-colors duration-200"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-secondary-400 hover:text-secondary-500 hover:bg-gray-100 dark:hover:bg-secondary-700 focus:outline-none transition-colors duration-200"
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="sm:hidden animate-slide-in">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMenu}
                className={`block pl-3 pr-4 py-2 text-base font-medium transition-colors duration-200 ${
                  location.pathname === item.path
                    ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/50 border-l-4 border-primary-500'
                    : 'text-secondary-600 dark:text-secondary-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-secondary-700 border-l-4 border-transparent'
                }`}
              >
                {item.title}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="block w-full text-left pl-3 pr-4 py-2 text-base font-medium text-secondary-600 dark:text-secondary-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-secondary-700 border-l-4 border-transparent transition-colors duration-200"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;