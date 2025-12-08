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
import { 
  FaCrown, 
  FaUserFriends, 
  FaStar, 
  FaRegStar, 
  FaCopy, 
  FaCheckCircle,
  FaPlus,
  FaSignInAlt,
  FaUsers,
  FaFootballBall,
  FaGraduationCap,
  FaTimes
} from 'react-icons/fa';
import PinUnlock from '../components/PinUnlock';

// Add shine animation style
const shineStyle = `
  @keyframes shine {
    0% {
      background-position: -200% center;
    }
    100% {
      background-position: 200% center;
    }
  }
  
  @keyframes goldPulse {
    0%, 100% {
      filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 16px rgba(251, 191, 36, 1)) drop-shadow(0 0 24px rgba(251, 191, 36, 0.6));
      transform: scale(1.05);
    }
  }
  
  @keyframes goldGlow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.5), 0 0 40px rgba(251, 191, 36, 0.3);
    }
    50% {
      box-shadow: 0 0 30px rgba(251, 191, 36, 0.8), 0 0 60px rgba(251, 191, 36, 0.5), 0 0 80px rgba(251, 191, 36, 0.3);
    }
  }
  
  .gold-shine {
    background: linear-gradient(
      90deg,
      rgba(251, 191, 36, 0) 0%,
      rgba(251, 191, 36, 0.3) 50%,
      rgba(251, 191, 36, 0) 100%
    );
    background-size: 200% 100%;
    animation: shine 3s infinite;
    -webkit-background-clip: text;
    background-clip: text;
  }
  
  .gold-pulse {
    animation: goldPulse 2s ease-in-out infinite;
  }
  
  .gold-glow {
    animation: goldGlow 2s ease-in-out infinite;
  }
`;

// Inject styles (only once)
if (typeof document !== 'undefined' && !document.getElementById('gold-shine-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'gold-shine-styles';
  styleSheet.type = 'text/css';
  styleSheet.innerText = shineStyle;
  document.head.appendChild(styleSheet);
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Royal blue and gold gradient variations
const groupGradients = [
  'from-blue-600 via-blue-700 to-blue-800',
  'from-blue-500 via-blue-600 to-blue-700',
  'from-indigo-600 via-indigo-700 to-indigo-800',
  'from-cyan-600 via-cyan-700 to-cyan-800',
  'from-sky-600 via-sky-700 to-sky-800',
  'from-blue-700 via-indigo-700 to-purple-800',
];

const getGradient = (idx) => groupGradients[idx % groupGradients.length];

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

  const toggleFavorite = (groupId) => {
    setFavoriteGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleCopyId = (groupId) => {
    navigator.clipboard.writeText(groupId);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 1200);
  };

  // High-tech neon animated background
  const AnimatedBackground = () => (
    <div className="fixed inset-0 bg-black -z-10 overflow-hidden">
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Animated neon orbs */}
      {[...Array(8)].map((_, i) => {
        const size = 200 + Math.random() * 150;
        const top = Math.random() * 100;
        const left = Math.random() * 100;
        const isBlue = i % 2 === 0;
        const color = isBlue 
          ? 'rgba(59, 130, 246, 0.15)' 
          : 'rgba(251, 191, 36, 0.1)';
        
        return (
          <motion.div
            key={i}
            className="absolute rounded-full blur-3xl"
            style={{
              width: size,
              height: size,
              top: `${top}%`,
              left: `${left}%`,
              background: `radial-gradient(circle, ${color}, transparent 70%)`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50, 0],
              y: [0, Math.random() * 100 - 50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        );
      })}
      
      {/* Scanning lines effect */}
      <motion.div
        className="absolute inset-0 opacity-10"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, 0.3) 50%, transparent 100%)',
        }}
        animate={{
          y: ['-100%', '200%'],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
    </div>
  );

  // High-tech group card
  const GroupCard = ({ group, idx, isLeader }) => {
    const groupType = group.groupType || 'school';
    const gradient = getGradient(idx);
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.5) }}
        whileHover={{ scale: 1.03, y: -5 }}
        className="relative group cursor-pointer"
        onClick={() => navigate(`/groups/${group.groupId}`)}
      >
        {/* Neon border glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 rounded-xl opacity-0 group-hover:opacity-75 blur-sm transition-opacity duration-300" />
        
        {/* Main card */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-blue-500/30 p-6 backdrop-blur-sm">
          {/* Shine effect - pointer-events-none so it doesn't block clicks */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          
          {/* Corner accents - pointer-events-none so they don't block clicks */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl pointer-events-none" />
          
          {/* Avatar with neon glow */}
          <div className="relative mx-auto mb-4 w-20 h-20">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-full blur-lg opacity-60`} />
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold bg-gradient-to-br ${gradient} border-2 border-cyan-400/50 shadow-[0_0_20px_rgba(59,130,246,0.5)]`}>
              <span className="text-white drop-shadow-lg">
                {group.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          </div>

          {/* Group Name */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 text-center">
              {group.name}
            </h3>
            {isLeader && (
              <FaCrown 
                className="text-yellow-400 gold-pulse" 
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))',
                  animation: 'goldPulse 2s ease-in-out infinite'
                }}
                title="You are the leader" 
              />
            )}
            <button
              onClick={e => { 
                e.stopPropagation(); 
                toggleFavorite(group.groupId); 
              }}
              className="relative z-10 text-gray-400 hover:text-yellow-400 transition-colors"
            >
              {favoriteGroups.includes(group.groupId) ? (
                <FaStar 
                  className="text-yellow-400 gold-pulse" 
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))',
                    animation: 'goldPulse 2s ease-in-out infinite'
                  }}
                />
              ) : (
                <FaRegStar />
              )}
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <FaUserFriends className="drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
              <span className="font-semibold text-sm">{group.members?.length || 1}</span>
            </div>
            {isLeader ? (
              <div className="flex items-center gap-2">
                <FaCrown 
                  className="text-yellow-400 gold-pulse" 
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))',
                    animation: 'goldPulse 2s ease-in-out infinite'
                  }}
                />
                <span 
                  className="font-semibold text-sm text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400"
                  style={{
                    backgroundSize: '200% 100%',
                    animation: 'shine 3s infinite'
                  }}
                >
                  Leader
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <span className="font-semibold text-sm">{group.leader?.username || 'Leader'}</span>
              </div>
            )}
          </div>

          {/* Group ID + Copy */}
          <div className="relative flex items-center justify-center gap-2 mb-4 p-2 bg-black/50 rounded-lg border border-blue-500/20 z-10">
            <span className="text-xs text-gray-400 font-mono select-all">
              ID: {group.groupId.slice(0, 8)}...
            </span>
            <button
              className="relative z-20 ml-1 px-2 py-1 rounded bg-blue-900/50 hover:bg-blue-800/50 border border-blue-500/30 text-xs text-cyan-300 hover:text-cyan-200 transition-all hover:shadow-[0_0_8px_rgba(34,211,238,0.4)]"
              onClick={e => { e.stopPropagation(); handleCopyId(group.groupId); }}
            >
              {copiedId === group.groupId ? (
                <span className="flex items-center gap-1">
                  <FaCheckCircle className="text-green-400" /> 
                  <span>Copied!</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <FaCopy /> Copy
                </span>
              )}
            </button>
          </div>

          {/* Group Type Badge */}
          <div className="text-center">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              groupType === 'football'
                ? 'bg-orange-900/30 text-orange-300 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                : 'bg-blue-900/30 text-blue-300 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
            }`}>
              {groupType === 'football' ? (
                <>
                  <FaFootballBall /> Football Group
                </>
              ) : (
                <>
                  <FaGraduationCap /> School Group
                </>
              )}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  // PaymentForm
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
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/50 font-semibold"
        >
          Pay Now
        </button>
      </form>
    );
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden w-full bg-black">
      <AnimatedBackground />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">
              My Groups
            </span>
          </motion.h1>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowPinUnlock(true)}
              className="relative group px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 transition-all overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                <FaPlus /> Create Group
              </span>
            </motion.button>
            
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowJoinModal(true)}
              className="relative group px-6 py-3 bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-lg font-semibold shadow-lg shadow-yellow-500/50 hover:shadow-yellow-500/70 transition-all overflow-hidden gold-glow"
              style={{
                animation: 'goldGlow 2s ease-in-out infinite'
              }}
            >
              <span 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shine 2s infinite'
                }}
              />
              <span className="relative flex items-center gap-2 z-10">
                <FaSignInAlt /> Join Group
              </span>
            </motion.button>
          </div>
        </div>

        {/* Groups I'm Leading */}
        {groups.leading.length > 0 && (
          <div className="mb-12">
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3"
            >
              <FaCrown 
                className="text-yellow-400 gold-pulse" 
                style={{
                  filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.8))',
                  animation: 'goldPulse 2s ease-in-out infinite'
                }}
              />
              <span 
                className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400"
                style={{
                  backgroundSize: '200% 100%',
                  animation: 'shine 3s infinite'
                }}
              >
                Groups I'm Leading
              </span>
            </motion.h2>
            <AnimatePresence>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.leading.map((group, idx) => (
                  <GroupCard key={group.id} group={group} idx={idx} isLeader={true} />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {/* Groups I'm a Member Of */}
        {groups.memberOf.length > 0 && (
          <div>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3"
            >
              <FaUsers className="text-blue-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Groups I'm a Member Of
              </span>
            </motion.h2>
            <AnimatePresence>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.memberOf.map((group, idx) => (
                  <GroupCard key={group.id} group={group} idx={idx + 100} isLeader={false} />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {groups.leading.length === 0 && groups.memberOf.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-block p-6 bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-blue-500/30 shadow-lg">
              <FaUsers className="text-6xl text-blue-400/50 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">
                No Groups Yet
              </h3>
              <p className="text-gray-400 mb-6">Create or join a group to get started</p>
              <button
                onClick={() => setShowPinUnlock(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/50"
              >
                Create Your First Group
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PIN Unlock Modal */}
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
            <FaTimes />
          </button>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-8 shadow-2xl w-full max-w-md border border-blue-500/30"
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-xl" />
            
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl transition-colors"
              onClick={() => setShowCreateModal(false)}
            >
              <FaTimes />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Create a New Group
            </h2>
            
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Group Name"
                  value={newGroup.name}
                  onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-black/50 border border-blue-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
                  required
                />
              </div>
              
              <div>
                <input
                  type="password"
                  placeholder="Group Password"
                  value={newGroup.password}
                  onChange={e => setNewGroup({ ...newGroup, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-black/50 border border-blue-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
                  required
                />
              </div>
              
              <div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Member Count"
                  value={newGroup.memberCount}
                  onChange={e => setNewGroup({ ...newGroup, memberCount: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-black/50 border border-blue-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-cyan-400 mb-2">
                  Group Type
                </label>
                <select
                  value={newGroup.groupType}
                  onChange={e => setNewGroup({ ...newGroup, groupType: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-black/50 border border-blue-500/30 text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 transition-all"
                >
                  <option value="school" className="bg-gray-900">School Group</option>
                  <option value="football" className="bg-gray-900">Football Group</option>
                </select>
              </div>
              
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/50 font-semibold mt-6"
              >
                Create Group
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-8 shadow-2xl w-full max-w-md border border-yellow-500/30"
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-yellow-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-yellow-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-yellow-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-yellow-400 rounded-br-xl" />
            
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl transition-colors"
              onClick={() => setShowJoinModal(false)}
            >
              <FaTimes />
            </button>
            
            <h2 
              className="text-2xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400"
              style={{
                backgroundSize: '200% 100%',
                animation: 'shine 3s infinite'
              }}
            >
              Join a Group
            </h2>
            
            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Group ID"
                  value={joinGroup.groupId}
                  onChange={e => setJoinGroup({ ...joinGroup, groupId: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-black/50 border border-yellow-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/50 transition-all font-mono"
                  required
                />
              </div>
              
              <div>
                <input
                  type="password"
                  placeholder="Group Password"
                  value={joinGroup.password}
                  onChange={e => setJoinGroup({ ...joinGroup, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-black/50 border border-yellow-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/50 transition-all"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="relative w-full py-3 bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-lg hover:from-yellow-700 hover:to-amber-700 transition-all shadow-lg shadow-yellow-500/50 font-semibold mt-6 overflow-hidden gold-glow"
                style={{
                  animation: 'goldGlow 2s ease-in-out infinite'
                }}
              >
                <span 
                  className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shine 2s infinite'
                  }}
                />
                <span className="relative z-10">Join Group</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Groups;
