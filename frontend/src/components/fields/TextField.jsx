/**
 * TextField — single-line or multiline text input.
 * config.multiline: boolean
 */
import React, { useState } from 'react';

export default function TextField({ field, value, onChange, readOnly }) {
  const multiline = field.config?.multiline || false;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const commit = () => { onChange(draft); setEditing(false); };

  if (readOnly || !editing) {
    const display = value || '';
    return (
      <span
        onClick={() => !readOnly && setEditing(true)}
        style={{
          display: 'inline-block', fontSize: 'var(--text-sm)',
          color: display ? 'var(--text-default)' : 'var(--text-subtle)',
          cursor: readOnly ? 'default' : 'text',
          minWidth: 80,
          borderBottom: readOnly ? 'none' : '1px dashed var(--border-default)',
        }}
      >
        {display || (readOnly ? '—' : 'Click to edit…')}
      </span>
    );
  }

  const sharedStyle = {
    border: '1px solid var(--accent-default)', borderRadius: 'var(--radius-sm)',
    padding: '4px 8px', fontFamily: 'inherit', fontSize: 'var(--text-sm)',
    background: 'var(--bg-default)', color: 'var(--text-default)', outline: 'none',
    width: '100%',
  };

  return multiline ? (
    <textarea rows={3} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} autoFocus style={{ ...sharedStyle, resize: 'vertical' }}
    />
  ) : (
    <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => e.key === 'Enter' && commit()}
      autoFocus style={sharedStyle}
    />
  );
}
