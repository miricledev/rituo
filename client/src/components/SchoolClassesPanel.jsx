import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { HOMEWORK_ENABLED } from '../config/features';

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-950/50 dark:text-white dark:focus:ring-violet-500/10';
const assignmentRoleOptions = [
  { value: 'lead-teacher', label: 'Lead teacher' },
  { value: 'subject-teacher', label: 'Subject teacher' },
  { value: 'assistant-teacher', label: 'Assistant teacher' }
];

function teacherLabel(assignment) {
  const role = assignmentRoleOptions.find((item) => item.value === assignment.assignmentRole)?.label || 'Teacher';
  return `${assignment.teacher?.username || 'Unassigned'} · ${role}`;
}

export default function SchoolClassesPanel({
  groupId,
  classes = [],
  subjects = [],
  rooms = [],
  teachers = [],
  isStudentView = false,
  onStructureChange,
  onOpenHomework,
  onToast
}) {
  const [query, setQuery] = useState('');
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [rosterClassId, setRosterClassId] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [draftAssignments, setDraftAssignments] = useState({});
  const [draftDetails, setDraftDetails] = useState({});
  const [savingKey, setSavingKey] = useState('');

  const visibleClasses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return classes;
    return classes.filter((schoolClass) => {
      const teacherNames = (schoolClass.teachingAssignments || [])
        .map((assignment) => assignment.teacher?.username || '')
        .join(' ');
      const text = [
        schoolClass.name,
        schoolClass.yearGroup,
        schoolClass.tutorGroup,
        schoolClass.subject?.name,
        teacherNames
      ].join(' ').toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [classes, query]);

  const filteredAvailableStudents = useMemo(() => {
    const normalizedQuery = studentQuery.trim().toLowerCase();
    if (!normalizedQuery) return availableStudents;
    return availableStudents.filter((student) => (
      `${student.username || ''} ${student.email || ''}`.toLowerCase().includes(normalizedQuery)
    ));
  }, [availableStudents, studentQuery]);

  const openRoster = async (schoolClass) => {
    try {
      setRosterClassId(schoolClass.id);
      setStudentQuery('');
      setSelectedStudentIds((schoolClass.enrollments || []).map((item) => Number(item.studentId)));
      const response = await axios.get(`/groups/${groupId}/classes/${schoolClass.id}/available-students`);
      setAvailableStudents(response.data?.students || []);
    } catch (error) {
      setRosterClassId(null);
      onToast?.({ type: 'error', title: 'Roster not loaded', message: error.response?.data?.error || 'Please try again.' });
    }
  };

  const saveRoster = async (classId) => {
    try {
      setSavingKey(`roster-${classId}`);
      const response = await axios.put(`/groups/${groupId}/classes/${classId}/roster`, {
        studentIds: selectedStudentIds
      });
      onStructureChange?.(response.data?.structure);
      setRosterClassId(null);
      onToast?.({ type: 'success', title: 'Class roster saved' });
    } catch (error) {
      onToast?.({ type: 'error', title: 'Roster not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey('');
    }
  };

  const getAssignments = (schoolClass) => (
    draftAssignments[schoolClass.id] || schoolClass.teachingAssignments || []
  );

  const changeAssignment = (schoolClass, index, field, value) => {
    const next = getAssignments(schoolClass).map((assignment, assignmentIndex) => (
      assignmentIndex === index ? { ...assignment, [field]: value } : assignment
    ));
    setDraftAssignments((previous) => ({ ...previous, [schoolClass.id]: next }));
  };

  const saveAssignments = async (schoolClass) => {
    try {
      setSavingKey(`staff-${schoolClass.id}`);
      const assignments = getAssignments(schoolClass)
        .filter((item) => item.teacherId && item.subjectId)
        .map((item) => ({
          teacherId: Number(item.teacherId),
          subjectId: Number(item.subjectId),
          assignmentRole: item.assignmentRole || 'lead-teacher'
        }));
      const response = await axios.put(`/groups/${groupId}/classes/${schoolClass.id}/staff`, { assignments });
      onStructureChange?.(response.data?.structure);
      setDraftAssignments((previous) => {
        const next = { ...previous };
        delete next[schoolClass.id];
        return next;
      });
      onToast?.({ type: 'success', title: 'Teaching team saved' });
    } catch (error) {
      onToast?.({ type: 'error', title: 'Teaching team not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey('');
    }
  };

  const saveDetails = async (schoolClass) => {
    try {
      setSavingKey(`details-${schoolClass.id}`);
      const details = draftDetails[schoolClass.id] || {};
      const response = await axios.patch(`/groups/${groupId}/classes/${schoolClass.id}`, details);
      onStructureChange?.(response.data?.structure);
      setDraftDetails((previous) => {
        const next = { ...previous };
        delete next[schoolClass.id];
        return next;
      });
      onToast?.({ type: 'success', title: 'Class details saved' });
    } catch (error) {
      onToast?.({ type: 'error', title: 'Class details not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey('');
    }
  };

  const setDetail = (schoolClass, field, value) => {
    setDraftDetails((previous) => ({
      ...previous,
      [schoolClass.id]: {
        name: schoolClass.name || '',
        tutorGroup: schoolClass.tutorGroup || '',
        yearGroup: schoolClass.yearGroup || '',
        description: schoolClass.description || '',
        subjectId: schoolClass.subjectId || '',
        roomId: schoolClass.roomId || '',
        weeklyLessons: schoolClass.weeklyLessons || 5,
        ...(previous[schoolClass.id] || {}),
        [field]: value
      }
    }));
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900/80">
      <div className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-6 dark:border-white/10 dark:from-violet-950/30 dark:via-slate-900 dark:to-cyan-950/20 sm:p-8">
        <img src="/images/school/class-community.webp" alt="" aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[48%] object-cover opacity-[0.13] dark:opacity-25 lg:block" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-violet-600 dark:text-cyan-300">
              {isStudentView ? 'My learning groups' : 'Class command centre'}
            </p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {isStudentView ? 'My classes' : 'Classes & teaching teams'}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {isStudentView
                ? 'See your subjects, teachers, classmates and community channels in one place.'
                : 'Search classes, maintain rosters, assign teaching teams and move directly into class work.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="text-2xl font-black text-slate-950 dark:text-white">{classes.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Classes</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="text-2xl font-black text-slate-950 dark:text-white">{new Set(classes.flatMap((item) => (item.enrollments || []).map((row) => row.studentId))).size}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Students</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="text-2xl font-black text-slate-950 dark:text-white">{new Set(classes.flatMap((item) => (item.teachingAssignments || []).map((row) => row.teacherId))).size}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Teachers</div>
            </div>
          </div>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by class, subject, year group or teacher..."
          className={`${fieldClass} relative mt-6 max-w-xl`}
        />
      </div>

      <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-2">
        {visibleClasses.map((schoolClass) => {
          const isExpanded = expandedClassId === schoolClass.id;
          const assignments = getAssignments(schoolClass);
          const details = { ...schoolClass, ...(draftDetails[schoolClass.id] || {}) };
          return (
            <article key={schoolClass.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xl font-black text-slate-950 dark:text-white">{schoolClass.name}</h4>
                    {schoolClass.yearGroup ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">{schoolClass.yearGroup}</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-cyan-700 dark:text-cyan-300">{schoolClass.subject?.name || 'Subject not set'}</p>
                  {schoolClass.description ? <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{schoolClass.description}</p> : null}
                </div>
                <button type="button" onClick={() => setExpandedClassId(isExpanded ? null : schoolClass.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  {isExpanded ? 'Collapse' : 'Manage'}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white p-3 dark:bg-slate-950/40"><div className="text-lg font-black text-slate-950 dark:text-white">{(schoolClass.enrollments || []).length}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Students</div></div>
                <div className="rounded-2xl bg-white p-3 dark:bg-slate-950/40"><div className="text-lg font-black text-slate-950 dark:text-white">{assignments.length}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staff</div></div>
                <div className="rounded-2xl bg-white p-3 dark:bg-slate-950/40"><div className="text-lg font-black text-slate-950 dark:text-white">{schoolClass.weeklyLessons || 5}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lessons / wk</div></div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div><span className="font-bold">Teaching team:</span> {assignments.length ? assignments.map(teacherLabel).join(', ') : 'Not assigned'}</div>
                <div><span className="font-bold">Room:</span> {schoolClass.room?.name || 'Flexible'}{schoolClass.tutorGroup ? ` · Tutor ${schoolClass.tutorGroup}` : ''}</div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <a href={`/groups/${groupId}?tab=chat&class=${schoolClass.id}`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 dark:bg-white dark:text-slate-950">
                  Open class chat
                </a>
                {HOMEWORK_ENABLED ? <button type="button" onClick={onOpenHomework} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  Homework
                </button> : null}
                {schoolClass.permissions?.canManageRoster ? (
                  <button type="button" onClick={() => openRoster(schoolClass)} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
                    Manage roster
                  </button>
                ) : null}
              </div>

              {isExpanded ? (
                <div className="mt-5 space-y-5 border-t border-slate-200 pt-5 dark:border-white/10">
                  <div>
                    <h5 className="text-sm font-black text-slate-950 dark:text-white">Students</h5>
                    <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                      {(schoolClass.enrollments || []).length ? (schoolClass.enrollments || []).map((enrollment) => (
                        <span key={enrollment.id || enrollment.studentId} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200">
                          {enrollment.student?.username || `Student ${enrollment.studentId}`}
                        </span>
                      )) : <span className="text-sm text-slate-500">No students assigned yet.</span>}
                    </div>
                  </div>

                  {schoolClass.permissions?.canManageDetails ? (
                    <div className="space-y-3">
                      <h5 className="text-sm font-black text-slate-950 dark:text-white">Class setup</h5>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={details.name || ''} onChange={(event) => setDetail(schoolClass, 'name', event.target.value)} placeholder="Class name" className={fieldClass} />
                        <input value={details.yearGroup || ''} onChange={(event) => setDetail(schoolClass, 'yearGroup', event.target.value)} placeholder="Year group" className={fieldClass} />
                        <select value={details.subjectId || ''} onChange={(event) => setDetail(schoolClass, 'subjectId', event.target.value)} className={fieldClass}>
                          <option value="">Primary subject</option>
                          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                        </select>
                        <select value={details.roomId || ''} onChange={(event) => setDetail(schoolClass, 'roomId', event.target.value)} className={fieldClass}>
                          <option value="">Default room</option>
                          {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                        </select>
                        <input type="number" min="1" max="20" value={details.weeklyLessons || 5} onChange={(event) => setDetail(schoolClass, 'weeklyLessons', event.target.value)} className={fieldClass} />
                        <input value={details.tutorGroup || ''} onChange={(event) => setDetail(schoolClass, 'tutorGroup', event.target.value)} placeholder="Tutor group" className={fieldClass} />
                      </div>
                      <textarea value={details.description || ''} onChange={(event) => setDetail(schoolClass, 'description', event.target.value)} placeholder="Class notes or curriculum focus" rows={3} className={fieldClass} />
                      <button type="button" disabled={savingKey === `details-${schoolClass.id}`} onClick={() => saveDetails(schoolClass)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                        {savingKey === `details-${schoolClass.id}` ? 'Saving...' : 'Save class setup'}
                      </button>
                    </div>
                  ) : null}

                  {schoolClass.permissions?.canManageStaff ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="text-sm font-black text-slate-950 dark:text-white">Teaching team</h5>
                        <button type="button" onClick={() => setDraftAssignments((previous) => ({ ...previous, [schoolClass.id]: [...assignments, { teacherId: '', subjectId: schoolClass.subjectId || '', assignmentRole: 'subject-teacher' }] }))} className="text-xs font-black text-violet-700 dark:text-violet-300">
                          + Add staff
                        </button>
                      </div>
                      {assignments.map((assignment, index) => (
                        <div key={`${schoolClass.id}-staff-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                          <select value={assignment.teacherId || ''} onChange={(event) => changeAssignment(schoolClass, index, 'teacherId', event.target.value)} className={fieldClass}>
                            <option value="">Teacher</option>
                            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.username}</option>)}
                          </select>
                          <select value={assignment.subjectId || ''} onChange={(event) => changeAssignment(schoolClass, index, 'subjectId', event.target.value)} className={fieldClass}>
                            <option value="">Subject</option>
                            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                          </select>
                          <select value={assignment.assignmentRole || 'lead-teacher'} onChange={(event) => changeAssignment(schoolClass, index, 'assignmentRole', event.target.value)} className={fieldClass}>
                            {assignmentRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <button type="button" onClick={() => setDraftAssignments((previous) => ({ ...previous, [schoolClass.id]: assignments.filter((_, assignmentIndex) => assignmentIndex !== index) }))} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                            Remove
                          </button>
                        </div>
                      ))}
                      <button type="button" disabled={savingKey === `staff-${schoolClass.id}`} onClick={() => saveAssignments(schoolClass)} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                        {savingKey === `staff-${schoolClass.id}` ? 'Saving...' : 'Save teaching team'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
        {!visibleClasses.length ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-white/15 xl:col-span-2">
            {classes.length ? 'No classes match your search.' : 'No classes are assigned yet.'}
          </div>
        ) : null}
      </div>

      {rosterClassId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl dark:bg-slate-900">
            <div className="border-b border-slate-200 p-6 dark:border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-600">Class roster</p>
                  <h4 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Assign students</h4>
                </div>
                <button type="button" onClick={() => setRosterClassId(null)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-black text-slate-600 dark:border-white/10 dark:text-slate-200">Close</button>
              </div>
              <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search this school by student name or email..." className={`${fieldClass} mt-5`} />
            </div>
            <div className="grid flex-1 gap-2 overflow-y-auto p-6 sm:grid-cols-2">
              {filteredAvailableStudents.map((student) => {
                const checked = selectedStudentIds.includes(Number(student.id));
                return (
                  <label key={student.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${checked ? 'border-violet-300 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10' : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedStudentIds((previous) => (
                        checked ? previous.filter((id) => id !== Number(student.id)) : [...previous, Number(student.id)]
                      ))}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{student.username}</span>
                      <span className="block truncate text-xs text-slate-500">{student.email}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-5 dark:border-white/10">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{selectedStudentIds.length} selected</span>
              <button type="button" disabled={savingKey === `roster-${rosterClassId}`} onClick={() => saveRoster(rosterClassId)} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                {savingKey === `roster-${rosterClassId}` ? 'Saving...' : 'Save roster'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
