/**
 * ActivityFeedPage.jsx — k-* design system.
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
  const [events,      setEvents]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [offset,      setOffset]      = useState(0);
  const [filterType,  setFilterType]  = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [members,     setMembers]     = useState([]);
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

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">Activity</h1>
        <span className="k-pageh__sans">गतिविधि</span>
        <div className="k-pageh__actions">
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => load(true)}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76M14 2v4h-4"/></svg>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
        <select className="k-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
          {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="k-select" value={filterActor} onChange={e => setFilterActor(e.target.value)}>
          <option value=''>All members</option>
          {members.map(m => (
            <option key={m.user_id || m.email} value={m.user_id || ''}>
              {m.display_name || m.full_name || m.email}
            </option>
          ))}
        </select>
      </div>

      <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
        <ActivityList events={events} loading={loading} showTask />
      </div>

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 'var(--sp-5)' }}>
          <button className="k-btn k-btn--ghost" onClick={() => load(false)} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
