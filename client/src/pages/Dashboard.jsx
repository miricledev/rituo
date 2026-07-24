import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  FaArrowRight,
  FaBrain,
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaEdit,
  FaGraduationCap,
  FaLock,
  FaPlus,
  FaSchool,
  FaShieldAlt,
  FaMagic,
  FaUserGraduate,
  FaUsers
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import AdminAccountEditor from '../components/AdminAccountEditor';
import AdminSchoolStudentDirectory from '../components/AdminSchoolStudentDirectory';
import AdminStudentImport from '../components/AdminStudentImport';
import InlineToast from '../components/InlineToast';

const roleMeta = {
  admin: {
    label: 'Administrator',
    eyebrow: 'System command',
    title: 'Lead every moving part.',
    description: 'Create schools, provision staff and students, and keep performance systems aligned.',
    icon: FaShieldAlt,
    gradient: 'from-violet-500 via-indigo-500 to-cyan-400'
  },
  teacher: {
    label: 'Teacher',
    eyebrow: 'Teaching flow',
    title: 'Know who needs you next.',
    description: 'Move from timetable to register, behaviour, homework and intervention without losing context.',
    icon: FaChalkboardTeacher,
    gradient: 'from-cyan-400 via-blue-500 to-indigo-500'
  },
  student: {
    label: 'Student',
    eyebrow: 'Personal performance',
    title: 'Turn goals into a day you can follow.',
    description: 'See your habits, school commitments and AI-built plan in one calm workspace.',
    icon: FaUserGraduate,
    gradient: 'from-emerald-400 via-cyan-400 to-blue-500'
  }
};

const emptyAccountForm = {
  username: '',
  email: '',
  password: '',
  accountRole: 'teacher',
  groupId: '',
  firstName: '',
  lastName: '',
  yearGroup: '',
  tutorGroup: ''
};

const Dashboard = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.accountRole || 'student';
  const meta = roleMeta[role] || roleMeta.student;
  const RoleIcon = meta.icon;
  const [groups, setGroups] = useState({ memberOf: [], leading: [], legacy: { memberOf: [], leading: [] } });
  const [accounts, setAccounts] = useState([]);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [editingAccount, setEditingAccount] = useState(null);
  const [directoryRefreshKey, setDirectoryRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);

  const schools = useMemo(() => {
    const byId = new Map();
    [...groups.leading, ...groups.memberOf].forEach((group) => byId.set(group.id, group));
    const availableSchools = [...byId.values()];
    return role === 'student' ? availableSchools.slice(0, 1) : availableSchools;
  }, [groups, role]);
  const legacyCount = (groups.legacy?.leading?.length || 0) + (groups.legacy?.memberOf?.length || 0);

  const loadDashboard = async () => {
    try {
      const groupResponse = await axios.get('/groups/my-groups');
      const currentLeading = (groupResponse.data.leading || []).filter((group) => group.isLegacy === false);
      const currentMemberOf = (groupResponse.data.memberOf || []).filter((group) => group.isLegacy === false);
      const fallbackLegacy = {
        leading: (groupResponse.data.leading || []).filter((group) => group.isLegacy !== false),
        memberOf: (groupResponse.data.memberOf || []).filter((group) => group.isLegacy !== false)
      };
      const normalizedGroups = {
        ...groupResponse.data,
        leading: currentLeading,
        memberOf: currentMemberOf,
        legacy: groupResponse.data.legacy || fallbackLegacy
      };
      setGroups(normalizedGroups);
      const nextSchools = [...currentLeading, ...currentMemberOf];
      setAccountForm((previous) => ({ ...previous, groupId: previous.groupId || nextSchools[0]?.groupId || '' }));
      if (role === 'admin') {
        const accountResponse = await axios.get('/admin/accounts');
        setAccounts(accountResponse.data?.accounts || []);
        setDirectoryRefreshKey((current) => current + 1);
      }
    } catch (error) {
      setToast({ type: 'error', title: 'Dashboard unavailable', message: error.response?.data?.error || error.message });
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [role]);

  const createAccount = async (event) => {
    event.preventDefault();
    try {
      setCreatingAccount(true);
      setTemporaryPassword('');
      const response = await axios.post('/admin/accounts', accountForm);
      setTemporaryPassword(response.data?.temporaryPassword || '');
      setAccountForm((previous) => ({ ...emptyAccountForm, groupId: previous.groupId }));
      setToast({ type: 'success', title: `${response.data.account.accountRole} account created`, message: `${response.data.account.username} can now access the assigned school.` });
      await loadDashboard();
    } catch (error) {
      setToast({ type: 'error', title: 'Account not created', message: error.response?.data?.error || error.message });
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 10% 0%, rgba(99,102,241,.22), transparent 32%), radial-gradient(circle at 90% 15%, rgba(6,182,212,.16), transparent 30%), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)', backgroundSize: 'auto, auto, 44px 44px, 44px 44px' }} />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <InlineToast toast={toast} onClose={() => setToast(null)} />

        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-4 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${meta.gradient} px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-950`}>
                  <RoleIcon /> {meta.label}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{meta.eyebrow}</span>
              </div>
              <p className="mt-8 text-sm text-cyan-300">Good to see you, {currentUser?.username}</p>
              <h1 className="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">{meta.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{meta.description}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/groups" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:shadow-xl">
                  Open schools <FaArrowRight />
                </Link>
                {(role === 'admin' || role === 'teacher') && (
                  <Link to="/teacher-desk" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    Teacher Desk <FaChalkboardTeacher />
                  </Link>
                )}
                {legacyCount > 0 && (
                  <Link to="/legacy" className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15">
                    Legacy <FaLock />
                  </Link>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                [schools.length, 'Schools', FaSchool],
                [role === 'admin' ? accounts.length : schools.reduce((total, school) => total + (school.members?.length || 0), 0), role === 'admin' ? 'Accounts' : 'Peers', FaUsers],
                [legacyCount, 'Legacy spaces', FaLock],
                ['AI', 'Planning ready', FaBrain]
              ].map(([value, label, Icon]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <Icon className="text-cyan-300" />
                  <div className="mt-5 text-2xl font-bold">{value}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          {(role === 'admin' ? [
            ['Provision people', 'Create teacher and student accounts with the right school access.', FaUsers, '#8b5cf6'],
            ['Build habits faster', 'Open a school challenge and turn free text into timed habits.', FaMagic, '#06b6d4'],
            ['Run the operation', 'Timetable, registers, homework, behaviour and reports stay connected.', FaSchool, '#3b82f6']
          ] : role === 'teacher' ? [
            ['Start with today', 'Teacher Desk surfaces classes, registers and the highest-priority actions.', FaChalkboardTeacher, '#06b6d4'],
            ['See the whole learner', 'Goals, habits, attendance, behaviour and homework share one profile.', FaUserGraduate, '#6366f1'],
            ['Act before drift', 'Intervention and recovery signals are built into daily workflows.', FaBrain, '#8b5cf6']
          ] : [
            ['Plan around real life', 'Explain your constraints and let OpenAI schedule today’s habits.', FaCalendarAlt, '#06b6d4'],
            ['Know the reason', 'Every habit can connect back to the goal it supports.', FaBrain, '#8b5cf6'],
            ['Build momentum', 'Your school, homework and recovery points meet in one view.', FaGraduationCap, '#3b82f6']
          ]).map(([title, description, Icon, color], index) => (
            <motion.div key={title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * index }} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22`, color }}><Icon /></div>
              <h2 className="mt-5 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-7 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">Your network</p>
              <h2 className="mt-2 text-2xl font-bold">Active schools</h2>
            </div>
            <Link to="/groups" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">View all schools →</Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schools.length ? schools.slice(0, 6).map((school) => (
              <Link key={school.id} to={`/groups/${school.groupId}`} className="group rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:-translate-y-1 hover:border-cyan-300/40">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-xl font-bold text-slate-950">{school.name?.[0] || 'S'}</div>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{school.viewerSchoolRole || role}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{school.name}</h3>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-400">
                  <span>{school.members?.length || 0} students</span>
                  <FaArrowRight className="transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                </div>
              </Link>
            )) : (
              <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
                {role === 'admin' ? 'Create your first school to begin provisioning accounts.' : 'An administrator will assign your school here.'}
              </div>
            )}
          </div>
        </section>

        {role === 'admin' && (
          <section className="mt-7 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
            <form onSubmit={createAccount} className="rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300"><FaPlus /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-300">Account control</p>
                  <h2 className="text-xl font-semibold">Create a managed account</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <input value={accountForm.firstName} onChange={(event) => setAccountForm({ ...accountForm, firstName: event.target.value })} placeholder="First name (optional)" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" />
                <input value={accountForm.lastName} onChange={(event) => setAccountForm({ ...accountForm, lastName: event.target.value })} placeholder="Last name (optional)" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" />
                <input value={accountForm.username} onChange={(event) => setAccountForm({ ...accountForm, username: event.target.value })} placeholder="Username" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" required />
                <input type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} placeholder="Email" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" required />
                <select value={accountForm.accountRole} onChange={(event) => setAccountForm({ ...accountForm, accountRole: event.target.value })} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400">
                  <option value="teacher">Teacher account</option>
                  <option value="student">Student account</option>
                  <option value="admin">Admin account</option>
                </select>
                <select value={accountForm.groupId} onChange={(event) => setAccountForm({ ...accountForm, groupId: event.target.value })} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" required>
                  <option value="">Choose school</option>
                  {schools.filter((school) => school.viewerCanManage).map((school) => <option key={school.id} value={school.groupId}>{school.name}</option>)}
                </select>
                {accountForm.accountRole === 'student' && (
                  <>
                    <input value={accountForm.yearGroup} onChange={(event) => setAccountForm({ ...accountForm, yearGroup: event.target.value })} placeholder="Year group (optional)" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" />
                    <input value={accountForm.tutorGroup} onChange={(event) => setAccountForm({ ...accountForm, tutorGroup: event.target.value })} placeholder="Tutor group (optional)" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" />
                  </>
                )}
              </div>
              <input type="password" value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} placeholder="Password (leave blank to generate)" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-violet-400" />
              {temporaryPassword && (
                <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                  Temporary password: <strong className="select-all font-mono">{temporaryPassword}</strong>
                </div>
              )}
              <button disabled={creatingAccount || !schools.length} className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50">
                {creatingAccount ? 'Creating account...' : 'Create and assign account'}
              </button>
            </form>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Directory</p>
                  <h2 className="mt-1 text-xl font-semibold">Managed accounts</h2>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{accounts.length} total</span>
              </div>
              <div className="mt-4 max-h-[390px] space-y-2 overflow-y-auto pr-1">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{account.username}</div>
                      <div className="truncate text-xs text-slate-500">{account.email}</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                      <span className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-200">{account.accountRole}</span>
                      <div className={`mt-1 text-[10px] ${account.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>{account.isActive ? 'Active' : 'Inactive'}</div>
                      </div>
                      <button type="button" onClick={() => setEditingAccount(account)} aria-label={`Edit ${account.username}`} className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-300">
                        <FaEdit />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {role === 'admin' && (
          <AdminStudentImport schools={schools} onImported={loadDashboard} onToast={setToast} />
        )}
        {role === 'admin' && (
          <AdminSchoolStudentDirectory
            schools={schools}
            refreshKey={directoryRefreshKey}
            onEdit={setEditingAccount}
            onToast={setToast}
          />
        )}
      </div>
      {editingAccount && (
        <AdminAccountEditor
          account={editingAccount}
          schools={schools}
          onClose={() => setEditingAccount(null)}
          onSaved={loadDashboard}
          onToast={setToast}
        />
      )}
    </div>
  );
};

export default Dashboard;
