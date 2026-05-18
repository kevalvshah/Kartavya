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
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { KWordmark } from '../../lib/brand';
import { NotificationsModal } from '../NotificationsModal';
import NewTaskModal from '../NewTaskModal';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import { Bell, Menu } from 'lucide-react';

export default function AppShell() {
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [newTaskOpen,  setNewTaskOpen]  = useState(false);
  const [unread,       setUnread]       = useState(0);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [teams,        setTeams]        = useState([]);
  const [teamsLoaded,  setTeamsLoaded]  = useState(false);
  const location = useLocation();

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

  // FIX #3: null until loaded — child pages guard on null to avoid empty requests.
  const teamIdFromPath = location.pathname.match(/\/projects\/([^/]+)/)?.[1];
  const teamId = teamIdFromPath || (teamsLoaded ? (teams[0]?.team_id || '') : null);

  return (
    <div data-testid="app-shell" className="k-app">
      {/* Sidebar — hidden on mobile via CSS */}
      <div className="k-app__sidebar">
        <Sidebar inboxCount={unread} />
      </div>

      {/* Mobile overlay drawer */}
      {sidebarOpen && (
        <div className="k-app__mob-overlay" onClick={() => setSidebarOpen(false)}>
          <div className="k-app__mob-drawer" onClick={e => e.stopPropagation()}>
            <Sidebar inboxCount={unread} />
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
          <button className="k-iconbtn" style={{ position: 'relative' }} onClick={() => setNotifOpen(true)} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, height: 16, minWidth: 16, padding: '0 4px', borderRadius: 99, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', fontWeight: 700 }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
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
    </div>
  );
}

// re-export Protected so App.js can import from one place
export { default as Protected } from './Protected';
