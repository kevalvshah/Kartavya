/**
 * NewTaskModal.jsx — global "New task" modal. k-* design system.
 * Opened from the top-bar "+ New task" button (AppShell).
 */
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import ReminderPicker, { DEFAULT_REMINDERS } from './ReminderPicker';
import { formatDueDateTime } from '../lib/timeFormat';
import { AVATAR_COLORS, PRIORITY_COLOR, userInitials, logger } from '../lib/utils';import { currentUser } from '../lib/auth';

const PRIORITY_DOTS = {
  low:    { color: PRIORITY_COLOR.low,    label: 'Low',    hi: 'लघु' },
  medium: { color: PRIORITY_COLOR.medium, label: 'Medium', hi: 'मध्यम' },
  high:   { color: PRIORITY_COLOR.high,   label: 'High',   hi: 'उच्च' },
  urgent: { color: PRIORITY_COLOR.urgent, label: 'Urgent', hi: 'अत्यावश्यक' },
};

export default function NewTaskModal({ open, onClose, onCreated }) {  const isClient = currentUser()?.role === 'client';
  const [title,       setTitle]       = useState('');
  const [projectId,   setProjectId]   = useState('');
  const [status,      setStatus]      = useState('todo');
  const [priority,    setPriority]    = useState('medium');
  const [dueAt,       setDueAt]       = useState('');
  const [reminders,   setReminders]   = useState([]);
  const [description, setDescription] = useState('');
  const [assignees,   setAssignees]   = useState([]);
  const [files,       setFiles]       = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [projects,    setProjects]    = useState([]);
  const [members,     setMembers]     = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [titleError,  setTitleError]  = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const titleRef    = useRef(null);
  const fileRef     = useRef(null);
  const assigneeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle(''); setProjectId(''); setStatus('todo'); setPriority('medium');
    setDueAt(''); setReminders([]); setDescription(''); setAssignees([]); setFiles([]);
    setTitleError(false); setAssigneeOpen(false);
    api.get('/teams').then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    setTimeout(() => titleRef.current?.focus(), 80);
  }, [open]);

  // Fetch members when project changes
  useEffect(() => {
    if (!projectId) { setMembers([]); return; }
    api.get(`/teams/${projectId}`)
      .then(r => setMembers(Array.isArray(r.data?.members) ? r.data.members : []))
      .catch(() => setMembers([]));
  }, [projectId]);

  // Close assignee dropdown on outside click
  useEffect(() => {
    if (!assigneeOpen) return;
    const handler = (e) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setAssigneeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assigneeOpen]);

  const toggleAssignee = (uid) => {
    setAssignees(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length) return;
    setUploading(true);
    try {
      for (const file of picked) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/upload', fd);
        setFiles(prev => [...prev, { name: file.name, url: res.data.url, key: res.data.key || null }]);
      }
    } catch (_) {}
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setTitleError(true); titleRef.current?.focus(); return; }
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        status,
        priority,
        description: description.trim() || null,
      };
      if (projectId)        payload.team_id           = projectId;
      if (dueAt)            payload.due_at             = new Date(dueAt).toISOString();
      if (dueAt && reminders.length) {
        payload.reminders = reminders.map(r => ({
          offset_minutes: r.offset_minutes,
          channels: Object.entries(r.channels).filter(([, v]) => v).map(([k]) => k),
        }));
      }
      if (assignees.length) payload.assignee_user_ids  = assignees;
      if (files.length)     payload.attachments        = files.map(f => ({ name: f.name, url: f.url, key: f.key || null }));
      await (isClient ? api.post('/client/tasks/request', payload) : api.post('/tasks', payload));
      onCreated?.();
      onClose();
    } catch (err) {
      logger.error('Task creation failed', err);
    }
    finally { setSaving(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && e.target === titleRef.current) { e.preventDefault(); handleSubmit(); }
  };

  if (!open) return null;

  const selectedMembers = members.filter(m => assignees.includes(m.user_id));

  return (
    <div
      className="k-modal-scrim"
      style={{ zIndex: 300 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="k-modal">

        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--k-primary)', marginBottom: 2 }}>
                {isClient ? 'REQUEST TASK' : 'NEW TASK'} · <span style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>{isClient ? 'अनुरोध' : 'नया कार्य'}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                What needs doing?
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-3)', lineHeight: 1, padding: 4, marginTop: -2 }}>×</button>
          </div>
          <div style={{ height: 1, background: 'var(--rule-soft)', margin: '16px 0 0' }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <input
              ref={titleRef}
              value={title}
              onChange={e => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(false); }}
              placeholder="Write a clear, action-first title…"
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${titleError ? '#dc2626' : 'var(--rule)'}`, outline: 'none', fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--ink)', background: 'transparent', paddingBottom: 10, fontWeight: 400 }}
            />
            {titleError && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>Title is required.</div>}
          </div>

          {/* PROJECT + STATUS */}
          <div style={{ display: 'grid', gridTemplateColumns: isClient ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>PROJECT · परियोजना</FieldLabel>
              <select className="k-select" style={{ width: '100%' }} value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Personal task</option>
                {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
              </select>
            </div>
            {!isClient && (
            <div>
              <FieldLabel>STATUS · स्थिति</FieldLabel>
              <select className="k-select" style={{ width: '100%' }} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="in_review">In review</option>
                <option value="done">Done</option>
              </select>
            </div>
            )}
          </div>

          {/* PRIORITY */}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>PRIORITY · प्राथमिकता</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(PRIORITY_DOTS).map(([key, { color, label }]) => (
                <button key={key} onClick={() => setPriority(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${priority === key ? color : 'var(--rule)'}`, background: priority === key ? `${color}18` : 'transparent', color: priority === key ? color : 'var(--ink-3)', cursor: 'pointer', fontSize: 13, fontWeight: priority === key ? 700 : 400, transition: 'all 0.15s' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* DUE + ASSIGNEES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>DUE · नियत तिथि</FieldLabel>
              <input
                type="datetime-local"
                className="k-input"
                style={{ width: '100%' }}
                value={dueAt}
                onChange={e => {
                  let val = e.target.value;
                  // If user picks a date without changing the time, default to 16:00
                  if (val && val.slice(-5) === '00:00') val = val.slice(0, -5) + '16:00';
                  setDueAt(val);
                  if (!val) setReminders([]);
                  else if (reminders.length === 0) setReminders(DEFAULT_REMINDERS);
                }}
              />
              {dueAt && (
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDueDateTime(new Date(dueAt).toISOString())}</span>
              )}
              <div style={{ marginTop: 8 }}>
                <ReminderPicker value={reminders} onChange={setReminders} disabled={!dueAt} />
              </div>
            </div>

            {/* Assignee dropdown */}
            <div ref={assigneeRef} style={{ position: 'relative' }}>
              <FieldLabel>ASSIGNEES · नियुक्त</FieldLabel>
              <button
                type="button"
                onClick={() => setAssigneeOpen(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-soft)', border: '1px solid var(--rule)',
                  borderRadius: 'var(--r-md)', padding: '7px 10px', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: 13,
                  color: selectedMembers.length ? 'var(--ink)' : 'var(--ink-faint)',
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
                        <span key={m.user_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--side-active)', borderRadius: 20, padding: '2px 8px 2px 4px', fontSize: 12, fontWeight: 500 }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 9, fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {userInitials(name)}
                          </span>
                          {name.split(' ')[0]}
                        </span>
                      );
                    })}
                    {selectedMembers.length > 3 && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>+{selectedMembers.length - 3}</span>}
                  </div>
                )}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, color: 'var(--ink-3)' }}>
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </button>

              {assigneeOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxHeight: 220, overflowY: 'auto' }}>
                  {members.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                      {projectId ? 'No members found' : 'Select a project first'}
                    </div>
                  ) : (
                    members.map((m, i) => {
                      const uid     = m.user_id;
                      const name    = m.display_name || m.full_name || m.name || '';
                      if (!name) return null; // skip email-only members
                      const jobTitle = m.member_role || m.position || m.job_title || '';
                      const checked = assignees.includes(uid);
                      return (
                        <button
                          key={uid}
                          type="button"
                          onClick={() => toggleAssignee(uid)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: checked ? 'var(--side-active)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < members.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}
                        >
                          <span style={{ width: 30, height: 30, borderRadius: '50%', fontSize: 11, fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {userInitials(name)}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}>{name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px', marginTop: 2 }}>
                              {jobTitle && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{jobTitle}</span>}
                              {jobTitle && m.company_name && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>·</span>}
                              {m.company_name && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.company_name}</span>}
                              {m.receives_approval_emails && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#05b7aa', background: '#05b7aa18', borderRadius: 4, padding: '1px 5px', marginTop: 1 }}>
                                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#05b7aa" strokeWidth="2"><path d="M1.5 5l3 3 4-4"/></svg>
                                  {m.role === 'client' ? 'Client Approver' : 'Internal Approver'}
                                </span>
                              )}
                            </div>
                          </div>
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

          {/* DESCRIPTION */}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>DESCRIPTION · विवरण</FieldLabel>
            <textarea
              className="k-input"
              rows={3}
              style={{ resize: 'vertical', width: '100%', lineHeight: 1.6 }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Acceptance criteria, context, links…"
            />
          </div>

          {/* ATTACHMENTS */}
          <div>
            <FieldLabel>ATTACHMENTS · संलग्नक</FieldLabel>
            <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt" style={{ display: 'none' }} onChange={handleFileChange} />
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--rule)', fontSize: 13 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--k-primary)" strokeWidth="1.5"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z"/><path d="M9 1v4h4"/></svg>
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ flex: 1, color: 'var(--ink-2)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</a>
                    <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
                {files.length < 5 && !uploading && (
                  <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1.5px dashed var(--rule-strong)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v10M3 8h10"/></svg>
                    Add more
                  </button>
                )}
              </div>
            )}
            {files.length === 0 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', padding: '20px 14px', borderRadius: 10, border: '1.5px dashed var(--rule-strong)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }}
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 12V4M4 8l4-4 4 4"/><path d="M2 14h12"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{uploading ? 'Uploading…' : 'Drop files or click to browse'}</span>
                <span style={{ fontSize: 11, lineHeight: 1.6, textAlign: 'center' }}>Computer · Google Drive · OneDrive · Dropbox<br/>Images, PDF, Word, Excel · max 5 MB each</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', flex: 1 }}>↵ to create · Esc to close</span>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={onClose}>Cancel</button>
          <button className="k-btn k-btn--primary k-btn--sm" onClick={handleSubmit} disabled={saving}>
            {saving ? (isClient ? 'Submitting…' : 'Creating…') : (isClient ? 'Submit request' : 'Create task')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
      {children}
    </div>
  );
}
