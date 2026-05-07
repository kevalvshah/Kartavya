/**
 * Protected.jsx — auth guard wrapper.
 * Verifies token via /auth/me before rendering children.
 */
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { KLogo } from '../../lib/brand';

export default function Protected({ children, requiredRole }) {
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
        <div style={{ marginTop: 16, fontSize: 13, color: '#5a7087', fontFamily: "'Nunito',sans-serif" }}>Loading Kartavya…</div>
      </div>
    </div>
  );
  if (!ready) return null;
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
