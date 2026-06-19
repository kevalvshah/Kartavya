/**
 * WhatsAppTemplatesPage — manage Meta-approved WhatsApp message templates.
 * Left: template list cards  |  Right: editor + live phone preview
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/toast';
import { PageHeader } from '../components/editorial';
import ConfirmDialog from '../components/ui/ConfirmDialog';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['AUTHENTICATION', 'UTILITY', 'MARKETING'];
const LANGUAGES  = [
  { code: 'en',    label: 'English' },
  { code: 'hi',    label: 'Hindi — हिन्दी' },
  { code: 'en_IN', label: 'English (India)' },
];
const STATUS_META = {
  APPROVED: { label: 'Approved', color: '#16a34a', bg: '#dcfce7' },
  PENDING:  { label: 'Pending',  color: '#b45309', bg: '#fef3c7' },
  REJECTED: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2' },
  PAUSED:   { label: 'Paused',   color: '#6b7280', bg: '#f3f4f6' },
};
const CAT_META = {
  AUTHENTICATION: { emoji: '🔐', color: '#6366f1' },
  UTILITY:        { emoji: '⚡', color: '#0082c6' },
  MARKETING:      { emoji: '📢', color: '#ec4899' },
};

const EMPTY_TEMPLATE = {
  name: '', template_key: '', category: 'UTILITY', language: 'en',
  header_text: '', body_text: '', footer_text: '',
  buttons: [], params: [],
};

// ── WhatsApp phone mockup ─────────────────────────────────────────────────────

function renderBody(text, paramValues) {
  if (!text) return '';
  let out = text;
  (paramValues || []).forEach((val, i) => {
    out = out.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val || `{{${i + 1}}}`);
  });
  // Bold: *text* → <strong>
  out = out.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  // Italic: _text_ → <em>
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Newlines
  out = out.replace(/\n/g, '<br/>');
  return out;
}

function PhonePreview({ template, paramValues }) {
  const body    = template?.body_text    || '';
  const header  = template?.header_text  || '';
  const footer  = template?.footer_text  || '';
  const buttons = template?.buttons      || [];

  const rendered = renderBody(body, paramValues);
  const renderedHeader = renderBody(header, paramValues);

  return (
    <div style={ph.wrap}>
      {/* Phone shell */}
      <div style={ph.phone}>
        {/* Status bar */}
        <div style={ph.statusBar}>
          <span style={{ fontSize: 10, fontWeight: 700 }}>9:41</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M1 9l11-7 11 7v13H1V9z" opacity=".3"/><path d="M1 9l11-7 11 7" stroke="white" fill="none" strokeWidth="2"/></svg>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="1" y="6" width="4" height="12" rx="1"/><rect x="7" y="4" width="4" height="14" rx="1"/><rect x="13" y="2" width="4" height="16" rx="1"/><rect x="19" y="1" width="4" height="17" rx="1" opacity=".3"/></svg>
            <svg width="16" height="12" viewBox="0 0 28 14" fill="none"><rect x="0.5" y="0.5" width="22" height="13" rx="3" stroke="white" strokeOpacity=".5"/><rect x="2" y="2" width="15" height="10" rx="2" fill="white"/><path d="M24 4.5v5a2 2 0 000-5z" fill="white" opacity=".4"/></svg>
          </div>
        </div>

        {/* WA top bar */}
        <div style={ph.topBar}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          <div style={ph.avatar}>K</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Kartavya</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>+91 98765 43210</div>
          </div>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </div>

        {/* Chat area */}
        <div style={ph.chat}>
          {/* Date divider */}
          <div style={ph.dateDivider}>
            <span style={ph.dateDividerText}>TODAY</span>
          </div>

          {/* Message bubble */}
          <div style={ph.bubble}>
            {/* Tail */}
            <div style={ph.tail} />

            {header ? (
              <div style={ph.bubbleHeader}
                dangerouslySetInnerHTML={{ __html: renderedHeader }} />
            ) : null}

            <div style={ph.bubbleBody}
              dangerouslySetInnerHTML={{ __html: rendered || '<span style="color:#9ca3af;font-style:italic">Your message will appear here…</span>' }} />

            {footer ? (
              <div style={ph.bubbleFooter}>{footer}</div>
            ) : null}

            <div style={ph.bubbleTime}>
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <svg width="14" height="10" viewBox="0 0 18 12" fill="#53bdeb"><path d="M17.394.636L6.817 11.213l-3.83-3.83 1.06-1.06 2.77 2.77L16.334-.424l1.06 1.06z"/><path d="M1 6.5l2 2" stroke="#53bdeb" strokeWidth="1.4"/></svg>
            </div>
          </div>

          {/* Quick-reply buttons */}
          {buttons.length > 0 && (
            <div style={ph.buttons}>
              {buttons.map((btn, i) => (
                <button key={i} style={ph.qrBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0082c6" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
                  <span style={{ color: '#0082c6', fontSize: 13, fontWeight: 600 }}>{btn.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={ph.inputBar}>
          <div style={ph.inputField}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9.5" r="1" fill="#8696a0"/><circle cx="15" cy="9.5" r="1" fill="#8696a0"/></svg>
            <span style={{ fontSize: 13, color: '#8696a0', flex: 1 }}>Message</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </div>
          <div style={ph.micBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="1.5" fill="none"/></svg>
          </div>
        </div>
      </div>

      {/* Meta note */}
      <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5 }}>
        Preview only — submit to <strong>Meta Business Manager</strong> for approval before going live.
      </p>
    </div>
  );
}

const ph = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    position: 'sticky', top: 24,
  },
  phone: {
    width: 300, borderRadius: 36,
    background: '#fff',
    boxShadow: '0 0 0 8px #1a1a2e, 0 0 0 10px #2d2d50, 0 32px 80px rgba(0,0,0,.45)',
    overflow: 'hidden',
    fontFamily: '-apple-system, "Segoe UI", sans-serif',
  },
  statusBar: {
    background: '#075E54',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 14px 4px',
    color: '#fff',
  },
  topBar: {
    background: '#075E54',
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 12px 10px',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    background: '#128C7E',
    color: '#fff', fontSize: 14, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  chat: {
    background: '#E5DDD5',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23e5ddd5'/%3E%3C/svg%3E")`,
    minHeight: 280,
    padding: '10px 10px 6px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  dateDivider: {
    display: 'flex', justifyContent: 'center', margin: '4px 0 8px',
  },
  dateDividerText: {
    background: 'rgba(225,221,214,.92)',
    color: '#6b6b6b',
    fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
    padding: '3px 8px', borderRadius: 6,
    boxShadow: '0 1px 2px rgba(0,0,0,.1)',
  },
  bubble: {
    background: '#fff',
    borderRadius: '0 10px 10px 10px',
    padding: '6px 10px 4px',
    maxWidth: '85%',
    alignSelf: 'flex-start',
    position: 'relative',
    boxShadow: '0 1px 2px rgba(0,0,0,.12)',
  },
  tail: {
    position: 'absolute', top: 0, left: -6,
    width: 0, height: 0,
    borderStyle: 'solid',
    borderWidth: '0 8px 8px 0',
    borderColor: 'transparent #fff transparent transparent',
  },
  bubbleHeader: {
    fontSize: 13, fontWeight: 700, color: '#111',
    marginBottom: 5, lineHeight: 1.4,
  },
  bubbleBody: {
    fontSize: 13, color: '#111',
    lineHeight: 1.6, whiteSpace: 'pre-wrap',
  },
  bubbleFooter: {
    fontSize: 11, color: '#6b7280', marginTop: 5,
    borderTop: '1px solid #f0f0f0', paddingTop: 4,
  },
  bubbleTime: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: 3, marginTop: 3,
    fontSize: 10, color: '#9ca3af',
  },
  buttons: {
    display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2,
  },
  qrBtn: {
    background: '#fff',
    borderRadius: '10px', border: 'none',
    padding: '8px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,.12)',
  },
  inputBar: {
    background: '#f0f2f5',
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px',
  },
  inputField: {
    flex: 1, background: '#fff', borderRadius: 99,
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px',
  },
  micBtn: {
    width: 40, height: 40, borderRadius: 20,
    background: '#00a884',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
};


// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ tmpl, active, onClick }) {
  const cat    = CAT_META[tmpl.category] || CAT_META.UTILITY;
  const status = STATUS_META[tmpl.status] || STATUS_META.PENDING;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '14px 16px', borderRadius: 12,
        border: active ? '1.5px solid var(--k-primary)' : '1.5px solid var(--rule)',
        background: active ? 'color-mix(in srgb, var(--k-primary) 6%, var(--surface))' : 'var(--surface)',
        transition: 'border .15s, background .15s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: cat.color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>
            {cat.emoji}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 2 }}>
              {tmpl.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              {tmpl.template_key}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            color: status.color, background: status.bg,
            padding: '2px 7px', borderRadius: 99,
          }}>{status.label}</span>
          {tmpl.is_system && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
              color: 'var(--ink-3)', background: 'var(--rule-soft)',
              padding: '2px 7px', borderRadius: 99,
            }}>SYSTEM</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
        {(tmpl.body_text || '').replace(/\*([^*]+)\*/g, '$1').split('\n')[0]}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
          color: cat.color, background: cat.color + '14', padding: '1px 7px', borderRadius: 99,
        }}>{tmpl.category}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {(tmpl.params || []).length} param{(tmpl.params || []).length !== 1 ? 's' : ''}
          {(tmpl.buttons || []).length > 0 && ` · ${(tmpl.buttons || []).length} button${(tmpl.buttons || []).length !== 1 ? 's' : ''}`}
        </span>
      </div>
    </button>
  );
}


// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 38, height: 20, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
        background: value ? 'var(--k-primary)' : 'var(--rule-soft)',
        position: 'relative', transition: 'background .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        transition: 'left .2s', left: value ? 20 : 2,
      }} />
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function WhatsAppTemplatesPage() {
  const { pushToast } = useToast();

  const [templates,   setTemplates]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [active,      setActive]      = useState(null);   // selected template
  const [editing,     setEditing]     = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [form,        setForm]        = useState(EMPTY_TEMPLATE);
  const [paramVals,   setParamVals]   = useState([]);     // for preview
  const [saving,      setSaving]      = useState(false);
  const [confirm,     setConfirm]     = useState(null);
  const [testPhone,   setTestPhone]   = useState('');
  const [testSending, setTestSending] = useState(false);
  const [showTest,    setShowTest]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/whatsapp/templates');
      const data = Array.isArray(r.data) ? r.data : [];
      setTemplates(data);
      if (!active && data.length > 0) {
        setActive(data[0]);
        setParamVals((data[0].params || []).map(p => p.example || ''));
      }
    } catch { pushToast({ type: 'error', title: 'Could not load templates' }); }
    finally { setLoading(false); }
  }, [pushToast]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function selectTemplate(tmpl) {
    setActive(tmpl);
    setEditing(false);
    setCreating(false);
    setParamVals((tmpl.params || []).map(p => p.example || ''));
  }

  function startCreate() {
    setCreating(true); setEditing(false);
    setActive(null);
    setForm({ ...EMPTY_TEMPLATE });
    setParamVals([]);
  }

  function startEdit(tmpl) {
    setEditing(true); setCreating(false);
    setForm({
      name:         tmpl.name,
      template_key: tmpl.template_key,
      category:     tmpl.category,
      language:     tmpl.language,
      header_text:  tmpl.header_text || '',
      body_text:    tmpl.body_text || '',
      footer_text:  tmpl.footer_text || '',
      buttons:      tmpl.buttons || [],
      params:       tmpl.params  || [],
    });
    setParamVals((tmpl.params || []).map(p => p.example || ''));
  }

  const saveTemplate = async () => {
    if (!form.body_text.trim()) { pushToast({ type: 'error', title: 'Body text required' }); return; }
    if (!form.name.trim())      { pushToast({ type: 'error', title: 'Template name required' }); return; }
    setSaving(true);
    try {
      if (creating) {
        if (!form.template_key.trim()) { pushToast({ type: 'error', title: 'Template key required' }); setSaving(false); return; }
        const r = await api.post('/whatsapp/templates', form);
        pushToast({ type: 'success', title: `Template "${form.name}" created` });
        await load();
        const fresh = templates.find(t => t.template_key === form.template_key) || r.data;
        setActive(fresh); setCreating(false);
      } else {
        await api.patch(`/whatsapp/templates/${active.template_id}`, form);
        pushToast({ type: 'success', title: 'Template saved' });
        await load();
        setEditing(false);
      }
    } catch (e) { pushToast({ type: 'error', title: e?.response?.data?.detail || 'Could not save' }); }
    finally { setSaving(false); }
  };

  const deleteTemplate = (tmpl) => {
    setConfirm({
      message: `Delete template "${tmpl.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/whatsapp/templates/${tmpl.template_id}`);
          pushToast({ type: 'success', title: 'Deleted' });
          setActive(null); setEditing(false);
          load();
        } catch (e) { pushToast({ type: 'error', title: e?.response?.data?.detail || 'Could not delete' }); }
      },
    });
  };

  const sendTest = async () => {
    if (!testPhone.trim() || !active) return;
    setTestSending(true);
    try {
      const r = await api.post(`/whatsapp/templates/${active.template_id}/test-send`, {
        phone: testPhone.trim(),
        param_values: paramVals,
      });
      if (r.data.dev_mode) {
        pushToast({ type: 'info', title: 'Dev mode — WhatsApp not configured. Check server logs.' });
      } else {
        pushToast({ type: 'success', title: `Test sent to ${testPhone}` });
      }
      setShowTest(false);
    } catch (e) { pushToast({ type: 'error', title: e?.response?.data?.detail || 'Send failed' }); }
    finally { setTestSending(false); }
  };

  // Preview template — either the active one or the form being edited/created
  const previewTmpl = (editing || creating) ? form : active;

  // Param rows — for live preview sliders
  const previewParams = (editing || creating) ? (form.params || []) : (active?.params || []);

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Button helpers
  const addButton  = ()  => setForm(f => ({ ...f, buttons: [...f.buttons, { type: 'QUICK_REPLY', text: '', payload: '' }] }));
  const rmButton   = (i) => setForm(f => ({ ...f, buttons: f.buttons.filter((_, j) => j !== i) }));
  const setButton  = (i, key, val) => setForm(f => {
    const b = [...f.buttons]; b[i] = { ...b[i], [key]: val }; return { ...f, buttons: b };
  });

  // Param helpers
  const addParam   = ()  => setForm(f => ({ ...f, params: [...f.params, { key: String(f.params.length + 1), label: '', example: '' }] }));
  const rmParam    = (i) => setForm(f => ({ ...f, params: f.params.filter((_, j) => j !== i) }));
  const setParam   = (i, key, val) => {
    setForm(f => {
      const p = [...f.params]; p[i] = { ...p[i], [key]: val }; return { ...f, params: p };
    });
    if (key === 'example') setParamVals(v => { const n = [...v]; n[i] = val; return n; });
  };

  return (
    <div className="k-screen">
      <PageHeader
        kicker="COMMUNICATIONS"
        title="WhatsApp Templates"
        sanskrit="व्हाट्सऐप साँचा"
        lede="Manage Meta-approved message templates for task alerts, approvals, and OTP verification."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 28, alignItems: 'start' }}>

        {/* ── Left: template list ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* New template button */}
          <button
            onClick={startCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
              border: '1.5px dashed var(--rule-strong)',
              background: creating ? 'color-mix(in srgb, var(--k-primary) 6%, var(--surface))' : 'transparent',
              borderColor: creating ? 'var(--k-primary)' : 'var(--rule-strong)',
              color: creating ? 'var(--k-primary)' : 'var(--ink-3)',
              transition: 'all .15s', width: '100%', textAlign: 'left',
            }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 7,
              background: creating ? 'var(--k-primary)' : 'var(--rule-soft)',
              color: creating ? '#fff' : 'var(--ink-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 300, flexShrink: 0, transition: 'all .15s',
            }}>+</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>New template</div>
              <div style={{ fontSize: 11, opacity: .8 }}>Create a custom Meta template</div>
            </div>
          </button>

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>
              Loading templates…
            </div>
          ) : (
            templates.map(t => (
              <TemplateCard
                key={t.template_id}
                tmpl={t}
                active={active?.template_id === t.template_id && !creating}
                onClick={() => selectTemplate(t)}
              />
            ))
          )}
        </div>

        {/* ── Right: editor + preview ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
          {/* Only show something if a template is selected or creating */}
          {!active && !creating ? (
            <div className="k-empty">
              <div className="k-empty__icon">💬</div>
              <div className="k-empty__title">Select a template</div>
              <div className="k-empty__sub">Choose a template from the list to preview or edit it, or create a new one.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>

              {/* Editor panel */}
              <section className="k-card">
                <div className="k-card__head">
                  <div className="k-card__titles">
                    <h3 className="k-card__title">
                      {creating ? 'New template' : (editing ? 'Edit template' : (active?.name || ''))}
                    </h3>
                    <span className="k-card__sans">
                      {creating ? 'नया साँचा' : (editing ? 'संपादित करें' : (CAT_META[active?.category]?.emoji + ' ' + active?.category))}
                    </span>
                  </div>
                  {!creating && !editing && active && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {!active.is_system && (
                        <button className="k-btn k-btn--ghost k-btn--sm"
                          style={{ color: 'var(--ink-3)' }}
                          onClick={() => deleteTemplate(active)}>
                          Delete
                        </button>
                      )}
                      <button
                        className="k-btn k-btn--ghost k-btn--sm"
                        onClick={() => { setShowTest(v => !v); }}
                      >
                        Test send
                      </button>
                      <button
                        className="k-btn k-btn--primary k-btn--sm"
                        onClick={() => startEdit(active)}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  {(editing || creating) && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="k-btn k-btn--primary k-btn--sm" onClick={saveTemplate} disabled={saving}>
                        {saving ? 'Saving…' : (creating ? 'Create' : 'Save changes')}
                      </button>
                      <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => { setEditing(false); setCreating(false); }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="k-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* View mode */}
                  {!editing && !creating && active && (
                    <>
                      {/* Metadata row */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Key',      val: active.template_key, mono: true },
                          { label: 'Category', val: active.category },
                          { label: 'Language', val: LANGUAGES.find(l => l.code === active.language)?.label || active.language },
                          { label: 'Status',   val: STATUS_META[active.status]?.label || active.status,
                            color: STATUS_META[active.status]?.color, bg: STATUS_META[active.status]?.bg },
                        ].map(m => (
                          <div key={m.label} style={{
                            padding: '8px 14px', borderRadius: 10,
                            background: m.bg || 'var(--bg-soft)',
                            border: '1px solid var(--rule-soft)',
                          }}>
                            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 3 }}>{m.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: m.color || 'var(--ink)', fontFamily: m.mono ? 'var(--font-mono)' : undefined }}>{m.val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Header */}
                      {active.header_text && (
                        <div>
                          <FieldLabel>HEADER · शीर्षक</FieldLabel>
                          <div style={{ padding: '10px 14px', background: 'var(--bg-soft)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                            {active.header_text}
                          </div>
                        </div>
                      )}

                      {/* Body */}
                      <div>
                        <FieldLabel>BODY · मुख्य संदेश</FieldLabel>
                        <div style={{
                          padding: '12px 14px', background: 'var(--bg-soft)', borderRadius: 8,
                          fontSize: 14, lineHeight: 1.7, color: 'var(--ink)',
                          whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                          border: '1px solid var(--rule-soft)',
                        }}>
                          {active.body_text}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>
                          Use *bold*, _italic_, and {'{{1}}'} for parameters.
                        </div>
                      </div>

                      {/* Footer */}
                      {active.footer_text && (
                        <div>
                          <FieldLabel>FOOTER · पाद-टिप्पणी</FieldLabel>
                          <div style={{ padding: '8px 14px', background: 'var(--bg-soft)', borderRadius: 8, fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic' }}>
                            {active.footer_text}
                          </div>
                        </div>
                      )}

                      {/* Buttons */}
                      {(active.buttons || []).length > 0 && (
                        <div>
                          <FieldLabel>BUTTONS · बटन</FieldLabel>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {active.buttons.map((btn, i) => (
                              <div key={i} style={{
                                padding: '8px 12px', borderRadius: 8,
                                border: '1.5px solid var(--k-primary)',
                                background: 'color-mix(in srgb, var(--k-primary) 6%, var(--surface))',
                                display: 'flex', alignItems: 'center', gap: 10,
                              }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                                  color: 'var(--k-primary)', background: 'color-mix(in srgb, var(--k-primary) 15%, transparent)',
                                  padding: '2px 6px', borderRadius: 99, flexShrink: 0,
                                }}>{btn.type.replace('_', ' ')}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--k-primary)' }}>{btn.text}</span>
                                {btn.payload && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{btn.payload}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Params */}
                      {(active.params || []).length > 0 && (
                        <div>
                          <FieldLabel>PARAMETERS · पैरामीटर</FieldLabel>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                            {active.params.map((p, i) => (
                              <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-soft)', border: '1px solid var(--rule-soft)' }}>
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 3 }}>
                                  {`{{${p.key}}}`}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{p.label}</div>
                                {p.example && <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>e.g. {p.example}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Test send panel */}
                      {showTest && (
                        <div style={{ padding: 16, borderRadius: 12, border: '1.5px solid var(--rule)', background: 'var(--bg-soft)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>TEST SEND · परीक्षण</div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                              <label className="k-label">WhatsApp number (E.164)</label>
                              <input className="k-input" style={{ width: '100%' }}
                                value={testPhone} onChange={e => setTestPhone(e.target.value)}
                                placeholder="+91 98765 43210" />
                            </div>
                            <button className="k-btn k-btn--primary k-btn--sm" onClick={sendTest} disabled={testSending || !testPhone.trim()}>
                              {testSending ? 'Sending…' : 'Send'}
                            </button>
                          </div>
                          {(active.params || []).length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                              {active.params.map((p, i) => (
                                <div key={i}>
                                  <label className="k-label">{p.label} ({`{{${p.key}}}`})</label>
                                  <input className="k-input" value={paramVals[i] || ''} onChange={e => {
                                    const n = [...paramVals]; n[i] = e.target.value; setParamVals(n);
                                  }} placeholder={p.example} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Edit / Create form */}
                  {(editing || creating) && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label className="k-label">Template name *</label>
                          <input className="k-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Task Reminder" autoFocus />
                        </div>
                        <div>
                          <label className="k-label">Template key * {creating && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>(cannot change after creation)</span>}</label>
                          <input className="k-input" value={form.template_key} onChange={e => setF('template_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                            disabled={editing} placeholder="kartavya_my_template" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: editing ? .6 : 1 }} />
                        </div>
                        <div>
                          <label className="k-label">Category</label>
                          <select className="k-input" style={{ width: '100%' }} value={form.category} onChange={e => setF('category', e.target.value)}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="k-label">Language</label>
                          <select className="k-input" style={{ width: '100%' }} value={form.language} onChange={e => setF('language', e.target.value)}>
                            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="k-label">Header text (optional)</label>
                        <input className="k-input" value={form.header_text} onChange={e => setF('header_text', e.target.value)} placeholder="e.g. 📋 New task for you" />
                      </div>

                      <div>
                        <label className="k-label">Body text * <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Use *bold*, _italic_, {'{{1}}'} {'{{2}}'} for params</span></label>
                        <textarea className="k-input" rows={6} value={form.body_text} onChange={e => setF('body_text', e.target.value)}
                          style={{ width: '100%', resize: 'vertical', minHeight: 120, fontFamily: 'var(--font-mono)', fontSize: 13 }}
                          placeholder={"Hi *{{1}}*, your task *{{2}}* has been updated.\n\nDue: {{3}}"} />
                      </div>

                      <div>
                        <label className="k-label">Footer text (optional)</label>
                        <input className="k-input" value={form.footer_text} onChange={e => setF('footer_text', e.target.value)} placeholder="e.g. Kartavya by Aekam Inc" />
                      </div>

                      {/* Parameters */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <FieldLabel noMargin>PARAMETERS · पैरामीटर</FieldLabel>
                          <button className="k-btn k-btn--ghost k-btn--sm" onClick={addParam}>+ Add param</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {form.params.map((p, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                              <div>
                                <label className="k-label">Key</label>
                                <input className="k-input" value={p.key} onChange={e => setParam(i, 'key', e.target.value)}
                                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                              </div>
                              <div>
                                <label className="k-label">Label</label>
                                <input className="k-input" value={p.label} onChange={e => setParam(i, 'label', e.target.value)} placeholder="e.g. First name" />
                              </div>
                              <div>
                                <label className="k-label">Example (for preview)</label>
                                <input className="k-input" value={p.example} onChange={e => setParam(i, 'example', e.target.value)} placeholder="e.g. Priya" />
                              </div>
                              <button onClick={() => rmParam(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 18, paddingBottom: 2 }}>×</button>
                            </div>
                          ))}
                          {form.params.length === 0 && (
                            <div style={{ color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>No parameters — add one if you used {'{{1}}'} in the body.</div>
                          )}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <FieldLabel noMargin>BUTTONS · बटन</FieldLabel>
                          <button className="k-btn k-btn--ghost k-btn--sm" onClick={addButton} disabled={form.buttons.length >= 3}>
                            + Add button
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {form.buttons.map((btn, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                              <div>
                                <label className="k-label">Type</label>
                                <select className="k-input" style={{ width: '100%', fontSize: 12 }} value={btn.type} onChange={e => setButton(i, 'type', e.target.value)}>
                                  <option value="QUICK_REPLY">Quick reply</option>
                                  <option value="URL">URL</option>
                                  <option value="PHONE_NUMBER">Phone</option>
                                </select>
                              </div>
                              <div>
                                <label className="k-label">Button text</label>
                                <input className="k-input" value={btn.text} onChange={e => setButton(i, 'text', e.target.value)} placeholder="e.g. Approve ✅" />
                              </div>
                              <div>
                                <label className="k-label">{btn.type === 'URL' ? 'URL' : btn.type === 'PHONE_NUMBER' ? 'Phone' : 'Payload'}</label>
                                <input className="k-input" value={btn.payload || btn.url || btn.phone || ''}
                                  onChange={e => setButton(i, btn.type === 'URL' ? 'url' : btn.type === 'PHONE_NUMBER' ? 'phone' : 'payload', e.target.value)}
                                  placeholder={btn.type === 'URL' ? 'https://…' : btn.type === 'PHONE_NUMBER' ? '+91…' : 'PAYLOAD_VALUE'} />
                              </div>
                              <button onClick={() => rmButton(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 18, paddingBottom: 2 }}>×</button>
                            </div>
                          ))}
                          {form.buttons.length === 0 && (
                            <div style={{ color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>No buttons — add quick-reply or link buttons.</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Phone preview */}
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>LIVE PREVIEW · पूर्वावलोकन</div>
                  {/* Param sliders */}
                  {previewParams.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                      {previewParams.map((p, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                            {`{{${p.key}}}`} {p.label}
                          </label>
                          <input
                            className="k-input"
                            style={{ fontSize: 12, padding: '6px 10px' }}
                            value={paramVals[i] || ''}
                            onChange={e => { const n = [...paramVals]; n[i] = e.target.value; setParamVals(n); }}
                            placeholder={p.example || `{{${p.key}}}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <PhonePreview template={previewTmpl} paramValues={paramVals} />
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function FieldLabel({ children, noMargin }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
      color: 'var(--ink-3)', marginBottom: noMargin ? 0 : 8,
    }}>
      {children}
    </div>
  );
}
