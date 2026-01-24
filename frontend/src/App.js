import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from "react-router-dom";
import axios from "axios";
import "./App.css";

import { cn } from "./lib/utils";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Modal } from "./components/ui/modal";
import { Badge } from "./components/ui/badge";
import { ToastProvider, useToast } from "./components/ui/toast";

import {
  CalendarClock,
  LayoutGrid,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  Sun,
  Moon,
  Tag,
} from "lucide-react";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("taskflow_theme");
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("taskflow_theme", theme);
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
  const location = useLocation();
  // IMPORTANT: Emergent auth returns session_id in the URL fragment (hash)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="settings/categories" element={<CategoriesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function Protected({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthed, setIsAuthed] = useState(null); // null=checking

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/auth/me");
        if (!mounted) return;
        window.__taskflow_user = res.data;
        setIsAuthed(true);
      } catch (e) {
        if (!mounted) return;
        setIsAuthed(false);
        navigate("/login", { replace: true, state: { from: location.pathname } });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate, location.pathname]);

  if (isAuthed === null) {
    return (
      <div data-testid="auth-checking" className="min-h-screen bg-app text-foreground">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-4 w-80 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) return null;
  return children;
}

function LoginPage() {
  const { theme, setTheme } = useTheme();

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div data-testid="login-page" className="min-h-screen bg-app text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm" />
            <div>
              <div data-testid="login-brand-title" className="text-lg font-semibold tracking-tight">
                TaskFlow
              </div>
              <div data-testid="login-brand-subtitle" className="text-sm text-muted-foreground">
                Notion-style tasks, with a dashboard and kanban.
              </div>
            </div>
          </div>

          <Button
            data-testid="theme-toggle-button"
            variant="ghost"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="ml-2 text-sm">{theme === "dark" ? "Light" : "Dark"}</span>
          </Button>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-border/70 bg-card/60 p-8 shadow-sm">
              <h1 data-testid="login-hero-title" className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">
                Your tasks, organized like a workspace.
              </h1>
              <p data-testid="login-hero-subtitle" className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
                Categories + priorities, due dates with time, subtasks, tags, attachments, reminders, and a kanban board you can drag around.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button data-testid="login-google-button" onClick={handleLogin}>
                  Continue with Google
                </Button>
                <div data-testid="login-note" className="text-sm text-muted-foreground">
                  Uses secure cookie sessions (7 days).
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FeaturePill testid="login-pill-views" icon={<LayoutGrid size={16} />} title="Board + List" />
                <FeaturePill testid="login-pill-due" icon={<CalendarClock size={16} />} title="Due date + time" />
                <FeaturePill testid="login-pill-tags" icon={<Tag size={16} />} title="Tags & more" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-border/70 bg-gradient-to-b from-card/70 to-card/40 p-6 shadow-sm">
              <div data-testid="login-preview-title" className="text-sm font-semibold text-muted-foreground">
                What you get
              </div>
              <div className="mt-4 space-y-3">
                <PreviewItem testid="login-preview-1" title="Dashboard" desc="At-a-glance status, overdue, and due soon." />
                <PreviewItem testid="login-preview-2" title="Editing" desc="Rich details: notes, subtasks, attachments, custom fields." />
                <PreviewItem testid="login-preview-3" title="Reordering" desc="Drag tasks between columns and keep everything tidy." />
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-10 text-sm text-muted-foreground">
          <span data-testid="login-footer-text">Tip: after logging in, open the Board and drag a task to feel the Notion vibe.</span>
        </footer>
      </div>
    </div>
  );
}

function FeaturePill({ icon, title, testid }) {
  return (
    <div
      data-testid={testid}
      className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-4 py-3"
    >
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

function AuthCallback() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    if (!sessionId) {
      pushToast({ type: "error", title: "Login failed", message: "Missing session_id" });
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        await api.post("/auth/session", { session_id: sessionId });
        // Clear hash (one-time token)
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true });
      } catch (e) {
        pushToast({ type: "error", title: "Login failed", message: "Could not create session" });
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, pushToast]);

  return (
    <div data-testid="auth-callback" className="min-h-screen bg-app text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-3xl border border-border/70 bg-card/60 p-8">
          <div data-testid="auth-callback-title" className="text-xl font-semibold">
            Signing you in…
          </div>
          <div data-testid="auth-callback-subtitle" className="mt-2 text-sm text-muted-foreground">
            This should only take a moment.
          </div>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <div data-testid="app-shell" className="min-h-screen bg-app text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Sidebar />
          <main className="min-w-0">
            <Topbar />
            <div className="mt-6">
              <OutletCompat />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function OutletCompat() {
  return <Outlet />;
}

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, testid: "sidebar-nav-dashboard" },
    { to: "/tasks", label: "Tasks", icon: ListTodo, testid: "sidebar-nav-tasks" },
    { to: "/board", label: "Board", icon: LayoutGrid, testid: "sidebar-nav-board" },
    { to: "/settings/categories", label: "Categories", icon: Settings, testid: "sidebar-nav-categories" },
  ];

  return (
    <aside
      data-testid="sidebar"
      className="rounded-3xl border border-border/70 bg-card/50 p-4 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500" />
          <div>
            <div data-testid="sidebar-brand" className="text-sm font-semibold tracking-tight">
              TaskFlow
            </div>
            <div data-testid="sidebar-brand-caption" className="text-xs text-muted-foreground">
              Focused workspace
            </div>
          </div>
        </div>

        <Button
          data-testid="sidebar-theme-toggle"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>

      <div className="mt-5 space-y-1">
        {nav.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <button
              key={item.to}
              data-testid={item.testid}
              onClick={() => navigate(item.to)}
              className={cn(
                "w-full rounded-2xl px-3 py-2 text-left text-sm font-medium",
                "transition-colors duration-150",
                active
                  ? "bg-violet-500/15 text-violet-100 dark:text-violet-50"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Icon size={16} />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border/60 bg-background/30 p-3">
        <div data-testid="sidebar-hint-title" className="text-xs font-semibold text-muted-foreground">
          Pro tip
        </div>
        <div data-testid="sidebar-hint" className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Create tasks in the list, then drag them around the board.
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      pushToast({ type: "success", title: "Logged out", message: "See you next time." });
    } catch (e) {
      // ignore
    }
    navigate("/login", { replace: true });
  };

  return (
    <div
      data-testid="topbar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/50 px-4 py-3"
    >
      <div className="min-w-0">
        <div data-testid="topbar-title" className="text-sm font-semibold">
          Workspace
        </div>
        <div data-testid="topbar-subtitle" className="text-xs text-muted-foreground">
          Plan, ship, repeat.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button data-testid="topbar-logout-button" variant="ghost" onClick={handleLogout}>
          <LogOut size={16} />
          <span className="ml-2 text-sm">Logout</span>
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
                <div data-testid="dashboard-focus-title" className="text-sm font-semibold">
                  Today’s focus
                </div>
                <div data-testid="dashboard-focus-subtitle" className="mt-1 text-sm text-muted-foreground">
                  Overdue tasks and due within 24h are a good place to start.
                </div>
              </div>
              <Badge data-testid="dashboard-due24h-badge" tone="info">
                Due 24h: {summary?.due_24h ?? "—"}
              </Badge>
            </div>

            <div className="mt-5 rounded-2xl border border-border/60 bg-background/30 p-4">
              <div data-testid="dashboard-note" className="text-sm text-muted-foreground">
                Open <span className="font-medium text-foreground">Tasks</span> to add details, then switch to <span className="font-medium text-foreground">Board</span> for drag & drop.
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <QuickAddCard />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, testid, tone }) {
  const toneClass =
    tone === "danger"
      ? "from-rose-500/15 to-transparent"
      : "from-violet-500/15 to-transparent";
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
    if (!title.trim()) {
      pushToast({ type: "error", title: "Missing title", message: "Add a task title." });
      return;
    }
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
      <div data-testid="dashboard-quickadd-title" className="text-sm font-semibold">
        Quick add
      </div>
      <div data-testid="dashboard-quickadd-subtitle" className="mt-1 text-sm text-muted-foreground">
        Capture something now, polish it later.
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Input
          data-testid="dashboard-quickadd-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Draft project brief"
        />
        <Button data-testid="dashboard-quickadd-button" onClick={create} disabled={saving}>
          <Plus size={16} />
          <span className="ml-2">Add</span>
        </Button>
      </div>
    </div>
  );
}

function TasksListPage() {
  const { pushToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ status: "", category_id: "", q: "" });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.category_id) params.category_id = filters.category_id;
    if (filters.q) params.q = filters.q;

    const [t, c] = await Promise.all([api.get("/tasks", { params }), api.get("/categories")]);
    setTasks(t.data);
    setCategories(c.data);
  };

  useEffect(() => {
    load().catch(() => {
      pushToast({ type: "error", title: "Could not load tasks", message: "Try refreshing." });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch(() => {});
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.category_id, filters.q]);

  const onCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const onEdit = (task) => {
    setEditing(task);
    setEditorOpen(true);
  };

  const onToggle = async (task) => {
    try {
      const res = await api.patch(`/tasks/${task.task_id}/toggle`);
      setTasks((prev) => prev.map((t) => (t.task_id === task.task_id ? res.data : t)));
    } catch (e) {
      pushToast({ type: "error", title: "Could not update", message: "Try again." });
    }
  };

  const onDelete = async (task) => {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    try {
      await api.delete(`/tasks/${task.task_id}`);
      setTasks((prev) => prev.filter((t) => t.task_id !== task.task_id));
      pushToast({ type: "success", title: "Deleted", message: "Task removed." });
    } catch (e) {
      pushToast({ type: "error", title: "Could not delete", message: "Try again." });
    }
  };

  return (
    <div data-testid="tasks-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div data-testid="tasks-title" className="text-sm font-semibold">
            Tasks
          </div>
          <div data-testid="tasks-subtitle" className="mt-1 text-sm text-muted-foreground">
            Filter, edit, and keep your system clean.
          </div>
        </div>
        <Button data-testid="tasks-create-button" onClick={onCreate}>
          <Plus size={16} />
          <span className="ml-2">New task</span>
        </Button>
      </div>

      <div data-testid="tasks-filters" className="rounded-3xl border border-border/70 bg-card/50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div data-testid="tasks-filter-status-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Status
            </div>
            <Select
              data-testid="tasks-filter-status"
              value={filters.status}
              onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
              options={[
                { value: "", label: "All" },
                { value: "todo", label: "Todo" },
                { value: "in_progress", label: "In progress" },
                { value: "done", label: "Done" },
              ]}
            />
          </div>
          <div>
            <div data-testid="tasks-filter-category-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Category
            </div>
            <Select
              data-testid="tasks-filter-category"
              value={filters.category_id}
              onChange={(v) => setFilters((p) => ({ ...p, category_id: v }))}
              options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]}
            />
          </div>
          <div>
            <div data-testid="tasks-filter-search-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Search
            </div>
            <Input
              data-testid="tasks-filter-search"
              value={filters.q}
              onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
              placeholder="Search by title…"
            />
          </div>
        </div>
      </div>

      <div data-testid="tasks-table" className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_160px_220px_180px] gap-0 border-b border-border/60 px-5 py-3 text-xs font-semibold text-muted-foreground">
          <div data-testid="tasks-col-title">Title</div>
          <div data-testid="tasks-col-status">Status</div>
          <div data-testid="tasks-col-priority">Priority</div>
          <div data-testid="tasks-col-due">Due</div>
          <div data-testid="tasks-col-actions" className="text-right">
            Actions
          </div>
        </div>

        {tasks.length === 0 ? (
          <div data-testid="tasks-empty" className="px-5 py-8 text-sm text-muted-foreground">
            No tasks found. Create one.
          </div>
        ) : (
          <div>
            {tasks.map((t) => (
              <div
                key={t.task_id}
                data-testid={`task-row-${t.task_id}`}
                className="grid grid-cols-[1fr_160px_160px_220px_180px] items-center border-b border-border/40 px-5 py-4"
              >
                <button
                  data-testid={`task-row-title-button-${t.task_id}`}
                  onClick={() => onEdit(t)}
                  className="min-w-0 text-left"
                >
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(t.tags || []).slice(0, 3).map((tag) => (
                      <Badge key={tag} data-testid={`task-tag-${t.task_id}-${tag}`} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </button>

                <div data-testid={`task-row-status-${t.task_id}`} className="text-sm text-muted-foreground">
                  {t.status === "in_progress" ? "In progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                </div>
                <div data-testid={`task-row-priority-${t.task_id}`} className="text-sm text-muted-foreground">
                  {t.priority}
                </div>
                <div data-testid={`task-row-due-${t.task_id}`} className="text-sm text-muted-foreground">
                  {t.due_at ? formatDue(t.due_at) : "—"}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    data-testid={`task-toggle-${t.task_id}`}
                    variant="ghost"
                    onClick={() => onToggle(t)}
                  >
                    {t.status === "done" ? "Reopen" : "Complete"}
                  </Button>
                  <Button
                    data-testid={`task-delete-${t.task_id}`}
                    variant="ghost"
                    onClick={() => onDelete(t)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
        categories={categories}
        onSaved={(task) => {
          setEditorOpen(false);
          setEditing(null);
          setTasks((prev) => {
            const exists = prev.some((t) => t.task_id === task.task_id);
            if (exists) return prev.map((t) => (t.task_id === task.task_id ? task : t));
            return [task, ...prev];
          });
        }}
      />
    </div>
  );
}

function TaskEditor({ open, onOpenChange, editing, categories, onSaved }) {
  const { pushToast } = useToast();

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    category_id: "",
    tags: "",
    due_at: "",
    reminder_at: "",
    estimated_minutes: "",
    recurrence_rule: "none",
    recurrence_interval: 1,
    attachments: [{ name: "", url: "" }],
    custom_fields_text: "{}",
    subtasks: [{ title: "", is_done: false }],
  });

  useEffect(() => {
    if (!open) return;

    const initial = !editing
      ? {
          title: "",
          description: "",
          status: "todo",
          priority: "medium",
          category_id: "",
          tags: "",
          due_at: "",
          reminder_at: "",
          estimated_minutes: "",
          recurrence_rule: "none",
          recurrence_interval: 1,
          attachments: [{ name: "", url: "" }],
          custom_fields_text: "{}",
          subtasks: [{ title: "", is_done: false }],
        }
      : {
          title: editing.title || "",
          description: editing.description || "",
          status: editing.status || "todo",
          priority: editing.priority || "medium",
          category_id: editing.category_id || "",
          tags: (editing.tags || []).join(", "),
          due_at: toDatetimeLocalValue(editing.due_at),
          reminder_at: toDatetimeLocalValue(editing.reminder_at),
          estimated_minutes: editing.estimated_minutes ? String(editing.estimated_minutes) : "",
          recurrence_rule: editing.recurrence?.rule || "none",
          recurrence_interval: editing.recurrence?.interval || 1,
          attachments:
            editing.attachments && editing.attachments.length
              ? editing.attachments
              : [{ name: "", url: "" }],
          custom_fields_text: JSON.stringify(editing.custom_fields || {}, null, 2),
          subtasks:
            editing.subtasks && editing.subtasks.length
              ? editing.subtasks
              : [{ title: "", is_done: false }],
        };

    setForm(initial);
  }, [open, editing]);

  const save = async () => {
    if (!form.title.trim()) {
      pushToast({ type: "error", title: "Missing title", message: "Task title is required." });
      return;
    }

    let customFields = {};
    try {
      customFields = form.custom_fields_text?.trim() ? JSON.parse(form.custom_fields_text) : {};
    } catch (e) {
      pushToast({ type: "error", title: "Custom fields", message: "Must be valid JSON." });
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      status: form.status,
      priority: form.priority,
      category_id: form.category_id || null,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      due_at: fromDatetimeLocalValue(form.due_at),
      reminder_at: fromDatetimeLocalValue(form.reminder_at),
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      recurrence: { rule: form.recurrence_rule, interval: Number(form.recurrence_interval) || 1 },
      attachments: (form.attachments || []).filter((a) => a.url && a.name),
      custom_fields: customFields,
      subtasks: (form.subtasks || [])
        .filter((s) => s.title && s.title.trim())
        .map((s, idx) => ({ title: s.title.trim(), is_done: !!s.is_done, order: idx })),
    };

    try {
      const res = editing
        ? await api.put(`/tasks/${editing.task_id}`, payload)
        : await api.post(`/tasks`, payload);

      pushToast({ type: "success", title: "Saved", message: "Task updated." });
      onSaved(res.data);
    } catch (e) {
      pushToast({ type: "error", title: "Could not save", message: "Please try again." });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit task" : "New task"}
      dataTestId="task-editor-modal"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button data-testid="task-editor-cancel" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button data-testid="task-editor-save" onClick={save}>
            Save task
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <div data-testid="task-editor-title-label" className="mb-1 text-xs font-semibold text-muted-foreground">
            Title
          </div>
          <Input
            data-testid="task-editor-title-input"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g., Plan sprint kickoff"
          />
        </div>

        <div>
          <div data-testid="task-editor-description-label" className="mb-1 text-xs font-semibold text-muted-foreground">
            Notes
          </div>
          <textarea
            data-testid="task-editor-description-input"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Context, links, meeting notes…"
            className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40"
            rows={4}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div data-testid="task-editor-status-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Status
            </div>
            <Select
              data-testid="task-editor-status"
              value={form.status}
              onChange={(v) => setForm((p) => ({ ...p, status: v }))}
              options={[
                { value: "todo", label: "Todo" },
                { value: "in_progress", label: "In progress" },
                { value: "done", label: "Done" },
              ]}
            />
          </div>
          <div>
            <div data-testid="task-editor-priority-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Priority
            </div>
            <Select
              data-testid="task-editor-priority"
              value={form.priority}
              onChange={(v) => setForm((p) => ({ ...p, priority: v }))}
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
            />
          </div>
          <div>
            <div data-testid="task-editor-category-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Category
            </div>
            <Select
              data-testid="task-editor-category"
              value={form.category_id}
              onChange={(v) => setForm((p) => ({ ...p, category_id: v }))}
              options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div data-testid="task-editor-due-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Due date & time
            </div>
            <Input
              data-testid="task-editor-due"
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))}
            />
          </div>
          <div>
            <div data-testid="task-editor-reminder-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Reminder
            </div>
            <Input
              data-testid="task-editor-reminder"
              type="datetime-local"
              value={form.reminder_at}
              onChange={(e) => setForm((p) => ({ ...p, reminder_at: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div data-testid="task-editor-tags-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Tags
            </div>
            <Input
              data-testid="task-editor-tags"
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              placeholder="Design, review, urgent… (comma separated)"
            />
          </div>
          <div>
            <div data-testid="task-editor-estimate-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Estimated minutes
            </div>
            <Input
              data-testid="task-editor-estimate"
              value={form.estimated_minutes}
              onChange={(e) => setForm((p) => ({ ...p, estimated_minutes: e.target.value }))}
              placeholder="e.g., 45"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div data-testid="task-editor-recurrence-rule-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Recurring
            </div>
            <Select
              data-testid="task-editor-recurrence-rule"
              value={form.recurrence_rule}
              onChange={(v) => setForm((p) => ({ ...p, recurrence_rule: v }))}
              options={[
                { value: "none", label: "Not recurring" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
          </div>
          <div>
            <div data-testid="task-editor-recurrence-interval-label" className="mb-1 text-xs font-semibold text-muted-foreground">
              Interval
            </div>
            <Input
              data-testid="task-editor-recurrence-interval"
              value={String(form.recurrence_interval)}
              onChange={(e) => setForm((p) => ({ ...p, recurrence_interval: e.target.value }))}
              placeholder="1"
            />
          </div>
        </div>

        <div>
          <div data-testid="task-editor-subtasks-label" className="mb-2 text-xs font-semibold text-muted-foreground">
            Subtasks
          </div>
          <div className="space-y-2">
            {form.subtasks.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  data-testid={`task-editor-subtask-done-${idx}`}
                  type="checkbox"
                  checked={!!s.is_done}
                  onChange={(e) => {
                    const isDone = e.target.checked;
                    setForm((p) => ({
                      ...p,
                      subtasks: p.subtasks.map((x, i) => (i === idx ? { ...x, is_done: isDone } : x)),
                    }));
                  }}
                />
                <Input
                  data-testid={`task-editor-subtask-title-${idx}`}
                  value={s.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((p) => ({
                      ...p,
                      subtasks: p.subtasks.map((x, i) => (i === idx ? { ...x, title } : x)),
                    }));
                  }}
                  placeholder={`Subtask ${idx + 1}`}
                />
                <Button
                  data-testid={`task-editor-subtask-remove-${idx}`}
                  variant="ghost"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      subtasks: p.subtasks.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              data-testid="task-editor-subtask-add"
              variant="ghost"
              onClick={() => setForm((p) => ({ ...p, subtasks: [...p.subtasks, { title: "", is_done: false }] }))}
            >
              Add subtask
            </Button>
          </div>
        </div>

        <div>
          <div data-testid="task-editor-attachments-label" className="mb-2 text-xs font-semibold text-muted-foreground">
            Attachments
          </div>
          <div className="space-y-2">
            {form.attachments.map((a, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_1.2fr_100px]">
                <Input
                  data-testid={`task-editor-attachment-name-${idx}`}
                  value={a.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((p) => ({
                      ...p,
                      attachments: p.attachments.map((x, i) => (i === idx ? { ...x, name } : x)),
                    }));
                  }}
                  placeholder="Name"
                />
                <Input
                  data-testid={`task-editor-attachment-url-${idx}`}
                  value={a.url}
                  onChange={(e) => {
                    const url = e.target.value;
                    setForm((p) => ({
                      ...p,
                      attachments: p.attachments.map((x, i) => (i === idx ? { ...x, url } : x)),
                    }));
                  }}
                  placeholder="https://…"
                />
                <Button
                  data-testid={`task-editor-attachment-remove-${idx}`}
                  variant="ghost"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      attachments: p.attachments.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button
              data-testid="task-editor-attachment-add"
              variant="ghost"
              onClick={() => setForm((p) => ({ ...p, attachments: [...p.attachments, { name: "", url: "" }] }))}
            >
              Add attachment
            </Button>
          </div>
        </div>

        <div>
          <div data-testid="task-editor-customfields-label" className="mb-1 text-xs font-semibold text-muted-foreground">
            Custom fields (JSON)
          </div>
          <textarea
            data-testid="task-editor-customfields-input"
            value={form.custom_fields_text}
            onChange={(e) => setForm((p) => ({ ...p, custom_fields_text: e.target.value }))}
            className="w-full rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-500/40"
            rows={5}
          />
        </div>
      </div>
    </Modal>
  );
}

function BoardPage() {
  const { pushToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);

  const columns = useMemo(
    () => [
      { id: "todo", title: "Todo" },
      { id: "in_progress", title: "In progress" },
      { id: "done", title: "Done" },
    ],
    [],
  );

  const load = async () => {
    const [t, c] = await Promise.all([api.get("/tasks"), api.get("/categories")]);
    setTasks(t.data);
    setCategories(c.data);
  };

  useEffect(() => {
    load().catch(() => pushToast({ type: "error", title: "Could not load board", message: "Try again." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) map[t.status]?.push(t);
    for (const key of Object.keys(map)) map[key].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return map;
  }, [tasks]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const taskId = draggableId;
    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    const sourceList = Array.from(grouped[sourceStatus]);
    const destList = sourceStatus === destStatus ? sourceList : Array.from(grouped[destStatus]);

    const moving = sourceList.find((t) => t.task_id === taskId);
    if (!moving) return;

    // Remove from source
    const sourceIdx = sourceList.findIndex((t) => t.task_id === taskId);
    sourceList.splice(sourceIdx, 1);

    // Insert into dest
    destList.splice(destination.index, 0, { ...moving, status: destStatus });

    // Rebuild state orders
    const next = tasks.map((t) => {
      if (t.task_id === taskId) return { ...t, status: destStatus };
      return t;
    });

    // Set order based on lists
    const applyOrders = (list, status) => {
      list.forEach((t, idx) => {
        const i = next.findIndex((x) => x.task_id === t.task_id);
        if (i >= 0) next[i] = { ...next[i], status, order: idx };
      });
    };

    applyOrders(sourceList, sourceStatus);
    applyOrders(destList, destStatus);
    setTasks(next);

    try {
      await api.patch(`/tasks/${taskId}/move`, { status: destStatus, order: destination.index });
    } catch (e) {
      pushToast({ type: "error", title: "Move failed", message: "Refreshing board…" });
      load().catch(() => {});
    }
  };

  const categoryName = (id) => categories.find((c) => c.category_id === id)?.name || "";

  return (
    <div data-testid="board-page" className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div data-testid="board-title" className="text-sm font-semibold">
            Board
          </div>
          <div data-testid="board-subtitle" className="mt-1 text-sm text-muted-foreground">
            Drag cards between columns.
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div data-testid="board-columns" className="grid gap-4 lg:grid-cols-3">
          {columns.map((col) => (
            <div key={col.id} className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div data-testid={`board-col-title-${col.id}`} className="text-sm font-semibold">
                  {col.title}
                </div>
                <Badge data-testid={`board-col-count-${col.id}`} tone="neutral">
                  {grouped[col.id]?.length ?? 0}
                </Badge>
              </div>

              <Droppable droppableId={col.id}>
                {(provided) => (
                  <div
                    data-testid={`board-col-dropzone-${col.id}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="min-h-[220px] p-3 space-y-3"
                  >
                    {grouped[col.id].map((t, idx) => (
                      <Draggable key={t.task_id} draggableId={t.task_id} index={idx}>
                        {(drag) => (
                          <div
                            data-testid={`board-card-${t.task_id}`}
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className="rounded-2xl border border-border/60 bg-background/35 p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{t.title}</div>
                                {t.category_id ? (
                                  <div data-testid={`board-card-category-${t.task_id}`} className="mt-1 text-xs text-muted-foreground">
                                    {categoryName(t.category_id)}
                                  </div>
                                ) : null}
                              </div>
                              <Badge data-testid={`board-card-priority-${t.task_id}`} tone={t.priority === "urgent" ? "danger" : "info"}>
                                {t.priority}
                              </Badge>
                            </div>

                            {t.due_at ? (
                              <div data-testid={`board-card-due-${t.task_id}`} className="mt-3 text-xs text-muted-foreground">
                                Due: {formatDue(t.due_at)}
                              </div>
                            ) : null}

                            {(t.subtasks || []).length ? (
                              <div data-testid={`board-card-subtasks-${t.task_id}`} className="mt-3 text-xs text-muted-foreground">
                                Subtasks: {(t.subtasks || []).filter((s) => s.is_done).length}/{(t.subtasks || []).length}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-1">
                              {(t.tags || []).slice(0, 4).map((tag) => (
                                <Badge key={tag} data-testid={`board-card-tag-${t.task_id}-${tag}`} tone="neutral">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
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
  const [color, setColor] = useState("#7C3AED");

  const load = async () => {
    const res = await api.get("/categories");
    setCats(res.data);
  };

  useEffect(() => {
    load().catch(() => pushToast({ type: "error", title: "Could not load categories", message: "Try again." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!name.trim()) {
      pushToast({ type: "error", title: "Missing name", message: "Category needs a name." });
      return;
    }
    try {
      const res = await api.post("/categories", { name: name.trim(), color });
      setCats((p) => [res.data, ...p]);
      setName("");
      pushToast({ type: "success", title: "Created", message: "Category added." });
    } catch (e) {
      pushToast({ type: "error", title: "Could not create", message: "Try again." });
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete category “${c.name}”? Tasks will be uncategorized.`)) return;
    try {
      await api.delete(`/categories/${c.category_id}`);
      setCats((p) => p.filter((x) => x.category_id !== c.category_id));
      pushToast({ type: "success", title: "Deleted", message: "Category removed." });
    } catch (e) {
      pushToast({ type: "error", title: "Could not delete", message: "Try again." });
    }
  };

  return (
    <div data-testid="categories-page" className="space-y-6">
      <div>
        <div data-testid="categories-title" className="text-sm font-semibold">
          Categories
        </div>
        <div data-testid="categories-subtitle" className="mt-1 text-sm text-muted-foreground">
          Keep a clean set of buckets.
        </div>
      </div>

      <div data-testid="categories-create" className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
          <Input
            data-testid="categories-create-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Work"
          />
          <Input
            data-testid="categories-create-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <Button data-testid="categories-create-button" onClick={create}>
            Create
          </Button>
        </div>
      </div>

      <div data-testid="categories-list" className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
        {cats.length === 0 ? (
          <div data-testid="categories-empty" className="px-5 py-8 text-sm text-muted-foreground">
            No categories yet.
          </div>
        ) : (
          cats.map((c) => (
            <div
              key={c.category_id}
              data-testid={`category-row-${c.category_id}`}
              className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <div
                  data-testid={`category-color-${c.category_id}`}
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ background: c.color }}
                />
                <div>
                  <div data-testid={`category-name-${c.category_id}`} className="text-sm font-semibold">
                    {c.name}
                  </div>
                  <div data-testid={`category-id-${c.category_id}`} className="text-xs text-muted-foreground">
                    {c.category_id}
                  </div>
                </div>
              </div>
              <Button
                data-testid={`category-delete-${c.category_id}`}
                variant="ghost"
                onClick={() => remove(c)}
              >
                Delete
              </Button>
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
