/**
 * TableView.jsx — v2 sortable, filterable, grouped table.
 */
import React, { useState, useMemo } from 'react';
import TaskDrawer from '../TaskDrawer';
import FieldRenderer from '../fields/FieldRenderer';

const PRIORITY_ORDER = { urgent:0, high:1, medium:2, low:3 };
const PRIORITY_COLOR = { urgent:'#dc2626', high:'#ef4444', medium:'#f59e0b', low:'#22c55e' };

function Th({ label, sortKey, sort, onSort, width }) {
  const active = sort?.key === sortKey;
  return (
    <th onClick={() => sortKey && onSort(sortKey)} style={{
      padding:'9px 12px', textAlign:'left', fontSize:'var(--text-xs)', fontWeight:700,
      color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em',
      whiteSpace:'nowrap', width, cursor:sortKey?'pointer':'default', userSelect:'none',
      borderBottom:'2px solid var(--border-default)',
      background:active?'var(--bg-muted)':'var(--bg-subtle)',
    }}>
      {label}{active?(sort.dir==='asc'?' ↑':' ↓'):''}
    </th>
  );
}

export default function TableView({ tasks, columns, fieldDefs, fieldValueMap, teamMembers, onTasksChange }) {
  const [sort,   setSort]   = useState({ key:'sort_order', dir:'asc' });
  const [filter, setFilter] = useState('');
  const [groupBy,setGroupBy]= useState('none');
  const [drawer, setDrawer] = useState(null);
  const [visibleFields, setVisible] = useState(() => (fieldDefs||[]).map(f=>f.field_id));

  React.useEffect(() => { setVisible((fieldDefs||[]).map(f=>f.field_id)); }, [fieldDefs?.length]);

  const colMap = useMemo(() => Object.fromEntries((columns||[]).map(c=>[c.column_id,c])), [columns]);
  const handleSort = (key) => setSort(s => ({ key, dir:s.key===key&&s.dir==='asc'?'desc':'asc' }));

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return (tasks||[]).filter(t => !q || t.title.toLowerCase().includes(q));
  }, [tasks, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a,b) => {
      let av=a[sort.key], bv=b[sort.key];
      if (sort.key==='priority') { av=PRIORITY_ORDER[av]??99; bv=PRIORITY_ORDER[bv]??99; }
      if (sort.key==='due_at')   { av=av?new Date(av).getTime():Infinity; bv=bv?new Date(bv).getTime():Infinity; }
      if (av<bv) return sort.dir==='asc'?-1:1;
      if (av>bv) return sort.dir==='asc'?1:-1;
      return 0;
    });
  }, [filtered, sort]);

  const grouped = useMemo(() => {
    if (groupBy==='none') return [{ label:null, rows:sorted }];
    const groups = {};
    sorted.forEach(t => {
      const key = groupBy==='column'?(colMap[t.column_id]?.name||'Uncategorised')
                : groupBy==='status'?t.status : t.priority;
      if (!groups[key]) groups[key]=[];
      groups[key].push(t);
    });
    return Object.entries(groups).map(([label,rows])=>({label,rows}));
  }, [sorted,groupBy,colMap]);

  const shownFields = (fieldDefs||[]).filter(f=>visibleFields.includes(f.field_id));

  const S = {
    toolbar:{ display:'flex', alignItems:'center', gap:12, marginBottom:14, flexWrap:'wrap' },
    input:  { border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'6px 12px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)', outline:'none', width:220 },
    select: { border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)', cursor:'pointer' },
    table:  { width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' },
    tr:     { borderBottom:'1px solid var(--border-subtle)', cursor:'pointer' },
    td:     { padding:'9px 12px', color:'var(--text-default)', verticalAlign:'middle' },
    grpHdr: { padding:'10px 12px', fontWeight:700, fontSize:'var(--text-xs)', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg-muted)', borderBottom:'1px solid var(--border-default)' },
  };

  const badge = (text, color) => (
    <span style={{ background:color+'22', color, border:`1px solid ${color}44`, borderRadius:'var(--radius-full)', padding:'2px 8px', fontSize:'var(--text-xs)', fontWeight:600, whiteSpace:'nowrap' }}>{text}</span>
  );

  return (
    <>
      <div style={S.toolbar}>
        <input style={S.input} placeholder="Filter tasks…" value={filter} onChange={e=>setFilter(e.target.value)} />
        <select style={S.select} value={groupBy} onChange={e=>setGroupBy(e.target.value)}>
          <option value="none">No grouping</option>
          <option value="column">Group by column</option>
          <option value="status">Group by status</option>
          <option value="priority">Group by priority</option>
        </select>
        {(fieldDefs||[]).length>0 && (
          <details style={{ position:'relative' }}>
            <summary style={{ ...S.select, listStyle:'none', cursor:'pointer' }}>Fields ▾</summary>
            <div style={{ position:'absolute', top:'100%', left:0, zIndex:50, marginTop:4, background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-md)', padding:10, minWidth:180 }}>
              {(fieldDefs||[]).map(f => (
                <label key={f.field_id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', fontSize:'var(--text-sm)', cursor:'pointer' }}>
                  <input type="checkbox" checked={visibleFields.includes(f.field_id)}
                    onChange={e=>setVisible(v=>e.target.checked?[...v,f.field_id]:v.filter(id=>id!==f.field_id))} />
                  {f.name}
                </label>
              ))}
            </div>
          </details>
        )}
        <span style={{ marginLeft:'auto', color:'var(--text-muted)', fontSize:'var(--text-xs)' }}>{filtered.length} tasks</span>
      </div>
      <div style={{ overflowX:'auto', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-default)' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <Th label="Title"    sortKey="title"     sort={sort} onSort={handleSort} width="35%" />
              <Th label="Column"   sortKey="column_id" sort={sort} onSort={handleSort} width="12%" />
              <Th label="Priority" sortKey="priority"  sort={sort} onSort={handleSort} width="10%" />
              <Th label="Created by" sortKey={null}    sort={sort} onSort={handleSort} width="14%" />
              <Th label="Due"      sortKey="due_at"    sort={sort} onSort={handleSort} width="11%" />
              {shownFields.map(f=><Th key={f.field_id} label={f.name} sortKey={null} sort={sort} onSort={handleSort} width="120px" />)}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({label,rows},gi) => (
              <React.Fragment key={gi}>
                {label && <tr><td colSpan={6+shownFields.length} style={S.grpHdr}>{label} <span style={{ fontWeight:400, opacity:0.6 }}>({rows.length})</span></td></tr>}
                {rows.map(task => {
                  const col=colMap[task.column_id];
                  const isOverdue=task.due_at&&new Date(task.due_at)<new Date()&&task.status!=='done';
                  const fvals=fieldValueMap?.[task.task_id]||{};
                  return (
                    <tr key={task.task_id} style={S.tr}
                      onClick={()=>setDrawer(task.task_id)}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-muted)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      <td style={{...S.td,fontWeight:500}}>
                        {task.approval_status==='pending'&&<span style={{marginRight:6,fontSize:12}}>⏳</span>}
                        {task.title}
                      </td>
                      <td style={S.td}>{col?<span style={{fontSize:'var(--text-xs)',background:col.color+'22',color:col.color,padding:'2px 8px',borderRadius:'var(--radius-full)',fontWeight:600}}>{col.name}</span>:'—'}</td>
                      <td style={S.td}>{badge(task.priority,PRIORITY_COLOR[task.priority]||'#94a3b8')}</td>
                      <td style={{...S.td,color:'var(--text-muted)'}}>{task.created_by_name||'—'}</td>
                      <td style={{...S.td,color:isOverdue?'var(--danger)':'var(--text-muted)',fontWeight:isOverdue?700:400}}>
                        {task.due_at?new Date(task.due_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'—'}
                        {isOverdue&&' ⚠'}
                      </td>
                      {shownFields.map(f=>(
                        <td key={f.field_id} style={S.td} onClick={e=>e.stopPropagation()}>
                          <FieldRenderer field={f} value={fvals[f.field_id]??null} onChange={()=>{}} readOnly />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <TaskDrawer taskId={drawer} open={!!drawer} onClose={()=>setDrawer(null)}
        teamMembers={teamMembers} onSaved={u=>onTasksChange?.(p=>p.map(t=>t.task_id===u.task_id?u:t))} />
    </>
  );
}
