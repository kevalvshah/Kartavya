/**
 * ProjectBoardPage.jsx — v3 with Supabase Realtime + Presence.
 *
 * Changes from v2:
 *   - useRealtimeTasks() replaces local useState for tasks — any INSERT/UPDATE/DELETE
 *     on the tasks table (filtered to this project) patches state instantly for ALL
 *     users on the board without a page refresh.
 *   - usePresence() tracks who else is viewing this board right now and renders
 *     an avatar stack in the header.
 *
 * No backend changes required. Supabase Realtime operates via WAL directly.
 *
 * Prerequisites (one-time, run in Supabase SQL Editor):
 *   ALTER TABLE tasks   REPLICA IDENTITY FULL;
 *   ALTER TABLE columns REPLICA IDENTITY FULL;
 *   -- Then: Supabase Dashboard > Database > Replication > supabase_realtime
 *   --        add `tasks` and `columns` tables
 *
 * Vercel env vars required:
 *   REACT_APP_SUPABASE_URL
 *   REACT_APP_SUPABASE_ANON_KEY
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api }                    from '../lib/api';
import { currentUser }            from '../lib/auth';
import KanbanView    from '../components/views/KanbanView';
import TableView     from '../components/views/TableView';
import CalendarView  from '../components/views/CalendarView';
import TimelineView  from '../components/views/TimelineView';
import WorkloadView  from '../components/views/WorkloadView';
import PriorityView  from '../components/views/PriorityView';
import MyTasksView   from '../components/views/MyTasksView';
import TaskEditor    from '../components/TaskEditor';
import { AVATAR_COLORS } from '../lib/utils';
import { useFields }          from '../hooks/useFields';
import { useViews }           from '../hooks/useViews';
import { useRealtimeTasks }   from '../hooks/useRealtimeTasks';
import { usePresence }        from '../hooks/usePresence';
import { PageHeader, AvatarStack } from '../components/editorial';

const VIEWS = [
  { id: 'kanban',   label: 'Board',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="4" height="10" rx="1"/><rect x="6" y="3" width="4" height="10" rx="1"/><rect x="11" y="3" width="4" height="10" rx="1"/></svg> },
  { id: 'table',    label: 'List',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M2 8h12M2 12h12"/></svg> },
  { id: 'calendar', label: 'Calendar',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2M11 2v2M2 7h12"/></svg> },
  { id: 'timeline', label: 'Timeline',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5h5M2 8h9M2 11h6"/><circle cx="9" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="13" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r="1.5" fill="currentColor" stroke="none"/></svg> },
  { id: 'workload', label: 'Workload',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><circle cx="11" cy="5" r="2"/><path d="M1 13c0-2.2 2-4 5-4s5 1.8 5 4"/><path d="M11 9c2 .5 3 1.8 3 3"/></svg> },
  { id: 'priority', label: 'Priority',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3l12 0M2 7l8 0M2 11l5 0"/></svg> },
  { id: 'mytasks',  label: 'My Tasks',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/><path d="M6 10.5l1.5 1.5 3-3" strokeWidth="1.8"/></svg> },
];

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const me            = currentUser();

  const [project,       setProject]       = useState(null);
  const [columns,       setColumns]       = useState([]);
  const [rawTasks,      setRawTasks]      = useState([]);   // fetched from API
  const [teamMembers,   setTeamMembers]   = useState([]);
  const [view,          setView]          = useState('kanban');
  const [fieldValueMap, setFieldValueMap] = useState({});
  const [loading,       setLoading]       = useState(true);
  const [showFieldMgr,  setShowFieldMgr]  = useState(false);
  const [newFieldName,  setNewFieldName]  = useState('');
  const [newFieldType,  setNewFieldType]  = useState('text');
  const [newTaskEditor, setNewTaskEditor] = useState({ open: false, columnId: null });

  const { fieldDefs, createField, deleteField } = useFields(projectId);
  const { savedViews, saveView }                = useViews(projectId);

  // ── Realtime: tasks state is now owned by this hook ──────────────────────
  // rawTasks (from API load) seed the hook; from then on Supabase pushes patches.
  const { tasks, setTasks } = useRealtimeTasks(projectId, rawTasks);

  // ── Presence: who else is on this board right now ────────────────────────
  const onlineUsers = usePresence(projectId, me);

  // ── Initial data load ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projR, colR, taskR] = await Promise.all([
        api.get(`/teams/${projectId}`),
        api.get(`/projects/${projectId}/columns`),
        api.get('/tasks', { params: { team_id: projectId } }),
      ]);
      setProject(projR.data);
      setColumns(colR.data);
      setRawTasks(taskR.data);     // seeds useRealtimeTasks
      setTeamMembers(projR.data.members || []);
    } catch (e) {
      console.error('Board load failed', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field-value fetch (stable dep — only when task IDs change) ───────────
  const taskIds = useMemo(() => tasks.map(t => t.task_id).join(','), [tasks]);

  useEffect(() => {
    if (!tasks.length || !fieldDefs?.length) return;
    const map = {};
    Promise.all(
      tasks.map(async t => {
        try {
          const r = await api.get(`/fields/task/${t.task_id}/values`);
          map[t.task_id] = Object.fromEntries(r.data.map(v => [v.field_id, v.value]));
        } catch {}
      })
    ).then(() => setFieldValueMap({ ...map }));
  }, [taskIds, fieldDefs?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleColumnChange = (action, payload) => {
    if (action === 'new_task') setNewTaskEditor({ open: true, columnId: payload });
  };

  const addField = async () => {
    if (!newFieldName.trim()) return;
    await createField({ name: newFieldName.trim(), type: newFieldType, config: {} });
    setNewFieldName('');
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const labelSt = { fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' };
  const inputSt = { border: '1px solid var(--rule)', borderRadius: 'var(--r-sm)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)' };

  if (loading) return (
    <div className="k-screen">
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
        Loading board…
      </div>
    </div>
  );

  const projectName = project?.team?.name || project?.name || '…';
  const presenceUsers = onlineUsers.map((u, i) => ({ name: u.name || u.email || '?', color: AVATAR_COLORS[i % AVATAR_COLORS.length] }));

  return (
    <div className="k-screen">
      <PageHeader
        kicker="WORKSPACE"
        title={projectName}
        sanskrit={project?.sanskrit || ''}
        lede="Move work across the board. Click any card to open."
        right={
          <div className="k-headerright">
            {onlineUsers.length > 0 && (
              <AvatarStack users={presenceUsers} size={24} max={4} />
            )}
            <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowFieldMgr(v => !v)}>
              ⚙ Fields
            </button>
            <button
              className="k-btn k-btn--ghost k-btn--sm"
              onClick={() => saveView({ name: `View ${(savedViews?.length || 0) + 1}`, config: { viewType: view } })}
            >
              + Save view
            </button>
            <button className="k-link" onClick={() => navigate('/projects')}>
              ← Projects
            </button>
          </div>
        }
      />

      {/* View switcher bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--rule-soft)', paddingBottom: 0, marginBottom: 4, overflowX: 'auto' }}>
        <div className="k-segctrl">
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={'k-segctrl__btn' + (view === v.id ? ' is-active' : '')}
              onClick={() => setView(v.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Field manager panel */}
      {showFieldMgr && (
        <section className="k-card">
          <header className="k-card__head">
            <div className="k-card__titles">
              <h3 className="k-card__title">Custom Fields</h3>
            </div>
          </header>
          <div className="k-card__body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
              <input
                className="k-input"
                value={newFieldName}
                onChange={e => setNewFieldName(e.target.value)}
                placeholder="Field name"
                style={{ flex: 1 }}
              />
              <select className="k-select" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                {['text','number','date','select','checkbox','url','person'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="k-btn k-btn--primary k-btn--sm" onClick={addField}>Add</button>
            </div>
            {(fieldDefs || []).length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No custom fields yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(fieldDefs || []).map(f => (
                  <div key={f.field_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-soft)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{f.name}</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{f.type}</span>
                    <button onClick={() => deleteField(f.field_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Board views ──────────────────────────────────────────────── */}
      {view === 'kanban' && (
        <KanbanView
          columns={columns}
          tasks={tasks}
          fieldDefs={fieldDefs}
          fieldValueMap={fieldValueMap}
          teamMembers={teamMembers}
          onTasksChange={setTasks}
          onColumnChange={handleColumnChange}
          showRequested={me?.role === 'admin' || me?.role === 'owner'}
          showClientApproval={me?.role === 'admin' || me?.role === 'owner'}
          currentUserId={me?.user_id}
          currentUserRole={me?.role}
        />
      )}
      {view === 'table' && (
        <TableView
          tasks={tasks}
          columns={columns}
          fieldDefs={fieldDefs}
          fieldValueMap={fieldValueMap}
          teamMembers={teamMembers}
          onTasksChange={setTasks}
        />
      )}
      {view === 'calendar' && (
        <CalendarView tasks={tasks} teamMembers={teamMembers} onTasksChange={setTasks} />
      )}
      {view === 'timeline' && (
        <TimelineView tasks={tasks} columns={columns} teamMembers={teamMembers} onTasksChange={setTasks} />
      )}
      {view === 'workload' && (
        <WorkloadView tasks={tasks} teamMembers={teamMembers} />
      )}
      {view === 'priority' && (
        <PriorityView tasks={tasks} columns={columns} teamMembers={teamMembers} onTasksChange={setTasks} />
      )}
      {view === 'mytasks' && (
        <MyTasksView tasks={tasks} teamMembers={teamMembers} onTasksChange={setTasks} />
      )}

      {/* ── Task editor (new task from column button) ─────────────── */}
      <TaskEditor
        open={newTaskEditor.open}
        onOpenChange={(v) => { if (!v) setNewTaskEditor({ open: false, columnId: null }); }}
        editing={null}
        teams={[]}
        defaultTeamId={projectId}
        defaultColumnId={newTaskEditor.columnId}
        lockToProject
        onSaved={(task) => {
          setTasks((prev) => [task, ...prev]);
          setNewTaskEditor({ open: false, columnId: null });
        }}
      />
    </div>
  );
}

// remove unused style vars (they were only referenced in the old header)
// labelSt and inputSt are no longer needed but harmless to leave
