import React, { useState, useRef } from "react";
import { api } from "../../lib/api";
import TaskDrawer from "../TaskDrawer";

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
import { PRIORITY_COLOR as PCOLOR, logger } from '../../lib/utils';

export default function CalendarView({ tasks, teamMembers, onDayClick, onTasksChange }) {
  const now  = new Date();
  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth());
  const [drawer, setDrawer] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const draggingId = useRef(null);

  const firstDay = new Date(year, month, 1).getDay();
  const numDays  = new Date(year, month + 1, 0).getDate();
  const today    = now.toDateString();

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

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ blank: true });
  for (let d = 1; d <= numDays; d++) cells.push({ blank: false, day: d });
  while (cells.length % 7 !== 0) cells.push({ blank: true });

  const handleDragStart = (e, taskId) => { draggingId.current = taskId; e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver  = (e, day) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(day); };
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = draggingId.current;
    if (!taskId) return;
    draggingId.current = null;
    const task = (tasks || []).find(t => t.task_id === taskId);
    const orig = task?.due_at ? new Date(task.due_at) : new Date();
    const newDue = new Date(year, month, day, orig.getHours(), orig.getMinutes(), orig.getSeconds());
    try {
      const res = await api.put(`/tasks/${taskId}`, { due_at: newDue.toISOString() });
      onTasksChange?.(prev => prev.map(t => t.task_id === taskId ? res.data : t));
    } catch (err) {
      logger.error("Reschedule failed", err);
    }
  };

  const navBtn = {
    background: "var(--bg-soft)", border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
    padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
  };
  const pill = (priority) => ({
    display: "flex", alignItems: "center", gap: 4,
    borderRadius: "var(--r-sm)", padding: "2px 5px", marginBottom: 2,
    cursor: "grab", fontSize: 11, lineHeight: 1.3,
    background: (PCOLOR[priority] || "#94a3b8") + "22",
    color: PCOLOR[priority] || "#94a3b8", userSelect: "none",
  });

  return (
    <div>
      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button style={navBtn} onClick={prev}>‹ Prev</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-display)" }}>{MONTHS[month]} {year}</span>
        <button style={navBtn} onClick={next}>Next ›</button>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: "var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--rule)" }}>
        {DAYS.map(d => (
          <div key={d} style={{ background: "var(--bg-soft)", padding: "8px 0", textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>{d}</div>
        ))}
        {cells.map((cell, idx) => {
          if (cell.blank) return (
            <div key={`b${idx}`} style={{ background: "var(--bg-soft)", minHeight: 90 }} onDragOver={e => e.preventDefault()} />
          );
          const isToday  = new Date(year, month, cell.day).toDateString() === today;
          const isOver   = dragOver === cell.day;
          const dayTasks = byDay[cell.day] || [];
          const visible  = dayTasks.slice(0, 3);
          const overflow = dayTasks.length - 3;
          return (
            <div key={cell.day}
              style={{
                background: isOver || isToday ? "color-mix(in srgb, var(--k-primary) 8%, var(--surface))" : "var(--surface)",
                minHeight: 90, padding: "6px 8px", cursor: "default", position: "relative",
                outline: isOver ? `2px solid var(--k-primary)` : "none", transition: "background 0.1s",
              }}
              onDoubleClick={() => onDayClick?.(new Date(year, month, cell.day, 12, 0))}
              onMouseEnter={() => setHoveredDay(cell.day)}
              onMouseLeave={() => setHoveredDay(null)}
              onDragOver={e => handleDragOver(e, cell.day)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, cell.day)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--k-primary)" : "var(--ink-3)" }}>{cell.day}</div>
                {hoveredDay === cell.day && onDayClick && (
                  <button
                    onClick={e => { e.stopPropagation(); onDayClick(new Date(year, month, cell.day, 12, 0)); }}
                    title="Add task"
                    style={{
                      background: "var(--k-primary)", color: "#fff", border: "none", borderRadius: "50%",
                      width: 16, height: 16, fontSize: 14, lineHeight: 1, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      padding: 0, fontFamily: "inherit",
                    }}
                  >+</button>
                )}
              </div>
              {visible.map(task => (
                <div key={task.task_id} draggable style={pill(task.priority)}
                  onDragStart={e => { e.stopPropagation(); handleDragStart(e, task.task_id); }}
                  onClick={e => { e.stopPropagation(); setDrawer(task.task_id); }}
                  onDoubleClick={e => e.stopPropagation()}
                  title={`${task.title} — drag to reschedule`}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PCOLOR[task.priority] || "#94a3b8", flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{task.title}</span>
                </div>
              ))}
              {overflow > 0 && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>+{overflow} more</div>}
              {isOver && <div style={{ position: "absolute", inset: 0, border: "2px dashed var(--k-primary)", borderRadius: 4, pointerEvents: "none" }} />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", fontSize: 11, color: "var(--ink-3)" }}>
        {Object.entries(PCOLOR).map(([p, c]) => (
          <span key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />{p}
          </span>
        ))}
        <span style={{ opacity: 0.5 }}>Drag to reschedule · Click + or double-click a date to create task</span>
      </div>

      <TaskDrawer taskId={drawer} open={!!drawer} onClose={() => setDrawer(null)}
        teamMembers={teamMembers}
        onSaved={u => { setDrawer(null); onTasksChange?.(p => p.map(t => t.task_id === u.task_id ? u : t)); }}
      />
    </div>
  );
}
