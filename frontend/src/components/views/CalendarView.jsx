import React, { useState, useRef, useEffect } from "react";
import { api } from "../../lib/api";
import TaskDrawer from "../TaskDrawer";
import { PRIORITY_COLOR as PCOLOR, logger } from '../../lib/utils';

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOURS  = Array.from({ length: 24 }, (_, i) => i);
const ROW_H  = 54; // px per hour row

export default function CalendarView({ tasks, teamMembers, onDayClick, onTasksChange }) {
  const now   = new Date();
  const today = now.toDateString();

  // Month view state
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Shared UI state
  const [drawer,     setDrawer]     = useState(null);
  const [dragOver,   setDragOver]   = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);

  // View mode + anchor date for week/day
  const [viewMode, setViewMode] = useState('month');
  const [selDate,  setSelDate]  = useState(new Date(now));

  const draggingId = useRef(null);
  const gridRef    = useRef(null);

  // Scroll to 8 AM when switching into week/day view
  useEffect(() => {
    if (viewMode !== 'month' && gridRef.current) {
      gridRef.current.scrollTop = ROW_H * 8 - 8;
    }
  }, [viewMode]);

  // ── Month grid helpers ────────────────────────────────────────────────────
  const firstDay = new Date(year, month, 1).getDay();
  const numDays  = new Date(year, month + 1, 0).getDate();

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

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ blank: true });
  for (let d = 1; d <= numDays; d++) cells.push({ blank: false, day: d });
  while (cells.length % 7 !== 0) cells.push({ blank: true });

  // ── Week helpers ──────────────────────────────────────────────────────────
  const weekStart = (() => {
    const d = new Date(selDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // ── Task lookup for week/day grid ─────────────────────────────────────────
  const getTasksForHour = (date, hour) =>
    (tasks || []).filter(t => {
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      return d.getFullYear() === date.getFullYear() &&
             d.getMonth()    === date.getMonth()    &&
             d.getDate()     === date.getDate()     &&
             d.getHours()    === hour;
    });

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevMonth = () => { if (month === 0) { setYear(y=>y-1); setMonth(11); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11) { setYear(y=>y+1); setMonth(0);  } else setMonth(m=>m+1); };

  const shiftDays = (n) => {
    const d = new Date(selDate);
    d.setDate(d.getDate() + n);
    setSelDate(d);
  };

  const prevNav = () => viewMode==='month' ? prevMonth() : viewMode==='week' ? shiftDays(-7) : shiftDays(-1);
  const nextNav = () => viewMode==='month' ? nextMonth() : viewMode==='week' ? shiftDays(7)  : shiftDays(1);

  const switchView = (mode) => {
    setViewMode(mode);
    if (mode === 'month') {
      setYear(selDate.getFullYear());
      setMonth(selDate.getMonth());
    } else if (viewMode === 'month') {
      const todayInView = now.getFullYear()===year && now.getMonth()===month;
      setSelDate(todayInView ? new Date(now) : new Date(year, month, Math.min(selDate.getDate(), numDays)));
    }
  };

  const goToDay = (date) => { setSelDate(new Date(date)); setViewMode('day'); };

  // ── Drag & drop (month) ───────────────────────────────────────────────────
  const handleDragStart = (e, taskId) => { draggingId.current = taskId; e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver  = (e, day)    => { e.preventDefault(); e.dataTransfer.dropEffect="move"; setDragOver(day); };
  const handleDragLeave = (e)         => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = draggingId.current;
    if (!taskId) return;
    draggingId.current = null;
    const task   = (tasks||[]).find(t=>t.task_id===taskId);
    const orig   = task?.due_at ? new Date(task.due_at) : new Date();
    const newDue = new Date(year, month, day, orig.getHours(), orig.getMinutes(), orig.getSeconds());
    try {
      const res = await api.put(`/tasks/${taskId}`, { due_at: newDue.toISOString() });
      onTasksChange?.(prev => prev.map(t => t.task_id===taskId ? res.data : t));
    } catch (err) { logger.error("Reschedule failed", err); }
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const navBtn = {
    background:"var(--bg-soft)", border:"1px solid var(--rule)", borderRadius:"var(--r-sm)",
    padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"var(--ink)",
  };

  const pill = (priority) => ({
    display:"flex", alignItems:"center", gap:4,
    borderRadius:"var(--r-sm)", padding:"2px 5px", marginBottom:2,
    cursor:"grab", fontSize:11, lineHeight:1.3,
    background:(PCOLOR[priority]||"#94a3b8")+"22",
    color:PCOLOR[priority]||"#94a3b8", userSelect:"none",
  });

  // ── Nav title ─────────────────────────────────────────────────────────────
  const navTitle = () => {
    if (viewMode==='month') return `${MONTHS[month]} ${year}`;
    if (viewMode==='week') {
      const wEnd = weekDays[6];
      const sameMonth = weekStart.getMonth()===wEnd.getMonth();
      return sameMonth
        ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${wEnd.getDate()}, ${weekStart.getFullYear()}`
        : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[wEnd.getMonth()]} ${wEnd.getDate()}, ${wEnd.getFullYear()}`;
    }
    return `${DAYS[selDate.getDay()]}, ${MONTHS[selDate.getMonth()]} ${selDate.getDate()}, ${selDate.getFullYear()}`;
  };

  const fmtHour = (h) => {
    if (h===0) return '12 AM';
    if (h<12)  return `${h} AM`;
    if (h===12) return '12 PM';
    return `${h-12} PM`;
  };

  // ── Time grid (week + day) ────────────────────────────────────────────────
  const renderTimeGrid = (days) => (
    <div style={{ display:'flex', flexDirection:'column', border:'1px solid var(--rule)', borderRadius:'var(--r-md)', overflow:'hidden' }}>

      {/* Day header row */}
      <div style={{ display:'flex', background:'var(--bg-soft)', borderBottom:'1px solid var(--rule)', flexShrink:0 }}>
        <div style={{ width:58, flexShrink:0, borderRight:'1px solid var(--rule)' }} />
        {days.map((day, i) => {
          const isToday = day.toDateString()===today;
          return (
            <div
              key={i}
              style={{
                flex:1, textAlign:'center', padding:'8px 4px',
                borderLeft: i>0 ? '1px solid var(--rule-soft)' : 'none',
                background: isToday ? 'color-mix(in srgb, var(--k-primary) 10%, var(--surface))' : 'transparent',
                cursor: days.length>1 ? 'pointer' : 'default',
              }}
              onClick={() => days.length>1 && goToDay(day)}
              title={days.length>1 ? 'Switch to day view' : undefined}
            >
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-3)', textTransform:'uppercase' }}>{DAYS[day.getDay()]}</div>
              <div style={{
                width:28, height:28, borderRadius:'50%', margin:'4px auto 0',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:16, fontWeight: isToday ? 700 : 400,
                color: isToday ? '#fff' : 'var(--ink)',
                background: isToday ? 'var(--k-primary)' : 'transparent',
              }}>{day.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Scrollable hour rows */}
      <div ref={gridRef} style={{ overflowY:'auto', maxHeight:580 }}>
        {HOURS.map(hour => {
          const isCurrentHour = now.getHours()===hour;
          return (
            <div key={hour} style={{ display:'flex', height:ROW_H, borderBottom:'1px solid var(--rule-soft)', flexShrink:0, position:'relative' }}>

              {/* Hour label */}
              <div style={{
                width:58, flexShrink:0, paddingRight:8, paddingTop:4,
                fontSize:10, color:'var(--ink-faint)', textAlign:'right',
                borderRight:'1px solid var(--rule)', background:'var(--bg-soft)',
              }}>
                {fmtHour(hour)}
              </div>

              {/* Day columns */}
              {days.map((day, i) => {
                const slotTasks  = getTasksForHour(day, hour);
                const isToday    = day.toDateString()===today;
                const showNowBar = isToday && isCurrentHour;
                return (
                  <div
                    key={i}
                    onClick={() => { if (onDayClick) { const d=new Date(day); d.setHours(hour,0,0,0); onDayClick(d); } }}
                    style={{
                      flex:1, borderLeft: i>0 ? '1px solid var(--rule-soft)' : 'none',
                      background: isToday ? 'color-mix(in srgb, var(--k-primary) 3%, var(--surface))' : 'var(--surface)',
                      padding:'3px 4px', cursor: onDayClick ? 'pointer' : 'default',
                      position:'relative',
                    }}
                    onMouseEnter={e => { if (onDayClick) e.currentTarget.style.background='color-mix(in srgb, var(--k-primary) 9%, var(--surface))'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isToday ? 'color-mix(in srgb, var(--k-primary) 3%, var(--surface))' : 'var(--surface)'; }}
                  >
                    {/* Current-time bar */}
                    {showNowBar && (
                      <div style={{
                        position:'absolute', left:0, right:0,
                        top:`${(now.getMinutes()/60)*100}%`,
                        height:2, background:'var(--k-primary)', zIndex:3, pointerEvents:'none',
                      }} />
                    )}
                    {slotTasks.map(task => (
                      <div
                        key={task.task_id}
                        draggable
                        style={pill(task.priority)}
                        onDragStart={e => { e.stopPropagation(); handleDragStart(e, task.task_id); }}
                        onClick={e => { e.stopPropagation(); setDrawer(task.task_id); }}
                        title={task.title}
                      >
                        <span style={{ width:6, height:6, borderRadius:'50%', background:PCOLOR[task.priority]||'#94a3b8', flexShrink:0 }} />
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Nav bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button style={navBtn} onClick={prevNav}>‹ Prev</button>
        <span style={{ fontSize:18, fontWeight:700, color:"var(--ink)", fontFamily:"var(--font-display)" }}>{navTitle()}</span>
        <button style={navBtn} onClick={nextNav}>Next ›</button>
      </div>

      {/* View switcher */}
      <div style={{ display:'flex', gap:4, alignSelf:'center', background:'var(--bg-soft)', borderRadius:'var(--r-md)', padding:3, border:'1px solid var(--rule)' }}>
        {['month','week','day'].map(mode => (
          <button
            key={mode}
            onClick={() => switchView(mode)}
            style={{
              background: viewMode===mode ? 'var(--surface)' : 'transparent',
              border: viewMode===mode ? '1px solid var(--rule)' : '1px solid transparent',
              borderRadius:'var(--r-sm)', padding:'4px 14px', cursor:'pointer',
              fontFamily:'inherit', fontSize:12, fontWeight: viewMode===mode ? 600 : 400,
              color: viewMode===mode ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: viewMode===mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition:'all 0.1s',
            }}
          >
            {mode.charAt(0).toUpperCase()+mode.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Month view ── */}
      {viewMode==='month' && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, background:"var(--rule)", borderRadius:"var(--r-md)", overflow:"hidden", border:"1px solid var(--rule)" }}>
            {DAYS.map(d => (
              <div key={d} style={{ background:"var(--bg-soft)", padding:"8px 0", textAlign:"center", fontSize:10.5, fontWeight:700, color:"var(--ink-3)", textTransform:"uppercase" }}>{d}</div>
            ))}
            {cells.map((cell, idx) => {
              if (cell.blank) return (
                <div key={`b${idx}`} style={{ background:"var(--bg-soft)", minHeight:90 }} onDragOver={e=>e.preventDefault()} />
              );
              const isToday  = new Date(year,month,cell.day).toDateString()===today;
              const isOver   = dragOver===cell.day;
              const dayTasks = byDay[cell.day]||[];
              const visible  = dayTasks.slice(0,3);
              const overflow = dayTasks.length-3;
              return (
                <div key={cell.day}
                  style={{
                    background: isOver||isToday ? "color-mix(in srgb, var(--k-primary) 8%, var(--surface))" : "var(--surface)",
                    minHeight:90, padding:"6px 8px", cursor:"default", position:"relative",
                    outline: isOver ? `2px solid var(--k-primary)` : "none", transition:"background 0.1s",
                  }}
                  onDoubleClick={() => onDayClick?.(new Date(year,month,cell.day,12,0))}
                  onMouseEnter={() => setHoveredDay(cell.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onDragOver={e => handleDragOver(e, cell.day)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, cell.day)}
                >
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                    <div
                      style={{ fontSize:11, fontWeight:isToday?700:500, color:isToday?"var(--k-primary)":"var(--ink-3)", cursor:'pointer' }}
                      onClick={() => goToDay(new Date(year,month,cell.day))}
                      title="Switch to day view"
                    >
                      {cell.day}
                    </div>
                    {hoveredDay===cell.day && onDayClick && (
                      <button
                        onClick={e => { e.stopPropagation(); onDayClick(new Date(year,month,cell.day,12,0)); }}
                        title="Add task"
                        style={{
                          background:"var(--k-primary)", color:"#fff", border:"none", borderRadius:"50%",
                          width:16, height:16, fontSize:14, lineHeight:1, cursor:"pointer",
                          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                          padding:0, fontFamily:"inherit",
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
                      <span style={{ width:6, height:6, borderRadius:"50%", background:PCOLOR[task.priority]||"#94a3b8", flexShrink:0 }} />
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120 }}>{task.title}</span>
                    </div>
                  ))}
                  {overflow>0 && (
                    <div
                      style={{ fontSize:11, color:"var(--ink-3)", marginTop:2, cursor:'pointer' }}
                      onClick={() => goToDay(new Date(year,month,cell.day))}
                    >
                      +{overflow} more
                    </div>
                  )}
                  {isOver && <div style={{ position:"absolute", inset:0, border:"2px dashed var(--k-primary)", borderRadius:4, pointerEvents:"none" }} />}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:11, color:"var(--ink-3)" }}>
            {Object.entries(PCOLOR).map(([p,c]) => (
              <span key={p} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:c }} />{p}
              </span>
            ))}
            <span style={{ opacity:0.5 }}>Drag to reschedule · Click + or double-click date to add task · Click date number for day view</span>
          </div>
        </>
      )}

      {/* ── Week view ── */}
      {viewMode==='week' && renderTimeGrid(weekDays)}

      {/* ── Day view ── */}
      {viewMode==='day' && renderTimeGrid([selDate])}

      <TaskDrawer taskId={drawer} open={!!drawer} onClose={() => setDrawer(null)}
        teamMembers={teamMembers}
        onSaved={u => { setDrawer(null); onTasksChange?.(p=>p.map(t=>t.task_id===u.task_id?u:t)); }}
      />
    </div>
  );
}
