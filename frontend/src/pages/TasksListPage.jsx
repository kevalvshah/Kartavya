/**
 * TasksListPage.jsx — editorial Tasks screen with resizable columns.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import TaskDrawer  from '../components/TaskDrawer';
import NewTaskModal from '../components/NewTaskModal';
import { PageHeader, DueChip, PriorityDot, StatusChip, ProjectTag } from '../components/editorial';
import { AVATAR_COLORS, priorityColor } from '../lib/utils';

const PRIORITY_ORDER  = ['urgent','high','medium','low'];
const PRIORITY_LABEL  = { urgent:'Urgent', high:'High', medium:'Medium', low:'Low' };
const PRIORITY_HI     = { urgent:'अत्यावश्यक', high:'उच्च', medium:'मध्यम', low:'न्यून' };
const STATUS_ORDER    = ['todo','in_progress','in_review','done','requested'];
const STATUS_LABEL    = { todo:'To Do', in_progress:'In Progress', in_review:'In Review', done:'Done', requested:'Requested' };
const STATUS_HI       = { todo:'कार्य', in_progress:'चालू', in_review:'समीक्षा', done:'सम्पन्न', requested:'अनुरोध' };
const STATUS_COLOR    = { todo:'#94a3b8', in_progress:'#0082c6', in_review:'#a78bfa', done:'#05b7aa', requested:'#f59e0b' };

const COLS = [
  { key: 'task',      label: 'Task',      defaultW: 360, min: 180 },
  { key: 'project',   label: 'Project',   defaultW: 180, min: 100 },
  { key: 'assignees', label: 'Assignees', defaultW: 200, min: 120 },
  { key: 'due',       label: 'Due',       defaultW: 100, min: 80  },
  { key: 'status',    label: 'Status',    defaultW: 130, min: 90  },
];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function useResizableCols(cols) {
  const [widths, setWidths] = useState(() => cols.map(c => c.defaultW));
  const dragging = useRef(null);

  const onMouseDown = useCallback((e, idx) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widths[idx];
    dragging.current = { idx, startX, startW };

    function onMove(e) {
      if (!dragging.current) return;
      const { idx, startX, startW } = dragging.current;
      const newW = Math.max(cols[idx].min, startW + e.clientX - startX);
      setWidths(prev => { const n = [...prev]; n[idx] = newW; return n; });
    }
    function onUp() {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [widths, cols]);

  const gridTemplate = widths.map(w => `${w}px`).join(' ');
  return { widths, gridTemplate, onMouseDown };
}

export default function TasksListPage() {
  const { pushToast } = useToast();
  const user     = currentUser();
  const isClient = user?.role === 'client';

  const [tasks,   setTasks]   = useState([]);
  const [teams,   setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [group,   setGroup]   = useState('priority');
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [newTaskOpen,  setNewTaskOpen]  = useState(false);

  const { gridTemplate, onMouseDown } = useResizableCols(COLS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isClient ? '/client/tasks' : '/tasks';
      const [tRes, pRes] = await Promise.all([
        api.get(endpoint),
        isClient ? api.get('/client/projects') : api.get('/teams'),
      ]);
      setTasks(Array.isArray(tRes.data) ? tRes.data : []);
      setTeams((Array.isArray(pRes.data) ? pRes.data : []).map(t => ({ team_id: t.team_id, name: t.name })));
    } catch (_) { pushToast({ type: 'error', title: 'Could not load tasks' }); }
    finally { setLoading(false); }
  }, [isClient, pushToast]);

  useEffect(() => { load(); }, [load]);

  const myId = user?.user_id;
  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    if (filter === 'mine')    matchFilter = (t.user_id === myId || t.assignee_user_ids?.includes(myId)) && t.status !== 'done';
    if (filter === 'all')     matchFilter = t.status !== 'done';
    if (filter === 'overdue') matchFilter = t.due_at && new Date(t.due_at) < new Date() && t.status !== 'done';
    if (filter === 'done')    matchFilter = t.status === 'done';
    return matchSearch && matchFilter;
  });

  const groups = [];
  if (group === 'priority') {
    PRIORITY_ORDER.forEach(p => {
      const items = filtered.filter(t => t.priority === p);
      if (items.length) groups.push({ key: p, title: PRIORITY_LABEL[p], sans: PRIORITY_HI[p], color: priorityColor(p), items });
    });
    const rest = filtered.filter(t => !PRIORITY_ORDER.includes(t.priority));
    if (rest.length) groups.push({ key: 'other', title: 'Other', sans: 'अन्य', color: '#94a3b8', items: rest });
  } else if (group === 'project') {
    teams.forEach(team => {
      const items = filtered.filter(t => t.team_id === team.team_id);
      if (items.length) groups.push({ key: team.team_id, title: team.name, sans: '', color: AVATAR_COLORS[groups.length % AVATAR_COLORS.length], items });
    });
    const orphans = filtered.filter(t => !teams.find(tm => tm.team_id === t.team_id));
    if (orphans.length) groups.push({ key: 'none', title: 'No project', sans: 'अन्य', color: '#94a3b8', items: orphans });
  } else {
    STATUS_ORDER.forEach(s => {
      const items = filtered.filter(t => t.status === s);
      if (items.length) groups.push({ key: s, title: STATUS_LABEL[s], sans: STATUS_HI[s], color: STATUS_COLOR[s], items });
    });
  }

  const filterCounts = {
    mine:    tasks.filter(t => (t.user_id === myId || t.assignee_user_ids?.includes(myId)) && t.status !== 'done').length,
    all:     tasks.filter(t => t.status !== 'done').length,
    overdue: tasks.filter(t => t.due_at && new Date(t.due_at) < new Date() && t.status !== 'done').length,
    done:    tasks.filter(t => t.status === 'done').length,
  };

  const rowStyle = { gridTemplateColumns: gridTemplate };

  return (
    <div className="k-screen">
      <PageHeader
        kicker="WORKSPACE"
        title={isClient ? 'My Tasks' : 'Tasks'}
        sanskrit="कर्तव्य"
        lede="The list of what's worth doing today."
        right={
          !isClient && (
            <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setNewTaskOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
              New task
            </button>
          )
        }
      />

      {/* Filter bar */}
      <div className="k-filterbar">
        <div className="k-segctrl">
          {[
            { key: 'mine',    label: 'Mine' },
            { key: 'all',     label: 'All open' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'done',    label: 'Done' },
          ].map(f => (
            <button
              key={f.key}
              className={'k-segctrl__btn' + (filter === f.key ? ' is-active' : '')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="k-segctrl__count">{filterCounts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="k-filterbar__right">
          <label className="k-fld">
            <span className="k-fld__lbl">Group by</span>
            <select value={group} onChange={e => setGroup(e.target.value)} className="k-fld__sel">
              <option value="priority">Priority</option>
              <option value="project">Project</option>
              <option value="status">Status</option>
            </select>
          </label>
          <div className="k-topbar__search" style={{ maxWidth: 220 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading tasks…
        </div>
      ) : (
        <div className="k-tablewrap" style={{ overflowX: 'auto' }}>
          {/* Header */}
          <div className="k-table__head k-trow--resizable" style={rowStyle}>
            {COLS.map((col, idx) => (
              <div key={col.key} className={`k-table__hcell k-c-${col.key}`} style={{ position: 'relative', userSelect: 'none' }}>
                {col.label}
                {idx < COLS.length - 1 && (
                  <span
                    className="k-col-resize"
                    onMouseDown={e => onMouseDown(e, idx)}
                  />
                )}
              </div>
            ))}
          </div>

          {groups.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontStyle: 'italic' }}>
              No tasks match this filter.
            </div>
          )}

          {groups.map(g => (
            <div key={g.key} className="k-group">
              <div className="k-group__head" style={{ '--group-color': g.color }}>
                <span className="k-group__bar" />
                <span className="k-group__title">{g.title}</span>
                {g.sans && <span className="k-group__sans">{g.sans}</span>}
                <span className="k-group__count">{g.items.length}</span>
              </div>
              {g.items.map((t, idx) => {
                const team      = teams.find(tm => tm.team_id === t.team_id);
                const assignees = (t.assignee_names || []).map((name, j) => ({ name, color: AVATAR_COLORS[j % AVATAR_COLORS.length] }));
                return (
                  <button
                    key={t.task_id}
                    className="k-trow k-trow--resizable"
                    style={rowStyle}
                    onClick={() => setDrawerTaskId(t.task_id)}
                  >
                    <div className="k-trow__cell k-c-task">
                      <PriorityDot priority={t.priority} />
                      <span className="k-trow__id">KAR-{String(idx + 100)}</span>
                      <span className="k-trow__title">{t.title}</span>
                    </div>
                    <div className="k-trow__cell k-c-project">
                      {team && <ProjectTag name={team.name} dense />}
                    </div>
                    <div className="k-trow__cell k-c-assignees">
                      {assignees.length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>—</span>
                      )}
                      {assignees.slice(0, 3).map((a, j) => (
                        <span key={j} className="k-assignee-pill">
                          <span
                            className="k-avatar k-avatar--ring"
                            style={{ width: 24, height: 24, fontSize: 9, flexShrink: 0, background: a.color }}
                          >
                            {initials(a.name)}
                          </span>
                          <span className="k-assignee-pill__name">{a.name}</span>
                        </span>
                      ))}
                      {assignees.length > 3 && (
                        <span className="k-assignee-pill__more">+{assignees.length - 3}</span>
                      )}
                    </div>
                    <div className="k-trow__cell k-c-due">
                      <DueChip date={t.due_at} />
                    </div>
                    <div className="k-trow__cell k-c-status">
                      <StatusChip status={t.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <TaskDrawer
        taskId={drawerTaskId}
        open={!!drawerTaskId}
        onClose={() => setDrawerTaskId(null)}
        onSaved={() => { setDrawerTaskId(null); load(); }}
      />

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onCreated={() => { setNewTaskOpen(false); load(); }}
      />
    </div>
  );
}
