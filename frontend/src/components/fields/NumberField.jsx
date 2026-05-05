/**
 * NumberField — numeric input with optional prefix/suffix.
 * config: { prefix: '$', suffix: 'hrs', min, max, step }
 */
import React from 'react';

export default function NumberField({ field, value, onChange, readOnly }) {
  const { prefix, suffix, min, max, step = 1 } = field.config || {};

  if (readOnly) {
    if (value == null) return <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>—</span>;
    return (
      <span style={{ fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>
        {prefix}{value}{suffix}
      </span>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {prefix && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{prefix}</span>}
      <input
        type="number" value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        min={min} max={max} step={step}
        style={{
          width: 90, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
          padding: '4px 8px', fontFamily: 'inherit', fontSize: 'var(--text-sm)',
          background: 'var(--bg-default)', color: 'var(--text-default)',
          textAlign: 'right', outline: 'none',
        }}
      />
      {suffix && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{suffix}</span>}
    </div>
  );
}
