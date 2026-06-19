import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useChannels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading]   = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await api.get('/channels');
      setChannels(Array.isArray(r.data) ? r.data : []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, 15000); // poll every 15s for unread counts
    return () => clearInterval(id);
  }, [reload]);

  const totalUnread = channels.reduce((s, c) => s + (c.unread_count || 0), 0);
  const markRead = useCallback(async (channelId) => {
    await api.patch(`/channels/${channelId}/read`).catch(() => {});
    setChannels(prev => prev.map(c =>
      c.channel_id === channelId ? { ...c, unread_count: 0 } : c
    ));
  }, []);

  return { channels, loading, reload, totalUnread, markRead };
}
