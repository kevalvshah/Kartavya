/**
 * CategoriesPage.jsx — create/delete custom task categories.
 */
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { K } from '../lib/brand';
import { Button }  from '../components/ui/button';
import { Input }   from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { Trash2 } from 'lucide-react';

export default function CategoriesPage() {
  const { pushToast } = useToast();
  const [cats,  setCats]  = useState([]);
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(K.blue);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/categories').then(r => setCats(r.data)).catch(() => {}); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try { const r = await api.post('/categories', { name: name.trim(), color }); setCats(p => [r.data, ...p]); setName(''); }
    catch (_) { pushToast({ type: 'error', title: 'Could not create' }); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/categories/${c.category_id}`); setCats(p => p.filter(x => x.category_id !== c.category_id)); }
    catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  return (
    <div className="space-y-5">
      <div><div className="text-sm font-bold">Categories</div><div className="text-sm text-muted-foreground mt-0.5">Tag tasks with custom categories.</div></div>
      <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_120px]">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Category name" />
          <div className="flex gap-2">
            <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="px-2 w-16" />
            <Input value={color} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setColor(e.target.value); }} />
          </div>
          <Button onClick={create}>Create</Button>
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        {cats.length === 0
          ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No categories yet.</div>
          : cats.map(c => (
            <div key={c.category_id} className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ background: c.color }} />
                <div className="text-sm font-semibold">{c.name}</div>
              </div>
              <Button variant="ghost" onClick={() => remove(c)}><Trash2 size={13} /></Button>
            </div>
          ))}
      </div>
    </div>
  );
}
