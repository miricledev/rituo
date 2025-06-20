import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import axios from 'axios';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const Groups = () => {
  const [groups, setGroups] = useState({ memberOf: [], leading: [] });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [newGroup, setNewGroup] = useState({
    name: '',
    password: '',
    memberCount: 1
  });
  const [joinGroup, setJoinGroup] = useState({
    groupId: '',
    password: ''
  });
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Groups component mounted');
    console.log('Current user:', currentUser);
    console.log('User ID:', currentUser?.id);
    console.log('User token:', currentUser?.token);
    fetchGroups();
  }, [currentUser]);

  const fetchGroups = async () => {
    try {
      console.log('Fetching groups for user:', currentUser?.id);
      const response = await axios.get('/groups/my-groups');
      console.log('Response status:', response.status);
      console.log('Fetched groups:', response.data);
      console.log('Leading groups:', response.data.leading);
      console.log('Member groups:', response.data.memberOf);
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      console.log('Creating group with data:', {
        name: newGroup.name,
        password: newGroup.password,
        memberCount: newGroup.memberCount
      });
      const response = await axios.post('/groups/create', {
        name: newGroup.name,
        password: newGroup.password,
        memberCount: newGroup.memberCount
      });
      console.log('Group created:', response.data);
      setShowCreateModal(false);
      setNewGroup({
        name: '',
        password: '',
        memberCount: 1
      });
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        config: error.config
      });
      const errorMessage = error.response?.data?.error || error.message;
      const errorDetails = error.response?.data?.details || '';
      const errorType = error.response?.data?.type || '';
      alert(`Failed to create group: ${errorMessage}\n${errorDetails ? `Details: ${errorDetails}` : ''}\n${errorType ? `Type: ${errorType}` : ''}`);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/groups/join', joinGroup);
      setShowJoinModal(false);
      fetchGroups();
    } catch (error) {
      console.error('Error joining group:', error);
    }
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
          return_url: `${window.location.origin}/groups`,
        },
      });

      if (error) {
        console.error('Payment error:', error);
      } else {
        setShowPaymentModal(false);
        fetchGroups();
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Groups</h1>
        <div className="space-x-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Create Group
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            Join Group
          </button>
        </div>
      </div>

      {/* Groups I'm Leading */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Groups I'm Leading</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.leading.map(group => (
            <div key={group.id} className="border rounded-lg p-4 shadow-sm">
              <h3 className="text-xl font-semibold mb-2">{group.name}</h3>
              <p className="text-gray-600 mb-2">Group ID: {group.groupId}</p>
              <p className="text-gray-600 mb-4">Members: {group.members.length}</p>
              <button
                onClick={() => navigate(`/groups/${group.groupId}`)}
                className="bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700"
              >
                Manage Group
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Groups I'm a Member Of */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Groups I'm a Member Of</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.memberOf.map(group => (
            <div key={group.id} className="border rounded-lg p-4 shadow-sm">
              <h3 className="text-xl font-semibold mb-2">{group.name}</h3>
              <p className="text-gray-600 mb-2">Group ID: {group.groupId}</p>
              <p className="text-gray-600 mb-4">Leader: {group.leader.username}</p>
              <button
                onClick={() => navigate(`/groups/${group.groupId}`)}
                className="bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700"
              >
                View Group
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold mb-4">Create New Group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Group Name</label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={newGroup.password}
                  onChange={(e) => setNewGroup({ ...newGroup, password: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Number of Members</label>
                <input
                  type="number"
                  min="1"
                  value={newGroup.memberCount}
                  onChange={(e) => setNewGroup({ ...newGroup, memberCount: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold mb-4">Join Group</h2>
            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Group ID</label>
                <input
                  type="text"
                  value={joinGroup.groupId}
                  onChange={(e) => setJoinGroup({ ...joinGroup, groupId: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={joinGroup.password}
                  onChange={(e) => setJoinGroup({ ...joinGroup, password: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentIntent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold mb-4">Complete Payment</h2>
            <p className="text-gray-600 mb-4">
              Total: £{(newGroup.memberCount * 1.99).toFixed(2)}
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

export default Groups; 