import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiMessageCircle,
  FiSend,
  FiUsers,
  FiWifi,
  FiWifiOff
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import chatService from '../services/chat';
import { HOMEWORK_ENABLED } from '../config/features';

const parseReadBy = (value) => {
  if (Array.isArray(value)) return value.map((userId) => Number(userId)).filter(Number.isFinite);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((userId) => Number(userId)).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
};

const normalizeMessage = (message) => ({
  id: message.id,
  senderId: message.senderId ?? message.sender_id ?? null,
  senderUsername: message.senderUsername ?? message.sender_username ?? null,
  recipientId: message.recipientId ?? message.recipient_id ?? null,
  classId: message.classId ?? message.class_id ?? null,
  className: message.className ?? message.class_name ?? null,
  content: message.content ?? '',
  createdAt: message.createdAt ?? message.created_at ?? null,
  readBy: parseReadBy(message.readBy ?? message.read_by),
  messageType: message.messageType ?? message.message_type ?? 'user'
});

const mergeMessages = (...collections) => {
  const merged = new Map();
  collections.flat().forEach((rawMessage) => {
    if (!rawMessage?.id) return;
    const message = normalizeMessage(rawMessage);
    const existing = merged.get(String(message.id));
    merged.set(String(message.id), existing ? {
      ...existing,
      ...message,
      readBy: [...new Set([...(existing.readBy || []), ...(message.readBy || [])])]
    } : message);
  });
  return [...merged.values()].sort((left, right) => {
    const timeDifference = new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
    return timeDifference || Number(left.id) - Number(right.id);
  });
};

const sameChannel = (left, right) => String(left ?? 'group') === String(right ?? 'group');

const initialsFor = (username = 'IP') => username
  .split(/[\s._-]+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || 'IP';

const getSystemMessageMeta = (message) => {
  const content = (message.content || '').toLowerCase();
  if (content.startsWith('homework set:')) {
    return {
      label: 'Homework set',
      containerClassName: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100',
      badgeClassName: 'bg-blue-600 text-white'
    };
  }
  if (content.includes('submitted homework:')) {
    return {
      label: 'Submission',
      containerClassName: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100',
      badgeClassName: 'bg-emerald-600 text-white'
    };
  }
  if (content.startsWith('homework reviewed:')) {
    return {
      label: 'Review',
      containerClassName: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-100',
      badgeClassName: 'bg-violet-600 text-white'
    };
  }
  if (content.startsWith('homework reminder sent:')) {
    return {
      label: 'Reminder',
      containerClassName: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100',
      badgeClassName: 'bg-amber-600 text-white'
    };
  }
  return {
    label: 'IP update',
    containerClassName: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-100',
    badgeClassName: 'bg-fuchsia-600 text-white'
  };
};

const isHomeworkActivityMessage = (message) => {
  const content = (message.content || '').toLowerCase();
  return message.messageType === 'system' && (
    content.startsWith('homework set:') ||
    content.includes('submitted homework:') ||
    content.startsWith('homework reviewed:') ||
    content.startsWith('homework reminder sent:')
  );
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (timestamp) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
};

function GroupChat({
  groupId,
  groupName,
  isSchoolGroup = false,
  chatTitle,
  selectedClassId = null,
  onSelectClassId = null,
  showChannelPicker = true,
  onChannelChange = null
}) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(chatService.getConnectionState().status);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [channel, setChannel] = useState(null);
  const [messageView, setMessageView] = useState('all');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [readers, setReaders] = useState({});
  const messagesEndRef = useRef(null);
  const activeRoomRef = useRef(null);
  const messagesRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const remoteTypingTimeoutsRef = useRef(new Map());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' });
  }, [messages, typingUsers, loading]);

  useEffect(() => {
    if (onChannelChange) onChannelChange(channel);
  }, [channel, onChannelChange]);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setReaders({});
    setOnlineUsers([]);
    setTypingUsers([]);
    setJoinedRoom(false);
    setSendError('');
    activeRoomRef.current = null;

    const handleConnectionState = ({ status }) => {
      if (!active) return;
      setConnectionStatus(status);
      if (status !== 'connected') setJoinedRoom(false);
    };

    const handleJoinedChat = (data) => {
      if (!active || String(data?.group_id) !== String(groupId)) return;
      if (!sameChannel(data?.channel?.classId, selectedClassId)) return;
      activeRoomRef.current = data.room;
      setJoinedRoom(true);
      setConnectionStatus('connected');
      if (data.channel) setChannel(data.channel);
      if (window.refreshInboxUnreadCount) window.refreshInboxUnreadCount();
    };

    const handleReceiveMessage = (rawMessage) => {
      if (!active) return;
      const message = normalizeMessage(rawMessage);
      if (!sameChannel(message.classId, selectedClassId)) return;
      setMessages((previous) => mergeMessages(previous, [message]));
      if (String(message.senderId) !== String(currentUser?.id) && document.visibilityState === 'visible') {
        chatService.markGroupMessagesRead(groupId, selectedClassId, [message.id]);
      }
    };

    const handlePresence = (data) => {
      if (!active || data?.room !== activeRoomRef.current) return;
      setOnlineUsers(data.users || []);
    };

    const handleTyping = (data) => {
      if (!active || data?.room !== activeRoomRef.current || String(data.userId) === String(currentUser?.id)) return;
      const userId = String(data.userId);
      clearTimeout(remoteTypingTimeoutsRef.current.get(userId));
      setTypingUsers((previous) => data.isTyping
        ? [...previous.filter((user) => String(user.userId) !== userId), { userId: data.userId, username: data.username }]
        : previous.filter((user) => String(user.userId) !== userId));
      if (data.isTyping) {
        remoteTypingTimeoutsRef.current.set(userId, setTimeout(() => {
          setTypingUsers((previous) => previous.filter((user) => String(user.userId) !== userId));
          remoteTypingTimeoutsRef.current.delete(userId);
        }, 3500));
      } else {
        remoteTypingTimeoutsRef.current.delete(userId);
      }
    };

    const handleReadReceipt = (data) => {
      if (!active || data?.room !== activeRoomRef.current) return;
      const readMessageIds = new Set((data.messageIds || []).map(String));
      setReaders((previous) => ({
        ...previous,
        [String(data.userId)]: { userId: data.userId, username: data.username }
      }));
      setMessages((previous) => previous.map((message) => readMessageIds.has(String(message.id)) ? {
        ...message,
        readBy: [...new Set([...(message.readBy || []), Number(data.userId)])]
      } : message));
    };

    const handleError = (error) => {
      if (!active) return;
      setSendError(error?.message || 'Chat could not complete that action.');
    };

    chatService.on('connection_state', handleConnectionState);
    chatService.on('joined_group_chat', handleJoinedChat);
    chatService.on('receive_group_message', handleReceiveMessage);
    chatService.on('group_presence', handlePresence);
    chatService.on('group_typing', handleTyping);
    chatService.on('group_messages_read', handleReadReceipt);
    chatService.on('error', handleError);

    const loadChannel = async () => {
      setLoading(true);
      try {
        const response = await chatService.getGroupChatMessages(groupId, selectedClassId);
        if (!active) return;
        setMessages((previous) => mergeMessages(response.messages || [], previous));
        setReaders(response.readers || {});
        setChannel(response.channel || null);
      } catch (error) {
        if (active) setSendError(error?.message || 'Messages could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadChannel();
    if (currentUser?.id && groupId) {
      chatService.joinGroupChat(groupId, currentUser.id, selectedClassId);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !activeRoomRef.current) return;
      const unreadMessageIds = messagesRef.current
        .filter((message) => String(message.senderId) !== String(currentUser?.id) && !(message.readBy || []).map(String).includes(String(currentUser?.id)))
        .map((message) => message.id);
      if (unreadMessageIds.length) {
        chatService.markGroupMessagesRead(groupId, selectedClassId, unreadMessageIds);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      clearTimeout(typingTimeoutRef.current);
      remoteTypingTimeoutsRef.current.forEach(clearTimeout);
      remoteTypingTimeoutsRef.current.clear();
      chatService.setGroupTyping(groupId, selectedClassId, false);
      chatService.off('connection_state', handleConnectionState);
      chatService.off('joined_group_chat', handleJoinedChat);
      chatService.off('receive_group_message', handleReceiveMessage);
      chatService.off('group_presence', handlePresence);
      chatService.off('group_typing', handleTyping);
      chatService.off('group_messages_read', handleReadReceipt);
      chatService.off('error', handleError);
      chatService.leaveGroupChat(groupId, selectedClassId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [groupId, currentUser?.id, selectedClassId]);

  const availableMessages = useMemo(() => HOMEWORK_ENABLED
    ? messages
    : messages.filter((message) => !isHomeworkActivityMessage(message)), [messages]);
  const visibleMessages = useMemo(() => availableMessages.filter((message) => {
    if (messageView === 'activity') return message.messageType === 'system';
    if (messageView === 'discussion') return message.messageType !== 'system';
    return true;
  }), [availableMessages, messageView]);

  const activityMessageCount = availableMessages.filter((message) => message.messageType === 'system').length;
  const discussionMessageCount = availableMessages.length - activityMessageCount;
  const accessibleClasses = channel?.accessibleClasses || [];
  const activeChannelTitle = selectedClassId ? `${channel?.className || 'Class'} chat` : 'School-wide chat';
  const title = isSchoolGroup ? activeChannelTitle : (chatTitle || `${groupName} Chat`);
  const inputPlaceholder = selectedClassId
    ? `Message ${channel?.className || 'this class'}...`
    : `Message ${groupName || 'the group'}...`;
  const live = connectionStatus === 'connected' && joinedRoom;
  const statusLabel = live
    ? 'Live now'
    : connectionStatus === 'connected'
      ? 'Joining channel...'
      : connectionStatus === 'offline' || connectionStatus === 'unauthorized'
        ? 'Offline'
        : 'Reconnecting...';

  const stopTyping = () => {
    clearTimeout(typingTimeoutRef.current);
    chatService.setGroupTyping(groupId, selectedClassId, false);
  };

  const handleComposerChange = (event) => {
    const value = event.target.value.slice(0, 2000);
    setNewMessage(value);
    setSendError('');
    clearTimeout(typingTimeoutRef.current);
    chatService.setGroupTyping(groupId, selectedClassId, Boolean(value.trim()));
    typingTimeoutRef.current = setTimeout(() => chatService.setGroupTyping(groupId, selectedClassId, false), 1400);
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();
    const content = newMessage.trim();
    if (!content || !currentUser || !live || sending) return;
    setSending(true);
    setSendError('');
    stopTyping();
    const response = await chatService.sendGroupMessage(groupId, currentUser.id, content, selectedClassId);
    if (response?.ok) {
      setNewMessage('');
      if (response.message) setMessages((previous) => mergeMessages(previous, [response.message]));
    } else {
      setSendError(response?.error || 'Message was not sent. Please try again.');
    }
    setSending(false);
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event);
    }
  };

  const seenNamesFor = (message) => (message.readBy || [])
    .filter((userId) => String(userId) !== String(message.senderId))
    .map((userId) => readers[String(userId)]?.username || onlineUsers.find((user) => String(user.userId) === String(userId))?.username)
    .filter(Boolean);

  return (
    <section className="relative flex h-[76vh] min-h-[640px] max-h-[900px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_80px_-34px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#070b18]">
      <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-950 px-4 py-5 text-white sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur">
              <FiMessageCircle className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">IP Community</p>
              <h3 className="truncate text-xl font-black tracking-tight sm:text-2xl">{title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold ${live ? 'border-emerald-300/25 bg-emerald-400/15 text-emerald-200' : connectionStatus === 'offline' ? 'border-rose-300/25 bg-rose-400/15 text-rose-200' : 'border-amber-300/25 bg-amber-400/15 text-amber-200'}`}>
                  {live ? <FiWifi /> : connectionStatus === 'offline' ? <FiWifiOff /> : <FiClock className="animate-pulse" />}
                  {statusLabel}
                </span>
                {selectedClassId ? <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 font-bold">Class channel</span> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2.5 backdrop-blur lg:self-auto">
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 4).map((user, index) => (
                <div key={user.userId} title={user.username} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-indigo-950 text-[10px] font-black text-white ${['bg-cyan-500', 'bg-fuchsia-500', 'bg-amber-500', 'bg-violet-500'][index % 4]}`}>
                  {initialsFor(user.username)}
                </div>
              ))}
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-black"><FiUsers /> {onlineUsers.length} here now</p>
              <p className="mt-0.5 max-w-[190px] truncate text-[10px] text-slate-400">{onlineUsers.map((user) => user.username).join(', ') || 'Waiting for the room'}</p>
            </div>
          </div>
        </div>

        {isSchoolGroup && showChannelPicker && onSelectClassId ? (
          <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => onSelectClassId(null)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition ${selectedClassId == null ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/10'}`}>School-wide</button>
            {accessibleClasses.map((schoolClass) => (
              <button key={schoolClass.id} type="button" onClick={() => onSelectClassId(schoolClass.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition ${String(selectedClassId) === String(schoolClass.id) ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/10'}`}>
                {schoolClass.name}{schoolClass.unreadCount ? ` · ${schoolClass.unreadCount}` : ''}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035] sm:px-6">
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All', count: availableMessages.length },
            { key: 'discussion', label: 'Chat', count: discussionMessageCount },
            { key: 'activity', label: 'Updates', count: activityMessageCount }
          ].map((option) => (
            <button key={option.key} type="button" onClick={() => setMessageView(option.key)} className={`rounded-full px-3 py-1.5 text-xs font-black transition ${messageView === option.key ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950' : 'text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-white/10'}`}>
              {option.label} <span className="opacity-60">{option.count}</span>
            </button>
          ))}
        </div>
        <p className="hidden text-xs font-medium text-slate-400 sm:block">Messages update live across every connected device</p>
      </div>

      <div className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.07),_transparent_42%)] px-3 py-5 sm:px-6">
        {loading ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600 dark:border-white/10 dark:border-t-cyan-300" />
              <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">Loading the conversation...</p>
            </div>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="grid h-full place-items-center py-10 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.5rem] bg-gradient-to-br from-cyan-400 to-violet-600 text-white shadow-xl shadow-violet-500/20"><FiMessageCircle className="h-7 w-7" /></div>
              <h4 className="mt-5 text-xl font-black text-slate-950 dark:text-white">Start the conversation</h4>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Share an update, ask a question or celebrate a win. Everyone currently in this channel receives it instantly.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-2">
            {visibleMessages.map((message, index) => {
              const previousMessage = visibleMessages[index - 1];
              const showDate = !previousMessage || new Date(previousMessage.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
              const mine = String(message.senderId) === String(currentUser?.id);
              const systemMeta = message.messageType === 'system' ? getSystemMessageMeta(message) : null;
              const seenNames = mine ? seenNamesFor(message) : [];
              return (
                <React.Fragment key={message.id}>
                  {showDate ? (
                    <div className="flex items-center gap-3 py-4">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:border-white/10 dark:bg-slate-950 dark:text-slate-500">{formatDateLabel(message.createdAt)}</span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                    </div>
                  ) : null}

                  {message.messageType === 'system' ? (
                    <div className="flex justify-center py-2">
                      <div className={`max-w-2xl rounded-2xl border px-4 py-3 text-center shadow-sm ${systemMeta.containerClassName}`}>
                        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${systemMeta.badgeClassName}`}>{systemMeta.label}</span>
                          {message.className ? <span className="rounded-full border border-current/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-70">{message.className}</span> : null}
                        </div>
                        <p className="text-sm font-bold leading-6">{message.content}</p>
                        <p className="mt-1 text-[10px] font-bold opacity-50">{formatTime(message.createdAt)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex items-end gap-2.5 py-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {!mine ? <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 text-[10px] font-black text-white shadow-md">{initialsFor(message.senderUsername)}</div> : null}
                      <div className={`max-w-[82%] sm:max-w-[72%] ${mine ? 'text-right' : 'text-left'}`}>
                        <div className={`mb-1 flex items-center gap-2 px-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">{mine ? 'You' : message.senderUsername}</span>
                          <span className="text-[10px] text-slate-400">{formatTime(message.createdAt)}</span>
                        </div>
                        <div className={`rounded-[1.35rem] px-4 py-3 text-left text-sm leading-6 shadow-sm ${mine ? 'rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-500/15' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/[0.075] dark:text-slate-100'}`}>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                        {mine ? (
                          <p className={`mt-1.5 flex items-center justify-end gap-1 px-1 text-[10px] font-bold ${seenNames.length ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-400'}`}>
                            {seenNames.length ? <FiCheckCircle /> : <FiCheck />}
                            {seenNames.length ? `Seen by ${seenNames.slice(0, 3).join(', ')}${seenNames.length > 3 ? ` +${seenNames.length - 3}` : ''}` : 'Sent'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {typingUsers.length ? (
              <div className="flex items-center gap-2.5 pt-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[10px] font-black text-white">{initialsFor(typingUsers[0].username)}</div>
                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.075]">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: `${dot * 120}ms` }} />)}
                    <span className="ml-2 text-xs font-bold text-slate-500 dark:text-slate-300">{typingUsers.map((user) => user.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#090e1d] sm:p-4">
        {sendError ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{sendError}</div> : null}
        <div className={`flex items-end gap-2 rounded-[1.5rem] border bg-slate-50 p-2 transition focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:bg-white/[0.055] ${live ? 'border-slate-200 dark:border-white/10' : 'border-amber-200 dark:border-amber-400/20'}`}>
          <textarea
            value={newMessage}
            onChange={handleComposerChange}
            onKeyDown={handleComposerKeyDown}
            onBlur={stopTyping}
            placeholder={live ? inputPlaceholder : statusLabel}
            rows={1}
            maxLength={2000}
            disabled={!live || sending}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-wait dark:text-white"
          />
          <button type="submit" disabled={!newMessage.trim() || !live || sending} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0" aria-label="Send message">
            <FiSend className={`h-5 w-5 ${sending ? 'animate-pulse' : ''}`} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between px-2 text-[10px] font-bold text-slate-400">
          <span>{live ? 'Enter to send · Shift + Enter for a new line' : 'Your message will unlock when the live room reconnects'}</span>
          <span>{newMessage.length}/2000</span>
        </div>
      </form>
    </section>
  );
}

export default GroupChat;
