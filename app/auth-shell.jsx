'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from './logo';

const NOTIS = [
  { t: 'Nuevo pedido', b: 'Torta Rogel para el sábado · $ 38.000', h: 'ahora' },
  { t: 'Seña cobrada', b: 'Martina pagó $ 19.000 por Mercado Pago', h: '2 min' },
  { t: 'Mañana', b: '3 entregas y $ 57.000 para cobrar', h: '8:00' },
];

export function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Link href="/" aria-label="Volver al inicio"><Logo mark="#C2410C" /></Link>
        <div className="auth-pitch">
          <h2 className="disp">Tu día, ordenado antes de empezar.</h2>
          <p>Pedidos, señas, compras y ganancias en un solo lugar. Te avisa al celular cuando pasa algo.</p>
          <ul className="auth-notis" aria-label="Ejemplos de avisos">
            {NOTIS.map((n, i) => (
              <li key={n.t} style={{ '--d': `${0.2 + i * 0.22}s` }}>
                <span className="an-ico" aria-hidden="true" />
                <div><b>{n.t}</b><span>{n.b}</span></div>
                <em>{n.h}</em>
              </li>
            ))}
          </ul>
        </div>
        <p className="foot">14 días gratis con todo incluido · Sin tarjeta · Sin comisión por venta</p>
      </aside>
      <main className="auth-main">
        <div className="auth-box">{children}</div>
      </main>
    </div>
  );
}

export function AuthTabs({ active }) {
  return (
    <nav className="tabs" aria-label="Ingresar o crear cuenta">
      <Link href="/login" className={active === 'login' ? 'on' : ''} aria-current={active === 'login' ? 'page' : undefined}>Ingresar</Link>
      <Link href="/registro" className={active === 'registro' ? 'on' : ''} aria-current={active === 'registro' ? 'page' : undefined}>Crear cuenta</Link>
    </nav>
  );
}

export function PasswordInput({ id, value, onChange, onBlur, autoComplete, placeholder, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} onBlur={onBlur} autoComplete={autoComplete} placeholder={placeholder} className={invalid ? 'err' : ''} aria-invalid={invalid || undefined} />
      <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  );
}

export function strength(v) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (v.length >= 12 || /[^A-Za-z0-9]/.test(v)) s++;
  return Math.max(1, s);
}

export function StrengthMeter({ value }) {
  const s = strength(value);
  const words = ['', 'Débil', 'Aceptable', 'Buena', 'Muy segura'];
  return (
    <>
      <div className={`meter s${s}`} aria-hidden="true"><i /><i /><i /><i /></div>
      <div className={`hint ${s >= 3 ? 'ok' : ''}`}>{value ? `Seguridad: ${words[s]}` : 'Mínimo 8 caracteres. Sumá números y mayúsculas.'}</div>
    </>
  );
}

export const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

// «Continuar con Google» (Supabase Auth). Antes de ir a Google revisa que el proveedor esté
// activado en Supabase; si no, avisa en vez de mandar a una página de error.
// extra: datos del registro (rubro, piloto, referido) que se guardan en una cookie corta y
// el callback copia a la cuenta nueva.
export function GoogleButton({ extra = null, label = 'Continuar con Google' }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function go() {
    setMsg('');
    setBusy(true);
    try {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const settings = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json()).catch(() => null);
      if (settings && !settings.external?.google) {
        setMsg('El ingreso con Google todavía no está activado. Usá tu email por ahora.');
        setBusy(false);
        return;
      }
      if (extra) document.cookie = `hk_signup=${encodeURIComponent(JSON.stringify(extra))}; path=/; max-age=1800; samesite=lax; secure`;
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(base, key);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/app`, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
    } catch {
      setMsg('No pudimos abrir Google. Probá de nuevo o usá tu email.');
      setBusy(false);
    }
  }
  return (
    <div className="google-wrap">
      <button type="button" className="btn-google" onClick={go} disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
        {busy ? 'Abriendo Google…' : label}
      </button>
      {msg && <p className="hint" role="status" style={{ textAlign: 'center' }}>{msg}</p>}
      <div className="or-sep"><span>o con tu email</span></div>
    </div>
  );
}
