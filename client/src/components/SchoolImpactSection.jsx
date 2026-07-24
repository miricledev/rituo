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

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">School Impact Data</h2>
        <p className="text-secondary-600 dark:text-secondary-400">
          {isLeader
            ? 'Manage student goals, weekly behaviour snapshots, trend evidence, and coach notes.'
            : isCoach
              ? 'Monitor your assigned students with goals, behaviour evidence, and school impact notes.'
              : 'See your goals first, understand why each habit matters, and review your school impact trend.'}
        </p>
      </div>

      {renderLazyPanel(
        <SchoolProfilePanel
          group={group}
          groupId={groupId}
          currentUserId={user?.id}
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
    </div>
  );
};

export default SchoolImpactSection;
