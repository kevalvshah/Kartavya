/**
 * TasksListPage.jsx — cross-project flat task list with filters.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDue } from '../lib/auth';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/ui/toast';
import { Trash2, Plus } from 'lucide-react';
import TaskEditor from '../components/TaskEditor';

export default function TasksListPage() {
  const { pushToast } = useToast();
  const [tasks,      setTasks]      = useState([]);
  const [categories, setCats]       = useState([]);
  const [teams,      setTeams]      = useState([]);
  const [filters,    setFilters]    = useState({ status: '', category_id: '', q: '', team_id: '', assigned_to_me: false });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);

  const load = async () => {
    const p = {};
    if (filters.status)         p.status         = filters.status;
    if (filters.category_id)    p.category_id    = filters.category_id;
    if (filters.q)              p.q              = filters.q;
    if (filters.team_id)        p.team_id        = filters.team_id;
    if (filters.assigned_to_me) p.assigned_to_me = true;
    const [t, c, te] = await Promise.all([
      api.get('/tasks', { params: p }),
      api.get('/categories'),
      api.get('/teams'),
    ]);
    setTasks(t.data); setCats(c.data); setTeams(te.data);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => pushToast({ type: 'error', title: 'Could not load tasks' })); }, []);
  useEffect(() => {
    const id = setTimeout(() => load().catch(() => {}), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.category_id, filters.q, filters.team_id, filters.assigned_to_me]);

  const toggle = async (task) => {
    try {
      const r = await api.patch(`/tasks/${task.task_id}/toggle`);
      setTasks((p) => p.map((t) => t.task_id === task.task_id ? r.data : t));
    } catch (_) { pushToast({ type: 'error', title: 'Could not update' }); }
  };

  const remove = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/${task.task_id}`);
      setTasks((p) => p.filter((t) => t.task_id !== task.task_id));
    } catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  const f  = (k, v) => setFilters((p) => ({ ...p, [k]: v }));
  const sl = (t) => t.team_id ? teams.find((x) => x.team_id === t.team_id)?.name || 'Project' : 'Personal';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">All Tasks</div>
          <div className="text-sm text-muted-foreground mt-0.5">Across all projects and personal tasks.</div>
        </div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
          <Plus size={15} /><span className="ml-1.5">New task</span>
        </Button>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Status</div>
            <Select value={filters.status} onChange={(v) => f('status', v)}
              options={[{ value: '', label: 'All' }, { value: 'todo', label: 'Todo' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' }]} />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Project</div>
            <Select value={filters.team_id} onChange={(v) => f('team_id', v)}
              options={[{ value: '', label: 'All' }, ...teams.map((t) => ({ value: t.team_id, label: t.name }))]} />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Category</div>
            <Select value={filters.category_id} onChange={(v) => f('category_id', v)}
              options={[{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Search</div>
            <Input value={filters.q} onChange={(e) => f('q', e.target.value)} placeholder="Search…" />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Assigned</div>
            <button onClick={() => f('assigned_to_me', !filters.assigned_to_me)}
              className={cn('h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm transition-colors hover:bg-muted/40 font-medium', filters.assigned_to_me && 'ring-2')}>
              {filters.assigned_to_me ? 'Assigned to me' : 'All'}
            </button>
          </div>
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
                {(t.tags || []).length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {t.tags.slice(0, 2).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
                  </div>
                )}
              </button>
              <div className="text-sm text-muted-foreground truncate">{sl(t)}</div>
              <div><Badge tone={t.status === 'done' ? 'success' : t.status === 'in_progress' ? 'info' : 'neutral'}>{t.status === 'in_progress' ? 'In progress' : t.status}</Badge></div>
              <div><Badge tone={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'}>{t.priority}</Badge></div>
              <div className="text-sm text-muted-foreground">{t.due_at ? formatDue(t.due_at) : '—'}</div>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" onClick={() => toggle(t)} className="text-xs px-2.5 h-8">{t.status === 'done' ? 'Reopen' : 'Done'}</Button>
                <Button variant="ghost" onClick={() => remove(t)} className="px-2 h-8"><Trash2 size={13} /></Button>
              </div>
            </div>
          ))}
      </div>

      {editorOpen && (
        <TaskEditor
          key={editing ? editing.task_id : 'new'}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          editing={editing}
          categories={categories}
          teams={teams}
          onSaved={(task) => {
            setEditorOpen(false); setEditing(null);
            setTasks((prev) => {
              const exists = prev.some((t) => t.task_id === task.task_id);
              return exists ? prev.map((t) => t.task_id === task.task_id ? task : t) : [task, ...prev];
            });
          }}
        />
      )}
    </div>
  );
}
