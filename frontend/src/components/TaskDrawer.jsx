/**
 * TaskDrawer.jsx — v2 right-slide drawer.
 * Week 2 upgrade: @mention autocomplete, ActivityList, real time entries.
 */
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
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{h ? `${h}:` : ''}{String(m).padStart(2,'0')}:{String(sec).padStart(2,'0')}</span>;
}

export default function TaskDrawer({ taskId, open, onClose, onSaved, teamMembers = [] }) {
  const [task,     setTask]     = useState(null);
  const [fields,   setFields]   = useState([]);
  const [fValues,  setFValues]  = useState({});
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [actLoad,  setActLoad]  = useState(false);
  const [entries,  setEntries]  = useState([]);
  const [timer,    setTimer]    = useState(null);
  const [comment,  setComment]  = useState('');
  const [tab,      setTab]      = useState('details');
  const [saving,   setSaving]   = useState(false);
  const [draft,    setDraft]    = useState({});
  const [manualMin,setManualMin]= useState('');
  const [manualDesc,setManualDesc]=useState('');

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

  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' },
    drawer:  { width: 'min(600px,100vw)', height: '100vh', background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' },
    header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 },
    body:    { flex: 1, overflowY: 'auto', padding: '24px' },
    label:   { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' },
    field:   { marginBottom: 20 },
    tab:     (active) => ({ padding: '6px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: active ? 600 : 400, color: active ? 'var(--accent-default)' : 'var(--text-muted)', borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent' }),
    btn:     (v = 'primary') => ({ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 'var(--radius-sm)', padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 'var(--text-sm)', ...(v === 'primary' ? { background: 'var(--accent-default)', color: '#fff' } : v === 'ghost' ? { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-default)' } : { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }) }),
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.drawer}>
        <div style={s.header}>
          <div style={{ flex: 1 }}>
            {task ? (
              <input value={draft.title || ''}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                onBlur={() => draft.title !== task.title && saveTask({ title: draft.title })}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 'var(--text-xl)', fontWeight: 700, background: 'transparent', color: 'var(--text-default)', fontFamily: 'inherit' }}
              />
            ) : (
              <div style={{ height: 28, background: 'var(--bg-muted)', borderRadius: 4, width: '60%' }} />
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)', marginLeft: 12 }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', paddingLeft: 24, flexShrink: 0 }}>
          {[['details','Details'],['activity','Activity'],['time','Time']].map(([id,label]) => (
            <button key={id} style={s.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div style={s.body}>
          {tab === 'details' && task && (
            <>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
                <div style={s.field}>
                  <span style={s.label}>Priority</span>
                  <select value={draft.priority || 'medium'}
                    onChange={e => { setDraft(d => ({ ...d, priority: e.target.value })); saveTask({ priority: e.target.value }); }}
                    style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: PRIORITY_COLORS[draft.priority || 'medium'], fontWeight: 600, cursor: 'pointer' }}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <span style={s.label}>Due date</span>
                  <input type="date" value={draft.due_at ? draft.due_at.slice(0,10) : ''}
                    onChange={e => { const v = e.target.value ? new Date(e.target.value).toISOString() : null; setDraft(d => ({ ...d, due_at: v })); saveTask({ due_at: v }); }}
                    style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)' }}
                  />
                </div>
              </div>

              <div style={s.field}>
                <span style={s.label}>Description</span>
                <textarea value={draft.description || ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  onBlur={() => draft.description !== task.description && saveTask({ description: draft.description })}
                  rows={4}
                  style={{ width: '100%', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)', resize: 'vertical', outline: 'none', lineHeight: 1.6 }}
                  placeholder="Add a description…"
                />
              </div>

              {fields.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ ...s.label, marginBottom: 12 }}>Custom Fields</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
                    {fields.map(f => (
                      <div key={f.field_id}>
                        <span style={s.label}>{f.name}</span>
                        <FieldRenderer field={f} value={fValues[f.field_id] ?? null} onChange={v => saveFieldValue(f.field_id, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ ...s.label, marginBottom: 12 }}>Comments</div>
                {comments.map(c => (
                  <div key={c.comment_id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--accent-default)', flexShrink: 0 }}>
                      {c.user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{c.user_name}</span>{' '}
                      <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{new Date(c.created_at).toLocaleString()}</span>
                      <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {c.body.split(/(@[\w.-]+)/g).map((part, i) =>
                          part.startsWith('@')
                            ? <strong key={i} style={{ color: 'var(--accent-default)' }}>{part}</strong>
                            : part
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <MentionTextarea value={comment} onChange={setComment} onSubmit={postComment}
                    members={mentionMembers} placeholder="Add a comment… type @ to mention someone" rows={2} />
                  <button onClick={postComment} style={s.btn()}>Send</button>
                </div>
              </div>
            </>
          )}

          {tab === 'activity' && <ActivityList events={activity} loading={actLoad} />}

          {tab === 'time' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                {timer ? (
                  <><button onClick={stopTimer} style={s.btn('danger')}>⏹ Stop</button>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}><ElapsedTimer startedAt={timer.started_at} /></span>
                  </>
                ) : (
                  <button onClick={startTimer} style={s.btn()}>▶ Start Timer</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
                <input type="number" min="1" value={manualMin} onChange={e => setManualMin(e.target.value)}
                  placeholder="mins" style={{ width: 70, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)' }} />
                <input value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                  placeholder="Description (optional)"
                  style={{ flex: 1, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--bg-default)', color: 'var(--text-default)' }} />
                <button onClick={addManual} style={s.btn('ghost')}>+ Log</button>
              </div>
              {entries.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No time logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {entries.map(e => (
                    <div key={e.entry_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{e.description || 'No description'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong>{fmtMinutes(e.minutes)}</strong>
                        <button onClick={() => deleteEntry(e.entry_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 14 }}>×</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)', paddingTop: 8 }}>
                    Total: {fmtMinutes(entries.reduce((sum, e) => sum + (e.minutes || 0), 0))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!task && tab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[60,40,80,40].map((w,i) => (
                <div key={i} style={{ height: 16, background: 'var(--bg-muted)', borderRadius: 4, width: `${w}%` }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          {saving && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginRight: 'auto' }}>Saving…</span>}
          <button onClick={onClose} style={s.btn('ghost')}>Close</button>
        </div>
      </div>
    </div>
  );
}

