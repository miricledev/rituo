import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TaskStats from './TaskStats';
import TaskProgress from '../components/TaskProgress';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// Helper to format date as YYYY-MM-DD in local time
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MemberStats = () => {
  const { groupId, memberId } = useParams();
  const [group, setGroup] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const navigate = useNavigate();
  const { currentUser: user } = useAuth();
  const [selectedSection, setSelectedSection] = useState('overview'); // 'overview' or habit index

  React.useEffect(() => {
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
    fetchGroupDetails();
  }, [groupId]);

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
      const end = new Date(); // Use today for ongoing challenge
      while (d <= end) {
        allDates.push(formatDateLocal(d));
        d.setDate(d.getDate() + 1);
      }
    }
    // For each habit, build a map of date->progress
    const tasks_stats = memberHabit.habits.map((habit, idx) => {
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
      return {
        task_id: idx,
        title: habit.name,
        days_completed,
        completion_rate,
        current_streak: streak,
      };
    });
    // For overall stats, count unique days where any habit was completed
    const completedDates = new Set();
    memberHabit.habits.forEach(habit => {
      (habit.progress || []).forEach(p => {
        completedDates.add(formatDateLocal(new Date(p.date)));
      });
    });
    // Calculate days elapsed (from start date to today, inclusive)
    const daysElapsed = allDates.length;
    const daysCompleted = completedDates.size;
    // Calculate overall completion rate based on total possible completions
    const totalPossibleCompletions = memberHabit.habits.length * daysElapsed;
    const totalActualCompletions = tasks_stats.reduce((acc, t) => acc + t.days_completed, 0);
    const overallCompletionRate = totalPossibleCompletions > 0 ? totalActualCompletions / totalPossibleCompletions : 0;
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
      const end = new Date(); // Use today for ongoing challenge
      while (d <= end) {
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
      const end = new Date();
      const progressMap = {};
      (habit.progress || []).forEach(p => {
        progressMap[formatDateLocal(new Date(p.date))] = p.completed;
      });
      while (d <= end) {
        const dateStr = formatDateLocal(d);
        completeDailyData.push({
          date: dateStr,
          is_complete: progressMap[dateStr] !== undefined ? progressMap[dateStr] : false
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors duration-200 flex gap-8">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-secondary-800 rounded-lg shadow-card p-4 h-fit sticky top-24 self-start flex flex-col">
        <button
          className={`block w-full text-left px-4 py-2 rounded mb-2 font-semibold ${selectedSection === 'overview' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-secondary-700'}`}
          onClick={() => setSelectedSection('overview')}
        >
          Overview
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
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <button onClick={() => navigate(-1)} className="mb-4 text-primary-600 hover:underline">&larr; Back to Group</button>
        <h1 className="text-2xl font-bold mb-2">Stats for {member.username}</h1>
        {selectedSection === 'overview' ? (
          <div className="mb-8">
            <TaskProgress analytics={analytics} />
          </div>
        ) : (
          <TaskStats key={selectedSection} taskData={transformHabitToTaskStats(memberHabit.habits[selectedSection])} />
        )}
      </div>
    </div>
  );
};

export default MemberStats; 