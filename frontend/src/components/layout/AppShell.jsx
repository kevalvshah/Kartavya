/**
 * AppShell.jsx — main layout shell.
 * Week 3: Templates added to sidebar nav.
 *
 * Bug fix (2026-05-14):
 * FIX #3: teamId is now null (not "") until the /teams fetch completes.
 *   Previously it resolved to "" immediately, and that empty string was
 *   passed to ActivityFeedPage / AutomationsPage / TimeReportPage via
 *   outlet context, causing those pages to fire requests with no team_id.
 *   Child pages should render a loading state while teamId === null.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { NotificationsModal } from '../NotificationsModal';
import NewTaskModal from '../NewTaskModal';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import { NotifToastContainer, NotifPermissionPrompt } from './NotifToast';
import { urlBase64ToUint8Array } from '../../lib/push';
import { Bell, Menu, X } from 'lucide-react';

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return; // already subscribed
    const keyRes = await api.get('/push/vapid-public-key');
    const pubKey = keyRes.data?.public_key;
    if (!pubKey || pubKey === 'not-configured') return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pubKey),
    });
    await api.post('/push/subscribe', sub.toJSON());
  } catch (_) {}
}

function requestBrowserPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => { if (perm === 'granted') subscribeToPush(); });
  } else if (Notification.permission === 'granted') {
    subscribeToPush();
  }
}

function fireBrowserNotif(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then(reg =>
        reg.showNotification(title, { body, icon: '/logo192.png', badge: '/logo192.png' })
      );
    } else {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  } catch (_) {}
}

export default function AppShell() {
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [newTaskOpen,  setNewTaskOpen]  = useState(false);
  const [unread,         setUnread]         = useState(0);
  const [msgUnread,      setMsgUnread]      = useState(0);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [teams,        setTeams]        = useState([]);
  const [teamsLoaded,  setTeamsLoaded]  = useState(false);
  const [notifPrompt,  setNotifPrompt]  = useState(false);
  const [toasts,       setToasts]       = useState([]);
  const prevUnread = useRef(null);
  const location = useLocation();

  // Register SW and ask for browser notification permission after 4 s
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const t = setTimeout(() => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') setNotifPrompt(true);
      else if (Notification.permission === 'granted') requestBrowserPermission();
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    api.get('/teams')
      .then(r => setTeams(r.data))
      .catch(() => {})
      .finally(() => setTeamsLoaded(true));
  }, []);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const r = await api.get('/notifications/poll');
        const count = r.data.unread ?? 0;
        const fresh = r.data.fresh ?? [];
        if (live) {
          if (prevUnread.current !== null && count > prevUnread.current) {
            if (document.visibilityState === 'visible') {
              // Show custom in-app toasts for each fresh notification
              if (fresh.length > 0) {
                setToasts(prev => [...prev, ...fresh.filter(n => !prev.find(p => p.notification_id === n.notification_id))]);
              } else {
                // Fallback synthetic toast if fresh list is empty
                setToasts(prev => [...prev, { notification_id: `synth-${Date.now()}`, title: 'New notification', message: 'Open notifications to view', url: null }]);
              }
            } else if (Notification.permission === 'granted') {
              fireBrowserNotif(
                fresh[0]?.title ?? 'New notification',
                fresh[0]?.message ?? 'Open Kartavya to view'
              );
            }
          }
          prevUnread.current = count;
          setUnread(count);
        }
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => { live = false; clearInterval(id); };
  }, []);

  // Poll message unread count every 30s
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const r = await api.get('/messages/unread-count');
        if (live) setMsgUnread(r.data.count ?? 0);
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { live = false; clearInterval(id); };
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // FIX #3: null until loaded — child pages guard on null to avoid empty requests.
  const teamIdFromPath = location.pathname.match(/\/projects\/([^/]+)/)?.[1];
  const teamId = teamIdFromPath || (teamsLoaded ? (teams[0]?.team_id || '') : null);

  return (
    <div data-testid="app-shell" className="k-app">
      {/* Sidebar — hidden on mobile via CSS */}
      <div className="k-app__sidebar">
        <Sidebar inboxCount={unread} messagesCount={msgUnread} />
      </div>

      {/* Mobile overlay drawer */}
      {sidebarOpen && (
        <div className="k-app__mob-overlay" onClick={() => setSidebarOpen(false)}>
          <div className="k-app__mob-drawer" onClick={e => e.stopPropagation()}>
            <Sidebar inboxCount={unread} messagesCount={msgUnread} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="k-main">
        {/* Mobile topbar */}
        <div className="k-app__mob-bar">
          <button className="k-iconbtn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)', fontWeight: 500 }}>Kartavya</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="k-iconbtn" style={{ position: 'relative' }} onClick={() => setNotifOpen(true)} aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, height: 16, minWidth: 16, padding: '0 4px', borderRadius: 99, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', fontWeight: 700 }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <button className="k-btn k-btn--primary k-btn--sm" onClick={() => setNewTaskOpen(true)} style={{ padding: '6px 12px', fontSize: 12 }}>
              + New task
            </button>
          </div>
        </div>

        {/* Desktop topbar */}
        <div className="k-app__topbar">
          <Topbar unread={unread} onOpenNotifications={() => setNotifOpen(true)} onNewTask={() => setNewTaskOpen(true)} />
        </div>


        {/* Page content */}
        <main className="k-content">
          <Outlet context={{ teamId, teams }} />
        </main>
      </div>

      <NotificationsModal open={notifOpen} onOpenChange={setNotifOpen} />
      <NewTaskModal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} onCreated={() => setNewTaskOpen(false)} />

      {/* Corner notification permission prompt */}
      {notifPrompt && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9998, pointerEvents: 'all' }}>
          <NotifPermissionPrompt
            onAllow={() => { setNotifPrompt(false); requestBrowserPermission(); }}
            onDismiss={() => setNotifPrompt(false)}
          />
        </div>
      )}

      {/* In-app toast stack */}
      <NotifToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts(prev => prev.filter(t => t.notification_id !== id))}
      />
    </div>
  );
}

// re-export Protected so App.js can import from one place
export { default as Protected } from './Protected';
