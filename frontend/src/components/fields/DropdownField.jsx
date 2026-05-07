/**
 * DropdownField — single-select from a list of options.
 * config.options: ['Option A', 'Option B', ...]
 */
import React, { useState, useRef, useEffect } from 'react';

export default function DropdownField({ field, value, onChange, readOnly }) {
  const options = field.config?.options || [];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (readOnly) {
    return value
      ? <span style={{ fontSize: 'var(--text-sm)', background: 'var(--bg-muted)', padding: '2px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-default)' }}>{value}</span>
      : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>—</span>;
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
          padding: '4px 10px', background: 'var(--bg-default)', cursor: 'pointer',
          fontSize: 'var(--text-sm)', color: value ? 'var(--text-default)' : 'var(--text-subtle)',
          fontFamily: 'inherit',
        }}
      >
        {value || 'Select…'} <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          minWidth: 160, overflow: 'hidden',
        }}>
          <div onClick={() => { onChange(null); setOpen(false); }}
            style={{ padding: '7px 12px', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-muted)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >Clear</div>
          {options.map(opt => (
            <div key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)',
                fontWeight: opt === value ? 600 : 400,
                background: opt === value ? 'var(--accent-subtle)' : 'transparent',
              }}
              onMouseEnter={e => { if (opt!==value) e.currentTarget.style.background='var(--bg-muted)'; }}
              onMouseLeave={e => { if (opt!==value) e.currentTarget.style.background='transparent'; }}
            >{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}
