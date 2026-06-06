import React, { useState } from 'react';
import { currentUser } from '../../lib/auth';
import { api } from '../../lib/api';

const EMOJI_QUICK = ['👍','✅','👀','❤️','😂','🙏','🔥'];

function Avatar({ name, size = 28 }) {
  const colors = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981'];
  const color  = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function MessageItem({ msg, onReact, onDelete, onReplyClick, showThread = true }) {
  const me = currentUser();
  const isMine = msg.sender_id === me?.user_id;
  const [showEmoji, setShowEmoji] = useState(false);
  const [hovering, setHovering]  = useState(false);

  if (msg.deleted) {
    return (
      <div style={{ padding: '2px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ width: 28, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Message deleted</span>
      </div>
    );
  }

  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Group reactions by emoji
  const rxnGroups = {};
  (msg.reactions || []).forEach(r => {
    if (!rxnGroups[r.emoji]) rxnGroups[r.emoji] = [];
    rxnGroups[r.emoji].push(r);
  });

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShowEmoji(false); }}
      style={{ padding: '3px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
        background: hovering ? 'var(--bg-soft)' : 'transparent', position: 'relative' }}
    >
      <Avatar name={msg.sender_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{msg.sender_name}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{time}</span>
          {msg.edited_at && <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontStyle: 'italic' }}>(edited)</span>}
          {msg.source === 'whatsapp' && (
            <span style={{ fontSize: 10, background: '#25D366', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>WA</span>
          )}
        </div>
        {/* Body */}
        <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {(msg.body || '').split(/(@[\w.\-]+)/g).map((part, i) =>
            part.startsWith('@')
              ? <strong key={i} style={{ color: 'var(--k-primary)' }}>{part}</strong>
              : part
          )}
        </div>
        {/* Reactions */}
        {Object.keys(rxnGroups).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {Object.entries(rxnGroups).map(([emoji, users]) => {
              const iReacted = users.some(u => u.user_id === me?.user_id);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact?.(msg.message_id, emoji)}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px',
                    borderRadius: 99, border: iReacted ? '1.5px solid var(--k-primary)' : '1px solid var(--rule)',
                    background: iReacted ? 'color-mix(in srgb, var(--k-primary) 10%, transparent)' : 'var(--bg-soft)',
                    cursor: 'pointer', fontSize: 13 }}
                  title={users.map(u => u.user_name).join(', ')}
                >
                  {emoji} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
        {/* Thread reply count */}
        {showThread && msg.reply_count > 0 && (
          <button
            onClick={() => onReplyClick?.(msg)}
            style={{ marginTop: 4, fontSize: 12, color: 'var(--k-primary)', fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'} →
          </button>
        )}
      </div>

      {/* Hover actions */}
      {hovering && (
        <div style={{ position: 'absolute', top: 2, right: 16, display: 'flex', gap: 4,
          background: 'var(--surface)', border: '1px solid var(--rule-soft)',
          borderRadius: 'var(--r-md)', padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          {showEmoji ? (
            <>
              {EMOJI_QUICK.map(e => (
                <button key={e} onClick={() => { onReact?.(msg.message_id, e); setShowEmoji(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1.2 }}>
                  {e}
                </button>
              ))}
              <button onClick={() => setShowEmoji(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)' }}>✕</button>
            </>
          ) : (
            <>
              <HoverBtn title="React" onClick={() => setShowEmoji(true)}>😊</HoverBtn>
              {!msg.parent_id && <HoverBtn title="Reply in thread" onClick={() => onReplyClick?.(msg)}>💬</HoverBtn>}
              {isMine && <HoverBtn title="Delete" onClick={() => onDelete?.(msg.message_id)} danger>🗑</HoverBtn>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HoverBtn({ children, onClick, title, danger }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
        padding: '1px 4px', borderRadius: 4, color: danger ? 'var(--danger)' : 'inherit',
        lineHeight: 1.2 }}>
      {children}
    </button>
  );
}
