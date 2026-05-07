/**
 * Sidebar.jsx — left navigation panel.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { K, KLogo, KWordmark } from '../../lib/brand';
import { currentUser, useTheme } from '../../lib/auth';
import { Button } from '../ui/button';
import {
  Bell, FolderKanban, LayoutGrid, ListTodo,
  Sun, Moon, Users, ShieldCheck, Settings, CheckCircle2,
} from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const user     = currentUser();
  const isAdmin  = user?.role === 'admin';
  const isClient = user?.role === 'client';

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
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: K.gradD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
            {(user?.full_name || user?.name || '?')[0].toUpperCase()}
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
