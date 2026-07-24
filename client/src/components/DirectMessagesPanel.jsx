import React from 'react';
import DirectMessage from './DirectMessage';

const DirectMessagesPanel = ({
  activeTab,
  isLeader,
  group,
  conversations,
  conversationsLoading,
  filteredConversations,
  searchQuery,
  setSearchQuery,
  selectedDMUser,
  setSelectedDMUser,
  formatRelativeTime
}) => {
  return (
    <>
      {activeTab === 'dms' && isLeader && (
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-secondary-900 dark:text-white">Direct Messages</h2>
              <div className="text-sm text-secondary-500 dark:text-secondary-400">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {conversationsLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredConversations.length > 0 ? (
              <div className="space-y-2 overflow-y-auto h-full pr-2">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedDMUser({ id: conversation.id, username: conversation.username })}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedDMUser?.id === conversation.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800'
                        : 'bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 hover:bg-gray-50 dark:hover:bg-secondary-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-200">
                          {conversation.avatar}
                        </div>
                        {conversation.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white dark:border-gray-800 rounded-full"></div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {conversation.username}
                          </h3>
                          {conversation.timestamp && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                              {formatRelativeTime(conversation.timestamp)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-sm truncate ${
                            conversation.unreadCount > 0
                              ? 'text-gray-900 dark:text-white font-medium'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {conversation.latestMessage}
                          </p>

                          {conversation.unreadCount > 0 && (
                            <div className="flex-shrink-0 ml-2">
                              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">DM</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? `No conversations match "${searchQuery}"`
                    : 'Start a conversation by clicking on a member'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedDMUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-secondary-800 rounded-none sm:rounded-xl shadow-xl w-full max-w-4xl h-full sm:h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-secondary-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-200 to-primary-400 dark:from-primary-900 dark:to-primary-700 flex items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-200">
                  {selectedDMUser.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedDMUser.username}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Direct Message</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDMUser(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-secondary-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <DirectMessage
                groupId={group.groupId}
                targetUserId={selectedDMUser.id}
                targetUsername={selectedDMUser.username}
                isLeader={true}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dm' && !isLeader && (
        <div className="h-96">
          <DirectMessage
            groupId={group.groupId}
            targetUserId={group.leader?.id}
            targetUsername={group.leader?.username}
            isLeader={false}
          />
        </div>
      )}
    </>
  );
};

export default DirectMessagesPanel;
