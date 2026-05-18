/**
 * TaskEditor.jsx — create/edit task modal. k-* design system.
 * Used by TasksListPage and ProjectBoardPage (new-task-in-column flow).
 */
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { toLocal, fromLocal } from '../lib/auth';
import { useToast } from './ui/toast';

export default function TaskEditor({
  open,
  onOpenChange,
  editing,
  categories = [],
  teams = [],
  defaultTeamId,
  defaultColumnId = null,
  lockToProject = false,
  onSaved,
}) {
  const { pushToast } = useToast();
  const titleRef = useRef(null);
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    team_id: defaultTeamId || '', due_at: '',
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title:       editing.title       || '',
        description: editing.description || '',
        priority:    editing.priority    || 'medium',
        team_id:     editing.team_id     || defaultTeamId || '',
        due_at:      editing.due_at ? toLocal(editing.due_at) : '',
      });
    } else {
      setForm({ title: '', description: '', priority: 'medium', team_id: defaultTeamId || '', due_at: '' });
    }
    setTimeout(() => titleRef.current?.focus(), 60);
  }, [open, editing, defaultTeamId, lockToProject]);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: 'error', title: 'Title is required' }); return; }
    const teamId = lockToProject ? (defaultTeamId || null) : (form.team_id || null);
    const payload = {
      title:       form.title.trim(),
      description: form.description?.trim() || null,
      priority:    form.priority,
      team_id:     teamId,
      due_at:      fromLocal(form.due_at),
    };
    if (!editing && defaultColumnId) payload.column_id = defaultColumnId;
    try {
      const r = editing
        ? await api.put(`/tasks/${editing.task_id}`, payload)
        : await api.post('/tasks', payload);
      pushToast({ type: 'success', title: editing ? 'Task updated' : 'Task created' });
      onSaved(r.data);
      onOpenChange(false);
    } catch (e) {
      pushToast({ type: 'error', title: 'Could not save', message: e?.response?.data?.detail || 'Try again.' });
    }
  };

  if (!open) return null;

  return (
    <div className="k-modal-scrim" style={{ zIndex: 400 }} onClick={e => e.target === e.currentTarget && onOpenChange(false)}>
      <div className="k-modal" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--k-primary)', marginBottom: 2 }}>
                {editing ? 'EDIT TASK · संपादन' : 'NEW TASK · नया कार्य'}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                {editing ? 'Edit task' : 'What needs doing?'}
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-3)', lineHeight: 1, padding: 4, marginTop: -2 }}>×</button>
          </div>
          <div style={{ height: 1, background: 'var(--rule-soft)', margin: '16px 0 0' }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label className="k-label">Title *</label>
            <input
              ref={titleRef}
              className="k-input"
              style={{ width: '100%' }}
              value={form.title}
              onChange={upd('title')}
              placeholder="Clear, action-first title…"
              onKeyDown={e => e.key === 'Enter' && save()}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="k-label">Notes</label>
            <textarea
              className="k-input"
              rows={3}
              style={{ width: '100%', resize: 'vertical', lineHeight: 1.6 }}
              value={form.description}
              onChange={upd('description')}
              placeholder="Context, links, acceptance criteria…"
            />
          </div>

          {/* Project + Priority + Due */}
          <div style={{ display: 'grid', gridTemplateColumns: lockToProject ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
            {!lockToProject && (
              <div>
                <label className="k-label">Project · परियोजना</label>
                <select className="k-input" style={{ width: '100%' }} value={form.team_id} onChange={upd('team_id')}>
                  <option value="">Personal</option>
                  {teams.filter(t => t.team_id && t.name).map(t => (
                    <option key={t.team_id} value={t.team_id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="k-label">Priority · प्राथमिकता</label>
              <select className="k-input" style={{ width: '100%' }} value={form.priority} onChange={upd('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="k-label">Due date · नियत तिथि</label>
              <input type="datetime-local" className="k-input" style={{ width: '100%' }} value={form.due_at} onChange={upd('due_at')} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', flex: 1 }}>↵ to save · Esc to close</span>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => onOpenChange(false)}>Cancel</button>
          <button className="k-btn k-btn--primary k-btn--sm" onClick={save} disabled={!form.title.trim()}>
            {editing ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}
