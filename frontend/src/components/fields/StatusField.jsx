/**
 * StatusField — coloured pill selector.
 * config.options: [{label, color}]
 */
import React, { useState, useRef, useEffect } from 'react';

const DEFAULT_OPTIONS = [
  { label: 'Not Started', color: '#94a3b8' },
  { label: 'In Progress', color: '#3b82f6' },
  { label: 'Blocked',     color: '#ef4444' },
  { label: 'Done',        color: '#22c55e' },
];

export default function StatusField({ field, value, onChange, readOnly }) {
  const options = field.config?.options || DEFAULT_OPTIONS;
  const current = options.find(o => o.label === value) || options[0];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pill = (opt, onClick) => (
    <span
      key={opt.label}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: opt.color + '22', color: opt.color,
        border: `1px solid ${opt.color}55`,
        borderRadius: 'var(--radius-full)', padding: '2px 10px',
        fontSize: 'var(--text-xs)', fontWeight: 600,
        cursor: readOnly ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color, display: 'inline-block' }} />
      {opt.label}
    </span>
  );

  if (readOnly) return pill(current, undefined);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {pill(current, () => setOpen(o => !o))}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          display: 'flex', flexDirection: 'column', gap: 2, padding: 6, minWidth: 160,
        }}>
          {options.map(opt => (
            <div key={opt.label}
              onClick={() => { onChange(opt.label); setOpen(false); }}
              style={{ padding: '5px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {pill(opt, undefined)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
