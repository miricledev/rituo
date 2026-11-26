import io from 'socket.io-client';

class ChatService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
    this.connectionPromise = null;
    this.connectionToken = null;
    this.activeGroupChats = new Map();
    this.activeDirectMessages = new Map();
    this.apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.triggerHandler('connection_state', { connected: false, status: 'unauthorized' });
      return Promise.resolve(false);
    }

    if (this.socket && this.connectionToken !== token) {
      this.disconnect();
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 
                  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');

    if (!this.socket) {
      this.connectionToken = token;
      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        autoConnect: false,
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 700,
        reconnectionDelayMax: 5000,
        timeout: 10000
      });
      this.setupMessageHandlers();
    } else {
      this.socket.auth = { token };
    }

    if (this.socket.connected) {
      this.isConnected = true;
      return Promise.resolve(true);
    }

    if (this.connectionPromise) return this.connectionPromise;

    this.triggerHandler('connection_state', { connected: false, status: 'connecting' });
    this.connectionPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (connected) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.socket?.off('connect', handleConnect);
        this.socket?.off('connect_error', handleConnectError);
        this.connectionPromise = null;
        resolve(connected);
      };
      const handleConnect = () => finish(true);
      const handleConnectError = () => finish(false);
      const timeoutId = setTimeout(() => finish(false), 12000);
      this.socket.once('connect', handleConnect);
      this.socket.once('connect_error', handleConnectError);
      this.socket.connect();
    });

    return this.connectionPromise;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionPromise = null;
      this.connectionToken = null;
      this.activeGroupChats.clear();
      this.activeDirectMessages.clear();
    }
  }

  setupMessageHandlers() {
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.triggerHandler('connection_state', { connected: true, status: 'connected' });
      this.activeGroupChats.forEach((payload) => this.socket.emit('join_group_chat', payload));
      this.activeDirectMessages.forEach((payload) => this.socket.emit('join_dm', payload));
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.triggerHandler('connection_state', { connected: false, status: 'reconnecting', reason });
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      this.triggerHandler('connection_state', {
        connected: false,
        status: 'offline',
        message: error?.message || 'Chat connection failed'
      });
    });

    this.socket.on('joined_group_chat', (data) => {
      this.triggerHandler('joined_group_chat', data);
    });

    this.socket.on('left_group_chat', (data) => {
      this.triggerHandler('left_group_chat', data);
    });

    this.socket.on('receive_group_message', (message) => {
      this.triggerHandler('receive_group_message', message);
    });

    this.socket.on('group_presence', (data) => {
      this.triggerHandler('group_presence', data);
    });

    this.socket.on('group_typing', (data) => {
      this.triggerHandler('group_typing', data);
    });

    this.socket.on('group_messages_read', (data) => {
      this.triggerHandler('group_messages_read', data);
    });

    this.socket.on('joined_dm', (data) => {
      this.triggerHandler('joined_dm', data);
    });

    this.socket.on('left_dm', (data) => {
      this.triggerHandler('left_dm', data);
    });

    this.socket.on('receive_dm', (message) => {
      this.triggerHandler('receive_dm', message);
    });

    this.socket.on('error', (error) => {
      console.error('Chat error:', error);
      this.triggerHandler('error', error);
    });
  }

  joinGroupChat(groupId, userId, classId = null) {
    const key = this.getGroupChatKey(groupId, classId);
    const payload = { group_id: groupId, class_id: classId };
    this.activeGroupChats.set(key, payload);
    if (this.socket?.connected) {
      this.socket.emit('join_group_chat', payload);
    } else {
      this.connect();
    }
  }

  leaveGroupChat(groupId, classId = null) {
    this.activeGroupChats.delete(this.getGroupChatKey(groupId, classId));
    if (this.socket?.connected) {
      this.socket.emit('leave_group_chat', { group_id: groupId, class_id: classId });
    }
  }

  async sendGroupMessage(groupId, userId, content, classId = null) {
    const connected = this.socket?.connected || await this.connect();
    if (!connected || !this.socket) {
      return { ok: false, error: 'Chat is offline. Reconnecting now.' };
    }

    return new Promise((resolve) => {
      this.socket.timeout(10000).emit('send_group_message', {
        group_id: groupId,
        content,
        class_id: classId
      }, (error, response) => {
        if (error) {
          resolve({ ok: false, error: 'Message timed out. Please try again.' });
          return;
        }
        resolve(response || { ok: true });
      });
    });
  }

  setGroupTyping(groupId, classId = null, isTyping = false) {
    if (!this.socket?.connected) return;
    this.socket.emit('group_typing', {
      group_id: groupId,
      class_id: classId,
      is_typing: Boolean(isTyping)
    });
  }

  async markGroupMessagesRead(groupId, classId = null, messageIds = []) {
    const connected = this.socket?.connected || await this.connect();
    if (!connected || !this.socket) return { ok: false };

    return new Promise((resolve) => {
      this.socket.timeout(8000).emit('mark_group_messages_read', {
        group_id: groupId,
        class_id: classId,
        message_ids: messageIds
      }, (error, response) => resolve(error ? { ok: false } : (response || { ok: true })));
    });
  }

  joinDM(groupId, userId, targetUserId) {
    const key = `${groupId}:${targetUserId}`;
    const payload = {
      group_id: groupId,
      user_id: userId,
      target_user_id: targetUserId
    };
    this.activeDirectMessages.set(key, payload);
    if (this.socket?.connected) {
      this.socket.emit('join_dm', payload);
    } else {
      this.connect();
    }
  }

  leaveDM(groupId, userId, targetUserId) {
    this.activeDirectMessages.delete(`${groupId}:${targetUserId}`);
    if (this.socket?.connected) {
      this.socket.emit('leave_dm', {
        group_id: groupId,
        user_id: userId,
        target_user_id: targetUserId
      });
    }
  }

  // Send DM
  sendDM(groupId, userId, targetUserId, content) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('send_dm', {
      group_id: groupId,
      user_id: userId,
      target_user_id: targetUserId,
      content: content
    });
  }

  getGroupChatKey(groupId, classId = null) {
    return `${groupId}:${classId ?? 'group'}`;
  }

  getConnectionState() {
    return {
      connected: Boolean(this.socket?.connected),
      status: this.socket?.connected ? 'connected' : (this.socket ? 'connecting' : 'offline')
    };
  }

  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  triggerHandler(event, data) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  // API calls for fetching message history
  async getGroupChatMessages(groupId, classId = null) {
    try {
      const params = new URLSearchParams();
      if (classId !== null && classId !== undefined && classId !== '') {
        params.set('classId', classId);
      }
      const url = `${this.apiBaseUrl}/groups/${groupId}/chat${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch group chat messages');
      const data = await response.json();
      if (Array.isArray(data)) {
        return { messages: data, channel: null };
      }
      return {
        messages: data.messages || [],
        channel: data.channel || null
      };
    } catch (error) {
      console.error('Error fetching group chat messages:', error);
      throw error;
    }
  }

  async getDMMessages(groupId, userId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/groups/${groupId}/dm/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch DM messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching DM messages:', error);
      throw error;
    }
  }

  // Get inbox messages
  async getInbox() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/groups/inbox`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch inbox messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching inbox messages:', error);
      throw error;
    }
  }

  // Get unread message count
  async getUnreadCount() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/groups/inbox/unread-count`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch unread count');
      const data = await response.json();
      return data.unread_count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  // Mark message as read
  async markMessageRead(messageId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/groups/messages/${messageId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to mark message as read');
      return await response.json();
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  // Mark all group chat messages as read
  async markAllGroupChatRead(groupId, classId = null) {
    try {
      const params = new URLSearchParams();
      if (classId !== null && classId !== undefined && classId !== '') {
        params.set('classId', classId);
      }
      const url = `${this.apiBaseUrl}/groups/${groupId}/chat/mark-all-read${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to mark all group chat messages as read');
      return await response.json();
    } catch (error) {
      console.error('Error marking all group chat messages as read:', error);
      throw error;
    }
  }

  // Mark all DM messages as read
  async markAllDMRead(groupId, userId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/groups/${groupId}/dm/${userId}/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to mark all DM messages as read');
      return await response.json();
    } catch (error) {
      console.error('Error marking all DM messages as read:', error);
      throw error;
    }
  }
}

// Create singleton instance
const chatService = new ChatService();
export default chatService;
