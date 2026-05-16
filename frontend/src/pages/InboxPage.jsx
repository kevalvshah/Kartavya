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
      {/* Page header */}
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--k-primary)', marginBottom: 4 }}>TEAM</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Inbox</h1>
          <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', fontSize: 28, color: 'var(--k-primary)', fontWeight: 400 }}>सन्देश</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4, marginBottom: 0 }}>Mentions, assignments, and approvals routed to you.</p>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {notifications.map((n, i) => {
          const badge   = getBadge(n);
          const label   = getBadgeLabel(n);
          const initials = (n.sender_name || n.actor_name || 'K').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
          const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div key={n.notification_id || i}
              onClick={() => !n.read && markRead(n.notification_id)}
              style={{ display: 'flex', gap: 14, padding: '14px 18px', background: n.read ? 'transparent' : 'rgba(0,130,198,0.04)', borderRadius: 10, cursor: n.read ? 'default' : 'pointer', border: `1px solid ${n.read ? 'var(--rule-soft)' : 'rgba(0,130,198,.18)'}`, transition: 'background 0.2s', marginBottom: 2 }}>

              {/* Avatar */}
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {initials}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {n.sender_name || n.actor_name || 'System'}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 99, background: badge.bg, color: badge.color }}>
                    {label}
                  </span>
                  {n.task_title && (
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· on {n.task_title}</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                    {relTime(n.created_at)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  {n.message || n.body || n.content || 'No preview available.'}
                </p>
              </div>

              {/* Unread dot */}
              {!n.read && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--k-primary)', flexShrink: 0, marginTop: 6 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
