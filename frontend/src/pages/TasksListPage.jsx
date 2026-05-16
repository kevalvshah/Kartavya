/**
 * TasksListPage.jsx — task table using k-* design system.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { currentUser, formatDue } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import TaskEditor from '../components/TaskEditor';

const PRI_CLASS = { urgent: 'k-pri--urgent', high: 'k-pri--high', medium: 'k-pri--medium', low: 'k-pri--low' };
const STATUS_SANS = { todo: 'कार्य', in_progress: 'चालू', in_review: 'समीक्षा', done: 'सम्पन्न' };

export default function TasksListPage() {
  const { pushToast } = useToast();
  const user     = currentUser();
  const isClient = user?.role === 'client';

  const [tasks,   setTasks]   = useState([]);
  const [teams,   setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [editor,  setEditor]  = useState({ open: false, task: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isClient ? '/client/tasks' : '/tasks';
      const [tRes, pRes] = await Promise.all([
        api.get(endpoint),
        isClient ? api.get('/client/projects') : api.get('/teams'),
      ]);
      setTasks(tRes.data || []);
      setTeams((pRes.data || []).map(t => ({ team_id: t.team_id, name: t.name })));
    } catch (_) { pushToast({ type: 'error', title: 'Could not load tasks' }); }
    finally { setLoading(false); }
  }, [isClient, pushToast]);

  useEffect(() => { load(); }, [load]);

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try { await api.delete(`/tasks/${task.task_id}`); pushToast({ type: 'success', title: 'Task deleted' }); load(); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  const visible = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'done' ? t.status === 'done' : t.status !== 'done');
    return matchSearch && matchFilter;
  });

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">{isClient ? 'My Tasks' : 'All Tasks'}</h1>
        <span className="k-pageh__sans">कर्तव्य</span>
        <div className="k-pageh__actions">
          <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setEditor({ open: true, task: null })}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            New task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <div className="k-topbar__search" style={{ maxWidth: 280, flex: '1 1 200px' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" />
        </div>
        <select className="k-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All tasks</option>
          <option value="mine">Active</option>
          <option value="done">Done</option>
        </select>
      </div>

      {/* Table */}
      <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="k-tbl">
          <div className="k-tbl__head">
            <span />
            <span>ID</span>
            <span>Title</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Due</span>
            <span />
          </div>

          {loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
              Loading tasks…
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="k-empty" style={{ padding: 'var(--sp-8)' }}>
              <div className="k-empty__icon">✓</div>
              <div className="k-empty__title">{search ? 'No matches' : 'No tasks yet'}</div>
              <div className="k-empty__sub">{search ? 'Try a different search.' : 'Create your first task above.'}</div>
            </div>
          )}

          {visible.map(t => (
            <div key={t.task_id} className="k-trow" onClick={() => setEditor({ open: true, task: t })}>
              <div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.status === 'done' ? 'var(--ok)' : 'var(--ink-faint)' }} />
              </div>
              <div className="k-trow__id">{t.task_id?.slice(0, 8) || '—'}</div>
              <div className="k-trow__title" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.55 : 1 }}>
                {t.title}
              </div>
              <div>
                <span className="k-hi" style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: 'var(--ink-3)' }}>
                  {STATUS_SANS[t.status] || t.status?.replace('_', ' ')}
                </span>
              </div>
              <div>
                {t.priority && <span className={`k-pri ${PRI_CLASS[t.priority] || ''}`}>{t.priority}</span>}
              </div>
              <div className="k-trow__due">{t.due_at ? formatDue(t.due_at) : '—'}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="k-iconbtn" style={{ width: 26, height: 26 }} onClick={e => { e.stopPropagation(); setEditor({ open: true, task: t }); }} title="Edit">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-9 9H2v-3L11 2z"/></svg>
                </button>
                <button className="k-iconbtn" style={{ width: 26, height: 26, color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); deleteTask(t); }} title="Delete">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TaskEditor
        open={editor.open}
        onOpenChange={v => setEditor(e => ({ ...e, open: v }))}
        editing={editor.task}
        teams={teams}
        categories={[]}
        onSaved={() => { load(); setEditor({ open: false, task: null }); }}
      />
    </div>
  );
}
