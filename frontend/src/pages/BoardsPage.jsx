/**
 * BoardsPage.jsx — dedicated Boards page with project switcher in top-right.
 * Route: /boards  (separate from /projects which is the grid view)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api }          from '../lib/api';
import { currentUser }  from '../lib/auth';
import KanbanView       from '../components/views/KanbanView';
import { useFields }    from '../hooks/useFields';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks';
import { usePresence }  from '../hooks/usePresence';
import { AvatarStack }  from '../components/editorial';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

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
    <div className="k-screen k-screen--boards" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Page header */}
      <div className="k-boards-head">
        <div className="k-boards-head__left">
          <div className="k-boards-head__kicker">BOARDS · फ़लक</div>
          <div className="k-boards-head__title" style={{ borderLeft: `3px solid ${activeColor}`, paddingLeft: 12 }}>
            {project?.name || 'Loading…'}
          </div>
        </div>

        <div className="k-boards-head__right">
          {/* Online presence */}
          {onlineAvatars.length > 0 && (
            <AvatarStack users={onlineAvatars} size={24} max={4} />
          )}

          {/* Project switcher */}
          <div className="k-proj-switcher" ref={pickerRef}>
            <button
              className="k-proj-switcher__btn"
              onClick={() => setPickerOpen(v => !v)}
            >
              <span className="k-proj-switcher__dot" style={{ background: activeColor }} />
              <span className="k-proj-switcher__name">{activeProject?.name || 'Select project'}</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </button>

            {pickerOpen && (
              <div className="k-proj-switcher__menu">
                <div className="k-proj-switcher__label">Switch project</div>
                {projects.map((p, idx) => {
                  const c = PROJECT_COLORS[idx % PROJECT_COLORS.length];
                  return (
                    <button
                      key={p.team_id}
                      className={'k-proj-switcher__item' + (p.team_id === activeId ? ' is-active' : '')}
                      onClick={() => { setActiveId(p.team_id); setPickerOpen(false); }}
                    >
                      <span className="k-proj-switcher__dot" style={{ background: c }} />
                      <span>{p.name}</span>
                      {p.team_id === activeId && (
                        <svg style={{ marginLeft: 'auto' }} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 8l3.5 3.5L13 5"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
                <div className="k-proj-switcher__sep" />
                <button className="k-proj-switcher__item" onClick={() => navigate('/projects')}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="5" height="5" rx="1"/>
                    <rect x="9" y="2" width="5" height="5" rx="1"/>
                    <rect x="2" y="9" width="5" height="5" rx="1"/>
                    <rect x="9" y="9" width="5" height="5" rx="1"/>
                  </svg>
                  <span>All projects</span>
                </button>
              </div>
            )}
          </div>

          {/* New task */}
          <button
            className="k-btn k-btn--primary k-btn--sm"
            onClick={() => navigate(`/projects/${activeId}`)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            New task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="k-boards-body" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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

    </div>
  );
}
