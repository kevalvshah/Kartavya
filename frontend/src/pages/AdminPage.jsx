/**
 * AdminPage.jsx — k-* design system.
 * Invite form: Full Name, Email, Account Type, Role title, Client Approval toggle.
 * User list: inline role select + Edit slide-over + Remove.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { PageHeader, StatTile } from '../components/editorial';

const ROLE_COLORS = { admin: '#0082c6', member: '#6E7B91', client: '#ec4899', owner: '#8b5cf6' };
const AVATARS     = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981'];

const EMPTY_INVITE = {
  full_name: '', email: '', role: 'member',
  member_role: '', receives_approval_emails: true,
};

const EMPTY_EDIT = {
  full_name: '', role: 'member', member_role: '',
  company_name: '', receives_approval_emails: true,
};

// ── Small components ──────────────────────────────────────────────────────────

function RolePill({ role }) {
  const color = ROLE_COLORS[role] || '#6E7B91';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
      padding: '2px 8px', borderRadius: 99, background: `${color}18`, color, flexShrink: 0, whiteSpace: 'nowrap' }}>
      {role}
    </span>
  );
}

function UserAvatar({ user, index, size = 40 }) {
  const name = user.full_name || user.name || user.email || '?';
  if (user.avatar) return <img src={user.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: AVATARS[index % AVATARS.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontSize: size * 0.375, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)}
        style={{ width: 40, height: 22, borderRadius: 11, background: checked ? 'var(--k-primary)' : 'var(--rule-soft)',
          position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
    </label>
  );
}

// ── Delete user modal ─────────────────────────────────────────────────────────

function DeleteUserModal({ user, otherUsers, onConfirm, onClose }) {
  const [reassignTo, setReassignTo] = useState('');
  const [deleting,   setDeleting]   = useState(false);

  const userName = user.full_name || user.name || user.email;

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm(user, reassignTo || null);
    setDeleting(false);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.35)', overflow: 'hidden' }}>

        {/* Red header */}
        <div style={{ background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)', padding: '22px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M6 6h8M8 6V5h4v1M9 10v4M11 10v4M5 6l1 11h8l1-11"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: 2 }}>REMOVE USER · उपयोगकर्ता हटाएं</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: '#fff' }}>
                Remove <em>{userName}</em>?
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
            All tasks, comments, and time entries created by <strong>{userName}</strong> will be reassigned to the person you choose below, or unassigned if left blank.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
              REASSIGN WORK TO · कार्य सौंपें
            </label>
            <select
              className="k-input"
              style={{ width: '100%' }}
              value={reassignTo}
              onChange={e => setReassignTo(e.target.value)}
            >
              <option value="">— Leave unassigned —</option>
              {otherUsers.map(u => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name || u.name || u.email}{u.member_role ? ` · ${u.member_role}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12, color: '#b91c1c' }}>
            ⚠ This action is permanent and cannot be undone.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={onClose} disabled={deleting}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}
          >
            {deleting ? 'Removing…' : `Remove ${userName.split(' ')[0]}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit slide-over ───────────────────────────────────────────────────────────

function EditSlideOver({ user, onClose, onSaved, pushToast }) {
  const [form, setForm] = useState({
    full_name:                user.full_name || '',
    role:                     user.role || 'member',
    member_role:              user.member_role || '',
    company_name:             user.company_name || '',
    receives_approval_emails: user.receives_approval_emails !== false,
  });
  const [saving, setSaving] = useState(false);
  const panelRef = useRef();

  // Close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/admin/users/${user.user_id}`, {
        full_name:                form.full_name.trim() || null,
        role:                     form.role,
        member_role:              form.member_role.trim() || null,
        company_name:             form.company_name.trim() || null,
        receives_approval_emails: form.receives_approval_emails,
      });
      pushToast({ type: 'success', title: 'User updated' });
      onSaved(res.data);
      onClose();
    } catch (err) {
      pushToast({ type: 'error', title: err?.response?.data?.detail || 'Could not save' });
    } finally { setSaving(false); }
  };

  const labelSt = { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' };

  return (
    <div onClick={handleBackdrop} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,14,26,.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <div ref={panelRef} style={{ width: 420, maxWidth: '90vw', height: '100%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserAvatar user={user} index={0} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
              {user.full_name || user.name || 'Edit User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={labelSt}>Full Name</label>
              <input className="k-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Doe" />
            </div>

            <div>
              <label style={labelSt}>Account Type</label>
              <select className="k-select" style={{ width: '100%' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="client">Client</option>
              </select>
            </div>

            <div>
              <label style={labelSt}>Job Title / Role</label>
              <input className="k-input" value={form.member_role} onChange={e => setForm(f => ({ ...f, member_role: e.target.value }))} placeholder="e.g. Product Manager, Designer" />
            </div>

            <div>
              <label style={labelSt}>Company</label>
              <input className="k-input" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Aekam Inc" />
            </div>

            {/* Client approval — only for client account type */}
            {form.role === 'client' && (
              <div style={{ padding: '14px 16px', background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--rule-soft)' }}>
                <Toggle
                  checked={form.receives_approval_emails}
                  onChange={v => setForm(f => ({ ...f, receives_approval_emails: v }))}
                  label="Receives client approval emails"
                />
                <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8, marginBottom: 0 }}>
                  When enabled, this client will receive email notifications whenever a task or project requires their approval.
                </p>
              </div>
            )}

            <div style={{ padding: '12px 14px', background: 'var(--bg-soft)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-faint)', marginBottom: 4 }}>Email (immutable)</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{user.email}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--rule-soft)', display: 'flex', gap: 10 }}>
          <button className="k-btn k-btn--primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="k-btn k-btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { pushToast } = useToast();
  const [users,     setUsers]     = useState([]);
  const [invites,   setInvites]   = useState([]);
  const [invite,      setInvite]      = useState(EMPTY_INVITE);
  const [sending,     setSending]     = useState(false);
  const [copiedId,    setCopiedId]    = useState(null);
  const [editUser,    setEditUser]    = useState(null);   // user being edited
  const [deleteTarget, setDeleteTarget] = useState(null); // user pending deletion

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('kartavya_user') || 'null'); } catch { return null; }
  }, []);

  const load = () => Promise.all([
    api.get('/admin/users').then(r => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
    api.get('/admin/invites').then(r => setInvites(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
  ]);

  useEffect(() => { load(); }, []);

  // ── Invite ────────────────────────────────────────────────────────────────

  const sendInvite = async () => {
    if (!invite.email.trim()) return;
    setSending(true);
    try {
      await api.post('/admin/invites', {
        email:                    invite.email.trim(),
        full_name:                invite.full_name.trim() || undefined,
        role:                     invite.role,
        member_role:              invite.member_role.trim() || undefined,
        receives_approval_emails: invite.receives_approval_emails,
      });
      pushToast({ type: 'success', title: 'Invite sent — copy the link below' });
      setInvite(EMPTY_INVITE);
      load();
    } catch (err) {
      pushToast({ type: 'error', title: err?.response?.data?.detail || 'Could not send invite' });
    } finally { setSending(false); }
  };

  // ── Invite actions ────────────────────────────────────────────────────────

  const copyLink = (link, id) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const revokeInvite = async (id) => {
    if (!window.confirm('Revoke this invite? The link will stop working immediately.')) return;
    try {
      await api.delete(`/admin/invites/${id}`);
      setInvites(prev => prev.filter(i => i.invite_id !== id));
      pushToast({ type: 'success', title: 'Invite revoked' });
    } catch (_) {
      pushToast({ type: 'error', title: 'Could not revoke invite' }); load();
    }
  };

  // ── User actions ──────────────────────────────────────────────────────────

  const removeUser = (u) => {
    if (u.user_id === me?.user_id) { pushToast({ type: 'error', title: 'You cannot remove yourself' }); return; }
    setDeleteTarget(u);
  };

  const confirmDeleteUser = async (u, reassignTo) => {
    try {
      const params = reassignTo ? `?reassign_to=${reassignTo}` : '';
      await api.delete(`/admin/users/${u.user_id}${params}`);
      setUsers(prev => prev.filter(x => x.user_id !== u.user_id));
      setDeleteTarget(null);
      pushToast({ type: 'success', title: `${u.full_name || u.email} removed` });
    } catch (e) {
      pushToast({ type: 'error', title: e?.response?.data?.detail || 'Could not remove user' });
    }
  };

  const handleUserSaved = (updated) => {
    setUsers(prev => prev.map(u => u.user_id === updated.user_id ? updated : u));
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const pendingInvites  = invites.filter(i => !i.accepted_at && new Date(i.expires_at) > new Date());
  const roleCounts      = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  const labelSt = { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' };

  return (
    <div className="k-screen">
      {/* Edit slide-over */}
      {editUser && (
        <EditSlideOver
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={handleUserSaved}
          pushToast={pushToast}
        />
      )}

      {/* Delete user modal */}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          otherUsers={users.filter(u => u.user_id !== deleteTarget.user_id && u.user_id !== me?.user_id)}
          onConfirm={confirmDeleteUser}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <PageHeader kicker="SETTINGS · ADMIN" title="Admin" sanskrit="प्रशासन" lede="Workspace members, invites, and account settings." />

      {/* Stats strip */}
      <div className="k-stats">
        <StatTile variant="blue"  label="TOTAL"   sanskrit="सदस्य"   value={users.length}            sub="workspace users" />
        <StatTile variant="teal"  label="MEMBERS"  sanskrit="सहयोगी"  value={roleCounts['member'] || 0} sub="active" />
        <StatTile variant="amber" label="PENDING"  sanskrit="लंबित"   value={pendingInvites.length}    sub="invites" />
        <StatTile variant="red"   label="CLIENTS"  sanskrit="ग्राहक"  value={roleCounts['client'] || 0} sub="portal access" />
      </div>

      {/* ── Invite form ── */}
      <div className="k-card" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="k-card__head">
          <span className="k-card__title">New Invite</span>
          <span className="k-card__sans">आमंत्रण</span>
        </div>

        {/* Row 1: Full Name | Email | Account Type */}
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '35% 40% 25%', marginBottom: 10 }}>
          <div>
            <label style={labelSt}>Full Name</label>
            <input className="k-input" value={invite.full_name}
              onChange={e => setInvite(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Doe" />
          </div>
          <div>
            <label style={labelSt}>Email Address</label>
            <input className="k-input" type="email" value={invite.email}
              onChange={e => setInvite(f => ({ ...f, email: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              placeholder="jane@company.com" />
          </div>
          <div>
            <label style={labelSt}>Account Type</label>
            <select className="k-select" style={{ width: '100%' }} value={invite.role}
              onChange={e => setInvite(f => ({ ...f, role: e.target.value }))}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="client">Client</option>
            </select>
          </div>
        </div>

        {/* Row 2: Job Title | Client Approval (conditional) | Send button */}
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '35% 1fr auto', alignItems: 'end' }}>
          <div>
            <label style={labelSt}>Job Title / Role</label>
            <input className="k-input" value={invite.member_role}
              onChange={e => setInvite(f => ({ ...f, member_role: e.target.value }))}
              placeholder="e.g. Project Stakeholder" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 2 }}>
            {invite.role === 'client' ? (
              <div style={{ padding: '10px 14px', background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--rule-soft)', width: '100%' }}>
                <Toggle
                  checked={invite.receives_approval_emails}
                  onChange={v => setInvite(f => ({ ...f, receives_approval_emails: v }))}
                  label={`Client Approval Emails: ${invite.receives_approval_emails ? 'Yes' : 'No'}`}
                />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', paddingLeft: 4 }}>
                Client Approval toggle available when Account Type = Client
              </div>
            )}
          </div>

          <button className="k-btn k-btn--primary" onClick={sendInvite}
            disabled={sending || !invite.email.trim()} style={{ height: 38 }}>
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </div>

      {/* ── Pending invites ── */}
      <div className="k-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Pending Invites</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg-soft)', borderRadius: 99, padding: '2px 8px' }}>
            {pendingInvites.length} pending
          </span>
        </div>

        {pendingInvites.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
            No pending invites
          </div>
        ) : pendingInvites.map(inv => {
          const daysLeft = Math.ceil((new Date(inv.expires_at) - new Date()) / 86_400_000);
          return (
            <div key={inv.invite_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px dashed var(--rule-soft)' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(5,183,170,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✉</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                  {inv.full_name || inv.email}
                </div>
                {inv.full_name && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{inv.email}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <RolePill role={inv.role} />
                  {inv.member_role && (
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{inv.member_role}</span>
                  )}
                  {inv.role === 'client' && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                      background: inv.receives_approval_emails ? 'rgba(5,183,170,.12)' : 'var(--bg-soft)',
                      color: inv.receives_approval_emails ? 'var(--k-primary)' : 'var(--ink-faint)' }}>
                      {inv.receives_approval_emails ? '✓ Approval emails on' : 'Approval emails off'}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: daysLeft <= 1 ? 'var(--danger)' : 'var(--ink-faint)' }}>
                    Expires in {daysLeft}d
                  </span>
                  {inv.invited_by_name && (
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>· by {inv.invited_by_name}</span>
                  )}
                </div>
              </div>
              <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => copyLink(inv.invite_link, inv.invite_id)}>
                {copiedId === inv.invite_id ? '✓ Copied!' : 'Copy link'}
              </button>
              <button className="k-btn k-btn--ghost k-btn--sm" style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                onClick={() => revokeInvite(inv.invite_id)}>
                Revoke
              </button>
            </div>
          );
        })}
      </div>

      {/* ── All Users ── */}
      <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>All Users</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg-soft)', borderRadius: 99, padding: '2px 8px' }}>{users.length} total</span>
        </div>

        {users.map((u, i) => {
          const isSelf      = u.user_id === me?.user_id;
          const displayName = u.full_name || u.name || u.email || '?';
          const joined      = u.created_at
            ? new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : null;

          return (
            <div key={u.user_id} style={{ padding: '16px 20px', borderBottom: '1px dashed var(--rule-soft)' }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <UserAvatar user={u} index={i} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {displayName}
                    {isSelf && <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 400 }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {u.email}
                    {u.member_role && <span style={{ color: 'var(--ink-faint)' }}> · {u.member_role}</span>}
                    {u.company_name && <span style={{ color: 'var(--ink-faint)' }}> @ {u.company_name}</span>}
                  </div>
                </div>
                <RolePill role={u.role} />

                {/* Edit button */}
                <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setEditUser(u)} title="Edit user">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-9 9H2v-3L11 2z"/></svg>
                  Edit
                </button>

                {/* Remove button */}
                <button className="k-iconbtn" style={{ color: 'var(--danger)', opacity: isSelf ? 0.3 : 1 }}
                  onClick={() => removeUser(u)} disabled={isSelf} title="Remove user">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"/></svg>
                </button>
              </div>

              {/* Detail strip — always visible */}
              <div style={{ marginTop: 10, marginLeft: 52, display: 'flex', flexWrap: 'wrap', gap: '6px 20px',
                padding: '10px 14px', background: 'var(--bg-soft)', borderRadius: 8 }}>
                {[
                  { label: 'User ID',          value: u.user_id,     mono: true },
                  { label: 'Provider',         value: u.provider || 'local' },
                  { label: 'Position',         value: u.position },
                  { label: 'Company',          value: u.company_name },
                  { label: 'Job title',        value: u.member_role },
                  { label: 'Approval emails',  value: u.role === 'client' ? (u.receives_approval_emails !== false ? 'Yes' : 'No') : null },
                  { label: 'Joined',           value: joined },
                ].map(f => !f.value ? null : (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-faint)', marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: f.mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
