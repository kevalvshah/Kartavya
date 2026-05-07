import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { K } from '../lib/brand';
import { RoleBadge } from '../lib/brand';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { useToast } from '../components/ui/toast';
import { Mail, Copy, Check, Trash2 } from 'lucide-react';

export default function AdminPage() {
  const { pushToast } = useToast();
  const [users,       setUsers]       = useState([]);
  const [invites,     setInvites]     = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('member');
  const [sending,     setSending]     = useState(false);
  const [copiedId,    setCopiedId]    = useState(null);

  const load = () => Promise.all([
    api.get('/admin/users').then((r) => setUsers(r.data)).catch(() => {}),
    api.get('/admin/invites').then((r) => setInvites(r.data)).catch(() => {}),
  ]);
  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      await api.post('/admin/invites', { email: inviteEmail.trim(), role: inviteRole });
      pushToast({ type: 'success', title: 'Invite created — copy link below' });
      setInviteEmail(''); load();
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
    if (!window.confirm(`Remove ${u.name} (${u.email})? This cannot be undone.`)) return;
    await api.delete(`/admin/users/${u.user_id}`).catch(() => {});
    pushToast({ type: 'success', title: 'User removed' }); load();
  };

  const changeRole = async (u, role) => {
    try {
      await api.put(`/admin/users/${u.user_id}/role`, { role });
      setUsers((prev) => prev.map((x) => x.user_id === u.user_id ? { ...x, role } : x));
    } catch (_) { pushToast({ type: 'error', title: 'Could not change role' }); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={16} style={{ color: K.blue }} />
          <div className="text-sm font-bold">Send Invite</div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_160px_120px]">
          <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
            placeholder="client@company.com" type="email" />
          <Select value={inviteRole} onChange={setInviteRole}
            options={[{ value: 'member', label: 'Member' }, { value: 'client', label: 'Client' }]} />
          <Button onClick={sendInvite} disabled={sending}>{sending ? 'Sending…' : 'Send Invite'}</Button>
        </div>
      </div>

      {invites.filter((i) => !i.accepted_at).length > 0 && (
        <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 text-sm font-bold">Pending Invites</div>
          {invites.filter((i) => !i.accepted_at).map((inv) => (
            <div key={inv.invite_id} className="flex items-center gap-3 border-b border-border/40 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{inv.email}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <RoleBadge role={inv.role} />
                  <span>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => copyLink(inv.invite_link, inv.invite_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border/60 hover:bg-muted/40 transition-colors whitespace-nowrap">
                {copiedId === inv.invite_id ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy link</>}
              </button>
              <Button variant="ghost" onClick={() => revokeInvite(inv.invite_id)} className="px-2 h-8 shrink-0"><Trash2 size={13} /></Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="text-sm font-bold">All Users</div>
          <div className="text-xs text-muted-foreground">{users.length} total</div>
        </div>
        {users.map((u) => (
          <div key={u.user_id} className="flex items-center gap-3 border-b border-border/40 px-5 py-4">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {(u.name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{u.full_name || u.name}</div>
              <div className="text-xs text-muted-foreground truncate">{u.email}</div>
            </div>
            <RoleBadge role={u.role} />
            <div className="w-32 shrink-0">
              <Select value={u.role} onChange={(role) => changeRole(u, role)}
                options={[{ value: 'admin', label: 'Admin' }, { value: 'member', label: 'Member' }, { value: 'client', label: 'Client' }]} />
            </div>
            <Button variant="ghost" onClick={() => removeUser(u)} className="px-2 h-8 shrink-0"><Trash2 size={13} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
