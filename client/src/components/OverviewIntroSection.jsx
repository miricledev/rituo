import React from 'react';

const OverviewIntroSection = ({
  activeTab,
  isLeader,
  mySchoolProfile,
  group
}) => {
  if (activeTab !== 'overview') {
    return null;
  }

  return (
    <>
      {!isLeader && mySchoolProfile?.goals?.length > 0 && (
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-violet-700 to-cyan-600 p-6 text-white shadow-2xl shadow-violet-500/20 sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
            <div className="relative text-xs font-bold uppercase tracking-[0.24em] text-violet-100">Your goal first</div>
            <h2 className="relative mt-2 text-3xl font-black tracking-tight">{mySchoolProfile.goals[0].title}</h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-100">Barrier</div>
                <div className="mt-1 font-medium">{mySchoolProfile.goals[0].barrier || 'Not set yet'}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-100">For yourself</div>
                <div className="mt-1 font-medium">{mySchoolProfile.goals[0].forSelf || 'Not set yet'}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-100">For others</div>
                <div className="mt-1 font-medium">{mySchoolProfile.goals[0].forOthers || 'Not set yet'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="mb-8 rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">Community</p>
        <h2 className="mb-5 mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Members</h2>
        {group.members && group.members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/20"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xl font-black text-white shadow-lg shadow-violet-500/20 transition group-hover:scale-105">
                  {member.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-bold text-slate-950 dark:text-white">{member.username}</div>
                  <div className="truncate text-sm text-slate-500 dark:text-slate-400">{member.email}</div>
                </div>
                {group.leader && String(group.leader.id) === String(member.id) && (
                  <span className="ml-2 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
                    Leader
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-slate-400 dark:border-white/10">No members yet.</p>
        )}
      </section>
    </>
  );
};

export default OverviewIntroSection;
