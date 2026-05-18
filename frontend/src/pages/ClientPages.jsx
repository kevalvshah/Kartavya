/** ClientProjectsPage, ClientProjectBoardPage, ClientPortal */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { K, KLogo, KWordmark } from '../lib/brand';
import { apiLogout, formatDue } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import { PageHeader, DueChip, StatusChip } from '../components/editorial';

export function ClientProjectsPage() {
  const [projects, setProjects] = useState([]);
  const navigate     = useNavigate();
  const { pushToast } = useToast();

  useEffect(() => {
    api.get('/client/projects').then(r => setProjects(r.data)).catch(() => {
      pushToast({ type: 'error', title: 'Failed to load projects' });
    });
  }, [pushToast]);

  return (
    <div className="k-screen">
      <PageHeader
        kicker="CLIENT"
        title="My Projects"
        sanskrit="परियोजना"
        lede="Projects shared with you — track progress and approvals."
      />

      {projects.length === 0 && (
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
    </div>
  );
}

export function ClientProjectBoardPage() {
  const { projectId } = useParams();
  const navigate       = useNavigate();
  const { pushToast }  = useToast();
  const [project,  setProject]  = useState(null);
  const [tasks,    setTasks]    = useState([]);
  const [columns,  setColumns]  = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(`/teams/${projectId}`),
      api.get('/tasks', { params: { team_id: projectId } }),
      api.get(`/projects/${projectId}/columns`),
    ]).then(([pr, t, c]) => {
      setProject(pr.data); setTasks(t.data); setColumns(c.data);
    }).catch(() => {
      pushToast({ type: 'error', title: 'Failed to load project' });
      navigate('/client/projects');
    });
  }, [projectId, navigate, pushToast]);

  const grouped = useMemo(() => {
    const g = {};
    columns.forEach(c => { g[c.column_id] = []; });
    tasks.forEach(t => { if (g[t.column_id]) g[t.column_id].push(t); });
    return g;
  }, [tasks, columns]);

  const projectName = project?.team?.name || project?.name || '…';

  return (
    <div className="k-screen">
      <PageHeader
        kicker="CLIENT"
        title={projectName}
        sanskrit=""
        lede="Your tasks — read-only view."
        right={
          <button className="k-link" style={{ fontSize: 13 }} onClick={() => navigate('/client/projects')}>
            ← Projects
          </button>
        }
      />

      {/* Kanban columns scroll */}
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        {columns.map(col => (
          <div
            key={col.column_id}
            className="k-card"
            style={{ minWidth: 260, maxWidth: 280, flexShrink: 0, padding: 0, overflow: 'hidden', borderTopWidth: 3, borderTopColor: col.color || 'var(--k-primary)' }}
          >
            <div className="k-card__head" style={{ padding: '12px 16px' }}>
              <div className="k-card__titles">
                <h3 className="k-card__title" style={{ fontSize: 14 }}>{col.name}</h3>
                <span className="k-segctrl__count">{(grouped[col.column_id] || []).length}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px 12px' }}>
              {(grouped[col.column_id] || []).map(t => (
                <div key={t.task_id} style={{ background: 'var(--bg-soft)', borderRadius: 'var(--r-md)', padding: '10px 14px', border: '1px solid var(--rule-soft)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>{t.title}</div>
                  {t.description && (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.description}</div>
                  )}
                  {t.due_at && <DueChip date={t.due_at} />}
                </div>
              ))}
              {(grouped[col.column_id] || []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 2px' }}>Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>
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
