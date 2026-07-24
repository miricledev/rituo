import { useState } from 'react';
import axios from 'axios';
import {
  createEmptyPresetFormData,
  createEmptyPresetHabit
} from '../utils/groupDetailDefaults';

const useHabitPresets = ({
  requestConfirmation,
  showPageToast
}) => {
  const [habitPresets, setHabitPresets] = useState([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [presetFormData, setPresetFormData] = useState(createEmptyPresetFormData);

  const closePresetModal = () => {
    setShowPresetModal(false);
    setPresetFormData(createEmptyPresetFormData());
    setEditingPresetId(null);
  };

  const fetchPresets = async () => {
    try {
      const response = await axios.get('/groups/habit-presets');
      setHabitPresets(response.data.presets || []);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const handleCreatePreset = () => {
    setPresetFormData(createEmptyPresetFormData());
    setEditingPresetId(null);
    setShowPresetModal(true);
  };

  const handleEditPreset = (presetId) => {
    const preset = habitPresets.find((item) => item.id === presetId);
    if (!preset) return;

    setPresetFormData({
      name: preset.name,
      habits: preset.habits
    });
    setEditingPresetId(presetId);
    setShowPresetModal(true);
  };

  const handleDeletePreset = (presetId) => {
    requestConfirmation({
      title: 'Delete Preset',
      message: 'Are you sure you want to delete this preset?',
      confirmLabel: 'Delete Preset',
      confirmClassName: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: async () => {
        try {
          await axios.delete(`/groups/habit-presets/${presetId}`);
          await fetchPresets();
          showPageToast('success', 'Preset deleted');
        } catch (error) {
          console.error('Error deleting preset:', error);
          showPageToast('error', 'Failed to delete preset', 'Please try again.');
        }
      }
    });
  };

  const handleSavePreset = async () => {
    if (!presetFormData.name.trim()) {
      showPageToast('error', 'Preset name required', 'Please enter a preset name.');
      return;
    }
    if (presetFormData.habits.length === 0) {
      showPageToast('error', 'No habits added', 'Please add at least one habit to the preset.');
      return;
    }

    const habitsWithoutSchedule = presetFormData.habits.filter(
      (habit) => !habit.scheduleDays || habit.scheduleDays.length === 0
    );
    if (habitsWithoutSchedule.length > 0) {
      showPageToast('error', 'Schedule days missing', 'Please select at least one schedule day for all habits.');
      return;
    }

    try {
      if (editingPresetId) {
        await axios.put(`/groups/habit-presets/${editingPresetId}`, {
          name: presetFormData.name,
          habits: presetFormData.habits
        });
      } else {
        await axios.post('/groups/habit-presets', {
          name: presetFormData.name,
          habits: presetFormData.habits
        });
      }

      await fetchPresets();
      closePresetModal();
      showPageToast('success', editingPresetId ? 'Preset updated' : 'Preset saved');
    } catch (error) {
      console.error('Error saving preset:', error);
      showPageToast('error', 'Failed to save preset', 'Please try again.');
    }
  };

  const handleAddPresetHabit = () => {
    setPresetFormData((current) => ({
      ...current,
      habits: [...current.habits, createEmptyPresetHabit()]
    }));
  };

  const handleUpdatePresetHabit = (index, field, value) => {
    setPresetFormData((current) => {
      const updatedHabits = [...current.habits];
      updatedHabits[index] = {
        ...updatedHabits[index],
        [field]: value
      };

      return {
        ...current,
        habits: updatedHabits
      };
    });
  };

  const handleRemovePresetHabit = (index) => {
    setPresetFormData((current) => ({
      ...current,
      habits: current.habits.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  return {
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
  };
};

export default useHabitPresets;
