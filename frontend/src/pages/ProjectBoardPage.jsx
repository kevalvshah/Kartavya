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

import { AVATAR_COLORS, logger } from '../lib/utils';

import { useFields }          from '../hooks/useFields';

import { useViews }           from '../hooks/useViews';

import { useRealtimeTasks }   from '../hooks/useRealtimeTasks';

import { usePresence }        from '../hooks/usePresence';

import { PageHeader, AvatarStack } from '../components/editorial';

import AutomationsPage from './AutomationsPage';

import { useToast } from '../components/ui/toast';



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

  const [showArchived,  setShowArchived]  = useState(false);
  const [showFieldMgr,     setShowFieldMgr]     = useState(false);

  const [showAutomations,  setShowAutomations]  = useState(false);

  const [newFieldName,  setNewFieldName]  = useState('');

  const [newFieldType,  setNewFieldType]  = useState('text');

  const [newTaskEditor, setNewTaskEditor] = useState({ open: false, columnId: null, dueAt: '' });



  const { defs: fieldDefs, createField, deleteField } = useFields(projectId);

  const { pushToast } = useToast();

  const { savedViews, saveView }                = useViews(projectId);



  // ── Realtime: tasks state is now owned by this hook ──────────────────────

  // rawTasks (from API load) seed the hook; from then on Supabase pushes patches.

  const { tasks, setTasks } = useRealtimeTasks(projectId, rawTasks);



  // ── Presence: who else is on this board right now ────────────────────────

  const onlineUsers = usePresence(projectId, me);



  // ── Initial data load ────────────────────────────────────────────────────

  const load = useCallback(async (archived = false) => {

    if (!projectId) return;

    setLoading(true);

    try {

      const [projR, colR, taskR] = await Promise.all([

        api.get(`/teams/${projectId}`),

        api.get(`/projects/${projectId}/columns`),

        api.get('/tasks', { params: { team_id: projectId, ...(archived ? { archived: true } : {}) } }),

      ]);

      setProject(projR.data);

      setColumns(Array.isArray(colR.data) ? colR.data : []);

      setRawTasks(Array.isArray(taskR.data) ? taskR.data : []);     // seeds useRealtimeTasks

      setTeamMembers(projR.data.members || []);

    } catch (e) {

      logger.error('Board load failed', e);

    } finally {

      setLoading(false);

    }

  }, [projectId]);



  useEffect(() => {
    load(false);
    api.post('/tasks/auto-archive').catch(() => {});
  }, [projectId]); // eslint-disable-line

  useEffect(() => { load(showArchived); }, [showArchived]); // eslint-disable-line



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

  }, [taskIds, fieldDefs?.length]); // eslint-disable-line



  const handleColumnChange = (action, payload) => {

    if (action === 'new_task') setNewTaskEditor({ open: true, columnId: payload, dueAt: '' });

  };



  const unarchiveTask = async (taskId) => {
    try {
      await api.patch(`/tasks/${taskId}/unarchive`);
      setRawTasks(prev => prev.filter(t => t.task_id !== taskId));
      pushToast({ type: 'success', title: 'Task restored' });
    } catch { pushToast({ type: 'error', title: 'Could not restore task' }); }
  };

  const addField = async () => {

    if (!newFieldName.trim()) return;

    try {

      await createField({ name: newFieldName.trim(), type: newFieldType, config: {} });

      setNewFieldName('');

      pushToast({ type: 'success', title: 'Field added' });

    } catch (e) {

      pushToast({ type: 'error', title: 'Could not add field', body: e?.response?.data?.detail || e?.message });

    }

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

            <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => { setShowFieldMgr(v => !v); setShowAutomations(false); }}>

              ⚙ Fields

            </button>

            <button

              className={'k-btn k-btn--ghost k-btn--sm' + (showAutomations ? ' is-active' : '')}

              onClick={() => { setShowAutomations(v => !v); setShowFieldMgr(false); }}

              style={showAutomations ? { background: 'var(--bg-soft)', color: 'var(--ink)' } : {}}

            >

              ⚡ Automations

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
          <button
            className={'k-segctrl__btn k-segctrl__btn--archive' + (showArchived ? ' is-active' : '')}
            onClick={() => setShowArchived(v => !v)}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="14" height="3" rx="1"/><path d="M2 7v6a1 1 0 001 1h10a1 1 0 001-1V7"/><path d="M6 10h4"/></svg>
            Archived
          </button>

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

                {[

                  { v: 'text',     l: 'Text' },

                  { v: 'number',   l: 'Number' },

                  { v: 'date',     l: 'Date' },

                  { v: 'select',   l: 'Select / Dropdown' },

                  { v: 'checkbox', l: 'Checkbox' },

                  { v: 'url',      l: 'URL' },

                  { v: 'person',   l: 'Person' },

                ].map(t => <option key={t.v} value={t.v}>{t.l}</option>)}

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



      {/* Automations panel */}

      {showAutomations && (

        <section className="k-card">

          <header className="k-card__head">

            <div className="k-card__titles">

              <h3 className="k-card__title">Automations</h3>

              <span className="k-card__sans">स्वचालन</span>

            </div>

            <button

              className="k-iconbtn"

              style={{ marginLeft: 'auto', opacity: 0.5 }}

              onClick={() => setShowAutomations(false)}

              title="Close"

              aria-label="Close automations panel"

            >

              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13"/></svg>

            </button>

          </header>

          <div className="k-card__body" style={{ paddingTop: 0 }}>

            <AutomationsPage teamId={projectId} embedded />

          </div>

        </section>

      )}



      {/* New task bar — non-kanban views (kanban has per-column buttons) */}

      {view !== 'kanban' && (

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>

          <button

            className="k-btn k-btn--primary k-btn--sm"

            onClick={() => setNewTaskEditor({ open: true, columnId: null })}

            style={{ display: 'flex', alignItems: 'center', gap: 6 }}

          >

            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>

            New task

          </button>

        </div>

      )}



      {/* Archived mode banner */}
      {showArchived && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
          background: 'color-mix(in srgb, var(--ink-3) 8%, var(--surface))',
          border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
          marginBottom: 8, fontSize: 12, color: 'var(--ink-3)',
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="14" height="3" rx="1"/><path d="M2 7v6a1 1 0 001 1h10a1 1 0 001-1V7"/><path d="M6 10h4"/></svg>
          Showing archived tasks — open any task to restore it.
          <button
            className="k-btn k-btn--ghost k-btn--sm"
            onClick={() => setShowArchived(false)}
            style={{ marginLeft: 'auto', fontSize: 11 }}
          >
            ← Back to active
          </button>
        </div>
      )}

      {/* ── Board views ──────────────────────────────────────────────── */}

      {view === 'kanban' && (

        <KanbanView

          columns={columns}

          tasks={tasks}

          fieldDefs={fieldDefs}

          fieldValueMap={fieldValueMap}

          teamMembers={teamMembers}

          teamId={projectId}

          onTasksChange={setTasks}

          onColumnChange={handleColumnChange}

          onColumnsChange={setColumns}

          showRequested={me?.role === 'admin' || me?.role === 'owner'}

          showClientApproval

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

        <CalendarView
        tasks={tasks}
        teamMembers={teamMembers}
        onTasksChange={setTasks}
        onDayClick={date => {
          const p = n => String(n).padStart(2, '0');
          setNewTaskEditor({ open: true, columnId: null, dueAt: `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}` });
        }}
      />

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

        onOpenChange={(v) => { if (!v) setNewTaskEditor({ open: false, columnId: null, dueAt: '' }); }}

        editing={null}

        teams={[]}

        defaultTeamId={projectId}

        defaultColumnId={newTaskEditor.columnId}

        defaultDueAt={newTaskEditor.dueAt}

        lockToProject

        clientMode={me?.role === 'client'}

        onSaved={(task) => {

          setTasks((prev) => [task, ...prev]);

          setNewTaskEditor({ open: false, columnId: null, dueAt: '' });

        }}

      />

    </div>

  );

}



// remove unused style vars (they were only referenced in the old header)

// labelSt and inputSt are no longer needed but harmless to leave

