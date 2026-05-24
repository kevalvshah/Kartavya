import { apiClient } from './client';
import type { Notification, NotifPrefsResponse } from './types';

export const notificationsApi = {
  list:        (params?: { kind?: string }) =>
    apiClient.get<Notification[]>('/notifications', { params }).then(r => r.data),

  unreadCount: () =>
    apiClient.get<{ count: number }>('/notifications/unread_count').then(r => r.data.count),

  markRead:    (ids?: string[]) =>
    apiClient.post('/notifications/mark_read', ids ? { notification_ids: ids } : { mark_all: true })
      .then(r => r.data),

  getPrefs:    () =>
    apiClient.get<NotifPrefsResponse>('/me/notification_prefs').then(r => r.data),

  setPrefs:    (prefs: NotifPrefsResponse) =>
    apiClient.put('/me/notification_prefs', prefs).then(r => r.data),

  registerToken: (platform: string, token: string, device_id: string) =>
    apiClient.post('/me/push_tokens', { platform, token, device_id }).then(r => r.data),

  unregisterToken: (device_id: string) =>
    apiClient.delete(`/me/push_tokens/${device_id}`).then(r => r.data),
};
