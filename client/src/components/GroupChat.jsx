import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import chatService from '../services/chat';

const GroupChat = ({ groupId, groupName }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Connect to chat service
    chatService.connect();
    setIsConnected(true);
    setJoinedRoom(false);

    // Load existing messages
    loadMessages();

    // Mark all group chat messages as read
    if (currentUser && groupId) {
      chatService.markAllGroupChatRead(groupId).then(() => {
        // Optionally, refresh inbox unread count if you have a method for it
        if (window.refreshInboxUnreadCount) window.refreshInboxUnreadCount();
      }).catch(() => {});
    }

    // Join group chat
    if (currentUser && groupId) {
      chatService.joinGroupChat(groupId, currentUser.id);
    }

    // Set up event handlers
    const handleReceiveMessage = (message) => {
      setMessages(prev => [...prev, message]);
    };

    const handleJoinedChat = (data) => {
      setJoinedRoom(true);
      console.log('Joined group chat:', data);
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
      chatService.leaveGroupChat(groupId);
    };
  }, [groupId, currentUser]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const messageHistory = await chatService.getGroupChatMessages(groupId);
      setMessages(messageHistory);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !joinedRoom) return;
    chatService.sendGroupMessage(groupId, currentUser.id, newMessage.trim());
    setNewMessage('');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
            {groupName} Chat
          </h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected && joinedRoom ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-secondary-500 dark:text-secondary-400">
              {isConnected && joinedRoom ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-secondary-500 dark:text-secondary-400 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.message_type === 'system' ? 'justify-center' : (message.sender_id === currentUser?.id ? 'justify-end' : 'justify-start')}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.message_type === 'system'
                    ? 'bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200'
                    : message.sender_id === currentUser?.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-secondary-700 text-secondary-900 dark:text-white'
                }`}
              >
                {message.message_type === 'system' ? (
                  <div className="text-center">
                    <p className="text-sm font-medium break-words">{message.content}</p>
                    <span className="text-xs opacity-70 block mt-1">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {message.sender_id === currentUser?.id ? 'You' : message.sender_username}
                      </span>
                      <span className="text-xs opacity-70">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm break-words">{message.content}</p>
                  </>
                )}
              </div>
            </div>
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
            placeholder="Type your message..."
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