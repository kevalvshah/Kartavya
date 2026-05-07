/**
 * DashboardPage.jsx — v2 widget dashboard.
 * Count, Chart, MyWork, Deadlines + drag-to-reorder.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

const PRIORITY_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };

function relDate(iso) {
  if (!iso) return '—';
  const d   = new Date(iso);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return <span style={{ color: 'var(--danger)' }}>Overdue</span>;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return <span style={{ color: 'var(--warning)' }}>Today</span>;
  if (days === 1) return <span style={{ color: 'var(--warning)' }}>Tomorrow</span>;
  return `${days}d`;
}

function CountWidget({ data, config }) {
  const count = data?.count ?? '…';
  const label = config?.label || 'Tasks';
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent-default)', lineHeight: 1 }}>{count}</div>
      <div style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function ChartWidget({ data }) {
  const series = data?.series || [];
  const total  = series.reduce((s, r) => s + Number(r.count), 0) || 1;
  const STATUS_COLORS = { todo: '#60a5fa', in_progress: '#f59e0b', in_review: '#a78bfa', done: '#34d399', default: '#94a3b8' };
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12, gap: 1 }}>
        {series.map(r => (
          <div key={r.status} style={{ flex: r.count / total, background: STATUS_COLORS[r.status] || STATUS_COLORS.default, transition: 'flex 0.4s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {series.map(r => (
          <div key={r.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[r.status] || STATUS_COLORS.default, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.status.replace('_',' ')}</span>
            </div>
            <strong>{r.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function MyWorkWidget({ data }) {
  const tasks = data?.tasks || [];
  if (tasks.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No tasks assigned to you.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tasks.slice(0, 6).map(t => (
        <div key={t.task_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[t.priority] || '#94a3b8', flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
          <span style={{ color: 'var(--text-subtle)', fontSize: 11, flexShrink: 0 }}>{relDate(t.due_at)}</span>
        </div>
      ))}
      {tasks.length > 6 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>+{tasks.length - 6} more</div>}
    </div>
  );
}

function DeadlinesWidget({ data }) {
  const tasks = data?.tasks || [];
  if (tasks.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No upcoming deadlines.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tasks.slice(0, 8).map(t => (
        <div key={t.task_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
          <span style={{ flexShrink: 0, fontSize: 11 }}>{relDate(t.due_at)}</span>
        </div>
      ))}
    </div>
  );
}

function WidgetRenderer({ type, data, config }) {
  if (!data) return <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading…</div>;
  if (type === 'count')     return <CountWidget     data={data} config={config} />;
  if (type === 'chart')     return <ChartWidget     data={data} />;
  if (type === 'my_work')   return <MyWorkWidget   data={data} />;
  if (type === 'deadlines') return <DeadlinesWidget data={data} />;
  return <div style={{ color: 'var(--text-muted)' }}>Unknown widget: {type}</div>;
}

const WIDGET_TITLES = { count: '📊 Count', chart: '🎞 Status Breakdown', my_work: '📝 My Work', deadlines: '📅 Upcoming Deadlines' };

export default function DashboardPage({ teamId, teams = [] }) {
  const [dashboard,   setDashboard]   = useState(null);
  const [widgetData,  setWidgetData]  = useState({});
  const [loading,     setLoading]     = useState(true);
  const [addingType,  setAddingType]  = useState(null);
  const [dragIdx,     setDragIdx]     = useState(null);
  const [overIdx,     setOverIdx]     = useState(null);
  const [selectedTeam,setSelectedTeam]= useState(teamId || '');
  const saveTimeout = useRef(null);

  useEffect(() => { if (teamId) setSelectedTeam(teamId); }, [teamId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.get('/api/dashboards/')
       .then(async r => {
         let dash = r.data[0];
         if (!dash) {
           const cr = await api.post('/api/dashboards/', {
             name: 'My Dashboard',
             widgets: defaultWidgets(selectedTeam),
           });
           dash = cr.data;
         }
         setDashboard(dash);
       })
       .catch(console.error)
       .finally(() => setLoading(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dashboard) return;
    fetchAllWidgetData(dashboard.widgets);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.dashboard_id, selectedTeam]);

  async function fetchAllWidgetData(widgets) {
    if (!widgets?.length || !dashboard) return;
    const results = {};
    await Promise.all(widgets.map(async w => {
      try {
        const cfg = { ...(w.config || {}), team_id: selectedTeam || w.config?.team_id };
        const r = await api.get(`/api/dashboards/${dashboard.dashboard_id}/data`,
          { params: { widget_id: w.id, type: w.type, team_id: cfg.team_id, status: cfg.status } });
        Object.assign(results, r.data);
      } catch {}
    }));
    setWidgetData(results);
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
      api.put(`/api/dashboards/${dashboard.dashboard_id}`, { widgets }).catch(console.error);
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
  function onDragOver(e, i){ e.preventDefault(); setOverIdx(i); }
  function onDrop(i) {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const ws = [...dashboard.widgets];
    const [moved] = ws.splice(dragIdx, 1);
    ws.splice(i, 0, moved);
    setDashboard(d => ({ ...d, widgets: ws }));
    persist(ws);
    setDragIdx(null); setOverIdx(null);
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading dashboard…</div>;

  const widgets = dashboard?.widgets || [];

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>📊 Dashboard</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {teams.length > 0 && (
            <select value={selectedTeam} onChange={e => { setSelectedTeam(e.target.value); if (dashboard) fetchAllWidgetData(dashboard.widgets); }} // eslint-disable-line react-hooks/exhaustive-deps
              style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)' }}>
              <option value=''>All projects</option>
              {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={addingType || ''} onChange={e => setAddingType(e.target.value || null)}
              style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)' }}>
              <option value=''>+ Add widget</option>
              {Object.entries(WIDGET_TITLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {addingType && (
              <button onClick={addWidget}
                style={{ background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)' }}>Add</button>
            )}
          </div>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <p>Your dashboard is empty. Add widgets above to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
          {widgets.map((w, i) => (
            <div key={w.id} draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={() => onDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              style={{ background: 'var(--bg-elevated)', border: `1px solid ${overIdx === i && dragIdx !== i ? 'var(--accent-default)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', cursor: 'grab', opacity: dragIdx === i ? 0.4 : 1, transition: 'border-color 0.15s, opacity 0.15s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{w.config?.label || WIDGET_TITLES[w.type] || w.type}</span>
                <button onClick={() => removeWidget(w.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 15, lineHeight: 1, padding: 2 }}>×</button>
              </div>
              <WidgetRenderer type={w.type} data={widgetData[w.id]} config={w.config} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
