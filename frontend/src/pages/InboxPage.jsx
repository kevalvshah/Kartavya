/**
 * InboxPage.jsx — mentions, assignments, and approvals routed to you.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const BADGE_STYLES = {
  mention:  { bg: 'rgba(5,183,170,.12)',  color: '#05b7aa',  label: 'MENTION' },
  assign:   { bg: 'rgba(59,130,246,.12)', color: '#3b82f6',  label: 'ASSIGN' },
  approval: { bg: 'rgba(245,158,11,.12)', color: '#f59e0b',  label: 'APPROVAL' },
  comment:  { bg: 'rgba(139,92,246,.12)', color: '#8b5cf6',  label: 'COMMENT' },
  default:  { bg: 'var(--bg-soft)',       color: 'var(--ink-3)', label: 'NOTIF' },
};

function getBadge(notif) {
  const t = (notif.notification_type || notif.type || '').toLowerCase();
  if (t.includes('mention'))  return BADGE_STYLES.mention;
  if (t.includes('assign'))   return BADGE_STYLES.assign;
  if (t.includes('approval')) return BADGE_STYLES.approval;
  if (t.includes('comment'))  return BADGE_STYLES.comment;
  return BADGE_STYLES.default;
}

function getBadgeLabel(notif) {
  const t = (notif.notification_type || notif.type || '').toLowerCase();
  if (t.includes('mention'))  return 'MENTION';
  if (t.includes('assign'))   return 'ASSIGN';
  if (t.includes('approval')) return 'APPROVAL';
  if (t.includes('comment'))  return 'COMMENT';
  return 'NOTIF';
}

function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const AVATAR_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

export default function InboxPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/notifications').then(r => setNotifications(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read: true } : n));
    } catch (_) {}
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">Inbox</h1>
        <span className="k-pageh__sans">सन्देश</span>
      </div>

      {/* Unread badge */}
      {unread > 0 && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: 'rgba(220,38,38,.1)', color: '#dc2626', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
            {unread} UNREAD · अपठित
          </span>
        </div>
      )}

      {loading && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Loading inbox…</div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="k-empty">
          <div className="k-empty__icon">✉</div>
          <div className="k-empty__title">All clear</div>
          <div className="k-empty__sub">No notifications yet. You'll see mentions, assignments, and approvals here.</div>
        </div>
      )}

      <div className="k-inbox">
        {notifications.map((n, i) => {
          const label     = getBadgeLabel(n).toLowerCase();
          const initials  = (n.sender_name || n.actor_name || 'K').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div key={n.notification_id || i}
              className={`k-inboxrow${n.read ? '' : ' is-unread'}`}
              onClick={() => !n.read && markRead(n.notification_id)}
              style={{ cursor: n.read ? 'default' : 'pointer' }}
            >
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="k-inboxrow__head">
                  <span style={{ fontWeight: 600 }}>{n.sender_name || n.actor_name || 'System'}</span>
                  <span className={`k-inboxkind k-inboxkind--${label}`}>{getBadgeLabel(n)}</span>
                  {n.task_title && <span style={{ color: 'var(--ink-3)' }}>· {n.task_title}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                    {relTime(n.created_at)}
                  </span>
                </div>
                <div className="k-inboxrow__snip">
                  {n.message || n.body || n.content || 'No preview available.'}
                </div>
              </div>
              {!n.read && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--k-primary)', flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
