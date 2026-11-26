import React from 'react';
import { FiCheck, FiClock, FiEdit2, FiLock, FiShield, FiTarget, FiZap } from 'react-icons/fi';
import { HiOutlineFire } from 'react-icons/hi2';
import { calculateHabitStreak } from '../utils/groupLeaderboard';
import { formatDateLocal } from '../utils/habitScheduleUtils';
import { getHabitCompletionWindowState } from '../utils/habitCompletionWindow';
import { calculateHabitProgress } from '../utils/habitProgressUtils';

const formatClockTime = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const StudentHabitCard = ({
  habit,
  habitIndex,
  timelineMeta,
  completionWindow,
  completionWindowsLoaded,
  completionClock,
  featured = false,
  isEditing,
  ticking,
  numericValue,
  textValue,
  tempNumericValue,
  tempTextValue,
  linkedGoalTitle,
  isHabitAvailableToday,
  getNextAvailableDay,
  onStartEdit,
  onCancelEdit,
  onToggleHabit,
  onNumericUpdate,
  onNumericSubmit,
  onTextUpdate,
  onTextSubmit
}) => {
  const habitProgress = Array.isArray(habit.progress) ? habit.progress : [];
  const today = formatDateLocal(new Date());
  const progressEntry = habitProgress.find((entry) => entry.date && entry.date.slice(0, 10) === today);
  const progressPercentage = calculateHabitProgress(habit, progressEntry);
  const isComplete = progressPercentage >= 100;
  const hasPartialProgress = progressPercentage > 0 && progressPercentage < 100;
  const savedNumericValue = progressEntry?.numericValue;
  const savedTextValue = progressEntry?.textValue;
  const periodicCompleted = Number(progressEntry?.periodicCompleted) || 0;
  const periodicTarget = Number(
    progressEntry?.periodicTarget
    ?? completionWindow?.eligibleOccurrenceCount
    ?? habit.periodicOccurrences
    ?? 4
  );
  const isAvailableToday = isHabitAvailableToday(habit);
  const nextAvailableDay = getNextAvailableDay(habit);
  const streak = calculateHabitStreak(habit);
  const combatType = habit.combatType === 'defence' ? 'defence' : 'attack';
  const completionWindowState = getHabitCompletionWindowState(
    completionWindowsLoaded ? completionWindow : null,
    completionClock
  );
  const canSubmitNow = isAvailableToday && completionWindowState.canSubmit;
  const canEditCompleted = ['boolean', 'periodic'].includes(habit.habitType || 'boolean') || canSubmitNow;
  const completionTimezoneLabel = 'your time';
  const completionWindowMessage = (() => {
    if (isComplete) return 'Completion recorded in the verified time window';
    if (completionWindowState.status === 'open') {
      return `Open now · log by ${formatClockTime(completionWindowState.activeWindow?.closesTime)} ${completionTimezoneLabel}`;
    }
    if (completionWindowState.status === 'upcoming') {
      return `Opens at ${formatClockTime(completionWindowState.nextWindow?.opensTime)} ${completionTimezoneLabel}`;
    }
    if (completionWindowState.status === 'not-applicable') {
      return 'Not counted today · your challenge started after this time';
    }
    if (completionWindowState.status === 'loading') return 'Checking completion window…';
    return 'Completion window closed for today';
  })();

  return (
    <div
      className={`relative overflow-hidden rounded-[1.15rem] border transition-all duration-200 hover:shadow-xl sm:rounded-2xl sm:hover:-translate-y-0.5 ${featured ? 'p-4 shadow-lg sm:p-6' : 'p-3 sm:p-4'} ${
        isComplete
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-cyan-50 shadow-emerald-500/10 dark:border-emerald-400/25 dark:from-emerald-500/15 dark:to-cyan-400/5'
          : 'border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/[0.035]'
      }`}
    >
      {isComplete && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-400" />}
      <div className="mb-3 min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
            combatType === 'defence'
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300'
              : 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300'
          }`}>
            {combatType === 'defence' ? <FiShield className="h-3 w-3" /> : <FiZap className="h-3 w-3" />}
            {combatType}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
            <HiOutlineFire className="h-3.5 w-3.5" /> {streak} full streak
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 sm:inline-flex">
            <FiClock className="h-3 w-3" /> {timelineMeta?.durationMinutes || habit.durationMinutes || 30} min
          </span>
        </div>
        <div className={`font-black text-slate-950 dark:text-white ${featured ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>{habit.name}</div>
        {habit.description && (
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">{habit.description}</div>
        )}
        {linkedGoalTitle && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
            <FiTarget className="h-3.5 w-3.5" />
            Why: {linkedGoalTitle}
          </div>
        )}
        {habit.habitType === 'periodic' && (
          <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200">
            <div>
              {periodicTarget} times counted today · {timelineMeta?.fromPlanner
                ? 'set in My Planner'
                : timelineMeta?.periodicTimingAdjusted
                  ? 'spread across waking hours'
                  : `every ${habit.periodicIntervalHours || 4}h`}{habit.allowOverlap ? ' · may overlap' : ''}
            </div>
            {timelineMeta?.occurrenceTimes?.length ? (
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
                {timelineMeta.occurrenceTimes.map((time, occurrenceIndex) => (
                  <span key={`${time}-${occurrenceIndex}`} className="shrink-0 rounded-md bg-white/70 px-2 py-0.5 font-mono text-[10px] dark:bg-black/10">{time}</span>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {!isAvailableToday ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-400">
            <FiLock className="h-3.5 w-3.5" /> Not scheduled today{nextAvailableDay?.day ? ` · back ${nextAvailableDay.day}` : ''}
          </div>
        ) : null}
        {isAvailableToday ? (
          <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
            isComplete
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300'
              : completionWindowState.status === 'open'
                ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300'
          }`}>
            {isComplete ? <FiCheck className="h-3.5 w-3.5" /> : completionWindowState.status === 'open' ? <FiClock className="h-3.5 w-3.5" /> : <FiLock className="h-3.5 w-3.5" />}
            {completionWindowMessage}
          </div>
        ) : null}
        {hasPartialProgress ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
            {Math.round(progressPercentage)}% recorded so far
          </div>
        ) : null}
      </div>

      {isComplete && !isEditing && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
              <FiCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Completed</span>
          </div>
          <button
            onClick={() => onStartEdit(habitIndex, habit)}
            disabled={!canEditCompleted}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-violet-600 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-cyan-300 dark:hover:bg-white/[0.06]"
          >
            <FiEdit2 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      )}

      {isComplete && !isEditing && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-white/70 p-3 dark:border-emerald-400/20 dark:bg-black/10">
          {habit.habitType === 'numeric' && (
            <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Value: {savedNumericValue !== undefined ? savedNumericValue : (habit.minValue || 0)}
            </div>
          )}
          {habit.habitType === 'text' && (
            <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Response: {savedTextValue || 'No response'}
            </div>
          )}
        </div>
      )}

      {(!isComplete || isEditing) && (
        <>
          {(habit.habitType === 'boolean' || !habit.habitType) && (
            <>
              {isAvailableToday && (canSubmitNow || isComplete) ? (
                <button
                  onClick={() => onToggleHabit(habitIndex)}
                  disabled={ticking || (!isComplete && !canSubmitNow)}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all duration-200 hover:scale-105 ${isComplete ? 'border-emerald-500 bg-emerald-500' : 'border-violet-400 bg-violet-50 text-violet-600 dark:bg-violet-500/10'} ${ticking ? 'opacity-60' : ''}`}
                >
                  {isComplete && (
                    <FiCheck className="h-5 w-5 text-white" />
                  )}
                  {ticking && (
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                  <FiLock className="h-6 w-6 text-slate-400" />
                  <span>{isAvailableToday ? completionWindowMessage : `Not scheduled today${nextAvailableDay?.day ? ` · back ${nextAvailableDay.day}` : ''}`}</span>
                </div>
              )}
            </>
          )}

          {habit.habitType === 'periodic' && (
            <div className="space-y-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all" style={{ width: `${periodicTarget > 0 ? Math.min(100, (periodicCompleted / periodicTarget) * 100) : 0}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-800 dark:text-slate-200">{periodicCompleted}/{periodicTarget} occurrences</span>
                <span className="text-slate-500">Every {habit.periodicIntervalHours || 4}h</span>
              </div>
              {isAvailableToday && (canSubmitNow || isComplete) ? (
                <button onClick={() => onToggleHabit(habitIndex)} disabled={ticking || (!isComplete && !canSubmitNow)} className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 font-bold text-white shadow-lg disabled:opacity-50">
                  {ticking ? 'Saving...' : periodicCompleted >= periodicTarget ? 'Reset today' : 'Log this occurrence'}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-400 dark:bg-white/[0.04]">
                  <FiLock /> {isAvailableToday ? completionWindowMessage : 'Not scheduled today'}
                </div>
              )}
            </div>
          )}

          {habit.habitType === 'numeric' && (
            <div className="space-y-2">
              {!isAvailableToday || !canSubmitNow ? (
                <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                  <FiLock className="h-8 w-8 text-slate-400" />
                  <span className="text-center text-sm text-gray-500">{isAvailableToday ? completionWindowMessage : `Not scheduled today${nextAvailableDay?.day ? ` · back ${nextAvailableDay.day}` : ''}`}</span>
                  {isEditing ? <button onClick={() => onCancelEdit(habitIndex)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold dark:border-white/10 dark:bg-white/[0.05]">Cancel</button> : null}
                </div>
              ) : (
                <>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Range: {habit.minValue || 0} - {habit.maxValue || 10}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Value: {isEditing
                          ? (tempNumericValue !== undefined ? tempNumericValue : (habit.minValue || 0))
                          : (numericValue !== undefined ? numericValue : (habit.minValue || 0))}
                      </span>
                      <span className="text-sm text-slate-500">
                        {habit.minValue || 0} - {habit.maxValue || 10}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={habit.minValue || 0}
                      max={habit.maxValue || 10}
                      step="1"
                      value={isEditing
                        ? (tempNumericValue !== undefined ? tempNumericValue : (habit.minValue || 0))
                        : (numericValue !== undefined ? numericValue : (habit.minValue || 0))}
                      onChange={(e) => onNumericUpdate(habitIndex, parseInt(e.target.value, 10), isEditing)}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-violet-600 dark:bg-white/10"
                    />
                    <div className="flex gap-2">
                      {isEditing && (
                        <button
                          onClick={() => onCancelEdit(habitIndex)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => onNumericSubmit(habitIndex, isEditing ? tempNumericValue : numericValue, isEditing)}
                        disabled={ticking || (isEditing ? tempNumericValue === undefined : numericValue === undefined)}
                        className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-2 font-bold text-white shadow-lg shadow-violet-500/15 transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        {ticking ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {habit.habitType === 'text' && (
            <div className="space-y-2">
              {!isAvailableToday || !canSubmitNow ? (
                <div className="flex flex-col items-center justify-center gap-2 py-4 opacity-50">
                  <FiLock className="h-8 w-8 text-slate-400" />
                  <span className="text-center text-sm text-gray-500">{isAvailableToday ? completionWindowMessage : `Not scheduled today${nextAvailableDay?.day ? ` · back ${nextAvailableDay.day}` : ''}`}</span>
                  {isEditing ? <button onClick={() => onCancelEdit(habitIndex)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold dark:border-white/10 dark:bg-white/[0.05]">Cancel</button> : null}
                </div>
              ) : (
                <>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {habit.prompt || 'Enter your response'}
                  </div>
                  <textarea
                    value={isEditing ? (tempTextValue || '') : (textValue || '')}
                    onChange={(e) => onTextUpdate(habitIndex, e.target.value, isEditing)}
                    placeholder="Enter your response..."
                    rows="3"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-black/15 dark:text-white"
                  />
                  <div className="flex gap-2">
                    {isEditing && (
                      <button
                        onClick={() => onCancelEdit(habitIndex)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => onTextSubmit(habitIndex, isEditing ? tempTextValue : textValue, isEditing)}
                      disabled={ticking || (isEditing ? !tempTextValue?.trim() : !textValue?.trim())}
                      className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-2 font-bold text-white shadow-lg shadow-violet-500/15 transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {ticking ? 'Saving...' : (isEditing ? 'Update' : 'Submit')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentHabitCard;
