/**
 * AdminPage — enhanced invite form + user profile display
 * Fixes:
 *   1. Invite form now collects full_name, position, company_name, member_role, receives_approval_emails
 *   2. User list shows full_name, position/company or member_role
 *   3. Assignment picker in TaskEditor shows full_name + role, not email
 */
import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

// ── brand colours (keep in sync with App.js K object) ────────────────────────
const K = {
  blue: "#0082c6", mid: "#03a1b6", teal: "#05b7aa",
  gradD: "linear-gradient(135deg,#0082c6,#05b7aa)",
};

function RoleBadge({ role }) {
  const cfg = {
    admin:  { bg: "#0082c622", color: "#0082c6", label: "Admin" },
    member: { bg: "#05b7aa22", color: "#05b7aa", label: "Member" },
    client: { bg: "#8b5cf622", color: "#8b5cf6", label: "Client" },
  }[role] || { bg: "#88888822", color: "#888", label: role };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase",
      background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

// Shared field styles
const inp = {
  width: "100%", padding: "9px 12px", background: "var(--color-input, #f4fafd)",
  border: "1px solid var(--color-border, #d0e8f5)", borderRadius: 8, fontSize: 13,
  color: "var(--color-foreground, #0a1628)", outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
};
const lbl = {
  display: "block", fontSize: 10, fontWeight: 600, letterSpacing: 2,
  textTransform: "uppercase", color: "var(--color-muted-foreground, #5a7087)", marginBottom: 5,
};

export default function AdminPage() {
  const [users,   setUsers]   = useState([]);
  const [invites, setInvites] = useState([]);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [changingRole, setChangingRole] = useState(null);

  // ── Invite form state ──────────────────────────────────────────────────────
  const [inv, setInv] = useState({
    email: "",
    role: "member",
    full_name: "",
    position: "",
    company_name: "",
    member_role: "",
    receives_approval_emails: true,
  });
  const setF = (k, v) => setInv(p => ({ ...p, [k]: v }));

  // ── Edit profile modal ────────────────────────────────────────────────────
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => Promise.all([
    api.get("/admin/users").then(r => setUsers(r.data)).catch(() => {}),
    api.get("/admin/invites").then(r => setInvites(r.data)).catch(() => {}),
  ]);
  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!inv.email.trim() || !inv.full_name.trim()) {
      alert("Email and Full Name are required.");
      return;
    }
    setSending(true);
    try {
      await api.post("/admin/invites", {
        email:      inv.email.trim().toLowerCase(),
        role:       inv.role,
        full_name:  inv.full_name.trim(),
        position:   inv.role === "client" ? (inv.position.trim() || null)  : null,
        company_name: inv.role === "client" ? (inv.company_name.trim() || null) : null,
        member_role: inv.role === "member"  ? (inv.member_role.trim() || null)  : null,
        receives_approval_emails: inv.role === "client" ? inv.receives_approval_emails : false,
      });
      setInv({ email:"", role:"member", full_name:"", position:"", company_name:"", member_role:"", receives_approval_emails:true });
      load();
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not create invite.");
    } finally { setSending(false); }
  };

  const copyLink = (link, id) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };
  const revokeInvite = async (id) => {
    await api.delete(`/admin/invites/${id}`).catch(() => {});
    load();
  };
  const removeUser = async (u) => {
    if (!window.confirm(`Remove ${u.full_name || u.name} (${u.email})? This cannot be undone.`)) return;
    await api.delete(`/admin/users/${u.user_id}`).catch(() => {});
    load();
  };
  const changeRole = async (u, role) => {
    setChangingRole(u.user_id);
    try {
      await api.put(`/admin/users/${u.user_id}/role`, { role });
      setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, role } : x));
    } catch (_) {}
    finally { setChangingRole(null); }
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setEditForm({
      full_name:   u.full_name || u.name || "",
      position:    u.position || "",
      company_name: u.company_name || "",
      member_role: u.member_role || "",
      receives_approval_emails: u.receives_approval_emails ?? true,
    });
  };
  const saveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await api.put(`/admin/users/${editingUser.user_id}/profile`, {
        full_name:   editForm.full_name.trim() || null,
        position:    editForm.position.trim()  || null,
        company_name:editForm.company_name.trim() || null,
        member_role: editForm.member_role.trim() || null,
        receives_approval_emails: editForm.receives_approval_emails,
      });
      setUsers(prev => prev.map(x => x.user_id === editingUser.user_id
        ? { ...x, ...editForm, name: editForm.full_name || x.name }
        : x
      ));
      setEditingUser(null);
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not update profile.");
    } finally { setSavingEdit(false); }
  };

  const btnStyle = {
    primary:  { padding:"9px 18px", background:K.gradD, border:"none", borderRadius:8, fontSize:12, fontWeight:600, color:"#fff", cursor:"pointer", letterSpacing:1, textTransform:"uppercase" },
    ghost:    { padding:"7px 14px", background:"transparent", border:"1px solid var(--color-border,#d0e8f5)", borderRadius:8, fontSize:12, fontWeight:600, color:"var(--color-foreground,#0a1628)", cursor:"pointer" },
    danger:   { padding:"7px 12px", background:"transparent", border:"1px solid #ef4444", borderRadius:8, fontSize:12, fontWeight:600, color:"#ef4444", cursor:"pointer" },
    teal:     { padding:"7px 14px", background:"transparent", border:`1px solid ${K.teal}`, borderRadius:8, fontSize:12, fontWeight:600, color:K.teal, cursor:"pointer" },
  };

  const card = { borderRadius:16, border:"1px solid var(--color-border,#e2e8f0)", background:"var(--color-card,#fff)", padding:"20px 24px", marginBottom:20 };

  return (
    <div style={{ maxWidth:860, margin:"0 auto", fontFamily:"'Nunito',sans-serif" }}>

      {/* ── INVITE FORM ── */}
      <div style={card}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
          ✉️ Invite User
        </div>

        {/* Row 1: role toggle */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>User type</label>
          <div style={{ display:"flex", gap:8 }}>
            {["member","client","admin"].map(r => (
              <button key={r} onClick={() => setF("role", r)}
                style={{ ...btnStyle.ghost, background:inv.role===r?K.gradD:"transparent", color:inv.role===r?"#fff":undefined, border:inv.role===r?"none":undefined }}>
                {r.charAt(0).toUpperCase()+r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Full name + email */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={lbl}>Full Name <span style={{ color:"#ef4444" }}>*</span></label>
            <input style={inp} value={inv.full_name} onChange={e=>setF("full_name",e.target.value)} placeholder="John Doe" />
          </div>
          <div>
            <label style={lbl}>Email <span style={{ color:"#ef4444" }}>*</span></label>
            <input style={inp} type="email" value={inv.email} onChange={e=>setF("email",e.target.value)} placeholder="john@company.com" />
          </div>
        </div>

        {/* Client-only fields */}
        {inv.role === "client" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Position</label>
                <input style={inp} value={inv.position} onChange={e=>setF("position",e.target.value)} placeholder="Senior Manager" />
              </div>
              <div>
                <label style={lbl}>Company Name</label>
                <input style={inp} value={inv.company_name} onChange={e=>setF("company_name",e.target.value)} placeholder="Acme Corporation" />
              </div>
            </div>
            <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:10, background:"#fef3c7", border:"1px solid #fbbf24" }}>
              <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer" }}>
                <input type="checkbox" style={{ marginTop:2, width:16, height:16 }}
                  checked={inv.receives_approval_emails}
                  onChange={e=>setF("receives_approval_emails",e.target.checked)} />
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#78350f" }}>
                    Receives client approval emails
                  </div>
                  <div style={{ fontSize:12, color:"#92400e", marginTop:3, fontWeight:400 }}>
                    This client will get email notifications when tasks need their approval.
                    Can be changed later in their profile.
                  </div>
                </div>
              </label>
            </div>
          </>
        )}

        {/* Member-only: role */}
        {inv.role === "member" && (
          <div style={{ marginBottom:12 }}>
            <label style={lbl}>Role / Title</label>
            <select style={{ ...inp, cursor:"pointer" }} value={inv.member_role} onChange={e=>setF("member_role",e.target.value)}>
              <option value="">Select role…</option>
              {["Developer","Designer","Project Manager","QA Engineer","DevOps","Copywriter","Strategist","Other"].map(r=>(
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        <button style={btnStyle.primary} onClick={sendInvite} disabled={sending}>
          {sending ? "Sending…" : "Send Invite"}
        </button>
        <p style={{ marginTop:8, fontSize:11, color:"var(--color-muted-foreground,#5a7087)", fontWeight:400 }}>
          Clients see only tasks shared with them. Members get full workspace access. Admins manage users and settings.
        </p>
      </div>

      {/* ── PENDING INVITES ── */}
      {invites.filter(i=>!i.accepted_at).length > 0 && (
        <div style={card}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:16 }}>⏳ Pending Invites</div>
          {invites.filter(i=>!i.accepted_at).map(inv => (
            <div key={inv.invite_id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--color-border,#e2e8f0)" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>
                  {inv.full_name ? `${inv.full_name} ` : ""}<span style={{ fontWeight:400, color:"var(--color-muted-foreground,#5a7087)" }}>({inv.email})</span>
                </div>
                <div style={{ fontSize:11, color:"var(--color-muted-foreground,#5a7087)", marginTop:3, display:"flex", gap:8, alignItems:"center" }}>
                  <RoleBadge role={inv.role} />
                  <span>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => copyLink(inv.invite_link, inv.invite_id)} style={btnStyle.ghost}>
                {copiedId===inv.invite_id ? "✓ Copied" : "Copy link"}
              </button>
              <button onClick={() => revokeInvite(inv.invite_id)} style={btnStyle.danger}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      {/* ── ALL USERS ── */}
      <div style={card}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span>👥 All Users</span>
          <span style={{ fontSize:11, color:"var(--color-muted-foreground,#5a7087)", fontWeight:400 }}>{users.length} total</span>
        </div>
        {users.map(u => {
          const displayName = u.full_name || u.name || u.email;
          const subtitle = u.role === "client"
            ? [u.position, u.company_name].filter(Boolean).join(" · ") || u.email
            : [u.member_role, u.email].filter(Boolean).join(" · ");
          return (
            <div key={u.user_id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:"1px solid var(--color-border,#e2e8f0)" }}>
              {/* Avatar */}
              <div style={{ width:36, height:36, borderRadius:"50%", background:K.gradD, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, color:"#fff", flexShrink:0 }}>
                {displayName[0].toUpperCase()}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
                  {displayName}
                  {u.role === "client" && u.receives_approval_emails && (
                    <span style={{ fontSize:10, background:"#fef3c7", color:"#92400e", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>
                      approval emails ✓
                    </span>
                  )}
                </div>
                <div style={{ fontSize:11, color:"var(--color-muted-foreground,#5a7087)", marginTop:2, fontWeight:400 }}>{subtitle}</div>
              </div>
              <RoleBadge role={u.role} />
              {/* Role change */}
              <select value={u.role} onChange={e=>changeRole(u,e.target.value)} disabled={!!changingRole}
                style={{ ...inp, width:110, padding:"6px 8px", cursor:"pointer" }}>
                {["admin","member","client"].map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
              {/* Edit profile */}
              <button onClick={() => openEdit(u)} style={btnStyle.teal}>Edit</button>
              <button onClick={() => removeUser(u)} style={btnStyle.danger}>✕</button>
            </div>
          );
        })}
      </div>

      {/* ── EDIT PROFILE MODAL ── */}
      {editingUser && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => e.target===e.currentTarget && setEditingUser(null)}>
          <div style={{ background:"var(--color-card,#fff)", borderRadius:16, padding:28, width:460, boxShadow:"0 12px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:18 }}>
              Edit Profile — {editingUser.email}
            </div>
            <div style={{ display:"grid", gap:12 }}>
              <div>
                <label style={lbl}>Full Name</label>
                <input style={inp} value={editForm.full_name} onChange={e=>setEditForm(p=>({...p,full_name:e.target.value}))} />
              </div>
              {editingUser.role === "client" && (
                <>
                  <div>
                    <label style={lbl}>Position</label>
                    <input style={inp} value={editForm.position} onChange={e=>setEditForm(p=>({...p,position:e.target.value}))} placeholder="Senior Manager" />
                  </div>
                  <div>
                    <label style={lbl}>Company Name</label>
                    <input style={inp} value={editForm.company_name} onChange={e=>setEditForm(p=>({...p,company_name:e.target.value}))} placeholder="Acme Corp" />
                  </div>
                  <div style={{ padding:"12px 14px", borderRadius:10, background:"#fef3c7", border:"1px solid #fbbf24" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                      <input type="checkbox" style={{ width:16, height:16 }}
                        checked={editForm.receives_approval_emails}
                        onChange={e=>setEditForm(p=>({...p,receives_approval_emails:e.target.checked}))} />
                      <span style={{ fontSize:13, fontWeight:600, color:"#78350f" }}>Receives client approval emails</span>
                    </label>
                  </div>
                </>
              )}
              {editingUser.role === "member" && (
                <div>
                  <label style={lbl}>Role / Title</label>
                  <select style={{ ...inp, cursor:"pointer" }} value={editForm.member_role} onChange={e=>setEditForm(p=>({...p,member_role:e.target.value}))}>
                    <option value="">Select…</option>
                    {["Developer","Designer","Project Manager","QA Engineer","DevOps","Copywriter","Strategist","Other"].map(r=>(
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
              <button style={btnStyle.ghost} onClick={()=>setEditingUser(null)}>Cancel</button>
              <button style={btnStyle.primary} onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
