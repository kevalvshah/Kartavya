/** ClientProjectsPage, ClientProjectBoardPage, ClientPortal */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { K, KLogo, KWordmark } from '../lib/brand';
import { apiLogout, currentUser } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import { PageHeader, StatTile } from '../components/editorial';
import KanbanView from '../components/views/KanbanView';
import TaskEditor from '../components/TaskEditor';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks';
import { useFields } from '../hooks/useFields';

const STATUS_LABEL = { requested: 'Requested', todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', rejected: 'Declined' };
const STATUS_COLOR = { requested: '#f59e0b', todo: '#0082c6', in_progress: '#05b7aa', in_review: '#8b5cf6', done: '#10b981', rejected: '#ef4444' };

function relTime(ts) {
  if (!ts) return '';
  const d = Math.round((Date.now() - new Date(ts)) / 60000);
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.round(d/60)}h ago`;
  return `${Math.round(d/1440)}d ago`;
}

export function ClientProjectsPage() {
  const [projects,    setProjects]    = useState([]);
  const [allTasks,    setAllTasks]    = useState([]);
  const [clientApprovals, setClientApprovals] = useState([]);
  const [newTaskEditor, setNewTaskEditor] = useState({ open: false });
  const navigate     = useNavigate();
  const { pushToast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/client/projects'),
      api.get('/client/tasks'),
      api.get('/client/approvals'),
    ]).then(([pr, t, a]) => {
      setProjects(pr.data || []);
      setAllTasks(t.data || []);
      setClientApprovals(a.data || []);
    }).catch(() => {
      pushToast({ type: 'error', title: 'Failed to load' });
    });
  }, [pushToast]);

  const myRequests     = allTasks.filter(t => t.status === 'requested' || t.status === 'rejected');
  const activeTasks    = allTasks.filter(t => ['todo','in_progress','in_review'].includes(t.status));
  const pendingApprovals = clientApprovals.filter(a => a.approval_id?.startsWith('task_approval::') && a.approval_status === 'pending_client');
  const doneThisWeek   = allTasks.filter(t => {
    if (t.status !== 'done' || !t.updated_at) return false;
    return (Date.now() - new Date(t.updated_at)) < 7 * 86400000;
  });

  return (
    <div className="k-screen">
      <PageHeader
        kicker="WORK"
        title="My Projects"
        sanskrit="परियोजनाएँ"
        lede="Projects you're collaborating on with the team."
        right={
          <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setNewTaskEditor({ open: true })}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            New request
          </button>
        }
      />

      {/* Stat row */}
      <div className="k-stats">
        <StatTile variant="blue"  label="OPEN REQUESTS"         value={myRequests.filter(t => t.status === 'requested').length} sub="awaiting team approval" />
        <StatTile variant="teal"  label="IN PROGRESS"           value={activeTasks.length}      sub="across all projects" />
        <StatTile variant="amber" label="AWAITING YOUR APPROVAL" value={pendingApprovals.length} sub="work to review" />
        <StatTile variant="ok"    label="DONE THIS WEEK"        value={doneThisWeek.length}     sub="completed for you" />
      </div>

      {/* My requests card */}
      {myRequests.length > 0 && (
        <section className="k-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <header className="k-card__head" style={{ padding: '16px 24px' }}>
            <div className="k-card__titles">
              <h3 className="k-card__title">My requests</h3>
              <span className="k-card__sans">मेरे अनुरोध</span>
            </div>
          </header>
          <div className="k-card__body" style={{ padding: 0 }}>
            {myRequests.map((t, i) => (
              <div key={t.task_id} className="k-approval-row" style={i < myRequests.length - 1 ? { borderBottom: '1px solid var(--rule-soft)' } : {}}>
                <div className="k-approval-row__main">
                  <div className="k-approval-row__body">
                    <div className="k-approval-row__title">{t.title}</div>
                    {t.description && <div className="k-approval-row__desc">{t.description}</div>}
                    <div className="k-approval-row__meta">
                      <span className="k-mute">{relTime(t.created_at || t.updated_at)}</span>
                    </div>
                  </div>
                </div>
                <span className="k-statuschip" style={{ '--c': STATUS_COLOR[t.status] || '#888' }}>
                  <span className="k-statuschip__dot" />
                  {STATUS_LABEL[t.status] || t.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && myRequests.length === 0 && (
        <div className="k-empty">
          <div className="k-empty__icon">📂</div>
          <div className="k-empty__title">No projects yet</div>
          <div className="k-empty__sub">No projects have been assigned to you.</div>
        </div>
      )}

      <div className="k-pgrid">
        {projects.map(p => (
          <div
            key={p.team_id}
            className="k-pcard"
            onClick={() => navigate(`/client/project/${p.team_id}`)}
            style={{ cursor: 'pointer' }}
          >
            <div className="k-pcard__head">
              <div className="k-pcard__bar" style={{ background: p.color || 'var(--k-primary)' }} />
              <div className="k-pcard__titles">
                <div className="k-pcard__name">{p.name}</div>
                {p.workspace_name && <div className="k-pcard__client">{p.workspace_name}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <TaskEditor
        open={newTaskEditor.open}
        onOpenChange={(v) => { if (!v) setNewTaskEditor({ open: false }); }}
        editing={null}
        teams={projects}
        defaultTeamId={projects[0]?.team_id || ''}
        lockToProject={false}
        clientMode
        onSaved={() => {
          setNewTaskEditor({ open: false });
          api.get('/client/tasks').then(r => setAllTasks(r.data || [])).catch(() => {});
        }}
      />
    </div>
  );
}

export function ClientProjectBoardPage() {
  const { projectId }  = useParams();
  const navigate       = useNavigate();
  const { pushToast }  = useToast();
  const me             = currentUser();

  const [project,     setProject]     = useState(null);
  const [rawTasks,    setRawTasks]    = useState([]);
  const [columns,     setColumns]     = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [newTaskEditor, setNewTaskEditor] = useState({ open: false, columnId: null });

  const { fieldDefs }       = useFields(projectId);
  const { tasks, setTasks } = useRealtimeTasks(projectId, rawTasks);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, c, t] = await Promise.all([
        api.get(`/teams/${projectId}`),
        api.get(`/projects/${projectId}/columns`),
        api.get('/tasks', { params: { team_id: projectId } }),
      ]);
      setProject(pr.data);
      setColumns(c.data || []);
      setRawTasks(t.data || []);
      setTeamMembers(pr.data.members || []);
    } catch {
      pushToast({ type: 'error', title: 'Failed to load project' });
      navigate('/client/projects');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate, pushToast]);

  useEffect(() => { load(); }, [load]);

  const projectName = project?.team?.name || project?.name || '…';

  if (loading) return (
    <div className="k-screen">
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
        Loading board…
      </div>
    </div>
  );

  return (
    <div className="k-screen">
      <PageHeader
        kicker="CLIENT"
        title={projectName}
        sanskrit=""
        lede="Collaborate on tasks — request new work, approve items sent to you."
        right={
          <div className="k-headerright">
            <button
              className="k-btn k-btn--primary k-btn--sm"
              onClick={() => setNewTaskEditor({ open: true, columnId: columns[0]?.column_id || null })}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v10M3 8h10"/>
              </svg>
              Request task
            </button>
            <button className="k-link" style={{ fontSize: 13 }} onClick={() => navigate('/client/projects')}>
              ← Projects
            </button>
          </div>
        }
      />

      <KanbanView
        columns={columns}
        tasks={tasks}
        fieldDefs={fieldDefs}
        teamMembers={teamMembers}
        onTasksChange={setTasks}
        onColumnChange={(action, colId) => {
          if (action === 'new_task') setNewTaskEditor({ open: true, columnId: colId });
        }}
        showRequested
        showClientApproval
        currentUserId={me?.user_id}
        currentUserRole={me?.role}
      />

      <TaskEditor
        open={newTaskEditor.open}
        onOpenChange={(v) => { if (!v) setNewTaskEditor({ open: false, columnId: null }); }}
        editing={null}
        teams={[]}
        defaultTeamId={projectId}
        defaultColumnId={newTaskEditor.columnId}
        lockToProject
        clientMode
        onSaved={() => {
          setNewTaskEditor({ open: false, columnId: null });
          load();
        }}
      />
    </div>
  );
}

export function ClientPortal() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  useEffect(() => { api.get('/client/tasks').then((r) => setTasks(r.data)).catch(() => {}); }, []);

  return (
    <div style={{ minHeight: '100vh', background: K.dark, fontFamily: "'Inter',sans-serif", padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><KLogo size={36} /><KWordmark dark /></div>
        <button onClick={async () => { await apiLogout(); navigate('/login'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8aa5be', background: 'none', border: 'none', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
      {tasks.length === 0 && <div style={{ color: '#8aa5be', fontSize: 14 }}>No tasks shared with you yet.</div>}
      {tasks.map(t => (
        <div key={t.task_id} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '16px 20px', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t.title}</div>
          {t.description && <div style={{ fontSize: 12, color: '#8aa5be', marginTop: 4 }}>{t.description}</div>}
        </div>
      ))}
    </div>
  );
}
