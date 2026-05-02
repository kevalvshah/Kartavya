// frontend/src/pages/LoginPageStandalone.js
// Kartavya by Aekam Inc

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BRAND_STYLES = {
  page: { minHeight: '100vh', display: 'flex', fontFamily: "'Nunito', sans-serif", background: '#f4fafd' },
  left: { width: 420, background: '#050e1a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 44, flexShrink: 0 },
  mark: { width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#0082c6,#05b7aa)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  right: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 60px', maxWidth: 520, background: '#fff' },
  label: { display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#5a7087', marginBottom: 6 },
  input: { width: '100%', padding: '11px 14px', background: '#f4fafd', border: '1.5px solid #d0e8f5', borderRadius: 8, fontSize: 14, color: '#0a1628', outline: 'none', boxSizing: 'border-box' },
  btn: { width: '100%', padding: 13, background: 'linear-gradient(90deg,#0082c6,#03a1b6,#05b7aa)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  powered: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 18, marginTop: 18, borderTop: '1px solid #d0e8f5', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' },
};

function BrandLeft({ headline, sub }) {
  return (
    <div style={BRAND_STYLES.left}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={BRAND_STYLES.mark}>
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8" />
            <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: 2.5, textTransform: 'uppercase' }}>Kartavya</div>
          <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: '#05b7aa', marginTop: 2, fontWeight: 700 }}>by Aekam Inc</div>
        </div>
      </div>
      <div>
        <h2 style={{ color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 12, letterSpacing: -0.5 }} dangerouslySetInnerHTML={{ __html: headline }} />
        <p style={{ color: '#8aa5be', fontSize: 13, lineHeight: 1.7 }}>{sub}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {['Kanban boards, list views & due dates', 'Team roles, assignments & reminders', 'Browser push & in-app notifications', 'Web + Android — one backend'].map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 20, height: 2, background: 'linear-gradient(90deg,#0082c6,#05b7aa)', borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#8aa5be' }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(form.email, form.password); navigate('/dashboard'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div style={BRAND_STYLES.page}>
      <BrandLeft
        headline='Do what<br /><span style="background:linear-gradient(90deg,#0082c6,#05b7aa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">must be done.</span>'
        sub="Team task management built for Indian businesses."
      />
      <div style={BRAND_STYLES.right}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: 'uppercase', color: '#03a1b6', marginBottom: 8 }}>Welcome back</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0a1628', letterSpacing: -0.5, lineHeight: 1.2 }}>Sign in to<br /><span style={{ color: '#0082c6' }}>Kartavya</span></h1>
        </div>
        {error && <div style={{ background: '#fff0f0', color: '#c0392b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}><label style={BRAND_STYLES.label}>Email</label><input name="email" type="email" value={form.email} onChange={handle} required placeholder="you@aekaminc.com" style={BRAND_STYLES.input} /></div>
          <div style={{ marginBottom: 14 }}><label style={BRAND_STYLES.label}>Password</label><input name="password" type="password" value={form.password} onChange={handle} required placeholder="••••••••••" style={BRAND_STYLES.input} /></div>
          <button type="submit" disabled={loading} style={BRAND_STYLES.btn}>{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#5a7087', marginTop: 18 }}>No account? <span onClick={() => navigate('/register')} style={{ color: '#0082c6', fontWeight: 800, cursor: 'pointer' }}>Create one free</span></p>
        <div style={BRAND_STYLES.powered}><span style={{ color: '#b8cedd', fontWeight: 700 }}>Powered by</span><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#05b7aa' }} /><span style={{ color: '#03a1b6', fontWeight: 800 }}>Aekam Inc</span></div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) { setError("Passwords don't match"); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try { await register(form.name, form.email, form.password); navigate('/dashboard'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div style={BRAND_STYLES.page}>
      <BrandLeft
        headline='Get started<br /><span style="background:linear-gradient(90deg,#0082c6,#05b7aa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">for free.</span>'
        sub="Join Kartavya and manage your team tasks the right way."
      />
      <div style={BRAND_STYLES.right}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3.5, textTransform: 'uppercase', color: '#03a1b6', marginBottom: 8 }}>Get started free</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0a1628', letterSpacing: -0.5, lineHeight: 1.2 }}>Join<br /><span style={{ color: '#0082c6' }}>Kartavya</span></h1>
        </div>
        {error && <div style={{ background: '#fff0f0', color: '#c0392b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <form onSubmit={submit}>
          {[{ label: 'Full name', name: 'name', type: 'text', ph: 'Jane Smith' }, { label: 'Email', name: 'email', type: 'email', ph: 'you@aekaminc.com' }, { label: 'Password', name: 'password', type: 'password', ph: 'At least 8 characters' }, { label: 'Confirm password', name: 'confirm', type: 'password', ph: '••••••••••' }].map(({ label, name, type, ph }) => (
            <div key={name} style={{ marginBottom: 14 }}><label style={BRAND_STYLES.label}>{label}</label><input name={name} type={type} value={form[name]} onChange={handle} required placeholder={ph} style={BRAND_STYLES.input} /></div>
          ))}
          <button type="submit" disabled={loading} style={BRAND_STYLES.btn}>{loading ? 'Creating account…' : 'Create Account'}</button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#5a7087', marginTop: 18 }}>Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#0082c6', fontWeight: 800, cursor: 'pointer' }}>Sign in</span></p>
        <div style={BRAND_STYLES.powered}><span style={{ color: '#b8cedd', fontWeight: 700 }}>Powered by</span><div style={{ width: 4, height: 4, borderRadius: '50%', background: '#05b7aa' }} /><span style={{ color: '#03a1b6', fontWeight: 800 }}>Aekam Inc</span></div>
      </div>
    </div>
  );
}
