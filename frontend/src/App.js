/**
 * App.js — Kartavya by Aekam Inc
 * Invite-only auth · Projects + per-project boards · Dynamic columns · 4 views
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useLocation, useNavigate, useParams, Outlet,
} from "react-router-dom";
import "./App.css";
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
import {
  Bell, FolderKanban, LayoutGrid, ListTodo, LogOut,
  Plus, Settings, Sun, Moon, Users, ShieldCheck, Trash2,
  Copy, Check, Mail, ChevronRight, GripVertical,
  Pencil, Calendar, BarChart3, AlignLeft, Kanban,
  X, CheckCircle2, Menu,
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
      <div style={{ fontSize: fs, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase",
        color: dark ? "#fff" : K.dark }}>Kartavya</div>
      <div style={{ fontSize: sub, letterSpacing: 2.5, textTransform: "uppercase",
        color: K.teal, fontWeight: 500, marginTop: 1 }}>by Aekam Inc</div>
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
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase",
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

// Visual style for approval status badge on task cards
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

// ── Shared auth layout ────────────────────────────────────────────────────────
const authInput = {
  width: "100%", padding: "11px 14px", background: "#f4fafd",
  border: "1.5px solid #d0e8f5", borderRadius: 8, fontSize: 14,
  color: "#0a1628", outline: "none", boxSizing: "border-box",
};
const authLabel = {
  display: "block", fontSize: 10, fontWeight: 600, letterSpacing: 2,
  textTransform: "uppercase", color: "#5a7087", marginBottom: 6,
};
const authBtn = {
  width: "100%", padding: 13, background: K.grad, border: "none",
  borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff",
  cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", marginTop: 4,
};

function AuthShell({ children, title, sub }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Nunito',sans-serif", background: "#f4fafd" }}>
      <div style={{ width: 420, background: K.dark, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: 44, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <KLogo size={36} /><KWordmark dark />
        </div>
        <div>
          <h2 style={{ color: "#fff", fontSize: 30, fontWeight: 600, lineHeight: 1.25, marginBottom: 12, letterSpacing: -0.5 }}>{title}</h2>
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
          <span style={{ color: "#b8cedd", fontWeight: 500 }}>Powered by</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: K.teal }} />
          <span style={{ color: K.mid, fontWeight: 600 }}>Aekam Inc</span>
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
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 3.5, textTransform: "uppercase", color: K.mid, marginBottom: 8 }}>Welcome back</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>
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
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 3.5, textTransform: "uppercase", color: K.mid, marginBottom: 8 }}>Create your account</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>
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
        Already have an account? <span onClick={() => navigate("/login")} style={{ color: K.blue, fontWeight: 600, cursor: "pointer" }}>Sign in</span>
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
        <div style={{ marginTop: 16, fontSize: 13, color: "#5a7087", fontFamily: "'Nunito',sans-serif" }}>Loading Kartavya…</div>
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
  const location = useLocation();

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

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div data-testid="app-shell" className="min-h-screen bg-app text-foreground" style={{ fontFamily: "'Nunito',sans-serif" }}>
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-4 lg:py-6">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Desktop sidebar */}
          <div className="hidden lg:block"><Sidebar /></div>

          {/* Mobile sidebar overlay */}
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
            {/* Mobile-only hamburger row */}
            <div className="lg:hidden flex items-center justify-between mb-3">
              <button onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl border border-border/60 bg-card/50"
                aria-label="Open menu">
                <Menu size={18} />
              </button>
              <KWordmark size="sm" />
              <button onClick={() => setNotifOpen(true)}
                className="p-2 rounded-xl border border-border/60 bg-card/50 relative"
                aria-label="Notifications">
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
            <div className="mt-4 lg:mt-6"><Outlet /></div>
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

  // Clients get a stripped-down sidebar focused on their projects.
  // Owners/members get the full app + an Approvals entry for triage.
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
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
            {(user?.name || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate">{user?.name || "User"}</div>
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
    "/dashboard": "Dashboard", "/projects": "Projects", "/tasks": "All Tasks",
    "/teams": "Teams", "/settings/categories": "Categories",
    "/settings/notifications": "Notifications", "/admin": "Admin Panel", "/client": "Client Portal",
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

// ── Router ────────────────────────────────────────────────────────────────────
function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/" element={<Protected><AppShell /></Protected>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectBoardPage />} />
        <Route path="tasks" element={<TasksListPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="settings/categories" element={<CategoriesPage />} />
        <Route path="settings/notifications" element={<NotificationsSettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="approvals" element={<PendingApprovalsPage />} />
        <Route path="client" element={<ClientProjectsPage />} />
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

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setSummary(r.data)).catch(() => {});
    api.get("/teams").then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  const quickAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.post("/tasks", { title: title.trim(), status: "todo", priority: "medium" });
      setTitle(""); pushToast({ type: "success", title: "Task added" });
    } catch (_) { pushToast({ type: "error", title: "Could not create" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Todo"        value={summary?.todo        ?? "—"} accent />
        <StatCard label="In progress" value={summary?.in_progress ?? "—"} accent />
        <StatCard label="Done"        value={summary?.done        ?? "—"} />
        <StatCard label="Overdue"     value={summary?.overdue     ?? "—"} danger />
      </div>

      {/* ── Needs my attention ──────────────────────────────────────────── */}
      {summary && (() => {
        const items = [
          { count: summary.new_client_requests,     label: "New client requests",   to: "/approvals", color: "#8b5cf6" },
          { count: summary.pending_owner_approval,  label: "Pending your approval", to: "/approvals", color: "#f59e0b" },
          { count: summary.awaiting_my_review,      label: "Awaiting your review",  to: "/client/projects", color: "#8b5cf6" },
          { count: summary.pending_client_approval, label: "With client",           to: "/tasks",     color: "#8b5cf6" },
          { count: summary.rejected_to_revise,      label: "Needs revision",        to: "/tasks",     color: "#ef4444" },
        ].filter((i) => (i.count || 0) > 0);
        if (items.length === 0) return null;
        return (
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="text-sm mb-3" style={{ fontWeight: 500 }}>Needs your attention</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
              {items.map((it) => (
                <button key={it.label} onClick={() => navigate(it.to)}
                  className="text-left rounded-2xl border border-border/60 hover:border-border transition-colors p-4"
                  style={{ background: "var(--color-card)" }}>
                  <div className="text-2xl" style={{ color: it.color, fontWeight: 600, lineHeight: 1.1 }}>{it.count}</div>
                  <div className="text-xs mt-1 text-muted-foreground" style={{ fontWeight: 400 }}>{it.label}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="text-sm font-bold mb-3">Quick add task</div>
            <div className="flex gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && quickAdd()}
                placeholder="e.g., Review client brief…" />
              <Button onClick={quickAdd} disabled={saving}><Plus size={15} /><span className="ml-1.5">Add</span></Button>
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">Due in 24 hours</div>
              <Badge tone="info">{summary?.due_24h ?? "—"} tasks</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Head to Tasks or a Project board to act on these.</p>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold">Projects</div>
              <button onClick={() => navigate("/projects")} className="text-xs font-semibold flex items-center gap-1" style={{ color: K.blue }}>
                All <ChevronRight size={12} />
              </button>
            </div>
            {projects.length === 0
              ? <p className="text-sm text-muted-foreground">No projects yet. Create one from the Projects page.</p>
              : projects.slice(0, 4).map((p) => (
                <button key={p.team_id} onClick={() => navigate(`/projects/${p.team_id}`)}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-1 text-left hover:bg-muted/40 transition-colors">
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FolderKanban size={13} color="#fff" />
                  </div>
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <ChevronRight size={13} className="ml-auto text-muted-foreground" />
                </button>
              ))
            }
          </div>
        </div>
      </div>
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
    try {
      await api.delete(`/teams/${p.team_id}`);
      pushToast({ type: "success", title: "Project deleted" });
      load();
    } catch (e) {
      pushToast({
        type: "error",
        title: "Could not delete",
        message: e?.response?.data?.detail || e?.message || "Try again",
      });
    }
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

// ── Column Manager Modal ──────────────────────────────────────────────────────
function ColumnManager({ open, onClose, projectId, columns, onColumnsChange }) {
  const { pushToast } = useToast();
  const [cols, setCols] = useState(columns);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");
  const [newIsDone, setNewIsDone] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCols(columns); }, [columns]);

  const addCol = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await api.post(`/projects/${projectId}/columns`, { name: newName.trim(), color: newColor, is_done: newIsDone });
      const updated = [...cols, r.data];
      setCols(updated); onColumnsChange(updated);
      setNewName(""); setNewColor("#8b5cf6"); setNewIsDone(false);
      pushToast({ type: "success", title: "Column added" });
    } catch (_) { pushToast({ type: "error", title: "Could not add column" }); }
    finally { setSaving(false); }
  };

  const saveEdit = async (colId) => {
    try {
      const r = await api.put(`/projects/${projectId}/columns/${colId}`, { name: editName, color: editColor });
      const updated = cols.map((c) => c.column_id === colId ? r.data : c);
      setCols(updated); onColumnsChange(updated);
      setEditingId(null);
    } catch (_) { pushToast({ type: "error", title: "Could not save" }); }
  };

  const deleteCol = async (colId) => {
    if (!window.confirm("Delete this column? Tasks will move to the first remaining column.")) return;
    try {
      await api.delete(`/projects/${projectId}/columns/${colId}`);
      const updated = cols.filter((c) => c.column_id !== colId);
      setCols(updated); onColumnsChange(updated);
    } catch (err) {
      pushToast({ type: "error", title: err?.response?.data?.detail || "Could not delete" });
    }
  };

  const PRESET_COLORS = ["#0082c6","#03a1b6","#05b7aa","#8b5cf6","#f59e0b","#ef4444","#10b981","#ec4899","#6366f1","#84cc16"];

  return (
    <Modal open={open} onOpenChange={onClose} title="Manage Board Columns"
      footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="space-y-5">
        {/* Existing columns */}
        <div className="space-y-2">
          {cols.map((col) => (
            <div key={col.column_id} className="rounded-2xl border border-border/60 bg-background/40 p-3">
              {editingId === col.column_id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} onClick={() => setEditColor(c)}
                        style={{ width: 22, height: 22, borderRadius: 6, background: c, border: editColor === c ? "2px solid #fff" : "2px solid transparent", outline: editColor === c ? `2px solid ${c}` : "none" }} />
                    ))}
                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer" }} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveEdit(col.column_id)} className="flex-1">Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: col.color, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">{col.name}</span>
                    {col.is_done && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: K.teal + "22", color: K.teal }}>marks done</span>}
                  </div>
                  <button onClick={() => { setEditingId(col.column_id); setEditName(col.name); setEditColor(col.color); }}
                    className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors"><Pencil size={12} /></button>
                  <button onClick={() => deleteCol(col.column_id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new column */}
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-3">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Add Column</div>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., In Review, Approval, Live…"
            onKeyDown={(e) => e.key === "Enter" && addCol()} />
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setNewColor(c)}
                style={{ width: 22, height: 22, borderRadius: 6, background: c, border: newColor === c ? "2px solid #fff" : "2px solid transparent", outline: newColor === c ? `2px solid ${c}` : "none" }} />
            ))}
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer" }} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={newIsDone} onChange={(e) => setNewIsDone(e.target.checked)} />
            Mark tasks in this column as <strong>done</strong>
          </label>
          <Button onClick={addCol} disabled={saving} className="w-full">
            <Plus size={14} /><span className="ml-1.5">Add Column</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">Tip: columns marked "marks done" will move tasks to completed status — great for "Live", "Published", "Archived" etc.</p>
      </div>
    </Modal>
  );
}

// ── Project Board — full dynamic board with 4 views ───────────────────────────
function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = currentUser();
  const isOwner = user?.role === "admin" || user?.role === "owner";

  const [project, setProject]       = useState(null);
  const [columns, setColumns]       = useState([]);      // custom columns
  const [tasks, setTasks]           = useState([]);
  const [categories, setCats]       = useState([]);
  const [view, setView]             = useState("board"); // board | list | schedule | tracker
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [colMgrOpen, setColMgrOpen] = useState(false);
  const [filterCol, setFilterCol]   = useState("");      // filter by column in list view

  const load = useCallback(async () => {
    const [proj, cols, t, c] = await Promise.all([
      api.get(`/teams/${projectId}`),
      api.get(`/projects/${projectId}/columns`),
      api.get("/tasks", { params: { team_id: projectId } }),
      api.get("/categories"),
    ]);
    setProject(proj.data);
    setColumns(cols.data);
    setTasks(t.data);
    setCats(c.data);
  }, [projectId]);

  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load board" })); }, [load, pushToast]);

  // Group tasks by column_id
  const grouped = useMemo(() => {
    const m = {};
    columns.forEach((c) => { m[c.column_id] = []; });
    tasks.forEach((t) => {
      const key = t.column_id && m[t.column_id] !== undefined ? t.column_id : columns[0]?.column_id;
      if (key) { m[key] = m[key] || []; m[key].push(t); }
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return m;
  }, [tasks, columns]);

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
    const srcList = Array.from(grouped[source.droppableId] || []);
    const dstList = source.droppableId === destination.droppableId ? srcList : Array.from(grouped[destination.droppableId] || []);
    const moving = srcList.find((t) => t.task_id === draggableId);
    if (!moving) return;
    srcList.splice(srcList.findIndex((t) => t.task_id === draggableId), 1);
    dstList.splice(destination.index, 0, { ...moving, column_id: destination.droppableId });
    setTasks((prev) => prev.map((t) => t.task_id === draggableId ? { ...t, column_id: destination.droppableId } : t));
    try { await api.patch(`/tasks/${draggableId}/move`, { column_id: destination.droppableId, order: destination.index }); }
    catch (_) { pushToast({ type: "error", title: "Move failed" }); load(); }
  };

  const catName = (id) => categories.find((c) => c.category_id === id)?.name || "";
  const colForTask = (t) => columns.find((c) => c.column_id === t.column_id) || columns[0];

  const priorityStyle = (p) => ({
    urgent: { background: "#ef444420", color: "#ef4444" },
    high:   { background: "#f59e0b20", color: "#f59e0b" },
    medium: { background: "#0082c620", color: "#0082c6" },
    low:    { background: "#88888820", color: "#888" },
  }[p] || {});

  const VIEWS = [
    { id: "board",    label: "Board",    Icon: Kanban },
    { id: "list",     label: "List",     Icon: AlignLeft },
    { id: "schedule", label: "Schedule", Icon: Calendar },
    { id: "tracker",  label: "Tracker",  Icon: BarChart3 },
  ];

  const listTasks = filterCol ? (grouped[filterCol] || []) : tasks;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate("/projects")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Projects</button>
        <ChevronRight size={14} className="text-muted-foreground" />
        <div className="text-sm font-bold">{project?.team?.name || "…"}</div>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-2xl border border-border/60 bg-card/50 p-1">
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setView(id)}
              className={cn("view-pill", view === id && "active")}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button variant="ghost" onClick={() => setColMgrOpen(true)} className="text-xs h-9">
              <Settings size={13} /><span className="ml-1.5">Columns</span>
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus size={15} /><span className="ml-1.5">New task</span>
          </Button>
        </div>
      </div>

      {/* ── Column pills (mini legend) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {columns.map((col) => (
          <div key={col.column_id} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: col.color + "18", color: col.color, border: `1px solid ${col.color}44` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: col.color }} />
            {col.name}
            <span className="opacity-60">·</span>
            <span className="opacity-60">{(grouped[col.column_id] || []).length}</span>
          </div>
        ))}
      </div>

      {/* ── BOARD VIEW ── */}
      {view === "board" && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
            {columns.map((col) => (
              <div key={col.column_id} className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden flex flex-col flex-shrink-0"
                style={{ width: 280, borderTopWidth: 3, borderTopColor: col.color }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                    <span className="text-sm font-bold">{col.name}</span>
                    {col.is_done && <CheckCircle2 size={12} style={{ color: col.color }} />}
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: col.color + "18", color: col.color }}>
                    {(grouped[col.column_id] || []).length}
                  </span>
                </div>
                <Droppable droppableId={col.column_id}>{(prov, snap) => (
                  <div ref={prov.innerRef} {...prov.droppableProps}
                    className={cn("flex-1 min-h-[240px] p-2 space-y-2 transition-colors", snap.isDraggingOver && "board-col-active")}>
                    {(grouped[col.column_id] || []).map((t, i) => (
                      <Draggable key={t.task_id} draggableId={t.task_id} index={i}>{(drag) => (
                        <div ref={drag.innerRef} {...drag.draggableProps}
                          onClick={() => { setEditing(t); setEditorOpen(true); }}
                          className="rounded-2xl border border-border/60 bg-background/50 p-3.5 shadow-sm cursor-pointer hover:border-border transition-colors group">
                          <div className="flex items-start justify-between gap-2">
                            {/* drag handle */}
                            <div {...drag.dragHandleProps} className="mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab" onClick={(e) => e.stopPropagation()}>
                              <GripVertical size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold leading-snug">{t.title}</div>
                              {t.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={priorityStyle(t.priority)}>{t.priority}</span>
                          </div>
                          {/* Approval status + attachment count */}
                          {(t.approval_status || (t.attachments || []).length > 0) && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              {t.approval_status && approvalBadgeStyle(t.approval_status) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                                  style={{ background: approvalBadgeStyle(t.approval_status).bg, color: approvalBadgeStyle(t.approval_status).color, fontWeight: 500 }}>
                                  {approvalBadgeStyle(t.approval_status).label}
                                </span>
                              )}
                              {(t.attachments || []).length > 0 && (
                                <span className="text-[10px] text-muted-foreground" style={{ fontWeight: 400 }}>
                                  📎 {t.attachments.length}
                                </span>
                              )}
                            </div>
                          )}
                          {t.category_id && <div className="mt-2 text-xs text-muted-foreground">{catName(t.category_id)}</div>}
                          {t.due_at && (
                            <div className="mt-2 flex items-center gap-1 text-xs font-medium"
                              style={{ color: new Date(t.due_at) < new Date() ? "#ef4444" : K.mid }}>
                              <Calendar size={10} />{formatDue(t.due_at)}
                            </div>
                          )}
                          {(t.subtasks || []).length > 0 && (
                            <div className="mt-2">
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Subtasks</span>
                                <span>{t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length}</span>
                              </div>
                              <div className="h-1 rounded-full bg-border/60 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${(t.subtasks.filter((s) => s.is_done).length / t.subtasks.length) * 100}%`, background: col.color }} />
                              </div>
                            </div>
                          )}
                          {(t.tags || []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {t.tags.slice(0,3).map((tag) => (
                                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: col.color + "15", color: col.color }}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}</Draggable>
                    ))}
                    {prov.placeholder}
                    {/* Quick add in column */}
                    <button onClick={() => { setEditing({ _defaultColumn: col.column_id }); setEditorOpen(true); }}
                      className="w-full rounded-2xl border border-dashed border-border/40 py-2 text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors flex items-center justify-center gap-1">
                      <Plus size={11} /> Add task
                    </button>
                  </div>
                )}</Droppable>
              </div>
            ))}

            {/* Add column shortcut for admins */}
            {isOwner && (
              <button onClick={() => setColMgrOpen(true)}
                className="rounded-3xl border border-dashed border-border/60 flex-shrink-0 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                style={{ width: 180, minHeight: 240 }}>
                <Plus size={14} /> New column
              </button>
            )}
          </div>
        </DragDropContext>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="space-y-3">
          {/* Column filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setFilterCol("")}
              className={cn("view-pill", !filterCol && "active")}>All</button>
            {columns.map((col) => (
              <button key={col.column_id} onClick={() => setFilterCol(col.column_id)}
                className={cn("view-pill", filterCol === col.column_id && "active")}
                style={filterCol === col.column_id ? { color: col.color, background: col.color + "18", borderColor: col.color + "55" } : {}}>
                {col.name}
              </button>
            ))}
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_110px_110px_180px_100px] border-b border-border/60 px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
              <div>Task</div><div>Column</div><div>Priority</div><div>Assignees</div><div>Due</div><div className="text-right">Actions</div>
            </div>
            {listTasks.length === 0
              ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No tasks in this column.</div>
              : listTasks.map((t) => {
                const col = colForTask(t);
                return (
                  <div key={t.task_id} className="grid grid-cols-[1fr_140px_110px_110px_180px_100px] items-center border-b border-border/40 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <button onClick={() => { setEditing(t); setEditorOpen(true); }} className="min-w-0 text-left">
                      <div className="truncate text-sm font-semibold">{t.title}</div>
                      {t.description && <div className="truncate text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                    </button>
                    <div className="flex items-center gap-1.5">
                      {col && <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />}
                      <span className="text-xs text-muted-foreground truncate">{col?.name || "—"}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg w-fit" style={priorityStyle(t.priority)}>{t.priority}</span>
                    <div className="text-xs text-muted-foreground">{(t.assignee_user_ids || []).length > 0 ? `${t.assignee_user_ids.length} person${t.assignee_user_ids.length > 1 ? "s" : ""}` : "—"}</div>
                    <div className="text-xs text-muted-foreground">{t.due_at ? formatDue(t.due_at) : "—"}</div>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" className="px-2 h-8" onClick={async () => {
                        try { const r = await api.patch(`/tasks/${t.task_id}/toggle`); setTasks((p) => p.map((x) => x.task_id === t.task_id ? r.data : x)); }
                        catch (_) { pushToast({ type: "error", title: "Could not update" }); }
                      }}>{col?.is_done ? "Reopen" : "Done"}</Button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* ── SCHEDULE VIEW ── */}
      {view === "schedule" && (
        <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <div className="text-sm font-bold">Schedule</div>
            <div className="text-xs text-muted-foreground mt-0.5">Tasks sorted by due date · tasks without due dates not shown</div>
          </div>
          {tasks.filter((t) => t.due_at).length === 0
            ? <div className="px-5 py-10 text-sm text-muted-foreground text-center">No tasks with due dates yet.</div>
            : tasks.filter((t) => t.due_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).map((t) => {
              const col = colForTask(t);
              const overdue = new Date(t.due_at) < new Date() && !col?.is_done;
              return (
                <div key={t.task_id} className="flex items-start gap-4 border-b border-border/40 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => { setEditing(t); setEditorOpen(true); }}>
                  <div className="flex flex-col items-center min-w-[52px]">
                    <div className="text-2xl font-black" style={{ color: overdue ? "#ef4444" : K.blue }}>
                      {new Date(t.due_at).getDate()}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">
                      {new Date(t.due_at).toLocaleString("default", { month: "short" })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(t.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: col?.color || K.blue, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="text-sm font-semibold flex-1">{t.title}</div>
                      {overdue && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "#ef444420", color: "#ef4444" }}>OVERDUE</span>}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0" style={priorityStyle(t.priority)}>{t.priority}</span>
                    </div>
                    {t.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</div>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {col && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: col.color + "18", color: col.color }}>{col.name}</span>}
                      {catName(t.category_id) && <span className="text-[10px] text-muted-foreground">{catName(t.category_id)}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* ── TRACKER VIEW ── */}
      {view === "tracker" && (
        <div className="space-y-4">
          {/* Per-column progress bars */}
          <div className="rounded-3xl border border-border/70 bg-card/50 p-6">
            <div className="text-sm font-bold mb-5">Column Distribution</div>
            {columns.map((col) => {
              const count = (grouped[col.column_id] || []).length;
              const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
              return (
                <div key={col.column_id} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                      <span className="text-sm font-semibold">{col.name}</span>
                    </div>
                    <div className="text-sm font-bold" style={{ color: col.color }}>{count} <span className="text-muted-foreground font-normal text-xs">tasks · {pct}%</span></div>
                  </div>
                  <div className="h-2.5 rounded-full bg-border/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: col.color }} />
                  </div>
                </div>
              );
            })}
            <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total tasks</span>
              <span className="text-2xl font-black" style={{ color: K.blue }}>{tasks.length}</span>
            </div>
          </div>

          {/* Priority breakdown */}
          <div className="rounded-3xl border border-border/70 bg-card/50 p-6">
            <div className="text-sm font-bold mb-5">Priority Breakdown</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["urgent","high","medium","low"].map((p) => {
                const count = tasks.filter((t) => t.priority === p).length;
                const style = priorityStyle(p);
                return (
                  <div key={p} className="rounded-2xl border border-border/60 p-4 text-center">
                    <div className="text-2xl font-black" style={{ color: style.color }}>{count}</div>
                    <div className="text-xs font-bold uppercase mt-1 capitalize" style={{ color: style.color }}>{p}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overdue counter */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "With due dates",   value: tasks.filter((t) => t.due_at).length,                               color: K.blue },
              { label: "Overdue",          value: tasks.filter((t) => t.due_at && new Date(t.due_at) < new Date() && !colForTask(t)?.is_done).length, color: "#ef4444" },
              { label: "Done columns",     value: tasks.filter((t) => colForTask(t)?.is_done).length,                  color: K.teal },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-3xl border border-border/70 bg-card/50 p-5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                <div className="mt-2 text-3xl font-black" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Task editor ── */}
      <TaskEditor
        key={editing ? (editing.task_id || "new-from-col") : "new"}
        open={editorOpen} onOpenChange={setEditorOpen}
        editing={editing?.task_id ? editing : null}
        categories={categories}
        teams={project ? [{ team_id: projectId, name: project.team?.name || "This project" }] : []}
        defaultTeamId={projectId}
        defaultColumnId={editing?._defaultColumn || null}
        columns={columns}
        onSaved={(task) => {
          setEditorOpen(false); setEditing(null);
          setTasks((prev) => {
            const e = prev.some((t) => t.task_id === task.task_id);
            return e ? prev.map((t) => t.task_id === task.task_id ? task : t) : [task, ...prev];
          });
        }}
      />

      {/* ── Column manager ── */}
      <ColumnManager
        open={colMgrOpen}
        onClose={() => setColMgrOpen(false)}
        projectId={projectId}
        columns={columns}
        onColumnsChange={(updated) => { setColumns(updated); load(); }}
      />
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
              className={cn("h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm transition-colors hover:bg-muted/40 font-medium", filters.assigned_to_me && "ring-2")}
              style={filters.assigned_to_me ? { ringColor: K.blue } : {}}>
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
      <TaskEditor key={editing ? editing.task_id : "new"} open={editorOpen} onOpenChange={setEditorOpen}
        editing={editing} categories={categories} teams={teams}
        onSaved={(task) => { setEditorOpen(false); setEditing(null);
          setTasks((prev) => { const e = prev.some((t) => t.task_id === task.task_id); return e ? prev.map((t) => t.task_id === task.task_id ? task : t) : [task, ...prev]; }); }} />
    </div>
  );
}

// ── Task editor modal ─────────────────────────────────────────────────────────

// Hoisted out of TaskEditor on purpose. Defining F inside the render function
// gives it a different identity on every keystroke, which React reads as "new
// component type" and remounts every field — destroying focus mid-typing.
function F({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );
}

function TaskEditor({ open, onOpenChange, editing, categories, teams, defaultTeamId, defaultColumnId, columns, onSaved, isClientMode = false }) {
  const { pushToast } = useToast();
  const [teamMembers, setTeamMembers] = useState([]);
  const [yourRole, setYourRole] = useState("member");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  // Approval action UI
  const [approvalAction, setApprovalAction] = useState(null); // 'owner' | 'client' | 'approve' | 'reject' | 'client-approve' | 'client-reject'
  const [approvalNotes, setApprovalNotes] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const currentUserMe = currentUser();
  const isClientUser = currentUserMe?.role === "client";

  // Reload editing task fresh (for current approval_status) when opened
  const [taskState, setTaskState] = useState(editing);
  useEffect(() => { setTaskState(editing); }, [editing]);
  const refreshTask = async () => {
    if (!taskState?.task_id) return;
    try {
      const r = await api.get(`/tasks/${taskState.task_id}`).catch(() => null);
      if (r?.data) setTaskState(r.data);
    } catch (_) {}
  };

  const blank = useMemo(() => ({
    title: "", description: "", priority: "medium", category_id: "", tags: "",
    team_id: defaultTeamId || "", column_id: defaultColumnId || "",
    assign_scope: "none", assignee_user_ids: [],
    due_at: "", reminder_at: "", estimated_minutes: "",
    recurrence_rule: "none", recurrence_interval: 1,
    attachments: [], custom_fields_text: "{}", subtasks: [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [defaultTeamId, defaultColumnId]);

  const initial = useMemo(() => {
    if (!editing) return blank;
    return {
      title: editing.title || "", description: editing.description || "",
      priority: editing.priority || "medium",
      category_id: editing.category_id || "",
      tags: (editing.tags || []).join(", "),
      team_id: editing.team_id || defaultTeamId || "",
      column_id: editing.column_id || defaultColumnId || "",
      assign_scope: (editing.assignee_user_ids || []).length ? "members" : "none",
      assignee_user_ids: editing.assignee_user_ids || [],
      due_at: toLocal(editing.due_at), reminder_at: toLocal(editing.reminder_at),
      estimated_minutes: editing.estimated_minutes ? String(editing.estimated_minutes) : "",
      recurrence_rule: editing.recurrence?.rule || "none", recurrence_interval: editing.recurrence?.interval || 1,
      attachments: editing.attachments || [],
      custom_fields_text: JSON.stringify(editing.custom_fields || {}, null, 2),
      subtasks: editing.subtasks || [],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, defaultTeamId, defaultColumnId]);

  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  useEffect(() => {
    if (!open || !form.team_id) { setTeamMembers([]); setYourRole("member"); return; }
    let live = true; setLoadingMembers(true);
    api.get(`/teams/${form.team_id}`)
      .then((r) => { if (!live) return; setTeamMembers((r.data.members || []).filter((m) => m.status === "active" && m.user_id)); setYourRole(r.data.your_role || "member"); })
      .catch(() => { if (!live) return; setTeamMembers([]); setYourRole("member"); })
      .finally(() => { if (live) setLoadingMembers(false); });
    return () => { live = false; };
  }, [open, form.team_id]);

  const canAssign = !form.team_id || yourRole === "owner" || yourRole === "admin";
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Load comments when editing an existing task
  useEffect(() => {
    if (!open || !taskState?.task_id) { setComments([]); return; }
    let live = true;
    api.get(`/tasks/${taskState.task_id}/comments`)
      .then((r) => { if (live) setComments(r.data || []); })
      .catch(() => { if (live) setComments([]); });
    return () => { live = false; };
  }, [open, taskState?.task_id]);

  const postComment = async () => {
    if (!newComment.trim() || !taskState?.task_id) return;
    setPostingComment(true);
    try {
      const r = await api.post(`/tasks/${taskState.task_id}/comments`, { body: newComment.trim() });
      setComments((p) => [...p, r.data]);
      setNewComment("");
    } catch (e) {
      pushToast({ type: "error", title: "Could not post comment" });
    } finally {
      setPostingComment(false);
    }
  };

  // Approval actions
  const submitApprovalAction = async () => {
    if (!taskState?.task_id) return;
    setSubmittingApproval(true);
    try {
      if (approvalAction === "owner") {
        await api.post(`/tasks/${taskState.task_id}/request-approval`, { notes: approvalNotes });
        pushToast({ type: "success", title: "Sent for owner approval" });
      } else if (approvalAction === "client") {
        if (!clientEmail.trim()) {
          pushToast({ type: "error", title: "Client email required" });
          setSubmittingApproval(false); return;
        }
        await api.post(`/tasks/${taskState.task_id}/request-client-approval`,
          { client_email: clientEmail.trim(), notes: approvalNotes });
        pushToast({ type: "success", title: "Sent to client for approval" });
      } else if (approvalAction === "approve") {
        await api.post(`/tasks/${taskState.task_id}/approve`, { notes: approvalNotes });
        pushToast({ type: "success", title: "Approved" });
      } else if (approvalAction === "reject") {
        if (!approvalNotes.trim()) {
          pushToast({ type: "error", title: "Reason required" });
          setSubmittingApproval(false); return;
        }
        await api.post(`/tasks/${taskState.task_id}/reject`, { notes: approvalNotes });
        pushToast({ type: "success", title: "Rejected" });
      } else if (approvalAction === "client-approve") {
        await api.post(`/tasks/${taskState.task_id}/client-approve`, { notes: approvalNotes });
        pushToast({ type: "success", title: "Approved — task complete" });
      } else if (approvalAction === "client-reject") {
        if (!approvalNotes.trim()) {
          pushToast({ type: "error", title: "Reason required" });
          setSubmittingApproval(false); return;
        }
        await api.post(`/tasks/${taskState.task_id}/client-reject`, { notes: approvalNotes });
        pushToast({ type: "success", title: "Sent back for revision" });
      }
      setApprovalAction(null); setApprovalNotes(""); setClientEmail("");
      await refreshTask();
      onSaved?.(taskState);
    } catch (e) {
      pushToast({ type: "error", title: "Action failed", message: e?.response?.data?.detail || "Try again" });
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        pushToast({ type: "error", title: `File "${file.name}" exceeds 5MB limit` });
        return;
      }
    }

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const r = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        uploaded.push({ name: file.name, url: r.data.url });
      }

      upd("attachments", [...(form.attachments || []), ...uploaded]);
      pushToast({ type: "success", title: "Files uploaded" });
    } catch (err) {
      pushToast({ type: "error", title: "Upload failed", message: err?.response?.data?.detail || "Try again" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => {
    upd("attachments", (form.attachments || []).filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: "error", title: "Missing title" }); return; }
    let customFields = {};
    try { customFields = form.custom_fields_text?.trim() ? JSON.parse(form.custom_fields_text) : {}; }
    catch (_) { pushToast({ type: "error", title: "Custom fields must be valid JSON" }); return; }
    const assignees = form.assign_scope === "whole_team" && form.team_id ? teamMembers.map((m) => m.user_id) : (form.assignee_user_ids || []);
    // In client mode, the task is always scoped to the project the client opened.
    // Don't trust form.team_id (the dropdown is hidden anyway) — use defaultTeamId.
    const effectiveTeamId = isClientMode ? (defaultTeamId || form.team_id || null) : (form.team_id || null);
    const payload = {
      title: form.title.trim(), description: form.description?.trim() || null,
      priority: form.priority, category_id: form.category_id || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      team_id: effectiveTeamId,
      column_id: form.column_id || null,
      assignee_user_ids: assignees,
      due_at: fromLocal(form.due_at), reminder_at: form.reminder_at ? fromLocal(form.reminder_at) : null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      recurrence: { rule: form.recurrence_rule, interval: Number(form.recurrence_interval) || 1 },
      attachments: (form.attachments || []).filter((a) => a.url && a.name),
      custom_fields: customFields,
      subtasks: (form.subtasks || []).filter((s) => s.title?.trim()).map((s, i) => ({ title: s.title.trim(), is_done: !!s.is_done, order: i })),
    };
    try {
      if (isClientMode && !editing) {
        // Client creating new task - submit for approval
        await api.post("/client/tasks/request", payload);
        pushToast({ type: "success", title: "Task submitted for approval", message: "Project owner will review your request" });
        onSaved?.();
      } else {
        const r = editing ? await api.put(`/tasks/${editing.task_id}`, payload) : await api.post("/tasks", payload);
        pushToast({ type: "success", title: "Saved" }); 
        onSaved(r.data);
      }
    } catch (e) { 
      pushToast({ type: "error", title: "Could not save", message: e?.response?.data?.detail || "Try again." }); 
    }
  };

  const colOptions = columns ? [{ value: "", label: "— No column —" }, ...columns.map((c) => ({ value: c.column_id, label: c.name }))] : [];

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? "Edit task" : "New task"} dataTestId="task-editor-modal"
      footer={<div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Save task</Button></div>}>
      <div className="space-y-4">
        <F label="Title"><Input value={form.title} onChange={(e) => upd("title", e.target.value)} placeholder="Task title…" autoFocus /></F>
        <F label="Notes"><textarea value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder="Context, links, notes…" className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" rows={3} /></F>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {!isClientMode && (
            <F label="Project">
              <Select value={form.team_id} onChange={(v) => setForm((p) => ({ ...p, team_id: v, column_id: "", assign_scope: "none", assignee_user_ids: [] }))}
                options={[
                  { value: "", label: "Personal" },
                  ...(teams || [])
                    .filter((t) => t && t.team_id && (t.name || "").trim())
                    .map((t) => ({ value: t.team_id, label: t.name })),
                ]} />
            </F>
          )}
          {!isClientMode && columns && columns.length > 0 && (
            <F label="Column">
              <Select value={form.column_id} onChange={(v) => upd("column_id", v)} options={colOptions} />
            </F>
          )}
          <F label="Priority">
            <Select value={form.priority} onChange={(v) => upd("priority", v)} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} />
          </F>
          <F label="Category">
            <Select value={form.category_id} onChange={(v) => upd("category_id", v)} options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} />
          </F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Due date"><Input type="datetime-local" value={form.due_at} onChange={(e) => upd("due_at", e.target.value)} /></F>
          <F label="Reminder"><Input type="datetime-local" value={form.reminder_at} onChange={(e) => upd("reminder_at", e.target.value)} /></F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Tags"><Input value={form.tags} onChange={(e) => upd("tags", e.target.value)} placeholder="Design, review… (comma-separated)" /></F>
          <F label="Est. minutes"><Input value={form.estimated_minutes} onChange={(e) => upd("estimated_minutes", e.target.value)} placeholder="e.g., 45" /></F>
        </div>
        {form.team_id && canAssign && (
          <F label="Assignment">
            <Select value={form.assign_scope} onChange={(v) => setForm((p) => ({ ...p, assign_scope: v, assignee_user_ids: [] }))} options={[{ value: "none", label: "Unassigned" }, { value: "whole_team", label: "Whole project" }, { value: "members", label: "Selected members" }]} />
            {!loadingMembers && form.assign_scope === "members" && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {teamMembers.map((m) => {
                  const checked = (form.assignee_user_ids || []).includes(m.user_id);
                  return (
                    <label key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <input type="checkbox" checked={checked} onChange={(e) => setForm((p) => { const s = new Set(p.assignee_user_ids || []); e.target.checked ? s.add(m.user_id) : s.delete(m.user_id); return { ...p, assignee_user_ids: Array.from(s) }; })} />
                      <span className="truncate text-xs">{m.email}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </F>
        )}
        <F label="Attachments">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || (isClientMode && editing)}
          >
            {uploading ? "Uploading..." : "Add Files"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Max 5MB per file. PDF, docs, images, zip
          </p>
          {(form.attachments || []).length > 0 && (
            <div className="mt-3 space-y-2">
              {form.attachments.map((att, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm">📎</span>
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm truncate hover:underline">
                      {att.name}
                    </a>
                  </div>
                  {!isClientMode && (
                    <button type="button" onClick={() => removeAttachment(i)}
                      className="text-red-500 hover:text-red-700 p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </F>
        {isClientMode && !editing && (
          <div className="rounded-lg p-3" style={{ background: "#fef3c7", border: "1px solid #fbbf24" }}>
            <p className="text-sm" style={{ color: "#92400e" }}>
              ℹ️ This task will be submitted for approval by the project owner
            </p>
          </div>
        )}
        <F label="Subtasks">
          <div className="space-y-2">
            {(form.subtasks || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={!!s.is_done} onChange={(e) => setForm((p) => ({ ...p, subtasks: p.subtasks.map((x, j) => j === i ? { ...x, is_done: e.target.checked } : x) }))} />
                <Input value={s.title} onChange={(e) => setForm((p) => ({ ...p, subtasks: p.subtasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} placeholder={`Subtask ${i + 1}`} />
                <Button variant="ghost" onClick={() => setForm((p) => ({ ...p, subtasks: p.subtasks.filter((_, j) => j !== i) }))}>✕</Button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setForm((p) => ({ ...p, subtasks: [...(p.subtasks || []), { title: "", is_done: false }] }))}>+ Add subtask</Button>
          </div>
        </F>

        {/* ── Approval state banner (existing tasks only) ──────────────────── */}
        {taskState?.task_id && taskState?.approval_status && (
          <div style={{
            padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 400,
            background:
              taskState.approval_status === "approved" ? "rgba(16,185,129,0.10)" :
              taskState.approval_status === "rejected" ? "rgba(239,68,68,0.10)" :
              "rgba(245,158,11,0.10)",
            color:
              taskState.approval_status === "approved" ? "#10b981" :
              taskState.approval_status === "rejected" ? "#ef4444" :
              "#f59e0b",
            border: "1px solid",
            borderColor:
              taskState.approval_status === "approved" ? "rgba(16,185,129,0.3)" :
              taskState.approval_status === "rejected" ? "rgba(239,68,68,0.3)" :
              "rgba(245,158,11,0.3)",
          }}>
            <div style={{ fontWeight: 500 }}>
              {taskState.approval_status === "pending" && "Awaiting owner approval"}
              {taskState.approval_status === "pending_client" && "Awaiting client approval"}
              {taskState.approval_status === "approved" && "Approved"}
              {taskState.approval_status === "rejected" && "Rejected — needs revision"}
            </div>
            {taskState.approval_notes && (
              <div style={{ marginTop: 4, opacity: 0.85 }}>{taskState.approval_notes}</div>
            )}
          </div>
        )}

        {/* ── Approval action buttons (existing tasks only, not in client-create mode) ─── */}
        {taskState?.task_id && !isClientMode && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
            {/* Team member: send for owner approval — only when no approval cycle is active */}
            {(!taskState.approval_status || taskState.approval_status === "rejected") && (
              <Button variant="ghost" onClick={() => { setApprovalAction("owner"); setApprovalNotes(""); }}>
                Send for owner approval
              </Button>
            )}
            {/* Send for client approval — available unless already pending an approval */}
            {taskState.approval_status !== "pending" && taskState.approval_status !== "pending_client" && (
              <Button variant="ghost" onClick={() => { setApprovalAction("client"); setApprovalNotes(""); setClientEmail(""); }}>
                Send for client approval
              </Button>
            )}
            {/* Owner/admin: approve or reject pending request */}
            {taskState.approval_status === "pending" && (yourRole === "owner" || yourRole === "admin" || currentUserMe?.role === "admin") && (
              <>
                <Button onClick={() => { setApprovalAction("approve"); setApprovalNotes(""); }}>
                  Approve
                </Button>
                <Button variant="ghost" onClick={() => { setApprovalAction("reject"); setApprovalNotes(""); }} style={{ color: "#ef4444" }}>
                  Reject
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Client approval actions (client viewing pending_client task) ─── */}
        {taskState?.task_id && isClientUser && taskState.approval_status === "pending_client" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
            <Button onClick={() => { setApprovalAction("client-approve"); setApprovalNotes(""); }}>
              Approve work
            </Button>
            <Button variant="ghost" onClick={() => { setApprovalAction("client-reject"); setApprovalNotes(""); }} style={{ color: "#ef4444" }}>
              Request changes
            </Button>
          </div>
        )}

        {/* ── Approval action prompt (notes / client email) ─────────────── */}
        {approvalAction && (
          <div style={{ padding: 12, borderRadius: 10, background: "var(--color-muted)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1, color: "var(--color-muted-foreground)" }}>
              {approvalAction === "owner" && "Send for owner approval"}
              {approvalAction === "client" && "Send for client approval"}
              {approvalAction === "approve" && "Approve task"}
              {approvalAction === "reject" && "Reject — reason required"}
              {approvalAction === "client-approve" && "Approve completed work"}
              {approvalAction === "client-reject" && "Request changes — reason required"}
            </div>
            {approvalAction === "client" && (
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@company.com" type="email" />
            )}
            <textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} rows={2}
              placeholder={
                approvalAction === "reject" || approvalAction === "client-reject"
                  ? "Reason for rejection (required)…"
                  : "Optional note…"
              }
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-input)", fontSize: 13, fontWeight: 400, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => { setApprovalAction(null); setApprovalNotes(""); setClientEmail(""); }}>
                Cancel
              </Button>
              <Button onClick={submitApprovalAction} disabled={submittingApproval}>
                {submittingApproval ? "Sending…" : "Confirm"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Comments thread (existing tasks only) ─────────────────────── */}
        {taskState?.task_id && (
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--color-muted-foreground)", marginBottom: 8 }}>
              Comments ({comments.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto", marginBottom: 8 }}>
              {comments.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--color-muted-foreground)", fontWeight: 400, padding: "8px 0" }}>
                  No comments yet.
                </div>
              )}
              {comments.map((c) => (
                <div key={c.comment_id} style={{ padding: 10, borderRadius: 8, background: "var(--color-muted)", fontWeight: 400 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{c.user_name}</span>
                    <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Add a comment…"
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-input)", fontSize: 13, fontWeight: 400 }}
              />
              <Button onClick={postComment} disabled={postingComment || !newComment.trim()}>
                {postingComment ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        )}
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [changingRole, setChangingRole] = useState(null);

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
    setChangingRole(u.user_id);
    try {
      await api.put(`/admin/users/${u.user_id}/role`, { role });
      setUsers((prev) => prev.map((x) => x.user_id === u.user_id ? { ...x, role } : x));
    } catch (_) { pushToast({ type: "error", title: "Could not change role" }); }
    finally { setChangingRole(null); }
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
            options={[
              { value: "admin", label: "Admin" },
              { value: "member", label: "Member" },
              { value: "client", label: "Client" },
            ]} />
          <Button onClick={sendInvite} disabled={sending}>{sending ? "Sending…" : "Send Invite"}</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Admins manage users and settings. Members get full workspace access. Clients see only tasks shared with them.</p>
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
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
              {(u.name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{u.name}</div>
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

// ── Client portal ─────────────────────────────────────────────────────────────
// ── Client Projects View ──────────────────────────────────────────────────────
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
    <div className="content-wrapper">
      <div className="page-header">
        <h1 className="page-title">My Projects</h1>
        <p className="text-sm text-muted-foreground">Projects you're assigned to</p>
      </div>

      {projects.length === 0 && (
        <div className="empty-state">
          <FolderKanban size={48} style={{ color: K.mid, opacity: 0.3 }} />
          <p style={{ marginTop: 16, fontSize: 15, color: "var(--color-muted-foreground)" }}>
            No projects assigned yet
          </p>
        </div>
      )}

      <div className="grid-2">
        {projects.map(p => (
          <div
            key={p.team_id}
            className="elevated-card hover-lift"
            onClick={() => navigate(`/client/project/${p.team_id}`)}
            style={{ cursor: 'pointer', padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <FolderKanban size={18} style={{ color: K.teal }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{p.name}</h3>
            </div>
            {p.description && (
              <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', margin: 0 }}>
                {p.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientProjectBoardPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get(`/teams/${projectId}`).then(r => setProject(r.data)),
      api.get(`/tasks`, { params: { team_id: projectId } }).then(r => setTasks(r.data)),
      api.get(`/projects/${projectId}/columns`).then(r => setColumns(r.data)),
      api.get("/categories").then(r => setCategories(r.data))
    ]).catch(() => {
      pushToast({ type: "error", title: "Failed to load project" });
      navigate("/client/projects");
    });
  }, [projectId, navigate, pushToast]);

  const grouped = useMemo(() => {
    const g = {};
    columns.forEach(c => g[c.column_id] = []);
    tasks.forEach(t => {
      if (g[t.column_id]) g[t.column_id].push(t);
    });
    return g;
  }, [tasks, columns]);

  const catName = (cid) => categories.find(c => c.category_id === cid)?.name || "";
  const priorityStyle = (p) => ({
    low: { background: "#10b98122", color: "#10b981" },
    medium: { background: "#f59e0b22", color: "#f59e0b" },
    high: { background: "#ef444422", color: "#ef4444" },
    urgent: { background: "#9333ea22", color: "#9333ea" },
  }[p] || { background: "#88888822", color: "#888" });

  return (
    <div className="content-wrapper content-wrapper--kanban">
      <div className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate("/client/projects")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ChevronRight size={14} className="rotate-180" />
            Projects
          </button>
          <h1 className="page-title mb-0">{project?.name || "..."}</h1>

          <div style={{ marginLeft: 'auto' }}>
            <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus size={15} /><span className="ml-1.5">Request Task</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board - Read-only for clients */}
      <div className="kanban-container">
        {columns.map(col => (
          <div key={col.column_id} className="kanban-column">
            <div className="elevated-card" style={{ height: '100%' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span className="text-sm font-semibold">{col.name}</span>
                  {col.is_done && <CheckCircle2 size={12} style={{ color: col.color }} />}
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: col.color + "18", color: col.color }}>
                  {(grouped[col.column_id] || []).length}
                </span>
              </div>

              <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
                {(grouped[col.column_id] || []).map(t => (
                  <div
                    key={t.task_id}
                    onClick={() => { setEditing(t); setEditorOpen(true); }}
                    className="glass-card cursor-pointer hover-lift"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold leading-snug">{t.title}</div>
                        {t.description && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {t.description}
                          </div>
                        )}
                      </div>
                      <span className="badge-modern" style={{
                        background: priorityStyle(t.priority).background,
                        color: priorityStyle(t.priority).color
                      }}>
                        {t.priority}
                      </span>
                    </div>

                    {t.category_id && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {catName(t.category_id)}
                      </div>
                    )}

                    {/* Approval status badge for clients */}
                    {t.approval_status && approvalBadgeStyle(t.approval_status) && (
                      <div className="mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{ background: approvalBadgeStyle(t.approval_status).bg, color: approvalBadgeStyle(t.approval_status).color, fontWeight: 500 }}>
                          {approvalBadgeStyle(t.approval_status).label}
                        </span>
                      </div>
                    )}

                    {t.due_at && (
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium"
                        style={{ color: new Date(t.due_at) < new Date() ? "#ef4444" : K.mid }}>
                        <Calendar size={10} />{formatDue(t.due_at)}
                      </div>
                    )}

                    {/* Show attachments count */}
                    {t.attachments && t.attachments.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>📎</span>
                        <span>{t.attachments.length} file(s)</span>
                      </div>
                    )}

                    {/* Subtasks progress */}
                    {(t.subtasks || []).length > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Subtasks</span>
                          <span>{t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-bar__fill" style={{
                            width: `${(t.subtasks.filter((s) => s.is_done).length / t.subtasks.length) * 100}%`,
                            background: col.color
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Task editor - clients can view and create approval requests */}
      <TaskEditor
        key={editing ? editing.task_id : "new"}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
        categories={categories}
        teams={[{ team_id: projectId, name: project?.name }]}
        defaultTeamId={projectId}
        columns={columns}
        isClientMode={true}
        onSaved={(task) => {
          setEditorOpen(false);
          setEditing(null);
          api.get(`/tasks`, { params: { team_id: projectId } }).then(r => setTasks(r.data));
        }}
      />
    </div>
  );
}

function ClientPortal() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const user = currentUser();
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => { api.get("/client/tasks").then((r) => setTasks(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!selected) return;
    api.get(`/tasks/${selected.task_id}/comments`).then((r) => setComments(r.data)).catch(() => {});
  }, [selected]);

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const r = await api.post(`/tasks/${selected.task_id}/comments`, { body: comment.trim() });
      setComments((p) => [...p, r.data]); setComment("");
    } catch (_) { pushToast({ type: "error", title: "Could not post comment" }); }
    finally { setPosting(false); }
  };

  const statusColor = { todo: K.blue, in_progress: K.mid, done: K.teal };

  return (
    <div style={{ minHeight: "100vh", background: K.dark, fontFamily: "'Nunito',sans-serif", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <KLogo size={36} /><KWordmark dark />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#8aa5be" }}>Hi, {user?.name}</span>
          <button onClick={async () => { await apiLogout(); navigate("/login"); }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8aa5be", background: "none", border: "none", cursor: "pointer" }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 20, maxWidth: 1200, margin: "0 auto" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: K.teal, marginBottom: 16 }}>Your Updates</div>
          {tasks.length === 0 && <div style={{ color: "#8aa5be", fontSize: 14 }}>No tasks shared with you yet.</div>}
          {tasks.map((t) => (
            <div key={t.task_id} onClick={() => setSelected(selected?.task_id === t.task_id ? null : t)}
              style={{ background: selected?.task_id === t.task_id ? K.card : "rgba(255,255,255,.04)", border: `1px solid ${selected?.task_id === t.task_id ? K.blue : "rgba(255,255,255,.08)"}`, borderRadius: 16, padding: "16px 20px", marginBottom: 10, cursor: "pointer", transition: "all .15s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 4 }}>{t.title}</div>
                  {t.description && <div style={{ fontSize: 12, color: "#8aa5be", lineHeight: 1.5 }}>{t.description}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: statusColor[t.status] || K.teal, background: (statusColor[t.status] || K.teal) + "22", padding: "3px 8px", borderRadius: 6 }}>
                    {t.status === "in_progress" ? "In Progress" : t.status}
                  </span>
                  {t.due_at && <span style={{ fontSize: 11, color: "#8aa5be" }}>Due {formatDue(t.due_at)}</span>}
                </div>
              </div>
              {(t.subtasks || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: K.gradD, borderRadius: 4, width: `${(t.subtasks.filter((s) => s.is_done).length / t.subtasks.length) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8aa5be", marginTop: 4 }}>{t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length} subtasks complete</div>
                </div>
              )}
            </div>
          ))}
        </div>
        {selected && (
          <div style={{ background: K.card, border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: K.teal, marginBottom: 4 }}>Comments</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 12 }}>{selected.title}</div>
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
              {comments.length === 0 && <div style={{ color: "#8aa5be", fontSize: 13 }}>No comments yet.</div>}
              {comments.map((c) => (
                <div key={c.comment_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#fff" }}>{(c.user_name || "?")[0].toUpperCase()}</div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#fff" }}>{c.user_name}</span>
                    <span style={{ fontSize: 10, color: "#8aa5be" }}>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#c8dcea", lineHeight: 1.6, paddingLeft: 30 }}>{c.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && postComment()}
                placeholder="Add a comment…" style={{ flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#fff", outline: "none" }} />
              <button onClick={postComment} disabled={posting}
                style={{ padding: "9px 16px", background: K.gradD, border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: posting ? 0.6 : 1 }}>
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending approvals (owner/admin) ───────────────────────────────────────────
function PendingApprovalsPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]); // client → owner task requests
  const [reviewing, setReviewing] = useState(null);
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [tasksRes, reqRes] = await Promise.all([
        api.get("/tasks/pending-approval").catch(() => ({ data: [] })),
        api.get("/approvals/pending").catch(() => ({ data: [] })),
      ]);
      setItems(tasksRes.data || []);
      setRequests(reqRes.data || []);
    } catch (e) {
      pushToast({ type: "error", title: "Could not load approvals" });
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const decide = async (taskId, action) => {
    try {
      await api.post(`/tasks/${taskId}/${action}`, { notes });
      pushToast({ type: "success", title: action === "approve" ? "Approved" : "Rejected" });
      setReviewing(null); setNotes("");
      load();
    } catch (e) {
      pushToast({ type: "error", title: "Action failed", message: e?.response?.data?.detail || "Try again" });
    }
  };

  const decideRequest = async (approvalId, status) => {
    try {
      await api.post(`/approvals/${approvalId}/review`, { status, notes });
      pushToast({ type: "success", title: status === "approved" ? "Request approved" : "Request rejected" });
      setReviewing(null); setNotes("");
      load();
    } catch (e) {
      pushToast({ type: "error", title: "Action failed", message: e?.response?.data?.detail || "Try again" });
    }
  };

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1 className="page-title">Approvals</h1>
        <p className="text-sm text-muted-foreground" style={{ fontWeight: 400 }}>
          Review client requests and tasks waiting for sign-off.
        </p>
      </div>

      {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--color-muted-foreground)" }}>Loading…</div>}

      {!loading && requests.length === 0 && items.length === 0 && (
        <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
          <CheckCircle2 size={48} style={{ color: K.teal, opacity: 0.4, margin: "0 auto" }} />
          <p style={{ marginTop: 16, fontSize: 15, color: "var(--color-muted-foreground)", fontWeight: 400 }}>
            All caught up — nothing pending.
          </p>
        </div>
      )}

      {/* Client task requests waiting for owner approval */}
      {requests.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--color-muted-foreground)", marginBottom: 12 }}>
            New requests from clients ({requests.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.map((r) => {
              const data = typeof r.request_data === "string" ? JSON.parse(r.request_data) : r.request_data;
              return (
                <div key={r.approval_id} className="elevated-card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{data?.title}</div>
                      {data?.description && (
                        <div style={{ fontSize: 13, color: "var(--color-muted-foreground)", marginTop: 4, fontWeight: 400 }}>
                          {data.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--color-muted-foreground)", marginTop: 8, fontWeight: 400 }}>
                        From {r.requested_by_name || r.requested_by_email}
                        {r.created_at && ` · ${new Date(r.created_at).toLocaleString()}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <Button variant="ghost" onClick={() => { setReviewing({ kind: "request", id: r.approval_id, title: data?.title }); setNotes(""); }}>
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks the team has marked ready for review */}
      {items.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--color-muted-foreground)", marginBottom: 12 }}>
            Tasks pending sign-off ({items.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((t) => (
              <div key={t.task_id} className="elevated-card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                       onClick={() => navigate(`/projects/${t.team_id}`)}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{t.title}</div>
                    {t.description && (
                      <div style={{ fontSize: 13, color: "var(--color-muted-foreground)", marginTop: 4, fontWeight: 400 }}>
                        {t.description}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--color-muted-foreground)", marginTop: 8, fontWeight: 400 }}>
                      {t.team_name && `${t.team_name} · `}
                      Submitted by {t.created_by_name}
                      {t.approval_requested_at && ` · ${new Date(t.approval_requested_at).toLocaleString()}`}
                    </div>
                    {t.approval_notes && (
                      <div style={{ fontSize: 12, marginTop: 8, padding: "6px 10px", background: "var(--color-muted)", borderRadius: 6, fontWeight: 400 }}>
                        Note: {t.approval_notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Button variant="ghost" onClick={() => { setReviewing({ kind: "task", id: t.task_id, title: t.title }); setNotes(""); }}>
                      Review
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}
             title={reviewing?.title ? `Review: ${reviewing.title}` : "Review"}
             footer={
               <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                 <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
                 <Button variant="ghost"
                   onClick={() => reviewing.kind === "task"
                     ? decide(reviewing.id, "reject")
                     : decideRequest(reviewing.id, "rejected")}
                   style={{ color: "#ef4444" }}>
                   Reject
                 </Button>
                 <Button onClick={() => reviewing.kind === "task"
                     ? decide(reviewing.id, "approve")
                     : decideRequest(reviewing.id, "approved")}>
                   Approve
                 </Button>
               </div>
             }>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-muted-foreground)" }}>
            Notes (required if rejecting)
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Optional context for approval, required reason for rejection…"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-input)", fontSize: 14, fontWeight: 400, fontFamily: "inherit", resize: "vertical" }} />
        </div>
      </Modal>
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
