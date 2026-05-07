/**
 * AutomationsPage.jsx — Full automation rule builder.
 * Week 2 Day 9: conditions panel (AND filters), polished rule list, run-count badge.
 */
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

const CONDITION_FIELDS = [
  { value: 'status',   label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
];

const CONDITION_OPS = [
  { value: 'equals',     label: '=' },
  { value: 'not_equals', label: '≠' },
];

const STATUS_OPTS   = ['todo','in_progress','in_review','done'];
const PRIORITY_OPTS = ['low','medium','high','urgent'];

const EMPTY_CONDITION = { field: 'status', op: 'equals', value: 'done' };
const EMPTY_FORM      = { name: '', trigger_event: 'status_changed', action_type: 'send_notification', action_config: '', conditions: [] };

export default function AutomationsPage({ teamId }) {
  const [automations, setAutomations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!teamId) return;
    api.get(`/automations/team/${teamId}`)
       .then(r => setAutomations(r.data))
       .finally(() => setLoading(false));
  }, [teamId]);

  const handleToggle = async (auto) => {
    await api.put(`/automations/${auto.automation_id}`, { enabled: !auto.enabled });
    setAutomations(prev => prev.map(a => a.automation_id === auto.automation_id ? { ...a, enabled: !a.enabled } : a));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this automation?')) return;
    await api.delete(`/automations/${id}`);
    setAutomations(prev => prev.filter(a => a.automation_id !== id));
  };

  const addCondition    = () => setForm(f => ({ ...f, conditions: [...f.conditions, { ...EMPTY_CONDITION }] }));
  const removeCondition = (i) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }));
  const updateCondition = (i, patch) => setForm(f => ({ ...f, conditions: f.conditions.map((c, j) => j === i ? { ...c, ...patch } : c) }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const actionConfig = {};
      if (form.action_config.trim()) {
        // For actions that use 'message' or 'comment_body'
        if (['post_comment', 'send_notification', 'send_email'].includes(form.action_type)) {
          actionConfig.message = form.action_config.trim();
        } else if (form.action_type === 'change_status') {
          actionConfig.status = form.action_config.trim();
        } else {
          actionConfig.value = form.action_config.trim();
        }
      }
      const payload = {
        team_id: teamId,
        name: form.name,
        trigger: { event: form.trigger_event, filters: form.conditions },
        actions: [{ type: form.action_type, config: actionConfig }],
        enabled: true,
      };
      const r = await api.post('/automations/', payload);
      setAutomations(prev => [r.data, ...prev]);
      setCreating(false);
      setForm(EMPTY_FORM);
    } finally { setSaving(false); }
  };

  const inputSt = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)', width: '100%', boxSizing: 'border-box' };
  const labelSt = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5, display: 'block' };

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading automations…</div>;

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 860 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>⚡ Automations</h1>
        {!creating && (
          <button onClick={() => setCreating(true)}
            style={{ background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New Rule
          </button>
        )}
      </div>

      {/* Builder form */}
      {creating && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ marginTop: 0, marginBottom: 'var(--space-5)', fontWeight: 700 }}>New Automation Rule</h3>

          {/* Name + Trigger + Action row */}
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '2fr 1.5fr 1.5fr', marginBottom: 'var(--space-5)' }}>
            <div>
              <label style={labelSt}>Rule name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                placeholder="e.g. Notify on done" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>When (trigger)</label>
              <select value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))} style={inputSt}>
                {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Then (action)</label>
              <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))} style={inputSt}>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Action config */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={labelSt}>
              {form.action_type === 'change_status' ? 'Target status' :
               form.action_type === 'assign_to'     ? 'User email' :
               form.action_type === 'set_field'     ? 'Field value' :
               'Message (optional)'}
            </label>
            <input value={form.action_config} onChange={e => setForm(f => ({ ...f, action_config: e.target.value }))}
              placeholder={form.action_type === 'change_status' ? 'done' : form.action_type === 'assign_to' ? 'user@example.com' : 'Optional message…'}
              style={inputSt} />
          </div>

          {/* Conditions (AND filters) */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={labelSt}>Conditions (AND)</label>
              <button type="button" onClick={addCondition}
                style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                + Add condition
              </button>
            </div>
            {form.conditions.length === 0 ? (
              <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', margin: 0 }}>No conditions — rule fires on every trigger event.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.conditions.map((cond, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {i > 0 && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', width: 30, textAlign: 'center' }}>AND</span>}
                    {i === 0 && <span style={{ width: 30 }} />}
                    <select value={cond.field} onChange={e => updateCondition(i, { field: e.target.value })} style={{ ...inputSt, width: 120 }}>
                      {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select value={cond.op} onChange={e => updateCondition(i, { op: e.target.value })} style={{ ...inputSt, width: 60 }}>
                      {CONDITION_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })} style={{ ...inputSt, width: 130 }}>
                      {(cond.field === 'priority' ? PRIORITY_OPTS : STATUS_OPTS).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button type="button" onClick={() => removeCondition(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="submit" disabled={saving}
              style={{ background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating…' : 'Create rule'}
            </button>
            <button type="button" onClick={() => { setCreating(false); setForm(EMPTY_FORM); }}
              style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '8px 18px', cursor: 'pointer', color: 'var(--text-default)', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {automations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <p>No automations yet. Create your first rule to automate repetitive work.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {automations.map(auto => {
            const condCount = auto.trigger?.filters?.length || 0;
            return (
              <div key={auto.automation_id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                  <span style={{ fontSize: 20, marginTop: 2 }}>⚡</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{auto.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 3 }}>
                      When <strong>{TRIGGERS.find(t => t.value === auto.trigger?.event)?.label || auto.trigger?.event}</strong>
                      {condCount > 0 && <> + {condCount} condition{condCount > 1 ? 's' : ''}</>}
                      {' → '}
                      {auto.actions?.map(a => ACTIONS.find(x => x.value === a.type)?.label || a.type).join(', ')}
                    </div>
                    {condCount > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(auto.trigger?.filters || []).map((c, i) => (
                          <span key={i} style={{ background: 'var(--bg-muted)', borderRadius: 4, padding: '2px 7px', fontSize: 11 }}>
                            {c.field} {c.op === 'equals' ? '=' : '≠'} {c.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginTop: 2 }}>
                  {(auto.run_count > 0) && (
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)', background: 'var(--bg-muted)', borderRadius: 20, padding: '2px 8px' }}>
                      {auto.run_count} runs
                    </span>
                  )}
                  <button onClick={() => handleToggle(auto)}
                    style={{ background: auto.enabled ? 'var(--success-bg)' : 'var(--bg-muted)', color: auto.enabled ? 'var(--success)' : 'var(--text-muted)', border: '1px solid', borderColor: auto.enabled ? 'var(--success)' : 'var(--border-default)', borderRadius: 'var(--radius-full)', padding: '3px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {auto.enabled ? 'On' : 'Off'}
                  </button>
                  <button onClick={() => handleDelete(auto.automation_id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

