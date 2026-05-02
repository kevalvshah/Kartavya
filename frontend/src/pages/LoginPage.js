// frontend/src/pages/LoginPage.js
// Kartavya by Aekam Inc

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/brand.css';

function AuthLeft() {
  return (
    <div className="k-auth-left">
      <div style={{ display:'flex', alignItems:'center', gap:12, zIndex:1, position:'relative' }}>
        <div className="k-mark" style={{ width:38, height:38 }}>
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <path d="M4 11L11 4L18 11L11 18L4 11Z" stroke="white" strokeWidth="1.8"/>
            <path d="M7.5 11L11 7.5L14.5 11L11 14.5L7.5 11Z" fill="white" opacity=".85"/>
          </svg>
        </div>
        <div>
          <div className="k-brand" style={{ color:'#fff', fontSize:18 }}>Kartavya</div>
          <div style={{ fontSize:9, letterSpacing:3, textTransform:'uppercase', color:'#05b7aa', marginTop:2, fontWeight:700 }}>by Aekam Inc</div>
        </div>
      </div>
      <div style={{ zIndex:1, position:'relative' }}>
        <h2 style={{ color:'#fff', fontSize:32, fontWeight:800, lineHeight:1.25, marginBottom:12, letterSpacing:-0.5 }}>
          Do what<br /><span className="k-gradient-text">must be done.</span>
        </h2>
        <p style={{ color:'#8aa5be', fontSize:13, lineHeight:1.7 }}>
          Team task management built for Indian businesses.
        </p>
      </div>
      <div style={{ zIndex:1, position:'relative', display:'flex', flexDirection:'column', gap:12 }}>
        {['Kanban boards, list views & due dates','Team roles, assignments & reminders','Browser push & in-app notifications','Web app + Android — one backend'].map((f) => (
          <div key={f} style={{ display:'flex', alignItems:'center', gap:11 }}>
            <div style={{ width:20, height:1.5, background:'linear-gradient(90deg,#0082c6,#05b7aa)', borderRadius:2, flexShrink:0 }} />
            <span style={{ fontSize:12, color:'#8aa5be' }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email:'', password:'' });
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
    <div className="k-auth-wrap">
      <AuthLeft />
      <div className="k-auth-right">
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:3.5, textTransform:'uppercase', color:'#03a1b6', marginBottom:8 }}>Welcome back</div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'#0a1628', letterSpacing:-0.5, lineHeight:1.2 }}>Sign in to<br /><span style={{ color:'#0082c6' }}>Kartavya</span></h1>
        </div>
        {error && <div style={{ background:'#fff0f0', color:'#c0392b', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}
        <form onSubmit={submit}>
          <div style={{ marginBottom:15 }}><label className="k-label">Email address</label><input className="k-input" type="email" name="email" value={form.email} onChange={handle} required placeholder="you@aekaminc.com" autoComplete="email" /></div>
          <div style={{ marginBottom:15 }}><label className="k-label">Password</label><input className="k-input" type="password" name="password" value={form.password} onChange={handle} required placeholder="••••••••••" autoComplete="current-password" /></div>
          <button className="k-btn k-btn-primary" type="submit" disabled={loading} style={{ width:'100%', marginTop:4 }}>{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <div className="k-divider">or</div>
        <p style={{ textAlign:'center', fontSize:13, color:'#5a7087' }}>No account?{' '}<Link to="/register" style={{ color:'#0082c6', fontWeight:800, textDecoration:'none' }}>Create one free</Link></p>
        <div className="k-powered"><span className="k-powered-label">Powered by</span><div style={{ width:4, height:4, borderRadius:'50%', background:'#05b7aa' }} /><span className="k-powered-brand">Aekam Inc</span></div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'' });
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
    <div className="k-auth-wrap">
      <AuthLeft />
      <div className="k-auth-right">
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:3.5, textTransform:'uppercase', color:'#03a1b6', marginBottom:8 }}>Get started free</div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'#0a1628', letterSpacing:-0.5, lineHeight:1.2 }}>Join<br /><span style={{ color:'#0082c6' }}>Kartavya</span></h1>
        </div>
        {error && <div style={{ background:'#fff0f0', color:'#c0392b', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}
        <form onSubmit={submit}>
          {[{label:'Full name',name:'name',type:'text',ph:'Jane Smith'},{label:'Email address',name:'email',type:'email',ph:'you@aekaminc.com'},{label:'Password',name:'password',type:'password',ph:'At least 8 characters'},{label:'Confirm password',name:'confirm',type:'password',ph:'••••••••••'}].map(({ label, name, type, ph }) => (
            <div key={name} style={{ marginBottom:14 }}><label className="k-label">{label}</label><input className="k-input" type={type} name={name} value={form[name]} onChange={handle} required placeholder={ph} /></div>
          ))}
          <button className="k-btn k-btn-primary" type="submit" disabled={loading} style={{ width:'100%', marginTop:4 }}>{loading ? 'Creating account…' : 'Create Account'}</button>
        </form>
        <div className="k-divider">or</div>
        <p style={{ textAlign:'center', fontSize:13, color:'#5a7087' }}>Already have an account?{' '}<Link to="/login" style={{ color:'#0082c6', fontWeight:800, textDecoration:'none' }}>Sign in</Link></p>
        <div className="k-powered"><span className="k-powered-label">Powered by</span><div style={{ width:4, height:4, borderRadius:'50%', background:'#05b7aa' }} /><span className="k-powered-brand">Aekam Inc</span></div>
      </div>
    </div>
  );
}
