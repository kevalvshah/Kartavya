import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import FieldRenderer from './fields/FieldRenderer';
import MentionTextarea from './MentionTextarea';
import ActivityList from './ActivityList';
import { Paperclip, ExternalLink, Trash2, Play, Square, Clock } from 'lucide-react';

const PRIORITY_COLORS  = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };
const PRIORITY_LABELS  = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const STATUS_LABELS    = { todo: 'To do', in_progress: 'In progress', done: 'Done', requested: 'Requested' };
const STATUS_COLORS    = { todo: '#64748b', in_progress: '#0082c6', done: '#16a34a', requested: '#9333ea' };

const lbl = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-3)',
  marginBottom: 5, display: 'block',
};

function fmtMinutes(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const base = Date.now() - new Date(startedAt).getTime();
    setElapsed(base);
    const id = setInterval(() => setElapsed(Date.now() - new Date(startedAt).getTime()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const s = Math.floor(elapsed / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
      {h ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}
    </span>
  );
}

function FileChip({ file, onRemove }) {
  const name = file.name || file.url?.split('/').pop() || 'File';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-soft)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', fontSize: 12 }}>
      <Paperclip size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      <a href={file.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-2)', textDecoration: 'none', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </a>
      <ExternalLink size={10} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      {onRemove && (
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex' }}>
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

const APPROVAL_STATUS_LABEL = {
  pending:        'Awaiting Approval',
  pending_client: 'Awaiting Client Approval',
  approved:       'Approved',
  rejected:       'Rejected',
};
const APPROVAL_STATUS_COLOR = {
  pending:        '#d97706',
  pending_client: '#7c3aed',
  approved:       '#16a34a',
  rejected:       '#dc2626',
};

export default function TaskDrawer({ taskId, open, onClose, onSaved, teamMembers = [] }) {
  const me = currentUser();

  const [task,       setTask]       = useState(null);
  const [fields,     setFields]     = useState([]);
  const [fValues,    setFValues]    = useState({});
  const [comments,   setComments]   = useState([]);
  const [activity,   setActivity]   = useState([]);
  const [actLoad,    setActLoad]    = useState(false);
  const [entries,    setEntries]    = useState([]);
  const [timer,      setTimer]      = useState(null);
  const [comment,    setComment]    = useState('');
  const [tab,        setTab]        = useState('details');
  const [saving,     setSaving]     = useState(false);
  const [draft,      setDraft]      = useState({});
  const [categories, setCategories] = useState([]);
  const [manualMin,  setManualMin]  = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef(null);

  // Approval UI state
  const [approvalLoading,  setApprovalLoading]  = useState(false);
  const [approvalNotes,    setApprovalNotes]    = useState('');
  const [sendToClient,     setSendToClient]     = useState(false);
  const [clientList,       setClientList]       = useState([]);
  const [clientUserId,     setClientUserId]     = useState('');
  const [showRejectInput,  setShowRejectInput]  = useState(false);
  const [rejectNote,       setRejectNote]       = useState('');
  const [showApprovePanel, setShowApprovePanel] = useState(false);
  const [requestNotes,     setRequestNotes]     = useState('');
  const [showRequestPanel, setShowRequestPanel] = useState(false);

  const mentionMembers = teamMembers.map(m => ({
    user_id:      m.user_id,
    display_name: m.display_name || m.full_name || m.email || 'Unknown',
  }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !taskId) return;
    setTab('details');
    setTask(null); setFields([]); setFValues({});
    setComments([]); setActivity([]); setEntries([]); setTimer(null); setAttachments([]);

    api.get('/categories').then(r => setCategories(r.data || [])).catch(() => {});

    Promise.all([
      api.get(`/tasks/${taskId}`),
      api.get(`/tasks/${taskId}/comments`),
    ]).then(([tRes, cRes]) => {
      const t = tRes.data;
      setTask(t);
      setDraft({ title: t.title, description: t.description, priority: t.priority, due_at: t.due_at, status: t.status, category_id: t.category_id || '' });
      setComments(cRes.data);
      // Parse existing attachments
      const att = t.attachments || [];
      setAttachments(Array.isArray(att) ? att.map(a => typeof a === 'string' ? { url: a, name: a.split('/').pop() } : a) : []);
      if (t.team_id) {
        api.get(`/fields/team/${t.team_id}`).then(r => {
          const defs = r.data.map(f =>
            f.type === 'person' ? { ...f, config: { ...f.config, members: mentionMembers } } : f
          );
          setFields(defs);
        });
        api.get(`/fields/task/${taskId}/values`).then(r => {
          const vals = {};
          r.data.forEach(v => { vals[v.field_id] = v.value; });
          setFValues(vals);
        });
      }
    }).catch(console.error);
  }, [open, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'activity' || !taskId) return;
    setActLoad(true);
    api.get(`/activity/task/${taskId}`)
       .then(r => setActivity(r.data))
       .catch(console.error)
       .finally(() => setActLoad(false));
  }, [tab, taskId]);

  useEffect(() => {
    if (tab !== 'time' || !taskId) return;
    api.get(`/time/task/${taskId}`)
       .then(r => { setEntries(r.data.entries || []); setTimer(r.data.active_entry || null); })
       .catch(console.error);
  }, [tab, taskId]);

  const saveFieldValue = useCallback(async (field_id, value) => {
    setFValues(prev => ({ ...prev, [field_id]: value }));
    try { await api.put(`/fields/task/${taskId}/values`, [{ field_id, value }]); }
    catch (e) { console.error('Field save failed', e); }
  }, [taskId]);

  const saveTask = useCallback(async (patch) => {
    setSaving(true);
    try {
      const res = await api.put(`/tasks/${taskId}`, patch);
      setTask(res.data);
      onSaved?.(res.data);
    } catch (e) { console.error('Save failed', e); }
    finally { setSaving(false); }
  }, [taskId, onSaved]);

  const postComment = async () => {
    if (!comment.trim()) return;
    const res = await api.post(`/tasks/${taskId}/comments`, { body: comment });
    setComments(prev => [...prev, res.data]);
    setComment('');
  };

  const startTimer = async () => { const res = await api.post(`/time/start?task_id=${taskId}`); setTimer(res.data); };
  const stopTimer  = async () => { const res = await api.post('/time/stop'); setTimer(null); setEntries(prev => [res.data, ...prev]); };
  const addManual  = async () => {
    const mins = parseInt(manualMin);
    if (!mins || mins < 1) return;
    const res = await api.post('/time/manual', { task_id: taskId, minutes: mins, description: manualDesc });
    setEntries(prev => [res.data, ...prev]);
    setManualMin(''); setManualDesc('');
  };
  const deleteEntry = async (id) => { await api.delete(`/time/${id}`); setEntries(prev => prev.filter(e => e.entry_id !== id)); };

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length) return;
    setUploading(true);
    try {
      const newFiles = [];
      for (const file of picked) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/upload', fd);
        newFiles.push({ name: file.name, url: res.data.url });
      }
      const updated = [...attachments, ...newFiles];
      setAttachments(updated);
      await saveTask({ attachments: updated.map(f => f.url) });
    } catch (err) { console.error('Upload failed', err); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeAttachment = async (idx) => {
    const updated = attachments.filter((_, i) => i !== idx);
    setAttachments(updated);
    await saveTask({ attachments: updated.map(f => f.url) });
  };

  const isOwnerAdmin = me?.role === 'admin' || me?.role === 'owner';
  const isClient = me?.role === 'client';

  const requestApproval = async () => {
    setApprovalLoading(true);
    try {
      const res = await api.post(`/tasks/${taskId}/request-approval`, { notes: requestNotes });
      setTask(t => ({ ...t, approval_status: res.data.approval_status }));
      setShowRequestPanel(false); setRequestNotes('');
    } catch (e) { console.error(e); }
    finally { setApprovalLoading(false); }
  };

  const openApprovePanel = () => {
    setShowApprovePanel(true);
    setClientList([]); setClientUserId('');
    if (task?.team_id) {
      api.get(`/teams/${task.team_id}/clients`)
        .then(r => setClientList(r.data || []))
        .catch(() => {});
    }
  };

  const approveTask = async () => {
    setApprovalLoading(true);
    const approvalId = `task_approval::${taskId}`;
    const selected = clientList.find(c => c.user_id === clientUserId);
    try {
      const res = await api.post(`/approvals/${approvalId}/review`, {
        status: 'approved',
        notes: approvalNotes,
        send_to_client: !!selected,
        client_email: selected ? selected.email : '',
      });
      setTask(t => ({ ...t, approval_status: res.data.status }));
      setShowApprovePanel(false); setApprovalNotes(''); setSendToClient(false); setClientUserId('');
      if (res.data.status !== 'pending_client') onSaved?.({ ...task, approval_status: res.data.status });
    } catch (e) { console.error(e); }
    finally { setApprovalLoading(false); }
  };

  const rejectTask = async () => {
    if (!rejectNote.trim()) return;
    setApprovalLoading(true);
    const approvalId = `task_approval::${taskId}`;
    try {
      await api.post(`/approvals/${approvalId}/review`, { status: 'rejected', notes: rejectNote });
      setTask(t => ({ ...t, approval_status: 'rejected' }));
      setShowRejectInput(false); setRejectNote('');
    } catch (e) { console.error(e); }
    finally { setApprovalLoading(false); }
  };

  const clientApproveTask = async () => {
    setApprovalLoading(true);
    try {
      await api.post(`/tasks/${taskId}/client-approve`, { notes: '' });
      setTask(t => ({ ...t, approval_status: 'approved' }));
      onSaved?.({ ...task, approval_status: 'approved' });
    } catch (e) { console.error(e); }
    finally { setApprovalLoading(false); }
  };

  const clientRejectTask = async () => {
    if (!rejectNote.trim()) return;
    setApprovalLoading(true);
    try {
      await api.post(`/tasks/${taskId}/client-reject`, { notes: rejectNote });
      setTask(t => ({ ...t, approval_status: 'rejected' }));
      setShowRejectInput(false); setRejectNote('');
    } catch (e) { console.error(e); }
    finally { setApprovalLoading(false); }
  };

  if (!open) return null;

  const tabs = [
    ['details',  'Details',  'विवरण'],
    ['files',    'Files',    'फ़ाइलें'],
    ['activity', 'Activity', 'क्रिया'],
    ['time',     'Time',     'काल'],
  ];

  return (
    <div className="k-dr-scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="k-dr">

        {/* Breadcrumb / header */}
        <div className="k-dr__head">
          <div className="k-dr__crumb">
            {task?.team_id && (
              <>
                <span style={{ color: 'var(--ink-3)' }}>{task.team_name || 'Project'}</span>
                <span style={{ color: 'var(--rule-strong)' }}>/</span>
              </>
            )}
            <span style={{ padding: '2px 7px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, background: STATUS_COLORS[draft.status] + '18', color: STATUS_COLORS[draft.status] }}>
              {STATUS_LABELS[draft.status] || draft.status}
            </span>
          </div>
          <div className="k-dr__head-actions">
            {saving && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 6, alignSelf: 'center' }}>Saving…</span>}
            <button onClick={onClose} className="k-iconbtn" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="k-dr__title">
          {task ? (
            <input
              value={draft.title || ''}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              onBlur={() => draft.title !== task.title && saveTask({ title: draft.title })}
              style={{ width: '100%', border: 'none', outline: 'none', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, background: 'transparent', color: 'var(--ink)', padding: 0 }}
            />
          ) : (
            <div style={{ height: 28, background: 'var(--rule-soft)', borderRadius: 4, width: '65%' }} />
          )}
          {task && <div className="k-dr__id">#{task.task_id?.slice(-6)}</div>}
        </div>

        {/* Props row */}
        {task && (
          <div className="k-dr__props">
            <div className="k-prop">
              <span className="k-prop__lbl">Priority <span className="k-prop__sans">प्राथमिकता</span></span>
              <select
                value={draft.priority || 'medium'}
                onChange={e => { setDraft(d => ({ ...d, priority: e.target.value })); saveTask({ priority: e.target.value }); }}
                className="k-input"
                style={{ color: PRIORITY_COLORS[draft.priority || 'medium'], fontWeight: 600, fontSize: 13 }}
              >
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="k-prop">
              <span className="k-prop__lbl">Due date <span className="k-prop__sans">समय-सीमा</span></span>
              <input
                type="date" className="k-input"
                value={draft.due_at ? draft.due_at.slice(0, 10) : ''}
                onChange={e => { const v = e.target.value ? new Date(e.target.value).toISOString() : null; setDraft(d => ({ ...d, due_at: v })); saveTask({ due_at: v }); }}
              />
            </div>
            <div className="k-prop">
              <span className="k-prop__lbl">Category <span className="k-prop__sans">श्रेणी</span></span>
              <select
                value={draft.category_id || ''}
                onChange={e => { const v = e.target.value || null; setDraft(d => ({ ...d, category_id: v })); saveTask({ category_id: v }); }}
                className="k-input"
              >
                <option value="">— None —</option>
                {categories.map(c => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="k-dr__tabs">
          {tabs.map(([id, label, sans]) => (
            <button key={id} className={`k-dr__tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
              {label}
              <span className="k-dr__tab-sans">{sans}</span>
              {id === 'files' && attachments.length > 0 && (
                <span className="k-dr__tab-count">{attachments.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="k-dr__body">

          {/* ── Details ── */}
          {tab === 'details' && task && (
            <>
              <div style={{ marginBottom: 20 }}>
                <span style={lbl}>Description <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)', fontWeight: 400 }}>विवरण</span></span>
                <textarea
                  className="k-input"
                  value={draft.description || ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  onBlur={() => draft.description !== task.description && saveTask({ description: draft.description })}
                  rows={5}
                  style={{ width: '100%', resize: 'vertical', lineHeight: 1.65, fontSize: 13 }}
                  placeholder="Add a description…"
                />
              </div>

              {fields.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <span style={lbl}>Custom Fields</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                    {fields.map(f => (
                      <div key={f.field_id}>
                        <span style={lbl}>{f.name}</span>
                        <FieldRenderer field={f} value={fValues[f.field_id] ?? null} onChange={v => saveFieldValue(f.field_id, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Approval section ── */}
              {task.team_id && (
                <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-soft)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: task.approval_status ? 10 : 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                      Approval <span style={{ fontFamily: 'var(--font-hindi)', textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: 12 }}>अनुमोदन</span>
                    </span>
                    {task.approval_status && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                        color: APPROVAL_STATUS_COLOR[task.approval_status] || '#64748b',
                        background: (APPROVAL_STATUS_COLOR[task.approval_status] || '#64748b') + '18',
                        border: `1px solid ${(APPROVAL_STATUS_COLOR[task.approval_status] || '#64748b')}40`,
                      }}>
                        {APPROVAL_STATUS_LABEL[task.approval_status] || task.approval_status}
                      </span>
                    )}
                  </div>

                  {/* Request approval (anyone, if no pending approval) */}
                  {!task.approval_status && !showRequestPanel && (
                    <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowRequestPanel(true)}
                      style={{ marginTop: 4, fontSize: 12 }}>
                      ↑ Send for Approval
                    </button>
                  )}
                  {showRequestPanel && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)}
                        placeholder="Notes for the approver (optional)…" rows={2} className="k-input"
                        style={{ width: '100%', resize: 'none', boxSizing: 'border-box', fontSize: 12 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowRequestPanel(false)}>Cancel</button>
                        <button className="k-btn k-btn--primary k-btn--sm" onClick={requestApproval} disabled={approvalLoading}>
                          {approvalLoading ? '…' : '↑ Send for Approval'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Re-send if rejected */}
                  {task.approval_status === 'rejected' && !showRequestPanel && (
                    <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowRequestPanel(true)}
                      style={{ marginTop: 6, fontSize: 12 }}>
                      ↑ Re-send for Approval
                    </button>
                  )}

                  {/* Admin: approve/reject when pending */}
                  {isOwnerAdmin && task.approval_status === 'pending' && !showApprovePanel && !showRejectInput && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button className="k-btn k-btn--primary k-btn--sm" onClick={openApprovePanel}>✓ Approve</button>
                      <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowRejectInput(true)}
                        style={{ color: 'var(--k-danger)' }}>✕ Reject</button>
                    </div>
                  )}

                  {/* Admin: approve panel with client option */}
                  {showApprovePanel && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)}
                        placeholder="Notes (optional)…" rows={2} className="k-input"
                        style={{ width: '100%', resize: 'none', boxSizing: 'border-box', fontSize: 12 }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 5 }}>Send to client for approval?</div>
                        {clientList.length === 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>No clients on this project.</div>
                        ) : (
                          <select value={clientUserId} onChange={e => setClientUserId(e.target.value)}
                            className="k-input" style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}>
                            <option value="">— Skip, mark as Done —</option>
                            {clientList.map(c => (
                              <option key={c.user_id} value={c.user_id}>
                                {c.display_name}{c.email ? ` (${c.email})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowApprovePanel(false)}>Cancel</button>
                        <button className="k-btn k-btn--primary k-btn--sm" onClick={approveTask} disabled={approvalLoading}>
                          {approvalLoading ? '…' : clientUserId ? '✓ Approve & Send to Client' : '✓ Approve & Done'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Admin: reject panel */}
                  {showRejectInput && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                        placeholder="Reason for rejection (required)…" rows={2} className="k-input"
                        style={{ width: '100%', resize: 'none', boxSizing: 'border-box', fontSize: 12 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowRejectInput(false)}>Cancel</button>
                        <button className="k-btn k-btn--ghost k-btn--sm" onClick={rejectTask}
                          disabled={approvalLoading || !rejectNote.trim()}
                          style={{ color: 'var(--k-danger)', borderColor: 'var(--k-danger)' }}>
                          {approvalLoading ? '…' : '✕ Reject'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Client: approve/reject buttons when pending_client */}
                  {isClient && task.approval_status === 'pending_client' && !showRejectInput && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button className="k-btn k-btn--primary k-btn--sm" onClick={clientApproveTask} disabled={approvalLoading}>
                        {approvalLoading ? '…' : '✓ Approve'}
                      </button>
                      <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowRejectInput(true)}
                        style={{ color: 'var(--k-danger)' }}>
                        ✕ Reject
                      </button>
                    </div>
                  )}
                  {isClient && task.approval_status === 'pending_client' && showRejectInput && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                        placeholder="Reason for rejection (required)…" rows={2} className="k-input"
                        style={{ width: '100%', resize: 'none', boxSizing: 'border-box', fontSize: 12 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowRejectInput(false)}>Cancel</button>
                        <button className="k-btn k-btn--ghost k-btn--sm" onClick={clientRejectTask}
                          disabled={approvalLoading || !rejectNote.trim()}
                          style={{ color: 'var(--k-danger)', borderColor: 'var(--k-danger)' }}>
                          {approvalLoading ? '…' : '✕ Reject'}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Internal users: no action while awaiting client */}
                  {!isClient && task.approval_status === 'pending_client' && (
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '8px 0 0' }}>
                      Approval request sent to client. Waiting for their response.
                    </p>
                  )}
                </div>
              )}

              <div>
                <span style={{ ...lbl, marginBottom: 10 }}>Comments <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)', fontWeight: 400 }}>टिप्पणियाँ</span></span>
                {comments.length === 0 && <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 12 }}>No comments yet.</p>}
                {comments.map(c => (
                  <div key={c.comment_id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'color-mix(in srgb, var(--k-primary) 15%, var(--surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--k-primary)', flexShrink: 0 }}>
                      {c.user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name}</span>{' '}
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
                      <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                        {c.body.split(/(@[\w.-]+)/g).map((part, i) =>
                          part.startsWith('@')
                            ? <strong key={i} style={{ color: 'var(--k-primary)' }}>{part}</strong>
                            : part
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <MentionTextarea value={comment} onChange={setComment} onSubmit={postComment}
                    members={mentionMembers} placeholder="Add a comment… type @ to mention" rows={2} />
                  <button onClick={postComment} className="k-btn k-btn--primary k-btn--sm">Send</button>
                </div>
              </div>
            </>
          )}

          {tab === 'details' && !task && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[65, 40, 80, 40].map((w, i) => (
                <div key={i} style={{ height: 14, background: 'var(--rule-soft)', borderRadius: 4, width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* ── Files ── */}
          {tab === 'files' && (
            <div>
              <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
              <button
                className="k-btn k-btn--ghost k-btn--sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Paperclip size={13} />
                {uploading ? 'Uploading…' : 'Attach files'}
              </button>

              {attachments.length === 0 && !uploading && (
                <div className="k-empty" style={{ paddingTop: 40 }}>
                  <div className="k-empty__icon"><Paperclip size={24} /></div>
                  <div className="k-empty__title">No files yet</div>
                  <div className="k-empty__sub">Attach documents, images, or any file to this task.</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attachments.map((f, i) => (
                  <FileChip key={i} file={f} onRemove={() => removeAttachment(i)} />
                ))}
              </div>
            </div>
          )}

          {/* ── Activity ── */}
          {tab === 'activity' && <ActivityList events={activity} loading={actLoad} />}

          {/* ── Time ── */}
          {tab === 'time' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: 'var(--bg-soft)', borderRadius: 'var(--r-md)', border: '1px solid var(--rule)' }}>
                {timer ? (
                  <>
                    <button onClick={stopTimer} className="k-btn k-btn--sm" style={{ background: '#dc2626', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Square size={11} /> Stop
                    </button>
                    <Clock size={13} style={{ color: 'var(--ink-3)' }} />
                    <ElapsedTimer startedAt={timer.started_at} />
                  </>
                ) : (
                  <button onClick={startTimer} className="k-btn k-btn--primary k-btn--sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Play size={11} /> Start Timer
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
                <input type="number" min="1" value={manualMin} onChange={e => setManualMin(e.target.value)}
                  placeholder="mins" className="k-input" style={{ width: 70 }} />
                <input value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                  placeholder="Description (optional)" className="k-input" style={{ flex: 1 }} />
                <button onClick={addManual} className="k-btn k-btn--ghost k-btn--sm">+ Log</button>
              </div>

              {entries.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No time logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {entries.map(e => (
                    <div key={e.entry_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--rule-soft)', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-2)' }}>{e.description || <span style={{ color: 'var(--ink-3)' }}>No description</span>}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtMinutes(e.minutes)}</strong>
                        <button onClick={() => deleteEntry(e.entry_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, paddingTop: 10, color: 'var(--ink-2)' }}>
                    Total: {fmtMinutes(entries.reduce((sum, e) => sum + (e.minutes || 0), 0))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
