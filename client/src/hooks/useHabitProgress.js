import { useCallback } from 'react';
import axios from 'axios';

const useHabitProgress = ({
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
}) => {
  const withTicking = useCallback(async (habitIndex, action) => {
    setTicking((prev) => ({ ...prev, [habitIndex]: true }));
    try {
      await action();
    } finally {
      setTicking((prev) => ({ ...prev, [habitIndex]: false }));
    }
  }, [setTicking]);

  const handleToggleHabit = useCallback(async (habitIndex) => {
    if (!myMemberHabit) return;
    await withTicking(habitIndex, async () => {
      try {
        await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/toggle`, {});
        fetchGroupDetails();
      } catch (error) {
        showPageToast('error', 'Failed to update habit completion');
      }
    });
  }, [fetchGroupDetails, group, groupId, myMemberHabit, showPageToast, withTicking]);

  const handleNumericHabitUpdate = useCallback((habitIndex, value) => {
    setNumericValues((prev) => ({ ...prev, [habitIndex]: value }));
  }, [setNumericValues]);

  const handleNumericHabitSubmit = useCallback(async (habitIndex, value) => {
    if (!myMemberHabit || !value) return;
    await withTicking(habitIndex, async () => {
      try {
        await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/numeric`, { value });
        fetchGroupDetails();
      } catch (error) {
        showPageToast('error', 'Failed to update numeric habit');
      }
    });
  }, [fetchGroupDetails, group, groupId, myMemberHabit, showPageToast, withTicking]);

  const handleTextHabitUpdate = useCallback((habitIndex, value) => {
    setTextValues((prev) => ({ ...prev, [habitIndex]: value }));
  }, [setTextValues]);

  const handleTextHabitSubmit = useCallback(async (habitIndex, value) => {
    if (!myMemberHabit || !value?.trim()) return;
    await withTicking(habitIndex, async () => {
      try {
        await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/text`, {
          value: value.trim()
        });
        fetchGroupDetails();
        setEditingHabits((prev) => ({ ...prev, [habitIndex]: false }));
      } catch (error) {
        showPageToast('error', 'Failed to update text habit');
      }
    });
  }, [fetchGroupDetails, group, groupId, myMemberHabit, setEditingHabits, showPageToast, withTicking]);

  const handleStartEdit = useCallback((habitIndex, habit) => {
    setEditingHabits((prev) => ({ ...prev, [habitIndex]: true }));

    if (habit.habitType === 'numeric') {
      const today = new Date().toISOString().slice(0, 10);
      const progressEntry = (habit.progress || []).find((item) => item.date && item.date.slice(0, 10) === today);
      const currentValue = progressEntry?.numericValue !== undefined ? progressEntry.numericValue : (habit.minValue || 0);
      setTempNumericValues((prev) => ({ ...prev, [habitIndex]: currentValue }));
    } else if (habit.habitType === 'text') {
      const today = new Date().toISOString().slice(0, 10);
      const progressEntry = (habit.progress || []).find((item) => item.date && item.date.slice(0, 10) === today);
      const currentValue = progressEntry?.textValue || '';
      setTempTextValues((prev) => ({ ...prev, [habitIndex]: currentValue }));
    }
  }, [setEditingHabits, setTempNumericValues, setTempTextValues]);

  const handleCancelEdit = useCallback((habitIndex) => {
    setEditingHabits((prev) => ({ ...prev, [habitIndex]: false }));
    setTempNumericValues((prev) => {
      const next = { ...prev };
      delete next[habitIndex];
      return next;
    });
    setTempTextValues((prev) => {
      const next = { ...prev };
      delete next[habitIndex];
      return next;
    });
  }, [setEditingHabits, setTempNumericValues, setTempTextValues]);

  const handleTempNumericUpdate = useCallback((habitIndex, value) => {
    setTempNumericValues((prev) => ({ ...prev, [habitIndex]: value }));
  }, [setTempNumericValues]);

  const handleTempTextUpdate = useCallback((habitIndex, value) => {
    setTempTextValues((prev) => ({ ...prev, [habitIndex]: value }));
  }, [setTempTextValues]);

  const handleEditNumericSubmit = useCallback(async (habitIndex, value) => {
    if (!myMemberHabit || value === undefined) return;
    await withTicking(habitIndex, async () => {
      try {
        await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/numeric`, { value });
        fetchGroupDetails();
        setEditingHabits((prev) => ({ ...prev, [habitIndex]: false }));
      } catch (error) {
        showPageToast('error', 'Failed to update numeric habit');
      }
    });
  }, [fetchGroupDetails, group, groupId, myMemberHabit, setEditingHabits, showPageToast, withTicking]);

  const handleEditTextSubmit = useCallback(async (habitIndex, value) => {
    if (!myMemberHabit || !value?.trim()) return;
    await withTicking(habitIndex, async () => {
      try {
        await axios.post(`/groups/${groupId}/challenge/${group.activeChallenge.id}/habit/${habitIndex}/text`, {
          value: value.trim()
        });
        fetchGroupDetails();
        setEditingHabits((prev) => ({ ...prev, [habitIndex]: false }));
      } catch (error) {
        showPageToast('error', 'Failed to update text habit');
      }
    });
  }, [fetchGroupDetails, group, groupId, myMemberHabit, setEditingHabits, showPageToast, withTicking]);

  return {
    handleToggleHabit,
    handleNumericHabitUpdate,
    handleNumericHabitSubmit,
    handleTextHabitUpdate,
    handleTextHabitSubmit,
    handleStartEdit,
    handleCancelEdit,
    handleTempNumericUpdate,
    handleTempTextUpdate,
    handleEditNumericSubmit,
    handleEditTextSubmit
  };
};

export default useHabitProgress;
