/**
 * PageLoader.jsx — full-page loading spinner shown by React Suspense.
 * Extracted from App.js so it can be imported by anything that needs it.
 */
import React from 'react';

export default function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--text-muted)', fontSize: 13,
      fontFamily: "'Inter',sans-serif",
    }}>
      <span style={{ opacity: 0.5 }}>Loading…</span>
    </div>
  );
}
