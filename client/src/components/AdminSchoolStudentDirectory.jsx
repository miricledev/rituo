import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FaDownload,
  FaEdit,
  FaKey,
  FaSearch,
  FaUserGraduate
} from 'react-icons/fa';

const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (filename, headers, rows) => {
  const content = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','))
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const safeFilename = (value) => String(value || 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const AdminSchoolStudentDirectory = ({ schools, refreshKey, onEdit, onToast }) => {
  const manageableSchools = useMemo(
    () => schools.filter((school) => school.viewerCanManage),
    [schools]
  );
  const [groupId, setGroupId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingLogins, setGeneratingLogins] = useState(false);

  useEffect(() => {
    if (!groupId && manageableSchools.length) {
      setGroupId(manageableSchools[0].groupId);
    }
  }, [groupId, manageableSchools]);

  useEffect(() => {
    if (!groupId) {
      setStudents([]);
      setSchoolName('');
      return;
    }

    let active = true;
    const loadStudents = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/admin/schools/${groupId}/students`);
        if (!active) return;
        setSchoolName(response.data.school?.name || '');
        setStudents(response.data.students || []);
      } catch (error) {
        if (!active) return;
        onToast({
          type: 'error',
          title: 'Student list unavailable',
          message: error.response?.data?.error || error.message
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    loadStudents();
    return () => {
      active = false;
    };
  }, [groupId, refreshKey, onToast]);

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => (
      `${student.firstName} ${student.lastName} ${student.username} ${student.email} ${student.yearGroup} ${student.tutorGroup}`
        .toLowerCase()
        .includes(query)
    ));
  }, [search, students]);

  const downloadRoster = () => {
    downloadCsv(
      `${safeFilename(schoolName)}-student-roster.csv`,
      ['firstName', 'lastName', 'username', 'email', 'yearGroup', 'tutorGroup', 'isActive'],
      students
    );
  };

  const generateLoginPack = async () => {
    const confirmed = window.confirm(
      `Generate a new login CSV for all ${students.length} students in ${schoolName}? This resets every student's password to a new six-digit password.`
    );
    if (!confirmed) return;

    try {
      setGeneratingLogins(true);
      const response = await axios.post(`/admin/schools/${groupId}/student-logins`, {
        confirmReset: true
      });
      downloadCsv(
        `${safeFilename(schoolName)}-student-logins-${new Date().toISOString().slice(0, 10)}.csv`,
        ['firstName', 'lastName', 'username', 'email', 'temporaryPassword', 'yearGroup', 'tutorGroup', 'isActive'],
        response.data.credentials || []
      );
      onToast({
        type: 'success',
        title: 'Login CSV downloaded',
        message: `${response.data.credentials?.length || 0} six-digit passwords were securely regenerated.`
      });
    } catch (error) {
      onToast({
        type: 'error',
        title: 'Login CSV not generated',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setGeneratingLogins(false);
    }
  };

  return (
    <section className="mt-7 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-200">
            <FaUserGraduate className="text-xl" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-300">School student directory</p>
            <h2 className="mt-1 text-xl font-semibold">View students and distribute their logins</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Passwords are never stored in readable form. A login download securely replaces each password with a new six-digit temporary password.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={!students.length} onClick={downloadRoster} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-40">
            <FaDownload /> Download roster
          </button>
          <button type="button" disabled={!students.length || generatingLogins} onClick={generateLoginPack} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-300 to-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40">
            <FaKey /> {generatingLogins ? 'Generating...' : 'Generate login CSV'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[.75fr_1.25fr]">
        <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-indigo-400">
          <option value="">Choose school</option>
          {manageableSchools.map((school) => <option key={school.id} value={school.groupId}>{school.name}</option>)}
        </select>
        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <FaSearch className="text-slate-500" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username, year, or tutor group" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600" />
        </label>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-400">
          <span>{schoolName || 'Select a school'}</span>
          <span>{loading ? 'Loading...' : `${visibleStudents.length} of ${students.length} students`}</span>
        </div>
        <div className="max-h-[460px] overflow-auto">
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Year / tutor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold">{[student.firstName, student.lastName].filter(Boolean).join(' ') || student.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-200">{student.username}</td>
                  <td className="px-4 py-3 text-slate-400">{student.email}</td>
                  <td className="px-4 py-3 text-slate-400">{[student.yearGroup, student.tutorGroup].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${student.isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => onEdit(student)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200">
                      <FaEdit /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !visibleStudents.length && (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">
                    {students.length ? 'No students match this search.' : 'No students have been added to this school yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default AdminSchoolStudentDirectory;
