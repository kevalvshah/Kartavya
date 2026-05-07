import React, { useEffect, useState } from 'react';

export default function TimeReportPage({ teamId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const API = process.env.REACT_APP_API_URL || 'https://kartavya-production.up.railway.app';

  useEffect(() => {
    setLoading(true);
    const q = teamId ? `?team_id=${teamId}` : '';
    fetch(`${API}/api/time/report${q}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setReport(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId, API]);

  const fmtMins = m => {
    if (!m) return '0m';
    const h = Math.floor(m / 60), min = m % 60;
    return h ? `${h}h ${min}m` : `${min}m`;
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 860 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Time Report</h2>
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {report && (
        <>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 24 }}>
            Total logged: <strong style={{ color: 'var(--text-default)' }}>{fmtMins(report.total_minutes)}</strong>
          </div>
          {report.entries?.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No time entries yet. Start a timer on any task.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(report.entries || []).map(e => (
              <div key={e.entry_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 14 }}>
                <div>
                  <strong>{e.task_title}</strong>
                  {e.description && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {e.description}</span>}
                  <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2 }}>
                    {e.user_name} · {new Date(e.started_at).toLocaleDateString()}
                  </div>
                </div>
                <strong style={{ flexShrink: 0, marginLeft: 16 }}>{fmtMins(e.minutes)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
