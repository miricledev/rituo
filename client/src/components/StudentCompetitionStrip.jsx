import React, { useMemo } from 'react';
import { FiCalendar, FiTrendingUp } from 'react-icons/fi';
import { HiOutlineFire } from 'react-icons/hi2';
import { buildStudentCompetitionData } from '../utils/groupLeaderboard';

const rankStyles = [
  'bg-amber-400 text-amber-950',
  'bg-slate-300 text-slate-800',
  'bg-orange-300 text-orange-950'
];

const getVisibleEntries = (standings) => {
  const topEntries = standings.slice(0, 3).map((entry, index) => ({ ...entry, rank: index + 1 }));
  const currentIndex = standings.findIndex((entry) => entry.isCurrentUser);
  if (currentIndex < 3 || currentIndex < 0) return topEntries;
  return [...topEntries, { ...standings[currentIndex], rank: currentIndex + 1, isCurrentSummary: true }];
};

function MiniLeaderboard({ title, subtitle, entries, icon: Icon, accentClass }) {
  const visibleEntries = getVisibleEntries(entries);

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-2.5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-950 dark:text-white">{title}</h3>
            <p className="hidden truncate text-[9px] text-slate-500 dark:text-slate-400 sm:block">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {visibleEntries.map((entry) => (
          <div
            key={`${title}-${entry.member.id}-${entry.rank}`}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
              entry.isCurrentUser
                ? 'border-violet-200 bg-violet-50 dark:border-violet-400/20 dark:bg-violet-500/10'
                : 'border-transparent bg-slate-50 dark:bg-black/10'
            } ${entry.isCurrentSummary ? 'mt-2 border-dashed' : ''}`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-black ${rankStyles[entry.rank - 1] || 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
              {entry.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-slate-900 dark:text-white">
                {entry.displayName}{entry.isCurrentUser ? ' · You' : ''}
              </p>
              <p className="hidden text-[9px] text-slate-500 dark:text-slate-400 sm:block">{entry.completed}/{entry.opportunities} habits</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-black text-violet-700 dark:text-cyan-300">{entry.percentage}%</p>
              {entry.streak > 0 ? (
                <p className="flex items-center justify-end gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-300"><HiOutlineFire /> {entry.streak}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentCompetitionStrip({ group, userId }) {
  const competition = useMemo(() => buildStudentCompetitionData({
    activeChallenge: group?.activeChallenge,
    members: group?.members || [],
    userId
  }), [group?.activeChallenge, group?.members, userId]);

  if (competition.studentCount <= 1) return null;

  return (
    <div className="relative grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
      <img src="/images/competition/friendly-league.webp" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08] dark:opacity-[0.14]" />
      <MiniLeaderboard
        title="Daily leaderboard"
        subtitle="Today’s scheduled habits"
        entries={competition.daily}
        icon={FiCalendar}
        accentClass="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
      />
      <MiniLeaderboard
        title="Weekly leaderboard"
        subtitle="Monday through today"
        entries={competition.weekly}
        icon={FiTrendingUp}
        accentClass="bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200"
      />
    </div>
  );
}

export default StudentCompetitionStrip;
