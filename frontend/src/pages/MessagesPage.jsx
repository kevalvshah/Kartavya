/**
 * MessagesPage.jsx — /messages · संवाद
 * Full-view: channel list left rail + message thread main area.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChannels } from '../hooks/useChannels';
import { useMessages } from '../hooks/useMessages';
import ChannelList from '../components/messaging/ChannelList';
import MessageThread from '../components/messaging/MessageThread';
import MessageItem from '../components/messaging/MessageItem';
import { api } from '../lib/api';

function generateMeetUrl() {
  const seg = () => Array.from({ length: 3 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
  return `https://meet.google.com/${seg()}-${seg()}-${seg()}`;
}

export default function MessagesPage() {
  const { channelId: paramChannelId } = useParams();
  const navigate = useNavigate();
  const { channels, loading: chLoading, reload: reloadChannels, markRead } = useChannels();
  const [activeChannelId, setActiveChannelId] = useState(paramChannelId || null);

  // Auto-select first channel if none active
  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].channel_id);
    }
  }, [channels, activeChannelId]);

  // Sync URL → state
  useEffect(() => {
    if (paramChannelId) setActiveChannelId(paramChannelId);
  }, [paramChannelId]);

  const selectChannel = (id) => {
    setActiveChannelId(id);
    navigate(`/messages/${id}`, { replace: true });
    markRead(id);
  };

  const { messages, loading: msgLoading, hasMore, send, loadMore, react, deleteMsg } = useMessages(activeChannelId);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searchLoading, setSearchLoading] = useState(false);

  const runSearch = useCallback(async (q) => {
    if (!activeChannelId || !q.trim()) { setSearchResults(null); return; }
    setSearchLoading(true);
    try {
      const r = await api.get(`/channels/${activeChannelId}/search`, { params: { q } });
      setSearchResults(Array.isArray(r.data) ? r.data : []);
    } catch (_) { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, [activeChannelId]);

  // Reset search when channel changes
  useEffect(() => { setSearchQuery(''); setSearchResults(null); }, [activeChannelId]);

  const startMeet = async () => {
    const url = generateMeetUrl();
    await send(`📹 Google Meet: ${url}`);
  };

  const activeChannel = channels.find(c => c.channel_id === activeChannelId);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Left rail — channel list */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--rule-soft)',
        background: 'var(--surface)', overflowY: 'auto' }}>
        <ChannelList
          channels={channels}
          activeId={activeChannelId}
          onSelect={selectChannel}
          onReload={reloadChannels}
        />
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        {activeChannelId ? (
          <>
            {/* Channel header */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--rule-soft)',
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--surface)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {activeChannel?.type === 'dm'
                    ? activeChannel?.name || 'Direct Message'
                    : `# ${activeChannel?.name || activeChannel?.project_name || 'channel'}`}
                </div>
                {activeChannel?.type === 'project' && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-hindi)' }}>परियोजना चैनल</div>
                )}
              </div>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runSearch(searchQuery); if (e.key === 'Escape') { setSearchQuery(''); setSearchResults(null); } }}
                  placeholder="Search messages…"
                  style={{ fontSize: 12, padding: '5px 10px', borderRadius: 'var(--r-md)',
                    border: '1px solid var(--rule)', background: 'var(--bg-soft)',
                    outline: 'none', width: 160, color: 'var(--ink)' }}
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 0 }}>
                    ✕
                  </button>
                )}
              </div>
              {/* Google Meet */}
              <button onClick={startMeet} title="Start Google Meet"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                  border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', background: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#0F9D58' }}>
                📹 Meet
              </button>
            </div>

            {/* Search results overlay */}
            {searchResults !== null && (
              <div style={{ borderBottom: '1px solid var(--rule-soft)', background: 'var(--bg-soft)',
                maxHeight: 320, overflowY: 'auto', flexShrink: 0 }}>
                <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--ink-3)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{searchLoading ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`}</span>
                </div>
                {searchResults.length === 0 && !searchLoading && (
                  <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic' }}>No messages found.</div>
                )}
                {searchResults.map(msg => (
                  <MessageItem key={msg.message_id} msg={msg} showThread={false} />
                ))}
              </div>
            )}

            {/* Messages */}
            <MessageThread
              channelId={activeChannelId}
              messages={messages}
              loading={msgLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSend={async (body, parentId) => {
                await send(body, parentId);
                markRead(activeChannelId);
              }}
              onReact={react}
              onDelete={deleteMsg}
            />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 4 }}>
              {chLoading ? 'Loading…' : 'Select a channel'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
              {chLoading ? '' : 'Choose a channel from the left to start messaging.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
