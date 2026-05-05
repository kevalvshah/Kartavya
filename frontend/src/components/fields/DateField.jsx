/**
 * DateField — date picker with relative display.
 */
import React from 'react';

export default function DateField({ field, value, onChange, readOnly }) {
  const formatRelative = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = Date.now();
    const diff = d.getTime() - now;
    const days = Math.round(diff / 86400000);
    if (days === 0)  return 'Today';
    if (days === 1)  return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days > 0 && days < 7) return `In ${days} days`;
    if (days < 0 && days > -7) return `${Math.abs(days)} days ago`;
    return d.toLocaleDateString();
  };

  const isOverdue = value && new Date(value) < new Date() && !readOnly;

  if (readOnly) {
    if (!value) return <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>No date</span>;
    return (
      <span style={{ fontSize: 'var(--text-sm)', color: isOverdue ? 'var(--danger)' : 'var(--text-default)' }}>
        {formatRelative(value)}
      </span>
    );
  }

  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ''}
      onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      style={{
        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
        padding: '4px 8px', fontFamily: 'inherit', fontSize: 'var(--text-sm)',
        background: 'var(--bg-default)', color: isOverdue ? 'var(--danger)' : 'var(--text-default)',
        cursor: 'pointer',
      }}
    />
  );
}
