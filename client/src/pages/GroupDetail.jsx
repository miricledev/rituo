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
import ColorChart from '../components/ColorChart';
import HabitCalendar from '../components/HabitCalendar';

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
  const [currentHabit, setCurrentHabit] = useState({
    name: '',
    description: '',
    habitType: 'boolean',
    minValue: 0,
    maxValue: 10,
    prompt: '',
    assignedMembers: [], // Array of member IDs
    applyToAll: false,
    scheduleDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], // Default to everyday
    combatType: 'neutral' // 'attack', 'defence', or 'neutral'
  });
  const [memberHabits, setMemberHabits] = useState({}); // { memberId: [habits] }
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [collapsedMembersInModal, setCollapsedMembersInModal] = useState({}); // Track which members are collapsed in the modal
  const [lockedHabits, setLockedHabits] = useState({}); // { memberId: [habits] } - locked habits for overview
  const [isEditingHabits, setIsEditingHabits] = useState(true); // true = editing mode, false = overview mode
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
  const [selectedColorChartMember, setSelectedColorChartMember] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [archives, setArchives] = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [showDeleteChallengeConfirm, setShowDeleteChallengeConfirm] = useState(false);
  const [expandedAttendance, setExpandedAttendance] = useState({});
  const [collapsedMembers, setCollapsedMembers] = useState({}); // Will be initialized to collapse all members
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isEditingGroupType, setIsEditingGroupType] = useState(false);
  const [newGroupType, setNewGroupType] = useState('school');
  const [timeUntilMidnight, setTimeUntilMidnight] = useState('');
  
  // Habit Presets State
  const [habitPresets, setHabitPresets] = useState([]); // Stored in localStorage
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [presetFormData, setPresetFormData] = useState({
    name: '',
    habits: []
  });

  // Calculate myMemberHabit early to avoid temporal dead zone
  const myMemberHabit = group?.activeChallenge?.memberHabits?.find(
    mh => String(mh.member) === String(user?.id) || String(mh.member?.id) === String(user?.id)
  );

  // Check if there are any habits added
  const hasHabitsAdded = Object.values(memberHabits).flat().length > 0 || Object.values(lockedHabits).flat().length > 0;

  // Handle page refresh warning when habits are added
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (showCreateChallengeModal && hasHabitsAdded) {
        e.preventDefault();
        e.returnValue = 'You have unsaved habits. Are you sure you want to leave?';
        return 'You have unsaved habits. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showCreateChallengeModal, hasHabitsAdded]);

  // Helper function to format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return messageTime.toLocaleDateString();
  };

  // Helper to format date as YYYY-MM-DD in local time
  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to get day name from date
  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // Handle both Date objects and date strings
    let dateObj;
    if (typeof date === 'string') {
      // Parse YYYY-MM-DD string as local date to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);
    } else {
      dateObj = date;
    }
    const dayIndex = dateObj.getDay();
    return days[dayIndex];
  };

  // Helper to check if a habit is available today
  const isHabitAvailableToday = (habit) => {
    // If no scheduleDays specified, treat as everyday (backward compatibility)
    if (!habit.scheduleDays || habit.scheduleDays.length === 0) {
      return true;
    }
    const today = new Date();
    const todayName = getDayName(today);
    return habit.scheduleDays.includes(todayName);
  };

  // Helper to get next available day for a habit
  const getNextAvailableDay = (habit) => {
    if (!habit.scheduleDays || habit.scheduleDays.length === 0) {
      return null; // Available every day
    }
    
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = today.getDay();
    
    // Find the next scheduled day
    for (let i = 1; i <= 7; i++) {
      const nextIndex = (todayIndex + i) % 7;
      const nextDay = days[nextIndex];
      if (habit.scheduleDays.includes(nextDay)) {
        return { day: nextDay, hoursUntil: i * 24 };
      }
    }
    
    return null;
  };

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conv => 
    conv.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate isLeader early to avoid temporal dead zone
  const isLeader = group?.leader && user ? String(group.leader.id) === String(user.id) : false;

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  useEffect(() => {
    if (group?.groupType) {
      setNewGroupType(group.groupType);
    }
  }, [group?.groupType]);

  useEffect(() => {
    if (activeTab === 'archives' && isLeader) {
      fetchArchives();
    }
  }, [activeTab, isLeader, groupId]);

  useEffect(() => {
    if (activeTab === 'attendance' && isLeader) {
      fetchAttendance();
    }
  }, [activeTab, isLeader, groupId]);

  useEffect(() => {
    if (activeTab === 'dms' && isLeader) {
      fetchConversations();
    }
  }, [activeTab, isLeader, groupId]);

  // Initialize all member sections as collapsed on page load
  useEffect(() => {
    if (group?.activeChallenge?.memberHabits) {
      const allCollapsed = {};
      group.activeChallenge.memberHabits.forEach(memberHabit => {
        const member = group.members?.find(m => String(m.id) === String(memberHabit.member) || String(m.id) === String(memberHabit.member?.id));
        const memberId = member?.id || memberHabit.member;
        allCollapsed[memberId] = true; // Start collapsed
      });
      setCollapsedMembers(allCollapsed);
    }
  }, [group?.activeChallenge?.memberHabits]);

  // Timer to show time until midnight (habit reset)
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      
      const diff = midnight - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeUntilMidnight(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateTimer(); // Run immediately
    const interval = setInterval(updateTimer, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, []);

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
      const fetchedGroup = response.data.group;
      if (fetchedGroup) {
        setGroup({
          ...fetchedGroup,
          groupType: fetchedGroup.groupType || 'school'
        });
      } else {
        setGroup(null);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
      setError('Failed to load group details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    try {
      setArchivesLoading(true);
      const response = await axios.get(`/groups/${groupId}/archives`);
      setArchives(response.data.archives);
    } catch (error) {
      console.error('Error fetching archives:', error);
    } finally {
      setArchivesLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const response = await axios.get(`/groups/${groupId}/attendance`);
      console.log('Attendance data received:', response.data.attendance);
      setAttendance(response.data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setConversationsLoading(true);
      // Get all members except current user for conversations
      const otherMembers = group.members?.filter(member => member.id !== user?.id) || [];
      
      // For each member, get the latest message and unread count
      const conversationPromises = otherMembers.map(async (member) => {
        try {
          const response = await axios.get(`/groups/${groupId}/dm/${member.id}`);
          const messages = response.data.messages || [];
          const latestMessage = messages[messages.length - 1];
          const unreadCount = messages.filter(msg => 
            msg.sender_id !== user?.id && 
            !msg.read_by?.includes(user?.id)
          ).length;
          
          return {
            id: member.id,
            username: member.username,
            avatar: member.username?.[0]?.toUpperCase() || '?',
            latestMessage: latestMessage?.content || 'No messages yet',
            timestamp: latestMessage?.created_at || null,
            unreadCount,
            isOnline: false // We could add online status later
          };
        } catch (error) {
          // If no messages exist, return empty conversation
          return {
            id: member.id,
            username: member.username,
            avatar: member.username?.[0]?.toUpperCase() || '?',
            latestMessage: 'No messages yet',
            timestamp: null,
            unreadCount: 0,
            isOnline: false
          };
        }
      });
      
      const conversationResults = await Promise.all(conversationPromises);
      // Sort by latest message timestamp (most recent first)
      conversationResults.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      setConversations(conversationResults);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  };

  // Load presets from backend on component mount
  useEffect(() => {
    fetchPresets();
  }, []);

  // Fetch presets from backend
  const fetchPresets = async () => {
    try {
      const response = await axios.get('/groups/habit-presets');
      setHabitPresets(response.data.presets || []);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  // Preset Management Functions
  const handleCreatePreset = () => {
    setPresetFormData({ name: '', habits: [] });
    setEditingPresetId(null);
    setShowPresetModal(true);
  };

  const handleEditPreset = (presetId) => {
    const preset = habitPresets.find(p => p.id === presetId);
    if (preset) {
      setPresetFormData({
        name: preset.name,
        habits: preset.habits
      });
      setEditingPresetId(presetId);
      setShowPresetModal(true);
    }
  };

  const handleDeletePreset = async (presetId) => {
    if (window.confirm('Are you sure you want to delete this preset?')) {
      try {
        await axios.delete(`/groups/habit-presets/${presetId}`);
        // Refresh presets from backend
        await fetchPresets();
      } catch (error) {
        console.error('Error deleting preset:', error);
        alert('Failed to delete preset. Please try again.');
      }
    }
  };

  const handleSavePreset = async () => {
    if (!presetFormData.name.trim()) {
      alert('Please enter a preset name');
      return;
    }
    if (presetFormData.habits.length === 0) {
      alert('Please add at least one habit to the preset');
      return;
    }
    // Validate that all habits have at least one schedule day
    const habitsWithoutSchedule = presetFormData.habits.filter(
      habit => !habit.scheduleDays || habit.scheduleDays.length === 0
    );
    if (habitsWithoutSchedule.length > 0) {
      alert('Please select at least one schedule day for all habits');
      return;
    }

    try {
      if (editingPresetId) {
        // Update existing preset
        await axios.put(`/groups/habit-presets/${editingPresetId}`, {
          name: presetFormData.name,
          habits: presetFormData.habits
        });
      } else {
        // Create new preset
        await axios.post('/groups/habit-presets', {
          name: presetFormData.name,
          habits: presetFormData.habits
        });
      }
      
      // Refresh presets from backend
      await fetchPresets();
      
      setShowPresetModal(false);
      setPresetFormData({ name: '', habits: [] });
      setEditingPresetId(null);
    } catch (error) {
      console.error('Error saving preset:', error);
      alert('Failed to save preset. Please try again.');
    }
  };

  const handleLoadPreset = (presetId) => {
    // Prevent loading if there's an active challenge
    if (group?.activeChallenge) {
      return;
    }

    // Convert presetId to number for comparison (dropdown passes string)
    const presetIdNum = typeof presetId === 'string' ? parseInt(presetId, 10) : presetId;
    const preset = habitPresets.find(p => p.id === presetIdNum || p.id === presetId);
    if (!preset) return;

    // Load preset habits for all members
    const allMembers = group?.members || [];
    const newMemberHabits = {};
    
    allMembers.forEach(member => {
      newMemberHabits[member.id] = preset.habits.map(habit => ({
        ...habit,
        // Ensure numeric habits have default min/max values if missing
        minValue: habit.habitType === 'numeric' ? (habit.minValue ?? 0) : habit.minValue,
        maxValue: habit.habitType === 'numeric' ? (habit.maxValue ?? 10) : habit.maxValue,
        // Ensure scheduleDays and combatType have defaults
        scheduleDays: habit.scheduleDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        combatType: habit.combatType || 'neutral'
      }));
    });

    setMemberHabits(newMemberHabits);
    
    // If modal is not open, open it and set to editing mode
    // If modal is already open, just load the habits (it's already in editing mode)
    if (!showCreateChallengeModal) {
      setIsEditingHabits(true);
      setShowCreateChallengeModal(true);
    }
    // If modal is already open, the state update above will automatically show the loaded habits
  };

  const handleAddPresetHabit = () => {
    setPresetFormData({
      ...presetFormData,
      habits: [
        ...presetFormData.habits,
        {
          name: '',
          description: '',
          habitType: 'boolean',
          minValue: 0,
          maxValue: 10,
          prompt: '',
          scheduleDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          combatType: 'neutral'
        }
      ]
    });
  };

  const handleUpdatePresetHabit = (index, field, value) => {
    const updatedHabits = [...presetFormData.habits];
    updatedHabits[index][field] = value;
    setPresetFormData({
      ...presetFormData,
      habits: updatedHabits
    });
  };

  const handleRemovePresetHabit = (index) => {
    const updatedHabits = presetFormData.habits.filter((_, i) => i !== index);
    setPresetFormData({
      ...presetFormData,
      habits: updatedHabits
    });
  };

  const deleteActiveChallenge = async () => {
    if (!group?.activeChallenge) return;
    try {
      await axios.delete(`/groups/${groupId}/challenge/${group.activeChallenge.id}`);
      // Refresh group details
      await fetchGroupDetails();
      setShowDeleteChallengeConfirm(false);
    } catch (e) {
      alert('Failed to remove challenge.');
    }
  };

  const toggleMemberCollapse = (memberId) => {
    setCollapsedMembers(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  // Helper function to get date string for a given number of days from today
  const getDateString = (daysFromToday) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    return date.toISOString().slice(0, 10);
  };

  // Handle cancel with confirmation
  const handleCancel = () => {
    if (hasHabitsAdded) {
      setShowCancelConfirm(true);
    } else {
      setShowCreateChallengeModal(false);
    }
  };

  // Confirm cancel and reset form
  const confirmCancel = () => {
    setShowCreateChallengeModal(false);
    setShowCancelConfirm(false);
    setMemberHabits({});
    setLockedHabits({});
    setCollapsedMembersInModal({});
    setIsEditingHabits(true);
    setCurrentHabit({
      name: '',
      description: '',
      habitType: 'boolean',
      minValue: 0,
      maxValue: 10,
      prompt: '',
      assignedMembers: [],
      applyToAll: false
    });
  };

  // Handle edit group name
  const handleEditGroupName = () => {
    setNewGroupName(group.name);
    setIsEditingGroupName(true);
  };

  // Handle save group name
  const handleSaveGroupName = async () => {
    if (!newGroupName.trim()) {
      alert('Group name cannot be empty');
      return;
    }

    try {
      await axios.put(`/groups/${groupId}`, { name: newGroupName });
      setGroup(prev => ({ ...prev, name: newGroupName }));
      setIsEditingGroupName(false);
    } catch (error) {
      console.error('Error updating group name:', error);
      alert('Failed to update group name');
    }
  };

  // Handle cancel editing group name
  const handleCancelEditGroupName = () => {
    setIsEditingGroupName(false);
    setNewGroupName('');
  };

  const handleEditGroupType = () => {
    setNewGroupType(group?.groupType || 'school');
    setIsEditingGroupType(true);
  };

  const handleSaveGroupType = async () => {
    if (!group) return;
    if (group.activeChallenge) {
      alert('Cannot change group type while a challenge is active.');
      return;
    }

    try {
      await axios.put(`/groups/${groupId}`, { groupType: newGroupType });
      setGroup(prev => (prev ? { ...prev, groupType: newGroupType } : prev));
      setIsEditingGroupType(false);
    } catch (error) {
      console.error('Error updating group type:', error);
      alert('Failed to update group type');
    }
  };

  const handleCancelEditGroupType = () => {
    setIsEditingGroupType(false);
    setNewGroupType(group?.groupType || 'school');
  };

  // Toggle individual member collapse in modal
  const toggleMemberCollapseInModal = (memberId) => {
    setCollapsedMembersInModal(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  // Expand all members in modal
  const expandAllMembersInModal = () => {
    setCollapsedMembersInModal({});
  };

  // Collapse all members in modal
  const collapseAllMembersInModal = () => {
    const allCollapsed = {};
    Object.keys(memberHabits).forEach(memberId => {
      allCollapsed[memberId] = true;
    });
    setCollapsedMembersInModal(allCollapsed);
  };

  // Lock habits and switch to overview mode
  const lockHabitsAndShowOverview = () => {
    if (Object.values(memberHabits).flat().length > 0) {
      setLockedHabits({ ...memberHabits });
      setIsEditingHabits(false);
    }
  };

  // Go back to editing mode
  const goBackToEditing = () => {
    setIsEditingHabits(true);
    // Keep the current memberHabits for editing
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    
    // Validate dates
    if (!newChallenge.startDate || !newChallenge.endDate) {
      alert('Please select both start and end dates for the challenge.');
      return;
    }
    
    try {
      // Use locked habits if in overview mode, otherwise use current memberHabits
      const habitsToSubmit = isEditingHabits ? memberHabits : lockedHabits;
      
      // Validate that habits exist
      if (Object.keys(habitsToSubmit).length === 0) {
        alert('Please add at least one habit before creating the challenge.');
        return;
      }
      
      // Convert habits to the format expected by the backend
      const memberHabitsArray = Object.entries(habitsToSubmit).map(([memberId, habits]) => ({
        member: memberId,
        habits: habits
      }));

      const response = await axios.post('/groups/challenge', {
        groupId,
        startDate: newChallenge.startDate,
        endDate: newChallenge.endDate,
        memberHabits: memberHabitsArray
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
    const habitsToCheck = isEditingHabits ? memberHabits : lockedHabits;
    return Object.keys(habitsToCheck).filter(memberId => 
      habitsToCheck[memberId] && habitsToCheck[memberId].length > 0
    );
  };

  const getMissingMembers = () => {
    const allMembers = getAllMembers();
    const membersWithHabits = getMembersWithHabits();
    return allMembers.filter(member => !membersWithHabits.includes(String(member.id)));
  };

  const isChallengeValid = () => {
    const allMembers = getAllMembers();
    const membersWithHabits = getMembersWithHabits();
    return allMembers.length > 0 && allMembers.every(member => membersWithHabits.includes(String(member.id)));
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

  // Helper function to calculate today's completion rate (only scheduled habits)
  const calculateTodayCompletionRate = (memberHabit) => {
    if (!memberHabit?.habits || memberHabit.habits.length === 0) return 0;

    const today = new Date().toISOString().slice(0, 10);
    let totalProgress = 0;
    let scheduledCount = 0;

    memberHabit.habits.forEach(habit => {
      // Only count habits that are scheduled for today
      if (isHabitAvailableToday(habit)) {
        scheduledCount++;
        const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
        const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === today);
        
        if (progressEntry && progressEntry.completed) {
          if (habit.habitType === 'numeric') {
            // For numeric habits, calculate the percentage based on the actual value
            const progress = calculateNumericProgress(habit, progressEntry);
            totalProgress += progress;
          } else {
            // For boolean and text habits, it's either 0% or 100%
            totalProgress += 100;
          }
        }
      }
    });

    return scheduledCount > 0 ? totalProgress / scheduledCount : 0;
  };

  // Helper function to get color based on percentage
  const getPercentageColor = (percentage) => {
    if (percentage === 0) return 'text-red-500 dark:text-red-400';
    if (percentage < 50) return 'text-orange-500 dark:text-orange-400';
    if (percentage < 100) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-green-500 dark:text-green-400';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div className="w-full sm:w-auto">
          {isEditingGroupName && isLeader ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="text-2xl sm:text-3xl font-bold bg-white dark:bg-secondary-700 border-2 border-primary-500 rounded px-3 py-2 text-secondary-900 dark:text-white"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveGroupName();
                  }
                }}
                autoFocus
              />
              <button
                onClick={handleSaveGroupName}
                className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                title="Save"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={handleCancelEditGroupName}
                className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                title="Cancel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold break-words">{group.name}</h1>
              {isLeader && (
                <button
                  onClick={handleEditGroupName}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="Edit group name"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-all">Group ID: {group.groupId}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Group Type:</span>
            {isEditingGroupType && isLeader && !group.activeChallenge ? (
              <>
                <select
                  value={newGroupType}
                  onChange={(e) => setNewGroupType(e.target.value)}
                  className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-secondary-800"
                >
                  <option value="school">School Group</option>
                  <option value="football">Football Group</option>
                </select>
                <button
                  onClick={handleSaveGroupType}
                  className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  title="Save"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={handleCancelEditGroupType}
                  className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                  group.groupType === 'football'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {group.groupType === 'football' ? 'Football Group' : 'School Group'}
                </span>
                {isLeader && !group.activeChallenge && (
                  <button
                    onClick={handleEditGroupType}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    title="Edit group type"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {isLeader && group.activeChallenge && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                    (Locked while challenge is active)
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {isLeader && (
          group.activeChallenge ? (
            <button
              onClick={() => setShowDeleteChallengeConfirm(true)}
              className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 w-full sm:w-auto text-sm sm:text-base"
            >
              Remove Challenge
            </button>
          ) : (
            <button
              onClick={() => setShowCreateChallengeModal(true)}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 w-full sm:w-auto text-sm sm:text-base"
            >
              Create Challenge
            </button>
          )
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-secondary-700 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
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
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'dms'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                DMs
              </button>
            )}
            {!isLeader && (
              <button
                onClick={() => setActiveTab('dm')}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'dm'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                Message
              </button>
            )}
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'leaderboard'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('colorChart')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'colorChart'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              Color Chart
            </button>
            {!isLeader && (
              <button
                onClick={() => setActiveTab('calendar')}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'calendar'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                Calendar
              </button>
            )}
            {isLeader && (
              <button
                onClick={() => setActiveTab('archives')}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'archives'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                Archives
              </button>
            )}
            {isLeader && (
              <button
                onClick={() => setActiveTab('presets')}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'presets'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                Presets
              </button>
            )}
            {isLeader && (
              <button
                onClick={() => setActiveTab('attendance')}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'attendance'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                Attendance
              </button>
            )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 dark:text-gray-400">
                  Start Date: {new Date(group.activeChallenge.startDate).toLocaleDateString()}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  End Date: {new Date(group.activeChallenge.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Status: {group.activeChallenge.status}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">
                  Today's Date: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Group Progress Overview */}
            {isLeader && (
              <div className="mt-8">
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Group Progress Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Average Overall Completion Rate */}
                  <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-3 sm:p-4">
                    <h4 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Average Overall Completion Rate</h4>
                    <div className="h-56 sm:h-64">
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
                                let scheduledCount = 0;
                                habits.forEach(habit => {
                                  // Check if habit is scheduled for this day
                                  const dayName = getDayName(dateStr);
                                  const isScheduled = !habit.scheduleDays || habit.scheduleDays.length === 0 || habit.scheduleDays.includes(dayName);
                                  
                                  if (isScheduled) {
                                    scheduledCount++;
                                    // Ensure progress is always an array
                                    const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
                                  // Look for progress entry for this date - try multiple date formats
                                    const progress = habitProgress.find(p => {
                                    if (!p.date) return false;
                                    const progressDate = new Date(p.date);
                                    const targetDate = new Date(dateStr);
                                    // Compare dates only (ignore time)
                                    return progressDate.toDateString() === targetDate.toDateString() ||
                                           p.date.slice(0, 10) === dateStr ||
                                           formatDateLocal(progressDate) === dateStr;
                                  });
                                  if (progress) {
                                    if (habit.habitType === 'numeric') {
                                      userTotal += calculateNumericProgress(habit, progress);
                                    } else {
                                      userTotal += progress.completed ? 100 : 0;
                                    }
                                  } else {
                                    userTotal += 0;
                                    }
                                  }
                                });
                                // Only count habits that are scheduled for this day
                                // Return null if no habits scheduled (member excluded from average)
                                return scheduledCount > 0 ? userTotal / scheduledCount : null;
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
                  <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-3 sm:p-4">
                    <h4 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Member Progress Distribution</h4>
                    <div className="h-56 sm:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={group.activeChallenge.memberHabits?.map(memberHabit => {
                              const member = group.members?.find(m => 
                                String(m.id) === String(memberHabit.member) || 
                                String(m.id) === String(memberHabit.member?.id)
                              );
                              const today = new Date();
                              const dayName = getDayName(today);
                              
                              // Count habits scheduled for today
                              const scheduledHabits = memberHabit.habits?.filter(habit => 
                                !habit.scheduleDays || habit.scheduleDays.length === 0 || habit.scheduleDays.includes(dayName)
                              ) || [];
                              
                              const totalProgress = scheduledHabits.reduce((acc, habit) => {
                                const todayStr = today.toISOString().slice(0, 10);
                                // Ensure progress is always an array
                                const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
                                const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === todayStr);
                                if (progressEntry) {
                                  if (habit.habitType === 'numeric') {
                                    return acc + calculateNumericProgress(habit, progressEntry);
                                  } else {
                                    return acc + (progressEntry.completed ? 100 : 0);
                                  }
                                }
                                // If no progress entry exists, count as 0% (incomplete)
                                return acc + 0;
                              }, 0);
                              
                              return {
                                name: member?.username || 'Unknown Member',
                                value: scheduledHabits.length > 0 ? (totalProgress / scheduledHabits.length) : 0
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
              <div className="mt-6 sm:mt-8">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h3 className="text-lg sm:text-xl font-semibold">Member Progress</h3>
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 dark:text-blue-400">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
                      {timeUntilMidnight}
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">until reset</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4 italic">
                  Click on a member's name to view their individual stats
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {(group.activeChallenge.memberHabits || []).map((memberHabit, index) => {
                    const member = group.members?.find(m => String(m.id) === String(memberHabit.member) || String(m.id) === String(memberHabit.member?.id));
                    const memberId = member?.id || memberHabit.member;
                    const isCollapsed = collapsedMembers[memberId];
                    const completionRate = calculateOverallCompletionRate([memberHabit]);
                    const todayCompletionRate = calculateTodayCompletionRate(memberHabit);
                    
                    // Check if any habits have combatType
                    const hasCombatHabits = (memberHabit.habits || []).some(habit => habit.combatType === 'attack' || habit.combatType === 'defence');
                    
                    // Separate habits by combat type
                    const attackHabits = (memberHabit.habits || []).filter(habit => habit.combatType === 'attack' || (!habit.combatType && !hasCombatHabits));
                    const defenceHabits = (memberHabit.habits || []).filter(habit => habit.combatType === 'defence');
                    
                    return (
                      <div
                        key={index}
                        className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg border border-gray-200 dark:border-secondary-700 p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 transition-transform transform hover:scale-[1.02] hover:shadow-2xl group"
                      >
                        <div className="flex items-center gap-2 sm:gap-4 mb-2">
                          <Link to={`/groups/${groupId}/member/${memberId}`} className="flex items-center gap-3 sm:gap-4 flex-1 hover:opacity-80 transition-opacity">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xl font-bold text-primary-700 dark:text-primary-200 group-hover:ring-4 group-hover:ring-primary-200/40">
                              {member?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-lg text-primary-600 dark:text-primary-300 truncate">
                                  {member?.username || 'Unknown Member'}
                                </div>
                                <svg className="w-4 h-4 text-primary-500 dark:text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              <div className="text-xs text-secondary-500 dark:text-secondary-400 truncate">
                                {member?.email || ''}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {completionRate.toFixed(0)}% Complete
                              </div>
                            </div>
                          </Link>
                          {/* Today's completion rate - large number */}
                          <div className="flex flex-col items-center mr-1 sm:mr-3">
                            <div className={`text-3xl sm:text-5xl font-bold ${getPercentageColor(todayCompletionRate)}`}>
                              {todayCompletionRate.toFixed(0)}%
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">today</div>
                          </div>
                          <button
                            onClick={() => toggleMemberCollapse(memberId)}
                            className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-secondary-700 transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                            aria-label={isCollapsed ? "Expand habits" : "Collapse habits"}
                          >
                            <svg
                              className={`w-6 h-6 text-gray-600 dark:text-gray-300 transition-all duration-200 ${
                                isCollapsed ? 'rotate-180' : ''
                              }`}
                              style={{
                                filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))',
                              }}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <div className={`space-y-3 mt-2 transition-all duration-300 ease-in-out overflow-hidden ${
                          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
                        }`}>
                          {hasCombatHabits ? (
                            /* Show attack and defence sections */
                            <div className="space-y-4">
                              {/* Attack Habits */}
                              {attackHabits.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                      <path d="M21 3l-1 1M3 21l1-1M21 3l-10 10M3 21l10-10M9 3l3 3M15 21l-3-3M21 9l-3 3M3 15l3-3M21 21l-1-1M3 3l1 1" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Attack Habits
                                  </h4>
                                  <div className="space-y-2">
                                    {attackHabits.map((habit, habitIndex) => {
                            // Ensure progress is always an array (handles undefined from backend)
                            const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
                            
                            // Find today's progress entry
                            const today = new Date().toISOString().slice(0, 10);
                            const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === today);
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
                                  <div className="flex items-center gap-2">
                                    {!isHabitAvailableToday(habit) ? (
                                      <>
                                        <div className="flex flex-col items-center gap-1 opacity-50">
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-400">
                                            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                          </svg>
                                          {getNextAvailableDay(habit) && (
                                            <span className="text-xs text-gray-400 text-center">
                                              In {getNextAvailableDay(habit).hoursUntil}h
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Not completed today
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Defence Habits */}
                              {defenceHabits.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Defence Habits
                                  </h4>
                                  <div className="space-y-2">
                                    {defenceHabits.map((habit, habitIndex) => {
                                      // Same habit rendering logic as attack habits
                                      const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
                                      const today = new Date().toISOString().slice(0, 10);
                                      const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === today);
                                      const isComplete = progressEntry?.completed;
                                      const numericValue = progressEntry?.numericValue;
                                      const textValue = progressEntry?.textValue;
                                      
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
                                            <div className="flex items-center gap-2">
                                              {!isHabitAvailableToday(habit) ? (
                                                <>
                                                  <div className="flex flex-col items-center gap-1 opacity-50">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-400">
                                                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                                    </svg>
                                                    {getNextAvailableDay(habit) && (
                                                      <span className="text-xs text-gray-400 text-center">
                                                        In {getNextAvailableDay(habit).hoursUntil}h
                                                      </span>
                                                    )}
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                  Not completed today
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Old single-column layout for habits without combat types */
                            (memberHabit.habits || []).map((habit, habitIndex) => {
                              const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
                              const today = new Date().toISOString().slice(0, 10);
                              const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === today);
                              const isComplete = progressEntry?.completed;
                              const numericValue = progressEntry?.numericValue;
                              const textValue = progressEntry?.textValue;
                              
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

                                  {!isComplete && (
                                    <div className="flex items-center gap-2">
                                      {!isHabitAvailableToday(habit) ? (
                                        <>
                                          <div className="flex flex-col items-center gap-1 opacity-50">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-400">
                                              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                            </svg>
                                            {getNextAvailableDay(habit) && (
                                              <span className="text-xs text-gray-400 text-center">
                                                In {getNextAvailableDay(habit).hoursUntil}h
                                              </span>
                                            )}
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          Not completed today
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
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
      {isMember && !isLeader && myMemberHabit && (() => {
        // Check if any habits have combatType
        const hasCombatHabits = myMemberHabit.habits.some(habit => habit.combatType === 'attack' || habit.combatType === 'defence');
        
        return (
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
            <h2 className="text-lg sm:text-xl font-semibold">Today's Group Habits</h2>
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 dark:text-blue-400">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
                {timeUntilMidnight}
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400">until reset</span>
            </div>
          </div>
          
          {hasCombatHabits ? (
            /* Separate attack and defence habits */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attack Habits - Left Side */}
            <div>
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M21 3l-1 1M3 21l1-1M21 3l-10 10M3 21l10-10M9 3l3 3M15 21l-3-3M21 9l-3 3M3 15l3-3M21 21l-1-1M3 3l1 1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Attack Habits
              </h3>
              <div className="space-y-3">
                {myMemberHabit.habits.map((habit, originalIdx) => {
                  if (habit.combatType !== 'attack' && habit.combatType) return null;
                  const idx = originalIdx;
              // Ensure progress is always an array (handles undefined from backend)
              const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
              
              // Find today's progress entry
              const today = new Date().toISOString().slice(0, 10);
              const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === today);
              const isComplete = progressEntry?.completed;
              const numericValue = progressEntry?.numericValue;
              const textValue = progressEntry?.textValue;
              const isEditing = editingHabits[idx];

              return (
                <div
                  key={idx}
                  className={`rounded-lg shadow-md p-3 sm:p-4 border transition-transform hover:scale-[1.01] ${
                    isComplete 
                      ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700' 
                      : 'bg-white dark:bg-secondary-800 border-gray-200 dark:border-secondary-700'
                  }`}
                >
                  <div className="flex-1 min-w-0 mb-2 sm:mb-3">
                    <div className="font-medium text-sm sm:text-base text-secondary-900 dark:text-white">{habit.name}</div>
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
                        <>
                          {isHabitAvailableToday(habit) ? (
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
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1 opacity-50">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400">
                                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                              </svg>
                              {getNextAvailableDay(habit) && (
                                <span className="text-xs text-gray-400 text-center">
                                  Available in {getNextAvailableDay(habit).hoursUntil}h
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {habit.habitType === 'numeric' && (
                        <div className="space-y-2">
                          {!isHabitAvailableToday(habit) ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                              </svg>
                              {getNextAvailableDay(habit) && (
                                <span className="text-sm text-gray-400 text-center">
                                  Available in {getNextAvailableDay(habit).hoursUntil}h
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
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
                            </>
                            )}
                        </div>
                      )}

                      {habit.habitType === 'text' && (
                        <div className="space-y-2">
                          {!isHabitAvailableToday(habit) ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                              </svg>
                              {getNextAvailableDay(habit) && (
                                <span className="text-sm text-gray-400 text-center">
                                  Available in {getNextAvailableDay(habit).hoursUntil}h
                                </span>
                              )}
                            </div>
                          ) : (
                            <><div className="text-sm text-secondary-600 dark:text-secondary-400">
                          
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none dark:bg-gray-700 dark:text-black placeholder-gray-500 dark:placeholder-gray-400"
                          />
                          <div className="flex gap-2">
                            {isEditing && (
                              <button
                                onClick={() => handleCancelEdit(idx)}
                                className="flex-1 px-3 py-2 bg-gray-500 text-white dark:text-black rounded-md hover:bg-gray-600"
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
                            </>
                            )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

            {/* Defence Habits - Right Side */}
            <div>
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Defence Habits
              </h3>
              <div className="space-y-3">
                {myMemberHabit.habits.map((habit, originalIdx) => {
                  if (habit.combatType !== 'defence') return null;
                  const idx = originalIdx;
                  // Ensure progress is always an array (handles undefined from backend)
                  const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
                  
                  // Find today's progress entry
                  const today = new Date().toISOString().slice(0, 10);
                  const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === today);
                  const isComplete = progressEntry?.completed;
                  const numericValue = progressEntry?.numericValue;
                  const textValue = progressEntry?.textValue;
                  const isEditing = editingHabits[idx];

                  return (
                    <div
                      key={idx}
                      className={`rounded-lg shadow-md p-3 sm:p-4 border transition-transform hover:scale-[1.01] ${
                        isComplete 
                          ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700' 
                          : 'bg-white dark:bg-secondary-800 border-gray-200 dark:border-secondary-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0 mb-2 sm:mb-3">
                        <div className="font-medium text-sm sm:text-base text-secondary-900 dark:text-white">{habit.name}</div>
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
                            <>
                              {isHabitAvailableToday(habit) ? (
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
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-1 opacity-50">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400">
                                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                  </svg>
                                  {getNextAvailableDay(habit) && (
                                    <span className="text-xs text-gray-400 text-center">
                                      Available in {getNextAvailableDay(habit).hoursUntil}h
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {habit.habitType === 'numeric' && (
                        <div className="space-y-2">
                          {!isHabitAvailableToday(habit) ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                              </svg>
                              {getNextAvailableDay(habit) && (
                                <span className="text-sm text-gray-400 text-center">
                                  Available in {getNextAvailableDay(habit).hoursUntil}h
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
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
                            </>
                            )}
                        </div>
                      )}

                      {habit.habitType === 'text' && (
                        <div className="space-y-2">
                          {!isHabitAvailableToday(habit) ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                              </svg>
                              {getNextAvailableDay(habit) && (
                                <span className="text-sm text-gray-400 text-center">
                                  Available in {getNextAvailableDay(habit).hoursUntil}h
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
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
                            </>
                            )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
              </div>
            </div>
          </div>
          ) : (
            /* Old single-column layout for habits without combat types */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {myMemberHabit.habits.map((habit, idx) => {
                // Ensure progress is always an array (handles undefined from backend)
                const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
                
                // Find today's progress entry
                const today = new Date().toISOString().slice(0, 10);
                const progressEntry = habitProgress.find(p => p.date && p.date.slice(0, 10) === today);
                const isComplete = progressEntry?.completed;
                const numericValue = progressEntry?.numericValue;
                const textValue = progressEntry?.textValue;
                const isEditing = editingHabits[idx];

                return (
                  <div
                    key={idx}
                    className={`rounded-lg shadow-md p-3 sm:p-4 border transition-transform hover:scale-[1.01] ${
                      isComplete 
                        ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700' 
                        : 'bg-white dark:bg-secondary-800 border-gray-200 dark:border-secondary-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mb-2 sm:mb-3">
                      <div className="font-medium text-sm sm:text-base text-secondary-900 dark:text-white">{habit.name}</div>
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
                          <>
                            {isHabitAvailableToday(habit) ? (
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
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1 opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400">
                                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                </svg>
                                {getNextAvailableDay(habit) && (
                                  <span className="text-xs text-gray-400 text-center">
                                    Available in {getNextAvailableDay(habit).hoursUntil}h
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {habit.habitType === 'numeric' && (
                          <div className="space-y-2">
                            {!isHabitAvailableToday(habit) ? (
                              <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                </svg>
                                {getNextAvailableDay(habit) && (
                                  <span className="text-sm text-gray-400 text-center">
                                    Available in {getNextAvailableDay(habit).hoursUntil}h
                                  </span>
                                )}
                              </div>
                            ) : (
                              <>
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
                              </>
                            )}
                          </div>
                        )}

                        {habit.habitType === 'text' && (
                          <div className="space-y-2">
                            {!isHabitAvailableToday(habit) ? (
                              <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-400">
                                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                </svg>
                                {getNextAvailableDay(habit) && (
                                  <span className="text-sm text-gray-400 text-center">
                                    Available in {getNextAvailableDay(habit).hoursUntil}h
                                  </span>
                                )}
                              </div>
                            ) : (
                              <>
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
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
                              </>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        );
      })()}
        </div>
      )}

      {/* Group Chat Tab */}
      {activeTab === 'chat' && (
        <div className="h-96">
          <GroupChat groupId={group.id} groupName={group.name} />
        </div>
      )}

      {/* Direct Messages Tab (for Leaders) - Inbox Style */}
      {activeTab === 'dms' && isLeader && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-secondary-900 dark:text-white">💬 Direct Messages</h2>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-hidden">
            {conversationsLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredConversations.length > 0 ? (
              <div className="space-y-2 overflow-y-auto h-full pr-2">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedDMUser({ id: conversation.id, username: conversation.username })}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedDMUser?.id === conversation.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800'
                        : 'bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 hover:bg-gray-50 dark:hover:bg-secondary-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar with online indicator */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-200">
                          {conversation.avatar}
                        </div>
                        {conversation.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white dark:border-gray-800 rounded-full"></div>
                        )}
                      </div>

                      {/* Conversation Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {conversation.username}
                          </h3>
                          {conversation.timestamp && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                              {formatRelativeTime(conversation.timestamp)}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-sm truncate ${
                            conversation.unreadCount > 0 
                              ? 'text-gray-900 dark:text-white font-medium' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {conversation.latestMessage}
                          </p>
                          
                          {/* Unread indicator */}
                          {conversation.unreadCount > 0 && (
                            <div className="flex-shrink-0 ml-2">
                              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {searchQuery 
                    ? `No conversations match "${searchQuery}"`
                    : 'Start a conversation by clicking on a member'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Message Chat View */}
      {selectedDMUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-none sm:rounded-xl shadow-xl w-full max-w-4xl h-full sm:h-[80vh] flex flex-col">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-secondary-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-200">
                  {selectedDMUser.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedDMUser.username}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Direct Message</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDMUser(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-secondary-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Component */}
            <div className="flex-1 overflow-hidden">
              <DirectMessage 
                groupId={group.groupId} 
                targetUserId={selectedDMUser.id} 
                targetUsername={selectedDMUser.username}
                isLeader={true}
              />
            </div>
          </div>
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

                  // Filter habits scheduled for today
                  const today = new Date();
                  const todayStr = today.toISOString().slice(0, 10);
                  const dayName = getDayName(todayStr);
                  
                  const scheduledHabits = memberHabit.habits?.filter(habit => 
                    !habit.scheduleDays || habit.scheduleDays.length === 0 || habit.scheduleDays.includes(dayName)
                  ) || [];

                  // Get the highest streak among all habits
                  const maxStreak = Math.max(...habitStreaks.map(h => h.streak), 0);
                  const totalHabits = scheduledHabits.length; // Count only scheduled habits
                  // Count habits completed today that are scheduled
                  const completedToday = habitStreaks.filter((h, idx) => {
                    const habit = memberHabit.habits[idx];
                    const isScheduled = !habit.scheduleDays || habit.scheduleDays.length === 0 || habit.scheduleDays.includes(dayName);
                    return isScheduled && h.streak > 0;
                  }).length;
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

      {/* Color Chart Tab */}
      {activeTab === 'colorChart' && (
                <div>
          {isLeader ? (
            // Leader view - show member list or individual chart
            !selectedColorChartMember ? (
              // Show member list
                <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🎨 Skill Development Charts</h2>
                  <p className="text-secondary-600 dark:text-secondary-400 mb-4">Select a member to manage their skill development chart.</p>
              </div>

                {group.members && group.members.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.members.map(member => (
                      <div 
                        key={member.id} 
                        className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 cursor-pointer transition-transform transform hover:scale-105 hover:shadow-xl border border-gray-200 dark:border-secondary-700"
                        onClick={() => setSelectedColorChartMember(member)}
                      >
                        <div className="text-center">
                          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                              {member.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
                            {member.username}
                          </h3>
                          <p className="text-sm text-secondary-600 dark:text-secondary-400">
                            Click to view skill chart
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">👥</div>
                    <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                      No Members Yet
                    </h3>
                    <p className="text-secondary-600 dark:text-secondary-400">
                      Add members to the group to manage their skill development charts.
                    </p>
                  </div>
                  )}
                </div>
            ) : (
              // Show individual member's chart
              <div>
                <div className="mb-6 flex items-center gap-4">
                          <button
                    onClick={() => setSelectedColorChartMember(null)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                          >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Members
                          </button>
                        </div>
                        
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
                    🎨 {selectedColorChartMember.username}'s Skill Development Chart
                  </h2>
                  <p className="text-secondary-600 dark:text-secondary-400 mb-4">
                    Manage skill development chart for {selectedColorChartMember.username}.
                  </p>
                        </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
                  <ColorChart 
                    memberHabit={{ member: selectedColorChartMember.id }}
                    isLeader={isLeader}
                    groupId={groupId}
                    groupType={group?.groupType}
                  />
                              </div>
                              </div>
            )
          ) : (
            // Student view - show their own chart
                              <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🎨 Your Skill Development Chart</h2>
                <p className="text-secondary-600 dark:text-secondary-400 mb-4">Track your skill development progress across different areas.</p>
                        </div>

              <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
                <ColorChart 
                  memberHabit={{ member: user.id }}
                  isLeader={false}
                  groupId={groupId}
                  groupType={group?.groupType}
                              />
                            </div>
                            </div>
          )}
                          </div>
                        )}

      {/* Calendar Tab - Students only */}
      {!isLeader && activeTab === 'calendar' && (
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">📅 Habit Calendar</h2>
            <p className="text-secondary-600 dark:text-secondary-400 mb-4">
              View your habit completion calendar
            </p>
          </div>

          {group.activeChallenge && myMemberHabit ? (
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
              <HabitCalendar 
                habits={myMemberHabit.habits}
                startDate={group.activeChallenge.startDate}
                endDate={group.activeChallenge.endDate}
                memberHabit={myMemberHabit}
              />
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-secondary-800 rounded-lg shadow-card">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                No Active Challenge
              </h3>
              <p className="text-secondary-600 dark:text-secondary-400">
                Join an active challenge to see your habit completion calendar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateChallengeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-lg w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900 dark:text-white">Create New Challenge</h2>
                {hasHabitsAdded && (
                  <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Unsaved changes</span>
                          </div>
                        )}
                      </div>
            </div>
            
            {/* Two Panel Layout */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left Panel - Member Habits */}
              <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-y-auto max-h-96 lg:max-h-none">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
                    {isEditingHabits ? 'Assigned Habits' : 'Challenge Overview'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {(isEditingHabits ? Object.values(memberHabits) : Object.values(lockedHabits)).flat().length} total habits
                    </span>
                    {isEditingHabits && Object.keys(memberHabits).length > 1 && (
                      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                      <button
                        type="button"
                          onClick={expandAllMembersInModal}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          title="Expand all"
                      >
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                      </button>
                        <button
                          type="button"
                          onClick={collapseAllMembersInModal}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          title="Collapse all"
                        >
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m16 0l-4-4m4 4l-4 4" />
                          </svg>
                        </button>
                  </div>
                )}
                  </div>
              </div>

                {(() => {
                  const habitsToShow = isEditingHabits ? memberHabits : lockedHabits;
                  const hasHabits = Object.keys(habitsToShow).length > 0;
                  
                  if (!hasHabits) {
                    return (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">👥</div>
                        <p className="text-gray-500 dark:text-gray-400 mb-2">
                          {isEditingHabits ? 'No habits assigned yet' : 'No habits in overview'}
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          {isEditingHabits ? 'Add habits and assign them to members' : 'Go back to editing to add habits'}
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-4">
                      {Object.entries(habitsToShow).map(([memberId, habits]) => {
                      const member = group?.members?.find(m => String(m.id) === String(memberId));
                      const isCollapsed = collapsedMembersInModal[memberId];
                      return (
                        <div key={memberId} className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div 
                            className={`flex items-center gap-3 p-4 ${isEditingHabits ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors' : ''}`}
                            onClick={isEditingHabits ? () => toggleMemberCollapseInModal(memberId) : undefined}
                          >
                            {isEditingHabits && (
                    <button
                      type="button"
                                className="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              >
                                <svg
                                  className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                                    isCollapsed ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                    </button>
                            )}
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200 flex-shrink-0">
                              {member?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-secondary-900 dark:text-white">{member?.username || 'Unknown Member'}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{habits.length} habit{habits.length !== 1 ? 's' : ''}</p>
                        </div>
                            {!isEditingHabits && (
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                  ✓ Locked
                                </span>
                              </div>
                            )}
                          </div>
                          <div className={`px-4 pb-4 transition-all duration-300 ease-in-out overflow-hidden ${
                            isEditingHabits && isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
                          }`}>
                            <div className="space-y-2">
                              {habits.map((habit, habitIndex) => (
                              <div key={habitIndex} className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-sm text-secondary-900 dark:text-white">{habit.name}</h5>
                                    {habit.description && (
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{habit.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                        {habit.habitType === 'boolean' ? 'Checkbox' : 
                                         habit.habitType === 'numeric' ? 'Numeric' : 'Text'}
                                      </span>
                                      {habit.habitType === 'numeric' && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{habit.minValue} - {habit.maxValue}</span>
                                      )}
                                      {habit.combatType === 'attack' && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                                            <path d="M21 3l-1 1M3 21l1-1M21 3l-10 10M3 21l10-10M9 3l3 3M15 21l-3-3M21 9l-3 3M3 15l3-3M21 21l-1-1M3 3l1 1" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          Attack
                                        </span>
                                      )}
                                      {habit.combatType === 'defence' && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          Defence
                                        </span>
                                      )}
                                      {/* Schedule Days Indicator */}
                                      {habit.scheduleDays && habit.scheduleDays.length > 0 && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded text-xs">
                                          <span className="text-gray-600 dark:text-gray-400 mr-1">Days:</span>
                                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
                                            const dayInitial = day[0];
                                            const isScheduled = habit.scheduleDays.includes(day);
                                            return (
                                              <span
                                                key={day}
                                                className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-medium transition-colors cursor-help ${
                                                  isScheduled
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                                                }`}
                                                title={day}
                                              >
                                                {dayInitial}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isEditingHabits && (
                            <button
                              type="button"
                                      onClick={() => {
                                        const newMemberHabits = { ...memberHabits };
                                        newMemberHabits[memberId] = newMemberHabits[memberId].filter((_, idx) => idx !== habitIndex);
                                        if (newMemberHabits[memberId].length === 0) {
                                          delete newMemberHabits[memberId];
                                        }
                                        setMemberHabits(newMemberHabits);
                                      }}
                                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                            </button>
                                  )}
                          </div>
                              </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  );
                })()}
              </div>

              {/* Right Panel - Add Habit Form or Overview */}
              <div className="w-full lg:w-1/2 p-4 sm:p-6 overflow-y-auto">
                {isEditingHabits ? (
                  <form onSubmit={handleCreateChallenge} className="space-y-6">
                    {/* Challenge Settings */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Challenge Settings</h3>
                      {habitPresets.length > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleLoadPreset(e.target.value);
                                e.target.value = ''; // Reset dropdown
                              }
                            }}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <option value="">Load Preset...</option>
                            {habitPresets.map(preset => (
                              <option key={preset.id} value={preset.id}>{preset.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                        <div className="space-y-2">
                  <input
                    type="date"
                    value={newChallenge.startDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, startDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={newChallenge.startDate === getDateString(0)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewChallenge({ ...newChallenge, startDate: getDateString(0) });
                                }
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-gray-700 dark:text-gray-300">Start today</span>
                          </label>
                        </div>
                </div>
                <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                        <div className="space-y-2">
                  <input
                    type="date"
                    value={newChallenge.endDate}
                    onChange={(e) => setNewChallenge({ ...newChallenge, endDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                                checked={newChallenge.endDate === getDateString(7)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewChallenge({ ...newChallenge, endDate: getDateString(7) });
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-gray-700 dark:text-gray-300">7 days</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={newChallenge.endDate === getDateString(14)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewChallenge({ ...newChallenge, endDate: getDateString(14) });
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-gray-700 dark:text-gray-300">14 days</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={newChallenge.endDate === getDateString(30)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewChallenge({ ...newChallenge, endDate: getDateString(30) });
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-gray-700 dark:text-gray-300">30 days</span>
                    </label>
                  </div>
                </div>
                      </div>
                    </div>
                        </div>

                  {/* Add Habit Form */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Add New Habit</h3>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
                        
                        {/* Basic Habit Info */}
                      <div className="grid grid-cols-1 gap-4">
                          <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Habit Name</label>
                            <input
                              type="text"
                            value={currentHabit.name}
                            onChange={(e) => setCurrentHabit({ ...currentHabit, name: e.target.value })}
                            placeholder="e.g., Drink 8 glasses of water"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                              required
                            />
                          </div>
                          <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (Optional)</label>
                            <input
                              type="text"
                            value={currentHabit.description}
                            onChange={(e) => setCurrentHabit({ ...currentHabit, description: e.target.value })}
                            placeholder="Brief description of the habit"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Habit Type Selection */}
                        <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Habit Type</label>
                        <div className="grid grid-cols-1 gap-3">
                          <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                              <input
                                type="radio"
                              name="habit-type"
                                value="boolean"
                              checked={currentHabit.habitType === 'boolean'}
                              onChange={(e) => setCurrentHabit({ ...currentHabit, habitType: e.target.value })}
                              className="mr-3"
                              />
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">Checkbox</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Simple yes/no completion</div>
                              </div>
                            </label>
                          <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                              <input
                                type="radio"
                              name="habit-type"
                                value="numeric"
                              checked={currentHabit.habitType === 'numeric'}
                              onChange={(e) => setCurrentHabit({ ...currentHabit, habitType: e.target.value })}
                              className="mr-3"
                              />
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">Numeric Range</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Track numbers with min/max values</div>
                              </div>
                            </label>
                          <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                              <input
                                type="radio"
                              name="habit-type"
                                value="text"
                              checked={currentHabit.habitType === 'text'}
                              onChange={(e) => setCurrentHabit({ ...currentHabit, habitType: e.target.value })}
                              className="mr-3"
                              />
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">Text Entry</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Written response or journal entry</div>
                              </div>
                            </label>
                          </div>
                        </div>

                      {/* Member Assignment */}
                            <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Assign to Members</label>
                        
                        {/* Apply to All Toggle */}
                        <div className="mb-4">
                          <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                              <input
                              type="checkbox"
                              checked={currentHabit.applyToAll}
                              onChange={(e) => {
                                const applyToAll = e.target.checked;
                                setCurrentHabit({
                                  ...currentHabit,
                                  applyToAll,
                                  assignedMembers: applyToAll ? group?.members?.map(m => m.id) || [] : []
                                });
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div>
                              <div className="font-medium text-secondary-900 dark:text-white">Apply to All Members</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Assign this habit to all group members</div>
                            </div>
                          </label>
                          </div>

                        {/* Individual Member Selection */}
                        {!currentHabit.applyToAll && (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {group?.members?.map((member) => (
                              <label key={member.id} className="flex items-center gap-3 p-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                            <input
                                  type="checkbox"
                                  checked={currentHabit.assignedMembers.includes(member.id)}
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setCurrentHabit({
                                      ...currentHabit,
                                      assignedMembers: isChecked
                                        ? [...currentHabit.assignedMembers, member.id]
                                        : currentHabit.assignedMembers.filter(id => id !== member.id)
                                    });
                                  }}
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-200">
                                    {member.username[0].toUpperCase()}
                          </div>
                                  <span className="text-sm font-medium text-secondary-900 dark:text-white">{member.username}</span>
                      </div>
                              </label>
                            ))}
                          </div>
                        )}
                        
                        {/* Validation message for member selection */}
                        {!currentHabit.applyToAll && currentHabit.assignedMembers.length === 0 && (
                          <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                            Please select at least one member or choose "Apply to All Members"
                          </p>
                )}
              </div>

                      {/* Schedule Days Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Schedule Days</label>
                        
                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                            onClick={() => setCurrentHabit({ ...currentHabit, scheduleDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] })}
                            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                              currentHabit.scheduleDays.length === 7 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Everyday
                    </button>
                          <button
                            type="button"
                            onClick={() => setCurrentHabit({ ...currentHabit, scheduleDays: ['Monday', 'Wednesday', 'Friday'] })}
                            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                              JSON.stringify(currentHabit.scheduleDays.sort()) === JSON.stringify(['Friday', 'Monday', 'Wednesday'].sort())
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Mon, Wed, Fri
                          </button>
                            <button
                              type="button"
                            onClick={() => setCurrentHabit({ ...currentHabit, scheduleDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] })}
                            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                              JSON.stringify(currentHabit.scheduleDays.sort()) === JSON.stringify(['Friday', 'Monday', 'Thursday', 'Tuesday', 'Wednesday'].sort())
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Weekdays
                            </button>
                          </div>

                        {/* Day Checkboxes */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                            <label 
                              key={day} 
                              className={`flex flex-col items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                                currentHabit.scheduleDays.includes(day)
                                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                                  : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`}
                            >
                                    <input
                                type="checkbox"
                                checked={currentHabit.scheduleDays.includes(day)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCurrentHabit({ ...currentHabit, scheduleDays: [...currentHabit.scheduleDays, day] });
                                  } else {
                                    setCurrentHabit({ ...currentHabit, scheduleDays: currentHabit.scheduleDays.filter(d => d !== day) });
                                  }
                                }}
                                className="sr-only"
                              />
                              <span className="text-xs font-medium mt-1">{day.slice(0, 3)}</span>
                                    </label>
                          ))}
                                  </div>
                        
                        {currentHabit.scheduleDays.length === 0 && (
                          <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                            Please select at least one day for the habit schedule
                          </p>
                        )}
                                </div>

                                {/* Attack/Defence Selection */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Combat Type</label>
                                  <div className="grid grid-cols-3 gap-3">
                                    <button
                                      type="button"
                                      onClick={() => setCurrentHabit({ ...currentHabit, combatType: 'attack' })}
                                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                        currentHabit.combatType === 'attack'
                                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700'
                                      }`}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-5 h-5 ${currentHabit.combatType === 'attack' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                        <path d="M21 3l-1 1M3 21l1-1M21 3l-10 10M3 21l10-10M9 3l3 3M15 21l-3-3M21 9l-3 3M3 15l3-3M21 21l-1-1M3 3l1 1" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      <span className={`text-sm font-medium ${currentHabit.combatType === 'attack' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                        Attack
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCurrentHabit({ ...currentHabit, combatType: 'defence' })}
                                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                        currentHabit.combatType === 'defence'
                                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                          : 'border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700'
                                      }`}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-5 h-5 ${currentHabit.combatType === 'defence' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      <span className={`text-sm font-medium ${currentHabit.combatType === 'defence' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                        Defence
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCurrentHabit({ ...currentHabit, combatType: 'neutral' })}
                                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                        currentHabit.combatType === 'neutral'
                                          ? 'border-gray-500 bg-gray-50 dark:bg-gray-700'
                                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                      }`}
                                    >
                                      <span className={`text-sm font-medium ${currentHabit.combatType === 'neutral' ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                        Neutral
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                {/* Conditional Fields based on Habit Type */}
                      {currentHabit.habitType === 'numeric' && (
                        <div className="grid grid-cols-2 gap-4">
                                    <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Minimum Value</label>
                                      <input
                                        type="number"
                              value={currentHabit.minValue ?? ''}
                              onChange={(e) => setCurrentHabit({ ...currentHabit, minValue: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                                        required
                                      />
                                    </div>
                                    <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Maximum Value</label>
                                      <input
                                        type="number"
                              value={currentHabit.maxValue ?? ''}
                              onChange={(e) => setCurrentHabit({ ...currentHabit, maxValue: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                                        required
                                      />
                                    </div>
                                  </div>
                                )}

                      {currentHabit.habitType === 'text' && (
                                  <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prompt/Question</label>
                                    <input
                                      type="text"
                            value={currentHabit.prompt}
                            onChange={(e) => setCurrentHabit({ ...currentHabit, prompt: e.target.value })}
                                      placeholder="e.g., What did you learn today?"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                                      required
                                    />
                                  </div>
                                )}

                      {/* Add Habit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (currentHabit.name.trim() && currentHabit.assignedMembers.length > 0) {
                            const newMemberHabits = { ...memberHabits };
                            
                            // Add the habit to each assigned member
                            currentHabit.assignedMembers.forEach(memberId => {
                              if (!newMemberHabits[memberId]) {
                                newMemberHabits[memberId] = [];
                              }
                              newMemberHabits[memberId].push({
                                name: currentHabit.name,
                                description: currentHabit.description,
                                habitType: currentHabit.habitType,
                                minValue: currentHabit.minValue,
                                maxValue: currentHabit.maxValue,
                                prompt: currentHabit.prompt,
                                scheduleDays: currentHabit.scheduleDays,
                                combatType: currentHabit.combatType
                              });
                            });
                            
                            setMemberHabits(newMemberHabits);
                            setCurrentHabit({
                              name: '',
                              description: '',
                              habitType: 'boolean',
                              minValue: 0,
                              maxValue: 10,
                              prompt: '',
                              assignedMembers: [],
                              applyToAll: false,
                              scheduleDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                              combatType: 'neutral'
                            });
                          }
                        }}
                        disabled={!currentHabit.name.trim() || currentHabit.assignedMembers.length === 0}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Add Habit to Challenge
                      </button>
                              </div>
                          </div>


              {/* Validation Status */}
              {!isChallengeValid() && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
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

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 gap-4">
                    {/* Cancel Button */}
                <button
                  type="button"
                      onClick={handleCancel}
                      className={`px-6 py-2 rounded-lg transition-colors ${
                        hasHabitsAdded 
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {hasHabitsAdded ? 'Cancel (Unsaved)' : 'Cancel'}
                </button>

                    {/* Done Adding Habits Button */}
                    {Object.values(memberHabits).flat().length > 0 && (
                  <button
                        type="button"
                        onClick={lockHabitsAndShowOverview}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg border-2 border-green-500"
                      >
                        ✓ Done Adding Habits
                  </button>
                    )}
                  </div>
                </form>
                ) : (
                  /* Overview Mode */
                  <div className="space-y-6">
                    {/* Challenge Settings Summary */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Challenge Summary</h3>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                            <p className="text-sm text-gray-900 dark:text-gray-100">{newChallenge.startDate}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                            <p className="text-sm text-gray-900 dark:text-gray-100">{newChallenge.endDate}</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Habits</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">{Object.values(lockedHabits).flat().length} habits across {Object.keys(lockedHabits).length} members</p>
                        </div>
                      </div>
                    </div>

                    {/* Go Back and Edit Button */}
                    <div className="mb-6">
                      <button
                        type="button"
                        onClick={goBackToEditing}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        ← Go Back and Edit Habits
                      </button>
                    </div>

                    {/* Create Challenge Button */}
                    <div className="mb-6">
                      <button
                        type="button"
                        onClick={(e) => handleCreateChallenge(e)}
                        disabled={!newChallenge.startDate || !newChallenge.endDate || Object.values(lockedHabits).flat().length === 0}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        🚀 Create Challenge
                      </button>
                      {(!newChallenge.startDate || !newChallenge.endDate || Object.values(lockedHabits).flat().length === 0) && (
                        <p className="text-sm text-red-500 dark:text-red-400 mt-2 text-center">
                          Please complete all fields above
                        </p>
                  )}
                </div>
              </div>
                  )}
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-3 text-secondary-900 dark:text-white">Discard Changes?</h2>
            <p className="text-secondary-700 dark:text-secondary-300 mb-6">
              You have {Object.values(memberHabits).flat().length} habit{Object.values(memberHabits).flat().length !== 1 ? 's' : ''} added. 
              Are you sure you want to cancel and lose all your progress?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Challenge Confirm Modal */}
      {showDeleteChallengeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-3 text-secondary-900 dark:text-white">Remove Active Challenge</h2>
            <p className="text-secondary-700 dark:text-secondary-300 mb-4">
              Are you sure you want to remove this challenge? <strong>All data for this challenge will be permanently lost</strong> (member habits, progress, attendance, analytics). This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteChallengeConfirm(false)}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-secondary-700 text-secondary-800 dark:text-white hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={deleteActiveChallenge}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Archives Tab */}
      {activeTab === 'archives' && (
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">📚 Challenge Archives</h2>
            <p className="text-secondary-600 dark:text-secondary-400 mb-4">View completed challenges and their statistics.</p>
          </div>
          
          <div className="space-y-6">
            {archivesLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : archives && archives.length > 0 ? (
              archives.map((archive) => (
                <div key={archive.id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                        {archive.title}
                      </h3>
                      <p className="text-secondary-600 dark:text-secondary-400">
                        {new Date(archive.start_date).toLocaleDateString()} - {new Date(archive.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {archive.overall_completion_rate}%
                      </div>
                      <div className="text-sm text-secondary-500 dark:text-secondary-400">
                        Overall Completion
                      </div>
                    </div>
                  </div>
                  
                  {/* Challenge Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                      <div className="text-sm text-primary-600 dark:text-primary-400 font-medium">Duration</div>
                      <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                        {archive.duration_days} days
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <div className="text-sm text-green-600 dark:text-green-400 font-medium">Members</div>
                      <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                        {archive.total_members}
                      </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Completions</div>
                      <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                        {archive.total_completions}/{archive.total_possible}
                      </div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                      <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Best Performer</div>
                      <div className="text-xl font-semibold text-secondary-900 dark:text-white">
                        {archive.member_stats && archive.member_stats.length > 0 
                          ? archive.member_stats.reduce((best, member) => 
                              member.completion_rate > best.completion_rate ? member : best
                            ).username
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                  
                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Daily Progress Chart */}
                    {archive.daily_progress && archive.daily_progress.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Daily Progress</h4>
                        <div className="bg-white dark:bg-secondary-800 rounded-lg p-4">
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={archive.daily_progress}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              />
                              <YAxis domain={[0, 100]} />
                              <Tooltip 
                                formatter={(value) => [`${value}%`, 'Completion Rate']}
                                labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="completion_rate" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Member Comparison Chart */}
                    {archive.member_stats && archive.member_stats.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Daily Participation Comparison</h4>
                        <div className="bg-white dark:bg-secondary-800 rounded-lg p-4">
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={archive.member_stats}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="username" 
                                tick={{ fontSize: 12 }}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis domain={[0, 100]} />
                              <Tooltip 
                                formatter={(value) => [`${value}%`, 'Daily Participation']}
                                labelFormatter={(label) => `Member: ${label}`}
                              />
                              <Bar 
                                dataKey="completion_rate" 
                                fill="#10b981"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Member Performance */}
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Member Performance</h4>
                    <div className="space-y-4">
                      {archive.member_stats.map((member) => (
                        <div key={member.id} className="bg-gray-50 dark:bg-secondary-700 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200">
                                {member.username[0].toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-secondary-900 dark:text-white">
                                  {member.username}
                                </span>
                                <div className="text-sm text-secondary-500 dark:text-secondary-400">
                                  Daily Participation: {member.completion_rate}% ({member.days_completed}/{member.total_days} days)
                                </div>
                                {member.total_habit_completions !== undefined && (
                                  <div className="text-xs text-secondary-400 dark:text-secondary-500">
                                    Total Habit Completions: {member.total_habit_completions}/{member.total_possible_habit_completions}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-secondary-900 dark:text-white">
                                {member.completion_rate}%
                              </div>
                            </div>
                          </div>
                          
                          {/* Individual Habit Performance */}
                          {member.habit_details && member.habit_details.length > 0 && (
                            <div className="ml-13">
                              <div className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">Individual Habit Performance (vs Total Challenge Days):</div>
                              <div className="space-y-2">
                                {member.habit_details.map((habit, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white dark:bg-secondary-800 rounded p-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-secondary-600 dark:text-secondary-400">
                                        {habit.name}
                                      </span>
                                      <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-secondary-600 rounded text-secondary-600 dark:text-secondary-400">
                                        {habit.type}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-semibold text-secondary-900 dark:text-white">
                                        {habit.completion_rate}%
                                      </div>
                                      <div className="text-xs text-secondary-500 dark:text-secondary-400">
                                        {habit.completed_days}/{habit.total_days}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                  No Completed Challenges Yet
                </h3>
                <p className="text-secondary-600 dark:text-secondary-400">
                  Completed challenges will appear here once they finish.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'presets' && isLeader && (
        <div>
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">🎯 Habit Presets</h2>
                <p className="text-secondary-600 dark:text-secondary-400">Create and manage habit templates to quickly set up challenges</p>
              </div>
              <button
                onClick={handleCreatePreset}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
              >
                + Create Preset
              </button>
            </div>
          </div>

          {habitPresets.length === 0 ? (
            <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-12 text-center border border-gray-200 dark:border-secondary-700">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">No Presets Yet</h3>
              <p className="text-secondary-500 dark:text-secondary-400 mb-6">Create your first habit preset to save time when setting up challenges</p>
              <button
                onClick={handleCreatePreset}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Create Your First Preset
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {habitPresets.map(preset => (
                <div key={preset.id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700 hover:shadow-2xl transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-secondary-900 dark:text-white">{preset.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPreset(preset.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit preset"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete preset"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>{preset.habits.length} {preset.habits.length === 1 ? 'habit' : 'habits'}</span>
                    </div>
                  </div>

                  <div className="mb-4 max-h-32 overflow-y-auto">
                    <div className="space-y-2">
                      {preset.habits.slice(0, 3).map((habit, idx) => (
                        <div key={idx} className="text-sm text-secondary-700 dark:text-secondary-300 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            habit.combatType === 'attack' ? 'bg-blue-500' :
                            habit.combatType === 'defence' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`}></div>
                          <span className="truncate">{habit.name || 'Untitled habit'}</span>
                        </div>
                      ))}
                      {preset.habits.length > 3 && (
                        <div className="text-xs text-secondary-500 dark:text-secondary-400">
                          + {preset.habits.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleLoadPreset(preset.id)}
                    disabled={!!group?.activeChallenge}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      group?.activeChallenge
                        ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                  >
                    {group?.activeChallenge ? 'Challenge Active' : 'Load Preset'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">📊 Member Attendance</h2>
            <p className="text-secondary-600 dark:text-secondary-400 mb-4">Track member participation and activity in the current challenge.</p>
          </div>
          
          {attendanceLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : attendance && attendance.length > 0 ? (
            <div className="space-y-6">
              {/* Attendance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                  <div className="text-sm text-primary-600 dark:text-primary-400 font-medium">Total Members</div>
                  <div className="text-2xl font-semibold text-secondary-900 dark:text-white">
                    {attendance.length}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">Average Attendance</div>
                  <div className="text-2xl font-semibold text-secondary-900 dark:text-white">
                    {attendance.length > 0 ? Math.round(attendance.reduce((sum, member) => sum + member.attendance_rate, 0) / attendance.length) : 0}%
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Most Active</div>
                  <div className="text-2xl font-semibold text-secondary-900 dark:text-white">
                    {attendance.length > 0 ? attendance[0].username : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Member Attendance Cards */}
              <div className="space-y-4">
                {attendance.map((member, index) => (
                  <div key={member.member_id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-secondary-700">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200">
                            #{index + 1}
                          </div>
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-200 to-secondary-400 dark:from-secondary-900 dark:to-secondary-700 flex items-center justify-center text-sm font-bold text-secondary-700 dark:text-secondary-200">
                            {member.username[0].toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
                            {member.username}
                          </h3>
                          <div className="text-sm text-secondary-500 dark:text-secondary-400">
                            {member.days_active}/{member.total_days} days active
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-secondary-900 dark:text-white">
                          {member.attendance_rate}%
                        </div>
                        <div className="text-sm text-secondary-500 dark:text-secondary-400">
                          Attendance Rate
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                        Recent Activity {member.recent_activity.length > 0 && `(Last ${member.recent_activity.length} Day${member.recent_activity.length !== 1 ? 's' : ''})`}
                      </h4>
                      <div className="flex gap-2">
                        {member.recent_activity.map((day, idx) => {
                          // Parse date in local timezone to avoid UTC conversion issues
                          const dateParts = day.date.split('-');
                          const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                          return (
                            <div
                              key={idx}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                                day.active
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                              }`}
                              title={`${localDate.toLocaleDateString()}: ${day.active ? 'Active' : 'Inactive'}`}
                            >
                              {localDate.getDate()}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Last Active */}
                    {member.last_active && (
                      <div className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                        Last active: {(() => {
                          const dateParts = member.last_active.split('-');
                          const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                          return localDate.toLocaleDateString();
                        })()}
                      </div>
                    )}

                    {/* View Full Attendance Button */}
                    <button
                      onClick={() => {
                        console.log('Button clicked for member:', member.member_id);
                        console.log('Full attendance data:', member.full_attendance);
                        setExpandedAttendance(prev => {
                          const newState = { ...prev, [member.member_id]: !prev[member.member_id] };
                          console.log('New expanded state:', newState);
                          return newState;
                        });
                      }}
                      className="w-full mt-3 py-2 px-4 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {expandedAttendance[member.member_id] ? '▲ Hide' : '▼ View'} Full Attendance History
                    </button>

                    {/* Full Attendance History */}
                    {expandedAttendance[member.member_id] && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-secondary-900/50 rounded-lg border border-gray-200 dark:border-secondary-700">
                        {member.full_attendance && member.full_attendance.length > 0 ? (
                          <>
                            <h4 className="text-sm font-semibold text-secondary-900 dark:text-white mb-3">
                              Complete Attendance ({member.full_attendance.length} days)
                            </h4>
                            <div className="overflow-x-auto -mx-2 px-2">
                              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-2 min-w-max">
                              {member.full_attendance.map((day, idx) => {
                            const dateParts = day.date.split('-');
                            const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                            return (
                              <div
                                key={idx}
                                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium p-1 ${
                                  day.active
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-2 border-green-300 dark:border-green-700'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
                                }`}
                                title={`${localDate.toLocaleDateString()}: ${day.active ? 'Active' : 'Inactive'}`}
                              >
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {localDate.toLocaleDateString('en-US', { month: 'short' })}
                                </div>
                                <div className="font-bold">
                                  {localDate.getDate()}
                                </div>
                              </div>
                            );
                              })}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center text-secondary-500 dark:text-secondary-400 py-4">
                            <p>No attendance data available</p>
                            <p className="text-xs mt-2">Debug: {JSON.stringify(member.full_attendance)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                No Active Challenge
              </h3>
              <p className="text-secondary-600 dark:text-secondary-400">
                Attendance tracking is only available during active challenges.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preset Creation/Edit Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900 dark:text-white">
                  {editingPresetId ? 'Edit Preset' : 'Create Preset'}
                </h2>
                <button
                  onClick={() => {
                    setShowPresetModal(false);
                    setPresetFormData({ name: '', habits: [] });
                    setEditingPresetId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Preset Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preset Name</label>
                <input
                  type="text"
                  value={presetFormData.name}
                  onChange={(e) => setPresetFormData({ ...presetFormData, name: e.target.value })}
                  placeholder="e.g., Morning Routine, Daily Fitness"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Habits List */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
                    Habits ({presetFormData.habits.length})
                  </h3>
                  <button
                    onClick={handleAddPresetHabit}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    + Add Habit
                  </button>
                </div>

                {presetFormData.habits.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">No habits yet. Click "Add Habit" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {presetFormData.habits.map((habit, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 space-y-3">
                            {/* Habit Name */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Habit Name</label>
                              <input
                                type="text"
                                value={habit.name}
                                onChange={(e) => handleUpdatePresetHabit(index, 'name', e.target.value)}
                                placeholder="e.g., Drink Water"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                              />
                            </div>

                            {/* Habit Type */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                              <div className="grid grid-cols-3 gap-2">
                                {['boolean', 'numeric', 'text'].map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleUpdatePresetHabit(index, 'habitType', type)}
                                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                      habit.habitType === type
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {type === 'boolean' ? 'Checkbox' : type === 'numeric' ? 'Numeric' : 'Text'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Numeric fields */}
                            {habit.habitType === 'numeric' && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Min</label>
                                  <input
                                    type="number"
                                    value={habit.minValue ?? ''}
                                    onChange={(e) => handleUpdatePresetHabit(index, 'minValue', e.target.value === '' ? undefined : parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Max</label>
                                  <input
                                    type="number"
                                    value={habit.maxValue ?? ''}
                                    onChange={(e) => handleUpdatePresetHabit(index, 'maxValue', e.target.value === '' ? undefined : parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Text prompt */}
                            {habit.habitType === 'text' && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt</label>
                                <input
                                  type="text"
                                  value={habit.prompt || ''}
                                  onChange={(e) => handleUpdatePresetHabit(index, 'prompt', e.target.value)}
                                  placeholder="e.g., What did you learn today?"
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                                />
                              </div>
                            )}

                            {/* Combat Type */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Combat Type</label>
                              <div className="grid grid-cols-3 gap-2">
                                {['neutral', 'attack', 'defence'].map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleUpdatePresetHabit(index, 'combatType', type)}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                      habit.combatType === type
                                        ? type === 'attack' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                          : type === 'defence' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                          : 'border-gray-500 bg-gray-100 dark:bg-gray-600'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Schedule Days Selection */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule Days</label>
                              
                              {/* Quick Presets */}
                              <div className="flex flex-wrap gap-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePresetHabit(index, 'scheduleDays', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])}
                                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                                    habit.scheduleDays?.length === 7 
                                      ? 'bg-blue-600 text-white' 
                                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                  }`}
                                >
                                  Everyday
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePresetHabit(index, 'scheduleDays', ['Monday', 'Wednesday', 'Friday'])}
                                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                                    JSON.stringify((habit.scheduleDays || []).sort()) === JSON.stringify(['Friday', 'Monday', 'Wednesday'].sort())
                                      ? 'bg-blue-600 text-white' 
                                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                  }`}
                                >
                                  Mon, Wed, Fri
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePresetHabit(index, 'scheduleDays', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                                    JSON.stringify((habit.scheduleDays || []).sort()) === JSON.stringify(['Friday', 'Monday', 'Thursday', 'Tuesday', 'Wednesday'].sort())
                                      ? 'bg-blue-600 text-white' 
                                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                  }`}
                                >
                                  Weekdays
                                </button>
                              </div>

                              {/* Day Checkboxes */}
                              <div className="grid grid-cols-7 gap-1">
                                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                                  <label 
                                    key={day} 
                                    className={`flex flex-col items-center p-1.5 border rounded-lg cursor-pointer transition-colors ${
                                      (habit.scheduleDays || []).includes(day)
                                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                                        : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={(habit.scheduleDays || []).includes(day)}
                                      onChange={(e) => {
                                        const currentDays = habit.scheduleDays || [];
                                        if (e.target.checked) {
                                          handleUpdatePresetHabit(index, 'scheduleDays', [...currentDays, day]);
                                        } else {
                                          handleUpdatePresetHabit(index, 'scheduleDays', currentDays.filter(d => d !== day));
                                        }
                                      }}
                                      className="sr-only"
                                    />
                                    <span className="text-xs font-medium">{day.slice(0, 3)}</span>
                                  </label>
                                ))}
                              </div>
                              
                              {/* Validation message */}
                              {(!habit.scheduleDays || habit.scheduleDays.length === 0) && (
                                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                                  Please select at least one day for the habit schedule
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemovePresetHabit(index)}
                            className="ml-4 text-red-500 hover:text-red-700 dark:text-red-400"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPresetModal(false);
                  setPresetFormData({ name: '', habits: [] });
                  setEditingPresetId(null);
                }}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {editingPresetId ? 'Update Preset' : 'Save Preset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail; 