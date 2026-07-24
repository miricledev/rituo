import React from 'react';

function GroupWorkspaceShell({
  group,
  isLeader,
  isEditingGroupName,
  newGroupName,
  setNewGroupName,
  handleSaveGroupName,
  handleCancelEditGroupName,
  handleEditGroupName,
  containerIdLabel,
  containerLabel,
  isEditingGroupType,
  newGroupType,
  setNewGroupType,
  handleSaveGroupType,
  handleCancelEditGroupType,
  handleEditGroupType,
  activeTab,
  setActiveTab,
  tabs,
  onOpenChallenge,
  onRemoveChallenge
}) {
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          {isEditingGroupName && isLeader ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="text-2xl sm:text-3xl font-bold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-primary-500"
                autoFocus
              />
              <button onClick={handleSaveGroupName} className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors" title="Save">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button onClick={handleCancelEditGroupName} className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors" title="Cancel">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">{group.name}</h1>
              {isLeader && (
                <button onClick={handleEditGroupName} className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title={`Edit ${containerLabel.toLowerCase()} name`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-all">{containerIdLabel}: {group.groupId}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">{containerLabel} Type:</span>
            {isEditingGroupType && isLeader && !group.activeChallenge ? (
              <>
                <select value={newGroupType} onChange={(e) => setNewGroupType(e.target.value)} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-secondary-800">
                  <option value="school">School</option>
                  <option value="football">Football Group</option>
                </select>
                <button onClick={handleSaveGroupType} className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors" title="Save">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button onClick={handleCancelEditGroupType} className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors" title="Cancel">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                  group.groupType === 'football'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {group.groupType === 'football' ? 'Football Group' : 'School'}
                </span>
                {isLeader && !group.activeChallenge && (
                  <button onClick={handleEditGroupType} className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title={`Edit ${containerLabel.toLowerCase()} type`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {isLeader && group.activeChallenge && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                    (Locked while challenge is active)
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {isLeader && (
          group.activeChallenge ? (
            <button onClick={onRemoveChallenge} className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 w-full sm:w-auto text-sm sm:text-base">
              Remove Challenge
            </button>
          ) : (
            <button onClick={onOpenChallenge} className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 w-full sm:w-auto text-sm sm:text-base">
              Create Challenge
            </button>
          )
        )}
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-secondary-700 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8">
            {tabs.filter((tab) => tab.show).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

export default GroupWorkspaceShell;
