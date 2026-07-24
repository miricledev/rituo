import React, { useState } from 'react';
import GroupChat from './GroupChat';
import DirectMessagesPanel from './DirectMessagesPanel';
import ChallengeEditorModal from './ChallengeEditorModal';
import GroupDetailOverlays from './GroupDetailOverlays';
import CourseTabSection from './CourseTabSection';
import HabitPresetsPanel from './HabitPresetsPanel';
import SchoolImpactSection from './SchoolImpactSection';
import HabitCalendarSection from './HabitCalendarSection';
import ArchivePanel from './ArchivePanel';
import LeaderboardPanel from './LeaderboardPanel';
import ColorChartPanel from './ColorChartPanel';
import HabitPresetModal from './HabitPresetModal';

function formatChannelActivityTime(timestamp) {
  if (!timestamp) return 'No activity yet';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMinutes = Math.max(0, Math.floor((now - date) / (1000 * 60)));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function truncateChannelActivity(content, maxLength = 64) {
  if (!content) return 'No activity yet';
  return content.length > maxLength ? `${content.slice(0, maxLength)}...` : content;
}

function getActivityTimestamp(activity) {
  return activity?.createdAt ? new Date(activity.createdAt).getTime() : 0;
}

function GroupDetailWorkspace(props) {
  const [chatChannel, setChatChannel] = useState(null);
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [showAttentionOnly, setShowAttentionOnly] = useState(false);
  const {
    activeTab,
    groupId,
    isLeader,
    isCoach,
    group,
    myMemberHabit,
    editingHabits,
    overviewContent,
    selectedChatClassId,
    setSelectedChatClassId,
    conversations,
    conversationsLoading,
    filteredConversations,
    searchQuery,
    setSearchQuery,
    selectedDMUser,
    setSelectedDMUser,
    formatRelativeTime,
    leaderboardData,
    courseProgress,
    refreshCourseProgress,
    renderLazyPanel,
    CourseStudentProgress,
    CourseManager,
    CoursePlayer,
    selectedColorChartMember,
    setSelectedColorChartMember,
    availableMembers,
    user,
    renderColorChart,
    schoolProfiles,
    leagueTable,
    schoolProfilesLoading,
    fetchSchoolProfiles,
    fetchGroupDetails,
    SchoolProfilePanel,
    forcedSchoolSection,
    onSchoolSectionChange,
    HabitCalendar,
    showCreateChallengeModal,
    editChallengeHabitsMode,
    hasHabitsAdded,
    memberHabits,
    lockedHabits,
    expandAllMembersInModal,
    collapseAllMembersInModal,
    collapsedMembersInModal,
    lockedChallengeMemberIds,
    toggleMemberCollapseInModal,
    setMemberHabits,
    newChallenge,
    goBackToEditing,
    challengeHandleCreateChallenge,
    habitPresets,
    challengeHandleLoadPreset,
    setNewChallenge,
    getDateString,
    groupCourses,
    currentHabit,
    setCurrentHabit,
    schoolProfileMap,
    challengeIsChallengeValid,
    challengeGetMissingMembers,
    handleCancel,
    lockHabitsAndShowOverview,
    pageToast,
    clearPageToast,
    showCancelConfirm,
    setShowCancelConfirm,
    confirmCancel,
    showDeleteChallengeConfirm,
    setShowDeleteChallengeConfirm,
    challengeDeleteActiveChallenge,
    confirmDialog,
    clearConfirmation,
    showAddMembersToChallengeModal,
    addMembersToChallengeSelected,
    membersNotInChallenge,
    setShowAddMembersToChallengeModal,
    setAddMembersToChallengeSelected,
    challengeToggleAddMemberToChallenge,
    challengeHandleAddMembersToChallenge,
    addMembersToChallengeSubmitting,
    archivesLoading,
    archives,
    onCreatePreset,
    onEditPreset,
    onDeletePreset,
    onLoadPreset,
    showPresetModal,
    editingPresetId,
    onAddPresetHabit,
    onClosePresetModal,
    onRemovePresetHabit,
    onSavePreset,
    onUpdatePresetHabit,
    presetFormData,
    setPresetFormData
  } = props;
  const schoolWideUnreadCount = chatChannel?.schoolWideUnreadCount || 0;
  const accessibleClasses = chatChannel?.accessibleClasses || [];
  const sortedAccessibleClasses = [...accessibleClasses].sort((left, right) => {
    if ((right.unreadCount || 0) !== (left.unreadCount || 0)) {
      return (right.unreadCount || 0) - (left.unreadCount || 0);
    }
    return getActivityTimestamp(right.latestActivity) - getActivityTimestamp(left.latestActivity);
  });
  const totalChannelUnreadCount = schoolWideUnreadCount + accessibleClasses.reduce(
    (sum, schoolClass) => sum + (schoolClass.unreadCount || 0),
    0
  );
  const attentionChannels = sortedAccessibleClasses.filter((schoolClass) => (schoolClass.unreadCount || 0) > 0).slice(0, 3);
  const recentChannels = [...sortedAccessibleClasses]
    .sort((left, right) => getActivityTimestamp(right.latestActivity) - getActivityTimestamp(left.latestActivity))
    .slice(0, 3);
  const normalizedChannelSearch = channelSearchQuery.trim().toLowerCase();
  const visibleChannelRailClasses = sortedAccessibleClasses.filter((schoolClass) => {
    if (showAttentionOnly && !(schoolClass.unreadCount || 0)) {
      return false;
    }
    if (!normalizedChannelSearch) {
      return true;
    }
    const haystack = `${schoolClass.name} ${schoolClass.latestActivity?.content || ''}`.toLowerCase();
    return haystack.includes(normalizedChannelSearch);
  });
  const selectedChannelLabel = selectedChatClassId
    ? `${chatChannel?.className || 'Class'} chat`
    : 'School-wide chat';
  const selectedChannelLatestActivity = selectedChatClassId
    ? chatChannel?.latestActivity
    : chatChannel?.schoolWideLatestActivity || chatChannel?.latestActivity;

  return (
    <>
      {overviewContent}

      {activeTab === 'chat' && (
        <div className="space-y-4">
          {(group?.groupType || 'school') === 'school' && (
            <section className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-card backdrop-blur dark:border-secondary-700 dark:bg-secondary-800/80">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-600 dark:text-primary-300">
                      Community channel
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold text-secondary-900 dark:text-white">
                        {selectedChannelLabel}
                      </h3>
                      <span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-semibold text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200">
                        {totalChannelUnreadCount > 0 ? `${totalChannelUnreadCount} unread across channels` : 'All channels caught up'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
                      {selectedChatClassId
                        ? 'Class-specific discussion and homework activity live together here.'
                        : 'Whole-school conversation, announcements, and cross-school discussion. Staff-to-student messaging stays in the shared channel for school groups.'}
                    </p>
                    <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/50">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                        Latest activity
                      </p>
                      <p className="mt-1 text-sm font-medium text-secondary-900 dark:text-white">
                        {truncateChannelActivity(selectedChannelLatestActivity?.content)}
                      </p>
                      <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                        {formatChannelActivityTime(selectedChannelLatestActivity?.createdAt)}
                        {selectedChannelLatestActivity?.senderUsername ? ` | ${selectedChannelLatestActivity.senderUsername}` : ''}
                      </p>
                    </div>
                  </div>
                  {selectedChatClassId != null && (
                    <button
                      type="button"
                      onClick={() => setSelectedChatClassId(null)}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 px-3 py-2 text-sm font-semibold text-secondary-700 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-200 dark:hover:border-primary-700 dark:hover:text-primary-300"
                    >
                      Back to school-wide
                    </button>
                  )}
                </div>

                <div className="sm:hidden">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                    Choose channel
                  </label>
                  <select
                    value={selectedChatClassId ?? 'school-wide'}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSelectedChatClassId(nextValue === 'school-wide' ? null : Number(nextValue));
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-secondary-700 dark:bg-secondary-900 dark:text-white"
                  >
                    <option value="school-wide">
                      School-wide{schoolWideUnreadCount > 0 ? ` (${schoolWideUnreadCount})` : ''}
                    </option>
                    {visibleChannelRailClasses.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}{schoolClass.unreadCount > 0 ? ` (${schoolClass.unreadCount})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hidden sm:block">
                  <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                      Channel rail
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={channelSearchQuery}
                        onChange={(event) => setChannelSearchQuery(event.target.value)}
                        placeholder="Search channels"
                        className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-secondary-700 dark:bg-secondary-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAttentionOnly((value) => !value)}
                        className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                          showAttentionOnly
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                            : 'border-gray-200 text-secondary-600 hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
                        }`}
                      >
                        Attention only
                      </button>
                      <p className="text-xs text-secondary-500 dark:text-secondary-400">
                        Swipe or scroll to move across classes
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto pb-1">
                    <div className="flex min-w-max gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedChatClassId(null)}
                        className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                          selectedChatClassId == null
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                            : 'border-gray-200 text-secondary-600 hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
                        }`}
                      >
                        School-wide
                        {schoolWideUnreadCount > 0 && (
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                            selectedChatClassId == null
                              ? 'bg-primary-600 text-white dark:bg-primary-500'
                              : 'bg-gray-700 text-white dark:bg-secondary-700'
                          }`}>
                            {schoolWideUnreadCount}
                          </span>
                        )}
                      </button>
                      {visibleChannelRailClasses.map((schoolClass) => (
                        <button
                          key={schoolClass.id}
                          type="button"
                          onClick={() => setSelectedChatClassId(schoolClass.id)}
                          className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                            String(selectedChatClassId) === String(schoolClass.id)
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                              : 'border-gray-200 text-secondary-600 hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
                          }`}
                        >
                          {schoolClass.name}
                          {(schoolClass.unreadCount || 0) > 0 && (
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                              String(selectedChatClassId) === String(schoolClass.id)
                                ? 'bg-primary-600 text-white dark:bg-primary-500'
                                : 'bg-gray-700 text-white dark:bg-secondary-700'
                            }`}>
                              {schoolClass.unreadCount}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {visibleChannelRailClasses.length === 0 && (
                    <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
                      No channels match the current search or filter.
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                        Needs attention
                      </p>
                      {attentionChannels.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {attentionChannels.map((schoolClass) => (
                            <button
                              key={schoolClass.id}
                              type="button"
                              onClick={() => setSelectedChatClassId(schoolClass.id)}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/60 dark:border-secondary-700 dark:bg-secondary-800 dark:hover:border-primary-700 dark:hover:bg-primary-900/10"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-secondary-900 dark:text-white">{schoolClass.name}</span>
                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                                  {schoolClass.unreadCount}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                                {truncateChannelActivity(schoolClass.latestActivity?.content, 42)}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">No class channels with unread activity.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                        Recent channels
                      </p>
                      {recentChannels.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {recentChannels.map((schoolClass) => (
                            <button
                              key={schoolClass.id}
                              type="button"
                              onClick={() => setSelectedChatClassId(schoolClass.id)}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/60 dark:border-secondary-700 dark:bg-secondary-800 dark:hover:border-primary-700 dark:hover:bg-primary-900/10"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-secondary-900 dark:text-white">{schoolClass.name}</span>
                                <span className="text-[11px] text-secondary-500 dark:text-secondary-400">
                                  {formatChannelActivityTime(schoolClass.latestActivity?.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                                {truncateChannelActivity(schoolClass.latestActivity?.content, 42)}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">No recent class activity yet.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                        School-wide latest
                      </p>
                      <p className="mt-1 text-sm text-secondary-900 dark:text-white">
                        {truncateChannelActivity(chatChannel?.schoolWideLatestActivity?.content)}
                      </p>
                      <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                        {formatChannelActivityTime(chatChannel?.schoolWideLatestActivity?.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                        Most active class
                      </p>
                      {sortedAccessibleClasses.length > 0 ? (
                        (() => {
                          const topClass = [...sortedAccessibleClasses].sort((left, right) => {
                            const leftLatest = left.latestActivity?.createdAt ? new Date(left.latestActivity.createdAt).getTime() : 0;
                            const rightLatest = right.latestActivity?.createdAt ? new Date(right.latestActivity.createdAt).getTime() : 0;
                            return rightLatest - leftLatest;
                          })[0];
                          return (
                            <>
                              <p className="mt-1 text-sm font-medium text-secondary-900 dark:text-white">{topClass?.name || 'No classes yet'}</p>
                              <p className="mt-1 text-sm text-secondary-700 dark:text-secondary-200">
                                {truncateChannelActivity(topClass?.latestActivity?.content)}
                              </p>
                              <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                                {formatChannelActivityTime(topClass?.latestActivity?.createdAt)}
                              </p>
                            </>
                          );
                        })()
                      ) : (
                        <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">No class channels available.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">
                        Channel order
                      </p>
                      <p className="mt-1 text-sm text-secondary-700 dark:text-secondary-200">
                        The rail prioritizes unread classes first, then latest activity.
                      </p>
                      <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
                        Use the quick cards above when several classes are active at once.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="h-96">
          <GroupChat
            groupId={group.groupId || groupId}
            groupName={group.name}
            isSchoolGroup={(group?.groupType || 'school') === 'school'}
            selectedClassId={selectedChatClassId}
            onSelectClassId={setSelectedChatClassId}
            showChannelPicker={false}
            onChannelChange={setChatChannel}
          />
          </div>
        </div>
      )}

      {(group?.groupType || 'school') !== 'school' ? (
        <DirectMessagesPanel
          activeTab={activeTab}
          isLeader={isLeader}
          group={group}
          conversations={conversations}
          conversationsLoading={conversationsLoading}
          filteredConversations={filteredConversations}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedDMUser={selectedDMUser}
          setSelectedDMUser={setSelectedDMUser}
          formatRelativeTime={formatRelativeTime}
        />
      ) : null}

      {activeTab === 'leaderboard' && (
        <LeaderboardPanel leaderboardData={leaderboardData} isLeader={isLeader} />
      )}

      <CourseTabSection
        activeTab={activeTab}
        isLeader={isLeader}
        group={group}
        groupId={groupId}
        courseProgress={courseProgress}
        refreshCourseProgress={refreshCourseProgress}
        renderLazyPanel={renderLazyPanel}
        CourseStudentProgress={CourseStudentProgress}
        CourseManager={CourseManager}
        CoursePlayer={CoursePlayer}
      />

      {activeTab === 'colorChart' && (
        <ColorChartPanel
          isLeader={isLeader}
          isCoach={isCoach}
          selectedColorChartMember={selectedColorChartMember}
          setSelectedColorChartMember={setSelectedColorChartMember}
          availableMembers={availableMembers}
          group={group}
          user={user}
          renderColorChart={renderColorChart}
        />
      )}

      <SchoolImpactSection
        activeTab={activeTab}
        isLeader={isLeader}
        isCoach={isCoach}
        user={user}
        group={group}
        groupId={groupId}
        schoolProfiles={schoolProfiles}
        leagueTable={leagueTable}
        schoolProfilesLoading={schoolProfilesLoading}
        fetchSchoolProfiles={fetchSchoolProfiles}
        fetchGroupDetails={fetchGroupDetails}
        renderLazyPanel={renderLazyPanel}
        SchoolProfilePanel={SchoolProfilePanel}
        forcedSchoolSection={forcedSchoolSection}
        onSchoolSectionChange={onSchoolSectionChange}
      />

      <HabitCalendarSection
        activeTab={activeTab}
        isLeader={isLeader}
        group={group}
        myMemberHabit={myMemberHabit}
        renderLazyPanel={renderLazyPanel}
        HabitCalendar={HabitCalendar}
      />

      <ChallengeEditorModal
        show={showCreateChallengeModal}
        editChallengeHabitsMode={editChallengeHabitsMode}
        hasHabitsAdded={hasHabitsAdded}
        isEditingHabits={editingHabits}
        memberHabits={memberHabits}
        lockedHabits={lockedHabits}
        expandAllMembersInModal={expandAllMembersInModal}
        collapseAllMembersInModal={collapseAllMembersInModal}
        group={group}
        collapsedMembersInModal={collapsedMembersInModal}
        lockedChallengeMemberIds={lockedChallengeMemberIds}
        toggleMemberCollapseInModal={toggleMemberCollapseInModal}
        setMemberHabits={setMemberHabits}
        newChallenge={newChallenge}
        goBackToEditing={goBackToEditing}
        challengeHandleCreateChallenge={challengeHandleCreateChallenge}
        habitPresets={habitPresets}
        challengeHandleLoadPreset={challengeHandleLoadPreset}
        setNewChallenge={setNewChallenge}
        getDateString={getDateString}
        groupCourses={groupCourses}
        currentHabit={currentHabit}
        setCurrentHabit={setCurrentHabit}
        schoolProfileMap={schoolProfileMap}
        challengeIsChallengeValid={challengeIsChallengeValid}
        challengeGetMissingMembers={challengeGetMissingMembers}
        handleCancel={handleCancel}
        lockHabitsAndShowOverview={lockHabitsAndShowOverview}
      />

      <GroupDetailOverlays
        pageToast={pageToast}
        clearPageToast={clearPageToast}
        showCancelConfirm={showCancelConfirm}
        memberHabits={memberHabits}
        setShowCancelConfirm={setShowCancelConfirm}
        confirmCancel={confirmCancel}
        showDeleteChallengeConfirm={showDeleteChallengeConfirm}
        setShowDeleteChallengeConfirm={setShowDeleteChallengeConfirm}
        challengeDeleteActiveChallenge={challengeDeleteActiveChallenge}
        confirmDialog={confirmDialog}
        clearConfirmation={clearConfirmation}
        showAddMembersToChallengeModal={showAddMembersToChallengeModal}
        group={group}
        membersNotInChallenge={membersNotInChallenge}
        addMembersToChallengeSelected={addMembersToChallengeSelected}
        challengeToggleAddMemberToChallenge={challengeToggleAddMemberToChallenge}
        setShowAddMembersToChallengeModal={setShowAddMembersToChallengeModal}
        setAddMembersToChallengeSelected={setAddMembersToChallengeSelected}
        challengeHandleAddMembersToChallenge={challengeHandleAddMembersToChallenge}
        addMembersToChallengeSubmitting={addMembersToChallengeSubmitting}
      />

      {activeTab === 'archives' && (
        <ArchivePanel archivesLoading={archivesLoading} archives={archives} />
      )}

      <HabitPresetsPanel
        activeTab={activeTab}
        isLeader={isLeader}
        habitPresets={habitPresets}
        group={group}
        onCreatePreset={onCreatePreset}
        onEditPreset={onEditPreset}
        onDeletePreset={onDeletePreset}
        onLoadPreset={onLoadPreset}
      />

      {showPresetModal && (
        <HabitPresetModal
          editingPresetId={editingPresetId}
          onAddPresetHabit={onAddPresetHabit}
          onClose={onClosePresetModal}
          onRemovePresetHabit={onRemovePresetHabit}
          onSavePreset={onSavePreset}
          onUpdatePresetHabit={onUpdatePresetHabit}
          presetFormData={presetFormData}
          setPresetFormData={setPresetFormData}
        />
      )}
    </>
  );
}

export default GroupDetailWorkspace;
