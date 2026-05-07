/**
 * TimeReportPage.jsx — Week 3: full time tracking report.
 * Features: date range filter, per-member breakdown, bar chart, CSV export.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';

function fmt(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.minutes), 1);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 120, fontSize:'var(--text-xs)', color:'var(--text-muted)', textAlign:'right', flexShrink: 0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</div>
          <div style={{ flex: 1, height: 22, background:'var(--bg-muted)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(d.minutes / max) * 100}%`, background:'var(--accent-default)', borderRadius:'var(--radius-sm)', transition:'width 0.4s', minWidth: d.minutes > 0 ? 4 : 0 }} />
          </div>
          <div style={{ width: 60, fontSize:'var(--text-xs)', fontWeight: 600, color:'var(--accent-default)', flexShrink: 0 }}>{fmt(d.minutes)}</div>
        </div>
      ))}
    </div>
  );
}

function exportCSV(entries) {
  const rows = [
    ['Task','Description','Started','Ended','Minutes','Hours','Who'],
    ...entries.map(e => [
      e.task_title || '',
      e.description || '',
      e.started_at ? new Date(e.started_at).toLocaleString() : '',
      e.ended_at   ? new Date(e.ended_at).toLocaleString()   : '',
      e.minutes || 0,
      ((e.minutes || 0) / 60).toFixed(2),
      e.user_name || '',
    ])
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'kartavya-time-report.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function TimeReportPage({ teamId }) {
  // date range defaults to current week
  const todayISO = new Date().toISOString().slice(0, 10);
  const weekAgoISO = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);

  const [data,     setData]     = useState({ entries: [], total_minutes: 0 });
  const [loading,  setLoading]  = useState(true);
  const [from,     setFrom]     = useState(weekAgoISO);
  const [to,       setTo]       = useState(todayISO);
  const [memberF,  setMemberF]  = useState('');
  const [members,  setMembers]  = useState([]);
  const [tab,      setTab]      = useState('table'); // 'table' | 'chart'

  // load team members for filter
  useEffect(() => {
    if (!teamId) return;
    api.get(`/teams/${teamId}`)
       .then(r => setMembers(r.data.members || []))
       .catch(() => {});
  }, [teamId]);

  // load report
  useEffect(() => {
    setLoading(true);
    const params = { team_id: teamId, from, to };
    if (memberF) params.user_id = memberF;
    api.get('/time/report', { params })
       .then(r => setData(r.data))
       .catch(() => setData({ entries: [], total_minutes: 0 }))
       .finally(() => setLoading(false));
  }, [teamId, from, to, memberF]);

  // per-member breakdown for chart tab
  const byMember = useMemo(() => {
    const m = {};
    (data.entries || []).forEach(e => {
      const name = e.user_name || 'Unknown';
      m[name] = (m[name] || 0) + (e.minutes || 0);
    });
    return Object.entries(m)
      .map(([label, minutes]) => ({ label, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [data.entries]);

  // per-task breakdown for chart tab
  const byTask = useMemo(() => {
    const m = {};
    (data.entries || []).forEach(e => {
      const title = e.task_title || 'Unknown task';
      m[title] = (m[title] || 0) + (e.minutes || 0);
    });
    return Object.entries(m)
      .map(([label, minutes]) => ({ label, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);
  }, [data.entries]);

  const inputSt  = { border:'1px solid var(--border-default)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontFamily:'inherit', fontSize:'var(--text-sm)', background:'var(--bg-default)', color:'var(--text-default)' };
  const tabSt    = (active) => ({ padding:'6px 14px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:'var(--text-sm)', fontWeight: active ? 600 : 400, color: active ? 'var(--accent-default)' : 'var(--text-muted)', borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent' });
  const exportBtn = { ...inputSt, cursor:'pointer', background:'var(--bg-muted)', fontWeight: 600 };

  return (
    <div style={{ padding:'var(--space-6)', maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap: 12, marginBottom:'var(--space-5)' }}>
        <h1 style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-semibold)', margin: 0 }}>⏱ Time Report</h1>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <span style={{ fontSize:'var(--text-lg)', fontWeight: 700, color:'var(--accent-default)' }}>
            Total: {fmt(data.total_minutes)}
          </span>
          <button style={exportBtn} onClick={() => exportCSV(data.entries)} disabled={!data.entries?.length}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap: 10, flexWrap:'wrap', marginBottom:'var(--space-5)', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:'var(--text-xs)', fontWeight: 600, color:'var(--text-muted)', marginBottom: 4, textTransform:'uppercase', letterSpacing:'0.04em' }}>From</div>
          <input type="date" style={inputSt} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize:'var(--text-xs)', fontWeight: 600, color:'var(--text-muted)', marginBottom: 4, textTransform:'uppercase', letterSpacing:'0.04em' }}>To</div>
          <input type="date" style={inputSt} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {members.length > 0 && (
          <div>
            <div style={{ fontSize:'var(--text-xs)', fontWeight: 600, color:'var(--text-muted)', marginBottom: 4, textTransform:'uppercase', letterSpacing:'0.04em' }}>Member</div>
            <select style={inputSt} value={memberF} onChange={e => setMemberF(e.target.value)}>
              <option value=''>All members</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name || m.full_name || m.email}</option>)}
            </select>
          </div>
        )}
        <button style={{ ...exportBtn, alignSelf:'flex-end' }} onClick={() => { setFrom(weekAgoISO); setTo(todayISO); setMemberF(''); }}>Reset</button>
      </div>

      {/* Stats row */}
      {!loading && data.entries?.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom:'var(--space-5)' }}>
          {[
            { label: 'Total entries', value: data.entries.length },
            { label: 'Total time',    value: fmt(data.total_minutes) },
            { label: 'Avg per entry', value: fmt(Math.round(data.total_minutes / data.entries.length)) },
            { label: 'Members',       value: new Set(data.entries.map(e => e.user_name)).size },
            { label: 'Tasks covered', value: new Set(data.entries.map(e => e.task_id)).size },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:'12px 16px' }}>
              <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize:'var(--text-xl)', fontWeight: 700, color:'var(--accent-default)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border-default)', marginBottom:'var(--space-4)' }}>
        <button style={tabSt(tab==='table')} onClick={() => setTab('table')}>Table</button>
        <button style={tabSt(tab==='chart')} onClick={() => setTab('chart')}>Charts</button>
      </div>

      {loading && <div style={{ color:'var(--text-muted)', padding: 24 }}>Loading…</div>}

      {/* Table view */}
      {!loading && tab === 'table' && (
        data.entries.length === 0
          ? <div style={{ color:'var(--text-muted)', padding: 24, textAlign:'center' }}>No time entries for this period.</div>
          : (
            <div style={{ overflowX:'auto', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-default)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' }}>
                <thead>
                  <tr style={{ background:'var(--bg-subtle)' }}>
                    {['Task','Description','Started','Ended','Duration','Who'].map(h => (
                      <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight: 700, color:'var(--text-muted)', borderBottom:'2px solid var(--border-default)', whiteSpace:'nowrap', fontSize:'var(--text-xs)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e, i) => (
                    <tr key={e.entry_id} style={{ borderBottom:'1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                      <td style={{ padding:'10px 12px', fontWeight: 500, maxWidth: 240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.task_title || '—'}</td>
                      <td style={{ padding:'10px 12px', color:'var(--text-muted)', maxWidth: 200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description || '—'}</td>
                      <td style={{ padding:'10px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{e.started_at ? new Date(e.started_at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                      <td style={{ padding:'10px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{e.ended_at ? new Date(e.ended_at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : <span style={{ color:'var(--accent-default)', fontWeight: 600 }}>Active</span>}</td>
                      <td style={{ padding:'10px 12px', fontWeight: 700, color:'var(--accent-default)', whiteSpace:'nowrap' }}>{fmt(e.minutes)}</td>
                      <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>{e.user_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'var(--bg-muted)', borderTop:'2px solid var(--border-default)' }}>
                    <td colSpan={4} style={{ padding:'10px 12px', fontWeight: 700, fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Total</td>
                    <td style={{ padding:'10px 12px', fontWeight: 700, color:'var(--accent-default)' }}>{fmt(data.total_minutes)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
      )}

      {/* Chart view */}
      {!loading && tab === 'chart' && (
        data.entries.length === 0
          ? <div style={{ color:'var(--text-muted)', padding: 24, textAlign:'center' }}>No data to chart.</div>
          : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24 }}>
              <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-lg)', padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize:'var(--text-sm)', marginBottom: 16 }}>By Member</div>
                <BarChart data={byMember} />
              </div>
              <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-lg)', padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize:'var(--text-sm)', marginBottom: 16 }}>Top Tasks</div>
                <BarChart data={byTask} />
              </div>
            </div>
          )
      )}
    </div>
  );
}

