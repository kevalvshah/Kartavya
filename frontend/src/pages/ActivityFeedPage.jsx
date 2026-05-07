/**
 * ActivityFeedPage.jsx — Project-level activity feed.
 * Week 2: actor filter, load-more pagination, uses ActivityList.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import ActivityList from '../components/ActivityList';

const EVENT_TYPES = [
  { value: '',               label: 'All events' },
  { value: 'status_changed', label: 'Status changes' },
  { value: 'commented',      label: 'Comments' },
  { value: 'assigned',       label: 'Assignments' },
  { value: 'approved',       label: 'Approvals' },
  { value: 'field_changed',  label: 'Field changes' },
  { value: 'created',        label: 'Created' },
  { value: 'time_logged',    label: 'Time logged' },
];

const LIMIT = 50;

export default function ActivityFeedPage({ teamId }) {
  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [hasMore,    setHasMore]    = useState(false);
  const [offset,     setOffset]     = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterActor,setFilterActor]= useState('');
  const [members,    setMembers]    = useState([]);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    api.get(`/teams/${teamId}`)
       .then(r => setMembers(r.data.members || []))
       .catch(() => {});
  }, [teamId]);

  const load = useCallback(async (reset = true) => {
    if (!teamId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const off = reset ? 0 : offset;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const params = { limit: LIMIT, offset: off };
      if (filterType)  params.event_type = filterType;
      if (filterActor) params.actor_id   = filterActor;
      const r = await api.get(`/activity/team/${teamId}`, { params, signal: ctrl.signal });
      const data = r.data;
      setEvents(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === LIMIT);
      setOffset(off + data.length);
    } catch (e) {
      if (e.name !== 'CanceledError' && e.name !== 'AbortError') console.error(e);
    } finally {
      reset ? setLoading(false) : setLoadingMore(false);
    }
  }, [teamId, filterType, filterActor]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true); }, [teamId, filterType, filterActor]);

  const sel = {
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    padding: '6px 10px', fontFamily: 'inherit', fontSize: 'var(--text-sm)',
    background: 'var(--bg-default)', color: 'var(--text-default)', cursor: 'pointer',
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>📋 Activity Feed</h1>
        <button onClick={() => load(true)} style={{ ...sel, fontWeight: 600 }}>↻ Refresh</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={sel}>
          {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterActor} onChange={e => setFilterActor(e.target.value)} style={sel}>
          <option value=''>All members</option>
          {members.map(m => (
            <option key={m.user_id || m.email} value={m.user_id || ''}>
              {m.display_name || m.full_name || m.email}
            </option>
          ))}
        </select>
      </div>
      <ActivityList events={events} loading={loading} showTask />
      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-5)' }}>
          <button onClick={() => load(false)} disabled={loadingMore}
            style={{ ...sel, fontWeight: 600, minWidth: 120 }}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

