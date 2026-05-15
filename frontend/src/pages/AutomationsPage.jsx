/**
 * AutomationsPage.jsx — k-* design system.
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

export default function AutomationsPage({ teamId: propTeamId }) {
  const [automations, setAutomations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [teams,       setTeams]       = useState([]);
  const [teamId,      setTeamId]      = useState(propTeamId || '');

  useEffect(() => {
    if (!propTeamId) {
      api.get('/teams').then(r => {
        setTeams(r.data);
        if (r.data.length > 0) setTeamId(r.data[0].team_id);
      }).catch(() => {});
    }
  }, [propTeamId]);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/automations/team/${teamId}`)
       .then(r => setAutomations(r.data))
       .catch(() => setAutomations([]))
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

  if (loading) return (
    <div className="k-page">
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
        Loading automations…
      </div>
    </div>
  );

  if (!teamId && teams.length === 0) return (
    <div className="k-page">
      <div className="k-empty">
        <div className="k-empty__icon">⚡</div>
        <div className="k-empty__title">No projects yet</div>
        <div className="k-empty__sub">Create a project first to set up automations.</div>
      </div>
    </div>
  );

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">Automations</h1>
        <span className="k-pageh__sans">स्वचालन</span>
        <div className="k-pageh__actions">
          {teams.length > 1 && (
            <select className="k-select" value={teamId} onChange={e => setTeamId(e.target.value)}>
              {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
            </select>
          )}
          {!creating && (
            <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setCreating(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
              New Rule
            </button>
          )}
        </div>
      </div>

      {/* Builder form */}
      {creating && (
        <form onSubmit={handleCreate} className="k-card" style={{ marginBottom: 'var(--sp-5)' }}>
          <div className="k-card__head" style={{ marginBottom: 'var(--sp-5)' }}>
            <span className="k-card__title">New Automation Rule</span>
          </div>

          <div style={{ display: 'grid', gap: 'var(--sp-4)', gridTemplateColumns: '2fr 1.5fr 1.5fr', marginBottom: 'var(--sp-4)' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Rule name</div>
              <input className="k-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Notify on done" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>When (trigger)</div>
              <select className="k-select" value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}>
                {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Then (action)</div>
              <select className="k-select" value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              {form.action_type === 'change_status' ? 'Target status' :
               form.action_type === 'assign_to'     ? 'User email' :
               form.action_type === 'set_field'     ? 'Field value' :
               'Message (optional)'}
            </div>
            <input className="k-input" value={form.action_config} onChange={e => setForm(f => ({ ...f, action_config: e.target.value }))}
              placeholder={form.action_type === 'change_status' ? 'done' : form.action_type === 'assign_to' ? 'user@example.com' : 'Optional message…'} />
          </div>

          <div style={{ marginBottom: 'var(--sp-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conditions (AND)</div>
              <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={addCondition}>+ Add condition</button>
            </div>
            {form.conditions.length === 0 ? (
              <p style={{ color: 'var(--ink-faint)', fontSize: 12, margin: 0 }}>No conditions — rule fires on every trigger event.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.conditions.map((cond, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {i > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', width: 30, textAlign: 'center' }}>AND</span>}
                    {i === 0 && <span style={{ width: 30 }} />}
                    <select className="k-select" style={{ width: 120 }} value={cond.field} onChange={e => updateCondition(i, { field: e.target.value })}>
                      {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select className="k-select" style={{ width: 60 }} value={cond.op} onChange={e => updateCondition(i, { op: e.target.value })}>
                      {CONDITION_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select className="k-select" style={{ width: 130 }} value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })}>
                      {(cond.field === 'priority' ? PRIORITY_OPTS : STATUS_OPTS).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button type="button" onClick={() => removeCondition(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="k-btn k-btn--primary" disabled={saving}>{saving ? 'Creating…' : 'Create rule'}</button>
            <button type="button" className="k-btn k-btn--ghost" onClick={() => { setCreating(false); setForm(EMPTY_FORM); }}>Cancel</button>
          </div>
        </form>
      )}

      {automations.length === 0 ? (
        <div className="k-empty">
          <div className="k-empty__icon">⚡</div>
          <div className="k-empty__title">No automations yet</div>
          <div className="k-empty__sub">Create your first rule to automate repetitive work.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {automations.map(auto => {
            const condCount = auto.trigger?.filters?.length || 0;
            return (
              <div key={auto.automation_id} className="k-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(5,183,170,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⚡</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>{auto.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      When <strong>{TRIGGERS.find(t => t.value === auto.trigger?.event)?.label || auto.trigger?.event}</strong>
                      {condCount > 0 && <> + {condCount} condition{condCount > 1 ? 's' : ''}</>}
                      {' → '}
                      {auto.actions?.map(a => ACTIONS.find(x => x.value === a.type)?.label || a.type).join(', ')}
                    </div>
                    {condCount > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(auto.trigger?.filters || []).map((c, i) => (
                          <span key={i} style={{ background: 'var(--bg-soft)', borderRadius: 4, padding: '2px 7px', fontSize: 11, color: 'var(--ink-2)' }}>
                            {c.field} {c.op === 'equals' ? '=' : '≠'} {c.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {(auto.run_count > 0) && (
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg-soft)', borderRadius: 20, padding: '2px 8px' }}>
                      {auto.run_count} runs
                    </span>
                  )}
                  <button onClick={() => handleToggle(auto)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, border: '1px solid', cursor: 'pointer',
                      background: auto.enabled ? 'rgba(16,185,129,.12)' : 'var(--bg-soft)',
                      color: auto.enabled ? '#059669' : 'var(--ink-3)',
                      borderColor: auto.enabled ? '#059669' : 'var(--rule-soft)' }}>
                    {auto.enabled ? 'On' : 'Off'}
                  </button>
                  <button className="k-iconbtn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(auto.automation_id)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
