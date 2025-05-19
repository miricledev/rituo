import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e42', '#ef4444', '#a78bfa', '#f472b6'];

const Archives = () => {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArchives = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/analytics/archives`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setArchives(res.data.archives || []);
      } catch (err) {
        setArchives([]);
      } finally {
        setLoading(false);
      }
    };
    fetchArchives();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!archives.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white dark:bg-secondary-800 rounded-lg shadow-card p-8 mt-8">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-primary-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6 4.5A9 9 0 11.75 12 9 9 0 0121 18.5z" />
        </svg>
        <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">No Completed Challenges Yet</h2>
        <p className="text-secondary-600 dark:text-secondary-300 mb-4">Complete a 30-day challenge to see your achievements and analytics here!</p>
        <Link to="/dashboard" className="btn btn-primary px-6 py-2">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-primary-50 dark:bg-secondary-900 transition-colors duration-200">
      <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-8">Archives: Completed 30-Day Challenges</h1>
      <div className="space-y-12">
        {archives.map((archive, idx) => (
          <div key={archive.cycle_id || idx} className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6">
            <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-primary-600 dark:text-primary-400">{archive.title || `Challenge #${idx + 1}`}</h2>
                <p className="text-secondary-600 dark:text-secondary-300 mt-1">{archive.cycle_start_date} - {archive.cycle_end_date}</p>
              </div>
              <div className="mt-4 md:mt-0">
                <span className="inline-block bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-xs font-semibold">Completed</span>
              </div>
            </div>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{archive.days_completed}</div>
                <div className="text-sm text-secondary-600 dark:text-secondary-300">Days Completed</div>
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{archive.completion_rate.toFixed(1)}%</div>
                <div className="text-sm text-secondary-600 dark:text-secondary-300">Completion Rate</div>
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{archive.current_streak}</div>
                <div className="text-sm text-secondary-600 dark:text-secondary-300">Longest Streak</div>
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{archive.tasks.length}</div>
                <div className="text-sm text-secondary-600 dark:text-secondary-300">Tasks</div>
              </div>
            </div>
            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Bar Chart: Task Completion */}
              <div className="bg-white dark:bg-secondary-900 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-secondary-900 dark:text-white">Task Completion</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={archive.tasks}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="title" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tickFormatter={tick => `${tick.toFixed(1)}%`} />
                    <Tooltip formatter={v => `${Number(v).toFixed(1)}%`} />
                    <Bar dataKey="completion_rate" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Pie Chart: Task Distribution */}
              <div className="bg-white dark:bg-secondary-900 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-secondary-900 dark:text-white">Task Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={archive.tasks} dataKey="completion_rate" nameKey="title" cx="50%" cy="50%" outerRadius={70} label={({ completion_rate }) => `${Number(completion_rate).toFixed(1)}%`}>
                      {archive.tasks.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `${Number(v).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Line Chart: Daily Completion */}
              <div className="bg-white dark:bg-secondary-900 rounded-lg p-4 shadow md:col-span-2">
                <h3 className="text-lg font-semibold mb-2 text-secondary-900 dark:text-white">Daily Completion History</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={archive.daily_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tickFormatter={tick => `${tick.toFixed(1)}%`} />
                    <Tooltip formatter={v => `${Number(v).toFixed(1)}%`} />
                    <Line 
                      type="monotone" 
                      dataKey="is_complete" 
                      stroke="#22c55e" 
                      strokeWidth={2} 
                      dot={{ r: 4 }}
                      name="Completion Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Radar Chart: Task Strengths */}
              <div className="bg-white dark:bg-secondary-900 rounded-lg p-4 shadow md:col-span-2">
                <h3 className="text-lg font-semibold mb-2 text-secondary-900 dark:text-white">Task Strengths</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={archive.tasks}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="title" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tickFormatter={tick => `${tick.toFixed(1)}%`} />
                    <Radar name="Completion Rate" dataKey="completion_rate" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.6} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Task List */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-2 text-secondary-900 dark:text-white">Tasks</h4>
              <ul className="divide-y divide-gray-200 dark:divide-secondary-700">
                {archive.tasks.map((task, i) => (
                  <li key={i} className="py-2 flex items-center justify-between">
                    <span className="font-medium text-secondary-800 dark:text-white">{task.title}</span>
                    <span className="text-sm px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">{Number(task.completion_rate).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Archives; 