/**
 * MentionTextarea.jsx — Comment textarea with @mention typeahead.
 * Week 2 Day 8.
 *
 * Props:
 *   value, onChange, onSubmit — standard controlled textarea contract
 *   members — [{user_id, display_name}] to populate autocomplete
 *   placeholder, rows
 */
import React, { useState, useRef, useEffect } from 'react';

const TRIGGER = '@';

export default function MentionTextarea({ value, onChange, onSubmit, members = [], placeholder = 'Add a comment…', rows = 2 }) {
  const [popup, setPopup]     = useState(null); // { query, anchorTop, anchorLeft, range }
  const [cursor, setCursor]   = useState(0);    // highlighted index in filtered list
  const taRef = useRef(null);

  // Derive filtered list from current @query
  const filtered = popup
    ? members.filter(m => m.display_name.toLowerCase().startsWith(popup.query.toLowerCase())).slice(0, 8)
    : [];

  function getCaretCoords(el) {
    // Rough approximation — good enough for dropdown positioning
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX };
  }

  function handleChange(e) {
    const text = e.target.value;
    onChange(text);

    const pos = e.target.selectionStart;
    const slice = text.slice(0, pos);
    const atIdx = slice.lastIndexOf(TRIGGER);

    if (atIdx !== -1) {
      const query = slice.slice(atIdx + 1);
      // Only show popup if no spaces in partial query
      if (!query.includes(' ') && query.length <= 30) {
        const coords = getCaretCoords(e.target);
        setPopup({ query, anchorTop: coords.top, anchorLeft: coords.left, atIdx });
        setCursor(0);
        return;
      }
    }
    setPopup(null);
  }

  function insertMention(member) {
    if (!popup) return;
    const before = value.slice(0, popup.atIdx);
    const after  = value.slice(popup.atIdx + 1 + popup.query.length);
    const mention = `@${member.display_name} `;
    onChange(before + mention + after);
    setPopup(null);
    taRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!popup || filtered.length === 0) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filtered[cursor]);
    }
    if (e.key === 'Escape') setPopup(null);
  }

  // Close popup on outside click
  useEffect(() => {
    function down(e) { if (!taRef.current?.contains(e.target)) setPopup(null); }
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, []);

  const taStyle = {
    width: '100%', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)', padding: '8px 12px',
    fontFamily: 'inherit', fontSize: 'var(--text-sm)',
    background: 'var(--bg-default)', color: 'var(--text-default)',
    resize: 'none', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'relative', flex: 1 }} ref={taRef}>
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        style={taStyle}
      />

      {popup && filtered.length > 0 && (
        <div style={{
          position: 'fixed', top: popup.anchorTop, left: popup.anchorLeft,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          zIndex: 999, minWidth: 220, maxWidth: 320, overflow: 'hidden',
        }}>
          {filtered.map((m, i) => (
            <div
              key={m.user_id || m.display_name}
              onMouseDown={e => { e.preventDefault(); insertMention(m); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', cursor: 'pointer',
                background: i === cursor ? 'var(--bg-muted)' : 'transparent',
                fontSize: 'var(--text-sm)',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--accent-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--accent-default)',
                flexShrink: 0,
              }}>
                {m.display_name[0].toUpperCase()}
              </div>
              <span style={{ fontWeight: 500 }}>{m.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
