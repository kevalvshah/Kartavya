/**
 * ProjectsPage.jsx — create/browse project cards.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { K } from '../lib/brand';
import { Button }  from '../components/ui/button';
import { Input }   from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { FolderKanban, LayoutGrid, Trash2, Plus } from 'lucide-react';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [name,     setName]     = useState('');
  const [creating, setCreating] = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const load = () => api.get('/teams').then(r => setProjects(r.data)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try { await api.post('/teams', { name: name.trim() }); setName(''); setShowNew(false); pushToast({ type: 'success', title: 'Project created' }); load(); }
    catch (_) { pushToast({ type: 'error', title: 'Could not create project' }); }
    finally { setCreating(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete project "${p.name}"? All tasks in it will be deleted.`)) return;
    try { await api.delete(`/teams/${p.team_id}`); pushToast({ type: 'success', title: 'Project deleted' }); load(); }
    catch (e) { pushToast({ type: 'error', title: 'Could not delete', message: e?.response?.data?.detail || e?.message }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-bold">Projects</div><div className="text-sm text-muted-foreground mt-0.5">Each project has its own customisable board.</div></div>
        <Button onClick={() => setShowNew(true)}><Plus size={15} /><span className="ml-1.5">New project</span></Button>
      </div>
      {showNew && (
        <div className="rounded-3xl border border-border/70 bg-card/50 p-5 flex gap-3">
          <Input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder="Project name e.g. Website Redesign" autoFocus />
          <Button onClick={create} disabled={creating}>Create</Button>
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.length === 0 && <div className="col-span-3 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No projects yet. Create your first one above.</div>}
        {projects.map(p => (
          <div key={p.team_id} className="rounded-3xl border border-border/70 bg-card/50 p-5 flex flex-col gap-3 hover:border-border transition-colors">
            <div className="flex items-start gap-3">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FolderKanban size={18} color="#fff" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Project · {new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => navigate(`/projects/${p.team_id}`)} className="flex-1"><LayoutGrid size={13} /><span className="ml-1.5">Open Board</span></Button>
              <Button variant="ghost" onClick={() => remove(p)} className="px-2.5"><Trash2 size={13} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
