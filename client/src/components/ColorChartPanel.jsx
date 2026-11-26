import React from 'react';
import { FiArrowLeft, FiBarChart2, FiUsers } from 'react-icons/fi';

const ColorChartPanel = ({
  isLeader,
  isCoach,
  selectedColorChartMember,
  setSelectedColorChartMember,
  availableMembers,
  group,
  user,
  renderColorChart,
  workspaceType = 'school'
}) => {
  const isFootballWorkspace = workspaceType === 'football';
  return (
    <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] sm:rounded-[2rem] sm:p-6">
      {(isLeader || isCoach) ? (
        !selectedColorChartMember ? (
          <div>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">{isFootballWorkspace ? 'Football development' : 'Development'}</p>
              <h2 className="mb-2 mt-1 flex items-center gap-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                <FiBarChart2 className="text-violet-500 dark:text-cyan-300" />
                {isFootballWorkspace ? 'Football Colour Charts' : 'Skill Development Charts'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {isFootballWorkspace ? 'Select a client to review and update their football development chart.' : isCoach ? 'Select a student to manage their skill development chart.' : 'Select a member to manage their skill development chart.'}
              </p>
            </div>

            {availableMembers.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {availableMembers.map((member) => (
                  <div
                    key={member.id}
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white/75 p-6 transition-all hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/20"
                    onClick={() => setSelectedColorChartMember(member)}
                  >
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/20">
                        <span className="text-2xl font-black text-white">
                          {member.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">
                        {member.username}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Click to view {isFootballWorkspace ? 'football chart' : 'skill chart'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-white/15">
                <FiUsers className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                <h3 className="mb-2 text-xl font-bold text-slate-950 dark:text-white">
                  {isFootballWorkspace ? 'No Clients Yet' : 'No Members Yet'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {isFootballWorkspace ? 'There are no clients in this football workspace yet.' : isCoach ? 'No students are assigned to you yet.' : 'There are no members in this group yet.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <button
                onClick={() => setSelectedColorChartMember(null)}
                className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-violet-600 transition hover:border-violet-300 dark:border-white/10 dark:text-cyan-300"
              >
                <FiArrowLeft />
                <span>Back to {isFootballWorkspace ? 'clients' : 'members'}</span>
              </button>
              <h2 className="mb-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                {selectedColorChartMember.username}&apos;s {isFootballWorkspace ? 'Football Colour Chart' : 'Skill Development Chart'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Manage {isFootballWorkspace ? 'football development' : 'skill development'} for {selectedColorChartMember.username}.
              </p>
            </div>

            {renderColorChart({
              memberHabit: { member: selectedColorChartMember.id },
              group,
              selectedMember: selectedColorChartMember
            })}
          </div>
        )
      ) : (
        <div>
          <div className="mb-4 sm:mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">{isFootballWorkspace ? 'Football development' : 'Development'}</p>
            <h2 className="mb-2 mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">{isFootballWorkspace ? 'My Football Colour Chart' : 'My Skill Development Chart'}</h2>
            <p className="hidden text-slate-600 dark:text-slate-400 sm:block">
              {isFootballWorkspace ? 'Track the football qualities you and your coach are developing together.' : 'Track and develop your personal skills.'}
            </p>
          </div>

          {renderColorChart({
            memberHabit: { member: user?.id },
            group,
            selectedMember: user
          })}
        </div>
      )}
    </section>
  );
};

export default ColorChartPanel;
