/**
 * DashboardPage.jsx — summary stats, attention items, quick-add, projects list.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { K } from '../lib/brand';
import { Button } from '../components/ui/button';
import { Input }  from '../components/ui/input';
import { Badge }  from '../components/ui/badge';
import { useToast } from '../components/ui/toast';
import { FolderKanban, ChevronRight, Plus } from 'lucide-react';

function StatCard({ label, value, danger, accent }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/50 p-5"
      style={{ background: danger ? 'linear-gradient(135deg,rgba(239,68,68,.08),transparent)' : accent ? `linear-gradient(135deg,${K.blue}14,transparent)` : undefined }}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight" style={{ color: danger ? '#ef4444' : accent ? K.blue : undefined }}>{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [summary,  setSummary]  = useState(null);
  const [projects, setProjects] = useState([]);
  const [title,    setTitle]    = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    api.get('/dashboard/summary').then(r => setSummary(r.data)).catch(() => {});
    api.get('/teams').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  const quickAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try { await api.post('/tasks', { title: title.trim(), status: 'todo', priority: 'medium' }); setTitle(''); pushToast({ type: 'success', title: 'Task added' }); }
    catch (_) { pushToast({ type: 'error', title: 'Could not create' }); }
    finally { setSaving(false); }
  };

  const attentionItems = summary ? [
    { count: summary.new_client_requests,     label: 'New client requests',   to: '/approvals',       color: '#8b5cf6' },
    { count: summary.pending_owner_approval,  label: 'Pending your approval', to: '/approvals',       color: '#f59e0b' },
    { count: summary.awaiting_my_review,      label: 'Awaiting your review',  to: '/client/projects', color: '#8b5cf6' },
    { count: summary.pending_client_approval, label: 'With client',           to: '/tasks',           color: '#8b5cf6' },
    { count: summary.rejected_to_revise,      label: 'Needs revision',        to: '/tasks',           color: '#ef4444' },
  ].filter(i => (i.count || 0) > 0) : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Todo"        value={summary?.todo        ?? '—'} accent />
        <StatCard label="In progress" value={summary?.in_progress ?? '—'} accent />
        <StatCard label="Done"        value={summary?.done        ?? '—'} />
        <StatCard label="Overdue"     value={summary?.overdue     ?? '—'} danger />
      </div>

      {attentionItems.length > 0 && (
        <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
          <div className="text-sm mb-3" style={{ fontWeight: 500 }}>Needs your attention</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {attentionItems.map(it => (
              <button key={it.label} onClick={() => navigate(it.to)}
                className="text-left rounded-2xl border border-border/60 hover:border-border transition-colors p-4"
                style={{ background: 'var(--color-card)' }}>
                <div className="text-2xl" style={{ color: it.color, fontWeight: 600, lineHeight: 1.1 }}>{it.count}</div>
                <div className="text-xs mt-1 text-muted-foreground">{it.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="text-sm font-bold mb-3">Quick add task</div>
            <div className="flex gap-2">
              <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && quickAdd()} placeholder="e.g., Review client brief…" />
              <Button onClick={quickAdd} disabled={saving}><Plus size={15} /><span className="ml-1.5">Add</span></Button>
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">Due in 24 hours</div>
              <Badge tone="info">{summary?.due_24h ?? '—'} tasks</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Head to Tasks or a Project board to act on these.</p>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold">Projects</div>
              <button onClick={() => navigate('/projects')} className="text-xs font-semibold flex items-center gap-1" style={{ color: K.blue }}>All <ChevronRight size={12} /></button>
            </div>
            {projects.length === 0
              ? <p className="text-sm text-muted-foreground">No projects yet.</p>
              : projects.slice(0, 4).map(p => (
                <button key={p.team_id} onClick={() => navigate(`/projects/${p.team_id}`)}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-1 text-left hover:bg-muted/40 transition-colors">
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FolderKanban size={13} color="#fff" />
                  </div>
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <ChevronRight size={13} className="ml-auto text-muted-foreground" />
                </button>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
