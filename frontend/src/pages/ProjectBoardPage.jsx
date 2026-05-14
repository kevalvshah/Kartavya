/**
 * ProjectBoardPage.jsx — v2 per-project board with view switcher.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import KanbanView    from '../components/views/KanbanView';
import TableView     from '../components/views/TableView';
import CalendarView  from '../components/views/CalendarView';
import TaskEditor    from '../components/TaskEditor';
import { useFields } from '../hooks/useFields';
import { useViews }  from '../hooks/useViews';

const VIEWS = [
  { id: 'kanban',    label: 'Board' },
  { id: 'table',     label: 'Table' },
  { id: 'calendar',  label: 'Calendar' },
];

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project,      setProject]      = useState(null);
  const [columns,      setColumns]      = useState([]);
  const [tasks,        setTasks]        = useState([]);
  const [teamMembers,  setTeamMembers]  = useState([]);
  const [view,         setView]         = useState('kanban');
  const [fieldValueMap,setFieldValueMap]= useState({});
  const [loading,      setLoading]      = useState(true);
  const [showFieldMgr, setShowFieldMgr] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newTaskEditor, setNewTaskEditor] = useState({ open: false, columnId: null });

  const { fieldDefs, createField, deleteField } = useFields(projectId);
  const { savedViews, saveView }                = useViews(projectId);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projR, colR, taskR, memR] = await Promise.all([
        api.get(`/teams/${projectId}`),
        api.get(`/projects/${projectId}/columns`),
        api.get('/tasks', { params: { team_id: projectId } }),
        api.get(`/teams/${projectId}`),
      ]);
      setProject(projR.data);
      setColumns(colR.data);
      setTasks(taskR.data);
      setTeamMembers(memR.data.members || []);
    } catch (e) {
      console.error('Board load failed', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [projectId]);

  // Load field values for all tasks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!tasks.length || !fieldDefs?.length) return;
    const map = {};
    Promise.all(tasks.map(async t => {
      try {
        const r = await api.get(`/fields/task/${t.task_id}/values`);
        map[t.task_id] = Object.fromEntries(r.data.map(v => [v.field_id, v.value]));
      } catch {}
    })).then(() => setFieldValueMap({ ...map }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length, fieldDefs?.length]);

  const handleColumnChange = (action, payload) => {
    if (action === 'new_task') setNewTaskEditor({ open: true, columnId: payload });
  };

  const addField = async () => {
    if (!newFieldName.trim()) return;
    await createField({ name: newFieldName.trim(), type: newFieldType, config: {} });
    setNewFieldName('');
  };

  const labelSt = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' };
  const inputSt = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)' };

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading board…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/projects')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontFamily: 'inherit' }}>
          ← Projects
        </button>
        <span style={{ color: 'var(--text-subtle)' }}>/</span>
        <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>
          {project?.team?.name || project?.name || '…'}
        </span>

        {/* View switcher */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', padding: 3 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: view === v.id ? 600 : 400, background: view === v.id ? 'var(--bg-elevated)' : 'transparent', color: view === v.id ? 'var(--text-default)' : 'var(--text-muted)', boxShadow: view === v.id ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s' }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Saved views */}
        {savedViews?.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {savedViews.map(sv => (
              <button key={sv.view_id} onClick={() => setView(sv.config?.viewType || 'kanban')}
                style={{ padding: '4px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-xs)', background: 'var(--bg-default)', color: 'var(--text-muted)' }}>
                {sv.name}
              </button>
            ))}
          </div>
        )}

        {/* Field manager toggle */}
        <button onClick={() => setShowFieldMgr(v => !v)}
          style={{ padding: '5px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-muted)' }}>
          ⚙ Fields
        </button>

        {/* Save view */}
        <button onClick={() => saveView({ name: `View ${(savedViews?.length||0)+1}`, config: { viewType: view } })}
          style={{ padding: '5px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-muted)' }}>
          + Save view
        </button>
      </div>

      {/* Field manager panel */}
      {showFieldMgr && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12 }}>Custom Fields</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Name</label>
              <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                placeholder="Field name" style={{ ...inputSt, width: '100%' }} />
            </div>
            <div>
              <label style={labelSt}>Type</label>
              <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)} style={inputSt}>
                {['text','number','date','select','checkbox','url','person'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={addField}
              style={{ padding: '6px 14px', background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Add
            </button>
          </div>
          {(fieldDefs||[]).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No custom fields yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(fieldDefs||[]).map(f => (
                <div key={f.field_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 'var(--text-sm)' }}>
                  <span style={{ fontWeight: 500 }}>{f.name}</span>
                  <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{f.type}</span>
                  <button onClick={() => deleteField(f.field_id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Board view */}
      {view === 'kanban' && (
        <KanbanView columns={columns} tasks={tasks} fieldDefs={fieldDefs} fieldValueMap={fieldValueMap}
          teamMembers={teamMembers} onTasksChange={setTasks} onColumnChange={handleColumnChange} />
      )}
      {view === 'table' && (
        <TableView tasks={tasks} columns={columns} fieldDefs={fieldDefs} fieldValueMap={fieldValueMap}
          teamMembers={teamMembers} onTasksChange={setTasks} />
      )}
      {view === 'calendar' && (
        <CalendarView tasks={tasks} onTaskClick={t => console.log('open', t)} />
      )}

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

