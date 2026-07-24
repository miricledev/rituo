import { useState } from 'react';
import axios from 'axios';

const useGroupAdmin = ({
  groupId,
  isLeader,
  fetchGroupDetails,
  navigate,
  requestConfirmation,
  showPageToast
}) => {
  const [coaches, setCoaches] = useState([]);
  const [coachAssignments, setCoachAssignments] = useState({});
  const [selectedCoachForAssignment, setSelectedCoachForAssignment] = useState(null);
  const [showCoachAssignmentModal, setShowCoachAssignmentModal] = useState(false);
  const [adminSidebarActive, setAdminSidebarActive] = useState('coaches');
  const [showDeleteGroupStep, setShowDeleteGroupStep] = useState(0);
  const [deleteGroupConfirmText, setDeleteGroupConfirmText] = useState('');
  const [memberToKick, setMemberToKick] = useState(null);
  const [showKickMemberConfirm, setShowKickMemberConfirm] = useState(false);

  const closeCoachAssignmentModal = () => {
    setShowCoachAssignmentModal(false);
    setSelectedCoachForAssignment(null);
  };

  const fetchCoaches = async () => {
    if (!isLeader) return;
    try {
      const response = await axios.get(`/groups/${groupId}/coaches`);
      setCoaches(response.data.coaches || []);

      const assignments = {};
      for (const coach of response.data.coaches || []) {
        try {
          const assignResponse = await axios.get(`/groups/${groupId}/coaches/${coach.id}/assignments`);
          assignments[coach.id] = assignResponse.data.students.map((student) => student.id);
        } catch (error) {
          console.error(`Error fetching assignments for coach ${coach.id}:`, error);
          assignments[coach.id] = [];
        }
      }
      setCoachAssignments(assignments);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    }
  };

  const handlePromoteToCoach = async (memberId) => {
    try {
      await axios.post(`/groups/${groupId}/coaches`, { memberId });
      await fetchCoaches();
      await fetchGroupDetails();
      showPageToast('success', 'Coach added');
    } catch (error) {
      console.error('Error promoting to coach:', error);
      showPageToast('error', 'Failed to promote member', error.response?.data?.error || 'Please try again.');
    }
  };

  const handleDemoteCoach = async (coachId) => {
    requestConfirmation({
      title: 'Remove Coach',
      message: 'Are you sure you want to remove this coach? Their student assignments will also be removed.',
      confirmLabel: 'Remove Coach',
      confirmClassName: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: async () => {
        try {
          await axios.delete(`/groups/${groupId}/coaches/${coachId}`);
          await fetchCoaches();
          await fetchGroupDetails();
          showPageToast('success', 'Coach removed');
        } catch (error) {
          console.error('Error demoting coach:', error);
          showPageToast('error', 'Failed to remove coach', error.response?.data?.error || 'Please try again.');
        }
      }
    });
  };

  const handleAssignStudents = async (coachId, studentIds) => {
    try {
      await axios.post(`/groups/${groupId}/coaches/${coachId}/assignments`, { studentIds });
      await fetchCoaches();
      closeCoachAssignmentModal();
      showPageToast('success', 'Student assignments saved');
    } catch (error) {
      console.error('Error assigning students:', error);
      showPageToast('error', 'Failed to assign students', error.response?.data?.error || 'Please try again.');
    }
  };

  const handleKickMember = async (memberId) => {
    try {
      await axios.delete(`/groups/${groupId}/members/${memberId}`);
      await fetchGroupDetails();
      setShowKickMemberConfirm(false);
      setMemberToKick(null);
      showPageToast('success', 'Member removed');
    } catch (error) {
      console.error('Error kicking member:', error);
      showPageToast('error', 'Failed to remove member', error.response?.data?.error || 'Please try again.');
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await axios.delete(`/groups/${groupId}`);
      navigate('/groups');
    } catch (error) {
      console.error('Error deleting group:', error);
      showPageToast('error', 'Failed to delete group', error.response?.data?.error || 'Please try again.');
      setShowDeleteGroupStep(0);
      setDeleteGroupConfirmText('');
    }
  };

  return {
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
    closeCoachAssignmentModal,
    fetchCoaches,
    handlePromoteToCoach,
    handleDemoteCoach,
    handleAssignStudents,
    handleKickMember,
    handleDeleteGroup
  };
};

export default useGroupAdmin;
