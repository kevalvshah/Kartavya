import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export function useMessages(channelId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [hasMore, setHasMore]   = useState(true);
  const pollingRef = useRef(null);

  const load = useCallback(async (before = null) => {
    if (!channelId) return;
    try {
      const params = { limit: 50 };
      if (before) params.before = before;
      const r = await api.get(`/channels/${channelId}/messages`, { params });
      const msgs = Array.isArray(r.data) ? r.data : [];
      if (before) {
        setMessages(prev => [...msgs, ...prev]);
        setHasMore(msgs.length === 50);
      } else {
        setMessages(msgs);
        setHasMore(msgs.length === 50);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [channelId]);

  // Poll for new messages every 3 seconds
  const poll = useCallback(async () => {
    if (!channelId) return;
    try {
      const r = await api.get(`/channels/${channelId}/messages`, { params: { limit: 20 } });
      const msgs = Array.isArray(r.data) ? r.data : [];
      if (msgs.length) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.message_id));
          const newMsgs = msgs.filter(m => !existingIds.has(m.message_id));
          if (!newMsgs.length) return prev;
          // Also update edits/deletes
          const updated = prev.map(m => {
            const fresh = msgs.find(x => x.message_id === m.message_id);
            return fresh || m;
          });
          return [...updated, ...newMsgs];
        });
      }
    } catch (_) {}
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    setMessages([]); setLoading(true); setHasMore(true);
    load();
    pollingRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollingRef.current);
  }, [channelId, load, poll]);

  const send = useCallback(async (body, parentId = null) => {
    const r = await api.post(`/channels/${channelId}/messages`, { body, parent_id: parentId });
    setMessages(prev => [...prev, r.data]);
    return r.data;
  }, [channelId]);

  const loadMore = useCallback(() => {
    if (!messages.length || !hasMore) return;
    load(messages[0].created_at);
  }, [messages, hasMore, load]);

  const react = useCallback(async (messageId, emoji) => {
    await api.post(`/messages/${messageId}/reactions`, { emoji });
    // Optimistic update handled by poll
  }, []);

  const deleteMsg = useCallback(async (messageId) => {
    await api.delete(`/messages/${messageId}`);
    setMessages(prev => prev.map(m =>
      m.message_id === messageId ? { ...m, deleted: true, body: null } : m
    ));
  }, []);

  return { messages, loading, hasMore, send, loadMore, react, deleteMsg, reload: load };
}
