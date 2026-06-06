import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';

export default function MessageComposer({ onSend, placeholder = 'Message…', autoFocus = false, compact = false }) {
  const [body,        setBody]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [attachments, setAttachments] = useState([]); // [{name, url, key, uploading}]
  const textRef = useRef();
  const fileRef = useRef();

  useEffect(() => { if (autoFocus && textRef.current) textRef.current.focus(); }, [autoFocus]);

  const submit = async () => {
    const text = body.trim();
    if ((!text && !attachments.length) || sending) return;
    if (attachments.some(a => a.uploading)) return;
    setSending(true);
    try {
      const meta = attachments.length
        ? { attachments: attachments.map(a => ({ name: a.name, url: a.url, key: a.key })) }
        : undefined;
      await onSend(text || ' ', meta);
      setBody('');
      setAttachments([]);
    } finally { setSending(false); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const handleFiles = async (files) => {
    for (const file of files) {
      const id = Math.random().toString(36).slice(2);
      setAttachments(prev => [...prev, { id, name: file.name, url: null, key: null, uploading: true }]);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/upload', fd);
        setAttachments(prev => prev.map(a => a.id === id
          ? { ...a, url: res.data.url, key: res.data.key || null, uploading: false }
          : a
        ));
      } catch {
        setAttachments(prev => prev.filter(a => a.id !== id));
      }
    }
  };

  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  const isImage = (name) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name || '');

  return (
    <div style={{ borderTop: '1px solid var(--rule-soft)', background: 'var(--surface)' }}>
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px 0' }}>
          {attachments.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--rule)', background: 'var(--bg-soft)',
              maxWidth: 200,
            }}>
              {a.uploading ? (
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>Uploading…</span>
              ) : isImage(a.name) && a.url ? (
                <img src={a.url} alt={a.name}
                  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/></svg>
              )}
              <span style={{ fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {a.name}
              </span>
              <button onClick={() => removeAttachment(a.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, lineHeight: 1, flexShrink: 0, padding: 0 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: compact ? '8px 10px' : '10px 14px' }}>
        {/* Attach button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Attach file"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
            padding: '6px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ''; }} />

        <textarea
          ref={textRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          rows={compact ? 1 : 2}
          style={{
            flex: 1, resize: 'none', border: '1px solid var(--rule)',
            borderRadius: 'var(--r-md)', padding: '8px 12px',
            fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
            background: 'var(--bg-soft)', outline: 'none', color: 'var(--ink)',
          }}
        />
        <button
          onClick={submit}
          disabled={(!body.trim() && !attachments.length) || sending || attachments.some(a => a.uploading)}
          style={{
            background: (body.trim() || attachments.length) ? 'var(--k-primary)' : 'var(--rule)',
            color: '#fff', border: 'none', borderRadius: 'var(--r-md)',
            width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background .15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
