/**
 * MessagesPage.jsx — /messages · संवाद
 * Full-view: channel list left rail + message thread main area.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChannels } from '../hooks/useChannels';
import { useMessages } from '../hooks/useMessages';
import ChannelList from '../components/messaging/ChannelList';
import MessageThread from '../components/messaging/MessageThread';

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
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule-soft)',
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--surface)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {activeChannel?.type === 'dm'
                    ? activeChannel?.name || 'Direct Message'
                    : `# ${activeChannel?.name || activeChannel?.project_name || 'channel'}`}
                </div>
                {activeChannel?.type === 'project' && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-hindi)' }}>
                    परियोजना चैनल
                  </div>
                )}
              </div>
            </div>

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
