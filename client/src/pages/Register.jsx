import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!username || !email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      await register(username, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account. Please try again.');
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
          <h2 className="mt-4 text-2xl font-bold text-secondary-800 dark:text-white">Create an Account</h2>
          <p className="mt-2 text-secondary-600 dark:text-secondary-300">Start your 30-day journey to better habits</p>
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
              placeholder="Choose a username"
              required
            />
          </div>
          
          <div className="mb-4 transform hover:scale-[1.02] transition-transform duration-200">
            <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="Enter your email address"
              required
            />
          </div>
          
          <div className="mb-4 transform hover:scale-[1.02] transition-transform duration-200">
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Create a password (min. 6 characters)"
              required
            />
          </div>
          
          <div className="mb-6 transform hover:scale-[1.02] transition-transform duration-200">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              placeholder="Confirm your password"
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
                Creating Account...
              </div>
            ) : (
              'Create Account'
            )}
          </button>
          
          <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <p className="text-secondary-600 dark:text-secondary-400">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors duration-200">
                Log in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;