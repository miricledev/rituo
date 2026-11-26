export const IPKP_TRANSITION_EVENT = 'ipkp:transition';

const tabLabels = {
  overview: 'Dashboard',
  dashboard: 'Dashboard',
  school: 'School Workspace',
  admin: 'School Administration',
  chat: 'Community',
  dms: 'Messages',
  dm: 'Messages',
  leaderboard: 'Leaderboard',
  colorChart: 'Colour Chart',
  calendar: 'Schedule',
  rewards: 'IP Shop',
  tools: 'IP Performance Tools',
  testing: 'Admin Feature Lab',
  attendance: 'Attendance',
  archives: 'Archives',
  presets: 'Habit Protocols',
  course: 'Learning',
  habits: 'Habits',
  stats: 'Performance Data'
};

const sectionLabels = {
  'school-classes': 'Classes',
  'school-timetable': 'Timetable',
  'teacher-register': 'Teacher Register',
  'school-homework': 'School Workspace',
  'school-operations': 'School Operations',
  'school-reports': 'Reports',
  'student-profiles': 'Student Progress',
  'school-structure': 'School Structure'
};

export function getProtocolNameForPath(pathname = '') {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/groups') return 'Schools';
  if (pathname === '/legacy') return 'Legacy Schools';
  if (pathname === '/teacher-desk') return 'Teacher Desk';
  if (pathname === '/feature-lab') return 'Admin Feature Lab';
  if (pathname === '/settings') return 'Settings';
  if (pathname === '/archives') return 'Archives';
  if (pathname === '/pomodoro') return 'Focus Protocol';
  if (/^\/groups\/[^/]+\/member\//.test(pathname)) return 'Student Performance';
  if (/^\/groups\/[^/]+/.test(pathname)) return 'School Workspace';
  if (/^\/task\//.test(pathname)) return 'Performance Data';
  return 'Secure Workspace';
}

export function getProtocolNameForTab(tab, section = '') {
  return sectionLabels[section] || tabLabels[tab] || 'Workspace';
}

export function triggerProtocolTransition(protocolName, duration = 1250) {
  window.dispatchEvent(new CustomEvent(IPKP_TRANSITION_EVENT, {
    detail: {
      protocolName: protocolName || 'Workspace',
      duration
    }
  }));
}
