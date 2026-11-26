import { FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiUsers } from 'react-icons/fi';

const ChallengeCoveragePanel = ({
  coverage,
  aiProgress,
  canRetryAi,
  selectedRetryCount,
  retrying,
  onRetrySelected,
  onSelectMissing,
  onSelectAll,
  onClearSelection,
  retryMessage,
  memberLabel = 'student',
  memberLabelPlural = 'students',
}) => {
  const coveragePercent = coverage.totalStudents
    ? Math.round((coverage.coveredStudents / coverage.totalStudents) * 100)
    : 0;

  return (
    <div className="border-b border-slate-200 bg-slate-50/95 px-4 py-3 dark:border-white/10 dark:bg-slate-950/95 sm:px-6">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
              coverage.missingMembers.length
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
            }`}>
              {coverage.missingMembers.length ? <FiAlertTriangle /> : <FiCheckCircle />}
              {coverage.coveredStudents}/{coverage.totalStudents} {memberLabelPlural} covered
            </span>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
              {coverage.totalHabits} habits
            </span>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200">
              {coverage.averageWeeklyMinutes} min average weekly load
            </span>
            {!!coverage.studentsWithoutGoals.length && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                {coverage.studentsWithoutGoals.length} without goals
              </span>
            )}
            {!!coverage.habitsWithoutGoalLink && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                {coverage.habitsWithoutGoalLink} unlinked habits
              </span>
            )}
            {!!coverage.habitsWithoutSchedule && (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                {coverage.habitsWithoutSchedule} missing schedules
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${coveragePercent}%` }} />
          </div>
          {aiProgress?.status === 'generating' && (
            <p className="mt-2 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
              AI batch {aiProgress.batchNumber}/{aiProgress.totalBatches}: {aiProgress.completedStudents}/{aiProgress.totalStudents} {memberLabelPlural} completed.
            </p>
          )}
          {retryMessage && <p className="mt-2 text-xs font-semibold text-violet-700 dark:text-violet-200">{retryMessage}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {!!coverage.missingMembers.length && (
            <button type="button" onClick={onSelectMissing} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-400/25 dark:text-rose-200">
              <FiAlertTriangle /> Select missing
            </button>
          )}
          <button type="button" onClick={onSelectAll} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">
            <FiUsers /> Select all
          </button>
          {!!selectedRetryCount && (
            <button type="button" onClick={onClearSelection} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onRetrySelected}
            disabled={!canRetryAi || !selectedRetryCount || retrying}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiRefreshCw className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Regenerating...' : `Retry selected (${selectedRetryCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeCoveragePanel;
