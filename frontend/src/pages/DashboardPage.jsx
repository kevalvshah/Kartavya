/**
 * DashboardPage.jsx — real-data dashboard matching the design handoff.
 * Greeting · week strip · stat cards · On your plate · Upcoming · Status · Team pulse
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';

// ── Constants ─────────────────────────────────────────────────────────────────
const WEEK_EN  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEK_HI  = ['सोम','मंगल','बुध','गुरु','शुक्र','शनि','रवि'];
const VIKRAM_MONTHS = ['Chaitra','Vaishākha','Jyēṣṭha','Āṣāḍha','Śrāvaṇa','Bhādra','Āśvina','Kārtika','Mārgaśīrṣa','Pauṣa','Māgha','Phālguna'];

const PRI_DOT  = { urgent: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const STATUS_COLOR = { todo: '#60a5fa', in_progress: '#f59e0b', in_review: '#a78bfa', done: '#34d399' };
const STATUS_HI    = { todo: 'कार्य', in_progress: 'चालू', in_review: 'समीक्षा', done: 'सम्पन्न' };
const AVATAR_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function relDate(iso) {
  if (!iso) return null;
  const diff  = new Date(iso) - new Date();
  const days  = Math.floor(diff / 86_400_000);
  if (diff < 0) return { label: 'Overdue',  color: 'var(--danger)' };
  if (days === 0) return { label: 'Today',   color: '#f59e0b' };
  if (days === 1) return { label: 'Tomorrow',color: '#f59e0b' };
  return { label: `In ${days}d`, color: 'var(--ink-3)' };
}

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function MiniAvatar({ name, index, size = 24 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: AVATAR_COLORS[(index||0) % AVATAR_COLORS.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38,
      fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: 'var(--font-display)' }}>
      {initials(name)}
    </div>
  );
}

function RelBadge({ iso }) {
  const r = relDate(iso);
  if (!r) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
      background: r.color + '18', color: r.color, whiteSpace: 'nowrap' }}>
      {r.label}
    </span>
  );
}

// ── Vikram Samvat approximate ─────────────────────────────────────────────────
function vikramDate(now) {
  const year  = now.getFullYear() + 56 + (now.getMonth() >= 3 ? 1 : 0);
  const month = VIKRAM_MONTHS[(now.getMonth() + 1) % 12];
  return { year, month };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardPage({ teams = [] }) {
  const navigate = useNavigate();
  const user     = currentUser();
  const firstName = (user?.full_name || user?.name || 'there').split(' ')[0];

  const now     = new Date();
  const dayIdx  = (now.getDay() + 6) % 7;
  const { year: vikYear, month: vikMonth } = vikramDate(now);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - dayIdx + i); return d;
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(true);
  const [tasks,     setTasks]     = useState([]);
  const [activity,  setActivity]  = useState([]);
  const [teamId,    setTeamId]    = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [tRes] = await Promise.all([
          api.get('/tasks'),
        ]);
        setTasks(tRes.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  // Fetch activity when we have a teamId
  useEffect(() => {
    const tid = teamId || teams?.[0]?.team_id;
    if (!tid) return;
    api.get(`/activity/team/${tid}`, { params: { limit: 12 } })
       .then(r => setActivity(r.data || []))
       .catch(() => {});
  }, [teamId, teams]);

  // Auto-select first team
  useEffect(() => {
    if (!teamId && teams.length) setTeamId(teams[0].team_id);
  }, [teams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats ──────────────────────────────────────────────────────────
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const weekEnd  = new Date(today); weekEnd.setDate(today.getDate()+7);
  const weekStart= new Date(today); weekStart.setDate(today.getDate()-7);

  const myId    = user?.user_id;
  const myTasks = tasks.filter(t => t.user_id === myId || t.assignee_user_ids?.includes(myId));

  const openTasks      = tasks.filter(t => t.status !== 'done');
  const dueTodayTasks  = tasks.filter(t => t.due_at && new Date(t.due_at) >= today && new Date(t.due_at) < tomorrow);
  const overdueTasks   = tasks.filter(t => t.due_at && new Date(t.due_at) < today && t.status !== 'done');
  const completedWeek  = tasks.filter(t => t.status === 'done' && t.updated_at && new Date(t.updated_at) >= weekStart);

  const myPlate = myTasks.filter(t => t.status !== 'done').slice(0, 6);
  const upcoming = tasks
    .filter(t => t.due_at && new Date(t.due_at) >= today && new Date(t.due_at) <= weekEnd && t.status !== 'done')
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .slice(0, 8);

  // Status breakdown
  const statusCounts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});
  const statusOrder  = ['todo','in_progress','in_review','done'];
  const totalTasks   = tasks.length || 1;
  const doneCount    = statusCounts['done'] || 0;
  const donePct      = Math.round((doneCount / totalTasks) * 100);

  // Task dots on week strip (tasks due on each weekday)
  const dotsByDay = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (!t.due_at) return;
      const d = new Date(t.due_at);
      const key = d.toDateString();
      map[key] = (map[key]||0)+1;
    });
    return map;
  }, [tasks]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const statCards = [
    { en: 'OPEN',  hi: 'कार्य', value: openTasks.length,
      sub: openTasks.length === 1 ? 'task open' : 'tasks open',
      color: 'var(--ink)' },
    { en: 'DUE TODAY', hi: 'आज', value: dueTodayTasks.length,
      sub: dueTodayTasks.filter(t=>t.priority==='high'||t.priority==='urgent').length + ' high priority',
      color: dueTodayTasks.length > 0 ? '#f59e0b' : 'var(--ink)' },
    { en: 'OVERDUE', hi: 'विलंबित', value: overdueTasks.length,
      sub: overdueTasks.length > 0 ? 'needs attention' : 'all on track',
      color: overdueTasks.length > 0 ? 'var(--danger)' : 'var(--ink)' },
    { en: 'COMPLETED THIS WEEK', hi: 'सम्पन्न', value: completedWeek.length,
      sub: completedWeek.length > 0 ? `↑ great progress` : 'keep going',
      color: completedWeek.length > 0 ? '#10b981' : 'var(--ink)' },
  ];

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="k-hero">
        <div className="k-hero__wm">आज</div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            {/* Date line */}
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>{now.toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase()}</span>
              <span style={{ color: 'var(--rule-strong)' }}>·</span>
              <span>{now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span style={{ color: 'var(--rule-strong)' }}>·</span>
              <span style={{ color: 'var(--k-primary)', fontFamily: 'var(--font-hindi)' }}>विक्रम संवत् {vikYear}</span>
            </div>

            {/* Greeting */}
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', fontWeight: 400, color: 'var(--ink)', margin: 0, lineHeight: 1.1 }}>
              <span style={{ fontFamily: 'var(--font-hindi)', color: 'var(--k-primary)' }}>नमस्ते,</span>{' '}
              {firstName}.
            </h1>

            {/* Summary line */}
            {!loading && (
              <p style={{ marginTop: 10, fontSize: 14, color: 'var(--ink-3)', margin: '10px 0 0' }}>
                You have <strong style={{ color: 'var(--ink)' }}>{openTasks.length} open task{openTasks.length !== 1 ? 's' : ''}</strong>
                {dueTodayTasks.length > 0 && <>, <strong style={{ color: '#f59e0b' }}>{dueTodayTasks.length} due today</strong></>}
                {overdueTasks.length > 0 && <>, <strong style={{ color: 'var(--danger)' }}>{overdueTasks.length} running late</strong></>}
                {overdueTasks.length === 0 && <>, 0 running late</>}.
                {' '}<span style={{ fontFamily: 'var(--font-hindi)', color: 'var(--ink-3)' }}>करणीय कुरु</span>
                {' '}<em style={{ color: 'var(--ink-faint)' }}>— Do what must be done.</em>
              </p>
            )}
          </div>

          {/* Vikram date block */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-hindi)' }}>विक्रम संवत् {vikYear}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long' }).slice(0,3)} · {vikMonth}
            </div>
          </div>
        </div>

        {/* Week strip */}
        <div className="k-week" style={{ marginTop: 20 }}>
          {weekDates.map((d, i) => {
            const dots = dotsByDay[d.toDateString()] || 0;
            return (
              <div key={i} className={'k-wday' + (i === dayIdx ? ' is-today' : '')}>
                <div className="k-wday__en">{WEEK_EN[i]}</div>
                <div className="k-wday__hi">{WEEK_HI[i]}</div>
                <div className="k-wday__num">{d.getDate()}</div>
                {/* Task dots */}
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 4, minHeight: 6 }}>
                  {Array.from({ length: Math.min(dots, 3) }, (_, k) => (
                    <div key={k} style={{ width: 4, height: 4, borderRadius: '50%', background: i === dayIdx ? '#fff' : 'var(--k-primary)', opacity: 0.8 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Page body ────────────────────────────────────────────────────── */}
      <div className="k-page">
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
            Loading…
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              {statCards.map(s => (
                <div key={s.en} className="k-card" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{s.en}</span>
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: 'var(--ink-faint)' }}>{s.hi}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 400, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Main 2-col grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--sp-5)', alignItems: 'start' }}>

              {/* LEFT column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

                {/* On your plate */}
                <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>On your plate</span>
                      <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: 'var(--ink-3)' }}>आपके हाथ में</span>
                    </div>
                    <button onClick={() => navigate('/tasks')}
                      style={{ fontSize: 12, color: 'var(--k-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      View all →
                    </button>
                  </div>

                  {myPlate.length === 0 ? (
                    <div style={{ padding: '24px 20px', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
                      No tasks assigned to you right now.
                    </div>
                  ) : myPlate.map((t, i) => {
                    const rel = relDate(t.due_at);
                    const team = teams.find(tm => tm.team_id === t.team_id);
                    return (
                      <div key={t.task_id} onClick={() => navigate('/tasks')}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                          borderBottom: '1px dashed var(--rule-soft)', cursor: 'pointer',
                          transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg-soft)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        {/* Priority dot */}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRI_DOT[t.priority]||'var(--ink-faint)', flexShrink: 0 }} />
                        {/* ID */}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-faint)', flexShrink: 0, minWidth: 56 }}>
                          KAR-{t.task_id?.slice(-3) || String(i+100)}
                        </span>
                        {/* Title */}
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                        </span>
                        {/* Team chip */}
                        {team && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--bg-soft)', color: 'var(--ink-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {team.name}
                          </span>
                        )}
                        {/* Due badge */}
                        {rel && <RelBadge iso={t.due_at} />}
                        {/* Assignee avatar */}
                        <MiniAvatar name={user?.full_name || user?.name} index={i} size={22} />
                      </div>
                    );
                  })}
                </div>

                {/* Status breakdown */}
                <div className="k-card">
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Status breakdown</span>
                      <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: 'var(--ink-3)' }}>स्थिति विश्लेषण</span>
                    </div>
                    <button onClick={() => navigate('/projects')}
                      style={{ fontSize: 12, color: 'var(--k-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Open board →
                    </button>
                  </div>

                  {/* Stacked bar */}
                  <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 16, gap: 1 }}>
                    {statusOrder.map(s => {
                      const count = statusCounts[s] || 0;
                      const pct   = (count / totalTasks) * 100;
                      return pct > 0 ? (
                        <div key={s} style={{ width: `${pct}%`, background: STATUS_COLOR[s], transition: 'width .4s' }} />
                      ) : null;
                    })}
                  </div>

                  {/* Status rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {statusOrder.map(s => {
                      const count = statusCounts[s] || 0;
                      return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLOR[s], flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)', textTransform: 'capitalize' }}>
                            {s.replace('_',' ')}
                          </span>
                          <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: 'var(--ink-faint)' }}>
                            {STATUS_HI[s]}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 20, textAlign: 'right' }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${donePct}%`, background: STATUS_COLOR['done'], borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
                      {donePct}% complete
                    </span>
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>सम्पन्न</span>
                  </div>
                </div>

              </div>

              {/* RIGHT column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

                {/* Upcoming */}
                <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Upcoming</span>
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: 'var(--ink-3)' }}>आगामी</span>
                  </div>

                  {upcoming.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic', fontFamily: 'var(--font-display)', textAlign: 'center' }}>
                      No deadlines this week.
                    </div>
                  ) : upcoming.map((t, i) => {
                    const team = teams.find(tm => tm.team_id === t.team_id);
                    const rel  = relDate(t.due_at);
                    return (
                      <div key={t.task_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 20px', borderBottom: '1px dashed var(--rule-soft)' }}>
                        <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: rel?.color || 'var(--ink-3)' }}>{rel?.label}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                          {team && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{team.name}</div>}
                        </div>
                        <MiniAvatar name={user?.full_name||user?.name} index={i} size={20} />
                      </div>
                    );
                  })}
                </div>

                {/* Team pulse */}
                {activity.length > 0 && (
                  <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Team pulse</span>
                        <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: 'var(--ink-3)' }}>दल की गतिविधि</span>
                      </div>
                      <button onClick={() => navigate('/activity')}
                        style={{ fontSize: 12, color: 'var(--k-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        All activity →
                      </button>
                    </div>

                    {activity.slice(0,8).map((ev, i) => {
                      const actor = ev.data?.actor_name || ev.actor_id?.slice(0,8) || '?';
                      const action = ev.type?.replace(/_/g,' ') || 'updated';
                      const task   = ev.data?.task_title || '';
                      return (
                        <div key={ev.event_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px', borderBottom: '1px dashed var(--rule-soft)' }}>
                          <MiniAvatar name={actor} index={i} size={26} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{actor.split(' ')[0]}</strong>
                              {' '}{action}
                              {task && <> <em style={{ color: 'var(--ink-3)' }}>"{task}"</em></>}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>{timeAgo(ev.created_at)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bhagavad Gita quote */}
                <div style={{ padding: '16px 20px', background: 'rgba(5,183,170,.06)', borderRadius: 12, border: '1px solid rgba(5,183,170,.15)' }}>
                  <p style={{ fontFamily: 'var(--font-hindi)', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 6px', lineHeight: 1.6 }}>
                    कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: 0, fontStyle: 'italic' }}>
                    Bhagavad Gītā 2.47 · You have a right to action alone, never to its fruits.
                  </p>
                </div>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
