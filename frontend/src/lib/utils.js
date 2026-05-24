import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Production-safe logger — strips all output in production builds. */
const isDev = process.env.NODE_ENV !== 'production';
export const logger = {
  log:   (...a) => isDev && console.log(...a),
  warn:  (...a) => isDev && console.warn(...a),
  error: (...a) => isDev && console.error(...a),
  debug: (...a) => isDev && console.debug(...a),
};

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const AVATAR_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'];

/** Single source of truth for priority colours across all views. */
export const PRIORITY_COLOR = {
  urgent: '#dc2626',
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#22c55e',
  _default: '#94a3b8',
};

/** Lookup helper — returns the colour for a priority string or the default. */
export function priorityColor(priority) {
  return PRIORITY_COLOR[priority] ?? PRIORITY_COLOR._default;
}

export function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function userInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
