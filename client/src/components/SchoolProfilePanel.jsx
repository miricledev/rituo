import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DailyHabitPlanner from './DailyHabitPlanner';
import InlineToast from './InlineToast';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const checkpoints = ['morning', 'midday', 'endOfDay'];
const checkpointLabels = { morning: 'Morning', midday: 'Midday', endOfDay: 'End of Day' };
const interventionTypes = [
  { value: 'reflection-session', label: 'Reflection session' },
  { value: 'mindset-lesson', label: 'Mindset lesson' },
  { value: 'behaviour-coaching', label: 'Behaviour coaching' },
  { value: 'pastoral-follow-up', label: 'Pastoral follow-up' },
  { value: 'parent-call', label: 'Parent call' }
];
const interventionStatuses = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'closed', label: 'Closed' }
];
const parentContactTypes = [
  { value: 'phone-call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'text-message', label: 'Text message' }
];
const schoolRoleOptions = [
  { value: 'coach', label: 'Coach' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'pastoral-lead', label: 'Pastoral lead' },
  { value: 'headteacher', label: 'Headteacher' },
  { value: 'school-admin', label: 'School admin' }
];
const behaviourKindOptions = [
  { value: 'reward', label: 'Reward' },
  { value: 'sanction', label: 'Sanction' },
  { value: 'referral', label: 'Referral' },
  { value: 'on-call', label: 'On-call' },
  { value: 'removal', label: 'Removal' }
];
const behaviourSeverityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];
const homeworkTypeOptions = [
  { value: 'practice', label: 'Practice' },
  { value: 'essay', label: 'Essay' },
  { value: 'revision', label: 'Revision' },
  { value: 'project', label: 'Project' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'reading', label: 'Reading' }
];
const homeworkComplexityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];
const homeworkStatusOptions = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'late', label: 'Late' },
  { value: 'missing', label: 'Missing' }
];
const attendanceStatusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'authorised-absence', label: 'Authorised absence' }
];
const trendStyles = {
  improving: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  worsening: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  inconsistent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
};
const dailyTones = {
  recovered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'needs-action': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'on-track': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
};
const leagueBadgeTones = {
  bronze: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  silver: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100',
  gold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  platinum: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  diamond: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
};

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-secondary-600 dark:bg-secondary-800 dark:text-white';
const inputLabelClass = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400';
const scoreGuideSteps = [
  'Start with Today recovery. If the score is low or marked needs-action, open the student before the end of the day and check which part is dragging them down.',
  'Use the lesson register first. That is the cleanest daily lever because attendance, engagement, and refocus entries immediately affect school points.',
  'Set homework with a class selected whenever possible. That keeps the assignment, reminders, and submissions inside the correct class chat rather than scattering activity.',
  'Use the weekly score and league as a recognition tool, not just a ranking. Celebrate consistent gains and use low movement as a prompt to review attendance, behaviour, and missing homework together.',
  'Only use interventions after the score breakdown explains why a student is stuck. The score cards tell you whether the issue is lesson conduct, homework completion, habits, or attendance.'
];

function LabeledField({ label, hint, className = '', children }) {
  return (
    <label className={`space-y-2 ${className}`}>
      <div>
        <div className={inputLabelClass}>{label}</div>
        {hint ? <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function getRecommendedTeacherAction(profile) {
  const scorecards = profile?.scorecards || {};
  const daily = scorecards.daily || {};
  const attendanceRate = profile?.attendanceSummary?.attendanceRate ?? 0;
  const missingHomeworkCount = profile?.homework?.missingCount ?? 0;
  const dueTodayCount = profile?.homework?.dueTodayCount ?? 0;
  const activeIntervention = (profile?.interventions || []).some((item) => ['scheduled', 'monitoring'].includes(item.status));
  const lessonCoverageGap = Math.max(
    0,
    (daily.lessonRegisterExpectedLessons ?? 0) - (daily.lessonRegisterLoggedLessons ?? 0)
  );

  if (lessonCoverageGap > 0) {
    return {
      title: 'Finish the register',
      detail: `${lessonCoverageGap} lesson ${lessonCoverageGap === 1 ? 'entry is' : 'entries are'} still missing today. Log attendance and engagement first so the daily score reflects the actual lesson.`,
      tone: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-100'
    };
  }
  if (missingHomeworkCount > 0) {
    return {
      title: 'Review missing homework',
      detail: `${missingHomeworkCount} homework ${missingHomeworkCount === 1 ? 'task is' : 'tasks are'} missing. Check whether this needs a reminder, a sanction, or a smaller support task in class chat.`,
      tone: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-100'
    };
  }
  if (dueTodayCount > 0) {
    return {
      title: 'Check today’s homework completion',
      detail: `${dueTodayCount} homework ${dueTodayCount === 1 ? 'item is' : 'items are'} due today. Use the class channel to remind students before the end of the day.`,
      tone: 'bg-violet-50 border-violet-200 text-violet-900 dark:bg-violet-950/20 dark:border-violet-900/40 dark:text-violet-100'
    };
  }
  if (attendanceRate > 0 && attendanceRate < 85) {
    return {
      title: 'Follow up on attendance',
      detail: `Attendance is at ${attendanceRate}%. Use this scorecard alongside attendance records before deciding on intervention or parent contact.`,
      tone: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-100'
    };
  }
  if (daily.status === 'needs-action' || (daily.combinedPoints ?? 0) < 0) {
    return {
      title: 'Address today’s classroom score',
      detail: 'The live score is below expected. Check behaviour points, refocus flags, and lesson notes before adding a new intervention.',
      tone: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-100'
    };
  }
  if (activeIntervention) {
    return {
      title: 'Track the live intervention',
      detail: 'There is already an active intervention on this profile. Use today’s score and homework movement to decide whether the plan is working.',
      tone: 'bg-cyan-50 border-cyan-200 text-cyan-900 dark:bg-cyan-950/20 dark:border-cyan-900/40 dark:text-cyan-100'
    };
  }
  return {
    title: 'Keep momentum visible',
    detail: 'This profile is broadly on track. Reinforce the progress publicly through the class channel or weekly league rather than adding more admin.',
    tone: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-100'
  };
}

const emptyGoal = () => ({ title: '', barrier: '', schoolGoal: '', forSelf: '', forOthers: '' });
const emptyIntervention = () => ({ interventionType: 'reflection-session', status: 'scheduled', interventionDate: new Date().toISOString().slice(0, 10), dueDate: '', ownerId: '', summary: '', nextStep: '' });
const emptyParentContact = () => ({ contactDate: new Date().toISOString().slice(0, 10), contactType: 'phone-call', outcome: '', notes: '' });
const emptyParentProfile = () => ({ name: '', relationship: '', phone: '', email: '', preferredContact: 'phone-call', receivesUpdates: true, notes: '' });
const emptyPerformance = () => ({
  cardDate: new Date().toISOString().slice(0, 10),
  checkpoints: checkpoints.map((slot) => ({ slot, attended: true, engagement: 'green', refocus: false, teacherSignature: '' }))
});
const emptyTimetable = () => ({
  id: `slot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
  weekday: 'Monday',
  startTime: '09:00',
  endTime: '10:00',
  subject: '',
  teacherId: null,
  teacherName: '',
  room: '',
  className: '',
  studentIds: []
});
const emptySubject = () => ({ id: `subject-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: '', code: '' });
const emptyRoom = () => ({ id: `room-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: '', block: '', capacity: '' });
const emptyClass = () => ({ id: `class-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: '', tutorGroup: '', yearGroup: '', roomId: '', enrollments: [], teachingAssignments: [] });
const emptyTeachingAssignment = () => ({ subjectId: '', teacherId: '' });
const emptyBehaviourType = () => ({ id: `behaviour-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: '', kind: 'reward', severity: 'low', defaultPoints: 0, noteType: '' });
const emptyBehaviourEvent = () => ({ behaviourTypeId: '', eventDate: new Date().toISOString().slice(0, 10), kind: 'reward', severity: 'low', title: '', subject: '', className: '', pointsDelta: 0, notes: '' });
const emptyHomeworkAssignment = () => ({
  title: '',
  description: '',
  instructions: '',
  homeworkType: 'practice',
  complexity: 'medium',
  assignedDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  estimatedMinutes: 30,
  maxPoints: 3,
  latePenalty: 1,
  missingPenalty: 2,
  allowLate: true,
  requiresEvidence: false,
  classId: '',
  subjectId: '',
  studentIds: []
});
const emptyHomeworkSubmission = () => ({
  completedDate: new Date().toISOString().slice(0, 10),
  responseText: '',
  evidenceLink: ''
});

export default function SchoolProfilePanel({
  group,
  groupId,
  currentUserId,
  isLeader,
  isCoach,
  profilesData,
  leagueTable,
  profilesLoading,
  refreshProfiles,
  refreshGroup,
  forcedActiveSection,
  onActiveSectionChange
}) {
  const [searchParams] = useSearchParams();
  const [goalForms, setGoalForms] = useState({});
  const [impactForms, setImpactForms] = useState({});
  const [performanceForms, setPerformanceForms] = useState({});
  const [lessonForms, setLessonForms] = useState({});
  const [behaviourEventForms, setBehaviourEventForms] = useState({});
  const [homeworkAssignments, setHomeworkAssignments] = useState([]);
  const [homeworkForm, setHomeworkForm] = useState(emptyHomeworkAssignment());
  const [homeworkSubmissionForms, setHomeworkSubmissionForms] = useState({});
  const [homeworkReviewForms, setHomeworkReviewForms] = useState({});
  const [interventionForms, setInterventionForms] = useState({});
  const [parentProfileForms, setParentProfileForms] = useState({});
  const [parentContactForms, setParentContactForms] = useState({});
  const [parentAcknowledgementNotes, setParentAcknowledgementNotes] = useState({});
  const [goalActivityForms, setGoalActivityForms] = useState({});
  const [aiPlanInputs, setAiPlanInputs] = useState({});
  const [aiPlanDrafts, setAiPlanDrafts] = useState({});
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [schoolStructure, setSchoolStructure] = useState({ roles: [], subjects: [], rooms: [], classes: [] });
  const [teacherRegisterDate, setTeacherRegisterDate] = useState(new Date().toISOString().slice(0, 10));
  const [teacherRegister, setTeacherRegister] = useState([]);
  const [teacherRegisterForms, setTeacherRegisterForms] = useState({});
  const [teacherBehaviourForms, setTeacherBehaviourForms] = useState({});
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [interventionFilters, setInterventionFilters] = useState({ ownerId: 'all', status: 'all', due: 'all' });
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);
  const [activeSection, setActiveSection] = useState('school-timetable');
  const [studentSearch, setStudentSearch] = useState('');
  const [expandedStudents, setExpandedStudents] = useState({});
  const [studentSort, setStudentSort] = useState('pinned');
  const [studentQuickFilter, setStudentQuickFilter] = useState('all');
  const [showScoreGuide, setShowScoreGuide] = useState(false);
  const schoolUiStorageKey = useMemo(() => `school-profile-panel-ui-${groupId}-${currentUserId}`, [groupId, currentUserId]);

  const profiles = useMemo(() => [...(profilesData || [])].sort((a, b) => a.student.username.localeCompare(b.student.username)), [profilesData]);
  const teacherOptions = useMemo(() => {
    const seen = new Map();
    if (group?.leader) seen.set(String(group.leader.id), { id: group.leader.id, username: group.leader.username });
    (group?.coaches || []).forEach((coach) => seen.set(String(coach.id), { id: coach.id, username: coach.username }));
    (schoolStructure.roles || [])
      .filter((assignment) => assignment.role !== 'student' && assignment.user)
      .forEach((assignment) => seen.set(String(assignment.user.id), {
        id: assignment.user.id,
        username: assignment.user.username
      }));
    return [...seen.values()];
  }, [group, schoolStructure.roles]);
  const studentOptions = useMemo(
    () => profiles.map((profile) => ({ id: profile.student.id, username: profile.student.username })),
    [profiles]
  );
  const subjectOptions = useMemo(() => {
    const subjects = [...new Set((dashboard?.subjectHistory || []).map((item) => item.subject).filter(Boolean))];
    return ['all', ...subjects];
  }, [dashboard?.subjectHistory]);
  const filteredSubjectHistory = useMemo(() => {
    const history = dashboard?.subjectHistory || [];
    return selectedSubject === 'all' ? history.slice(-18) : history.filter((item) => item.subject === selectedSubject).slice(-18);
  }, [dashboard?.subjectHistory, selectedSubject]);
  const subjectChartData = useMemo(() => {
    if (selectedSubject !== 'all') return filteredSubjectHistory;
    const rows = new Map();
    filteredSubjectHistory.forEach((item) => {
      const row = rows.get(item.date) || { date: item.date };
      row[item.subject] = item.points;
      rows.set(item.date, row);
    });
    return [...rows.values()];
  }, [filteredSubjectHistory, selectedSubject]);
  const filteredInterventions = useMemo(() => {
    const interventions = dashboard?.interventions || [];
    const todayKey = new Date().toISOString().slice(0, 10);
    return interventions.filter((item) => {
      const latest = item.latestIntervention || {};
      if (interventionFilters.ownerId !== 'all' && String(latest.ownerId || '') !== String(interventionFilters.ownerId)) {
        return false;
      }
      if (interventionFilters.status !== 'all' && String(latest.status || 'scheduled') !== interventionFilters.status) {
        return false;
      }
      if (interventionFilters.due !== 'all') {
        if (!latest.dueDate) return false;
        const dueKey = String(latest.dueDate).slice(0, 10);
        if (interventionFilters.due === 'overdue' && !(dueKey < todayKey)) return false;
        if (interventionFilters.due === 'today' && dueKey !== todayKey) return false;
        if (interventionFilters.due === 'upcoming' && !(dueKey > todayKey)) return false;
      }
      return true;
    });
  }, [dashboard?.interventions, interventionFilters]);
  const currentSchoolRole = useMemo(
    () => (schoolStructure.roles || []).find((item) => Number(item.userId) === Number(currentUserId))?.role || '',
    [currentUserId, schoolStructure.roles]
  );
  const canUseSchoolOps = isLeader || isCoach || ['teacher', 'headteacher', 'pastoral-lead', 'school-admin'].includes(currentSchoolRole);
  const canEditSchoolStructure = isLeader || ['headteacher', 'school-admin'].includes(currentSchoolRole);
  const canUseTeacherRegister = isLeader || isCoach || ['teacher', 'headteacher', 'pastoral-lead', 'school-admin'].includes(currentSchoolRole);
  const canManage = canUseSchoolOps;
  const sectionLinks = useMemo(() => {
    const links = [{ id: 'school-timetable', label: 'Timetable' }];
    if (canEditSchoolStructure) links.push({ id: 'school-structure', label: 'Structure' });
    if (canUseSchoolOps) links.push({ id: 'school-operations', label: 'Operations' });
    if (canUseTeacherRegister) links.push({ id: 'teacher-register', label: 'Register' });
    links.push({ id: 'school-homework', label: 'Homework' });
    if (canUseSchoolOps) links.push({ id: 'school-reports', label: 'Reports' });
    if (leagueTable?.length) links.push({ id: 'school-league-table', label: 'League' });
    links.push({ id: 'student-profiles', label: 'Students' });
    return links;
  }, [canEditSchoolStructure, canUseTeacherRegister, canUseSchoolOps, leagueTable?.length]);
  const filteredProfiles = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    const matched = query
      ? profiles.filter((profile) => profile.student.username.toLowerCase().includes(query))
      : profiles;

    const filtered = matched.filter((profile) => {
      if (studentQuickFilter === 'all') return true;
      if (studentQuickFilter === 'intervention') {
        return (profile.interventions || []).some((item) => ['scheduled', 'monitoring'].includes(item.status));
      }
      if (studentQuickFilter === 'goal-locked') {
        return !profile.goalActivity?.unlocked;
      }
      if (studentQuickFilter === 'attendance-low') {
        return (profile.attendanceSummary?.attendanceRate ?? 0) > 0 && (profile.attendanceSummary?.attendanceRate ?? 0) < 80;
      }
      if (studentQuickFilter === 'recovered') {
        return profile.scorecards?.daily?.status === 'recovered';
      }
      if (studentQuickFilter === 'homework-missing') {
        return (profile.homework?.missingCount ?? 0) > 0;
      }
      if (studentQuickFilter === 'homework-due') {
        return (profile.homework?.dueTodayCount ?? 0) > 0;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aOwn = Number(a.student.id) === Number(currentUserId);
      const bOwn = Number(b.student.id) === Number(currentUserId);

      if (studentSort === 'pinned') {
        if (aOwn !== bOwn) return aOwn ? -1 : 1;
        return a.student.username.localeCompare(b.student.username);
      }

      if (studentSort === 'risk') {
        const aRisk = a.scorecards?.daily?.combinedPoints ?? 0;
        const bRisk = b.scorecards?.daily?.combinedPoints ?? 0;
        if (aRisk !== bRisk) return aRisk - bRisk;
        if (aOwn !== bOwn) return aOwn ? -1 : 1;
        return a.student.username.localeCompare(b.student.username);
      }

      if (studentSort === 'score') {
        const aScore = a.scorecards?.combinedWeeklyScore ?? 0;
        const bScore = b.scorecards?.combinedWeeklyScore ?? 0;
        if (aScore !== bScore) return bScore - aScore;
        if (aOwn !== bOwn) return aOwn ? -1 : 1;
        return a.student.username.localeCompare(b.student.username);
      }

      if (studentSort === 'attendance') {
        const aAttendance = a.attendanceSummary?.attendanceRate ?? 0;
        const bAttendance = b.attendanceSummary?.attendanceRate ?? 0;
        if (aAttendance !== bAttendance) return aAttendance - bAttendance;
        if (aOwn !== bOwn) return aOwn ? -1 : 1;
        return a.student.username.localeCompare(b.student.username);
      }

      return a.student.username.localeCompare(b.student.username);
    });

    return sorted;
  }, [profiles, studentSearch, studentSort, studentQuickFilter, currentUserId]);
  const studentQuickFilters = useMemo(() => ([
    { id: 'all', label: 'All students' },
    { id: 'intervention', label: 'Needs intervention' },
    { id: 'goal-locked', label: 'Goal locked' },
    { id: 'attendance-low', label: 'Attendance under 80%' },
    { id: 'recovered', label: 'Recovered today' },
    { id: 'homework-missing', label: 'Homework missing' },
    { id: 'homework-due', label: 'Homework due today' }
  ]), []);
  const studentQuickFilterCounts = useMemo(() => {
    const counts = {
      all: profiles.length,
      intervention: 0,
      'goal-locked': 0,
      'attendance-low': 0,
      recovered: 0,
      'homework-missing': 0,
      'homework-due': 0
    };
    profiles.forEach((profile) => {
      if ((profile.interventions || []).some((item) => ['scheduled', 'monitoring'].includes(item.status))) counts.intervention += 1;
      if (!profile.goalActivity?.unlocked) counts['goal-locked'] += 1;
      const attendanceRate = profile.attendanceSummary?.attendanceRate ?? 0;
      if (attendanceRate > 0 && attendanceRate < 80) counts['attendance-low'] += 1;
      if (profile.scorecards?.daily?.status === 'recovered') counts.recovered += 1;
      if ((profile.homework?.missingCount ?? 0) > 0) counts['homework-missing'] += 1;
      if ((profile.homework?.dueTodayCount ?? 0) > 0) counts['homework-due'] += 1;
    });
    return counts;
  }, [profiles]);
  const leagueLeaders = useMemo(() => (leagueTable || []).slice(0, 3), [leagueTable]);
  const leagueAverageScore = useMemo(() => {
    if (!leagueTable?.length) return 0;
    const total = leagueTable.reduce((sum, entry) => sum + (entry.combinedWeeklyScore || 0), 0);
    return Math.round(total / leagueTable.length);
  }, [leagueTable]);
  const mostImprovedLeagueHint = useMemo(() => {
    if (!leagueTable?.length) return null;
    return [...leagueTable]
      .sort((left, right) => (right.habitRecoveryPoints || 0) - (left.habitRecoveryPoints || 0))[0];
  }, [leagueTable]);

  useEffect(() => {
    if (!sectionLinks.some((link) => link.id === activeSection)) {
      setActiveSection(sectionLinks[0]?.id || 'school-timetable');
    }
  }, [activeSection, sectionLinks]);

  useEffect(() => {
    const section = searchParams.get('section');
    const studentId = searchParams.get('student');
    if (section && sectionLinks.some((link) => link.id === section)) {
      setActiveSection(section);
    }
    if (studentId) {
      setActiveSection('student-profiles');
      setExpandedStudents((prev) => ({ ...prev, [studentId]: true, [Number(studentId)]: true }));
    }
  }, [searchParams, sectionLinks]);

  useEffect(() => {
    if (forcedActiveSection && sectionLinks.some((link) => link.id === forcedActiveSection)) {
      setActiveSection(forcedActiveSection);
    }
  }, [forcedActiveSection, sectionLinks]);

  useEffect(() => {
    if (!schoolUiStorageKey) return;
    try {
      const raw = window.localStorage.getItem(schoolUiStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!forcedActiveSection && !searchParams.get('section') && saved.activeSection) setActiveSection(saved.activeSection);
      if (typeof saved.studentSearch === 'string') setStudentSearch(saved.studentSearch);
      if (typeof saved.studentSort === 'string') setStudentSort(saved.studentSort);
      if (typeof saved.studentQuickFilter === 'string') setStudentQuickFilter(saved.studentQuickFilter);
    } catch (error) {
      // Ignore invalid persisted state.
    }
  }, [forcedActiveSection, schoolUiStorageKey, searchParams]);

  useEffect(() => {
    if (!schoolUiStorageKey) return;
    window.localStorage.setItem(schoolUiStorageKey, JSON.stringify({
      activeSection,
      studentSearch,
      studentSort,
      studentQuickFilter
    }));
  }, [activeSection, studentQuickFilter, studentSearch, studentSort, schoolUiStorageKey]);

  useEffect(() => {
    onActiveSectionChange?.(activeSection);
  }, [activeSection, onActiveSectionChange]);

  useEffect(() => {
    setExpandedStudents((prev) => {
      const next = {};
      profiles.forEach((profile) => {
        next[profile.student.id] = prev[profile.student.id] ?? false;
      });
      return next;
    });
  }, [profiles]);

  useEffect(() => {
    setTimetableEntries(group?.schoolTimetable || []);
  }, [group?.schoolTimetable]);

  useEffect(() => {
    if (!subjectOptions.includes(selectedSubject)) {
      setSelectedSubject(subjectOptions[0] || 'all');
    }
  }, [selectedSubject, subjectOptions]);

  useEffect(() => {
    if (!groupId) return;
    let isMounted = true;
    const fetchSchoolData = async () => {
      try {
        setDashboardLoading(true);
        const [dashboardResult, structureResult, registerResult, homeworkResult] = await Promise.allSettled([
          axios.get(`/groups/${groupId}/school-dashboard`),
          axios.get(`/groups/${groupId}/school-structure`),
          axios.get(`/groups/${groupId}/teacher-register`, { params: { date: teacherRegisterDate } }),
          axios.get(`/groups/${groupId}/homework`)
        ]);
        if (isMounted) {
          setDashboard(dashboardResult.status === 'fulfilled' ? (dashboardResult.value.data?.dashboard || null) : null);
          setSchoolStructure(structureResult.status === 'fulfilled' ? (structureResult.value.data?.structure || { roles: [], subjects: [], rooms: [], classes: [] }) : { roles: [], subjects: [], rooms: [], classes: [] });
          const registerData = registerResult.status === 'fulfilled' ? (registerResult.value.data?.register || []) : [];
          const homeworkData = homeworkResult.status === 'fulfilled' ? (homeworkResult.value.data?.homework || []) : [];
          setTeacherRegister(registerData);
          setHomeworkAssignments(homeworkData);
          const nextForms = {};
          const nextBehaviourForms = {};
          registerData.forEach((registerClass) => {
            (registerClass.students || []).forEach((row) => {
              nextForms[`${registerClass.slotId}-${row.student.id}`] = {
                timetableSlotId: registerClass.slotId,
                attendanceStatus: row.lesson?.attendanceStatus || 'present',
                latenessMinutes: row.lesson?.latenessMinutes || 0,
                engagement: row.lesson?.engagement || 'green',
                refocus: !!row.lesson?.refocus,
                teacherComment: row.lesson?.teacherComment || ''
              };
              nextBehaviourForms[`${registerClass.slotId}-${row.student.id}`] = {
                behaviourTypeId: '',
                kind: 'reward',
                severity: 'low',
                title: '',
                pointsDelta: 0,
                notes: ''
              };
            });
          });
          setTeacherRegisterForms(nextForms);
          setTeacherBehaviourForms(nextBehaviourForms);
        }
      } catch (error) {
        if (isMounted) setToast({ type: 'error', title: 'School dashboard not loaded', message: error.response?.data?.error || 'Please try again.' });
      } finally {
        if (isMounted) setDashboardLoading(false);
      }
    };
    fetchSchoolData();
    return () => { isMounted = false; };
  }, [groupId, profilesData, group?.schoolTimetable, teacherRegisterDate]);

  useEffect(() => {
    if (!profilesData?.length) return;
    setGoalForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => {
        next[profile.student.id] = profile.goals.length
          ? profile.goals.map((goal) => ({ title: goal.title || '', barrier: goal.barrier || '', schoolGoal: goal.schoolGoal || '', forSelf: goal.forSelf || '', forOthers: goal.forOthers || '' }))
          : [emptyGoal()];
      });
      return next;
    });
    setImpactForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => { next[profile.student.id] = next[profile.student.id] || { weekEnding: '', truancyIncidents: 0, positivePoints: 0, negativePoints: 0, coachNotes: '', evidence: null }; });
      return next;
    });
    setPerformanceForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => { next[profile.student.id] = next[profile.student.id] || emptyPerformance(); });
      return next;
    });
    setLessonForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => {
        next[profile.student.id] = {
          lessonDate: profile.lessonRegister?.date || new Date().toISOString().slice(0, 10),
          entries: (profile.lessonRegister?.entries || []).map((entry) => ({ timetableSlotId: entry.id, attendanceStatus: entry.attendanceStatus || 'present', latenessMinutes: entry.latenessMinutes || 0, attended: !!entry.attended, engagement: entry.engagement || 'green', refocus: !!entry.refocus, teacherComment: entry.teacherComment || '' }))
        };
      });
      return next;
    });
    setInterventionForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => { next[profile.student.id] = next[profile.student.id] || emptyIntervention(); });
      return next;
    });
    setBehaviourEventForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => { next[profile.student.id] = next[profile.student.id] || emptyBehaviourEvent(); });
      return next;
    });
    setHomeworkSubmissionForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => {
        (profile.homework?.assignments || []).forEach((assignment) => {
          const key = `${assignment.id}-${profile.student.id}`;
          next[key] = next[key] || emptyHomeworkSubmission();
        });
      });
      return next;
    });
    setHomeworkReviewForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => {
        (profile.homework?.assignments || []).forEach((assignment) => {
          const submission = assignment.submission || {};
          const key = `${assignment.id}-${profile.student.id}`;
          next[key] = next[key] || {
            status: submission.status || 'reviewed',
            awardedPoints: submission.awardedPoints ?? assignment.maxPoints ?? 0,
            teacherFeedback: submission.teacherFeedback || ''
          };
        });
      });
      return next;
    });
    setParentContactForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => { next[profile.student.id] = next[profile.student.id] || emptyParentContact(); });
      return next;
    });
    setParentProfileForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => {
        next[profile.student.id] = next[profile.student.id] || (profile.parentProfiles?.length ? profile.parentProfiles.map((item) => ({
          name: item.name || '',
          relationship: item.relationship || '',
          phone: item.phone || '',
          email: item.email || '',
          preferredContact: item.preferredContact || 'phone-call',
          receivesUpdates: item.receivesUpdates ?? true,
          notes: item.notes || ''
        })) : [emptyParentProfile()]);
      });
      return next;
    });
    setParentAcknowledgementNotes((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => {
        (profile.parentContacts || []).forEach((record) => {
          next[record.id] = next[record.id] ?? (record.acknowledgementNote || '');
        });
      });
      return next;
    });
    setGoalActivityForms((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => { next[profile.student.id] = next[profile.student.id] || { activity: profile.goalActivity?.activity === 'Goal activity not set' ? '' : (profile.goalActivity?.activity || ''), fallbackActivity: profile.goalActivity?.fallbackActivity || 'Reflection session' }; });
      return next;
    });
    setAiPlanInputs((prev) => {
      const next = { ...prev };
      profilesData.forEach((profile) => { next[profile.student.id] = next[profile.student.id] || ''; });
      return next;
    });
  }, [profilesData]);

  const setSavingKey = (key, value) => setSaving((prev) => ({ ...prev, [key]: value }));
  const updateGoal = (studentId, index, field, value) => setGoalForms((prev) => ({ ...prev, [studentId]: (prev[studentId] || [emptyGoal()]).map((goal, row) => row === index ? { ...goal, [field]: value } : goal) }));
  const addGoal = (studentId) => setGoalForms((prev) => ({ ...prev, [studentId]: [...(prev[studentId] || [emptyGoal()]), emptyGoal()] }));
  const removeGoal = (studentId, index) => setGoalForms((prev) => ({ ...prev, [studentId]: (prev[studentId] || []).filter((_, row) => row !== index) || [emptyGoal()] }));
  const updateImpact = (studentId, field, value) => setImpactForms((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [field]: value } }));
  const updatePerformance = (studentId, checkpointIndex, field, value) => setPerformanceForms((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || emptyPerformance()), checkpoints: (prev[studentId]?.checkpoints || emptyPerformance().checkpoints).map((checkpoint, index) => index === checkpointIndex ? { ...checkpoint, [field]: value } : checkpoint) } }));
  const updateTimetable = (entryId, field, value) => setTimetableEntries((prev) => prev.map((entry) => entry.id === entryId ? { ...entry, [field]: value } : entry));
  const toggleTimetableStudent = (entryId, studentId) => setTimetableEntries((prev) => prev.map((entry) => {
    if (entry.id !== entryId) return entry;
    const studentIds = new Set((entry.studentIds || []).map((value) => Number(value)));
    if (studentIds.has(studentId)) studentIds.delete(studentId);
    else studentIds.add(studentId);
    return { ...entry, studentIds: [...studentIds] };
  }));
  const updateLesson = (studentId, slotId, field, value) => setLessonForms((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || { lessonDate: new Date().toISOString().slice(0, 10), entries: [] }), entries: (prev[studentId]?.entries || []).map((entry) => entry.timetableSlotId === slotId ? { ...entry, [field]: value } : entry) } }));
  const updateIntervention = (studentId, field, value) => setInterventionForms((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || emptyIntervention()), [field]: value } }));
  const updateBehaviourEvent = (studentId, field, value) => setBehaviourEventForms((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || emptyBehaviourEvent()), [field]: value } }));
  const updateParentProfile = (studentId, index, field, value) => setParentProfileForms((prev) => ({
    ...prev,
    [studentId]: (prev[studentId] || [emptyParentProfile()]).map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
  }));
  const addParentProfile = (studentId) => setParentProfileForms((prev) => ({ ...prev, [studentId]: [...(prev[studentId] || [emptyParentProfile()]), emptyParentProfile()] }));
  const removeParentProfile = (studentId, index) => setParentProfileForms((prev) => ({ ...prev, [studentId]: (prev[studentId] || [emptyParentProfile()]).filter((_, itemIndex) => itemIndex !== index) || [emptyParentProfile()] }));
  const updateParentContact = (studentId, field, value) => setParentContactForms((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || emptyParentContact()), [field]: value } }));
  const updateStructureList = (key, index, field, value) => setSchoolStructure((prev) => ({ ...prev, [key]: (prev[key] || []).map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const addStructureItem = (key, factory) => setSchoolStructure((prev) => ({ ...prev, [key]: [...(prev[key] || []), factory()] }));
  const removeStructureItem = (key, index) => setSchoolStructure((prev) => ({ ...prev, [key]: (prev[key] || []).filter((_, itemIndex) => itemIndex !== index) }));
  const toggleClassEnrollment = (classIndex, studentId) => setSchoolStructure((prev) => ({
    ...prev,
    classes: (prev.classes || []).map((item, itemIndex) => {
      if (itemIndex !== classIndex) return item;
      const enrollments = new Set((item.enrollments || []).map((row) => Number(row.studentId)));
      if (enrollments.has(studentId)) enrollments.delete(studentId);
      else enrollments.add(studentId);
      return {
        ...item,
        enrollments: [...enrollments].map((id) => ({ studentId: id }))
      };
    })
  }));
  const addTeachingAssignment = (classIndex) => setSchoolStructure((prev) => ({
    ...prev,
    classes: (prev.classes || []).map((item, itemIndex) => itemIndex === classIndex ? { ...item, teachingAssignments: [...(item.teachingAssignments || []), emptyTeachingAssignment()] } : item)
  }));
  const updateTeachingAssignment = (classIndex, assignmentIndex, field, value) => setSchoolStructure((prev) => ({
    ...prev,
    classes: (prev.classes || []).map((item, itemIndex) => itemIndex === classIndex ? {
      ...item,
      teachingAssignments: (item.teachingAssignments || []).map((assignment, index) => index === assignmentIndex ? { ...assignment, [field]: value } : assignment)
    } : item)
  }));
  const removeTeachingAssignment = (classIndex, assignmentIndex) => setSchoolStructure((prev) => ({
    ...prev,
    classes: (prev.classes || []).map((item, itemIndex) => itemIndex === classIndex ? {
      ...item,
      teachingAssignments: (item.teachingAssignments || []).filter((_, index) => index !== assignmentIndex)
    } : item)
  }));
  const updateTeacherRegisterForm = (slotId, studentId, field, value) => setTeacherRegisterForms((prev) => ({
    ...prev,
    [`${slotId}-${studentId}`]: {
      ...(prev[`${slotId}-${studentId}`] || { timetableSlotId: slotId, attendanceStatus: 'present', latenessMinutes: 0, engagement: 'green', refocus: false, teacherComment: '' }),
      [field]: value
    }
  }));
  const updateTeacherBehaviourForm = (slotId, studentId, field, value) => setTeacherBehaviourForms((prev) => ({
    ...prev,
    [`${slotId}-${studentId}`]: {
      ...(prev[`${slotId}-${studentId}`] || { behaviourTypeId: '', kind: 'reward', severity: 'low', title: '', pointsDelta: 0, notes: '' }),
      [field]: value
    }
  }));
  const updateHomeworkForm = (field, value) => setHomeworkForm((prev) => ({ ...prev, [field]: value }));
  const clearStudentFilters = () => {
    setStudentSearch('');
    setStudentSort('pinned');
    setStudentQuickFilter('all');
  };
  const updateHomeworkSubmissionForm = (assignmentId, studentId, field, value) => setHomeworkSubmissionForms((prev) => ({
    ...prev,
    [`${assignmentId}-${studentId}`]: {
      ...(prev[`${assignmentId}-${studentId}`] || emptyHomeworkSubmission()),
      [field]: value
    }
  }));
  const updateHomeworkReviewForm = (assignmentId, studentId, field, value) => setHomeworkReviewForms((prev) => ({
    ...prev,
    [`${assignmentId}-${studentId}`]: {
      ...(prev[`${assignmentId}-${studentId}`] || { status: 'reviewed', awardedPoints: 0, teacherFeedback: '' }),
      [field]: value
    }
  }));
  const applyBulkRegisterField = (slotId, students, field, value) => {
    setTeacherRegisterForms((prev) => {
      const next = { ...prev };
      students.forEach((row) => {
        const key = `${slotId}-${row.student.id}`;
        next[key] = {
          ...(next[key] || { timetableSlotId: slotId, attendanceStatus: 'present', latenessMinutes: 0, engagement: 'green', refocus: false, teacherComment: '' }),
          [field]: value
        };
      });
      return next;
    });
  };
  const saveTeacherRegisterClass = async (registerClass) => {
    try {
      setSavingKey(`teacher-register-class-${registerClass.slotId}`, true);
      await Promise.all(
        (registerClass.students || []).map((row) =>
          axios.post(`/groups/${groupId}/teacher-register`, {
            studentId: row.student.id,
            lessonDate: teacherRegisterDate,
            entry: teacherRegisterForms[`${registerClass.slotId}-${row.student.id}`]
          })
        )
      );
      const registerResponse = await axios.get(`/groups/${groupId}/teacher-register`, { params: { date: teacherRegisterDate } });
      setTeacherRegister(registerResponse.data?.register || []);
      await refreshProfiles?.();
      await refreshGroup?.();
      setToast({ type: 'success', title: 'Class register saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Class register not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`teacher-register-class-${registerClass.slotId}`, false);
    }
  };
  const markNotificationRead = async (messageId) => {
    try {
      await axios.post(`/groups/messages/${messageId}/mark-read`);
      setDashboard((prev) => {
        if (!prev?.notifications) return prev;
        const items = (prev.notifications.items || []).map((item) => item.id === messageId ? { ...item, unread: false } : item);
        return {
          ...prev,
          notifications: {
            ...prev.notifications,
            items,
            unreadCount: items.filter((item) => item.unread).length
          }
        };
      });
    } catch (error) {
      setToast({ type: 'error', title: 'Alert not updated', message: error.response?.data?.error || 'Please try again.' });
    }
  };

  const saveGoals = async (studentId) => {
    try {
      setSavingKey(`goals-${studentId}`, true);
      await axios.put(`/groups/${groupId}/students/${studentId}/goal-plan`, { goals: (goalForms[studentId] || []).filter((goal) => goal.title.trim()) });
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Goal plan saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Goal plan not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`goals-${studentId}`, false);
    }
  };
  const runAiGoalPlan = async (studentId, applyPlan = false) => {
    try {
      setSavingKey(`ai-plan-${studentId}`, true);
      const response = await axios.post(`/groups/${groupId}/students/${studentId}/ai-goal-plan`, {
        sourceText: aiPlanInputs[studentId] || '',
        apply: applyPlan
      });
      const plan = response.data?.plan || {};
      setGoalForms((prev) => ({
        ...prev,
        [studentId]: (plan.goals || []).length
          ? plan.goals.map((goal) => ({
              title: goal.title || '',
              barrier: goal.barrier || '',
              schoolGoal: goal.schoolGoal || '',
              forSelf: goal.forSelf || '',
              forOthers: goal.forOthers || ''
            }))
          : [emptyGoal()]
      }));
      setGoalActivityForms((prev) => ({
        ...prev,
        [studentId]: {
          activity: plan.goalActivity?.activity || '',
          fallbackActivity: plan.goalActivity?.fallbackActivity || 'Reflection session'
        }
      }));
      setAiPlanDrafts((prev) => ({ ...prev, [studentId]: plan }));
      if (applyPlan) {
        await refreshProfiles?.();
        await refreshGroup?.();
        setToast({ type: 'success', title: 'AI plan applied', message: 'Goals, habits, and goal activity were updated from your notes.' });
      } else {
        setToast({ type: 'success', title: 'AI draft ready', message: 'Review the generated goals and habits, then apply when ready.' });
      }
    } catch (error) {
      setToast({
        type: 'error',
        title: applyPlan ? 'AI plan not applied' : 'AI draft not generated',
        message: error.response?.data?.error || 'Please try again.'
      });
    } finally {
      setSavingKey(`ai-plan-${studentId}`, false);
    }
  };
  const saveImpact = async (studentId) => {
    try {
      setSavingKey(`impact-${studentId}`, true);
      const form = impactForms[studentId];
      const payload = new FormData();
      Object.entries({ weekEnding: form.weekEnding, truancyIncidents: form.truancyIncidents || 0, positivePoints: form.positivePoints || 0, negativePoints: form.negativePoints || 0, coachNotes: form.coachNotes || '' }).forEach(([key, value]) => payload.append(key, String(value)));
      if (form.evidence) payload.append('evidence', form.evidence);
      await axios.post(`/groups/${groupId}/students/${studentId}/school-impact`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'School impact saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'School impact not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`impact-${studentId}`, false);
    }
  };
  const savePerformance = async (studentId) => {
    try {
      setSavingKey(`performance-${studentId}`, true);
      await axios.post(`/groups/${groupId}/students/${studentId}/performance-card`, performanceForms[studentId] || emptyPerformance());
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Performance card saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Performance card not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`performance-${studentId}`, false);
    }
  };
  const saveLessonRegister = async (studentId) => {
    try {
      setSavingKey(`lessons-${studentId}`, true);
      await axios.post(`/groups/${groupId}/students/${studentId}/lesson-register`, lessonForms[studentId] || { lessonDate: new Date().toISOString().slice(0, 10), entries: [] });
      await refreshProfiles?.();
      await refreshGroup?.();
      setToast({ type: 'success', title: 'Lesson register saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Lesson register not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`lessons-${studentId}`, false);
    }
  };
  const saveGoalActivity = async (studentId) => {
    try {
      setSavingKey(`activity-${studentId}`, true);
      await axios.put(`/groups/${groupId}/students/${studentId}/goal-activity`, goalActivityForms[studentId] || {});
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Goal activity saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Goal activity not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`activity-${studentId}`, false);
    }
  };
  const saveIntervention = async (studentId) => {
    try {
      setSavingKey(`intervention-${studentId}`, true);
      await axios.post(`/groups/${groupId}/students/${studentId}/interventions`, interventionForms[studentId]);
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Intervention saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Intervention not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`intervention-${studentId}`, false);
    }
  };
  const saveParentContact = async (studentId) => {
    try {
      setSavingKey(`parent-contact-${studentId}`, true);
      await axios.post(`/groups/${groupId}/students/${studentId}/parent-contacts`, parentContactForms[studentId]);
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Parent contact saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Parent contact not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`parent-contact-${studentId}`, false);
    }
  };
  const saveParentProfiles = async (studentId) => {
    try {
      setSavingKey(`parent-profiles-${studentId}`, true);
      await axios.put(`/groups/${groupId}/students/${studentId}/parent-profiles`, { profiles: parentProfileForms[studentId] || [] });
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Parent profiles saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Parent profiles not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`parent-profiles-${studentId}`, false);
    }
  };
  const acknowledgeParentContact = async (studentId, contactId, acknowledged) => {
    try {
      setSavingKey(`parent-ack-${contactId}`, true);
      await axios.post(`/groups/${groupId}/parent-contacts/${contactId}/acknowledge`, {
        acknowledged,
        acknowledgementNote: parentAcknowledgementNotes[contactId] || ''
      });
      await refreshProfiles?.();
      setToast({ type: 'success', title: acknowledged ? 'Contact acknowledged' : 'Acknowledgement removed' });
    } catch (error) {
      setToast({ type: 'error', title: 'Acknowledgement not updated', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`parent-ack-${contactId}`, false);
    }
  };
  const saveBehaviourEvent = async (studentId) => {
    try {
      setSavingKey(`behaviour-${studentId}`, true);
      await axios.post(`/groups/${groupId}/students/${studentId}/behaviour-events`, behaviourEventForms[studentId]);
      await refreshProfiles?.();
      setBehaviourEventForms((prev) => ({ ...prev, [studentId]: emptyBehaviourEvent() }));
      setToast({ type: 'success', title: 'Behaviour event saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'Behaviour event not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`behaviour-${studentId}`, false);
    }
  };
  const saveTimetable = async () => {
    try {
      setSavingKey('timetable', true);
      await axios.put(`/groups/${groupId}/school-timetable`, { entries: timetableEntries });
      await refreshGroup?.();
      setToast({ type: 'success', title: 'School timetable saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'School timetable not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey('timetable', false);
    }
  };
  const saveSchoolStructure = async () => {
    try {
      setSavingKey('structure', true);
      await axios.put(`/groups/${groupId}/school-structure`, schoolStructure);
      const structureResponse = await axios.get(`/groups/${groupId}/school-structure`);
      setSchoolStructure(structureResponse.data?.structure || { roles: [], subjects: [], rooms: [], classes: [] });
      await refreshGroup?.();
      setToast({ type: 'success', title: 'School structure saved' });
    } catch (error) {
      setToast({ type: 'error', title: 'School structure not saved', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey('structure', false);
    }
  };
  const saveTeacherRegisterRow = async (slotId, studentId) => {
    try {
      const form = teacherRegisterForms[`${slotId}-${studentId}`];
      setSavingKey(`teacher-register-${slotId}-${studentId}`, true);
      await axios.post(`/groups/${groupId}/teacher-register`, {
        studentId,
        lessonDate: teacherRegisterDate,
        entry: form
      });
      const registerResponse = await axios.get(`/groups/${groupId}/teacher-register`, { params: { date: teacherRegisterDate } });
      setTeacherRegister(registerResponse.data?.register || []);
      await refreshProfiles?.();
      await refreshGroup?.();
      setToast({ type: 'success', title: 'Register updated' });
    } catch (error) {
      setToast({ type: 'error', title: 'Register not updated', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`teacher-register-${slotId}-${studentId}`, false);
    }
  };
  const refreshHomework = async () => {
    const homeworkResponse = await axios.get(`/groups/${groupId}/homework`);
    setHomeworkAssignments(homeworkResponse.data?.homework || []);
  };
  const createHomeworkAssignment = async () => {
    try {
      setSavingKey('homework-create', true);
      await axios.post(`/groups/${groupId}/homework`, homeworkForm);
      await refreshHomework();
      await refreshProfiles?.();
      setHomeworkForm(emptyHomeworkAssignment());
      setToast({ type: 'success', title: 'Homework set' });
    } catch (error) {
      setToast({ type: 'error', title: 'Homework not set', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey('homework-create', false);
    }
  };
  const submitHomework = async (assignmentId, studentId) => {
    try {
      setSavingKey(`homework-submit-${assignmentId}-${studentId}`, true);
      await axios.post(`/groups/${groupId}/homework/${assignmentId}/submit`, {
        studentId,
        ...(homeworkSubmissionForms[`${assignmentId}-${studentId}`] || emptyHomeworkSubmission())
      });
      await refreshHomework();
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Homework submitted' });
    } catch (error) {
      setToast({ type: 'error', title: 'Homework not submitted', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`homework-submit-${assignmentId}-${studentId}`, false);
    }
  };
  const reviewHomework = async (assignmentId, studentId) => {
    try {
      setSavingKey(`homework-review-${assignmentId}-${studentId}`, true);
      await axios.post(`/groups/${groupId}/homework/${assignmentId}/mark`, {
        studentId,
        ...(homeworkReviewForms[`${assignmentId}-${studentId}`] || {})
      });
      await refreshHomework();
      await refreshProfiles?.();
      setToast({ type: 'success', title: 'Homework reviewed' });
    } catch (error) {
      setToast({ type: 'error', title: 'Homework not reviewed', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`homework-review-${assignmentId}-${studentId}`, false);
    }
  };
  const saveTeacherBehaviourLog = async (slotId, studentId) => {
    try {
      setSavingKey(`teacher-behaviour-${slotId}-${studentId}`, true);
      const form = teacherBehaviourForms[`${slotId}-${studentId}`];
      await axios.post(`/groups/${groupId}/teacher-behaviour-log`, {
        studentId,
        slotId,
        lessonDate: teacherRegisterDate,
        ...form
      });
      await refreshProfiles?.();
      await refreshHomework();
      setTeacherBehaviourForms((prev) => ({
        ...prev,
        [`${slotId}-${studentId}`]: { behaviourTypeId: '', kind: 'reward', severity: 'low', title: '', pointsDelta: 0, notes: '' }
      }));
      setToast({ type: 'success', title: 'Behaviour points logged' });
    } catch (error) {
      setToast({ type: 'error', title: 'Behaviour not logged', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSavingKey(`teacher-behaviour-${slotId}-${studentId}`, false);
    }
  };

  if (profilesLoading) return <div className="flex justify-center items-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!profiles.length) return <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-card p-8 text-center text-secondary-500 dark:text-secondary-400">No school profiles available yet.</div>;

  return (
    <div className="space-y-6">
      <InlineToast toast={toast} onClose={() => setToast(null)} />

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_220px] xl:gap-6 xl:items-start">
        <div className="space-y-6">
      <div className="xl:hidden rounded-xl border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 shadow-card p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">Jump to</div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {sectionLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setActiveSection(link.id)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium ${
                    activeSection === link.id
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'border-gray-200 text-secondary-600 hover:border-primary-200 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
                  }`}
                >
                  {link.label}
                </button>
              ))}
        </div>
      </div>

      {activeSection === 'school-timetable' && (
      <section id="school-timetable" className="scroll-mt-24 bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">School timetable</h3>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">Teachers can set lesson slots so students place habits around the school day.</p>
          </div>
          {canManage ? <button type="button" onClick={() => setTimetableEntries((prev) => [...prev, emptyTimetable()])} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add lesson</button> : null}
        </div>
        {!timetableEntries.length ? (
          <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No lesson slots added yet.</div>
        ) : (
          <div className="space-y-3">
            {timetableEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <select value={entry.weekday} disabled={!canManage} onChange={(e) => updateTimetable(entry.id, 'weekday', e.target.value)} className={inputClass}>{weekdays.map((day) => <option key={day} value={day}>{day}</option>)}</select>
                  <input type="time" value={entry.startTime || ''} disabled={!canManage} onChange={(e) => updateTimetable(entry.id, 'startTime', e.target.value)} className={inputClass} />
                  <input type="time" value={entry.endTime || ''} disabled={!canManage} onChange={(e) => updateTimetable(entry.id, 'endTime', e.target.value)} className={inputClass} />
                  <select value={entry.subjectId || ''} disabled={!canManage} onChange={(e) => { const subject = (schoolStructure.subjects || []).find((item) => String(item.id) === String(e.target.value)); updateTimetable(entry.id, 'subjectId', e.target.value || ''); updateTimetable(entry.id, 'subject', subject?.name || ''); }} className={inputClass}>
                    <option value="">Subject</option>
                    {(schoolStructure.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                  <select value={entry.teacherId || ''} disabled={!canManage} onChange={(e) => { const teacher = teacherOptions.find((option) => String(option.id) === String(e.target.value)); updateTimetable(entry.id, 'teacherId', e.target.value ? Number(e.target.value) : null); updateTimetable(entry.id, 'teacherName', teacher?.username || ''); }} className={inputClass}>
                    <option value="">Teacher</option>
                    {teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.username}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <select value={entry.roomId || ''} disabled={!canManage} onChange={(e) => { const room = (schoolStructure.rooms || []).find((item) => String(item.id) === String(e.target.value)); updateTimetable(entry.id, 'roomId', e.target.value || ''); updateTimetable(entry.id, 'room', room?.name || ''); }} className={`${inputClass} min-w-0 flex-1`}>
                      <option value="">Room</option>
                      {(schoolStructure.rooms || []).map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </select>
                    {canManage ? <button type="button" onClick={() => setTimetableEntries((prev) => prev.filter((item) => item.id !== entry.id))} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove</button> : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={entry.teacherName || ''} disabled className={`${inputClass} opacity-70`} placeholder="Teacher name" />
                  <select value={entry.classId || ''} disabled={!canManage} onChange={(e) => { const schoolClass = (schoolStructure.classes || []).find((item) => String(item.id) === String(e.target.value)); updateTimetable(entry.id, 'classId', e.target.value || ''); updateTimetable(entry.id, 'className', schoolClass?.name || ''); updateTimetable(entry.id, 'studentIds', (schoolClass?.enrollments || []).map((row) => row.studentId)); }} className={inputClass}>
                    <option value="">Class / tutor group</option>
                    {(schoolStructure.classes || []).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                  </select>
                </div>
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Class roster</div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                    {studentOptions.map((student) => {
                      const checked = (entry.studentIds || []).some((value) => Number(value) === student.id);
                      return (
                        <label key={`${entry.id}-${student.id}`} className="flex items-center gap-2 rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300">
                          <input type="checkbox" disabled={!canManage} checked={checked} onChange={() => toggleTimetableStudent(entry.id, student.id)} />
                          <span>{student.username}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Leave this empty to include all visible students, or set a real class roster for this lesson.</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {canManage ? <div className="mt-4 flex justify-end"><button type="button" onClick={saveTimetable} disabled={!!saving.timetable} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving.timetable ? 'Saving...' : 'Save timetable'}</button></div> : null}
      </section>
      )}

      {canEditSchoolStructure && activeSection === 'school-structure' ? (
        <section id="school-structure" className="scroll-mt-24 bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">School structure</h3>
              <p className="text-sm text-secondary-500 dark:text-secondary-400">Define staff roles, subjects, rooms, classes, and enrollments for the school MIS layer.</p>
            </div>
            <button type="button" onClick={saveSchoolStructure} disabled={!!saving.structure} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving.structure ? 'Saving...' : 'Save structure'}</button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5 space-y-3">
              <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Staff roles</h4>
              {teacherOptions.map((teacher) => {
                const currentRole = (schoolStructure.roles || []).find((item) => Number(item.userId) === teacher.id)?.role || '';
                return (
                  <div key={`role-${teacher.id}`} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300">{teacher.username}</div>
                    <select value={currentRole} onChange={(e) => setSchoolStructure((prev) => {
                      const others = (prev.roles || []).filter((item) => Number(item.userId) !== teacher.id);
                      return { ...prev, roles: e.target.value ? [...others, { userId: teacher.id, role: e.target.value }] : others };
                    })} className={inputClass}>
                      <option value="">No extra role</option>
                      {schoolRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Subjects</h4>
                <button type="button" onClick={() => addStructureItem('subjects', emptySubject)} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add subject</button>
              </div>
              {(schoolStructure.subjects || []).map((subject, index) => (
                <div key={subject.id || `subject-${index}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_90px] gap-3">
                  <input value={subject.name || ''} onChange={(e) => updateStructureList('subjects', index, 'name', e.target.value)} placeholder="Subject name" className={inputClass} />
                  <input value={subject.code || ''} onChange={(e) => updateStructureList('subjects', index, 'code', e.target.value)} placeholder="Code" className={inputClass} />
                  <button type="button" onClick={() => removeStructureItem('subjects', index)} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Rooms</h4>
                <button type="button" onClick={() => addStructureItem('rooms', emptyRoom)} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add room</button>
              </div>
              {(schoolStructure.rooms || []).map((room, index) => (
                <div key={room.id || `room-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input value={room.name || ''} onChange={(e) => updateStructureList('rooms', index, 'name', e.target.value)} placeholder="Room" className={inputClass} />
                  <input value={room.block || ''} onChange={(e) => updateStructureList('rooms', index, 'block', e.target.value)} placeholder="Block" className={inputClass} />
                  <input type="number" min="0" value={room.capacity || ''} onChange={(e) => updateStructureList('rooms', index, 'capacity', e.target.value)} placeholder="Capacity" className={inputClass} />
                  <button type="button" onClick={() => removeStructureItem('rooms', index)} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove</button>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Classes</h4>
                <button type="button" onClick={() => addStructureItem('classes', emptyClass)} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add class</button>
              </div>
              {(schoolStructure.classes || []).map((schoolClass, classIndex) => (
                <div key={schoolClass.id || `class-${classIndex}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input value={schoolClass.name || ''} onChange={(e) => updateStructureList('classes', classIndex, 'name', e.target.value)} placeholder="Class name" className={inputClass} />
                    <input value={schoolClass.tutorGroup || ''} onChange={(e) => updateStructureList('classes', classIndex, 'tutorGroup', e.target.value)} placeholder="Tutor group" className={inputClass} />
                    <input value={schoolClass.yearGroup || ''} onChange={(e) => updateStructureList('classes', classIndex, 'yearGroup', e.target.value)} placeholder="Year group" className={inputClass} />
                    <select value={schoolClass.roomId || ''} onChange={(e) => updateStructureList('classes', classIndex, 'roomId', e.target.value)} className={inputClass}>
                      <option value="">Room</option>
                      {(schoolStructure.rooms || []).map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-secondary-900 dark:text-white mb-2">Students</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                      {studentOptions.map((student) => {
                        const checked = (schoolClass.enrollments || []).some((item) => Number(item.studentId) === student.id);
                        return (
                          <label key={`${schoolClass.id}-${student.id}`} className="flex items-center gap-2 rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300">
                            <input type="checkbox" checked={checked} onChange={() => toggleClassEnrollment(classIndex, student.id)} />
                            <span>{student.username}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-secondary-900 dark:text-white">Teaching assignments</div>
                      <button type="button" onClick={() => addTeachingAssignment(classIndex)} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add teacher</button>
                    </div>
                    <div className="space-y-2">
                      {(schoolClass.teachingAssignments || []).map((assignment, assignmentIndex) => (
                        <div key={`${schoolClass.id}-assignment-${assignmentIndex}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px] gap-3">
                          <select value={assignment.subjectId || ''} onChange={(e) => updateTeachingAssignment(classIndex, assignmentIndex, 'subjectId', e.target.value)} className={inputClass}>
                            <option value="">Subject</option>
                            {(schoolStructure.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                          </select>
                          <select value={assignment.teacherId || ''} onChange={(e) => updateTeachingAssignment(classIndex, assignmentIndex, 'teacherId', e.target.value)} className={inputClass}>
                            <option value="">Teacher</option>
                            {teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.username}</option>)}
                          </select>
                          <button type="button" onClick={() => removeTeachingAssignment(classIndex, assignmentIndex)} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => removeStructureItem('classes', classIndex)} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove class</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Behaviour catalogue</h4>
                <button type="button" onClick={() => addStructureItem('behaviourTypes', emptyBehaviourType)} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add type</button>
              </div>
              {(schoolStructure.behaviourTypes || []).map((item, index) => (
                <div key={item.id || `behaviour-type-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <input value={item.name || ''} onChange={(e) => updateStructureList('behaviourTypes', index, 'name', e.target.value)} placeholder="Name" className={inputClass} />
                  <select value={item.kind || 'reward'} onChange={(e) => updateStructureList('behaviourTypes', index, 'kind', e.target.value)} className={inputClass}>
                    {behaviourKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={item.severity || 'low'} onChange={(e) => updateStructureList('behaviourTypes', index, 'severity', e.target.value)} className={inputClass}>
                    {behaviourSeverityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input type="number" value={item.defaultPoints || 0} onChange={(e) => updateStructureList('behaviourTypes', index, 'defaultPoints', e.target.value)} placeholder="Points" className={inputClass} />
                  <div className="flex gap-2">
                    <input value={item.noteType || ''} onChange={(e) => updateStructureList('behaviourTypes', index, 'noteType', e.target.value)} placeholder="Note type" className={`${inputClass} min-w-0 flex-1`} />
                    <button type="button" onClick={() => removeStructureItem('behaviourTypes', index)} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {canUseSchoolOps && dashboard && activeSection === 'school-operations' ? (
        <section id="school-operations" className="scroll-mt-24 bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">School operations</h3>
              <p className="text-sm text-secondary-500 dark:text-secondary-400">See who is at risk today, lesson coverage, and which subjects need attention.</p>
            </div>
            {dashboardLoading ? <div className="text-sm text-secondary-500 dark:text-secondary-400">Refreshing...</div> : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4"><div className="text-xs uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Students</div><div className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">{dashboard.overview?.studentCount ?? 0}</div></div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 p-4"><div className="text-xs uppercase tracking-wide text-red-600 dark:text-red-300">At risk</div><div className="mt-2 text-3xl font-bold text-red-700 dark:text-red-200">{dashboard.overview?.atRiskCount ?? 0}</div></div>
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 p-4"><div className="text-xs uppercase tracking-wide text-green-600 dark:text-green-300">Recovered</div><div className="mt-2 text-3xl font-bold text-green-700 dark:text-green-200">{dashboard.overview?.recoveredTodayCount ?? 0}</div></div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-4"><div className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-300">Overdue actions</div><div className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-200">{dashboard.overview?.overdueActionsCount ?? 0}</div></div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-4"><div className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-300">Lesson marks</div><div className="mt-2 text-3xl font-bold text-blue-700 dark:text-blue-200">{dashboard.overview?.loggedLessonMarks ?? 0}/{dashboard.overview?.expectedLessonMarks ?? 0}</div></div>
            <div className="rounded-xl bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4"><div className="text-xs uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Avg attendance</div><div className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">{dashboard.overview?.averageAttendanceRate ?? 0}%</div></div>
            <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40 p-4"><div className="text-xs uppercase tracking-wide text-violet-600 dark:text-violet-300">Avg homework</div><div className="mt-2 text-3xl font-bold text-violet-700 dark:text-violet-200">{dashboard.overview?.averageHomeworkPoints ?? 0}</div></div>
          </div>
          {!!dashboard.notifications?.items?.length ? (
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">System alerts</h4>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400">{dashboard.notifications.unreadCount ?? 0} unread alerts for staff.</p>
                </div>
              </div>
              <div className="space-y-3">
                {dashboard.notifications.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.unread && markNotificationRead(item.id)}
                    className={`w-full rounded-lg border p-4 text-left ${item.unread ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20' : 'border-gray-200 bg-gray-50 dark:border-secondary-700 dark:bg-secondary-900/60'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-secondary-900 dark:text-white">{item.content}</div>
                      {item.unread ? <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">Unread</span> : null}
                    </div>
                    <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {!!dashboard.recentActivity?.length ? (
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Recent activity</h4>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400">See who changed school records most recently.</p>
                </div>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {dashboard.recentActivity.map((item) => (
                  <div key={`audit-${item.id}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-secondary-900 dark:text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                          {item.actor?.username || 'Staff'}
                          {item.student?.username ? ` | ${item.student.username}` : ''}
                          {item.entityType ? ` | ${item.entityType}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-secondary-500 dark:text-secondary-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                      </div>
                    </div>
                    {item.description ? <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-300">{item.description}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!!dashboard.myStudentsAtRisk?.length ? (
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">My students at risk</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {dashboard.myStudentsAtRisk.map((item) => (
                  <div key={`risk-${item.studentId}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                    <div className="font-medium text-secondary-900 dark:text-white">{item.username}</div>
                    <div className="mt-2 text-sm text-red-600 dark:text-red-300">{item.dailyScore} daily points</div>
                    {item.assignedOwner?.username ? <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Owner: {item.assignedOwner.username}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!!dashboard.overdueInterventions?.length ? (
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Overdue actions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {dashboard.overdueInterventions.map((item) => (
                  <div key={`overdue-${item.studentId}`} className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-4">
                    <div className="font-medium text-secondary-900 dark:text-white">{item.username}</div>
                    <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">{item.latestIntervention?.interventionType || 'Intervention'} overdue</div>
                    <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
                      {item.assignedOwner?.username ? `Owner: ${item.assignedOwner.username}` : 'Owner not set'}
                      {item.latestIntervention?.dueDate ? ` | Due ${new Date(item.latestIntervention.dueDate).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <div className="flex flex-col gap-3 mb-4 xl:flex-row xl:items-center xl:justify-between">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Intervention queue</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select value={interventionFilters.ownerId} onChange={(e) => setInterventionFilters((prev) => ({ ...prev, ownerId: e.target.value }))} className={inputClass}>
                    <option value="all">All owners</option>
                    {teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.username}</option>)}
                  </select>
                  <select value={interventionFilters.status} onChange={(e) => setInterventionFilters((prev) => ({ ...prev, status: e.target.value }))} className={inputClass}>
                    <option value="all">All statuses</option>
                    {interventionStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={interventionFilters.due} onChange={(e) => setInterventionFilters((prev) => ({ ...prev, due: e.target.value }))} className={inputClass}>
                    <option value="all">All due dates</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Due today</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </div>
              </div>
              {!filteredInterventions.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No students currently match these intervention filters.</div> : (
                <div className="space-y-3">
                  {filteredInterventions.map((item) => (
                    <div key={item.studentId} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-secondary-900 dark:text-white">{item.username}</div>
                        <div className={`text-sm font-semibold ${item.dailyScore < 0 ? 'text-red-600 dark:text-red-300' : 'text-secondary-700 dark:text-secondary-200'}`}>{item.dailyScore} pts</div>
                      </div>
                      <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{item.reasons.join(' | ')}</div>
                      {!!item.autoFlags?.length ? <div className="mt-2 flex flex-wrap gap-2">{item.autoFlags.map((flag) => <span key={`${item.studentId}-${flag}`} className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">{flag}</span>)}</div> : null}
                      {item.latestIntervention ? <div className="mt-2 text-xs text-primary-700 dark:text-primary-300">Latest: {item.latestIntervention.interventionType} | {item.latestIntervention.status} | {new Date(item.latestIntervention.interventionDate).toLocaleDateString()}</div> : null}
                      {item.assignedOwner?.username ? <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">Owner: {item.assignedOwner.username}{item.latestIntervention?.dueDate ? ` | Due ${new Date(item.latestIntervention.dueDate).toLocaleDateString()}` : ''}</div> : null}
                      <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">Attendance {item.attendanceRate ?? 0}%</div>
                      <div className="mt-3 text-sm text-secondary-700 dark:text-secondary-300">{item.recommendedAction}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Subject risk view</h4>
              {!dashboard.subjectSummaries?.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No subject data yet for today.</div> : (
                <div className="grid grid-cols-1 gap-3">
                  {dashboard.subjectSummaries.slice(0, 6).map((subject) => (
                    <div key={subject.subject} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-secondary-900 dark:text-white">{subject.subject}</div>
                          <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{subject.teacherName || 'Teacher not set'}</div>
                        </div>
                        <div className={`text-sm font-semibold ${subject.averagePointsPerLesson < 0 ? 'text-red-600 dark:text-red-300' : 'text-secondary-700 dark:text-secondary-200'}`}>{subject.averagePointsPerLesson} avg</div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-secondary-500 dark:text-secondary-400">
                        <div>Coverage {subject.coverageRate}%</div>
                        <div>Negative {subject.negativeLessons}</div>
                        <div>Missing {subject.missingStudents}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {!!dashboard.homework?.overview ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Homework pressure</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Assignments</div>
                    <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{dashboard.homework.overview.assignmentCount ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Due today</div>
                    <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{dashboard.homework.overview.dueTodayCount ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Submitted today</div>
                    <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{dashboard.homework.overview.submittedTodayCount ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Missing</div>
                    <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{dashboard.homework.overview.missingCount ?? 0}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Homework watchlist</h4>
                {!dashboard.homework.assignments?.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No homework pressure right now.</div> : (
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {dashboard.homework.assignments.slice(0, 8).map((item) => (
                      <div key={`homework-watch-${item.assignmentId}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-secondary-900 dark:text-white">{item.title}</div>
                          <div className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">{item.missingCount} missing</div>
                        </div>
                        <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Due {new Date(item.dueDate).toLocaleDateString()} | {item.subject || 'No subject'}{item.className ? ` | ${item.className}` : ''}</div>
                        <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{item.completedCount}/{item.studentCount} submitted</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {!!dashboard.staffAccountability?.length ? (
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Staff accountability</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {dashboard.staffAccountability.map((item) => (
                  <div key={`staff-${item.teacherId || item.teacherName}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                    <div className="font-medium text-secondary-900 dark:text-white">{item.teacherName}</div>
                    <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{item.coverageRate}%</div>
                    <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{item.loggedRegisters}/{item.expectedRegisters} registers logged</div>
                    <div className="mt-1 text-xs text-red-600 dark:text-red-300">{item.missingRegisters} missing</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!!dashboard.subjectHistory?.length ? (
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
              <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Weekly subject trend</h4>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className={`${inputClass} md:max-w-xs`}>
                  {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject === 'all' ? 'All subjects' : subject}</option>)}
                </select>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={subjectChartData}>
                    <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} formatter={(value, name, props) => [value, props?.payload?.subject || name || selectedSubject]} />
                    {selectedSubject === 'all'
                      ? subjectOptions.filter((subject) => subject !== 'all').slice(0, 4).map((subject, index) => (
                        <Line
                          key={subject}
                          type="monotone"
                          dataKey={subject}
                          name={subject}
                          stroke={['#2563eb', '#16a34a', '#dc2626', '#d97706'][index % 4]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))
                      : <Line type="monotone" dataKey="points" stroke="#2563eb" strokeWidth={2} name={selectedSubject} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
          {!!dashboard.attendance?.trend?.length ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Attendance trend</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboard.attendance.trend}>
                      <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} formatter={(value) => [`${value}%`, 'Attendance']} />
                      <Line type="monotone" dataKey="attendanceRate" stroke="#0f766e" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Lowest attendance students</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {(dashboard.attendance.students || []).slice(0, 8).map((item) => (
                    <div key={`attendance-student-${item.studentId}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-secondary-900 dark:text-white">{item.username}</div>
                        <div className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">{item.attendanceRate}%</div>
                      </div>
                      <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Present {item.present} | Late {item.late} | Absent {item.absent} | Authorised {item.authorisedAbsence}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {!!dashboard.attendance?.classes?.length ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Attendance by class</h4>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {dashboard.attendance.classes.slice(0, 10).map((item) => (
                    <div key={`attendance-class-${item.className}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-secondary-900 dark:text-white">{item.className}</div>
                        <div className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">{item.attendanceRate}%</div>
                      </div>
                      <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Present {item.present} | Late {item.late} | Absent {item.absent}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Attendance by subject</h4>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {dashboard.attendance.subjects.slice(0, 10).map((item) => (
                    <div key={`attendance-subject-${item.subject}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-secondary-900 dark:text-white">{item.subject}</div>
                        <div className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">{item.attendanceRate}%</div>
                      </div>
                      <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Present {item.present} | Late {item.late} | Absent {item.absent}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {canUseTeacherRegister && activeSection === 'teacher-register' ? (
        <section id="teacher-register" className="scroll-mt-24 bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-6 space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">Teacher register</h3>
              <p className="text-sm text-secondary-500 dark:text-secondary-400">Rapid lesson-by-lesson register for staff, with attendance separate from behaviour scoring.</p>
            </div>
            <input type="date" value={teacherRegisterDate} onChange={(e) => setTeacherRegisterDate(e.target.value)} className={`${inputClass} md:max-w-xs`} />
          </div>
          {!teacherRegister.length ? (
            <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No classes available for this date yet.</div>
          ) : (
            <div className="space-y-4">
              {teacherRegister.map((registerClass) => (
                <div key={`register-${registerClass.slotId}`} className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="text-lg font-semibold text-secondary-900 dark:text-white">{registerClass.startTime} - {registerClass.endTime} | {registerClass.subject}</div>
                      <div className="text-sm text-secondary-500 dark:text-secondary-400">{registerClass.className || 'Class not set'}{registerClass.room ? ` | ${registerClass.room}` : ''}{registerClass.teacherName ? ` | ${registerClass.teacherName}` : ''}</div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button type="button" onClick={() => applyBulkRegisterField(registerClass.slotId, registerClass.students, 'attendanceStatus', 'present')} className="rounded-full bg-gray-100 dark:bg-secondary-900/60 px-3 py-1.5 text-xs font-medium text-secondary-700 dark:text-secondary-300">All present</button>
                      <button type="button" onClick={() => applyBulkRegisterField(registerClass.slotId, registerClass.students, 'engagement', 'green')} className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300">All green</button>
                      <button type="button" onClick={() => saveTeacherRegisterClass(registerClass)} disabled={!!saving[`teacher-register-class-${registerClass.slotId}`]} className="px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
                        {saving[`teacher-register-class-${registerClass.slotId}`] ? 'Saving class...' : 'Save class'}
                      </button>
                      <div className="text-sm text-secondary-500 dark:text-secondary-400">{registerClass.students.length} students</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {registerClass.students.map((row) => {
                      const form = teacherRegisterForms[`${registerClass.slotId}-${row.student.id}`] || { timetableSlotId: registerClass.slotId, attendanceStatus: 'present', latenessMinutes: 0, engagement: 'green', refocus: false, teacherComment: '' };
                      const behaviourForm = teacherBehaviourForms[`${registerClass.slotId}-${row.student.id}`] || { behaviourTypeId: '', kind: 'reward', severity: 'low', title: '', pointsDelta: 0, notes: '' };
                      return (
                        <div key={`${registerClass.slotId}-${row.student.id}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                              <div className="font-medium text-secondary-900 dark:text-white">{row.student.username}</div>
                              <div className="text-xs text-secondary-500 dark:text-secondary-400">Attendance this week: {row.attendanceSummary?.attendanceRate ?? 0}%</div>
                            </div>
                            <button type="button" onClick={() => saveTeacherRegisterRow(registerClass.slotId, row.student.id)} disabled={!!saving[`teacher-register-${registerClass.slotId}-${row.student.id}`]} className="px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
                              {saving[`teacher-register-${registerClass.slotId}-${row.student.id}`] ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <select value={form.attendanceStatus} onChange={(e) => updateTeacherRegisterForm(registerClass.slotId, row.student.id, 'attendanceStatus', e.target.value)} className={inputClass}>
                              {attendanceStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <input type="number" min="0" value={form.latenessMinutes || 0} onChange={(e) => updateTeacherRegisterForm(registerClass.slotId, row.student.id, 'latenessMinutes', e.target.value)} className={inputClass} placeholder="Late mins" />
                            <select value={form.engagement} onChange={(e) => updateTeacherRegisterForm(registerClass.slotId, row.student.id, 'engagement', e.target.value)} className={inputClass}>
                              <option value="green">Green (+4)</option>
                              <option value="amber">Amber (+1)</option>
                              <option value="red">Red (-3)</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-300"><input type="checkbox" checked={!!form.refocus} onChange={(e) => updateTeacherRegisterForm(registerClass.slotId, row.student.id, 'refocus', e.target.checked)} />Refocus</label>
                            <div className="rounded-lg bg-white dark:bg-secondary-800 px-3 py-2 text-sm text-secondary-600 dark:text-secondary-300">{row.lesson?.points ?? 0} pts</div>
                          </div>
                          <textarea value={form.teacherComment || ''} onChange={(e) => updateTeacherRegisterForm(registerClass.slotId, row.student.id, 'teacherComment', e.target.value)} rows={2} placeholder="Teacher comment" className={`${inputClass} mt-3`} />
                          <div className="mt-4 rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">Quick behaviour points</div>
                                <div className="text-xs text-secondary-500 dark:text-secondary-400">Log lesson behaviour straight from the register and feed it into points.</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => saveTeacherBehaviourLog(registerClass.slotId, row.student.id)}
                                disabled={!!saving[`teacher-behaviour-${registerClass.slotId}-${row.student.id}`]}
                                className="px-3 py-2 rounded-lg bg-secondary-900 text-white hover:bg-secondary-700 dark:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-60"
                              >
                                {saving[`teacher-behaviour-${registerClass.slotId}-${row.student.id}`] ? 'Logging...' : 'Log points'}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(schoolStructure.behaviourTypes || []).slice(0, 6).map((item) => (
                                <button
                                  key={`quick-behaviour-${registerClass.slotId}-${row.student.id}-${item.id}`}
                                  type="button"
                                  onClick={() => {
                                    updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'behaviourTypeId', item.id);
                                    updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'title', item.name);
                                    updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'kind', item.kind);
                                    updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'severity', item.severity);
                                    updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'pointsDelta', item.defaultPoints ?? 0);
                                  }}
                                  className="rounded-full bg-gray-100 dark:bg-secondary-900/60 px-3 py-1.5 text-xs font-medium text-secondary-700 dark:text-secondary-300 hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/20 dark:hover:text-primary-300"
                                >
                                  {item.name}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                              <select
                                value={behaviourForm.behaviourTypeId || ''}
                                onChange={(e) => {
                                  const selected = (schoolStructure.behaviourTypes || []).find((item) => String(item.id) === String(e.target.value));
                                  updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'behaviourTypeId', e.target.value);
                                  updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'title', selected?.name || '');
                                  updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'kind', selected?.kind || 'reward');
                                  updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'severity', selected?.severity || 'low');
                                  updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'pointsDelta', selected?.defaultPoints ?? 0);
                                }}
                                className={inputClass}
                              >
                                <option value="">Behaviour type</option>
                                {(schoolStructure.behaviourTypes || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                              <select value={behaviourForm.kind} onChange={(e) => updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'kind', e.target.value)} className={inputClass}>
                                {behaviourKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                              <select value={behaviourForm.severity} onChange={(e) => updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'severity', e.target.value)} className={inputClass}>
                                {behaviourSeverityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                              <input value={behaviourForm.title} onChange={(e) => updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'title', e.target.value)} placeholder="Title" className={inputClass} />
                              <input type="number" value={behaviourForm.pointsDelta ?? 0} onChange={(e) => updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'pointsDelta', e.target.value)} placeholder="Points" className={inputClass} />
                            </div>
                            <textarea value={behaviourForm.notes || ''} onChange={(e) => updateTeacherBehaviourForm(registerClass.slotId, row.student.id, 'notes', e.target.value)} rows={2} placeholder="Quick lesson note" className={inputClass} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeSection === 'school-homework' ? (
        <section id="school-homework" className="scroll-mt-24 bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-6 space-y-6">
          <div>
            <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">Homework and recovery points</h3>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">Set class homework, let students submit after school, and turn completed homework into live recovery points.</p>
          </div>

          {canUseSchoolOps ? (
            <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Set homework</h4>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400">Assign homework to a whole class or a selected student group.</p>
                </div>
                <button type="button" onClick={createHomeworkAssignment} disabled={!!saving['homework-create']} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
                  {saving['homework-create'] ? 'Saving...' : 'Set homework'}
                </button>
              </div>
              <div className="rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-4 dark:border-primary-900/40 dark:bg-primary-900/10">
                <div className="text-sm font-semibold text-primary-700 dark:text-primary-300">Recommended flow</div>
                <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-200">
                  Choose the class first, then the subject, then the due date. Use specific students only when a smaller intervention group needs a separate task.
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <LabeledField label="Homework title" hint="What staff and students will see in the class feed.">
                  <input value={homeworkForm.title} onChange={(e) => updateHomeworkForm('title', e.target.value)} placeholder="Algebra worksheet" className={inputClass} />
                </LabeledField>
                <LabeledField label="Homework type" hint="Choose the task style for reporting and filtering.">
                  <select value={homeworkForm.homeworkType} onChange={(e) => updateHomeworkForm('homeworkType', e.target.value)} className={inputClass}>
                    {homeworkTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </LabeledField>
                <LabeledField label="Difficulty" hint="Use this to signal expected effort.">
                  <select value={homeworkForm.complexity} onChange={(e) => updateHomeworkForm('complexity', e.target.value)} className={inputClass}>
                    {homeworkComplexityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </LabeledField>
                <LabeledField label="Subject" hint="Used in subject reports and trend charts.">
                  <select value={homeworkForm.subjectId} onChange={(e) => updateHomeworkForm('subjectId', e.target.value)} className={inputClass}>
                    <option value="">Select subject</option>
                    {(schoolStructure.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </LabeledField>
                <LabeledField label="Class" hint="This decides which class chat receives the homework activity.">
                  <select value={homeworkForm.classId} onChange={(e) => updateHomeworkForm('classId', e.target.value)} className={inputClass}>
                    <option value="">Select class</option>
                    {(schoolStructure.classes || []).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                  </select>
                </LabeledField>
                <LabeledField label="Assigned date" hint="Usually today.">
                  <input type="date" value={homeworkForm.assignedDate} onChange={(e) => updateHomeworkForm('assignedDate', e.target.value)} className={inputClass} />
                </LabeledField>
                <LabeledField label="Due date" hint="Students see this in homework tracking and reminders.">
                  <input type="date" value={homeworkForm.dueDate} onChange={(e) => updateHomeworkForm('dueDate', e.target.value)} className={inputClass} />
                </LabeledField>
                <LabeledField label="Estimated minutes" hint="Helps staff judge workload balance.">
                  <input type="number" min="5" value={homeworkForm.estimatedMinutes} onChange={(e) => updateHomeworkForm('estimatedMinutes', e.target.value)} placeholder="30" className={inputClass} />
                </LabeledField>
                <LabeledField label="Max points" hint="Points available once reviewed.">
                  <input type="number" min="0" value={homeworkForm.maxPoints} onChange={(e) => updateHomeworkForm('maxPoints', e.target.value)} placeholder="3" className={inputClass} />
                </LabeledField>
                <LabeledField label="Late penalty" hint="Deduction applied when marked late.">
                  <input type="number" min="0" value={homeworkForm.latePenalty} onChange={(e) => updateHomeworkForm('latePenalty', e.target.value)} placeholder="1" className={inputClass} />
                </LabeledField>
                <LabeledField label="Missing penalty" hint="Deduction if no valid submission is made.">
                  <input type="number" min="0" value={homeworkForm.missingPenalty} onChange={(e) => updateHomeworkForm('missingPenalty', e.target.value)} placeholder="2" className={inputClass} />
                </LabeledField>
                <LabeledField label="Late submissions" hint="Turn this off for hard deadlines.">
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-secondary-700 px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300">
                    <input type="checkbox" checked={!!homeworkForm.allowLate} onChange={(e) => updateHomeworkForm('allowLate', e.target.checked)} />
                    Allow late submission
                  </label>
                </LabeledField>
              </div>
              <LabeledField label="Description" hint="One-line summary shown in the homework card.">
                <textarea value={homeworkForm.description} onChange={(e) => updateHomeworkForm('description', e.target.value)} rows={2} placeholder="Complete questions 1 to 12 on fractions." className={inputClass}></textarea>
              </LabeledField>
              <LabeledField label="Instructions" hint="Use this for rubric detail, success criteria, or evidence rules.">
                <textarea value={homeworkForm.instructions} onChange={(e) => updateHomeworkForm('instructions', e.target.value)} rows={3} placeholder="Show working, upload a photo of the final page, and highlight question 7 if you got stuck." className={inputClass}></textarea>
              </LabeledField>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Specific students</div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {studentOptions.map((student) => {
                    const checked = (homeworkForm.studentIds || []).some((value) => Number(value) === student.id);
                    return (
                      <label key={`homework-student-${student.id}`} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => updateHomeworkForm('studentIds', checked ? homeworkForm.studentIds.filter((value) => Number(value) !== student.id) : [...(homeworkForm.studentIds || []), student.id])}
                        />
                        <span>{student.username}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Pick a class, specific students, or both. Students get homework points when they submit and staff can review them later.</div>
              </div>
            </div>
          ) : null}

          {!homeworkAssignments.length ? (
            <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No homework set yet.</div>
          ) : (
            <div className="space-y-4">
              {homeworkAssignments.map((assignment) => {
                const mySubmission = assignment.mySubmission || null;
                const targetRows = canUseSchoolOps
                  ? (assignment.submissions || [])
                  : (mySubmission ? [mySubmission] : [{
                      studentId: currentUserId,
                      student: profiles.find((profile) => Number(profile.student.id) === Number(currentUserId))?.student || null,
                      status: 'assigned',
                      awardedPoints: 0
                    }]);
                return (
                  <div key={`homework-${assignment.id}`} className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5 space-y-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-secondary-900 dark:text-white">{assignment.title}</div>
                        <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                          {assignment.homeworkType} | {assignment.complexity} | Due {new Date(assignment.dueDate).toLocaleDateString()} | {assignment.maxPoints} pts
                          {assignment.schoolClass?.name ? ` | ${assignment.schoolClass.name}` : ''}{assignment.subject?.name ? ` | ${assignment.subject.name}` : ''}
                        </div>
                        {assignment.description ? <div className="mt-3 text-sm text-secondary-700 dark:text-secondary-300">{assignment.description}</div> : null}
                        {assignment.instructions ? <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">{assignment.instructions}</div> : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-secondary-500 dark:text-secondary-400">
                        <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-3 py-2">{assignment.studentCount} assigned</div>
                        <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-3 py-2">{assignment.submissionCount} submissions</div>
                      </div>
                    </div>

                    {!targetRows.length ? (
                      <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No submission data yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {targetRows.map((submission) => {
                          const studentId = submission.studentId || currentUserId;
                          const submitForm = homeworkSubmissionForms[`${assignment.id}-${studentId}`] || emptyHomeworkSubmission();
                          const reviewForm = homeworkReviewForms[`${assignment.id}-${studentId}`] || { status: submission.status || 'reviewed', awardedPoints: submission.awardedPoints ?? assignment.maxPoints ?? 0, teacherFeedback: submission.teacherFeedback || '' };
                          return (
                            <div key={`submission-${assignment.id}-${studentId}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4 space-y-3">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-medium text-secondary-900 dark:text-white">{submission.student?.username || 'You'}</div>
                                  <div className="text-xs text-secondary-500 dark:text-secondary-400">Status {submission.status || 'assigned'} | Points {submission.awardedPoints ?? 0}</div>
                                </div>
                                {submission.submittedAt ? <div className="text-xs text-secondary-500 dark:text-secondary-400">Submitted {new Date(submission.submittedAt).toLocaleString()}</div> : null}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input type="date" value={submitForm.completedDate} onChange={(e) => updateHomeworkSubmissionForm(assignment.id, studentId, 'completedDate', e.target.value)} className={inputClass} />
                                <input value={submitForm.evidenceLink} onChange={(e) => updateHomeworkSubmissionForm(assignment.id, studentId, 'evidenceLink', e.target.value)} placeholder="Evidence link / file URL" className={inputClass} />
                              </div>
                              <textarea value={submitForm.responseText} onChange={(e) => updateHomeworkSubmissionForm(assignment.id, studentId, 'responseText', e.target.value)} rows={2} placeholder="What did you complete?" className={inputClass}></textarea>
                              <div className="flex justify-end">
                                <button type="button" onClick={() => submitHomework(assignment.id, studentId)} disabled={!!saving[`homework-submit-${assignment.id}-${studentId}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
                                  {saving[`homework-submit-${assignment.id}-${studentId}`] ? 'Submitting...' : 'Submit homework'}
                                </button>
                              </div>
                              {canUseSchoolOps ? (
                                <div className="rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 p-4 space-y-3">
                                  <div className="font-medium text-secondary-900 dark:text-white">Teacher review</div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <select value={reviewForm.status} onChange={(e) => updateHomeworkReviewForm(assignment.id, studentId, 'status', e.target.value)} className={inputClass}>
                                      {homeworkStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                    <input type="number" value={reviewForm.awardedPoints ?? 0} onChange={(e) => updateHomeworkReviewForm(assignment.id, studentId, 'awardedPoints', e.target.value)} className={inputClass} placeholder="Awarded points" />
                                    <button type="button" onClick={() => reviewHomework(assignment.id, studentId)} disabled={!!saving[`homework-review-${assignment.id}-${studentId}`]} className="px-4 py-2 rounded-lg bg-secondary-900 text-white hover:bg-secondary-700 dark:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-60">
                                      {saving[`homework-review-${assignment.id}-${studentId}`] ? 'Saving...' : 'Save review'}
                                    </button>
                                  </div>
                                  <textarea value={reviewForm.teacherFeedback} onChange={(e) => updateHomeworkReviewForm(assignment.id, studentId, 'teacherFeedback', e.target.value)} rows={2} placeholder="Teacher feedback" className={inputClass}></textarea>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {canUseSchoolOps && activeSection === 'school-reports' ? (
        <section id="school-reports" className="scroll-mt-24 bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-6 space-y-6">
          <div>
            <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">Reports and exports</h3>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">Download printable or spreadsheet-ready outputs for students, classes, interventions, homework, parents, audit history, subjects, and leadership review.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/interventions`} className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
              <div className="font-semibold">Intervention report</div>
              <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">CSV of intervention status, owner, due date, and next step.</div>
            </a>
            <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/homework`} className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
              <div className="font-semibold">Homework report</div>
              <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">CSV of homework submissions, status, points, and teacher feedback.</div>
            </a>
            <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/parents`} className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
              <div className="font-semibold">Parent summary</div>
              <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">CSV of parent/carer profiles plus the latest contact and acknowledgement state.</div>
            </a>
            <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/subjects`} className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
              <div className="font-semibold">Subject report</div>
              <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">CSV of subject performance, attendance, and behaviour pressure.</div>
            </a>
            <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/audit`} className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
              <div className="font-semibold">Audit report</div>
              <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">CSV of school changes with who changed what and when.</div>
            </a>
            <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/leadership`} className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
              <div className="font-semibold">Leadership summary</div>
              <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">CSV of headline school KPIs for leadership review.</div>
            </a>
            {(schoolStructure.classes || []).length ? (
              <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/class/${schoolStructure.classes[0].id}`} className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
                <div className="font-semibold">First class report</div>
                <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">CSV export for {schoolStructure.classes[0].name}.</div>
              </a>
            ) : (
              <div className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-gray-50 dark:bg-secondary-900/60 p-4 text-secondary-900 dark:text-white">
                <div className="font-semibold">Class report</div>
                <div className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">Create a class first to unlock class exports.</div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {!!leagueTable?.length && activeSection === 'school-league-table' ? (
        <section id="school-league-table" className="scroll-mt-24 rounded-[28px] border border-gray-200 bg-white p-6 shadow-card dark:border-secondary-700 dark:bg-secondary-800">
          <div className="overflow-hidden rounded-[24px] bg-gradient-to-r from-secondary-950 via-primary-950 to-cyan-950 px-6 py-6 text-white">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-200">Weekly league</div>
                <h3 className="mt-3 text-3xl font-semibold">Recognition for consistency, effort, and recovery</h3>
                <p className="mt-3 text-sm text-secondary-200">
                  Use the league to celebrate momentum publicly, then open the scorecards page to explain why someone rose or dipped. The goal is clear next action, not just ranking.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-primary-100">Students ranked</div>
                  <div className="mt-2 text-3xl font-bold">{leagueTable.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-primary-100">Average weekly score</div>
                  <div className="mt-2 text-3xl font-bold">{leagueAverageScore}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-primary-100">Best recovery</div>
                  <div className="mt-2 text-lg font-semibold">{mostImprovedLeagueHint?.username || 'No data'}</div>
                  <div className="mt-1 text-xs text-secondary-200">{mostImprovedLeagueHint ? `${mostImprovedLeagueHint.habitRecoveryPoints || 0} recovery pts` : 'No recovery data yet'}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1.85fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-secondary-700 dark:bg-secondary-900/50">
                <div className="text-sm font-semibold text-secondary-900 dark:text-white">Top three this week</div>
                <div className="mt-4 space-y-3">
                  {leagueLeaders.map((entry, index) => (
                    <div
                      key={`league-leader-${entry.studentId}`}
                      className={`rounded-2xl border px-4 py-4 ${
                        index === 0
                          ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/40 dark:bg-yellow-900/10'
                          : index === 1
                            ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
                            : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                            {index === 0 ? '1st place' : index === 1 ? '2nd place' : '3rd place'}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-secondary-900 dark:text-white">{entry.username}</div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leagueBadgeTones[entry.league?.toLowerCase()] || 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'}`}>
                          {entry.league}
                        </span>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div className="text-4xl font-bold text-secondary-900 dark:text-white">{entry.combinedWeeklyScore || 0}</div>
                        <div className="text-right text-xs text-secondary-500 dark:text-secondary-400">
                          <div>Behaviour {entry.behaviourScore || 0}</div>
                          <div>Card {entry.performanceCardPoints || 0}</div>
                          <div>Recovery {entry.habitRecoveryPoints || 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-secondary-700 dark:bg-secondary-900/40">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-secondary-700">
                <div>
                  <div className="text-sm font-semibold text-secondary-900 dark:text-white">Full standings</div>
                  <div className="text-xs text-secondary-500 dark:text-secondary-400">Weekly combined score with behaviour, performance card, and recovery breakdown.</div>
                </div>
                <div className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-semibold text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200">
                  Sorted highest to lowest
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {leagueTable.map((entry) => (
                  <div key={entry.studentId} className="grid grid-cols-[72px_minmax(0,1fr)_88px] items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 dark:border-secondary-700 dark:bg-secondary-800/60">
                    <div className="text-sm font-semibold text-secondary-900 dark:text-white">#{entry.position}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-secondary-900 dark:text-white">{entry.username}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${leagueBadgeTones[entry.league?.toLowerCase()] || 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'}`}>
                          {entry.league}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                        Behaviour {entry.behaviourScore || 0} | Card {entry.performanceCardPoints || 0} | Recovery {entry.habitRecoveryPoints || 0}
                      </div>
                    </div>
                    <div className="text-right text-2xl font-bold text-secondary-900 dark:text-white">{entry.combinedWeeklyScore || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeSection === 'student-profiles' && (
      <section id="student-profiles" className="scroll-mt-24 space-y-6">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">Student profiles</h3>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">Search students, then expand only the profile you need to work on.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setShowScoreGuide((value) => !value)}
              className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
            >
              {showScoreGuide ? 'Hide score guide' : 'How to use scores'}
            </button>
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student..."
              className={`${inputClass} sm:w-72`}
            />
            <select
              value={studentSort}
              onChange={(e) => setStudentSort(e.target.value)}
              className={`${inputClass} sm:w-44`}
            >
              <option value="pinned">Pinned + A-Z</option>
              <option value="risk">At risk first</option>
              <option value="score">Highest score</option>
              <option value="attendance">Attendance low</option>
              <option value="alphabetical">A-Z</option>
            </select>
            <button
              type="button"
              onClick={() => setExpandedStudents(Object.fromEntries(filteredProfiles.map((profile) => [profile.student.id, true])))}
              className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() => setExpandedStudents((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, false])))}
              className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-secondary-900/60 text-secondary-700 dark:text-secondary-300"
            >
              Collapse all
            </button>
            {(studentSearch || studentSort !== 'pinned' || studentQuickFilter !== 'all') ? (
              <button
                type="button"
                onClick={clearStudentFilters}
                className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
        {showScoreGuide ? (
          <div className="mt-4 rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 via-white to-cyan-50 p-5 dark:border-primary-900/40 dark:from-primary-900/15 dark:via-secondary-800 dark:to-cyan-900/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-600 dark:text-primary-300">Teacher guide</div>
                <h4 className="mt-2 text-lg font-semibold text-secondary-900 dark:text-white">How to work this page as a teacher</h4>
                <p className="mt-2 max-w-3xl text-sm text-secondary-600 dark:text-secondary-300">
                  This page should help you decide what to do next for a student, not just show numbers. Start with the live score, then use the breakdown to choose the right teacher action.
                </p>
              </div>
              <div className="rounded-xl bg-secondary-900 px-4 py-3 text-white dark:bg-secondary-950">
                <div className="text-[11px] uppercase tracking-[0.2em] text-primary-200">Fastest route</div>
                <div className="mt-2 text-sm font-medium">Today recovery, weekly score, homework, attendance, then intervention.</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-5">
              {scoreGuideSteps.map((step, index) => (
                <div key={`score-guide-step-${index + 1}`} className="rounded-xl border border-white/60 bg-white/80 p-4 dark:border-secondary-700 dark:bg-secondary-900/50">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">Step {index + 1}</div>
                  <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-200">{step}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {studentQuickFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStudentQuickFilter(filter.id)}
              className={`rounded-full px-3 py-2 text-sm font-medium ${
                studentQuickFilter === filter.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-secondary-700 hover:bg-primary-100 hover:text-primary-700 dark:bg-secondary-900/60 dark:text-secondary-300 dark:hover:bg-primary-900/20 dark:hover:text-primary-300'
              }`}
            >
              {filter.label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                studentQuickFilter === filter.id
                  ? 'bg-white/20 text-white'
                  : 'bg-white text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400'
              }`}>
                {studentQuickFilterCounts[filter.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>
      {!filteredProfiles.length ? (
        <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 p-8 text-center text-secondary-500 dark:text-secondary-400">
          No students match that search yet.
        </div>
      ) : filteredProfiles.map((profile) => {
        const scorecards = profile.scorecards || {};
        const recommendedAction = getRecommendedTeacherAction(profile);
        const impactForm = impactForms[profile.student.id] || {};
        const performanceForm = performanceForms[profile.student.id] || emptyPerformance();
        const interventionForm = interventionForms[profile.student.id] || emptyIntervention();
        const behaviourEventForm = behaviourEventForms[profile.student.id] || emptyBehaviourEvent();
        const parentContactForm = parentContactForms[profile.student.id] || emptyParentContact();
        const goalActivityForm = goalActivityForms[profile.student.id] || { activity: '', fallbackActivity: 'Reflection session' };
        const aiPlanDraft = aiPlanDrafts[profile.student.id] || null;
        const isOwn = profile.student.id === currentUserId;
        const evidenceBase = `${axios.defaults.baseURL}/groups/school-impact`;
        const lessonEntries = profile.lessonRegister?.entries || [];
        const isExpanded = !!expandedStudents[profile.student.id];

        return (
          <div key={profile.student.id} className="bg-white dark:bg-secondary-800 rounded-xl shadow-card border border-gray-200 dark:border-secondary-700 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-secondary-700 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white">{profile.student.username}</h3>
                  {isOwn ? <span className="rounded-full bg-primary-100 dark:bg-primary-900/30 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">You</span> : null}
                </div>
                <p className="text-sm text-secondary-500 dark:text-secondary-400">{isOwn ? 'Your school profile' : 'Student school profile'}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={`${axios.defaults.baseURL}/groups/${groupId}/reports/student/${profile.student.id}`} className="rounded-lg bg-primary-100 dark:bg-primary-900/30 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300">Weekly report</a>
                <div className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${trendStyles[profile.trend?.status] || trendStyles.inconsistent}`}>{profile.trend?.status || 'inconsistent'}</div>
                <button
                  type="button"
                  onClick={() => setExpandedStudents((prev) => ({ ...prev, [profile.student.id]: !prev[profile.student.id] }))}
                  className="rounded-lg bg-gray-100 dark:bg-secondary-900/60 px-3 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-300"
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>

            {isExpanded ? (
            <div className="p-6 space-y-6">
              <div className={`rounded-2xl border px-5 py-4 ${recommendedAction.tone}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">Recommended next action</div>
                    <div className="mt-2 text-lg font-semibold">{recommendedAction.title}</div>
                    <div className="mt-2 text-sm opacity-90">{recommendedAction.detail}</div>
                  </div>
                  <div className="rounded-full border border-current/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] opacity-80">
                    Teacher workflow
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-300">Weekly snapshot</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-2xl font-semibold text-secondary-900 dark:text-white">{profile.latestImpact?.truancyIncidents ?? 0}</div><div className="text-xs text-secondary-500 dark:text-secondary-400">Truancy</div></div>
                    <div><div className="text-2xl font-semibold text-green-600 dark:text-green-400">{profile.latestImpact?.positivePoints ?? 0}</div><div className="text-xs text-secondary-500 dark:text-secondary-400">Positive</div></div>
                    <div><div className="text-2xl font-semibold text-red-600 dark:text-red-400">{profile.latestImpact?.negativePoints ?? 0}</div><div className="text-xs text-secondary-500 dark:text-secondary-400">Negative</div></div>
                  </div>
                </div>
                <div className="rounded-xl bg-secondary-900 text-white p-4">
                  <div className="text-xs uppercase tracking-wide text-primary-200">Weekly points</div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-sm text-secondary-300">Behaviour</span><span className="text-xl font-semibold">{scorecards.latestBehaviourScore ?? 0}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm text-secondary-300">Habit recovery</span><span className="text-xl font-semibold text-green-300">{scorecards.habitRecovery?.recoveryPoints ?? 0}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm text-secondary-300">Performance card</span><span className="text-xl font-semibold text-cyan-300">{scorecards.performanceCard?.weeklyPoints ?? 0}</span></div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-3"><span className="text-sm text-secondary-300">Combined</span><span className="text-2xl font-bold">{scorecards.combinedWeeklyScore ?? 0}</span></div>
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-secondary-900 border border-gray-200 dark:border-secondary-700 p-4">
                  <div className="text-xs uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Today recovery</div>
                  <div className="mt-2 flex items-center justify-between gap-3"><div className="text-3xl font-bold text-secondary-900 dark:text-white">{scorecards.daily?.combinedPoints ?? 0}</div><span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${dailyTones[scorecards.daily?.status] || dailyTones['on-track']}`}>{scorecards.daily?.status || 'on-track'}</span></div>
                  <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">School source: {scorecards.daily?.schoolSource === 'lesson-register' ? 'Lesson register' : 'Performance card'}</div>
                  <div className="mt-3 space-y-2 text-sm text-secondary-600 dark:text-secondary-300">
                    <div className="flex justify-between"><span>School points</span><span>{scorecards.daily?.schoolPoints ?? 0}</span></div>
                    <div className="flex justify-between"><span>Habit recovery</span><span>{scorecards.daily?.habitRecoveryPoints ?? 0}</span></div>
                    <div className="flex justify-between"><span>Habits today</span><span>{scorecards.daily?.habitsCompleted ?? 0}/{scorecards.daily?.habitsScheduled ?? 0}</span></div>
                    <div className="flex justify-between"><span>Lessons logged</span><span>{scorecards.daily?.lessonRegisterLoggedLessons ?? 0}/{scorecards.daily?.lessonRegisterExpectedLessons ?? 0}</span></div>
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-secondary-900 border border-gray-200 dark:border-secondary-700 p-4">
                  <div className="text-xs uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Goal activity</div>
                  <div className="mt-2 text-xl font-semibold text-secondary-900 dark:text-white">{profile.goalActivity?.unlocked ? profile.goalActivity?.activity : profile.goalActivity?.fallbackActivity}</div>
                  <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">{profile.goalActivity?.reason}</p>
                  {!!profile.goalActivity?.lockReasons && !profile.goalActivity?.unlocked ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.goalActivity.lockReasons.activeIntervention ? <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-1 text-[11px] font-medium text-red-700 dark:text-red-300">Active intervention</span> : null}
                      {profile.goalActivity.lockReasons.attendance ? <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">Attendance threshold</span> : null}
                      {profile.goalActivity.lockReasons.behaviour ? <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300">Repeated behaviour flags</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-secondary-900 border border-gray-200 dark:border-secondary-700 p-4">
                <div className="mb-3"><h4 className="font-semibold text-secondary-900 dark:text-white">Behaviour trend</h4></div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(profile.trend?.points || []).slice(-6)}>
                      <XAxis dataKey="weekEnding" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                      <YAxis />
                      <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                      <Line type="monotone" dataKey="positivePoints" stroke="#22c55e" strokeWidth={2} />
                      <Line type="monotone" dataKey="negativePoints" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="truancyIncidents" stroke="#f59e0b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Goal plan</h4>
                    {canManage ? <button type="button" onClick={() => addGoal(profile.student.id)} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add row</button> : null}
                  </div>
                  {canManage ? (
                    <div className="mb-4 rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 via-white to-cyan-50 p-4 dark:border-primary-900/40 dark:from-primary-900/15 dark:via-secondary-900 dark:to-cyan-900/10">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-600 dark:text-primary-300">AI planning</div>
                          <div className="mt-2 text-sm text-secondary-600 dark:text-secondary-300">
                            Paste a teacher note, pastoral summary, or parent update and AI will draft goals, linked habits, and a goal activity.
                          </div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-500 shadow-sm dark:bg-secondary-800 dark:text-secondary-300">
                          Replaces current plan on apply
                        </div>
                      </div>
                      <textarea
                        value={aiPlanInputs[profile.student.id] || ''}
                        onChange={(e) => setAiPlanInputs((prev) => ({ ...prev, [profile.student.id]: e.target.value }))}
                        rows={4}
                        placeholder="Example: Sam is capable but loses focus after lunch, misses science homework, and responds well to short routines with visible praise..."
                        className="mt-4 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm text-secondary-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-secondary-700 dark:bg-secondary-950 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
                      />
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => runAiGoalPlan(profile.student.id, false)}
                          disabled={!!saving[`ai-plan-${profile.student.id}`]}
                          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-secondary-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 dark:bg-secondary-800 dark:text-secondary-100 dark:hover:bg-secondary-700"
                        >
                          {saving[`ai-plan-${profile.student.id}`] ? 'Thinking...' : 'Generate AI draft'}
                        </button>
                        <button
                          type="button"
                          onClick={() => runAiGoalPlan(profile.student.id, true)}
                          disabled={!!saving[`ai-plan-${profile.student.id}`]}
                          className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                        >
                          Apply AI plan
                        </button>
                      </div>
                      {aiPlanDraft ? (
                        <div className="mt-4 rounded-2xl bg-white/90 p-4 shadow-sm dark:bg-secondary-900/80">
                          <div className="text-sm font-semibold text-secondary-900 dark:text-white">Latest AI draft</div>
                          {aiPlanDraft.summary ? <div className="mt-2 text-sm text-secondary-600 dark:text-secondary-300">{aiPlanDraft.summary}</div> : null}
                          {(aiPlanDraft.habits || []).length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {aiPlanDraft.habits.map((habit) => (
                                <span key={`${profile.student.id}-ai-habit-${habit.name}`} className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                                  {habit.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {(aiPlanDraft.notes || []).length ? (
                            <div className="mt-3 space-y-2">
                              {aiPlanDraft.notes.map((note, noteIndex) => (
                                <div key={`${profile.student.id}-ai-note-${noteIndex}`} className="text-xs text-secondary-500 dark:text-secondary-400">
                                  {note}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {(aiPlanDraft.warnings || []).length ? (
                            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                              {(aiPlanDraft.warnings || []).join(' ')}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {(goalForms[profile.student.id] || [emptyGoal()]).map((goal, index) => (
                      <div key={`${profile.student.id}-goal-${index}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input value={goal.title} disabled={!canManage} onChange={(e) => updateGoal(profile.student.id, index, 'title', e.target.value)} placeholder="Goal" className={inputClass} />
                          <input value={goal.barrier} disabled={!canManage} onChange={(e) => updateGoal(profile.student.id, index, 'barrier', e.target.value)} placeholder="Barrier" className={inputClass} />
                          <input value={goal.schoolGoal} disabled={!canManage} onChange={(e) => updateGoal(profile.student.id, index, 'schoolGoal', e.target.value)} placeholder="School goal" className={inputClass} />
                          <input value={goal.forSelf} disabled={!canManage} onChange={(e) => updateGoal(profile.student.id, index, 'forSelf', e.target.value)} placeholder="For self" className={inputClass} />
                        </div>
                        <input value={goal.forOthers} disabled={!canManage} onChange={(e) => updateGoal(profile.student.id, index, 'forOthers', e.target.value)} placeholder="For others" className={inputClass} />
                        {canManage ? <div className="flex justify-end"><button type="button" onClick={() => removeGoal(profile.student.id, index)} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove row</button></div> : null}
                      </div>
                    ))}
                  </div>
                  {canManage ? <div className="mt-4 flex justify-end"><button type="button" onClick={() => saveGoals(profile.student.id)} disabled={!!saving[`goals-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`goals-${profile.student.id}`] ? 'Saving...' : 'Save goal plan'}</button></div> : null}
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Habits linked to goals</h4>
                  <div className="space-y-3">
                    {!profile.linkedHabits.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No habits are linked yet.</div> : profile.linkedHabits.map((habit) => {
                      const linkedGoal = profile.goals.find((goal) => String(goal.id) === String(habit.linkedGoalId));
                      return <div key={`${profile.student.id}-${habit.index}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4"><div className="font-medium text-secondary-900 dark:text-white">{habit.name}</div>{habit.description ? <div className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{habit.description}</div> : null}<div className="mt-2 text-xs text-secondary-600 dark:text-secondary-300"><span className="font-semibold">Why:</span> <span className="text-primary-700 dark:text-primary-300">{linkedGoal?.title || 'No linked goal selected yet'}</span></div></div>;
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <DailyHabitPlanner groupId={groupId} profile={profile} canEdit={isOwn} schoolTimetable={group?.schoolTimetable || []} />
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Coach notes and evidence</h4>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {!profile.impactRecords.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No behaviour records uploaded yet.</div> : profile.impactRecords.map((record) => (
                      <div key={record.id} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-secondary-900 dark:text-white">Week ending {new Date(record.weekEnding).toLocaleDateString()}</div>
                          {record.evidenceFileName ? <div className="flex items-center gap-2"><a href={`${evidenceBase}/${record.id}/evidence`} target="_blank" rel="noreferrer" className="rounded-lg bg-primary-100 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">Preview</a><a href={`${evidenceBase}/${record.id}/evidence?download=1`} className="rounded-lg bg-gray-200 dark:bg-secondary-700 px-3 py-1 text-xs font-medium text-secondary-700 dark:text-secondary-200">Download</a></div> : null}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-secondary-500 dark:text-secondary-400"><div>Truancy: {record.truancyIncidents}</div><div>Positive: {record.positivePoints}</div><div>Negative: {record.negativePoints}</div></div>
                        {record.coachNotes ? <div className="mt-3 text-sm text-secondary-700 dark:text-secondary-300">{record.coachNotes}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Upload school impact data</h4>
                  {canManage ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="date" value={impactForm.weekEnding || ''} onChange={(e) => updateImpact(profile.student.id, 'weekEnding', e.target.value)} className={inputClass} />
                        <input type="file" accept=".pdf" onChange={(e) => updateImpact(profile.student.id, 'evidence', e.target.files?.[0] || null)} className={inputClass} />
                        <input type="number" min="0" value={impactForm.truancyIncidents ?? 0} onChange={(e) => updateImpact(profile.student.id, 'truancyIncidents', e.target.value)} placeholder="Truancy incidents" className={inputClass} />
                        <input type="number" min="0" value={impactForm.positivePoints ?? 0} onChange={(e) => updateImpact(profile.student.id, 'positivePoints', e.target.value)} placeholder="Positive points" className={inputClass} />
                        <input type="number" min="0" value={impactForm.negativePoints ?? 0} onChange={(e) => updateImpact(profile.student.id, 'negativePoints', e.target.value)} placeholder="Negative points" className={`${inputClass} md:col-span-2`} />
                      </div>
                      <textarea value={impactForm.coachNotes || ''} onChange={(e) => updateImpact(profile.student.id, 'coachNotes', e.target.value)} rows={4} placeholder="Context, concerns, intervention..." className={inputClass}></textarea>
                      <div className="flex justify-end"><button type="button" onClick={() => saveImpact(profile.student.id)} disabled={!!saving[`impact-${profile.student.id}`] || !impactForm.weekEnding} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`impact-${profile.student.id}`] ? 'Uploading...' : 'Save school impact'}</button></div>
                    </div>
                  ) : <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">School impact uploads are managed by leaders and assigned coaches.</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Lesson register</h4>
                  {!lessonEntries.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No lessons are scheduled today.</div> : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-3 py-2 text-sm text-secondary-600 dark:text-secondary-300">{profile.lessonRegister.weekday} | {profile.lessonRegister.loggedLessons}/{profile.lessonRegister.expectedLessons} lessons logged | {profile.lessonRegister.points} points</div>
                      {lessonEntries.map((entry) => {
                        const formEntry = (lessonForms[profile.student.id]?.entries || []).find((item) => item.timetableSlotId === entry.id) || { timetableSlotId: entry.id, attendanceStatus: entry.attendanceStatus || 'present', latenessMinutes: entry.latenessMinutes || 0, attended: !!entry.attended, engagement: entry.engagement || 'green', refocus: !!entry.refocus, teacherComment: entry.teacherComment || '' };
                        return (
                          <div key={`${profile.student.id}-${entry.id}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div>
                                <div className="font-medium text-secondary-900 dark:text-white">{entry.startTime} - {entry.endTime} | {entry.subject}</div>
                                <div className="text-xs text-secondary-500 dark:text-secondary-400">{entry.className || 'Class not set'}{entry.room ? ` | ${entry.room}` : ''}{entry.teacherName ? ` | ${entry.teacherName}` : ''}</div>
                              </div>
                              <div className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">{entry.logged ? `${entry.points} pts` : 'Not logged'}</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                              <select value={formEntry.attendanceStatus || 'present'} disabled={!canManage} onChange={(e) => updateLesson(profile.student.id, entry.id, 'attendanceStatus', e.target.value)} className={inputClass}>
                                {attendanceStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                              <input type="number" min="0" value={formEntry.latenessMinutes || 0} disabled={!canManage} onChange={(e) => updateLesson(profile.student.id, entry.id, 'latenessMinutes', e.target.value)} className={inputClass} placeholder="Late mins" />
                              <select value={formEntry.engagement} disabled={!canManage} onChange={(e) => updateLesson(profile.student.id, entry.id, 'engagement', e.target.value)} className={inputClass}><option value="green">Green (+4)</option><option value="amber">Amber (+1)</option><option value="red">Red (-3)</option></select>
                              <label className="flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-300"><input type="checkbox" disabled={!canManage} checked={!!formEntry.refocus} onChange={(e) => updateLesson(profile.student.id, entry.id, 'refocus', e.target.checked)} />Refocus</label>
                              <div className="rounded-lg bg-white dark:bg-secondary-800 px-3 py-2 text-sm text-secondary-600 dark:text-secondary-300">Current: {entry.points} pts</div>
                            </div>
                            <textarea value={formEntry.teacherComment || ''} disabled={!canManage} onChange={(e) => updateLesson(profile.student.id, entry.id, 'teacherComment', e.target.value)} rows={2} placeholder="Teacher note" className={`${inputClass} mt-3`}></textarea>
                          </div>
                        );
                      })}
                      {canManage ? <div className="flex justify-end"><button type="button" onClick={() => saveLessonRegister(profile.student.id)} disabled={!!saving[`lessons-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`lessons-${profile.student.id}`] ? 'Saving...' : 'Save lesson register'}</button></div> : null}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">IP performance card</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input type="date" value={performanceForm.cardDate} onChange={(e) => setPerformanceForms((prev) => ({ ...prev, [profile.student.id]: { ...(prev[profile.student.id] || emptyPerformance()), cardDate: e.target.value } }))} className={`${inputClass} md:col-span-2`} />
                    <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-3 py-2 text-sm text-secondary-600 dark:text-secondary-300 md:col-span-2">Max +12 | Min -15</div>
                  </div>
                  <div className="space-y-3">
                    {performanceForm.checkpoints.map((checkpoint, checkpointIndex) => (
                      <div key={`${profile.student.id}-${checkpoint.slot}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                        <div className="font-medium text-secondary-900 dark:text-white mb-3">{checkpointLabels[checkpoint.slot] || checkpoint.slot}</div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <label className="flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-300"><input type="checkbox" checked={!!checkpoint.attended} onChange={(e) => updatePerformance(profile.student.id, checkpointIndex, 'attended', e.target.checked)} />Attended lesson</label>
                          <select value={checkpoint.engagement} onChange={(e) => updatePerformance(profile.student.id, checkpointIndex, 'engagement', e.target.value)} className={inputClass}><option value="green">Green (+4)</option><option value="amber">Amber (+1)</option><option value="red">Red (-3)</option></select>
                          <label className="flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-300"><input type="checkbox" checked={!!checkpoint.refocus} onChange={(e) => updatePerformance(profile.student.id, checkpointIndex, 'refocus', e.target.checked)} />Refocus / C5</label>
                          <input value={checkpoint.teacherSignature || ''} onChange={(e) => updatePerformance(profile.student.id, checkpointIndex, 'teacherSignature', e.target.value)} placeholder="Teacher signature" className={inputClass} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {canManage ? <div className="mt-4 flex justify-end"><button type="button" onClick={() => savePerformance(profile.student.id)} disabled={!!saving[`performance-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`performance-${profile.student.id}`] ? 'Saving...' : 'Save performance card'}</button></div> : <div className="mt-4 text-sm text-secondary-500 dark:text-secondary-400">Coaches and leaders complete the performance card during the school week.</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Goal activity unlock</h4>
                  {canManage ? <div className="space-y-4"><input value={goalActivityForm.activity} onChange={(e) => setGoalActivityForms((prev) => ({ ...prev, [profile.student.id]: { ...goalActivityForm, activity: e.target.value } }))} placeholder="Reward activity" className={inputClass} /><input value={goalActivityForm.fallbackActivity} onChange={(e) => setGoalActivityForms((prev) => ({ ...prev, [profile.student.id]: { ...goalActivityForm, fallbackActivity: e.target.value } }))} placeholder="Fallback session" className={inputClass} /><div className="flex justify-end"><button type="button" onClick={() => saveGoalActivity(profile.student.id)} disabled={!!saving[`activity-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`activity-${profile.student.id}`] ? 'Saving...' : 'Save goal activity'}</button></div></div> : <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">Your coach sets the activity you unlock when your school week is successful.</div>}
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Homework recovery</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Weekly homework points</div>
                      <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{profile.homework?.weeklyPoints ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Due today</div>
                      <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{profile.homework?.dueTodayCount ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Missing</div>
                      <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{profile.homework?.missingCount ?? 0}</div>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {!(profile.homework?.assignments || []).length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No homework assigned yet.</div> : profile.homework.assignments.slice(0, 6).map((assignment) => (
                      <div key={`profile-homework-${profile.student.id}-${assignment.id}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-secondary-900 dark:text-white">{assignment.title}</div>
                          <div className="text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 px-2 py-1 text-primary-700 dark:text-primary-300">{assignment.pointsImpact ?? 0} pts</div>
                        </div>
                        <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Due {new Date(assignment.dueDate).toLocaleDateString()} | {assignment.homeworkType} | {assignment.complexity}</div>
                        <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-300">{assignment.submission?.status || 'assigned'}</div>
                        {assignment.submission?.teacherFeedback ? <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Feedback: {assignment.submission.teacherFeedback}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Interventions</h4>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {!profile.interventions?.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No interventions logged yet.</div> : profile.interventions.map((record) => <div key={record.id} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4"><div className="flex items-center justify-between gap-3"><div className="font-medium text-secondary-900 dark:text-white">{record.interventionType}</div><div className="text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 px-2 py-1 text-primary-700 dark:text-primary-300">{record.status}</div></div><div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{new Date(record.interventionDate).toLocaleDateString()} | {record.staff?.username || 'Staff'}</div>{record.owner?.username ? <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">Owner: {record.owner.username}{record.dueDate ? ` | Due ${new Date(record.dueDate).toLocaleDateString()}` : ''}</div> : null}{record.summary ? <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-300">{record.summary}</div> : null}{record.nextStep ? <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Next: {record.nextStep}</div> : null}</div>)}
                  </div>
                  {canManage ? <div className="mt-4 space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"><select value={interventionForm.interventionType} onChange={(e) => updateIntervention(profile.student.id, 'interventionType', e.target.value)} className={inputClass}>{interventionTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select value={interventionForm.status} onChange={(e) => updateIntervention(profile.student.id, 'status', e.target.value)} className={inputClass}>{interventionStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input type="date" value={interventionForm.interventionDate} onChange={(e) => updateIntervention(profile.student.id, 'interventionDate', e.target.value)} className={inputClass} /><input type="date" value={interventionForm.dueDate || ''} onChange={(e) => updateIntervention(profile.student.id, 'dueDate', e.target.value)} className={inputClass} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><select value={interventionForm.ownerId || ''} onChange={(e) => updateIntervention(profile.student.id, 'ownerId', e.target.value)} className={inputClass}><option value="">Assign owner</option>{teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.username}</option>)}</select><input value={interventionForm.nextStep} onChange={(e) => updateIntervention(profile.student.id, 'nextStep', e.target.value)} placeholder="Next step" className={inputClass} /></div><textarea value={interventionForm.summary} onChange={(e) => updateIntervention(profile.student.id, 'summary', e.target.value)} rows={3} placeholder="What happened / why this was needed?" className={inputClass}></textarea><div className="flex justify-end"><button type="button" onClick={() => saveIntervention(profile.student.id)} disabled={!!saving[`intervention-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`intervention-${profile.student.id}`] ? 'Saving...' : 'Log intervention'}</button></div></div> : null}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Behaviour history</h4>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {!profile.behaviourEvents?.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No behaviour events logged yet.</div> : profile.behaviourEvents.map((event) => (
                      <div key={event.id} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-secondary-900 dark:text-white">{event.title}</div>
                          <div className="text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 px-2 py-1 text-primary-700 dark:text-primary-300">{event.kind} | {event.severity}</div>
                        </div>
                        <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{new Date(event.eventDate).toLocaleDateString()} | {event.subject || 'General'}{event.className ? ` | ${event.className}` : ''}{event.staff?.username ? ` | ${event.staff.username}` : ''}</div>
                        <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-300">{event.pointsDelta} points</div>
                        {event.notes ? <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-300">{event.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Log behaviour event</h4>
                  {canManage ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <select value={behaviourEventForm.behaviourTypeId || ''} onChange={(e) => {
                          const selected = (schoolStructure.behaviourTypes || []).find((item) => String(item.id) === String(e.target.value));
                          updateBehaviourEvent(profile.student.id, 'behaviourTypeId', e.target.value);
                          updateBehaviourEvent(profile.student.id, 'title', selected?.name || '');
                          updateBehaviourEvent(profile.student.id, 'kind', selected?.kind || 'reward');
                          updateBehaviourEvent(profile.student.id, 'severity', selected?.severity || 'low');
                          updateBehaviourEvent(profile.student.id, 'pointsDelta', selected?.defaultPoints ?? 0);
                        }} className={inputClass}>
                          <option value="">Catalogue type</option>
                          {(schoolStructure.behaviourTypes || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <input type="date" value={behaviourEventForm.eventDate} onChange={(e) => updateBehaviourEvent(profile.student.id, 'eventDate', e.target.value)} className={inputClass} />
                        <select value={behaviourEventForm.kind} onChange={(e) => updateBehaviourEvent(profile.student.id, 'kind', e.target.value)} className={inputClass}>
                          {behaviourKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <select value={behaviourEventForm.severity} onChange={(e) => updateBehaviourEvent(profile.student.id, 'severity', e.target.value)} className={inputClass}>
                          {behaviourSeverityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input value={behaviourEventForm.title} onChange={(e) => updateBehaviourEvent(profile.student.id, 'title', e.target.value)} placeholder="Title" className={inputClass} />
                        <input value={behaviourEventForm.subject} onChange={(e) => updateBehaviourEvent(profile.student.id, 'subject', e.target.value)} placeholder="Subject" className={inputClass} />
                        <input value={behaviourEventForm.className} onChange={(e) => updateBehaviourEvent(profile.student.id, 'className', e.target.value)} placeholder="Class name" className={inputClass} />
                      </div>
                      <input type="number" value={behaviourEventForm.pointsDelta ?? 0} onChange={(e) => updateBehaviourEvent(profile.student.id, 'pointsDelta', e.target.value)} placeholder="Points delta" className={inputClass} />
                      <textarea value={behaviourEventForm.notes} onChange={(e) => updateBehaviourEvent(profile.student.id, 'notes', e.target.value)} rows={3} placeholder="Behaviour note / referral detail" className={inputClass}></textarea>
                      <div className="flex justify-end"><button type="button" onClick={() => saveBehaviourEvent(profile.student.id)} disabled={!!saving[`behaviour-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`behaviour-${profile.student.id}`] ? 'Saving...' : 'Log behaviour event'}</button></div>
                    </div>
                  ) : <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">Behaviour events are managed by school staff.</div>}
                </div>
              </div>

              {!!profile.behaviourSummary?.subjects?.length ? (
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Behaviour by subject</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {profile.behaviourSummary.subjects.slice(0, 6).map((item) => (
                      <div key={`behaviour-subject-${profile.student.id}-${item.subject}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                        <div className="font-medium text-secondary-900 dark:text-white">{item.subject}</div>
                        <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">Rewards {item.reward} | Sanctions {item.sanction} | Referrals {item.referral} | On-call {item.onCall} | Removal {item.removal}</div>
                        <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-300">{item.pointsDelta} points net</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">Parent / carer profiles</h4>
                    {canManage ? <button type="button" onClick={() => addParentProfile(profile.student.id)} className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">Add contact</button> : null}
                  </div>
                  <div className="space-y-3">
                    {(parentProfileForms[profile.student.id] || [emptyParentProfile()]).map((parentProfile, index) => (
                      <div key={`parent-profile-${profile.student.id}-${index}`} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input value={parentProfile.name} onChange={(e) => updateParentProfile(profile.student.id, index, 'name', e.target.value)} placeholder="Parent / carer name" className={inputClass} />
                          <input value={parentProfile.relationship} onChange={(e) => updateParentProfile(profile.student.id, index, 'relationship', e.target.value)} placeholder="Relationship" className={inputClass} />
                          <input value={parentProfile.phone} onChange={(e) => updateParentProfile(profile.student.id, index, 'phone', e.target.value)} placeholder="Phone" className={inputClass} />
                          <input value={parentProfile.email} onChange={(e) => updateParentProfile(profile.student.id, index, 'email', e.target.value)} placeholder="Email" className={inputClass} />
                          <select value={parentProfile.preferredContact} onChange={(e) => updateParentProfile(profile.student.id, index, 'preferredContact', e.target.value)} className={inputClass}>
                            {parentContactTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-secondary-700 px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300"><input type="checkbox" checked={!!parentProfile.receivesUpdates} onChange={(e) => updateParentProfile(profile.student.id, index, 'receivesUpdates', e.target.checked)} />Receives updates</label>
                        </div>
                        <textarea value={parentProfile.notes} onChange={(e) => updateParentProfile(profile.student.id, index, 'notes', e.target.value)} rows={2} placeholder="Parent notes" className={inputClass}></textarea>
                        {canManage ? <div className="flex justify-end"><button type="button" onClick={() => removeParentProfile(profile.student.id, index)} className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Remove</button></div> : null}
                      </div>
                    ))}
                  </div>
                  {canManage ? <div className="mt-4 flex justify-end"><button type="button" onClick={() => saveParentProfiles(profile.student.id)} disabled={!!saving[`parent-profiles-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`parent-profiles-${profile.student.id}`] ? 'Saving...' : 'Save parent profiles'}</button></div> : null}
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
                  <h4 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Parent contact log</h4>
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {!profile.parentContacts?.length ? <div className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 p-4 text-sm text-secondary-500 dark:text-secondary-400">No parent contact logged yet.</div> : profile.parentContacts.map((record) => (
                      <div key={record.id} className="rounded-lg bg-gray-50 dark:bg-secondary-900/60 border border-gray-200 dark:border-secondary-700 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-secondary-900 dark:text-white">{record.contactType}</div>
                          <div className="text-xs text-secondary-500 dark:text-secondary-400">{new Date(record.contactDate).toLocaleDateString()}</div>
                        </div>
                        {record.outcome ? <div className="mt-2 text-sm text-secondary-700 dark:text-secondary-300">{record.outcome}</div> : null}
                        {record.notes ? <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{record.notes}</div> : null}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                          <textarea value={parentAcknowledgementNotes[record.id] || ''} onChange={(e) => setParentAcknowledgementNotes((prev) => ({ ...prev, [record.id]: e.target.value }))} rows={2} placeholder="Acknowledgement note" className={inputClass}></textarea>
                          <button type="button" onClick={() => acknowledgeParentContact(profile.student.id, record.id, !record.acknowledged)} disabled={!!saving[`parent-ack-${record.id}`]} className={`px-4 py-2 rounded-lg text-white disabled:opacity-60 ${record.acknowledged ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
                            {saving[`parent-ack-${record.id}`] ? 'Saving...' : record.acknowledged ? 'Remove acknowledgement' : 'Mark acknowledged'}
                          </button>
                        </div>
                        {record.acknowledged ? <div className="mt-2 text-xs text-green-600 dark:text-green-300">Acknowledged{record.acknowledgedAt ? ` on ${new Date(record.acknowledgedAt).toLocaleString()}` : ''}</div> : null}
                      </div>
                    ))}
                  </div>
                  {canManage ? <div className="mt-4 space-y-3"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><input type="date" value={parentContactForm.contactDate} onChange={(e) => updateParentContact(profile.student.id, 'contactDate', e.target.value)} className={inputClass} /><select value={parentContactForm.contactType} onChange={(e) => updateParentContact(profile.student.id, 'contactType', e.target.value)} className={inputClass}>{parentContactTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input value={parentContactForm.outcome} onChange={(e) => updateParentContact(profile.student.id, 'outcome', e.target.value)} placeholder="Outcome" className={inputClass} /></div><textarea value={parentContactForm.notes} onChange={(e) => updateParentContact(profile.student.id, 'notes', e.target.value)} rows={3} placeholder="Parent contact notes" className={inputClass}></textarea><div className="flex justify-end"><button type="button" onClick={() => saveParentContact(profile.student.id)} disabled={!!saving[`parent-contact-${profile.student.id}`]} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">{saving[`parent-contact-${profile.student.id}`] ? 'Saving...' : 'Log parent contact'}</button></div></div> : null}
                </div>
              </div>
            </div>
            ) : (
            <div className="px-6 py-5 bg-gray-50 dark:bg-secondary-900/40">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Weekly score</div>
                  <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{scorecards.combinedWeeklyScore ?? 0}</div>
                  <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">Behaviour {scorecards.latestBehaviourScore ?? 0} | Live {scorecards.liveBehaviourPoints ?? 0} | Homework {profile.homework?.weeklyPoints ?? 0}</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Today</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-2xl font-bold text-secondary-900 dark:text-white">{scorecards.daily?.combinedPoints ?? 0}</div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${dailyTones[scorecards.daily?.status] || dailyTones['on-track']}`}>{scorecards.daily?.status || 'on-track'}</span>
                  </div>
                  <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{scorecards.daily?.habitsCompleted ?? 0}/{scorecards.daily?.habitsScheduled ?? 0} habits | Homework {scorecards.daily?.homeworkPoints ?? 0} | Behaviour {scorecards.daily?.behaviourPoints ?? 0}</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Attendance</div>
                  <div className="mt-2 text-2xl font-bold text-secondary-900 dark:text-white">{profile.attendanceSummary?.attendanceRate ?? 0}%</div>
                  <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{profile.attendanceSummary?.todayStatus || 'No lessons logged'}</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Goal status</div>
                  <div className="mt-2 text-sm font-semibold text-secondary-900 dark:text-white">{profile.goalActivity?.statusLabel || 'Unknown'}</div>
                  <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 truncate">{profile.goalActivity?.unlocked ? profile.goalActivity?.activity : profile.goalActivity?.fallbackActivity}</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">Focus</div>
                  <div className="mt-2 text-sm font-semibold text-secondary-900 dark:text-white">{profile.goals?.[0]?.title || 'No goal set yet'}</div>
                  <div className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">Homework due {profile.homework?.dueTodayCount ?? 0} | Missing {profile.homework?.missingCount ?? 0}</div>
                </div>
              </div>
            </div>
            )}
          </div>
        );
      })}
      </section>
      )}
        </div>
        <aside className="hidden xl:block xl:sticky xl:top-36">
          <div className="rounded-xl border border-gray-200 dark:border-secondary-700 bg-white/95 dark:bg-secondary-800/95 shadow-card backdrop-blur p-4 max-h-[calc(100vh-10rem)] overflow-y-auto">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">School nav</div>
            <div className="mt-4 space-y-2">
              {sectionLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setActiveSection(link.id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    activeSection === link.id
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'text-secondary-600 hover:bg-primary-50 hover:text-primary-700 dark:text-secondary-300 dark:hover:bg-primary-900/20 dark:hover:text-primary-300'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
