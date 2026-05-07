/**
 * CalendarView.jsx — v2 month calendar with drag-to-reschedule.
 * Drag a task pill onto any day cell to update its due_at via PATCH.
 */
import React, { useState, useRef } from 'react';
import { api } from '../../lib/api';
import TaskDrawer from '../TaskDrawer';

const DAYS         = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PCOLOR       = { urgent:'#dc2626', high:'#ef4444', medium:'#f59e0b', low:'#22c55e' };

export default function CalendarView({ tasks, teamMembers, onDayClick, onTasksChange }) {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [drawer, setDrawer] = useState(null);
  const [dragOver, setDragOver] = useState(null); // day number being hovered
  const draggingId = useRef(null);

  const firstDay = new Date(year, month, 1).getDay();
  const numDays  = new Date(year, month + 1, 0).getDate();
  const today    = now.toDateString();

  // group tasks by calendar day
  const byDay = {};
  (tasks || []).forEach(t => {
    if (!t.due_at) return;
    const d = new Date(t.due_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(t);
    }
  });

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  // build grid cells (blank padding + numbered days)
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ blank: true });
  for (let d = 1; d <= numDays; d++) cells.push({ blank: false, day: d });
  while (cells.length % 7 !== 0) cells.push({ blank: true });

  // ── drag-to-reschedule handlers ───────────────────────────────────────────
  const handleDragStart = (e, taskId) => {
    draggingId.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, day) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(day);
  };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = draggingId.current;
    if (!taskId) return;
    draggingId.current = null;
    // build new due_at: keep original time, change year/month/day
    const task = (tasks || []).find(t => t.task_id === taskId);
    const original = task?.due_at ? new Date(task.due_at) : new Date();
    const newDue = new Date(
      year, month, day,
      original.getHours(), original.getMinutes(), original.getSeconds()
    );
    try {
      const res = await api.put(`/tasks/${taskId}`, { due_at: newDue.toISOString() });
      onTasksChange?.(prev => prev.map(t => t.task_id === taskId ? res.data : t));
    } catch (err) {
      console.error('Reschedule failed', err);
    }
  };

  const handleDragLeave = (e) => {
    // only clear if leaving the cell entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  };

  // ── styles ───────────────────────────────────────────────────────────────
  const S = {
    nav:    { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16 },
    navBtn: { background:'var(--bg-muted)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'6px 14px', cursor:'pointer', fontFamily:'inherit', fontSize:'var(--text-sm)', color:'var(--text-default)' },
    grid:   { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap: 1, background:'var(--border-default)', borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid var(--border-default)' },
    dayHdr: { background:'var(--bg-subtle)', padding:'8px 0', textAlign:'center', fontSize:'var(--text-xs)', fontWeight: 700, color:'var(--text-muted)', textTransform:'uppercase' },
    cell:   (isToday, isOver) => ({ background: isOver ? 'var(--accent-subtle)' : isToday ? 'var(--accent-subtle)' : 'var(--bg-elevated)', minHeight: 90, padding:'6px 8px', cursor:'pointer', position:'relative', outline: isOver ? '2px solid var(--accent-default)' : 'none', transition:'background 0.1s' }),
    dayNum: (isToday) => ({ fontSize:'var(--text-xs)', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent-default)' : 'var(--text-muted)', marginBottom: 4 }),
    pill:   (priority) => ({ display:'flex', alignItems:'center', gap: 4, borderRadius:'var(--radius-sm)', padding:'2px 5px', marginBottom: 2, cursor:'grab', fontSize:'var(--text-xs)', lineHeight: 1.3, background:(PCOLOR[priority]||'#94a3b8')+'22', color: PCOLOR[priority]||'#94a3b8', userSelect:'none' }),
    more:   { fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop: 2 },
    legend: { display:'flex', gap: 12, marginTop: 12, flexWrap:'wrap', fontSize:'var(--text-xs)', color:'var(--text-muted)' },
  };

  return (
    <div>
      {/* Month nav */}
      <div style={S.nav}>
        <button style={S.navBtn} onClick={prev}>‹ Prev</button>
        <span style={{ fontSize:'var(--text-xl)', fontWeight: 700 }}>{MONTHS[month]} {year}</span>
        <button style={S.navBtn} onClick={next}>Next ›</button>
      </div>

      {/* Calendar grid */}
      <div style={S.grid}>
        {DAYS.map(d => <div key={d} style={S.dayHdr}>{d}</div>)}
        {cells.map((cell, idx) => {
          if (cell.blank) return (
            <div key={`b${idx}`}
              style={{ background:'var(--bg-muted)', minHeight: 90 }}
              onDragOver={e => e.preventDefault()}
            />
          );
          const isToday = new Date(year, month, cell.day).toDateString() === today;
          const isOver  = dragOver === cell.day;
          const dayTasks = byDay[cell.day] || [];
          const visible  = dayTasks.slice(0, 3);
          const overflow = dayTasks.length - 3;
          return (
            <div
              key={cell.day}
              style={S.cell(isToday, isOver)}
              onClick={() => onDayClick?.(new Date(year, month, cell.day))}
              onDragOver={e => handleDragOver(e, cell.day)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, cell.day)}
            >
              <div style={S.dayNum(isToday)}>{cell.day}</div>
              {visible.map(task => (
                <div
                  key={task.task_id}
                  draggable
                  style={S.pill(task.priority)}
                  onDragStart={e => { e.stopPropagation(); handleDragStart(e, task.task_id); }}
                  onClick={e => { e.stopPropagation(); setDrawer(task.task_id); }}
                  title={`${task.title} — drag to reschedule`}
                >
                  <span style={{ width: 6, height: 6, borderRadius:'50%', background: PCOLOR[task.priority]||'#94a3b8', flexShrink: 0 }} />
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: 120 }}>{task.title}</span>
                </div>
              ))}
              {overflow > 0 && <div style={S.more}>+{overflow} more</div>}
              {/* drop target hint when dragging */}
              {isOver && <div style={{ position:'absolute', inset: 0, border:'2px dashed var(--accent-default)', borderRadius: 4, pointerEvents:'none' }} />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={S.legend}>
        {Object.entries(PCOLOR).map(([p, c]) => (
          <span key={p} style={{ display:'flex', alignItems:'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius:'50%', background: c }} />{p}
          </span>
        ))}
        <span style={{ opacity: 0.5 }}>Drag a task to reschedule</span>
      </div>

      {/* Task drawer */}
      <TaskDrawer
        taskId={drawer}
        open={!!drawer}
        onClose={() => setDrawer(null)}
        teamMembers={teamMembers}
        onSaved={u => { setDrawer(null); onTasksChange?.(p => p.map(t => t.task_id === u.task_id ? u : t)); }}
      />
    </div>
  );
}

