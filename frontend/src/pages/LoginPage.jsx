import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/toast';
import AuthShell, { authInput, authLabel, authBtn } from '../components/layout/AuthShell';
import { K } from '../lib/brand';
import { apiLogin, apiAcceptInvite } from '../lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [form, setForm]       = useState({ email: '', password: '' });
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
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: 'uppercase', color: K.mid, marginBottom: 8 }}>Welcome back</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0a1628', letterSpacing: -0.5, lineHeight: 1.2 }}>
          Sign in to<br /><span style={{ color: K.blue }}>Kartavya</span>
        </h1>
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>Email</label>
          <input name="email" type="email" value={form.email} onChange={set} required placeholder="you@example.com" style={authInput} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>Password</label>
          <input name="password" type="password" value={form.password} onChange={set} required placeholder="••••••••••" style={authInput} />
        </div>
        <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#8aa5be', marginTop: 20 }}>
        Access is invite-only. Contact your admin to get access.
      </p>
    </AuthShell>
  );
}

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [params]        = useState(() => new URLSearchParams(window.location.search));
  const token           = params.get('token') || '';
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
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: 'uppercase', color: K.mid, marginBottom: 8 }}>Create your account</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0a1628', letterSpacing: -0.5, lineHeight: 1.2 }}>
          Join<br /><span style={{ color: K.blue }}>Kartavya</span>
        </h1>
      </div>
      <form onSubmit={submit}>
        {[
          { label: 'Your name', name: 'name',    type: 'text',     ph: 'Keval Shah' },
          { label: 'Password',  name: 'password', type: 'password', ph: 'At least 8 characters' },
          { label: 'Confirm password', name: 'confirm', type: 'password', ph: '••••••••••' },
        ].map(({ label, name, type, ph }) => (
          <div key={name} style={{ marginBottom: 14 }}>
            <label style={authLabel}>{label}</label>
            <input name={name} type={type} value={form[name]} onChange={set} required placeholder={ph} style={authInput} />
          </div>
        ))}
        <button type="submit" disabled={loading} style={{ ...authBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Activating…' : 'Activate Account'}
        </button>
      </form>
      <p style={{ textAlign: 'center', fontSize: 13, color: '#5a7087', marginTop: 14 }}>
        Already have an account?{' '}
        <span onClick={() => navigate('/login')} style={{ color: K.blue, fontWeight: 800, cursor: 'pointer' }}>Sign in</span>
      </p>
    </AuthShell>
  );
}
