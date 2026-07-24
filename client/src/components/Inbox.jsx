import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import chatService from '../services/chat.js';

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'system', label: 'System' },
  { value: 'group', label: 'Group' },
  { value: 'dm', label: 'DM' }
];

const getInboxTone = (message) => {
  const content = (message.content || '').toLowerCase();
  if (message.category === 'system') {
    return {
      pill: 'bg-amber-500 text-white',
      text: 'text-amber-200',
      accent: 'border-l-amber-400'
    };
  }
  if (content.startsWith('homework set:')) {
    return {
      pill: 'bg-blue-500 text-white',
      text: 'text-blue-200',
      accent: 'border-l-blue-400'
    };
  }
  if (content.includes('submitted homework:')) {
    return {
      pill: 'bg-emerald-500 text-white',
      text: 'text-emerald-200',
      accent: 'border-l-emerald-400'
    };
  }
  if (content.startsWith('homework reviewed:')) {
    return {
      pill: 'bg-violet-500 text-white',
      text: 'text-violet-200',
      accent: 'border-l-violet-400'
    };
  }
  if (content.startsWith('homework reminder sent:')) {
    return {
      pill: 'bg-amber-500 text-white',
      text: 'text-amber-200',
      accent: 'border-l-amber-400'
    };
  }
  return {
    pill: message.category === 'group' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white',
    text: 'text-gray-300',
    accent: 'border-l-transparent'
  };
};

const Inbox = () => {
  const [inboxMessages, setInboxMessages] = useState([]);
  const [counts, setCounts] = useState({ all: 0, system: 0, group: 0, dm: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchUpdating, setBatchUpdating] = useState(false);
  const navigate = useNavigate();

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const [inboxResponse, count] = await Promise.all([
        chatService.getInbox(),
        chatService.getUnreadCount()
      ]);
      const messages = inboxResponse?.messages || [];
      setInboxMessages(messages);
      setCounts(inboxResponse?.counts || {
        all: messages.length,
        system: messages.filter((item) => item.category === 'system').length,
        group: messages.filter((item) => item.category === 'group').length,
        dm: messages.filter((item) => item.category === 'dm').length
      });
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  };

  const availableClassScopes = useMemo(() => {
    const scopes = new Map();
    inboxMessages.forEach((message) => {
      if (message.class_id && message.class_name) {
        scopes.set(String(message.class_id), message.class_name);
      }
    });
    return Array.from(scopes.entries()).map(([id, name]) => ({ id, name }));
  }, [inboxMessages]);

  const filteredMessages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return inboxMessages.filter((message) => {
      if (activeFilter !== 'all' && message.category !== activeFilter) {
        return false;
      }
      if (scopeFilter === 'class-only' && !message.class_id) {
        return false;
      }
      if (scopeFilter !== 'all' && scopeFilter !== 'class-only' && String(message.class_id || '') !== scopeFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [
        message.sender_username,
        message.group_name,
        message.class_name,
        message.content
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeFilter, inboxMessages, scopeFilter, searchQuery]);

  const visibleUnreadMessages = filteredMessages.filter((message) => message.unread);

  const handleMessageClick = async (message) => {
    try {
      await chatService.markMessageRead(message.id);
      setIsOpen(false);
      navigate(message.deep_link || '/groups');
      fetchInbox();
    } catch (_error) {
      fetchInbox();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    if (diffInHours < 1) {
      return `${Math.max(1, Math.floor((now - date) / (1000 * 60)))}m ago`;
    }
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    }
    return date.toLocaleDateString();
  };

  const truncateContent = (content, maxLength = 72) => {
    if ((content || '').length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  const handleMarkVisibleRead = async () => {
    if (!visibleUnreadMessages.length) return;
    try {
      setBatchUpdating(true);
      await Promise.all(visibleUnreadMessages.map((message) => chatService.markMessageRead(message.id).catch(() => null)));
    } finally {
      setBatchUpdating(false);
      fetchInbox();
    }
  };

  useEffect(() => {
    fetchInbox();
    window.refreshInboxUnreadCount = fetchInbox;
    const interval = setInterval(fetchInbox, 30000);
    return () => {
      clearInterval(interval);
      window.refreshInboxUnreadCount = undefined;
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
        aria-label="Open notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50" onClick={() => setIsOpen(false)}>
          <div className="w-[28rem] max-w-[calc(100vw-2rem)] bg-gray-800 border border-gray-700 rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700 flex justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Notification center</h3>
                <p className="text-sm text-gray-400">{unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up'}</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1" aria-label="Close notifications">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-700 flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActiveFilter(option.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${activeFilter === option.value ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  {option.label} ({counts[option.value] ?? 0})
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-b border-gray-700 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search inbox"
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <select
                  value={scopeFilter}
                  onChange={(event) => setScopeFilter(event.target.value)}
                  className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All scopes</option>
                  <option value="class-only">Class chat only</option>
                  {availableClassScopes.map((scope) => (
                    <option key={scope.id} value={scope.id}>
                      {scope.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                  {filteredMessages.length} visible
                  {visibleUnreadMessages.length > 0 ? ` • ${visibleUnreadMessages.length} unread in view` : ''}
                </p>
                <button
                  type="button"
                  onClick={handleMarkVisibleRead}
                  disabled={!visibleUnreadMessages.length || batchUpdating}
                  className="rounded-full border border-gray-600 px-3 py-1 text-xs font-semibold text-gray-200 transition-colors hover:border-primary-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {batchUpdating ? 'Marking...' : 'Mark Visible Read'}
                </button>
              </div>
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2">Loading notifications...</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <p>No notifications in this view.</p>
                </div>
              ) : (
                filteredMessages.map((message) => (
                  (() => {
                    const tone = getInboxTone(message);
                    const channelLabel = message.class_name
                      ? `${message.group_name} • ${message.class_name}`
                      : message.group_name;
                    return (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => handleMessageClick(message)}
                        className={`w-full border-b border-l-4 border-gray-700 p-4 text-left transition-colors hover:bg-gray-700 ${tone.accent}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {message.sender_username || (message.category === 'system' ? 'System' : 'Unknown')}
                              </span>
                              <span className={`rounded-full px-2 py-1 text-[11px] ${tone.pill}`}>
                                {message.category === 'system' ? 'System' : message.category === 'group' ? 'Group' : 'DM'}
                              </span>
                              {message.class_name && (
                                <span className="rounded-full bg-gray-700 px-2 py-1 text-[11px] text-gray-200">
                                  {message.class_name}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">in {channelLabel}</span>
                            </div>
                            <p className={`text-sm ${tone.text}`}>{truncateContent(message.content)}</p>
                            <p className="mt-1 text-xs text-gray-500">{formatTime(message.created_at)}</p>
                          </div>
                          {message.unread ? <div className="mt-1 h-2 w-2 rounded-full bg-red-500"></div> : null}
                        </div>
                      </button>
                    );
                  })()
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/groups');
                }}
                className="w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Go to groups
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
