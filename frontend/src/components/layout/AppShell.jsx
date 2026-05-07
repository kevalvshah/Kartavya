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
    <div data-testid="app-shell" className="min-h-screen bg-app text-foreground" style={{ fontFamily: "'Inter',sans-serif" }}>
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-4 lg:py-6">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="hidden lg:block"><Sidebar /></div>

          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-card shadow-xl" onClick={e => e.stopPropagation()}>
                <Sidebar />
              </div>
            </div>
          )}

          <main className="min-w-0">
            <div className="lg:hidden flex items-center justify-between mb-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl border border-border/60 bg-card/50" aria-label="Open menu">
                <Menu size={18} />
              </button>
              <KWordmark size="sm" />
              <button onClick={() => setNotifOpen(true)} className="p-2 rounded-xl border border-border/60 bg-card/50 relative" aria-label="Notifications">
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full text-[10px] flex items-center justify-center"
                    style={{ background: '#ef4444', color: '#fff', fontWeight: 500 }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            </div>
            <div className="hidden lg:block">
              <Topbar unread={unread} onOpenNotifications={() => setNotifOpen(true)} />
            </div>
            <div className="mt-4 lg:mt-6">
              <Outlet context={{ teamId, teams }} />
            </div>
          </main>
        </div>
      </div>
      <NotificationsModal open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
  );
}

// re-export Protected so App.js can import from one place
export { default as Protected } from './Protected';
