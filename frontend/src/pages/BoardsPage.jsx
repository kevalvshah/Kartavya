/**
 * BoardsPage.jsx — dedicated Boards page with project switcher in top-right.
 * Route: /boards  (separate from /projects which is the grid view)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api }          from '../lib/api';
import { currentUser }  from '../lib/auth';
import KanbanView       from '../components/views/KanbanView';
import { useFields }    from '../hooks/useFields';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks';
import { usePresence }  from '../hooks/usePresence';
import { PageHeader, AvatarStack } from '../components/editorial';
import { AVATAR_COLORS } from '../lib/utils';

const PROJECT_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

export default function BoardsPage() {
  const navigate  = useNavigate();
  const me        = currentUser();
  const isClient  = me?.role === 'client';

  const [projects,      setProjects]      = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [project,       setProject]       = useState(null);
  const [columns,       setColumns]       = useState([]);
  const [rawTasks,      setRawTasks]      = useState([]);
  const [teamMembers,   setTeamMembers]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  const { fieldDefs } = useFields(activeId);
  const { tasks, setTasks } = useRealtimeTasks(activeId, rawTasks);
  const onlineUsers = usePresence(activeId, me);

  // Load project list
  useEffect(() => {
    const endpoint = isClient ? '/client/projects' : '/teams';
    api.get(endpoint).then(r => {
      const list = r.data || [];
      setProjects(list);
      if (list.length && !activeId) setActiveId(list[0].team_id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load board data for active project
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

  // Close picker on outside click
  useEffect(() => {
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTasksChange = useCallback((updatedTasks) => {
    setTasks(updatedTasks);
  }, [setTasks]);

  const activeProject = projects.find(p => p.team_id === activeId);
  const activeColor   = PROJECT_COLORS[projects.findIndex(p => p.team_id === activeId) % PROJECT_COLORS.length] || '#0082c6';

  const onlineAvatars = onlineUsers.map((u, i) => ({ name: u.name || u.email || '?', color: AVATAR_COLORS[i % AVATAR_COLORS.length] }));

  return (
    <div className="k-screen">

      <PageHeader
        kicker={activeProject ? `${activeProject.name.toUpperCase()} · फ़लक` : 'BOARDS · फ़लक'}
        title={activeProject?.name || 'Loading…'}
        lede="Move work across the board. Click any card to open."
        right={
          <div className="k-headerright">
            {onlineAvatars.length > 0 && (
              <AvatarStack users={onlineAvatars} size={24} max={4} />
            )}
            <div className="k-projectpicker">
              {projects.map((p, idx) => {
                const c = PROJECT_COLORS[idx % PROJECT_COLORS.length];
                return (
                  <button
                    key={p.team_id}
                    className={'k-projectpicker__chip' + (p.team_id === activeId ? ' is-active' : '')}
                    onClick={() => setActiveId(p.team_id)}
                  >
                    <span className="k-projectpicker__dot" style={{ background: c }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
            <button className="k-link" onClick={() => activeId && navigate(`/projects/${activeId}`)}>
              Open project →
            </button>
          </div>
        }
      />

      {/* Board */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loading board…
        </div>
      ) : (
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

    </div>
  );
}
