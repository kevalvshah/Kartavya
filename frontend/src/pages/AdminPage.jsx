/**
 * AdminPage.jsx — k-* design system.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';

const ROLE_COLORS = { admin: '#0082c6', member: '#6E7B91', client: '#ec4899', owner: '#8b5cf6' };
const AVATARS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981'];

function RolePill({ role }) {
  const color = ROLE_COLORS[role] || '#6E7B91';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 8px', borderRadius: 99, background: `${color}18`, color }}>
      {role}
    </span>
  );
}

export default function AdminPage() {
  const { pushToast } = useToast();
  const [users,       setUsers]       = useState([]);
  const [invites,     setInvites]     = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName,  setInviteName]  = useState('');
  const [inviteRole,  setInviteRole]  = useState('member');
  const [sending,     setSending]     = useState(false);
  const [copiedId,    setCopiedId]    = useState(null);

  const me = JSON.parse(localStorage.getItem('kartavya_user') || 'null');

  const load = () => Promise.all([
    api.get('/admin/users').then(r => setUsers(r.data)).catch(() => {}),
    api.get('/admin/invites').then(r => setInvites(r.data)).catch(() => {}),
  ]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      await api.post('/admin/invites', { email: inviteEmail.trim(), role: inviteRole, name: inviteName.trim() || undefined });
      pushToast({ type: 'success', title: 'Invite created — copy link below' });
      setInviteEmail(''); setInviteName(''); load();
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not create invite', message: err?.response?.data?.detail });
    } finally { setSending(false); }
  };

  const copyLink = (link, id) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const revokeInvite = async (id) => {
    await api.delete(`/admin/invites/${id}`).catch(() => {});
    pushToast({ type: 'success', title: 'Invite revoked' }); load();
  };

  const removeUser = async (u) => {
    if (u.user_id === me?.user_id) { pushToast({ type: 'error', title: 'You cannot remove yourself' }); return; }
    if (!window.confirm(`Remove ${u.full_name || u.name} (${u.email})? This cannot be undone.`)) return;
    await api.delete(`/admin/users/${u.user_id}`).catch(() => {});
    pushToast({ type: 'success', title: 'User removed' }); load();
  };

  const changeRole = async (u, role) => {
    if (u.user_id === me?.user_id) { pushToast({ type: 'error', title: 'You cannot change your own role' }); return; }
    try {
      await api.put(`/admin/users/${u.user_id}/role`, { role });
      setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, role } : x));
      pushToast({ type: 'success', title: 'Role updated' });
    } catch (_) { pushToast({ type: 'error', title: 'Could not change role' }); }
  };

  const pendingInvites = invites.filter(i => !i.accepted_at);

  return (
    <div className="k-page">
      <div className="k-pageh">
        <h1 className="k-pageh__title">Admin</h1>
        <span className="k-pageh__sans">प्रशासन</span>
      </div>

      {/* Invite panel */}
      <div className="k-card" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="k-card__head">
          <span className="k-card__title">Invite user</span>
          <span className="k-card__sans">आमंत्रण</span>
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr auto auto', flexWrap: 'wrap' }}>
          <input className="k-input" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" />
          <input className="k-input" type="email" value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInvite()}
            placeholder="user@company.com" />
          <select className="k-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="client">Client</option>
          </select>
          <button className="k-btn k-btn--primary" onClick={sendInvite} disabled={sending}>
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="k-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Pending Invites</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pendingInvites.length} pending</span>
          </div>
          {pendingInvites.map(inv => (
            <div key={inv.invite_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px dashed var(--rule-soft)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{inv.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <RolePill role={inv.role} />
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => copyLink(inv.invite_link, inv.invite_id)}>
                {copiedId === inv.invite_id ? '✓ Copied!' : 'Copy link'}
              </button>
              <button className="k-iconbtn" style={{ color: 'var(--danger)' }} onClick={() => revokeInvite(inv.invite_id)} title="Revoke">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* All users */}
      <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>All Users</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{users.length} total</span>
        </div>
        {users.map((u, i) => {
          const isSelf = u.user_id === me?.user_id;
          const displayName = u.full_name || u.name || u.email || '?';
          return (
            <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px dashed var(--rule-soft)' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: AVATARS[i % AVATARS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {displayName[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {displayName}
                  {isSelf && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>(you)</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{u.email}</div>
              </div>
              <RolePill role={u.role} />
              <select className="k-select" style={{ fontSize: 12 }} value={u.role}
                onChange={e => changeRole(u, e.target.value)} disabled={isSelf}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="client">Client</option>
              </select>
              <button className="k-iconbtn" style={{ color: 'var(--danger)', opacity: isSelf ? 0.3 : 1 }}
                onClick={() => removeUser(u)} disabled={isSelf} title="Remove">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
