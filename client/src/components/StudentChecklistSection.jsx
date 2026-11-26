import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FiArrowRight, FiBookOpen, FiCalendar, FiCheck, FiCheckCircle, FiChevronDown, FiClock, FiCoffee, FiMoon, FiSun, FiX } from 'react-icons/fi';
import { HiOutlineFire } from 'react-icons/hi2';
import StudentHabitCard from './StudentHabitCard';
import IpBuck from './IpBuck';
import { syncDeviceTimezone } from '../utils/deviceTimezone';
import { calculateHabitProgress } from '../utils/habitProgressUtils';

const timeToMinutes = (time, fallback) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return (hours * 60) + minutes;
};

const minutesToTime = (minutes) => {
  const safeMinutes = Math.min((23 * 60) + 59, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, '0')}:${String(safeMinutes % 60).padStart(2, '0')}`;
};

const formatTime = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const getZonedClockParts = (timestamp, timezone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      hours: Number(values.hour) || 0,
      minutes: Number(values.minute) || 0,
      seconds: Number(values.second) || 0,
      label: `${values.hour || '00'}:${values.minute || '00'}:${values.second || '00'}`
    };
  } catch (_error) {
    const fallback = new Date(timestamp);
    return {
      hours: fallback.getHours(),
      minutes: fallback.getMinutes(),
      seconds: fallback.getSeconds(),
      label: fallback.toLocaleTimeString('en-GB', { hour12: false })
    };
  }
};

const formatCountdown = (totalSeconds) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const PERIODIC_DAY_START_MINUTES = 7 * 60;
const PERIODIC_DAY_END_MINUTES = 22 * 60;

const buildTimelineMeta = (habit, habitIndex, plannerTimes = []) => {
  const isPeriodic = habit.habitType === 'periodic';
  const suggestedMinutes = isPeriodic ? 8 * 60 : (16 * 60) + (habitIndex * 45);
  const startMinutes = timeToMinutes(habit.scheduleTime, suggestedMinutes);
  const durationMinutes = Math.max(5, Number(habit.durationMinutes) || 30);
  const occurrences = isPeriodic ? Math.max(2, Number(habit.periodicOccurrences) || 4) : 1;
  const validPlannerTimes = [...new Set(plannerTimes)]
    .filter((time) => /^\d{2}:\d{2}$/.test(time))
    .sort((left, right) => left.localeCompare(right));
  const hasPlannerSchedule = isPeriodic
    ? validPlannerTimes.length === occurrences
    : validPlannerTimes.length > 0;
  if (hasPlannerSchedule) {
    const plannerStartMinutes = timeToMinutes(validPlannerTimes[0], suggestedMinutes);
    return {
      startMinutes: plannerStartMinutes,
      timeLabel: formatTime(validPlannerTimes[0]),
      durationMinutes,
      occurrenceTimes: isPeriodic ? validPlannerTimes : [validPlannerTimes[0]],
      periodicTimingAdjusted: false,
      fromPlanner: true,
      isSuggested: false
    };
  }
  const requestedIntervalMinutes = Math.max(30, (Number(habit.periodicIntervalHours) || 4) * 60);
  const maximumIntervalMinutes = Math.floor(
    (PERIODIC_DAY_END_MINUTES - PERIODIC_DAY_START_MINUTES) / Math.max(1, occurrences - 1)
  );
  const intervalMinutes = isPeriodic
    ? Math.min(requestedIntervalMinutes, maximumIntervalMinutes)
    : requestedIntervalMinutes;
  const latestStartMinutes = PERIODIC_DAY_END_MINUTES - (intervalMinutes * (occurrences - 1));
  const adjustedStartMinutes = isPeriodic
    ? Math.min(
        Math.max(PERIODIC_DAY_START_MINUTES, startMinutes),
        Math.max(PERIODIC_DAY_START_MINUTES, latestStartMinutes)
      )
    : startMinutes;

  return {
    startMinutes: adjustedStartMinutes,
    timeLabel: formatTime(minutesToTime(adjustedStartMinutes)),
    durationMinutes,
    occurrenceTimes: Array.from({ length: occurrences }, (_, index) => (
      minutesToTime(adjustedStartMinutes + (index * intervalMinutes))
    )),
    intervalHours: intervalMinutes / 60,
    periodicTimingAdjusted: isPeriodic && (
      adjustedStartMinutes !== startMinutes || intervalMinutes !== requestedIntervalMinutes
    ),
    fromPlanner: false,
    isSuggested: !habit.scheduleTime
  };
};

const StudentChecklistSection = ({
  isMember,
  isLeader,
  myMemberHabit,
  timeUntilMidnight,
  editingHabits,
  ticking,
  numericValues,
  textValues,
  tempNumericValues,
  tempTextValues,
  getLinkedGoalTitle,
  isHabitAvailableToday,
  getNextAvailableDay,
  groupId,
  studentId,
  challengeId,
  schoolTimetable = [],
  workspaceType = 'school',
  onOpenPlanner,
  onRefresh,
  showPageToast,
  handleStartEdit,
  handleCancelEdit,
  handleToggleHabit,
  handleStudentNumericUpdate,
  handleStudentNumericSubmit,
  handleStudentTextUpdate,
  handleStudentTextSubmit
}) => {
  const isFootballWorkspace = workspaceType === 'football';
  const [plannerItems, setPlannerItems] = useState([]);
  const [completionWindows, setCompletionWindows] = useState({});
  const [completionWindowsLoaded, setCompletionWindowsLoaded] = useState(false);
  const [completionPolicy, setCompletionPolicy] = useState(null);
  const [completionClock, setCompletionClock] = useState(() => Date.now());
  const [ipWalletBalance, setIpWalletBalance] = useState(0);
  const [restoreConfirmIndex, setRestoreConfirmIndex] = useState(null);
  const [restoringHabitIndex, setRestoringHabitIndex] = useState(null);
  const [streakNotice, setStreakNotice] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCompletionClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!groupId || !studentId) {
      setPlannerItems([]);
      setCompletionWindows({});
      setCompletionWindowsLoaded(false);
      setCompletionPolicy(null);
      setIpWalletBalance(0);
      return undefined;
    }
    setCompletionWindowsLoaded(false);
    let cancelled = false;
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentSchoolItems = schoolTimetable
      .filter((entry) => entry.weekday === weekday)
      .filter((entry) => {
        const studentIds = (entry.studentIds || []).map(Number);
        return !studentIds.length || studentIds.includes(Number(studentId));
      })
      .map((entry) => ({
        id: `school-${entry.id}`,
        title: [entry.subject || 'School', entry.className].filter(Boolean).join(' · '),
        itemType: 'school',
        startTime: entry.startTime,
        endTime: entry.endTime,
        reason: [entry.teacherName, entry.room].filter(Boolean).join(' · ') || 'School timetable'
      }));
    const settingsEndpoint = `/groups/${groupId}/students/${studentId}/planner-settings`;
    axios.get(settingsEndpoint)
      .then(async (settingsResponse) => ({
        ...settingsResponse,
        data: {
          ...settingsResponse.data,
          settings: await syncDeviceTimezone(
            axios,
            settingsEndpoint,
            settingsResponse.data?.settings || {}
          )
        }
      }))
      .catch(() => ({ data: { settings: {} } }))
      .then((settingsResponse) => Promise.allSettled([
        axios.get(`/groups/${groupId}/students/${studentId}/schedule`, { params: { date } }),
        Promise.resolve(settingsResponse),
        axios.get('/groups/ip-wallet')
      ]))
      .then(([scheduleResult, settingsResult, walletResult]) => {
        if (cancelled) return;
        setCompletionWindows(
          scheduleResult.status === 'fulfilled'
            ? (scheduleResult.value.data?.completionWindows || {})
            : {}
        );
        setCompletionWindowsLoaded(scheduleResult.status === 'fulfilled');
        setCompletionPolicy(
          scheduleResult.status === 'fulfilled'
            ? {
                ...(scheduleResult.value.data?.completionPolicy || {}),
                receivedAt: Date.now()
              }
            : null
        );
        const settings = settingsResult.status === 'fulfilled' ? (settingsResult.value.data?.settings || {}) : {};
        setIpWalletBalance(
          walletResult.status === 'fulfilled'
            ? Number(walletResult.value.data?.wallet?.balance) || 0
            : 0
        );
        const scheduleItems = scheduleResult.status === 'fulfilled' ? (scheduleResult.value.data?.plan?.items || []) : [];
        const wakeTime = settings.wakeTime || '07:00';
        const bedtime = settings.bedtime || '22:00';
        const sleepItems = [
          { id: 'sleep-morning', title: 'Sleep', itemType: 'sleep', startTime: '06:00', endTime: wakeTime, reason: `Wake up at ${wakeTime}` },
          { id: 'sleep-evening', title: 'Sleep', itemType: 'sleep', startTime: bedtime, endTime: '23:00', reason: `Bedtime at ${bedtime}` }
        ];
        const routineOverrides = new Map(
          scheduleItems
            .filter((item) => item.itemType === 'routine' && (item.routineOverride || item.source === 'routine-override'))
            .map((item) => [String(item.routineId), item])
        );
        const routineItems = (settings.recurringReminders || [])
          .filter((reminder) => (
            (reminder.weekdays || []).includes(weekday)
            && date >= String(reminder.createdDate || date).slice(0, 10)
          ))
          .map((reminder) => ({
            id: `routine-${reminder.id}`,
            routineId: reminder.id,
            title: reminder.title,
            itemType: 'routine',
            startTime: reminder.startTime,
            endTime: reminder.endTime,
            reason: 'Your weekly reminder · No completion needed'
          }))
          .map((item) => {
            const override = routineOverrides.get(String(item.routineId));
            return override ? { ...item, ...override, id: item.id, itemType: 'routine' } : item;
          });
        const validHabitIndexes = new Set(
          (myMemberHabit?.habits || [])
            .map((habit, habitIndex) => ({ habit, habitIndex }))
            .filter(({ habit }) => !(habit.scheduleDays || []).length || habit.scheduleDays.includes(weekday))
            .map(({ habitIndex }) => habitIndex)
        );
        const weeklyTemplateItems = scheduleItems.length ? [] : (settings.aiWeeklyTemplates?.[weekday] || [])
          .filter((item) => item.itemType === 'break' || (
            item.itemType === 'habit' && validHabitIndexes.has(Number(item.habitIndex))
          ))
          .map((item, itemIndex) => ({
            ...item,
            id: `weekly-ai-${weekday}-${item.itemType}-${item.habitIndex ?? -1}-${itemIndex}`,
            reason: item.reason || 'Your recurring AI plan'
          }));
        const savedPersonalItems = scheduleItems.filter((item) => !['school', 'sleep', 'routine'].includes(item.itemType));
        setPlannerItems([
          ...currentSchoolItems,
          ...sleepItems,
          ...routineItems,
          ...weeklyTemplateItems,
          ...savedPersonalItems
        ].sort((left, right) => String(left.startTime || '').localeCompare(String(right.startTime || ''))));
      })
      .catch(() => {
        if (!cancelled) {
          setPlannerItems(currentSchoolItems);
          setCompletionWindows({});
          setCompletionWindowsLoaded(false);
          setCompletionPolicy(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, studentId, schoolTimetable, myMemberHabit]);

  const restoreHabitStreak = async (habitIndex) => {
    if (!groupId || !challengeId || restoringHabitIndex !== null) return;
    try {
      setRestoringHabitIndex(habitIndex);
      const response = await axios.post(
        `/groups/${groupId}/challenge/${challengeId}/habit/${habitIndex}/restore-streak`,
        {}
      );
      const nextBalance = Number(response.data?.wallet?.balance) || 0;
      setIpWalletBalance(nextBalance);
      window.dispatchEvent(new CustomEvent('ip-bucks-updated', { detail: { balance: nextBalance } }));
      setCompletionWindows((previous) => ({
        ...previous,
        [String(habitIndex)]: {
          ...(previous[String(habitIndex)] || {}),
          streakRestore: response.data?.streakRestore || {
            eligible: false,
            alreadyRestored: true
          }
        }
      }));
      setRestoreConfirmIndex(null);
      setStreakNotice({ type: 'success', message: response.data?.message || 'Your streak is protected.' });
      showPageToast?.('success', 'Streak protected', response.data?.message || 'Your streak is protected.');
      await onRefresh?.();
    } catch (error) {
      const message = error.response?.data?.error || 'Your streak could not be restored.';
      setStreakNotice({ type: 'error', message });
      showPageToast?.('error', 'Could not protect streak', message);
      if (error.response?.data?.wallet) {
        const nextBalance = Number(error.response.data.wallet.balance) || 0;
        setIpWalletBalance(nextBalance);
        window.dispatchEvent(new CustomEvent('ip-bucks-updated', { detail: { balance: nextBalance } }));
      }
    } finally {
      setRestoringHabitIndex(null);
    }
  };

  if (!(isMember && !isLeader && myMemberHabit)) return null;

  const now = new Date();
  const serverNow = Date.parse(completionPolicy?.serverNow || '');
  const serverClockOffset = Number.isFinite(serverNow)
    ? serverNow - (completionPolicy?.receivedAt || completionClock)
    : 0;
  const trustedNow = completionClock + serverClockOffset;
  const schoolTimezone = completionPolicy?.timezone || 'Europe/London';
  const schoolClock = getZonedClockParts(trustedNow, schoolTimezone);
  const schoolSecondsElapsed = (schoolClock.hours * 3600) + (schoolClock.minutes * 60) + schoolClock.seconds;
  const schoolTimeUntilReset = formatCountdown((24 * 3600) - schoolSecondsElapsed);
  const schoolTimeLabel = 'Your time';
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const plannerTimesByHabit = plannerItems
    .filter((item) => item.itemType === 'habit' && Number(item.habitIndex) >= 0 && item.startTime)
    .reduce((timesByHabit, item) => {
      const habitIndex = Number(item.habitIndex);
      timesByHabit[habitIndex] = [...(timesByHabit[habitIndex] || []), item.startTime];
      return timesByHabit;
    }, {});
  const timelineHabits = (myMemberHabit.habits || [])
    .map((habit, habitIndex) => {
      const timeline = buildTimelineMeta(habit, habitIndex, plannerTimesByHabit[habitIndex] || []);
      if (habit.habitType !== 'periodic') {
        return { habit, habitIndex, isAvailable: isHabitAvailableToday(habit), timeline };
      }
      const progressEntry = (habit.progress || []).find(
        (progress) => progress.date?.slice(0, 10) === localToday
      );
      const completedOccurrences = Math.max(0, Number(progressEntry?.periodicCompleted) || 0);
      const targetOccurrences = Math.max(2, Number(habit.periodicOccurrences) || 4);
      const completionWindow = completionWindows[String(habitIndex)] || {};
      const availableWindows = (completionWindow.windows || []).filter((window) => window.eligible !== false && !window.logged);
      const dynamicWindow = availableWindows.find((window) => (
        new Date(window.opensAt).getTime() <= trustedNow && trustedNow <= new Date(window.closesAt).getTime()
      )) || availableWindows.find((window) => trustedNow < new Date(window.opensAt).getTime());
      const occurrenceIndex = Math.min(
        Number(
          dynamicWindow?.occurrenceIndex
          ?? completedOccurrences
        ),
        Math.max(0, timeline.occurrenceTimes.length - 1)
      );
      const activeOccurrenceTime = timeline.occurrenceTimes[occurrenceIndex] || timeline.occurrenceTimes[0];
      return {
        habit,
        habitIndex,
        isAvailable: isHabitAvailableToday(habit),
        timeline: {
          ...timeline,
          startMinutes: timeToMinutes(activeOccurrenceTime, timeline.startMinutes),
          timeLabel: formatTime(activeOccurrenceTime),
          completedOccurrences,
          targetOccurrences,
          activeOccurrenceNumber: Math.min(occurrenceIndex + 1, targetOccurrences)
        }
      };
    })
    .sort((left, right) => (
      Number(right.isAvailable) - Number(left.isAvailable)
      || left.timeline.startMinutes - right.timeline.startMinutes
      || left.habitIndex - right.habitIndex
  ));
  const availableCount = timelineHabits.filter((entry) => entry.isAvailable).length;
  const progressToday = (habit) => {
    const progressEntry = (habit.progress || []).find((progress) => progress.date?.slice(0, 10) === localToday);
    return calculateHabitProgress(habit, progressEntry);
  };
  const isCompletedToday = (habit) => progressToday(habit) >= 100;
  const completedCount = timelineHabits.filter((entry) => (
    entry.isAvailable && isCompletedToday(entry.habit)
  )).length;
  const availableHabits = timelineHabits.filter((entry) => entry.isAvailable);
  const restDayHabits = timelineHabits.filter((entry) => !entry.isAvailable);
  const completionWindowPhase = (habitIndex) => {
    const access = completionWindows[String(habitIndex)];
    if (!access || ['not-scheduled', 'not-applicable'].includes(access.status)) return access?.status || 'loading';
    const availableWindows = (access.windows || []).filter((window) => window.eligible !== false);
    if (availableWindows.some((window) => (
      new Date(window.opensAt).getTime() <= trustedNow && trustedNow <= new Date(window.closesAt).getTime()
    ))) return 'open';
    if (availableWindows.some((window) => trustedNow < new Date(window.opensAt).getTime())) return 'upcoming';
    return (access.windows || []).some((window) => window.eligible !== false) ? 'closed' : 'not-applicable';
  };
  const closedHabits = availableHabits.filter((entry) => completionWindowPhase(entry.habitIndex) === 'closed');
  const liveHabits = availableHabits.filter((entry) => completionWindowPhase(entry.habitIndex) !== 'closed');
  const incompleteLiveHabits = liveHabits.filter((entry) => !isCompletedToday(entry.habit));
  const nextHabitIndex = (
    incompleteLiveHabits.find((entry) => completionWindowPhase(entry.habitIndex) === 'open')
    || incompleteLiveHabits.find((entry) => completionWindowPhase(entry.habitIndex) === 'upcoming')
    || incompleteLiveHabits[0]
  )?.habitIndex;
  const scheduleEvents = plannerItems
    .filter((item) => item.itemType !== 'habit' && item.startTime)
    .map((item) => {
      const isMorningSleep = item.itemType === 'sleep' && item.id === 'sleep-morning';
      const isEveningSleep = item.itemType === 'sleep' && item.id === 'sleep-evening';
      const eventTime = isMorningSleep ? item.endTime : item.startTime;
      return {
        kind: 'event',
        event: {
          ...item,
          title: isMorningSleep ? 'Wake up' : isEveningSleep ? 'Go to sleep' : item.title,
          eventType: isMorningSleep ? 'wake' : isEveningSleep ? 'bedtime' : item.itemType
        },
        timeline: {
          startMinutes: timeToMinutes(eventTime, 7 * 60),
          timeLabel: formatTime(eventTime),
          durationMinutes: Math.max(5, timeToMinutes(item.endTime, 0) - timeToMinutes(item.startTime, 0))
        }
      };
    });
  const availableTimelineEntries = [
    ...liveHabits.map((entry) => ({ ...entry, kind: 'habit' })),
    ...scheduleEvents
  ].sort((left, right) => left.timeline.startMinutes - right.timeline.startMinutes);
  const completionUnits = availableHabits.reduce((total, entry) => total + (progressToday(entry.habit) / 100), 0);
  const completionPercent = availableCount ? Math.round((completionUnits / availableCount) * 100) : 0;

  const renderTimeline = (entries, isRestDay = false) => (
    <div className="space-y-1">
      {entries.map((entry, timelineIndex) => {
        const { habit, habitIndex, timeline, event } = entry;
        const isEvent = entry.kind === 'event';
        const isNext = !isEvent && !isRestDay && habitIndex === nextHabitIndex;
        const eventTone = event?.eventType === 'school'
          ? 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-50'
          : ['wake', 'bedtime'].includes(event?.eventType)
            ? 'border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-300/20 dark:bg-yellow-400/10 dark:text-yellow-50'
            : event?.eventType === 'break'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-50'
              : event?.eventType === 'routine'
                ? 'border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-400/20 dark:bg-teal-500/10 dark:text-teal-50'
                : 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-50';
        const EventIcon = event?.eventType === 'wake'
          ? FiSun
          : event?.eventType === 'bedtime'
            ? FiMoon
            : event?.eventType === 'school'
              ? FiBookOpen
              : event?.eventType === 'break'
                ? FiCoffee
                : FiCalendar;
        return (
          <div key={isEvent ? `event-${event.id}-${event.eventType}` : `habit-${habitIndex}`} className="grid grid-cols-[52px_14px_minmax(0,1fr)] gap-2 sm:grid-cols-[92px_22px_minmax(0,1fr)] sm:gap-3">
            <div className="pt-4 text-right">
              <div className={`text-xs font-black sm:text-base ${isRestDay ? 'text-slate-400 dark:text-slate-500' : 'text-slate-950 dark:text-white'}`}>
                {isRestDay ? 'Rest' : timeline.timeLabel}
              </div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">
                {isEvent
                  ? event.eventType === 'wake' ? 'Morning' : event.eventType === 'bedtime' ? 'Night' : event.eventType
                  : isRestDay
                  ? getNextAvailableDay(habit)?.day || 'Not today'
                  : isNext
                    ? habit.habitType === 'periodic'
                      ? `${timeline.activeOccurrenceNumber}/${timeline.targetOccurrences} ${completionWindowPhase(habitIndex) === 'open' ? 'open' : 'next'}`
                      : completionWindowPhase(habitIndex) === 'open' ? 'Open now' : 'Coming up'
                    : timeline.isSuggested ? 'Suggested' : `${timeline.durationMinutes}m`}
              </div>
            </div>

            <div className="relative flex justify-center">
              {timelineIndex < entries.length - 1 ? (
                <span className={`absolute bottom-0 top-7 w-px ${isRestDay ? 'bg-slate-200 dark:bg-white/10' : 'bg-gradient-to-b from-violet-300 to-cyan-200 dark:from-violet-400/40 dark:to-cyan-400/20'}`} />
              ) : null}
              <span className={`relative mt-5 h-2.5 w-2.5 rounded-full border-2 ring-4 sm:h-3 sm:w-3 sm:border-[3px] ${
                isEvent && ['wake', 'bedtime'].includes(event.eventType)
                  ? 'border-yellow-500 bg-white ring-yellow-100 dark:bg-slate-950 dark:ring-yellow-400/20'
                  : isEvent && event.eventType === 'school'
                    ? 'border-blue-500 bg-white ring-blue-100 dark:bg-slate-950 dark:ring-blue-400/20'
                    : isNext
                  ? 'border-amber-500 bg-white ring-amber-100 dark:bg-slate-950 dark:ring-amber-500/20'
                  : isRestDay
                    ? 'border-slate-300 bg-slate-100 ring-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/5'
                    : 'border-violet-600 bg-white ring-violet-100 dark:bg-slate-950 dark:ring-violet-500/15'
              }`} />
            </div>

            <div className={`pb-3 sm:pb-4 ${isNext ? 'my-1 rounded-[1.35rem] ring-2 ring-amber-300/80 ring-offset-4 ring-offset-white shadow-[0_18px_45px_rgba(245,158,11,0.16)] dark:ring-amber-400/40 dark:ring-offset-[#081024]' : ''}`}>
              {isEvent ? (
                <div className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${eventTone}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm dark:bg-white/10"><EventIcon className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="font-black">{event.title}</p>
                      <p className="mt-1 text-xs font-semibold opacity-75">
                        {event.eventType === 'wake'
                          ? 'Start your day on time.'
                          : event.eventType === 'bedtime'
                            ? 'Protect tomorrow by winding down now.'
                            : `Until ${formatTime(event.endTime)}${event.reason ? ` · ${event.reason}` : ''}`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <StudentHabitCard
                  habit={habit}
                  habitIndex={habitIndex}
                  timelineMeta={timeline}
                  completionWindow={completionWindows[String(habitIndex)]}
                  completionWindowsLoaded={completionWindowsLoaded}
                  completionClock={trustedNow}
                  featured={isNext}
                  isEditing={editingHabits[habitIndex]}
                  ticking={ticking[habitIndex]}
                  numericValue={numericValues[habitIndex]}
                  textValue={textValues[habitIndex]}
                  tempNumericValue={tempNumericValues[habitIndex]}
                  tempTextValue={tempTextValues[habitIndex]}
                  linkedGoalTitle={getLinkedGoalTitle(habit)}
                  isHabitAvailableToday={isHabitAvailableToday}
                  getNextAvailableDay={getNextAvailableDay}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onToggleHabit={handleToggleHabit}
                  onNumericUpdate={handleStudentNumericUpdate}
                  onNumericSubmit={handleStudentNumericSubmit}
                  onTextUpdate={handleStudentTextUpdate}
                  onTextSubmit={handleStudentTextSubmit}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const closedCompletedCount = closedHabits.filter((entry) => isCompletedToday(entry.habit)).length;
  const renderClosedHabits = () => (
    <details className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.025]">
      <summary className="group flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="font-black text-slate-800 dark:text-white">Closed habit windows · {closedHabits.length}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{closedCompletedCount} completed · {closedHabits.length - closedCompletedCount} missed or partial</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm transition group-open:rotate-180 dark:bg-white/[0.06] dark:text-slate-300">
          <FiChevronDown />
        </span>
      </summary>
      <div className="space-y-2 border-t border-slate-200 p-3 dark:border-white/10 sm:p-4">
        {closedHabits.map(({ habit, habitIndex, timeline }) => {
          const progressEntry = (habit.progress || []).find((entry) => entry.date?.slice(0, 10) === localToday);
          const progressPercent = Math.round(calculateHabitProgress(habit, progressEntry));
          const completed = progressPercent >= 100;
          const restoreOffer = completionWindows[String(habitIndex)]?.streakRestore || {};
          const restored = Boolean(progressEntry?.streakRestored || restoreOffer.alreadyRestored);
          const restoreCost = Number(restoreOffer.cost) || 0;
          const canRestore = !completed && !restored && Number(restoreOffer.atRiskStreak) > 0 && restoreCost > 0;
          const canAfford = ipWalletBalance >= restoreCost;
          const confirming = restoreConfirmIndex === habitIndex;
          const restoring = restoringHabitIndex === habitIndex;
          const statusDetail = completed
            ? 'Completed inside the verified window'
            : progressPercent > 0
              ? `${progressPercent}% completed before the window closed`
              : 'Not completed before the window closed';
          return (
            <div key={`closed-${habitIndex}`} className={`rounded-2xl border p-3 sm:p-4 ${completed ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/20 dark:bg-emerald-500/10' : 'border-rose-200 bg-rose-50/80 dark:border-rose-400/20 dark:bg-rose-500/10'}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${completed ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {completed ? <FiCheck className="h-5 w-5" /> : <FiX className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-950 dark:text-white">{habit.name}</p>
                      <p className={`mt-1 text-xs font-bold ${completed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{statusDetail}</p>
                    </div>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm dark:bg-white/[0.07] dark:text-slate-300">{timeline.timeLabel}</span>
                  </div>
                  {restored ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
                      <HiOutlineFire /> Streak protected · result still recorded as {completed ? 'complete' : progressPercent > 0 ? 'partial' : 'missed'}
                    </div>
                  ) : null}
                  {canRestore ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-300/20 dark:bg-black/10">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200"><HiOutlineFire /> Protect your {restoreOffer.atRiskStreak}-occasion streak</p>
                          <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">This protects momentum only. The missed result and statistics stay honest.</p>
                        </div>
                        {confirming ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <button type="button" onClick={() => setRestoreConfirmIndex(null)} disabled={restoring} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">Cancel</button>
                            <button type="button" onClick={() => restoreHabitStreak(habitIndex)} disabled={restoring || !canAfford} className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45">{restoring ? 'Protecting…' : 'Confirm spend'}</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setRestoreConfirmIndex(habitIndex)} disabled={!canAfford || restoringHabitIndex !== null} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-slate-950">
                            {canAfford ? <>Protect for <IpBuck amount={restoreCost} compact /></> : <>Need {restoreCost - ipWalletBalance} more IP Bucks</>}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );

  return (
    <section className="mb-6 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:mb-10 sm:rounded-[2rem]">
      <div className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-4 dark:border-white/10 dark:from-violet-500/10 dark:via-transparent dark:to-cyan-400/5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <img src="/images/student/my-day-ready.webp" alt="" aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[38%] object-cover opacity-[0.16] dark:opacity-25 lg:block" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">My Day timeline</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Move through today with purpose</h2>
            <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:block">
              Your available habits are ordered by time. Habits that are not due today stay visible without affecting your streak.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-white/[0.05] dark:text-emerald-300">
              <FiCheckCircle className="h-4 w-4" /> {completedCount}/{availableCount} full · {completionPercent}% progress
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-cyan-700 dark:border-cyan-400/20 dark:bg-white/[0.05] dark:text-cyan-200">
              <FiClock className="h-4 w-4" /> {schoolTimeLabel} {schoolClock.label}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-violet-700 dark:border-violet-400/20 dark:bg-white/[0.05] dark:text-violet-200">
              <FiClock className="h-4 w-4" /> {completionPolicy ? schoolTimeUntilReset : timeUntilMidnight} to reset
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80 shadow-inner dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all duration-500" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6">
        {streakNotice ? (
          <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${streakNotice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200'}`}>
            <span>{streakNotice.message}</span>
            <button type="button" onClick={() => setStreakNotice(null)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss message"><FiX /></button>
          </div>
        ) : null}
        {timelineHabits.length || scheduleEvents.length ? (
          <>
            {availableTimelineEntries.length ? renderTimeline(availableTimelineEntries) : (
              <div className="rounded-2xl bg-emerald-50 px-4 py-6 text-center dark:bg-emerald-500/10">
                <p className="font-black text-emerald-800 dark:text-emerald-200">No habits are due today</p>
                <p className="mt-1 text-sm text-emerald-700/70 dark:text-emerald-300/70">Use the space to recover and prepare for your next scheduled day.</p>
              </div>
            )}
            {closedHabits.length ? renderClosedHabits() : null}
            {restDayHabits.length ? (
              <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.025]">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                  Not scheduled today · {restDayHabits.length}
                </summary>
                <div className="border-t border-slate-200 p-3 dark:border-white/10">{renderTimeline(restDayHabits, true)}</div>
              </details>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center dark:border-white/15 dark:bg-white/[0.025]">
            <img src="/images/empty-states/no-habits.webp" alt="A calm Inner Performance space waiting for the first habits" className="mx-auto mb-5 h-40 w-full max-w-md rounded-[1.25rem] object-cover" />
            <p className="font-bold text-slate-800 dark:text-white">No habits have been assigned yet.</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your timeline will appear here when your challenge begins.</p>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-cyan-50 p-3.5 dark:border-violet-400/20 dark:from-violet-500/10 dark:to-cyan-400/5 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/20">
              <FiCalendar className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-black text-slate-950 dark:text-white">Need to reorganise today?</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{isFootballWorkspace ? 'Open My Planner to move habits around training, matches and recovery, or let AI rebuild your day.' : 'Open My Planner to move habits around your lessons or let AI rebuild your day.'}</p>
            </div>
          </div>
          <button type="button" onClick={onOpenPlanner} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-700 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">
            Open My Planner <FiArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default StudentChecklistSection;
