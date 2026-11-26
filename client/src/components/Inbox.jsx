import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiCheck,
  FiChevronRight,
  FiInbox,
  FiMessageCircle,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUsers,
  FiX
} from 'react-icons/fi';
import chatService from '../services/chat.js';
import { HOMEWORK_ENABLED } from '../config/features';

const filterOptions = [
  { value: 'all', label: 'All', icon: FiInbox },
  { value: 'system', label: 'System', icon: FiShield },
  { value: 'group', label: 'Groups', icon: FiUsers },
  { value: 'dm', label: 'Messages', icon: FiMessageCircle }
];

const isHomeworkMessage = (message) => {
  const content = (message.content || '').toLowerCase();
  return (
    content.startsWith('homework set:') ||
    content.includes('submitted homework:') ||
    content.startsWith('homework reviewed:') ||
    content.startsWith('homework reminder sent:')
  );
};

const getInboxTone = (message) => {
  const content = (message.content || '').toLowerCase();
  if (message.category === 'system') {
    return {
      pill: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
      icon: 'bg-amber-400/15 text-amber-200 ring-amber-300/20',
      glow: 'from-amber-400/15 to-transparent'
    };
  }
  if (content.startsWith('homework set:')) {
    return {
      pill: 'border-blue-300/20 bg-blue-300/10 text-blue-200',
      icon: 'bg-blue-400/15 text-blue-200 ring-blue-300/20',
      glow: 'from-blue-400/15 to-transparent'
    };
  }
  if (content.includes('submitted homework:')) {
    return {
      pill: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
      icon: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/20',
      glow: 'from-emerald-400/15 to-transparent'
    };
  }
  if (content.startsWith('homework reviewed:')) {
    return {
      pill: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
      icon: 'bg-violet-400/15 text-violet-200 ring-violet-300/20',
      glow: 'from-violet-400/15 to-transparent'
    };
  }
  if (content.startsWith('homework reminder sent:')) {
    return {
      pill: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
      icon: 'bg-amber-400/15 text-amber-200 ring-amber-300/20',
      glow: 'from-amber-400/15 to-transparent'
    };
  }
  if (message.category === 'group') {
    return {
      pill: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
      icon: 'bg-cyan-400/15 text-cyan-200 ring-cyan-300/20',
      glow: 'from-cyan-400/15 to-transparent'
    };
  }
  return {
    pill: 'border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200',
    icon: 'bg-fuchsia-400/15 text-fuchsia-200 ring-fuchsia-300/20',
    glow: 'from-fuchsia-400/15 to-transparent'
  };
};

const getCategoryDetails = (message) => {
  if (message.category === 'system') return { label: 'System', icon: FiShield };
  if (message.category === 'group') return { label: 'Group', icon: FiUsers };
  return { label: 'Message', icon: FiMessageCircle };
};

const formatTime = (timestamp) => {
  const messageDate = new Date(timestamp);
  if (Number.isNaN(messageDate.getTime())) return '';
  const now = new Date();
  const differenceMs = Math.max(0, now - messageDate);
  const differenceHours = differenceMs / (1000 * 60 * 60);
  if (differenceHours < 1) {
    return `${Math.max(1, Math.floor(differenceMs / (1000 * 60)))}m ago`;
  }
  if (differenceHours < 24) {
    return `${Math.floor(differenceHours)}h ago`;
  }
  return messageDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const Inbox = () => {
  const [inboxMessages, setInboxMessages] = useState([]);
  const [counts, setCounts] = useState({ all: 0, system: 0, group: 0, dm: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchUpdating, setBatchUpdating] = useState(false);
  const navigate = useNavigate();

  const fetchInbox = async ({ showLoading = false } = {}) => {
    try {
      if (showLoading) setLoading(true);
      setLoadError('');
      const [inboxResponse, count] = await Promise.all([
        chatService.getInbox(),
        chatService.getUnreadCount()
      ]);
      const messages = (inboxResponse?.messages || []).filter(
        (message) => HOMEWORK_ENABLED || !isHomeworkMessage(message)
      );
      setInboxMessages(messages);
      setCounts({
        all: messages.length,
        system: messages.filter((item) => item.category === 'system').length,
        group: messages.filter((item) => item.category === 'group').length,
        dm: messages.filter((item) => item.category === 'dm').length
      });
      setUnreadCount(HOMEWORK_ENABLED ? count : messages.filter((message) => message.unread).length);
    } catch (_error) {
      setLoadError('Notifications could not be refreshed. Check your connection and try again.');
    } finally {
      if (showLoading) setLoading(false);
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
      if (activeFilter !== 'all' && message.category !== activeFilter) return false;
      if (scopeFilter === 'class-only' && !message.class_id) return false;
      if (scopeFilter !== 'all' && scopeFilter !== 'class-only' && String(message.class_id || '') !== scopeFilter) return false;
      if (!normalizedQuery) return true;
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

  const openInbox = () => {
    setIsOpen(true);
    fetchInbox({ showLoading: inboxMessages.length === 0 });
  };

  useEffect(() => {
    fetchInbox({ showLoading: true });
    window.refreshInboxUnreadCount = fetchInbox;
    const interval = setInterval(fetchInbox, 30000);
    return () => {
      clearInterval(interval);
      window.refreshInboxUnreadCount = undefined;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={isOpen ? () => setIsOpen(false) : openInbox}
        className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 shadow-sm transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
        aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
        aria-expanded={isOpen}
        aria-controls="notification-centre"
      >
        <FiBell className="h-5 w-5 transition-transform group-hover:-rotate-6" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-slate-950 bg-gradient-to-r from-rose-500 to-orange-400 px-1 text-[10px] font-black leading-none text-white shadow-lg shadow-rose-500/20">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-stretch justify-center overflow-hidden bg-slate-950/80 backdrop-blur-md sm:p-5 lg:justify-end lg:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            id="notification-centre"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-centre-title"
            className="relative flex h-full max-h-full w-full flex-col overflow-hidden bg-[#07101f] text-white shadow-2xl shadow-black/50 sm:max-w-2xl sm:rounded-[2rem] sm:border sm:border-white/10 lg:max-w-[38rem]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_48%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_45%)]" />

            <header className="relative z-30 shrink-0 border-b border-white/10 bg-[#07101f]/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 sm:pb-5 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-slate-950 shadow-lg shadow-cyan-500/20 sm:h-14 sm:w-14">
                    <FiBell className="h-6 w-6" />
                    {unreadCount > 0 ? <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#07101f] bg-rose-400" /> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/80">IP command feed</p>
                    <h2 id="notification-centre-title" className="truncate text-xl font-black tracking-tight sm:text-2xl">Notification centre</h2>
                    <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
                      {unreadCount > 0 ? `${unreadCount} update${unreadCount === 1 ? '' : 's'} waiting for you` : 'You are fully caught up'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
                  aria-label="Close notifications"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="relative shrink-0 border-b border-white/10 bg-slate-950/20 px-4 py-3 sm:px-6 sm:py-4">
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
                {filterOptions.map((option) => {
                  const FilterIcon = option.icon;
                  const selected = activeFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setActiveFilter(option.value)}
                      className={`flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-300/60 sm:w-full ${selected ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100 shadow-inner shadow-cyan-300/5' : 'border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/10 hover:text-white'}`}
                      aria-pressed={selected}
                    >
                      <FilterIcon className="h-3.5 w-3.5" />
                      <span>{option.label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selected ? 'bg-cyan-200/15 text-cyan-100' : 'bg-white/5 text-slate-500'}`}>{counts[option.value] ?? 0}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <label className="relative block">
                  <span className="sr-only">Search notifications</span>
                  <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search notifications"
                    className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 py-2 pl-10 pr-10 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
                  />
                  {searchQuery ? (
                    <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Clear notification search">
                      <FiX className="h-4 w-4" />
                    </button>
                  ) : null}
                </label>
                <label>
                  <span className="sr-only">Filter notifications by class</span>
                  <select
                    value={scopeFilter}
                    onChange={(event) => setScopeFilter(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm font-semibold text-slate-200 outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
                  >
                    <option value="all">All workspaces</option>
                    <option value="class-only">Class updates only</option>
                    {availableClassScopes.map((scope) => (
                      <option key={scope.id} value={scope.id}>{scope.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[11px] font-bold text-slate-500 sm:text-xs">
                  {filteredMessages.length} shown{visibleUnreadMessages.length > 0 ? ` \u00b7 ${visibleUnreadMessages.length} unread` : ''}
                </p>
                <button
                  type="button"
                  onClick={handleMarkVisibleRead}
                  disabled={!visibleUnreadMessages.length || batchUpdating}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px] font-black text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35 sm:text-xs"
                >
                  {batchUpdating ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiCheck className="h-3.5 w-3.5" />}
                  <span>{batchUpdating ? 'Marking…' : 'Mark visible read'}</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
              {loadError ? (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-rose-300/15 bg-rose-400/10 p-3 text-sm text-rose-100">
                  <p className="leading-5">{loadError}</p>
                  <button type="button" onClick={() => fetchInbox({ showLoading: inboxMessages.length === 0 })} className="shrink-0 rounded-lg border border-rose-200/20 px-2.5 py-1.5 text-xs font-black hover:bg-rose-200/10">Retry</button>
                </div>
              ) : null}

              {loading ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-400">
                  <div className="relative h-12 w-12">
                    <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-300" />
                    <FiBell className="absolute inset-0 m-auto h-5 w-5 text-cyan-200" />
                  </div>
                  <p className="mt-4 text-sm font-bold">Checking your command feed…</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-slate-500">
                    <FiInbox className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white">Nothing in this view</h3>
                  <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">Try another filter or search. New updates will appear here automatically.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredMessages.map((message) => {
                    const tone = getInboxTone(message);
                    const category = getCategoryDetails(message);
                    const CategoryIcon = category.icon;
                    const sender = message.sender_username || (message.category === 'system' ? 'Inner Performance' : 'Unknown sender');
                    const channelLabel = message.class_name
                      ? `${message.group_name || 'Workspace'} \u00b7 ${message.class_name}`
                      : message.group_name || 'Inner Performance';
                    return (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => handleMessageClick(message)}
                        className={`group relative w-full overflow-hidden rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-300/60 sm:p-4 ${message.unread ? 'border-white/15 bg-white/[0.075] shadow-lg shadow-black/10 hover:border-cyan-300/25 hover:bg-white/10' : 'border-white/[0.07] bg-white/[0.025] opacity-80 hover:opacity-100'}`}
                      >
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${tone.glow} opacity-0 transition-opacity group-hover:opacity-100`} />
                        <div className="relative flex items-start gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 sm:h-11 sm:w-11 ${tone.icon}`}>
                            <CategoryIcon className="h-[18px] w-[18px]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <span className={`truncate text-sm ${message.unread ? 'font-black text-white' : 'font-bold text-slate-300'}`}>{sender}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider sm:text-[10px] ${tone.pill}`}>{category.label}</span>
                                </div>
                                <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:text-[11px]">{channelLabel}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-600 sm:text-xs">{formatTime(message.created_at)}</span>
                                {message.unread ? <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.75)]" /> : null}
                              </div>
                            </div>
                            <p className={`mt-2 line-clamp-3 text-sm leading-5 sm:line-clamp-2 ${message.unread ? 'text-slate-200' : 'text-slate-500'}`}>{message.content}</p>
                          </div>
                          <FiChevronRight className="mt-4 hidden h-4 w-4 shrink-0 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-300 sm:block" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-slate-950/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/groups');
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Open my workspaces
                <FiChevronRight className="h-4 w-4" />
              </button>
            </footer>
          </section>
        </div>,
        document.body
      ) : null}
    </div>
  );
};

export default Inbox;
