import ConfirmModal from './ConfirmModal';

const MemberManagementSection = ({
  group,
  memberToKick,
  setMemberToKick,
  setShowKickMemberConfirm,
  showKickMemberConfirm,
  onKickMember
}) => (
  <div>
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">Member Management</h2>
      <p className="text-secondary-600 dark:text-secondary-400">Remove members from the group</p>
    </div>

    <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg border border-gray-200 dark:border-secondary-700">
      {group?.members && group.members.length > 0 ? (
        <div className="divide-y divide-gray-200 dark:divide-secondary-700">
          {group.members.map((member) => {
            const isLeader = group.leader && String(group.leader.id) === String(member.id);

            return (
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-200">
                    {member.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-secondary-900 dark:text-white">
                      {member.username}
                      {isLeader && (
                        <span className="ml-2 text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                          Leader
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-secondary-500 dark:text-secondary-400">{member.email}</div>
                  </div>
                </div>
                {!isLeader && (
                  <button
                    onClick={() => {
                      setMemberToKick(member);
                      setShowKickMemberConfirm(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-secondary-500 dark:text-secondary-400">
          No members in this group
        </div>
      )}
    </div>

    {showKickMemberConfirm && memberToKick && (
      <ConfirmModal
        title="Remove Member"
        message={<>Are you sure you want to remove <strong>{memberToKick.username}</strong> from this group? This action cannot be undone.</>}
        cancelLabel="Cancel"
        confirmLabel="Remove Member"
        onCancel={() => {
          setShowKickMemberConfirm(false);
          setMemberToKick(null);
        }}
        onConfirm={() => onKickMember(memberToKick.id)}
        confirmClassName="bg-red-600 hover:bg-red-700 text-white"
      />
    )}
  </div>
);

export default MemberManagementSection;
