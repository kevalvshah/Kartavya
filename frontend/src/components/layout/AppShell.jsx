/**
 * AppShell, Sidebar, Topbar, Protected — layout scaffolding.
 */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { K, KLogo, KWordmark } from '../../lib/brand';
import { currentUser, useTheme, apiLogout } from '../../lib/auth';
import { Button } from '../ui/button';
import { NotificationsModal } from '../NotificationsModal';
import {
  Bell, FolderKanban, LayoutGrid, ListTodo, LogOut,
  Sun, Moon, Users, ShieldCheck, Settings, CheckCircle2,
  Menu, Activity, Clock, Zap,
} from 'lucide-react';
import { useToast } from '../ui/toast';

// ── Protected wrapper ─────────────────────────────────────────────────────────
export function Protected({ children, requiredRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(null);
  const [user,  setUser]  = useState(null);

  useEffect(() => {
    let live = true;
    if (!localStorage.getItem('auth_token')) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      setReady(false); return;
    }
    api.get('/auth/me')
      .then((r) => {
        if (!live) return;
        window.__kartavya_user = r.data;
        localStorage.setItem('kartavya_user', JSON.stringify(r.data));
        setUser(r.data); setReady(true);
      })
      .catch(() => {
        if (!live) return;
        localStorage.removeItem('auth_token');
        navigate('/login', { replace: true });
        setReady(false);
      });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ready === null) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050e1a' }}>
      <div style={{ textAlign: 'center' }}>
        <KLogo size={40} />
        <div style={{ marginTop: 16, fontSize: 13, color: '#5a7087', fontFamily: "'Inter',sans-serif" }}>Loading Kartavya…</div>
      </div>
    </div>
  );
  if (!ready) return null;
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { theme, setTheme } = useTheme();
  const user      = currentUser();
  const isAdmin   = user?.role === 'admin';
  const isClient  = user?.role === 'client';

  const nav = isClient
    ? [
        { to: '/client/projects',        label: 'My Projects',   Icon: FolderKanban },
        { to: '/settings/notifications', label: 'Notifications', Icon: Bell },
      ]
    : [
        { to: '/dashboard',              label: 'Dashboard',     Icon: LayoutGrid },
        { to: '/projects',               label: 'Projects',      Icon: FolderKanban },
        { to: '/tasks',                  label: 'All Tasks',     Icon: ListTodo },
        { to: '/approvals',              label: 'Approvals',     Icon: CheckCircle2 },
        { to: '/teams',                  label: 'Teams',         Icon: Users },
        { to: '/activity',               label: 'Activity',      Icon: Activity },
        { to: '/automations',            label: 'Automations',   Icon: Zap },
        { to: '/time',                   label: 'Time Report',   Icon: Clock },
        { to: '/settings/categories',    label: 'Categories',    Icon: Settings },
        { to: '/settings/notifications', label: 'Notifications', Icon: Bell },
        ...(isAdmin ? [{ to: '/admin',   label: 'Admin',         Icon: ShieldCheck }] : []),
      ];

  return (
    <aside className="rounded-3xl border border-border/70 bg-card/50 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-48px)] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border/60">
        <div className="flex items-center gap-3"><KLogo size={34} /><KWordmark size="sm" /></div>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map(({ to, label, Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + '/');
          return (
            <button key={to} onClick={() => navigate(to)}
              className={cn('w-full rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-150 flex items-center gap-2.5',
                active ? 'text-white shadow-sm' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground')}
              style={active ? { background: K.gradD } : {}}>
              <Icon size={15} />
              {label}
              {to === '/admin' && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: K.teal + '33', color: K.teal }}>admin</span>}
            </button>
          );
        })}
      </div>
      <div className="p-3 border-t border-border/60">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {(user?.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate">{user?.full_name || user?.name || 'User'}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{user?.role || 'member'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
export function Topbar({ unread, onOpenNotifications }) {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const location = useLocation();

  const pageTitle = {
    '/dashboard':   'Dashboard',
    '/projects':    'Projects',
    '/tasks':       'All Tasks',
    '/teams':       'Teams',
    '/activity':    'Activity Feed',
    '/automations': 'Automations',
    '/time':        'Time Report',
    '/settings/categories':    'Categories',
    '/settings/notifications': 'Notifications',
    '/admin':  'Admin Panel',
    '/client': 'Client Portal',
  }[location.pathname] || 'Kartavya';

  const logout = async () => {
    await apiLogout();
    pushToast({ type: 'success', title: 'Signed out' });
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 px-5 py-3" style={{ background: K.dark }}>
      <div className="flex items-center gap-3">
        <KLogo size={28} />
        <div>
          <div className="text-sm font-bold text-white">{pageTitle}</div>
          <div className="text-xs" style={{ color: K.teal }}>Kartavya · Aekam Inc</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onOpenNotifications}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <Bell size={15} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: K.blue }}>{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
        <button onClick={logout} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────
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
    const id = setInterval(tick, 30000);
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
              <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-card shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <Sidebar />
              </div>
            </div>
          )}
          <main className="min-w-0">
            <div className="lg:hidden flex items-center justify-between mb-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl border border-border/60 bg-card/50"><Menu size={18} /></button>
              <KWordmark size="sm" />
              <button onClick={() => setNotifOpen(true)} className="p-2 rounded-xl border border-border/60 bg-card/50 relative">
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
