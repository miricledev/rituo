import { useState } from 'react';
import { FiBell, FiCalendar, FiCheckCircle, FiClock, FiUsers } from 'react-icons/fi';

const ChallengeFormPanel = ({
  isEditingHabits,
  editor,
  editChallengeHabitsMode,
  newChallenge,
  lockedHabits,
  goBackToEditing,
  handleCreateChallenge,
  groupMembers,
  coverage,
  workspaceType = 'school'
}) => {
  const isFootballWorkspace = workspaceType === 'football';
  const memberLabel = isFootballWorkspace ? 'client' : 'student';
  const memberLabelPlural = isFootballWorkspace ? 'clients' : 'students';
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [publishing, setPublishing] = useState(false);

  if (isEditingHabits) {
    return <div className="w-full overflow-y-auto p-4 sm:p-6 lg:w-1/2">{editor}</div>;
  }

  const totalHabits = Object.values(lockedHabits).flat().length;
  const totalStudents = groupMembers?.length || Object.keys(lockedHabits).length;
  const canCreate = !!newChallenge.startDate
    && !!newChallenge.endDate
    && totalHabits > 0
    && !coverage?.missingMembers?.length
    && !coverage?.habitsWithoutSchedule;
  const startDate = newChallenge.startDate ? new Date(`${newChallenge.startDate}T00:00:00`) : null;
  const endDate = newChallenge.endDate ? new Date(`${newChallenge.endDate}T00:00:00`) : null;
  const challengeDays = startDate && endDate
    ? Math.max(1, Math.round((endDate - startDate) / 86400000) + 1)
    : 0;

  const publish = async () => {
    try {
      setPublishing(true);
      const success = await handleCreateChallenge();
      if (!success) setShowPublishConfirmation(false);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="w-full overflow-y-auto p-4 sm:p-6 lg:w-1/2">
      <div className="space-y-6 rounded-[1.75rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 dark:border-emerald-400/20 dark:from-emerald-500/10 dark:via-white/[0.03] dark:to-cyan-400/5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">Ready for review</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Challenge summary</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Check every {memberLabel} assignment on the left, then review the final publication details.</p>
          <div className="mt-5 space-y-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-black/15">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Start date</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{newChallenge.startDate || 'Existing challenge'}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">End date</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{newChallenge.endDate || 'Existing challenge'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Assignments</p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {totalHabits} habits across {totalStudents} {memberLabelPlural}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Duration</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{challengeDays || '—'} days</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Average workload</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{coverage?.averageWeeklyMinutes || 0} minutes weekly</p>
              </div>
            </div>
          </div>
        </div>

        <button type="button" onClick={goBackToEditing} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 transition hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
          ← Go back and edit habits
        </button>

        {editChallengeHabitsMode ? (
          <button type="button" onClick={publish} disabled={publishing} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:opacity-50">
            {publishing ? 'Saving habits...' : 'Save habits'}
          </button>
        ) : (
          <div>
            <button type="button" onClick={() => setShowPublishConfirmation(true)} disabled={!canCreate} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 font-black text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none">
              Review and publish challenge
            </button>
            {!canCreate && (
              <p className="mt-2 text-center text-sm font-semibold text-rose-600 dark:text-rose-300">
                Add dates, schedules, and at least one habit for every {memberLabel} before publishing.
              </p>
            )}
          </div>
        )}
      </div>

      {showPublishConfirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-2xl text-emerald-300">
              <FiCheckCircle />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Final publication check</p>
            <h3 className="mt-2 text-2xl font-black">Publish this challenge?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">The challenge becomes active immediately and each assigned {memberLabel} receives an inbox notification.</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                [FiCalendar, `${newChallenge.startDate} → ${newChallenge.endDate}`, `${challengeDays} days`],
                [FiUsers, `${totalStudents} ${memberLabelPlural}`, `${totalHabits} assigned habits`],
                [FiClock, `${coverage?.averageWeeklyMinutes || 0} minutes`, 'Average weekly workload'],
                [FiBell, `${totalStudents} notifications`, 'Sent after publication'],
              ].map(([Icon, value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <Icon className="text-cyan-300" />
                  <div className="mt-3 text-sm font-bold">{value}</div>
                  <div className="mt-1 text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowPublishConfirmation(false)} disabled={publishing} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 disabled:opacity-50">
                Continue reviewing
              </button>
              <button type="button" onClick={publish} disabled={publishing} className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                {publishing ? 'Publishing...' : `Confirm and notify ${memberLabelPlural}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChallengeFormPanel;
