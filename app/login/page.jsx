'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message === 'Email not confirmed' ? 'Todavía no confirmaste tu email. Revisá tu casilla.' : error.message);
      return;
    }
    window.location.href = '/app';
  }

  async function resetPassword() {
    setError('');
    if (!email) return setError('Escribí tu email arriba y volvé a tocar «Olvidé mi contraseña».');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/app/configuracion` });
    if (error) setError(error.message);
    else setInfo('Te mandamos un email para entrar y cambiar la contraseña.');
  }

  return (
    <main className="narrow">
      <Link href="/" className="logo">AutoFlow <span>Cocina</span></Link>
      <div className="card" style={{ marginTop: 20 }}>
        <h1>Ingresar</h1>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <div className="alert bad">{error}</div>}
          {info && <div className="alert ok">{info}</div>}
          <button className="btn block" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
        <p style={{ marginTop: 12 }}>
          <button type="button" onClick={resetPassword} className="btn secondary small">Olvidé mi contraseña</button>
        </p>
        <p className="muted">¿No tenés cuenta? <Link href="/registro">Probá gratis 14 días</Link></p>
      </div>
    </main>
  );
}
