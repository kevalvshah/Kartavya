import React, { useEffect, useState } from 'react';

export default function ActivityFeedPage({ teamId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const API = process.env.REACT_APP_API_URL || 'https://kartavya-production.up.railway.app';

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    fetch(`${API}/api/activity/team/${teamId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId, API]);

  const TYPE_ICON = {
    created: '✨', status_changed: '🔄', assigned: '👤',
    commented: '💬', field_changed: '✏️', approved: '✅',
    rejected: '❌', mention: '📣',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Activity Feed</h2>
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {!loading && events.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>No activity yet. Create tasks or update statuses to see the feed.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map(evt => (
          <div key={evt.event_id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              {TYPE_ICON[evt.type] || '📋'}
            </div>
            <div>
              <div style={{ fontSize: 14 }}>
                <strong>{evt.actor_name || 'System'}</strong>{' '}
                <span style={{ color: 'var(--text-muted)' }}>{evt.type?.replace(/_/g, ' ')}</span>
                {evt.task_title && <span> on <strong>{evt.task_title}</strong></span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2 }}>
                {new Date(evt.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
