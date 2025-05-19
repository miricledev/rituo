import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const { currentUser, updateUsername, deleteAccount, logout } = useAuth();
  const navigate = useNavigate();
  const [newUsername, setNewUsername] = useState(currentUser?.username || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState(currentUser?.email || '');
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleUsernameUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/auth/update-username`,
        { username: newUsername },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      setSuccess('Username updated successfully');
      updateUsername(newUsername);
      setNewUsername('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update username');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/request-password-reset`, {
        email: currentUser.email
      });
      setSuccess('Password reset instructions sent to your email');
      setResetEmail('');
      setIsResettingPassword(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset instructions');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/auth/delete-account`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      localStorage.removeItem('token');
      await logout();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to delete account');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-primary-50 dark:bg-secondary-900 transition-colors duration-200">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Settings</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Profile Settings</h2>
          
          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <p className="text-green-700 dark:text-green-400">{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Username
              </label>
              <div className="flex items-center space-x-4">
                {isEditing ? (
                  <form onSubmit={handleUpdateUsername} className="flex-1 flex items-center space-x-4">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
                      placeholder="Enter new username"
                    />
                    <button
                      type="submit"
                      className="btn btn-primary px-4 py-2"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setNewUsername(currentUser?.username || '');
                        setError('');
                      }}
                      className="btn btn-outline px-4 py-2"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-secondary-700 rounded-md">
                      {currentUser?.username}
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn btn-outline px-4 py-2"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Email
              </label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-secondary-700 rounded-md">
                {currentUser?.email}
              </div>
            </div>

            <div>
              <button
                onClick={() => setIsResettingPassword(true)}
                className="btn btn-outline px-4 py-2"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>

        {/* Help & Support Section */}
        <div id="help" className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Help & Support</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
                Frequently Asked Questions
              </h3>
              <div className="space-y-4">
                <div className="border-b border-gray-200 dark:border-secondary-700 pb-4">
                  <h4 className="font-medium text-secondary-800 dark:text-secondary-200 mb-2">
                    How do I track my progress?
                  </h4>
                  <p className="text-secondary-600 dark:text-secondary-400">
                    Your progress is automatically tracked in the dashboard. You can view detailed statistics for each task by clicking on it.
                  </p>
                </div>
                <div className="border-b border-gray-200 dark:border-secondary-700 pb-4">
                  <h4 className="font-medium text-secondary-800 dark:text-secondary-200 mb-2">
                    What is the Pomodoro Timer?
                  </h4>
                  <p className="text-secondary-600 dark:text-secondary-400">
                    The Pomodoro Timer helps you stay focused by breaking work into intervals, traditionally 25 minutes in length, separated by short breaks.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-secondary-800 dark:text-secondary-200 mb-2">
                    How do I reset my password?
                  </h4>
                  <p className="text-secondary-600 dark:text-secondary-400">
                    You can reset your password by clicking the "Reset Password" button in your profile settings. A reset link will be sent to your email.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
                Contact Support
              </h3>
              <form 
                action="https://formsubmit.co/rohan13k@outlook.com" 
                method="POST"
                className="space-y-4"
              >
                <input type="hidden" name="_subject" value="New Support Request from Rituo" />
                <input type="hidden" name="_template" value="table" />
                <input type="hidden" name="_next" value="https://rituo.vercel.app/settings#help" />
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
                    placeholder="Your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
                    rows="4"
                    placeholder="How can we help you?"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary px-4 py-2"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 border-2 border-red-200 dark:border-red-900/30">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
                Delete Account
              </h3>
              <p className="text-secondary-600 dark:text-secondary-400 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button
                onClick={() => setIsDeleting(true)}
                className="btn btn-danger px-4 py-2"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
              Confirm Account Deletion
            </h3>
            <p className="text-secondary-600 dark:text-secondary-400 mb-6">
              Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsDeleting(false)}
                className="btn btn-outline px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="btn btn-danger px-4 py-2"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {isResettingPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">
              Reset Password
            </h3>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
                  required
                />
              </div>
              {resetSuccess && (
                <p className="text-green-600 dark:text-green-400">
                  Password reset instructions have been sent to your email.
                </p>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsResettingPassword(false);
                    setResetSuccess(false);
                  }}
                  className="btn btn-outline px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-4 py-2"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 