import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { relTime } from '../lib/utils';

export function NotificationsModal({ open, onOpenChange }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const unreadCount = useMemo(() => items.filter(i => !i.read_at).length, [items]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/notifications')
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const markAll = async () => {
    await api.post('/notifications/mark-read', { mark_all: true, notification_ids: [] });
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  };

  const markOne = async (id) => {
    await api.post('/notifications/mark-read', { mark_all: false, notification_ids: [id] });
    setItems(prev => prev.map(n => n.notification_id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => onOpenChange(false)}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,.3)', width: 480, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--k-primary)', marginBottom: 2 }}>
              NOTIFICATIONS · <span style={{ fontFamily: 'var(--font-hindi)' }}>सूचनाएं</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
              What's new
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: 7, cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>No notifications yet</div>
            </div>
          )}
          {items.map(n => (
            <div key={n.notification_id}
              onClick={n.url ? () => { onOpenChange(false); navigate(n.url); } : undefined}
              style={{
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${!n.read_at ? 'var(--k-primary)40' : 'var(--rule-soft)'}`,
                background: !n.read_at ? 'var(--side-active)' : 'var(--bg)',
                opacity: n.read_at ? 0.7 : 1,
                transition: 'opacity .15s',
                cursor: n.url ? 'pointer' : 'default',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    {!n.read_at && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--k-primary)', flexShrink: 0, display: 'inline-block' }} />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{n.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>{relTime(n.created_at)}</div>
                </div>
                {!n.read_at && (
                  <button
                    onClick={() => markOne(n.notification_id)}
                    style={{ flexShrink: 0, fontSize: 11, color: 'var(--k-primary)', background: 'none', border: '1px solid var(--k-primary)50', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </span>
          <button
            onClick={markAll}
            disabled={unreadCount === 0}
            className="k-btn k-btn--ghost k-btn--sm"
          >
            Mark all read
          </button>
        </div>
      </div>
    </div>
  );
}
