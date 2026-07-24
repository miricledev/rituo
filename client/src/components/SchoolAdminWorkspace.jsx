import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FaBolt,
  FaChalkboardTeacher,
  FaCheckCircle,
  FaDownload,
  FaEdit,
  FaFileCsv,
  FaKey,
  FaMagic,
  FaPlus,
  FaRobot,
  FaSave,
  FaSearch,
  FaSchool,
  FaShieldAlt,
  FaSignOutAlt,
  FaUserGraduate,
  FaUsers,
} from 'react-icons/fa';
import AdminAccountEditor from './AdminAccountEditor';
import AdminStudentImport from './AdminStudentImport';
import GroupManagementSection from './GroupManagementSection';

const emptyAccountForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  accountRole: 'teacher',
  yearGroup: '',
  tutorGroup: '',
};

const sections = [
  { id: 'overview', label: 'Overview', icon: FaBolt },
  { id: 'people', label: 'People', icon: FaUsers },
  { id: 'add', label: 'Add person', icon: FaPlus },
  { id: 'import', label: 'Bulk CSV', icon: FaFileCsv },
  { id: 'settings', label: 'School setup', icon: FaSchool },
];

const schoolRoleLabels = {
  'school-admin': 'School admin',
  headteacher: 'Headteacher',
  teacher: 'Teacher',
  coach: 'Coach',
  'pastoral-lead': 'Pastoral lead',
  student: 'Student',
};

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15';
const cardClass = 'rounded-2xl border border-white/10 bg-white/[0.045] p-5';

const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const safeFilename = (value) => String(value || 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const downloadCsv = (filename, headers, rows) => {
  const content = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
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

const downloadCredential = (schoolName, credential) => {
  const headers = ['school', 'name', 'accountRole', 'username', 'email', 'temporaryPassword'];
  const row = {
    school: schoolName,
    name: [credential.firstName, credential.lastName].filter(Boolean).join(' '),
    accountRole: credential.accountRole,
    username: credential.username,
    email: credential.email,
    temporaryPassword: credential.temporaryPassword,
  };
  downloadCsv(`${safeFilename(schoolName)}-${credential.username}-login.csv`, headers, [row]);
};

function SchoolAdminWorkspace({
  group,
  groupId,
  user,
  fetchGroupDetails,
  showPageToast,
  onOpenSchoolSection,
  deleteGroupConfirmText,
  setDeleteGroupConfirmText,
  setShowDeleteGroupStep,
  showDeleteGroupStep,
  onDeleteGroup,
}) {
  const [activeSection, setActiveSection] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, students: 0, teachers: 0, admins: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [creating, setCreating] = useState(false);
  const [latestCredential, setLatestCredential] = useState(null);
  const [workingAccountId, setWorkingAccountId] = useState(null);
  const [generatingStudentLogins, setGeneratingStudentLogins] = useState(false);
  const [schoolName, setSchoolName] = useState(group?.name || '');
  const [savingSchool, setSavingSchool] = useState(false);

  const school = useMemo(() => ({ ...group, viewerCanManage: true }), [group]);
  const notify = (toast) => {
    showPageToast?.(toast.type || 'success', toast.title || 'School admin', toast.message || '');
  };

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/admin/schools/${groupId}/accounts`);
      setAccounts(response.data?.accounts || []);
      setSummary(response.data?.summary || { total: 0, students: 0, teachers: 0, admins: 0, inactive: 0 });
    } catch (error) {
      notify({
        type: 'error',
        title: 'People directory unavailable',
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [groupId]);

  useEffect(() => {
    setSchoolName(group?.name || '');
  }, [group?.name]);

  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (roleFilter !== 'all' && account.accountRole !== roleFilter) return false;
      if (!query) return true;
      return [
        account.firstName,
        account.lastName,
        account.username,
        account.email,
        account.yearGroup,
        account.tutorGroup,
        account.schoolRole,
      ].join(' ').toLowerCase().includes(query);
    });
  }, [accounts, roleFilter, search]);

  const createAccount = async (event) => {
    event.preventDefault();
    try {
      setCreating(true);
      const response = await axios.post('/admin/accounts', {
        ...accountForm,
        groupId,
      });
      const account = response.data.account;
      setLatestCredential({
        ...account,
        temporaryPassword: response.data.temporaryPassword || accountForm.password,
      });
      setAccountForm({ ...emptyAccountForm, accountRole: accountForm.accountRole });
      await Promise.all([loadAccounts(), fetchGroupDetails?.()]);
      notify({
        type: 'success',
        title: `${account.accountRole} account created`,
        message: `${account.username} can now access ${group.name}.`,
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Account not created',
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async (account) => {
    const confirmed = window.confirm(`Generate a new temporary password for ${account.username}? Their current password will stop working.`);
    if (!confirmed) return;
    try {
      setWorkingAccountId(account.id);
      const response = await axios.post(`/admin/schools/${groupId}/accounts/${account.id}/reset-password`);
      setLatestCredential({
        ...response.data.account,
        temporaryPassword: response.data.temporaryPassword,
      });
      notify({
        type: 'success',
        title: 'Temporary password generated',
        message: 'Download or copy it now. It will not be shown again.',
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Password not reset',
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setWorkingAccountId(null);
    }
  };

  const removeFromSchool = async (account) => {
    const confirmed = window.confirm(
      `Remove ${account.username} from ${group.name}? Their account will remain in the system, but all school access and class assignments here will be removed.`
    );
    if (!confirmed) return;
    try {
      setWorkingAccountId(account.id);
      const response = await axios.delete(`/admin/schools/${groupId}/accounts/${account.id}`);
      await Promise.all([loadAccounts(), fetchGroupDetails?.()]);
      notify({ type: 'success', title: 'School access removed', message: response.data.message });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Account not removed',
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setWorkingAccountId(null);
    }
  };

  const copyCredential = async () => {
    if (!latestCredential) return;
    const content = [
      `School: ${group.name}`,
      `Username: ${latestCredential.username}`,
      `Email: ${latestCredential.email}`,
      `Temporary password: ${latestCredential.temporaryPassword}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(content);
      notify({ type: 'success', title: 'Login copied', message: 'The one-time login details are on your clipboard.' });
    } catch (_error) {
      notify({ type: 'error', title: 'Could not copy', message: 'Download the login CSV instead.' });
    }
  };

  const downloadStudentRoster = () => {
    const students = accounts.filter((account) => account.accountRole === 'student');
    downloadCsv(
      `${safeFilename(group.name)}-student-roster.csv`,
      ['firstName', 'lastName', 'username', 'email', 'yearGroup', 'tutorGroup', 'isActive'],
      students
    );
  };

  const generateStudentLoginPack = async () => {
    const studentCount = accounts.filter((account) => account.accountRole === 'student').length;
    if (!studentCount) {
      notify({ type: 'error', title: 'No student logins available', message: 'Add students before generating a login pack.' });
      return;
    }
    const confirmed = window.confirm(
      `Generate a login CSV for all ${studentCount} students? This resets every current student password to a new six-digit password.`
    );
    if (!confirmed) return;
    try {
      setGeneratingStudentLogins(true);
      const response = await axios.post(`/admin/schools/${groupId}/student-logins`, { confirmReset: true });
      downloadCsv(
        `${safeFilename(group.name)}-student-logins-${new Date().toISOString().slice(0, 10)}.csv`,
        ['firstName', 'lastName', 'username', 'email', 'temporaryPassword', 'yearGroup', 'tutorGroup', 'isActive'],
        response.data.credentials || []
      );
      notify({
        type: 'success',
        title: 'Student login pack downloaded',
        message: `${response.data.credentials?.length || 0} passwords were securely regenerated.`,
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Login pack not generated',
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setGeneratingStudentLogins(false);
    }
  };

  const saveSchoolName = async (event) => {
    event.preventDefault();
    if (!schoolName.trim() || schoolName.trim() === group.name) return;
    try {
      setSavingSchool(true);
      await axios.put(`/groups/${groupId}`, { name: schoolName.trim() });
      await fetchGroupDetails?.();
      notify({ type: 'success', title: 'School updated', message: 'The school name has been saved.' });
    } catch (error) {
      notify({ type: 'error', title: 'School not updated', message: error.response?.data?.error || error.message });
    } finally {
      setSavingSchool(false);
    }
  };

  const renderCredentialCard = () => latestCredential && (
    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-emerald-100">
            <FaCheckCircle /> One-time login ready
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div><span className="text-emerald-100/60">Username</span><div className="select-all font-mono text-white">{latestCredential.username}</div></div>
            <div><span className="text-emerald-100/60">Email</span><div className="select-all font-mono text-white">{latestCredential.email}</div></div>
            <div><span className="text-emerald-100/60">Temporary password</span><div className="select-all font-mono text-lg font-bold text-white">{latestCredential.temporaryPassword}</div></div>
          </div>
          <p className="mt-3 text-xs text-emerald-100/70">Save this now. Passwords are stored only as hashes and cannot be recovered later.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyCredential} className="rounded-xl border border-emerald-200/30 px-4 py-2.5 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/10">Copy login</button>
          <button type="button" onClick={() => downloadCredential(group.name, latestCredential)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-950">
            <FaDownload /> Download CSV
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#081024]/95 text-white shadow-2xl shadow-slate-950/30">
      <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/15 via-cyan-500/10 to-transparent p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
              <FaShieldAlt /> School administration
            </div>
            <h2 className="mt-2 text-3xl font-bold">{group.name} control centre</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Add staff and students, repair unfamiliar CSV files with AI, issue secure logins, control access, and jump directly into school setup.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-100"><FaRobot /> AI import assistant active</div>
            <div className="mt-1 text-xs text-violet-200/70">Unknown CSV columns are mapped into the required schema before review.</div>
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                activeSection === id
                  ? 'border-cyan-300/60 bg-cyan-300 text-slate-950'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:text-white'
              }`}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        {activeSection === 'overview' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                [summary.total, 'Total accounts', FaUsers, 'text-cyan-300'],
                [summary.students, 'Students', FaUserGraduate, 'text-emerald-300'],
                [summary.teachers, 'Teachers', FaChalkboardTeacher, 'text-blue-300'],
                [summary.admins, 'Admins', FaShieldAlt, 'text-violet-300'],
                [summary.inactive, 'Inactive', FaKey, 'text-amber-300'],
              ].map(([value, label, Icon, color]) => (
                <div key={label} className={cardClass}>
                  <Icon className={color} />
                  <div className="mt-5 text-3xl font-bold">{loading ? '—' : value}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            {renderCredentialCard()}

            <div className="grid gap-4 lg:grid-cols-3">
              <button type="button" onClick={() => setActiveSection('add')} className={`${cardClass} text-left transition hover:-translate-y-0.5 hover:border-violet-300/35`}>
                <FaPlus className="text-xl text-violet-300" />
                <h3 className="mt-5 text-lg font-semibold">Add one person</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Enter a name and role. The system can generate the username, email, and secure temporary password.</p>
              </button>
              <button type="button" onClick={() => setActiveSection('import')} className={`${cardClass} text-left transition hover:-translate-y-0.5 hover:border-cyan-300/35`}>
                <FaMagic className="text-xl text-cyan-300" />
                <h3 className="mt-5 text-lg font-semibold">Import students with AI</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Upload almost any CSV layout, review the AI-reformatted rows, then create all accounts together.</p>
              </button>
              <button type="button" onClick={() => setActiveSection('people')} className={`${cardClass} text-left transition hover:-translate-y-0.5 hover:border-emerald-300/35`}>
                <FaUsers className="text-xl text-emerald-300" />
                <h3 className="mt-5 text-lg font-semibold">Manage existing accounts</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Search people, edit details, deactivate accounts, reset passwords, or remove school access.</p>
              </button>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
              <div className="flex items-start gap-3">
                <FaRobot className="mt-1 shrink-0 text-cyan-300" />
                <div>
                  <h3 className="font-semibold text-cyan-50">Fastest route for a new school</h3>
                  <ol className="mt-3 grid gap-3 text-sm text-cyan-50/75 md:grid-cols-4">
                    <li><strong className="text-white">1.</strong> Add administrators and teachers.</li>
                    <li><strong className="text-white">2.</strong> Upload the student CSV.</li>
                    <li><strong className="text-white">3.</strong> Review AI mappings and import.</li>
                    <li><strong className="text-white">4.</strong> Download the generated login pack.</li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}

        {activeSection === 'add' && (
          <div className="grid gap-6 xl:grid-cols-[1fr_.7fr]">
            <form onSubmit={createAccount} className={cardClass}>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300"><FaPlus /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Quick account generator</p>
                  <h3 className="mt-1 text-xl font-semibold">Add a student, teacher, or administrator</h3>
                  <p className="mt-2 text-sm text-slate-400">Only the name and account type are required. Leave login fields blank to generate them automatically.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <input value={accountForm.firstName} onChange={(event) => setAccountForm({ ...accountForm, firstName: event.target.value })} placeholder="First name" required className={inputClass} />
                <input value={accountForm.lastName} onChange={(event) => setAccountForm({ ...accountForm, lastName: event.target.value })} placeholder="Last name" required className={inputClass} />
                <select value={accountForm.accountRole} onChange={(event) => setAccountForm({ ...accountForm, accountRole: event.target.value })} className={inputClass}>
                  <option value="teacher">Teacher account</option>
                  <option value="student">Student account</option>
                  <option value="admin">Administrator account</option>
                </select>
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-xs leading-5 text-cyan-100/75">
                  {accountForm.accountRole === 'student'
                    ? 'Students receive a generated @innerperformance.co.uk email and six-digit password.'
                    : 'Staff receive a generated @innerperformance.co.uk email and strong temporary password.'}
                </div>
                {accountForm.accountRole === 'student' && (
                  <>
                    <input value={accountForm.yearGroup} onChange={(event) => setAccountForm({ ...accountForm, yearGroup: event.target.value })} placeholder="Year group (optional)" className={inputClass} />
                    <input value={accountForm.tutorGroup} onChange={(event) => setAccountForm({ ...accountForm, tutorGroup: event.target.value })} placeholder="Tutor group (optional)" className={inputClass} />
                  </>
                )}
              </div>

              <details className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300">Advanced login options</summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input value={accountForm.username} onChange={(event) => setAccountForm({ ...accountForm, username: event.target.value })} placeholder="Custom username (optional)" className={inputClass} />
                  <input type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} placeholder="Custom email (optional)" className={inputClass} />
                  <input type="password" value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} placeholder="Custom password (optional)" className={`${inputClass} sm:col-span-2`} />
                </div>
              </details>

              <button disabled={creating} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
                <FaMagic /> {creating ? 'Creating account...' : 'Generate account and school access'}
              </button>
            </form>

            <div className="space-y-4">
              {renderCredentialCard()}
              <div className={cardClass}>
                <h3 className="font-semibold">What happens automatically?</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                  <li>• A unique username is created from the person&apos;s name.</li>
                  <li>• Their school email uses the Inner Performance domain.</li>
                  <li>• The correct student, teacher, or admin school role is assigned.</li>
                  <li>• Students are kept to one current school.</li>
                  <li>• A one-time password is shown for secure distribution.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'people' && (
          <>
            {renderCredentialCard()}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold">School people directory</h3>
                <p className="mt-1 text-sm text-slate-400">Manage every account currently assigned to this school.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <button type="button" onClick={downloadStudentRoster} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-400/35 hover:text-white">
                  <FaDownload /> Student roster
                </button>
                <button type="button" disabled={generatingStudentLogins} onClick={generateStudentLoginPack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-400/15 disabled:opacity-50">
                  <FaKey /> {generatingStudentLogins ? 'Generating...' : 'Student login pack'}
                </button>
                <label className="relative">
                  <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className={`${inputClass} pl-10 sm:w-72`} />
                </label>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={inputClass}>
                  <option value="all">All account types</option>
                  <option value="admin">Admins</option>
                  <option value="teacher">Teachers</option>
                  <option value="student">Students</option>
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Person</th>
                      <th className="px-4 py-3">Login</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Student details</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {visibleAccounts.map((account) => (
                      <tr key={account.id} className="bg-white/[0.025] align-middle hover:bg-white/[0.05]">
                        <td className="px-4 py-4">
                          <div className="font-semibold">{[account.firstName, account.lastName].filter(Boolean).join(' ') || account.username}</div>
                          <div className="mt-1 text-xs text-slate-500">{account.email}</div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-cyan-200">{account.username}</td>
                        <td className="px-4 py-4">
                          <div className="font-medium capitalize">{account.accountRole}</div>
                          <div className="mt-1 text-xs text-slate-500">{schoolRoleLabels[account.schoolRole] || account.schoolRole}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-400">{[account.yearGroup, account.tutorGroup].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${account.isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                            {account.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingAccount(account)} className="rounded-lg border border-white/10 p-2.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200" title="Edit account"><FaEdit /></button>
                            {Number(account.id) !== Number(user?.id) && (
                              <>
                                <button type="button" disabled={workingAccountId === account.id} onClick={() => resetPassword(account)} className="rounded-lg border border-white/10 p-2.5 text-slate-300 hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-50" title="Reset password"><FaKey /></button>
                                <button type="button" disabled={workingAccountId === account.id} onClick={() => removeFromSchool(account)} className="rounded-lg border border-white/10 p-2.5 text-slate-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50" title="Remove from school"><FaSignOutAlt /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && visibleAccounts.length === 0 && (
                      <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">No school accounts match the current filters.</td></tr>
                    )}
                    {loading && (
                      <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">Loading school accounts...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeSection === 'import' && (
          <>
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
              <div className="flex items-start gap-3">
                <FaRobot className="mt-1 shrink-0 text-violet-300" />
                <div>
                  <h3 className="font-semibold text-violet-100">AI-assisted, but always reviewed by you</h3>
                  <p className="mt-2 text-sm leading-6 text-violet-100/70">
                    Template files are processed locally. If headings differ, OpenAI returns only a strict column mapping. The app then reformats rows, generates unique six-digit student logins, validates every field, and waits for your approval.
                  </p>
                </div>
              </div>
            </div>
            <AdminStudentImport
              schools={[school]}
              lockedGroupId={groupId}
              onImported={async () => {
                await Promise.all([loadAccounts(), fetchGroupDetails?.()]);
              }}
              onToast={notify}
            />
          </>
        )}

        {activeSection === 'settings' && (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
              <form onSubmit={saveSchoolName} className={cardClass}>
                <div className="flex items-center gap-3">
                  <FaSchool className="text-xl text-cyan-300" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">School identity</p>
                    <h3 className="mt-1 text-lg font-semibold">Name and workspace</h3>
                  </div>
                </div>
                <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">School name</label>
                <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className={`${inputClass} mt-2`} />
                <button disabled={savingSchool || !schoolName.trim() || schoolName.trim() === group.name} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40">
                  <FaSave /> {savingSchool ? 'Saving...' : 'Save school name'}
                </button>
              </form>

              <div className={cardClass}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Operational setup</p>
                <h3 className="mt-1 text-lg font-semibold">Continue configuring the school</h3>
                <p className="mt-2 text-sm text-slate-400">Open the specialist setup areas without leaving this school.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ['School structure', 'school-structure'],
                    ['Timetable', 'school-timetable'],
                    ['Registers and classes', 'teacher-register'],
                    ['Operations and roles', 'school-operations'],
                    ['Homework setup', 'school-homework'],
                    ['Reports and exports', 'school-reports'],
                  ].map(([label, section]) => (
                    <button key={section} type="button" onClick={() => onOpenSchoolSection?.(section)} className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:border-cyan-400/35 hover:bg-cyan-400/5 hover:text-white">
                      {label} →
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {onDeleteGroup && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-1">
                <GroupManagementSection
                  deleteGroupConfirmText={deleteGroupConfirmText}
                  group={group}
                  setDeleteGroupConfirmText={setDeleteGroupConfirmText}
                  setShowDeleteGroupStep={setShowDeleteGroupStep}
                  showDeleteGroupStep={showDeleteGroupStep}
                  onDeleteGroup={onDeleteGroup}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {editingAccount && (
        <AdminAccountEditor
          account={editingAccount}
          schools={[school]}
          lockedGroupId={groupId}
          onClose={() => setEditingAccount(null)}
          onSaved={async () => {
            await Promise.all([loadAccounts(), fetchGroupDetails?.()]);
          }}
          onToast={notify}
        />
      )}
    </section>
  );
}

export default SchoolAdminWorkspace;
