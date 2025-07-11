import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import chatService from '../services/chat.js';

const Inbox = () => {
  const [inboxMessages, setInboxMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch inbox messages and unread count
  const fetchInbox = async () => {
    try {
      setLoading(true);
      const [messages, count] = await Promise.all([
        chatService.getInbox(),
        chatService.getUnreadCount()
      ]);
      setInboxMessages(messages);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark message as read and navigate to the appropriate chat
  const handleMessageClick = async (message) => {
    try {
      await chatService.markMessageRead(message.id);
      
      // Navigate to the appropriate chat
      if (message.type === 'group_chat') {
        navigate(`/groups/${message.group_id}?tab=chat`);
      } else if (message.type === 'dm') {
        navigate(`/groups/${message.group_id}?tab=dm&user=${message.sender_id}`);
      }
      
      // Refresh inbox
      fetchInbox();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Truncate message content
  const truncateContent = (content, maxLength = 50) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  useEffect(() => {
    fetchInbox();
    window.refreshInboxUnreadCount = fetchInbox;
    
    // Set up periodic refresh
    const interval = setInterval(fetchInbox, 30000); // Refresh every 30 seconds
    
    return () => {
      clearInterval(interval);
      window.refreshInboxUnreadCount = undefined;
    };
  }, []);

  return (
    <div className="relative">
      {/* Inbox Button with Notification Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        
        {/* Notification Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Inbox Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Inbox</h3>
            <p className="text-sm text-gray-400">
              {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : 'No unread messages'}
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2">Loading messages...</p>
              </div>
            ) : inboxMessages.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>No unread messages</p>
              </div>
            ) : (
              inboxMessages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className="p-4 border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {message.message_type === 'system' ? (
                          <>
                            <span className="text-sm font-medium text-orange-300">
                              System
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-orange-500 text-white">
                              System
                            </span>
                            <span className="text-xs text-gray-400">
                              in {message.group_name}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-white">
                              {message.sender_username || 'Unknown User'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              message.type === 'group_chat' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-purple-500 text-white'
                            }`}>
                              {message.type === 'group_chat' ? 'Group' : 'DM'}
                            </span>
                            <span className="text-xs text-gray-400">
                              in {message.group_name}
                            </span>
                          </>
                        )}
                      </div>
                      <p className={`text-sm mb-1 ${
                        message.message_type === 'system' 
                          ? 'text-orange-200' 
                          : 'text-gray-300'
                      }`}>
                        {truncateContent(message.content)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                    <div className="ml-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {inboxMessages.length > 0 && (
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/groups');
                }}
                className="w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                View All Groups
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default Inbox; 