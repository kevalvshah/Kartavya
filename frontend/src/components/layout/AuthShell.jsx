import React from 'react';
import { K, KLogo, KWordmark } from '../../lib/brand';

export const authInput = {
  width: '100%', padding: '11px 14px', background: '#f4fafd',
  border: '1.5px solid #d0e8f5', borderRadius: 8, fontSize: 14,
  color: '#0a1628', outline: 'none', boxSizing: 'border-box',
};
export const authLabel = {
  display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 2,
  textTransform: 'uppercase', color: '#5a7087', marginBottom: 6,
};
export const authBtn = {
  width: '100%', padding: 13, background: K.grad, border: 'none',
  borderRadius: 8, fontSize: 12, fontWeight: 800, color: '#fff',
  cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4,
};

export default function AuthShell({ children, title, sub }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter',sans-serif", background: '#f4fafd' }}>
      <div style={{ width: 420, background: K.dark, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: 44, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <KLogo size={36} /><KWordmark dark />
        </div>
        <div>
          <h2 style={{ color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 12, letterSpacing: -0.5 }}>{title}</h2>
          <p style={{ color: '#8aa5be', fontSize: 13, lineHeight: 1.7 }}>{sub}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Custom Kanban columns per project', 'Client portal with restricted access',
            'Invite-only — no public sign-ups', '4 board views: Kanban, List, Schedule, Tracker'].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 20, height: 2, background: K.grad, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#8aa5be' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 60px', maxWidth: 520, background: '#fff' }}>
        {children}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          paddingTop: 18, marginTop: 18, borderTop: '1px solid #d0e8f5',
          fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' }}>
          <span style={{ color: '#b8cedd', fontWeight: 700 }}>Powered by</span>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: K.teal }} />
          <span style={{ color: K.mid, fontWeight: 800 }}>Aekam Inc</span>
        </div>
      </div>
    </div>
  );
}
