/**
 * KanbanView.jsx — v2 drag-and-drop kanban board.
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import KanbanCard from './KanbanCard';
import TaskDrawer from '../TaskDrawer';

export default function KanbanView({ columns, tasks, fieldDefs, fieldValueMap, teamMembers, onTasksChange, onColumnChange }) {
  const [dragging, setDragging]         = useState(null);
  const [over, setOver]                 = useState(null);
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const dragIdx = useRef(null);

  const byCol = useMemo(() => {
    const m = {};
    (columns || []).forEach(c => { m[c.column_id] = []; });
    (tasks || []).forEach(t => {
      const cid = t.column_id || '__none__';
      if (!m[cid]) m[cid] = [];
      m[cid].push(t);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0)));
    return m;
  }, [columns, tasks]);

  const handleDragStart = (taskId, colId, idx) => {
    setDragging({ taskId, srcColId: colId });
    dragIdx.current = idx;
  };

  const handleDrop = useCallback(async (targetColId, targetIdx) => {
    if (!dragging) return;
    const { taskId } = dragging;
    setDragging(null); setOver(null);
    const order = targetIdx ?? (byCol[targetColId]?.length ?? 0);
    try {
      const res = await api.patch(`/api/tasks/${taskId}/move`, { column_id: targetColId, order });
      onTasksChange?.(prev => prev.map(t => t.task_id === taskId ? res.data : t));
    } catch (e) { console.error('Move failed', e); }
  }, [dragging, byCol, onTasksChange]);

  const S = {
    board:  { display:'flex', gap:16, overflowX:'auto', paddingBottom:16, alignItems:'flex-start', minHeight:'calc(100vh - 180px)' },
    col:    (isOver) => ({ display:'flex', flexDirection:'column', gap:8, minWidth:272, maxWidth:272, background:isOver?'var(--accent-subtle)':'var(--bg-subtle)', borderRadius:'var(--radius-lg)', padding:12, border:`1px solid ${isOver?'var(--accent-default)':'var(--border-subtle)'}`, transition:'background 0.15s, border-color 0.15s' }),
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 },
    colName:{ fontSize:'var(--text-sm)', fontWeight:700, color:'var(--text-default)' },
    badge:  (col) => ({ background:col.color+'22', color:col.color, border:`1px solid ${col.color}44`, borderRadius:'var(--radius-full)', padding:'1px 8px', fontSize:'var(--text-xs)', fontWeight:700 }),
    drop:   { height:60, border:'2px dashed var(--accent-default)', borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-default)', fontSize:'var(--text-sm)' },
    addBtn: { width:'100%', background:'transparent', border:'1px dashed var(--border-default)', borderRadius:'var(--radius-md)', padding:'7px 0', cursor:'pointer', color:'var(--text-muted)', fontSize:'var(--text-sm)', fontFamily:'inherit', marginTop:4 },
  };

  return (
    <>
      <div style={S.board}>
        {(columns || []).map(col => {
          const colTasks = byCol[col.column_id] || [];
          const isOver = over === col.column_id;
          return (
            <div key={col.column_id} style={S.col(isOver)}
              onDragOver={e => { e.preventDefault(); setOver(col.column_id); }}
              onDragLeave={() => setOver(o => o === col.column_id ? null : o)}
              onDrop={() => handleDrop(col.column_id, null)}
            >
              <div style={S.header}>
                <span style={S.colName}>{col.name}</span>
                <span style={S.badge(col)}>{colTasks.length}</span>
              </div>
              {colTasks.map((task, idx) => (
                <div key={task.task_id} draggable
                  onDragStart={() => handleDragStart(task.task_id, col.column_id, idx)}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  onDrop={e => { e.stopPropagation(); handleDrop(col.column_id, idx); }}
                  onDragOver={e => e.preventDefault()}
                >
                  <KanbanCard task={task} fieldDefs={fieldDefs||[]} fieldValues={fieldValueMap?.[task.task_id]||{}}
                    dragging={dragging?.taskId===task.task_id} onClick={() => setDrawerTaskId(task.task_id)} />
                </div>
              ))}
              {isOver && dragging && colTasks.length===0 && <div style={S.drop}>Drop here</div>}
              <button style={S.addBtn} onClick={() => onColumnChange?.('new_task', col.column_id)}>+ Add task</button>
            </div>
          );
        })}
      </div>
      <TaskDrawer taskId={drawerTaskId} open={!!drawerTaskId} onClose={() => setDrawerTaskId(null)}
        teamMembers={teamMembers} onSaved={u => onTasksChange?.(p => p.map(t => t.task_id===u.task_id?u:t))} />
    </>
  );
}
