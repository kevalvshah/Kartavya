/**
 * TasksListPage.jsx
 * Works for both members AND clients.
 * - Members see all tasks they own/are assigned to.
 * - Clients see their tasks via /client/tasks endpoint.
 * Full create/edit/delete via TaskEditor (members) or ClientTaskDrawer-like inline.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { currentUser, formatDue } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input }  from '../components/ui/input';
import { Select } from '../components/ui/select';
import { useToast } from '../components/ui/toast';
import TaskEditor from '../components/TaskEditor';
import { ListTodo, Plus, Trash2, Pencil } from 'lucide-react';

const PRIORITY_COLOR = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };

export default function TasksListPage() {
  const { pushToast } = useToast();
  const user     = currentUser();
  const isClient = user?.role === 'client';

  const [tasks,   setTasks]   = useState([]);
  const [teams,   setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');   // all | mine | done
  const [editor,  setEditor]  = useState({ open: false, task: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Clients use the scoped /client/tasks endpoint
      const endpoint = isClient ? '/client/tasks' : '/tasks';
      const [tRes, pRes] = await Promise.all([
        api.get(endpoint),
        isClient ? api.get('/client/projects') : api.get('/teams'),
      ]);
      setTasks(tRes.data || []);
      setTeams((pRes.data || []).map(t => ({ team_id: t.team_id, name: t.name })));
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not load tasks' });
    } finally { setLoading(false); }
  }, [isClient, pushToast]);

  useEffect(() => { load(); }, [load]);

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/${task.task_id}`);
      pushToast({ type: 'success', title: 'Task deleted' });
      load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  const visible = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'done' ? t.status === 'done' : t.status !== 'done');
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-bold flex items-center gap-2"><ListTodo size={16} />{isClient ? 'My Tasks' : 'All Tasks'}</div>
        <Button onClick={() => setEditor({ open: true, task: null })}>
          <Plus size={14} /><span className="ml-1">New Task</span>
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="max-w-xs"
        />
        <Select
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all',  label: 'All' },
            { value: 'mine', label: 'Active' },
            { value: 'done', label: 'Done' },
          ]}
          className="w-36"
        />
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && visible.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {search ? 'No tasks match your search.' : 'No tasks yet — create one!'}
        </div>
      )}

      <div className="space-y-2">
        {visible.map(t => (
          <div key={t.task_id} className="rounded-2xl border border-border/60 bg-card/50 px-4 py-3 flex items-center gap-3">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[t.priority] || '#94a3b8', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{t.title}</div>
              <div className="text-xs text-muted-foreground">
                {t.status?.replace('_', ' ')}
                {t.due_at && <> · Due {formatDue(t.due_at)}</>}
              </div>
            </div>
            <button
              onClick={() => setEditor({ open: true, task: t })}
              className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => deleteTask(t)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <TaskEditor
        open={editor.open}
        onOpenChange={(v) => setEditor(e => ({ ...e, open: v }))}
        editing={editor.task}
        teams={teams}
        categories={[]}
        onSaved={() => { load(); setEditor({ open: false, task: null }); }}
      />
    </div>
  );
}
