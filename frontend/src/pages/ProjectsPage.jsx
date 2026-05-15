/**
 * ProjectsPage.jsx — project grid using k-* design system.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';

const PROJECT_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [name,     setName]     = useState('');
  const [creating, setCreating] = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const load = () => api.get('/teams').then(r => setProjects(r.data)).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="k-page">
      {/* Page header */}
      <div className="k-pageh">
        <h1 className="k-pageh__title">Projects</h1>
        <span className="k-pageh__sans">योजना</span>
        <div className="k-pageh__actions">
          <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setShowNew(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            New project
          </button>
        </div>
      </div>

      {/* New project form */}
      {showNew && (
        <div className="k-card" style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="k-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="Project name e.g. Diwali Campaign"
              autoFocus
            />
            <button className="k-btn k-btn--primary" onClick={create} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button className="k-btn k-btn--ghost" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Grid */}
      {projects.length === 0 ? (
        <div className="k-empty">
          <div className="k-empty__icon">📁</div>
          <div className="k-empty__title">No projects yet</div>
          <div className="k-empty__sub">Create your first project to get started with tasks and boards.</div>
        </div>
      ) : (
        <div className="k-projgrid">
          {projects.map((p, i) => {
            const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
            const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const created = p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            return (
              <div key={p.team_id} className="k-projcard">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="k-projcard__name" style={{ fontSize: 16 }}>{p.name}</div>
                    <div className="k-projcard__meta">{created}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="k-btn k-btn--primary k-btn--sm" style={{ flex: 1 }}
                    onClick={() => navigate(`/projects/${p.team_id}`)}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="3" width="3" height="10" rx="1"/><rect x="6.5" y="3" width="3" height="7" rx="1"/><rect x="11" y="3" width="3" height="9" rx="1"/></svg>
                    Open Board
                  </button>
                  <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => remove(p)} title="Delete project"
                    style={{ padding: '6px 10px', color: 'var(--danger)' }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add project tile */}
          <button className="k-projcard" onClick={() => setShowNew(true)}
            style={{ border: '1px dashed var(--rule-strong)', background: 'transparent', alignItems: 'center', justifyContent: 'center', minHeight: 140, cursor: 'pointer', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink-3)', lineHeight: 1 }}>+</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-2)', fontWeight: 500 }}>New project</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Create a board for your team</div>
          </button>
        </div>
      )}
    </div>
  );
}
