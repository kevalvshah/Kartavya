/**
 * DashboardPage.jsx â€” editorial Today screen.
 * Layout: Hero â†’ StatRow (4 tiles) â†’ k-twocol (main + side columns)
 * Data: existing /tasks + /activity/team/:id + /api/verse-of-the-day
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { currentUser } from '../lib/auth';
import {
  Hero, StatTile, Card, DueChip, PriorityDot, ProjectTag, AvatarStack, Citation,
} from '../components/editorial';
import { AVATAR_COLORS, relTime, userInitials, logger } from '../lib/utils';

const VIKRAM_MONTHS = ['Chaitra','VaishÄkha','JyÄ“á¹£á¹­ha','Ä€á¹£Äá¸ha','ÅšrÄvaá¹‡a','BhÄdra',
  'Ä€Å›vina','KÄrtika','MÄrgaÅ›Ä«rá¹£a','Pauá¹£a','MÄgha','PhÄlguna'];
const STATUS_COLOR  = { todo:'#94a3b8', in_progress:'#0082c6', in_review:'#a78bfa', done:'#05b7aa', requested:'#f59e0b' };
const STATUS_LABEL  = { todo:'To Do', in_progress:'In Progress', in_review:'In Review', done:'Done', requested:'Requested' };
const STATUS_HI     = { todo:'à¤•à¤¾à¤°à¥à¤¯', in_progress:'à¤šà¤¾à¤²à¥‚', in_review:'à¤¸à¤®à¥€à¤•à¥à¤·à¤¾', done:'à¤¸à¤®à¥à¤ªà¤¨à¥à¤¨', requested:'à¤…à¤¨à¥à¤°à¥‹à¤§' };

function vikramDate(now) {
  const year  = now.getFullYear() + 56 + (now.getMonth() >= 3 ? 1 : 0);
  const month = VIKRAM_MONTHS[(now.getMonth() + 1) % 12];
  return { year, month };
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DashboardPage({ teams = [] }) {
  const navigate  = useNavigate();
  const user      = currentUser();
  const firstName = (user?.full_name || user?.name || 'there').split(' ')[0];

  const now    = new Date();
  const dayIdx = (now.getDay() + 6) % 7;
  const { year: vikYear, month: vikMonth } = vikramDate(now);

  const weekDates = useMemo(() => {
    const base = new Date(); base.setHours(0,0,0,0);
    const idx  = (base.getDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base); d.setDate(base.getDate() - idx + i); return d;
    });
  }, []);

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [loading,  setLoading]  = useState(true);
  const [tasks,    setTasks]    = useState([]);
  const [activity, setActivity] = useState([]);
  const [verse,    setVerse]    = useState(null);
  const [teamId,   setTeamId]   = useState('');

  // â”€â”€ Fetch tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/tasks'),
      api.get('/verse-of-the-day').catch(() => null),
    ]).then(([tRes, vRes]) => {
      setTasks(Array.isArray(tRes.data) ? tRes.data : []);
      if (vRes) setVerse(vRes.data);
    }).catch(logger.error).finally(() => setLoading(false));
  }, []);

  // â”€â”€ Fetch activity when team resolves â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const tid = teams?.[0]?.team_id;
    if (!tid) return;
    setTeamId(tid);
    api.get(`/activity/team/${tid}`, { params: { limit: 6 } })
       .then(r => setActivity(r.data || []))
       .catch(() => {});
  }, [teams]);

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { today, tomorrow, weekEnd, weekAgo } = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    const tom = new Date(t); tom.setDate(t.getDate()+1);
    const we  = new Date(t); we.setDate(t.getDate()+7);
    const wa  = new Date(t); wa.setDate(t.getDate()-7);
    return { today: t, tomorrow: tom, weekEnd: we, weekAgo: wa };
  }, []);

  const myId = user?.user_id;
  const {
    myPlate, openTasks, openProjectCount, dueToday, overdue, completedWeek, inProgress, inReview, upcoming,
  } = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const myTasks   = safeTasks.filter(t => t.created_by_user_id === myId || t.user_id === myId || t.assignee_user_ids?.includes(myId));
    const open      = safeTasks.filter(t => t.status !== 'done');
    return {
      myPlate:       myTasks.filter(t => t.status !== 'done').slice(0, 6),
      openTasks:     open,
      openProjectCount: new Set(open.map(t => t.team_id).filter(Boolean)).size || 1,
      dueToday:      safeTasks.filter(t => t.due_at && new Date(t.due_at) >= today && new Date(t.due_at) < tomorrow),
      overdue:       safeTasks.filter(t => t.due_at && new Date(t.due_at) < today && t.status !== 'done'),
      completedWeek: safeTasks.filter(t => t.status === 'done' && t.updated_at && new Date(t.updated_at) >= weekAgo),
      inProgress:    safeTasks.filter(t => t.status === 'in_progress'),
      inReview:      safeTasks.filter(t => t.status === 'in_review'),
      upcoming:      safeTasks
        .filter(t => t.due_at && new Date(t.due_at) >= today && new Date(t.due_at) <= weekEnd && t.status !== 'done')
        .sort((a,b) => new Date(a.due_at) - new Date(b.due_at)).slice(0, 6),
    };
  }, [tasks, myId, today, tomorrow, weekEnd, weekAgo]);

  // Status breakdown
  const statusOrder = ['todo','in_progress','in_review','done'];
  const statusCounts = tasks.reduce((a, t) => { a[t.status] = (a[t.status]||0)+1; return a; }, {});
  const totalTasks   = tasks.length || 1;
  const doneCount    = statusCounts.done || 0;
  const donePct      = Math.round((doneCount / totalTasks) * 100);

  // Task dots on week strip
  const dotsByDay = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (!t.due_at) return;
      const key = new Date(t.due_at).toDateString();
      map[key] = (map[key]||0)+1;
    });
    return map;
  }, [tasks]);

  // Date line for Hero
  const DAYS_HI = ['à¤°à¤µà¤¿à¤µà¤¾à¤°','à¤¸à¥‹à¤®à¤µà¤¾à¤°','à¤®à¤‚à¤—à¤²à¤µà¤¾à¤°','à¤¬à¥à¤§à¤µà¤¾à¤°','à¤—à¥à¤°à¥à¤µà¤¾à¤°','à¤¶à¥à¤•à¥à¤°à¤µà¤¾à¤°','à¤¶à¤¨à¤¿à¤µà¤¾à¤°'];
  const dateLine = [
    { label: now.toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase() },
    { label: DAYS_HI[now.getDay()], hindi: true },
    { label: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
    { label: `à¤µà¤¿à¤•à¥à¤°à¤® à¤¸à¤‚à¤µà¤¤à¥ ${vikYear}`, hindi: true },
  ];

  const ledeCopy = loading ? null : (
    <>
      You have <b>{myPlate.length} open task{myPlate.length !== 1 ? 's' : ''}</b>
      {dueToday.length > 0 && <>, <b>{dueToday.length} due today</b></>}
      {overdue.length > 0   && <>, <b style={{ color: 'var(--danger)' }}>{overdue.length} running late</b></>}.
      {' '}<span className="hi-mute">à¤•à¤°à¤£à¥€à¤¯à¤‚ à¤•à¥à¤°à¥ â€”</span> <em>Do what must be done.</em>
    </>
  );

  return (
    <div className="k-screen">
      {/* Hero */}
      <Hero
        name={firstName}
        dateLine={dateLine}
        lede={ledeCopy}
        weekDates={weekDates}
        dotsByDay={dotsByDay}
        todayIdx={dayIdx}
      />

      {/* Stat row */}
      <div className="k-stats">
        <StatTile variant="blue"  label="OPEN"                sanskrit="à¤–à¥à¤²à¤¾"      value={openTasks.length}     sub={`across ${openProjectCount} project${openProjectCount !== 1 ? 's' : ''}`} />
        <StatTile variant="teal"  label="DUE TODAY"           sanskrit="à¤†à¤œ"        value={dueToday.length}      sub={`${dueToday.filter(t=>t.priority==='high'||t.priority==='urgent').length} high priority`} />
        <StatTile variant="amber" label="OVERDUE"             sanskrit="à¤µà¤¿à¤²à¤‚à¤¬à¤¿à¤¤"   value={overdue.length}       sub={overdue.length > 0 ? 'needs attention' : 'all on track'} />
        <StatTile variant="red"   label="COMPLETED THIS WEEK" sanskrit="à¤‡à¤¸ à¤¸à¤ªà¥à¤¤à¤¾à¤¹" value={completedWeek.length} sub={completedWeek.length > 0 ? `â†‘ ${Math.round((completedWeek.length/(tasks.length||1))*100)}% on last week` : 'keep going'} />
      </div>

      {/* Two-column body */}
      {!loading && (
        <section className="k-twocol">
          {/* LEFT column */}
          <div className="k-col k-col--main">
            {/* On your plate */}
            <Card
              title="On your plate"
              sanskrit="à¤†à¤ªà¤•à¥‡ à¤¹à¤¾à¤¥ à¤®à¥‡à¤‚"
              right={<button className="k-link" onClick={() => navigate('/tasks')}>View all â†’</button>}
              noPad
            >
              {myPlate.length === 0 ? (
                <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
                  Nothing assigned to you right now.
                </div>
              ) : myPlate.map((t, i) => {
                const assignees = (t.assignee_names || []).map((name, j) => ({
                  name, color: AVATAR_COLORS[j % AVATAR_COLORS.length],
                }));
                return (
                  <button key={t.task_id} className="k-taskrow" onClick={() => navigate('/tasks')}>
                    <PriorityDot priority={t.priority} />
                    <span className="k-taskrow__id">KAR-{String(i+100)}</span>
                    <span className="k-taskrow__title">{t.title}</span>
                    {t.team_name && <ProjectTag name={t.team_name} dense />}
                    <DueChip date={t.due_at} />
                    <AvatarStack users={assignees} size={20} max={3} />
                  </button>
                );
              })}
            </Card>

            {/* Status breakdown */}
            <Card title="Project status" sanskrit="à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤µà¤¿à¤µà¤°à¤£" right={<button className="k-link" onClick={() => navigate('/projects')}>Open projects â†’</button>}>
              <div className="k-stackbar">
                {statusOrder.map(s => {
                  const count = statusCounts[s] || 0;
                  if (!count) return null;
                  return (
                    <div key={s} className="k-stackbar__seg"
                      style={{ flex: count, background: STATUS_COLOR[s] }}
                      title={`${STATUS_LABEL[s]}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="k-statuslegend">
                {statusOrder.map(s => (
                  <div key={s} className="k-statuslegend__row">
                    <span className="k-statuslegend__dot" style={{ background: STATUS_COLOR[s] }} />
                    <span className="k-statuslegend__lbl">{STATUS_LABEL[s]}</span>
                    <span className="k-statuslegend__hi">{STATUS_HI[s]}</span>
                    <span className="k-statuslegend__count">{statusCounts[s] || 0}</span>
                  </div>
                ))}
              </div>
              <div className="k-meter">
                <div className="k-meter__bar">
                  <div className="k-meter__fill" style={{ width: donePct + '%' }} />
                </div>
                <div className="k-meter__lbl">
                  {donePct}% complete Â· <span className="hi-mute">{donePct}% à¤¸à¤®à¥à¤ªà¤¨à¥à¤¨</span>
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT column */}
          <div className="k-col k-col--side">
            {/* Upcoming */}
            <Card title="Upcoming this week" sanskrit="à¤†à¤—à¤¾à¤®à¥€ à¤¸à¤ªà¥à¤¤à¤¾à¤¹">
              <div className="k-upcoming">
                {upcoming.length === 0 ? (
                  <div style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 13 }}>Nothing due this week.</div>
                ) : upcoming.map(t => {
                  const assignees = (t.assignee_names || []).map((name, j) => ({ name, color: AVATAR_COLORS[j % AVATAR_COLORS.length] }));
                  return (
                    <button key={t.task_id} className="k-upcoming__row" onClick={() => navigate('/tasks')}>
                      <DueChip date={t.due_at} flush />
                      <div className="k-upcoming__body">
                        <div className="k-upcoming__title">{t.title}</div>
                        {t.team_name && <div className="k-upcoming__meta"><ProjectTag name={t.team_name} dense /></div>}
                      </div>
                      <AvatarStack users={assignees} size={18} max={2} />
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Recent activity */}
            <Card title="Team pulse" sanskrit="à¤¦à¤² à¤•à¥€ à¤—à¤¤à¤¿à¤µà¤¿à¤§à¤¿" right={<button className="k-link" onClick={() => navigate('/activity')}>All activity â†’</button>}>
              <div className="k-activity">
                {activity.length === 0 ? (
                  <div style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 13 }}>No recent activity.</div>
                ) : activity.slice(0,6).map((a, i) => {
                  const initials = userInitials(a.actor_name || a.actor || '');
                  const color    = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  return (
                    <div key={a.activity_id || i} className="k-activity__row">
                      <span className="k-avatar" style={{ width: 22, height: 22, fontSize: 9, background: color, flexShrink: 0 }}>
                        {initials}
                      </span>
                      <div className="k-activity__body">
                        <div className="k-activity__line">
                          <b>{(a.actor_name || a.actor || 'Someone').split(' ')[0]}</b>{' '}
                          <span className="k-mute">{a.verb || a.event_type || 'updated'}</span>{' '}
                          <span className="k-activity__what">{a.subject_title || a.task_title || ''}</span>
                        </div>
                        <div className="k-activity__when">{relTime(a.created_at || a.at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Verse of the day */}
            {verse ? (
              <Citation
                sanskrit={verse.sanskrit}
                english={verse.english}
                source={verse.ref || 'Bhagavad GÄ«tÄ'}
              />
            ) : (
              <Citation
                sanskrit="à¤•à¤°à¥à¤®à¤£à¥à¤¯à¥‡à¤µà¤¾à¤§à¤¿à¤•à¤¾à¤°à¤¸à¥à¤¤à¥‡ à¤®à¤¾ à¤«à¤²à¥‡à¤·à¥ à¤•à¤¦à¤¾à¤šà¤¨"
                english="You have a right to action alone, never to its fruits."
                source="Bhagavad GÄ«tÄ 2.47"
              />
            )}
          </div>
        </section>
      )}

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Loadingâ€¦
        </div>
      )}
    </div>
  );
}
