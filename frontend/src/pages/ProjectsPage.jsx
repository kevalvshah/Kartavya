/**
 * ProjectsPage.jsx — editorial Projects grid.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { PageHeader, DueChip } from '../components/editorial';

const PROJECT_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [name,     setName]     = useState('');
  const [creating, setCreating] = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const load = () => api.get('/teams').then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post('/teams', { name: name.trim() });
      setName(''); setShowNew(false);
      pushToast({ type: 'success', title: 'Project created' }); load();
    } catch (_) { pushToast({ type: 'error', title: 'Could not create project' }); }
    finally { setCreating(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? All tasks will be deleted.`)) return;
    try { await api.delete(`/teams/${p.team_id}`); pushToast({ type: 'success', title: 'Deleted' }); load(); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  return (
    <div className="k-screen">
      <PageHeader
        kicker="WORKSPACE"
        title="Projects"
        sanskrit="परियोजनाएँ"
        lede="Every active engagement — internal and client."
        right={
          <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setShowNew(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            New project
          </button>
        }
      />

      {/* New project form */}
      {showNew && (
        <section className="k-card">
          <header className="k-card__head">
            <div className="k-card__titles">
              <h3 className="k-card__title">New project</h3>
              <span className="k-card__sans">नई परियोजना</span>
            </div>
          </header>
          <div className="k-card__body">
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="k-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Project name…"
                onKeyDown={e => e.key === 'Enter' && create()}
                autoFocus
                style={{ flex: 1 }}
              />
              <button className="k-btn k-btn--primary" onClick={create} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button className="k-btn k-btn--ghost" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      {/* Project grid */}
      <div className="k-pgrid">
        {projects.length === 0 && (
          <div className="k-empty">
            <div className="k-empty__icon">📁</div>
            <div className="k-empty__title">No projects yet</div>
            <div className="k-empty__sub">Create your first project to get started.</div>
          </div>
        )}
        {projects.map((p, idx) => {
          const color     = PROJECT_COLORS[idx % PROJECT_COLORS.length];
          const taskCount = p.task_count || 0;
          const doneCount = p.done_count || 0;
          const openCount = taskCount - doneCount;
          const progress  = taskCount > 0 ? doneCount / taskCount : 0;
          const kicker    = p.category || p.name.split(' ').pop().toUpperCase().slice(0, 10);

          return (
            <button
              key={p.team_id}
              className="k-pcard"
              onClick={() => navigate(`/projects/${p.team_id}`)}
            >
              <div className="k-pcard__head">
                <span className="k-pcard__bar" style={{ background: color }} />
                <div className="k-pcard__titles">
                  <div className="k-pcard__sans" style={{ color }}>{kicker}</div>
                  <div className="k-pcard__name">{p.name}</div>
                  <div className="k-pcard__client">{p.workspace_name || 'Internal'}</div>
                </div>
                <button
                  className="k-iconbtn"
                  style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 12 }}
                  onClick={e => { e.stopPropagation(); remove(p); }}
                  title="Delete project"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M5 4V2.5h6V4M6 7v5M10 7v5M4 4l.8 10h6.4L12 4"/></svg>
                </button>
              </div>
              <div className="k-pcard__body">
                <div className="k-pcard__stat"><b>{taskCount}</b><span>tasks</span></div>
                <div className="k-pcard__stat"><b>{doneCount}</b><span>done</span></div>
                <div className="k-pcard__stat"><b>{openCount}</b><span>open</span></div>
              </div>
              <div className="k-pcard__meter">
                <div className="k-pcard__bar2">
                  <i style={{ width: Math.round(progress * 100) + '%', background: color }} />
                </div>
                <div className="k-pcard__meter-row">
                  <span>{Math.round(progress * 100)}% complete</span>
                  {p.due_at && <DueChip date={p.due_at} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
