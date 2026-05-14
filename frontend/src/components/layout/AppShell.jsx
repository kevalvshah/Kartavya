/**
 * AppShell.jsx — main layout shell.
 * Week 3: Templates added to sidebar nav.
 */
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { KWordmark } from '../../lib/brand';
import { NotificationsModal } from '../NotificationsModal';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import { Bell, Menu } from 'lucide-react';

export default function AppShell() {
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [unread,      setUnread]      = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teams,       setTeams]       = useState([]);
  const location = useLocation();

  useEffect(() => {
    api.get('/teams').then(r => setTeams(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        await api.post('/notifications/process');
        const r = await api.get('/notifications', { params: { unread_only: true } });
        if (live) setUnread(r.data.length);
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { live = false; clearInterval(id); };
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const teamId = location.pathname.match(/\/projects\/([^/]+)/)?.[1] || teams[0]?.team_id || '';

  return (
    <div data-testid="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block" style={{ flexShrink: 0 }}>
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute left-0 top-0 bottom-0" onClick={e => e.stopPropagation()}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--rule)', background: 'var(--surface)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer' }} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)', fontWeight: 500 }}>Kartavya</span>
          <button onClick={() => setNotifOpen(true)} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', position: 'relative' }} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, height: 16, minWidth: 16, padding: '0 4px', borderRadius: 99, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', fontWeight: 700 }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>

        {/* Desktop topbar */}
        <div className="hidden lg:block">
          <Topbar unread={unread} onOpenNotifications={() => setNotifOpen(true)} />
        </div>

        {/* Page content */}
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <Outlet context={{ teamId, teams }} />
        </main>
      </div>

      <NotificationsModal open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
  );
}

// re-export Protected so App.js can import from one place
export { default as Protected } from './Protected';
