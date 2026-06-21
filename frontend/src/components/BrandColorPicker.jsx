/**
 * BrandColorPicker — org-wide brand color palette.
 *
 * mode="manage"  Full CRUD palette: add / remove colors, saves to API.
 *                Used in AdminPage so admins can maintain the palette.
 *
 * mode="display" Read-only swatches pulled from org settings.
 *                Used anywhere the palette should be visible for reference
 *                (template editor, task drawer, project settings, etc.).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export default function BrandColorPicker({ mode = 'manage' }) {
  const [colors,   setColors]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [newHex,   setNewHex]   = useState('#0082c6');
  const [newName,  setNewName]  = useState('');

  useEffect(() => {
    api.get('/settings')
      .then(r => setColors(Array.isArray(r.data.brand_colors) ? r.data.brand_colors : []))
      .catch(() => setColors([]))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (updated) => {
    setSaving(true);
    try {
      const res = await api.put('/settings/brand-colors', { colors: updated });
      setColors(Array.isArray(res.data.brand_colors) ? res.data.brand_colors : updated);
    } catch (_) {}
    finally { setSaving(false); }
  }, []);

  const addColor = () => {
    if (!newHex) return;
    const entry = { hex: newHex, name: newName.trim() };
    const updated = [...colors, entry];
    setColors(updated);
    setNewName('');
    persist(updated);
  };

  const removeColor = (i) => {
    const updated = colors.filter((_, j) => j !== i);
    setColors(updated);
    persist(updated);
  };

  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '8px 0' }}>Loading…</div>;
  }

  /* ── display mode — read-only swatches ── */
  if (mode === 'display') {
    if (colors.length === 0) {
      return (
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
          No brand colors saved. Admins can add them in Admin → Brand Colors.
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {colors.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px',
            background: 'var(--bg-soft)', border: '1px solid var(--rule-soft)', borderRadius: 'var(--r-md)' }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: c.hex, flexShrink: 0,
              border: '1px solid rgba(0,0,0,.1)', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{c.hex}</span>
            {c.name && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>— {c.name}</span>}
          </div>
        ))}
      </div>
    );
  }

  /* ── manage mode — full CRUD ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {colors.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {colors.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
              background: 'var(--bg-soft)', borderRadius: 'var(--r-md)', border: '1px solid var(--rule-soft)' }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: c.hex, flexShrink: 0,
                border: '1px solid rgba(0,0,0,.1)' }} />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
                color: 'var(--ink)', minWidth: 84, letterSpacing: '0.02em' }}>{c.hex}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>
                {c.name || <em style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>Unnamed</em>}
              </span>
              <button onClick={() => removeColor(i)} disabled={saving}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-faint)', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', padding: '4px 0' }}>
          No brand colors saved yet.
        </div>
      )}

      {/* Add row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
            background: 'var(--bg-soft)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
            fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
            <span style={{ width: 20, height: 20, borderRadius: 5, background: newHex,
              border: '1px solid rgba(0,0,0,.15)', flexShrink: 0, display: 'inline-block' }} />
            {newHex}
          </span>
          <input type="color" value={newHex} onChange={e => setNewHex(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%',
              top: 0, left: 0, cursor: 'pointer' }} />
        </label>
        <input className="k-input" value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Name — e.g. Brand Pink, Dark Navy, Logo Blue…"
          onKeyDown={e => e.key === 'Enter' && addColor()}
          style={{ flex: 1, minWidth: 180 }} />
        <button className="k-btn k-btn--ghost k-btn--sm" onClick={addColor} disabled={saving || !newHex}>
          {saving ? 'Saving…' : '+ Add color'}
        </button>
      </div>
    </div>
  );
}
