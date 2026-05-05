/**
 * TaskDrawer.jsx — v2 right-slide drawer for task editing.
 * Replaces the old modal-based TaskEditor.
 * Includes custom fields panel, activity feed, time tracker, comments with @mentions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import FieldRenderer from './fields/FieldRenderer';

const PRIORITY_COLORS = { low:'#22c55e', medium:'#f59e0b', high:'#ef4444', urgent:'#dc2626' };
const PRIORITY_LABELS = { low:'Low', medium:'Medium', high:'High', urgent:'Urgent' };

export default function TaskDrawer({ taskId, open, onClose, onSaved, teamMembers = [] }) {
  const [task,    setTask]    = useState(null);
  const [fields,  setFields]  = useState([]);   // field_definitions for the team
  const [fValues, setFValues] = useState({});   // {field_id: value}
  const [comments,setComments]= useState([]);
  const [activity,setActivity]= useState([]);
  const [timer,   setTimer]   = useState(null); // running timer entry
  const [comment, setComment] = useState('');
  const [tab,     setTab]     = useState('details'); // details | activity | time
  const [saving,  setSaving]  = useState(false);
  const [draft,   setDraft]   = useState({});

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !taskId) return;
    setTab('details');
    setTask(null); setFields([]); setFValues({}); setComments([]); setActivity([]);

    Promise.all([
      api.get(`/api/tasks/${taskId}`),
      api.get(`/api/tasks/${taskId}/comments`),
      api.get(`/api/activity/task/${taskId}`),
    ]).then(([tRes, cRes, aRes]) => {
      const t = tRes.data;
      setTask(t);
      setDraft({ title: t.title, description: t.description, priority: t.priority, due_at: t.due_at });
      setComments(cRes.data);
      setActivity(aRes.data);

      // Load field definitions + values
      if (t.team_id) {
        api.get(`/api/fields/team/${t.team_id}`).then(r => {
          // Inject team members into person fields
          const defs = r.data.map(f =>
            f.type === 'person'
              ? { ...f, config: { ...f.config, members: teamMembers.map(m => ({ user_id: m.user_id, display_name: m.display_name || m.full_name || m.email })) } }
              : f
          );
          setFields(defs);
        });
        api.get(`/api/fields/task/${taskId}/values`).then(r => {
          const vals = {};
          r.data.forEach(v => { vals[v.field_id] = v.value; });
          setFValues(vals);
        });
      }
    }).catch(console.error);
  }, [open, taskId]);

  // ── Save field values ─────────────────────────────────────────────────────
  const saveFieldValue = useCallback(async (field_id, value) => {
    setFValues(prev => ({ ...prev, [field_id]: value }));
    try {
      await api.put(`/api/fields/task/${taskId}/values`, [{ field_id, value }]);
    } catch (e) { console.error('Field save failed', e); }
  }, [taskId]);

  // ── Save task core fields ─────────────────────────────────────────────────
  const saveTask = useCallback(async (patch) => {
    setSaving(true);
    try {
      const res = await api.put(`/api/tasks/${taskId}`, patch);
      setTask(res.data);
      onSaved?.(res.data);
    } catch (e) { console.error('Save failed', e); }
    finally { setSaving(false); }
  }, [taskId, onSaved]);

  // ── Post comment ──────────────────────────────────────────────────────────
  const postComment = async () => {
    if (!comment.trim()) return;
    const res = await api.post(`/api/tasks/${taskId}/comments`, { body: comment });
    setComments(prev => [...prev, res.data]);
    setComment('');
  };

  // ── Time tracking ─────────────────────────────────────────────────────────
  const startTimer = async () => {
    const res = await api.post(`/api/time/start?task_id=${taskId}`);
    setTimer(res.data);
  };
  const stopTimer = async () => {
    const res = await api.post('/api/time/stop');
    setTimer(null);
  };

  if (!open) return null;

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    overlay: { position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:200,display:'flex',justifyContent:'flex-end' },
    drawer:  { width:'min(600px,100vw)',height:'100vh',background:'var(--bg-elevated)',boxShadow:'var(--shadow-lg)',display:'flex',flexDirection:'column',overflowY:'hidden' },
    header:  { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 24px',borderBottom:'1px solid var(--border-default)',flexShrink:0 },
    body:    { flex:1,overflowY:'auto',padding:'24px' },
    label:   { fontSize:'var(--text-xs)',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6,display:'block' },
    field:   { marginBottom:20 },
    tab:     (active) => ({ padding:'6px 14px',border:'none',background:'transparent',cursor:'pointer',fontFamily:'inherit',fontSize:'var(--text-sm)',fontWeight:active?600:400,color:active?'var(--accent-default)':'var(--text-muted)',borderBottom:active?'2px solid var(--accent-default)':'2px solid transparent' }),
    btn:     (variant='primary') => ({ display:'inline-flex',alignItems:'center',gap:6,border:'none',borderRadius:'var(--radius-sm)',padding:'7px 14px',cursor:'pointer',fontFamily:'inherit',fontWeight:600,fontSize:'var(--text-sm)', ...(variant==='primary'?{background:'var(--accent-default)',color:'#fff'}:variant==='ghost'?{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border-default)'}:{background:'var(--danger-bg)',color:'var(--danger)',border:'1px solid var(--danger)'}) }),
  };

  return (
    <div style={s.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={s.drawer}>

        {/* Header */}
        <div style={s.header}>
          <div style={{ flex:1 }}>
            {task ? (
              <input
                value={draft.title || ''}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                onBlur={() => draft.title !== task.title && saveTask({ title: draft.title })}
                style={{ width:'100%',border:'none',outline:'none',fontSize:'var(--text-xl)',fontWeight:700,background:'transparent',color:'var(--text-default)',fontFamily:'inherit' }}
              />
            ) : (
              <div style={{ height:28,background:'var(--bg-muted)',borderRadius:4,width:'60%',animation:'pulse 1.5s infinite' }} />
            )}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22,color:'var(--text-muted)',marginLeft:12 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',borderBottom:'1px solid var(--border-default)',paddingLeft:24,flexShrink:0 }}>
          {[['details','Details'],['activity','Activity'],['time','Time']].map(([id,label]) => (
            <button key={id} style={s.tab(tab===id)} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={s.body}>

          {/* ── Details tab ─────────────────────────────────────────── */}
          {tab === 'details' && task && (
            <>
              {/* Meta row */}
              <div style={{ display:'flex',gap:24,flexWrap:'wrap',marginBottom:24 }}>
                {/* Priority */}
                <div style={s.field}>
                  <span style={s.label}>Priority</span>
                  <select value={draft.priority || 'medium'}
                    onChange={e => { setDraft(d=>({...d,priority:e.target.value})); saveTask({priority:e.target.value}); }}
                    style={{ border:'1px solid var(--border-default)',borderRadius:'var(--radius-sm)',padding:'4px 10px',fontFamily:'inherit',fontSize:'var(--text-sm)',background:'var(--bg-default)',color:PRIORITY_COLORS[draft.priority||'medium'],fontWeight:600,cursor:'pointer' }}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                {/* Due date */}
                <div style={s.field}>
                  <span style={s.label}>Due date</span>
                  <input type="date" value={draft.due_at?draft.due_at.slice(0,10):''}
                    onChange={e => { const v=e.target.value?new Date(e.target.value).toISOString():null; setDraft(d=>({...d,due_at:v})); saveTask({due_at:v}); }}
                    style={{ border:'1px solid var(--border-default)',borderRadius:'var(--radius-sm)',padding:'4px 8px',fontFamily:'inherit',fontSize:'var(--text-sm)',background:'var(--bg-default)',color:'var(--text-default)' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={s.field}>
                <span style={s.label}>Description</span>
                <textarea
                  value={draft.description || ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  onBlur={() => draft.description !== task.description && saveTask({ description: draft.description })}
                  rows={4}
                  style={{ width:'100%',border:'1px solid var(--border-default)',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontFamily:'inherit',fontSize:'var(--text-sm)',background:'var(--bg-default)',color:'var(--text-default)',resize:'vertical',outline:'none',lineHeight:1.6 }}
                  placeholder="Add a description…"
                />
              </div>

              {/* Custom fields */}
              {fields.length > 0 && (
                <div style={{ marginBottom:24 }}>
                  <div style={{ ...s.label, marginBottom:12 }}>Custom Fields</div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16 }}>
                    {fields.map(f => (
                      <div key={f.field_id}>
                        <span style={s.label}>{f.name}</span>
                        <FieldRenderer
                          field={f}
                          value={fValues[f.field_id] ?? null}
                          onChange={v => saveFieldValue(f.field_id, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <div style={{ ...s.label, marginBottom:12 }}>Comments</div>
                {comments.map(c => (
                  <div key={c.comment_id} style={{ display:'flex',gap:10,marginBottom:14 }}>
                    <div style={{ width:28,height:28,borderRadius:'50%',background:'var(--accent-subtle)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--text-xs)',fontWeight:700,color:'var(--accent-default)',flexShrink:0 }}>
                      {c.user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <span style={{ fontWeight:600,fontSize:'var(--text-sm)' }}>{c.user_name}</span>{' '}
                      <span style={{ color:'var(--text-subtle)',fontSize:'var(--text-xs)' }}>{new Date(c.created_at).toLocaleString()}</span>
                      <p style={{ margin:'4px 0 0',fontSize:'var(--text-sm)',lineHeight:1.5,whiteSpace:'pre-wrap' }}>{c.body}</p>
                    </div>
                  </div>
                ))}
                <div style={{ display:'flex',gap:8,marginTop:8 }}>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add a comment… (@mention a team member)"
                    rows={2}
                    style={{ flex:1,border:'1px solid var(--border-default)',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontFamily:'inherit',fontSize:'var(--text-sm)',background:'var(--bg-default)',color:'var(--text-default)',resize:'none',outline:'none' }}
                    onKeyDown={e => e.key==='Enter' && !e.shiftKey && (e.preventDefault(), postComment())}
                  />
                  <button onClick={postComment} style={s.btn()}>Send</button>
                </div>
              </div>
            </>
          )}

          {/* ── Activity tab ─────────────────────────────────────────── */}
          {tab === 'activity' && (
            <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
              {activity.length === 0 && <p style={{ color:'var(--text-muted)',fontSize:'var(--text-sm)' }}>No activity yet.</p>}
              {activity.map(evt => (
                <div key={evt.event_id} style={{ display:'flex',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border-subtle)' }}>
                  <div style={{ width:28,height:28,borderRadius:'50%',background:'var(--bg-muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0 }}>
                    {evt.type==='created'?'✨':evt.type==='status_changed'?'🔄':evt.type==='commented'?'💬':evt.type==='assigned'?'👤':evt.type==='approved'?'✅':evt.type==='rejected'?'❌':'📋'}
                  </div>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:600,fontSize:'var(--text-sm)' }}>{evt.actor_name || 'System'}</span>{' '}
                    <span style={{ color:'var(--text-muted)',fontSize:'var(--text-sm)' }}>{evt.type.replace(/_/g,' ')}</span>
                    {evt.data?.from && <span style={{ color:'var(--text-subtle)',fontSize:'var(--text-xs)',marginLeft:6 }}>({evt.data.from} → {evt.data.to})</span>}
                    <div style={{ color:'var(--text-subtle)',fontSize:'var(--text-xs)',marginTop:2 }}>{new Date(evt.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Time tab ─────────────────────────────────────────────── */}
          {tab === 'time' && (
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:24 }}>
                {timer ? (
                  <button onClick={stopTimer} style={s.btn('danger')}>⏹ Stop Timer</button>
                ) : (
                  <button onClick={startTimer} style={s.btn()}>▶ Start Timer</button>
                )}
                {timer && <span style={{ color:'var(--text-muted)',fontSize:'var(--text-sm)' }}>Timer running…</span>}
              </div>
              <p style={{ color:'var(--text-muted)',fontSize:'var(--text-sm)' }}>Time entries for this task appear here. Use the Time Report page for full details.</p>
            </div>
          )}

          {/* Loading skeleton */}
          {!task && (
            <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
              {[60,40,80,40].map((w,i) => (
                <div key={i} style={{ height:16,background:'var(--bg-muted)',borderRadius:4,width:`${w}%` }} />
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px',borderTop:'1px solid var(--border-default)',display:'flex',justifyContent:'flex-end',flexShrink:0 }}>
          {saving && <span style={{ color:'var(--text-muted)',fontSize:'var(--text-sm)',marginRight:'auto' }}>Saving…</span>}
          <button onClick={onClose} style={s.btn('ghost')}>Close</button>
        </div>

      </div>
    </div>
  );
}
