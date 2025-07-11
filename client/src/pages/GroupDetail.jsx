import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import GroupChat from '../components/GroupChat';
import DirectMessage from '../components/DirectMessage';

// Helper to format date as YYYY-MM-DD in local time
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const GroupDetail = () => {
  // All hooks at the top!
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateChallengeModal, setShowCreateChallengeModal] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    startDate: '',
    endDate: '',
    memberHabits: []
  });
  const [bulkCreate, setBulkCreate] = useState(false);
  const [bulkHabits, setBulkHabits] = useState([]);
  const { currentUser: user } = useAuth();
  const navigate = useNavigate();
  const [ticking, setTicking] = useState({});
  const [numericValues, setNumericValues] = useState({});
  const [textValues, setTextValues] = useState({});
  const [editingHabits, setEditingHabits] = useState({});
  const [tempNumericValues, setTempNumericValues] = useState({});
  const [tempTextValues, setTempTextValues] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDMUser, setSelectedDMUser] = useState(null);

  // Calculate myMemberHabit early to avoid temporal dead zone
  const myMemberHabit = group?.activeChallenge?.memberHabits?.find(
    mh => String(mh.member) === String(user?.id) || String(mh.member?.id) === String(user?.id)
  );

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  // Initialize values from existing progress when group data loads
  useEffect(() => {
    if (group?.activeChallenge && myMemberHabit) {
      const initialNumericValues = {};
      const initialTextValues = {};
      
      myMemberHabit.habits.forEach((habit, idx) => {
        const today = new Date().toISOString().slice(0, 10);
        const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === today);
        
        if (habit.habitType === 'numeric' && progressEntry?.numericValue !== undefined) {
          initialNumericValues[idx] = progressEntry.numericValue;
        }
        
        if (habit.habitType === 'text' && progressEntry?.textValue) {
          initialTextValues[idx] = progressEntry.textValue;
        }
      });
      
      setNumericValues(initialNumericValues);
      setTextValues(initialTextValues);
    }
  }, [group, myMemberHabit]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/groups/${groupId}`);
      setGroup(response.data.group);
    } catch (error) {
      console.error('Error fetching group details:', error);
      setError('Failed to load group details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/groups/challenge', {
        groupId,
        ...newChallenge
      });
      setShowCreateChallengeModal(false);
      fetchGroupDetails();
    } catch (error) {
      console.error('Error creating challenge:', error);
      alert('Failed to create challenge: ' + (error.response?.data?.error || error.message));
    }
  };

  const addMemberHabit = () => {
    setNewChallenge({
      ...newChallenge,
      memberHabits: [
        ...newChallenge.memberHabits,
        {
          member: '',
          habits: []
        }
      ]
    });
  };

  const addHabitToMember = (memberIndex) => {
    const updatedMemberHabits = [...newChallenge.memberHabits];
    updatedMemberHabits[memberIndex].habits.push({
      name: '',
      description: '',
      frequency: 'daily',
      habitType: 'boolean', // Default to boolean (checkbox)
      minValue: 0, // For numeric range
      maxValue: 10, // For numeric range
      prompt: '' // For text notes
    });
    setNewChallenge({
      ...newChallenge,
      memberHabits: updatedMemberHabits
    });
  };

  const updateMemberHabit = (memberIndex, habitIndex, field, value) => {
    const updatedMemberHabits = [...newChallenge.memberHabits];
    updatedMemberHabits[memberIndex].habits[habitIndex][field] = value;
    setNewChallenge({
      ...newChallenge,
      memberHabits: updatedMemberHabits
    });
  };

  const updateMemberSelection = (memberIndex, memberId) => {
    const updatedMemberHabits = [...newChallenge.memberHabits];
    updatedMemberHabits[memberIndex].member = memberId;
    setNewChallenge({
      ...newChallenge,
      memberHabits: updatedMemberHabits
    });
  };

  // Validation functions
  const getAllMembers = () => {
    return group?.members || [];
  };

  const getMembersWithHabits = () => {
    return newChallenge.memberHabits
      .filter(mh => mh.member && mh.habits && mh.habits.length > 0)
      .map(mh => mh.member);
  };

  const getMissingMembers = () => {
    const allMembers = getAllMembers();
    const membersWithHabits = getMembersWithHabits();
    return allMembers.filter(member => !membersWithHabits.includes(member.id));
  };

  const isChallengeValid = () => {
    const allMembers = getAllMembers();
    const membersWithHabits = getMembersWithHabits();
    return allMembers.length > 0 && allMembers.every(member => membersWithHabits.includes(member.id));
  };

  // Bulk habit functions
  const addBulkHabit = () => {
    setBulkHabits([
      ...bulkHabits,
      {
        name: '',
        description: '',
        frequency: 'daily',
        habitType: 'boolean',
        minValue: 0,
        maxValue: 10,
        prompt: ''
      }
    ]);
  };

  const updateBulkHabit = (habitIndex, field, value) => {
    const updatedHabits = [...bulkHabits];
    updatedHabits[habitIndex][field] = value;
    setBulkHabits(updatedHabits);
  };

  const applyBulkHabits = () => {
    if (bulkHabits.length === 0) return;
    
    const updatedMemberHabits = getAllMembers().map(member => ({
      member: member.id,
      habits: bulkHabits.map(habit => ({ ...habit }))
    }));
    
    setNewChallenge({
      ...newChallenge,
      memberHabits: updatedMemberHabits
    });
  };

  const removeBulkHabit = (habitIndex) => {
    setBulkHabits(bulkHabits.filter((_, index) => index !== habitIndex));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-md p-4">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded-md p-4">
          <p>Group not found.</p>
        </div>
      </div>
    );
  }

  // Defensive check for leader and user (type-safe)
  const isLeader = group?.leader && user ? String(group.leader.id) === String(user.id) : false;
  const isMember = group?.members?.some(m => String(m.id) === String(user?.id));

  // Handler for ticking off a habit for today
  const handleToggleHabit = async (habitIndex) => {
    if (!myMemberHabit) return;
    setTicking(prev => ({ ...prev, [habitIndex]: true }));
    try {
      // Call backend endpoint to toggle today's completion for this habit
      await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/toggle`, {});
      // Refresh group details
      fetchGroupDetails();
    } catch (err) {
      alert('Failed to update habit completion.');
    } finally {
      setTicking(prev => ({ ...prev, [habitIndex]: false }));
    }
  };

  // Handler for numeric habit updates
  const handleNumericHabitUpdate = (habitIndex, value) => {
    setNumericValues(prev => ({ ...prev, [habitIndex]: value }));
  };

  // Handler for numeric habit submission
  const handleNumericHabitSubmit = async (habitIndex, value) => {
    if (!myMemberHabit || !value) return;
    setTicking(prev => ({ ...prev, [habitIndex]: true }));
    try {
      await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/numeric`, {
        value: value
      });
      fetchGroupDetails();
    } catch (err) {
      alert('Failed to update numeric habit.');
    } finally {
      setTicking(prev => ({ ...prev, [habitIndex]: false }));
    }
  };

  // Handler for text habit updates
  const handleTextHabitUpdate = (habitIndex, value) => {
    setTextValues(prev => ({ ...prev, [habitIndex]: value }));
  };

  // Handler for text habit submission
  const handleTextHabitSubmit = async (habitIndex, value) => {
    if (!myMemberHabit || !value?.trim()) return;
    setTicking(prev => ({ ...prev, [habitIndex]: true }));
    try {
      await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/text`, {
        value: value.trim()
      });
      fetchGroupDetails();
      setEditingHabits(prev => ({ ...prev, [habitIndex]: false }));
    } catch (err) {
      alert('Failed to update text habit.');
    } finally {
      setTicking(prev => ({ ...prev, [habitIndex]: false }));
    }
  };

  // Handler for starting to edit a habit
  const handleStartEdit = (habitIndex, habit) => {
    setEditingHabits(prev => ({ ...prev, [habitIndex]: true }));
    
    // Initialize temp values with current values
    if (habit.habitType === 'numeric') {
      const today = new Date().toISOString().slice(0, 10);
      const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === today);
      const currentValue = progressEntry?.numericValue !== undefined ? progressEntry.numericValue : (habit.minValue || 0);
      setTempNumericValues(prev => ({ ...prev, [habitIndex]: currentValue }));
    } else if (habit.habitType === 'text') {
      const today = new Date().toISOString().slice(0, 10);
      const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === today);
      const currentValue = progressEntry?.textValue || '';
      setTempTextValues(prev => ({ ...prev, [habitIndex]: currentValue }));
    }
  };

  // Handler for canceling edit
  const handleCancelEdit = (habitIndex) => {
    setEditingHabits(prev => ({ ...prev, [habitIndex]: false }));
    setTempNumericValues(prev => {
      const newState = { ...prev };
      delete newState[habitIndex];
      return newState;
    });
    setTempTextValues(prev => {
      const newState = { ...prev };
      delete newState[habitIndex];
      return newState;
    });
  };

  // Handler for updating temp numeric values
  const handleTempNumericUpdate = (habitIndex, value) => {
    setTempNumericValues(prev => ({ ...prev, [habitIndex]: value }));
  };

  // Handler for updating temp text values
  const handleTempTextUpdate = (habitIndex, value) => {
    setTempTextValues(prev => ({ ...prev, [habitIndex]: value }));
  };

  // Handler for submitting edited numeric habit
  const handleEditNumericSubmit = async (habitIndex, value) => {
    if (!myMemberHabit || value === undefined) return;
    setTicking(prev => ({ ...prev, [habitIndex]: true }));
    try {
      await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/numeric`, {
        value: value
      });
      fetchGroupDetails();
      setEditingHabits(prev => ({ ...prev, [habitIndex]: false }));
    } catch (err) {
      alert('Failed to update numeric habit.');
    } finally {
      setTicking(prev => ({ ...prev, [habitIndex]: false }));
    }
  };

  // Handler for submitting edited text habit
  const handleEditTextSubmit = async (habitIndex, value) => {
    if (!myMemberHabit || !value?.trim()) return;
    setTicking(prev => ({ ...prev, [habitIndex]: true }));
    try {
      await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/text`, {
        value: value.trim()
      });
      fetchGroupDetails();
      setEditingHabits(prev => ({ ...prev, [habitIndex]: false }));
    } catch (err) {
      alert('Failed to update text habit.');
    } finally {
      setTicking(prev => ({ ...prev, [habitIndex]: false }));
    }
  };

  // Helper function to calculate progress percentage for numeric habits
  const calculateNumericProgress = (habit, progressEntry) => {
    if (!progressEntry || progressEntry.numericValue === undefined) return 0;
    const min = habit.minValue || 0;
    const max = habit.maxValue || 10;
    const value = progressEntry.numericValue;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  };

  // Helper function to get color based on progress percentage
  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'green';
    if (percentage >= 50) return 'yellow';
    if (percentage >= 20) return 'orange';
    return 'red';
  };

  // Helper function to get color classes based on progress
  const getProgressColorClasses = (percentage) => {
    if (percentage >= 80) {
      return {
        bg: 'bg-green-100 dark:bg-green-900/40',
        border: 'border-green-300 dark:border-green-700',
        text: 'text-green-800 dark:text-green-200'
      };
    }
    if (percentage >= 50) {
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/40',
        border: 'border-yellow-300 dark:border-yellow-700',
        text: 'text-yellow-800 dark:text-yellow-200'
      };
    }
    if (percentage >= 20) {
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/40',
        border: 'border-orange-300 dark:border-orange-700',
        text: 'text-orange-800 dark:text-orange-200'
      };
    }
    return {
      bg: 'bg-red-100 dark:bg-red-900/40',
      border: 'border-red-300 dark:border-red-700',
      text: 'text-red-800 dark:text-red-200'
    };
  };

  // Helper function to calculate overall completion rate considering partial progress
  const calculateOverallCompletionRate = (memberHabits) => {
    let totalWeight = 0;
    let totalProgress = 0;

    memberHabits.forEach(memberHabit => {
      memberHabit.habits.forEach(habit => {
        const today = new Date().toISOString().slice(0, 10);
        const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === today);
        
        // Always count the habit in total weight
        totalWeight += 100;
        
        if (progressEntry) {
          if (habit.habitType === 'numeric') {
            const progress = calculateNumericProgress(habit, progressEntry);
            totalProgress += progress;
          } else {
            // For boolean and text, it's either 0% or 100%
            totalProgress += progressEntry.completed ? 100 : 0;
          }
        } else {
          // If no progress entry exists, count as 0% (incomplete)
          totalProgress += 0;
        }
      });
    });

    return totalWeight > 0 ? totalProgress / totalWeight : 0;
  };

  // Debug logs
  console.log('user:', user);
  console.log('group.leader:', group.leader);
  console.log('isLeader:', isLeader);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{group.name}</h1>
          <p className="text-gray-600">Group ID: {group.groupId}</p>
        </div>
        {isLeader && (
          <button
            onClick={() => setShowCreateChallengeModal(true)}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Create Challenge
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-secondary-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chat'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Group Chat
            </button>
            {isLeader && (
              <button
                onClick={() => setActiveTab('dms')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dms'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                Direct Messages
              </button>
            )}
            {!isLeader && (
              <button
                onClick={() => setActiveTab('dm')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dm'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                Message Leader
              </button>
            )}
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'leaderboard'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Leaderboard
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Members</h2>
        {group.members && group.members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {group.members.map(member => (
              <div
                key={member.id}
                className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-4 flex items-center gap-4 border border-gray-200 dark:border-secondary-700 transition-transform transform hover:scale-[1.025] hover:shadow-2xl group cursor-pointer"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xl font-bold text-primary-700 dark:text-primary-200 group-hover:ring-4 group-hover:ring-primary-200/40">
                  {member.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-secondary-900 dark:text-white truncate">{member.username}</div>
                  <div className="text-sm text-secondary-500 dark:text-secondary-400 truncate">{member.email}</div>
                </div>
                {group.leader && String(group.leader.id) === String(member.id) && (
                  <span className="ml-2 px-2 py-1 text-xs rounded bg-gradient-to-r from-primary-100 to-primary-300 dark:from-primary-900 dark:to-primary-700 text-primary-800 dark:text-primary-200 font-semibold shadow-sm border border-primary-200 dark:border-primary-800">Leader</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No members yet.</p>
        )}
      </div>

      {/* Active Challenge */}
      {group.activeChallenge && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Active Challenge</h2>
          <div className="border rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">
                  Start Date: {new Date(group.activeChallenge.startDate).toLocaleDateString()}
                </p>
                <p className="text-gray-600">
                  End Date: {new Date(group.activeChallenge.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Status: {group.activeChallenge.status}</p>
              </div>
            </div>

            {/* Group Progress Overview */}
            {isLeader && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">Group Progress Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Average Overall Completion Rate */}
                  <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-4">
                    <h4 className="text-lg font-medium mb-4">Average Overall Completion Rate</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={(() => {
                            const start = new Date(group.activeChallenge.startDate);
                            // Use today if challenge is ongoing, otherwise use end date
                            const challengeEnd = new Date(group.activeChallenge.endDate);
                            const today = new Date();
                            const isOngoing = today < challengeEnd;
                            const end = isOngoing ? today : challengeEnd;
                            const allDates = [];
                            let d = new Date(start);
                            while (d <= end) {
                              allDates.push(formatDateLocal(d));
                              d.setDate(d.getDate() + 1);
                            }
                            return allDates.map(dateStr => {
                              const userAverages = (group.activeChallenge.memberHabits || []).map(memberHabit => {
                                const habits = memberHabit.habits || [];
                                if (habits.length === 0) return null;
                                let userTotal = 0;
                                habits.forEach(habit => {
                                  const progress = (habit.progress || []).find(p => p.date && formatDateLocal(new Date(p.date)) === dateStr);
                                  if (progress) {
                                    if (habit.habitType === 'numeric') {
                                      userTotal += calculateNumericProgress(habit, progress);
                                    } else {
                                      userTotal += progress.completed ? 100 : 0;
                                    }
                                  } else {
                                    userTotal += 0;
                                  }
                                });
                                return userTotal / habits.length;
                              }).filter(val => val !== null);
                              const dayAvg = userAverages.length > 0 ? (userAverages.reduce((a, b) => a + b, 0) / userAverages.length) : 0;
                              return {
                                date: dateStr,
                                rate: dayAvg
                              };
                            });
                          })()}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip 
                            formatter={(value) => [`${value.toFixed(1)}%`, 'Average Completion Rate']}
                            labelFormatter={(label) => `Date: ${label}`}
                          />
                          <Line type="monotone" dataKey="rate" stroke="#3b82f6" name="Average Completion Rate" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Member Progress Distribution */}
                  <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-4">
                    <h4 className="text-lg font-medium mb-4">Member Progress Distribution</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={group.activeChallenge.memberHabits?.map(memberHabit => {
                              const member = group.members?.find(m => 
                                String(m.id) === String(memberHabit.member) || 
                                String(m.id) === String(memberHabit.member?.id)
                              );
                              const totalHabits = memberHabit.habits?.length || 0;
                              const today = new Date().toISOString().slice(0, 10);
                              
                              const totalProgress = memberHabit.habits?.reduce((acc, habit) => {
                                const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === today);
                                if (progressEntry) {
                                  if (habit.habitType === 'numeric') {
                                    return acc + calculateNumericProgress(habit, progressEntry);
                                  } else {
                                    return acc + (progressEntry.completed ? 100 : 0);
                                  }
                                }
                                // If no progress entry exists, count as 0% (incomplete)
                                return acc + 0;
                              }, 0) || 0;
                              
                              return {
                                name: member?.username || 'Unknown Member',
                                value: totalHabits > 0 ? (totalProgress / totalHabits) : 0
                              };
                            })}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {group.activeChallenge.memberHabits?.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name, props) => [
                            `${value.toFixed(1)}%`, 
                            `${props.payload.name} - Completion Rate`
                          ]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Member Progress */}
            {isLeader && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">Member Progress</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6">
                  {(group.activeChallenge.memberHabits || []).map((memberHabit, index) => {
                    const member = group.members?.find(m => String(m.id) === String(memberHabit.member) || String(m.id) === String(memberHabit.member?.id));
                    return (
                      <div
                        key={index}
                        className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg border border-gray-200 dark:border-secondary-700 p-6 flex flex-col gap-4 transition-transform transform hover:scale-[1.02] hover:shadow-2xl group"
                      >
                        <div className="flex items-center gap-4 mb-2">
                          <Link to={`/groups/${groupId}/member/${member?.id || memberHabit.member}`} className="flex items-center gap-4 group-hover:underline">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xl font-bold text-primary-700 dark:text-primary-200 group-hover:ring-4 group-hover:ring-primary-200/40">
                              {member?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lg text-primary-600 dark:text-primary-300 truncate">
                                {member?.username || 'Unknown Member'}
                              </div>
                              <div className="text-xs text-secondary-500 dark:text-secondary-400 truncate">
                                {member?.email || ''}
                              </div>
                            </div>
                          </Link>
                        </div>
                        <div className="space-y-3 mt-2">
                          {(memberHabit.habits || []).map((habit, habitIndex) => {
                            // Find today's progress entry
                            const today = new Date().toISOString().slice(0, 10);
                            const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === today);
                            const isComplete = progressEntry?.completed;
                            const numericValue = progressEntry?.numericValue;
                            const textValue = progressEntry?.textValue;
                            
                            // Calculate progress and colors for numeric habits
                            let progressPercentage = 0;
                            let colorClasses = {
                              bg: 'bg-gray-100 dark:bg-secondary-700',
                              border: 'border-gray-200 dark:border-secondary-600',
                              text: 'text-gray-800 dark:text-gray-200'
                            };
                            
                            if (isComplete) {
                              if (habit.habitType === 'numeric') {
                                progressPercentage = calculateNumericProgress(habit, progressEntry);
                                colorClasses = getProgressColorClasses(progressPercentage);
                              } else {
                                progressPercentage = 100;
                                colorClasses = {
                                  bg: 'bg-green-100 dark:bg-green-900/40',
                                  border: 'border-green-300 dark:border-green-700',
                                  text: 'text-green-800 dark:text-green-200'
                                };
                              }
                            }

                            return (
                              <div
                                key={habitIndex}
                                className={`rounded-lg p-3 flex flex-col gap-2 border transition-colors duration-200 ${colorClasses.bg} ${colorClasses.border}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`font-medium ${colorClasses.text}`}>{habit.name}</span>
                                  {isComplete && (
                                    <div className="flex items-center gap-1">
                                      {habit.habitType === 'numeric' && (
                                        <span className={`text-xs font-medium ${colorClasses.text}`}>
                                          {progressPercentage.toFixed(0)}%
                                        </span>
                                      )}
                                      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                                          <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {habit.description && (
                                  <span className={`text-xs ${colorClasses.text} opacity-80`}>{habit.description}</span>
                                )}

                                {/* Show detailed information for completed habits */}
                                {isComplete && (
                                  <div className={`mt-2 p-2 rounded border ${colorClasses.border} ${colorClasses.bg} bg-opacity-50`}>
                                    {habit.habitType === 'numeric' && (
                                      <div className="space-y-1">
                                        <div className={`text-sm font-medium ${colorClasses.text}`}>
                                          Value: {numericValue !== undefined ? numericValue : (habit.minValue || 0)}
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          Range: {habit.minValue || 0} - {habit.maxValue || 10}
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                          <div 
                                            className={`h-2 rounded-full ${
                                              progressPercentage >= 80 ? 'bg-green-500' :
                                              progressPercentage >= 50 ? 'bg-yellow-500' :
                                              progressPercentage >= 20 ? 'bg-orange-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${progressPercentage}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {habit.habitType === 'text' && (
                                      <div className="space-y-1">
                                        <div className={`text-sm font-medium ${colorClasses.text}`}>
                                          Response:
                                        </div>
                                        <div className={`text-sm ${colorClasses.text} bg-white dark:bg-gray-800 p-2 rounded border`}>
                                          {textValue || 'No response provided'}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {(habit.habitType === 'boolean' || !habit.habitType) && (
                                      <div className={`text-sm ${colorClasses.text}`}>
                                        ✓ Completed
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Show incomplete status */}
                                {!isComplete && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Not completed today
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checklist for logged-in member */}
      {isMember && !isLeader && myMemberHabit && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Today's Group Habits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {myMemberHabit.habits.map((habit, idx) => {
              // Find today's progress entry
              const today = new Date().toISOString().slice(0, 10);
              const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === today);
              const isComplete = progressEntry?.completed;
              const numericValue = progressEntry?.numericValue;
              const textValue = progressEntry?.textValue;
              const isEditing = editingHabits[idx];

              return (
                <div
                  key={idx}
                  className={`rounded-lg shadow-md p-4 border transition-transform hover:scale-[1.01] ${
                    isComplete 
                      ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700' 
                      : 'bg-white dark:bg-secondary-800 border-gray-200 dark:border-secondary-700'
                  }`}
                >
                  <div className="flex-1 min-w-0 mb-3">
                    <div className="font-medium text-secondary-900 dark:text-white">{habit.name}</div>
                    {habit.description && (
                      <div className="text-sm text-secondary-500 dark:text-secondary-300 mt-1">{habit.description}</div>
                    )}
                  </div>

                  {/* Show completion status and edit button for completed habits */}
                  {isComplete && !isEditing && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">Completed</span>
                      </div>
                      <button
                        onClick={() => handleStartEdit(idx, habit)}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                    </div>
                  )}

                  {/* Show current value for completed habits */}
                  {isComplete && !isEditing && (
                    <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                      {habit.habitType === 'numeric' && (
                        <div className="text-sm text-green-800 dark:text-green-200">
                          Value: {numericValue !== undefined ? numericValue : (habit.minValue || 0)}
                        </div>
                      )}
                      {habit.habitType === 'text' && (
                        <div className="text-sm text-green-800 dark:text-green-200">
                          Response: {textValue || 'No response'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Habit Type Specific UI - Only show if not completed or if editing */}
                  {(!isComplete || isEditing) && (
                    <>
                      {(habit.habitType === 'boolean' || !habit.habitType) && (
                        <button
                          onClick={() => handleToggleHabit(idx)}
                          disabled={ticking[idx]}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${isComplete ? 'bg-primary-500 border-primary-500' : 'bg-transparent border-primary-400'} ${ticking[idx] ? 'opacity-60' : ''}`}
                        >
                          {isComplete && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                              <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                            </svg>
                          )}
                          {ticking[idx] && (
                            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </button>
                      )}

                      {habit.habitType === 'numeric' && (
                        <div className="space-y-2">
                          <div className="text-sm text-secondary-600 dark:text-secondary-400">
                            Range: {habit.minValue || 0} - {habit.maxValue || 10}
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Value: {isEditing 
                                  ? (tempNumericValues[idx] !== undefined ? tempNumericValues[idx] : (habit.minValue || 0))
                                  : (numericValues[idx] !== undefined ? numericValues[idx] : (habit.minValue || 0))
                                }
                              </span>
                              <span className="text-sm text-secondary-500">
                                {habit.minValue || 0} - {habit.maxValue || 10}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={habit.minValue || 0}
                              max={habit.maxValue || 10}
                              step="1"
                              value={isEditing 
                                ? (tempNumericValues[idx] !== undefined ? tempNumericValues[idx] : (habit.minValue || 0))
                                : (numericValues[idx] !== undefined ? numericValues[idx] : (habit.minValue || 0))
                              }
                              onChange={(e) => isEditing 
                                ? handleTempNumericUpdate(idx, parseInt(e.target.value))
                                : handleNumericHabitUpdate(idx, parseInt(e.target.value))
                              }
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <div className="flex gap-2">
                              {isEditing && (
                                <button
                                  onClick={() => handleCancelEdit(idx)}
                                  className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              )}
                              <button
                                onClick={() => isEditing 
                                  ? handleEditNumericSubmit(idx, tempNumericValues[idx])
                                  : handleNumericHabitSubmit(idx, numericValues[idx])
                                }
                                disabled={ticking[idx] || (isEditing ? tempNumericValues[idx] === undefined : numericValues[idx] === undefined)}
                                className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                              >
                                {ticking[idx] ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {habit.habitType === 'text' && (
                        <div className="space-y-2">
                          <div className="text-sm text-secondary-600 dark:text-secondary-400">
                            {habit.prompt || 'Enter your response'}
                          </div>
                          <textarea
                            value={isEditing ? (tempTextValues[idx] || '') : (textValues[idx] || '')}
                            onChange={(e) => isEditing 
                              ? handleTempTextUpdate(idx, e.target.value)
                              : handleTextHabitUpdate(idx, e.target.value)
                            }
                            placeholder="Enter your response..."
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                          />
                          <div className="flex gap-2">
                            {isEditing && (
                              <button
                                onClick={() => handleCancelEdit(idx)}
                                className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={() => isEditing 
                                ? handleEditTextSubmit(idx, tempTextValues[idx])
                                : handleTextHabitSubmit(idx, textValues[idx])
                              }
                              disabled={ticking[idx] || (isEditing ? !tempTextValues[idx]?.trim() : !textValues[idx]?.trim())}
                              className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                            >
                              {ticking[idx] ? 'Saving...' : (isEditing ? 'Update' : 'Submit')}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
        </div>
      )}

      {/* Group Chat Tab */}
      {activeTab === 'chat' && (
        <div className="h-96">
          <GroupChat groupId={group.id} groupName={group.name} />
        </div>
      )}

      {/* Direct Messages Tab (for Leaders) */}
      {activeTab === 'dms' && isLeader && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Direct Messages</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.members.map(member => (
              <div
                key={member.id}
                className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-secondary-700 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedDMUser(member)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-200">
                    {member.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-secondary-900 dark:text-white">{member.username}</div>
                    <div className="text-sm text-secondary-500 dark:text-secondary-400">Click to message</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {selectedDMUser && (
            <div className="mt-6 h-96">
              <DirectMessage 
                groupId={group.groupId} 
                targetUserId={selectedDMUser.id} 
                targetUsername={selectedDMUser.username}
                isLeader={true}
              />
            </div>
          )}
        </div>
      )}

      {/* Direct Message Tab (for Members) */}
      {activeTab === 'dm' && !isLeader && (
        <div className="h-96">
          <DirectMessage 
            groupId={group.groupId} 
            targetUserId={group.leader?.id} 
            targetUsername={group.leader?.username}
            isLeader={false}
          />
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🏆 Habit Streaks Leaderboard</h2>
            <p className="text-secondary-600 dark:text-secondary-400 mb-4">Compete for the top spot! Ranking combines your best streak (60%) and total completions (40%).</p>
            
            {/* Ranking System Explanation */}
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800">
              <h3 className="font-semibold text-secondary-900 dark:text-white mb-2">📊 How Ranking Works:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-primary-600 dark:text-primary-400">60% - Best Streak:</span>
                  <span className="text-secondary-600 dark:text-secondary-400 ml-2">Your longest consecutive day streak</span>
                </div>
                <div>
                  <span className="font-medium text-primary-600 dark:text-primary-400">40% - Total Completions:</span>
                  <span className="text-secondary-600 dark:text-secondary-400 ml-2">Sum of all your habit completions</span>
                </div>
              </div>
            </div>
          </div>

          {group.activeChallenge ? (
            <div className="space-y-3">
              {(() => {
                // Calculate current streaks for all members
                const leaderboardData = group.activeChallenge.memberHabits?.map(memberHabit => {
                  const member = group.members?.find(m => String(m.id) === String(memberHabit.member) || String(m.id) === String(memberHabit.member?.id));
                  if (!member) return null;

                  // Calculate current streak for each habit
                  const habitStreaks = memberHabit.habits?.map(habit => {
                    const today = new Date().toISOString().slice(0, 10);
                    let currentStreak = 0;
                    let lastDate = new Date(today);
                    
                    // Go backwards from today to find consecutive completed days
                    while (true) {
                      const dateStr = lastDate.toISOString().slice(0, 10);
                      const progressEntry = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === dateStr);
                      
                      if (progressEntry && progressEntry.completed) {
                        currentStreak++;
                        lastDate.setDate(lastDate.getDate() - 1);
                      } else {
                        break;
                      }
                    }
                    
                    return {
                      habitName: habit.name,
                      streak: currentStreak,
                      habitType: habit.habitType
                    };
                  }) || [];

                  // Get the highest streak among all habits
                  const maxStreak = Math.max(...habitStreaks.map(h => h.streak), 0);
                  const totalHabits = habitStreaks.length;
                  const completedToday = habitStreaks.filter(h => h.streak > 0).length;
                  const totalCompleted = habitStreaks.reduce((sum, h) => sum + h.streak, 0);

                  // Calculate weighted score: 60% streak + 40% total completions
                  // Normalize both metrics to 0-100 scale for fair comparison
                  const maxPossibleStreak = 30; // Assume 30 days as max reasonable streak
                  const maxPossibleCompletions = totalHabits * 30; // Assume 30 days max
                  
                  const streakScore = Math.min((maxStreak / maxPossibleStreak) * 100, 100);
                  const completionScore = Math.min((totalCompleted / maxPossibleCompletions) * 100, 100);
                  
                  const weightedScore = (streakScore * 0.6) + (completionScore * 0.4);

                  return {
                    member,
                    maxStreak,
                    totalHabits,
                    completedToday,
                    totalCompleted,
                    weightedScore,
                    habitStreaks,
                    isLeader: group.leader && String(group.leader.id) === String(member.id),
                    isCurrentUser: user && String(user.id) === String(member.id)
                  };
                }).filter(Boolean).sort((a, b) => b.weightedScore - a.weightedScore) || [];

                return leaderboardData.map((entry, index) => (
                  <div
                    key={entry.member.id}
                    className={`relative bg-white dark:bg-secondary-800 rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] ${
                      entry.isCurrentUser ? 'ring-4 ring-primary-500/30 border-primary-500' :
                      index === 0 ? 'border-yellow-400 dark:border-yellow-500 shadow-yellow-200/20' :
                      index === 1 ? 'border-gray-300 dark:border-gray-600 shadow-gray-200/20' :
                      index === 2 ? 'border-orange-400 dark:border-orange-500 shadow-orange-200/20' :
                      'border-gray-200 dark:border-secondary-700'
                    }`}
                  >
                    {/* Current User Indicator */}
                    {entry.isCurrentUser && (
                      <div className="absolute -top-3 left-6 bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                        YOU
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          {/* Ranking Badge */}
                          <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                            index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600 text-white' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                            'bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 text-primary-700 dark:text-primary-200'
                          }`}>
                            {index + 1}
                          </div>

                          {/* Member Avatar and Info */}
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-2xl font-bold text-primary-700 dark:text-primary-200 shadow-lg">
                              {entry.member.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold text-secondary-900 dark:text-white">
                                  {entry.member.username}
                                </h3>
                                {entry.isLeader && (
                                  <span className="px-3 py-1 text-xs rounded-full bg-gradient-to-r from-primary-100 to-primary-300 dark:from-primary-900 dark:to-primary-700 text-primary-800 dark:text-primary-200 font-semibold shadow-sm">
                                    LEADER
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-sm text-secondary-600 dark:text-secondary-400">
                                  {entry.completedToday}/{entry.totalHabits} today
                                </span>
                                <span className="text-sm text-secondary-600 dark:text-secondary-400">
                                  {entry.totalCompleted} total completions
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Streak Display */}
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            {entry.maxStreak > 0 && (
                              <div className="text-3xl animate-pulse">🔥</div>
                            )}
                            <div>
                              <div className="text-4xl font-bold text-secondary-900 dark:text-white">
                                {entry.maxStreak}
                              </div>
                              <div className="text-sm font-medium text-secondary-600 dark:text-secondary-400 uppercase tracking-wide">
                                Day{entry.maxStreak !== 1 ? 's' : ''} Streak
                              </div>
                            </div>
                          </div>
                          
                          {/* Weighted Score */}
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-secondary-700">
                            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                              {Math.round(entry.weightedScore)}
                            </div>
                            <div className="text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wide">
                              Score
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Individual Habit Streaks - Only for Leaders or Current User */}
                      {(isLeader || entry.isCurrentUser) && entry.habitStreaks.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-secondary-700">
                          <h4 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-3 uppercase tracking-wide">
                            {entry.isCurrentUser ? 'Your Habit Details:' : 'Habit Breakdown:'}
                          </h4>
                          
                          {/* Score Breakdown */}
                          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <h5 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-2 uppercase tracking-wide">
                              Score Breakdown:
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                                  {Math.round(entry.weightedScore)}
                                </div>
                                <div className="text-xs text-secondary-500 dark:text-secondary-400">Total Score</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                  {Math.round((entry.maxStreak / 30) * 100 * 0.6)}
                                </div>
                                <div className="text-xs text-secondary-500 dark:text-secondary-400">Streak Points (60%)</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                  {Math.round((entry.totalCompleted / (entry.totalHabits * 30)) * 100 * 0.4)}
                                </div>
                                <div className="text-xs text-secondary-500 dark:text-secondary-400">Completion Points (40%)</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {entry.habitStreaks.map((habit, habitIndex) => (
                              <div
                                key={habitIndex}
                                className={`flex items-center justify-between p-3 rounded-xl border ${
                                  habit.streak > 0 
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-secondary-900 dark:text-white truncate">
                                    {habit.habitName}
                                  </div>
                                  <div className="text-xs text-secondary-500 dark:text-secondary-400 uppercase tracking-wide">
                                    {habit.habitType}
                                  </div>
                                </div>
                                <div className="ml-3 text-right">
                                  <div className={`text-lg font-bold ${
                                    habit.streak > 0 
                                      ? 'text-green-600 dark:text-green-400' 
                                      : 'text-gray-400 dark:text-gray-500'
                                  }`}>
                                    {habit.streak}
                                  </div>
                                  <div className="text-xs text-secondary-500 dark:text-secondary-400">
                                    days
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-8xl mb-6">🏆</div>
              <h3 className="text-2xl font-bold text-secondary-900 dark:text-white mb-3">
                No Active Challenge
              </h3>
              <p className="text-secondary-600 dark:text-secondary-400 mb-6 max-w-md mx-auto">
                Start a challenge to compete with your group members and see who can build the longest habit streaks!
              </p>
              {isLeader && (
                <button
                  onClick={() => setShowCreateChallengeModal(true)}
                  className="bg-primary-600 text-white py-3 px-8 rounded-xl hover:bg-primary-700 transition-colors font-semibold shadow-lg hover:shadow-xl"
                >
                  Create Challenge
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateChallengeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary-800 rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-4 text-secondary-900 dark:text-white">Create New Challenge</h2>
            <form onSubmit={handleCreateChallenge} className="space-y-6">
              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                  <input
                    type="date"
                    value={newChallenge.startDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, startDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                  <input
                    type="date"
                    value={newChallenge.endDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, endDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Bulk Create Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Bulk Create Habits</h3>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={bulkCreate}
                        onChange={(e) => setBulkCreate(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Apply same habits to all members</span>
                    </label>
                  </div>
                  {bulkCreate && (
                    <button
                      type="button"
                      onClick={addBulkHabit}
                      className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
                    >
                      Add Habit Template
                    </button>
                  )}
                </div>

                {bulkCreate && (
                  <div className="space-y-4 mb-6">
                    {bulkHabits.map((habit, habitIndex) => (
                      <div key={habitIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-secondary-900 dark:text-white">Habit Template {habitIndex + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeBulkHabit(habitIndex)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                        
                        {/* Basic Habit Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Habit Name</label>
                            <input
                              type="text"
                              value={habit.name}
                              onChange={(e) => updateBulkHabit(habitIndex, 'name', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                            <input
                              type="text"
                              value={habit.description}
                              onChange={(e) => updateBulkHabit(habitIndex, 'description', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Habit Type Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Habit Type</label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                              <input
                                type="radio"
                                name={`bulk-habit-type-${habitIndex}`}
                                value="boolean"
                                checked={habit.habitType === 'boolean'}
                                onChange={(e) => updateBulkHabit(habitIndex, 'habitType', e.target.value)}
                                className="mr-2"
                              />
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">Checkbox</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Simple yes/no</div>
                              </div>
                            </label>
                            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                              <input
                                type="radio"
                                name={`bulk-habit-type-${habitIndex}`}
                                value="numeric"
                                checked={habit.habitType === 'numeric'}
                                onChange={(e) => updateBulkHabit(habitIndex, 'habitType', e.target.value)}
                                className="mr-2"
                              />
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">Numeric Range</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Set min/max values</div>
                              </div>
                            </label>
                            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                              <input
                                type="radio"
                                name={`bulk-habit-type-${habitIndex}`}
                                value="text"
                                checked={habit.habitType === 'text'}
                                onChange={(e) => updateBulkHabit(habitIndex, 'habitType', e.target.value)}
                                className="mr-2"
                              />
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">Text Entry</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Written response</div>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Conditional Fields based on Habit Type */}
                        {habit.habitType === 'numeric' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Minimum Value</label>
                              <input
                                type="number"
                                value={habit.minValue}
                                onChange={(e) => updateBulkHabit(habitIndex, 'minValue', parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Maximum Value</label>
                              <input
                                type="number"
                                value={habit.maxValue}
                                onChange={(e) => updateBulkHabit(habitIndex, 'maxValue', parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                required
                              />
                            </div>
                          </div>
                        )}

                        {habit.habitType === 'text' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prompt/Question</label>
                            <input
                              type="text"
                              value={habit.prompt}
                              onChange={(e) => updateBulkHabit(habitIndex, 'prompt', e.target.value)}
                              placeholder="e.g., What did you learn today?"
                              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              required
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {bulkHabits.length > 0 && (
                      <button
                        type="button"
                        onClick={applyBulkHabits}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Apply to All Members ({getAllMembers().length} members)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Individual Member Habits (only show if not using bulk create) */}
              {!bulkCreate && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Individual Member Habits</h3>
                    <button
                      type="button"
                      onClick={addMemberHabit}
                      className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
                    >
                      Add Member
                    </button>
                  </div>
                  <div className="space-y-4">
                    {newChallenge.memberHabits.map((memberHabit, memberIndex) => (
                      <div key={memberIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Member</label>
                          <select
                            value={memberHabit.member}
                            onChange={(e) => updateMemberSelection(memberIndex, e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            required
                          >
                            <option value="">Select Member</option>
                            {group.members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.username}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium text-secondary-900 dark:text-white">Habits</h4>
                            <button
                              type="button"
                              onClick={() => addHabitToMember(memberIndex)}
                              className="bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700 text-sm transition-colors"
                            >
                              Add Habit
                            </button>
                          </div>
                          <div className="space-y-4">
                            {memberHabit.habits.map((habit, habitIndex) => (
                              <div key={habitIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4">
                                {/* Basic Habit Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Habit Name</label>
                                    <input
                                      type="text"
                                      value={habit.name}
                                      onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'name', e.target.value)}
                                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                                    <input
                                      type="text"
                                      value={habit.description}
                                      onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'description', e.target.value)}
                                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                    />
                                  </div>
                                </div>

                                {/* Habit Type Selection */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Habit Type</label>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                      <input
                                        type="radio"
                                        name={`habit-type-${memberIndex}-${habitIndex}`}
                                        value="boolean"
                                        checked={habit.habitType === 'boolean'}
                                        onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'habitType', e.target.value)}
                                        className="mr-2"
                                      />
                                      <div>
                                        <div className="font-medium text-secondary-900 dark:text-white">Checkbox</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Simple yes/no</div>
                                      </div>
                                    </label>
                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                      <input
                                        type="radio"
                                        name={`habit-type-${memberIndex}-${habitIndex}`}
                                        value="numeric"
                                        checked={habit.habitType === 'numeric'}
                                        onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'habitType', e.target.value)}
                                        className="mr-2"
                                      />
                                      <div>
                                        <div className="font-medium text-secondary-900 dark:text-white">Numeric Range</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Set min/max values</div>
                                      </div>
                                    </label>
                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                      <input
                                        type="radio"
                                        name={`habit-type-${memberIndex}-${habitIndex}`}
                                        value="text"
                                        checked={habit.habitType === 'text'}
                                        onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'habitType', e.target.value)}
                                        className="mr-2"
                                      />
                                      <div>
                                        <div className="font-medium text-secondary-900 dark:text-white">Text Entry</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Written response</div>
                                      </div>
                                    </label>
                                  </div>
                                </div>

                                {/* Conditional Fields based on Habit Type */}
                                {habit.habitType === 'numeric' && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Minimum Value</label>
                                      <input
                                        type="number"
                                        value={habit.minValue}
                                        onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'minValue', parseInt(e.target.value))}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Maximum Value</label>
                                      <input
                                        type="number"
                                        value={habit.maxValue}
                                        onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'maxValue', parseInt(e.target.value))}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        required
                                      />
                                    </div>
                                  </div>
                                )}

                                {habit.habitType === 'text' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prompt/Question</label>
                                    <input
                                      type="text"
                                      value={habit.prompt}
                                      onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'prompt', e.target.value)}
                                      placeholder="e.g., What did you learn today?"
                                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      required
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Status */}
              {!isChallengeValid() && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">Challenge Setup Incomplete</span>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    {getMissingMembers().length > 0 
                      ? `${getMissingMembers().length} member(s) still need habits assigned: ${getMissingMembers().map(m => m.username).join(', ')}`
                      : 'All members need at least one habit assigned.'
                    }
                  </p>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateChallengeModal(false)}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-4 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <div className="relative group">
                  <button
                    type="submit"
                    disabled={!isChallengeValid()}
                    className={`py-2 px-6 rounded font-medium transition-all ${
                      isChallengeValid()
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    Create Challenge
                  </button>
                  
                  {/* Tooltip for disabled state */}
                  {!isChallengeValid() && (
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {getMissingMembers().length > 0 
                        ? `Missing habits for: ${getMissingMembers().map(m => m.username).join(', ')}`
                        : 'All members need habits assigned'
                      }
                      <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail; 