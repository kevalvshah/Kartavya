/**
 * usePresence.js
 *
 * Uses Supabase Presence to track which users are currently viewing
 * the same project board. Returns an array of online user objects
 * ready to render as an avatar stack.
 *
 * Usage:
 *   const onlineUsers = usePresence(projectId, currentUser());
 *
 * Returns: [{ user_id, name, initials, color, online_at }, ...]
 *
 * Each user gets a stable deterministic avatar color derived from
 * their user_id so the same person always appears in the same color.
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// 8 distinct colors for avatar backgrounds — cycles by user_id hash
const AVATAR_COLORS = [
  '#378ADD', '#1D9E75', '#BA7517', '#7F77DD',
  '#D85A30', '#3B6D11', '#993556', '#0F6E56',
];

function colorForUser(userId = '') {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initialsFor(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function usePresence(projectId, user) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!projectId || !user?.user_id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const room = supabase.channel(`presence:board:${projectId}`, {
      config: { presence: { key: user.user_id } },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        // Each key is a user_id; value is an array of presence payloads
        const users = Object.values(state)
          .flat()
          .map((p) => ({
            user_id:   p.user_id,
            name:      p.name      || 'Unknown',
            initials:  p.initials  || initialsFor(p.name || ''),
            color:     p.color     || colorForUser(p.user_id),
            online_at: p.online_at,
          }))
          // Sort so the current user always appears first
          .sort((a) => (a.user_id === user.user_id ? -1 : 1));

        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.debug('[Presence] joined', newPresences.map(p => p.name));
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.debug('[Presence] left', leftPresences.map(p => p.name));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({
            user_id:   user.user_id,
            name:      user.name || user.email || 'User',
            initials:  initialsFor(user.name || user.email || 'U'),
            color:     colorForUser(user.user_id),
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = room;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, user?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return onlineUsers;
}
