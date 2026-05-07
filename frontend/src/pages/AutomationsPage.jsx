import React, { useEffect, useState } from 'react';

export default function AutomationsPage({ teamId }) {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const API = process.env.REACT_APP_API_URL || 'https://kartavya-production.up.railway.app';

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    fetch(`${API}/api/automations/team/${teamId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAutomations(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId, API]);

  const toggle = async (id, enabled) => {
    await fetch(`${API}/api/automations/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setAutomations(prev => prev.map(a => a.automation_id === id ? { ...a, enabled: !enabled } : a));
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 860 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Automations</h2>
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {!loading && automations.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>No automations yet. Add them via the API or contact your admin.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {automations.map(a => (
          <div key={a.automation_id} style={{ border: '1px solid var(--border-default)', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Trigger: {a.trigger?.event?.replace(/_/g, ' ')} · Runs: {a.run_count || 0}
              </div>
            </div>
            <button
              onClick={() => toggle(a.automation_id, a.enabled)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: a.enabled ? 'var(--accent-default)' : 'var(--bg-muted)', color: a.enabled ? '#fff' : 'var(--text-muted)' }}
            >
              {a.enabled ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
