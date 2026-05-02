/**
 * App.js — Kartavya by Aekam Inc
 * Full rewrite. Zero legacy references.
 * Auth: JWT via localStorage (email + password)
 * Stack: React, react-router-dom, axios, @hello-pangea/dnd, lucide-react
 */

import React, { useEffect, useMemo, useState } from "react";
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
import { Bell, LayoutGrid, ListTodo, LogOut, Plus, Settings, Sun, Moon, Users } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// ── Brand colours ──────────────────────────────────────────────────────────────
const K = {
  blue:  "#0082c6",
  mid:   "#03a1b6",
  teal:  "#05b7aa",
  dark:  "#050e1a",
  grad:  "linear-gradient(90deg,#0082c6,#03a1b6,#05b7aa)",
  gradD: "linear-gradient(135deg,#0082c6,#05b7aa)",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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

// ── Auth helpers ───────────────────────────────────────────────────────────────
async function apiLogin(email, password) {
  const res = await api.post("/auth/login", { email, password });
  localStorage.setItem("auth_token", res.data.token);
  return res.data;
}

async function apiRegister(name, email, password) {
  const res = await api.post("/auth/register", { name, email, password });
  localStorage.setItem("auth_token", res.data.token);
  return res.data;
}

async function apiLogout() {
  try { await api.post("/auth/logout"); } catch (_) {}
  localStorage.removeItem("auth_token");
}

// ── Router ─────────────────────────────────────────────────────────────────────
function AppRouter() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Protected><AppShell /></Protected>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"                element={<DashboardPage />} />
        <Route path="tasks"                    element={<TasksListPage />} />
        <Route path="board"                    element={<BoardPage />} />
        <Route path="teams"                    element={<TeamsPage />} />
        <Route path="settings/categories"      element={<CategoriesPage />} />
        <Route path="settings/notifications"   element={<NotificationsSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// ── Protected wrapper ──────────────────────────────────────────────────────────
function Protected({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(null); // null = checking

  useEffect(() => {
    let live = true;
    if (!localStorage.getItem("auth_token")) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
      setReady(false);
      return;
    }
    api.get("/auth/me")
      .then((r) => { if (live) { window.__kartavya_user = r.data; setReady(true); } })
      .catch(() => {
        if (!live) return;
        localStorage.removeItem("auth_token");
        navigate("/login", { replace: true, state: { from: location.pathname } });
        setReady(false);
      });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ready === null) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 14, color: "#5a7087" }}>Loading Kartavya…</span>
    </div>
  );
  if (!ready) return null;
  return children;
}

// ── Shared auth panel (left dark side) ────────────────────────────────────────
function AuthPanel({ title, sub }) {
  return (
    <div style={{ width: 420, background: K.dark, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 44, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/>
            <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: 2.5, textTransform: "uppercase" }}>Kartavya</div>
          <div style={{ fontSize: 8, letterSpacing: 3, textTransform: "uppercase", color: K.teal, marginTop: 2, fontWeight: 700 }}>by Aekam Inc</div>
        </div>
      </div>
      <div>
        <h2 style={{ color: "#fff", fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 12, letterSpacing: -0.5 }}>{title}</h2>
        <p style={{ color: "#8aa5be", fontSize: 13, lineHeight: 1.7 }}>{sub}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["Kanban boards, list views & due dates", "Team roles, assignments & reminders", "Browser push & in-app notifications", "Web + Android — one backend"].map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 20, height: 2, background: K.grad, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#8aa5be" }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const authInput = { width: "100%", padding: "11px 14px", background: "#f4fafd", border: "1.5px solid #d0e8f5", borderRadius: 8, fontSize: 14, color: "#0a1628", outline: "none", boxSizing: "border-box" };
const authLabel = { display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#5a7087", marginBottom: 6 };
const authBtn   = { width: "100%", padding: 13, background: K.grad, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", marginTop: 4, opacity: 1 };
const poweredBar = (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 18, marginTop: 18, borderTop: "1px solid #d0e8f5", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase" }}>
    <span style={{ color: "#b8cedd", fontWeight: 700 }}>Powered by</span>
    <div style={{ width: 4, height: 4, borderRadius: "50%", background: K.teal }} />
    <span style={{ color: K.mid, fontWeight: 800 }}>Aekam Inc</span>
  </div>
);

// ── Login page ─────────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await apiLogin(form.email, form.password); navigate("/dashboard", { replace: true }); }
    catch (err) { pushToast({ type: "error", title: "Sign in failed", message: err?.response?.data?.detail || "Check your email and password." }); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Nunito',sans-serif", background: "#f4fafd" }}>
      <AuthPanel title={<>Do what<br /><span style={{ background: K.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>must be done.</span></>} sub="Team task management built for Indian businesses — from solo founders to full agency teams." />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 60px", maxWidth: 520, background: "#fff" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: "uppercase", color: K.mid, marginBottom: 8 }}>Welcome back</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>Sign in to<br /><span style={{ color: K.blue }}>Kartavya</span></h1>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}><label style={authLabel}>Email</label><input name="email" type="email" value={form.email} onChange={set} required placeholder="you@example.com" style={authInput} /></div>
          <div style={{ marginBottom: 14 }}><label style={authLabel}>Password</label><input name="password" type="password" value={form.password} onChange={set} required placeholder="••••••••••" style={authInput} /></div>
          <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>{loading ? "Signing in…" : "Sign In"}</button>
        </form>
        <p style={{ textAlign: "center", fontSize: 13, color: "#5a7087", marginTop: 18 }}>No account? <span onClick={() => navigate("/register")} style={{ color: K.blue, fontWeight: 800, cursor: "pointer" }}>Create one free</span></p>
        {poweredBar}
      </div>
    </div>
  );
}

// ── Register page ──────────────────────────────────────────────────────────────
function RegisterPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { pushToast({ type: "error", title: "Passwords don't match", message: "Please check and try again." }); return; }
    if (form.password.length < 8) { pushToast({ type: "error", title: "Password too short", message: "Minimum 8 characters." }); return; }
    setLoading(true);
    try { await apiRegister(form.name, form.email, form.password); navigate("/dashboard", { replace: true }); }
    catch (err) { pushToast({ type: "error", title: "Registration failed", message: err?.response?.data?.detail || "Please try again." }); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Nunito',sans-serif", background: "#f4fafd" }}>
      <AuthPanel title={<>Get started<br /><span style={{ background: K.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>for free.</span></>} sub="Join Kartavya and manage your team tasks the right way." />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 60px", maxWidth: 520, background: "#fff" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: "uppercase", color: K.mid, marginBottom: 8 }}>Get started free</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0a1628", letterSpacing: -0.5, lineHeight: 1.2 }}>Join<br /><span style={{ color: K.blue }}>Kartavya</span></h1>
        </div>
        <form onSubmit={submit}>
          {[
            { label: "Full name",        name: "name",     type: "text",     ph: "Your Name" },
            { label: "Email address",    name: "email",    type: "email",    ph: "you@example.com" },
            { label: "Password",         name: "password", type: "password", ph: "At least 8 characters" },
            { label: "Confirm password", name: "confirm",  type: "password", ph: "••••••••••" },
          ].map(({ label, name, type, ph }) => (
            <div key={name} style={{ marginBottom: 14 }}><label style={authLabel}>{label}</label><input name={name} type={type} value={form[name]} onChange={set} required placeholder={ph} style={authInput} /></div>
          ))}
          <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>{loading ? "Creating account…" : "Create Account"}</button>
        </form>
        <p style={{ textAlign: "center", fontSize: 13, color: "#5a7087", marginTop: 18 }}>Already have an account? <span onClick={() => navigate("/login")} style={{ color: K.blue, fontWeight: 800, cursor: "pointer" }}>Sign in</span></p>
        {poweredBar}
      </div>
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────────
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

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { theme, setTheme } = useTheme();

  const nav = [
    { to: "/dashboard",               label: "Dashboard",     Icon: LayoutGrid },
    { to: "/tasks",                    label: "Tasks",         Icon: ListTodo },
    { to: "/board",                    label: "Board",         Icon: LayoutGrid },
    { to: "/teams",                    label: "Teams",         Icon: Users },
    { to: "/settings/categories",      label: "Categories",   Icon: Settings },
    { to: "/settings/notifications",   label: "Notifications", Icon: Bell },
  ];

  return (
    <aside className="rounded-3xl border border-border/70 bg-card/50 p-4 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 34, height: 34, borderRadius: 9, background: K.gradD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/>
              <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "inherit", letterSpacing: 1.5, textTransform: "uppercase" }}>Kartavya</div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: K.teal, fontWeight: 700 }}>by Aekam Inc</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>

      <div className="mt-5 space-y-1">
        {nav.map(({ to, label, Icon }) => {
          const active = location.pathname === to;
          return (
            <button key={to} onClick={() => navigate(to)}
              className={cn("w-full rounded-2xl px-3 py-2 text-left text-sm font-medium transition-colors duration-150",
                active ? "bg-violet-500/15 text-violet-100 dark:text-violet-50" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
              <span className="inline-flex items-center gap-2"><Icon size={16} />{label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────────────
function Topbar({ unread, onOpenNotifications }) {
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const logout = async () => {
    await apiLogout();
    pushToast({ type: "success", title: "Signed out", message: "See you next time." });
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/50 px-4 py-3">
      <div>
        <div className="text-sm font-semibold">Workspace</div>
        <div className="text-xs text-muted-foreground">Plan, ship, repeat.</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onOpenNotifications}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/30 transition-colors hover:bg-muted/40">
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white" style={{ background: K.blue }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
        <Button variant="ghost" onClick={logout}><LogOut size={16} /><span className="ml-2 text-sm">Sign out</span></Button>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function DashboardPage() {
  const { pushToast } = useToast();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/dashboard/summary")
      .then((r) => setSummary(r.data))
      .catch(() => pushToast({ type: "error", title: "Could not load dashboard", message: "Try refreshing." }));
  }, [pushToast]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Todo"        value={summary?.todo       ?? "—"} />
        <StatCard label="In progress" value={summary?.in_progress ?? "—"} />
        <StatCard label="Done"        value={summary?.done       ?? "—"} />
        <StatCard label="Overdue"     value={summary?.overdue    ?? "—"} danger />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-border/70 bg-card/50 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Today's focus</div>
                <div className="mt-1 text-sm text-muted-foreground">Overdue tasks and tasks due within 24h are a good place to start.</div>
              </div>
              <Badge tone="info">Due 24h: {summary?.due_24h ?? "—"}</Badge>
            </div>
            <div className="mt-5 rounded-2xl border border-border/60 bg-background/30 p-4">
              <div className="text-sm text-muted-foreground">Create team tasks, assign them, and enable browser notifications for reminders.</div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5"><QuickAddCard /></div>
      </div>
    </div>
  );
}

function StatCard({ label, value, danger }) {
  return (
    <div className={cn("rounded-3xl border border-border/70 bg-card/50 p-5 bg-gradient-to-b", danger ? "from-rose-500/15 to-transparent" : "from-violet-500/15 to-transparent")}>
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
    try { await api.post("/tasks", { title: title.trim(), status: "todo", priority: "medium" }); setTitle(""); pushToast({ type: "success", title: "Task created", message: "Added to Todo." }); }
    catch (_) { pushToast({ type: "error", title: "Could not create", message: "Please try again." }); }
    finally { setSaving(false); }
  };
  return (
    <div className="rounded-3xl border border-border/70 bg-card/50 p-6">
      <div className="text-sm font-semibold">Quick add</div>
      <div className="mt-1 text-sm text-muted-foreground">Capture something now, polish it later.</div>
      <div className="mt-4 flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Draft project brief" />
        <Button onClick={create} disabled={saving}><Plus size={16} /><span className="ml-2">Add</span></Button>
      </div>
    </div>
  );
}

// ── Tasks list ─────────────────────────────────────────────────────────────────
function TasksListPage() {
  const { pushToast } = useToast();
  const [tasks, setTasks]       = useState([]);
  const [categories, setCats]   = useState([]);
  const [teams, setTeams]       = useState([]);
  const [filters, setFilters]   = useState({ status: "", category_id: "", q: "", team_id: "", assigned_to_me: false });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [editorKey, setEditorKey] = useState("k");

  const load = async () => {
    const p = {};
    if (filters.status)        p.status        = filters.status;
    if (filters.category_id)   p.category_id   = filters.category_id;
    if (filters.q)             p.q             = filters.q;
    if (filters.team_id)       p.team_id       = filters.team_id;
    if (filters.assigned_to_me) p.assigned_to_me = true;
    const [t, c, te] = await Promise.all([api.get("/tasks", { params: p }), api.get("/categories"), api.get("/teams")]);
    setTasks(t.data); setCats(c.data); setTeams(te.data);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load tasks", message: "Try refreshing." })); }, []);
  useEffect(() => { const id = setTimeout(() => load().catch(() => {}), 250); return () => clearTimeout(id); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.status, filters.category_id, filters.q, filters.team_id, filters.assigned_to_me]);

  const openCreate = () => { setEditing(null); setEditorKey(`n${Date.now()}`); setEditorOpen(true); };
  const openEdit   = (t)  => { setEditing(t);  setEditorKey(`e${t.task_id}`);  setEditorOpen(true); };

  const toggle = async (task) => {
    try { const r = await api.patch(`/tasks/${task.task_id}/toggle`); setTasks((p) => p.map((t) => t.task_id === task.task_id ? r.data : t)); }
    catch (_) { pushToast({ type: "error", title: "Could not update", message: "Try again." }); }
  };

  const remove = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try { await api.delete(`/tasks/${task.task_id}`); setTasks((p) => p.filter((t) => t.task_id !== task.task_id)); pushToast({ type: "success", title: "Deleted" }); }
    catch (_) { pushToast({ type: "error", title: "Could not delete", message: "Try again." }); }
  };

  const scopeLabel = (t) => t.team_id ? `Team: ${teams.find((x) => x.team_id === t.team_id)?.name || t.team_id}` : "Personal";
  const f = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-semibold">Tasks</div><div className="mt-1 text-sm text-muted-foreground">Personal + team tasks.</div></div>
        <Button onClick={openCreate}><Plus size={16} /><span className="ml-2">New task</span></Button>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/50 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Status</div>
            <Select value={filters.status} onChange={(v) => f("status", v)} options={[{ value: "", label: "All" }, { value: "todo", label: "Todo" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" }]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Team</div>
            <Select value={filters.team_id} onChange={(v) => f("team_id", v)} options={[{ value: "", label: "All" }, ...teams.map((t) => ({ value: t.team_id, label: t.name }))]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Category</div>
            <Select value={filters.category_id} onChange={(v) => f("category_id", v)} options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Search</div>
            <Input value={filters.q} onChange={(e) => f("q", e.target.value)} placeholder="Search by title…" /></div>
          <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Assigned</div>
            <button onClick={() => f("assigned_to_me", !filters.assigned_to_me)}
              className={cn("h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm transition-colors hover:bg-muted/40", filters.assigned_to_me && "ring-2 ring-violet-500/30")}>
              {filters.assigned_to_me ? "Assigned to me" : "All"}
            </button></div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_200px_140px_180px_220px_160px] border-b border-border/60 px-5 py-3 text-xs font-semibold text-muted-foreground">
          <div>Title</div><div>Scope</div><div>Status</div><div>Priority</div><div>Due</div><div className="text-right">Actions</div>
        </div>
        {tasks.length === 0
          ? <div className="px-5 py-8 text-sm text-muted-foreground">No tasks found. Create one.</div>
          : tasks.map((t) => (
            <div key={t.task_id} className="grid grid-cols-[1fr_200px_140px_180px_220px_160px] items-center border-b border-border/40 px-5 py-4">
              <button onClick={() => openEdit(t)} className="min-w-0 text-left">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(t.tags || []).slice(0,3).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
                  {(t.assignee_user_ids || []).length > 0 && <Badge tone="info">{t.assignee_user_ids.length} assignee(s)</Badge>}
                </div>
              </button>
              <div className="text-sm text-muted-foreground">{scopeLabel(t)}</div>
              <div className="text-sm text-muted-foreground">{t.status === "in_progress" ? "In progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1)}</div>
              <div className="text-sm text-muted-foreground">{t.priority}</div>
              <div className="text-sm text-muted-foreground">{t.due_at ? formatDue(t.due_at) : "—"}</div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => toggle(t)}>{t.status === "done" ? "Reopen" : "Complete"}</Button>
                <Button variant="ghost" onClick={() => remove(t)}>Delete</Button>
              </div>
            </div>
          ))
        }
      </div>

      <TaskEditor key={editorKey} open={editorOpen} onOpenChange={setEditorOpen} editing={editing} categories={categories} teams={teams}
        onSaved={(task) => { setEditorOpen(false); setEditing(null); setTasks((prev) => { const e = prev.some((t) => t.task_id === task.task_id); return e ? prev.map((t) => t.task_id === task.task_id ? task : t) : [task, ...prev]; }); }} />
    </div>
  );
}

// ── Task editor modal ──────────────────────────────────────────────────────────
function TaskEditor({ open, onOpenChange, editing, categories, teams, onSaved }) {
  const { pushToast } = useToast();
  const [teamMembers, setTeamMembers] = useState([]);
  const [yourRole, setYourRole] = useState("member");
  const [loadingMembers, setLoadingMembers] = useState(false);

  const blank = { title: "", description: "", status: "todo", priority: "medium", category_id: "", tags: "", team_id: "", assign_scope: "none", assignee_user_ids: [], due_at: "", reminder_at: "", estimated_minutes: "", recurrence_rule: "none", recurrence_interval: 1, attachments: [{ name: "", url: "" }], custom_fields_text: "{}", subtasks: [{ title: "", is_done: false }] };

  const initial = useMemo(() => {
    if (!editing) return blank;
    return {
      title: editing.title || "", description: editing.description || "", status: editing.status || "todo", priority: editing.priority || "medium",
      category_id: editing.category_id || "", tags: (editing.tags || []).join(", "), team_id: editing.team_id || "",
      assign_scope: (editing.assignee_user_ids || []).length ? "members" : "none", assignee_user_ids: editing.assignee_user_ids || [],
      due_at: toLocal(editing.due_at), reminder_at: toLocal(editing.reminder_at),
      estimated_minutes: editing.estimated_minutes ? String(editing.estimated_minutes) : "",
      recurrence_rule: editing.recurrence?.rule || "none", recurrence_interval: editing.recurrence?.interval || 1,
      attachments: (editing.attachments || []).length ? editing.attachments : [{ name: "", url: "" }],
      custom_fields_text: JSON.stringify(editing.custom_fields || {}, null, 2),
      subtasks: (editing.subtasks || []).length ? editing.subtasks : [{ title: "", is_done: false }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  const isTeam = !!form.team_id;
  useEffect(() => {
    if (!open || !form.team_id) { setTeamMembers([]); setYourRole("member"); return; }
    let live = true; setLoadingMembers(true);
    api.get(`/teams/${form.team_id}`)
      .then((r) => { if (!live) return; setTeamMembers((r.data.members || []).filter((m) => m.status === "active" && m.user_id)); setYourRole(r.data.your_role || "member"); })
      .catch(() => { if (!live) return; setTeamMembers([]); setYourRole("member"); })
      .finally(() => { if (live) setLoadingMembers(false); });
    return () => { live = false; };
  }, [open, form.team_id]);

  const canAssign = !isTeam || yourRole === "owner" || yourRole === "admin";
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { pushToast({ type: "error", title: "Missing title", message: "Task title is required." }); return; }
    let customFields = {};
    try { customFields = form.custom_fields_text?.trim() ? JSON.parse(form.custom_fields_text) : {}; }
    catch (_) { pushToast({ type: "error", title: "Custom fields", message: "Must be valid JSON." }); return; }
    const assignees = form.assign_scope === "whole_team" && isTeam ? teamMembers.map((m) => m.user_id) : (form.assignee_user_ids || []);
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
    } catch (e) { pushToast({ type: "error", title: "Could not save", message: e?.response?.data?.detail || "Please try again." }); }
  };

  const F = ({ label, children }) => <div><div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>{children}</div>;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? "Edit task" : "New task"} dataTestId="task-editor-modal"
      footer={<div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Save task</Button></div>}>
      <div className="space-y-5">
        <F label="Title"><Input value={form.title} onChange={(e) => upd("title", e.target.value)} placeholder="e.g., Plan sprint kickoff" /></F>
        <F label="Notes"><textarea value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder="Context, links, notes…" className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40" rows={3} /></F>
        <div className="grid gap-3 md:grid-cols-4">
          <F label="Scope"><Select value={form.team_id} onChange={(v) => setForm((p) => ({ ...p, team_id: v, assign_scope: v ? p.assign_scope : "none", assignee_user_ids: [] }))} options={[{ value: "", label: "Personal" }, ...teams.map((t) => ({ value: t.team_id, label: `Team: ${t.name}` }))]} /></F>
          <F label="Status"><Select value={form.status} onChange={(v) => upd("status", v)} options={[{ value: "todo", label: "Todo" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" }]} /></F>
          <F label="Priority"><Select value={form.priority} onChange={(v) => upd("priority", v)} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} /></F>
          <F label="Category"><Select value={form.category_id} onChange={(v) => upd("category_id", v)} options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]} /></F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Due date & time"><Input type="datetime-local" value={form.due_at} onChange={(e) => upd("due_at", e.target.value)} /></F>
          <F label="Reminder"><Input type="datetime-local" value={form.reminder_at} onChange={(e) => upd("reminder_at", e.target.value)} /></F>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Tags"><Input value={form.tags} onChange={(e) => upd("tags", e.target.value)} placeholder="Design, review… (comma separated)" /></F>
          <F label="Estimated minutes"><Input value={form.estimated_minutes} onChange={(e) => upd("estimated_minutes", e.target.value)} placeholder="e.g., 45" /></F>
        </div>
        {isTeam && canAssign && (
          <F label="Assignment">
            <Select value={form.assign_scope} onChange={(v) => setForm((p) => ({ ...p, assign_scope: v, assignee_user_ids: [] }))} options={[{ value: "none", label: "Unassigned" }, { value: "whole_team", label: "Whole team" }, { value: "members", label: "Selected members" }]} />
            {!loadingMembers && form.assign_scope === "members" && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {teamMembers.map((m) => {
                  const checked = (form.assignee_user_ids || []).includes(m.user_id);
                  return (
                    <label key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <input type="checkbox" checked={checked} onChange={(e) => setForm((p) => { const s = new Set(p.assignee_user_ids || []); e.target.checked ? s.add(m.user_id) : s.delete(m.user_id); return { ...p, assignee_user_ids: Array.from(s) }; })} />
                      <span className="truncate">{m.email}</span>
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
                <Button variant="ghost" onClick={() => setForm((p) => ({ ...p, subtasks: p.subtasks.filter((_, j) => j !== i) }))}>Remove</Button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setForm((p) => ({ ...p, subtasks: [...p.subtasks, { title: "", is_done: false }] }))}>Add subtask</Button>
          </div>
        </F>
      </div>
    </Modal>
  );
}

// ── Board (Kanban) ─────────────────────────────────────────────────────────────
function BoardPage() {
  const { pushToast } = useToast();
  const [tasks, setTasks]     = useState([]);
  const [categories, setCats] = useState([]);
  const [teams, setTeams]     = useState([]);
  const [teamId, setTeamId]   = useState("");
  const cols = useMemo(() => [{ id: "todo", title: "Todo" }, { id: "in_progress", title: "In progress" }, { id: "done", title: "Done" }], []);

  const load = async () => {
    const p = teamId ? { team_id: teamId } : {};
    const [t, c, te] = await Promise.all([api.get("/tasks", { params: p }), api.get("/categories"), api.get("/teams")]);
    setTasks(t.data); setCats(c.data); setTeams(te.data);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => pushToast({ type: "error", title: "Could not load board" })); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => {}); }, [teamId]);

  const grouped = useMemo(() => {
    const m = { todo: [], in_progress: [], done: [] };
    tasks.forEach((t) => m[t.status]?.push(t));
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return m;
  }, [tasks]);

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
    const srcList  = Array.from(grouped[source.droppableId]);
    const dstList  = source.droppableId === destination.droppableId ? srcList : Array.from(grouped[destination.droppableId]);
    const moving   = srcList.find((t) => t.task_id === draggableId); if (!moving) return;
    srcList.splice(srcList.findIndex((t) => t.task_id === draggableId), 1);
    dstList.splice(destination.index, 0, { ...moving, status: destination.droppableId });
    const next = tasks.map((t) => t.task_id === draggableId ? { ...t, status: destination.droppableId } : t);
    [[srcList, source.droppableId], [dstList, destination.droppableId]].forEach(([list, st]) =>
      list.forEach((t, i) => { const idx = next.findIndex((x) => x.task_id === t.task_id); if (idx >= 0) next[idx] = { ...next[idx], status: st, order: i }; }));
    setTasks(next);
    try { await api.patch(`/tasks/${draggableId}/move`, { status: destination.droppableId, order: destination.index }); }
    catch (_) { pushToast({ type: "error", title: "Move failed" }); load().catch(() => {}); }
  };

  const catName  = (id) => categories.find((c) => c.category_id === id)?.name || "";
  const teamName = (id) => teams.find((t) => t.team_id === id)?.name || id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-semibold">Board</div><div className="mt-1 text-sm text-muted-foreground">Drag cards between columns.</div></div>
        <div className="w-full max-w-[360px]"><Select value={teamId} onChange={setTeamId} options={[{ value: "", label: "All scopes" }, ...teams.map((t) => ({ value: t.team_id, label: `Team: ${t.name}` }))]} /></div>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid gap-4 lg:grid-cols-3">
          {cols.map((col) => (
            <div key={col.id} className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="text-sm font-semibold">{col.title}</div>
                <Badge tone="neutral">{grouped[col.id]?.length ?? 0}</Badge>
              </div>
              <Droppable droppableId={col.id}>{(prov) => (
                <div ref={prov.innerRef} {...prov.droppableProps} className="min-h-[220px] p-3 space-y-3">
                  {grouped[col.id].map((t, i) => (
                    <Draggable key={t.task_id} draggableId={t.task_id} index={i}>{(drag) => (
                      <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className="rounded-2xl border border-border/60 bg-background/35 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{t.title}</div>
                            {t.team_id     && <div className="mt-1 text-xs text-muted-foreground">Team: {teamName(t.team_id)}</div>}
                            {t.category_id && <div className="mt-1 text-xs text-muted-foreground">{catName(t.category_id)}</div>}
                          </div>
                          <Badge tone={t.priority === "urgent" ? "danger" : "info"}>{t.priority}</Badge>
                        </div>
                        {t.due_at && <div className="mt-3 text-xs text-muted-foreground">Due: {formatDue(t.due_at)}</div>}
                        {(t.subtasks || []).length > 0 && <div className="mt-3 text-xs text-muted-foreground">Subtasks: {t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length}</div>}
                        <div className="mt-3 flex flex-wrap gap-1">{(t.tags || []).slice(0,4).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}</div>
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
    </div>
  );
}

// ── Categories ─────────────────────────────────────────────────────────────────
function CategoriesPage() {
  const { pushToast } = useToast();
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(K.blue);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { api.get("/categories").then((r) => setCats(r.data)).catch(() => pushToast({ type: "error", title: "Could not load categories" })); }, []);

  const create = async () => {
    if (!name.trim()) { pushToast({ type: "error", title: "Missing name" }); return; }
    try { const r = await api.post("/categories", { name: name.trim(), color }); setCats((p) => [r.data, ...p]); setName(""); pushToast({ type: "success", title: "Created" }); }
    catch (_) { pushToast({ type: "error", title: "Could not create" }); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/categories/${c.category_id}`); setCats((p) => p.filter((x) => x.category_id !== c.category_id)); pushToast({ type: "success", title: "Deleted" }); }
    catch (_) { pushToast({ type: "error", title: "Could not delete" }); }
  };

  return (
    <div className="space-y-6">
      <div><div className="text-sm font-semibold">Categories</div><div className="mt-1 text-sm text-muted-foreground">Organise tasks with custom buckets.</div></div>
      <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_160px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Work" />
          <div className="grid grid-cols-[64px_1fr] gap-2">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="px-2" />
            <Input value={color} onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v); }} onBlur={() => { if (!/^#[0-9A-Fa-f]{6}$/.test(color)) setColor(K.blue); }} placeholder={K.blue} />
          </div>
          <Button onClick={create}>Create</Button>
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        {cats.length === 0
          ? <div className="px-5 py-8 text-sm text-muted-foreground">No categories yet.</div>
          : cats.map((c) => (
            <div key={c.category_id} className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} />
                <div><div className="text-sm font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.category_id}</div></div>
              </div>
              <Button variant="ghost" onClick={() => remove(c)}>Delete</Button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
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
