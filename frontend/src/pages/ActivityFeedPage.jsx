import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const TYPE_ICONS = {
  created:         '✨',
  status_changed:  '🔄',
  assigned:        '👤',
  commented:       '💬',
  field_changed:   '✏️',
  approved:        '✅',
  rejected:        '❌',
  mention:         '📣',
  time_logged:     '⏱',
  default:         '📋',
};

export default function ActivityFeedPage({ teamId }) {
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterType, setFilterType] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/activity/team/${teamId}`, { params: { limit: 100, event_type: filterType || undefined } });
      setEvents(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (teamId) load(); }, [teamId, filterType]);

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000)  return 'just now';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)' }}>📋 Activity Feed</h1>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '6px 12px', fontFamily: 'inherit', background: 'var(--bg-default)', color: 'var(--text-default)' }}>
          <option value=''>All events</option>
          <option value='status_changed'>Status changes</option>
          <option value='commented'>Comments</option>
          <option value='assigned'>Assignments</option>
          <option value='approved'>Approvals</option>
          <option value='field_changed'>Field changes</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
          No activity yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {events.map(evt => (
            <div key={evt.event_id} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 18, minWidth: 24, textAlign: 'center', marginTop: 1 }}>
                {TYPE_ICONS[evt.type] || TYPE_ICONS.default}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 'var(--weight-medium)' }}>{evt.actor_name || 'System'}</span>
                {' '}
                <span style={{ color: 'var(--text-muted)' }}>{evt.type.replace(/_/g, ' ')}</span>
                {evt.task_title && (
                  <span> on <strong style={{ color: 'var(--accent-default)' }}>{evt.task_title}</strong></span>
                )}
                {evt.data?.from && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    {' '}({evt.data.from} → {evt.data.to})
                  </span>
                )}
              </div>
              <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', marginTop: 2 }}>
                {formatTime(evt.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
