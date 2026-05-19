import React, { useState, useRef, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import KanbanCard from './KanbanCard';
import TaskDrawer from '../TaskDrawer';

// Synthetic column injected at position 0 for admins/owners
const REQUESTED_COL = {
  column_id: '__requested__',
  name: 'Requested',
  color: '#94a3b8',
  _synthetic: true,
};

// Synthetic column for tasks awaiting client approval
const CLIENT_APPROVAL_COL = {
  column_id: '__pending_client__',
  name: 'Awaiting Client Approval',
  color: '#7c3aed',
  _synthetic: true,
  _hindi: 'क्लाइंट अनुमोदन',
};

export default function KanbanView({
  columns, tasks, fieldDefs, fieldValueMap, teamMembers,
  onTasksChange, onColumnChange,
  // readOnly: disables ALL drag + hides "Add task" buttons
  readOnly = false,
  // currentUserId / currentUserRole: used to enforce client drag rules
  currentUserId,
  currentUserRole,
  // showRequested: inject "Requested" column (admins/owners on project board)
  showRequested = false,
  // showClientApproval: inject "Awaiting Client Approval" column
  showClientApproval = false,
}) {
  const [dragging, setDragging]         = useState(null);
  const [over, setOver]                 = useState(null);
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const dragIdx = useRef(null);

  const isClient = currentUserRole === 'client';

  // Columns to render — prepend synthetic cols when enabled
  const visibleColumns = useMemo(() => {
    let cols = columns || [];
    if (showClientApproval) cols = [...cols, CLIENT_APPROVAL_COL];
    if (showRequested) cols = [REQUESTED_COL, ...cols];
    return cols;
  }, [columns, showRequested, showClientApproval]);

  // Status → column fallback for tasks with missing/invalid column_id
  const statusFallbackCol = useMemo(() => {
    const cols = visibleColumns.filter(c => !c._synthetic);
    const find = (names) => cols.find(c => names.includes(c.name?.toLowerCase()))?.column_id;
    return {
      done:        find(['done', 'complete', 'completed']) || cols[cols.length - 1]?.column_id,
      in_progress: find(['in progress', 'in-progress', 'inprogress', 'doing', 'review', 'in review', 'approval']) || cols[1]?.column_id || cols[0]?.column_id,
      todo:        find(['to do', 'todo', 'backlog', 'open', 'not started']) || cols[0]?.column_id,
    };
  }, [visibleColumns]);

  const byCol = useMemo(() => {
    const validColIds = new Set(visibleColumns.map(c => c.column_id));
    const m = {};
    visibleColumns.forEach(c => { m[c.column_id] = []; });
    (tasks || []).forEach(t => {
      if (showRequested && t.status === 'requested') {
        m['__requested__'].push(t);
        return;
      }
      if (showClientApproval && t.approval_status === 'pending_client') {
        m['__pending_client__'].push(t);
        return;
      }
      // Use column_id if valid; otherwise fall back to a column matching the task's status
      const cid = (t.column_id && validColIds.has(t.column_id))
        ? t.column_id
        : (statusFallbackCol[t.status] || statusFallbackCol.todo);
      if (cid && m[cid]) m[cid].push(t);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0)));
    return m;
  }, [visibleColumns, tasks, showRequested, statusFallbackCol]);

  // Can this task be dragged by the current user?
  const canDrag = (task) => {
    if (readOnly) return false;
    if (isClient) {
      // Clients can only drag their own tasks, and only if not yet in_progress
      return task.created_by === currentUserId && task.status !== 'in_progress';
    }
    return true;
  };

  // Can a task be dropped into this column by current user?
  const canDrop = (col) => {
    if (readOnly) return false;
    // Nobody can drag INTO the synthetic Requested column — only backend sets that
    if (col._synthetic) return false;
    return true;
  };

  const handleDragStart = (taskId, colId, idx) => {
    setDragging({ taskId, srcColId: colId });
    dragIdx.current = idx;
  };

  const handleDrop = useCallback(async (targetColId, targetIdx) => {
    if (!dragging || targetColId === '__requested__' || targetColId === '__pending_client__') return;
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
        {visibleColumns.map(col => {
          const colTasks = byCol[col.column_id] || [];
          const isOver   = over === col.column_id && canDrop(col);
          const isSynth  = col._synthetic;
          return (
            <div key={col.column_id}
              className={`k-bcol${isOver ? ' is-over' : ''}${isSynth ? ' k-bcol--requested' : ''}`}
              onDragOver={e => { if (canDrop(col)) { e.preventDefault(); setOver(col.column_id); } }}
              onDragLeave={() => setOver(o => o === col.column_id ? null : o)}
              onDrop={() => canDrop(col) && handleDrop(col.column_id, null)}
            >
              <div className="k-bcol__head">
                <span className="k-bcol__bar" style={{ background: col.color || 'var(--k-primary)' }} />
                <span className="k-bcol__title">
                  {col.name}
                  {isSynth && col._hindi && (
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: 'var(--ink-3)', marginLeft: 6 }}>{col._hindi}</span>
                  )}
                  {isSynth && !col._hindi && col.column_id === '__requested__' && (
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: 'var(--ink-3)', marginLeft: 6 }}>अनुरोध</span>
                  )}
                </span>
                <span className="k-bcol__count">{colTasks.length}</span>
              </div>
              <div className="k-bcol__body">
                {colTasks.map((task, idx) => {
                  const draggable = canDrag(task);
                  return (
                    <div key={task.task_id}
                      draggable={draggable}
                      onDragStart={draggable ? () => handleDragStart(task.task_id, col.column_id, idx) : undefined}
                      onDragEnd={draggable ? () => { setDragging(null); setOver(null); } : undefined}
                      onDrop={draggable ? e => { e.stopPropagation(); handleDrop(col.column_id, idx); } : undefined}
                      onDragOver={draggable ? e => e.preventDefault() : undefined}
                      style={draggable ? { cursor: 'grab' } : undefined}
                    >
                      <KanbanCard task={task} fieldDefs={fieldDefs || []} fieldValues={fieldValueMap?.[task.task_id] || {}}
                        dragging={dragging?.taskId === task.task_id} onClick={() => setDrawerTaskId(task.task_id)} />
                    </div>
                  );
                })}
                {isOver && dragging && colTasks.length === 0 && (
                  <div style={{ height: 60, border: '2px dashed var(--k-primary)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--k-primary)', fontSize: 13 }}>
                    Drop here
                  </div>
                )}
                {!readOnly && !isSynth && (
                  <button
                    style={{ width: '100%', background: 'transparent', border: '1px dashed var(--rule)', borderRadius: 'var(--r-md)', padding: '7px 0', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, fontFamily: 'inherit', marginTop: 4 }}
                    onClick={() => onColumnChange?.('new_task', col.column_id)}
                  >+ Add task</button>
                )}
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
