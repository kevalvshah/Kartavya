// frontend/src/components/Sidebar.js
// Kartavya by Aekam Inc — Dark solid sidebar #050e1a

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/brand.css';

const NAV = [
  { section: 'Workspace', items: [
    { to: '/dashboard', label: 'Dashboard',    icon: 'grid' },
    { to: '/tasks',     label: 'My Tasks',     icon: 'list' },
    { to: '/board',     label: 'Kanban Board', icon: 'kanban' },
  ]},
  { section: 'Team', items: [
    { to: '/teams',         label: 'Teams',         icon: 'team' },
    { to: '/notifications', label: 'Notifications', icon: 'bell' },
  ]},
  { section: 'Settings', items: [
    { to: '/settings/categories',    label: 'Categories',   icon: 'tag' },
    { to: '/settings/notifications', label: 'Push Settings', icon: 'settings' },
  ]},
];

const ICONS = {
  grid:     <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  list:     <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M2 8h8M2 12h10"/></svg>,
  kanban:   <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="3" height="10" rx="1"/><rect x="6.5" y="3" width="3" height="7" rx="1"/><rect x="11" y="3" width="3" height="9" rx="1"/></svg>,
  team:     <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/><circle cx="13" cy="5" r="1.5"/><path d="M13 8.5c1.5 0 2.5 1 2.5 2.5"/></svg>,
  bell:     <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 11l-2-2H5L3 11V4a1 1 0 011-1h8a1 1 0 011 1v7z"/></svg>,
  tag:      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z"/><circle cx="5.5" cy="5.5" r="1"/></svg>,
  settings: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 2v1.5M8 12.5V14M14 8h-1.5M3.5 8H2M12.1 3.9l-1 1M4.9 11.1l-1 1M12.1 12.1l-1-1M4.9 4.9l-1-1"/></svg>,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '?';

  return (
    <aside className="k-sidebar">
      <div className="k-sidebar-brand">
        <div className="k-sidebar-mark">
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/>
            <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/>
          </svg>
        </div>
        <div>
          <div className="k-brand" style={{ color:'#fff', fontSize:15 }}>Kartavya</div>
          <div style={{ fontSize:8, letterSpacing:2.5, textTransform:'uppercase', color:'#05b7aa', marginTop:2, fontWeight:700 }}>by Aekam Inc</div>
        </div>
      </div>
      <nav style={{ flex:1, paddingBottom:8 }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div className="k-sidebar-section">{section}</div>
            {items.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `k-sidebar-item${isActive ? ' active' : ''}`}>
                {ICONS[icon]}{label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding:'14px 12px', borderTop:'1px solid rgba(255,255,255,0.055)', display:'flex', alignItems:'center', gap:9, position:'relative', zIndex:2 }}>
        <div className="k-avatar" style={{ width:30, height:30, fontSize:11, background:'rgba(255,255,255,0.1)', border:'1.5px solid rgba(255,255,255,0.18)' }}>{initials}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} title="Sign out" style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.22)', padding:4, borderRadius:4 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"/></svg>
        </button>
      </div>
    </aside>
  );
}
