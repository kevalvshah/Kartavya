import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ensureServiceWorkerRegistered, urlBase64ToUint8Array } from '../lib/push';
import { PageHeader } from '../components/editorial';
import { NOTIF_SOUNDS, getNotifSoundId, setNotifSoundId, playNotifSound } from '../lib/notifSound';

export default function NotificationsSettingsPage() {
  const [supported,  setSupported]  = useState(false);
  const [permission, setPermission] = useState('default');
  const [enabled,    setEnabled]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [soundId,    setSoundId]    = useState(getNotifSoundId());

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
    setPermission(Notification.permission);
  }, []);

  const chooseSound = (id) => {
    setSoundId(id);
    setNotifSoundId(id);
    if (id !== 'none') playNotifSound();
  };

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

      {/* Notification sound */}
      <section className="k-card">
        <div className="k-card__head">
          <div className="k-card__titles">
            <h3 className="k-card__title">Notification sound</h3>
            <span className="k-card__sans">ध्वनि</span>
          </div>
        </div>
        <div className="k-card__body">
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>
            Plays when an in-app reminder or notification toast appears while Kartavya is open.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {NOTIF_SOUNDS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => chooseSound(s.id)}
                className="k-btn k-btn--sm"
                style={{
                  border: `1.5px solid ${soundId === s.id ? 'var(--k-primary)' : 'var(--rule)'}`,
                  background: soundId === s.id ? 'color-mix(in srgb, var(--k-primary) 12%, transparent)' : 'transparent',
                  color: soundId === s.id ? 'var(--k-primary)' : 'var(--ink-2)',
                  fontWeight: soundId === s.id ? 700 : 400,
                }}
              >
                {s.label} <span style={{ fontFamily: 'var(--font-hindi)', fontWeight: 400, opacity: 0.7 }}>{s.hi}</span>
              </button>
            ))}
          </div>
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
            New tasks default to reminders <strong>1 hour</strong> and <strong>15 minutes</strong> before the due date.
            Pick from 2 days down to 15 minutes, with separate in-app/push/email toggles, in the task drawer or New Task form.
          </p>
        </div>
      </section>
    </div>
  );
}
