/** Auth helpers, date utils, theme hook — shared across all pages */
import { useState, useEffect } from 'react';
import { api } from './api';

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function apiLogin(email, password) {
  const res = await api.post('/auth/login', { email, password });
  sessionStorage.setItem('auth_token', res.data.token);
  sessionStorage.setItem('kartavya_user', JSON.stringify(res.data.user));
  return res.data;
}

export async function apiAcceptInvite(token, name, password) {
  const res = await api.post('/auth/accept-invite', { token, name, password });
  sessionStorage.setItem('auth_token', res.data.token);
  sessionStorage.setItem('kartavya_user', JSON.stringify(res.data.user));
  return res.data;
}

export async function apiLogout() {
  try { await api.post('/auth/logout'); } catch (_) { /* fire-and-forget: logout always proceeds */ }
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('kartavya_user');
}

export function currentUser() {
  try { return JSON.parse(sessionStorage.getItem('kartavya_user') || 'null'); } catch { return null; }
}

// ── Theme ─────────────────────────────────────────────────────────────────────
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('kartavya_theme') || 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('kartavya_theme', theme);
  }, [theme]);
  return { theme, setTheme };
}

// ── Date utils ────────────────────────────────────────────────────────────────
export function formatDue(v) {
  if (!v) return '';
  return new Date(v).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function toLocal(v) {
  if (!v) return '';
  const d = new Date(v), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocal(v) { return v ? new Date(v).toISOString() : null; }

// ── Approval badge ────────────────────────────────────────────────────────────
export function approvalBadgeStyle(status) {
  switch (status) {
    case 'pending':        return { label: 'Pending owner',  bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' };
    case 'pending_client': return { label: 'Pending client', bg: 'rgba(139,92,246,0.15)',  color: '#8b5cf6' };
    case 'approved':       return { label: 'Approved',       bg: 'rgba(16,185,129,0.15)',  color: '#10b981' };
    case 'rejected':       return { label: 'Rejected',       bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' };
    default: return null;
  }
}
