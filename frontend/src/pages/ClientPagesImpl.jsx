/**
 * ClientPagesImpl.jsx — client-facing page components.
 *
 * v2 capabilities:
 *  - Full task CRUD (create, edit, delete) via ClientTaskDrawer
 *  - @mention autocomplete in comments
 *  - File attachment upload + view
 *  - Mark 'ready' tasks as reviewed (approval CTA)
 *  - Full statusColor map
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { K, KLogo, KWordmark } from '../lib/brand';
import { apiLogout, approvalBadgeStyle, formatDue } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import MentionTextarea from '../components/MentionTextarea';
import {
  FolderKanban, ChevronRight, CheckCircle2, Calendar,
  LogOut, CheckCheck, Paperclip, Trash2, X, Plus,
} from 'lucide-react';

// ── Status helpers ───────────────────────────────────────────────────────────
const STATUS_COLOR = {
  todo:        '#6366f1',
  in_progress: '#f59e0b',
  ready:       '#10b981',
  done:        '#22c55e',
  blocked:     '#ef4444',
  review:      '#8b5cf6',
};

const statusLabel = (s) => ({
  todo:        'To Do',
  in_progress: 'In Progress',
  ready:       'Ready for Review',
  done:        'Done',
  blocked:     'Blocked',
  review:      'In Review',
})[s] || s;

// ── ClientTaskDrawer ─────────────────────────────────────────────────────────
// Full-featured right-slide drawer for clients: create/edit/delete,
// @mention comments, file attachments.
function ClientTaskDrawer({ open, onClose, task: initialTask, categories = [], teams = [], defaultTeamId, members = [], onSaved, onDeleted }) {
  const { pushToast } = useToast();
  const fileRef = useRef();

  const isNew = !initialTask;

  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    team_id: defaultTeamId || '', due_at: '',
  });
  const [comments,    setComments]    = useState([]);
  const [comment,     setComment]     = useState('');
  const [posting,     setPosting]     = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [tab,         setTab]         = useState('details');

  const mentionMembers = members.map(m => ({
    user_id:      m.user_id,
    display_name: m.display_name || m.full_name || m.email || 'Unknown',
  }));

  useEffect(() => {
    if (!open) return;
    setTab('details');
    setComment('');
    setComments([]);
    setAttachments([]);

    if (initialTask) {
      setForm({
        title:       initialTask.title       || '',
        description: initialTask.description || '',
        priority:    initialTask.priority    || 'medium',
        team_id:     initialTask.team_id     || defaultTeamId || '',
        due_at:      initialTask.due_at ? initialTask.due_at.slice(0, 10) : '',
      });
      // Load comments
      api.get(`/tasks/${initialTask.task_id}/comments`)
         .then(r => setComments(r.data))
         .catch(() => {});
      // Load attachments
      if (initialTask.attachments) {
        setAttachments(initialTask.attachments);
      } else {
        api.get(`/tasks/${initialTask.task_id}/attachments`)
           .catch(() => {})
           .then(r => r && setAttachments(r.data || []));
      }
    } else {
      setForm({ title: '', description: '', priority: 'medium', team_id: defaultTeamId || '', due_at: '' });
    }
  }, [open, initialTask, defaultTeamId]);

  if (!open) return null;

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: 'error', title: 'Title is required' }); return; }
    setSaving(true);
    const payload = {
      title:       form.title.trim(),
      description: form.description?.trim() || null,
      priority:    form.priority,
      team_id:     form.team_id || null,
      due_at:      form.due_at ? new Date(form.due_at).toISOString() : null,
    };
    try {
      const r = isNew
        ? await api.post('/tasks', payload)
        : await api.put(`/tasks/${initialTask.task_id}`, payload);
      pushToast({ type: 'success', title: isNew ? 'Task created!' : 'Task updated' });
      onSaved?.(r.data);
      if (isNew) onClose();
    } catch (e) {
      pushToast({ type: 'error', title: 'Could not save', message: e?.response?.data?.detail || 'Try again.' });
    } finally { setSaving(false); }
  };

  const deleteTask = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${initialTask.task_id}`);
      pushToast({ type: 'success', title: 'Task deleted' });
      onDeleted?.();
      onClose();
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not delete task' });
    } finally { setDeleting(false); }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const r = await api.post(`/tasks/${initialTask.task_id}/comments`, { body: comment.trim() });
      setComments(p => [...p, r.data]);
      setComment('');
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not post comment' });
    } finally { setPosting(false); }
  };

  const uploadFile = async (file) => {
    if (!initialTask?.task_id) {
      pushToast({ type: 'error', title: 'Save the task first before attaching files.' }); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/tasks/${initialTask.task_id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments(p => [...p, r.data]);
      pushToast({ type: 'success', title: 'File attached' });
    } catch (_) {
      pushToast({ type: 'error', title: 'Upload failed' });
    } finally { setUploading(false); }
  };

  const deleteAttachment = async (attachmentId) => {
    try {
      await api.delete(`/tasks/${initialTask.task_id}/attachments/${attachmentId}`);
      setAttachments(p => p.filter(a => a.attachment_id !== attachmentId));
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not remove attachment' });
    }
  };

  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' },
    drawer:  { width: 'min(560px,100vw)', height: '100vh', background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' },
    header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 },
    body:    { flex: 1, overflowY: 'auto', padding: 24 },
    label:   { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' },
    field:   { marginBottom: 20 },
    tabBtn:  (active) => ({ padding: '6px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent-default)' : 'var(--text-muted)', borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent' }),
    btn:     (v = 'primary') => ({ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, ...(v === 'primary' ? { background: 'var(--accent-default)', color: '#fff' } : v === 'danger' ? { background: 'transparent', color: '#ef4444', border: '1px solid #ef444460' } : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }) }),
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.drawer}>
        {/* Header */}
        <div style={s.header}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{isNew ? 'New Task' : 'Edit Task'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* Tabs */}
        {!isNew && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', paddingLeft: 24, flexShrink: 0 }}>
            {[['details', 'Details'], ['comments', 'Comments'], ['files', 'Files']].map(([id, label]) => (
              <button key={id} style={s.tabBtn(tab === id)} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={s.body}>
          {/* DETAILS */}
          {(isNew || tab === 'details') && (
            <div className="space-y-4">
              <div style={s.field}>
                <span style={s.label}>Title *</span>
                <Input value={form.title} onChange={upd('title')} placeholder="Task title…" autoFocus />
              </div>
              <div style={s.field}>
                <span style={s.label}>Notes</span>
                <textarea value={form.description} onChange={upd('description')}
                  placeholder="Context, links, notes…"
                  className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none"
                  rows={3} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.field}>
                  <span style={s.label}>Project</span>
                  <Select value={form.team_id} onChange={upd('team_id')}
                    options={[
                      { value: '', label: 'Personal' },
                      ...teams.filter(t => t.team_id && t.name).map(t => ({ value: t.team_id, label: t.name })),
                    ]} />
                </div>
                <div style={s.field}>
                  <span style={s.label}>Priority</span>
                  <Select value={form.priority} onChange={upd('priority')}
                    options={[
                      { value: 'low',    label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high',   label: 'High' },
                      { value: 'urgent', label: 'Urgent' },
                    ]} />
                </div>
              </div>
              <div style={s.field}>
                <span style={s.label}>Due date</span>
                <Input type="date" value={form.due_at} onChange={upd('due_at')} />
              </div>
            </div>
          )}

          {/* COMMENTS */}
          {!isNew && tab === 'comments' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                {comments.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No comments yet. Be the first!</p>
                )}
                {comments.map(c => (
                  <div key={c.comment_id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-default)', flexShrink: 0 }}>
                      {(c.user_name?.[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name}</span>
                        <span style={{ color: 'var(--text-subtle)', fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {c.body.split(/(@[\w.-]+)/g).map((part, i) =>
                          part.startsWith('@')
                            ? <strong key={i} style={{ color: 'var(--accent-default)' }}>{part}</strong>
                            : part
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {/* @mention textarea */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <MentionTextarea
                    value={comment}
                    onChange={setComment}
                    onSubmit={postComment}
                    members={mentionMembers}
                    placeholder="Add a comment… type @ to mention someone"
                    rows={2}
                  />
                </div>
                <button onClick={postComment} disabled={posting} style={s.btn()}>
                  {posting ? '…' : 'Post'}
                </button>
              </div>
            </div>
          )}

          {/* FILES */}
          {!isNew && tab === 'files' && (
            <div>
              <input
                ref={fileRef}
                type="file"
                style={{ display: 'none' }}
                onChange={e => e.target.files[0] && uploadFile(e.target.files[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ ...s.btn('ghost'), marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Paperclip size={14} />
                {uploading ? 'Uploading…' : 'Attach file'}
              </button>

              {attachments.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No files attached yet.</p>
              )}
              {attachments.map(a => (
                <div key={a.attachment_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <Paperclip size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <a
                    href={a.url || a.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1, fontSize: 13, color: 'var(--accent-default)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {a.filename || a.file_name || 'Attachment'}
                  </a>
                  <button
                    onClick={() => deleteAttachment(a.attachment_id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            {!isNew && (
              <button onClick={deleteTask} disabled={deleting} style={s.btn('danger')}>
                <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={s.btn('ghost')}>Cancel</button>
            <button onClick={save} disabled={saving} style={s.btn()}>
              {saving ? 'Saving…' : isNew ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── ClientProjectsPage ───────────────────────────────────────────────────────
export function ClientProjectsPage() {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  useEffect(() => {
    api.get('/client/projects')
       .then(r => setProjects(r.data))
       .catch(() => pushToast({ type: 'error', title: 'Failed to load projects' }));
  }, [pushToast]);

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1 className="page-title">My Projects</h1>
        <p className="text-sm text-muted-foreground">Projects you're assigned to</p>
      </div>
      {projects.length === 0 && (
        <div className="empty-state">
          <FolderKanban size={48} style={{ color: K.mid, opacity: 0.3 }} />
          <p style={{ marginTop: 16, fontSize: 15, color: 'var(--color-muted-foreground)' }}>No projects assigned yet</p>
        </div>
      )}
      <div className="grid-2">
        {projects.map(p => (
          <div key={p.team_id} className="elevated-card hover-lift"
            onClick={() => navigate(`/client/project/${p.team_id}`)}
            style={{ cursor: 'pointer', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <FolderKanban size={18} style={{ color: K.teal }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{p.name}</h3>
            </div>
            {p.description && <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', margin: 0 }}>{p.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}


// ── ClientProjectBoardPage ───────────────────────────────────────────────────
export function ClientProjectBoardPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const { pushToast } = useToast();
  const [project,    setProject]    = useState(null);
  const [tasks,      setTasks]      = useState([]);
  const [columns,    setColumns]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [members,    setMembers]    = useState([]);
  const [drawer,     setDrawer]     = useState({ open: false, task: null });

  const reload = () =>
    api.get('/tasks', { params: { team_id: projectId } }).then(r => setTasks(r.data));

  useEffect(() => {
    Promise.all([
      api.get(`/teams/${projectId}`).then(r => setProject(r.data)),
      api.get('/tasks', { params: { team_id: projectId } }).then(r => setTasks(r.data)),
      api.get(`/projects/${projectId}/columns`).then(r => setColumns(r.data)),
      api.get('/categories').then(r => setCategories(r.data)),
      api.get(`/teams/${projectId}/members`).then(r => setMembers(r.data)).catch(() => {}),
    ]).catch(() => { pushToast({ type: 'error', title: 'Failed to load project' }); navigate('/client/projects'); });
  }, [projectId, navigate, pushToast]);

  const grouped = useMemo(() => {
    const g = {};
    columns.forEach(c => (g[c.column_id] = []));
    tasks.forEach(t => { if (g[t.column_id]) g[t.column_id].push(t); });
    return g;
  }, [tasks, columns]);

  const priorityStyle = (p) => ({
    low:    { background: '#10b98122', color: '#10b981' },
    medium: { background: '#f59e0b22', color: '#f59e0b' },
    high:   { background: '#ef444422', color: '#ef4444' },
    urgent: { background: '#9333ea22', color: '#9333ea' },
  }[p] || { background: '#88888822', color: '#888' });

  const catName = (cid) => categories.find(c => c.category_id === cid)?.name || '';

  const markReviewed = async (e, t) => {
    e.stopPropagation();
    try {
      await api.patch(`/tasks/${t.task_id}`, { approval_status: 'approved' });
      pushToast({ type: 'success', title: 'Marked as reviewed!' });
      reload();
    } catch (_) { pushToast({ type: 'error', title: 'Could not update task' }); }
  };

  return (
    <div className="content-wrapper content-wrapper--kanban">
      <div className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/client/projects')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronRight size={14} className="rotate-180" />Projects
          </button>
          <h1 className="page-title mb-0">{project?.name || '…'}</h1>
          <div style={{ marginLeft: 'auto' }}>
            <Button onClick={() => setDrawer({ open: true, task: null })}>
              <Plus size={14} /><span className="ml-1">New Task</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="kanban-container">
        {columns.map(col => (
          <div key={col.column_id} className="kanban-column">
            <div className="elevated-card" style={{ height: '100%' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  <span className="text-sm font-semibold">{col.name}</span>
                  {col.is_done && <CheckCircle2 size={12} style={{ color: col.color }} />}
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: col.color + '18', color: col.color }}>
                  {(grouped[col.column_id] || []).length}
                </span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
                {(grouped[col.column_id] || []).map(t => {
                  const isReady = t.status === 'ready' || col.name?.toLowerCase() === 'ready';
                  return (
                    <div key={t.task_id}
                      onClick={() => setDrawer({ open: true, task: t })}
                      className="glass-card cursor-pointer hover-lift">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold leading-snug">{t.title}</div>
                          {t.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                        </div>
                        <span className="badge-modern" style={{ background: priorityStyle(t.priority).background, color: priorityStyle(t.priority).color }}>
                          {t.priority}
                        </span>
                      </div>
                      {t.category_id && <div className="mt-2 text-xs text-muted-foreground">{catName(t.category_id)}</div>}
                      {t.approval_status && approvalBadgeStyle(t.approval_status) && (
                        <div className="mt-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: approvalBadgeStyle(t.approval_status).bg, color: approvalBadgeStyle(t.approval_status).color, fontWeight: 500 }}>
                            {approvalBadgeStyle(t.approval_status).label}
                          </span>
                        </div>
                      )}
                      {t.due_at && (
                        <div className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: new Date(t.due_at) < new Date() ? '#ef4444' : K.mid }}>
                          <Calendar size={10} />{formatDue(t.due_at)}
                        </div>
                      )}
                      {t.attachments?.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Paperclip size={10} /><span>{t.attachments.length} file{t.attachments.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {(t.subtasks || []).length > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Subtasks</span>
                            <span>{t.subtasks.filter(s => s.is_done).length}/{t.subtasks.length}</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-bar__fill" style={{ width: `${(t.subtasks.filter(s => s.is_done).length / t.subtasks.length) * 100}%`, background: col.color }} />
                          </div>
                        </div>
                      )}
                      {isReady && t.approval_status !== 'approved' && (
                        <button
                          onClick={(e) => markReviewed(e, t)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition-colors"
                          style={{ background: '#10b98118', color: '#10b981', border: '1px solid #10b98140' }}>
                          <CheckCheck size={12} /> Mark as Reviewed
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ClientTaskDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false, task: null })}
        task={drawer.task}
        categories={categories}
        teams={[{ team_id: projectId, name: project?.name }]}
        defaultTeamId={projectId}
        members={members}
        onSaved={() => reload()}
        onDeleted={() => reload()}
      />
    </div>
  );
}


// ── ClientPortal (legacy dark portal) ────────────────────────────────────────
export function ClientPortal() {
  const { pushToast } = useToast();
  const navigate      = useNavigate();
  const [tasks,    setTasks]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment,  setComment]  = useState('');
  const [posting,  setPosting]  = useState(false);
  const [marking,  setMarking]  = useState(null);
  const [members,  setMembers]  = useState([]);
  const user = JSON.parse(localStorage.getItem('kartavya_user') || 'null');

  const reloadTasks = () =>
    api.get('/client/tasks').then(r => setTasks(r.data)).catch(() => {});

  useEffect(() => { reloadTasks(); }, []);

  // Load members when a task is selected (for @mentions)
  useEffect(() => {
    if (!selected?.team_id) return;
    api.get(`/teams/${selected.team_id}/members`)
       .then(r => setMembers(r.data))
       .catch(() => {});
  }, [selected?.team_id]);

  useEffect(() => {
    if (!selected) return;
    api.get(`/tasks/${selected.task_id}/comments`)
       .then(r => setComments(r.data))
       .catch(() => {});
  }, [selected]);

  const mentionMembers = members.map(m => ({
    user_id:      m.user_id,
    display_name: m.display_name || m.full_name || m.email || 'Unknown',
  }));

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const r = await api.post(`/tasks/${selected.task_id}/comments`, { body: comment.trim() });
      setComments(p => [...p, r.data]);
      setComment('');
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not post comment' });
    } finally { setPosting(false); }
  };

  const markReviewed = async (t) => {
    setMarking(t.task_id);
    try {
      await api.patch(`/tasks/${t.task_id}`, { approval_status: 'approved' });
      pushToast({ type: 'success', title: '✓ Marked as reviewed' });
      reloadTasks();
      if (selected?.task_id === t.task_id) setSelected(prev => ({ ...prev, approval_status: 'approved' }));
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not update task' });
    } finally { setMarking(null); }
  };

  return (
    <div style={{ minHeight: '100vh', background: K.dark, fontFamily: "'Nunito',sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><KLogo size={36} /><KWordmark dark /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#8aa5be' }}>Hi, {user?.full_name || user?.name}</span>
          <button onClick={async () => { await apiLogout(); navigate('/login'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8aa5be', background: 'none', border: 'none', cursor: 'pointer' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: K.teal, marginBottom: 16 }}>Your Updates</div>
          {tasks.length === 0 && <div style={{ color: '#8aa5be', fontSize: 14 }}>No tasks shared with you yet.</div>}
          {tasks.map(t => {
            const color   = STATUS_COLOR[t.status] || K.teal;
            const isReady = t.status === 'ready';
            return (
              <div key={t.task_id}
                onClick={() => setSelected(selected?.task_id === t.task_id ? null : t)}
                style={{ background: selected?.task_id === t.task_id ? K.card : 'rgba(255,255,255,.04)', border: `1px solid ${selected?.task_id === t.task_id ? K.blue : 'rgba(255,255,255,.08)'}`, borderRadius: 16, padding: '16px 20px', marginBottom: 10, cursor: 'pointer', transition: 'all .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 4 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize: 12, color: '#8aa5be', lineHeight: 1.5 }}>{t.description}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color, background: color + '22', padding: '3px 8px', borderRadius: 6 }}>
                      {statusLabel(t.status)}
                    </span>
                    {t.due_at && <span style={{ fontSize: 11, color: '#8aa5be' }}>Due {formatDue(t.due_at)}</span>}
                  </div>
                </div>
                {isReady && t.approval_status !== 'approved' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markReviewed(t); }}
                    disabled={marking === t.task_id}
                    style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: '#10b98118', border: '1px solid #10b98140', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#10b981', cursor: 'pointer', opacity: marking === t.task_id ? 0.6 : 1 }}>
                    ✓ {marking === t.task_id ? 'Updating…' : 'Mark as Reviewed'}
                  </button>
                )}
                {isReady && t.approval_status === 'approved' && (
                  <div style={{ marginTop: 10, fontSize: 11, color: '#10b981', fontWeight: 500 }}>✓ Reviewed</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comments side-panel — now with @mention textarea */}
        {selected && (
          <div style={{ background: K.card, border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: K.teal }}>Comments</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8aa5be' }}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 12 }}>{selected.title}</div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              {comments.length === 0 && <div style={{ color: '#8aa5be', fontSize: 13 }}>No comments yet.</div>}
              {comments.map(c => (
                <div key={c.comment_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#fff' }}>
                      {(c.user_name || '?')[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>{c.user_name}</span>
                    <span style={{ fontSize: 10, color: '#8aa5be' }}>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#c8dcea', lineHeight: 1.6, paddingLeft: 30 }}>
                    {c.body.split(/(@[\w.-]+)/g).map((part, i) =>
                      part.startsWith('@')
                        ? <strong key={i} style={{ color: K.teal }}>{part}</strong>
                        : part
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* @mention textarea for dark portal */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <MentionTextarea
                  value={comment}
                  onChange={setComment}
                  onSubmit={postComment}
                  members={mentionMembers}
                  placeholder="Add a comment… type @ to mention"
                  rows={2}
                  darkMode
                />
              </div>
              <button onClick={postComment} disabled={posting}
                style={{ padding: '9px 16px', background: K.gradD, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', opacity: posting ? 0.6 : 1 }}>
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
