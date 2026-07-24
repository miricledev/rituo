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
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 text-white shadow-xl">
            <div className="text-xs uppercase tracking-[0.2em] text-primary-100">Your goal first</div>
            <h2 className="mt-2 text-3xl font-bold">{mySchoolProfile.goals[0].title}</h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-white/10 p-3">
                <div className="text-primary-100">Barrier</div>
                <div className="mt-1 font-medium">{mySchoolProfile.goals[0].barrier || 'Not set yet'}</div>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <div className="text-primary-100">For yourself</div>
                <div className="mt-1 font-medium">{mySchoolProfile.goals[0].forSelf || 'Not set yet'}</div>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <div className="text-primary-100">For others</div>
                <div className="mt-1 font-medium">{mySchoolProfile.goals[0].forOthers || 'Not set yet'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Members</h2>
        {group.members && group.members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-4 flex items-center gap-4 border border-gray-200 dark:border-secondary-700 transition-transform transform hover:scale-[1.025] hover:shadow-2xl group cursor-pointer"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-xl font-bold text-primary-700 dark:text-primary-200 group-hover:ring-4 group-hover:ring-primary-200/40">
                  {member.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-secondary-900 dark:text-white truncate">{member.username}</div>
                  <div className="text-sm text-secondary-500 dark:text-secondary-400 truncate">{member.email}</div>
                </div>
                {group.leader && String(group.leader.id) === String(member.id) && (
                  <span className="ml-2 px-2 py-1 text-xs rounded bg-gradient-to-r from-primary-100 to-primary-300 dark:from-primary-900 dark:to-primary-700 text-primary-800 dark:text-primary-200 font-semibold shadow-sm border border-primary-200 dark:border-primary-800">
                    Leader
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No members yet.</p>
        )}
      </div>
    </>
  );
};

export default OverviewIntroSection;
