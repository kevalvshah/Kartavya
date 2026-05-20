/**
 * PriorityView.jsx — tasks grouped by Urgent / High / Medium / Low.
 * Each group is a collapsible section with task rows.
 */
import React, { useState, useMemo } from 'react';
import TaskDrawer from '../TaskDrawer';

const PRIORITIES = [
  { id: 'urgent', label: 'Urgent', sans: 'अत्यावश्यक', color: '#dc2626' },
  { id: 'high',   label: 'High',   sans: 'उच्च',       color: '#ef4444' },
  { id: 'medium', label: 'Medium', sans: 'मध्यम',      color: '#f59e0b' },
  { id: 'low',    label: 'Low',    sans: 'लघु',        color: '#22c55e' },
];

const STATUS_COLOR = { todo: '#64748b', in_progress: '#0082c6', in_review: '#8b5cf6', done: '#16a34a', requested: '#9333ea' };
const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done', requested: 'Requested' };

function Avatar({ uid, i }) {
  const COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];
  return (
    <span title={uid} style={{
      width: 22, height: 22, borderRadius: '50%',
      background: COLORS[i % COLORS.length], color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, border: '2px solid var(--surface)',
      marginLeft: i > 0 ? -6 : 0, flexShrink: 0,
    }}>
      {uid.slice(-2).toUpperCase()}
    </span>
  );
}

export default function PriorityView({ tasks = [], columns = [], teamMembers = [], onTasksChange }) {
  const [drawer,    setDrawer]    = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const colMap = useMemo(() => {
    const m = {}; (columns || []).forEach(c => { m[c.column_id] = c; }); return m;
  }, [columns]);

  const grouped = useMemo(() => {
    const m = {};
    PRIORITIES.forEach(p => { m[p.id] = []; });
    tasks.forEach(t => {
      const p = t.priority || 'medium';
      if (m[p]) m[p].push(t);
    });
    return m;
  }, [tasks]);

  const now = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {PRIORITIES.map(p => {
        const rows = grouped[p.id] || [];
        const isCol = collapsed[p.id];
        const overdue = rows.filter(t => t.due_at && new Date(t.due_at) < now && t.status !== 'done').length;

        return (
          <div key={p.id} style={{ background: 'var(--surface)', border: `1px solid var(--rule)`, borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {/* Group header */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', cursor: 'pointer', borderLeft: `4px solid ${p.color}` }}
              onClick={() => setCollapsed(c => ({ ...c, [p.id]: !c[p.id] }))}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-soft)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{p.label}</span>
              <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: 'var(--ink-3)' }}>{p.sans}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', background: 'var(--bg-soft)', padding: '1px 7px', borderRadius: 99 }}>{rows.length}</span>
              {overdue > 0 && (
                <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginLeft: 4 }}>⚠ {overdue} overdue</span>
              )}
              <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontSize: 13 }}>{isCol ? '▸' : '▾'}</span>
            </div>

            {/* Task rows */}
            {!isCol && (
              <>
                {rows.length === 0 && (
                  <div style={{ padding: '14px 20px', fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', fontFamily: 'var(--font-display)', borderTop: '1px solid var(--rule-soft)' }}>
                    Nothing here
                  </div>
                )}
                {rows.map(t => {
                  const col = colMap[t.column_id];
                  const isOverdue = t.due_at && new Date(t.due_at) < now && t.status !== 'done';
                  const sColor = STATUS_COLOR[t.status] || '#64748b';
                  return (
                    <div
                      key={t.task_id}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 20px', borderTop: '1px solid var(--rule-soft)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-soft)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                      onClick={() => setDrawer(t.task_id)}
                    >
                      {/* Status badge */}
                      <span style={{ fontSize: 11, fontWeight: 600, color: sColor, background: sColor + '18', borderRadius: 99, padding: '2px 9px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>

                      {/* Title */}
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </span>

                      {/* Column */}
                      {col && (
                        <span style={{ fontSize: 11, color: col.color || 'var(--ink-3)', fontWeight: 600, background: (col.color || '#94a3b8') + '18', borderRadius: 99, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {col.name}
                        </span>
                      )}

                      {/* Due */}
                      {t.due_at && (
                        <span style={{ fontSize: 11, color: isOverdue ? '#dc2626' : 'var(--ink-3)', fontWeight: isOverdue ? 700 : 400, flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {isOverdue && '⚠ '}{new Date(t.due_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}

                      {/* Assignees */}
                      {(t.assignee_user_ids || []).length > 0 && (
                        <div style={{ display: 'flex', flexShrink: 0 }}>
                          {(t.assignee_user_ids || []).slice(0, 3).map((uid, i) => <Avatar key={uid} uid={uid} i={i} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}

      <TaskDrawer taskId={drawer} open={!!drawer} onClose={() => setDrawer(null)} teamMembers={teamMembers}
        onSaved={u => { setDrawer(null); onTasksChange?.(p => p.map(t => t.task_id === u.task_id ? u : t)); }} />
    </div>
  );
}
