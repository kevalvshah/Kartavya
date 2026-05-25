import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';

const STORAGE_KEY = 'k_prefs';

const ACCENTS = [
  { id: 'teal',   label: 'TEAL',   color: '#05b7aa', mid: '#03a1b6', deep: '#0082c6' },
  { id: 'blue',   label: 'BLUE',   color: '#3b82f6', mid: '#2563eb', deep: '#1d4ed8' },
  { id: 'saffro', label: 'SAFFRO', color: '#f59e0b', mid: '#d97706', deep: '#b45309' },
  { id: 'indigo', label: 'INDIGO', color: '#6366f1', mid: '#4f46e5', deep: '#3730a3' },
];

const FONTS = [
  { id: 'newsreader',       label: 'Newsreader',      sub: 'editorial', value: "'Newsreader', 'Georgia', serif" },
  { id: 'spectral',         label: 'Spectral',         sub: 'literary',  value: "'Spectral', 'Georgia', serif" },
  { id: 'instrument-serif', label: 'Instrument Serif', sub: 'modern',    value: "'Instrument Serif', 'Georgia', serif" },
  { id: 'inter',            label: 'Inter',            sub: 'sans only', value: "'Inter', system-ui, sans-serif" },
];

const DEFAULTS = {
  mode:     'light',
  accent:   'teal',
  sidebar:  'wide',
  density:  'comfy',
  font:     'newsreader',
  language: 'en+sa',
};

function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

function applyPrefs(prefs) {
  const root = document.documentElement;
  const acc  = ACCENTS.find(a => a.id === prefs.accent) || ACCENTS[0];
  const fnt  = FONTS.find(f => f.id === prefs.font)     || FONTS[0];

  root.style.setProperty('--k-primary', acc.color);
  root.style.setProperty('--k-mid',     acc.mid);
  root.style.setProperty('--k-deep',    acc.deep);
  root.style.setProperty('--k-grad',    `linear-gradient(135deg, ${acc.deep}, ${acc.mid} 55%, ${acc.color})`);
  root.style.setProperty('--k-gradD',   `linear-gradient(135deg, ${acc.deep}cc, ${acc.mid}cc 55%, ${acc.color}cc)`);
  root.style.setProperty('--side-active', `${acc.color}29`);

  root.style.setProperty('--font-display', fnt.value);
  if (prefs.font === 'inter') {
    root.style.setProperty('--font-ui', "'Inter', system-ui, sans-serif");
    document.body.style.fontFamily = "'Inter', system-ui, sans-serif";
  } else {
    root.style.setProperty('--font-ui', fnt.value);
    document.body.style.fontFamily = fnt.value;
  }

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

  root.setAttribute('data-density', prefs.density);
  root.style.setProperty('--page-pad', prefs.density === 'compact' ? '16px' : '28px');
  root.setAttribute('data-sidebar', prefs.sidebar);
  root.setAttribute('data-language', prefs.language);
}

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

// ── Seg control — subtle active state ────────────────────────────────────────

function Seg({ options, value, onChange }) {
  return (
    <div style={{
      display: 'flex', background: 'var(--bg-soft)',
      borderRadius: 8, padding: 3, gap: 2, width: 'fit-content',
    }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            padding: '4px 13px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font-ui)',
            fontWeight: active ? 600 : 400,
            background: active ? 'var(--surface-2)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-3)',
            boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            transition: 'all .12s',
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionHead({ en, hi }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10, marginTop: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--k-primary)' }}>{en}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-hindi)' }}>{hi}</span>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
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
      {/* Invisible click-away */}
      <div onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 9990 }} />

      {/* Floating card */}
      <div style={{
        position: 'fixed', bottom: 72, right: 24, zIndex: 9999,
        width: 340, borderRadius: 16,
        background: 'var(--bg)',
        border: '1px solid var(--rule)',
        boxShadow: '0 8px 40px rgba(0,0,0,.18)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--k-primary)' }}>CUSTOMIZE</span>
              <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-hindi)' }}>· सजावट</span>
            </div>
            <div style={{ fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)', marginTop: 1 }}>Make it yours</div>
          </div>
          <button onClick={() => setOpen(false)} style={{
            width: 26, height: 26, borderRadius: 6, border: '1px solid var(--rule)',
            background: 'transparent', cursor: 'pointer', fontSize: 15, color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px' }}>

          {/* Theme */}
          <SectionHead en="THEME" hi="रंग" />
          <Row label="Mode">
            <Seg value={prefs.mode} onChange={v => setPrefs({ mode: v })}
              options={[{ label: '☀ Light', value: 'light' }, { label: '◗ Dark', value: 'dark' }]} />
          </Row>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 7 }}>Accent</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ACCENTS.map(a => (
                <button key={a.id} onClick={() => setPrefs({ accent: a.id })} title={a.label} style={{
                  flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                  background: a.color,
                  border: prefs.accent === a.id ? '2px solid var(--ink)' : '2px solid transparent',
                  outline: prefs.accent === a.id ? `2px solid ${a.color}` : 'none',
                  outlineOffset: 1,
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 3,
                  transition: 'border .12s, outline .12s',
                }}>
                  <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--rule-soft)', margin: '12px 0' }} />

          {/* Layout */}
          <SectionHead en="LAYOUT" hi="विन्यास" />
          <Row label="Sidebar">
            <Seg value={prefs.sidebar} onChange={v => setPrefs({ sidebar: v })}
              options={[{ label: 'Wide', value: 'wide' }, { label: 'Rail', value: 'rail' }]} />
          </Row>
          <Row label="Density">
            <Seg value={prefs.density} onChange={v => setPrefs({ density: v })}
              options={[{ label: 'Compact', value: 'compact' }, { label: 'Comfy', value: 'comfy' }]} />
          </Row>

          <div style={{ height: 1, background: 'var(--rule-soft)', margin: '12px 0' }} />

          {/* Type & Language */}
          <SectionHead en="TYPE & LANGUAGE" hi="भाषा" />

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>Display font</div>
            <select value={prefs.font} onChange={e => setPrefs({ font: e.target.value })} style={{
              width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--rule)', background: 'var(--surface)',
              color: 'var(--ink)', fontFamily: 'var(--font-ui)', cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236E7B91' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}>
              {FONTS.map(f => <option key={f.id} value={f.id}>{f.label} · {f.sub}</option>)}
            </select>
          </div>

          <Row label="Language">
            <Seg value={prefs.language} onChange={v => setPrefs({ language: v })}
              options={[
                { label: 'EN',      value: 'en' },
                { label: 'EN + सं', value: 'en+sa' },
                { label: 'हिन्दी', value: 'hi' },
              ]} />
          </Row>

          {/* Tagline */}
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10,
            border: `1px solid ${acc.color}44`, borderLeftWidth: 3,
            background: `${acc.color}0d`, fontSize: 12, lineHeight: 1.6, color: 'var(--ink-3)',
          }}>
            <span style={{ fontFamily: 'var(--font-hindi)', color: 'var(--ink-2)' }}>यथारुचि</span>
            {' — '}
            <em style={{ color: 'var(--k-primary)', fontFamily: 'var(--font-display)' }}>"as you wish."</em>
            {' Your choices persist as you click around.'}
          </div>
        </div>
      </div>
    </>
  );
}

// ── FAB ───────────────────────────────────────────────────────────────────────

export function CustomizeFAB() {
  const { setOpen } = useCustomize();
  return (
    <button onClick={() => setOpen(o => !o)} style={{
      position: 'fixed', bottom: 20, right: 24, zIndex: 9991,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 18px', borderRadius: 99,
      background: 'var(--side-bg, #1A2230)', color: '#fff',
      border: 'none', cursor: 'pointer',
      fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,.28)',
      transition: 'transform .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
      </svg>
      <span>Customize</span>
      <span style={{ fontFamily: 'var(--font-hindi)', fontWeight: 400, fontSize: 11, opacity: 0.65 }}>सजावट</span>
    </button>
  );
}
