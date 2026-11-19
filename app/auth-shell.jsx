'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from './logo';

export function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Logo mark="#C2410C" />
        <div style={{ maxWidth: 460 }}>
          <h2 className="disp">Tu negocio, ordenado antes de empezar el día.</h2>
          <ul>
            <li>Pedidos y turnos con seña cobrada, ordenados por día</li>
            <li>Cupos que cierran la fecha cuando no das abasto</li>
            <li>Precios que se recalculan cuando sube lo que comprás</li>
          </ul>
        </div>
        <p className="foot">14 días gratis con todos los módulos. Sin tarjeta.</p>
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
