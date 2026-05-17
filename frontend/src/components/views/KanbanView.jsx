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
      const res = await api.patch(`/tasks/${taskId}/move`, { column_id: targetColId, order });
      onTasksChange?.(prev => prev.map(t => t.task_id === taskId ? res.data : t));
    } catch (e) { console.error('Move failed', e); }
  }, [dragging, byCol, onTasksChange]);

  return (
    <>
      <div className="k-board">
        {(columns || []).map(col => {
          const colTasks = byCol[col.column_id] || [];
          const isOver = over === col.column_id;
          return (
            <div key={col.column_id}
              className={`k-bcol${isOver ? ' is-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setOver(col.column_id); }}
              onDragLeave={() => setOver(o => o === col.column_id ? null : o)}
              onDrop={() => handleDrop(col.column_id, null)}
            >
              <div className="k-bcol__head">
                <span className="k-bcol__bar" style={{ background: col.color || 'var(--k-primary)' }} />
                <span className="k-bcol__title">{col.name}</span>
                <span className="k-bcol__count">{colTasks.length}</span>
              </div>
              <div className="k-bcol__body">
                {colTasks.map((task, idx) => (
                  <div key={task.task_id} draggable
                    onDragStart={() => handleDragStart(task.task_id, col.column_id, idx)}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    onDrop={e => { e.stopPropagation(); handleDrop(col.column_id, idx); }}
                    onDragOver={e => e.preventDefault()}
                  >
                    <KanbanCard task={task} fieldDefs={fieldDefs || []} fieldValues={fieldValueMap?.[task.task_id] || {}}
                      dragging={dragging?.taskId === task.task_id} onClick={() => setDrawerTaskId(task.task_id)} />
                  </div>
                ))}
                {isOver && dragging && colTasks.length === 0 && (
                  <div style={{ height: 60, border: '2px dashed var(--k-primary)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--k-primary)', fontSize: 13 }}>
                    Drop here
                  </div>
                )}
                <button
                  style={{ width: '100%', background: 'transparent', border: '1px dashed var(--rule)', borderRadius: 'var(--r-md)', padding: '7px 0', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, fontFamily: 'inherit', marginTop: 4 }}
                  onClick={() => onColumnChange?.('new_task', col.column_id)}
                >+ Add task</button>
              </div>
            </div>
          );
        })}
      </div>
      <TaskDrawer taskId={drawerTaskId} open={!!drawerTaskId} onClose={() => setDrawerTaskId(null)}
        teamMembers={teamMembers} onSaved={u => onTasksChange?.(p => p.map(t => t.task_id === u.task_id ? u : t))} />
    </>
  );
}
