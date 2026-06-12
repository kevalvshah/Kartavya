/**
 * TasksListPage.jsx — editorial Tasks screen.
 * GroupBy: priority (default) | project | status. All data hooks unchanged.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import TaskDrawer  from '../components/TaskDrawer';
import NewTaskModal from '../components/NewTaskModal';
import { PageHeader, DueChip, PriorityDot, StatusChip, ProjectTag, AvatarStack } from '../components/editorial';
import { AVATAR_COLORS, priorityColor } from '../lib/utils';

const PRIORITY_ORDER  = ['urgent','high','medium','low'];
const PRIORITY_LABEL  = { urgent:'Urgent', high:'High', medium:'Medium', low:'Low' };
const PRIORITY_HI     = { urgent:'अत्यावश्यक', high:'उच्च', medium:'मध्यम', low:'न्यून' };
const STATUS_ORDER    = ['todo','in_progress','in_review','done','requested'];
const STATUS_LABEL    = { todo:'To Do', in_progress:'In Progress', in_review:'In Review', done:'Done', requested:'Requested' };
const STATUS_HI       = { todo:'कार्य', in_progress:'चालू', in_review:'समीक्षा', done:'सम्पन्न', requested:'अनुरोध' };
const STATUS_COLOR    = { todo:'#94a3b8', in_progress:'#0082c6', in_review:'#a78bfa', done:'#05b7aa', requested:'#f59e0b' };

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

  // ── Filter ─────────────────────────────────────────────────────────────────
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

  // ── Group ──────────────────────────────────────────────────────────────────
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

      {/* Table */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading tasks…
        </div>
      ) : (
        <div className="k-tablewrap">
          <div className="k-table__head">
            <div className="k-table__hcell k-c-task">Task</div>
            <div className="k-table__hcell k-c-project">Project</div>
            <div className="k-table__hcell k-c-assignees">Assignees</div>
            <div className="k-table__hcell k-c-due">Due</div>
            <div className="k-table__hcell k-c-status">Status</div>
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
                    className="k-trow"
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
                    <div className="k-trow__cell k-c-assignees" style={{ gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}>
                      {assignees.slice(0, 2).map((a, j) => (
                        <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                          <span
                            className="k-avatar"
                            style={{ width: 20, height: 20, fontSize: 8, flexShrink: 0, background: a.color }}
                          >
                            {(a.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                            {a.name}
                          </span>
                        </span>
                      ))}
                      {assignees.length > 2 && (
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>+{assignees.length - 2}</span>
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
