import React from 'react';
import InlineToast from './InlineToast';
import ConfirmModal from './ConfirmModal';
import AddMembersToChallengeModal from './AddMembersToChallengeModal';

const GroupDetailOverlays = ({
  pageToast,
  clearPageToast,
  showCancelConfirm,
  memberHabits,
  setShowCancelConfirm,
  confirmCancel,
  showDeleteChallengeConfirm,
  setShowDeleteChallengeConfirm,
  challengeDeleteActiveChallenge,
  confirmDialog,
  clearConfirmation,
  showAddMembersToChallengeModal,
  group,
  membersNotInChallenge,
  addMembersToChallengeSelected,
  challengeToggleAddMemberToChallenge,
  setShowAddMembersToChallengeModal,
  setAddMembersToChallengeSelected,
  challengeHandleAddMembersToChallenge,
  addMembersToChallengeSubmitting
}) => {
  return (
    <>
      {pageToast && (
        <div className="mb-6">
          <InlineToast toast={pageToast} onClose={clearPageToast} />
        </div>
      )}

      {showCancelConfirm && (
        <ConfirmModal
          title="Close Challenge Editor?"
          message={`You have ${Object.values(memberHabits).flat().length} habit${Object.values(memberHabits).flat().length !== 1 ? 's' : ''} in the editor. New challenge work is autosaved and will be restored next time; unsaved edits to an already active challenge are not published.`}
          cancelLabel="Keep Editing"
          confirmLabel="Close Editor"
          onCancel={() => setShowCancelConfirm(false)}
          onConfirm={confirmCancel}
        />
      )}

      {showDeleteChallengeConfirm && (
        <ConfirmModal
          title="Remove Active Challenge"
          message="Are you sure you want to remove this challenge? All data for this challenge will be permanently lost (member habits, progress, attendance, analytics). This action cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Yes, remove"
          onCancel={() => setShowDeleteChallengeConfirm(false)}
          onConfirm={challengeDeleteActiveChallenge}
          maxWidthClassName="max-w-lg"
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          cancelLabel="Cancel"
          confirmLabel={confirmDialog.confirmLabel}
          confirmClassName={confirmDialog.confirmClassName}
          onCancel={clearConfirmation}
          onConfirm={async () => {
            const action = confirmDialog.onConfirm;
            clearConfirmation();
            if (action) {
              await action();
            }
          }}
        />
      )}

      {showAddMembersToChallengeModal && group?.activeChallenge && (
        <AddMembersToChallengeModal
          activeChallenge={group.activeChallenge}
          membersNotInChallenge={membersNotInChallenge}
          selectedMemberIds={addMembersToChallengeSelected}
          onToggleMember={challengeToggleAddMemberToChallenge}
          onClose={() => {
            setShowAddMembersToChallengeModal(false);
            setAddMembersToChallengeSelected([]);
          }}
          onSubmit={challengeHandleAddMembersToChallenge}
          submitting={addMembersToChallengeSubmitting}
        />
      )}
    </>
  );
};

export default GroupDetailOverlays;
