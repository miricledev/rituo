import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

// Create the auth context
const AuthContext = createContext();

// API base URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // Configure axios to use the token
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verify token validity by fetching user data
          const response = await axios.get(`${API_URL}/auth/user`);
          setCurrentUser(response.data.user);
        } catch (err) {
          // Token is invalid or expired
          console.error('Auth token validation failed:', err);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      
      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  // Register a new user
  const register = async (username, email, password) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/auth/register`, {
        username,
        email,
        password
      });
      
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      setCurrentUser(response.data.user);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    }
  };

  // Login a user
  const login = async (username, password) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password
      });
      
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      setCurrentUser(response.data.user);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  // Logout the user
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
  };

  // Update user profile
  const updateProfile = async (userData) => {
    try {
      setError(null);
      const response = await axios.put(`${API_URL}/auth/user`, userData);
      setCurrentUser(response.data.user);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
      throw err;
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError(null);
      const response = await axios.put(`${API_URL}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
      throw err;
    }
  };

  // Clear any error
  const clearError = () => {
    setError(null);
  };

  // Prepare the value object with all functions and state
  const value = {
    currentUser,
    loading,
    error,
    isAuthenticated: !!currentUser,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}