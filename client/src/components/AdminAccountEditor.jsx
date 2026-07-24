import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { FaSave, FaTimes } from 'react-icons/fa';

const AdminAccountEditor = ({ account, schools, lockedGroupId = '', onClose, onSaved, onToast }) => {
  const manageableSchools = useMemo(
    () => schools.filter((school) => school.viewerCanManage),
    [schools]
  );
  const currentSchool = manageableSchools.find((school) => (
    (account.schoolAssignments || []).some((assignment) => Number(assignment.groupId) === Number(school.id))
  ));
  const [form, setForm] = useState({
    username: account.username || '',
    email: account.email || '',
    firstName: account.firstName || '',
    lastName: account.lastName || '',
    yearGroup: account.yearGroup || '',
    tutorGroup: account.tutorGroup || '',
    accountRole: account.accountRole || 'student',
    isActive: account.isActive !== false,
    password: '',
    groupId: lockedGroupId || currentSchool?.groupId || manageableSchools[0]?.groupId || ''
  });
  const [saving, setSaving] = useState(false);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveAccount = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = {
        username: form.username,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        yearGroup: form.yearGroup,
        tutorGroup: form.tutorGroup,
        accountRole: form.accountRole,
        isActive: form.isActive
      };
      if (form.password) payload.password = form.password;
      await axios.patch(`/admin/accounts/${account.id}`, payload);
      if (form.groupId) {
        const schoolRole = form.accountRole === 'admin' ? 'school-admin' : form.accountRole;
        await axios.put(`/admin/accounts/${account.id}/school`, {
          groupId: form.groupId,
          schoolRole
        });
      }
      onToast({ type: 'success', title: 'Account updated', message: `${form.username}'s details are now up to date.` });
      await onSaved();
      onClose();
    } catch (error) {
      onToast({ type: 'error', title: 'Account not updated', message: error.response?.data?.error || error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form onSubmit={saveAccount} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0b1022] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Admin account editor</p>
            <h2 className="mt-2 text-2xl font-bold">Edit {account.username}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor" className="rounded-xl border border-white/10 p-3 text-slate-400 hover:bg-white/5 hover:text-white"><FaTimes /></button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <input value={form.firstName} onChange={(event) => updateForm('firstName', event.target.value)} placeholder="First name" className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
          <input value={form.lastName} onChange={(event) => updateForm('lastName', event.target.value)} placeholder="Last name" className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
          <input value={form.username} onChange={(event) => updateForm('username', event.target.value)} placeholder="Username" required className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
          <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="Email" required className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
          <select value={form.accountRole} onChange={(event) => updateForm('accountRole', event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400">
            <option value="student">Student account</option>
            <option value="teacher">Teacher account</option>
            <option value="admin">Admin account</option>
          </select>
          {!lockedGroupId && (
            <select value={form.groupId} onChange={(event) => updateForm('groupId', event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400">
              <option value="">No school change</option>
              {manageableSchools.map((school) => <option key={school.id} value={school.groupId}>{school.name}</option>)}
            </select>
          )}
          <input value={form.yearGroup} onChange={(event) => updateForm('yearGroup', event.target.value)} placeholder="Year group" className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
          <input value={form.tutorGroup} onChange={(event) => updateForm('tutorGroup', event.target.value)} placeholder="Tutor group" className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
        </div>
        <input type="password" value={form.password} onChange={(event) => updateForm('password', event.target.value)} placeholder="New password (leave blank to keep current)" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
        <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} className="h-4 w-4 accent-cyan-400" />
          Account is active and can sign in
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/5">Cancel</button>
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
            <FaSave /> {saving ? 'Saving...' : 'Save account details'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminAccountEditor;
