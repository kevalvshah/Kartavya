import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const TRIGGERS = [
  { value: 'task_created',            label: 'Task created' },
  { value: 'status_changed',          label: 'Status changed' },
  { value: 'field_changed',           label: 'Field changed' },
  { value: 'assigned',                label: 'Task assigned' },
  { value: 'due_date_approaching',    label: 'Due date approaching' },
  { value: 'task_overdue',            label: 'Task overdue' },
  { value: 'comment_added',           label: 'Comment added' },
  { value: 'approval_status_changed', label: 'Approval status changed' },
];

const ACTIONS = [
  { value: 'send_email',        label: 'Send email' },
  { value: 'send_notification', label: 'Send in-app notification' },
  { value: 'set_field',         label: 'Set a field' },
  { value: 'change_status',     label: 'Change status' },
  { value: 'assign_to',         label: 'Assign to user' },
  { value: 'post_comment',      label: 'Post a comment' },
];

export default function AutomationsPage({ teamId }) {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [form, setForm]               = useState({ name: '', trigger_event: 'status_changed', action_type: 'send_notification', enabled: true });

  useEffect(() => {
    if (!teamId) return;
    api.get(`/api/automations/team/${teamId}`)
       .then(r => setAutomations(r.data))
       .finally(() => setLoading(false));
  }, [teamId]);

  const handleToggle = async (auto) => {
    await api.put(`/api/automations/${auto.automation_id}`, { enabled: !auto.enabled });
    setAutomations(prev => prev.map(a => a.automation_id === auto.automation_id ? { ...a, enabled: !a.enabled } : a));
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/automations/${id}`);
    setAutomations(prev => prev.filter(a => a.automation_id !== id));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const payload = {
      team_id: teamId,
      name: form.name,
      trigger: { event: form.trigger_event, filters: [] },
      actions: [{ type: form.action_type, config: {} }],
      enabled: true,
    };
    const r = await api.post('/api/automations/', payload);
    setAutomations(prev => [r.data, ...prev]);
    setCreating(false);
    setForm({ name: '', trigger_event: 'status_changed', action_type: 'send_notification', enabled: true });
  };

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading automations…</div>;

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)' }}>⚡ Automations</h1>
        <button onClick={() => setCreating(true)}
          style={{ background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>
          + New Rule
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', fontWeight: 600 }}>New Automation</h3>
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Name</span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontFamily: 'inherit', background: 'var(--bg-default)', color: 'var(--text-default)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>When (trigger)</span>
              <select value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}
                style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontFamily: 'inherit', background: 'var(--bg-default)', color: 'var(--text-default)' }}>
                {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Then (action)</span>
              <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontFamily: 'inherit', background: 'var(--bg-default)', color: 'var(--text-default)' }}>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button type="submit" style={{ background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}>Create</button>
            <button type="button" onClick={() => setCreating(false)} style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '8px 18px', cursor: 'pointer', color: 'var(--text-default)' }}>Cancel</button>
          </div>
        </form>
      )}

      {automations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <p>No automations yet. Create your first rule to automate repetitive work.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {automations.map(auto => (
            <div key={auto.automation_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{auto.name}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
                    When <strong>{auto.trigger?.event}</strong> → {auto.actions?.map(a => a.type).join(', ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: auto.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
                  {auto.run_count || 0} runs
                </span>
                <button onClick={() => handleToggle(auto)}
                  style={{ background: auto.enabled ? 'var(--success-bg)' : 'var(--bg-muted)', color: auto.enabled ? 'var(--success)' : 'var(--text-muted)', border: '1px solid', borderColor: auto.enabled ? 'var(--success)' : 'var(--border-default)', borderRadius: 'var(--radius-full)', padding: '4px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}>
                  {auto.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button onClick={() => handleDelete(auto.automation_id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
