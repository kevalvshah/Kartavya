// frontend/src/components/Topbar.js
// Kartavya by Aekam Inc

import React from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/brand.css';

export default function Topbar({ title, actions }) {
  const { user } = useAuth();
  const greeting = () => { const h = new Date().getHours(); if (h < 12) return 'Good morning'; if (h < 17) return 'Good afternoon'; return 'Good evening'; };
  return (
    <div className="k-topbar">
      <div>
        <div style={{ fontSize:11, color:'#5a7087', fontWeight:600 }}>{new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
        <div style={{ fontSize:17, fontWeight:800, color:'#0a1628', letterSpacing:-0.3, lineHeight:1 }}>{title || `${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <div style={{ width:33, height:33, borderRadius:8, background:'#f4fafd', border:'1px solid #d0e8f5', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5a7087" strokeWidth="1.5"><path d="M13 11l-2-2H5L3 11V4a1 1 0 011-1h8a1 1 0 011 1v7z"/></svg>
          <div style={{ position:'absolute', top:6, right:6, width:6, height:6, borderRadius:'50%', background:'#0082c6', border:'1.5px solid white' }} />
        </div>
        {actions}
      </div>
    </div>
  );
}

export function NewTaskButton({ onClick }) {
  return (
    <button className="k-btn k-btn-primary" onClick={onClick}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
      New Task
    </button>
  );
}
