/**
 * NewTaskModal.jsx — "New task" creation modal with bilingual design system.
 */
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

const PRIORITY_DOTS = {
  low:    { color: '#10b981', label: 'Low',    hi: 'लघु' },
  medium: { color: '#3b82f6', label: 'Medium', hi: 'मध्यम' },
  high:   { color: '#f59e0b', label: 'High',   hi: 'उच्च' },
  urgent: { color: '#dc2626', label: 'Urgent', hi: 'अत्यावश्यक' },
};

const MEMBER_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

export default function NewTaskModal({ open, onClose, onCreated }) {
  const [title,       setTitle]       = useState('');
  const [projectId,   setProjectId]   = useState('');
  const [status,      setStatus]      = useState('todo');
  const [priority,    setPriority]    = useState('medium');
  const [dueAt,       setDueAt]       = useState('');
  const [estimate,    setEstimate]    = useState('');
  const [description, setDescription] = useState('');
  const [assignees,   setAssignees]   = useState([]);
  const [files,       setFiles]       = useState([]); // [{name, url}]
  const [uploading,   setUploading]   = useState(false);
  const [projects,    setProjects]    = useState([]);
  const [members,     setMembers]     = useState([]);
  const [categoryId,  setCategoryId]  = useState('');
  const [categories,  setCategories]  = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [titleError,  setTitleError]  = useState(false);
  const fileRef = useRef(null);

  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle(''); setProjectId(''); setStatus('todo'); setPriority('medium');
    setDueAt(''); setEstimate(''); setDescription(''); setAssignees([]); setFiles([]); setCategoryId('');
    api.get('/categories').then(r => setCategories(r.data || [])).catch(() => {});
    api.get('/teams').then(r => setProjects(r.data)).catch(() => {});
    api.get('/teams').then(r => {
      const allMembers = [];
      r.data.forEach(t => (t.members || []).forEach(m => {
        if (!allMembers.find(x => x.user_id === m.user_id)) allMembers.push(m);
      }));
      setMembers(allMembers);
    }).catch(() => {});
    setTimeout(() => titleRef.current?.focus(), 80);
  }, [open]);

  // Fetch members when project changes
  useEffect(() => {
    if (!projectId) return;
    api.get(`/teams/${projectId}`).then(r => setMembers(r.data.members || [])).catch(() => {});
  }, [projectId]);

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
        setFiles(prev => [...prev, { name: file.name, url: res.data.url }]);
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
      if (projectId)             payload.team_id             = projectId;
      if (categoryId)            payload.category_id         = categoryId;
      if (dueAt)                 payload.due_at              = new Date(dueAt).toISOString();
      if (estimate)              payload.estimated_minutes   = Math.round(parseFloat(estimate) * 60);
      if (assignees.length)      payload.assignee_user_ids   = assignees;
      if (files.length)          payload.attachments         = files.map(f => ({ name: f.name, url: f.url }));
      await api.post('/tasks', payload);
      onCreated?.();
      onClose();
    } catch (_) {}
    finally { setSaving(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && e.target === titleRef.current) { e.preventDefault(); handleSubmit(); }
  };

  if (!open) return null;

  return (
    <div
      className="k-modal-scrim"
      style={{ zIndex: 300 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="k-modal">

        {/* Modal header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--k-primary)', marginBottom: 2 }}>
                NEW TASK · <span className="k-hi">नया कार्य</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                What needs doing?
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-3)', lineHeight: 1, padding: 4, marginTop: -2 }}>×</button>
          </div>
          <div style={{ height: 1, background: 'var(--rule-soft)', margin: '16px 0 0' }} />
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <input
              ref={titleRef}
              value={title}
              onChange={e => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(false); }}
              placeholder="Write a clear, action-first title…"
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${titleError ? '#dc2626' : 'var(--rule)'}`, outline: 'none', fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--ink)', background: 'transparent', paddingBottom: 10, fontWeight: 400, transition: 'border-color .15s' }}
            />
            {titleError && (
              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>Title is required to create a task.</div>
            )}
          </div>

          {/* PROJECT + STATUS row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                PROJECT · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>परियोजना</span>
              </div>
              <select className="k-select" style={{ width: '100%' }} value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.team_id} value={p.team_id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                STATUS · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>स्थिति</span>
              </div>
              <select className="k-select" style={{ width: '100%' }} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="in_review">In review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* PRIORITY */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
              PRIORITY · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>प्राथमिकता</span>
            </div>
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

          {/* DUE + ESTIMATE row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                DUE · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>नियत तिथि</span>
              </div>
              <input type="date" className="k-input" style={{ width: '100%' }} value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                ESTIMATE · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>अनुमान</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min="0" step="0.5" className="k-input" style={{ width: 80 }} value={estimate} onChange={e => setEstimate(e.target.value)} placeholder="2" />
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>hours</span>
              </div>
            </div>
          </div>

          {/* CATEGORY */}
          {categories.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                CATEGORY · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>श्रेणी</span>
              </div>
              <select className="k-select" style={{ width: '100%' }} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">— None —</option>
                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* ASSIGNEES */}
          {members.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
                ASSIGNEES · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>नियुक्त</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {members.map((m, i) => {
                  const uid = m.user_id;
                  const sel = assignees.includes(uid);
                  const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                  return (
                    <button key={uid} onClick={() => toggleAssignee(uid)} title={m.name || m.email || m.display_name}
                      style={{ width: 34, height: 34, borderRadius: '50%', background: sel ? color : `${color}30`, color: sel ? '#fff' : color, border: `2px solid ${sel ? color : 'transparent'}`, cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                      {initials(m.name || m.display_name || m.email)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DESCRIPTION */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
              DESCRIPTION · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>विवरण</span>
            </div>
            <textarea
              className="k-input"
              rows={3}
              style={{ resize: 'vertical', width: '100%', lineHeight: 1.6 }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Acceptance criteria, context, links…"
            />
          </div>

          {/* FILES */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
              ATTACHMENTS · <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0 }}>संलग्नक</span>
            </div>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--rule)', fontSize: 13 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--ink-3)" strokeWidth="1.5"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z"/><path d="M9 1v4h4"/></svg>
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ flex: 1, color: 'var(--k-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</a>
                    <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, border: '1.5px dashed var(--rule-strong)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 12V4M4 8l4-4 4 4"/><path d="M2 14h12"/></svg>
              {uploading ? 'Uploading…' : 'Attach files'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', flex: 1 }}>↵ to create · Esc to close</span>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={onClose}>Cancel</button>
          <button
            className="k-btn k-btn--primary k-btn--sm"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}
