/**
 * CalendarView.jsx — v2 month calendar grid.
 */
import React, { useState } from 'react';
import TaskDrawer from '../TaskDrawer';

const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const PRIORITY_COLOR={ urgent:'#dc2626', high:'#ef4444', medium:'#f59e0b', low:'#22c55e' };

export default function CalendarView({ tasks, teamMembers, onDayClick, onTasksChange }) {
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth());
  const [drawer,setDrawer]=useState(null);

  const firstDay=new Date(year,month,1).getDay();
  const numDays=new Date(year,month+1,0).getDate();
  const today=now.toDateString();

  const byDay={};
  (tasks||[]).forEach(t=>{
    if(!t.due_at) return;
    const d=new Date(t.due_at);
    if(d.getFullYear()===year&&d.getMonth()===month){
      const day=d.getDate();
      if(!byDay[day]) byDay[day]=[];
      byDay[day].push(t);
    }
  });

  const prev=()=>{ if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const next=()=>{ if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };

  const cells=[];
  for(let i=0;i<firstDay;i++) cells.push({blank:true});
  for(let d=1;d<=numDays;d++) cells.push({blank:false,day:d});
  while(cells.length%7!==0) cells.push({blank:true});

  const S={
    nav:   { display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 },
    navBtn:{ background:'var(--bg-muted)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-sm)',padding:'6px 14px',cursor:'pointer',fontFamily:'inherit',fontSize:'var(--text-sm)',color:'var(--text-default)' },
    grid:  { display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,background:'var(--border-default)',borderRadius:'var(--radius-lg)',overflow:'hidden',border:'1px solid var(--border-default)' },
    dayHdr:{ background:'var(--bg-subtle)',padding:'8px 0',textAlign:'center',fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase' },
    cell:  (isToday)=>({ background:isToday?'var(--accent-subtle)':'var(--bg-elevated)',minHeight:90,padding:'6px 8px',cursor:'pointer',position:'relative' }),
    dayNum:(isToday)=>({ fontSize:'var(--text-xs)',fontWeight:isToday?700:500,color:isToday?'var(--accent-default)':'var(--text-muted)',marginBottom:4 }),
    dot:   { display:'flex',alignItems:'center',gap:5,borderRadius:'var(--radius-sm)',padding:'2px 5px',marginBottom:2,cursor:'pointer',fontSize:'var(--text-xs)',lineHeight:1.3 },
    more:  { fontSize:'var(--text-xs)',color:'var(--text-muted)',marginTop:2 },
  };

  return (
    <div>
      <div style={S.nav}>
        <button style={S.navBtn} onClick={prev}>‹ Prev</button>
        <span style={{ fontSize:'var(--text-xl)',fontWeight:700 }}>{MONTHS[month]} {year}</span>
        <button style={S.navBtn} onClick={next}>Next ›</button>
      </div>
      <div style={S.grid}>
        {DAYS.map(d=><div key={d} style={S.dayHdr}>{d}</div>)}
        {cells.map((cell,idx)=>{
          if(cell.blank) return <div key={`b${idx}`} style={{background:'var(--bg-muted)',minHeight:90}} />;
          const isToday=new Date(year,month,cell.day).toDateString()===today;
          const dayTasks=byDay[cell.day]||[];
          const visible=dayTasks.slice(0,3);
          const overflow=dayTasks.length-3;
          return (
            <div key={cell.day} style={S.cell(isToday)} onClick={()=>onDayClick?.(new Date(year,month,cell.day))}>
              <div style={S.dayNum(isToday)}>{cell.day}</div>
              {visible.map(task=>(
                <div key={task.task_id}
                  style={{...S.dot,background:(PRIORITY_COLOR[task.priority]||'#94a3b8')+'22',color:PRIORITY_COLOR[task.priority]||'#94a3b8'}}
                  onClick={e=>{e.stopPropagation();setDrawer(task.task_id);}}
                  title={task.title}
                >
                  <span style={{width:6,height:6,borderRadius:'50%',background:PRIORITY_COLOR[task.priority]||'#94a3b8',flexShrink:0}} />
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>{task.title}</span>
                </div>
              ))}
              {overflow>0&&<div style={S.more}>+{overflow} more</div>}
            </div>
          );
        })}
      </div>
      <TaskDrawer taskId={drawer} open={!!drawer} onClose={()=>setDrawer(null)}
        teamMembers={teamMembers} onSaved={u=>{setDrawer(null);onTasksChange?.(p=>p.map(t=>t.task_id===u.task_id?u:t));}} />
    </div>
  );
}
