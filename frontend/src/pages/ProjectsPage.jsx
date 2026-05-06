/**
 * ProjectsPage, TasksListPage, TaskEditor (modal), CategoriesPage
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDue, toLocal, fromLocal } from '../lib/auth';
import { K } from '../lib/brand';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Modal } from '../components/ui/modal';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/ui/toast';
import { FolderKanban, LayoutGrid, Trash2, Plus, Trash2 as T2 } from 'lucide-react';

// ── Projects ──────────────────────────────────────────────────────────────────
export function ProjectsPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [name,     setName]     = useState('');
  const [creating, setCreating] = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const load = () => api.get('/teams').then((r) => setProjects(r.data)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post('/teams', { name: name.trim() });
      setName(''); setShowNew(false);
      pushToast({ type: 'success', title: 'Project created' }); load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not create project' }); }
    finally { setCreating(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete project "${p.name}"? All tasks in it will be deleted.`)) return;
    try { await api.delete(`/teams/${p.team_id}`); pushToast({ type: 'success', title: 'Project deleted' }); load(); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Projects</div>
          <div className="text-sm text-muted-foreground mt-0.5">Each project has its own customisable board.</div>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={15} /><span className="ml-1.5">New project</span></Button>
      </div>
      {showNew && (
        <div className="rounded-3xl border border-border/70 bg-card/50 p-5 flex gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Project name e.g. Website Redesign" autoFocus />
          <Button onClick={create} disabled={creating}>Create</Button>
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.length === 0 && (
          <div className="col-span-3 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No projects yet. Create your first one above.
          </div>
        )}
        {projects.map((p) => (
          <div key={p.team_id} className="rounded-3xl border border-border/70 bg-card/50 p-5 flex flex-col gap-3 hover:border-border transition-colors">
            <div className="flex items-start gap-3">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FolderKanban size={18} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Project · {new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => navigate(`/projects/${p.team_id}`)} className="flex-1">
                <LayoutGrid size={13} /><span className="ml-1.5">Open Board</span>
              </Button>
              <Button variant="ghost" onClick={() => remove(p)} className="px-2.5"><Trash2 size={13} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Task editor modal ─────────────────────────────────────────────────────────
export function TaskEditor({ open, onOpenChange, editing, categories, teams, defaultTeamId, onSaved }) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', team_id: defaultTeamId || '', due_at: '' });

  useEffect(() => {
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
  }, [editing, defaultTeamId]);

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: 'error', title: 'Missing title' }); return; }
    const payload = {
      title:       form.title.trim(),
      description: form.description?.trim() || null,
      priority:    form.priority,
      team_id:     form.team_id || null,
      due_at:      fromLocal(form.due_at),
    };
    try {
      const r = editing ? await api.put(`/tasks/${editing.task_id}`, payload) : await api.post('/tasks', payload);
      pushToast({ type: 'success', title: 'Saved' });
      onSaved(r.data);
    } catch (e) {
      pushToast({ type: 'error', title: 'Could not save', message: e?.response?.data?.detail || 'Try again.' });
    }
  };

  const F = ({ label, children }) => (
    <div>
      <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? 'Edit task' : 'New task'}
      footer={<div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Save task</Button></div>}>
      <div className="space-y-4">
        <F label="Title"><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title…" autoFocus /></F>
        <F label="Notes"><textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Context, links, notes…" className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none" rows={3} /></F>
        <div className="grid gap-3 md:grid-cols-3">
          <F label="Project">
            <Select value={form.team_id} onChange={(v) => setForm(f => ({ ...f, team_id: v }))}
              options={[{ value: '', label: 'Personal' }, ...(teams || []).map((t) => ({ value: t.team_id, label: t.name }))]} />
          </F>
          <F label="Priority">
            <Select value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))}
              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
          </F>
          <F label="Due date"><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm(f => ({ ...f, due_at: e.target.value }))} /></F>
        </div>
      </div>
    </Modal>
  );
}

// ── Tasks list page ───────────────────────────────────────────────────────────
export function TasksListPage() {
  const { pushToast } = useToast();
  const [tasks,      setTasks]      = useState([]);
  const [categories, setCats]       = useState([]);
  const [teams,      setTeams]      = useState([]);
  const [filters,    setFilters]    = useState({ status: '', category_id: '', q: '', team_id: '', assigned_to_me: false });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);

  const load = async () => {
    const p = {};
    if (filters.status)       p.status       = filters.status;
    if (filters.category_id)  p.category_id  = filters.category_id;
    if (filters.q)            p.q            = filters.q;
    if (filters.team_id)      p.team_id      = filters.team_id;
    if (filters.assigned_to_me) p.assigned_to_me = true;
    const [t, c, te] = await Promise.all([api.get('/tasks', { params: p }), api.get('/categories'), api.get('/teams')]);
    setTasks(t.data); setCats(c.data); setTeams(te.data);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => pushToast({ type: 'error', title: 'Could not load tasks' })); }, []);
  useEffect(() => { const id = setTimeout(() => load().catch(() => {}), 250); return () => clearTimeout(id); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.status, filters.category_id, filters.q, filters.team_id, filters.assigned_to_me]);

  const toggle = async (task) => {
    try { const r = await api.patch(`/tasks/${task.task_id}/toggle`); setTasks((p) => p.map((t) => t.task_id === task.task_id ? r.data : t)); }
    catch (_) { pushToast({ type: 'error', title: 'Could not update' }); }
  };
  const remove = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try { await api.delete(`/tasks/${task.task_id}`); setTasks((p) => p.filter((t) => t.task_id !== task.task_id)); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };
  const f  = (k, v) => setFilters((p) => ({ ...p, [k]: v }));
  const sl = (t) => t.team_id ? teams.find((x) => x.team_id === t.team_id)?.name || 'Project' : 'Personal';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-bold">All Tasks</div><div className="text-sm text-muted-foreground mt-0.5">Across all projects and personal tasks.</div></div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={15} /><span className="ml-1.5">New task</span></Button>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Status</div>
            <Select value={filters.status} onChange={(v) => f('status', v)} options={[{ value: '', label: 'All' }, { value: 'todo', label: 'Todo' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' }]} /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Project</div>
            <Select value={filters.team_id} onChange={(v) => f('team_id', v)} options={[{ value: '', label: 'All' }, ...teams.map((t) => ({ value: t.team_id, label: t.name }))]} /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Category</div>
            <Select value={filters.category_id} onChange={(v) => f('category_id', v)} options={[{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Search</div>
            <Input value={filters.q} onChange={(e) => f('q', e.target.value)} placeholder="Search…" /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Assigned</div>
            <button onClick={() => f('assigned_to_me', !filters.assigned_to_me)}
              className={cn('h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm transition-colors hover:bg-muted/40 font-medium', filters.assigned_to_me && 'ring-2')}>
              {filters.assigned_to_me ? 'Assigned to me' : 'All'}
            </button></div>
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_120px_120px_200px_160px] border-b border-border/60 px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
          <div>Title</div><div>Project</div><div>Status</div><div>Priority</div><div>Due</div><div className="text-right">Actions</div>
        </div>
        {tasks.length === 0
          ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No tasks found.</div>
          : tasks.map((t) => (
            <div key={t.task_id} className="grid grid-cols-[1fr_160px_120px_120px_200px_160px] items-center border-b border-border/40 px-5 py-3.5 hover:bg-muted/20 transition-colors">
              <button onClick={() => { setEditing(t); setEditorOpen(true); }} className="min-w-0 text-left">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                {(t.tags || []).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{t.tags.slice(0,2).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}</div>}
              </button>
              <div className="text-sm text-muted-foreground truncate">{sl(t)}</div>
              <div><Badge tone={t.status === 'done' ? 'success' : t.status === 'in_progress' ? 'info' : 'neutral'}>{t.status === 'in_progress' ? 'In progress' : t.status}</Badge></div>
              <div><Badge tone={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'}>{t.priority}</Badge></div>
              <div className="text-sm text-muted-foreground">{t.due_at ? formatDue(t.due_at) : '—'}</div>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" onClick={() => toggle(t)} className="text-xs px-2.5 h-8">{t.status === 'done' ? 'Reopen' : 'Done'}</Button>
                <Button variant="ghost" onClick={() => remove(t)} className="px-2 h-8"><T2 size={13} /></Button>
              </div>
            </div>
          ))}
      </div>
      {editorOpen && (
        <TaskEditor key={editing ? editing.task_id : 'new'} open={editorOpen} onOpenChange={setEditorOpen}
          editing={editing} categories={categories} teams={teams}
          onSaved={(task) => { setEditorOpen(false); setEditing(null);
            setTasks((prev) => { const e = prev.some((t) => t.task_id === task.task_id); return e ? prev.map((t) => t.task_id === task.task_id ? task : t) : [task, ...prev]; }); }} />
      )}
    </div>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
export function CategoriesPage() {
  const { pushToast } = useToast();
  const [cats,  setCats]  = useState([]);
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(K.blue);

  useEffect(() => { api.get('/categories').then((r) => setCats(r.data)).catch(() => {}); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try { const r = await api.post('/categories', { name: name.trim(), color }); setCats((p) => [r.data, ...p]); setName(''); }
    catch (_) { pushToast({ type: 'error', title: 'Could not create' }); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/categories/${c.category_id}`); setCats((p) => p.filter((x) => x.category_id !== c.category_id)); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  return (
    <div className="space-y-5">
      <div><div className="text-sm font-bold">Categories</div><div className="text-sm text-muted-foreground mt-0.5">Tag tasks with custom categories.</div></div>
      <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_120px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
          <div className="flex gap-2">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="px-2 w-16" />
            <Input value={color} onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setColor(e.target.value); }} />
          </div>
          <Button onClick={create}>Create</Button>
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        {cats.length === 0 ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No categories yet.</div>
          : cats.map((c) => (
            <div key={c.category_id} className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ background: c.color }} />
                <div className="text-sm font-semibold">{c.name}</div>
              </div>
              <Button variant="ghost" onClick={() => remove(c)}><T2 size={13} /></Button>
            </div>
          ))}
      </div>
    </div>
  );
}
