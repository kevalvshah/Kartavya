import React, { useEffect, useRef, useState } from 'react';
import MessageItem from './MessageItem';
import MessageComposer from './MessageComposer';
import { api } from '../../lib/api';

export default function MessageThread({ channelId, messages, loading, hasMore, onLoadMore, onSend, onReact, onDelete }) {
  const bottomRef = useRef();
  const listRef   = useRef();
  const [threadMsg, setThreadMsg] = useState(null); // message whose thread is open
  const [replies, setReplies]     = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const openThread = async (msg) => {
    setThreadMsg(msg);
    setRepliesLoading(true);
    try {
      const r = await api.get(`/channels/${channelId}/messages/${msg.message_id}/replies`);
      setReplies(Array.isArray(r.data) ? r.data : []);
    } catch (_) { setReplies([]); }
    finally { setRepliesLoading(false); }
  };

  const sendReply = async (body) => {
    await onSend(body, threadMsg.message_id);
    // Reload replies
    const r = await api.get(`/channels/${channelId}/messages/${threadMsg.message_id}/replies`);
    setReplies(Array.isArray(r.data) ? r.data : []);
  };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Main thread */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {hasMore && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <button className="k-btn k-btn--ghost k-btn--sm" onClick={onLoadMore}>Load older messages</button>
            </div>
          )}
          {loading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ padding: '60px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 15, fontFamily: 'var(--font-display)', color: 'var(--ink-2)', marginBottom: 4 }}>
                No messages yet
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Be the first to say something.</div>
            </div>
          ) : (
            messages.map(msg => (
              <MessageItem
                key={msg.message_id}
                msg={msg}
                onReact={onReact}
                onDelete={onDelete}
                onReplyClick={openThread}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <MessageComposer onSend={(body, meta) => onSend(body, null, meta)} placeholder="Message the channel… (Enter to send)" />
      </div>

      {/* Thread drawer */}
      {threadMsg && (
        <div style={{ width: 320, borderLeft: '1px solid var(--rule-soft)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)' }}>
                Thread · धागा
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                {threadMsg.sender_name}
              </div>
            </div>
            <button onClick={() => setThreadMsg(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)', lineHeight: 1 }}>
              ✕
            </button>
          </div>
          {/* Parent message */}
          <div style={{ padding: '8px 0', borderBottom: '1px solid var(--rule-soft)', background: 'var(--bg-soft)' }}>
            <MessageItem msg={threadMsg} showThread={false} />
          </div>
          {/* Replies */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {repliesLoading ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>Loading…</div>
            ) : replies.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic' }}>No replies yet</div>
            ) : (
              replies.map(r => <MessageItem key={r.message_id} msg={r} showThread={false} />)
            )}
          </div>
          <MessageComposer onSend={sendReply} placeholder="Reply…" compact />
        </div>
      )}
    </div>
  );
}
