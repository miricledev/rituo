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
import { motion, AnimatePresence } from 'framer-motion';
import { FaCrown, FaUserFriends, FaStar, FaRegStar, FaCopy, FaCheckCircle } from 'react-icons/fa';
import PinUnlock from '../components/PinUnlock';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Helper to get a color for each group
const groupColors = [
  'from-pink-400 to-pink-600',
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-yellow-400 to-yellow-600',
  'from-purple-400 to-purple-600',
  'from-indigo-400 to-indigo-600',
  'from-red-400 to-red-600',
  'from-teal-400 to-teal-600',
];

const getColor = (idx) => groupColors[idx % groupColors.length];

const Groups = () => {
  const [groups, setGroups] = useState({ memberOf: [], leading: [] });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPinUnlock, setShowPinUnlock] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    password: '',
    memberCount: 1,
    groupType: 'school'
  });
  const [joinGroup, setJoinGroup] = useState({
    groupId: '',
    password: ''
  });
  const [favoriteGroups, setFavoriteGroups] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, [currentUser]);

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/groups/my-groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/groups/create', {
        name: newGroup.name,
        password: newGroup.password,
        memberCount: newGroup.memberCount,
        groupType: newGroup.groupType
      });
      setShowCreateModal(false);
      setNewGroup({ name: '', password: '', memberCount: 1, groupType: 'school' });
      fetchGroups();
    } catch (error) {
      alert('Failed to create group: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/groups/join', joinGroup);
      setShowJoinModal(false);
      fetchGroups();
    } catch (error) {
      alert('Failed to join group: ' + (error.response?.data?.error || error.message));
    }
  };

  // Favorite logic (local only for now)
  const toggleFavorite = (groupId) => {
    setFavoriteGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Copy group ID logic
  const handleCopyId = (groupId) => {
    navigator.clipboard.writeText(groupId);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 1200);
  };

  // Animated background (floating shapes)
  const AnimatedBackground = () => (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {[...Array(12)].map((_, i) => {
        const size = 120 + Math.random() * 80;
        const top = Math.random() * 90;
        const left = Math.random() * 90;
        const background = i % 2 === 0 
          ? 'linear-gradient(135deg, #f472b6, #60a5fa)' 
          : 'linear-gradient(135deg, #34d399, #fbbf24)';
        
        return (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-30 blur-2xl"
            style={{
              width: size,
              height: size,
              top: `${top}%`,
              left: `${left}%`,
              background: background,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.3, rotate: 360 }}
            transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          />
        );
      })}
    </div>
  );

  // Group Card
  const GroupCard = ({ group, idx, isLeader }) => {
    const groupType = group.groupType || 'school';
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.5) }}
        whileHover={{ scale: 1.02, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.18)' }}
        className={`relative group-card bg-white/80 dark:bg-secondary-800/80 rounded-2xl shadow-xl p-6 flex flex-col gap-3 border-2 border-transparent hover:border-primary-400 transition-all cursor-pointer overflow-hidden`}
        onClick={() => navigate(`/groups/${group.groupId}`)}
      >
      {/* Avatar */}
      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold mb-2 mx-auto shadow-lg bg-gradient-to-br ${getColor(idx)}`}>
        {group.name?.[0]?.toUpperCase() || '?'}
      </div>
      {/* Group Name */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-xl font-bold text-secondary-900 dark:text-white text-center">{group.name}</span>
        {isLeader && <FaCrown className="text-yellow-400" title="You are the leader" />}
        {favoriteGroups.includes(group.groupId)
          ? <FaStar className="text-yellow-400 cursor-pointer" title="Unfavorite" onClick={e => { e.stopPropagation(); toggleFavorite(group.groupId); }} />
          : <FaRegStar className="text-gray-400 cursor-pointer" title="Favorite" onClick={e => { e.stopPropagation(); toggleFavorite(group.groupId); }} />}
      </div>
      {/* Stats */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1 text-blue-500"><FaUserFriends /> <span className="font-semibold">{group.members?.length || 1}</span></div>
        {isLeader
          ? <div className="flex items-center gap-1 text-yellow-500"><FaCrown /> <span className="font-semibold">Leader</span></div>
          : <div className="flex items-center gap-1 text-gray-500"><span className="font-semibold">{group.leader?.username || 'Leader'}</span></div>}
      </div>
      {/* Group ID + Copy */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-xs text-gray-500 select-all">ID: {group.groupId}</span>
        <button
          className="ml-1 px-2 py-1 rounded bg-gray-200 dark:bg-secondary-700 text-xs text-gray-700 dark:text-gray-200 hover:bg-primary-100 dark:hover:bg-primary-700 transition-all"
          onClick={e => { e.stopPropagation(); handleCopyId(group.groupId); }}
        >
          {copiedId === group.groupId ? <><FaCheckCircle className="inline text-green-500 mr-1" /> Copied!</> : <><FaCopy className="inline mr-1" />Copy</>}
        </button>
      </div>
      <div className="mt-2 text-xs font-semibold text-center">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
          groupType === 'football'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        }`}>
          {groupType === 'football' ? 'Football Group' : 'School Group'}
        </span>
      </div>
      {/* Animated border on hover */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl border-4 border-primary-400 opacity-0 group-hover:opacity-60 transition-all duration-300"
        layoutId={`border-${group.groupId}`}
      />
      </motion.div>
    );
  };

  // PaymentForm unchanged
  const PaymentForm = () => {
    const stripe = useStripe();
    const elements = useElements();
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/groups` },
      });
      if (error) {
        console.error('Payment error:', error);
      } else {
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
    <div className="relative min-h-screen overflow-x-hidden w-full">
      <AnimatedBackground />
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 relative z-20">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 gap-4">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary-500 to-pink-500 bg-clip-text text-transparent drop-shadow-lg text-center sm:text-left">My Groups</h1>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPinUnlock(true)}
              className="bg-blue-600 text-white py-2 px-4 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all w-full sm:w-auto"
            >
              Create Group
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowJoinModal(true)}
              className="bg-green-600 text-white py-2 px-4 rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 transition-all w-full sm:w-auto"
            >
              Join Group
            </motion.button>
          </div>
        </div>

        {/* Groups I'm Leading */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><FaCrown className="text-yellow-400" /> Groups I'm Leading</h2>
          <AnimatePresence>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {groups.leading.map((group, idx) => (
                <GroupCard key={group.id} group={group} idx={idx} isLeader={true} />
              ))}
            </div>
          </AnimatePresence>
        </div>

        {/* Groups I'm a Member Of */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><FaUserFriends className="text-blue-400" /> Groups I'm a Member Of</h2>
          <AnimatePresence>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {groups.memberOf.map((group, idx) => (
                <GroupCard key={group.id} group={group} idx={idx + 100} isLeader={false} />
              ))}
            </div>
          </AnimatePresence>
        </div>

        {/* PIN Unlock Modal for Create Group */}
        {showPinUnlock && (
          <div className="fixed inset-0 z-50">
            <PinUnlock 
              onUnlock={() => {
                setShowPinUnlock(false);
                setShowCreateModal(true);
              }} 
              title="Create Group" 
            />
            <button
              className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-10"
              onClick={() => setShowPinUnlock(false)}
            >
              &times;
            </button>
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-secondary-900 rounded-2xl p-8 shadow-2xl w-full max-w-md relative"
            >
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl"
                onClick={() => setShowCreateModal(false)}
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold mb-4 text-center">Create a New Group</h2>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <input
                  type="text"
                  placeholder="Group Name"
                  value={newGroup.name}
                  onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="password"
                  placeholder="Group Password"
                  value={newGroup.password}
                  onChange={e => setNewGroup({ ...newGroup, password: e.target.value })}
                  className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Member Count"
                  value={newGroup.memberCount}
                  onChange={e => setNewGroup({ ...newGroup, memberCount: e.target.value })}
                  className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-400"
                  required
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Group Type
                  </label>
                  <select
                    value={newGroup.groupType}
                    onChange={e => setNewGroup({ ...newGroup, groupType: e.target.value })}
                    className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-400 dark:bg-secondary-800 dark:border-secondary-700"
                  >
                    <option value="school">School Group</option>
                    <option value="football">Football Group</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-all"
                >
                  Create Group
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Join Group Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-secondary-900 rounded-2xl p-8 shadow-2xl w-full max-w-md relative"
            >
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl"
                onClick={() => setShowJoinModal(false)}
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold mb-4 text-center">Join a Group</h2>
              <form onSubmit={handleJoinGroup} className="space-y-4">
                <input
                  type="text"
                  placeholder="Group ID"
                  value={joinGroup.groupId}
                  onChange={e => setJoinGroup({ ...joinGroup, groupId: e.target.value })}
                  className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-green-400"
                  required
                />
                <input
                  type="password"
                  placeholder="Group Password"
                  value={joinGroup.password}
                  onChange={e => setJoinGroup({ ...joinGroup, password: e.target.value })}
                  className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-green-400"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-all"
                >
                  Join Group
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups; 