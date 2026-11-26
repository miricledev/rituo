import React from 'react';
import { FiAward, FiShield, FiShoppingBag, FiTrendingUp } from 'react-icons/fi';
import StudentRewardsPanel from './StudentRewardsPanel';

function StudentRewardsPage({ groupId, studentId, refreshKey, onOpenFeature, workspaceType = 'school', readOnlyPreview = false }) {
  const isFootballWorkspace = workspaceType === 'football';
  const isStaffWorkspace = workspaceType === 'staff';
  if (!studentId) {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 text-center shadow-lg dark:border-white/10 dark:bg-white/[0.045]">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">IP Shop unavailable</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your {isFootballWorkspace ? 'client' : isStaffWorkspace ? 'staff' : 'student'} profile is still loading. Refresh this page to try again.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-violet-200/80 bg-gradient-to-br from-slate-950 via-violet-950 to-cyan-950 p-5 text-white shadow-[0_28px_80px_rgba(76,29,149,0.24)] sm:rounded-[2rem] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_10rem_auto] xl:grid-cols-[minmax(0,1fr)_13rem_auto]">
          <div className="relative z-10">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300 sm:text-xs">
              <FiShoppingBag /> IP Shop
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{isFootballWorkspace ? 'Consistency builds your player.' : isStaffWorkspace ? 'The tools are free. The drip is earned.' : 'Consistency becomes currency.'}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {isFootballWorkspace ? 'Build full habit streaks, earn IP Bucks, customise your football avatar and unlock tools that support training, mindset and recovery.' : isStaffWorkspace ? 'Every IP performance tool is included for Coaches HQ members. Full habit streaks earn IP Bucks for avatar gear and status cosmetics only.' : 'Build full habit streaks, earn IP Bucks, and shape an avatar that represents your performance journey.'}
            </p>
          </div>
          <div className="relative mx-auto h-28 w-28 sm:h-36 sm:w-36 lg:h-40 lg:w-40 xl:h-52 xl:w-52">
            <div className="absolute inset-3 rounded-full bg-amber-300/25 blur-2xl" />
            <img src="/images/rewards/ip-shop-hero.webp" alt={isFootballWorkspace ? 'Football client unlocking rewards in the IP Shop' : 'Student unlocking rewards in the IP Shop'} className="relative h-full w-full rounded-[1.5rem] object-cover drop-shadow-[0_18px_28px_rgba(245,158,11,0.2)]" />
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-2 text-center">
            {[
              ['Earn', 'Streak rewards', FiTrendingUp],
              ['Spend', 'No real money', FiAward],
              ['Own', 'Permanent unlocks', FiShield]
            ].map(([label, detail, Icon]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 backdrop-blur-sm">
                <Icon className="mx-auto text-cyan-300" />
                <p className="mt-1 text-xs font-black">{label}</p>
                <p className="mt-0.5 hidden text-[9px] text-slate-400 sm:block">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StudentRewardsPanel
        groupId={groupId}
        studentId={studentId}
        refreshKey={refreshKey}
        onOpenFeature={onOpenFeature}
        workspaceType={workspaceType}
        readOnlyPreview={readOnlyPreview}
        standalone
      />
    </div>
  );
}

export default StudentRewardsPage;
