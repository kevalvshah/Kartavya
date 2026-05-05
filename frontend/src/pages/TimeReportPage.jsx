import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function TimeReportPage({ teamId }) {
  const [data, setData]       = useState({ entries: [], total_minutes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/time/report', { params: { team_id: teamId } })
       .then(r => setData(r.data))
       .finally(() => setLoading(false));
  }, [teamId]);

  const fmt = (mins) => {
    if (!mins) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)' }}>⏱ Time Report</h1>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-lg)', color: 'var(--accent-default)' }}>
          Total: {fmt(data.total_minutes)}
        </span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
              {['Task','Description','Started','Duration','Who'].map(h => (
                <th key={h} style={{ padding: '8px 12px', fontWeight: 'var(--weight-semibold)', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.entries.map(e => (
              <tr key={e.entry_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{e.task_title}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{e.description || '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(e.started_at).toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent-default)' }}>{fmt(e.minutes)}</td>
                <td style={{ padding: '10px 12px' }}>{e.user_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
