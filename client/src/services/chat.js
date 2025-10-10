import io from 'socket.io-client';

class ChatService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
    // Get API base URL from environment
    this.apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  }

  // Connect to WebSocket server
  connect() {
    if (this.socket && this.isConnected) return;

    // Get WebSocket URL from environment or fallback to localhost
    const wsUrl = import.meta.env.VITE_WS_URL || 
                  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to chat server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
      this.isConnected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Chat server error:', error);
    });

    // Set up message handlers
    this.setupMessageHandlers();
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Set up event handlers for incoming messages
  setupMessageHandlers() {
    // Group chat events
    this.socket.on('joined_group_chat', (data) => {
      console.log('Joined group chat:', data);
      this.triggerHandler('joined_group_chat', data);
    });

    this.socket.on('left_group_chat', (data) => {
      console.log('Left group chat:', data);
      this.triggerHandler('left_group_chat', data);
    });

    this.socket.on('receive_group_message', (message) => {
      console.log('Received group message:', message);
      this.triggerHandler('receive_group_message', message);
    });

    // DM events
    this.socket.on('joined_dm', (data) => {
      console.log('Joined DM:', data);
      this.triggerHandler('joined_dm', data);
    });

    this.socket.on('left_dm', (data) => {
      console.log('Left DM:', data);
      this.triggerHandler('left_dm', data);
    });

    this.socket.on('receive_dm', (message) => {
      console.log('Received DM:', message);
      this.triggerHandler('receive_dm', message);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Chat error:', error);
      this.triggerHandler('error', error);
    });
  }

  // Join group chat
  joinGroupChat(groupId, userId) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('join_group_chat', { group_id: groupId, user_id: userId });
  }

  // Leave group chat
  leaveGroupChat(groupId) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('leave_group_chat', { group_id: groupId });
  }

  // Send group chat message
  sendGroupMessage(groupId, userId, content) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('send_group_message', {
      group_id: groupId,
      user_id: userId,
      content: content
    });
  }

  // Join DM
  joinDM(groupId, userId, targetUserId) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('join_dm', {
      group_id: groupId,
      user_id: userId,
      target_user_id: targetUserId
    });
  }

  // Leave DM
  leaveDM(groupId, userId, targetUserId) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('leave_dm', {
      group_id: groupId,
      user_id: userId,
      target_user_id: targetUserId
    });
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

  // Register event handlers
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event).push(handler);
  }

  // Remove event handlers
  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Trigger event handlers
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
  async getGroupChatMessages(groupId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/groups/${groupId}/chat`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch group chat messages');
      return await response.json();
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
  async markAllGroupChatRead(groupId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/groups/${groupId}/chat/mark-all-read`, {
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