import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Outlet,
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
  Bell,
  CalendarClock,
  LayoutGrid,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  Sun,
  Moon,
  Tag,
  Users,
} from "lucide-react";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("kartavya_theme");
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("kartavya_theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

function formatDue(dueAt) {
  if (!dueAt) return "";
  const d = new Date(dueAt);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(v) {
  if (!v) return null;
  const d = new Date(v);
  return d.toISOString();
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tasks" element={<TasksListPage />} />
        <Route path="board" element={<BoardPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="settings/categories" element={<CategoriesPage />} />
        <Route path="settings/notifications" element={<NotificationsSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function Protected({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthed, setIsAuthed] = useState(null);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setIsAuthed(false);
      navigate("/login", { replace: true, state: { from: location.pathname } });
      return;
    }
    (async () => {
      try {
        const res = await api.get("/auth/me");
        if (!mounted) return;
        window.__kartavya_user = res.data;
        setIsAuthed(true);
      } catch (e) {
        if (!mounted) return;
        localStorage.removeItem("auth_token");
        setIsAuthed(false);
        navigate("/login", { replace: true, state: { from: location.pathname } });
      }
    })();
    return () => { mounted = false; };
  }, [navigate, location.pathname]);

  if (isAuthed === null) {
    return (
      <div className="min-h-screen bg-app text-foreground flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading Kartavya…</div>
      </div>
    );
  }

  if (!isAuthed) return null;
  return children;
}

// ── Kartavya branded Login page ──────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email: form.email, password: form.password });
      localStorage.setItem("auth_token", res.data.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      pushToast({ type: "error", title: "Login failed", message: err?.response?.data?.detail || "Invalid email or password" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Nunito', sans-serif", background: "#f4fafd" }}>
      {/* Left panel */}
      <div style={{ width: 420, background: "#050e1a", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 44, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#0082c6,#05b7aa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none"><path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/><path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: 2.5, textTransform: "uppercase" }}>Kartavya</div>
            <div style={{ fontSize: 8, letterSpacing: 3, textTransform: "uppercase", color: "#05b7aa", marginTop: 2, fontWeight: 700 }}>by Aekam Inc</div>
          </div>
        </div>
        <div>
          <h2 style={{ color: "#fff", fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 12, letterSpacing: -0.5 }}>Do what<br /><span style={{ background: "linear-gradient(90deg,#0082c6,#05b7aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>must be done.</span></h2>
          <p style={{ color: "#8aa5be", fontSize: 13, lineHeight: 1.7 }}>Team task management built for Indian businesses — from solo founders to full agency teams.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["Kanban boards, list views & due dates", "Team roles, assignments & reminders", "Browser push & in-app notifications", "Web app + Android — one backend"].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 20, height: 2, background: "linear-gradient(90deg,#0082c6,#05b7aa)", borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#8aa5be" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 60px", maxWidth: 520, background: "#fff" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: "uppercase", color: "#03a1b6", marginBottom: 8 }}>Welcome back</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>Sign in to<br /><span style={{ color: "#0082c6" }}>Kartavya</span></h1>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#5a7087", marginBottom: 6 }}>Email address</label>
            <input name="email" type="email" value={form.email} onChange={handle} required placeholder="you@aekaminc.com" style={{ width: "100%", padding: "11px 14px", background: "#f4fafd", border: "1.5px solid #d0e8f5", borderRadius: 8, fontSize: 14, color: "#0a1628", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#5a7087", marginBottom: 6 }}>Password</label>
            <input name="password" type="password" value={form.password} onChange={handle} required placeholder="••••••••••" style={{ width: "100%", padding: "11px 14px", background: "#f4fafd", border: "1.5px solid #d0e8f5", borderRadius: 8, fontSize: 14, color: "#0a1628", outline: "none", boxSizing: "border-box" }} />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 13, background: "linear-gradient(90deg,#0082c6,#03a1b6,#05b7aa)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p style={{ textAlign: "center", fontSize: 13, color: "#5a7087", marginTop: 18 }}>No account?{" "}<span onClick={() => navigate("/register")} style={{ color: "#0082c6", fontWeight: 800, cursor: "pointer" }}>Create one free</span></p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 18, marginTop: 18, borderTop: "1px solid #d0e8f5", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase" }}>
          <span style={{ color: "#b8cedd", fontWeight: 700 }}>Powered by</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#05b7aa" }} />
          <span style={{ color: "#03a1b6", fontWeight: 800 }}>Aekam Inc</span>
        </div>
      </div>
    </div>
  );
}

// ── Kartavya branded Register page ───────────────────────────────────────────
function RegisterPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { pushToast({ type: "error", title: "Passwords don't match", message: "Please check and try again." }); return; }
    if (form.password.length < 8) { pushToast({ type: "error", title: "Password too short", message: "Minimum 8 characters." }); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { name: form.name, email: form.email, password: form.password });
      localStorage.setItem("auth_token", res.data.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      pushToast({ type: "error", title: "Registration failed", message: err?.response?.data?.detail || "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Nunito', sans-serif", background: "#f4fafd" }}>
      <div style={{ width: 420, background: "#050e1a", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 44, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#0082c6,#05b7aa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none"><path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/><path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: 2.5, textTransform: "uppercase" }}>Kartavya</div>
            <div style={{ fontSize: 8, letterSpacing: 3, textTransform: "uppercase", color: "#05b7aa", marginTop: 2, fontWeight: 700 }}>by Aekam Inc</div>
          </div>
        </div>
        <div>
          <h2 style={{ color: "#fff", fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 12 }}>Get started<br /><span style={{ background: "linear-gradient(90deg,#0082c6,#05b7aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>for free.</span></h2>
          <p style={{ color: "#8aa5be", fontSize: 13, lineHeight: 1.7 }}>Join Kartavya and start managing your team tasks the right way.</p>
        </div>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>by Aekam Inc — aekaminc.com</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 60px", maxWidth: 520, background: "#fff" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: "uppercase", color: "#03a1b6", marginBottom: 8 }}>Get started free</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>Join<br /><span style={{ color: "#0082c6" }}>Kartavya</span></h1>
        </div>
        <form onSubmit={submit}>
          {[
            { label: "Full name", name: "name", type: "text", ph: "Jane Smith" },
            { label: "Email address", name: "email", type: "email", ph: "you@aekaminc.com" },
            { label: "Password", name: "password", type: "password", ph: "At least 8 characters" },
            { label: "Confirm password", name: "confirm", type: "password", ph: "••••••••••" },
          ].map(({ label, name, type, ph }) => (
            <div key={name} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#5a7087", marginBottom: 6 }}>{label}</label>
              <input name={name} type={type} value={form[name]} onChange={handle} required placeholder={ph} style={{ width: "100%", padding: "11px 14px", background: "#f4fafd", border: "1.5px solid #d0e8f5", borderRadius: 8, fontSize: 14, color: "#0a1628", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 13, background: "linear-gradient(90deg,#0082c6,#03a1b6,#05b7aa)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p style={{ textAlign: "center", fontSize: 13, color: "#5a7087", marginTop: 18 }}>Already have an account?{" "}<span onClick={() => navigate("/login")} style={{ color: "#0082c6", fontWeight: 800, cursor: "pointer" }}>Sign in</span></p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 18, marginTop: 18, borderTop: "1px solid #d0e8f5", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase" }}>
          <span style={{ color: "#b8cedd", fontWeight: 700 }}>Powered by</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#05b7aa" }} />
          <span style={{ color: "#03a1b6", fontWeight: 800 }}>Aekam Inc</span>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, title, testid }) {
  return (
    <div data-testid={testid} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
      <div className="text-violet-500">{icon}</div>
      <div className="text-sm font-medium">{title}</div>
    </div>
  );
}

function PreviewItem({ title, desc, testid }) {
  return (
    <div data-testid={testid} className="rounded-2xl border border-border/60 bg-background/30 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}

function AppShell() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        await api.post("/notifications/process");
        const res = await api.get("/notifications", { params: { unread_only: true } });
        if (!mounted) return;
        setUnread(res.data.length);
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div data-testid="app-shell" className="min-h-screen bg-app text-foreground">
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

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, testid: "sidebar-nav-dashboard" },
    { to: "/tasks", label: "Tasks", icon: ListTodo, testid: "sidebar-nav-tasks" },
    { to: "/board", label: "Board", icon: LayoutGrid, testid: "sidebar-nav-board" },
    { to: "/teams", label: "Teams", icon: Users, testid: "sidebar-nav-teams" },
    { to: "/settings/categories", label: "Categories", icon: Settings, testid: "sidebar-nav-categories" },
    { to: "/settings/notifications", label: "Notifications", icon: Bell, testid: "sidebar-nav-notifications" },
  ];

  return (
    <aside data-testid="sidebar" className="rounded-3xl border border-border/70 bg-card/50 p-4 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#0082c6,#05b7aa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none"><path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/><path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/></svg>
          </div>
          <div>
            <div data-testid="sidebar-brand" className="text-sm font-semibold tracking-tight" style={{ letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 }}>Kartavya</div>
            <div data-testid="sidebar-brand-caption" className="text-xs text-muted-foreground" style={{ fontSize: 9, letterSpacing: 2, color: "#05b7aa" }}>by Aekam Inc</div>
          </div>
        </div>
        <Button data-testid="sidebar-theme-toggle" variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>

      <div className="mt-5 space-y-1">
        {nav.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <button key={item.to} data-testid={item.testid} onClick={() => navigate(item.to)}
              className={cn("w-full rounded-2xl px-3 py-2 text-left text-sm font-medium", "transition-colors duration-150",
                active ? "bg-violet-500/15 text-violet-100 dark:text-violet-50" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
              <span className="inline-flex items-center gap-2"><Icon size={16} />{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function Topbar({ unread, onOpenNotifications }) {
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const handleLogout = async () => {
    try { await api.post("/auth/logout"); } catch (e) {}
    localStorage.removeItem("auth_token");
    pushToast({ type: "success", title: "Logged out", message: "See you next time." });
    navigate("/login", { replace: true });
  };

  return (
    <div data-testid="topbar" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/50 px-4 py-3">
      <div className="min-w-0">
        <div data-testid="topbar-title" className="text-sm font-semibold">Workspace</div>
        <div data-testid="topbar-subtitle" className="text-xs text-muted-foreground">Plan, ship, repeat.</div>
      </div>
      <div className="flex items-center gap-2">
        <button data-testid="topbar-notifications-button" onClick={onOpenNotifications}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/30 transition-colors duration-150 hover:bg-muted/40">
          <Bell size={16} />
          {unread ? (
            <span data-testid="topbar-notifications-unread" className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[11px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
        <Button data-testid="topbar-logout-button" variant="ghost" onClick={handleLogout}>
          <LogOut size={16} /><span className="ml-2 text-sm">Logout</span>
        </Button>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { pushToast } = useToast();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/dashboard/summary");
        setSummary(res.data);
      } catch (e) {
        pushToast({ type: "error", title: "Could not load dashboard", message: "Try refreshing." });
      }
    })();
  }, [pushToast]);

  return (
    <div data-testid="dashboard-page" className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard testid="dashboard-stat-todo" label="Todo" value={summary?.todo ?? "—"} />
        <StatCard testid="dashboard-stat-inprogress" label="In progress" value={summary?.in_progress ?? "—"} />
        <StatCard testid="dashboard-stat-done" label="Done" value={summary?.done ?? "—"} />
        <StatCard testid="dashboard-stat-overdue" label="Overdue" value={summary?.overdue ?? "—"} tone="danger" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-border/70 bg-card/50 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div data-testid="dashboard-focus-title" className="text-sm font-semibold">Today's focus</div>
                <div data-testid="dashboard-focus-subtitle" className="mt-1 text-sm text-muted-foreground">Overdue tasks and due within 24h are a good place to start.</div>
              </div>
              <Badge data-testid="dashboard-due24h-badge" tone="info">Due 24h: {summary?.due_24h ?? "—"}</Badge>
            </div>
            <div className="mt-5 rounded-2xl border border-border/60 bg-background/30 p-4">
              <div data-testid="dashboard-note" className="text-sm text-muted-foreground">Create team tasks, assign them, and enable browser notifications for reminders.</div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5"><QuickAddCard /></div>
      </div>
    </div>
  );
}

function StatCard({ label, value, testid, tone }) {
  const toneClass = tone === "danger" ? "from-rose-500/15 to-transparent" : "from-violet-500/15 to-transparent";
  return (
    <div data-testid={testid} className={cn("rounded-3xl border border-border/70 bg-card/50 p-5", "bg-gradient-to-b", toneClass)}>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function QuickAddCard() {
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) { pushToast({ type: "error", title: "Missing title", message: "Add a task title." }); return; }
    setSaving(true);
    try {
      await api.post("/tasks", { title: title.trim(), status: "todo", priority: "medium" });
      setTitle("");
      pushToast({ type: "success", title: "Task created", message: "Added to Todo." });
    } catch (e) {
      pushToast({ type: "error", title: "Could not create", message: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="dashboard-quickadd" className="rounded-3xl border border-border/70 bg-card/50 p-6">
      <div data-testid="dashboard-quickadd-title" className="text-sm font-semibold">Quick add</div>
      <div data-testid="dashboard-quickadd-subtitle" className="mt-1 text-sm text-muted-foreground">Capture something now, polish it later.</div>
      <div className="mt-4 flex items-center gap-2">
        <Input data-testid="dashboard-quickadd-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Draft project brief" />
        <Button data-testid="dashboard-quickadd-button" onClick={create} disabled={saving}><Plus size={16} /><span className="ml-2">Add</span></Button>
      </div>
    </div>
  );
}

function TasksListPage() {
  const { pushToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filters, setFilters] = useState({ status: "", category_id: "", q: "", team_id: "", assigned_to_me: false });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editorKey, setEditorKey] = useState("new");

  const load = async () => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.category_id) params.category_id = filters.category_id;
    if (filters.q) params.q = filters.q;
    if (filters.team_id) params.team_id = filters.team_id;
    if (filters.assigned_to_me) params.assigned_to_me = true;
    const [t, c, te] = await Promise.all([api.get("/tasks", { params }), api.get("/categories"), api.get("/teams")]);
    setTasks(t.data); setCategories(c.data); setTeams(te.data);
  };

  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load tasks", message: "Try refreshing." })); }, []);
  useEffect(() => { const t = setTimeout(() => load().catch(() => {}), 250); return () => clearTimeout(t); }, [filters.status, filters.category_id, filters.q, filters.team_id, filters.assigned_to_me]);

  const onCreate = () => { setEditing(null); setEditorKey(`new_${Date.now()}`); setEditorOpen(true); };
  const onEdit = (task) => { setEditing(task); setEditorKey(`edit_${task.task_id}`); setEditorOpen(true); };
  const onToggle = async (task) => {
    try { const res = await api.patch(`/tasks/${task.task_id}/toggle`); setTasks((prev) => prev.map((t) => (t.task_id === task.task_id ? res.data : t))); }
    catch (e) { pushToast({ type: "error", title: "Could not update", message: "Try again." }); }
  };
  const onDelete = async (task) => {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    try { await api.delete(`/tasks/${task.task_id}`); setTasks((prev) => prev.filter((t) => t.task_id !== task.task_id)); pushToast({ type: "success", title: "Deleted", message: "Task removed." }); }
    catch (e) { pushToast({ type: "error", title: "Could not delete", message: "Try again." }); }
  };
  const scopeLabel = (t) => { if (t.team_id) return `Team: ${teams.find((x) => x.team_id === t.team_id)?.name || t.team_id}`; return "Personal"; };

  return (
    <div data-testid="tasks-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div data-testid="tasks-title" className="text-sm font-semibold">Tasks</div><div data-testid="tasks-subtitle" className="mt-1 text-sm text-muted-foreground">Personal + team tasks.</div></div>
        <Button data-testid="tasks-create-button" onClick={onCreate}><Plus size={16} /><span className="ml-2">New task</span></Button>
      </div>
      <div data-testid="tasks-filters" className="rounded-3xl border border-border/70 bg-card/50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Status</div><Select data-testid="tasks-filter-status" value={filters.status} onChange={(v) => setFilters((p) => ({ ...p, status: v }))} options={[{ value: "", label: "All" }, { value: "todo", label: "Todo" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" }]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Team</div><Select data-testid="tasks-filter-team" value={filters.team_id} onChange={(v) => setFilters((p) => ({ ...p, team_id: v }))} options={[{ value: "", label: "All scopes" }, ...teams.map((t) => ({ value: t.team_id, label: t.name }))]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Category</div><Select data-testid="tasks-filter-category" value={filters.category_id} onChange={(v) => setFilters((p) => ({ ...p, category_id: v }))} options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Search</div><Input data-testid="tasks-filter-search" value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Search by title…" /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Assigned</div><button data-testid="tasks-filter-assigned-to-me" onClick={() => setFilters((p) => ({ ...p, assigned_to_me: !p.assigned_to_me }))} className={cn("h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm transition-colors duration-150 hover:bg-muted/40", filters.assigned_to_me ? "ring-2 ring-violet-500/30" : "")}>{filters.assigned_to_me ? "Assigned to me" : "All"}</button></div>
        </div>
      </div>
      <div data-testid="tasks-table" className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_200px_140px_180px_220px_160px] gap-0 border-b border-border/60 px-5 py-3 text-xs font-semibold text-muted-foreground">
          <div>Title</div><div>Scope</div><div>Status</div><div>Priority</div><div>Due</div><div className="text-right">Actions</div>
        </div>
        {tasks.length === 0 ? (<div data-testid="tasks-empty" className="px-5 py-8 text-sm text-muted-foreground">No tasks found. Create one.</div>) : (
          <div>{tasks.map((t) => (
            <div key={t.task_id} data-testid={`task-row-${t.task_id}`} className="grid grid-cols-[1fr_200px_140px_180px_220px_160px] items-center border-b border-border/40 px-5 py-4">
              <button data-testid={`task-row-title-button-${t.task_id}`} onClick={() => onEdit(t)} className="min-w-0 text-left"><div className="truncate text-sm font-semibold">{t.title}</div><div className="mt-1 flex flex-wrap gap-1">{(t.tags || []).slice(0, 3).map((tag) => (<Badge key={tag} tone="neutral">{tag}</Badge>))}{(t.assignee_user_ids || []).length ? (<Badge tone="info">{(t.assignee_user_ids || []).length} assignee(s)</Badge>) : null}</div></button>
              <div className="text-sm text-muted-foreground">{scopeLabel(t)}</div>
              <div className="text-sm text-muted-foreground">{t.status === "in_progress" ? "In progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1)}</div>
              <div className="text-sm text-muted-foreground">{t.priority}</div>
              <div className="text-sm text-muted-foreground">{t.due_at ? formatDue(t.due_at) : "—"}</div>
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onToggle(t)}>{t.status === "done" ? "Reopen" : "Complete"}</Button><Button variant="ghost" onClick={() => onDelete(t)}>Delete</Button></div>
            </div>
          ))}</div>
        )}
      </div>
      <TaskEditor key={editorKey} open={editorOpen} onOpenChange={setEditorOpen} editing={editing} categories={categories} teams={teams} onSaved={(task) => { setEditorOpen(false); setEditing(null); setTasks((prev) => { const exists = prev.some((t) => t.task_id === task.task_id); if (exists) return prev.map((t) => (t.task_id === task.task_id ? task : t)); return [task, ...prev]; }); }} />
    </div>
  );
}

function TaskEditor({ open, onOpenChange, editing, categories, teams, onSaved }) {
  const { pushToast } = useToast();
  const [teamMembers, setTeamMembers] = useState([]);
  const [yourRole, setYourRole] = useState("member");
  const [teamPermLoading, setTeamPermLoading] = useState(false);

  const initial = useMemo(() => {
    if (!editing) return { title: "", description: "", status: "todo", priority: "medium", category_id: "", tags: "", team_id: "", assign_scope: "none", assignee_user_ids: [], due_at: "", reminder_at: "", estimated_minutes: "", recurrence_rule: "none", recurrence_interval: 1, attachments: [{ name: "", url: "" }], custom_fields_text: "{}", subtasks: [{ title: "", is_done: false }] };
    return { title: editing.title || "", description: editing.description || "", status: editing.status || "todo", priority: editing.priority || "medium", category_id: editing.category_id || "", tags: (editing.tags || []).join(", "), team_id: editing.team_id || "", assign_scope: (editing.assignee_user_ids || []).length ? "members" : "none", assignee_user_ids: editing.assignee_user_ids || [], due_at: toDatetimeLocalValue(editing.due_at), reminder_at: toDatetimeLocalValue(editing.reminder_at), estimated_minutes: editing.estimated_minutes ? String(editing.estimated_minutes) : "", recurrence_rule: editing.recurrence?.rule || "none", recurrence_interval: editing.recurrence?.interval || 1, attachments: editing.attachments && editing.attachments.length ? editing.attachments : [{ name: "", url: "" }], custom_fields_text: JSON.stringify(editing.custom_fields || {}, null, 2), subtasks: editing.subtasks && editing.subtasks.length ? editing.subtasks : [{ title: "", is_done: false }] };
  }, [editing]);

  const [form, setForm] = useState(initial);
  useEffect(() => { setForm(initial); }, [initial]);

  const isTeamTask = !!form.team_id;
  useEffect(() => {
    if (!open || !form.team_id) { setTeamMembers([]); setYourRole("member"); setTeamPermLoading(false); return; }
    let mounted = true; setTeamPermLoading(true);
    (async () => { try { const res = await api.get(`/teams/${form.team_id}`); if (!mounted) return; setTeamMembers((res.data.members || []).filter((m) => m.status === "active" && m.user_id)); setYourRole(res.data.your_role || "member"); } catch (e) { if (!mounted) return; setTeamMembers([]); setYourRole("member"); } finally { if (mounted) setTeamPermLoading(false); } })();
    return () => { mounted = false; };
  }, [open, form.team_id]);

  const canEditAssignments = !isTeamTask || yourRole === "owner" || yourRole === "admin";

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: "error", title: "Missing title", message: "Task title is required." }); return; }
    let customFields = {};
    try { customFields = form.custom_fields_text?.trim() ? JSON.parse(form.custom_fields_text) : {}; } catch (e) { pushToast({ type: "error", title: "Custom fields", message: "Must be valid JSON." }); return; }
    let assignees = form.assignee_user_ids || [];
    if (form.assign_scope === "whole_team" && isTeamTask) assignees = teamMembers.map((m) => m.user_id);
    const payload = { title: form.title.trim(), description: form.description?.trim() || null, status: form.status, priority: form.priority, category_id: form.category_id || null, tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [], team_id: form.team_id || null, assignee_user_ids: assignees, due_at: fromDatetimeLocalValue(form.due_at), reminder_at: form.reminder_at ? fromDatetimeLocalValue(form.reminder_at) : null, estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null, recurrence: { rule: form.recurrence_rule, interval: Number(form.recurrence_interval) || 1 }, attachments: (form.attachments || []).filter((a) => a.url && a.name), custom_fields: customFields, subtasks: (form.subtasks || []).filter((s) => s.title && s.title.trim()).map((s, idx) => ({ title: s.title.trim(), is_done: !!s.is_done, order: idx })) };
    try { const res = editing ? await api.put(`/tasks/${editing.task_id}`, payload) : await api.post(`/tasks`, payload); pushToast({ type: "success", title: "Saved", message: "Task updated." }); onSaved(res.data); }
    catch (e) { pushToast({ type: "error", title: "Could not save", message: e?.response?.data?.detail || "Please try again." }); }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? "Edit task" : "New task"} dataTestId="task-editor-modal" footer={<div className="flex items-center justify-between gap-2"><Button data-testid="task-editor-cancel" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button data-testid="task-editor-save" onClick={save}>Save task</Button></div>}>
      <div className="space-y-5">
        <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Title</div><Input data-testid="task-editor-title-input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., Plan sprint kickoff" /></div>
        <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Notes</div><textarea data-testid="task-editor-description-input" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Context, links, meeting notes…" className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40" rows={4} /></div>
        <div className="grid gap-3 md:grid-cols-4">
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Scope</div><Select data-testid="task-editor-team" value={form.team_id} onChange={(v) => setForm((p) => ({ ...p, team_id: v, assign_scope: v ? p.assign_scope : "none", assignee_user_ids: [] }))} options={[{ value: "", label: "Personal" }, ...teams.map((t) => ({ value: t.team_id, label: `Team: ${t.name}` }))]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Status</div><Select data-testid="task-editor-status" value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} options={[{ value: "todo", label: "Todo" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" }]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Priority</div><Select data-testid="task-editor-priority" value={form.priority} onChange={(v) => setForm((p) => ({ ...p, priority: v }))} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Category</div><Select data-testid="task-editor-category" value={form.category_id} onChange={(v) => setForm((p) => ({ ...p, category_id: v }))} options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Due date & time</div><Input data-testid="task-editor-due" type="datetime-local" value={form.due_at} onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Reminder</div><Input data-testid="task-editor-reminder" type="datetime-local" value={form.reminder_at} onChange={(e) => setForm((p) => ({ ...p, reminder_at: e.target.value }))} /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Tags</div><Input data-testid="task-editor-tags" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Design, review… (comma separated)" /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Estimated minutes</div><Input data-testid="task-editor-estimate" value={form.estimated_minutes} onChange={(e) => setForm((p) => ({ ...p, estimated_minutes: e.target.value }))} placeholder="e.g., 45" /></div>
        </div>
      </div>
    </Modal>
  );
}

function BoardPage() {
  const { pushToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const columns = useMemo(() => [{ id: "todo", title: "Todo" }, { id: "in_progress", title: "In progress" }, { id: "done", title: "Done" }], []);

  const load = async () => { const params = {}; if (teamId) params.team_id = teamId; const [t, c, te] = await Promise.all([api.get("/tasks", { params }), api.get("/categories"), api.get("/teams")]); setTasks(t.data); setCategories(c.data); setTeams(te.data); };
  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load board", message: "Try again." })); }, []);
  useEffect(() => { load().catch(() => {}); }, [teamId]);

  const grouped = useMemo(() => { const map = { todo: [], in_progress: [], done: [] }; for (const t of tasks) map[t.status]?.push(t); for (const key of Object.keys(map)) map[key].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); return map; }, [tasks]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
    const taskId = draggableId; const sourceStatus = source.droppableId; const destStatus = destination.droppableId;
    const sourceList = Array.from(grouped[sourceStatus]); const destList = sourceStatus === destStatus ? sourceList : Array.from(grouped[destStatus]);
    const moving = sourceList.find((t) => t.task_id === taskId); if (!moving) return;
    sourceList.splice(sourceList.findIndex((t) => t.task_id === taskId), 1); destList.splice(destination.index, 0, { ...moving, status: destStatus });
    const next = tasks.map((t) => t.task_id === taskId ? { ...t, status: destStatus } : t);
    const applyOrders = (list, status) => list.forEach((t, idx) => { const i = next.findIndex((x) => x.task_id === t.task_id); if (i >= 0) next[i] = { ...next[i], status, order: idx }; });
    applyOrders(sourceList, sourceStatus); applyOrders(destList, destStatus); setTasks(next);
    try { await api.patch(`/tasks/${taskId}/move`, { status: destStatus, order: destination.index }); } catch (e) { pushToast({ type: "error", title: "Move failed", message: "Refreshing board…" }); load().catch(() => {}); }
  };

  const categoryName = (id) => categories.find((c) => c.category_id === id)?.name || "";
  const teamName = (id) => teams.find((t) => t.team_id === id)?.name || id;

  return (
    <div data-testid="board-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div data-testid="board-title" className="text-sm font-semibold">Board</div><div data-testid="board-subtitle" className="mt-1 text-sm text-muted-foreground">Drag cards between columns.</div></div>
        <div className="w-full max-w-[360px]"><Select data-testid="board-team-filter" value={teamId} onChange={setTeamId} options={[{ value: "", label: "All scopes" }, ...teams.map((t) => ({ value: t.team_id, label: `Team: ${t.name}` }))]} /></div>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div data-testid="board-columns" className="grid gap-4 lg:grid-cols-3">
          {columns.map((col) => (
            <div key={col.id} className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div data-testid={`board-col-title-${col.id}`} className="text-sm font-semibold">{col.title}</div>
                <Badge data-testid={`board-col-count-${col.id}`} tone="neutral">{grouped[col.id]?.length ?? 0}</Badge>
              </div>
              <Droppable droppableId={col.id}>{(provided) => (
                <div data-testid={`board-col-dropzone-${col.id}`} ref={provided.innerRef} {...provided.droppableProps} className="min-h-[220px] p-3 space-y-3">
                  {grouped[col.id].map((t, idx) => (
                    <Draggable key={t.task_id} draggableId={t.task_id} index={idx}>{(drag) => (
                      <div data-testid={`board-card-${t.task_id}`} ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className="rounded-2xl border border-border/60 bg-background/35 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><div className="truncate text-sm font-semibold">{t.title}</div>{t.team_id ? <div className="mt-1 text-xs text-muted-foreground">Team: {teamName(t.team_id)}</div> : null}{t.category_id ? <div className="mt-1 text-xs text-muted-foreground">{categoryName(t.category_id)}</div> : null}</div>
                          <Badge tone={t.priority === "urgent" ? "danger" : "info"}>{t.priority}</Badge>
                        </div>
                        {t.due_at ? <div className="mt-3 text-xs text-muted-foreground">Due: {formatDue(t.due_at)}</div> : null}
                        {(t.subtasks || []).length ? <div className="mt-3 text-xs text-muted-foreground">Subtasks: {(t.subtasks || []).filter((s) => s.is_done).length}/{(t.subtasks || []).length}</div> : null}
                        <div className="mt-3 flex flex-wrap gap-1">{(t.tags || []).slice(0, 4).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}</div>
                      </div>
                    )}</Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}</Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function CategoriesPage() {
  const { pushToast } = useToast();
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0082c6");

  const load = async () => { const res = await api.get("/categories"); setCats(res.data); };
  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load categories", message: "Try again." })); }, []);

  const create = async () => {
    if (!name.trim()) { pushToast({ type: "error", title: "Missing name", message: "Category needs a name." }); return; }
    try { const res = await api.post("/categories", { name: name.trim(), color }); setCats((p) => [res.data, ...p]); setName(""); pushToast({ type: "success", title: "Created", message: "Category added." }); }
    catch (e) { pushToast({ type: "error", title: "Could not create", message: "Try again." }); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete category “${c.name}”?`)) return;
    try { await api.delete(`/categories/${c.category_id}`); setCats((p) => p.filter((x) => x.category_id !== c.category_id)); pushToast({ type: "success", title: "Deleted", message: "Category removed." }); }
    catch (e) { pushToast({ type: "error", title: "Could not delete", message: "Try again." }); }
  };

  return (
    <div data-testid="categories-page" className="space-y-6">
      <div><div data-testid="categories-title" className="text-sm font-semibold">Categories</div><div data-testid="categories-subtitle" className="mt-1 text-sm text-muted-foreground">Keep a clean set of buckets.</div></div>
      <div data-testid="categories-create" className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_160px]">
          <Input data-testid="categories-create-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Work" />
          <div className="grid grid-cols-[64px_1fr] gap-2">
            <Input data-testid="categories-create-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="px-2" />
            <Input data-testid="categories-create-color-hex" value={color} onChange={(e) => { const v = e.target.value; if (v === "" || v === "#") return setColor(v); if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v); }} onBlur={() => { if (!/^#[0-9A-Fa-f]{6}$/.test(color)) setColor("#0082c6"); }} placeholder="#0082c6" />
          </div>
          <Button data-testid="categories-create-button" onClick={create}>Create</Button>
        </div>
      </div>
      <div data-testid="categories-list" className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        {cats.length === 0 ? (<div data-testid="categories-empty" className="px-5 py-8 text-sm text-muted-foreground">No categories yet.</div>) : (
          cats.map((c) => (
            <div key={c.category_id} data-testid={`category-row-${c.category_id}`} className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
              <div className="flex items-center gap-3"><div className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} /><div><div className="text-sm font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.category_id}</div></div></div>
              <Button variant="ghost" onClick={() => remove(c)}>Delete</Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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
