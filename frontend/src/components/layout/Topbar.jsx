/**
 * Topbar.jsx — desktop header bar.
 * Week 3: Templates title added.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { K, KLogo } from '../../lib/brand';
import { apiLogout } from '../../lib/auth';
import { useToast } from '../ui/toast';
import { Bell, LogOut } from 'lucide-react';

const PAGE_TITLES = {
  '/dashboard':   'Dashboard',
  '/projects':    'Projects',
  '/tasks':       'All Tasks',
  '/teams':       'Teams',
  '/activity':    'Activity Feed',
  '/automations': 'Automations',
  '/time':        'Time Report',
  '/templates':   'Templates',
  '/approvals':   'Approvals',
  '/settings/categories':    'Categories',
  '/settings/notifications': 'Notifications',
  '/admin':  'Admin Panel',
  '/client': 'Client Portal',
};

export default function Topbar({ unread, onOpenNotifications }) {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Kartavya';

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
