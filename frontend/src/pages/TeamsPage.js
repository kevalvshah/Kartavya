/**
 * TeamsPage.js — team management with k-* design system.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const ROLE_COLORS = { admin: '#0082c6', owner: '#8b5cf6', member: '#6E7B91', client: '#ec4899' };
const MEMBER_AVATARS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

export default function TeamsPage() {
  const [teams,          setTeams]          = useState([]);
  const [name,           setName]           = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamDetail,     setTeamDetail]     = useState(null);
  const [inviteEmail,    setInviteEmail]    = useState('');
  const [inviteRole,     setInviteRole]     = useState('member');

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
    setName('');
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
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">Teams</h1>
        <span className="k-pageh__sans">सहयोगी</span>
      </div>

      {/* Create team */}
      <div className="k-card" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="k-card__head">
          <span className="k-card__title">New team</span>
          <span className="k-card__sans">नया दल</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="k-input" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTeam()}
            placeholder="Team name e.g. Product, Finance" />
          <button className="k-btn k-btn--primary" onClick={createTeam}>Create</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--sp-5)', alignItems: 'start' }}>
        {/* Team list */}
        <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
          {teams.length === 0 ? (
            <div className="k-empty" style={{ padding: 'var(--sp-6)' }}>
              <div className="k-empty__sub">No teams yet</div>
            </div>
          ) : teams.map(t => (
            <button key={t.team_id} onClick={() => setSelectedTeamId(t.team_id)}
              style={{ width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none', background: selectedTeamId === t.team_id ? 'var(--side-active, rgba(5,183,170,.1))' : 'transparent', borderBottom: '1px dashed var(--rule-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .1s' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--k-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {t.name.slice(0,2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              </div>
              {selectedTeamId === t.team_id && (
                <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--k-primary)', flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>

        {/* Team detail */}
        <div className="k-card">
          {!selectedTeamId ? (
            <div className="k-empty">
              <div className="k-empty__icon">👥</div>
              <div className="k-empty__sub">Select a team to manage members</div>
            </div>
          ) : (
            <>
              <div className="k-card__head" style={{ marginBottom: 'var(--sp-5)' }}>
                <span className="k-card__title">{teamDetail?.team?.name || 'Team'}</span>
                <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: isAdmin ? 'rgba(0,130,198,.12)' : 'var(--bg-soft)', color: isAdmin ? 'var(--k-deep)' : 'var(--ink-3)' }}>
                  {yourRole}
                </span>
              </div>

              {/* Add member */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
                  <input className="k-input" style={{ flex: '1 1 200px' }} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMember()} placeholder="member@company.com" />
                  <select className="k-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="k-btn k-btn--primary k-btn--sm" onClick={addMember}>Add member</button>
                </div>
              )}

              {/* Members list */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {members.length === 0 ? (
                  <div className="k-empty__sub" style={{ padding: 'var(--sp-5)', textAlign: 'center' }}>No members found.</div>
                ) : members.map((m, i) => (
                  <div key={m.member_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px dashed var(--rule-soft)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: MEMBER_AVATARS[i % MEMBER_AVATARS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {(m.name || m.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{m.name || m.email}</div>
                      {m.name && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.email}</div>}
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 1 }}>{m.status === 'invited' ? '⟳ Invite pending' : '● Active'}</div>
                    </div>
                    <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${ROLE_COLORS[m.role] || '#6E7B91'}18`, color: ROLE_COLORS[m.role] || 'var(--ink-3)' }}>
                      {m.role}
                    </span>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select className="k-select" style={{ fontSize: 12, padding: '4px 22px 4px 8px' }} value={m.role} onChange={e => updateMemberRole(m.member_id, e.target.value)}>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                        </select>
                        <button className="k-btn k-btn--ghost k-btn--sm" style={{ color: 'var(--danger)' }} onClick={() => removeMember(m.member_id)}>Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 'var(--sp-4)' }}>
                Admins can add members and assign tasks. Ownership transfers by setting another member to Owner.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
