/**
 * ClientPagesImpl.jsx — client-facing page components.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { K, KLogo, KWordmark } from '../lib/brand';
import { apiLogout, approvalBadgeStyle, formatDue } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import TaskEditor from '../components/TaskEditor';
import { FolderKanban, ChevronRight, CheckCircle2, Calendar, LogOut } from 'lucide-react';

export function ClientProjectsPage() {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();
  const { pushToast } = useToast();
  useEffect(() => { api.get('/client/projects').then(r => setProjects(r.data)).catch(() => pushToast({ type: 'error', title: 'Failed to load projects' })); }, [pushToast]);
  return (
    <div className="content-wrapper">
      <div className="page-header"><h1 className="page-title">My Projects</h1><p className="text-sm text-muted-foreground">Projects you're assigned to</p></div>
      {projects.length === 0 && <div className="empty-state"><FolderKanban size={48} style={{ color: K.mid, opacity: 0.3 }} /><p style={{ marginTop: 16, fontSize: 15, color: 'var(--color-muted-foreground)' }}>No projects assigned yet</p></div>}
      <div className="grid-2">
        {projects.map(p => (
          <div key={p.team_id} className="elevated-card hover-lift" onClick={() => navigate(`/client/project/${p.team_id}`)} style={{ cursor: 'pointer', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}><FolderKanban size={18} style={{ color: K.teal }} /><h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{p.name}</h3></div>
            {p.description && <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', margin: 0 }}>{p.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [project,    setProject]    = useState(null);
  const [tasks,      setTasks]      = useState([]);
  const [columns,    setColumns]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/teams/${projectId}`).then(r => setProject(r.data)),
      api.get('/tasks', { params: { team_id: projectId } }).then(r => setTasks(r.data)),
      api.get(`/projects/${projectId}/columns`).then(r => setColumns(r.data)),
      api.get('/categories').then(r => setCategories(r.data)),
    ]).catch(() => { pushToast({ type: 'error', title: 'Failed to load project' }); navigate('/client/projects'); });
  }, [projectId, navigate, pushToast]);

  const grouped = useMemo(() => {
    const g = {}; columns.forEach(c => (g[c.column_id] = [])); tasks.forEach(t => { if (g[t.column_id]) g[t.column_id].push(t); }); return g;
  }, [tasks, columns]);

  const priorityStyle = (p) => ({ low: { background: '#10b98122', color: '#10b981' }, medium: { background: '#f59e0b22', color: '#f59e0b' }, high: { background: '#ef444422', color: '#ef4444' }, urgent: { background: '#9333ea22', color: '#9333ea' } }[p] || { background: '#88888822', color: '#888' });
  const catName = (cid) => categories.find(c => c.category_id === cid)?.name || '';

  return (
    <div className="content-wrapper content-wrapper--kanban">
      <div className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/client/projects')} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><ChevronRight size={14} className="rotate-180" />Projects</button>
          <h1 className="page-title mb-0">{project?.name || '…'}</h1>
          <div style={{ marginLeft: 'auto' }}><Button onClick={() => { setEditing(null); setEditorOpen(true); }}><span className="ml-1.5">Request Task</span></Button></div>
        </div>
      </div>
      <div className="kanban-container">
        {columns.map(col => (
          <div key={col.column_id} className="kanban-column">
            <div className="elevated-card" style={{ height: '100%' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2"><div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} /><span className="text-sm font-semibold">{col.name}</span>{col.is_done && <CheckCircle2 size={12} style={{ color: col.color }} />}</div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: col.color + '18', color: col.color }}>{(grouped[col.column_id] || []).length}</span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
                {(grouped[col.column_id] || []).map(t => (
                  <div key={t.task_id} onClick={() => { setEditing(t); setEditorOpen(true); }} className="glass-card cursor-pointer hover-lift">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0"><div className="text-sm font-semibold leading-snug">{t.title}</div>{t.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}</div>
                      <span className="badge-modern" style={{ background: priorityStyle(t.priority).background, color: priorityStyle(t.priority).color }}>{t.priority}</span>
                    </div>
                    {t.category_id && <div className="mt-2 text-xs text-muted-foreground">{catName(t.category_id)}</div>}
                    {t.approval_status && approvalBadgeStyle(t.approval_status) && (
                      <div className="mt-2"><span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: approvalBadgeStyle(t.approval_status).bg, color: approvalBadgeStyle(t.approval_status).color, fontWeight: 500 }}>{approvalBadgeStyle(t.approval_status).label}</span></div>
                    )}
                    {t.due_at && <div className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: new Date(t.due_at) < new Date() ? '#ef4444' : K.mid }}><Calendar size={10} />{formatDue(t.due_at)}</div>}
                    {t.attachments?.length > 0 && <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><span>📎</span><span>{t.attachments.length} file(s)</span></div>}
                    {(t.subtasks || []).length > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>Subtasks</span><span>{t.subtasks.filter(s => s.is_done).length}/{t.subtasks.length}</span></div>
                        <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${(t.subtasks.filter(s => s.is_done).length / t.subtasks.length) * 100}%`, background: col.color }} /></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <TaskEditor key={editing ? editing.task_id : 'new'} open={editorOpen} onOpenChange={setEditorOpen}
        editing={editing} categories={categories} teams={[{ team_id: projectId, name: project?.name }]}
        defaultTeamId={projectId} columns={columns} isClientMode
        onSaved={() => { setEditorOpen(false); setEditing(null); api.get('/tasks', { params: { team_id: projectId } }).then(r => setTasks(r.data)); }}
      />
    </div>
  );
}

export function ClientPortal() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [tasks,    setTasks]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment,  setComment]  = useState('');
  const [posting,  setPosting]  = useState(false);
  const user = JSON.parse(localStorage.getItem('kartavya_user') || 'null');

  useEffect(() => { api.get('/client/tasks').then(r => setTasks(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (!selected) return; api.get(`/tasks/${selected.task_id}/comments`).then(r => setComments(r.data)).catch(() => {}); }, [selected]);

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try { const r = await api.post(`/tasks/${selected.task_id}/comments`, { body: comment.trim() }); setComments(p => [...p, r.data]); setComment(''); }
    catch (_) { pushToast({ type: 'error', title: 'Could not post comment' }); }
    finally { setPosting(false); }
  };

  const statusColor = { todo: K.blue, in_progress: K.mid, done: K.teal };

  return (
    <div style={{ minHeight: '100vh', background: K.dark, fontFamily: "'Nunito',sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><KLogo size={36} /><KWordmark dark /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#8aa5be' }}>Hi, {user?.full_name || user?.name}</span>
          <button onClick={async () => { await apiLogout(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8aa5be', background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={14} /> Sign out</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: K.teal, marginBottom: 16 }}>Your Updates</div>
          {tasks.length === 0 && <div style={{ color: '#8aa5be', fontSize: 14 }}>No tasks shared with you yet.</div>}
          {tasks.map(t => (
            <div key={t.task_id} onClick={() => setSelected(selected?.task_id === t.task_id ? null : t)}
              style={{ background: selected?.task_id === t.task_id ? K.card : 'rgba(255,255,255,.04)', border: `1px solid ${selected?.task_id === t.task_id ? K.blue : 'rgba(255,255,255,.08)'}`, borderRadius: 16, padding: '16px 20px', marginBottom: 10, cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 4 }}>{t.title}</div>{t.description && <div style={{ fontSize: 12, color: '#8aa5be', lineHeight: 1.5 }}>{t.description}</div>}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: statusColor[t.status] || K.teal, background: (statusColor[t.status] || K.teal) + '22', padding: '3px 8px', borderRadius: 6 }}>{t.status === 'in_progress' ? 'In Progress' : t.status}</span>
                  {t.due_at && <span style={{ fontSize: 11, color: '#8aa5be' }}>Due {formatDue(t.due_at)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {selected && (
          <div style={{ background: K.card, border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: K.teal, marginBottom: 4 }}>Comments</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 12 }}>{selected.title}</div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              {comments.length === 0 && <div style={{ color: '#8aa5be', fontSize: 13 }}>No comments yet.</div>}
              {comments.map(c => (
                <div key={c.comment_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><div style={{ width: 22, height: 22, borderRadius: '50%', background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#fff' }}>{(c.user_name || '?')[0].toUpperCase()}</div><span style={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>{c.user_name}</span><span style={{ fontSize: 10, color: '#8aa5be' }}>{new Date(c.created_at).toLocaleString()}</span></div>
                  <div style={{ fontSize: 13, color: '#c8dcea', lineHeight: 1.6, paddingLeft: 30 }}>{c.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()} placeholder="Add a comment…" style={{ flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#fff', outline: 'none' }} />
              <button onClick={postComment} disabled={posting} style={{ padding: '9px 16px', background: K.gradD, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', opacity: posting ? 0.6 : 1 }}>Post</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
