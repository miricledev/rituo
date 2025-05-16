import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Simple validation
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-secondary-900 dark:to-secondary-800 flex items-center justify-center px-4 transition-colors duration-200">
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card w-full max-w-md p-8 transform hover:scale-[1.02] transition-all duration-300">
        <div className="text-center mb-8 animate-fade-in">
          <Link to="/" className="inline-block hover:scale-105 transition-transform duration-200">
            <h1 className="font-display text-2xl font-bold text-primary-600 dark:text-primary-400">Rituo</h1>
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-secondary-800 dark:text-white">Welcome Back</h2>
          <p className="mt-2 text-secondary-600 dark:text-secondary-300">Log in to your account to continue your journey</p>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md p-3 mb-6 animate-fade-in">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="mb-4 transform hover:scale-[1.02] transition-transform duration-200">
            <label htmlFor="username" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="Enter your username"
              required
            />
          </div>
          
          <div className="mb-6 transform hover:scale-[1.02] transition-transform duration-200">
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`w-full btn btn-primary py-2.5 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Logging In...
              </div>
            ) : (
              'Log In'
            )}
          </button>
          
          <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <p className="text-secondary-600 dark:text-secondary-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors duration-200">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;