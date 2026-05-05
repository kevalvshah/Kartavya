/**
 * ProjectBoardPage.jsx — v2 project view hub.
 * BUG FIX: setPriority2 → setTitle in NewTaskModal (title input was broken)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import KanbanView   from '../components/views/KanbanView';
import TableView    from '../components/views/TableView';
import CalendarView from '../components/views/CalendarView';
import { useFieldDefs } from '../hooks/useFields';

const VIEW_ICONS = { kanban: '▦', table: '☰', calendar: '📅' };

function ViewPill({ id, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:6, padding:'5px 13px', border:'none',
      borderRadius:'var(--radius-full)', cursor:'pointer', fontFamily:'inherit',
      fontSize:'var(--text-sm)', fontWeight:active?700:500,
      background:active?'var(--accent-default)':'transparent',
      color:active?'#fff':'var(--text-muted)', transition:'background 0.15s,color 0.15s',
    }}>{VIEW_ICONS[id]} {label}</button>
  );
}

function NewTaskModal({ columns, teamId, onSaved, onClose }) {
  const [title,    setTitle]    = useState('');   // FIX: was [title, setPriority2]
  const [colId,    setColId]    = useState(columns[0]?.column_id || '');
  const [priority, setPriority] = useState('medium');
  const [saving,   setSaving]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/api/tasks', { title: title.trim(), team_id: teamId, column_id: colId, priority });
      onSaved(res.data);
      onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const S = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' },
    box:     { background:'var(--bg-elevated)', borderRadius:'var(--radius-xl)', padding:28, width:420, boxShadow:'var(--shadow-lg)' },
    label:   { display:'block', fontSize:'var(--text-xs)', fontWeight:700, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' },
    input:   { width:'100%', border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)', outline:'none', marginBottom:16 },
    select:  { width:'100%', border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)', cursor:'pointer', marginBottom:16 },
    row:     { display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 },
    btn:     (p) => ({ border:'none', borderRadius:'var(--radius-sm)', padding:'8px 18px', fontFamily:'inherit', fontWeight:700, fontSize:'var(--text-sm)', cursor:'pointer', background:p?'var(--accent-default)':'var(--bg-muted)', color:p?'#fff':'var(--text-default)' }),
  };

  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <form style={S.box} onSubmit={submit}>
        <h3 style={{ margin:'0 0 18px', fontSize:'var(--text-lg)', fontWeight:700 }}>New Task</h3>
        <label style={S.label}>Title</label>
        <input style={S.input} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title…" required />
        <label style={S.label}>Column</label>
        <select style={S.select} value={colId} onChange={e => setColId(e.target.value)}>
          {columns.map(c => <option key={c.column_id} value={c.column_id}>{c.name}</option>)}
        </select>
        <label style={S.label}>Priority</label>
        <select style={S.select} value={priority} onChange={e => setPriority(e.target.value)}>
          {['urgent','high','medium','low'].map(p => <option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}
        </select>
        <div style={S.row}>
          <button type="button" style={S.btn(false)} onClick={onClose}>Cancel</button>
          <button type="submit" style={S.btn(true)} disabled={saving}>{saving?'Creating…':'Create Task'}</button>
        </div>
      </form>
    </div>
  );
}

function FieldManager({ teamId, fieldDefs, onCreateField, onDeleteField }) {
  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState({ name:'', type:'text' });
  const [saving, setSaving] = useState(false);
  const create = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await onCreateField({ name:form.name, type:form.type }); setForm({ name:'', type:'text' }); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'5px 12px', background:'var(--bg-default)', cursor:'pointer', fontFamily:'inherit', fontSize:'var(--text-sm)', color:'var(--text-default)' }}>
        Fields ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', right:0, zIndex:100, marginTop:4, background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', width:280, padding:16 }}>
          <div style={{ fontWeight:700, fontSize:'var(--text-sm)', marginBottom:12 }}>Custom Fields</div>
          {(fieldDefs||[]).map(f => (
            <div key={f.field_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ fontSize:'var(--text-sm)' }}>{f.name} <span style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)' }}>({f.type})</span></span>
              <button onClick={() => onDeleteField(f.field_id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:14 }}>✕</button>
            </div>
          ))}
          <form onSubmit={create} style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} required placeholder="Field name"
              style={{ border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)', outline:'none' }} />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type:e.target.value }))}
              style={{ border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)', cursor:'pointer' }}>
              {['text','number','date','status','person','dropdown','files'].map(t => <option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}
            </select>
            <button type="submit" disabled={saving} style={{ background:'var(--accent-default)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:7, fontFamily:'inherit', fontWeight:700, cursor:'pointer', fontSize:'var(--text-sm)' }}>
              {saving ? 'Adding…' : '+ Add Field'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SavedViewsPicker({ teamId, currentView, onSelectView }) {
  const [views, setViews] = useState([]);
  useEffect(() => {
    if (!teamId) return;
    api.get(`/api/views/team/${teamId}`).then(r => setViews(r.data)).catch(() => {});
  }, [teamId]);
  const save = async () => {
    const name = prompt('Save view as:'); if (!name) return;
    const res = await api.post('/api/views/', { team_id:teamId, name, type:currentView, config:{}, is_default:false });
    setViews(v => [...v, res.data]);
  };
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      {views.length > 0 && (
        <select onChange={e => { const v = views.find(x => x.view_id===e.target.value); if (v) onSelectView(v.type); }}
          style={{ border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'5px 10px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)', cursor:'pointer' }}>
          <option value="">Saved views</option>
          {views.map(v => <option key={v.view_id} value={v.view_id}>{v.name} ({v.type})</option>)}
        </select>
      )}
      <button onClick={save} style={{ border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'5px 10px', background:'var(--bg-default)', cursor:'pointer', fontFamily:'inherit', fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>
        Save view
      </button>
    </div>
  );
}

export default function ProjectBoardPage() {
  const { teamId } = useParams();
  const navigate   = useNavigate();
  const [project,       setProject]       = useState(null);
  const [columns,       setColumns]       = useState([]);
  const [tasks,         setTasks]         = useState([]);
  const [members,       setMembers]       = useState([]);
  const [view,          setView]          = useState('kanban');
  const [loading,       setLoading]       = useState(true);
  const [showNew,       setShowNew]       = useState(false);
  const [fieldValueMap, setFieldValueMap] = useState({});
  const { defs: fieldDefs, createField, deleteField } = useFieldDefs(teamId);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    Promise.all([
      api.get(`/api/teams/${teamId}`),
      api.get(`/api/projects/${teamId}/columns`),
      api.get('/api/tasks', { params: { team_id: teamId } }),
    ]).then(([pRes, cRes, tRes]) => {
      setProject(pRes.data);
      setColumns(cRes.data);
      setTasks(tRes.data);
      setMembers(pRes.data.members || []);
    }).catch(e => { if (e.response?.status === 403) navigate('/projects'); })
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    if (!fieldDefs.length || !tasks.length) return;
    tasks.forEach(t => {
      if (fieldValueMap[t.task_id]) return;
      api.get(`/api/fields/task/${t.task_id}/values`).then(r => {
        const vals = {};
        r.data.forEach(v => { vals[v.field_id] = v.value; });
        setFieldValueMap(prev => ({ ...prev, [t.task_id]: vals }));
      }).catch(() => {});
    });
  }, [fieldDefs, tasks]);

  const handleTasksChange = useCallback(updater => setTasks(typeof updater === 'function' ? updater : () => updater), []);

  const addColumn = async () => {
    const name = prompt('New column name:'); if (!name) return;
    const res = await api.post(`/api/projects/${teamId}/columns`, { name });
    setColumns(c => [...c, res.data]);
  };

  const teamMembers = (members || []).map(m => ({
    user_id:      m.user_id || m.member_id,
    display_name: m.display_name || m.full_name || m.email,
  }));

  const S = {
    page:    { padding:'24px 28px', maxWidth:'100%' },
    header:  { display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' },
    title:   { fontSize:'var(--text-2xl)', fontWeight:700, color:'var(--text-default)', flex:1 },
    viewBar: { display:'inline-flex', background:'var(--bg-subtle)', borderRadius:'var(--radius-full)', padding:3, border:'1px solid var(--border-default)', gap:2 },
    btn:     (primary) => ({ border:primary?'none':'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'5px 12px', background:primary?'var(--accent-default)':'var(--bg-default)', cursor:'pointer', fontFamily:'inherit', fontSize:'var(--text-sm)', color:primary?'#fff':'var(--text-muted)', fontWeight:primary?700:400 }),
  };

  if (loading) return (
    <div style={{ padding:32 }}>
      {[1,2,3].map(i => <div key={i} style={{ height:18, background:'var(--bg-muted)', borderRadius:4, marginBottom:16, width:`${70-i*10}%` }} />)}
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button onClick={() => navigate('/projects')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:20 }}>←</button>
        <h1 style={S.title}>{project?.team?.name || '…'}</h1>
        <div style={S.viewBar}>
          {[['kanban','Kanban'],['table','Table'],['calendar','Calendar']].map(([id, label]) => (
            <ViewPill key={id} id={id} label={label} active={view===id} onClick={() => setView(id)} />
          ))}
        </div>
        <SavedViewsPicker teamId={teamId} currentView={view} onSelectView={setView} />
        <FieldManager teamId={teamId} fieldDefs={fieldDefs} onCreateField={createField} onDeleteField={deleteField} />
        {view === 'kanban' && <button style={S.btn(false)} onClick={addColumn}>+ Column</button>}
        <button style={S.btn(true)} onClick={() => setShowNew(true)}>+ New Task</button>
      </div>

      {view === 'kanban' && <KanbanView columns={columns} tasks={tasks} fieldDefs={fieldDefs} fieldValueMap={fieldValueMap} teamMembers={teamMembers} onTasksChange={handleTasksChange} onColumnChange={(a) => a==='new_task' && setShowNew(true)} />}
      {view === 'table'  && <TableView tasks={tasks} columns={columns} fieldDefs={fieldDefs} fieldValueMap={fieldValueMap} teamMembers={teamMembers} onTasksChange={handleTasksChange} />}
      {view === 'calendar' && <CalendarView tasks={tasks} teamMembers={teamMembers} onDayClick={() => setShowNew(true)} onTasksChange={handleTasksChange} />}

      {showNew && <NewTaskModal columns={columns} teamId={teamId} onSaved={task => setTasks(prev => [task, ...prev])} onClose={() => setShowNew(false)} />}
    </div>
  );
}
