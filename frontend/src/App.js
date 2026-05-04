/**
 * App.js — Kartavya by Aekam Inc
 * Invite-only auth · Projects + per-project boards · Consistent branding
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useLocation, useNavigate, useParams, Outlet,
} from "react-router-dom";
import "./App.css";
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
  Copy, Check, Mail, ChevronRight,
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

// Logo mark — used everywhere
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

// Wordmark
function KWordmark({ dark = false, size = "md" }) {
  const fs = size === "sm" ? 11 : 14;
  const sub = size === "sm" ? 7 : 8;
  return (
    <div>
      <div style={{ fontSize: fs, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase",
        color: dark ? "#fff" : K.dark }}> Kartavya</div>
      <div style={{ fontSize: sub, letterSpacing: 2.5, textTransform: "uppercase",
        color: K.teal, fontWeight: 700, marginTop: 1 }}>by Aekam Inc</div>
    </div>
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
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Nunito',sans-serif", background: "#f4fafd" }}>
      {/* Left dark panel */}
      <div style={{ width: 420, background: K.dark, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: 44, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <KLogo size={36} />
          <KWordmark dark />
        </div>
        <div>
          <h2 style={{ color: "#fff", fontSize: 30, fontWeight: 800, lineHeight: 1.25,
            marginBottom: 12, letterSpacing: -0.5 }}>{title}</h2>
          <p style={{ color: "#8aa5be", fontSize: 13, lineHeight: 1.7 }}>{sub}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["Kanban boards per project", "Client portal with restricted access",
            "Invite-only — no public sign-ups", "In-app & push notifications"].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 20, height: 2, background: K.grad, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#8aa5be" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Right white panel */}
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
        setUser(r.data);
        setReady(true);
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
  if (requiredRole && user?.role !== requiredRole && user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ── App shell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);

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

  return (
    <div data-testid="app-shell" className="min-h-screen bg-app text-foreground" style={{ fontFamily: "'Nunito',sans-serif" }}>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Sidebar />
          <main className="min-w-0">
            <Topbar unread={unread} onOpenNotifications={() => setNotifOpen(true)} />
            <div className="mt-6"><Outlet /></div>
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

  const nav = [
    { to: "/dashboard",               label: "Dashboard",      Icon: LayoutGrid },
    { to: "/projects",                 label: "Projects",       Icon: FolderKanban },
    { to: "/tasks",                    label: "All Tasks",      Icon: ListTodo },
    { to: "/teams",                    label: "Teams",          Icon: Users },
    { to: "/settings/categories",      label: "Categories",     Icon: Settings },
    { to: "/settings/notifications",   label: "Notifications",  Icon: Bell },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", Icon: ShieldCheck }] : []),
  ];

  return (
    <aside className="rounded-3xl border border-border/70 bg-card/50 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-48px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <KLogo size={34} />
          <KWordmark size="sm" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map(({ to, label, Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <button key={to} onClick={() => navigate(to)}
              className={cn("w-full rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-150 flex items-center gap-2.5",
                active
                  ? "text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}
              style={active ? { background: K.gradD } : {}}>
              <Icon size={15} />
              {label}
              {to === "/admin" && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: K.teal + "33", color: K.teal }}>admin</span>}
            </button>
          );
        })}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-border/60">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
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
    "/dashboard": "Dashboard",
    "/projects": "Projects",
    "/tasks": "All Tasks",
    "/teams": "Teams",
    "/settings/categories": "Categories",
    "/settings/notifications": "Notifications",
    "/admin": "Admin Panel",
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
      </Route>
      <Route path="/client" element={<Protected><ClientPortal /></Protected>} />
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

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          {/* Quick add */}
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="text-sm font-bold mb-3">Quick add task</div>
            <div className="flex gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && quickAdd()}
                placeholder="e.g., Review client brief…" />
              <Button onClick={quickAdd} disabled={saving}><Plus size={15} /><span className="ml-1.5">Add</span></Button>
            </div>
          </div>
          {/* Due soon */}
          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">Due in 24 hours</div>
              <Badge tone="info">{summary?.due_24h ?? "—"} tasks</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Head to Tasks or a Project board to act on these.</p>
          </div>
        </div>

        {/* Recent projects */}
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
      pushToast({ type: "success", title: "Project created" });
      load();
    } catch (_) { pushToast({ type: "error", title: "Could not create project" }); }
    finally { setCreating(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete project "${p.name}"? All tasks in it will be deleted.`)) return;
    try {
      await api.delete(`/teams/${p.team_id}`);
      pushToast({ type: "success", title: "Project deleted" }); load();
    } catch (_) { pushToast({ type: "error", title: "Could not delete" }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Projects</div>
          <div className="text-sm text-muted-foreground mt-0.5">Each project has its own Kanban board.</div>
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

// ── Project Board ─────────────────────────────────────────────────────────────
function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [categories, setCats] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const cols = useMemo(() => [
    { id: "todo", title: "To Do", color: K.blue },
    { id: "in_progress", title: "In Progress", color: K.mid },
    { id: "done", title: "Done", color: K.teal },
  ], []);

  const load = useCallback(async () => {
    const [proj, t, c] = await Promise.all([
      api.get(`/teams/${projectId}`),
      api.get("/tasks", { params: { team_id: projectId } }),
      api.get("/categories"),
    ]);
    setProject(proj.data);
    setTasks(t.data);
    setCats(c.data);
  }, [projectId]);

  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load board" })); }, [load, pushToast]);

  const grouped = useMemo(() => {
    const m = { todo: [], in_progress: [], done: [] };
    tasks.forEach((t) => m[t.status]?.push(t));
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return m;
  }, [tasks]);

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
    const srcList = Array.from(grouped[source.droppableId]);
    const dstList = source.droppableId === destination.droppableId ? srcList : Array.from(grouped[destination.droppableId]);
    const moving = srcList.find((t) => t.task_id === draggableId); if (!moving) return;
    srcList.splice(srcList.findIndex((t) => t.task_id === draggableId), 1);
    dstList.splice(destination.index, 0, { ...moving, status: destination.droppableId });
    const next = tasks.map((t) => t.task_id === draggableId ? { ...t, status: destination.droppableId } : t);
    [[srcList, source.droppableId], [dstList, destination.droppableId]].forEach(([list, st]) =>
      list.forEach((t, i) => { const idx = next.findIndex((x) => x.task_id === t.task_id); if (idx >= 0) next[idx] = { ...next[idx], status: st, order: i }; }));
    setTasks(next);
    try { await api.patch(`/tasks/${draggableId}/move`, { status: destination.droppableId, order: destination.index }); }
    catch (_) { pushToast({ type: "error", title: "Move failed" }); load(); }
  };

  const catName = (id) => categories.find((c) => c.category_id === id)?.name || "";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/projects")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Projects</button>
        <ChevronRight size={14} className="text-muted-foreground" />
        <div className="text-sm font-bold">{project?.team?.name || "…"}</div>
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus size={15} /><span className="ml-1.5">New task</span>
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid gap-4 lg:grid-cols-3">
          {cols.map((col) => (
            <div key={col.id} className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span className="text-sm font-bold">{col.title}</span>
                </div>
                <Badge tone="neutral">{grouped[col.id]?.length ?? 0}</Badge>
              </div>
              <Droppable droppableId={col.id}>{(prov) => (
                <div ref={prov.innerRef} {...prov.droppableProps} className="flex-1 min-h-[300px] p-3 space-y-2">
                  {grouped[col.id].map((t, i) => (
                    <Draggable key={t.task_id} draggableId={t.task_id} index={i}>{(drag) => (
                      <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}
                        onClick={() => { setEditing(t); setEditorOpen(true); }}
                        className="rounded-2xl border border-border/60 bg-background/50 p-3.5 shadow-sm cursor-pointer hover:border-border transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold leading-snug truncate">{t.title}</div>
                          <Badge tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warning" : "info"} className="shrink-0">
                            {t.priority}
                          </Badge>
                        </div>
                        {t.description && <div className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                        {t.category_id && <div className="mt-2 text-xs text-muted-foreground">{catName(t.category_id)}</div>}
                        {t.due_at && <div className="mt-2 text-xs font-medium" style={{ color: new Date(t.due_at) < new Date() ? "#ef4444" : K.mid }}>Due {formatDue(t.due_at)}</div>}
                        {(t.subtasks || []).length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground mb-1">{t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length} subtasks</div>
                            <div className="h-1 rounded-full bg-border/60 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(t.subtasks.filter((s) => s.is_done).length / t.subtasks.length) * 100}%`, background: K.gradD }} />
                            </div>
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">{(t.tags || []).slice(0,3).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}</div>
                      </div>
                    )}</Draggable>
                  ))}
                  {prov.placeholder}
                </div>
              )}</Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <TaskEditor
        key={editing ? editing.task_id : "new"}
        open={editorOpen} onOpenChange={setEditorOpen}
        editing={editing} categories={categories}
        teams={project ? [{ team_id: projectId, name: project.team?.name || "This project" }] : []}
        defaultTeamId={projectId}
        onSaved={(task) => {
          setEditorOpen(false); setEditing(null);
          setTasks((prev) => {
            const e = prev.some((t) => t.task_id === task.task_id);
            return e ? prev.map((t) => t.task_id === task.task_id ? task : t) : [task, ...prev];
          });
        }}
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
function TaskEditor({ open, onOpenChange, editing, categories, teams, defaultTeamId, onSaved }) {
  const { pushToast } = useToast();
  const [teamMembers, setTeamMembers] = useState([]);
  const [yourRole, setYourRole] = useState("member");
  const [loadingMembers, setLoadingMembers] = useState(false);

  const blank = { title: "", description: "", status: "todo", priority: "medium", category_id: "", tags: "", team_id: defaultTeamId || "", assign_scope: "none", assignee_user_ids: [], due_at: "", reminder_at: "", estimated_minutes: "", recurrence_rule: "none", recurrence_interval: 1, attachments: [{ name: "", url: "" }], custom_fields_text: "{}", subtasks: [{ title: "", is_done: false }] };

  const initial = useMemo(() => {
    if (!editing) return blank;
    return {
      title: editing.title || "", description: editing.description || "", status: editing.status || "todo", priority: editing.priority || "medium",
      category_id: editing.category_id || "", tags: (editing.tags || []).join(", "), team_id: editing.team_id || defaultTeamId || "",
      assign_scope: (editing.assignee_user_ids || []).length ? "members" : "none", assignee_user_ids: editing.assignee_user_ids || [],
      due_at: toLocal(editing.due_at), reminder_at: toLocal(editing.reminder_at),
      estimated_minutes: editing.estimated_minutes ? String(editing.estimated_minutes) : "",
      recurrence_rule: editing.recurrence?.rule || "none", recurrence_interval: editing.recurrence?.interval || 1,
      attachments: (editing.attachments || []).length ? editing.attachments : [{ name: "", url: "" }],
      custom_fields_text: JSON.stringify(editing.custom_fields || {}, null, 2),
      subtasks: (editing.subtasks || []).length ? editing.subtasks : [{ title: "", is_done: false }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, defaultTeamId]);

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

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: "error", title: "Missing title" }); return; }
    let customFields = {};
    try { customFields = form.custom_fields_text?.trim() ? JSON.parse(form.custom_fields_text) : {}; }
    catch (_) { pushToast({ type: "error", title: "Custom fields must be valid JSON" }); return; }
    const assignees = form.assign_scope === "whole_team" && form.team_id ? teamMembers.map((m) => m.user_id) : (form.assignee_user_ids || []);
    const payload = {
      title: form.title.trim(), description: form.description?.trim() || null, status: form.status, priority: form.priority,
      category_id: form.category_id || null, tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      team_id: form.team_id || null, assignee_user_ids: assignees,
      due_at: fromLocal(form.due_at), reminder_at: form.reminder_at ? fromLocal(form.reminder_at) : null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      recurrence: { rule: form.recurrence_rule, interval: Number(form.recurrence_interval) || 1 },
      attachments: (form.attachments || []).filter((a) => a.url && a.name),
      custom_fields: customFields,
      subtasks: (form.subtasks || []).filter((s) => s.title?.trim()).map((s, i) => ({ title: s.title.trim(), is_done: !!s.is_done, order: i })),
    };
    try {
      const r = editing ? await api.put(`/tasks/${editing.task_id}`, payload) : await api.post("/tasks", payload);
      pushToast({ type: "success", title: "Saved" }); onSaved(r.data);
    } catch (e) { pushToast({ type: "error", title: "Could not save", message: e?.response?.data?.detail || "Try again." }); }
  };

  const F = ({ label, children }) => (
    <div>
      <div className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? "Edit task" : "New task"} dataTestId="task-editor-modal"
      footer={<div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Save task</Button></div>}>
      <div className="space-y-4">
        <F label="Title"><Input value={form.title} onChange={(e) => upd("title", e.target.value)} placeholder="Task title…" /></F>
        <F label="Notes"><textarea value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder="Context, links, notes…" className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" rows={3} /></F>
        <div className="grid gap-3 md:grid-cols-4">
          <F label="Project"><Select value={form.team_id} onChange={(v) => setForm((p) => ({ ...p, team_id: v, assign_scope: "none", assignee_user_ids: [] }))} options={[{ value: "", label: "Personal" }, ...teams.map((t) => ({ value: t.team_id, label: t.name }))]} /></F>
          <F label="Status"><Select value={form.status} onChange={(v) => upd("status", v)} options={[{ value: "todo", label: "Todo" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" }]} /></F>
          <F label="Priority"><Select value={form.priority} onChange={(v) => upd("priority", v)} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} /></F>
          <F label="Category"><Select value={form.category_id} onChange={(v) => upd("category_id", v)} options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} /></F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Due date"><Input type="datetime-local" value={form.due_at} onChange={(e) => upd("due_at", e.target.value)} /></F>
          <F label="Reminder"><Input type="datetime-local" value={form.reminder_at} onChange={(e) => upd("reminder_at", e.target.value)} /></F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Tags"><Input value={form.tags} onChange={(e) => upd("tags", e.target.value)} placeholder="Design, review… (comma-separated)" /></F>
          <F label="Estimated minutes"><Input value={form.estimated_minutes} onChange={(e) => upd("estimated_minutes", e.target.value)} placeholder="e.g., 45" /></F>
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
        <F label="Subtasks">
          <div className="space-y-2">
            {form.subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={!!s.is_done} onChange={(e) => setForm((p) => ({ ...p, subtasks: p.subtasks.map((x, j) => j === i ? { ...x, is_done: e.target.checked } : x) }))} />
                <Input value={s.title} onChange={(e) => setForm((p) => ({ ...p, subtasks: p.subtasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} placeholder={`Subtask ${i + 1}`} />
                <Button variant="ghost" onClick={() => setForm((p) => ({ ...p, subtasks: p.subtasks.filter((_, j) => j !== i) }))}>✕</Button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setForm((p) => ({ ...p, subtasks: [...p.subtasks, { title: "", is_done: false }] }))}>+ Add subtask</Button>
          </div>
        </F>
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

  const load = () => Promise.all([
    api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {}),
    api.get("/admin/invites").then((r) => setInvites(r.data)).catch(() => {}),
  ]);
  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      const r = await api.post("/admin/invites", { email: inviteEmail.trim(), role: inviteRole });
      pushToast({ type: "success", title: "Invite created", message: r.data.invite_link });
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
    if (!window.confirm(`Remove ${u.name}?`)) return;
    await api.delete(`/admin/users/${u.user_id}`).catch(() => {});
    pushToast({ type: "success", title: "User removed" }); load();
  };

  const changeRole = async (u, role) => {
    await api.put(`/admin/users/${u.user_id}/role`, { role }).catch(() => {});
    load();
  };

  return (
    <div className="space-y-6">
      {/* Send invite */}
      <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={16} style={{ color: K.blue }} />
          <div className="text-sm font-bold">Send Invite</div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_160px_120px]">
          <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendInvite()}
            placeholder="client@company.com" type="email" />
          <Select value={inviteRole} onChange={setInviteRole} options={[{ value: "member", label: "Member" }, { value: "client", label: "Client" }]} />
          <Button onClick={sendInvite} disabled={sending}>{sending ? "Sending…" : "Send Invite"}</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Members get full workspace access. Clients see only tasks you share with them.</p>
      </div>

      {/* Pending invites */}
      {invites.filter((i) => !i.accepted_at).length > 0 && (
        <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 text-sm font-bold">Pending Invites</div>
          {invites.filter((i) => !i.accepted_at).map((inv) => (
            <div key={inv.invite_id} className="flex items-center gap-3 border-b border-border/40 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{inv.email}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="capitalize">{inv.role}</span> · Expires {new Date(inv.expires_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => copyLink(inv.invite_link, inv.invite_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border/60 hover:bg-muted/40 transition-colors">
                {copiedId === inv.invite_id ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy link</>}
              </button>
              <Button variant="ghost" onClick={() => revokeInvite(inv.invite_id)} className="px-2 h-8"><Trash2 size={13} /></Button>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/60 text-sm font-bold">All Users ({users.length})</div>
        {users.map((u) => (
          <div key={u.user_id} className="flex items-center gap-3 border-b border-border/40 px-5 py-3.5">
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {(u.name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
            <Select value={u.role} onChange={(role) => changeRole(u, role)}
              options={[{ value: "admin", label: "Admin" }, { value: "member", label: "Member" }, { value: "client", label: "Client" }]} />
            <Button variant="ghost" onClick={() => removeUser(u)} className="px-2 h-8"><Trash2 size={13} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Client portal ─────────────────────────────────────────────────────────────
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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <KLogo size={36} />
          <KWordmark dark />
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
        {/* Task list */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase", color: K.teal, marginBottom: 16 }}>Your Updates</div>
          {tasks.length === 0 && <div style={{ color: "#8aa5be", fontSize: 14 }}>No tasks shared with you yet.</div>}
          {tasks.map((t) => (
            <div key={t.task_id} onClick={() => setSelected(selected?.task_id === t.task_id ? null : t)}
              style={{ background: selected?.task_id === t.task_id ? K.card : "rgba(255,255,255,.04)", border: `1px solid ${selected?.task_id === t.task_id ? K.blue : "rgba(255,255,255,.08)"}`, borderRadius: 16, padding: "16px 20px", marginBottom: 10, cursor: "pointer", transition: "all .15s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{t.title}</div>
                  {t.description && <div style={{ fontSize: 12, color: "#8aa5be", lineHeight: 1.5 }}>{t.description}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: statusColor[t.status] || K.teal, background: (statusColor[t.status] || K.teal) + "22", padding: "3px 8px", borderRadius: 6 }}>
                    {t.status === "in_progress" ? "In Progress" : t.status}
                  </span>
                  {t.due_at && <span style={{ fontSize: 11, color: "#8aa5be" }}>Due {formatDue(t.due_at)}</span>}
                </div>
              </div>
              {(t.subtasks || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: K.gradD, borderRadius: 4, width: `${(t.subtasks.filter((s) => s.is_done).length / t.subtasks.length) * 100}%`, transition: "width .3s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8aa5be", marginTop: 4 }}>{t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length} subtasks complete</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Comments panel */}
        {selected && (
          <div style={{ background: K.card, border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: K.teal, marginBottom: 4 }}>Comments</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 12 }}>{selected.title}</div>
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
              {comments.length === 0 && <div style={{ color: "#8aa5be", fontSize: 13 }}>No comments yet. Be the first.</div>}
              {comments.map((c) => (
                <div key={c.comment_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>{(c.user_name || "?")[0].toUpperCase()}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{c.user_name}</span>
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
                style={{ padding: "9px 16px", background: K.gradD, border: "none", borderRadius: 10, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer", opacity: posting ? 0.6 : 1 }}>
                Post
              </button>
            </div>
          </div>
        )}
      </div>
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
