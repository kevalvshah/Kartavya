/**
 * CategoriesPage.jsx — k-* design system.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { PageHeader } from '../components/editorial';

const DEFAULT_COLOR = '#05b7aa';

export default function CategoriesPage() {
  const { pushToast } = useToast();
  const [cats,  setCats]  = useState([]);
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    api.get('/categories').then(r => setCats(r.data)).catch(() => {});
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      const r = await api.post('/categories', { name: name.trim(), color });
      setCats(p => [r.data, ...p]);
      setName('');
    } catch (_) { pushToast({ type: 'error', title: 'Could not create' }); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try {
      await api.delete(`/categories/${c.category_id}`);
      setCats(p => p.filter(x => x.category_id !== c.category_id));
    } catch (_) { pushToast({ type: 'error', title: 'Could not delete' }); }
  };

  return (
    <div className="k-screen">
      <PageHeader kicker="SETTINGS" title="Categories" sanskrit="वर्ग" lede="Tags you can drop on any task. Used in filters, reports, and automations." />

      <div className="k-card" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="k-card__head">
          <span className="k-card__title">New category</span>
          <span className="k-card__sans">नई श्रेणी</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="k-input" style={{ flex: '1 1 180px' }} value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Category name" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width: 36, height: 36, border: '2px solid var(--rule-soft)', borderRadius: 8, cursor: 'pointer', padding: 2, background: 'transparent' }} />
            <input className="k-input" style={{ width: 90, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              value={color} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setColor(e.target.value); }} />
          </div>
          <button className="k-btn k-btn--primary" onClick={create}>Create</button>
        </div>
      </div>

      <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
        {cats.length === 0 ? (
          <div className="k-empty" style={{ padding: 'var(--sp-8)' }}>
            <div className="k-empty__icon">🏷</div>
            <div className="k-empty__title">No categories yet</div>
            <div className="k-empty__sub">Tag tasks with custom categories.</div>
          </div>
        ) : cats.map(c => (
          <div key={c.category_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px dashed var(--rule-soft)' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{c.name}</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)' }}>{c.color}</div>
            <button className="k-iconbtn" style={{ color: 'var(--danger)' }} onClick={() => remove(c)} title="Delete">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
