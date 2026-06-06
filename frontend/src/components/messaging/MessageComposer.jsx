import React, { useState, useRef, useEffect } from 'react';

const EMOJI_QUICK = ['👍','✅','👀','❤️','😂','🙏','🔥'];

export default function MessageComposer({ onSend, placeholder = 'Message…', autoFocus = false, compact = false }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const ref = useRef();

  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);

  const submit = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setBody('');
    } finally { setSending(false); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: compact ? '8px 12px' : '12px 16px',
      borderTop: '1px solid var(--rule-soft)',
      background: 'var(--surface)',
    }}>
      <textarea
        ref={ref}
        value={body}
        onChange={e => setBody(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        rows={compact ? 1 : 2}
        style={{
          flex: 1, resize: 'none', border: '1px solid var(--rule)',
          borderRadius: 'var(--r-md)', padding: '8px 12px',
          fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
          background: 'var(--bg-soft)', outline: 'none',
          color: 'var(--ink)',
        }}
      />
      <button
        onClick={submit}
        disabled={!body.trim() || sending}
        style={{
          background: body.trim() ? 'var(--k-primary)' : 'var(--rule)',
          color: '#fff', border: 'none', borderRadius: 'var(--r-md)',
          width: 36, height: 36, cursor: body.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'background .15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  );
}
