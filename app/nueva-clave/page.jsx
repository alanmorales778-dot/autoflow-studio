'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

// Se llega desde el mail de «Olvidé mi contraseña» (vía /auth/callback, que ya abrió la sesión)
// o desde Configuración → Cambiar contraseña.
export default function NuevaClave() {
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  const [email, setEmail] = useState(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || null);
      setChecking(false);
    });
  }, [supabase]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.');
    if (password !== repeat) return setError('Las dos contraseñas no coinciden.');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const m = error.message || '';
      if (/different from the old/i.test(m)) return setError('Elegí una contraseña distinta a la anterior.');
      if (/pwned|leaked|compromised/i.test(m)) return setError('Esa contraseña apareció en filtraciones de datos. Elegí otra.');
      if (/weak|at least/i.test(m)) return setError('La contraseña es muy débil. Probá con una más larga.');
      return setError(m);
    }
    window.location.href = '/app?ok=' + encodeURIComponent('Contraseña actualizada.');
  }

  return (
    <main className="narrow">
      <Link href="/" className="logo">AutoFlow <span>Cocina</span></Link>
      <div className="card" style={{ marginTop: 20 }}>
        <h1>Nueva contraseña</h1>
        {checking ? (
          <p className="muted">Cargando…</p>
        ) : !email ? (
          <>
            <div className="alert bad">El enlace venció o ya se usó. Pedí uno nuevo desde «Olvidé mi contraseña».</div>
            <Link href="/login" className="btn">Ir a ingresar</Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className="muted">Cuenta: <strong>{email}</strong></p>
            <div className="field">
              <label htmlFor="password">Contraseña nueva</label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
            </div>
            <div className="field">
              <label htmlFor="repeat">Repetila</label>
              <input id="repeat" type="password" required minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
            </div>
            {error && <div className="alert bad">{error}</div>}
            <button className="btn block" disabled={loading}>{loading ? 'Guardando…' : 'Guardar contraseña'}</button>
          </form>
        )}
      </div>
    </main>
  );
}
