/**
 * TaskEditor.jsx — full task modal with approvals, attachments, comments, subtasks.
 * Extracted from App.js monolith.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { K, KLogo } from '../lib/brand';
import { currentUser, formatDue, toLocal, fromLocal, approvalBadgeStyle } from '../lib/auth';
import { useToast } from './ui/toast';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { X, Calendar } from 'lucide-react';

function F({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );
}

export default function TaskEditor({ open, onOpenChange, editing, categories, teams, defaultTeamId, defaultColumnId, columns, onSaved, isClientMode = false }) {
  const { pushToast } = useToast();
  const [teamMembers, setTeamMembers]       = useState([]);
  const [yourRole,    setYourRole]          = useState('member');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [uploading,   setUploading]         = useState(false);
  const fileInputRef = useRef(null);
  const [comments,    setComments]          = useState([]);
  const [newComment,  setNewComment]        = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [approvalNotes,  setApprovalNotes]  = useState('');
  const [clientEmail,    setClientEmail]    = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const currentUserMe = currentUser();
  const isClientUser  = currentUserMe?.role === 'client';

  const [taskState, setTaskState] = useState(editing);
  useEffect(() => { setTaskState(editing); }, [editing]);

  const refreshTask = async () => {
    if (!taskState?.task_id) return;
    try { const r = await api.get(`/tasks/${taskState.task_id}`).catch(() => null); if (r?.data) setTaskState(r.data); } catch (_) {}
  };

  const blank = useMemo(() => ({
    title: '', description: '', priority: 'medium', category_id: '', tags: '',
    team_id: defaultTeamId || '', column_id: defaultColumnId || '',
    assign_scope: 'none', assignee_user_ids: [],
    due_at: '', reminder_at: '', estimated_minutes: '',
    recurrence_rule: 'none', recurrence_interval: 1,
    attachments: [], custom_fields_text: '{}', subtasks: [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [defaultTeamId, defaultColumnId]);

  const initial = useMemo(() => {
    if (!editing) return blank;
    return {
      title: editing.title || '', description: editing.description || '',
      priority: editing.priority || 'medium', category_id: editing.category_id || '',
      tags: (editing.tags || []).join(', '),
      team_id: editing.team_id || defaultTeamId || '',
      column_id: editing.column_id || defaultColumnId || '',
      assign_scope: (editing.assignee_user_ids || []).length ? 'members' : 'none',
      assignee_user_ids: editing.assignee_user_ids || [],
      due_at: toLocal(editing.due_at), reminder_at: toLocal(editing.reminder_at),
      estimated_minutes: editing.estimated_minutes ? String(editing.estimated_minutes) : '',
      recurrence_rule: editing.recurrence?.rule || 'none', recurrence_interval: editing.recurrence?.interval || 1,
      attachments: editing.attachments || [],
      custom_fields_text: JSON.stringify(editing.custom_fields || {}, null, 2),
      subtasks: editing.subtasks || [],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, defaultTeamId, defaultColumnId]);

  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  useEffect(() => {
    if (!open || !form.team_id) { setTeamMembers([]); setYourRole('member'); return; }
    let live = true; setLoadingMembers(true);
    api.get(`/teams/${form.team_id}`)
      .then(r => { if (!live) return; setTeamMembers((r.data.members || []).filter(m => m.status === 'active' && m.user_id)); setYourRole(r.data.your_role || 'member'); })
      .catch(() => { if (!live) return; setTeamMembers([]); setYourRole('member'); })
      .finally(() => { if (live) setLoadingMembers(false); });
    return () => { live = false; };
  }, [open, form.team_id]);

  const canAssign = !form.team_id || yourRole === 'owner' || yourRole === 'admin';
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open || !taskState?.task_id) { setComments([]); return; }
    let live = true;
    api.get(`/tasks/${taskState.task_id}/comments`)
      .then(r => { if (live) setComments(r.data || []); })
      .catch(() => { if (live) setComments([]); });
    return () => { live = false; };
  }, [open, taskState?.task_id]);

  const postComment = async () => {
    if (!newComment.trim() || !taskState?.task_id) return;
    setPostingComment(true);
    try {
      const r = await api.post(`/tasks/${taskState.task_id}/comments`, { body: newComment.trim() });
      setComments(p => [...p, r.data]); setNewComment('');
    } catch (_) { pushToast({ type: 'error', title: 'Could not post comment' }); }
    finally { setPostingComment(false); }
  };

  const submitApprovalAction = async () => {
    if (!taskState?.task_id) return;
    setSubmittingApproval(true);
    try {
      if (approvalAction === 'owner') {
        await api.post(`/tasks/${taskState.task_id}/request-approval`, { notes: approvalNotes });
        pushToast({ type: 'success', title: 'Sent for owner approval' });
      } else if (approvalAction === 'client') {
        if (!clientEmail.trim()) { pushToast({ type: 'error', title: 'Client email required' }); setSubmittingApproval(false); return; }
        await api.post(`/tasks/${taskState.task_id}/request-client-approval`, { client_email: clientEmail.trim(), notes: approvalNotes });
        pushToast({ type: 'success', title: 'Sent to client for approval' });
      } else if (approvalAction === 'approve') {
        await api.post(`/tasks/${taskState.task_id}/approve`, { notes: approvalNotes });
        pushToast({ type: 'success', title: 'Approved' });
      } else if (approvalAction === 'reject') {
        if (!approvalNotes.trim()) { pushToast({ type: 'error', title: 'Reason required' }); setSubmittingApproval(false); return; }
        await api.post(`/tasks/${taskState.task_id}/reject`, { notes: approvalNotes });
        pushToast({ type: 'success', title: 'Rejected' });
      } else if (approvalAction === 'client-approve') {
        await api.post(`/tasks/${taskState.task_id}/client-approve`, { notes: approvalNotes });
        pushToast({ type: 'success', title: 'Approved' });
      } else if (approvalAction === 'client-reject') {
        if (!approvalNotes.trim()) { pushToast({ type: 'error', title: 'Reason required' }); setSubmittingApproval(false); return; }
        await api.post(`/tasks/${taskState.task_id}/client-reject`, { notes: approvalNotes });
        pushToast({ type: 'success', title: 'Sent back for revision' });
      }
      setApprovalAction(null); setApprovalNotes(''); setClientEmail('');
      await refreshTask();
      onSaved?.(taskState);
    } catch (e) {
      pushToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.detail || 'Try again' });
    } finally { setSubmittingApproval(false); }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const MAX_SIZE = 5 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_SIZE) { pushToast({ type: 'error', title: `File "${file.name}" exceeds 5MB limit` }); return; }
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const r = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploaded.push({ name: file.name, url: r.data.url });
      }
      upd('attachments', [...(form.attachments || []), ...uploaded]);
      pushToast({ type: 'success', title: 'Files uploaded' });
    } catch (err) {
      pushToast({ type: 'error', title: 'Upload failed', message: err?.response?.data?.detail || 'Try again' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => { upd('attachments', (form.attachments || []).filter((_, i) => i !== index)); };

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: 'error', title: 'Missing title' }); return; }
    let customFields = {};
    try { customFields = form.custom_fields_text?.trim() ? JSON.parse(form.custom_fields_text) : {}; }
    catch (_) { pushToast({ type: 'error', title: 'Custom fields must be valid JSON' }); return; }
    const assignees = form.assign_scope === 'whole_team' && form.team_id ? teamMembers.map(m => m.user_id) : (form.assignee_user_ids || []);
    const effectiveTeamId = isClientMode ? (defaultTeamId || form.team_id || null) : (form.team_id || null);
    const payload = {
      title: form.title.trim(), description: form.description?.trim() || null,
      priority: form.priority, category_id: form.category_id || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      team_id: effectiveTeamId, column_id: form.column_id || null,
      assignee_user_ids: assignees,
      due_at: fromLocal(form.due_at), reminder_at: form.reminder_at ? fromLocal(form.reminder_at) : null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      recurrence: { rule: form.recurrence_rule, interval: Number(form.recurrence_interval) || 1 },
      attachments: (form.attachments || []).filter(a => a.url && a.name),
      custom_fields: customFields,
      subtasks: (form.subtasks || []).filter(s => s.title?.trim()).map((s, i) => ({ title: s.title.trim(), is_done: !!s.is_done, order: i })),
    };
    try {
      if (isClientMode && !editing) {
        await api.post('/client/tasks/request', payload);
        pushToast({ type: 'success', title: 'Task submitted for approval' });
        onSaved?.();
      } else {
        const r = editing ? await api.put(`/tasks/${editing.task_id}`, payload) : await api.post('/tasks', payload);
        pushToast({ type: 'success', title: 'Saved' });
        onSaved(r.data);
      }
    } catch (e) { pushToast({ type: 'error', title: 'Could not save', message: e?.response?.data?.detail || 'Try again.' }); }
  };

  const colOptions = columns ? [{ value: '', label: '— No column —' }, ...columns.map(c => ({ value: c.column_id, label: c.name }))] : [];

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? 'Edit task' : 'New task'} dataTestId="task-editor-modal"
      footer={<div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Save task</Button></div>}>
      <div className="space-y-4">
        <F label="Title"><Input value={form.title} onChange={e => upd('title', e.target.value)} placeholder="Task title…" autoFocus /></F>
        <F label="Notes"><textarea value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Context, links, notes…" className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" rows={3} /></F>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {!isClientMode && (
            <F label="Project">
              <Select value={form.team_id} onChange={v => setForm(p => ({ ...p, team_id: v, column_id: '', assign_scope: 'none', assignee_user_ids: [] }))}
                options={[{ value: '', label: 'Personal' }, ...(teams || []).filter(t => t && t.team_id && (t.name || '').trim()).map(t => ({ value: t.team_id, label: t.name }))]} />
            </F>
          )}
          {!isClientMode && columns && columns.length > 0 && (
            <F label="Column"><Select value={form.column_id} onChange={v => upd('column_id', v)} options={colOptions} /></F>
          )}
          <F label="Priority">
            <Select value={form.priority} onChange={v => upd('priority', v)} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
          </F>
          <F label="Category">
            <Select value={form.category_id} onChange={v => upd('category_id', v)} options={[{ value: '', label: 'None' }, ...categories.map(c => ({ value: c.category_id, label: c.name }))]} />
          </F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Due date"><Input type="datetime-local" value={form.due_at} onChange={e => upd('due_at', e.target.value)} /></F>
          <F label="Reminder"><Input type="datetime-local" value={form.reminder_at} onChange={e => upd('reminder_at', e.target.value)} /></F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Tags"><Input value={form.tags} onChange={e => upd('tags', e.target.value)} placeholder="Design, review… (comma-separated)" /></F>
          <F label="Est. minutes"><Input value={form.estimated_minutes} onChange={e => upd('estimated_minutes', e.target.value)} placeholder="e.g., 45" /></F>
        </div>
        {form.team_id && canAssign && (
          <F label="Assignment">
            <Select value={form.assign_scope} onChange={v => setForm(p => ({ ...p, assign_scope: v, assignee_user_ids: [] }))} options={[{ value: 'none', label: 'Unassigned' }, { value: 'whole_team', label: 'Whole project' }, { value: 'members', label: 'Selected members' }]} />
            {!loadingMembers && form.assign_scope === 'members' && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {teamMembers.map(m => {
                  const checked = (form.assignee_user_ids || []).includes(m.user_id);
                  return (
                    <label key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <input type="checkbox" checked={checked} onChange={e => setForm(p => { const s = new Set(p.assignee_user_ids || []); e.target.checked ? s.add(m.user_id) : s.delete(m.user_id); return { ...p, assignee_user_ids: Array.from(s) }; })} />
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                        <span className="truncate text-xs font-semibold">{m.display_name || m.full_name || m.name || m.email}</span>
                        {(m.member_role || m.role) && <span style={{ fontSize: 10, color: '#8aa5be' }}>{m.member_role || m.role}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </F>
        )}
        <F label="Attachments">
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip" />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || (isClientMode && editing)}>
            {uploading ? 'Uploading...' : 'Add Files'}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">Max 5MB per file. PDF, docs, images, zip</p>
          {(form.attachments || []).length > 0 && (
            <div className="mt-3 space-y-2">
              {form.attachments.map((att, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm">📎</span>
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate hover:underline">{att.name}</a>
                  </div>
                  {!isClientMode && (
                    <button type="button" onClick={() => removeAttachment(i)} className="text-red-500 hover:text-red-700 p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </F>
        <F label="Subtasks">
          <div className="space-y-2">
            {(form.subtasks || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={!!s.is_done} onChange={e => setForm(p => ({ ...p, subtasks: p.subtasks.map((x, j) => j === i ? { ...x, is_done: e.target.checked } : x) }))} />
                <Input value={s.title} onChange={e => setForm(p => ({ ...p, subtasks: p.subtasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} placeholder={`Subtask ${i + 1}`} />
                <Button variant="ghost" onClick={() => setForm(p => ({ ...p, subtasks: p.subtasks.filter((_, j) => j !== i) }))}>✕</Button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setForm(p => ({ ...p, subtasks: [...(p.subtasks || []), { title: '', is_done: false }] }))}>+ Add subtask</Button>
          </div>
        </F>
        {taskState?.task_id && taskState?.approval_status && (
          <div style={{ padding: 12, borderRadius: 10, fontSize: 13, background: taskState.approval_status === 'approved' ? 'rgba(16,185,129,0.10)' : taskState.approval_status === 'rejected' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)', color: taskState.approval_status === 'approved' ? '#10b981' : taskState.approval_status === 'rejected' ? '#ef4444' : '#f59e0b', border: '1px solid', borderColor: taskState.approval_status === 'approved' ? 'rgba(16,185,129,0.3)' : taskState.approval_status === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)' }}>
            <div style={{ fontWeight: 500 }}>
              {taskState.approval_status === 'pending' && 'Awaiting owner approval'}
              {taskState.approval_status === 'pending_client' && 'Awaiting client approval'}
              {taskState.approval_status === 'approved' && 'Approved'}
              {taskState.approval_status === 'rejected' && 'Rejected — needs revision'}
            </div>
            {taskState.approval_notes && <div style={{ marginTop: 4, opacity: 0.85 }}>{taskState.approval_notes}</div>}
          </div>
        )}
        {taskState?.task_id && (
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--color-muted-foreground)', marginBottom: 8 }}>Comments ({comments.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', marginBottom: 8 }}>
              {comments.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>No comments yet.</div>}
              {comments.map(c => (
                <div key={c.comment_id} style={{ padding: 10, borderRadius: 8, background: 'var(--color-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{c.user_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }} placeholder="Add a comment…"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-input)', fontSize: 13 }} />
              <Button onClick={postComment} disabled={postingComment || !newComment.trim()}>{postingComment ? 'Posting…' : 'Post'}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
