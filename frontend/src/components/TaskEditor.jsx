/**
 * TaskEditor.jsx — create/edit task modal. k-* design system.
 * Used by TasksListPage and ProjectBoardPage (new-task-in-column flow).
 */
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { toLocal, fromLocal } from '../lib/auth';
import { useToast } from './ui/toast';
import { AVATAR_COLORS, userInitials } from '../lib/utils';
import FilesField from './fields/FilesField';

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
  clientMode = false,
}) {
  const { pushToast } = useToast();
  const titleRef = useRef(null);
  const assigneeRef = useRef(null);

  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    team_id: defaultTeamId || '', due_at: '',
    assignee_user_ids: [],
  });

  const [members, setMembers] = useState([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);

  // Fetch members when team changes
  useEffect(() => {
    const tid = form.team_id;
    if (!tid) { setMembers([]); return; }
    api.get(`/teams/${tid}`)
      .then(r => setMembers(Array.isArray(r.data?.members) ? r.data.members : []))
      .catch(() => setMembers([]));
  }, [form.team_id]);

  // Close assignee dropdown on outside click
  useEffect(() => {
    if (!assigneeOpen) return;
    const handler = (e) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) {
        setAssigneeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assigneeOpen]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title:              editing.title       || '',
        description:        editing.description || '',
        priority:           editing.priority    || 'medium',
        team_id:            editing.team_id     || defaultTeamId || '',
        due_at:             editing.due_at ? toLocal(editing.due_at) : '',
        assignee_user_ids:  editing.assignee_user_ids || [],
      });
    } else {
      setForm({
        title: '', description: '', priority: 'medium',
        team_id: defaultTeamId || '', due_at: '',
        assignee_user_ids: [],
      });
    }
    setAttachments([]);
    setTimeout(() => titleRef.current?.focus(), 60);
  }, [open, editing, defaultTeamId]);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const toggleAssignee = (uid) => {
    setForm(f => {
      const ids = f.assignee_user_ids || [];
      return {
        ...f,
        assignee_user_ids: ids.includes(uid) ? ids.filter(x => x !== uid) : [...ids, uid],
      };
    });
  };

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: 'error', title: 'Title is required' }); return; }
    const teamId = lockToProject ? (defaultTeamId || null) : (form.team_id || null);
    const payload = {
      title:              form.title.trim(),
      description:        form.description?.trim() || null,
      priority:           form.priority,
      team_id:            teamId,
      due_at:             fromLocal(form.due_at),
      assignee_user_ids:  form.assignee_user_ids,
      attachments:        attachments.map(f => ({ name: f.name, url: f.url })),
    };
    if (!editing && defaultColumnId) payload.column_id = defaultColumnId;
    try {
      let r;
      if (editing) {
        r = await api.put(`/tasks/${editing.task_id}`, payload);
      } else if (clientMode) {
        r = await api.post('/client/tasks/request', payload);
      } else {
        r = await api.post('/tasks', payload);
      }

      pushToast({ type: 'success', title: editing ? 'Task updated' : clientMode ? 'Task submitted for approval' : 'Task created' });
      onSaved(r.data);
      onOpenChange(false);
    } catch (e) {
      pushToast({ type: 'error', title: 'Could not save', message: e?.response?.data?.detail || 'Try again.' });
    }
  };

  if (!open) return null;

  const selectedIds = form.assignee_user_ids || [];
  const selectedMembers = members.filter(m => selectedIds.includes(m.user_id || m.member_id));

  return (
    <div className="k-modal-scrim" style={{ zIndex: 400 }} onClick={e => e.target === e.currentTarget && onOpenChange(false)}>
      <div className="k-modal" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--k-primary)', marginBottom: 2 }}>
                {editing ? 'EDIT TASK · संपादन' : clientMode ? 'REQUEST TASK · अनुरोध' : 'NEW TASK · नया कार्य'}
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
          <input
            ref={titleRef}
            className="k-input"
            style={{ width: '100%', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 400, background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule)', borderRadius: 0, padding: '6px 0', color: 'var(--ink)' }}
            value={form.title}
            onChange={upd('title')}
            placeholder="Write a clear, action-first title..."
            onKeyDown={e => e.key === 'Enter' && save()}
          />

          {/* Row 1: Project + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: lockToProject ? '1fr' : '1fr 1fr', gap: 12 }}>
            {!lockToProject && (
              <div>
                <label style={lbl}>PROJECT · परियोजना</label>
                <select className="k-input" style={{ width: '100%' }} value={form.team_id} onChange={upd('team_id')}>
                  <option value="">No project</option>
                  {teams.filter(t => t.team_id && t.name).map(t => (
                    <option key={t.team_id} value={t.team_id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>PRIORITY · प्राथमिकता</label>
              <select className="k-input" style={{ width: '100%' }} value={form.priority} onChange={upd('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Row 2: Due + Assignees */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>DUE · नियत तिथि</label>
              <input type="datetime-local" className="k-input" style={{ width: '100%' }} value={form.due_at} onChange={upd('due_at')} />
            </div>

            {/* Assignee picker */}
            <div ref={assigneeRef} style={{ position: 'relative' }}>
              <label style={lbl}>ASSIGNEES · नियुक्त</label>
              <button
                type="button"
                onClick={() => setAssigneeOpen(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-soft)', border: '1px solid var(--rule)',
                  borderRadius: 'var(--r-md)', padding: '7px 10px', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: 13, color: selectedMembers.length ? 'var(--ink)' : 'var(--ink-faint)',
                  minHeight: 36,
                }}
              >
                {selectedMembers.length === 0 ? (
                  <span style={{ flex: 1, textAlign: 'left' }}>Pick team members…</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                    {selectedMembers.slice(0, 3).map((m, i) => {
                      const name = m.display_name || m.full_name || m.name || '';
                      return (
                        <span key={m.user_id || m.member_id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'var(--side-active)', borderRadius: 20,
                          padding: '2px 8px 2px 4px', fontSize: 12, fontWeight: 500,
                        }}>
                          <span style={{
                            width: 18, height: 18, borderRadius: '50%', fontSize: 9, fontWeight: 700,
                            background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>{userInitials(name)}</span>
                          {name.split(' ')[0]}
                        </span>
                      );
                    })}
                    {selectedMembers.length > 3 && (
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>+{selectedMembers.length - 3}</span>
                    )}
                  </div>
                )}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, color: 'var(--ink-3)' }}>
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </button>

              {/* Dropdown */}
              {assigneeOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                  background: 'var(--surface)', border: '1px solid var(--rule)',
                  borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  maxHeight: 220, overflowY: 'auto',
                }}>
                  {members.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                      {form.team_id ? 'No members found' : 'Select a project first'}
                    </div>
                  ) : (
                    members.map((m, i) => {
                      const uid = m.user_id || m.member_id;
                      const name = m.display_name || m.full_name || m.name || '';
                      if (!name) return null; // skip email-only members
                      const title = m.member_role || m.position || m.job_title || '';
                      const checked = selectedIds.includes(uid);
                      return (
                        <button
                          key={uid}
                          type="button"
                          onClick={() => toggleAssignee(uid)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', background: checked ? 'var(--side-active)' : 'transparent',
                            border: 'none', cursor: 'pointer', textAlign: 'left',
                            borderBottom: i < members.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                          }}
                        >
                          {/* Avatar */}
                          <span style={{
                            width: 30, height: 30, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                            background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>{userInitials(name)}</span>
                          {/* Name + title */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}>
                              {name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px', marginTop: 2 }}>
                              {title && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{title}</span>}
                              {title && m.company_name && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>·</span>}
                              {m.company_name && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.company_name}</span>}
                              {m.receives_approval_emails && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#05b7aa', background: '#05b7aa18', borderRadius: 4, padding: '1px 5px', marginTop: 1 }}>
                                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#05b7aa" strokeWidth="2"><path d="M1.5 5l3 3 4-4"/></svg>
                                  {m.role === 'client' ? 'Client Approver' : 'Internal Approver'}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Checkmark */}
                          {checked && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--k-primary)" strokeWidth="2" style={{ flexShrink: 0 }}>
                              <path d="M2 7l4 4 6-6"/>
                            </svg>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>DESCRIPTION · विवरण</label>
            <textarea
              className="k-input"
              rows={3}
              style={{ width: '100%', resize: 'vertical', lineHeight: 1.6 }}
              value={form.description}
              onChange={upd('description')}
              placeholder="Acceptance criteria, context, links..."
            />
          </div>

          {/* Attachments — shown for client requests and new tasks */}
          {(clientMode || !editing) && (
            <div>
              <label style={lbl}>ATTACHMENTS · संलग्नक</label>
              <FilesField
                value={attachments}
                onChange={setAttachments}
                readOnly={false}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', flex: 1 }}>↵ to create · Esc to close</span>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => onOpenChange(false)}>Cancel</button>
          <button className="k-btn k-btn--primary k-btn--sm" onClick={save} disabled={!form.title.trim()}>
            {editing ? 'Save changes' : clientMode ? 'Submit request' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl = {
  display: 'block',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  marginBottom: 6,
};
