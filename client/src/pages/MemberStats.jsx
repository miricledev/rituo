import React, { Suspense, lazy, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TaskStats from './TaskStats';
import TaskProgress from '../components/TaskProgress';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  formatDateLocal,
  getNextAvailableDayFromDate,
  isHabitScheduledForDay,
  parseDateLocal
} from '../utils/habitScheduleUtils';

const HabitCalendar = lazy(() => import('../components/HabitCalendar'));

const MemberStats = () => {
  const { groupId, memberId } = useParams();
  const [group, setGroup] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const navigate = useNavigate();
  const { currentUser: user } = useAuth();
  const [selectedSection, setSelectedSection] = useState('overview'); // 'overview', 'calendar', or habit index
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/groups/${groupId}`);
      setGroup(response.data.group);
    } catch (err) {
      setError('Failed to load group data.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  // Function to update habit for a specific day (boolean, numeric, or text)
  const updateHabitDay = async (habitIndex, date, updateData) => {
    try {
      setSaving(true);
      await axios.post(
        `/groups/${groupId}/challenge/${group.activeChallenge.id}/member/${memberId}/habit/${habitIndex}/toggle-day`,
        {
          date: date,
          ...updateData  // Can include: completed, numericValue, textValue
        }
      );
      // Refresh group data to show the change
      await fetchGroupDetails();
    } catch (err) {
      console.error('Error updating habit:', err);
      setError('Failed to update habit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Find the member and their habits
  const memberHabit = useMemo(() => {
    if (!group?.activeChallenge?.memberHabits) return null;
    return group.activeChallenge.memberHabits.find(
      mh => String(mh.member) === String(memberId) || String(mh.member?.id) === String(memberId)
    );
  }, [group, memberId]);

  const member = useMemo(() => {
    if (!group?.members) return null;
    return group.members.find(m => String(m.id) === String(memberId));
  }, [group, memberId]);

  // Check if current user is the group leader
  const isLeader = useMemo(() => {
    if (!group?.leader || !user) return false;
    return String(group.leader.id) === String(user.id);
  }, [group, user]);

  // Calculate challenge dates and days
  const startDate = group?.activeChallenge?.startDate;
  const endDate = group?.activeChallenge?.endDate;
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = startDate && endDate
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  const daysRemaining = endDate
    ? Math.max(0, Math.ceil((new Date(endDate) - new Date(today)) / (1000 * 60 * 60 * 24)))
    : 0;

  // Transform memberHabit data for TaskProgress and TaskStats
  const analytics = useMemo(() => {
    if (!memberHabit) return null;
    // For each habit, for each day from challenge start to today, if no progress entry exists, count as missed.
    // This affects days_completed, completion_rate, streak, and daily_data.
    const allDates = [];
    if (startDate && endDate) {
      let d = new Date(startDate);
      const endBound = new Date(Math.min(new Date(endDate).getTime(), new Date().getTime()));
      while (d <= endBound) {
        allDates.push(formatDateLocal(d));
        d.setDate(d.getDate() + 1);
      }
    }
    // For each habit, build a map of date->progress
    const tasks_stats = memberHabit.habits.map((habit, idx) => {
      let days_completed = 0;
      let days_scheduled = 0; // Count days where habit is scheduled
      let streak = 0;
      let currentStreak = 0;
      let lastMissed = false;
      const progressMap = {};
      (habit.progress || []).forEach(p => {
        progressMap[formatDateLocal(parseDateLocal(p.date))] = p.completed;
      });
      allDates.forEach(dateStr => {
        // Only count days where habit is scheduled
        const isScheduled = isHabitScheduledForDay(habit, dateStr);
        if (isScheduled) {
          days_scheduled++;
          if (progressMap[dateStr]) {
            days_completed++;
            if (!lastMissed) currentStreak++;
            else currentStreak = 1;
            lastMissed = false;
          } else {
            lastMissed = true;
            currentStreak = 0;
          }
        }
      });
      streak = currentStreak;
      const completion_rate = days_scheduled > 0 ? days_completed / days_scheduled : 0;
      return {
        task_id: idx,
        title: habit.name,
        days_completed,
        days_scheduled,
        completion_rate,
        current_streak: streak,
      };
    });
    // For overall stats, count unique days where any scheduled habit was completed
    const completedDates = new Set();
    memberHabit.habits.forEach(habit => {
      (habit.progress || []).forEach(p => {
        const dateStr = formatDateLocal(parseDateLocal(p.date));
        // Only count if the habit was scheduled for that day
        if (isHabitScheduledForDay(habit, dateStr)) {
          completedDates.add(dateStr);
        }
      });
    });
    // Calculate days elapsed based on scheduled days only
    let scheduledDates = new Set();
    memberHabit.habits.forEach(habit => {
      allDates.forEach(dateStr => {
        if (isHabitScheduledForDay(habit, dateStr)) {
          scheduledDates.add(dateStr);
        }
      });
    });
    const daysElapsed = scheduledDates.size;
    const daysCompleted = completedDates.size;
    
    // Calculate total scheduled days across all habits
    let totalScheduledDays = 0;
    memberHabit.habits.forEach(habit => {
      allDates.forEach(dateStr => {
        if (isHabitScheduledForDay(habit, dateStr)) {
          totalScheduledDays++;
        }
      });
    });
    
    // Calculate overall completion rate based on total possible completions
    const totalActualCompletions = tasks_stats.reduce((acc, t) => acc + t.days_completed, 0);
    const overallCompletionRate = totalScheduledDays > 0 ? totalActualCompletions / totalScheduledDays : 0;
    return {
      completion_rate: overallCompletionRate * 100,
      current_streak: Math.max(...tasks_stats.map(t => t.current_streak)),
      days_completed: daysCompleted,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      cycle_start_date: startDate,
      cycle_end_date: endDate,
      has_active_cycle: true,
      tasks_stats,
    };
  }, [memberHabit, daysRemaining, startDate, endDate]);

  // Transform each habit for TaskStats
  const transformHabitToTaskStats = (habit) => {
    // For each habit, for each day from challenge start to today, if no progress entry exists, count as missed.
    // This affects days_completed, completion_rate, streak, and daily_data.
    const allDates = [];
    if (startDate && endDate) {
      let d = new Date(startDate);
      const endBound = new Date(Math.min(new Date(endDate).getTime(), new Date().getTime()));
      while (d <= endBound) {
        allDates.push(formatDateLocal(d));
        d.setDate(d.getDate() + 1);
      }
    }
    let days_completed = 0;
    let streak = 0;
    let currentStreak = 0;
    let lastMissed = false;
    const progressMap = {};
    (habit.progress || []).forEach(p => {
      progressMap[formatDateLocal(new Date(p.date))] = p.completed;
    });
    allDates.forEach(dateStr => {
      if (progressMap[dateStr]) {
        days_completed++;
        if (!lastMissed) currentStreak++;
        else currentStreak = 1;
        lastMissed = false;
      } else {
        lastMissed = true;
        currentStreak = 0;
      }
    });
    streak = currentStreak;
    const daysElapsed = allDates.length;
    const completion_rate = daysElapsed > 0 ? days_completed / daysElapsed : 0;
    // Create complete daily data from start date to today (including today)
    const completeDailyData = [];
    if (startDate) {
      let d = new Date(startDate);
      const endBound = new Date(Math.min(new Date(endDate || startDate).getTime(), new Date().getTime()));
      const progressMap = {};
      (habit.progress || []).forEach(p => {
        progressMap[formatDateLocal(parseDateLocal(p.date))] = p.completed;
      });
      while (d <= endBound) {
        const dateStr = formatDateLocal(d);
        const isScheduled = isHabitScheduledForDay(habit, d);
        const nextAvailable = isScheduled ? null : getNextAvailableDayFromDate(habit, d);
        completeDailyData.push({
          date: dateStr,
          is_complete: progressMap[dateStr] !== undefined ? progressMap[dateStr] : false,
          isScheduled: isScheduled,
          nextAvailable: nextAvailable
        });
        d.setDate(d.getDate() + 1);
      }
    }

    return {
      task: {
        title: habit.name,
        description: habit.description,
      },
      days_completed,
      completion_rate,
      current_streak: streak,
      daily_data: completeDailyData,
    };
  };

  // Memoize the transformed task data for the selected habit
  const selectedHabitTaskData = useMemo(() => {
    if (selectedSection === 'overview' || !memberHabit?.habits?.[selectedSection]) {
      return null;
    }
    return transformHabitToTaskStats(memberHabit.habits[selectedSection]);
  }, [selectedSection, memberHabit, startDate, endDate]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[40vh]"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }
  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }
  if (!memberHabit || !member) {
    return <div className="text-yellow-500 p-4">Member or their habits not found.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 transition-colors duration-200 flex flex-col lg:flex-row gap-4 lg:gap-8">
      {/* Sidebar - Mobile: Horizontal scroll, Desktop: Vertical sidebar */}
      <aside className="w-full lg:w-64 bg-white dark:bg-secondary-800 rounded-lg shadow-card p-3 sm:p-4 lg:h-fit lg:sticky lg:top-24 lg:self-start">
        {/* Mobile: Horizontal scrollable tabs */}
        <div className="lg:hidden">
          <div className="flex overflow-x-auto gap-2 pb-2 -mx-3 px-3 scrollbar-hide">
            <button
              className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${selectedSection === 'overview' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300'}`}
              onClick={() => setSelectedSection('overview')}
            >
              Overview
            </button>
            <button
              className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${selectedSection === 'calendar' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300'}`}
              onClick={() => setSelectedSection('calendar')}
            >
              Calendar
            </button>
            {memberHabit.habits.map((habit, idx) => (
              <button
                key={idx}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${selectedSection === idx ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300'}`}
                onClick={() => setSelectedSection(idx)}
              >
                {habit.name}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: Vertical sidebar */}
        <div className="hidden lg:flex lg:flex-col">
          <button
            className={`block w-full text-left px-4 py-2 rounded mb-2 font-semibold ${selectedSection === 'overview' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-secondary-700'}`}
            onClick={() => setSelectedSection('overview')}
          >
            Overview
          </button>
          <button
            className={`block w-full text-left px-4 py-2 rounded mb-2 font-semibold ${selectedSection === 'calendar' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-secondary-700'}`}
            onClick={() => setSelectedSection('calendar')}
          >
            Calendar
          </button>
          <div className="mt-4">
            <div className="text-xs uppercase text-secondary-500 dark:text-secondary-400 mb-2">Habits</div>
            {memberHabit.habits.map((habit, idx) => (
              <button
                key={idx}
                className={`block w-full text-left px-4 py-2 rounded mb-2 ${selectedSection === idx ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-secondary-700'}`}
                onClick={() => setSelectedSection(idx)}
              >
                {habit.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <button onClick={() => navigate(-1)} className="text-sm sm:text-base text-primary-600 hover:underline">&larr; Back to Group</button>
          {isLeader && selectedSection !== 'overview' && selectedSection !== 'calendar' && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                editMode
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                  : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50'
              }`}
              disabled={saving}
            >
              {saving ? '💾 Saving...' : editMode ? '✕ Cancel Edit' : '✏️ Edit Mode'}
            </button>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-2">Stats for {member.username}</h1>
        {selectedSection === 'overview' ? (
          <div>
            <TaskProgress analytics={analytics} />
          </div>
        ) : selectedSection === 'calendar' ? (
          <Suspense fallback={<div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-secondary-500 shadow-card">Loading calendar...</div>}>
            <div>
              <HabitCalendar
                habits={memberHabit.habits}
                startDate={startDate}
                endDate={endDate}
                memberHabit={memberHabit}
              />
            </div>
          </Suspense>
        ) : (
          <TaskStats 
            key={selectedSection} 
            taskData={selectedHabitTaskData} 
            habitData={memberHabit.habits[selectedSection]}
            editMode={editMode}
            onUpdateDay={(date, updateData) => updateHabitDay(selectedSection, date, updateData)}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
};

export default MemberStats;
