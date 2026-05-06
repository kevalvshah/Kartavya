/**
 * App.js — Kartavya by Aekam Inc
 * v2-plan branch — wires v2 page components into the router.
 * All legacy pages remain inline; v2 pages imported from pages/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useLocation, useNavigate, useParams, Outlet,
} from "react-router-dom";
import "./App.css";
import "./lib/tokens.css";
import "./styles/layout.css";
import "./styles/modern-components.css";
import "./styles/dark-theme.css";
import "./styles/animations.css";
import "./styles/mobile-responsive.css";
import { cn } from "./lib/utils";
import { api } from "./lib/api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Modal } from "./components/ui/modal";
import { Badge } from "./components/ui/badge";
import { ToastProvider, useToast } from "./components/ui/toast";
import TeamsPage from "./pages/TeamsPage";
import NotificationsSettingsPage from "./pages/NotificationsSettingsPage";
import { NotificationsModal } from "./components/NotificationsModal";
// ── v2 pages ──────────────────────────────────────────────────────────────────
import V2DashboardPage  from "./pages/DashboardPage";
import ActivityFeedPage from "./pages/ActivityFeedPage";
import AutomationsPage  from "./pages/AutomationsPage";
import TimeReportPage   from "./pages/TimeReportPage";
import ProjectBoardPageV2 from "./pages/ProjectBoardPage";
import {
  Bell, FolderKanban, LayoutGrid, ListTodo, LogOut,
  Plus, Settings, Sun, Moon, Users, ShieldCheck, Trash2,
  Copy, Check, Mail, ChevronRight, GripVertical,
  Pencil, Calendar, BarChart3, AlignLeft, Kanban,
  X, CheckCircle2, Menu, Activity, Clock, Zap,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// ── Brand ─────────────────────────────────────────────────────────────────────
const K = {
  blue:  "#0082c6",
  mid:   "#03a1b6",
  teal:  "#05b7aa",
  dark:  "#050e1a",
  card:  "#0b1829",
  grad:  "linear-gradient(90deg,#0082c6,#03a1b6,#05b7aa)",
  gradD: "linear-gradient(135deg,#0082c6,#05b7aa)",
};

function KLogo({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: K.gradD,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 22 22" fill="none">
        <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/>
        <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/>
      </svg>
    </div>
  );
}

function KWordmark({ dark = false, size = "md" }) {
  const fs = size === "sm" ? 11 : 14;
  const sub = size === "sm" ? 7 : 8;
  return (
    <div>
      <div style={{ fontSize: fs, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase",
        color: dark ? "#fff" : K.dark }}>Kartavya</div>
      <div style={{ fontSize: sub, letterSpacing: 2.5, textTransform: "uppercase",
        color: K.teal, fontWeight: 700, marginTop: 1 }}>by Aekam Inc</div>
    </div>
  );
}

function RoleBadge({ role }) {
  const cfg = {
    admin:  { bg: "#0082c622", color: "#0082c6", label: "Admin" },
    member: { bg: "#05b7aa22", color: "#05b7aa", label: "Member" },
    client: { bg: "#8b5cf622", color: "#8b5cf6", label: "Client" },
  }[role] || { bg: "#88888822", color: "#888", label: role };
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
      background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("kartavya_theme") || "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("kartavya_theme", theme);
  }, [theme]);
  return { theme, setTheme };
}

function formatDue(v) {
  if (!v) return "";
  return new Date(v).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function toLocal(v) {
  if (!v) return "";
  const d = new Date(v), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocal(v) { return v ? new Date(v).toISOString() : null; }

function approvalBadgeStyle(status) {
  switch (status) {
    case "pending":         return { label: "Pending owner", bg: "rgba(245,158,11,0.15)", color: "#f59e0b" };
    case "pending_client":  return { label: "Pending client", bg: "rgba(139,92,246,0.15)", color: "#8b5cf6" };
    case "approved":        return { label: "Approved", bg: "rgba(16,185,129,0.15)", color: "#10b981" };
    case "rejected":        return { label: "Rejected", bg: "rgba(239,68,68,0.15)", color: "#ef4444" };
    default: return null;
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function apiLogin(email, password) {
  const res = await api.post("/auth/login", { email, password });
  localStorage.setItem("auth_token", res.data.token);
  localStorage.setItem("kartavya_user", JSON.stringify(res.data.user));
  return res.data;
}
async function apiAcceptInvite(token, name, password) {
  const res = await api.post("/auth/accept-invite", { token, name, password });
  localStorage.setItem("auth_token", res.data.token);
  localStorage.setItem("kartavya_user", JSON.stringify(res.data.user));
  return res.data;
}
async function apiLogout() {
  try { await api.post("/auth/logout"); } catch (_) {}
  localStorage.removeItem("auth_token");
  localStorage.removeItem("kartavya_user");
}
function currentUser() {
  try { return JSON.parse(localStorage.getItem("kartavya_user") || "null"); } catch { return null; }
}

// ── Auth styles ───────────────────────────────────────────────────────────────
const authInput = {
  width: "100%", padding: "11px 14px", background: "#f4fafd",
  border: "1.5px solid #d0e8f5", borderRadius: 8, fontSize: 14,
  color: "#0a1628", outline: "none", boxSizing: "border-box",
};
const authLabel = {
  display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 2,
  textTransform: "uppercase", color: "#5a7087", marginBottom: 6,
};
const authBtn = {
  width: "100%", padding: 13, background: K.grad, border: "none",
  borderRadius: 8, fontSize: 12, fontWeight: 800, color: "#fff",
  cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", marginTop: 4,
};

function AuthShell({ children, title, sub }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter',sans-serif", background: "#f4fafd" }}>
      <div style={{ width: 420, background: K.dark, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: 44, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <KLogo size={36} /><KWordmark dark />
        </div>
        <div>
          <h2 style={{ color: "#fff", fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 12, letterSpacing: -0.5 }}>{title}</h2>
          <p style={{ color: "#8aa5be", fontSize: 13, lineHeight: 1.7 }}>{sub}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["Custom Kanban columns per project", "Client portal with restricted access",
            "Invite-only — no public sign-ups", "4 board views: Kanban, List, Schedule, Tracker"].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 20, height: 2, background: K.grad, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#8aa5be" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "48px 60px", maxWidth: 520, background: "#fff" }}>
        {children}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          paddingTop: 18, marginTop: 18, borderTop: "1px solid #d0e8f5",
          fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase" }}>
          <span style={{ color: "#b8cedd", fontWeight: 700 }}>Powered by</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: K.teal }} />
          <span style={{ color: K.mid, fontWeight: 800 }}>Aekam Inc</span>
        </div>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const data = await apiLogin(form.email, form.password);
      navigate(data.user?.role === "client" ? "/client" : "/dashboard", { replace: true });
    } catch (err) {
      pushToast({ type: "error", title: "Sign in failed", message: err?.response?.data?.detail || "Check your credentials." });
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      title={<>Do what<br /><span style={{ background: K.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>must be done.</span></>}
      sub="Team task management built for agencies and founders. Invite-only access."
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: "uppercase", color: K.mid, marginBottom: 8 }}>Welcome back</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>
          Sign in to<br /><span style={{ color: K.blue }}>Kartavya</span>
        </h1>
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>Email</label>
          <input name="email" type="email" value={form.email} onChange={set} required placeholder="you@example.com" style={authInput} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>Password</label>
          <input name="password" type="password" value={form.password} onChange={set} required placeholder="••••••••••" style={authInput} />
        </div>
        <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p style={{ textAlign: "center", fontSize: 12, color: "#8aa5be", marginTop: 20 }}>
        Access is invite-only. Contact your admin to get access.
      </p>
    </AuthShell>
  );
}

// ── Accept Invite ─────────────────────────────────────────────────────────────
function AcceptInvitePage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const token = params.get("token") || "";
  const [form, setForm] = useState({ name: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  if (!token) return (
    <AuthShell title="Invalid link" sub="This invite link is missing a token.">
      <p style={{ color: "#e74c3c", fontSize: 14 }}>No invite token found. Please ask your admin for a new link.</p>
    </AuthShell>
  );

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { pushToast({ type: "error", title: "Passwords don't match" }); return; }
    if (form.password.length < 8) { pushToast({ type: "error", title: "Password too short", message: "Minimum 8 characters." }); return; }
    setLoading(true);
    try {
      const data = await apiAcceptInvite(token, form.name, form.password);
      pushToast({ type: "success", title: "Welcome to Kartavya!" });
      navigate(data.user?.role === "client" ? "/client" : "/dashboard", { replace: true });
    } catch (err) {
      pushToast({ type: "error", title: "Could not accept invite", message: err?.response?.data?.detail || "Link may have expired." });
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      title={<>You've been<br /><span style={{ background: K.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>invited.</span></>}
      sub="Set your name and password to activate your account."
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: "uppercase", color: K.mid, marginBottom: 8 }}>Create your account</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>
          Join<br /><span style={{ color: K.blue }}>Kartavya</span>
        </h1>
      </div>
      <form onSubmit={submit}>
        {[
          { label: "Your name", name: "name", type: "text", ph: "Keval Shah" },
          { label: "Password", name: "password", type: "password", ph: "At least 8 characters" },
          { label: "Confirm password", name: "confirm", type: "password", ph: "••••••••••" },
        ].map(({ label, name, type, ph }) => (
          <div key={name} style={{ marginBottom: 14 }}>
            <label style={authLabel}>{label}</label>
            <input name={name} type={type} value={form[name]} onChange={set} required placeholder={ph} style={authInput} />
          </div>
        ))}
        <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Activating…" : "Activate Account"}
        </button>
      </form>
      <p style={{ textAlign: "center", fontSize: 13, color: "#5a7087", marginTop: 14 }}>
        Already have an account? <span onClick={() => navigate("/login")} style={{ color: K.blue, fontWeight: 800, cursor: "pointer" }}>Sign in</span>
      </p>
    </AuthShell>
  );
}

// ── Protected wrapper ─────────────────────────────────────────────────────────
function Protected({ children, requiredRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let live = true;
    if (!localStorage.getItem("auth_token")) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
      setReady(false); return;
    }
    api.get("/auth/me")
      .then((r) => {
        if (!live) return;
        window.__kartavya_user = r.data;
        localStorage.setItem("kartavya_user", JSON.stringify(r.data));
        setUser(r.data); setReady(true);
      })
      .catch(() => {
        if (!live) return;
        localStorage.removeItem("auth_token");
        navigate("/login", { replace: true });
        setReady(false);
      });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ready === null) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050e1a" }}>
      <div style={{ textAlign: "center" }}>
        <KLogo size={40} />
        <div style={{ marginTop: 16, fontSize: 13, color: "#5a7087", fontFamily: "'Inter',sans-serif" }}>Loading Kartavya…</div>
      </div>
    </div>
  );
  if (!ready) return null;
  if (requiredRole && user?.role !== requiredRole && user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

// ── App shell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const location = useLocation();

  useEffect(() => {
    api.get("/teams").then(r => setTeams(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        await api.post("/notifications/process");
        const r = await api.get("/notifications", { params: { unread_only: true } });
        if (live) setUnread(r.data.length);
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => { live = false; clearInterval(id); };
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Extract current teamId from URL for v2 pages that need it
  const teamId = location.pathname.match(/\/projects\/([^/]+)/)?.[1] || teams[0]?.team_id || "";

  return (
    <div data-testid="app-shell" className="min-h-screen bg-app text-foreground" style={{ fontFamily: "'Inter',sans-serif" }}>
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-4 lg:py-6">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="hidden lg:block"><Sidebar /></div>
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-card shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <Sidebar />
              </div>
            </div>
          )}
          <main className="min-w-0">
            <div className="lg:hidden flex items-center justify-between mb-3">
              <button onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl border border-border/60 bg-card/50">
                <Menu size={18} />
              </button>
              <KWordmark size="sm" />
              <button onClick={() => setNotifOpen(true)}
                className="p-2 rounded-xl border border-border/60 bg-card/50 relative">
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full text-[10px] flex items-center justify-center"
                    style={{ background: "#ef4444", color: "#fff", fontWeight: 500 }}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </div>
            <div className="hidden lg:block">
              <Topbar unread={unread} onOpenNotifications={() => setNotifOpen(true)} />
            </div>
            <div className="mt-4 lg:mt-6">
              <Outlet context={{ teamId, teams }} />
            </div>
          </main>
        </div>
      </div>
      <NotificationsModal open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const user = currentUser();
  const isAdmin = user?.role === "admin";
  const isClient = user?.role === "client";

  const nav = isClient
    ? [
        { to: "/client/projects",        label: "My Projects",   Icon: FolderKanban },
        { to: "/settings/notifications", label: "Notifications", Icon: Bell },
      ]
    : [
        { to: "/dashboard",              label: "Dashboard",     Icon: LayoutGrid },
        { to: "/projects",               label: "Projects",      Icon: FolderKanban },
        { to: "/tasks",                  label: "All Tasks",     Icon: ListTodo },
        { to: "/approvals",              label: "Approvals",     Icon: CheckCircle2 },
        { to: "/teams",                  label: "Teams",         Icon: Users },
        { to: "/activity",               label: "Activity",      Icon: Activity },
        { to: "/automations",            label: "Automations",   Icon: Zap },
        { to: "/time",                   label: "Time Report",   Icon: Clock },
        { to: "/settings/categories",    label: "Categories",    Icon: Settings },
        { to: "/settings/notifications", label: "Notifications", Icon: Bell },
        ...(isAdmin ? [{ to: "/admin",   label: "Admin",         Icon: ShieldCheck }] : []),
      ];

  return (
    <aside className="rounded-3xl border border-border/70 bg-card/50 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-48px)] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <KLogo size={34} /><KWordmark size="sm" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map(({ to, label, Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <button key={to} onClick={() => navigate(to)}
              className={cn("w-full rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-150 flex items-center gap-2.5",
                active ? "text-white shadow-sm" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}
              style={active ? { background: K.gradD } : {}}>
              <Icon size={15} />
              {label}
              {to === "/admin" && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: K.teal + "33", color: K.teal }}>admin</span>}
            </button>
          );
        })}
      </div>
      <div className="p-3 border-t border-border/60">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {(user?.name || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate">{user?.full_name || user?.name || "User"}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{user?.role || "member"}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ unread, onOpenNotifications }) {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const location = useLocation();

  const pageTitle = {
    "/dashboard":   "Dashboard",
    "/projects":    "Projects",
    "/tasks":       "All Tasks",
    "/teams":       "Teams",
    "/activity":    "Activity Feed",
    "/automations": "Automations",
    "/time":        "Time Report",
    "/settings/categories":    "Categories",
    "/settings/notifications": "Notifications",
    "/admin":  "Admin Panel",
    "/client": "Client Portal",
  }[location.pathname] || "Kartavya";

  const logout = async () => {
    await apiLogout();
    pushToast({ type: "success", title: "Signed out" });
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 px-5 py-3" style={{ background: K.dark }}>
      <div className="flex items-center gap-3">
        <KLogo size={28} />
        <div>
          <div className="text-sm font-bold text-white">{pageTitle}</div>
          <div className="text-xs" style={{ color: K.teal }}>Kartavya · Aekam Inc</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onOpenNotifications}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <Bell size={15} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: K.blue }}>{unread > 99 ? "99+" : unread}</span>
          )}
        </button>
        <button onClick={logout} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

// ── Wrapper components for v2 pages that need teamId from context ──────────────
import { useOutletContext } from "react-router-dom";

function ActivityFeedWrapper() {
  const { teamId } = useOutletContext();
  return <ActivityFeedPage teamId={teamId} />;
}
function AutomationsWrapper() {
  const { teamId } = useOutletContext();
  return <AutomationsPage teamId={teamId} />;
}
function DashboardWrapper() {
  const { teams } = useOutletContext();
  return <V2DashboardPage teams={teams} />;
}

// ── Router ────────────────────────────────────────────────────────────────────
function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/" element={<Protected><AppShell /></Protected>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<DashboardWrapper />} />
        <Route path="projects"   element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectBoardPageV2 />} />
        <Route path="tasks"      element={<TasksListPage />} />
        <Route path="teams"      element={<TeamsPage />} />
        <Route path="activity"   element={<ActivityFeedWrapper />} />
        <Route path="automations" element={<AutomationsWrapper />} />
        <Route path="time"       element={<TimeReportPage />} />
        <Route path="approvals"  element={<PendingApprovalsPage />} />
        <Route path="settings/categories"    element={<CategoriesPage />} />
        <Route path="settings/notifications" element={<NotificationsSettingsPage />} />
        <Route path="admin"      element={<AdminPage />} />
        <Route path="client"     element={<ClientProjectsPage />} />
        <Route path="client/projects" element={<ClientProjectsPage />} />
        <Route path="client/project/:projectId" element={<ClientProjectBoardPage />} />
      </Route>
      <Route path="/client/legacy" element={<Protected><ClientPortal /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, danger, accent }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/50 p-5"
      style={{ background: danger ? "linear-gradient(135deg,rgba(239,68,68,.08),transparent)" : accent ? `linear-gradient(135deg,${K.blue}14,transparent)` : undefined }}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight" style={{ color: danger ? "#ef4444" : accent ? K.blue : undefined }}>{value}</div>
    </div>
  );
}

// ── Projects ──────────────────────────────────────────────────────────────────
function ProjectsPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = () => api.get("/teams").then((r) => setProjects(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post("/teams", { name: name.trim() });
      setName(""); setShowNew(false);
      pushToast({ type: "success", title: "Project created" }); load();
    } catch (_) { pushToast({ type: "error", title: "Could not create project" }); }
    finally { setCreating(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete project "${p.name}"? All tasks in it will be deleted.`)) return;
    try { await api.delete(`/teams/${p.team_id}`); pushToast({ type: "success", title: "Project deleted" }); load(); }
    catch (_) { pushToast({ type: "error", title: "Could not delete" }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Projects</div>
          <div className="text-sm text-muted-foreground mt-0.5">Each project has its own customisable board.</div>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={15} /><span className="ml-1.5">New project</span></Button>
      </div>
      {showNew && (
        <div className="rounded-3xl border border-border/70 bg-card/50 p-5 flex gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Project name e.g. Website Redesign" autoFocus />
          <Button onClick={create} disabled={creating}>Create</Button>
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.length === 0 && (
          <div className="col-span-3 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No projects yet. Create your first one above.
          </div>
        )}
        {projects.map((p) => (
          <div key={p.team_id} className="rounded-3xl border border-border/70 bg-card/50 p-5 flex flex-col gap-3 hover:border-border transition-colors">
            <div className="flex items-start gap-3">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FolderKanban size={18} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Project · {new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => navigate(`/projects/${p.team_id}`)} className="flex-1">
                <LayoutGrid size={13} /><span className="ml-1.5">Open Board</span>
              </Button>
              <Button variant="ghost" onClick={() => remove(p)} className="px-2.5"><Trash2 size={13} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tasks list ────────────────────────────────────────────────────────────────
function TasksListPage() {
  const { pushToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [categories, setCats] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filters, setFilters] = useState({ status: "", category_id: "", q: "", team_id: "", assigned_to_me: false });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const p = {};
    if (filters.status) p.status = filters.status;
    if (filters.category_id) p.category_id = filters.category_id;
    if (filters.q) p.q = filters.q;
    if (filters.team_id) p.team_id = filters.team_id;
    if (filters.assigned_to_me) p.assigned_to_me = true;
    const [t, c, te] = await Promise.all([api.get("/tasks", { params: p }), api.get("/categories"), api.get("/teams")]);
    setTasks(t.data); setCats(c.data); setTeams(te.data);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load tasks" })); }, []);
  useEffect(() => { const id = setTimeout(() => load().catch(() => {}), 250); return () => clearTimeout(id); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.status, filters.category_id, filters.q, filters.team_id, filters.assigned_to_me]);

  const toggle = async (task) => {
    try { const r = await api.patch(`/tasks/${task.task_id}/toggle`); setTasks((p) => p.map((t) => t.task_id === task.task_id ? r.data : t)); }
    catch (_) { pushToast({ type: "error", title: "Could not update" }); }
  };
  const remove = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try { await api.delete(`/tasks/${task.task_id}`); setTasks((p) => p.filter((t) => t.task_id !== task.task_id)); }
    catch (_) { pushToast({ type: "error", title: "Could not delete" }); }
  };
  const f = (k, v) => setFilters((p) => ({ ...p, [k]: v }));
  const scopeLabel = (t) => t.team_id ? teams.find((x) => x.team_id === t.team_id)?.name || "Project" : "Personal";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-bold">All Tasks</div><div className="text-sm text-muted-foreground mt-0.5">Across all projects and personal tasks.</div></div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={15} /><span className="ml-1.5">New task</span></Button>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Status</div>
            <Select value={filters.status} onChange={(v) => f("status", v)} options={[{ value: "", label: "All" }, { value: "todo", label: "Todo" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" }]} /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Project</div>
            <Select value={filters.team_id} onChange={(v) => f("team_id", v)} options={[{ value: "", label: "All" }, ...teams.map((t) => ({ value: t.team_id, label: t.name }))]} /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Category</div>
            <Select value={filters.category_id} onChange={(v) => f("category_id", v)} options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Search</div>
            <Input value={filters.q} onChange={(e) => f("q", e.target.value)} placeholder="Search…" /></div>
          <div><div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">Assigned</div>
            <button onClick={() => f("assigned_to_me", !filters.assigned_to_me)}
              className={cn("h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm transition-colors hover:bg-muted/40 font-medium", filters.assigned_to_me && "ring-2")}>
              {filters.assigned_to_me ? "Assigned to me" : "All"}
            </button></div>
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_120px_120px_200px_160px] border-b border-border/60 px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
          <div>Title</div><div>Project</div><div>Status</div><div>Priority</div><div>Due</div><div className="text-right">Actions</div>
        </div>
        {tasks.length === 0
          ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No tasks found.</div>
          : tasks.map((t) => (
            <div key={t.task_id} className="grid grid-cols-[1fr_160px_120px_120px_200px_160px] items-center border-b border-border/40 px-5 py-3.5 hover:bg-muted/20 transition-colors">
              <button onClick={() => { setEditing(t); setEditorOpen(true); }} className="min-w-0 text-left">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                {(t.tags || []).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{t.tags.slice(0,2).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}</div>}
              </button>
              <div className="text-sm text-muted-foreground truncate">{scopeLabel(t)}</div>
              <div><Badge tone={t.status === "done" ? "success" : t.status === "in_progress" ? "info" : "neutral"}>{t.status === "in_progress" ? "In progress" : t.status}</Badge></div>
              <div><Badge tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warning" : "neutral"}>{t.priority}</Badge></div>
              <div className="text-sm text-muted-foreground">{t.due_at ? formatDue(t.due_at) : "—"}</div>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" onClick={() => toggle(t)} className="text-xs px-2.5 h-8">{t.status === "done" ? "Reopen" : "Done"}</Button>
                <Button variant="ghost" onClick={() => remove(t)} className="px-2 h-8"><Trash2 size={13} /></Button>
              </div>
            </div>
          ))
        }
      </div>
      {editorOpen && (
        <TaskEditor key={editing ? editing.task_id : "new"} open={editorOpen} onOpenChange={setEditorOpen}
          editing={editing} categories={categories} teams={teams}
          onSaved={(task) => { setEditorOpen(false); setEditing(null);
            setTasks((prev) => { const e = prev.some((t) => t.task_id === task.task_id); return e ? prev.map((t) => t.task_id === task.task_id ? task : t) : [task, ...prev]; }); }} />
      )}
    </div>
  );
}

// ── Task editor modal (minimal — full one lives in TaskDrawer for v2 boards) ──
function TaskEditor({ open, onOpenChange, editing, categories, teams, defaultTeamId, defaultColumnId, columns, onSaved, isClientMode = false }) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", team_id: defaultTeamId || "", due_at: "" });

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || "",
        description: editing.description || "",
        priority: editing.priority || "medium",
        team_id: editing.team_id || defaultTeamId || "",
        due_at: editing.due_at ? toLocal(editing.due_at) : "",
      });
    } else {
      setForm({ title: "", description: "", priority: "medium", team_id: defaultTeamId || "", due_at: "" });
    }
  }, [editing, defaultTeamId]);

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: "error", title: "Missing title" }); return; }
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      priority: form.priority,
      team_id: form.team_id || null,
      due_at: fromLocal(form.due_at),
    };
    try {
      const r = editing
        ? await api.put(`/tasks/${editing.task_id}`, payload)
        : await api.post("/tasks", payload);
      pushToast({ type: "success", title: "Saved" });
      onSaved(r.data);
    } catch (e) {
      pushToast({ type: "error", title: "Could not save", message: e?.response?.data?.detail || "Try again." });
    }
  };

  const F = ({ label, children }) => (
    <div>
      <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? "Edit task" : "New task"}
      footer={<div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Save task</Button></div>}>
      <div className="space-y-4">
        <F label="Title"><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title…" autoFocus /></F>
        <F label="Notes"><textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Context, links, notes…" className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none" rows={3} /></F>
        <div className="grid gap-3 md:grid-cols-3">
          <F label="Project">
            <Select value={form.team_id} onChange={(v) => setForm(f => ({ ...f, team_id: v }))}
              options={[{ value: "", label: "Personal" }, ...(teams || []).map((t) => ({ value: t.team_id, label: t.name }))]} />
          </F>
          <F label="Priority">
            <Select value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))}
              options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} />
          </F>
          <F label="Due date"><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm(f => ({ ...f, due_at: e.target.value }))} /></F>
        </div>
      </div>
    </Modal>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
function CategoriesPage() {
  const { pushToast } = useToast();
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(K.blue);

  useEffect(() => { api.get("/categories").then((r) => setCats(r.data)).catch(() => {}); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try { const r = await api.post("/categories", { name: name.trim(), color }); setCats((p) => [r.data, ...p]); setName(""); }
    catch (_) { pushToast({ type: "error", title: "Could not create" }); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/categories/${c.category_id}`); setCats((p) => p.filter((x) => x.category_id !== c.category_id)); }
    catch (_) { pushToast({ type: "error", title: "Could not delete" }); }
  };

  return (
    <div className="space-y-5">
      <div><div className="text-sm font-bold">Categories</div><div className="text-sm text-muted-foreground mt-0.5">Tag tasks with custom categories.</div></div>
      <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_120px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
          <div className="flex gap-2">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="px-2 w-16" />
            <Input value={color} onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setColor(e.target.value); }} />
          </div>
          <Button onClick={create}>Create</Button>
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        {cats.length === 0 ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No categories yet.</div>
          : cats.map((c) => (
            <div key={c.category_id} className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ background: c.color }} />
                <div className="text-sm font-semibold">{c.name}</div>
              </div>
              <Button variant="ghost" onClick={() => remove(c)}><Trash2 size={13} /></Button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Admin panel ───────────────────────────────────────────────────────────────
function AdminPage() {
  const { pushToast } = useToast();
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = () => Promise.all([
    api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {}),
    api.get("/admin/invites").then((r) => setInvites(r.data)).catch(() => {}),
  ]);
  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      await api.post("/admin/invites", { email: inviteEmail.trim(), role: inviteRole });
      pushToast({ type: "success", title: "Invite created — copy link below" });
      setInviteEmail(""); load();
    } catch (err) {
      pushToast({ type: "error", title: "Could not create invite", message: err?.response?.data?.detail });
    } finally { setSending(false); }
  };

  const copyLink = (link, id) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const revokeInvite = async (id) => {
    await api.delete(`/admin/invites/${id}`).catch(() => {});
    pushToast({ type: "success", title: "Invite revoked" }); load();
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Remove ${u.name} (${u.email})? This cannot be undone.`)) return;
    await api.delete(`/admin/users/${u.user_id}`).catch(() => {});
    pushToast({ type: "success", title: "User removed" }); load();
  };

  const changeRole = async (u, role) => {
    try {
      await api.put(`/admin/users/${u.user_id}/role`, { role });
      setUsers((prev) => prev.map((x) => x.user_id === u.user_id ? { ...x, role } : x));
    } catch (_) { pushToast({ type: "error", title: "Could not change role" }); }
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
            onKeyDown={(e) => e.key === "Enter" && sendInvite()}
            placeholder="client@company.com" type="email" />
          <Select value={inviteRole} onChange={setInviteRole}
            options={[{ value: "member", label: "Member" }, { value: "client", label: "Client" }]} />
          <Button onClick={sendInvite} disabled={sending}>{sending ? "Sending…" : "Send Invite"}</Button>
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
              <Button variant="ghost" onClick={() => revokeInvite(inv.invite_id)} className="px-2 h-8 shrink-0">
                <Trash2 size={13} />
              </Button>
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
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {(u.name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{u.full_name || u.name}</div>
              <div className="text-xs text-muted-foreground truncate">{u.email}</div>
            </div>
            <RoleBadge role={u.role} />
            <div className="w-32 shrink-0">
              <Select value={u.role} onChange={(role) => changeRole(u, role)}
                options={[{ value: "admin", label: "Admin" }, { value: "member", label: "Member" }, { value: "client", label: "Client" }]} />
            </div>
            <Button variant="ghost" onClick={() => removeUser(u)} className="px-2 h-8 shrink-0">
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Client pages ──────────────────────────────────────────────────────────────
function ClientProjectsPage() {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  useEffect(() => {
    api.get("/client/projects").then(r => setProjects(r.data)).catch(() => {
      pushToast({ type: "error", title: "Failed to load projects" });
    });
  }, [pushToast]);

  return (
    <div className="space-y-5">
      <div className="text-sm font-bold">My Projects</div>
      {projects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No projects assigned yet.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map(p => (
          <div key={p.team_id}
            className="rounded-3xl border border-border/70 bg-card/50 p-5 cursor-pointer hover:border-border transition-colors"
            onClick={() => navigate(`/client/project/${p.team_id}`)}>
            <div className="flex items-center gap-3">
              <FolderKanban size={18} style={{ color: K.teal }} />
              <div className="font-bold text-sm">{p.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(`/teams/${projectId}`),
      api.get("/tasks", { params: { team_id: projectId } }),
      api.get(`/projects/${projectId}/columns`),
    ]).then(([pr, t, c]) => {
      setProject(pr.data);
      setTasks(t.data);
      setColumns(c.data);
    }).catch(() => {
      pushToast({ type: "error", title: "Failed to load project" });
      navigate("/client/projects");
    });
  }, [projectId, navigate, pushToast]);

  const grouped = useMemo(() => {
    const g = {};
    columns.forEach(c => { g[c.column_id] = []; });
    tasks.forEach(t => { if (g[t.column_id]) g[t.column_id].push(t); });
    return g;
  }, [tasks, columns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/client/projects")} className="text-sm text-muted-foreground hover:text-foreground">
          Projects
        </button>
        <ChevronRight size={14} className="text-muted-foreground" />
        <div className="text-sm font-bold">{project?.team?.name || project?.name || "…"}</div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <div key={col.column_id} className="rounded-3xl border border-border/70 bg-card/50 flex-shrink-0" style={{ width: 260, borderTopWidth: 3, borderTopColor: col.color }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="text-sm font-bold">{col.name}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: col.color + "18", color: col.color }}>
                {(grouped[col.column_id] || []).length}
              </span>
            </div>
            <div className="p-2 space-y-2">
              {(grouped[col.column_id] || []).map(t => (
                <div key={t.task_id} className="rounded-2xl border border-border/60 bg-background/50 p-3">
                  <div className="text-sm font-semibold">{t.title}</div>
                  {t.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                  {t.due_at && <div className="mt-2 text-xs" style={{ color: new Date(t.due_at) < new Date() ? "#ef4444" : K.mid }}>Due {formatDue(t.due_at)}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientPortal() {
  const navigate = useNavigate();
  const user = currentUser();
  const { pushToast } = useToast();
  const [tasks, setTasks] = useState([]);

  useEffect(() => { api.get("/client/tasks").then((r) => setTasks(r.data)).catch(() => {}); }, []);

  return (
    <div style={{ minHeight: "100vh", background: K.dark, fontFamily: "'Inter',sans-serif", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><KLogo size={36} /><KWordmark dark /></div>
        <button onClick={async () => { await apiLogout(); navigate("/login"); }}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8aa5be", background: "none", border: "none", cursor: "pointer" }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
      {tasks.length === 0 && <div style={{ color: "#8aa5be", fontSize: 14 }}>No tasks shared with you yet.</div>}
      {tasks.map(t => (
        <div key={t.task_id} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "16px 20px", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{t.title}</div>
          {t.description && <div style={{ fontSize: 12, color: "#8aa5be", marginTop: 4 }}>{t.description}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Pending approvals ─────────────────────────────────────────────────────────
function PendingApprovalsPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/approvals/pending");
      setRequests(r.data || []);
    } catch (_) { pushToast({ type: "error", title: "Could not load approvals" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const decide = async (approvalId, status) => {
    try {
      await api.post(`/approvals/${approvalId}/review`, { status, notes: "" });
      pushToast({ type: "success", title: status === "approved" ? "Approved" : "Rejected" });
      load();
    } catch (e) {
      pushToast({ type: "error", title: "Action failed", message: e?.response?.data?.detail || "Try again" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-sm font-bold">Approvals</div>
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && requests.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          All caught up — nothing pending.
        </div>
      )}
      {requests.map((r) => {
        const data = typeof r.request_data === "string" ? JSON.parse(r.request_data) : r.request_data;
        return (
          <div key={r.approval_id} className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="text-sm font-bold">{data?.title}</div>
            {data?.description && <div className="text-xs text-muted-foreground mt-1">{data.description}</div>}
            <div className="text-xs text-muted-foreground mt-2">
              From {r.requested_by_name || r.requested_by_email}
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={() => decide(r.approval_id, "approved")}>Approve</Button>
              <Button variant="ghost" onClick={() => decide(r.approval_id, "rejected")}>Reject</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
