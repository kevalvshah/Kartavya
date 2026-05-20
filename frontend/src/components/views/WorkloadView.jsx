/**
 * WorkloadView.jsx — per-member task load: open tasks, due soon, overdue.
 */
import React, { useMemo, useState } from 'react';
import TaskDrawer from '../TaskDrawer';

const PRIORITY_COLOR = { urgent: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const AVATAR_COLORS  = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];
const STATUS_COLOR   = { todo: '#64748b', in_progress: '#0082c6', in_review: '#8b5cf6', done: '#16a34a', requested: '#9333ea' };

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function WorkloadView({ tasks = [], teamMembers = [] }) {
  const [drawer, setDrawer] = useState(null);
  const [expanded, setExpanded] = useState({});

  const now = new Date();

  const members = useMemo(() => {
    // Build member list; include anyone who has tasks even if not in teamMembers
    const base = (teamMembers || []).map(m => ({ ...m, id: m.user_id }));
    const seen = new Set(base.map(m => m.user_id));
    tasks.forEach(t => {
      (t.assignee_user_ids || []).forEach(uid => {
        if (!seen.has(uid)) { base.push({ user_id: uid, display_name: uid, email: uid, id: uid }); seen.add(uid); }
      });
    });
    return base;
  }, [teamMembers, tasks]);

  const byMember = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.user_id] = []; });
    tasks.forEach(t => {
      (t.assignee_user_ids || []).forEach(uid => {
        if (!map[uid]) map[uid] = [];
        map[uid].push(t);
      });
    });
    // Unassigned bucket
    const unassigned = tasks.filter(t => !(t.assignee_user_ids || []).length);
    if (unassigned.length) map['__unassigned__'] = unassigned;
    return map;
  }, [members, tasks]);

  const allMembers = useMemo(() => {
    const list = members.map(m => ({ ...m, tasks: byMember[m.user_id] || [] }));
    if (byMember['__unassigned__']?.length) {
      list.push({ user_id: '__unassigned__', display_name: 'Unassigned', tasks: byMember['__unassigned__'] });
    }
    return list.sort((a, b) => b.tasks.filter(t => t.status !== 'done').length - a.tasks.filter(t => t.status !== 'done').length);
  }, [members, byMember]);

  const maxLoad = Math.max(...allMembers.map(m => m.tasks.filter(t => t.status !== 'done').length), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {allMembers.map((m, mi) => {
        const open     = m.tasks.filter(t => t.status !== 'done');
        const done     = m.tasks.filter(t => t.status === 'done');
        const overdue  = open.filter(t => t.due_at && new Date(t.due_at) < now);
        const dueSoon  = open.filter(t => t.due_at && new Date(t.due_at) >= now && daysBetween(now, new Date(t.due_at)) <= 3);
        const isExp    = expanded[m.user_id];
        const barPct   = Math.min((open.length / maxLoad) * 100, 100);
        const barColor = open.length > maxLoad * 0.75 ? '#dc2626' : open.length > maxLoad * 0.5 ? '#f59e0b' : '#0082c6';
        const avatarColor = m.user_id === '__unassigned__' ? '#94a3b8' : AVATAR_COLORS[mi % AVATAR_COLORS.length];
        const name = m.display_name || m.full_name || m.email || m.user_id;

        return (
          <div key={m.user_id} style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {/* Member row */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto auto auto', gap: 16, alignItems: 'center', padding: '14px 20px', cursor: 'pointer' }}
              onClick={() => setExpanded(e => ({ ...e, [m.user_id]: !e[m.user_id] }))}
            >
              {/* Avatar */}
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {initials(name)}
              </span>

              {/* Name + bar */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{name}</div>
                <div style={{ height: 5, background: 'var(--rule-soft)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: barPct + '%', background: barColor, borderRadius: 99, transition: 'width .4s' }} />
                </div>
              </div>

              {/* Stats */}
              <Stat n={open.length}    label="open"    color="var(--ink)" />
              <Stat n={overdue.length} label="overdue" color={overdue.length ? '#dc2626' : 'var(--ink-3)'} />
              <Stat n={dueSoon.length} label="due soon" color={dueSoon.length ? '#f59e0b' : 'var(--ink-3)'} />
              <Stat n={done.length}    label="done"    color="#16a34a" />
            </div>

            {/* Expanded task list */}
            {isExp && open.length > 0 && (
              <div style={{ borderTop: '1px solid var(--rule-soft)' }}>
                {open.map(t => {
                  const isOv = t.due_at && new Date(t.due_at) < now;
                  const pColor = PRIORITY_COLOR[t.priority] || '#94a3b8';
                  const sColor = STATUS_COLOR[t.status] || '#64748b';
                  return (
                    <div key={t.task_id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px 10px 76px', borderBottom: '1px solid var(--rule-soft)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-soft)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                      onClick={() => setDrawer(t.task_id)}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: pColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: sColor, background: sColor + '18', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>{t.status?.replace('_', ' ')}</span>
                      {t.due_at && (
                        <span style={{ fontSize: 11, color: isOv ? '#dc2626' : 'var(--ink-3)', fontWeight: isOv ? 700 : 400, whiteSpace: 'nowrap' }}>
                          {isOv ? '⚠ ' : ''}{new Date(t.due_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {allMembers.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          No team members
        </div>
      )}

      <TaskDrawer taskId={drawer} open={!!drawer} onClose={() => setDrawer(null)} teamMembers={teamMembers}
        onSaved={() => setDrawer(null)} />
    </div>
  );
}

function Stat({ n, label, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}
