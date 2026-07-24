import { useEffect, useState } from 'react';
import axios from 'axios';

const useGroupSettings = ({ group, groupId, setGroup, showPageToast }) => {
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isEditingGroupType, setIsEditingGroupType] = useState(false);
  const [newGroupType, setNewGroupType] = useState('school');

  useEffect(() => {
    if (group?.groupType) {
      setNewGroupType(group.groupType);
    }
  }, [group?.groupType]);

  const handleEditGroupName = () => {
    setNewGroupName(group?.name || '');
    setIsEditingGroupName(true);
  };

  const handleSaveGroupName = async () => {
    if (!newGroupName.trim()) {
      showPageToast('error', 'Group name required', 'Group name cannot be empty.');
      return;
    }

    try {
      await axios.put(`/groups/${groupId}`, { name: newGroupName });
      setGroup((prev) => ({ ...prev, name: newGroupName }));
      setIsEditingGroupName(false);
      showPageToast('success', 'Group name updated');
    } catch (error) {
      console.error('Error updating group name:', error);
      showPageToast('error', 'Failed to update group name');
    }
  };

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
      showPageToast('error', 'Group type locked', 'Cannot change group type while a challenge is active.');
      return;
    }

    try {
      await axios.put(`/groups/${groupId}`, { groupType: newGroupType });
      setGroup((prev) => (prev ? { ...prev, groupType: newGroupType } : prev));
      setIsEditingGroupType(false);
      showPageToast('success', 'Group type updated');
    } catch (error) {
      console.error('Error updating group type:', error);
      showPageToast('error', 'Failed to update group type');
    }
  };

  const handleCancelEditGroupType = () => {
    setIsEditingGroupType(false);
    setNewGroupType(group?.groupType || 'school');
  };

  return {
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
  };
};

export default useGroupSettings;
