'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { AuthShell, AuthTabs, PasswordInput, validEmail, GoogleButton } from '../auth-shell';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'link') {
      setError('El enlace venció o ya se usó. Pedí uno nuevo con «Olvidé mi contraseña».');
    }
  }, []);

  const emailErr = touched.email && !validEmail(email);
  const pwErr = touched.pw && !password;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!validEmail(email) || !password) {
      setTouched({ email: true, pw: true });
      setShake((s) => s + 1);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setShake((s) => s + 1);
      setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message === 'Email not confirmed' ? 'Todavía no confirmaste tu email. Revisá tu casilla.' : error.message);
      return;
    }
    window.location.href = '/app';
  }

  async function resetPassword() {
    setError('');
    setInfo('');
    if (!validEmail(email)) {
      setTouched((t) => ({ ...t, email: true }));
      return setError('Escribí tu email arriba y volvé a tocar «Olvidé mi contraseña».');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/nueva-clave` });
    if (error) setError(error.message);
    else setInfo(`Te mandamos un mail a ${email.trim()} con un enlace para elegir una contraseña nueva. Si no lo ves, revisá Spam.`);
  }

  return (
    <AuthShell>
      <h1 className="disp">Hola de nuevo</h1>
      <p className="sub">Entrá para ver los pedidos de hoy.</p>
      <AuthTabs active="login" />
      <GoogleButton />
      <form key={shake} className={shake ? 'shake' : ''} onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} autoComplete="email" placeholder="vos@ejemplo.com" className={emailErr ? 'err' : ''} aria-invalid={emailErr || undefined} />
          {emailErr && <div className="hint err">{email ? 'Revisá el email: falta algo.' : 'Escribí tu email.'}</div>}
        </div>
        <div className="field">
          <div className="row between" style={{ marginBottom: 6 }}>
            <label htmlFor="password" style={{ margin: 0 }}>Contraseña</label>
            <button type="button" onClick={resetPassword} style={{ border: 0, background: 'none', padding: '4px 0', minHeight: 0, font: '600 13px var(--font-sans)', color: 'var(--brand)', cursor: 'pointer' }}>Olvidé mi contraseña</button>
          </div>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, pw: true }))} autoComplete="current-password" placeholder="Tu contraseña" invalid={pwErr} />
          {pwErr && <div className="hint err">Escribí tu contraseña.</div>}
        </div>
        {error && <div className="alert bad" role="alert">{error}</div>}
        {info && <div className="alert info" role="status">{info}</div>}
        <button className="btn block large" disabled={loading}>{loading && <span className="spin" aria-hidden="true" />}{loading ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </AuthShell>
  );
}
