/**
 * ProjectBoardPage.jsx — full dynamic board with 4 views: Board, List, Schedule, Tracker.
 * Extracted from App.js monolith.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../lib/api';
import { K } from '../lib/brand';
import { currentUser, formatDue, approvalBadgeStyle } from '../lib/auth';
import { cn } from '../lib/utils';
import { useToast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { Input }  from '../components/ui/input';
import { Modal }  from '../components/ui/modal';
import TaskEditor from '../components/TaskEditor';
import {
  ChevronRight, Settings, Plus, GripVertical, Calendar,
  CheckCircle2, Kanban, AlignLeft, BarChart3, Pencil, Trash2,
} from 'lucide-react';

const PRESET_COLORS = ['#0082c6','#03a1b6','#05b7aa','#8b5cf6','#f59e0b','#ef4444','#10b981','#ec4899','#6366f1','#84cc16'];

function ColumnManager({ open, onClose, projectId, columns, onColumnsChange }) {
  const { pushToast } = useToast();
  const [cols,     setCols]     = useState(columns);
  const [newName,  setNewName]  = useState('');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [newIsDone, setNewIsDone] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName]  = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving,    setSaving]    = useState(false);
  useEffect(() => { setCols(columns); }, [columns]);

  const addCol = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await api.post(`/projects/${projectId}/columns`, { name: newName.trim(), color: newColor, is_done: newIsDone });
      const updated = [...cols, r.data]; setCols(updated); onColumnsChange(updated);
      setNewName(''); setNewColor('#8b5cf6'); setNewIsDone(false);
      pushToast({ type: 'success', title: 'Column added' });
    } catch (_) { pushToast({ type: 'error', title: 'Could not add column' }); }
    finally { setSaving(false); }
  };
  const saveEdit = async (colId) => {
    try {
      const r = await api.put(`/projects/${projectId}/columns/${colId}`, { name: editName, color: editColor });
      const updated = cols.map(c => c.column_id === colId ? r.data : c); setCols(updated); onColumnsChange(updated); setEditingId(null);
    } catch (_) { pushToast({ type: 'error', title: 'Could not save' }); }
  };
  const deleteCol = async (colId) => {
    if (!window.confirm('Delete this column? Tasks will move to the first remaining column.')) return;
    try {
      await api.delete(`/projects/${projectId}/columns/${colId}`);
      const updated = cols.filter(c => c.column_id !== colId); setCols(updated); onColumnsChange(updated);
    } catch (err) { pushToast({ type: 'error', title: err?.response?.data?.detail || 'Could not delete' }); }
  };

  return (
    <Modal open={open} onOpenChange={onClose} title="Manage Board Columns" footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="space-y-5">
        <div className="space-y-2">
          {cols.map(col => (
            <div key={col.column_id} className="rounded-2xl border border-border/60 bg-background/40 p-3">
              {editingId === col.column_id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} />
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map(c => <button key={c} onClick={() => setEditColor(c)} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: editColor === c ? '2px solid #fff' : '2px solid transparent', outline: editColor === c ? `2px solid ${c}` : 'none' }} />)}
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer' }} />
                  </div>
                  <div className="flex gap-2"><Button onClick={() => saveEdit(col.column_id)} className="flex-1">Save</Button><Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button></div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: col.color, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0"><span className="text-sm font-semibold">{col.name}</span>{col.is_done && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: K.teal + '22', color: K.teal }}>marks done</span>}</div>
                  <button onClick={() => { setEditingId(col.column_id); setEditName(col.name); setEditColor(col.color); }} className="p-1.5 rounded-lg hover:bg-muted/40"><Pencil size={12} /></button>
                  <button onClick={() => deleteCol(col.column_id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-3">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Add Column</div>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., In Review, Approval, Live…" onKeyDown={e => e.key === 'Enter' && addCol()} />
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(c => <button key={c} onClick={() => setNewColor(c)} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: newColor === c ? '2px solid #fff' : '2px solid transparent', outline: newColor === c ? `2px solid ${c}` : 'none' }} />)}
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer' }} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={newIsDone} onChange={e => setNewIsDone(e.target.checked)} />
            Mark tasks in this column as <strong>done</strong>
          </label>
          <Button onClick={addCol} disabled={saving} className="w-full"><Plus size={14} /><span className="ml-1.5">Add Column</span></Button>
        </div>
      </div>
    </Modal>
  );
}

const VIEWS = [
  { id: 'board',    label: 'Board',    Icon: Kanban },
  { id: 'list',     label: 'List',     Icon: AlignLeft },
  { id: 'schedule', label: 'Schedule', Icon: Calendar },
  { id: 'tracker',  label: 'Tracker',  Icon: BarChart3 },
];

const priorityStyle = (p) => ({
  urgent: { background: '#ef444420', color: '#ef4444' },
  high:   { background: '#f59e0b20', color: '#f59e0b' },
  medium: { background: '#0082c620', color: '#0082c6' },
  low:    { background: '#88888820', color: '#888' },
}[p] || {});

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user    = currentUser();
  const isOwner = user?.role === 'admin' || user?.role === 'owner';

  const [project,    setProject]    = useState(null);
  const [columns,    setColumns]    = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [categories, setCats]       = useState([]);
  const [view,       setView]       = useState('board');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [colMgrOpen, setColMgrOpen] = useState(false);
  const [filterCol,  setFilterCol]  = useState('');

  const load = useCallback(async () => {
    const [proj, cols, t, c] = await Promise.all([
      api.get(`/teams/${projectId}`),
      api.get(`/projects/${projectId}/columns`),
      api.get('/tasks', { params: { team_id: projectId } }),
      api.get('/categories'),
    ]);
    setProject(proj.data); setColumns(cols.data); setTasks(t.data); setCats(c.data);
  }, [projectId]);

  useEffect(() => { load().catch(() => pushToast({ type: 'error', title: 'Could not load board' })); }, [load, pushToast]);

  const grouped = useMemo(() => {
    const m = {};
    columns.forEach(c => { m[c.column_id] = []; });
    tasks.forEach(t => {
      const key = t.column_id && m[t.column_id] !== undefined ? t.column_id : columns[0]?.column_id;
      if (key) { m[key] = m[key] || []; m[key].push(t); }
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return m;
  }, [tasks, columns]);

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
    const srcList = Array.from(grouped[source.droppableId] || []);
    const dstList = source.droppableId === destination.droppableId ? srcList : Array.from(grouped[destination.droppableId] || []);
    const moving = srcList.find(t => t.task_id === draggableId);
    if (!moving) return;
    srcList.splice(srcList.findIndex(t => t.task_id === draggableId), 1);
    dstList.splice(destination.index, 0, { ...moving, column_id: destination.droppableId });
    setTasks(prev => prev.map(t => t.task_id === draggableId ? { ...t, column_id: destination.droppableId } : t));
    try { await api.patch(`/tasks/${draggableId}/move`, { column_id: destination.droppableId, order: destination.index }); }
    catch (_) { pushToast({ type: 'error', title: 'Move failed' }); load(); }
  };

  const catName   = (id) => categories.find(c => c.category_id === id)?.name || '';
  const colForTask = (t) => columns.find(c => c.column_id === t.column_id) || columns[0];
  const listTasks  = filterCol ? (grouped[filterCol] || []) : tasks;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate('/projects')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Projects</button>
        <ChevronRight size={14} className="text-muted-foreground" />
        <div className="text-sm font-bold">{project?.team?.name || '…'}</div>
        <div className="ml-auto flex items-center gap-1 rounded-2xl border border-border/60 bg-card/50 p-1">
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setView(id)} className={cn('view-pill', view === id && 'active')}><Icon size={12} />{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && <Button variant="ghost" onClick={() => setColMgrOpen(true)} className="text-xs h-9"><Settings size={13} /><span className="ml-1.5">Columns</span></Button>}
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={15} /><span className="ml-1.5">New task</span></Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {columns.map(col => (
          <div key={col.column_id} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: col.color + '18', color: col.color, border: `1px solid ${col.color}44` }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: col.color }} />
            {col.name} <span className="opacity-60">·</span> <span className="opacity-60">{(grouped[col.column_id] || []).length}</span>
          </div>
        ))}
      </div>

      {view === 'board' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
            {columns.map(col => (
              <div key={col.column_id} className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden flex flex-col flex-shrink-0"
                style={{ width: 280, borderTopWidth: 3, borderTopColor: col.color }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span className="text-sm font-bold">{col.name}</span>
                    {col.is_done && <CheckCircle2 size={12} style={{ color: col.color }} />}
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: col.color + '18', color: col.color }}>{(grouped[col.column_id] || []).length}</span>
                </div>
                <Droppable droppableId={col.column_id}>{(prov, snap) => (
                  <div ref={prov.innerRef} {...prov.droppableProps}
                    className={cn('flex-1 min-h-[240px] p-2 space-y-2 transition-colors', snap.isDraggingOver && 'board-col-active')}>
                    {(grouped[col.column_id] || []).map((t, i) => (
                      <Draggable key={t.task_id} draggableId={t.task_id} index={i}>{(drag) => (
                        <div ref={drag.innerRef} {...drag.draggableProps}
                          onClick={() => { setEditing(t); setEditorOpen(true); }}
                          className="rounded-2xl border border-border/60 bg-background/50 p-3.5 shadow-sm cursor-pointer hover:border-border transition-colors group">
                          <div className="flex items-start justify-between gap-2">
                            <div {...drag.dragHandleProps} className="mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab" onClick={e => e.stopPropagation()}>
                              <GripVertical size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold leading-snug">{t.title}</div>
                              {t.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={priorityStyle(t.priority)}>{t.priority}</span>
                          </div>
                          {t.approval_status && approvalBadgeStyle(t.approval_status) && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: approvalBadgeStyle(t.approval_status).bg, color: approvalBadgeStyle(t.approval_status).color, fontWeight: 500 }}>{approvalBadgeStyle(t.approval_status).label}</span>
                              {(t.attachments || []).length > 0 && <span className="text-[10px] text-muted-foreground">📎 {t.attachments.length}</span>}
                            </div>
                          )}
                          {t.category_id && <div className="mt-2 text-xs text-muted-foreground">{catName(t.category_id)}</div>}
                          {t.due_at && (
                            <div className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: new Date(t.due_at) < new Date() ? '#ef4444' : K.mid }}>
                              <Calendar size={10} />{formatDue(t.due_at)}
                            </div>
                          )}
                          {(t.subtasks || []).length > 0 && (
                            <div className="mt-2">
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>Subtasks</span><span>{t.subtasks.filter(s => s.is_done).length}/{t.subtasks.length}</span></div>
                              <div className="h-1 rounded-full bg-border/60 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(t.subtasks.filter(s => s.is_done).length / t.subtasks.length) * 100}%`, background: col.color }} /></div>
                            </div>
                          )}
                          {(t.tags || []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">{t.tags.slice(0,3).map(tag => <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: col.color + '15', color: col.color }}>{tag}</span>)}</div>
                          )}
                        </div>
                      )}</Draggable>
                    ))}
                    {prov.placeholder}
                    <button onClick={() => { setEditing({ _defaultColumn: col.column_id }); setEditorOpen(true); }}
                      className="w-full rounded-2xl border border-dashed border-border/40 py-2 text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors flex items-center justify-center gap-1">
                      <Plus size={11} /> Add task
                    </button>
                  </div>
                )}</Droppable>
              </div>
            ))}
            {isOwner && (
              <button onClick={() => setColMgrOpen(true)}
                className="rounded-3xl border border-dashed border-border/60 flex-shrink-0 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                style={{ width: 180, minHeight: 240 }}>
                <Plus size={14} /> New column
              </button>
            )}
          </div>
        </DragDropContext>
      )}

      {view === 'list' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setFilterCol('')} className={cn('view-pill', !filterCol && 'active')}>All</button>
            {columns.map(col => (
              <button key={col.column_id} onClick={() => setFilterCol(col.column_id)}
                className={cn('view-pill', filterCol === col.column_id && 'active')}
                style={filterCol === col.column_id ? { color: col.color, background: col.color + '18', borderColor: col.color + '55' } : {}}>
                {col.name}
              </button>
            ))}
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_110px_110px_180px_100px] border-b border-border/60 px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
              <div>Task</div><div>Column</div><div>Priority</div><div>Assignees</div><div>Due</div><div className="text-right">Actions</div>
            </div>
            {listTasks.length === 0
              ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No tasks in this column.</div>
              : listTasks.map(t => {
                const col = colForTask(t);
                return (
                  <div key={t.task_id} className="grid grid-cols-[1fr_140px_110px_110px_180px_100px] items-center border-b border-border/40 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <button onClick={() => { setEditing(t); setEditorOpen(true); }} className="min-w-0 text-left">
                      <div className="truncate text-sm font-semibold">{t.title}</div>
                      {t.description && <div className="truncate text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                    </button>
                    <div className="flex items-center gap-1.5">{col && <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />}<span className="text-xs text-muted-foreground truncate">{col?.name || '—'}</span></div>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg w-fit" style={priorityStyle(t.priority)}>{t.priority}</span>
                    <div className="text-xs text-muted-foreground">{(t.assignee_user_ids || []).length > 0 ? `${t.assignee_user_ids.length} person${t.assignee_user_ids.length > 1 ? 's' : ''}` : '—'}</div>
                    <div className="text-xs text-muted-foreground">{t.due_at ? formatDue(t.due_at) : '—'}</div>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" className="px-2 h-8" onClick={async () => {
                        try { const r = await api.patch(`/tasks/${t.task_id}/toggle`); setTasks(p => p.map(x => x.task_id === t.task_id ? r.data : x)); }
                        catch (_) { pushToast({ type: 'error', title: 'Could not update' }); }
                      }}>{col?.is_done ? 'Reopen' : 'Done'}</Button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {view === 'schedule' && (
        <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <div className="text-sm font-bold">Schedule</div>
            <div className="text-xs text-muted-foreground mt-0.5">Tasks sorted by due date</div>
          </div>
          {tasks.filter(t => t.due_at).length === 0
            ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No tasks with due dates yet.</div>
            : tasks.filter(t => t.due_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).map(t => {
              const col = colForTask(t);
              const overdue = new Date(t.due_at) < new Date() && !col?.is_done;
              return (
                <div key={t.task_id} className="flex items-start gap-4 border-b border-border/40 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => { setEditing(t); setEditorOpen(true); }}>
                  <div className="flex flex-col items-center min-w-[52px]">
                    <div className="text-2xl font-black" style={{ color: overdue ? '#ef4444' : K.blue }}>{new Date(t.due_at).getDate()}</div>
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">{new Date(t.due_at).toLocaleString('default', { month: 'short' })}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(t.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: col?.color || K.blue, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="text-sm font-semibold flex-1">{t.title}</div>
                      {overdue && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#ef444420', color: '#ef4444' }}>OVERDUE</span>}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0" style={priorityStyle(t.priority)}>{t.priority}</span>
                    </div>
                    {t.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</div>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {col && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: col.color + '18', color: col.color }}>{col.name}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {view === 'tracker' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border/70 bg-card/50 p-6">
            <div className="text-sm font-bold mb-5">Column Distribution</div>
            {columns.map(col => {
              const count = (grouped[col.column_id] || []).length;
              const pct   = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
              return (
                <div key={col.column_id} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2"><div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} /><span className="text-sm font-semibold">{col.name}</span></div>
                    <div className="text-sm font-bold" style={{ color: col.color }}>{count} <span className="text-muted-foreground font-normal text-xs">tasks · {pct}%</span></div>
                  </div>
                  <div className="h-2.5 rounded-full bg-border/60 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: col.color }} /></div>
                </div>
              );
            })}
            <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total tasks</span>
              <span className="text-2xl font-black" style={{ color: K.blue }}>{tasks.length}</span>
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/50 p-6">
            <div className="text-sm font-bold mb-5">Priority Breakdown</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['urgent','high','medium','low'].map(p => {
                const count = tasks.filter(t => t.priority === p).length;
                const style = priorityStyle(p);
                return (
                  <div key={p} className="rounded-2xl border border-border/60 p-4 text-center">
                    <div className="text-2xl font-black" style={{ color: style.color }}>{count}</div>
                    <div className="text-xs font-bold uppercase mt-1 capitalize" style={{ color: style.color }}>{p}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'With due dates', value: tasks.filter(t => t.due_at).length, color: K.blue },
              { label: 'Overdue',        value: tasks.filter(t => t.due_at && new Date(t.due_at) < new Date() && !colForTask(t)?.is_done).length, color: '#ef4444' },
              { label: 'Done columns',  value: tasks.filter(t => colForTask(t)?.is_done).length, color: K.teal },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-3xl border border-border/70 bg-card/50 p-5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                <div className="mt-2 text-3xl font-black" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskEditor
        key={editing ? (editing.task_id || 'new-from-col') : 'new'}
        open={editorOpen} onOpenChange={setEditorOpen}
        editing={editing?.task_id ? editing : null}
        categories={categories}
        teams={project ? [{ team_id: projectId, name: project.team?.name || 'This project' }] : []}
        defaultTeamId={projectId}
        defaultColumnId={editing?._defaultColumn || null}
        columns={columns}
        onSaved={task => {
          setEditorOpen(false); setEditing(null);
          setTasks(prev => { const e = prev.some(t => t.task_id === task.task_id); return e ? prev.map(t => t.task_id === task.task_id ? task : t) : [task, ...prev]; });
        }}
      />

      <ColumnManager
        open={colMgrOpen} onClose={() => setColMgrOpen(false)}
        projectId={projectId} columns={columns}
        onColumnsChange={updated => { setColumns(updated); load(); }}
      />
    </div>
  );
}
