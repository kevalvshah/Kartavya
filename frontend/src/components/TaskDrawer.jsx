import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import FieldRenderer from './fields/FieldRenderer';
import MentionTextarea from './MentionTextarea';
import ActivityList from './ActivityList';
import { Paperclip, ExternalLink, Trash2, Play, Square, Clock, Pencil, Check, X } from 'lucide-react';
import { AVATAR_COLORS, userInitials } from '../lib/utils';

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

function SubtaskAssigneePicker({ subtaskId, assigneeUserId, assignedMember, aName, members, onAssign, colorIndex }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const assignableMembers = members.filter(m => m.display_name || m.full_name || m.name);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Assign subtask"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: aName ? 'var(--side-active)' : 'var(--bg-soft)',
          border: '1px solid var(--rule)', borderRadius: 20,
          padding: aName ? '2px 8px 2px 3px' : '2px 8px',
          cursor: 'pointer', fontSize: 11, fontWeight: 500,
          color: aName ? 'var(--ink)' : 'var(--ink-faint)',
          whiteSpace: 'nowrap',
        }}
      >
        {aName ? (
          <>
            <span style={{ width: 16, height: 16, borderRadius: '50%', fontSize: 8, fontWeight: 700, background: AVATAR_COLORS[colorIndex % AVATAR_COLORS.length], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {userInitials(aName)}
            </span>
            {aName.split(' ')[0]}
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>
            Assign…
          </>
        )}
        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 4l4 4 4-4"/></svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', right: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--rule)',
          borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          minWidth: 180, maxHeight: 220, overflowY: 'auto',
        }}>
          <button
            type="button"
            onClick={() => { onAssign(subtaskId, null); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: !assigneeUserId ? 'var(--side-active)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--rule-soft)' }}
          >
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--rule-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--ink-3)" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>Unassigned</span>
            {!assigneeUserId && <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--k-primary)" strokeWidth="2" style={{ marginLeft: 'auto' }}><path d="M2 7l4 4 6-6"/></svg>}
          </button>
          {assignableMembers.map((m, i) => {
            const uid = m.user_id || m.member_id;
            const name = m.display_name || m.full_name || m.name || '';
            const jobTitle = m.member_role || m.position || m.job_title || '';
            const checked = assigneeUserId === uid;
            return (
              <button
                key={uid}
                type="button"
                onClick={() => { onAssign(subtaskId, uid); setOpen(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: checked ? 'var(--side-active)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < assignableMembers.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}
              >
                <span style={{ width: 26, height: 26, borderRadius: '50%', fontSize: 10, fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {userInitials(name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
                  {jobTitle && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{jobTitle}</div>}
                </div>
                {checked && <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--k-primary)" strokeWidth="2"><path d="M2 7l4 4 6-6"/></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const [columns,     setColumns]     = useState([]);
  const [members,     setMembers]     = useState([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assigneeRef = useRef(null);
  const fileRef = useRef(null);

  // Approval UI state
  const [deletingTask,    setDeletingTask]    = useState(false);

  // Subtask state
  const [newSubtask,     setNewSubtask]     = useState('');
  const [addingSubtask,  setAddingSubtask]  = useState(false);

  // Comment edit state
  const [editingComment, setEditingComment] = useState(null); // comment_id
  const [editBody,       setEditBody]       = useState('');

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

  useEffect(() => {
    if (!assigneeOpen) return;
    const handler = (e) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setAssigneeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assigneeOpen]);

  const mentionMembers = teamMembers.map(m => ({
    user_id:      m.user_id,
    display_name: m.display_name || m.full_name || m.email || 'Unknown',
  }));
  useEffect(() => {
    if (!open || !taskId) return;
    setTab('details');
    setTask(null); setFields([]); setFValues({});
    setComments([]); setActivity([]); setEntries([]); setTimer(null); setAttachments([]);

    api.get('/categories').then(r => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    setMembers([]); setAssigneeOpen(false);

    Promise.all([
      api.get(`/tasks/${taskId}`),
      api.get(`/tasks/${taskId}/comments`),
    ]).then(([tRes, cRes]) => {
      const t = tRes.data;
      setTask(t);
      setDraft({ title: t.title, description: t.description, priority: t.priority, due_at: t.due_at, status: t.status, category_id: t.category_id || '' });
      setComments(Array.isArray(cRes.data) ? cRes.data : []);
      // Parse existing attachments
      const att = t.attachments || [];
      setAttachments(Array.isArray(att) ? att.map(a => typeof a === 'string' ? { url: a, name: a.split('/').pop() } : a) : []);
      if (t.team_id) {
        api.get(`/projects/${t.team_id}/columns`).then(r => {
          setColumns(Array.isArray(r.data) ? r.data : []);
        }).catch(() => {});
        api.get(`/teams/${t.team_id}`).then(r => {
          setMembers(Array.isArray(r.data?.members) ? r.data.members : []);
        }).catch(() => {});
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
  }, [open, taskId]);

  useEffect(() => {
    if (tab !== 'activity' || !taskId) return;
    setActLoad(true);
    api.get(`/activity/task/${taskId}`)
       .then(r => setActivity(Array.isArray(r.data) ? r.data : []))
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

  const toggleAssignee = useCallback(async (uid) => {
    const current = task?.assignee_user_ids || [];
    const next = current.includes(uid) ? current.filter(x => x !== uid) : [...current, uid];
    setTask(t => ({ ...t, assignee_user_ids: next }));
    try { await api.put(`/tasks/${taskId}`, { assignee_user_ids: next }); }
    catch (e) { console.error(e); }
  }, [task, taskId]);

  const updateSubtaskAssignee = useCallback(async (subtaskId, uid) => {
    try {
      const res = await api.put(`/tasks/${taskId}/subtasks/${subtaskId}`, { assignee_user_id: uid || null });
      setTask(res.data);
    } catch (e) { console.error(e); }
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

  const deleteComment = async (commentId) => {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`);
    setComments(prev => prev.filter(c => c.comment_id !== commentId));
  };

  const startEditComment = (c) => { setEditingComment(c.comment_id); setEditBody(c.body); };

  const saveEditComment = async (commentId) => {
    if (!editBody.trim()) return;
    const res = await api.put(`/tasks/${taskId}/comments/${commentId}`, { body: editBody });
    setComments(prev => prev.map(c => c.comment_id === commentId ? { ...c, body: res.data.body } : c));
    setEditingComment(null); setEditBody('');
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      const res = await api.post(`/tasks/${taskId}/subtasks`, { title: newSubtask });
      setTask(res.data);
      setNewSubtask('');
    } catch (e) { console.error(e); }
    finally { setAddingSubtask(false); }
  };

  const toggleSubtask = async (subtaskId) => {
    const res = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`);
    setTask(res.data);
  };

  const deleteSubtask = async (subtaskId) => {
    const res = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
    setTask(res.data);
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDeletingTask(true);
    try {
      await api.delete(`/tasks/${taskId}`);
      onSaved?.(null);
      onClose();
    } catch (e) {
      console.error(e);
      setDeletingTask(false);
    }
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

  const MAX_FILES = 5;
  const MAX_MB    = 5;

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length) return;

    // Slot check
    const slots = MAX_FILES - attachments.length;
    if (slots <= 0) {
      pushToast({ type: 'error', title: `Max ${MAX_FILES} files per task` });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const toUpload = picked.slice(0, slots);
    if (toUpload.length < picked.length)
      pushToast({ type: 'error', title: `Only ${slots} slot(s) remaining — uploading first ${slots}` });

    // Size check
    const oversized = toUpload.filter(f => f.size > MAX_MB * 1024 * 1024);
    if (oversized.length) {
      pushToast({ type: 'error', title: `${oversized.map(f => f.name).join(', ')} exceed${oversized.length > 1 ? '' : 's'} ${MAX_MB} MB` });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const newFiles = [];
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        newFiles.push({ name: file.name, url: res.data.url, key: res.data.key, size: res.data.size });
      }
      const updated = [...attachments, ...newFiles];
      setAttachments(updated);
      await saveTask({ attachments: updated.map(f => ({ name: f.name, url: f.url, key: f.key || null })) });
      pushToast({ type: 'success', title: `${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded` });
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Upload failed';
      pushToast({ type: 'error', title: msg });
    }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeAttachment = async (idx) => {
    const updated = attachments.filter((_, i) => i !== idx);
    setAttachments(updated);
    await saveTask({ attachments: updated.map(f => ({ name: f.name, url: f.url, key: f.key || null })) });
  };

  const isSystemAdmin = me?.role === 'admin';
  const isOwnerAdmin = me?.role === 'admin' || me?.role === 'owner';
  const isClient = me?.role === 'client';

  // For task deletion: check project-level role via task.project_role or fall back to system role
  const canDeleteTask = isSystemAdmin || (task && teamMembers.find(m => m.user_id === me?.user_id && (m.role === 'admin' || m.role === 'owner')));

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
        .then(r => setClientList(Array.isArray(r.data) ? r.data : []))
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
            {canDeleteTask && task && (
              <button onClick={handleDeleteTask} disabled={deletingTask} className="k-iconbtn" aria-label="Delete task" title="Delete task" style={{ color: 'var(--k-danger)' }}>
                <Trash2 size={14} />
              </button>
            )}
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
            {columns.length > 0 && (
              <div className="k-prop">
                <span className="k-prop__lbl">Column <span className="k-prop__sans">स्तंभ</span></span>
                <select
                  value={task?.column_id || ''}
                  onChange={async e => {
                    const colId = e.target.value;
                    if (!colId) return;
                    try {
                      const res = await api.patch(`/tasks/${taskId}/move`, { column_id: colId, order: 999 });
                      setTask(res.data);
                      setDraft(d => ({ ...d, status: res.data.status }));
                      onSaved?.(res.data);
                    } catch { /* ignore */ }
                  }}
                  className="k-input"
                  style={{ fontSize: 13 }}
                >
                  {columns.map(c => (
                    <option key={c.column_id} value={c.column_id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
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

            {/* Assignees */}
            <div className="k-prop" ref={assigneeRef} style={{ position: 'relative' }}>
              <span className="k-prop__lbl">Assignees <span className="k-prop__sans">नियुक्त</span></span>
              {(() => {
                const selIds = task?.assignee_user_ids || [];
                const selMembers = members.filter(m => selIds.includes(m.user_id || m.member_id));
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setAssigneeOpen(v => !v)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg-soft)', border: '1px solid var(--rule)',
                        borderRadius: 'var(--r-md)', padding: '6px 10px', cursor: 'pointer',
                        fontFamily: 'var(--font-ui)', fontSize: 12,
                        color: selMembers.length ? 'var(--ink)' : 'var(--ink-faint)', minHeight: 34,
                      }}
                    >
                      {selMembers.length === 0 ? (
                        <span style={{ flex: 1, textAlign: 'left' }}>Pick members…</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                          {selMembers.slice(0, 3).map((m, i) => {
                            const name = m.display_name || m.full_name || m.name || '';
                            return (
                              <span key={m.user_id || m.member_id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                background: 'var(--side-active)', borderRadius: 20,
                                padding: '1px 7px 1px 3px', fontSize: 11, fontWeight: 500,
                              }}>
                                <span style={{ width: 16, height: 16, borderRadius: '50%', fontSize: 8, fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{userInitials(name)}</span>
                                {name.split(' ')[0]}
                              </span>
                            );
                          })}
                          {selMembers.length > 3 && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>+{selMembers.length - 3}</span>}
                        </div>
                      )}
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, color: 'var(--ink-3)' }}><path d="M2 4l4 4 4-4"/></svg>
                    </button>
                    {assigneeOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxHeight: 200, overflowY: 'auto' }}>
                        {members.length === 0 ? (
                          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>No members found</div>
                        ) : members.map((m, i) => {
                          const uid = m.user_id || m.member_id;
                          const name = m.display_name || m.full_name || m.name || '';
                          if (!name) return null;
                          const jobTitle = m.member_role || m.position || m.job_title || '';
                          const checked = selIds.includes(uid);
                          return (
                            <button key={uid} type="button" onClick={() => toggleAssignee(uid)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: checked ? 'var(--side-active)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < members.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
                              <span style={{ width: 26, height: 26, borderRadius: '50%', fontSize: 10, fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{userInitials(name)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
                                {jobTitle && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{jobTitle}</div>}
                              </div>
                              {checked && <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="var(--k-primary)" strokeWidth="2"><path d="M2 7l4 4 6-6"/></svg>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
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

              {/* ── Subtasks ── */}
              <div style={{ marginBottom: 20 }}>
                <span style={{ ...lbl, marginBottom: 10 }}>
                  Subtasks{task.subtasks?.length > 0 && ` (${task.subtasks.filter(s => s.is_done).length}/${task.subtasks.length})`}
                  {' '}<span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)', fontWeight: 400 }}>उप-कार्य</span>
                </span>
                {task.subtasks?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    {task.subtasks.map((s, si) => {
                      const assignedMember = members.find(m => (m.user_id || m.member_id) === s.assignee_user_id);
                      const aName = assignedMember ? (assignedMember.display_name || assignedMember.full_name || assignedMember.name || '') : '';
                      return (
                        <div key={s.subtask_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-soft)', borderRadius: 'var(--r-sm)', border: '1px solid var(--rule)' }}>
                          <button
                            onClick={() => toggleSubtask(s.subtask_id)}
                            style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${s.is_done ? 'var(--k-primary)' : 'var(--ink-3)'}`, background: s.is_done ? 'var(--k-primary)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          >
                            {s.is_done && <Check size={10} color="#fff" strokeWidth={3} />}
                          </button>
                          <span style={{ flex: 1, fontSize: 13, color: s.is_done ? 'var(--ink-3)' : 'var(--ink)', textDecoration: s.is_done ? 'line-through' : 'none' }}>
                            {s.title}
                          </span>
                          {/* Mini assignee picker */}
                          {(() => {
                            const dropId = `sub-${s.subtask_id}`;
                            return (
                              <SubtaskAssigneePicker
                                subtaskId={s.subtask_id}
                                assigneeUserId={s.assignee_user_id || null}
                                assignedMember={assignedMember}
                                aName={aName}
                                members={members}
                                onAssign={updateSubtaskAssignee}
                                colorIndex={si}
                              />
                            );
                          })()}
                          <button
                            onClick={() => deleteSubtask(s.subtask_id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex', opacity: 0.6 }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSubtask()}
                    placeholder="Add a subtask…"
                    className="k-input"
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <button onClick={addSubtask} disabled={addingSubtask || !newSubtask.trim()} className="k-btn k-btn--ghost k-btn--sm">
                    + Add
                  </button>
                </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name}</span>{' '}
                        <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
                        {(c.user_id === me?.user_id || isSystemAdmin) && editingComment !== c.comment_id && (
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                            <button onClick={() => startEditComment(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, display: 'flex' }} title="Edit">
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => deleteComment(c.comment_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, display: 'flex' }} title="Delete">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingComment === c.comment_id ? (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <textarea
                            value={editBody}
                            onChange={e => setEditBody(e.target.value)}
                            rows={3}
                            className="k-input"
                            style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setEditingComment(null)} className="k-btn k-btn--ghost k-btn--sm">Cancel</button>
                            <button onClick={() => saveEditComment(c.comment_id)} className="k-btn k-btn--primary k-btn--sm" disabled={!editBody.trim()}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {c.body.split(/(@[\w.-]+)/g).map((part, i) =>
                            part.startsWith('@')
                              ? <strong key={i} style={{ color: 'var(--k-primary)' }}>{part}</strong>
                              : part
                          )}
                        </p>
                      )}
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
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button
                  className="k-btn k-btn--ghost k-btn--sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || attachments.length >= MAX_FILES}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Paperclip size={13} />
                  {uploading ? 'Uploading…' : 'Attach files'}
                </button>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{attachments.length}/{MAX_FILES} · max 5 MB each</span>
              </div>

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
