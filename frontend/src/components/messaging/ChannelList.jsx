import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../ui/toast';

function UnreadDot({ count }) {
  if (!count) return null;
  return (
    <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 99,
      background: 'var(--k-primary)', color: '#fff', fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function ChannelList({ channels, activeId, onSelect, onReload }) {
  const { pushToast } = useToast();
  const [showDmInput, setShowDmInput]       = useState(false);
  const [dmQuery, setDmQuery]               = useState('');
  const [dmSuggestions, setDmSuggestions]   = useState([]);
  const [dmLoading, setDmLoading]           = useState(false);
  const [search, setSearch]                 = useState('');
  const searchTimer = useRef(null);

  const filtered = search.trim()
    ? channels.filter(c => {
        const label = c.name || c.project_name || '';
        return label.toLowerCase().includes(search.toLowerCase());
      })
    : channels;

  const projectChannels = filtered.filter(c => c.type === 'project');
  const dmChannels      = filtered.filter(c => c.type === 'dm');

  // Debounced name search
  const handleDmQueryChange = useCallback((e) => {
    const q = e.target.value;
    setDmQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setDmSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setDmLoading(true);
      try {
        const r = await api.get('/channels/dm/search-users', { params: { q } });
        setDmSuggestions(Array.isArray(r.data) ? r.data : []);
      } catch { setDmSuggestions([]); }
      finally { setDmLoading(false); }
    }, 250);
  }, []);

  const startDmWithUser = async (u) => {
    try {
      const r = await api.post('/channels/dm-by-email', { email: u.email });
      setDmQuery(''); setDmSuggestions([]); setShowDmInput(false);
      onReload?.();
      onSelect?.(r.data.channel_id);
    } catch (e) {
      pushToast({ type: 'error', title: e?.response?.data?.detail || 'Could not start DM' });
    }
  };

  // Close suggestions when clicking outside
  const dmRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (dmRef.current && !dmRef.current.contains(e.target)) setDmSuggestions([]); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ChannelItem = ({ ch, icon }) => {
    const isActive = ch.channel_id === activeId;
    const label = ch.type === 'dm'
      ? (ch.name || 'Direct Message')
      : `#​${ch.name || ch.project_name || 'channel'}`;
    return (
      <button
        onClick={() => onSelect?.(ch.channel_id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', border: 'none', textAlign: 'left', cursor: 'pointer',
          borderRadius: 'var(--r-md)', marginBottom: 1,
          background: isActive ? 'color-mix(in srgb, var(--k-primary) 14%, transparent)' : 'transparent',
          color: isActive ? 'var(--k-primary)' : ch.unread_count ? 'var(--ink)' : 'var(--ink-2)',
          fontWeight: ch.unread_count ? 700 : isActive ? 600 : 400,
          fontSize: 13,
        }}
      >
        <span style={{ opacity: 0.7, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <UnreadDot count={ch.unread_count} />
      </button>
    );
  };

  const SectionHead = ({ label, sans, action }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 12px 4px', color: 'var(--ink-3)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label} <span style={{ fontFamily: 'var(--font-hindi)', fontWeight: 400, letterSpacing: 0, textTransform: 'none', fontSize: 11 }}>{sans}</span>
      </div>
      {action}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '16px 12px 8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>Messages</div>
        <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: 'var(--k-primary)', marginBottom: 10 }}>संवाद</div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search channels…"
          style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--rule)', background: 'var(--bg-soft)', outline: 'none',
            color: 'var(--ink)', boxSizing: 'border-box' }}
        />
      </div>

      <SectionHead label="Channels" sans="चैनल" />
      {projectChannels.length === 0 && (
        <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
          No project channels yet
        </div>
      )}
      {projectChannels.map(ch => <ChannelItem key={ch.channel_id} ch={ch} icon="#" />)}

      <SectionHead
        label="Direct Messages" sans="संदेश"
        action={
          <button onClick={() => { setShowDmInput(v => !v); setDmQuery(''); setDmSuggestions([]); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)', lineHeight: 1, padding: 0 }}>
            +
          </button>
        }
      />
      {showDmInput && (
        <div ref={dmRef} style={{ padding: '4px 12px 8px', position: 'relative' }}>
          <input
            className="k-input"
            value={dmQuery}
            onChange={handleDmQueryChange}
            placeholder="Search by name…"
            style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
            autoFocus
          />
          {(dmSuggestions.length > 0 || dmLoading) && (
            <div style={{
              position: 'absolute', top: '100%', left: 12, right: 12, zIndex: 100,
              background: 'var(--surface)', border: '1px solid var(--rule)',
              borderRadius: 'var(--r-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}>
              {dmLoading && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink-3)' }}>Searching…</div>
              )}
              {dmSuggestions.map(u => (
                <button
                  key={u.user_id}
                  onClick={() => startDmWithUser(u)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', border: 'none', background: 'transparent',
                    cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-soft)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--k-primary)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                </button>
              ))}
              {!dmLoading && dmSuggestions.length === 0 && dmQuery.trim() && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                  No teammates found
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {dmChannels.map(ch => <ChannelItem key={ch.channel_id} ch={ch} icon="💬" />)}

      {channels.length === 0 && (
        <div style={{ padding: '24px 12px', fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center' }}>
          Channels appear here when you join a project.
        </div>
      )}
    </div>
  );
}
