/**
 * TimeReportPage.jsx — k-* design system.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 110, fontSize: 12, color: 'var(--ink-3)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          <div style={{ flex: 1, height: 20, background: 'var(--bg-soft)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.minutes / max) * 100}%`, background: 'var(--k-primary)', borderRadius: 4, transition: 'width 0.4s', minWidth: d.minutes > 0 ? 4 : 0 }} />
          </div>
          <div style={{ width: 56, fontSize: 12, fontWeight: 700, color: 'var(--k-primary)', flexShrink: 0, fontFamily: 'var(--font-display)' }}>{fmt(d.minutes)}</div>
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
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'kartavya-time-report.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function TimeReportPage({ teamId }) {
  const todayISO   = new Date().toISOString().slice(0, 10);
  const weekAgoISO = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);

  const [data,    setData]    = useState({ entries: [], total_minutes: 0 });
  const [loading, setLoading] = useState(true);
  const [from,    setFrom]    = useState(weekAgoISO);
  const [to,      setTo]      = useState(todayISO);
  const [memberF, setMemberF] = useState('');
  const [members, setMembers] = useState([]);
  const [tab,     setTab]     = useState('table');

  useEffect(() => {
    if (!teamId) return;
    api.get(`/teams/${teamId}`)
       .then(r => setMembers(r.data.members || []))
       .catch(() => {});
  }, [teamId]);

  useEffect(() => {
    setLoading(true);
    const params = { team_id: teamId, from, to };
    if (memberF) params.user_id = memberF;
    api.get('/time/report', { params })
       .then(r => setData(r.data))
       .catch(() => setData({ entries: [], total_minutes: 0 }))
       .finally(() => setLoading(false));
  }, [teamId, from, to, memberF]);

  const byMember = useMemo(() => {
    const m = {};
    (data.entries || []).forEach(e => { const n = e.user_name || 'Unknown'; m[n] = (m[n] || 0) + (e.minutes || 0); });
    return Object.entries(m).map(([label, minutes]) => ({ label, minutes })).sort((a, b) => b.minutes - a.minutes);
  }, [data.entries]);

  const byTask = useMemo(() => {
    const m = {};
    (data.entries || []).forEach(e => { const t = e.task_title || 'Unknown task'; m[t] = (m[t] || 0) + (e.minutes || 0); });
    return Object.entries(m).map(([label, minutes]) => ({ label, minutes })).sort((a, b) => b.minutes - a.minutes).slice(0, 10);
  }, [data.entries]);

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">Time Report</h1>
        <span className="k-pageh__sans">समय</span>
        <div className="k-pageh__actions">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--k-primary)' }}>
            {fmt(data.total_minutes)}
          </span>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => exportCSV(data.entries)} disabled={!data.entries?.length}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'var(--sp-5)', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>From</div>
          <input type="date" className="k-input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>To</div>
          <input type="date" className="k-input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {members.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Member</div>
            <select className="k-select" value={memberF} onChange={e => setMemberF(e.target.value)}>
              <option value=''>All members</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name || m.full_name || m.email}</option>)}
            </select>
          </div>
        )}
        <button className="k-btn k-btn--ghost k-btn--sm" style={{ alignSelf: 'flex-end' }}
          onClick={() => { setFrom(weekAgoISO); setTo(todayISO); setMemberF(''); }}>Reset</button>
      </div>

      {/* Stats */}
      {!loading && data.entries?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 'var(--sp-5)' }}>
          {[
            { label: 'Total entries', value: data.entries.length },
            { label: 'Total time',    value: fmt(data.total_minutes) },
            { label: 'Avg per entry', value: fmt(Math.round(data.total_minutes / data.entries.length)) },
            { label: 'Members',       value: new Set(data.entries.map(e => e.user_name)).size },
            { label: 'Tasks covered', value: new Set(data.entries.map(e => e.task_id)).size },
          ].map(s => (
            <div key={s.label} className="k-stat">
              <div className="k-stat__label">{s.label}</div>
              <div className="k-stat__value">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--rule-soft)', marginBottom: 'var(--sp-4)' }}>
        {['table','chart'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--k-primary)' : 'var(--ink-3)',
              borderBottom: tab === t ? '2px solid var(--k-primary)' : '2px solid transparent',
              marginBottom: -1 }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--ink-3)', padding: 24, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Loading…</div>}

      {/* Table view */}
      {!loading && tab === 'table' && (
        data.entries.length === 0
          ? <div className="k-empty"><div className="k-empty__sub">No time entries for this period.</div></div>
          : (
            <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-soft)' }}>
                      {['Task','Description','Started','Ended','Duration','Who'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--ink-3)', borderBottom: '1px solid var(--rule-soft)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map(e => (
                      <tr key={e.entry_id} style={{ borderBottom: '1px dashed var(--rule-soft)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.task_title || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ink-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap', fontSize: 12 }}>{e.started_at ? new Date(e.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap', fontSize: 12 }}>{e.ended_at ? new Date(e.ended_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : <span style={{ color: 'var(--k-primary)', fontWeight: 600 }}>Active</span>}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--k-primary)', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)' }}>{fmt(e.minutes)}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{e.user_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-soft)', borderTop: '1px solid var(--rule-soft)' }}>
                      <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)' }}>Total</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--k-primary)', fontFamily: 'var(--font-display)' }}>{fmt(data.total_minutes)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
      )}

      {/* Chart view */}
      {!loading && tab === 'chart' && (
        data.entries.length === 0
          ? <div className="k-empty"><div className="k-empty__sub">No data to chart.</div></div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
              <div className="k-card">
                <div className="k-card__head"><span className="k-card__title">By Member</span></div>
                <BarChart data={byMember} />
              </div>
              <div className="k-card">
                <div className="k-card__head"><span className="k-card__title">Top Tasks</span></div>
                <BarChart data={byTask} />
              </div>
            </div>
          )
      )}
    </div>
  );
}
