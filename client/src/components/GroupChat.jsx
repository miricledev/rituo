import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import chatService from '../services/chat';

const normalizeMessage = (message) => ({
  id: message.id,
  senderId: message.senderId ?? message.sender_id ?? null,
  senderUsername: message.senderUsername ?? message.sender_username ?? null,
  recipientId: message.recipientId ?? message.recipient_id ?? null,
  classId: message.classId ?? message.class_id ?? null,
  className: message.className ?? message.class_name ?? null,
  content: message.content ?? '',
  createdAt: message.createdAt ?? message.created_at ?? null,
  messageType: message.messageType ?? message.message_type ?? 'user'
});

const getSystemMessageMeta = (message) => {
  const content = (message.content || '').toLowerCase();
  if (content.startsWith('homework set:')) {
    return {
      label: 'Homework set',
      containerClassName: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100',
      badgeClassName: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white'
    };
  }
  if (content.includes('submitted homework:')) {
    return {
      label: 'Submission',
      containerClassName: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100',
      badgeClassName: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white'
    };
  }
  if (content.startsWith('homework reviewed:')) {
    return {
      label: 'Review',
      containerClassName: 'bg-violet-50 border-violet-200 text-violet-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-100',
      badgeClassName: 'bg-violet-600 text-white dark:bg-violet-500 dark:text-white'
    };
  }
  if (content.startsWith('homework reminder sent:')) {
    return {
      label: 'Reminder',
      containerClassName: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100',
      badgeClassName: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-white'
    };
  }
  return {
    label: 'System',
    containerClassName: 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/40 dark:border-orange-700 dark:text-orange-200',
    badgeClassName: 'bg-orange-600 text-white dark:bg-orange-500 dark:text-white'
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

const GroupChat = ({
  groupId,
  groupName,
  isSchoolGroup = false,
  selectedClassId = null,
  onSelectClassId = null,
  showChannelPicker = true,
  onChannelChange = null
}) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState(null);
  const [messageView, setMessageView] = useState('all');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    chatService.connect();
    setIsConnected(true);
    setJoinedRoom(false);

    if (currentUser && groupId) {
      chatService.markAllGroupChatRead(groupId, selectedClassId).then(() => {
        if (window.refreshInboxUnreadCount) window.refreshInboxUnreadCount();
        loadMessages();
      }).catch(() => {});
    } else {
      loadMessages();
    }

    if (currentUser && groupId) {
      chatService.joinGroupChat(groupId, currentUser.id, selectedClassId);
    }

    const handleReceiveMessage = (message) => {
      const normalized = normalizeMessage(message);
      const incomingClassId = normalized.classId ?? null;
      const activeClassId = selectedClassId ?? null;
      if (incomingClassId !== activeClassId) return;
      setMessages((prev) => [...prev, normalized]);
    };

    const handleJoinedChat = (data) => {
      setJoinedRoom(true);
      if (data?.channel) {
        setChannel(data.channel);
      }
    };

    const handleError = (error) => {
      console.error('Chat error:', error);
    };

    chatService.on('receive_group_message', handleReceiveMessage);
    chatService.on('joined_group_chat', handleJoinedChat);
    chatService.on('error', handleError);

    // Cleanup
    return () => {
      chatService.off('receive_group_message', handleReceiveMessage);
      chatService.off('joined_group_chat', handleJoinedChat);
      chatService.off('error', handleError);
      chatService.leaveGroupChat(groupId, selectedClassId);
    };
  }, [groupId, currentUser, selectedClassId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await chatService.getGroupChatMessages(groupId, selectedClassId);
      setMessages((response.messages || []).map(normalizeMessage));
      setChannel(response.channel || null);
      if (onChannelChange) {
        onChannelChange(response.channel || null);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !joinedRoom) return;
    chatService.sendGroupMessage(groupId, currentUser.id, newMessage.trim(), selectedClassId);
    setNewMessage('');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeChannelTitle = selectedClassId
    ? `${channel?.className || 'Class'} chat`
    : 'School-wide chat';
  const accessibleClasses = channel?.accessibleClasses || [];
  const visibleMessages = messages.filter((message) => {
    if (messageView === 'activity') {
      return message.messageType === 'system';
    }
    if (messageView === 'discussion') {
      return message.messageType !== 'system';
    }
    return true;
  });
  const activityMessageCount = messages.filter((message) => message.messageType === 'system').length;
  const discussionMessageCount = messages.filter((message) => message.messageType !== 'system').length;
  const inputPlaceholder = selectedClassId
    ? `Message ${channel?.className || 'this class'}`
    : `Message ${groupName || 'the school'}`;

  useEffect(() => {
    if (onChannelChange) {
      onChannelChange(channel);
    }
  }, [channel, onChannelChange]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-secondary-800 rounded-lg shadow-lg">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-secondary-700">
        <div>
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
            {isSchoolGroup ? activeChannelTitle : `${groupName} Chat`}
          </h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected && joinedRoom ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-secondary-500 dark:text-secondary-400">
              {isConnected && joinedRoom ? 'Connected' : 'Connecting...'}
            </span>
            {selectedClassId && (
              <span className="rounded-full bg-secondary-100 px-2 py-1 text-[11px] font-semibold text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200">
                Class channel
              </span>
            )}
          </div>
        </div>
        {isSchoolGroup && showChannelPicker && onSelectClassId && (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => onSelectClassId(null)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selectedClassId == null
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'border-gray-200 text-secondary-600 hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
              }`}
            >
              School-wide
            </button>
            {accessibleClasses.map((schoolClass) => (
              <button
                key={schoolClass.id}
                type="button"
                onClick={() => onSelectClassId(schoolClass.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  String(selectedClassId) === String(schoolClass.id)
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'border-gray-200 text-secondary-600 hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
                }`}
              >
                {schoolClass.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 px-4 py-3 dark:border-secondary-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: `All (${messages.length})` },
              { key: 'activity', label: `Activity (${activityMessageCount})` },
              { key: 'discussion', label: `Discussion (${discussionMessageCount})` }
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setMessageView(option.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  messageView === option.key
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'border-gray-200 text-secondary-600 hover:border-primary-300 hover:text-primary-700 dark:border-secondary-700 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:text-primary-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            {messageView === 'activity'
              ? 'Homework and system updates only'
              : messageView === 'discussion'
              ? 'Human conversation only'
              : 'Everything in this channel'}
          </p>
        </div>
        {isSchoolGroup ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">School-wide</div>
              <div className="mt-1 text-sm text-secondary-700 dark:text-secondary-200">Use this for announcements, shared wins, and cross-school conversation.</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">Class channels</div>
              <div className="mt-1 text-sm text-secondary-700 dark:text-secondary-200">Use class chat for homework, reminders, and teaching discussion so the whole class sees the same thread.</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 dark:border-secondary-700 dark:bg-secondary-900/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500 dark:text-secondary-400">Direct messages</div>
              <div className="mt-1 text-sm text-secondary-700 dark:text-secondary-200">School groups do not use private student DMs. Keep communication visible in the relevant class channel.</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleMessages.length === 0 ? (
          <div className="py-8">
            <div className="text-center text-secondary-500 dark:text-secondary-400">
              {messageView === 'activity'
                ? 'No activity posts in this channel yet.'
                : messageView === 'discussion'
                ? 'No discussion messages in this channel yet.'
                : selectedClassId
                ? 'No class messages yet. Start the conversation.'
                : 'No messages yet. Start the conversation.'}
            </div>
            {isSchoolGroup ? (
              <div className="mx-auto mt-4 max-w-3xl grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left dark:border-blue-900/40 dark:bg-blue-950/20">
                  <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">Start with context</div>
                  <div className="mt-1 text-sm text-blue-800 dark:text-blue-200">Post the reason for the message first so students know whether this is homework, a reminder, or discussion.</div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-left dark:border-violet-900/40 dark:bg-violet-950/20">
                  <div className="text-sm font-semibold text-violet-900 dark:text-violet-100">Use the right channel</div>
                  <div className="mt-1 text-sm text-violet-800 dark:text-violet-200">{selectedClassId ? 'This class channel is the right place for lesson-specific conversation and homework.' : 'Switch into a class channel when the message is about one teaching group only.'}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Keep it shared</div>
                  <div className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">There are no student DMs in school groups, so reminders and clarifications stay visible to the whole class.</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          visibleMessages.map((message) => (
            (() => {
              const systemMeta = message.messageType === 'system' ? getSystemMessageMeta(message) : null;
              return (
                <div
                  key={message.id}
                  className={`flex ${message.messageType === 'system' ? 'justify-center' : (message.senderId === currentUser?.id ? 'justify-end' : 'justify-start')}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg border ${
                      message.messageType === 'system'
                        ? systemMeta.containerClassName
                        : message.senderId === currentUser?.id
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-200 bg-gray-100 text-secondary-900 dark:border-secondary-700 dark:bg-secondary-700 dark:text-white'
                    }`}
                  >
                    {message.messageType === 'system' ? (
                  <div className="text-center">
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${systemMeta.badgeClassName}`}>
                        {systemMeta.label}
                      </span>
                      {message.className && (
                        <span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] opacity-80">
                          {message.className}
                        </span>
                      )}
                      {isHomeworkActivityMessage(message) && (
                        <span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] opacity-80">
                          Activity
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium break-words">{message.content}</p>
                    <span className="text-xs opacity-70 block mt-1">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {message.senderId === currentUser?.id ? 'You' : message.senderUsername}
                      </span>
                      <span className="text-xs opacity-70">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm break-words">{message.content}</p>
                  </>
                    )}
                  </div>
                </div>
              );
            })()
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-secondary-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={inputPlaceholder}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-secondary-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
            disabled={!isConnected || !joinedRoom}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected || !joinedRoom}
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroupChat;
