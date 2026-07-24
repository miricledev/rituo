export const DEFAULT_SCHEDULE_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export const createEmptyCurrentHabit = () => ({
  name: '',
  description: '',
  habitType: 'boolean',
  minValue: 0,
  maxValue: 10,
  prompt: '',
  assignedMembers: [],
  applyToAll: false,
  scheduleDays: [...DEFAULT_SCHEDULE_DAYS],
  durationMinutes: 30,
  combatType: 'neutral',
  linkedGoalIds: {}
});

export const createEmptyPresetFormData = () => ({
  name: '',
  habits: []
});

export const createEmptyPresetHabit = () => ({
  name: '',
  description: '',
  habitType: 'boolean',
  minValue: 0,
  maxValue: 10,
  prompt: '',
  scheduleDays: [...DEFAULT_SCHEDULE_DAYS],
  durationMinutes: 30,
  combatType: 'neutral'
});
