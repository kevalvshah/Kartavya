/** Brand tokens, logo, wordmark, role badge — shared across all layouts */
import React from 'react';

export const K = {
  blue:  '#0082c6',
  mid:   '#03a1b6',
  teal:  '#05b7aa',
  dark:  '#050e1a',
  card:  '#0b1829',
  grad:  'linear-gradient(90deg,#0082c6,#03a1b6,#05b7aa)',
  gradD: 'linear-gradient(135deg,#0082c6,#05b7aa)',
};

export function KLogo({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: K.gradD,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 22 22" fill="none">
        <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/>
        <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/>
      </svg>
    </div>
  );
}

export function KWordmark({ dark = false, size = 'md' }) {
  const fs  = size === 'sm' ? 11 : 14;
  const sub = size === 'sm' ? 7  : 8;
  return (
    <div>
      <div style={{ fontSize: fs, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
        color: dark ? '#fff' : K.dark }}>Kartavya</div>
      <div style={{ fontSize: sub, letterSpacing: 2.5, textTransform: 'uppercase',
        color: K.teal, fontWeight: 700, marginTop: 1 }}>by Aekam Inc</div>
    </div>
  );
}

export function RoleBadge({ role }) {
  const cfg = {
    admin:  { bg: '#0082c622', color: '#0082c6', label: 'Admin' },
    member: { bg: '#05b7aa22', color: '#05b7aa', label: 'Member' },
    client: { bg: '#8b5cf622', color: '#8b5cf6', label: 'Client' },
  }[role] || { bg: '#88888822', color: '#888', label: role };
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
      background: cfg.bg, color: cfg.color, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}
