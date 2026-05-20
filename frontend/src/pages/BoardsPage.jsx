/**
 * BoardsPage.jsx — dedicated Boards page with project switcher + view toggle.
 * Route: /boards
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api }          from '../lib/api';
import { currentUser }  from '../lib/auth';
import KanbanView    from '../components/views/KanbanView';
import TableView     from '../components/views/TableView';
import CalendarView  from '../components/views/CalendarView';
import { useFields }    from '../hooks/useFields';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks';
import { usePresence }  from '../hooks/usePresence';
import { PageHeader, AvatarStack } from '../components/editorial';
import { AVATAR_COLORS } from '../lib/utils';

const PROJECT_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

const VIEWS = [
  { id: 'kanban',   label: 'Board',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="4" height="10" rx="1"/><rect x="6" y="3" width="4" height="10" rx="1"/><rect x="11" y="3" width="4" height="10" rx="1"/></svg> },
  { id: 'table',    label: 'List',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M2 8h12M2 12h12"/></svg> },
  { id: 'calendar', label: 'Calendar',
    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2M11 2v2M2 7h12"/></svg> },
];

export default function BoardsPage() {
  const navigate  = useNavigate();
  const me        = currentUser();
  const isClient  = me?.role === 'client';

  const [projects,    setProjects]    = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [project,     setProject]     = useState(null);
  const [columns,     setColumns]     = useState([]);
  const [rawTasks,    setRawTasks]    = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState('kanban');

  const { fieldDefs } = useFields(activeId);
  const { tasks, setTasks } = useRealtimeTasks(activeId, rawTasks);
  const onlineUsers = usePresence(activeId, me);

  useEffect(() => {
    const endpoint = isClient ? '/client/projects' : '/teams';
    api.get(endpoint).then(r => {
      const list = r.data || [];
      setProjects(list);
      if (list.length && !activeId) setActiveId(list[0].team_id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBoard = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const [projR, colR, taskR, membR] = await Promise.all([
        api.get(`/teams/${activeId}`),
        api.get(`/projects/${activeId}/columns`),
        api.get('/tasks', { params: { team_id: activeId } }),
        api.get(`/teams/${activeId}/members`).catch(() => ({ data: [] })),
      ]);
      setProject(projR.data);
      setColumns(colR.data || []);
      setRawTasks(taskR.data || []);
      setTeamMembers(membR.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [activeId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const handleTasksChange = useCallback((updatedTasks) => {
    setTasks(updatedTasks);
  }, [setTasks]);

  const activeProject = projects.find(p => p.team_id === activeId);
  const onlineAvatars = onlineUsers.map((u, i) => ({ name: u.name || u.email || '?', color: AVATAR_COLORS[i % AVATAR_COLORS.length] }));

  return (
    <div className="k-screen">

      <PageHeader
        kicker="AEKAM INC · फ़लक"
        title={project?.name || activeProject?.name || 'Select a project'}
        lede="Move work across the board. Click any card to open."
        right={
          <div className="k-headerright">
            {onlineAvatars.length > 0 && (
              <AvatarStack users={onlineAvatars} size={24} max={4} />
            )}
            <div className="k-projectpicker">
              {projects.map((p, idx) => (
                <button
                  key={p.team_id}
                  className={'k-projectpicker__chip' + (p.team_id === activeId ? ' is-active' : '')}
                  onClick={() => setActiveId(p.team_id)}
                >
                  <span className="k-projectpicker__dot" style={{ background: PROJECT_COLORS[idx % PROJECT_COLORS.length] }} />
                  {p.name}
                </button>
              ))}
            </div>
            <button className="k-link" onClick={() => activeId && navigate(`/projects/${activeId}`)}>
              Open project →
            </button>
          </div>
        }
      />

      {/* View switcher bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--rule-soft)', paddingBottom: 0, marginBottom: 4 }}>
        <div className="k-segctrl">
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={'k-segctrl__btn' + (view === v.id ? ' is-active' : '')}
              onClick={() => setView(v.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading…
        </div>
      ) : (
        <>
          {view === 'kanban' && (
            <KanbanView
              columns={columns}
              tasks={tasks}
              teamMembers={teamMembers}
              fieldDefs={fieldDefs}
              currentUserId={me?.user_id}
              currentUserRole={me?.role}
              showRequested={me?.role !== 'client'}
              onTasksChange={handleTasksChange}
            />
          )}
          {view === 'table' && (
            <TableView
              tasks={tasks}
              columns={columns}
              teamMembers={teamMembers}
              fieldDefs={fieldDefs}
              onTasksChange={handleTasksChange}
            />
          )}
          {view === 'calendar' && (
            <CalendarView
              tasks={tasks}
              teamMembers={teamMembers}
              onTasksChange={handleTasksChange}
            />
          )}
        </>
      )}

    </div>
  );
}
