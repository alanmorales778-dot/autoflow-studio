'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function Registro() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [business, setBusiness] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { business_name: business } },
    });
    setLoading(false);
    if (error) return setError(error.message.includes('already') ? 'Ese email ya tiene cuenta. Ingresá desde «Ingresar».' : error.message);
    if (data.session) window.location.href = '/app';
    else setDone(true);
  }

  return (
    <main className="narrow">
      <Link href="/" className="logo">AutoFlow <span>Cocina</span></Link>
      <div className="card" style={{ marginTop: 20 }}>
        {done ? (
          <>
            <h1>Revisá tu email</h1>
            <p>Te mandamos un link a <strong>{email}</strong> para confirmar la cuenta. Después de confirmarla entrás directo a tu panel.</p>
            <p className="muted">Si no lo ves, buscá en spam o promociones.</p>
          </>
        ) : (
          <>
            <h1>Probá gratis 14 días</h1>
            <p className="muted">Todos los módulos incluidos. Sin tarjeta.</p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="business">Nombre de tu emprendimiento</label>
                <input id="business" required value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ej: Dulce Lola Pastelería" />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="password">Contraseña (mínimo 8 caracteres)</label>
                <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {error && <div className="alert bad">{error}</div>}
              <button className="btn block" disabled={loading}>{loading ? 'Creando cuenta…' : 'Crear cuenta'}</button>
            </form>
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Al crear la cuenta aceptás los <Link href="/legal">términos y la política de privacidad</Link>.</p>
            <p className="muted">¿Ya tenés cuenta? <Link href="/login">Ingresar</Link></p>
          </>
        )}
      </div>
    </main>
  );
}
