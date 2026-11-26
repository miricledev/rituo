import React from 'react';
import FootballDashboardOverview from '../components/FootballDashboardOverview';
import GroupDetailWorkspace from '../components/GroupDetailWorkspace';
import GroupWorkspaceShell from '../components/GroupWorkspaceShell';

function FootballGroupDetail({ shellProps, workspaceProps }) {
  return (
    <div className="relative mx-auto w-full max-w-[1440px] overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-emerald-50/70 via-white to-cyan-50/60 dark:from-[#030b09] dark:via-[#06110e] dark:to-[#071526]" />
      <div className="pointer-events-none fixed left-[-10rem] top-24 -z-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none fixed right-[-8rem] top-1/3 -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <GroupWorkspaceShell {...shellProps} compactForStudent={!workspaceProps.isLeader} workspaceVariant="football" allowTypeEditing={false} />
      <GroupDetailWorkspace
        {...workspaceProps}
        workspaceType="football"
        overviewContent={<FootballDashboardOverview {...workspaceProps} />}
      />
    </div>
  );
}

export default FootballGroupDetail;
