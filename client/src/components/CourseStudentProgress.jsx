import React, { useState, useEffect } from 'react';
import axios from 'axios';

/** Leader: view which students passed/failed the course (below 75% = failed, admin speaks to them) */
const CourseStudentProgress = ({ groupId, challengeId, course }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/groups/${groupId}/challenge/${challengeId}/course/students`)
      .then(res => setStudents(res.data.students || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [groupId, challengeId]);

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  const failed = students.filter(s => !s.passed);
  const passed = students.filter(s => s.passed);

  return (
    <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 p-6">
      <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
        📊 Course Progress – {course?.name}
      </h3>
      <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
        Students need 75% overall to pass. Speak to those who failed in person.
      </p>

      {failed.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
            ⚠️ Below 75% – follow up with these students
          </h4>
          <ul className="space-y-2">
            {failed.map(s => (
              <li key={s.memberId} className="flex items-center justify-between text-sm">
                <span className="font-medium text-secondary-900 dark:text-white">{s.username}</span>
                <span className="text-red-600 dark:text-red-400">{Math.round(s.overallScore)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {passed.map(s => (
          <div key={s.memberId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-secondary-700 last:border-0">
            <span className="text-secondary-900 dark:text-white">{s.username}</span>
            <span className="text-green-600 dark:text-green-400 font-medium">{Math.round(s.overallScore)}% ✓</span>
          </div>
        ))}
      </div>

      {students.length === 0 && (
        <p className="text-secondary-500 dark:text-secondary-400">No students enrolled in this course yet.</p>
      )}
    </div>
  );
};

export default CourseStudentProgress;
