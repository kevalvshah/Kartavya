import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ensureServiceWorkerRegistered, urlBase64ToUint8Array } from '../lib/push';
import { PageHeader } from '../components/editorial';
import { useToast } from '../components/ui/toast';

export default function NotificationsSettingsPage() {
  const { pushToast } = useToast();
  const [supported,  setSupported]  = useState(false);
  const [permission, setPermission] = useState('default');
  const [enabled,    setEnabled]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  // WhatsApp state
  const [wa,          setWa]          = useState(null);   // settings from API
  const [waLoading,   setWaLoading]   = useState(true);
  const [waPhone,     setWaPhone]     = useState('');
  const [waOtp,       setWaOtp]       = useState('');
  const [waStep,      setWaStep]      = useState('idle'); // idle | phone | otp | verified
  const [waWorking,   setWaWorking]   = useState(false);

  useEffect(() => {
    api.get('/whatsapp/settings')
      .then(r => {
        setWa(r.data);
        if (r.data.verified && !r.data.opted_out) setWaStep('verified');
        else if (r.data.opted_in) setWaStep('otp');
      })
      .catch(() => {})
      .finally(() => setWaLoading(false));
  }, []);

  const sendOptIn = async () => {
    if (!waPhone.trim()) return;
    setWaWorking(true);
    try {
      const r = await api.post('/whatsapp/opt-in', { phone: waPhone.trim() });
      pushToast({ type: 'success', title: 'OTP sent', message: 'Check your WhatsApp.' });
      if (r.data.dev_otp) setWaOtp(r.data.dev_otp); // dev convenience
      setWaStep('otp');
    } catch (e) {
      pushToast({ type: 'error', title: e?.response?.data?.detail || 'Could not send OTP' });
    } finally { setWaWorking(false); }
  };

  const verifyOtp = async () => {
    if (!waOtp.trim()) return;
    setWaWorking(true);
    try {
      await api.post('/whatsapp/verify', { otp: waOtp.trim() });
      pushToast({ type: 'success', title: 'WhatsApp verified! ✓', message: 'Notifications are now active.' });
      setWaStep('verified');
      const r = await api.get('/whatsapp/settings');
      setWa(r.data);
    } catch (e) {
      pushToast({ type: 'error', title: e?.response?.data?.detail || 'Invalid OTP' });
    } finally { setWaWorking(false); }
  };

  const optOut = async () => {
    setWaWorking(true);
    try {
      await api.delete('/whatsapp/opt-out');
      pushToast({ type: 'success', title: 'WhatsApp notifications disabled' });
      setWaStep('idle'); setWa(null); setWaPhone(''); setWaOtp('');
    } catch (_) { pushToast({ type: 'error', title: 'Could not opt out' }); }
    finally { setWaWorking(false); }
  };

  const togglePref = async (key) => {
    const next = !wa[key];
    setWa(prev => ({ ...prev, [key]: next }));
    await api.patch('/whatsapp/settings', { [key]: next }).catch(() => {});
  };

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
    setPermission(Notification.permission);
  }, []);

  const statusColor = useMemo(() => {
    if (!supported || permission === 'denied') return 'var(--danger)';
    if (enabled) return 'var(--ok)';
    return 'var(--ink-3)';
  }, [supported, permission, enabled]);

  const refreshEnabled = async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return setEnabled(false);
    const sub = await reg.pushManager.getSubscription();
    setEnabled(!!sub);
  };

  useEffect(() => { refreshEnabled().catch(() => {}); }, [supported]);

  const enablePush = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      const reg = await ensureServiceWorkerRegistered();
      const keyRes = await api.get('/push/vapid-public-key');
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.data.public_key),
      });
      await api.post('/push/subscribe', subscription);
      await refreshEnabled();
    } finally { setLoading(false); }
  };

  const disablePush = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api.post('/push/unsubscribe', sub); await sub.unsubscribe(); }
      await refreshEnabled();
    } finally { setLoading(false); }
  };

  return (
    <div className="k-screen">
      <PageHeader
        kicker="SETTINGS"
        title="Notifications"
        sanskrit="सूचना"
        lede="Enable browser push notifications. Works on desktop and mobile."
      />

      {/* Push subscription card */}
      <section className="k-card">
        <div className="k-card__head">
          <div className="k-card__titles">
            <h3 className="k-card__title">Browser push</h3>
            <span className="k-card__sans">ब्राउज़र</span>
          </div>
          <span className="k-statuschip" style={{ '--c': statusColor, marginLeft: 'auto' }}>
            <span className="k-statuschip__dot" />
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="k-card__body">
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
            Supported: <strong>{supported ? 'Yes' : 'No'}</strong> · Permission: <strong>{permission}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="k-btn k-btn--primary" onClick={enablePush} disabled={loading || !supported || enabled}>
              Enable
            </button>
            <button className="k-btn k-btn--ghost" onClick={disablePush} disabled={loading || !supported || !enabled}>
              Disable
            </button>
          </div>
          {permission === 'denied' && (
            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--danger)' }}>
              Notifications are blocked in your browser settings. Allow this site in your browser notification preferences.
            </p>
          )}
        </div>
      </section>

      {/* WhatsApp */}
      <section className="k-card">
        <div className="k-card__head">
          <div className="k-card__titles">
            <h3 className="k-card__title">WhatsApp · वार्ता</h3>
            <span className="k-card__sans">व्हाट्सएप</span>
          </div>
          {waStep === 'verified' && (
            <span className="k-statuschip" style={{ '--c': '#25D366', marginLeft: 'auto' }}>
              <span className="k-statuschip__dot" />
              Active · {wa?.phone}
            </span>
          )}
        </div>
        <div className="k-card__body">
          {waLoading ? (
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading…</p>
          ) : waStep === 'idle' || waStep === 'phone' ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.6 }}>
                Receive approval requests, @mentions, and task assignments directly on WhatsApp — with one-tap Approve/Reject buttons.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="k-label">WhatsApp number</label>
                  <input className="k-input" value={waPhone}
                    onChange={e => setWaPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    onKeyDown={e => e.key === 'Enter' && sendOptIn()} />
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
                    Enter in E.164 format. +91 prefix auto-applied for India if omitted.
                  </div>
                </div>
                <button className="k-btn k-btn--primary" onClick={sendOptIn} disabled={waWorking || !waPhone.trim()}>
                  {waWorking ? 'Sending…' : 'Send OTP'}
                </button>
              </div>
            </>
          ) : waStep === 'otp' ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>
                An OTP was sent to your WhatsApp. Enter it below to verify.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="k-label">6-digit OTP</label>
                  <input className="k-input" value={waOtp}
                    onChange={e => setWaOtp(e.target.value)}
                    placeholder="123456" maxLength={6}
                    onKeyDown={e => e.key === 'Enter' && verifyOtp()} />
                </div>
                <button className="k-btn k-btn--primary" onClick={verifyOtp} disabled={waWorking || waOtp.length < 4}>
                  {waWorking ? 'Verifying…' : 'Verify'}
                </button>
                <button className="k-btn k-btn--ghost" onClick={() => setWaStep('phone')}>Change number</button>
              </div>
              <button
                onClick={async () => { await api.post('/whatsapp/resend-otp'); pushToast({ type: 'success', title: 'OTP resent' }); }}
                style={{ marginTop: 10, fontSize: 12, color: 'var(--k-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Resend OTP
              </button>
            </>
          ) : (
            /* Verified — show toggles */
            <>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 16, lineHeight: 1.6 }}>
                WhatsApp notifications are active on <strong>{wa?.phone}</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {[
                  { key: 'notify_approvals',   label: 'Approval requests',  sub: 'With one-tap Approve / Reject buttons' },
                  { key: 'notify_assignments', label: 'Task assignments',   sub: 'When someone assigns a task to you' },
                  { key: 'notify_mentions',    label: '@Mentions',           sub: 'When you are @mentioned in a message' },
                  { key: 'notify_dms',         label: 'Direct messages',    sub: 'New DM in messaging' },
                ].map(({ key, label, sub }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                    background: 'var(--bg-soft)', borderRadius: 'var(--r-md)', border: '1px solid var(--rule-soft)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
                    </div>
                    <div
                      onClick={() => togglePref(key)}
                      style={{ width: 40, height: 22, borderRadius: 11,
                        background: wa?.[key] ? '#25D366' : 'var(--rule-soft)',
                        position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
                      <div style={{ position: 'absolute', top: 3,
                        left: wa?.[key] ? 21 : 3, width: 16, height: 16,
                        borderRadius: '50%', background: '#fff',
                        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <button className="k-btn k-btn--ghost k-btn--sm"
                onClick={optOut} disabled={waWorking}
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {waWorking ? 'Disabling…' : 'Disable WhatsApp notifications'}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Reminder defaults */}
      <section className="k-card">
        <div className="k-card__head">
          <div className="k-card__titles">
            <h3 className="k-card__title">Reminder defaults</h3>
            <span className="k-card__sans">स्मरण</span>
          </div>
        </div>
        <div className="k-card__body">
          <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Default reminder fires <strong>2 hours before</strong> the due date. Override per task in the Task Editor.
          </p>
        </div>
      </section>
    </div>
  );
}
