import React from 'react';

const SchoolImpactSection = ({
  activeTab,
  isLeader,
  isCoach,
  user,
  group,
  groupId,
  schoolProfiles,
  leagueTable,
  schoolProfilesLoading,
  fetchSchoolProfiles,
  fetchGroupDetails,
  renderLazyPanel,
  SchoolProfilePanel,
  forcedSchoolSection,
  onSchoolSectionChange
}) => {
  if (activeTab !== 'school') {
    return null;
  }
  const isTeacherView = !isLeader && (isCoach || user?.accountRole === 'teacher');
  const heading = isLeader ? 'School impact data' : isTeacherView ? 'Student support' : 'My progress';

  return (
    <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:rounded-[2rem] sm:p-6">
      <div className="mb-4 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">School intelligence</p>
        <h2 className="mb-2 mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">{heading}</h2>
        <p className="hidden text-slate-600 dark:text-slate-400 sm:block">
          {isLeader
            ? 'Manage student goals, weekly behaviour snapshots, trend evidence, and coach notes.'
            : isTeacherView
              ? 'Monitor your assigned students with goals, behaviour evidence, and school impact notes.'
              : 'Review your own points, attendance, goals, habits, and progress trend.'}
        </p>
      </div>

      {renderLazyPanel(
        <SchoolProfilePanel
          group={group}
          groupId={groupId}
          currentUserId={user?.id}
          accountRole={user?.accountRole}
          isLeader={isLeader}
          isCoach={isCoach}
          profilesData={schoolProfiles}
          leagueTable={leagueTable}
          profilesLoading={schoolProfilesLoading}
          refreshProfiles={fetchSchoolProfiles}
          refreshGroup={fetchGroupDetails}
          forcedActiveSection={forcedSchoolSection}
          onActiveSectionChange={onSchoolSectionChange}
        />
      )}
    </section>
  );
};

export default SchoolImpactSection;
