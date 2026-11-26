import React from 'react';
import {
  FiActivity,
  FiArchive,
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiClock,
  FiEdit2,
  FiGrid,
  FiMessageCircle,
  FiPlus,
  FiSettings,
  FiShoppingBag,
  FiTool,
  FiTrash2,
  FiUsers,
  FiX
} from 'react-icons/fi';
import { HiOutlineAcademicCap, HiOutlineSparkles } from 'react-icons/hi2';

const tabIcons = {
  overview: FiGrid,
  chat: FiMessageCircle,
  dms: FiMessageCircle,
  dm: FiMessageCircle,
  leaderboard: FiBarChart2,
  challenge: FiActivity,
  course: FiBookOpen,
  colorChart: FiActivity,
  calendar: FiCalendar,
  rewards: FiShoppingBag,
  tools: FiTool,
  school: HiOutlineAcademicCap,
  archives: FiArchive,
  history: FiArchive,
  presets: HiOutlineSparkles,
  attendance: FiClock,
  coaches: FiUsers,
  admin: FiSettings
};

function GroupWorkspaceShell({
  group,
  isLeader,
  isEditingGroupName,
  newGroupName,
  setNewGroupName,
  handleSaveGroupName,
  handleCancelEditGroupName,
  handleEditGroupName,
  containerIdLabel,
  containerLabel,
  isEditingGroupType,
  newGroupType,
  setNewGroupType,
  handleSaveGroupType,
  handleCancelEditGroupType,
  handleEditGroupType,
  activeTab,
  setActiveTab,
  tabs,
  compactForStudent,
  workspaceVariant,
  allowTypeEditing = true,
  persistentContent,
  showChallengeAction = true,
  onOpenChallenge,
  onRemoveChallenge
}) {
  const visibleTabs = tabs.filter((tab) => tab.show);
  const isFootballWorkspace = workspaceVariant === 'football' || group.groupType === 'football';
  const isStaffWorkspace = workspaceVariant === 'staff' || group.groupType === 'staff';

  return (
    <section className={`relative overflow-hidden border bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:bg-[#081024]/90 dark:shadow-[0_30px_90px_rgba(0,0,0,0.35)] ${isFootballWorkspace ? 'border-emerald-200/80 dark:border-emerald-400/15' : 'border-slate-200/80 dark:border-white/10'} ${compactForStudent ? 'mb-4 rounded-[1.5rem] sm:mb-6 sm:rounded-[2rem]' : 'mb-6 rounded-[2rem]'}`}>
      <div className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl ${isFootballWorkspace ? 'bg-emerald-500/15' : 'bg-violet-500/15'}`} />
      <div className={`pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full blur-3xl ${isFootballWorkspace ? 'bg-lime-400/10' : 'bg-cyan-400/10'}`} />

      <div className={`relative ${compactForStudent ? 'p-4 sm:p-7 lg:p-8' : 'p-5 sm:p-7 lg:p-8'}`}>
        <div className={`flex flex-col justify-between gap-5 lg:flex-row ${persistentContent ? 'lg:items-start' : 'lg:items-center'}`}>
          <div className={`min-w-0 ${persistentContent ? 'lg:flex-1' : ''}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${isFootballWorkspace ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200'}`}>
                {group.groupType === 'football' ? <FiActivity className="h-3.5 w-3.5" /> : isStaffWorkspace ? <FiUsers className="h-3.5 w-3.5" /> : <HiOutlineAcademicCap className="h-3.5 w-3.5" />}
                {containerLabel} workspace
              </span>
              {group.activeChallenge && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Challenge live
                </span>
              )}
            </div>

            {isEditingGroupName && isLeader ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-2xl font-bold text-slate-950 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.06] dark:text-white sm:text-3xl"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveGroupName} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-400" title="Save">
                    <FiCheck className="h-5 w-5" />
                  </button>
                  <button onClick={handleCancelEditGroupName} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300" title="Cancel">
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-3">
                <h1 className={`break-words bg-gradient-to-r bg-clip-text font-black tracking-tight text-transparent ${isFootballWorkspace ? 'from-slate-950 via-emerald-900 to-cyan-700 dark:from-white dark:via-emerald-100 dark:to-cyan-200' : 'from-slate-950 via-violet-900 to-cyan-700 dark:from-white dark:via-violet-100 dark:to-cyan-200'} ${compactForStudent ? 'text-2xl sm:text-4xl lg:text-5xl' : 'text-3xl sm:text-4xl lg:text-5xl'}`}>
                  {group.name}
                </h1>
                {isLeader && (
                  <button onClick={handleEditGroupName} className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-slate-500 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400 dark:hover:text-cyan-300" title={`Edit ${containerLabel.toLowerCase()} name`}>
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                {containerIdLabel}: {group.groupId}
              </span>
              {allowTypeEditing && isEditingGroupType && isLeader && !group.activeChallenge ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={newGroupType} onChange={(e) => setNewGroupType(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#0e172b] dark:text-white">
                    <option value="school">School</option>
                    <option value="football">Football Group</option>
                  </select>
                  <button onClick={handleSaveGroupType} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white transition hover:bg-emerald-400" title="Save">
                    <FiCheck className="h-4 w-4" />
                  </button>
                  <button onClick={handleCancelEditGroupType} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:text-rose-500 dark:border-white/10 dark:text-slate-300" title="Cancel">
                    <FiX className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    group.groupType === 'football'
                      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300'
                      : 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300'
                  }`}>
                    {group.groupType === 'football' ? 'Football Group' : isStaffWorkspace ? 'Coaches HQ' : 'School'}
                  </span>
                  {allowTypeEditing && isLeader && !group.activeChallenge && (
                    <button onClick={handleEditGroupType} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-white/[0.06] dark:hover:text-cyan-300" title={`Edit ${containerLabel.toLowerCase()} type`}>
                      <FiEdit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isLeader && group.activeChallenge && (
                    <span className="text-xs text-slate-400">Type locked during active challenge</span>
                  )}
                </>
              )}
            </div>
          </div>

          {persistentContent ? (
            <div className="w-full shrink-0 lg:w-[min(58%,680px)]">
              {persistentContent}
            </div>
          ) : null}

          {showChallengeAction && isLeader && (
            group.activeChallenge ? (
              <button onClick={onRemoveChallenge} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 transition-all hover:-translate-y-0.5 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 lg:w-auto">
                <FiTrash2 className="h-4 w-4" />
                Remove Challenge
              </button>
            ) : (
              <button onClick={onOpenChallenge} className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-5 py-3 text-sm font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 lg:w-auto ${isFootballWorkspace ? 'from-emerald-600 to-cyan-500 shadow-emerald-500/20 hover:shadow-emerald-500/30 focus-visible:ring-emerald-400' : 'from-violet-600 to-cyan-500 shadow-violet-500/20 hover:shadow-violet-500/30 focus-visible:ring-violet-400'}`}>
                <FiPlus className="h-4 w-4" />
                Create Challenge
              </button>
            )
          )}
        </div>
      </div>

      <div className="relative border-t border-slate-200/80 bg-slate-50/70 px-3 py-3 dark:border-white/10 dark:bg-black/10 sm:px-5">
        <nav className={compactForStudent ? 'grid grid-cols-3 gap-1 sm:flex sm:gap-2 sm:overflow-x-auto sm:pb-1' : 'flex gap-2 overflow-x-auto pb-1 scrollbar-thin'}>
          {visibleTabs.map((tab) => {
            const Icon = tabIcons[tab.key] || FiGrid;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex flex-shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition-all sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-sm ${compactForStudent ? 'flex-col gap-1 px-1 py-2' : 'gap-2 px-3.5 py-2.5'} ${
                  isActive
                    ? isFootballWorkspace
                      ? 'border-emerald-200 bg-white text-emerald-800 shadow-sm dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-100'
                      : 'border-violet-200 bg-white text-violet-700 shadow-sm dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-100'
                    : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.055] dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? (isFootballWorkspace ? 'text-emerald-600 dark:text-emerald-300' : 'text-violet-600 dark:text-cyan-300') : ''}`} />
                {compactForStudent ? (
                  <><span className="sm:hidden">{tab.mobileLabel || tab.label}</span><span className="hidden sm:inline">{tab.label}</span></>
                ) : tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

export default GroupWorkspaceShell;
