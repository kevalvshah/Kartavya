import { apiClient } from './client';
import type { Channel, Message } from './types';

export const messagingApi = {
  channels: (): Promise<Channel[]> =>
    apiClient.get('/channels').then(r => (Array.isArray(r.data) ? r.data : [])),

  messages: (channelId: string, before?: string): Promise<Message[]> =>
    apiClient.get(`/channels/${channelId}/messages`, {
      params: { ...(before ? { before } : {}), limit: 50 },
    }).then(r => (Array.isArray(r.data) ? r.data : [])),

  replies: (channelId: string, messageId: string): Promise<Message[]> =>
    apiClient.get(`/channels/${channelId}/messages/${messageId}/replies`).then(r =>
      Array.isArray(r.data) ? r.data : []
    ),

  send: (channelId: string, body: string, parentId?: string): Promise<Message> =>
    apiClient.post(`/channels/${channelId}/messages`, {
      body,
      ...(parentId ? { parent_id: parentId } : {}),
    }).then(r => r.data),

  react: (messageId: string, emoji: string) =>
    apiClient.post(`/messages/${messageId}/reactions`, { emoji }).then(r => r.data),

  markRead: (channelId: string) =>
    apiClient.patch(`/channels/${channelId}/read`),

  unreadCount: (): Promise<{ count: number }> =>
    apiClient.get('/messages/unread-count').then(r => r.data),

  startDm: (email: string): Promise<{ channel_id: string; existing: boolean }> =>
    apiClient.post('/channels/dm-by-email', { email }).then(r => r.data),
};
