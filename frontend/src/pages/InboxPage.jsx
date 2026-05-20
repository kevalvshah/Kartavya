/**
 * InboxPage.jsx — editorial Inbox: mentions, assignments, approvals.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/editorial';
import { AVATAR_COLORS, relTime, userInitials } from '../lib/utils';
import TaskDrawer from '../components/TaskDrawer';

const KIND_MAP = {
  mention:  { bg: 'color-mix(in srgb, var(--k-deep) 14%, transparent)',   color: 'var(--k-deep)',   label: 'MENTION',  sans: 'उल्लेख' },
  assign:   { bg: 'color-mix(in srgb, var(--ok) 14%, transparent)',        color: 'var(--ok)',       label: 'ASSIGN',   sans: 'नियुक्त' },
  approval: { bg: 'color-mix(in srgb, var(--warn) 14%, transparent)',      color: 'var(--warn)',     label: 'APPROVAL', sans: 'अनुमोदन' },
  comment:  { bg: 'color-mix(in srgb, #8b5cf6 14%, transparent)',          color: '#8b5cf6',         label: 'COMMENT',  sans: 'टिप्पणी' },
  default:  { bg: 'var(--bg-soft)',                                          color: 'var(--ink-3)',    label: 'NOTIF',    sans: 'सूचना' },
};

function getKind(notif) {
  const t = (notif.notification_type || notif.type || '').toLowerCase();
  if (t.includes('mention'))  return KIND_MAP.mention;
  if (t.includes('assign'))   return KIND_MAP.assign;
  if (t.includes('approval')) return KIND_MAP.approval;
  if (t.includes('comment'))  return KIND_MAP.comment;
  return KIND_MAP.default;
}


export default function InboxPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [drawerTaskId,  setDrawerTaskId]  = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/notifications').then(r => setNotifications(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    const already = notifications.find(n => n.notification_id === id && n.read_at);
    if (already) return;
    try {
      await api.post('/notifications/mark-read', { notification_ids: [id] });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (_) {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-read', { mark_all: true });
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (_) {}
  };

  const openNotif = async (n) => {
    await markRead(n.notification_id);
    if (n.task_id) {
      setDrawerTaskId(n.task_id);
    }
  };

  const unread = notifications.filter(n => !n.read_at).length;

  return (
    <div className="k-screen">
      <PageHeader
        kicker="TEAM"
        title="Inbox"
        sanskrit="सन्देश"
        lede="Mentions, assignments, and approvals routed to you."
        right={
          unread > 0 && (
            <button className="k-btn k-btn--ghost k-btn--sm" onClick={markAllRead}>
              Mark all read
            </button>
          )
        }
      />

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading inbox…
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="k-empty">
          <div className="k-empty__icon">✓</div>
          <div className="k-empty__title">All caught up</div>
          <div className="k-empty__sub">Nothing in your inbox right now.</div>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="k-inbox">
          {notifications.map((n, idx) => {
            const kind     = getKind(n);
            const initials = userInitials(n.actor_name || n.from_name || '');
            const color    = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const when     = relTime(n.created_at || n.timestamp);
            const isUnread = !n.read_at;
            return (
              <div
                key={n.notification_id || idx}
                className={'k-inbox__row' + (isUnread ? ' is-unread' : '')}
                onClick={() => openNotif(n)}
              >
                {/* Unread indicator */}
                {isUnread && <span className="k-inbox__dot" />}

                {/* Avatar */}
                <span
                  className="k-avatar"
                  style={{ width: 36, height: 36, fontSize: 13, background: color, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}
                >
                  {initials}
                </span>

                {/* Content */}
                <div className="k-inbox__body">
                  <div className="k-inbox__head">
                    {/* Kind chip */}
                    <span
                      className="k-inbox__kind"
                      style={{ background: kind.bg, color: kind.color }}
                    >
                      {kind.label}
                      <span style={{ fontFamily: 'var(--font-hindi)', fontWeight: 400, marginLeft: 4, fontSize: '0.9em' }}>{kind.sans}</span>
                    </span>
                    {n.actor_name && <strong style={{ color: 'var(--ink)' }}>{n.actor_name}</strong>}
                    <span className="k-mute">{n.title || n.body || ''}</span>
                    <time className="k-inbox__when">{when}</time>
                  </div>
                  {(n.body || n.preview) && (
                    <div className="k-inbox__snip">{n.body || n.preview}</div>
                  )}
                </div>

                {/* Open action */}
                {n.task_id && (
                  <button
                    className="k-btn k-btn--ghost k-btn--sm"
                    style={{ flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); openNotif(n); }}
                  >
                    Open
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskDrawer
        taskId={drawerTaskId}
        open={!!drawerTaskId}
        onClose={() => setDrawerTaskId(null)}
        onSaved={() => setDrawerTaskId(null)}
      />
    </div>
  );
}
