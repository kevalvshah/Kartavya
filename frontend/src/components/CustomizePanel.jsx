/**
 * CustomizePanel.jsx — "Make it yours" slide-over.
 *
 * Persists to localStorage under key 'k_prefs'.
 * Applies changes immediately via CSS custom properties on :root / data-* attrs on <html>.
 *
 * Usage:
 *   import { CustomizePanel, useCustomize } from './CustomizePanel';
 *   const { open, setOpen } = useCustomize();
 *   <CustomizePanel open={open} onClose={() => setOpen(false)} />
 *   <button onClick={() => setOpen(true)}>Customize</button>
 */
import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'k_prefs';

const ACCENTS = [
  { id: 'teal',   label: 'TEAL',   color: '#05b7aa', mid: '#03a1b6', deep: '#0082c6' },
  { id: 'blue',   label: 'BLUE',   color: '#3b82f6', mid: '#2563eb', deep: '#1d4ed8' },
  { id: 'saffro', label: 'SAFFRO', color: '#f59e0b', mid: '#d97706', deep: '#b45309' },
  { id: 'indigo', label: 'INDIGO', color: '#6366f1', mid: '#4f46e5', deep: '#3730a3' },
];

const FONTS = [
  { id: 'newsreader',       label: 'Newsreader',       sub: 'editorial', value: "'Newsreader', 'Georgia', serif" },
  { id: 'spectral',         label: 'Spectral',          sub: 'literary',  value: "'Spectral', 'Georgia', serif" },
  { id: 'instrument-serif', label: 'Instrument Serif',  sub: 'modern',    value: "'Instrument Serif', 'Georgia', serif" },
  { id: 'inter',            label: 'Inter',             sub: 'sans only', value: "'Inter', system-ui, sans-serif" },
];

const DEFAULTS = {
  mode:     'light',   // 'light' | 'dark'
  accent:   'teal',
  sidebar:  'wide',    // 'wide' | 'rail'
  density:  'comfy',   // 'compact' | 'comfy'
  font:     'newsreader',
  language: 'en+sa',   // 'en' | 'en+sa' | 'hi'
};

// ── Load & Apply ──────────────────────────────────────────────────────────────

function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

function applyPrefs(prefs) {
  const root = document.documentElement;
  const acc  = ACCENTS.find(a => a.id === prefs.accent) || ACCENTS[0];
  const fnt  = FONTS.find(f => f.id === prefs.font)     || FONTS[0];

  // Accent
  root.style.setProperty('--k-primary', acc.color);
  root.style.setProperty('--k-mid',     acc.mid);
  root.style.setProperty('--k-deep',    acc.deep);
  root.style.setProperty('--k-grad',    `linear-gradient(135deg, ${acc.deep}, ${acc.mid} 55%, ${acc.color})`);
  root.style.setProperty('--k-gradD',   `linear-gradient(135deg, ${acc.deep}cc, ${acc.mid}cc 55%, ${acc.color}cc)`);
  root.style.setProperty('--side-active', `${acc.color}29`);

  // Font — change both display AND ui so body text visibly changes too
  root.style.setProperty('--font-display', fnt.value);
  // When "Inter · sans only" is chosen, body stays Inter (already default).
  // For serif fonts, also shift body to that font family for a full editorial feel.
  if (prefs.font === 'inter') {
    root.style.setProperty('--font-ui', "'Inter', system-ui, sans-serif");
    document.body.style.fontFamily = "'Inter', system-ui, sans-serif";
  } else {
    root.style.setProperty('--font-ui', fnt.value);
    document.body.style.fontFamily = fnt.value;
  }

  // Mode
  root.setAttribute('data-theme', prefs.mode);
  if (prefs.mode === 'dark') {
    root.style.setProperty('--bg',         '#0f1117');
    root.style.setProperty('--bg-soft',    '#161b25');
    root.style.setProperty('--surface',    '#1a2033');
    root.style.setProperty('--surface-2',  '#212840');
    root.style.setProperty('--ink',        '#e8eaf0');
    root.style.setProperty('--ink-2',      '#a8b0c4');
    root.style.setProperty('--ink-3',      '#7080a0');
    root.style.setProperty('--ink-faint',  '#455070');
    root.style.setProperty('--rule',       '#2a3248');
    root.style.setProperty('--rule-soft',  '#232a40');
    root.style.setProperty('--rule-strong','#384060');
  } else {
    root.style.setProperty('--bg',         '#F6F3EC');
    root.style.setProperty('--bg-soft',    '#F0ECDF');
    root.style.setProperty('--surface',    '#FCFAF5');
    root.style.setProperty('--surface-2',  '#FFFFFF');
    root.style.setProperty('--ink',        '#1A2230');
    root.style.setProperty('--ink-2',      '#4A5468');
    root.style.setProperty('--ink-3',      '#6E7B91');
    root.style.setProperty('--ink-faint',  '#A5B0C2');
    root.style.setProperty('--rule',       '#E2DCC9');
    root.style.setProperty('--rule-soft',  '#EFE9D8');
    root.style.setProperty('--rule-strong','#C8C0AA');
  }

  // Density
  root.setAttribute('data-density', prefs.density);
  root.style.setProperty('--page-pad', prefs.density === 'compact' ? '16px' : '28px');

  // Sidebar
  root.setAttribute('data-sidebar', prefs.sidebar);

  // Language
  root.setAttribute('data-language', prefs.language);
}

// ── Context ───────────────────────────────────────────────────────────────────

const CustomizeCtx = createContext(null);

export function CustomizeProvider({ children }) {
  const [open,  setOpen]  = useState(false);
  const [prefs, setPrefsState] = useState(loadPrefs);

  const setPrefs = useCallback((patch) => {
    setPrefsState(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applyPrefs(next);
      return next;
    });
  }, []);

  // Apply on mount
  useEffect(() => { applyPrefs(prefs); }, []); // eslint-disable-line

  return (
    <CustomizeCtx.Provider value={{ open, setOpen, prefs, setPrefs }}>
      {children}
    </CustomizeCtx.Provider>
  );
}

export function useCustomize() {
  const ctx = useContext(CustomizeCtx);
  if (!ctx) throw new Error('useCustomize must be inside CustomizeProvider');
  return ctx;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--rule)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{
            padding: '5px 14px', border: 'none', cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: value === o.value ? 600 : 400,
            background: value === o.value ? 'var(--k-primary)' : 'var(--surface)',
            color: value === o.value ? '#fff' : 'var(--ink-2)',
            transition: 'all .15s',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SectionHead({ en, hi }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, marginTop: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--k-primary)' }}>{en}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-hindi)' }}>{hi}</span>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
      {children}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function CustomizePanel() {
  const { open, setOpen, prefs, setPrefs } = useCustomize();

  if (!open) return null;

  const acc = ACCENTS.find(a => a.id === prefs.accent) || ACCENTS[0];

  return (
    <>
      {/* Backdrop */}
      <div onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.18)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 320, zIndex: 9999,
        background: 'var(--surface)', borderLeft: '1px solid var(--rule)',
        boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--rule-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--k-primary)' }}>CUSTOMIZE</span>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-hindi)' }}>· सजावट</span>
              </div>
              <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)', marginTop: 2 }}>Make it yours</div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--rule)', background: 'transparent', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', flex: 1 }}>

          {/* ── Theme ── */}
          <SectionHead en="THEME" hi="रंग" />

          <Row label="Mode">
            <Seg
              value={prefs.mode}
              onChange={v => setPrefs({ mode: v })}
              options={[{ label: '☀ Light', value: 'light' }, { label: '◗ Dark', value: 'dark' }]}
            />
          </Row>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>Accent</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ACCENTS.map(a => (
                <button key={a.id} onClick={() => setPrefs({ accent: a.id })}
                  title={a.label}
                  style={{
                    flex: 1, height: 36, borderRadius: 8, border: prefs.accent === a.id ? '3px solid var(--ink)' : '2px solid transparent',
                    background: a.color, cursor: 'pointer', position: 'relative',
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4,
                    transition: 'border .15s',
                  }}>
                  <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--rule-soft)', margin: '16px 0' }} />

          {/* ── Layout ── */}
          <SectionHead en="LAYOUT" hi="विन्यास" />

          <Row label="Sidebar">
            <Seg
              value={prefs.sidebar}
              onChange={v => setPrefs({ sidebar: v })}
              options={[{ label: 'Wide', value: 'wide' }, { label: 'Rail', value: 'rail' }]}
            />
          </Row>

          <Row label="Density">
            <Seg
              value={prefs.density}
              onChange={v => setPrefs({ density: v })}
              options={[{ label: 'Compact', value: 'compact' }, { label: 'Comfy', value: 'comfy' }]}
            />
          </Row>

          <div style={{ height: 1, background: 'var(--rule-soft)', margin: '16px 0' }} />

          {/* ── Type & Language ── */}
          <SectionHead en="TYPE & LANGUAGE" hi="भाषा" />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>Display font</div>
            <select
              value={prefs.font}
              onChange={e => setPrefs({ font: e.target.value })}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--rule)', background: 'var(--surface-2)',
                color: 'var(--ink)', fontFamily: 'var(--font-ui)', cursor: 'pointer',
                appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236E7B91' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              }}>
              {FONTS.map(f => (
                <option key={f.id} value={f.id}>{f.label} · {f.sub}</option>
              ))}
            </select>
          </div>

          <Row label="Language">
            <Seg
              value={prefs.language}
              onChange={v => setPrefs({ language: v })}
              options={[
                { label: 'EN',    value: 'en' },
                { label: 'EN + सं', value: 'en+sa' },
                { label: 'हिन्दी', value: 'hi' },
              ]}
            />
          </Row>

          {/* Tagline */}
          <div style={{
            marginTop: 24, padding: '12px 14px', borderRadius: 10,
            border: '1px solid var(--k-primary)', borderLeftWidth: 3,
            background: `${acc.color}0d`, fontSize: 12, lineHeight: 1.6,
          }}>
            <span style={{ fontFamily: 'var(--font-hindi)', color: 'var(--ink-2)' }}>यथारुचि</span>
            <span style={{ color: 'var(--ink-3)' }}> — </span>
            <em style={{ color: 'var(--k-primary)', fontFamily: 'var(--font-display)' }}>"as you wish."</em>
            <span style={{ color: 'var(--ink-3)' }}> Your choices persist as you click around.</span>
          </div>
        </div>

        {/* Reset footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--rule-soft)' }}>
          <button
            onClick={() => setPrefs({ ...DEFAULTS })}
            style={{
              width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--rule)',
              background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)',
              fontFamily: 'var(--font-ui)',
            }}>
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
}

// ── Floating trigger button ───────────────────────────────────────────────────

export function CustomizeFAB() {
  const { setOpen } = useCustomize();
  return (
    <button
      onClick={() => setOpen(true)}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9990,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 99,
        background: 'var(--side-bg)', color: '#fff',
        border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <span style={{ fontSize: 15 }}>✦</span>
      <span>Customize</span>
      <span style={{ fontFamily: 'var(--font-hindi)', fontWeight: 400, fontSize: 12, opacity: 0.7 }}>सजावट</span>
    </button>
  );
}
