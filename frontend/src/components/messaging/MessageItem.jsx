import React, { useState, useEffect } from 'react';
import { currentUser } from '../../lib/auth';
import { api } from '../../lib/api';

const isImage = (name) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name || '');

function AttachmentList({ attachments }) {
  if (!attachments?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
      {attachments.map((a, i) => (
        isImage(a.name) ? (
          <a key={i} href={a.url} target="_blank" rel="noreferrer">
            <img src={a.url} alt={a.name}
              style={{ maxWidth: 200, maxHeight: 160, borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', objectFit: 'cover', display: 'block' }} />
          </a>
        ) : (
          <a key={i} href={a.url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', background: 'var(--bg-soft)',
              color: 'var(--ink-2)', textDecoration: 'none', fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4"/></svg>
            {a.name}
          </a>
        )
      ))}
    </div>
  );
}

function TaskUnfurl({ taskData }) {
  const STATUS_COLOR = { todo: '#6366f1', in_progress: '#f59e0b', done: '#10b981', blocked: '#ef4444', review: '#8b5cf6' };
  const color = STATUS_COLOR[taskData.status] || '#6E7B91';
  return (
    <a href={`/tasks/${taskData.task_id}`} style={{ display: 'block', marginTop: 6, padding: '8px 12px',
      borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', background: 'var(--bg-soft)',
      textDecoration: 'none', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 2 }}>TASK</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{taskData.title}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
        {taskData.status?.replace('_', ' ')}{taskData.assignee_name && ` · ${taskData.assignee_name}`}
      </div>
    </a>
  );
}

function LinkUnfurl({ data }) {
  return (
    <a href={data.url} target="_blank" rel="noreferrer"
      style={{ display: 'block', marginTop: 6, padding: '8px 12px', borderRadius: 'var(--r-md)',
        border: '1px solid var(--rule)', background: 'var(--bg-soft)', textDecoration: 'none',
        borderLeft: `3px solid ${data.color || 'var(--rule)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 14 }}>{data.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: data.color || 'var(--ink-3)' }}>
          {data.brand}
        </span>
      </div>
      {data.title && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{data.title}</div>}
      {data.description && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{data.description}</div>
      )}
    </a>
  );
}

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
  const meta = msg.metadata || {};
  const msgAttachments = meta.attachments || [];

  // Link unfurl: Kartavya task links + branded services (Figma, Loom, GitHub, Docs…)
  const [unfurled, setUnfurled] = useState(null);
  useEffect(() => {
    if (!msg.body) return;
    // Find first URL in message
    const urlMatch = msg.body.match(/https?:\/\/[^\s]+/);
    const taskMatch = msg.body.match(/\/tasks?\/([a-zA-Z0-9_-]+)/);
    const target = urlMatch?.[0] || (taskMatch ? taskMatch[0] : null);
    if (!target) return;
    api.get(`/messages/unfurl?url=${encodeURIComponent(target)}`)
      .then(r => { if (r.data.type === 'task' || r.data.brand) setUnfurled(r.data); })
      .catch(() => {});
  }, [msg.body]);

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
        {/* Attachments */}
        <AttachmentList attachments={msgAttachments} />
        {/* Task / link unfurl */}
        {unfurled && unfurled.type === 'task' && <TaskUnfurl taskData={unfurled} />}
        {unfurled && unfurled.type === 'link' && unfurled.brand && <LinkUnfurl data={unfurled} />}
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
