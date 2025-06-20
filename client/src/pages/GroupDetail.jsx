import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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
  const { currentUser: user } = useAuth();
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [ticking, setTicking] = useState({});

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

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
      if (response.data.clientSecret) {
        setPaymentIntent(response.data.clientSecret);
        setShowPaymentModal(true);
      }
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
      frequency: 'daily'
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

  const PaymentForm = () => {
    const stripe = useStripe();
    const elements = useElements();
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/groups/${groupId}`,
        },
      });
      if (error) {
        console.error('Payment error:', error);
      } else {
        setShowPaymentModal(false);
        fetchGroupDetails();
      }
    };
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />
        <button
          type="submit"
          disabled={!stripe}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Pay Now
        </button>
      </form>
    );
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
  const myMemberHabit = group?.activeChallenge?.memberHabits?.find(
    mh => String(mh.member) === String(user?.id) || String(mh.member?.id) === String(user?.id)
  );

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
                  {/* Daily Completion Rate */}
                  <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-4">
                    <h4 className="text-lg font-medium mb-4">Daily Completion Rate</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={(() => {
                            const start = new Date(group.activeChallenge.startDate);
                            const end = new Date(group.activeChallenge.endDate);
                            const today = new Date();
                            const allDates = [];
                            const numDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
                            for (let i = 0; i < numDays; i++) {
                              const date = new Date(start);
                              date.setDate(start.getDate() + i);
                              allDates.push(date);
                            }
                            return allDates.map(dateObj => {
                              const dateStr = dateObj.toISOString().slice(0, 10);
                              let totalCompleted = 0;
                              let totalTasks = 0;
                              (group.activeChallenge.memberHabits || []).forEach(memberHabit => {
                                (memberHabit.habits || []).forEach(habit => {
                                  const progress = (habit.progress || []).find(p => p.date && p.date.slice(0, 10) === dateStr);
                                  if (progress) {
                                    totalTasks += 1;
                                    if (progress.completed) totalCompleted += 1;
                                  } else if (dateStr < new Date().toISOString().slice(0, 10)) {
                                    totalTasks += 1;
                                  }
                                });
                              });
                              return {
                                date: dateStr,
                                rate: totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0
                              };
                            });
                          })()}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Completion Rate']} />
                          <Line type="monotone" dataKey="rate" stroke="#3b82f6" name="Completion Rate" />
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
                              const member = group.members?.find(m => m.id === memberHabit.member);
                              const totalHabits = memberHabit.habits?.length || 0;
                              const completedHabits = memberHabit.habits?.reduce((acc, habit) => {
                                const completed = habit.progress?.filter(day => day.completed).length || 0;
                                const total = habit.progress?.length || 0;
                                return acc + (total > 0 ? completed / total : 0);
                              }, 0) || 0;
                              
                              return {
                                name: member?.username || 'Unknown',
                                value: totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0
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
                          <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Completion']} />
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
                            return (
                              <div
                                key={habitIndex}
                                className={`rounded-lg p-3 flex flex-col gap-1 border transition-colors duration-200 ${isComplete ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700' : 'bg-gray-100 dark:bg-secondary-700 border-gray-200 dark:border-secondary-600'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-secondary-900 dark:text-white">{habit.name}</span>
                                </div>
                                {habit.description && (
                                  <span className="text-xs text-secondary-500 dark:text-secondary-300">{habit.description}</span>
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
              return (
                <div
                  key={idx}
                  className={`bg-white dark:bg-secondary-800 rounded-lg shadow-md p-4 flex items-center gap-4 border border-gray-200 dark:border-secondary-700 transition-transform hover:scale-[1.01]`}
                >
                  <button
                    onClick={() => handleToggleHabit(idx)}
                    disabled={ticking[idx]}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors duration-200 mr-3 ${isComplete ? 'bg-primary-500 border-primary-500' : 'bg-transparent border-primary-400'} ${ticking[idx] ? 'opacity-60' : ''}`}
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
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-secondary-900 dark:text-white ${isComplete ? 'line-through text-secondary-400 dark:text-secondary-500' : ''}`}>{habit.name}</div>
                    {habit.description && (
                      <div className="text-sm text-secondary-500 dark:text-secondary-300 mt-1">{habit.description}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateChallengeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-4">Create New Challenge</h2>
            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={newChallenge.startDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, startDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={newChallenge.endDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, endDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Member Habits */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Member Habits</h3>
                  <button
                    type="button"
                    onClick={addMemberHabit}
                    className="bg-green-600 text-white py-1 px-3 rounded hover:bg-green-700"
                  >
                    Add Member
                  </button>
                </div>
                <div className="space-y-4">
                  {newChallenge.memberHabits.map((memberHabit, memberIndex) => (
                    <div key={memberIndex} className="border rounded-lg p-4">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Member</label>
                        <select
                          value={memberHabit.member}
                          onChange={(e) => updateMemberSelection(memberIndex, e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                          <h4 className="font-medium">Habits</h4>
                          <button
                            type="button"
                            onClick={() => addHabitToMember(memberIndex)}
                            className="bg-blue-600 text-white py-1 px-2 rounded hover:bg-blue-700 text-sm"
                          >
                            Add Habit
                          </button>
                        </div>
                        <div className="space-y-2">
                          {memberHabit.habits.map((habit, habitIndex) => (
                            <div key={habitIndex} className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                  type="text"
                                  value={habit.name}
                                  onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'name', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <input
                                  type="text"
                                  value={habit.description}
                                  onChange={(e) => updateMemberHabit(memberIndex, habitIndex, 'description', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateChallengeModal(false)}
                  className="bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Create Challenge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && paymentIntent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold mb-4">Complete Payment</h2>
            <p className="text-gray-600 mb-4">
              Total: £{(group.members.length * 1.99).toFixed(2)}
            </p>
            <Elements stripe={stripePromise} options={{ clientSecret: paymentIntent }}>
              <PaymentForm />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail; 