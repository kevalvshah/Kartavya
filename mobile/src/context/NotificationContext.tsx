/**
 * NotificationContext — global unread count + fresh notification feed.
 * Polls /notifications/poll every 60s (mirrors web AppShell logic).
 * Provides unread count to tab bar badge and fresh list to NotificationBanner.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { notificationsApi } from '../api/notifications';
import type { Notification } from '../api/types';

interface NotificationContextValue {
  unread:       number;
  fresh:        Notification[];
  dismissFresh: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unread:       0,
  fresh:        [],
  dismissFresh: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user }  = useAuth();
  const [unread,  setUnread]  = useState(0);
  const [fresh,   setFresh]   = useState<Notification[]>([]);
  const prevUnread = useRef<number | null>(null);
  const appState   = useRef<AppStateStatus>(AppState.currentState);

  const tick = useCallback(async () => {
    if (!user) return;
    try {
      const { unread: count, fresh: incoming } = await notificationsApi.poll();
      setUnread(count);
      if (prevUnread.current !== null && count > prevUnread.current && incoming.length > 0) {
        setFresh(prev => {
          const existingIds = new Set(prev.map(n => n.notification_id));
          const newOnes = incoming.filter(n => !existingIds.has(n.notification_id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      }
      prevUnread.current = count;
    } catch {
      // Non-fatal — badge stays stale until next tick
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    tick();
    const id = setInterval(tick, 60_000);

    const sub = AppState.addEventListener('change', next => {
      // Re-poll immediately when app comes to foreground
      if (appState.current.match(/inactive|background/) && next === 'active') {
        tick();
      }
      appState.current = next;
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [user, tick]);

  const dismissFresh = useCallback((id: string) => {
    setFresh(prev => prev.filter(n => n.notification_id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ unread, fresh, dismissFresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
