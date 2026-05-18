/**
 * TeamsPage.js — editorial Team screen with k-teamgrid member cards.
 * All data fetching + mutations unchanged.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { PageHeader, PriorityDot } from '../components/editorial';
import { AVATAR_COLORS, userInitials } from '../lib/utils';

export default function TeamsPage() {
  const [teams,          setTeams]          = useState([]);
  const [name,           setName]           = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamDetail,     setTeamDetail]     = useState(null);
  const [inviteEmail,    setInviteEmail]    = useState('');
  const [inviteRole,     setInviteRole]     = useState('member');
  const [showCreate,     setShowCreate]     = useState(false);

  const loadTeams = async () => {
    const res = await api.get('/teams');
    setTeams(res.data);
    if (!selectedTeamId && res.data.length) setSelectedTeamId(res.data[0].team_id);
  };
  const loadDetail = async (teamId) => {
    if (!teamId) return;
    const res = await api.get(`/teams/${teamId}`);
    setTeamDetail(res.data);
  };

  useEffect(() => { loadTeams().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedTeamId) { setTeamDetail(null); return; }
    loadDetail(selectedTeamId).catch(() => {});
  }, [selectedTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const yourRole = teamDetail?.your_role || 'member';
  const isAdmin  = yourRole === 'owner' || yourRole === 'admin';
  const members  = useMemo(() => teamDetail?.members || [], [teamDetail]);

  const createTeam = async () => {
    if (!name.trim()) return;
    const res = await api.post('/teams', { name: name.trim() });
    setName(''); setShowCreate(false);
    setTeams(p => [res.data, ...p]);
    setSelectedTeamId(res.data.team_id);
  };

  const addMember = async () => {
    if (!inviteEmail.trim()) return;
    const res = await api.post(`/teams/${selectedTeamId}/members`, {
      email: inviteEmail.trim().toLowerCase(), role: inviteRole,
    });
    setInviteEmail(''); setInviteRole('member');
    setTeamDetail(prev => ({ ...prev, members: [res.data, ...(prev?.members || [])] }));
  };

  const updateMemberRole = async (memberId, role) => {
    const res = await api.put(`/teams/${selectedTeamId}/members/${memberId}`, { role });
    setTeamDetail(prev => ({ ...prev, members: (prev?.members || []).map(m => m.member_id === memberId ? res.data : m) }));
  };

  const removeMember = async (memberId) => {
    if (!window.confirm('Remove this member?')) return;
    await api.delete(`/teams/${selectedTeamId}/members/${memberId}`);
    setTeamDetail(prev => ({ ...prev, members: (prev?.members || []).filter(m => m.member_id !== memberId) }));
  };

  return (
    <div className="k-screen">
      <PageHeader
        kicker="PEOPLE"
        title="Team"
        sanskrit="दल"
        lede={`${members.length} member${members.length !== 1 ? 's' : ''} across your workspace.`}
        right={
          <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setShowCreate(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            New team
          </button>
        }
      />

      {/* Team picker */}
      {teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {teams.map(t => (
            <button
              key={t.team_id}
              className={'k-segctrl__btn' + (selectedTeamId === t.team_id ? ' is-active' : '')}
              onClick={() => setSelectedTeamId(t.team_id)}
              style={{ borderRadius: 'var(--r-sm)', padding: '5px 14px', border: '1px solid var(--rule)', background: selectedTeamId === t.team_id ? 'var(--k-primary)' : 'var(--surface)', color: selectedTeamId === t.team_id ? '#fff' : 'var(--ink-2)', fontSize: 13, cursor: 'pointer' }}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* New team form */}
      {showCreate && (
        <section className="k-card">
          <header className="k-card__head">
            <div className="k-card__titles">
              <h3 className="k-card__title">New team</h3>
              <span className="k-card__sans">नया दल</span>
            </div>
          </header>
          <div className="k-card__body">
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="k-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Team name…" onKeyDown={e => e.key === 'Enter' && createTeam()} autoFocus style={{ flex: 1 }} />
              <button className="k-btn k-btn--primary" onClick={createTeam}>Create</button>
              <button className="k-btn k-btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      {/* Member grid */}
      {members.length > 0 && (
        <div className="k-teamgrid">
          {members.map((m, idx) => {
            const color    = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const initials = userInitials(m.display_name || m.full_name || m.email);
            const name     = m.display_name || m.full_name || m.email || '?';
            const role     = m.role || 'member';
            return (
              <div key={m.member_id} className="k-mcard">
                <div className="k-mcard__head">
                  <span className="k-avatar" style={{ width: 44, height: 44, fontSize: 16, background: color, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                    {initials}
                  </span>
                  <div>
                    <div className="k-mcard__name">{name}</div>
                    <div className="k-mcard__role">
                      <span className={`k-rolebadge k-rolebadge--${role}`}>{role}</span>
                    </div>
                  </div>
                </div>

                <div className="k-mcard__stats">
                  <div><b>{m.open_task_count ?? 0}</b><span>open</span></div>
                  <div><b>{m.done_this_week ?? 0}</b><span>done</span></div>
                </div>

                {(m.open_tasks || []).slice(0, 3).map(t => (
                  <div key={t.task_id} className="k-mcard__row">
                    <PriorityDot priority={t.priority} size={6} />
                    <span className="k-mcard__tt">{t.title}</span>
                  </div>
                ))}
                {(m.open_tasks || []).length === 0 && (
                  <div className="k-mcard__empty">No open work · रिक्त</div>
                )}

                {isAdmin && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, borderTop: '1px solid var(--rule-soft)', paddingTop: 12 }}>
                    <select
                      className="k-select"
                      value={role}
                      onChange={e => updateMemberRole(m.member_id, e.target.value)}
                      style={{ flex: 1, fontSize: 12 }}
                    >
                      {['admin','owner','member','client'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      className="k-btn k-btn--ghost k-btn--sm"
                      onClick={() => removeMember(m.member_id)}
                      style={{ color: 'var(--danger)', fontSize: 12 }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite form */}
      {isAdmin && (
        <section className="k-card">
          <header className="k-card__head">
            <div className="k-card__titles">
              <h3 className="k-card__title">Invite member</h3>
              <span className="k-card__sans">आमंत्रण</span>
            </div>
          </header>
          <div className="k-card__body">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input className="k-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="Email address" style={{ flex: '2 1 200px' }} />
              <select className="k-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ flex: '1 1 120px' }}>
                {['admin','owner','member','client'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button className="k-btn k-btn--primary" onClick={addMember}>Invite</button>
            </div>
          </div>
        </section>
      )}

      {!teamDetail && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          {teams.length === 0 ? 'No teams yet. Create one above.' : 'Loading…'}
        </div>
      )}
    </div>
  );
}
