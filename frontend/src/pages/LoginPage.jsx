/**
 * LoginPage.jsx — sign in + accept-invite pages.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { K, KLogo, KWordmark } from '../lib/brand';
import { apiLogin, apiAcceptInvite } from '../lib/auth';
import { useToast } from '../components/ui/toast';

const authInput = { width: '100%', padding: '11px 14px', background: '#f4fafd', border: '1.5px solid #d0e8f5', borderRadius: 8, fontSize: 14, color: '#0a1628', outline: 'none', boxSizing: 'border-box' };
const authLabel = { display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#5a7087', marginBottom: 6 };
const authBtn   = { width: '100%', padding: 13, background: K.grad, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 };

function AuthShell({ children, title, sub }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Nunito',sans-serif", background: '#f4fafd' }}>
      <div style={{ width: 420, background: K.dark, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 44, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><KLogo size={36} /><KWordmark dark /></div>
        <div>
          <h2 style={{ color: '#fff', fontSize: 30, fontWeight: 600, lineHeight: 1.25, marginBottom: 12, letterSpacing: -0.5 }}>{title}</h2>
          <p style={{ color: '#8aa5be', fontSize: 13, lineHeight: 1.7 }}>{sub}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Custom Kanban columns per project', 'Client portal with restricted access',
            'Invite-only — no public sign-ups', '4 board views: Kanban, List, Schedule, Tracker'].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 20, height: 2, background: K.grad, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#8aa5be' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 60px', maxWidth: 520, background: '#fff' }}>
        {children}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 18, marginTop: 18, borderTop: '1px solid #d0e8f5', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' }}>
          <span style={{ color: '#b8cedd', fontWeight: 500 }}>Powered by</span>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: K.teal }} />
          <span style={{ color: K.mid, fontWeight: 600 }}>Aekam Inc</span>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const data = await apiLogin(form.email, form.password);
      navigate(data.user?.role === 'client' ? '/client' : '/dashboard', { replace: true });
    } catch (err) {
      pushToast({ type: 'error', title: 'Sign in failed', message: err?.response?.data?.detail || 'Check your credentials.' });
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      title={<>Do what<br /><span style={{ background: K.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>must be done.</span></>}
      sub="Team task management built for agencies and founders. Invite-only access."
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 3.5, textTransform: 'uppercase', color: K.mid, marginBottom: 8 }}>Welcome back</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#0a1628', letterSpacing: -0.5, lineHeight: 1.2 }}>Sign in to<br /><span style={{ color: K.blue }}>Kartavya</span></h1>
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}><label style={authLabel}>Email</label><input name="email" type="email" value={form.email} onChange={set} required placeholder="you@example.com" style={authInput} /></div>
        <div style={{ marginBottom: 14 }}><label style={authLabel}>Password</label><input name="password" type="password" value={form.password} onChange={set} required placeholder="••••••••••" style={authInput} /></div>
        <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>{loading ? 'Signing in…' : 'Sign In'}</button>
      </form>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#8aa5be', marginTop: 20 }}>Access is invite-only. Contact your admin to get access.</p>
    </AuthShell>
  );
}

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const token = params.get('token') || '';
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  if (!token) return (
    <AuthShell title="Invalid link" sub="This invite link is missing a token.">
      <p style={{ color: '#e74c3c', fontSize: 14 }}>No invite token found. Please ask your admin for a new link.</p>
    </AuthShell>
  );

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { pushToast({ type: 'error', title: "Passwords don't match" }); return; }
    if (form.password.length < 8) { pushToast({ type: 'error', title: 'Password too short', message: 'Minimum 8 characters.' }); return; }
    setLoading(true);
    try {
      const data = await apiAcceptInvite(token, form.name, form.password);
      pushToast({ type: 'success', title: 'Welcome to Kartavya!' });
      navigate(data.user?.role === 'client' ? '/client' : '/dashboard', { replace: true });
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not accept invite', message: err?.response?.data?.detail || 'Link may have expired.' });
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      title={<>You've been<br /><span style={{ background: K.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>invited.</span></>}
      sub="Set your name and password to activate your account."
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 3.5, textTransform: 'uppercase', color: K.mid, marginBottom: 8 }}>Create your account</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#0a1628', letterSpacing: -0.5, lineHeight: 1.2 }}>Join<br /><span style={{ color: K.blue }}>Kartavya</span></h1>
      </div>
      <form onSubmit={submit}>
        {[{ label: 'Your name', name: 'name', type: 'text', ph: 'Keval Shah' }, { label: 'Password', name: 'password', type: 'password', ph: 'At least 8 characters' }, { label: 'Confirm password', name: 'confirm', type: 'password', ph: '••••••••••' }].map(({ label, name, type, ph }) => (
          <div key={name} style={{ marginBottom: 14 }}><label style={authLabel}>{label}</label><input name={name} type={type} value={form[name]} onChange={set} required placeholder={ph} style={authInput} /></div>
        ))}
        <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>{loading ? 'Activating…' : 'Activate Account'}</button>
      </form>
      <p style={{ textAlign: 'center', fontSize: 13, color: '#5a7087', marginTop: 14 }}>Already have an account? <span onClick={() => navigate('/login')} style={{ color: K.blue, fontWeight: 600, cursor: 'pointer' }}>Sign in</span></p>
    </AuthShell>
  );
}
