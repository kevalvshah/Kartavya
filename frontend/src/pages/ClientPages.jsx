/** ClientProjectsPage, ClientProjectBoardPage, ClientPortal */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { K, KLogo, KWordmark } from '../lib/brand';
import { apiLogout, formatDue } from '../lib/auth';
import { useToast } from '../components/ui/toast';
import { FolderKanban, ChevronRight, LogOut } from 'lucide-react';

export function ClientProjectsPage() {
  const [projects, setProjects] = useState([]);
  const navigate   = useNavigate();
  const { pushToast } = useToast();

  useEffect(() => {
    api.get('/client/projects').then(r => setProjects(r.data)).catch(() => {
      pushToast({ type: 'error', title: 'Failed to load projects' });
    });
  }, [pushToast]);

  return (
    <div className="space-y-5">
      <div className="text-sm font-bold">My Projects</div>
      {projects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No projects assigned yet.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map(p => (
          <div key={p.team_id}
            className="rounded-3xl border border-border/70 bg-card/50 p-5 cursor-pointer hover:border-border transition-colors"
            onClick={() => navigate(`/client/project/${p.team_id}`)}>
            <div className="flex items-center gap-3">
              <FolderKanban size={18} style={{ color: K.teal }} />
              <div className="font-bold text-sm">{p.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientProjectBoardPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const { pushToast } = useToast();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/client/projects')} className="text-sm text-muted-foreground hover:text-foreground">Projects</button>
        <ChevronRight size={14} className="text-muted-foreground" />
        <div className="text-sm font-bold">{project?.team?.name || project?.name || '…'}</div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <div key={col.column_id} className="rounded-3xl border border-border/70 bg-card/50 flex-shrink-0" style={{ width: 260, borderTopWidth: 3, borderTopColor: col.color }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="text-sm font-bold">{col.name}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: col.color + '18', color: col.color }}>
                {(grouped[col.column_id] || []).length}
              </span>
            </div>
            <div className="p-2 space-y-2">
              {(grouped[col.column_id] || []).map(t => (
                <div key={t.task_id} className="rounded-2xl border border-border/60 bg-background/50 p-3">
                  <div className="text-sm font-semibold">{t.title}</div>
                  {t.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                  {t.due_at && <div className="mt-2 text-xs" style={{ color: new Date(t.due_at) < new Date() ? '#ef4444' : K.mid }}>Due {formatDue(t.due_at)}</div>}
                </div>
              ))}
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
          <LogOut size={14} /> Sign out
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
