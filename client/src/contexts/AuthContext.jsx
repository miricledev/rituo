import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Configure axios defaults
axios.defaults.baseURL = API_URL;
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.withCredentials = true;

// Add request interceptor to include token in all requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Create the auth context
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token');
      console.log('Checking auth status, token exists:', !!token);
      
      if (token) {
        try {
          // Verify token validity by fetching user data
          const response = await axios.get('/auth/user');
          console.log('Auth check successful:', response.data);
          
          if (response.data && response.data.user) {
            setCurrentUser(response.data.user);
          } else {
            console.error('No user data in response');
            localStorage.removeItem('token');
          }
        } catch (err) {
          console.error('Auth check failed:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message,
            config: {
              url: err.config?.url,
              headers: err.config?.headers
            }
          });

          // Only remove token if we get a 401 Unauthorized response
          if (err.response?.status === 401) {
            console.error('Token is invalid or expired, removing from storage');
            localStorage.removeItem('token');
          } else {
            // For other errors (like network issues), keep the token but log the error
            console.error('Non-401 error during auth check, keeping token');
            // Don't remove the token, but also don't set the user
            setCurrentUser(null);
          }
        }
      } else {
        setCurrentUser(null);
      }
      
      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  // Register a new user
  const register = async (username, email, password) => {
    try {
      setError(null);
      const response = await axios.post('/auth/register', {
        username,
        email,
        password
      });
      
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      
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
      const response = await axios.post('/auth/login', {
        username,
        password
      });
      
      const { access_token } = response.data;
      console.log('Storing token:', access_token); // Debug log
      localStorage.setItem('token', access_token);
      
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
    setCurrentUser(null);
  };

  // Update user profile
  const updateProfile = async (userData) => {
    try {
      setError(null);
      const response = await axios.put('/auth/user', userData);
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
      const response = await axios.put('/auth/change-password', {
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