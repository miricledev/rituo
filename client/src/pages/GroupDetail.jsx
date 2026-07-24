import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import CoachManagementSection from '../components/CoachManagementSection';
import MemberManagementSection from '../components/MemberManagementSection';
import GroupManagementSection from '../components/GroupManagementSection';
import AttendancePanel from '../components/AttendancePanel';
import {
  createEmptyPresetFormData
} from '../utils/groupDetailDefaults';
import {
  calculateNumericProgress,
  calculateTodayCompletionRate,
  getPercentageColor,
  getProgressColorClasses
} from '../utils/habitProgressUtils';
import {
  formatDateLocal,
  getDayName,
  getNextAvailableDay,
  isHabitAvailableToday
} from '../utils/habitScheduleUtils';
import {
  calculateMemberCompletionRate,
  calculateScheduledAverageForDate,
  calculateTodayScheduledProgress
} from '../utils/groupOverviewStats';
import usePageFeedback from '../hooks/usePageFeedback';
import useHabitPresets from '../hooks/useHabitPresets';
import useChallengeModal from '../hooks/useChallengeModal';
import useGroupAdmin from '../hooks/useGroupAdmin';
import useGroupSettings from '../hooks/useGroupSettings';
import useGroupDataFetchers from '../hooks/useGroupDataFetchers';
import useChallengeActions from '../hooks/useChallengeActions';
import useHabitProgress from '../hooks/useHabitProgress';
import useColorChartAccess from '../hooks/useColorChartAccess';
import useGroupDetailViewModel from '../hooks/useGroupDetailViewModel';
import useChallengeValidation from '../hooks/useChallengeValidation';
import SchoolGroupDetail from './SchoolGroupDetail';
import StandardGroupDetail from './StandardGroupDetail';

const ColorChart = lazy(() => import('../components/ColorChart'));
const HabitCalendar = lazy(() => import('../components/HabitCalendar'));
const CourseManager = lazy(() => import('../components/CourseManager'));
const CoursePlayer = lazy(() => import('../components/CoursePlayer'));
const CourseStudentProgress = lazy(() => import('../components/CourseStudentProgress'));
const SchoolProfilePanel = lazy(() => import('../components/SchoolProfilePanel'));

const GroupDetail = () => {
  // All hooks at the top!
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser: user } = useAuth();
  const [ticking, setTicking] = useState({});
  const [numericValues, setNumericValues] = useState({});
  const [textValues, setTextValues] = useState({});
  const [editingHabits, setEditingHabits] = useState({});
  const [tempNumericValues, setTempNumericValues] = useState({});
  const [tempTextValues, setTempTextValues] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [forcedSchoolSection, setForcedSchoolSection] = useState(null);
  const [currentSchoolSection, setCurrentSchoolSection] = useState('school-timetable');
  const [selectedChatClassId, setSelectedChatClassId] = useState(null);
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
  const [showAddMembersToChallengeModal, setShowAddMembersToChallengeModal] = useState(false);
  const [addMembersToChallengeSelected, setAddMembersToChallengeSelected] = useState([]);
  const [addMembersToChallengeSubmitting, setAddMembersToChallengeSubmitting] = useState(false);
  const [expandedAttendance, setExpandedAttendance] = useState({});
  const [collapsedMembers, setCollapsedMembers] = useState({}); // Will be initialized to collapse all members
  const [timeUntilMidnight, setTimeUntilMidnight] = useState('');
  const [schoolProfiles, setSchoolProfiles] = useState([]);
  const [leagueTable, setLeagueTable] = useState([]);
  const [schoolProfilesLoading, setSchoolProfilesLoading] = useState(false);
  
  // Habit Presets State
  // Course state (for students taking course)
  const [courseProgress, setCourseProgress] = useState(null);
  const [groupCourses, setGroupCourses] = useState([]);
  const {
    pageToast,
    confirmDialog,
    showPageToast,
    clearPageToast,
    requestConfirmation,
    clearConfirmation
  } = usePageFeedback();
  const {
    habitPresets,
    showPresetModal,
    editingPresetId,
    presetFormData,
    setPresetFormData,
    fetchPresets,
    closePresetModal,
    handleCreatePreset,
    handleEditPreset,
    handleDeletePreset,
    handleSavePreset,
    handleAddPresetHabit,
    handleUpdatePresetHabit,
    handleRemovePresetHabit
  } = useHabitPresets({
    requestConfirmation,
    showPageToast
  });
  const {
    showCreateChallengeModal,
    setShowCreateChallengeModal,
    newChallenge,
    setNewChallenge,
    currentHabit,
    setCurrentHabit,
    memberHabits,
    setMemberHabits,
    showCancelConfirm,
    setShowCancelConfirm,
    collapsedMembersInModal,
    lockedHabits,
    isEditingHabits,
    setIsEditingHabits,
    editChallengeHabitsMode,
    setEditChallengeHabitsMode,
    lockedChallengeMemberIds,
    setLockedChallengeMemberIds,
    hasHabitsAdded,
    resetChallengeModalState,
    handleCancel,
    confirmCancel,
    toggleMemberCollapseInModal,
    expandAllMembersInModal,
    collapseAllMembersInModal,
    lockHabitsAndShowOverview,
    goBackToEditing,
    openEditChallengeHabitsModal,
    openCreateChallengeModal
  } = useChallengeModal({ group });

  const renderLazyPanel = (content) => (
    <Suspense
      fallback={(
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    >
      {content}
    </Suspense>
  );

  // Calculate myMemberHabit early to avoid temporal dead zone
  const myMemberHabit = group?.activeChallenge?.memberHabits?.find(
    mh => String(mh.member) === String(user?.id) || String(mh.member?.id) === String(user?.id)
  );
  const scheduledHabits = myMemberHabit?.habits?.filter((habit) => isHabitAvailableToday(habit)) || [];

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

  const refreshCourseProgress = () => {
    if (!group?.activeChallenge?.id) return;
    axios.get(`/groups/${groupId}/challenge/${group.activeChallenge.id}/course/progress`)
      .then(res => setCourseProgress(res.data))
      .catch(() => {});
  };

  const getGoalForStudent = (studentId, goalId) => {
    if (!studentId || !goalId) return null;
    const profile = schoolProfiles.find((entry) => String(entry.student.id) === String(studentId));
    return profile?.goals?.find((goal) => String(goal.id) === String(goalId)) || null;
  };

  const isLeader = group?.viewerCanManage ?? (group?.leader && user ? String(group.leader.id) === String(user.id) : false);
  const isSchoolGroup = (group?.groupType || 'school') === 'school';
  const containerLabel = isSchoolGroup ? 'School' : 'Group';
  const containerIdLabel = isSchoolGroup ? 'School ID' : 'Group ID';
  const overviewLabel = isSchoolGroup ? 'Dashboard' : 'Overview';
  const chatLabel = isSchoolGroup ? 'School Chat' : 'Group Chat';
  const schoolWorkspaceLabel = isSchoolGroup ? 'School Workspace' : 'School Impact';
  const adminLabel = isSchoolGroup ? 'School Admin' : 'Admin';
  const attendanceLabel = isSchoolGroup ? 'Attendance Ops' : 'Attendance';
  const {
    fetchSchoolProfiles,
    fetchGroupDetails,
    fetchArchives,
    fetchAttendance,
    fetchConversations,
    fetchMyCoachAssignments
  } = useGroupDataFetchers({
    group,
    groupId,
    user,
    setGroup,
    setLoading,
    setError,
    setSchoolProfiles,
    setLeagueTable,
    setSchoolProfilesLoading,
    setArchives,
    setArchivesLoading,
    setAttendance,
    setAttendanceLoading,
    setConversations,
    setConversationsLoading
  });
  const {
    coaches,
    setCoaches,
    coachAssignments,
    setCoachAssignments,
    selectedCoachForAssignment,
    setSelectedCoachForAssignment,
    showCoachAssignmentModal,
    setShowCoachAssignmentModal,
    adminSidebarActive,
    setAdminSidebarActive,
    showDeleteGroupStep,
    setShowDeleteGroupStep,
    deleteGroupConfirmText,
    setDeleteGroupConfirmText,
    memberToKick,
    setMemberToKick,
    showKickMemberConfirm,
    setShowKickMemberConfirm,
    fetchCoaches,
    handlePromoteToCoach,
    handleDemoteCoach,
    handleAssignStudents,
    handleKickMember,
    handleDeleteGroup
  } = useGroupAdmin({
    groupId,
    isLeader,
    fetchGroupDetails,
    navigate,
    requestConfirmation,
    showPageToast
  });
  const {
    isEditingGroupName,
    newGroupName,
    setNewGroupName,
    isEditingGroupType,
    newGroupType,
    setNewGroupType,
    handleEditGroupName,
    handleSaveGroupName,
    handleCancelEditGroupName,
    handleEditGroupType,
    handleSaveGroupType,
    handleCancelEditGroupType
  } = useGroupSettings({
    group,
    groupId,
    setGroup,
    showPageToast
  });
  const sharedTabState = {
    group,
    isLeader,
    activeTab,
    setActiveTab,
    isEditingGroupName,
    newGroupName,
    setNewGroupName,
    handleSaveGroupName,
    handleCancelEditGroupName,
    handleEditGroupName,
    containerIdLabel,
    containerLabel,
    isEditingGroupType,
    newGroupType,
    setNewGroupType,
    handleSaveGroupType,
    handleCancelEditGroupType,
    handleEditGroupType,
    onOpenChallenge: openCreateChallengeModal,
    onRemoveChallenge: () => setShowDeleteChallengeConfirm(true)
  };
  const schoolTabs = [
    { key: 'overview', label: overviewLabel, show: true },
    { key: 'school', label: schoolWorkspaceLabel, show: true },
    { key: 'chat', label: chatLabel, show: false },
    { key: 'dms', label: 'Staff DMs', show: false },
    { key: 'dm', label: 'Message', show: false },
    { key: 'course', label: 'Learning', show: isLeader || !!group?.activeChallenge?.courseId },
    { key: 'leaderboard', label: 'League', show: false },
    { key: 'colorChart', label: 'Color Chart', show: false },
    { key: 'calendar', label: 'Planner', show: false },
    { key: 'archives', label: 'Archives', show: false },
    { key: 'presets', label: 'Presets', show: false },
    { key: 'attendance', label: attendanceLabel, show: false },
    { key: 'admin', label: adminLabel, show: false }
  ];
  const standardTabs = [
    { key: 'overview', label: overviewLabel, show: true },
    { key: 'chat', label: chatLabel, show: true },
    { key: 'dms', label: 'DMs', show: isLeader },
    { key: 'dm', label: 'Message', show: !isLeader },
    { key: 'leaderboard', label: 'Leaderboard', show: true },
    { key: 'course', label: 'Course', show: isLeader || !!group?.activeChallenge?.courseId },
    { key: 'colorChart', label: 'Color Chart', show: true },
    { key: 'calendar', label: 'Calendar', show: !isLeader },
    { key: 'school', label: schoolWorkspaceLabel, show: true },
    { key: 'archives', label: 'Archives', show: isLeader },
    { key: 'presets', label: 'Presets', show: isLeader },
    { key: 'attendance', label: attendanceLabel, show: isLeader },
    { key: 'admin', label: adminLabel, show: isLeader }
  ];
  const {
    handleLoadPreset: challengeHandleLoadPreset,
    deleteActiveChallenge: challengeDeleteActiveChallenge,
    handleAddMembersToChallenge: challengeHandleAddMembersToChallenge,
    toggleAddMemberToChallenge: challengeToggleAddMemberToChallenge,
    handleCreateChallenge: challengeHandleCreateChallenge,
    getMissingMembers: challengeGetMissingMembers,
    isChallengeValid: challengeIsChallengeValid
  } = useChallengeActions({
    group,
    groupId,
    habitPresets,
    editChallengeHabitsMode,
    memberHabits,
    setMemberHabits,
    lockedChallengeMemberIds,
    showCreateChallengeModal,
    openCreateChallengeModal,
    isEditingHabits,
    lockedHabits,
    newChallenge,
    setNewChallenge,
    groupCourses,
    resetChallengeModalState,
    fetchGroupDetails,
    showPageToast,
    setShowDeleteChallengeConfirm,
    addMembersToChallengeSelected,
    setAddMembersToChallengeSelected,
    setAddMembersToChallengeSubmitting,
    setShowAddMembersToChallengeModal,
    setGroup,
    openEditChallengeHabitsModal
  });
  const {
    handleToggleHabit: progressHandleToggleHabit,
    handleNumericHabitUpdate: progressHandleNumericHabitUpdate,
    handleNumericHabitSubmit: progressHandleNumericHabitSubmit,
    handleTextHabitUpdate: progressHandleTextHabitUpdate,
    handleTextHabitSubmit: progressHandleTextHabitSubmit,
    handleStartEdit: progressHandleStartEdit,
    handleCancelEdit: progressHandleCancelEdit,
    handleTempNumericUpdate: progressHandleTempNumericUpdate,
    handleTempTextUpdate: progressHandleTempTextUpdate,
    handleEditNumericSubmit: progressHandleEditNumericSubmit,
    handleEditTextSubmit: progressHandleEditTextSubmit
  } = useHabitProgress({
    myMemberHabit,
    group,
    groupId,
    fetchGroupDetails,
    showPageToast,
    setTicking,
    setNumericValues,
    setTextValues,
    setEditingHabits,
    setTempNumericValues,
    setTempTextValues
  });
  const {
    membersNotInChallenge,
    schoolProfileMap,
    mySchoolProfile,
    leaderboardData,
    filteredConversations,
    getLinkedGoalTitle,
    handleStudentNumericUpdate,
    handleStudentNumericSubmit,
    handleStudentTextUpdate,
    handleStudentTextSubmit,
    formatRelativeTime
  } = useGroupDetailViewModel({
    group,
    schoolProfiles,
    user,
    getDayName,
    conversations,
    searchQuery,
    getGoalForStudent,
    handleTempNumericUpdate: progressHandleTempNumericUpdate,
    handleNumericHabitUpdate: progressHandleNumericHabitUpdate,
    handleEditNumericSubmit: progressHandleEditNumericSubmit,
    handleNumericHabitSubmit: progressHandleNumericHabitSubmit,
    handleTempTextUpdate: progressHandleTempTextUpdate,
    handleTextHabitUpdate: progressHandleTextHabitUpdate,
    handleEditTextSubmit: progressHandleEditTextSubmit,
    handleTextHabitSubmit: progressHandleTextHabitSubmit
  });
  const {
    getDateString,
    getMissingMembers,
    isChallengeValid
  } = useChallengeValidation({
    group,
    isEditingHabits,
    memberHabits,
    lockedHabits
  });
  const {
    isCoach,
    availableMembers
  } = useColorChartAccess({
    group,
    user,
    coaches,
    coachAssignments,
    isLeader
  });

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  useEffect(() => {
    fetchSchoolProfiles();
  }, [groupId, user?.id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const classParam = searchParams.get('class');
    const parsedClassId = classParam ? Number(classParam) : null;
    setSelectedChatClassId(Number.isFinite(parsedClassId) ? parsedClassId : null);
    if (tab === 'course') setActiveTab('course');
    if (tab === 'school-impact' || tab === 'school') setActiveTab('school');
    if (tab === 'admin' && isLeader) setActiveTab('admin');
    if (tab === 'chat') setActiveTab('chat');
    if (tab === 'dms' || tab === 'dm') {
      setActiveTab(isSchoolGroup ? 'chat' : tab);
    }
  }, [isLeader, isSchoolGroup, searchParams]);

  useEffect(() => {
    const currentClassParam = searchParams.get('class');
    const nextClassParam = activeTab === 'chat' && selectedChatClassId != null
      ? String(selectedChatClassId)
      : null;

    if (currentClassParam === nextClassParam || (!currentClassParam && !nextClassParam)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (nextClassParam) {
      nextParams.set('class', nextClassParam);
    } else {
      nextParams.delete('class');
    }
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, selectedChatClassId, setSearchParams]);

  useEffect(() => {
    if (activeTab !== 'school' && forcedSchoolSection) {
      setForcedSchoolSection(null);
    }
  }, [activeTab, forcedSchoolSection]);

  useEffect(() => {
    if (activeTab === 'archives' && isLeader) {
      fetchArchives();
    }
  }, [activeTab, isLeader, groupId]);

  useEffect(() => {
    if (activeTab === 'course' && group?.activeChallenge?.courseId && !isLeader) {
      axios.get(`/groups/${groupId}/challenge/${group.activeChallenge.id}/course/progress`)
        .then(res => setCourseProgress(res.data))
        .catch(() => setCourseProgress(null));
    }
  }, [activeTab, group?.activeChallenge?.courseId, group?.activeChallenge?.id, isLeader, groupId]);

  useEffect(() => {
    if (showCreateChallengeModal && !editChallengeHabitsMode && groupId) {
      axios.get('/groups/leader/courses').then(res => setGroupCourses(res.data.courses || [])).catch(() => setGroupCourses([]));
    }
  }, [showCreateChallengeModal, editChallengeHabitsMode, groupId]);

  useEffect(() => {
    if ((activeTab === 'coaches' || activeTab === 'admin') && isLeader) {
      fetchCoaches();
    }
  }, [activeTab, isLeader, groupId]);

  // Fetch coach's own assignments if they're a coach (not leader)
  useEffect(() => {
    if (isCoach && !isLeader && user && groupId) {
      fetchMyCoachAssignments().then((studentIds) => {
        setCoachAssignments((prev) => ({
          ...prev,
          [user.id]: studentIds || []
        }));
      });
    }
  }, [fetchMyCoachAssignments, isCoach, isLeader, user, groupId]);

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

  // Load presets from backend on component mount
  useEffect(() => {
    fetchPresets();
  }, []);

  const toggleMemberCollapse = (memberId) => {
    setCollapsedMembers(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();

    // Use locked habits if in overview mode, otherwise use current memberHabits
    const habitsToSubmit = isEditingHabits ? memberHabits : lockedHabits;

    if (editChallengeHabitsMode) {
      // Updating habits for existing active challenge
      try {
        const memberHabitsArray = Object.entries(habitsToSubmit).map(([memberId, habits]) => ({
          member: memberId,
          habits: habits
        }));
        await axios.put(`/groups/${groupId}/challenge/${group.activeChallenge.id}/member-habits`, {
          memberHabits: memberHabitsArray
        });
        resetChallengeModalState();
        await fetchGroupDetails();
        showPageToast('success', 'Challenge habits saved');
      } catch (error) {
        console.error('Error updating challenge habits:', error);
        showPageToast('error', 'Failed to save habits', error.response?.data?.error || error.message);
      }
      return;
    }

    // Validate dates for new challenge
    if (!newChallenge.startDate || !newChallenge.endDate) {
      showPageToast('error', 'Challenge dates required', 'Please select both start and end dates for the challenge.');
      return;
    }

    // Validate that habits exist
    if (Object.keys(habitsToSubmit).length === 0) {
      showPageToast('error', 'No habits added', 'Please add at least one habit before creating the challenge.');
      return;
    }

    // Validate course: if course attached, challenge must be >= course sections in weeks
    if (newChallenge.courseId) {
      const course = groupCourses.find(c => c.id === newChallenge.courseId);
      if (course) {
        const sectionsCount = course.sections?.length || 0;
        const start = new Date(newChallenge.startDate);
        const end = new Date(newChallenge.endDate);
        const challengeWeeks = (end - start) / (7 * 24 * 60 * 60 * 1000);
        if (challengeWeeks < sectionsCount) {
          showPageToast('error', 'Challenge too short', `Challenge must be at least ${sectionsCount} weeks for this course (1 week per section).`);
          return;
        }
      }
    }

    try {
      const memberHabitsArray = Object.entries(habitsToSubmit).map(([memberId, habits]) => ({
        member: memberId,
        habits: habits
      }));

      await axios.post('/groups/challenge', {
        groupId,
        startDate: newChallenge.startDate,
        endDate: newChallenge.endDate,
        memberHabits: memberHabitsArray,
        courseId: newChallenge.courseId || null,
        courseRequiredMemberIds: newChallenge.courseRequiredMemberIds || []
      });
      resetChallengeModalState();
      setNewChallenge(prev => ({ ...prev, courseId: null, courseRequiredMemberIds: [] }));
      fetchGroupDetails();
      showPageToast('success', 'Challenge created');
    } catch (error) {
      console.error('Error creating challenge:', error);
      showPageToast('error', 'Failed to create challenge', error.response?.data?.error || error.message);
    }
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
  const handleToggleHabit = async (habitIndex) => progressHandleToggleHabit(habitIndex);

  // Handler for numeric habit updates
  const handleNumericHabitUpdate = (habitIndex, value) => progressHandleNumericHabitUpdate(habitIndex, value);

  // Handler for numeric habit submission
  const handleNumericHabitSubmit = async (habitIndex, value) => progressHandleNumericHabitSubmit(habitIndex, value);

  // Handler for text habit updates
  const handleTextHabitUpdate = (habitIndex, value) => progressHandleTextHabitUpdate(habitIndex, value);

  // Handler for text habit submission
  const handleTextHabitSubmit = async (habitIndex, value) => progressHandleTextHabitSubmit(habitIndex, value);

  // Handler for starting to edit a habit
  const handleStartEdit = (habitIndex, habit) => progressHandleStartEdit(habitIndex, habit);

  // Handler for canceling edit
  const handleCancelEdit = (habitIndex) => progressHandleCancelEdit(habitIndex);

  // Handler for updating temp numeric values
  const handleTempNumericUpdate = (habitIndex, value) => progressHandleTempNumericUpdate(habitIndex, value);

  // Handler for updating temp text values
  const handleTempTextUpdate = (habitIndex, value) => progressHandleTempTextUpdate(habitIndex, value);

  // Handler for submitting edited numeric habit
  const handleEditNumericSubmit = async (habitIndex, value) => progressHandleEditNumericSubmit(habitIndex, value);

  // Handler for submitting edited text habit
  const handleEditTextSubmit = async (habitIndex, value) => progressHandleEditTextSubmit(habitIndex, value);

  const shellProps = {
    ...sharedTabState,
    tabs: isSchoolGroup ? schoolTabs : standardTabs
  };

  const handleSelectSchoolArea = (area) => {
    setActiveTab(area.defaultTab);
    if (area.defaultSection) {
      setCurrentSchoolSection(area.defaultSection);
    }
    setForcedSchoolSection(area.defaultSection || null);
  };

  const handleOpenSchoolSection = (section) => {
    setActiveTab('school');
    setCurrentSchoolSection(section);
    setForcedSchoolSection(section);
  };

  const workspaceProps = {
    activeTab,
    isLeader,
    isCoach,
    mySchoolProfile,
    group,
    membersNotInChallenge,
    setAddMembersToChallengeSelected,
    setShowAddMembersToChallengeModal,
    openEditChallengeHabitsModal,
    scheduledHabits,
    calculateScheduledAverageForDate,
    getDayName,
    formatDateLocal,
    calculateTodayScheduledProgress,
    groupId,
    timeUntilMidnight,
    collapsedMembers,
    toggleMemberCollapse,
    calculateMemberCompletionRate,
    calculateTodayCompletionRate,
    isHabitAvailableToday,
    getPercentageColor,
    getNextAvailableDay,
    isMember,
    myMemberHabit,
    editingHabits,
    ticking,
    numericValues,
    textValues,
    tempNumericValues,
    tempTextValues,
    getLinkedGoalTitle,
    handleStartEdit,
    handleCancelEdit,
    handleToggleHabit,
    handleStudentNumericUpdate,
    handleStudentNumericSubmit,
    handleStudentTextUpdate,
    handleStudentTextSubmit,
    selectedChatClassId,
    setSelectedChatClassId,
    conversations,
    conversationsLoading,
    filteredConversations,
    searchQuery,
    setSearchQuery,
    selectedDMUser,
    setSelectedDMUser,
    formatRelativeTime,
    leaderboardData,
    courseProgress,
    refreshCourseProgress,
    renderLazyPanel,
    CourseStudentProgress,
    CourseManager,
    CoursePlayer,
    selectedColorChartMember,
    setSelectedColorChartMember,
    availableMembers,
    user,
    renderColorChart: (props) => renderLazyPanel(<ColorChart {...props} />),
    schoolProfiles,
    leagueTable,
    schoolProfilesLoading,
    fetchSchoolProfiles,
    fetchGroupDetails,
    SchoolProfilePanel,
    forcedSchoolSection,
    onSchoolSectionChange: setCurrentSchoolSection,
    HabitCalendar,
    showCreateChallengeModal,
    editChallengeHabitsMode,
    hasHabitsAdded,
    memberHabits,
    lockedHabits,
    expandAllMembersInModal,
    collapseAllMembersInModal,
    collapsedMembersInModal,
    lockedChallengeMemberIds,
    toggleMemberCollapseInModal,
    setMemberHabits,
    newChallenge,
    goBackToEditing,
    challengeHandleCreateChallenge,
    habitPresets,
    challengeHandleLoadPreset,
    setNewChallenge,
    getDateString,
    groupCourses,
    currentHabit,
    setCurrentHabit,
    schoolProfileMap,
    challengeIsChallengeValid,
    challengeGetMissingMembers,
    handleCancel,
    lockHabitsAndShowOverview,
    pageToast,
    clearPageToast,
    showCancelConfirm,
    setShowCancelConfirm,
    confirmCancel,
    showDeleteChallengeConfirm,
    setShowDeleteChallengeConfirm,
    challengeDeleteActiveChallenge,
    confirmDialog,
    clearConfirmation,
    showAddMembersToChallengeModal,
    addMembersToChallengeSelected,
    challengeToggleAddMemberToChallenge,
    challengeHandleAddMembersToChallenge,
    addMembersToChallengeSubmitting,
    archivesLoading,
    archives,
    onCreatePreset: handleCreatePreset,
    onEditPreset: handleEditPreset,
    onDeletePreset: handleDeletePreset,
    onLoadPreset: challengeHandleLoadPreset,
    showPresetModal,
    editingPresetId,
    onAddPresetHabit: handleAddPresetHabit,
    onClosePresetModal: closePresetModal,
    onRemovePresetHabit: handleRemovePresetHabit,
    onSavePreset: handleSavePreset,
    onUpdatePresetHabit: handleUpdatePresetHabit,
    presetFormData,
    setPresetFormData,
    showPageToast,
    onOpenSchoolSection: handleOpenSchoolSection,
    deleteGroupConfirmText,
    setDeleteGroupConfirmText,
    setShowDeleteGroupStep,
    showDeleteGroupStep,
    handleDeleteGroup
  };

  return isSchoolGroup ? (
    <SchoolGroupDetail
      shellProps={shellProps}
      workspaceProps={workspaceProps}
      currentSchoolSection={currentSchoolSection}
      onSelectSchoolArea={handleSelectSchoolArea}
    />
  ) : (
    <StandardGroupDetail shellProps={shellProps} workspaceProps={workspaceProps} />
  );
};

export default GroupDetail;
