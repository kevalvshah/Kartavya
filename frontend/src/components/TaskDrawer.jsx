import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import FieldRenderer from './fields/FieldRenderer';
import MentionTextarea from './MentionTextarea';
import ActivityList from './ActivityList';

const PRIORITY_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

function fmtMinutes(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const base = Date.now() - new Date(startedAt).getTime();
    setElapsed(base);
    const id = setInterval(() => setElapsed(Date.now() - new Date(startedAt).getTime()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const s = Math.floor(elapsed / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{h ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}</span>;
}

export default function TaskDrawer({ taskId, open, onClose, onSaved, teamMembers = [] }) {
  const [task,       setTask]       = useState(null);
  const [fields,     setFields]     = useState([]);
  const [fValues,    setFValues]    = useState({});
  const [comments,   setComments]   = useState([]);
  const [activity,   setActivity]   = useState([]);
  const [actLoad,    setActLoad]    = useState(false);
  const [entries,    setEntries]    = useState([]);
  const [timer,      setTimer]      = useState(null);
  const [comment,    setComment]    = useState('');
  const [tab,        setTab]        = useState('details');
  const [saving,     setSaving]     = useState(false);
  const [draft,      setDraft]      = useState({});
  const [manualMin,  setManualMin]  = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const mentionMembers = teamMembers.map(m => ({
    user_id:      m.user_id,
    display_name: m.display_name || m.full_name || m.email || 'Unknown',
  }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !taskId) return;
    setTab('details');
    setTask(null); setFields([]); setFValues({});
    setComments([]); setActivity([]); setEntries([]); setTimer(null);

    Promise.all([
      api.get(`/tasks/${taskId}`),
      api.get(`/tasks/${taskId}/comments`),
    ]).then(([tRes, cRes]) => {
      const t = tRes.data;
      setTask(t);
      setDraft({ title: t.title, description: t.description, priority: t.priority, due_at: t.due_at });
      setComments(cRes.data);
      if (t.team_id) {
        api.get(`/fields/team/${t.team_id}`).then(r => {
          const defs = r.data.map(f =>
            f.type === 'person'
              ? { ...f, config: { ...f.config, members: mentionMembers } }
              : f
          );
          setFields(defs);
        });
        api.get(`/fields/task/${taskId}/values`).then(r => {
          const vals = {};
          r.data.forEach(v => { vals[v.field_id] = v.value; });
          setFValues(vals);
        });
      }
    }).catch(console.error);
  }, [open, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'activity' || !taskId) return;
    setActLoad(true);
    api.get(`/activity/task/${taskId}`)
       .then(r => setActivity(r.data))
       .catch(console.error)
       .finally(() => setActLoad(false));
  }, [tab, taskId]);

  useEffect(() => {
    if (tab !== 'time' || !taskId) return;
    api.get(`/time/task/${taskId}`)
       .then(r => { setEntries(r.data.entries || []); setTimer(r.data.active_entry || null); })
       .catch(console.error);
  }, [tab, taskId]);

  const saveFieldValue = useCallback(async (field_id, value) => {
    setFValues(prev => ({ ...prev, [field_id]: value }));
    try { await api.put(`/fields/task/${taskId}/values`, [{ field_id, value }]); }
    catch (e) { console.error('Field save failed', e); }
  }, [taskId]);

  const saveTask = useCallback(async (patch) => {
    setSaving(true);
    try {
      const res = await api.put(`/tasks/${taskId}`, patch);
      setTask(res.data);
      onSaved?.(res.data);
    } catch (e) { console.error('Save failed', e); }
    finally { setSaving(false); }
  }, [taskId, onSaved]);

  const postComment = async () => {
    if (!comment.trim()) return;
    const res = await api.post(`/tasks/${taskId}/comments`, { body: comment });
    setComments(prev => [...prev, res.data]);
    setComment('');
  };

  const startTimer = async () => {
    const res = await api.post(`/time/start?task_id=${taskId}`);
    setTimer(res.data);
  };
  const stopTimer = async () => {
    const res = await api.post('/time/stop');
    setTimer(null);
    setEntries(prev => [res.data, ...prev]);
  };
  const addManual = async () => {
    const mins = parseInt(manualMin);
    if (!mins || mins < 1) return;
    const res = await api.post('/time/manual', { task_id: taskId, minutes: mins, description: manualDesc });
    setEntries(prev => [res.data, ...prev]);
    setManualMin(''); setManualDesc('');
  };
  const deleteEntry = async (id) => {
    await api.delete(`/time/${id}`);
    setEntries(prev => prev.filter(e => e.entry_id !== id));
  };

  if (!open) return null;

  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6, display: 'block' };

  return (
    <div className="k-dr-scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="k-dr">

        {/* Header */}
        <div className="k-dr__head">
          <div style={{ flex: 1 }}>
            {task ? (
              <input
                value={draft.title || ''}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                onBlur={() => draft.title !== task.title && saveTask({ title: draft.title })}
                style={{ width: '100%', border: 'none', outline: 'none', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, background: 'transparent', color: 'var(--ink)' }}
              />
            ) : (
              <div style={{ height: 28, background: 'var(--rule-soft)', borderRadius: 4, width: '60%' }} />
            )}
            {task && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                #{task.task_id?.toString().slice(-6)}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-3)', marginLeft: 12, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div className="k-dr__tabs">
          {[['details', 'Details'], ['activity', 'Activity'], ['time', 'Time']].map(([id, label]) => (
            <button key={id} className={`k-dr__tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="k-dr__body">
          {tab === 'details' && task && (
            <>
              {/* Meta row */}
              <div className="k-dr__props">
                <div>
                  <span style={lbl}>Priority</span>
                  <select
                    value={draft.priority || 'medium'}
                    onChange={e => { setDraft(d => ({ ...d, priority: e.target.value })); saveTask({ priority: e.target.value }); }}
                    className="k-input"
                    style={{ color: PRIORITY_COLORS[draft.priority || 'medium'], fontWeight: 600 }}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <span style={lbl}>Due date</span>
                  <input
                    type="date"
                    className="k-input"
                    value={draft.due_at ? draft.due_at.slice(0, 10) : ''}
                    onChange={e => { const v = e.target.value ? new Date(e.target.value).toISOString() : null; setDraft(d => ({ ...d, due_at: v })); saveTask({ due_at: v }); }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 20 }}>
                <span style={lbl}>Description</span>
                <textarea
                  className="k-input"
                  value={draft.description || ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  onBlur={() => draft.description !== task.description && saveTask({ description: draft.description })}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', lineHeight: 1.6 }}
                  placeholder="Add a description…"
                />
              </div>

              {/* Custom Fields */}
              {fields.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <span style={{ ...lbl, marginBottom: 12 }}>Custom Fields</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
                    {fields.map(f => (
                      <div key={f.field_id}>
                        <span style={lbl}>{f.name}</span>
                        <FieldRenderer field={f} value={fValues[f.field_id] ?? null} onChange={v => saveFieldValue(f.field_id, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <span style={{ ...lbl, marginBottom: 12 }}>Comments</span>
                {comments.map(c => (
                  <div key={c.comment_id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'color-mix(in srgb, var(--k-primary) 15%, var(--surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--k-primary)', flexShrink: 0 }}>
                      {c.user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name}</span>{' '}
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
                      <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {c.body.split(/(@[\w.-]+)/g).map((part, i) =>
                          part.startsWith('@')
                            ? <strong key={i} style={{ color: 'var(--k-primary)' }}>{part}</strong>
                            : part
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <MentionTextarea value={comment} onChange={setComment} onSubmit={postComment}
                    members={mentionMembers} placeholder="Add a comment… type @ to mention someone" rows={2} />
                  <button onClick={postComment} className="k-btn k-btn--primary k-btn--sm">Send</button>
                </div>
              </div>
            </>
          )}

          {tab === 'activity' && <ActivityList events={activity} loading={actLoad} />}

          {tab === 'time' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                {timer ? (
                  <>
                    <button onClick={stopTimer} className="k-btn" style={{ background: 'var(--k-danger)', color: '#fff', border: 'none' }}>⏹ Stop</button>
                    <span style={{ color: 'var(--ink-3)', fontSize: 13 }}><ElapsedTimer startedAt={timer.started_at} /></span>
                  </>
                ) : (
                  <button onClick={startTimer} className="k-btn k-btn--primary k-btn--sm">▶ Start Timer</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
                <input type="number" min="1" value={manualMin} onChange={e => setManualMin(e.target.value)}
                  placeholder="mins" className="k-input" style={{ width: 70 }} />
                <input value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                  placeholder="Description (optional)" className="k-input" style={{ flex: 1 }} />
                <button onClick={addManual} className="k-btn k-btn--ghost k-btn--sm">+ Log</button>
              </div>
              {entries.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No time logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {entries.map(e => (
                    <div key={e.entry_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--rule-soft)', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-3)' }}>{e.description || 'No description'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong>{fmtMinutes(e.minutes)}</strong>
                        <button onClick={() => deleteEntry(e.entry_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14 }}>×</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, paddingTop: 8 }}>
                    Total: {fmtMinutes(entries.reduce((sum, e) => sum + (e.minutes || 0), 0))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!task && tab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[60, 40, 80, 40].map((w, i) => (
                <div key={i} style={{ height: 16, background: 'var(--rule-soft)', borderRadius: 4, width: `${w}%` }} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0, background: 'var(--bg-soft)' }}>
          {saving && <span style={{ color: 'var(--ink-3)', fontSize: 12, marginRight: 'auto' }}>Saving…</span>}
          <button onClick={onClose} className="k-btn k-btn--ghost k-btn--sm">Close</button>
        </div>
      </div>
    </div>
  );
}
