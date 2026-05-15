/**
 * DashboardPage.jsx — editorial hero dashboard with week strip + stat tiles.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

const PRIORITY_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };
const STATUS_COLORS   = { todo: '#60a5fa', in_progress: '#f59e0b', in_review: '#a78bfa', done: '#34d399' };
const WEEK_EN  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEK_HI  = ['सोम','मंगल','बुध','गुरु','शुक्र','शनि','रवि'];

const SEED_WIDGET_DATA = {
  count_todo:   { count: 0 },
  count_done:   { count: 0 },
  chart_main:   { series: [{ status: 'todo', count: 1 }, { status: 'in_progress', count: 0 }, { status: 'done', count: 0 }] },
  my_work_main: { tasks: [] },
  deadlines_1:  { tasks: [] },
};

function relDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso), now = new Date(), diff = d - now;
  if (diff < 0) return <span style={{ color: 'var(--danger)' }}>Overdue</span>;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return <span style={{ color: 'var(--warn)' }}>Today</span>;
  if (days === 1) return <span style={{ color: 'var(--warn)' }}>Tomorrow</span>;
  return `${days}d`;
}

function CountWidget({ data, config }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>
        {data?.count ?? '…'}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ink-3)' }}>
        {config?.label || 'Tasks'}
      </div>
    </div>
  );
}

function ChartWidget({ data }) {
  const series = data?.series || [];
  const total  = series.reduce((s, r) => s + Number(r.count), 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14, gap: 1 }}>
        {series.map(r => (
          <div key={r.status} style={{ flex: r.count / total, background: STATUS_COLORS[r.status] || 'var(--rule-strong)', transition: 'flex 0.4s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {series.map(r => (
          <div key={r.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLORS[r.status] || 'var(--rule-strong)', flexShrink: 0 }} />
              <span style={{ color: 'var(--ink-2)', textTransform: 'capitalize' }}>{r.status.replace('_', ' ')}</span>
            </div>
            <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function MyWorkWidget({ data }) {
  const tasks = data?.tasks || [];
  if (tasks.length === 0) return <p style={{ color: 'var(--ink-3)', fontSize: 13, margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>No tasks assigned to you.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.slice(0, 6).map(t => (
        <div key={t.task_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLORS[t.priority] || 'var(--ink-faint)', flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{t.title}</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 11, flexShrink: 0 }}>{relDate(t.due_at)}</span>
        </div>
      ))}
      {tasks.length > 6 && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>+{tasks.length - 6} more</div>}
    </div>
  );
}

function DeadlinesWidget({ data }) {
  const tasks = data?.tasks || [];
  if (tasks.length === 0) return <p style={{ color: 'var(--ink-3)', fontSize: 13, margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>No upcoming deadlines.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.slice(0, 8).map(t => (
        <div key={t.task_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{t.title}</span>
          <span style={{ flexShrink: 0, fontSize: 11 }}>{relDate(t.due_at)}</span>
        </div>
      ))}
    </div>
  );
}

const WIDGET_TITLES = {
  count: 'Count', chart: 'Status Breakdown', my_work: 'My Work', deadlines: 'Upcoming Deadlines',
};
const WIDGET_SANS = {
  count: 'संख्या', chart: 'स्थिति', my_work: 'कार्य', deadlines: 'समय-सीमा',
};

function WidgetRenderer({ type, data, config }) {
  if (!data) return <div style={{ color: 'var(--ink-3)', fontSize: 13, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Loading…</div>;
  if (type === 'count')     return <CountWidget     data={data} config={config} />;
  if (type === 'chart')     return <ChartWidget     data={data} />;
  if (type === 'my_work')   return <MyWorkWidget    data={data} />;
  if (type === 'deadlines') return <DeadlinesWidget data={data} />;
  return <div style={{ color: 'var(--ink-3)' }}>Unknown widget</div>;
}

export default function DashboardPage({ teamId, teams = [] }) {
  const [dashboard,    setDashboard]    = useState(null);
  const [widgetData,   setWidgetData]   = useState({});
  const [loading,      setLoading]      = useState(true);
  const [addingType,   setAddingType]   = useState(null);
  const [dragIdx,      setDragIdx]      = useState(null);
  const [overIdx,      setOverIdx]      = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(teamId || '');
  const saveTimeout = useRef(null);

  // Date info
  const now     = new Date();
  const dayIdx  = (now.getDay() + 6) % 7; // Mon=0
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - dayIdx + i); return d;
  });

  useEffect(() => { if (teamId) setSelectedTeam(teamId); }, [teamId]);

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    api.get('/dashboards/')
      .then(async r => {
        let dash = r.data[0];
        if (!dash) {
          const cr = await api.post('/dashboards/', { name: 'My Dashboard', widgets: defaultWidgets(selectedTeam) });
          dash = cr.data;
        }
        setDashboard(dash);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!dashboard) return;
    fetchAllWidgetData(dashboard.widgets);
  }, [dashboard?.dashboard_id, selectedTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAllWidgetData(widgets) {
    if (!widgets?.length || !dashboard) return;
    const results = {};
    await Promise.all(widgets.map(async w => {
      try {
        const cfg = { ...(w.config || {}), team_id: selectedTeam || w.config?.team_id };
        const r = await api.get(`/dashboards/${dashboard.dashboard_id}/data`,
          { params: { widget_id: w.id, type: w.type, team_id: cfg.team_id, status: cfg.status } });
        Object.assign(results, r.data);
      } catch {}
    }));
    const allEmpty = Object.values(results).every(d => {
      if (!d) return true;
      if (d.count === 0) return true;
      if (Array.isArray(d.tasks) && d.tasks.length === 0) return true;
      if (Array.isArray(d.series) && d.series.every(s => Number(s.count) === 0)) return true;
      return false;
    });
    setWidgetData(allEmpty ? { ...SEED_WIDGET_DATA, ...results } : results);
  }

  function defaultWidgets(tid) {
    return [
      { id: 'count_todo',   type: 'count',     config: { team_id: tid, status: 'todo',  label: 'To Do' } },
      { id: 'count_done',   type: 'count',     config: { team_id: tid, status: 'done',  label: 'Done' } },
      { id: 'chart_main',   type: 'chart',     config: { team_id: tid } },
      { id: 'my_work_main', type: 'my_work',   config: {} },
      { id: 'deadlines_1',  type: 'deadlines', config: { team_id: tid } },
    ];
  }

  const persist = useCallback((widgets) => {
    if (!dashboard) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      api.put(`/dashboards/${dashboard.dashboard_id}`, { widgets }).catch(console.error);
    }, 800);
  }, [dashboard]);

  function addWidget() {
    if (!addingType) return;
    const newW = { id: `${addingType}_${Date.now()}`, type: addingType, config: { team_id: selectedTeam, label: WIDGET_TITLES[addingType] } };
    const updated = [...(dashboard.widgets || []), newW];
    setDashboard(d => ({ ...d, widgets: updated }));
    persist(updated);
    setAddingType(null);
    setTimeout(() => fetchAllWidgetData(updated), 100); // eslint-disable-line react-hooks/exhaustive-deps
  }

  function removeWidget(id) {
    const updated = dashboard.widgets.filter(w => w.id !== id);
    setDashboard(d => ({ ...d, widgets: updated }));
    persist(updated);
  }

  function onDragStart(i)  { setDragIdx(i); }
  function onDragOver(e,i) { e.preventDefault(); setOverIdx(i); }
  function onDrop(i) {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const ws = [...dashboard.widgets];
    const [moved] = ws.splice(dragIdx, 1);
    ws.splice(i, 0, moved);
    setDashboard(d => ({ ...d, widgets: ws }));
    persist(ws);
    setDragIdx(null); setOverIdx(null);
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16 }}>
      Loading dashboard…
    </div>
  );

  const widgets = dashboard?.widgets || [];

  return (
    <div>
      {/* ── Hero ── */}
      <div className="k-hero">
        <div className="k-hero__wm">आज</div>
        <div className="k-hero__top">
          <div>
            <div className="k-hero__title">
              {now.toLocaleDateString('en-IN', { weekday: 'long' })}
            </div>
            <div className="k-hero__sub">
              {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="k-hero__date-block">
            <div className="k-hero__greg" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              विक्रम संवत् 2083
            </div>
            <div className="k-hero__tithi">गुरुवार · Vaishākha</div>
          </div>
        </div>

        {/* Week strip */}
        <div className="k-week">
          {weekDates.map((d, i) => (
            <div key={i} className={'k-wday' + (i === dayIdx ? ' is-today' : '')}>
              <div className="k-wday__en">{WEEK_EN[i]}</div>
              <div className="k-wday__hi">{WEEK_HI[i]}</div>
              <div className="k-wday__num">{d.getDate()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="k-page">
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--ink)' }}>Dashboard</span>
            <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 14, color: 'var(--ink-3)' }}>सारांश</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {teams.length > 0 && (
              <select className="k-select" value={selectedTeam} onChange={e => { setSelectedTeam(e.target.value); if (dashboard) fetchAllWidgetData(dashboard.widgets); }}> {/* eslint-disable-line react-hooks/exhaustive-deps */}
                <option value="">All projects</option>
                {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>
            )}
            <select className="k-select" value={addingType || ''} onChange={e => setAddingType(e.target.value || null)}>
              <option value="">+ Add widget</option>
              {Object.entries(WIDGET_TITLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {addingType && (
              <button className="k-btn k-btn--primary k-btn--sm" onClick={addWidget}>Add</button>
            )}
          </div>
        </div>

        {/* Widgets */}
        {widgets.length === 0 ? (
          <div className="k-empty">
            <div className="k-empty__icon">◇</div>
            <div className="k-empty__title">Dashboard is empty</div>
            <div className="k-empty__sub">Add widgets above to track tasks, deadlines, and progress.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sp-4)' }}>
            {widgets.map((w, i) => (
              <div key={w.id} className="k-card" draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDrop={() => onDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{ cursor: 'grab', opacity: dragIdx === i ? 0.4 : 1, borderColor: overIdx === i && dragIdx !== i ? 'var(--k-primary)' : undefined, transition: 'border-color .15s, opacity .15s' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{w.config?.label || WIDGET_TITLES[w.type] || w.type}</span>
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: 'var(--ink-3)' }}>{WIDGET_SANS[w.type]}</span>
                  </div>
                  <button onClick={() => removeWidget(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
                </div>
                <WidgetRenderer type={w.type} data={widgetData[w.id]} config={w.config} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
