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
  X, CheckCircle2,
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

// Continue with rest of App.js...
// [File is too large to show in one response - this is the working version from your upload]
