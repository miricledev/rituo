import React from 'react';
import { FiActivity, FiCopy, FiShield, FiTrash2, FiUser, FiUsers } from 'react-icons/fi';
import ConfirmModal from './ConfirmModal';
import GroupManagementSection from './GroupManagementSection';

function FootballClientManagement({
  group,
  memberToKick,
  setMemberToKick,
  showKickMemberConfirm,
  setShowKickMemberConfirm,
  onKickMember,
  showPageToast,
  deleteGroupConfirmText,
  setDeleteGroupConfirmText,
  setShowDeleteGroupStep,
  showDeleteGroupStep,
  onDeleteGroup
}) {
  const clients = (group?.members || []).filter((member) => String(member.id) !== String(group?.leader?.id));
  const challengeMemberIds = new Set((group?.activeChallenge?.memberHabits || []).map((entry) => String(entry.member?.id ?? entry.member)));

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(group.groupId);
      showPageToast?.('success', 'Client join code copied');
    } catch (_error) {
      showPageToast?.('error', 'Could not copy the join code');
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50 p-5 shadow-[0_22px_70px_rgba(5,150,105,0.1)] dark:border-emerald-400/20 dark:from-[#071712] dark:via-[#09231c] dark:to-[#0a1d2d] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">Client setup</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Keep the coaching relationship focused.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Football workspaces are designed for 1-to-1 clients or a very small coaching group, keeping every tool centred on individual development.</p>
          </div>
          <button type="button" onClick={copyJoinCode} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 dark:bg-emerald-300 dark:text-emerald-950">
            <FiCopy /> Copy client code · {group.groupId}
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300"><FiUsers /> Client roster</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{clients.length} active {clients.length === 1 ? 'client' : 'clients'}</h3>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">Recommended: 1 client per workspace</span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {clients.map((client) => {
            const inProgramme = challengeMemberIds.has(String(client.id));
            return (
              <article key={client.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-black/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-lg font-black text-white"><FiUser /></span>
                    <div className="min-w-0">
                      <h4 className="truncate font-black text-slate-950 dark:text-white">{client.username}</h4>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{client.email}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setMemberToKick(client); setShowKickMemberConfirm(true); }} className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-600 transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300" title="Remove client"><FiTrash2 /></button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white px-3 py-2.5 dark:bg-white/[0.05]"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Programme</p><p className={`mt-1 text-xs font-black ${inProgramme ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{inProgramme ? 'Included' : 'Not assigned'}</p></div>
                  <div className="rounded-xl bg-white px-3 py-2.5 dark:bg-white/[0.05]"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Workspace</p><p className="mt-1 text-xs font-black text-slate-700 dark:text-slate-200">Planner · Chart · Shop</p></div>
                </div>
              </article>
            );
          })}
          {!clients.length ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-white/15">
              <FiActivity className="mx-auto h-9 w-9 text-slate-300" />
              <h4 className="mt-3 font-black text-slate-950 dark:text-white">No client has joined yet</h4>
              <p className="mt-1 text-sm text-slate-500">Share the client code above, then create their first performance challenge.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-200/70 bg-cyan-50/70 p-5 dark:border-cyan-400/20 dark:bg-cyan-400/10 sm:p-6">
        <div className="flex items-start gap-3"><FiShield className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" /><div><h3 className="font-black text-cyan-950 dark:text-cyan-100">A focused client experience</h3><p className="mt-1 text-sm leading-6 text-cyan-900/70 dark:text-cyan-100/70">Clients see only their football programme, daily habits, planner, Football Colour Chart, coach chat, rewards and purchased performance tools.</p></div></div>
      </section>

      <GroupManagementSection
        deleteGroupConfirmText={deleteGroupConfirmText}
        group={group}
        setDeleteGroupConfirmText={setDeleteGroupConfirmText}
        setShowDeleteGroupStep={setShowDeleteGroupStep}
        showDeleteGroupStep={showDeleteGroupStep}
        onDeleteGroup={onDeleteGroup}
      />

      {showKickMemberConfirm && memberToKick ? (
        <ConfirmModal
          title="Remove Client"
          message={<>Remove <strong>{memberToKick.username}</strong> from this football workspace? Their account will remain, but they will lose access to this coaching space.</>}
          cancelLabel="Keep Client"
          confirmLabel="Remove Client"
          onCancel={() => { setShowKickMemberConfirm(false); setMemberToKick(null); }}
          onConfirm={() => onKickMember(memberToKick.id)}
          confirmClassName="bg-rose-600 hover:bg-rose-700 text-white"
        />
      ) : null}
    </div>
  );
}

export default FootballClientManagement;
