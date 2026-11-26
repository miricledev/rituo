import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import InlineToast from './InlineToast';
import { getDeviceTimezone, syncDeviceTimezone } from '../utils/deviceTimezone';

const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 23 * 60;
const PERIODIC_DAY_START_MINUTES = 7 * 60;
const PERIODIC_DAY_END_MINUTES = 22 * 60;
const DEFAULT_WAKE_TIME = '07:00';
const DEFAULT_BEDTIME = '22:00';
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_ROUTINE_DRAFT = {
  title: '',
  startTime: '07:30',
  endTime: '08:15',
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
};
const PIXELS_PER_HOUR = 72;
const CALENDAR_HEIGHT = ((DAY_END_MINUTES - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR;
const clonePlannerData = (value) => JSON.parse(JSON.stringify(value));
const isRoutineOverride = (item) => item?.itemType === 'routine' && (
  item.routineOverride || item.source === 'routine-override'
);
const persistableScheduleItems = (items = []) => items.filter(
  (item) => item.itemType !== 'google' && (item.itemType !== 'routine' || isRoutineOverride(item))
);
const comparableSchedulePlan = (plan = {}) => ({
  constraintsText: plan.constraintsText || '',
  items: persistableScheduleItems(plan.items).filter(
    (item) => !['school', 'sleep', 'google'].includes(item.itemType)
  )
});

const removeBreaksDuplicatingFixedEvents = (items = []) => {
  const fixedTypes = new Set(['google', 'manual', 'routine', 'school', 'sleep']);
  const fixedRanges = items
    .filter((item) => fixedTypes.has(item.itemType))
    .map((item) => ({
      start: timeToMinutes(item.startTime, -1),
      end: timeToMinutes(item.endTime, -1)
    }))
    .filter((range) => range.start >= 0 && range.end > range.start);
  return items.filter((item) => {
    if (item.itemType !== 'break') return true;
    const start = timeToMinutes(item.startTime, -1);
    const end = timeToMinutes(item.endTime, -1);
    return !fixedRanges.some((range) => start < range.end && end > range.start);
  });
};

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const toLocalIso = (date) => new Date(
  date.getTime() - date.getTimezoneOffset() * 60000
).toISOString().slice(0, 10);

const addCalendarMonths = (dateIso, months) => {
  const date = new Date(`${dateIso}T12:00:00`);
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return toLocalIso(date);
};

const clampIsoDate = (dateIso, minimumDate, maximumDate) => (
  dateIso < minimumDate ? minimumDate : dateIso > maximumDate ? maximumDate : dateIso
);

const getWeekDates = (dateIso) => {
  const selected = new Date(`${dateIso}T12:00:00`);
  const monday = new Date(selected);
  const day = selected.getDay();
  monday.setDate(selected.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      date: toLocalIso(date),
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      shortWeekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayLabel: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    };
  });
};

const normalizePlannerDateWithinBounds = (dateIso, minimumDate, maximumDate) => (
  clampIsoDate(dateIso, minimumDate, maximumDate)
);

const applyHabitCompletionState = (items, completionWindows = {}) => {
  const occurrenceIndexes = new Map();
  return (items || []).map((item) => {
    if (item.itemType !== 'habit' || Number(item.habitIndex) < 0) return item;
    const habitKey = String(item.habitIndex);
    const occurrenceIndex = occurrenceIndexes.get(habitKey) || 0;
    occurrenceIndexes.set(habitKey, occurrenceIndex + 1);
    const completionAccess = completionWindows[habitKey] || {};
    const occurrenceWindow = (completionAccess.windows || []).find(
      (window) => Number(window.occurrenceIndex) === occurrenceIndex
    );
    return {
      ...item,
      completed: completionAccess.status === 'completed' || Boolean(occurrenceWindow?.logged),
      completionStatus: completionAccess.status || 'unknown'
    };
  });
};

const timeToMinutes = (time, fallback = DAY_START_MINUTES) => {
  const [hour, minute] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  return (hour * 60) + minute;
};

const minutesToTime = (minutes) => {
  const safeMinutes = Math.min(23 * 60 + 59, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, '0')}:${String(safeMinutes % 60).padStart(2, '0')}`;
};

const formatTime = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const minutesBetween = (startTime, endTime) => Math.max(
  5,
  timeToMinutes(endTime, DAY_END_MINUTES) - timeToMinutes(startTime, DAY_START_MINUTES)
);

const formatDuration = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes ? ` ${minutes}m` : ''}`;
};

const getOvernightMinutes = (bedtime, wakeTime) => (
  (24 * 60) - timeToMinutes(bedtime, 22 * 60) + timeToMinutes(wakeTime, 7 * 60)
);

const addMinutes = (time, minutes) => minutesToTime(
  timeToMinutes(time, 16 * 60) + Number(minutes || 30)
);

const buildPeriodicOccurrenceTimes = (habit) => {
  const occurrences = Math.max(2, Number(habit.periodicOccurrences) || 4);
  const requestedInterval = Math.max(30, (Number(habit.periodicIntervalHours) || 4) * 60);
  const availableMinutes = PERIODIC_DAY_END_MINUTES - PERIODIC_DAY_START_MINUTES;
  const maximumInterval = Math.floor(availableMinutes / Math.max(1, occurrences - 1));
  const intervalMinutes = Math.min(requestedInterval, maximumInterval);
  const requestedStart = timeToMinutes(habit.scheduleTime, 8 * 60);
  const latestStart = PERIODIC_DAY_END_MINUTES - (intervalMinutes * (occurrences - 1));
  const startMinutes = Math.min(
    Math.max(PERIODIC_DAY_START_MINUTES, requestedStart),
    Math.max(PERIODIC_DAY_START_MINUTES, latestStart)
  );

  return Array.from({ length: occurrences }, (_, index) => (
    minutesToTime(startMinutes + (index * intervalMinutes))
  ));
};

const buildSleepItems = (wakeTime = DEFAULT_WAKE_TIME, bedtime = DEFAULT_BEDTIME) => ([
  {
    id: 'sleep-morning',
    title: 'Sleep',
    itemType: 'sleep',
    habitIndex: -1,
    startTime: '06:00',
    endTime: wakeTime,
    durationMinutes: minutesBetween('06:00', wakeTime),
    locked: true,
    allowOverlap: false,
    reason: `Wake up at ${wakeTime}`,
    source: 'sleep'
  },
  {
    id: 'sleep-evening',
    title: 'Sleep',
    itemType: 'sleep',
    habitIndex: -1,
    startTime: bedtime,
    endTime: '23:00',
    durationMinutes: minutesBetween(bedtime, '23:00'),
    locked: true,
    allowOverlap: false,
    reason: `Bedtime at ${bedtime}`,
    source: 'sleep'
  }
]);

const buildRoutineItems = (targetWeekday, reminders = [], targetDate = todayIso()) => reminders
  .filter((reminder) => (
    (reminder.weekdays || []).includes(targetWeekday)
    && targetDate >= String(reminder.createdDate || todayIso()).slice(0, 10)
  ))
  .map((reminder) => ({
    id: `routine-${reminder.id}`,
    routineId: reminder.id,
    title: reminder.title,
    itemType: 'routine',
    habitIndex: -1,
    startTime: reminder.startTime,
    endTime: reminder.endTime,
    durationMinutes: minutesBetween(reminder.startTime, reminder.endTime),
    locked: false,
    allowOverlap: false,
    routineOverride: false,
    reason: 'Your weekly reminder · Drag to adjust only this date',
    source: 'routine'
  }));

const mergeRoutineOverrides = (routineItems, savedItems = []) => {
  const overridesByRoutine = new Map(
    savedItems
      .filter(isRoutineOverride)
      .map((item) => [String(item.routineId), item])
  );
  return routineItems.map((item) => {
    const override = overridesByRoutine.get(String(item.routineId));
    if (!override) return item;
    return {
      ...item,
      ...override,
      id: item.id,
      routineId: item.routineId,
      itemType: 'routine',
      locked: false,
      routineOverride: true,
      source: 'routine-override',
      reason: 'Adjusted for this date · Click to change every occurrence'
    };
  });
};

const itemStyles = {
  school: 'border-blue-500 bg-blue-100 text-blue-950 dark:border-blue-400 dark:bg-blue-500/25 dark:text-blue-50',
  habit: 'border-violet-500 bg-violet-100 text-violet-950 dark:border-violet-400 dark:bg-violet-500/25 dark:text-violet-50',
  manual: 'border-orange-500 bg-orange-100 text-orange-950 dark:border-orange-400 dark:bg-orange-500/25 dark:text-orange-50',
  break: 'border-emerald-500 bg-emerald-100 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-500/25 dark:text-emerald-50',
  sleep: 'border-yellow-500 bg-yellow-100 text-yellow-950 dark:border-yellow-300 dark:bg-yellow-400/25 dark:text-yellow-50',
  routine: 'border-teal-500 bg-teal-100 text-teal-950 dark:border-teal-300 dark:bg-teal-400/25 dark:text-teal-50',
  google: 'border-sky-500 bg-sky-100 text-sky-950 dark:border-sky-300 dark:bg-sky-400/25 dark:text-sky-50'
};

const buildOverlapLayout = (dayItems) => {
  const layout = new Map();
  const sortedItems = [...dayItems]
    .map((item) => ({
      item,
      start: timeToMinutes(item.startTime, DAY_START_MINUTES),
      end: timeToMinutes(item.endTime, DAY_END_MINUTES)
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const clusters = [];
  let activeCluster = [];
  let clusterEnd = -1;

  sortedItems.forEach((entry) => {
    if (activeCluster.length && entry.start >= clusterEnd) {
      clusters.push(activeCluster);
      activeCluster = [];
      clusterEnd = -1;
    }
    activeCluster.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.end);
  });
  if (activeCluster.length) clusters.push(activeCluster);

  clusters.forEach((cluster) => {
    const columnEnds = [];
    const placements = cluster.map((entry) => {
      let column = columnEnds.findIndex((end) => end <= entry.start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = entry.end;
      return { id: entry.item.id, column };
    });
    const totalColumns = Math.max(1, columnEnds.length);
    placements.forEach(({ id, column }) => layout.set(id, { column, totalColumns }));
  });

  return layout;
};

const DailyHabitPlanner = ({
  groupId,
  profile,
  canEdit,
  schoolTimetable = [],
  schoolDayConfig = {},
  activeChallenge = null,
  challengeMember = null,
  workspaceType = 'school',
  readOnlyPreview = false,
  onSaved
}) => {
  const isFootballWorkspace = workspaceType === 'football';
  const isStaffWorkspace = workspaceType === 'staff';
  const schoolTimetableKey = JSON.stringify(schoolTimetable || []);
  const schoolDayConfigKey = JSON.stringify(schoolDayConfig || {});
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [weekPlans, setWeekPlans] = useState({});
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState([]);
  const [clarificationAnswers, setClarificationAnswers] = useState({});
  const [aiFrequency, setAiFrequency] = useState('once');
  const [aiDayMode, setAiDayMode] = useState('selected');
  const [aiCustomWeekdays, setAiCustomWeekdays] = useState(['Monday']);
  const [aiProgress, setAiProgress] = useState('');
  const [showSleepTips, setShowSleepTips] = useState(false);
  const [plannerSettings, setPlannerSettings] = useState({
    wakeTime: DEFAULT_WAKE_TIME,
    bedtime: DEFAULT_BEDTIME,
    schoolCommuteMinutes: 0,
    recurringReminders: [],
    aiWeeklyTemplates: {},
    googleCalendarConnected: false,
    googleCalendarConfigured: false,
    googleCalendarNeedsReconnect: false,
    googleCalendarHiddenEventCount: 0
  });
  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [routineDraft, setRoutineDraft] = useState(DEFAULT_ROUTINE_DRAFT);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);
  const [googleCleanupProgress, setGoogleCleanupProgress] = useState(null);
  const [lastGoogleSyncAt, setLastGoogleSyncAt] = useState(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const googlePopupRef = useRef(null);
  const googlePollingRef = useRef(false);
  const googleDisconnectingRef = useRef(false);
  const googleInitialPushRef = useRef(false);
  const lastAutoSaveAttemptRef = useRef(0);
  const [draggedId, setDraggedId] = useState(null);
  const [draggedDate, setDraggedDate] = useState(null);
  const [dragOffsetMinutes, setDragOffsetMinutes] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [toast, setToast] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const dirtyRef = useRef(false);
  const pendingLeaveRef = useRef(null);
  const savedSnapshotRef = useRef(null);

  const deviceToday = todayIso();
  const accountCreationDate = useMemo(() => {
    const rawCreatedAt = profile?.student?.created_at || profile?.student?.createdAt;
    const createdAt = rawCreatedAt ? new Date(rawCreatedAt) : null;
    return createdAt && !Number.isNaN(createdAt.getTime()) ? toLocalIso(createdAt) : deviceToday;
  }, [profile?.student?.created_at, profile?.student?.createdAt]);
  const challengeStartDate = String(activeChallenge?.startDate || '').slice(0, 10);
  const challengeEndDate = String(activeChallenge?.endDate || '').slice(0, 10);
  const challengeJoinedDate = String(challengeMember?.joinedAt || '').slice(0, 10);
  const habitStartDates = [challengeStartDate, challengeJoinedDate].filter(Boolean).sort();
  const habitStartDate = habitStartDates[habitStartDates.length - 1] || '';
  const isHabitChallengeDate = (dateIso) => (
    (!habitStartDate || dateIso >= habitStartDate)
    && (!challengeEndDate || dateIso <= challengeEndDate)
  );
  const hasChallengeOnDate = (dateIso) => Boolean(
    activeChallenge && isHabitChallengeDate(dateIso)
  );
  const latestPlannerDate = addCalendarMonths(deviceToday, 1);
  const oneMonthAgo = addCalendarMonths(deviceToday, -1);
  const earliestPlannerDate = accountCreationDate > oneMonthAgo ? accountCreationDate : oneMonthAgo;
  const isPlannerDateAvailable = (dateIso) => (
    dateIso >= earliestPlannerDate && dateIso <= latestPlannerDate
  );
  const isPlannerDateEditable = (dateIso) => (
    isPlannerDateAvailable(dateIso) && dateIso >= deviceToday
  );
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const weekKey = weekDates.map((day) => day.date).join('|');
  const currentWeekStart = weekDates[0]?.date;
  const earliestWeekStart = getWeekDates(earliestPlannerDate)[0]?.date;
  const latestWeekStart = getWeekDates(latestPlannerDate)[0]?.date;
  const canViewPreviousWeek = currentWeekStart > earliestWeekStart;
  const canViewNextWeek = currentWeekStart < latestWeekStart;
  const selectedPlan = weekPlans[selectedDate] || { items: [], constraintsText: '' };
  const items = selectedPlan.items;
  const constraintsText = selectedPlan.constraintsText;
  const selectedDateEditable = isPlannerDateEditable(selectedDate);
  const wakeTime = plannerSettings.wakeTime || DEFAULT_WAKE_TIME;
  const bedtime = plannerSettings.bedtime || DEFAULT_BEDTIME;
  const schoolCommuteMinutes = Math.max(0, Number(plannerSettings.schoolCommuteMinutes) || 0);
  const hasSchoolDayConfig = !isFootballWorkspace
    && !isStaffWorkspace
    && /^\d{2}:\d{2}$/.test(schoolDayConfig?.startTime || '')
    && /^\d{2}:\d{2}$/.test(schoolDayConfig?.endTime || '')
    && schoolDayConfig.startTime < schoolDayConfig.endTime;
  const sleepDurationMinutes = getOvernightMinutes(bedtime, wakeTime);
  const recommendedSleepMinimum = 8 * 60;
  const recommendedSleepMaximum = 10 * 60;
  const sleepComparison = sleepDurationMinutes < recommendedSleepMinimum
    ? `${formatDuration(recommendedSleepMinimum - sleepDurationMinutes)} below the recommended minimum`
    : sleepDurationMinutes > recommendedSleepMaximum
      ? `${formatDuration(sleepDurationMinutes - recommendedSleepMaximum)} above the recommended range`
      : `${formatDuration(sleepDurationMinutes - recommendedSleepMinimum)} above the minimum and ${formatDuration(recommendedSleepMaximum - sleepDurationMinutes)} below the upper end`;
  const sleepStatus = sleepDurationMinutes < recommendedSleepMinimum
    ? 'short'
    : sleepDurationMinutes > recommendedSleepMaximum
      ? 'long'
      : 'recommended';

  useEffect(() => {
    setClarificationQuestions([]);
    setClarificationAnswers({});
    setAiProgress('');
  }, [selectedDate, aiFrequency, aiDayMode, aiCustomWeekdays]);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(new Date());
    updateCurrentTime();
    const timer = window.setInterval(updateCurrentTime, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const boundedDate = normalizePlannerDateWithinBounds(
      selectedDate,
      earliestPlannerDate,
      latestPlannerDate
    );
    if (boundedDate !== selectedDate && !dirtyRef.current) setSelectedDate(boundedDate);
  }, [earliestPlannerDate, latestPlannerDate, selectedDate]);

  const setItems = (updater, targetDate = selectedDate) => {
    setWeekPlans((previous) => {
      const currentPlan = previous[targetDate] || { items: [], constraintsText: '' };
      const nextItems = typeof updater === 'function' ? updater(currentPlan.items) : updater;
      return {
        ...previous,
        [targetDate]: {
          ...currentPlan,
          items: nextItems
        }
      };
    });
  };

  const setConstraintsText = (value) => {
    if (!isPlannerDateEditable(selectedDate)) return;
    setIsDirty(true);
    setWeekPlans((previous) => ({
      ...previous,
      [selectedDate]: {
        ...(previous[selectedDate] || { items: [] }),
        constraintsText: typeof value === 'function'
          ? value(previous[selectedDate]?.constraintsText || '')
          : value
      }
    }));
  };

  const weekday = useMemo(
    () => new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    [selectedDate]
  );

  const aiTargetWeekdays = useMemo(() => {
    if (aiDayMode === 'school-week') return WEEKDAYS.slice(0, 5);
    if (aiDayMode === 'full-week') return WEEKDAYS;
    if (aiDayMode === 'custom') return aiCustomWeekdays;
    return [weekday];
  }, [aiCustomWeekdays, aiDayMode, weekday]);
  const aiTargetDays = useMemo(
    () => weekDates.filter((day) => (
      aiTargetWeekdays.includes(day.weekday) && isPlannerDateEditable(day.date)
    )),
    [aiTargetWeekdays, earliestPlannerDate, latestPlannerDate, weekKey]
  );
  const aiScopeSummary = aiFrequency === 'weekly'
    ? `Every ${aiTargetWeekdays.map((day) => day.slice(0, 3)).join(', ')}`
    : aiTargetDays.map((day) => `${day.shortWeekday} ${day.dayLabel}`).join(', ');

  const getScheduledHabits = (targetWeekday, targetDate = selectedDate) => (
    isHabitChallengeDate(targetDate) ? (profile?.linkedHabits || []).filter((habit) => {
      const days = habit.scheduleDays || [];
      return !days.length || days.includes(targetWeekday);
    }) : []
  );

  const scheduledHabits = getScheduledHabits(weekday, selectedDate);
  const aiHasScheduledHabits = aiTargetDays.some(
    (targetDay) => getScheduledHabits(targetDay.weekday, targetDay.date).length > 0
  );

  const isConfiguredSchoolDay = (targetWeekday) => hasSchoolDayConfig && (
    WEEKDAYS.slice(0, 5).includes(targetWeekday)
    || schoolTimetable.some((entry) => entry.weekday === targetWeekday)
  );

  const buildSchoolCommuteItems = (targetWeekday, settings = plannerSettings) => {
    const commuteMinutes = Math.max(0, Math.min(180, Number(settings.schoolCommuteMinutes) || 0));
    if (!isConfiguredSchoolDay(targetWeekday) || !commuteMinutes) return [];
    return [
      {
        id: 'school-commute-in',
        title: 'Travel to school',
        itemType: 'school',
        habitIndex: -1,
        startTime: addMinutes(schoolDayConfig.startTime, -commuteMinutes),
        endTime: schoolDayConfig.startTime,
        durationMinutes: commuteMinutes,
        locked: true,
        reason: `${commuteMinutes} minute school commute`,
        source: 'school-commute'
      },
      {
        id: 'school-commute-home',
        title: 'Travel home',
        itemType: 'school',
        habitIndex: -1,
        startTime: schoolDayConfig.endTime,
        endTime: addMinutes(schoolDayConfig.endTime, commuteMinutes),
        durationMinutes: commuteMinutes,
        locked: true,
        reason: `${commuteMinutes} minute school commute`,
        source: 'school-commute'
      }
    ];
  };

  const buildDefaultItems = (
    targetWeekday = weekday,
    settings = plannerSettings,
    targetDate = selectedDate
  ) => {
    const schoolItems = schoolTimetable
      .filter((entry) => entry.weekday === targetWeekday)
      .filter((entry) => {
        const studentIds = (entry.studentIds || []).map(Number);
        return !studentIds.length || studentIds.includes(Number(profile?.student?.id));
      })
      .map((entry) => ({
        id: `school-${entry.id}`,
        title: [entry.subject || 'School', entry.className].filter(Boolean).join(' · '),
        itemType: 'school',
        habitIndex: -1,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationMinutes: minutesBetween(entry.startTime, entry.endTime),
        locked: true,
        reason: [entry.teacherName, entry.room].filter(Boolean).join(' · ') || 'School timetable',
        source: 'school'
      }));
    const schoolCommuteItems = buildSchoolCommuteItems(targetWeekday, settings);

    const habitItems = getScheduledHabits(targetWeekday, targetDate).flatMap((habit, fallbackIndex) => {
      const habitIndex = Number.isInteger(habit.index) ? habit.index : fallbackIndex;
      const isPeriodic = habit.habitType === 'periodic';
      const baseTime = habit.scheduleTime || (isPeriodic ? '08:00' : addMinutes('16:00', fallbackIndex * 45));
      const occurrenceTimes = isPeriodic ? buildPeriodicOccurrenceTimes(habit) : [baseTime];

      return occurrenceTimes.map((startTime, occurrenceIndex) => {
        return {
          id: `habit-${habitIndex}-${occurrenceIndex}`,
          title: habit.name || `Habit ${fallbackIndex + 1}`,
          itemType: 'habit',
          habitIndex,
          startTime,
          endTime: addMinutes(startTime, habit.durationMinutes || 30),
          durationMinutes: Number(habit.durationMinutes) || 30,
          locked: false,
          allowOverlap: isPeriodic && !!habit.allowOverlap,
          reason: isPeriodic ? `Periodic occurrence ${occurrenceIndex + 1} of ${occurrenceTimes.length}` : 'Habit target',
          source: 'default'
        };
      });
    });

    const scheduledHabitIndexes = new Set(
      getScheduledHabits(targetWeekday, targetDate).map((habit, fallbackIndex) => (
        Number.isInteger(habit.index) ? habit.index : fallbackIndex
      ))
    );
    const weeklyTemplateItems = (settings.aiWeeklyTemplates?.[targetWeekday] || [])
      .filter((item) => item.itemType === 'break' || (
        item.itemType === 'habit' && scheduledHabitIndexes.has(Number(item.habitIndex))
      ))
      .map((item, itemIndex) => ({
        ...item,
        id: `weekly-ai-${targetWeekday}-${item.itemType}-${item.habitIndex ?? -1}-${itemIndex}`,
        locked: false,
        source: 'weekly-ai'
      }));
    const templatedHabitIndexes = new Set(
      weeklyTemplateItems
        .filter((item) => item.itemType === 'habit')
        .map((item) => Number(item.habitIndex))
    );
    const untemplatedHabitItems = habitItems.filter(
      (item) => !templatedHabitIndexes.has(Number(item.habitIndex))
    );
    const plannedHabitItems = templatedHabitIndexes.size
      ? [...weeklyTemplateItems, ...untemplatedHabitItems]
      : habitItems;
    const routineItems = buildRoutineItems(targetWeekday, settings.recurringReminders || [], targetDate);

    return [
      ...buildSleepItems(settings.wakeTime || DEFAULT_WAKE_TIME, settings.bedtime || DEFAULT_BEDTIME),
      ...schoolCommuteItems,
      ...schoolItems,
      ...routineItems,
      ...plannedHabitItems
    ]
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
  };

  const repairSavedPeriodicItems = (savedItems, defaultItems, targetWeekday, targetDate) => {
    const scheduledHabitIndexes = new Set(
      getScheduledHabits(targetWeekday, targetDate).map((habit, fallbackIndex) => (
        Number.isInteger(habit.index) ? Number(habit.index) : fallbackIndex
      ))
    );
    let repairedItems = savedItems.filter((item) => (
      item.itemType !== 'habit' || scheduledHabitIndexes.has(Number(item.habitIndex))
    ));

    getScheduledHabits(targetWeekday, targetDate).forEach((habit, fallbackIndex) => {
      if (habit.habitType !== 'periodic') return;
      const habitIndex = Number.isInteger(habit.index) ? habit.index : fallbackIndex;
      const expectedOccurrences = Math.max(2, Number(habit.periodicOccurrences) || 4);
      const matchingItems = repairedItems.filter(
        (item) => item.itemType === 'habit' && Number(item.habitIndex) === Number(habitIndex)
      );
      const uniqueTimes = new Set(matchingItems.map((item) => item.startTime));
      const hasInvalidTime = matchingItems.some((item) => {
        const startMinutes = timeToMinutes(item.startTime, -1);
        return startMinutes < PERIODIC_DAY_START_MINUTES || startMinutes > PERIODIC_DAY_END_MINUTES;
      });
      const needsRepair = matchingItems.length !== expectedOccurrences
        || uniqueTimes.size !== matchingItems.length
        || hasInvalidTime;

      if (!needsRepair) return;
      repairedItems = repairedItems.filter(
        (item) => !(item.itemType === 'habit' && Number(item.habitIndex) === Number(habitIndex))
      );
      repairedItems.push(...defaultItems.filter(
        (item) => item.itemType === 'habit' && Number(item.habitIndex) === Number(habitIndex)
      ));
    });

    return repairedItems.sort((left, right) => left.startTime.localeCompare(right.startTime));
  };

  useEffect(() => {
    if (!groupId || !profile?.student?.id) return;
    if (dirtyRef.current) return;
    let cancelled = false;

    const loadPlans = async () => {
      try {
        setLoadingPlan(true);
        setSelectedItemId(null);
        savedSnapshotRef.current = null;
        let settingsPayload = {
          wakeTime: DEFAULT_WAKE_TIME,
          bedtime: DEFAULT_BEDTIME,
          schoolCommuteMinutes: 0,
          timezone: getDeviceTimezone(),
          recurringReminders: [],
          aiWeeklyTemplates: {},
          googleCalendarConnected: false,
          googleCalendarConfigured: false,
          googleCalendarNeedsReconnect: false,
          googleCalendarHiddenEventCount: 0
        };
        try {
          const settingsEndpoint = `/groups/${groupId}/students/${profile.student.id}/${readOnlyPreview ? 'preview' : 'planner-settings'}`;
          const settingsResponse = await axios.get(settingsEndpoint);
          const savedSettings = { ...settingsPayload, ...(settingsResponse.data?.settings || {}) };
          settingsPayload = readOnlyPreview ? savedSettings : await syncDeviceTimezone(axios, settingsEndpoint, savedSettings);
        } catch (_error) {
          settingsPayload = { ...settingsPayload };
        }
        if (cancelled) return;
        let googleEventsByDate = {};
        let googleEventsFailed = false;
        if (settingsPayload.googleCalendarConnected) {
          const availableDays = weekDates.filter((day) => isPlannerDateAvailable(day.date));
          if (availableDays.length) {
            try {
              const googleResponse = await axios.get(`/groups/${groupId}/students/${profile.student.id}/google-calendar/events`, {
                params: {
                  start: availableDays[0].date,
                  end: availableDays[availableDays.length - 1].date
                }
              });
              googleEventsByDate = (googleResponse.data?.events || []).reduce((accumulator, event) => {
                const eventDate = event.date;
                if (!eventDate) return accumulator;
                if (!accumulator[eventDate]) accumulator[eventDate] = [];
                accumulator[eventDate].push(event);
                return accumulator;
              }, {});
              settingsPayload = {
                ...settingsPayload,
                googleCalendarHiddenEventCount: googleResponse.data?.hiddenCount || 0,
                googleCalendarNeedsReconnect: Boolean(googleResponse.data?.needsReconnect)
              };
            } catch (_error) {
              googleEventsFailed = true;
            }
          }
        }
        if (cancelled) return;
        const results = await Promise.all(weekDates.map(async (day) => {
          if (!isPlannerDateAvailable(day.date)) {
            return {
              date: day.date,
              plan: { constraintsText: '', items: [], unavailable: true },
              failed: false
            };
          }
          const defaultItems = buildDefaultItems(day.weekday, settingsPayload, day.date);
          const googleItems = googleEventsByDate[day.date] || [];
          try {
            const response = await axios.get(`/groups/${groupId}/students/${profile.student.id}/schedule`, {
              params: { date: day.date }
            });
            const plan = response.data?.plan;
            const currentSchoolItems = defaultItems.filter((item) => item.itemType === 'school');
            const currentSleepItems = defaultItems.filter((item) => item.itemType === 'sleep');
            const currentRoutineItems = defaultItems.filter((item) => item.itemType === 'routine');
            const routineItems = mergeRoutineOverrides(currentRoutineItems, plan?.items || []);
            const savedPersonalItems = repairSavedPeriodicItems(
              (plan?.items || []).filter((item) => !['school', 'sleep', 'routine'].includes(item.itemType)),
              defaultItems,
              day.weekday,
              day.date
            );
            const mergedItems = removeBreaksDuplicatingFixedEvents(plan?.items?.length
              ? [...currentSchoolItems, ...currentSleepItems, ...routineItems, ...savedPersonalItems, ...googleItems]
                .sort((left, right) => left.startTime.localeCompare(right.startTime))
              : [...defaultItems, ...googleItems].sort((left, right) => left.startTime.localeCompare(right.startTime)));
            return {
              date: day.date,
              plan: {
                constraintsText: plan?.constraintsText || '',
                items: applyHabitCompletionState(
                  mergedItems,
                  response.data?.completionWindows || {}
                )
              },
              failed: false
            };
          } catch (_error) {
            return {
              date: day.date,
              plan: { constraintsText: '', items: [...defaultItems, ...googleItems].sort((left, right) => left.startTime.localeCompare(right.startTime)) },
              failed: true
            };
          }
        }));
        if (cancelled) return;
        const loadedWeekPlans = Object.fromEntries(results.map((result) => [result.date, result.plan]));
        setPlannerSettings(settingsPayload);
        setWeekPlans(loadedWeekPlans);
        savedSnapshotRef.current = {
          plannerSettings: clonePlannerData(settingsPayload),
          weekPlans: clonePlannerData(loadedWeekPlans)
        };
        dirtyRef.current = false;
        setIsDirty(false);
        if (results.some((result) => result.failed)) {
          setToast({
            type: 'error',
            title: 'Some days could not be loaded',
            message: 'Default habit times are shown for the unavailable days.'
          });
        } else if (googleEventsFailed) {
          setToast({
            type: 'error',
            title: 'Google events unavailable',
            message: 'Your IP planner loaded, but Google Calendar could not be refreshed. Use Sync now to retry.'
          });
        }
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    };

    loadPlans();
    return () => {
      cancelled = true;
    };
  }, [groupId, profile?.student?.id, weekKey, profile?.linkedHabits, schoolTimetableKey, schoolDayConfigKey, earliestPlannerDate, latestPlannerDate, habitStartDate, challengeEndDate, calendarRefreshKey]);

  const totalMinutes = useMemo(
    () => weekDates
      .flatMap((day) => weekPlans[day.date]?.items || [])
      .filter((item) => item.itemType === 'habit')
      .reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0),
    [weekKey, weekPlans]
  );

  const schoolMinutes = useMemo(
    () => hasSchoolDayConfig
      ? weekDates
        .filter((day) => isConfiguredSchoolDay(day.weekday))
        .reduce((sum) => sum + minutesBetween(schoolDayConfig.startTime, schoolDayConfig.endTime), 0)
      : weekDates
        .flatMap((day) => weekPlans[day.date]?.items || [])
        .filter((item) => item.itemType === 'school' && item.source !== 'school-commute')
        .reduce((sum, item) => sum + minutesBetween(item.startTime, item.endTime), 0),
    [weekKey, weekPlans, hasSchoolDayConfig, schoolDayConfigKey, schoolTimetableKey]
  );
  const completedHabitBlocks = useMemo(
    () => weekDates
      .flatMap((day) => weekPlans[day.date]?.items || [])
      .filter((item) => item.itemType === 'habit' && item.completed)
      .length,
    [weekKey, weekPlans]
  );

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;
  const selectedRoutineReminder = selectedItem?.itemType === 'routine'
    ? (plannerSettings.recurringReminders || []).find(
      (reminder) => String(reminder.id) === String(selectedItem.routineId)
    )
    : null;
  const calendarHours = Array.from(
    { length: ((DAY_END_MINUTES - DAY_START_MINUTES) / 60) + 1 },
    (_, index) => (DAY_START_MINUTES / 60) + index
  );
  const currentTimeMinutes = (currentTime.getHours() * 60) + currentTime.getMinutes();
  const currentTimeLabel = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
  const currentTimeVisible = currentTimeMinutes >= DAY_START_MINUTES && currentTimeMinutes <= DAY_END_MINUTES;
  const currentTimeTop = ((currentTimeMinutes - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR;

  const updateItem = (itemId, patch, targetDate = selectedDate) => {
    if (!isPlannerDateEditable(targetDate)) return;
    setIsDirty(true);
    setItems((previous) => previous
      .map((item) => {
        if (item.id !== itemId || item.locked) return item;
        const next = { ...item, ...patch };
        if (patch.startTime && !patch.endTime) {
          next.endTime = addMinutes(patch.startTime, item.durationMinutes || 30);
        }
        if (patch.durationMinutes) {
          next.endTime = addMinutes(next.startTime, patch.durationMinutes);
        }
        if (patch.endTime) {
          next.durationMinutes = minutesBetween(next.startTime, patch.endTime);
        }
        return next;
      })
      .sort((left, right) => left.startTime.localeCompare(right.startTime)), targetDate);
  };

  const persistPlannerSettings = async (nextSettings) => {
    const response = await axios.put(`/groups/${groupId}/students/${profile.student.id}/planner-settings`, {
      wakeTime: nextSettings.wakeTime,
      bedtime: nextSettings.bedtime,
      schoolCommuteMinutes: nextSettings.schoolCommuteMinutes || 0,
      timezone: getDeviceTimezone(),
      recurringReminders: nextSettings.recurringReminders,
      aiWeeklyTemplates: nextSettings.aiWeeklyTemplates || {}
    });
    const savedSettings = response.data?.settings || {};
    setPlannerSettings((previous) => ({ ...previous, ...savedSettings }));
    return savedSettings;
  };

  const undoPlannerChanges = () => {
    const snapshot = savedSnapshotRef.current;
    if (!snapshot || saving || loadingPlan) return;
    setWeekPlans(clonePlannerData(snapshot.weekPlans));
    setPlannerSettings((previous) => ({
      ...clonePlannerData(snapshot.plannerSettings),
      googleCalendarConnected: previous.googleCalendarConnected,
      googleCalendarConfigured: previous.googleCalendarConfigured
    }));
    setSelectedItemId(null);
    setDraggedId(null);
    setDraggedDate(null);
    setShowRoutineForm(false);
    setEditingRoutineId(null);
    setRoutineDraft(DEFAULT_ROUTINE_DRAFT);
    setClarificationQuestions([]);
    setClarificationAnswers({});
    setAiProgress('');
    dirtyRef.current = false;
    setIsDirty(false);
    setToast({
      type: 'info',
      title: 'Changes undone',
      message: 'Your planner has been restored to the last saved version.'
    });
  };

  const updateSleepBoundary = (boundary, value) => {
    if (!value) return;
    const nextSettings = {
      ...plannerSettings,
      wakeTime: boundary === 'wake' ? value : wakeTime,
      bedtime: boundary === 'bedtime' ? value : bedtime
    };
    const nextSleepItems = buildSleepItems(nextSettings.wakeTime, nextSettings.bedtime);
    setIsDirty(true);
    setPlannerSettings(nextSettings);
    setWeekPlans((previous) => Object.fromEntries(Object.entries(previous).map(([date, plan]) => [
      date,
      {
        ...plan,
        items: [...(plan.items || []).filter((item) => item.itemType !== 'sleep'), ...nextSleepItems]
          .sort((left, right) => left.startTime.localeCompare(right.startTime))
      }
    ])));
    setClarificationQuestions([]);
    setClarificationAnswers({});
  };

  const updateSchoolCommute = (value) => {
    const nextMinutes = Math.max(0, Math.min(180, Number(value) || 0));
    const nextSettings = { ...plannerSettings, schoolCommuteMinutes: nextMinutes };
    setIsDirty(true);
    setPlannerSettings(nextSettings);
    setWeekPlans((previous) => Object.fromEntries(Object.entries(previous).map(([date, plan]) => {
      const targetWeekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
      return [date, {
        ...plan,
        items: [
          ...(plan.items || []).filter((item) => item.source !== 'school-commute'),
          ...buildSchoolCommuteItems(targetWeekday, nextSettings)
        ].sort((left, right) => left.startTime.localeCompare(right.startTime))
      }];
    })));
    setClarificationQuestions([]);
    setClarificationAnswers({});
  };

  const applyRecurringReminders = (nextReminders) => {
    const nextSettings = { ...plannerSettings, recurringReminders: nextReminders };
    setIsDirty(true);
    setPlannerSettings(nextSettings);
    setWeekPlans((previous) => Object.fromEntries(Object.entries(previous).map(([date, plan]) => {
      const targetWeekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
      const savedOverrides = (plan.items || []).filter(isRoutineOverride);
      return [date, {
        ...plan,
        items: [
          ...(plan.items || []).filter((item) => item.itemType !== 'routine'),
          ...mergeRoutineOverrides(buildRoutineItems(targetWeekday, nextReminders, date), savedOverrides)
        ].sort((left, right) => left.startTime.localeCompare(right.startTime))
      }];
    })));
  };

  const updateRecurringReminderTime = (routineId, field, value) => {
    const reminder = (plannerSettings.recurringReminders || []).find(
      (item) => String(item.id) === String(routineId)
    );
    if (!reminder || !value) return;
    const durationMinutes = minutesBetween(reminder.startTime, reminder.endTime);
    const nextReminder = {
      ...reminder,
      [field]: value,
      ...(field === 'startTime' ? { endTime: addMinutes(value, durationMinutes) } : {})
    };
    if (nextReminder.startTime >= nextReminder.endTime) {
      setToast({ type: 'error', title: 'Check the reminder time', message: 'The end time must be later than the start time.' });
      return;
    }
    applyRecurringReminders(
      plannerSettings.recurringReminders.map((item) => (
        String(item.id) === String(routineId) ? nextReminder : item
      ))
    );
  };

  const resetRoutineOverride = (item, targetDate = selectedDate) => {
    if (!isPlannerDateEditable(targetDate)) return;
    const reminder = (plannerSettings.recurringReminders || []).find(
      (entry) => String(entry.id) === String(item.routineId)
    );
    if (!reminder) return;
    const targetWeekday = new Date(`${targetDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
    const defaultItem = buildRoutineItems(targetWeekday, [reminder], targetDate)[0];
    if (!defaultItem) return;
    setIsDirty(true);
    setItems((previous) => previous
      .map((entry) => entry.id === item.id ? defaultItem : entry)
      .sort((left, right) => left.startTime.localeCompare(right.startTime)), targetDate);
  };

  const saveRoutineReminder = () => {
    if (!routineDraft.title.trim() || !routineDraft.weekdays.length) {
      setToast({ type: 'error', title: 'Reminder needs more detail', message: 'Add a title and select at least one day.' });
      return;
    }
    if (!routineDraft.startTime || !routineDraft.endTime || routineDraft.startTime >= routineDraft.endTime) {
      setToast({ type: 'error', title: 'Check the reminder time', message: 'The end time must be later than the start time.' });
      return;
    }
    const existingReminder = editingRoutineId
      ? plannerSettings.recurringReminders.find((item) => item.id === editingRoutineId)
      : null;
    const reminder = {
      ...routineDraft,
      id: editingRoutineId || `personal-${Date.now()}`,
      title: routineDraft.title.trim(),
      createdDate: existingReminder?.createdDate || deviceToday
    };
    const nextReminders = editingRoutineId
      ? plannerSettings.recurringReminders.map((item) => item.id === editingRoutineId ? reminder : item)
      : [...plannerSettings.recurringReminders, reminder];
    applyRecurringReminders(nextReminders);
    setRoutineDraft(DEFAULT_ROUTINE_DRAFT);
    setEditingRoutineId(null);
    setShowRoutineForm(false);
    setToast({ type: 'info', title: 'Weekly reminder added', message: 'It appears on the selected days. Save your week to keep the change.' });
  };

  const editRoutineReminder = (reminder) => {
    setRoutineDraft({
      title: reminder.title,
      startTime: reminder.startTime,
      endTime: reminder.endTime,
      weekdays: [...(reminder.weekdays || [])]
    });
    setEditingRoutineId(reminder.id);
    setShowRoutineForm(true);
  };

  const addManualBlock = (requestedTime = '17:00', targetDate = selectedDate) => {
    if (!isPlannerDateEditable(targetDate)) return;
    const newId = `manual-${Date.now()}`;
    setIsDirty(true);
    setItems((previous) => [...previous, {
      id: newId,
      title: 'New commitment',
      itemType: 'manual',
      habitIndex: -1,
      startTime: requestedTime,
      endTime: addMinutes(requestedTime, 60),
      durationMinutes: 60,
      locked: false,
      reason: '',
      source: 'manual'
    }].sort((left, right) => left.startTime.localeCompare(right.startTime)), targetDate);
    setSelectedDate(targetDate);
    setSelectedItemId(newId);
  };

  const moveSelectedDate = (days) => {
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + days);
    const normalizedDate = normalizePlannerDateWithinBounds(
      toLocalIso(nextDate),
      earliestPlannerDate,
      latestPlannerDate
    );
    const changeWeek = () => setSelectedDate(normalizedDate);
    if (dirtyRef.current && getWeekDates(normalizedDate)[0]?.date !== weekDates[0]?.date) {
      requestPlannerLeave(changeWeek);
      return;
    }
    changeWeek();
  };

  const selectPlannerDate = (date) => {
    const normalizedDate = normalizePlannerDateWithinBounds(
      date,
      earliestPlannerDate,
      latestPlannerDate
    );
    const changeDate = () => setSelectedDate(normalizedDate);
    if (dirtyRef.current && getWeekDates(normalizedDate)[0]?.date !== weekDates[0]?.date) {
      requestPlannerLeave(changeDate);
      return;
    }
    changeDate();
  };

  const getTimeFromPointer = (event, offsetMinutes = 0) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = Math.min(bounds.height, Math.max(0, event.clientY - bounds.top));
    const rawMinutes = DAY_START_MINUTES
      + ((relativeY / bounds.height) * (DAY_END_MINUTES - DAY_START_MINUTES))
      - offsetMinutes;
    return Math.min(
      DAY_END_MINUTES - 15,
      Math.max(DAY_START_MINUTES, Math.round(rawMinutes / 15) * 15)
    );
  };

  const handleCalendarDrop = (event, targetDate) => {
    event.preventDefault();
    if (!isPlannerDateEditable(targetDate)) return;
    if (!draggedId || !draggedDate) return;
    const item = (weekPlans[draggedDate]?.items || []).find((entry) => entry.id === draggedId);
    if (!item || item.locked) return;
    if (['habit', 'routine'].includes(item.itemType) && draggedDate !== targetDate) {
      setToast({
        type: 'info',
        title: item.itemType === 'routine' ? 'Keep this reminder on its date' : 'Keep habits on their assigned day',
        message: item.itemType === 'routine'
          ? 'Drag it to another time on the same date. Its normal weekly schedule will stay unchanged.'
          : 'You can move this habit to another time today, but not postpone it to a different day.'
      });
      setDraggedId(null);
      setDraggedDate(null);
      setDragOffsetMinutes(0);
      return;
    }
    const startTime = minutesToTime(getTimeFromPointer(event, dragOffsetMinutes));
    const movedItem = {
      ...item,
      startTime,
      endTime: addMinutes(startTime, item.durationMinutes || minutesBetween(item.startTime, item.endTime)),
      ...(item.itemType === 'routine' ? {
        locked: false,
        routineOverride: true,
        source: 'routine-override',
        reason: 'Adjusted for this date · Click to change every occurrence'
      } : {})
    };
    setIsDirty(true);
    setWeekPlans((previous) => {
      const sourcePlan = previous[draggedDate] || { items: [], constraintsText: '' };
      const targetPlan = previous[targetDate] || { items: [], constraintsText: '' };
      if (draggedDate === targetDate) {
        return {
          ...previous,
          [targetDate]: {
            ...targetPlan,
            items: targetPlan.items
              .map((entry) => entry.id === draggedId ? movedItem : entry)
              .sort((left, right) => left.startTime.localeCompare(right.startTime))
          }
        };
      }
      return {
        ...previous,
        [draggedDate]: {
          ...sourcePlan,
          items: sourcePlan.items.filter((entry) => entry.id !== draggedId)
        },
        [targetDate]: {
          ...targetPlan,
          items: [
            ...targetPlan.items.filter((entry) => entry.id !== movedItem.id),
            movedItem
          ].sort((left, right) => left.startTime.localeCompare(right.startTime))
        }
      };
    });
    setSelectedDate(targetDate);
    setSelectedItemId(draggedId);
    setDraggedId(null);
    setDraggedDate(null);
    setDragOffsetMinutes(0);
  };

  const handleCalendarDoubleClick = (event, targetDate) => {
    if (!canEdit || !isPlannerDateEditable(targetDate) || event.target !== event.currentTarget) return;
    addManualBlock(minutesToTime(getTimeFromPointer(event)), targetDate);
  };

  const buildGoogleSyncDays = () => weekDates
    .filter((day) => isPlannerDateAvailable(day.date))
    .map((day) => ({
      date: day.date,
      constraintsText: weekPlans[day.date]?.constraintsText || '',
      items: persistableScheduleItems(weekPlans[day.date]?.items || [])
    }));

  const pushWeekToGoogleCalendar = async () => {
    const response = await axios.post(`/groups/${groupId}/students/${profile.student.id}/google-calendar/sync`, {
      days: buildGoogleSyncDays(),
      includeChallengeHorizon: true
    });
    return response.data || {};
  };

  const pullGoogleCalendarIntoPlanner = async () => {
    const availableDays = weekDates.filter((day) => isPlannerDateAvailable(day.date));
    if (!availableDays.length) return { pulled: 0 };
    const [pullResponse, externalResponse] = await Promise.all([
      axios.post(`/groups/${groupId}/students/${profile.student.id}/google-calendar/pull`, {
        days: buildGoogleSyncDays()
      }),
      axios.get(`/groups/${groupId}/students/${profile.student.id}/google-calendar/events`, {
        params: {
          start: availableDays[0].date,
          end: availableDays[availableDays.length - 1].date
        }
      })
    ]);

    const googleEventsByDate = (externalResponse.data?.events || []).reduce((accumulator, event) => {
      if (!event.date) return accumulator;
      if (!accumulator[event.date]) accumulator[event.date] = [];
      accumulator[event.date].push(event);
      return accumulator;
    }, {});
    const duplicateBreakDetected = availableDays.some((day) => {
      const planItems = weekPlans[day.date]?.items || [];
      const mergedItems = [
        ...planItems.filter((item) => item.itemType !== 'google'),
        ...(googleEventsByDate[day.date] || [])
      ];
      return removeBreaksDuplicatingFixedEvents(mergedItems).length !== mergedItems.length;
    });
    setWeekPlans((previous) => {
      let changed = false;
      const next = { ...previous };
      availableDays.forEach((day) => {
        const plan = previous[day.date];
        if (!plan) return;
        const existingGoogle = (plan.items || []).filter((item) => item.itemType === 'google');
        const incomingGoogle = googleEventsByDate[day.date] || [];
        const combinedItems = [
          ...(plan.items || []).filter((item) => item.itemType !== 'google'),
          ...incomingGoogle
        ];
        const sanitizedItems = removeBreaksDuplicatingFixedEvents(combinedItems)
          .sort((left, right) => left.startTime.localeCompare(right.startTime));
        const signature = (events) => JSON.stringify(events.map((event) => [
          event.id,
          event.title,
          event.startTime,
          event.endTime,
          event.location
        ]));
        if (
          signature(existingGoogle) === signature(incomingGoogle)
          && sanitizedItems.length === combinedItems.length
        ) return;
        changed = true;
        next[day.date] = {
          ...plan,
          items: sanitizedItems
        };
      });
      return changed ? next : previous;
    });
    if (duplicateBreakDetected) setIsDirty(true);
    setPlannerSettings((previous) => ({
      ...previous,
      googleCalendarHiddenEventCount: externalResponse.data?.hiddenCount || 0,
      googleCalendarNeedsReconnect: Boolean(externalResponse.data?.needsReconnect)
    }));
    const result = pullResponse.data || { pulled: 0 };
    if (result.pulled > 0) setCalendarRefreshKey((value) => value + 1);
    setLastGoogleSyncAt(new Date());
    return result;
  };

  const syncGoogleCalendarNow = async () => {
    if (googleDisconnectingRef.current) return;
    try {
      if (dirtyRef.current) {
        await saveCalendar();
        return;
      }
      setGoogleSyncing(true);
      const pullResult = await pullGoogleCalendarIntoPlanner();
      const result = pullResult.pulled > 0 ? pullResult : await pushWeekToGoogleCalendar();
      if (pullResult.pulled === 0) setCalendarRefreshKey((value) => value + 1);
      setLastGoogleSyncAt(new Date());
      setToast({
        type: 'success',
        title: 'Google Calendar synced',
        message: pullResult.pulled > 0
          ? `${pullResult.pulled} day${pullResult.pulled === 1 ? '' : 's'} updated from Google Calendar.`
          : `${result.managed || 0} IP planner blocks are synced. Habit reminders will arrive 10 minutes before they start.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Google sync failed',
        message: error.response?.data?.error || 'Reconnect Google Calendar and try again.'
      });
    } finally {
      setGoogleSyncing(false);
    }
  };

  const hideGoogleCalendarEvent = async (item) => {
    if (!item?.googleEventId) return;
    try {
      const response = await axios.post(`/groups/${groupId}/students/${profile.student.id}/google-calendar/hidden-events`, {
        eventId: item.googleEventId
      });
      setWeekPlans((previous) => Object.fromEntries(
        Object.entries(previous).map(([planDate, plan]) => [planDate, {
          ...plan,
          items: (plan.items || []).filter((entry) => entry.googleEventId !== item.googleEventId)
        }])
      ));
      if (savedSnapshotRef.current?.weekPlans) {
        savedSnapshotRef.current = {
          ...savedSnapshotRef.current,
          weekPlans: Object.fromEntries(
            Object.entries(savedSnapshotRef.current.weekPlans).map(([planDate, plan]) => [planDate, {
              ...plan,
              items: (plan.items || []).filter((entry) => entry.googleEventId !== item.googleEventId)
            }])
          )
        };
      }
      setPlannerSettings((previous) => ({
        ...previous,
        googleCalendarHiddenEventCount: response.data?.hiddenCount || 0
      }));
      setSelectedItemId(null);
      setToast({
        type: 'success',
        title: 'Google event hidden',
        message: 'It remains in Google Calendar but will no longer appear inside your IP planner.'
      });
    } catch (error) {
      setToast({ type: 'error', title: 'Could not hide event', message: error.response?.data?.error || 'Please try again.' });
    }
  };

  const restoreHiddenGoogleEvents = async () => {
    try {
      setGoogleSyncing(true);
      await axios.delete(`/groups/${groupId}/students/${profile.student.id}/google-calendar/hidden-events`);
      setPlannerSettings((previous) => ({ ...previous, googleCalendarHiddenEventCount: 0 }));
      setCalendarRefreshKey((value) => value + 1);
      setToast({ type: 'success', title: 'Google events restored', message: 'Hidden Google events can appear in your IP planner again.' });
    } catch (error) {
      setToast({ type: 'error', title: 'Could not restore events', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setGoogleSyncing(false);
    }
  };

  const saveCalendar = async ({ silent = false } = {}) => {
    try {
      setSaving(true);
      const savedSettings = await persistPlannerSettings(plannerSettings);
      const savedWeekPlans = savedSnapshotRef.current?.weekPlans || {};
      const changedWeekDates = weekDates.filter((day) => (
        isPlannerDateAvailable(day.date)
        && JSON.stringify(comparableSchedulePlan(weekPlans[day.date]))
          !== JSON.stringify(comparableSchedulePlan(savedWeekPlans[day.date]))
      ));
      await Promise.all(changedWeekDates.map((day) => {
        const dayPlan = weekPlans[day.date] || { items: [], constraintsText: '' };
        return axios.put(`/groups/${groupId}/students/${profile.student.id}/schedule`, {
          date: day.date,
          constraintsText: dayPlan.constraintsText,
          items: persistableScheduleItems(dayPlan.items)
        });
      }));

      const habitItems = items.filter((item) => item.itemType === 'habit' && item.habitIndex >= 0);
      const firstItemByHabit = [...new Map(habitItems.map((item) => [item.habitIndex, item])).values()];
      await axios.put(`/groups/${groupId}/students/${profile.student.id}/planner`, {
        challengeId: activeChallenge?.id || null,
        habits: firstItemByHabit.map((item, orderIndex) => ({
          index: item.habitIndex,
          orderIndex,
          scheduleTime: item.startTime,
          durationMinutes: item.durationMinutes
        }))
      });
      if (onSaved) await onSaved();

      let googleSyncFailed = false;
      if (plannerSettings.googleCalendarConnected && !googleDisconnectingRef.current) {
        try {
          setGoogleSyncing(true);
          await pushWeekToGoogleCalendar();
        } catch (_error) {
          googleSyncFailed = true;
        } finally {
          setGoogleSyncing(false);
        }
      }

      const nextSavedSettings = { ...plannerSettings, ...savedSettings };
      setPlannerSettings((previous) => ({ ...previous, ...savedSettings }));
      savedSnapshotRef.current = {
        plannerSettings: clonePlannerData(nextSavedSettings),
        weekPlans: clonePlannerData(weekPlans)
      };
      dirtyRef.current = false;
      setIsDirty(false);
      if (plannerSettings.googleCalendarConnected && !googleSyncFailed) {
        setLastGoogleSyncAt(new Date());
      }
      if (!silent || googleSyncFailed) {
        setToast({
          type: googleSyncFailed ? 'error' : 'success',
          title: googleSyncFailed ? 'Week saved; Google needs attention' : 'Week saved',
          message: googleSyncFailed
            ? 'Your IP planner is saved, but Google Calendar could not be updated. Use Sync now to retry.'
            : plannerSettings.googleCalendarConnected
              ? 'Your planner is saved and Google Calendar reminders are up to date.'
              : 'Calendar blocks, sleep boundaries, weekly reminders, and preferred habit times are now in sync.'
        });
      }
      lastAutoSaveAttemptRef.current = 0;
      return true;
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Week not saved',
        message: error.response?.data?.error || 'Please try again.'
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (
      !plannerSettings.googleCalendarConnected
      || !isDirty
      || saving
      || loadingPlan
      || generating
      || clarifying
      || googleDisconnecting
    ) return undefined;
    const elapsed = Date.now() - lastAutoSaveAttemptRef.current;
    if (elapsed < 30000) return undefined;
    const timer = window.setTimeout(() => {
      lastAutoSaveAttemptRef.current = Date.now();
      saveCalendar({ silent: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isDirty, saving, loadingPlan, generating, clarifying, googleDisconnecting, plannerSettings, weekPlans, weekKey]);

  useEffect(() => {
    if (!plannerSettings.googleCalendarConnected || plannerSettings.googleCalendarNeedsReconnect) return undefined;
    let cancelled = false;
    const pollGoogleCalendar = async () => {
      if (
        cancelled
        || googlePollingRef.current
        || dirtyRef.current
        || saving
        || loadingPlan
        || googleSyncing
        || googleDisconnectingRef.current
      ) return;
      googlePollingRef.current = true;
      try {
        await pullGoogleCalendarIntoPlanner();
        if (!googleInitialPushRef.current) {
          await pushWeekToGoogleCalendar();
          googleInitialPushRef.current = true;
          setLastGoogleSyncAt(new Date());
        }
      } catch (error) {
        if (error.response?.status === 409) {
          setPlannerSettings((previous) => ({ ...previous, googleCalendarNeedsReconnect: true }));
        }
        return;
      } finally {
        googlePollingRef.current = false;
      }
    };
    const initialCheck = window.setTimeout(pollGoogleCalendar, 1500);
    const interval = window.setInterval(pollGoogleCalendar, 20000);
    const handleFocus = () => pollGoogleCalendar();
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [groupId, profile?.student?.id, weekKey, plannerSettings.googleCalendarConnected, plannerSettings.googleCalendarNeedsReconnect, saving, loadingPlan, googleSyncing]);

  useEffect(() => {
    googleInitialPushRef.current = false;
  }, [groupId, profile?.student?.id, plannerSettings.googleCalendarConnected]);

  const requestPlannerLeave = (onSaved) => {
    if (!dirtyRef.current) {
      onSaved?.();
      return;
    }
    pendingLeaveRef.current = onSaved || null;
    setShowUnsavedModal(true);
  };

  const cancelPlannerLeave = () => {
    pendingLeaveRef.current = null;
    setShowUnsavedModal(false);
  };

  const saveAndLeavePlanner = async () => {
    const saved = await saveCalendar();
    if (!saved) return;
    const continueNavigation = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setShowUnsavedModal(false);
    continueNavigation?.();
  };

  useEffect(() => {
    const guard = {
      isDirty: () => dirtyRef.current,
      requestLeave: requestPlannerLeave
    };
    window.__innerPerformancePlannerGuard = guard;

    const handleBeforeUnload = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const handleDocumentLink = (event) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      event.preventDefault();
      event.stopPropagation();
      requestPlannerLeave(() => window.location.assign(anchor.href));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentLink, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentLink, true);
      if (window.__innerPerformancePlannerGuard === guard) delete window.__innerPerformancePlannerGuard;
    };
  });

  const generateWithAi = async (answers = clarificationAnswers, questions = clarificationQuestions) => {
    try {
      if (!aiTargetDays.length) return;
      setGenerating(true);
      const generatedPlans = [];
      for (let targetIndex = 0; targetIndex < aiTargetDays.length; targetIndex += 1) {
        const targetDay = aiTargetDays[targetIndex];
        const dayPlan = weekPlans[targetDay.date] || {
          items: buildDefaultItems(targetDay.weekday, plannerSettings, targetDay.date),
          constraintsText: ''
        };
        setAiProgress(`Planning ${targetDay.weekday} (${targetIndex + 1} of ${aiTargetDays.length})`);
        const dayAnswers = Object.fromEntries(
          questions
            .filter((question) => question.appliesToAllTargets || question.targetDate === targetDay.date)
            .map((question) => [question.originalId, answers[question.id]])
        );
        const response = await axios.post(`/groups/${groupId}/students/${profile.student.id}/schedule/ai`, {
          phase: 'generate',
          date: targetDay.date,
          constraintsText,
          clarificationAnswers: dayAnswers,
          currentItems: dayPlan.items,
          repeatWeekly: aiFrequency === 'weekly',
          planningScope: aiDayMode,
          fixedItems: dayPlan.items.filter((item) => ['manual', 'sleep', 'routine', 'google'].includes(item.itemType))
        });
        const allowedHabitIndexes = new Set(
          getScheduledHabits(targetDay.weekday, targetDay.date).map((habit, fallbackIndex) => (
            Number.isInteger(habit.index) ? habit.index : fallbackIndex
          ))
        );
        const safeItems = (response.data?.plan?.items || []).filter((item) => (
          item.itemType !== 'habit' || allowedHabitIndexes.has(Number(item.habitIndex))
        ));
        const defaultHabitItems = buildDefaultItems(targetDay.weekday, plannerSettings, targetDay.date)
          .filter((item) => item.itemType === 'habit');
        const repairedItems = repairSavedPeriodicItems(safeItems, defaultHabitItems, targetDay.weekday, targetDay.date);
        const plannedHabitIndexes = new Set(
          repairedItems
            .filter((item) => item.itemType === 'habit')
            .map((item) => Number(item.habitIndex))
        );
        const missingHabitItems = defaultHabitItems.filter(
          (item) => !plannedHabitIndexes.has(Number(item.habitIndex))
        );
        const routineItems = mergeRoutineOverrides(
          buildRoutineItems(targetDay.weekday, plannerSettings.recurringReminders || [], targetDay.date),
          dayPlan.items
        );
        generatedPlans.push({
          date: targetDay.date,
          weekday: targetDay.weekday,
          summary: response.data?.summary,
          items: [
            ...repairedItems.filter((item) => item.itemType !== 'routine'),
            ...missingHabitItems,
            ...routineItems
          ].sort((left, right) => left.startTime.localeCompare(right.startTime))
        });
      }

      setWeekPlans((previous) => {
        const nextPlans = { ...previous };
        generatedPlans.forEach((plan) => {
          nextPlans[plan.date] = {
            ...(previous[plan.date] || {}),
            constraintsText,
            items: plan.items
          };
        });
        return nextPlans;
      });
      if (aiFrequency === 'weekly') {
        setPlannerSettings((previous) => {
          const nextTemplates = { ...(previous.aiWeeklyTemplates || {}) };
          generatedPlans.forEach((plan) => {
            nextTemplates[plan.weekday] = plan.items
              .filter((item) => ['habit', 'break'].includes(item.itemType))
              .map((item) => ({ ...item, source: 'weekly-ai' }));
          });
          return { ...previous, aiWeeklyTemplates: nextTemplates };
        });
      }
      setIsDirty(true);
      setSelectedItemId(null);
      setClarificationQuestions([]);
      setClarificationAnswers({});
      setToast({
        type: 'success',
        title: aiFrequency === 'weekly' ? 'Your weekly pattern is ready' : 'Your selected days are planned',
        message: `${generatedPlans.length} ${generatedPlans.length === 1 ? 'day' : 'days'} reorganised. Habits stayed on their assigned weekdays; review and save your week.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'AI plan unavailable',
        message: error.response?.data?.error || 'Please try again.'
      });
    } finally {
      setGenerating(false);
      setAiProgress('');
    }
  };

  const checkPlanWithAi = async () => {
    try {
      if (!aiTargetDays.length) return;
      setClarifying(true);
      const questions = [];
      const usesSharedWeeklyQuestions = aiFrequency === 'weekly' && aiTargetDays.length > 1;
      const referenceDay = aiTargetDays.find((day) => day.date === selectedDate) || aiTargetDays[0];
      const clarificationTargetDays = usesSharedWeeklyQuestions ? [referenceDay] : aiTargetDays;
      for (let targetIndex = 0; targetIndex < clarificationTargetDays.length; targetIndex += 1) {
        const targetDay = clarificationTargetDays[targetIndex];
        const dayPlan = weekPlans[targetDay.date] || {
          items: buildDefaultItems(targetDay.weekday, plannerSettings, targetDay.date),
          constraintsText: ''
        };
        setAiProgress(usesSharedWeeklyQuestions
          ? 'Checking the preferences for your weekly pattern'
          : `Checking ${targetDay.weekday} (${targetIndex + 1} of ${clarificationTargetDays.length})`);
        const response = await axios.post(`/groups/${groupId}/students/${profile.student.id}/schedule/ai`, {
          phase: 'clarify',
          date: targetDay.date,
          constraintsText,
          currentItems: dayPlan.items,
          repeatWeekly: aiFrequency === 'weekly',
          planningScope: aiDayMode,
          fixedItems: dayPlan.items.filter((item) => ['manual', 'sleep', 'routine', 'google'].includes(item.itemType))
        });
        const clarification = response.data?.clarification || {};
        if (clarification.needsClarification) {
          (clarification.questions || []).forEach((question, questionIndex) => {
            const originalId = question.id || `question-${questionIndex + 1}`;
            questions.push({
              ...question,
              id: usesSharedWeeklyQuestions ? `weekly:${originalId}` : `${targetDay.date}:${originalId}`,
              originalId,
              targetDate: targetDay.date,
              targetWeekday: targetDay.weekday,
              appliesToAllTargets: usesSharedWeeklyQuestions,
              question: usesSharedWeeklyQuestions ? question.question : `${targetDay.shortWeekday}: ${question.question}`
            });
          });
        }
      }
      if (questions.length) {
        setClarificationQuestions(questions);
        setClarificationAnswers({});
        return;
      }
      await generateWithAi({}, []);
    } catch (error) {
      setToast({
        type: 'error',
        title: 'AI check unavailable',
        message: error.response?.data?.error || 'Please try again.'
      });
    } finally {
      setClarifying(false);
      if (!generating) setAiProgress('');
    }
  };

  useEffect(() => {
    const handleGoogleCalendarMessage = async (event) => {
      if (event.source !== googlePopupRef.current || event.data?.source !== 'rituo-google-calendar') return;
      setGoogleConnecting(false);
      googlePopupRef.current = null;
      if (event.data.status !== 'connected') {
        setToast({ type: 'error', title: 'Google Calendar not connected', message: event.data.message || 'Please try again.' });
        return;
      }
      try {
        const response = await axios.get(`/groups/${groupId}/students/${profile.student.id}/planner-settings`);
        setPlannerSettings((previous) => ({ ...previous, ...(response.data?.settings || {}) }));
        try {
          setGoogleSyncing(true);
          await pushWeekToGoogleCalendar();
          setCalendarRefreshKey((value) => value + 1);
          setToast({ type: 'success', title: 'Google Calendar connected', message: 'Google events are loading and your IP planner blocks now include 10-minute Google reminders.' });
        } catch (syncError) {
          setCalendarRefreshKey((value) => value + 1);
          setToast({ type: 'error', title: 'Connected; first sync incomplete', message: syncError.response?.data?.error || 'Use Sync now to retry.' });
        } finally {
          setGoogleSyncing(false);
        }
      } catch (_error) {
        setToast({ type: 'success', title: 'Google Calendar connected', message: 'Refresh the planner to update its connection status.' });
      }
    };
    window.addEventListener('message', handleGoogleCalendarMessage);
    return () => window.removeEventListener('message', handleGoogleCalendarMessage);
  }, [groupId, profile?.student?.id]);

  const connectGoogleCalendar = async () => {
    const popup = window.open('', 'rituo-google-calendar', 'width=560,height=720,resizable=yes,scrollbars=yes');
    if (!popup) {
      setToast({ type: 'error', title: 'Popup blocked', message: 'Allow popups for this site, then try linking Google Calendar again.' });
      return;
    }
    googlePopupRef.current = popup;
    popup.document.write('<p style="font-family:sans-serif;padding:24px">Preparing secure Google Calendar connection…</p>');
    try {
      setGoogleConnecting(true);
      const response = await axios.post(`/groups/${groupId}/students/${profile.student.id}/google-calendar/connect`);
      popup.location.href = response.data.authorizationUrl;
    } catch (error) {
      popup.close();
      googlePopupRef.current = null;
      setGoogleConnecting(false);
      setToast({
        type: 'error',
        title: 'Google Calendar unavailable',
        message: error.response?.data?.error || 'Please try again.'
      });
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (googleDisconnectingRef.current) return;
    try {
      googleDisconnectingRef.current = true;
      setGoogleDisconnecting(true);
      setGoogleSyncing(true);
      setGoogleCleanupProgress({ removed: 0, remaining: null });
      let removed = 0;
      let complete = false;
      let attempts = 0;
      while (!complete && attempts < 30) {
        const response = await axios.delete(`/groups/${groupId}/students/${profile.student.id}/google-calendar`);
        removed += Number(response.data?.removed) || 0;
        complete = response.data?.complete !== false;
        setGoogleCleanupProgress({
          removed,
          remaining: Math.max(0, Number(response.data?.remaining) || 0)
        });
        attempts += 1;
        if (!complete) await new Promise((resolve) => window.setTimeout(resolve, 1200));
      }
      if (!complete) throw new Error('Google Calendar cleanup did not finish. Please try disconnecting again.');
      setPlannerSettings((previous) => ({ ...previous, googleCalendarConnected: false, googleCalendarHiddenEventCount: 0 }));
      setWeekPlans((previous) => Object.fromEntries(
        Object.entries(previous).map(([planDate, plan]) => [planDate, {
          ...plan,
          items: (plan.items || []).filter((item) => item.itemType !== 'google')
        }])
      ));
      setToast({
        type: 'success',
        title: 'Google Calendar disconnected',
        message: `${removed} IP planner event${removed === 1 ? '' : 's'} removed from Google. Your personal Google events were left untouched.`
      });
    } catch (error) {
      setToast({ type: 'error', title: 'Could not disconnect', message: error.response?.data?.error || error.message || 'Please try again.' });
    } finally {
      googleDisconnectingRef.current = false;
      setGoogleDisconnecting(false);
      setGoogleCleanupProgress(null);
      setGoogleSyncing(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#081024] sm:rounded-[1.75rem]">
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 p-4 text-white sm:p-6">
        <img src="/images/planner/five-day-planner-intro.webp" alt="" aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[48%] object-cover opacity-20 lg:block" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">MindHeartGut weekly planner</p>
            <h4 className="mt-2 text-xl font-black tracking-tight sm:text-3xl">Plan your full {isFootballWorkspace ? 'performance' : isStaffWorkspace ? 'personal performance' : 'school'} week</h4>
            <p className="mt-1 hidden text-sm text-slate-300 sm:block">Browse one month either side of today. Completed habits are checked, and habits remain on their assigned day.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => moveSelectedDate(-7)} disabled={!canViewPreviousWeek} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Previous week">‹</button>
            <button type="button" onClick={() => selectPlannerDate(todayIso())} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">This week</button>
            <input
              type="date"
              value={selectedDate}
              min={earliestPlannerDate}
              max={latestPlannerDate}
              onChange={(event) => selectPlannerDate(event.target.value)}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
            <button type="button" onClick={() => moveSelectedDate(7)} disabled={!canViewNextWeek} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Next week">›</button>
          </div>
        </div>
        <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1 sm:mt-5 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <span className="rounded-full bg-violet-400/15 px-3 py-1.5 text-xs font-semibold text-violet-100">{totalMinutes} weekly habit minutes</span>
          {!isFootballWorkspace && !isStaffWorkspace ? <span className="rounded-full bg-blue-400/15 px-3 py-1.5 text-xs font-semibold text-blue-100">{schoolMinutes} weekly school minutes</span> : null}
          <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100">✓ {completedHabitBlocks} completed habit blocks</span>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">{weekDates.reduce((sum, day) => sum + (weekPlans[day.date]?.items?.length || 0), 0)} blocks across 7 days</span>
        </div>
      </div>

      {isDirty ? (
        <div className="flex flex-col gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-black">Unsaved changes</p>
            <p className="text-xs font-semibold opacity-80">Your latest planner edits are only on this screen until you save them.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={undoPlannerChanges} disabled={saving || loadingPlan} className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-300/30 dark:bg-white/5 dark:text-amber-100 dark:hover:bg-white/10">Undo changes</button>
            <button type="button" onClick={saveCalendar} disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      ) : null}

      <div className="p-2 sm:p-5">
        <InlineToast toast={toast} onClose={() => setToast(null)} />

        <div className="grid gap-3 sm:gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="order-2 space-y-3 sm:space-y-4 xl:order-1">
            {canEdit ? (
              <div className="rounded-2xl border border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 p-4 dark:border-yellow-300/20 dark:from-yellow-400/10 dark:to-amber-400/5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700 dark:text-yellow-200">Sleep boundaries</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">These times apply to every day. Sleep stays yellow and AI plans inside your waking hours.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Wake up
                    <input type="time" min="06:15" max="10:00" value={wakeTime} onChange={(event) => updateSleepBoundary('wake', event.target.value)} className="mt-1 w-full rounded-xl border border-yellow-300 bg-white px-2.5 py-2.5 text-sm font-bold text-slate-900 dark:border-yellow-300/20 dark:bg-slate-950 dark:text-white" />
                  </label>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Bedtime
                    <input type="time" min="19:00" max="22:45" value={bedtime} onChange={(event) => updateSleepBoundary('bedtime', event.target.value)} className="mt-1 w-full rounded-xl border border-yellow-300 bg-white px-2.5 py-2.5 text-sm font-bold text-slate-900 dark:border-yellow-300/20 dark:bg-slate-950 dark:text-white" />
                  </label>
                </div>
                <div className={`mt-3 rounded-xl border px-3 py-3 ${
                  sleepStatus === 'recommended'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10'
                    : sleepStatus === 'short'
                      ? 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-500/10'
                      : 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10'
                }`}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Planned sleep window</p>
                      <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{formatDuration(sleepDurationMinutes)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      sleepStatus === 'recommended'
                        ? 'bg-emerald-600 text-white'
                        : sleepStatus === 'short'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500 text-slate-950'
                    }`}>{sleepStatus === 'recommended' ? 'In range' : sleepStatus === 'short' ? 'Below range' : 'Above range'}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                    {sleepComparison}. Young people aged 13–18 are generally advised to get 8–10 hours per 24 hours.
                  </p>
                  <button type="button" onClick={() => setShowSleepTips(true)} className="mt-3 w-full rounded-lg border border-yellow-400 bg-white px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-yellow-100 dark:border-yellow-300/30 dark:bg-white/5 dark:text-yellow-100 dark:hover:bg-yellow-400/10">
                    How to optimise sleep
                  </button>
                </div>
              </div>
            ) : null}

            {canEdit && !isFootballWorkspace && !isStaffWorkspace ? (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:border-blue-400/20 dark:from-blue-500/10 dark:to-cyan-500/5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">School travel</p>
                <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">Tell the planner your normal one-way journey. Travel blocks will protect the time before and after school.</p>
                <label className="mt-3 block text-xs font-bold text-slate-600 dark:text-slate-300">Minutes each way
                  <input
                    type="number"
                    min="0"
                    max="180"
                    step="5"
                    value={schoolCommuteMinutes}
                    onChange={(event) => updateSchoolCommute(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 dark:border-blue-300/20 dark:bg-slate-950 dark:text-white"
                  />
                </label>
                {!hasSchoolDayConfig ? <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-200">Your school has not published its start and finish times yet. The commute will appear once it does.</p> : null}
              </div>
            ) : null}

            {canEdit ? (
              <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-4 dark:border-teal-400/20 dark:from-teal-500/10 dark:to-cyan-500/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 dark:text-teal-200">Weekly reminders</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Personal routine notes appear on selected days, but never count as challenge habits.</p>
                    <div className="mt-2 space-y-1 text-[11px] italic leading-4 text-teal-800/80 dark:text-teal-100/70">
                      {isFootballWorkspace ? (
                        <>
                          <p>“16:30 — pack boots, shin pads and water.”</p>
                          <p>“Matchday — leave 20 minutes earlier than usual.”</p>
                          <p>“After training — stretch, refuel and prepare tomorrow’s kit.”</p>
                        </>
                      ) : isStaffWorkspace ? (
                        <>
                          <p>“Before the first session — review today’s coaching priorities.”</p>
                          <p>“After lunch — complete the admin block before calls begin.”</p>
                          <p>“Sunday evening — prepare the week and protect training time.”</p>
                        </>
                      ) : (
                        <>
                          <p>“7:30 — get ready for school; leave at 8:15.”</p>
                          <p>“Sunday evening — pack my bag and check tomorrow’s timetable.”</p>
                          <p>“After dinner — prepare my clothes and water bottle.”</p>
                        </>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => {
                    setShowRoutineForm((value) => !value);
                    setEditingRoutineId(null);
                    setRoutineDraft({ ...DEFAULT_ROUTINE_DRAFT, weekdays: [...DEFAULT_ROUTINE_DRAFT.weekdays] });
                  }} className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-xs font-black text-white hover:bg-teal-800 dark:bg-teal-300 dark:text-slate-950">{showRoutineForm ? 'Close' : '+ Add'}</button>
                </div>

                {showRoutineForm ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-teal-200 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/60">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Reminder
                      <input value={routineDraft.title} onChange={(event) => setRoutineDraft((previous) => ({ ...previous, title: event.target.value }))} placeholder={isFootballWorkspace ? 'Pack training kit and leave' : isStaffWorkspace ? 'Review tomorrow’s coaching plan' : 'Get ready for school and leave'} className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Starts
                        <input type="time" value={routineDraft.startTime} onChange={(event) => setRoutineDraft((previous) => ({ ...previous, startTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-2 py-2.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                      </label>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Ends
                        <input type="time" value={routineDraft.endTime} onChange={(event) => setRoutineDraft((previous) => ({ ...previous, endTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-2 py-2.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                      </label>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Repeat on</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          ['Mon–Fri', WEEKDAYS.slice(0, 5)],
                          ['Weekends', WEEKDAYS.slice(5)],
                          ['Every day', WEEKDAYS]
                        ].map(([label, days]) => (
                          <button key={label} type="button" onClick={() => setRoutineDraft((previous) => ({ ...previous, weekdays: [...days] }))} className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[10px] font-black text-teal-700 hover:bg-teal-100 dark:border-teal-300/20 dark:bg-white/5 dark:text-teal-200">{label}</button>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {WEEKDAYS.map((day) => {
                          const selected = routineDraft.weekdays.includes(day);
                          return (
                            <button key={day} type="button" onClick={() => setRoutineDraft((previous) => ({
                              ...previous,
                              weekdays: selected ? previous.weekdays.filter((item) => item !== day) : [...previous.weekdays, day]
                            }))} className={`rounded-lg px-1 py-2 text-[10px] font-black ${selected ? 'bg-teal-700 text-white dark:bg-teal-300 dark:text-slate-950' : 'border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'}`}>{day.slice(0, 3)}</button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Weekend reminders appear here and in My Day on their selected dates.</p>
                    </div>
                    <button type="button" onClick={saveRoutineReminder} className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-black text-white hover:bg-teal-800 dark:bg-teal-300 dark:text-slate-950">{editingRoutineId ? 'Update weekly reminder' : 'Save weekly reminder'}</button>
                  </div>
                ) : null}

                {plannerSettings.recurringReminders.length ? (
                  <div className="mt-3 space-y-2">
                    {plannerSettings.recurringReminders.map((reminder) => (
                      <div key={reminder.id} className="rounded-xl border border-teal-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                        <p className="truncate text-sm font-black text-slate-950 dark:text-white">{reminder.title}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{formatTime(reminder.startTime)}–{formatTime(reminder.endTime)} · {(reminder.weekdays || []).map((day) => day.slice(0, 3)).join(', ')} · From {new Date(`${reminder.createdDate || deviceToday}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        <div className="mt-2 flex gap-3">
                          <button type="button" onClick={() => editRoutineReminder(reminder)} className="text-xs font-black text-teal-700 dark:text-teal-200">Edit</button>
                          <button type="button" onClick={() => applyRecurringReminders(plannerSettings.recurringReminders.filter((item) => item.id !== reminder.id))} className="text-xs font-black text-rose-600 dark:text-rose-300">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {canEdit ? (
              <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50 p-4 dark:border-violet-400/20 dark:from-violet-500/10 dark:to-cyan-500/5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">AI auto-plan</p>
                <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">Choose exactly which days AI may reorganise. Every habit remains on its assigned weekday.</p>
                <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Apply plan</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    ['once', 'This week only', 'Exact dates'],
                    ['weekly', 'Repeat weekly', 'Same weekdays']
                  ].map(([value, title, detail]) => (
                    <button key={value} type="button" onClick={() => setAiFrequency(value)} className={`rounded-xl border px-3 py-2.5 text-left transition ${aiFrequency === value ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/20' : 'border-violet-200 bg-white/80 text-slate-700 hover:border-violet-400 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-200'}`}>
                      <span className="block text-xs font-black">{title}</span>
                      <span className={`mt-0.5 block text-[10px] font-semibold ${aiFrequency === value ? 'text-violet-100' : 'text-slate-400'}`}>{detail}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Days to organise</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    ['selected', 'One day'],
                    ['school-week', 'Mon–Fri'],
                    ['full-week', 'All 7 days'],
                    ['custom', 'Custom']
                  ].map(([value, title]) => (
                    <button key={value} type="button" onClick={() => {
                      setAiDayMode(value);
                      if (value === 'custom' && !aiCustomWeekdays.length) setAiCustomWeekdays([weekday]);
                    }} className={`rounded-xl border px-2 py-2.5 text-xs font-black transition ${aiDayMode === value ? 'border-cyan-500 bg-cyan-500 text-slate-950' : 'border-violet-200 bg-white/80 text-slate-600 hover:border-cyan-400 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300'}`}>
                      {title}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-sm font-bold text-slate-900 dark:text-white">Reference day</label>
                <select
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-white/10 dark:bg-slate-950/70 dark:text-white"
                >
                  {weekDates.map((day) => <option key={`ai-${day.date}`} value={day.date}>{day.weekday} · {day.dayLabel}</option>)}
                </select>
                {aiDayMode === 'custom' ? (
                  <div className="mt-2 grid grid-cols-7 gap-1.5">
                    {WEEKDAYS.map((day) => {
                      const active = aiCustomWeekdays.includes(day);
                      return (
                        <button key={`custom-${day}`} type="button" onClick={() => setAiCustomWeekdays((previous) => (
                          active ? previous.filter((value) => value !== day) : [...previous, day]
                        ))} className={`rounded-lg border px-1 py-2 text-[11px] font-black ${active ? 'border-violet-500 bg-violet-100 text-violet-800 dark:bg-violet-500/30 dark:text-violet-100' : 'border-slate-200 bg-white/70 text-slate-400 dark:border-white/10 dark:bg-slate-950/40'}`}>
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-violet-200 bg-white/80 px-3 py-2.5 dark:border-white/10 dark:bg-slate-950/45">
                  <p className="text-xs font-black text-violet-800 dark:text-violet-200">{aiScopeSummary || 'Select at least one day'}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{aiFrequency === 'weekly' ? 'This becomes the default pattern for these weekdays. Exact-date edits can still override it.' : 'Only the selected dates in this visible week will change.'}</p>
                </div>
                <label className="mt-3 block text-sm font-bold text-slate-900 dark:text-white">Instructions for this AI plan</label>
                <textarea
                  value={constraintsText}
                  onChange={(event) => setConstraintsText(event.target.value)}
                  rows={5}
                  placeholder="I get home at 4:15, have dinner at 6:30, football is 7–8, and I focus best before dinner..."
                  className="mt-2 w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-white/10 dark:bg-slate-950/70 dark:text-white"
                />
                {clarificationQuestions.length ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/50">
                    <p className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-200">A few details first</p>
                    {clarificationQuestions.map((question) => (
                      <label key={question.id} className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                        {question.question}
                        <input
                          value={clarificationAnswers[question.id] || ''}
                          onChange={(event) => setClarificationAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))}
                          placeholder={question.placeholder}
                          className="mt-1.5 w-full rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => generateWithAi()}
                      disabled={generating || clarificationQuestions.some((question) => !String(clarificationAnswers[question.id] || '').trim())}
                      className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                    >
                      {generating ? 'AI is building your plan…' : 'Build my organised plan'}
                    </button>
                    <button type="button" onClick={() => { setClarificationQuestions([]); setClarificationAnswers({}); }} className="w-full text-xs font-bold text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-200">Start the AI check again</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={checkPlanWithAi}
                    disabled={clarifying || generating || !aiTargetDays.length || !aiHasScheduledHabits}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                  >
                    {clarifying ? 'AI is checking what it needs…' : generating ? 'AI is building your plan…' : 'Check and organise with AI'}
                  </button>
                )}
                {aiProgress ? <p className="mt-2 text-center text-xs font-black text-violet-700 dark:text-violet-200">{aiProgress}</p> : null}
                {!aiTargetDays.length ? <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-300">Select at least one weekday.</p> : null}
                {aiTargetDays.length && !aiHasScheduledHabits ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No habits are assigned to the selected days yet.</p> : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.035] sm:p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Manual planning</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Add a one-off appointment, trip, meal, or commitment to the selected date only.</p>
              {canEdit ? (
                <button type="button" onClick={() => addManualBlock()} disabled={!selectedDateEditable} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-violet-400 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.05] dark:text-white">
                  + Add commitment
                </button>
              ) : null}
              <p className="mt-3 hidden text-xs leading-5 text-slate-500 dark:text-slate-400 md:block">Tip: double-click an empty calendar time to add a one-hour block there.</p>
            </div>

            <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035] sm:block">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Calendar key</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {[
                  ...(!isFootballWorkspace && !isStaffWorkspace ? [['bg-blue-500', 'School / lessons']] : []),
                  ['bg-violet-500', 'Habits'],
                  ['bg-orange-500', 'Commitments'],
                  ['bg-emerald-500', 'Breaks'],
                  ['bg-yellow-400', 'Sleep'],
                  ['bg-teal-500', 'Weekly reminders'],
                  ...(plannerSettings.googleCalendarConnected ? [['bg-sky-500', 'Google Calendar']] : [])
                ].map(([tone, label]) => (
                  <div key={label} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${tone}`} />{label}</div>
                ))}
                <div className="flex items-center gap-2"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">✓</span>Completed</div>
              </div>
            </div>

            {selectedItem ? (
              <div className="hidden rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-400/20 dark:bg-cyan-500/5 md:block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Selected block</p>
                    <p className="mt-1 font-bold text-slate-900 dark:text-white">{selectedItem.title}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedItemId(null)} className="text-lg text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close block editor">×</button>
                </div>
                {canEdit && selectedItem.itemType === 'manual' ? (
                  <input value={selectedItem.title} onChange={(event) => updateItem(selectedItem.id, { title: event.target.value })} className="mt-3 w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Starts
                    <input type="time" value={selectedRoutineReminder?.startTime || selectedItem.startTime} disabled={!canEdit || !selectedDateEditable || selectedItem.locked} onChange={(event) => selectedItem.itemType === 'routine' ? updateRecurringReminderTime(selectedItem.routineId, 'startTime', event.target.value) : updateItem(selectedItem.id, { startTime: event.target.value })} className="mt-1 w-full rounded-lg border border-cyan-200 bg-white px-2 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ends
                    <input type="time" value={selectedRoutineReminder?.endTime || selectedItem.endTime} disabled={!canEdit || !selectedDateEditable || selectedItem.locked} onChange={(event) => selectedItem.itemType === 'routine' ? updateRecurringReminderTime(selectedItem.routineId, 'endTime', event.target.value) : updateItem(selectedItem.id, { endTime: event.target.value })} className="mt-1 w-full rounded-lg border border-cyan-200 bg-white px-2 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                  </label>
                </div>
                {selectedItem.reason ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedItem.reason}</p> : null}
                {selectedItem.itemType === 'google' ? (
                  <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950 dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-100">
                    <p className="font-black">Imported from Google Calendar</p>
                    <p className="mt-1 leading-5">This block is read-only in IP. Hiding it here does not delete or change the original Google event.</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {selectedItem.htmlLink ? <a href={selectedItem.htmlLink} target="_blank" rel="noreferrer" className="font-black text-sky-700 underline underline-offset-2 dark:text-sky-200">Open in Google</a> : null}
                      <button type="button" onClick={() => hideGoogleCalendarEvent(selectedItem)} className="font-black text-rose-700 dark:text-rose-200">Hide from IP planner</button>
                    </div>
                  </div>
                ) : null}
                {selectedItem.itemType === 'routine' ? (
                  <div className="mt-3 rounded-lg bg-teal-100 px-3 py-2 text-xs font-semibold text-teal-900 dark:bg-teal-500/10 dark:text-teal-100">
                    <p>Changing these times updates every scheduled occurrence. Dragging the block only adjusts {selectedDate}.</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button type="button" onClick={() => editRoutineReminder(selectedRoutineReminder)} className="font-black text-teal-700 dark:text-teal-200">Edit all details</button>
                      {isRoutineOverride(selectedItem) ? <button type="button" onClick={() => resetRoutineOverride(selectedItem)} className="font-black text-violet-700 dark:text-violet-200">Use weekly time for this date</button> : null}
                    </div>
                  </div>
                ) : null}
                {selectedItem.locked && selectedItem.itemType !== 'google' ? <p className="mt-3 rounded-lg bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">{selectedItem.itemType === 'sleep' ? 'Change this using the sleep boundary controls.' : selectedItem.itemType === 'routine' ? 'Edit this from Weekly reminders.' : isFootballWorkspace || isStaffWorkspace ? 'This fixed commitment cannot be moved here.' : 'This lesson is locked by the school timetable.'}</p> : null}
                {canEdit && selectedDateEditable && !selectedItem.locked && !['habit', 'routine'].includes(selectedItem.itemType) ? (
                  <button type="button" onClick={() => {
                    setIsDirty(true);
                    setItems((previous) => previous.filter((entry) => entry.id !== selectedItem.id));
                    setSelectedItemId(null);
                  }} className="mt-3 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-300">
                    Remove from this day
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>

          <div className="order-1 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/50 xl:order-2">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 dark:border-white/10 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-cyan-300"><span className="md:hidden">Selected day</span><span className="hidden md:inline">Monday to Sunday</span></p>
                <p className="mt-1 font-bold text-slate-900 dark:text-white">
                  {weekDates[0]?.dayLabel} – {weekDates[6]?.dayLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => moveSelectedDate(-7)} disabled={!canViewPreviousWeek} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">← Previous week</button>
                <button type="button" onClick={() => selectPlannerDate(todayIso())} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-700">This week</button>
                <button type="button" onClick={() => moveSelectedDate(7)} disabled={!canViewNextWeek} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Next week →</button>
                {canEdit ? (
                  <button type="button" onClick={() => {
                    setIsDirty(true);
                    setItems(buildDefaultItems(weekday, plannerSettings, selectedDate));
                    setSelectedItemId(null);
                  }} disabled={!selectedDateEditable} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300">
                    Reset selected day
                  </button>
                ) : null}
              </div>
            </div>

            <div className="md:hidden">
              {loadingPlan ? (
                <div className="flex min-h-64 items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10">
                    {weekDates.map((day) => (
                      <button
                        key={`mobile-day-${day.date}`}
                        type="button"
                        disabled={!isPlannerDateAvailable(day.date)}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setSelectedItemId(null);
                        }}
                        className={`px-1 py-2.5 text-center disabled:cursor-not-allowed disabled:opacity-30 ${selectedDate === day.date ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-cyan-200' : 'text-slate-500 dark:text-slate-400'}`}
                      >
                        <span className="block text-[9px] font-black uppercase tracking-wider">{day.shortWeekday}</span>
                        <span className="mt-0.5 block text-[10px] font-bold">{day.dayLabel}</span>
                        {!hasChallengeOnDate(day.date) && isPlannerDateAvailable(day.date) ? <span className="mt-1 block truncate text-[8px] font-black uppercase tracking-tight text-amber-600 dark:text-amber-300">No challenge</span> : null}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 p-2.5">
                    {isConfiguredSchoolDay(weekday) ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-blue-950 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-50">
                        <div className="flex items-center justify-between gap-3 text-xs font-black">
                          <span>School day</span>
                          <span>{schoolDayConfig.startTime}–{schoolDayConfig.endTime}</span>
                        </div>
                        {(schoolDayConfig.breaks || []).length ? <p className="mt-1 text-[10px] font-semibold opacity-75">{schoolDayConfig.breaks.map((schoolBreak) => `${schoolBreak.name} ${schoolBreak.startTime}–${schoolBreak.endTime}`).join(' · ')}</p> : null}
                      </div>
                    ) : null}
                    {!hasChallengeOnDate(selectedDate) ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.16em] text-amber-800 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
                        No challenge on this date
                      </div>
                    ) : null}
                    {items.length ? items.map((item) => {
                      const isSelected = selectedItemId === item.id;
                      const routineReminder = item.itemType === 'routine'
                        ? (plannerSettings.recurringReminders || []).find(
                          (reminder) => String(reminder.id) === String(item.routineId)
                        )
                        : null;
                      return (
                        <div key={`mobile-${item.id}`} className={`overflow-hidden rounded-xl border ${item.completed ? 'border-emerald-400 ring-1 ring-emerald-300/60 dark:border-emerald-300/50' : isSelected ? 'border-cyan-400 ring-2 ring-cyan-200/50 dark:ring-cyan-400/15' : 'border-slate-200 dark:border-white/10'}`}>
                          <button type="button" onClick={() => setSelectedItemId(isSelected ? null : item.id)} className={`flex w-full items-center gap-3 border-l-4 px-3 py-3 text-left ${itemStyles[item.itemType] || itemStyles.manual}`}>
                            <span className="w-12 shrink-0 font-mono text-[11px] font-black">{item.startTime}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black">{item.title}</span>
                              <span className="mt-0.5 block text-[10px] font-semibold opacity-75">Until {item.endTime}{item.locked ? ' · Locked' : ''}</span>
                            </span>
                            {item.completed ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white" aria-label="Completed">✓</span> : <span className="text-sm opacity-60">{isSelected ? '−' : '+'}</span>}
                          </button>
                          {isSelected ? (
                            <div className="border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/80">
                              {canEdit && item.itemType === 'manual' ? (
                                <input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} className="mb-3 w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                              ) : null}
                              <div className="grid grid-cols-2 gap-2">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Starts
                                  <input type="time" value={routineReminder?.startTime || item.startTime} disabled={!canEdit || !selectedDateEditable || item.locked} onChange={(event) => item.itemType === 'routine' ? updateRecurringReminderTime(item.routineId, 'startTime', event.target.value) : updateItem(item.id, { startTime: event.target.value })} className="mt-1 w-full rounded-lg border border-cyan-200 bg-white px-2 py-2.5 text-sm text-slate-900 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                                </label>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ends
                                  <input type="time" value={routineReminder?.endTime || item.endTime} disabled={!canEdit || !selectedDateEditable || item.locked} onChange={(event) => item.itemType === 'routine' ? updateRecurringReminderTime(item.routineId, 'endTime', event.target.value) : updateItem(item.id, { endTime: event.target.value })} className="mt-1 w-full rounded-lg border border-cyan-200 bg-white px-2 py-2.5 text-sm text-slate-900 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
                                </label>
                              </div>
                              {item.itemType === 'routine' ? (
                                <div className="mt-2 rounded-lg bg-teal-50 p-2 text-xs font-semibold text-teal-900 dark:bg-teal-500/10 dark:text-teal-100">
                                  <p>Changing these times updates every occurrence.</p>
                                  <div className="mt-2 flex flex-wrap gap-3">
                                    <button type="button" onClick={() => editRoutineReminder(routineReminder)} className="font-black text-teal-700 dark:text-teal-200">Edit all details</button>
                                    {isRoutineOverride(item) ? <button type="button" onClick={() => resetRoutineOverride(item)} className="font-black text-violet-700 dark:text-violet-200">Use weekly time today</button> : null}
                                  </div>
                                </div>
                              ) : null}
                              {item.itemType === 'google' ? (
                                <div className="mt-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-950 dark:bg-sky-400/10 dark:text-sky-100">
                                  <p className="font-semibold">Imported from Google Calendar. Hiding it here leaves the original event untouched.</p>
                                  {item.googleCalendarName ? <p className="mt-1 font-bold opacity-75">Calendar: {item.googleCalendarName}</p> : null}
                                  <div className="mt-2 flex flex-wrap gap-3">
                                    {item.htmlLink ? <a href={item.htmlLink} target="_blank" rel="noreferrer" className="font-black underline underline-offset-2">Open in Google</a> : null}
                                    <button type="button" onClick={() => hideGoogleCalendarEvent(item)} className="font-black text-rose-700 dark:text-rose-200">Hide from IP</button>
                                  </div>
                                </div>
                              ) : null}
                              {item.locked && item.itemType !== 'google' ? <p className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-200">{item.itemType === 'sleep' ? 'Change this using the sleep boundary controls.' : item.itemType === 'routine' ? 'Edit this from Weekly reminders.' : isFootballWorkspace || isStaffWorkspace ? 'This is a fixed commitment.' : 'Managed by your school timetable.'}</p> : null}
                              {canEdit && selectedDateEditable && !item.locked && !['habit', 'routine'].includes(item.itemType) ? (
                                <button type="button" onClick={() => {
                                  setIsDirty(true);
                                  setItems((previous) => previous.filter((entry) => entry.id !== item.id));
                                  setSelectedItemId(null);
                                }} className="mt-3 text-xs font-bold text-rose-600 dark:text-rose-300">Remove this block</button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    }) : (
                      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">Nothing planned for this day.</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="hidden max-h-[760px] overflow-auto md:block">
              {loadingPlan ? (
                <div className="flex min-h-[520px] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>
              ) : (
                <div className="min-w-[1500px]">
                  <div className="grid grid-cols-[72px_repeat(7,minmax(190px,1fr))] border-b border-slate-200 dark:border-white/10">
                    <div className="border-r border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.025]" />
                    {weekDates.map((day) => (
                      <button
                        key={`header-${day.date}`}
                        type="button"
                        disabled={!isPlannerDateAvailable(day.date)}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setSelectedItemId(null);
                        }}
                        className={`border-r border-slate-200 px-3 py-3 text-center last:border-r-0 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 ${
                          selectedDate === day.date
                            ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-cyan-200'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-white/[0.025] dark:text-slate-300 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="block text-[11px] font-black uppercase tracking-[0.18em]">{day.shortWeekday}</span>
                        <span className="mt-1 block text-sm font-bold">{day.dayLabel}</span>
                        {!hasChallengeOnDate(day.date) && isPlannerDateAvailable(day.date) ? <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.14em] text-amber-600 dark:text-amber-300">No challenge</span> : null}
                      </button>
                    ))}
                  </div>

                  <div className="flex">
                    <div className="relative w-[72px] shrink-0 border-r border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.025]" style={{ height: CALENDAR_HEIGHT }}>
                      {calendarHours.map((hour) => (
                        <div key={`label-${hour}`} className="absolute right-3 -translate-y-1/2 text-[11px] font-semibold text-slate-400" style={{ top: ((hour * 60 - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR }}>
                          {minutesToTime(hour * 60)}
                        </div>
                      ))}
                    </div>

                    <div className="grid min-w-0 flex-1 grid-cols-7">
                      {weekDates.map((day) => {
                        const dayItems = weekPlans[day.date]?.items || [];
                        const dayIsAvailable = isPlannerDateAvailable(day.date);
                        const dayIsEditable = isPlannerDateEditable(day.date);
                        const overlapLayout = buildOverlapLayout(dayItems);
                        const isActiveDay = selectedDate === day.date;
                        const showSchoolDay = isConfiguredSchoolDay(day.weekday);
                        const schoolDayTop = showSchoolDay
                          ? ((timeToMinutes(schoolDayConfig.startTime) - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR
                          : 0;
                        const schoolDayHeight = showSchoolDay
                          ? (minutesBetween(schoolDayConfig.startTime, schoolDayConfig.endTime) / 60) * PIXELS_PER_HOUR
                          : 0;
                        return (
                          <div
                            key={`column-${day.date}`}
                            className={`relative border-r border-slate-200 last:border-r-0 dark:border-white/10 ${
                              !dayIsAvailable ? 'bg-slate-100/80 dark:bg-slate-950/70' : isActiveDay ? 'bg-violet-50/25 dark:bg-violet-500/[0.035]' : 'bg-white dark:bg-slate-950/30'
                            } ${draggedId ? 'hover:bg-cyan-50/60 dark:hover:bg-cyan-500/5' : ''}`}
                            style={{ height: CALENDAR_HEIGHT }}
                            onDragOver={(event) => {
                              if (canEdit && dayIsEditable && draggedId) event.preventDefault();
                            }}
                            onDrop={(event) => handleCalendarDrop(event, day.date)}
                            onDoubleClick={(event) => handleCalendarDoubleClick(event, day.date)}
                          >
                            {showSchoolDay ? (
                              <>
                                <div
                                  className="pointer-events-none absolute inset-x-0 z-0 border-y border-blue-300/40 bg-blue-100/35 dark:border-blue-400/15 dark:bg-blue-500/[0.08]"
                                  style={{ top: schoolDayTop, height: schoolDayHeight }}
                                >
                                  <span className="absolute left-1.5 top-1 rounded bg-blue-600/85 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">School {schoolDayConfig.startTime}–{schoolDayConfig.endTime}</span>
                                </div>
                                {(schoolDayConfig.breaks || []).map((schoolBreak, breakIndex) => {
                                  const breakTop = ((timeToMinutes(schoolBreak.startTime) - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR;
                                  const breakHeight = Math.max(18, (minutesBetween(schoolBreak.startTime, schoolBreak.endTime) / 60) * PIXELS_PER_HOUR);
                                  const isLunch = String(schoolBreak.name || '').toLowerCase().includes('lunch');
                                  return (
                                    <div
                                      key={`${day.date}-school-break-${breakIndex}`}
                                      className={`pointer-events-none absolute inset-x-0 z-[2] border-y ${isLunch ? 'border-amber-300/60 bg-amber-200/45 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/15 dark:text-amber-100' : 'border-cyan-300/60 bg-cyan-200/45 text-cyan-950 dark:border-cyan-300/20 dark:bg-cyan-400/15 dark:text-cyan-100'}`}
                                      style={{ top: breakTop, height: breakHeight }}
                                    >
                                      <span className="absolute bottom-0.5 right-1 text-[8px] font-black">{schoolBreak.name} · {schoolBreak.startTime}–{schoolBreak.endTime}</span>
                                    </div>
                                  );
                                })}
                              </>
                            ) : null}
                            {calendarHours.map((hour) => (
                              <React.Fragment key={`${day.date}-line-${hour}`}>
                                <div className="pointer-events-none absolute inset-x-0 border-t border-slate-200 dark:border-white/10" style={{ top: ((hour * 60 - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR }} />
                                {hour < (DAY_END_MINUTES / 60) ? <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-100 dark:border-white/5" style={{ top: (((hour * 60) + 30 - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR }} /> : null}
                              </React.Fragment>
                            ))}
                            {day.date === deviceToday && currentTimeVisible ? (
                              <div className="pointer-events-none absolute inset-x-0 z-[45] border-t-2 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]" style={{ top: currentTimeTop }}>
                                <span className="absolute -left-px -top-2 h-3.5 w-3.5 rounded-full border-2 border-white bg-rose-500 shadow dark:border-slate-950" />
                                <span className="absolute right-1 -top-3 rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] font-black text-white shadow">NOW {currentTimeLabel}</span>
                              </div>
                            ) : null}

                            {!dayIsAvailable ? (
                              <div className="pointer-events-none absolute inset-x-3 top-20 rounded-xl border border-dashed border-slate-300 bg-white/90 p-3 text-center text-xs font-semibold text-slate-500 shadow-sm dark:border-white/15 dark:bg-slate-900/90 dark:text-slate-400">
                                {day.date < accountCreationDate ? 'Before account creation' : 'Outside available month'}
                              </div>
                            ) : !dayItems.length ? (
                              <div className="pointer-events-none absolute inset-x-3 top-20 rounded-xl border border-dashed border-slate-300 bg-white/90 p-3 text-center text-xs text-slate-500 shadow-sm dark:border-white/15 dark:bg-slate-900/90 dark:text-slate-400">
                                No blocks
                              </div>
                            ) : null}
                            {dayIsAvailable && !hasChallengeOnDate(day.date) ? (
                              <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[1] -translate-y-1/2 rounded-xl border border-dashed border-amber-300/70 bg-amber-50/75 px-3 py-3 text-center text-xs font-black uppercase tracking-[0.2em] text-amber-700 backdrop-blur-sm dark:border-amber-300/20 dark:bg-amber-400/5 dark:text-amber-200">
                                No challenge
                              </div>
                            ) : null}

                            {dayItems.map((item) => {
                              const startMinutes = Math.min(
                                DAY_END_MINUTES - 15,
                                Math.max(DAY_START_MINUTES, timeToMinutes(item.startTime))
                              );
                              const durationMinutes = minutesBetween(item.startTime, item.endTime);
                              const top = ((startMinutes - DAY_START_MINUTES) / 60) * PIXELS_PER_HOUR;
                              const height = Math.max(32, (durationMinutes / 60) * PIXELS_PER_HOUR);
                              const isSelected = isActiveDay && selectedItemId === item.id;
                              const overlap = overlapLayout.get(item.id) || { column: 0, totalColumns: 1 };
                              const columnWidth = 100 / overlap.totalColumns;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  draggable={canEdit && dayIsEditable && !item.locked}
                                  onDragStart={(event) => {
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    setDraggedId(item.id);
                                    setDraggedDate(day.date);
                                    setDragOffsetMinutes(Math.max(0, ((event.clientY - bounds.top) / PIXELS_PER_HOUR) * 60));
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', `${day.date}:${item.id}`);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedId(null);
                                    setDraggedDate(null);
                                    setDragOffsetMinutes(0);
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedDate(day.date);
                                    setSelectedItemId(item.id);
                                  }}
                                  className={`absolute z-10 overflow-hidden rounded-lg border-l-4 px-2 py-1.5 text-left shadow-sm transition hover:z-20 hover:shadow-lg ${itemStyles[item.itemType] || itemStyles.manual} ${canEdit && dayIsEditable && !item.locked ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${item.completed ? 'z-30 ring-2 ring-emerald-400 ring-offset-1 dark:ring-offset-slate-950' : isSelected ? 'z-30 ring-2 ring-cyan-400 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
                                  style={{
                                    top,
                                    height,
                                    left: `calc(${overlap.column * columnWidth}% + 3px)`,
                                    width: `calc(${columnWidth}% - 6px)`
                                  }}
                                >
                                  <span className="flex items-center gap-1 text-[11px] font-black"><span className="truncate">{item.title}</span>{item.completed ? <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white" aria-label="Completed">✓</span> : null}</span>
                                  <span className="mt-0.5 block truncate text-[9px] font-semibold opacity-75">{item.startTime}–{item.endTime}{item.locked ? ' · Locked' : ''}</span>
                                  {height >= 60 && item.reason ? <span className="mt-1 block truncate text-[9px] opacity-70">{item.reason}</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {canEdit ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-slate-400">Planner changes stay on this screen until saved. Undo restores the complete last-saved week, including sleep and weekly reminders.</p>
            <div className="flex gap-2">
              <button type="button" onClick={undoPlannerChanges} disabled={!isDirty || saving || loadingPlan} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Undo changes</button>
              <button type="button" onClick={saveCalendar} disabled={saving || loadingPlan} className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:translate-y-0 disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">
                {saving ? 'Saving week…' : 'Save my week'}
              </button>
            </div>
          </div>
        ) : null}

        {canEdit ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-4 dark:border-blue-400/20 dark:from-blue-500/10 dark:via-white/[0.025] dark:to-cyan-400/5 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">External calendar</p>
              <h5 className="mt-1 font-black text-slate-950 dark:text-white">{plannerSettings.googleCalendarConnected ? 'Google Calendar is linked' : 'Link to Google Calendar'}</h5>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">Two-way sync runs automatically while this planner is open. IP edits save to your primary Google calendar; Google edits normally return here within 20 seconds or whenever you focus this window.</p>
              {plannerSettings.googleCalendarConnected && !plannerSettings.googleCalendarNeedsReconnect ? (
                <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-200">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Live sync active{lastGoogleSyncAt ? ` · Last checked ${lastGoogleSyncAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                </p>
              ) : null}
              {plannerSettings.googleCalendarNeedsReconnect ? (
                <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">Reconnect once to grant access to your other visible calendars, including shared teaching calendars.</p>
              ) : null}
              {plannerSettings.googleCalendarConnected && plannerSettings.googleCalendarHiddenEventCount > 0 ? (
                <p className="mt-2 text-xs font-bold text-sky-700 dark:text-sky-200">{plannerSettings.googleCalendarHiddenEventCount} Google event{plannerSettings.googleCalendarHiddenEventCount === 1 ? '' : 's'} hidden from IP.</p>
              ) : null}
              {googleDisconnecting ? (
                <p className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-900 dark:bg-rose-400/15 dark:text-rose-100">
                  Removing IP planner events from Google… {googleCleanupProgress?.removed || 0} removed
                  {googleCleanupProgress?.remaining === null ? '' : ` · ${googleCleanupProgress?.remaining || 0} remaining`}. Keep this planner open until cleanup finishes.
                </p>
              ) : null}
            </div>
            <div className="mt-4 shrink-0 sm:mt-0">
              {plannerSettings.googleCalendarConnected ? (
                <div className="grid gap-2 sm:min-w-[13rem]">
                  {plannerSettings.googleCalendarNeedsReconnect ? <button type="button" onClick={connectGoogleCalendar} disabled={googleConnecting || googleSyncing} className="w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:opacity-50">{googleConnecting ? 'Opening Google…' : 'Reconnect all calendars'}</button> : null}
                  <button type="button" onClick={syncGoogleCalendarNow} disabled={googleSyncing || saving} className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">{googleDisconnecting ? 'Cleanup in progress…' : googleSyncing ? 'Syncing…' : 'Sync now'}</button>
                  {plannerSettings.googleCalendarHiddenEventCount > 0 ? <button type="button" onClick={restoreHiddenGoogleEvents} disabled={googleSyncing} className="w-full rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-xs font-black text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-300/20 dark:bg-white/5 dark:text-sky-200">Restore hidden events</button> : null}
                  <button type="button" onClick={disconnectGoogleCalendar} disabled={googleSyncing} className="w-full rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-400/20 dark:bg-white/5 dark:text-rose-200 dark:hover:bg-rose-500/10">{googleDisconnecting ? `${googleCleanupProgress?.remaining || 0} events remaining` : 'Disconnect'}</button>
                </div>
              ) : (
                <button type="button" onClick={connectGoogleCalendar} disabled={googleConnecting || !plannerSettings.googleCalendarConfigured} className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                  {googleConnecting ? 'Opening Google…' : plannerSettings.googleCalendarConfigured ? 'Link to Google Calendar' : 'Google setup required'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {showUnsavedModal ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="unsaved-planner-title">
          <div className="w-full max-w-md rounded-[1.5rem] border border-amber-300/40 bg-white p-5 shadow-2xl dark:bg-[#081024] sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl dark:bg-amber-400/15">!</div>
            <h3 id="unsaved-planner-title" className="mt-4 text-2xl font-black text-slate-950 dark:text-white">Unsaved changes</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">You changed your planner. Save before leaving so your sleep times, reminders, commitments, and AI organisation stay in sync with My Day.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={cancelPlannerLeave} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Cancel</button>
              <button type="button" onClick={saveAndLeavePlanner} disabled={saving} className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50">{saving ? 'Saving…' : 'Save and leave'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showSleepTips ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="sleep-tips-title" onClick={() => setShowSleepTips(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-yellow-300/40 bg-white shadow-2xl dark:bg-[#081024]" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-5 dark:border-white/10 dark:from-yellow-400/15 dark:to-amber-400/5 sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700 dark:text-yellow-200">Sleep optimisation</p>
                <h3 id="sleep-tips-title" className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Make your {formatDuration(sleepDurationMinutes)} count</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Your selected window is {sleepComparison}. This is time in bed, so allow some time to settle and fall asleep.</p>
              </div>
              <button type="button" onClick={() => setShowSleepTips(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Close sleep tips">×</button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-300/20 dark:bg-yellow-400/10">
                <p className="font-black text-yellow-950 dark:text-yellow-50">Which recommendation is used?</p>
                <p className="mt-1 text-sm leading-6 text-yellow-900/80 dark:text-yellow-100/80">The planner uses 8–10 hours for young people aged 13–18. Adults aged 18+ usually need around 7–9 hours, so personal needs can differ.</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ['Keep the rhythm', 'Use a consistent bedtime and wake time, including weekends where possible.'],
                  ['Create a wind-down', 'Spend the final 30–60 minutes doing calm, predictable activities rather than intense work.'],
                  ['Reduce stimulation', 'Dim bright lights and step away from phones, gaming, and demanding tasks before bed.'],
                  ['Protect the environment', 'Keep the bedroom quiet, dark, comfortable, and slightly cool.'],
                  ['Plan caffeine earlier', 'Avoid caffeine late in the day if it makes it harder to settle at night.'],
                  ['Use daylight and movement', 'Get daylight and regular activity during the day, but avoid intense exercise immediately before bed.']
                ].map(([title, description], index) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-slate-950">{index + 1}</span>
                      <p className="font-black text-slate-950 dark:text-white">{title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                General guidance from <a href="https://www.cdc.gov/physical-activity-education/staying-healthy/sleep.html" target="_blank" rel="noreferrer" className="font-bold text-violet-700 hover:underline dark:text-cyan-300">CDC</a> and <a href="https://www.gosh.nhs.uk/conditions-and-treatments/procedures-and-treatments/sleep-hygiene-children/" target="_blank" rel="noreferrer" className="font-bold text-violet-700 hover:underline dark:text-cyan-300">Great Ormond Street Hospital</a>. Persistent sleep problems should be discussed with a parent, carer, {isFootballWorkspace ? 'coach' : 'school wellbeing lead'}, or healthcare professional.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DailyHabitPlanner;
