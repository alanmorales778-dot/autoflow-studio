'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { LogoMark } from '../../logo';
import { PasswordInput } from '../../auth-shell';
import { amIAdmin } from '../actions';

// Entrada propia del panel de administración: no comparte pantalla ni navegación con la app de los clientes.
export default function AdminLogin() {
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Completá email y contraseña.');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setLoading(false);
      return setError(/invalid/i.test(err.message) ? 'Email o contraseña incorrectos.' : err.message);
    }
    const r = await amIAdmin();
    if (!r?.ok) {
      setLoading(false);
      await supabase.auth.signOut();
      return setError(r?.reason || 'Esta cuenta no tiene acceso al panel de administración.');
    }
    window.location.href = '/admin';
  }

  return (
    <div className="adm-login">
      <div>
        <div className="adm-login-box fade-in">
          <div className="adm-login-head">
            <LogoMark color="#C2410C" />
            <strong style={{ fontSize: 18 }}>AutoFlow</strong>
            <span className="tag">Admin</span>
          </div>
          <h1 className="disp" style={{ fontSize: 24 }}>Panel de administración</h1>
          <p className="muted" style={{ marginBottom: 18 }}>Acceso solo para el equipo de AutoFlow.</p>
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="vos@ejemplo.com" />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Tu contraseña" />
            </div>
            {error && <div className="alert bad" role="alert">{error}</div>}
            <button className="btn dark block large" disabled={loading}>{loading && <span className="spin" aria-hidden="true" />}{loading ? 'Entrando…' : 'Entrar al panel'}</button>
          </form>
        </div>
        <p className="foot">¿Olvidaste la contraseña? Cambiala desde el ingreso de la app y volvé acá.</p>
      </div>
    </div>
  );
}
