import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import InlineToast from '../components/InlineToast';

const attendanceOptions = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'authorised-absence', label: 'Authorised absence' }
];

const quickBehaviourActions = [
  { key: 'reward', label: 'Quick reward', kind: 'reward', severity: 'low', title: 'Quick reward', pointsDelta: 2 },
  { key: 'sanction', label: 'Quick sanction', kind: 'sanction', severity: 'medium', title: 'Quick sanction', pointsDelta: -2 },
  { key: 'referral', label: 'Referral issued', kind: 'referral', severity: 'high', title: 'Referral issued', pointsDelta: -4 },
  { key: 'removal', label: 'Removal issued', kind: 'removal', severity: 'high', title: 'Removal from lesson', pointsDelta: -5 }
];

const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-secondary-900 shadow-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-secondary-700 dark:bg-secondary-900 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30';
const cardClass = 'rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-secondary-700 dark:bg-secondary-800/95';

const emptyRegisterEntry = (slotId, lesson = {}) => ({
  timetableSlotId: slotId,
  attendanceStatus: lesson.attendanceStatus || 'present',
  latenessMinutes: lesson.latenessMinutes || 0,
  engagement: lesson.engagement || 'green',
  refocus: !!lesson.refocus,
  teacherComment: lesson.teacherComment || ''
});

const defaultHomeworkReview = (assignment, submission) => ({
  status: submission?.status === 'late' ? 'late' : 'reviewed',
  awardedPoints: submission?.awardedPoints ?? assignment?.maxPoints ?? 0,
  teacherFeedback: submission?.teacherFeedback || ''
});

const formatDateLabel = (value) => {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

const asSortableText = (value) => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
};

const getEntityLabel = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.name === 'string' && value.name.trim()) return value.name;
    if (typeof value.title === 'string' && value.title.trim()) return value.title;
    if (typeof value.code === 'string' && value.code.trim()) return value.code;
    return fallback;
  }
  return fallback;
};

const normalizeHomeworkAssignment = (assignment) => ({
  ...assignment,
  title: getEntityLabel(assignment?.title, 'Homework item'),
  className: getEntityLabel(assignment?.className),
  subjectName: getEntityLabel(assignment?.subjectName),
  subject: getEntityLabel(assignment?.subject),
  submissions: (assignment?.submissions || []).map((submission) => ({
    ...submission,
    status: getEntityLabel(submission?.status, 'submitted'),
    responseText: getEntityLabel(submission?.responseText),
    evidenceLink: getEntityLabel(submission?.evidenceLink)
  }))
});

const normalizeRegisterClass = (registerClass) => ({
  ...registerClass,
  className: getEntityLabel(registerClass?.className, 'Unassigned class'),
  subject: getEntityLabel(registerClass?.subject, 'Unknown subject'),
  room: getEntityLabel(registerClass?.room),
  teacherName: getEntityLabel(registerClass?.teacherName),
  students: (registerClass?.students || []).map((row) => ({
    ...row,
    lesson: row?.lesson
      ? {
          ...row.lesson,
          subject: getEntityLabel(row.lesson?.subject, 'Unknown subject'),
          className: getEntityLabel(row.lesson?.className, 'Unassigned class'),
          room: getEntityLabel(row.lesson?.room),
          teacherName: getEntityLabel(row.lesson?.teacherName)
        }
      : row?.lesson
  }))
});

const normalizeHomeworkWatchItem = (item) => ({
  ...item,
  title: getEntityLabel(item?.title, 'Homework watch item'),
  username: getEntityLabel(item?.username),
  className: getEntityLabel(item?.className),
  subject: getEntityLabel(item?.subject)
});

const getTomorrow = (value) => {
  const base = value ? new Date(value) : new Date();
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
};

const dedupeGroups = (data) => {
  const source = [...(data?.leading || []), ...(data?.memberOf || [])];
  const map = new Map();
  source.forEach((group) => {
    if (group?.groupId && group?.isLegacy === false && group?.groupType === 'school' && !map.has(group.groupId)) {
      map.set(group.groupId, group);
    }
  });
  return Array.from(map.values());
};

const sortRegisterStudents = (students, sortMode) => {
  const next = [...students];
  next.sort((a, b) => {
    if (sortMode === 'attendance-low') {
      return (a.attendanceSummary?.attendanceRate ?? 0) - (b.attendanceSummary?.attendanceRate ?? 0)
        || (a.student?.username || '').localeCompare(b.student?.username || '');
    }
    if (sortMode === 'points-low') {
      return (a.lesson?.points ?? 0) - (b.lesson?.points ?? 0)
        || (a.student?.username || '').localeCompare(b.student?.username || '');
    }
    return (a.student?.username || '').localeCompare(b.student?.username || '');
  });
  return next;
};

function TeacherDesk() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [registerDate, setRegisterDate] = useState(searchParams.get('date') || new Date().toISOString().slice(0, 10));
  const [dashboard, setDashboard] = useState(null);
  const [registerClasses, setRegisterClasses] = useState([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState([]);
  const [registerForms, setRegisterForms] = useState({});
  const [behaviourNotes, setBehaviourNotes] = useState({});
  const [homeworkReviewForms, setHomeworkReviewForms] = useState({});
  const [homeworkClassFilter, setHomeworkClassFilter] = useState('all');
  const [homeworkSubjectFilter, setHomeworkSubjectFilter] = useState('all');
  const [registerStudentFilter, setRegisterStudentFilter] = useState('');
  const [registerStudentSort, setRegisterStudentSort] = useState('az');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [collapsedClasses, setCollapsedClasses] = useState({});
  const [activeClassSlotId, setActiveClassSlotId] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingDesk, setLoadingDesk] = useState(false);
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const loadGroups = async () => {
      setLoadingGroups(true);
      try {
        const response = await api.get('/groups/my-groups');
        const nextGroups = dedupeGroups(response.data);
        setGroups(nextGroups);
        const requestedGroup = searchParams.get('group');
        const storedGroup = localStorage.getItem('teacher-desk-group');
        const fallbackGroup = requestedGroup || storedGroup || nextGroups[0]?.groupId || '';
        setSelectedGroupId((current) => current || fallbackGroup);
      } catch (error) {
        setToast({
          type: 'error',
          title: 'Failed to load groups',
          message: error.response?.data?.error || error.message
        });
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, [searchParams]);

  useEffect(() => {
    if (selectedGroupId) {
      localStorage.setItem('teacher-desk-group', selectedGroupId);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    setHomeworkClassFilter('all');
    setHomeworkSubjectFilter('all');
    setRegisterStudentFilter('');
    setRegisterStudentSort('az');
    setShowIncompleteOnly(false);
    setCollapsedClasses({});
    setActiveClassSlotId('');
  }, [selectedGroupId]);

  const hydrateRegisterForms = (classes) => {
    setRegisterForms((prev) => {
      const next = { ...prev };
      classes.forEach((registerClass) => {
        (registerClass.students || []).forEach((row) => {
          const key = `${registerClass.slotId}-${row.student.id}`;
          next[key] = next[key] || emptyRegisterEntry(registerClass.slotId, row.lesson);
        });
      });
      return next;
    });
  };

  const hydrateHomeworkForms = (assignments) => {
    setHomeworkReviewForms((prev) => {
      const next = { ...prev };
      assignments.forEach((assignment) => {
        (assignment.submissions || []).forEach((submission) => {
          const key = `${assignment.id}-${submission.studentId}`;
          next[key] = next[key] || defaultHomeworkReview(assignment, submission);
        });
      });
      return next;
    });
  };

  const refreshDesk = async (groupId = selectedGroupId, targetDate = registerDate) => {
    if (!groupId) return;
    setLoadingDesk(true);
    try {
      const [dashboardResponse, registerResponse, homeworkResponse] = await Promise.all([
        api.get(`/groups/${groupId}/school-dashboard`),
        api.get(`/groups/${groupId}/teacher-register`, { params: { date: targetDate } }),
        api.get(`/groups/${groupId}/homework`)
      ]);
      const nextRegisterClasses = (registerResponse.data?.register || []).map(normalizeRegisterClass);
      const nextHomework = (homeworkResponse.data?.homework || []).map(normalizeHomeworkAssignment);
      const nextDashboard = dashboardResponse.data?.dashboard
        ? {
            ...dashboardResponse.data.dashboard,
            myClassesToday: (dashboardResponse.data.dashboard.myClassesToday || []).map(normalizeRegisterClass),
            classSummaries: (dashboardResponse.data.dashboard.classSummaries || []).map(normalizeRegisterClass),
            homework: {
              ...(dashboardResponse.data.dashboard.homework || {}),
              watchlist: ((dashboardResponse.data.dashboard.homework || {}).watchlist || []).map(normalizeHomeworkWatchItem)
            }
          }
        : null;
      setDashboard(nextDashboard);
      setRegisterClasses(nextRegisterClasses);
      setHomeworkAssignments(nextHomework);
      hydrateRegisterForms(nextRegisterClasses);
      hydrateHomeworkForms(nextHomework);
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Failed to load teacher desk',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setLoadingDesk(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      refreshDesk(selectedGroupId, registerDate);
    }
  }, [selectedGroupId, registerDate]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.groupId === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const pendingHomeworkReviews = useMemo(() => {
    const rows = [];
    homeworkAssignments.forEach((assignment) => {
      (assignment.submissions || []).forEach((submission) => {
        if (submission.status === 'submitted' || submission.status === 'late') {
          rows.push({ assignment, submission });
        }
      });
    });
    return rows.sort((a, b) => new Date(a.assignment.dueDate) - new Date(b.assignment.dueDate));
  }, [homeworkAssignments]);

  const homeworkWatchlist = useMemo(() => dashboard?.homework?.watchlist || [], [dashboard]);
  const homeworkClassOptions = useMemo(() => {
    const values = new Set();
    homeworkAssignments.forEach((assignment) => {
      const className = asSortableText(assignment.className).trim();
      if (className) values.add(className);
    });
    return Array.from(values).sort((a, b) => asSortableText(a).localeCompare(asSortableText(b)));
  }, [homeworkAssignments]);

  const homeworkSubjectOptions = useMemo(() => {
    const values = new Set();
    homeworkAssignments.forEach((assignment) => {
      const subjectName = asSortableText(assignment.subjectName || assignment.subject).trim();
      if (subjectName) values.add(subjectName);
    });
    return Array.from(values).sort((a, b) => asSortableText(a).localeCompare(asSortableText(b)));
  }, [homeworkAssignments]);

  const filteredPendingHomeworkReviews = useMemo(() => {
    return pendingHomeworkReviews.filter(({ assignment }) => {
      const className = assignment.className || '';
      const subjectName = assignment.subjectName || assignment.subject || '';
      if (homeworkClassFilter !== 'all' && className !== homeworkClassFilter) return false;
      if (homeworkSubjectFilter !== 'all' && subjectName !== homeworkSubjectFilter) return false;
      return true;
    });
  }, [pendingHomeworkReviews, homeworkClassFilter, homeworkSubjectFilter]);

  const registerCoverageWarnings = useMemo(() => {
    return registerClasses
      .map((registerClass) => {
        const loggedStudents = (registerClass.students || []).filter((row) => !!row.lesson?.logged).length;
        const expectedStudents = registerClass.students?.length || 0;
        const missingStudents = Math.max(0, expectedStudents - loggedStudents);
        const coverageRate = expectedStudents ? Math.round((loggedStudents / expectedStudents) * 100) : 100;
        return {
          slotId: registerClass.slotId,
          className: registerClass.className || 'Unassigned class',
          subject: registerClass.subject,
          startTime: registerClass.startTime,
          loggedStudents,
          expectedStudents,
          missingStudents,
          coverageRate
        };
      })
      .filter((item) => item.missingStudents > 0)
      .sort((a, b) => a.coverageRate - b.coverageRate);
  }, [registerClasses]);

  const visibleRegisterClasses = useMemo(() => {
    const search = registerStudentFilter.trim().toLowerCase();
    return registerClasses
      .map((registerClass) => {
        const filteredStudents = (registerClass.students || []).filter((row) => {
          if (!search) return true;
          return (row.student?.username || '').toLowerCase().includes(search);
        });
        const students = sortRegisterStudents(filteredStudents, registerStudentSort);
        return {
          ...registerClass,
          students
        };
      })
      .filter((registerClass) => {
        if (registerClass.students.length === 0) return false;
        if (!showIncompleteOnly) return true;
        return registerClass.students.some((row) => !row.lesson?.logged);
      });
  }, [registerClasses, registerStudentFilter, registerStudentSort, showIncompleteOnly]);

  const recoveryOpportunities = useMemo(() => {
    const source = dashboard?.myStudentsAtRisk || [];
    return source
      .filter((item) => (item.habitRecoveryPoints || 0) > 0 || (item.homeworkDueTodayCount || 0) > 0 || (item.homeworkMissingCount || 0) > 0)
      .sort((a, b) => {
        const aPotential = (a.habitRecoveryPoints || 0) + (a.homeworkDueTodayCount || 0);
        const bPotential = (b.habitRecoveryPoints || 0) + (b.homeworkDueTodayCount || 0);
        return bPotential - aPotential;
      });
  }, [dashboard]);

  const teacherMiniDashboard = useMemo(() => {
    const lateArrivals = registerClasses.reduce(
      (total, registerClass) => total + (registerClass.students || []).filter((row) => (row.lesson?.attendanceStatus || 'present') === 'late').length,
      0
    );
    const missingHomework = homeworkWatchlist.filter((item) => (item.studentId || item.username) && !item.dueDate).length
      || (dashboard?.homework?.watchlist || []).filter((item) => (item.studentId || item.username) && item.title).length;
    const interventionsDueToday = (dashboard?.interventions || []).filter((item) => {
      const dueDate = item.latestIntervention?.dueDate ? String(item.latestIntervention.dueDate).slice(0, 10) : '';
      return dueDate === registerDate;
    }).length;
    return { lateArrivals, missingHomework, interventionsDueToday };
  }, [dashboard, homeworkWatchlist, registerClasses, registerDate]);

  const updateRegisterForm = (slotId, studentId, field, value) => {
    setRegisterForms((prev) => ({
      ...prev,
      [`${slotId}-${studentId}`]: {
        ...(prev[`${slotId}-${studentId}`] || emptyRegisterEntry(slotId)),
        [field]: value
      }
    }));
  };

  const setSavingFlag = (key, value) => {
    setSaving((prev) => ({ ...prev, [key]: value }));
  };

  const saveRegisterRow = async (registerClass, row) => {
    const key = `register-row-${registerClass.slotId}-${row.student.id}`;
    setSavingFlag(key, true);
    try {
      const form = registerForms[`${registerClass.slotId}-${row.student.id}`] || emptyRegisterEntry(registerClass.slotId, row.lesson);
      await api.post(`/groups/${selectedGroupId}/teacher-register`, {
        studentId: row.student.id,
        lessonDate: registerDate,
        entry: form
      });
      await refreshDesk();
      setToast({
        type: 'success',
        title: 'Register saved',
        message: `${row.student.username} updated for ${registerClass.subject}.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not save register row',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSavingFlag(key, false);
    }
  };

  const saveRegisterClass = async (registerClass) => {
    const key = `register-class-${registerClass.slotId}`;
    setSavingFlag(key, true);
    try {
      await Promise.all(
        (registerClass.students || []).map((row) =>
          api.post(`/groups/${selectedGroupId}/teacher-register`, {
            studentId: row.student.id,
            lessonDate: registerDate,
            entry: registerForms[`${registerClass.slotId}-${row.student.id}`] || emptyRegisterEntry(registerClass.slotId, row.lesson)
          })
        )
      );
      await refreshDesk();
      setToast({
        type: 'success',
        title: 'Class register saved',
        message: `${registerClass.className || registerClass.subject} updated.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not save class register',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSavingFlag(key, false);
    }
  };

  const applyBulkRegisterField = (registerClass, field, value) => {
    setRegisterForms((prev) => {
      const next = { ...prev };
      (registerClass.students || []).forEach((row) => {
        const formKey = `${registerClass.slotId}-${row.student.id}`;
        next[formKey] = {
          ...(next[formKey] || emptyRegisterEntry(registerClass.slotId, row.lesson)),
          [field]: value
        };
      });
      return next;
    });
  };

  const logQuickBehaviour = async (registerClass, row, action) => {
    const saveKey = `behaviour-${registerClass.slotId}-${row.student.id}-${action.key}`;
    setSavingFlag(saveKey, true);
    try {
      await api.post(`/groups/${selectedGroupId}/teacher-behaviour-log`, {
        studentId: row.student.id,
        slotId: registerClass.slotId,
        lessonDate: registerDate,
        kind: action.kind,
        severity: action.severity,
        title: action.title,
        pointsDelta: action.pointsDelta,
        notes: behaviourNotes[`${registerClass.slotId}-${row.student.id}`] || ''
      });
      await refreshDesk();
      setToast({
        type: 'success',
        title: 'Behaviour logged',
        message: `${action.label} saved for ${row.student.username}.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not log behaviour',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSavingFlag(saveKey, false);
    }
  };

  const runBulkBehaviour = async (registerClass, action) => {
    const saveKey = `bulk-behaviour-${registerClass.slotId}-${action.key}`;
    setSavingFlag(saveKey, true);
    try {
      await Promise.all(
        (registerClass.students || []).map((row) =>
          api.post(`/groups/${selectedGroupId}/teacher-behaviour-log`, {
            studentId: row.student.id,
            slotId: registerClass.slotId,
            lessonDate: registerDate,
            kind: action.kind,
            severity: action.severity,
            title: `${action.title} (${registerClass.className || registerClass.subject})`,
            pointsDelta: action.pointsDelta
          })
        )
      );
      await refreshDesk();
      setToast({
        type: 'success',
        title: 'Bulk behaviour applied',
        message: `${action.label} logged for ${registerClass.students.length} students.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not apply bulk behaviour',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSavingFlag(saveKey, false);
    }
  };

  const updateHomeworkReviewForm = (assignmentId, studentId, field, value) => {
    setHomeworkReviewForms((prev) => ({
      ...prev,
      [`${assignmentId}-${studentId}`]: {
        ...(prev[`${assignmentId}-${studentId}`] || defaultHomeworkReview()),
        [field]: value
      }
    }));
  };

  const reviewHomework = async (assignment, submission) => {
    const saveKey = `homework-review-${assignment.id}-${submission.studentId}`;
    setSavingFlag(saveKey, true);
    try {
      const form = homeworkReviewForms[`${assignment.id}-${submission.studentId}`] || defaultHomeworkReview(assignment, submission);
      await api.post(`/groups/${selectedGroupId}/homework/${assignment.id}/mark`, {
        studentId: submission.studentId,
        status: form.status,
        awardedPoints: Number(form.awardedPoints || 0),
        teacherFeedback: form.teacherFeedback
      });
      await refreshDesk();
      setToast({
        type: 'success',
        title: 'Homework reviewed',
        message: `${submission.student?.username || 'Student'} updated.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not review homework',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSavingFlag(saveKey, false);
    }
  };

  const remindHomework = async (assignment, studentId = null) => {
    const saveKey = `homework-remind-${assignment.id}-${studentId || 'all'}`;
    setSavingFlag(saveKey, true);
    try {
      await api.post(`/groups/${selectedGroupId}/homework/${assignment.id}/remind`, studentId ? { studentId } : {});
      await refreshDesk();
      setToast({
        type: 'success',
        title: 'Reminder sent',
        message: studentId ? 'Student reminder sent.' : 'Class reminder sent.'
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not send reminder',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSavingFlag(saveKey, false);
    }
  };

  const createInterventionFromRisk = async (item) => {
    const saveKey = `intervention-${item.studentId}`;
    setSavingFlag(saveKey, true);
    try {
      await api.post(`/groups/${selectedGroupId}/students/${item.studentId}/interventions`, {
        interventionType: 'reflection-session',
        status: 'scheduled',
        interventionDate: registerDate,
        dueDate: getTomorrow(registerDate),
        summary: (item.reasons || []).join(' | ') || 'Teacher desk escalation',
        nextStep: 'Teacher desk escalation'
      });
      await refreshDesk();
      setToast({
        type: 'success',
        title: 'Intervention flagged',
        message: `${item.username} added to the intervention workflow.`
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not flag intervention',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSavingFlag(saveKey, false);
    }
  };

  const openStudentProfile = (studentId) => {
    navigate(`/groups/${selectedGroupId}?tab=school-impact&section=student-profiles&student=${studentId}`);
  };

  const handleGroupChange = (value) => {
    setSelectedGroupId(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('group', value);
    else next.delete('group');
    setSearchParams(next, { replace: true });
  };

  const handleDateChange = (value) => {
    setRegisterDate(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('date', value);
    else next.delete('date');
    setSearchParams(next, { replace: true });
  };

  const toggleClassCollapsed = (slotId) => {
    setCollapsedClasses((prev) => ({
      ...prev,
      [slotId]: !prev[slotId]
    }));
    setActiveClassSlotId(slotId);
  };

  const openAlertTarget = async (item) => {
    try {
      await api.post(`/groups/messages/${item.id}/mark-read`);
    } catch (_error) {
      // Ignore mark-read failures and still open the target.
    }
    if (item.deep_link) {
      navigate(item.deep_link);
      return;
    }
    navigate('/groups');
  };

  const activeRegisterClass = useMemo(
    () => visibleRegisterClasses.find((item) => item.slotId === activeClassSlotId) || null,
    [visibleRegisterClasses, activeClassSlotId]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!activeRegisterClass || !event.altKey) return;
      if (event.key === '1') {
        event.preventDefault();
        applyBulkRegisterField(activeRegisterClass, 'attendanceStatus', 'present');
      } else if (event.key === '2') {
        event.preventDefault();
        applyBulkRegisterField(activeRegisterClass, 'engagement', 'green');
      } else if (event.key === '3') {
        event.preventDefault();
        saveRegisterClass(activeRegisterClass);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeRegisterClass]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-500">Teacher desk</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-secondary-900 dark:text-white">Run today&apos;s classes from one screen</h1>
          <p className="mt-2 max-w-3xl text-secondary-600 dark:text-secondary-300">
            Take registers, log behaviour, review homework, remind students, and escalate interventions without going back into the full school workspace.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-secondary-500 dark:text-secondary-400">School</label>
            <select value={selectedGroupId} onChange={(e) => handleGroupChange(e.target.value)} className={inputClass} disabled={loadingGroups}>
              <option value="">Select school</option>
              {groups.map((group) => (
                <option key={group.groupId} value={group.groupId}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-secondary-500 dark:text-secondary-400">Date</label>
            <input type="date" value={registerDate} onChange={(e) => handleDateChange(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <InlineToast toast={toast} onClose={() => setToast(null)} />

      {!selectedGroupId && !loadingGroups ? (
        <div className={cardClass}>
          <div className="text-lg font-semibold text-secondary-900 dark:text-white">No school selected</div>
          <div className="mt-2 text-sm text-secondary-600 dark:text-secondary-300">Pick a school group to open today&apos;s teacher desk.</div>
        </div>
      ) : null}

      {selectedGroupId ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">School</div>
              <div className="mt-2 text-xl font-semibold text-secondary-900 dark:text-white">{selectedGroup?.name || 'Selected school'}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">My classes today</div>
              <div className="mt-2 text-3xl font-semibold text-secondary-900 dark:text-white">{dashboard?.myClassesToday?.length ?? 0}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">At-risk students</div>
              <div className="mt-2 text-3xl font-semibold text-secondary-900 dark:text-white">{dashboard?.myStudentsAtRisk?.length ?? 0}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">Overdue actions</div>
              <div className="mt-2 text-3xl font-semibold text-secondary-900 dark:text-white">{dashboard?.overview?.overdueActionsCount ?? 0}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">Unread alerts</div>
              <div className="mt-2 text-3xl font-semibold text-secondary-900 dark:text-white">{dashboard?.notifications?.unreadCount ?? 0}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">Late arrivals today</div>
              <div className="mt-2 text-3xl font-semibold text-secondary-900 dark:text-white">{teacherMiniDashboard.lateArrivals}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">Homework pressure</div>
              <div className="mt-2 text-3xl font-semibold text-secondary-900 dark:text-white">{teacherMiniDashboard.missingHomework}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">Interventions due today</div>
              <div className="mt-2 text-3xl font-semibold text-secondary-900 dark:text-white">{teacherMiniDashboard.interventionsDueToday}</div>
            </div>
          </div>

          {registerCoverageWarnings.length > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/95 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-900/20">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-amber-900 dark:text-amber-200">Register coverage warnings</div>
                  <div className="text-sm text-amber-800 dark:text-amber-300">These lessons still have missing rows for the selected date.</div>
                </div>
                <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {registerCoverageWarnings.length} incomplete class{registerCoverageWarnings.length === 1 ? '' : 'es'}
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {registerCoverageWarnings.map((warning) => (
                  <div key={`coverage-${warning.slotId}`} className="rounded-xl border border-amber-200 bg-white px-4 py-3 dark:border-amber-900/60 dark:bg-secondary-900/40">
                    <div className="font-medium text-secondary-900 dark:text-white">{warning.startTime} | {warning.subject}</div>
                    <div className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">{warning.className}</div>
                    <div className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                      {warning.loggedStudents}/{warning.expectedStudents} logged, {warning.missingStudents} missing, {warning.coverageRate}% coverage
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-6">
              <section className={cardClass}>
                <div className="flex flex-col gap-2 border-b border-gray-200 pb-4 dark:border-secondary-700 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">My classes today</h2>
                    <p className="text-sm text-secondary-600 dark:text-secondary-300">Rapid lesson registers and one-click behaviour actions.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIncompleteOnly((prev) => !prev)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${showIncompleteOnly ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-gray-200 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200'}`}
                    >
                      {showIncompleteOnly ? 'Showing incomplete only' : 'Show incomplete only'}
                    </button>
                    <button type="button" onClick={() => refreshDesk()} disabled={loadingDesk} className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-60">
                      {loadingDesk ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                    <input
                      value={registerStudentFilter}
                      onChange={(e) => setRegisterStudentFilter(e.target.value)}
                      placeholder="Filter register by student name"
                      className={inputClass}
                    />
                    <select value={registerStudentSort} onChange={(e) => setRegisterStudentSort(e.target.value)} className={inputClass}>
                      <option value="az">Sort A-Z</option>
                      <option value="attendance-low">Lowest attendance first</option>
                      <option value="points-low">Lowest lesson points first</option>
                    </select>
                  </div>
                  <div className="mt-3 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-xs text-secondary-500 dark:border-secondary-700 dark:text-secondary-400">
                    Keyboard shortcuts for the active class: `Alt + 1` all present, `Alt + 2` all green, `Alt + 3` save class.
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  {visibleRegisterClasses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-secondary-500 dark:border-secondary-700 dark:text-secondary-400">
                      {registerStudentFilter ? 'No students match this filter.' : showIncompleteOnly ? 'All visible classes are fully logged.' : 'No classes found for this date.'}
                    </div>
                  ) : (
                    visibleRegisterClasses.map((registerClass) => (
                      <div
                        key={registerClass.slotId}
                        className={`rounded-xl border p-4 ${activeClassSlotId === registerClass.slotId ? 'border-primary-400 bg-primary-50/50 dark:border-primary-500 dark:bg-primary-900/10' : 'border-gray-200 bg-gray-50/60 dark:border-secondary-700 dark:bg-secondary-900/40'}`}
                      >
                        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-secondary-700 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-lg font-semibold text-secondary-900 dark:text-white">
                              {registerClass.startTime} - {registerClass.endTime} | {registerClass.subject}
                            </div>
                            <div className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">
                              {registerClass.className || 'Unassigned class'}{registerClass.room ? ` | ${registerClass.room}` : ''}{registerClass.teacherName ? ` | ${registerClass.teacherName}` : ''}
                            </div>
                            <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
                              {(registerClass.students || []).filter((row) => !!row.lesson?.logged).length}/{registerClass.students?.length || 0} rows logged
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setActiveClassSlotId(registerClass.slotId)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeClassSlotId === registerClass.slotId ? 'bg-primary-600 text-white' : 'bg-white text-secondary-700 hover:bg-gray-100 dark:bg-secondary-800 dark:text-secondary-200 dark:hover:bg-secondary-700'}`}>
                              {activeClassSlotId === registerClass.slotId ? 'Active class' : 'Set active'}
                            </button>
                            <button type="button" onClick={() => toggleClassCollapsed(registerClass.slotId)} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-secondary-700 hover:bg-gray-100 dark:bg-secondary-800 dark:text-secondary-200 dark:hover:bg-secondary-700">
                              {collapsedClasses[registerClass.slotId] ? 'Expand class' : 'Collapse class'}
                            </button>
                            <button type="button" onClick={() => applyBulkRegisterField(registerClass, 'attendanceStatus', 'present')} className="rounded-full bg-gray-200 px-3 py-1.5 text-xs font-medium text-secondary-700 hover:bg-gray-300 dark:bg-secondary-700 dark:text-secondary-200">All present</button>
                            <button type="button" onClick={() => applyBulkRegisterField(registerClass, 'engagement', 'green')} className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300">All green</button>
                            <button type="button" onClick={() => runBulkBehaviour(registerClass, quickBehaviourActions[0])} disabled={!!saving[`bulk-behaviour-${registerClass.slotId}-reward`]} className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300">Class reward</button>
                            <button type="button" onClick={() => runBulkBehaviour(registerClass, quickBehaviourActions[1])} disabled={!!saving[`bulk-behaviour-${registerClass.slotId}-sanction`]} className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">Class sanction</button>
                            <button type="button" onClick={() => saveRegisterClass(registerClass)} disabled={!!saving[`register-class-${registerClass.slotId}`]} className="rounded-lg bg-secondary-900 px-4 py-2 text-white hover:bg-secondary-700 disabled:opacity-60 dark:bg-primary-700 dark:hover:bg-primary-600">{saving[`register-class-${registerClass.slotId}`] ? 'Saving class...' : 'Save class'}</button>
                          </div>
                        </div>

                        <div className={`mt-4 space-y-4 ${collapsedClasses[registerClass.slotId] ? 'hidden' : ''}`}>
                          {(registerClass.students || []).map((row) => {
                            const form = registerForms[`${registerClass.slotId}-${row.student.id}`] || emptyRegisterEntry(registerClass.slotId, row.lesson);
                            return (
                              <div key={`${registerClass.slotId}-${row.student.id}`} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-secondary-700 dark:bg-secondary-800">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-lg font-semibold text-secondary-900 dark:text-white">{row.student.username}</div>
                                    <div className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">Attendance {row.attendanceSummary?.attendanceRate ?? 0}% | Current lesson {row.lesson?.points ?? 0} pts</div>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-start">
                                    <select value={form.attendanceStatus} onChange={(e) => updateRegisterForm(registerClass.slotId, row.student.id, 'attendanceStatus', e.target.value)} className={inputClass}>
                                      {attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                    <input type="number" min="0" value={form.latenessMinutes || 0} onChange={(e) => updateRegisterForm(registerClass.slotId, row.student.id, 'latenessMinutes', e.target.value)} className={inputClass} placeholder="Late mins" />
                                    <select value={form.engagement} onChange={(e) => updateRegisterForm(registerClass.slotId, row.student.id, 'engagement', e.target.value)} className={inputClass}>
                                      <option value="green">Green (+4)</option>
                                      <option value="amber">Amber (+1)</option>
                                      <option value="red">Red (-3)</option>
                                    </select>
                                    <label className="flex min-h-[42px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-secondary-700 dark:border-secondary-700 dark:bg-secondary-900 dark:text-secondary-300">
                                      <input type="checkbox" checked={!!form.refocus} onChange={(e) => updateRegisterForm(registerClass.slotId, row.student.id, 'refocus', e.target.checked)} />
                                      Refocus
                                    </label>
                                    <button type="button" onClick={() => saveRegisterRow(registerClass, row)} disabled={!!saving[`register-row-${registerClass.slotId}-${row.student.id}`]} className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`register-row-${registerClass.slotId}-${row.student.id}`] ? 'Saving...' : 'Save row'}</button>
                                  </div>
                                </div>

                                <textarea value={form.teacherComment || ''} onChange={(e) => updateRegisterForm(registerClass.slotId, row.student.id, 'teacherComment', e.target.value)} rows={2} placeholder="Teacher comment" className={`${inputClass} mt-3`} />

                                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                      <div className="font-semibold text-secondary-900 dark:text-white">Quick behaviour log</div>
                                      <div className="text-sm text-secondary-500 dark:text-secondary-400">Apply points immediately from the lesson register.</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {quickBehaviourActions.map((action) => (
                                        <button key={action.key} type="button" onClick={() => logQuickBehaviour(registerClass, row, action)} disabled={!!saving[`behaviour-${registerClass.slotId}-${row.student.id}-${action.key}`]} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-secondary-700 hover:bg-gray-100 disabled:opacity-60 dark:border-secondary-700 dark:bg-secondary-800 dark:text-secondary-200 dark:hover:bg-secondary-700">
                                          {action.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <textarea value={behaviourNotes[`${registerClass.slotId}-${row.student.id}`] || ''} onChange={(e) => setBehaviourNotes((prev) => ({ ...prev, [`${registerClass.slotId}-${row.student.id}`]: e.target.value }))} rows={2} placeholder="Optional behaviour note" className={`${inputClass} mt-3`} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cardClass}>
                <div className="flex flex-col gap-2 border-b border-gray-200 pb-4 dark:border-secondary-700 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">Homework review queue</h2>
                    <p className="text-sm text-secondary-600 dark:text-secondary-300">Review submitted homework and push reminders to missing students.</p>
                  </div>
                  <div className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{filteredPendingHomeworkReviews.length} awaiting review</div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <select value={homeworkClassFilter} onChange={(e) => setHomeworkClassFilter(e.target.value)} className={inputClass}>
                    <option value="all">All classes</option>
                    {homeworkClassOptions.map((option) => (
                      <option key={`hw-class-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select value={homeworkSubjectFilter} onChange={(e) => setHomeworkSubjectFilter(e.target.value)} className={inputClass}>
                    <option value="all">All subjects</option>
                    {homeworkSubjectOptions.map((option) => (
                      <option key={`hw-subject-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5 space-y-4">
                  {filteredPendingHomeworkReviews.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-secondary-500 dark:border-secondary-700 dark:text-secondary-400">No submitted homework is waiting for review.</div>
                  ) : (
                    filteredPendingHomeworkReviews.map(({ assignment, submission }) => {
                      const form = homeworkReviewForms[`${assignment.id}-${submission.studentId}`] || defaultHomeworkReview(assignment, submission);
                      return (
                        <div key={`review-${assignment.id}-${submission.studentId}`} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-lg font-semibold text-secondary-900 dark:text-white">{assignment.title}</div>
                              <div className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
                                {submission.student?.username || 'Student'} | {assignment.className || 'Class not set'} | {(assignment.subjectName || assignment.subject || 'Subject not set')} | Due {formatDateLabel(assignment.dueDate)} | Status {submission.status}
                              </div>
                              {submission.responseText ? <div className="mt-3 text-sm text-secondary-700 dark:text-secondary-300">{submission.responseText}</div> : null}
                              {submission.evidenceLink ? <a href={submission.evidenceLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">Open evidence</a> : null}
                            </div>
                            <div className="grid w-full gap-3 lg:max-w-md">
                              <select value={form.status} onChange={(e) => updateHomeworkReviewForm(assignment.id, submission.studentId, 'status', e.target.value)} className={inputClass}>
                                <option value="reviewed">Reviewed</option>
                                <option value="late">Late</option>
                                <option value="missing">Missing</option>
                                <option value="submitted">Submitted</option>
                              </select>
                              <input type="number" value={form.awardedPoints ?? 0} onChange={(e) => updateHomeworkReviewForm(assignment.id, submission.studentId, 'awardedPoints', e.target.value)} className={inputClass} placeholder="Awarded points" />
                              <textarea value={form.teacherFeedback || ''} onChange={(e) => updateHomeworkReviewForm(assignment.id, submission.studentId, 'teacherFeedback', e.target.value)} rows={2} placeholder="Teacher feedback" className={inputClass} />
                              <div className="flex gap-3">
                                <button type="button" onClick={() => reviewHomework(assignment, submission)} disabled={!!saving[`homework-review-${assignment.id}-${submission.studentId}`]} className="rounded-lg bg-secondary-900 px-4 py-2 text-white hover:bg-secondary-700 disabled:opacity-60 dark:bg-primary-700 dark:hover:bg-primary-600">{saving[`homework-review-${assignment.id}-${submission.studentId}`] ? 'Saving...' : 'Save review'}</button>
                                <button type="button" onClick={() => remindHomework(assignment, submission.studentId)} disabled={!!saving[`homework-remind-${assignment.id}-${submission.studentId}`]} className="rounded-lg border border-gray-200 px-4 py-2 text-secondary-700 hover:bg-gray-100 disabled:opacity-60 dark:border-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-700">Remind student</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className={cardClass}>
                <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">Today&apos;s recovery opportunities</h2>
                <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">Students who can still recover points through homework or after-school habits.</p>
                <div className="mt-4 space-y-3">
                  {recoveryOpportunities.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-secondary-500 dark:border-secondary-700 dark:text-secondary-400">
                      No immediate recovery opportunities flagged for today.
                    </div>
                  ) : (
                    recoveryOpportunities.map((item) => (
                      <div key={`recovery-${item.studentId}`} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-secondary-900 dark:text-white">{item.username}</div>
                            <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                              Daily {item.dailyScore} | Habit recovery {item.habitRecoveryPoints || 0} | Homework due today {item.homeworkDueTodayCount || 0}
                            </div>
                          </div>
                          <button type="button" onClick={() => openStudentProfile(item.studentId)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-secondary-700 hover:bg-gray-100 dark:border-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-700">
                            Open profile
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(item.habitRecoveryPoints || 0) > 0 ? <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Habits can recover {item.habitRecoveryPoints} pts</span> : null}
                          {(item.homeworkDueTodayCount || 0) > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Homework due today</span> : null}
                          {(item.homeworkMissingCount || 0) > 0 ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{item.homeworkMissingCount} missing homework</span> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cardClass}>
                <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">Students at risk</h2>
                <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">Jump straight to the student profile or flag a same-day intervention.</p>
                <div className="mt-4 space-y-3">
                  {(dashboard?.myStudentsAtRisk || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-secondary-500 dark:border-secondary-700 dark:text-secondary-400">No at-risk students for this date.</div>
                  ) : (
                    (dashboard?.myStudentsAtRisk || []).map((item) => (
                      <div key={`risk-${item.studentId}`} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-secondary-900 dark:text-white">{item.username}</div>
                            <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">Daily {item.dailyScore} | School {item.schoolScore} | Attendance {item.attendanceRate ?? 0}%</div>
                          </div>
                          <div className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{item.autoFlags?.length || 0} flags</div>
                        </div>
                        {(item.reasons || []).length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.reasons.map((reason) => (
                              <span key={`${item.studentId}-${reason}`} className="rounded-full bg-gray-200 px-2.5 py-1 text-xs text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200">{reason}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button type="button" onClick={() => openStudentProfile(item.studentId)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-secondary-700 hover:bg-gray-100 dark:border-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-700">Open student profile</button>
                          <button type="button" onClick={() => createInterventionFromRisk(item)} disabled={!!saving[`intervention-${item.studentId}`]} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">{saving[`intervention-${item.studentId}`] ? 'Flagging...' : 'Flag intervention'}</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cardClass}>
                <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">Homework due and missing</h2>
                <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">Chase the work that can still recover points today.</p>
                <div className="mt-4 space-y-3">
                  {homeworkWatchlist.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-secondary-500 dark:border-secondary-700 dark:text-secondary-400">No homework pressure items right now.</div>
                  ) : (
                    homeworkWatchlist.map((item, index) => (
                      <div key={`watch-${item.assignmentId || item.studentId || index}`} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
                        <div className="font-semibold text-secondary-900 dark:text-white">{item.title || item.username || 'Homework watch item'}</div>
                        <div className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{item.username ? `${item.username} | ` : ''}{item.className || item.subject || 'Homework'}{item.dueDate ? ` | Due ${formatDateLabel(item.dueDate)}` : ''}</div>
                        {item.assignmentId ? (
                          <div className="mt-3">
                            <button type="button" onClick={() => remindHomework({ id: item.assignmentId }, item.studentId || null)} disabled={!!saving[`homework-remind-${item.assignmentId}-${item.studentId || 'all'}`]} className="rounded-lg bg-secondary-900 px-3 py-2 text-sm text-white hover:bg-secondary-700 disabled:opacity-60 dark:bg-primary-700 dark:hover:bg-primary-600">Remind {item.studentId ? 'student' : 'class'}</button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cardClass}>
                <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">System alerts</h2>
                <div className="mt-4 space-y-3">
                  {(dashboard?.notifications?.items || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-secondary-500 dark:border-secondary-700 dark:text-secondary-400">No alerts for this school.</div>
                  ) : (
                    (dashboard?.notifications?.items || []).map((item) => (
                      <div key={`notification-${item.id}`} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-secondary-700 dark:text-secondary-200">{item.content}</div>
                          {item.unread ? <span className="rounded-full bg-primary-100 px-2 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Unread</span> : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="text-xs text-secondary-500 dark:text-secondary-400">{formatDateLabel(item.createdAt)}</div>
                          <button type="button" onClick={() => openAlertTarget(item)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-secondary-700 hover:bg-gray-100 dark:border-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-700">
                            Open linked record
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default TeacherDesk;
