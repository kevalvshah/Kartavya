/**
 * ActivityList.jsx — Reusable activity event list.
 * Used in TaskDrawer (activity tab) and ActivityFeedPage.
 * Week 2: proper icons, readable labels, data diff rendering.
 */
import React from 'react';

const TYPE_META = {
  created:         { icon: '✨', verb: 'created this task' },
  status_changed:  { icon: '🔄', verb: 'changed status' },
  assigned:        { icon: '👤', verb: 'updated assignees' },
  commented:       { icon: '💬', verb: 'commented' },
  field_changed:   { icon: '✏️', verb: 'updated a field' },
  approved:        { icon: '✅', verb: 'approved' },
  rejected:        { icon: '❌', verb: 'rejected' },
  mention:         { icon: '📣', verb: 'mentioned someone' },
  time_logged:     { icon: '⏱', verb: 'logged time' },
  default:         { icon: '📋', verb: '' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)   return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function DiffBadge({ from, to }) {
  if (from == null && to == null) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, marginLeft: 6, fontFamily: 'inherit' }}>
      {from != null && <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 4, padding: '1px 5px' }}>{String(from)}</span>}
      {from != null && to != null && <span style={{ color: 'var(--text-subtle)' }}>→</span>}
      {to   != null && <span style={{ background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 4, padding: '1px 5px' }}>{String(to)}</span>}
    </span>
  );
}

function FieldDiff({ data }) {
  if (!data) return null;
  if (data.field) {
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        {' '}<em>{data.field}</em>
        <DiffBadge from={data.from} to={data.to} />
      </span>
    );
  }
  if (data.from !== undefined || data.to !== undefined) {
    return <DiffBadge from={data.from} to={data.to} />;
  }
  if (data.added?.length || data.removed?.length) {
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 4 }}>
        {data.added?.length  > 0 && <span style={{ background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 4, padding: '1px 5px', marginRight: 4 }}>+{data.added.length}</span>}
        {data.removed?.length > 0 && <span style={{ background: 'var(--danger-bg)',  color: 'var(--danger)',  borderRadius: 4, padding: '1px 5px' }}>-{data.removed.length}</span>}
      </span>
    );
  }
  return null;
}

export default function ActivityList({ events = [], loading = false, showTask = false }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-muted)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, background: 'var(--bg-muted)', borderRadius: 4, width: '60%', marginBottom: 6 }} />
              <div style={{ height: 10, background: 'var(--bg-muted)', borderRadius: 4, width: '35%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map(evt => {
        const meta = TYPE_META[evt.type] || TYPE_META.default;
        return (
          <div key={evt.event_id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            {/* Avatar / Icon */}
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
              {meta.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                <strong>{evt.actor_name || 'System'}</strong>
                {' '}
                <span style={{ color: 'var(--text-muted)' }}>{meta.verb}</span>
                {showTask && evt.task_title && (
                  <span> on <strong style={{ color: 'var(--accent-default)' }}>{evt.task_title}</strong></span>
                )}
                <FieldDiff data={evt.data} />
              </div>
              <div style={{ color: 'var(--text-subtle)', fontSize: 11, marginTop: 2 }}>
                {timeAgo(evt.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
