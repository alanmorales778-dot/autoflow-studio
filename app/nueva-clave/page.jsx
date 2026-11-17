'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { AuthShell, PasswordInput, StrengthMeter } from '../auth-shell';

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
    <AuthShell>
      <h1 className="disp">Nueva contraseña</h1>
      {checking ? (
        <p className="sub">Cargando…</p>
      ) : !email ? (
        <>
          <div className="alert bad" style={{ marginTop: 16 }}>El enlace venció o ya se usó. Pedí uno nuevo desde «Olvidé mi contraseña».</div>
          <Link href="/login" className="btn block">Ir a ingresar</Link>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <p className="sub">Cuenta: <strong>{email}</strong></p>
          <div className="field">
            <label htmlFor="password">Contraseña nueva</label>
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Al menos 8 caracteres" />
            <StrengthMeter value={password} />
          </div>
          <div className="field">
            <label htmlFor="repeat">Repetila</label>
            <PasswordInput id="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" invalid={repeat.length > 0 && repeat !== password} />
            {repeat.length > 0 && repeat !== password && <div className="hint err">Todavía no coinciden.</div>}
          </div>
          {error && <div className="alert bad" role="alert">{error}</div>}
          <button className="btn block large" disabled={loading}>{loading && <span className="spin" aria-hidden="true" />}{loading ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      )}
    </AuthShell>
  );
}
