'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { publicRubros } from '@/lib/rubros';
import { AuthShell, AuthTabs, PasswordInput, StrengthMeter, validEmail } from '../auth-shell';

const RUBROS = publicRubros();

export default function Registro() {
  const [rubro, setRubro] = useState('cocina');
  const [pilot, setPilot] = useState('');
  const [ref, setRef] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('rubro');
    if (q && RUBROS.some((r) => r.key === q)) setRubro(q);
    const pc = String(params.get('piloto') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (pc.length >= 4) setPilot(pc);
    // Link de recomendación de otro negocio (/registro?ref=CÓDIGO)
    const rc = String(params.get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (rc.length >= 4) setRef(rc);
  }, []);
  const ph = (RUBROS.find((r) => r.key === rubro) || RUBROS[0]).bizPh;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [business, setBusiness] = useState('');
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));

  const bizErr = touched.biz && business.trim().length < 2;
  const emailErr = touched.email && !validEmail(email);
  const pwErr = touched.pw && password.length < 8;
  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (business.trim().length < 2 || !validEmail(email) || password.length < 8) {
      setTouched({ biz: true, email: true, pw: true });
      setShake((s) => s + 1);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { business_name: business.trim(), business_type: rubro, ...(pilot ? { pilot_code: pilot } : {}), ...(ref ? { ref_code: ref } : {}) } },
    });
    setLoading(false);
    if (error) {
      setShake((s) => s + 1);
      const m = error.message || '';
      if (/already/i.test(m)) return setError('Ese email ya tiene cuenta. Ingresá desde «Ingresar».');
      if (/pwned|leaked|compromised/i.test(m)) return setError('Esa contraseña apareció en filtraciones de datos. Elegí otra.');
      return setError(m);
    }
    if (data.session) window.location.href = '/app';
    else setDone(true);
  }

  return (
    <AuthShell>
      {done ? (
        <div className="fade-in">
          <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ok-soft)', display: 'grid', placeItems: 'center', marginBottom: 20 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
          </span>
          <h1 className="disp">Revisá tu email</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 16 }}>Te mandamos un enlace a <strong>{email.trim()}</strong> para confirmar la cuenta. Al tocarlo entrás directo a tu panel.</p>
          <p className="muted">Si no lo ves, buscá en Spam o Promociones.</p>
          <Link href="/login" className="btn secondary block" style={{ marginTop: 20 }}>Volver a ingresar</Link>
        </div>
      ) : (
        <>
          <h1 className="disp">Probá 14 días gratis</h1>
          <p className="sub">Todos los módulos incluidos. Sin tarjeta.</p>
          {ref && !pilot && <div className="alert info" style={{ marginBottom: 12 }}>Te recomendó otro negocio: tenés <strong>14 días extra</strong> de prueba (28 en total).</div>}
          {pilot && <div className="alert info" style={{ marginBottom: 12 }}>Invitación piloto <strong className="mono">{pilot}</strong>: los días extra se activan al crear tu negocio.</div>}
          <AuthTabs active="registro" />
          <form key={shake} className={shake ? 'shake' : ''} onSubmit={onSubmit} noValidate>
            <fieldset className="field rubro-pick">
              <legend>¿Qué vendés?</legend>
              <div className="rubro-opts" role="radiogroup" aria-label="Rubro">
                {RUBROS.map((r) => (
                  <button key={r.key} type="button" role="radio" aria-checked={rubro === r.key} className={`rubro-opt ${rubro === r.key ? 'on' : ''}`} onClick={() => setRubro(r.key)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={r.icon} /></svg>
                    <span className="rubro-opt-t">{r.short || r.label}</span>
                  </button>
                ))}
              </div>
              <div className="hint">{(RUBROS.find((r) => r.key === rubro) || RUBROS[0]).ejemplos}. Lo podés cambiar después.</div>
            </fieldset>
            <div className="field">
              <label htmlFor="business">Nombre de tu emprendimiento</label>
              <input id="business" value={business} onChange={(e) => setBusiness(e.target.value)} onBlur={touch('biz')} placeholder={ph} autoComplete="organization" className={bizErr ? 'err' : ''} aria-invalid={bizErr || undefined} />
              <div className={`hint ${bizErr ? 'err' : ''}`}>{bizErr ? 'Poné el nombre con el que te conocen.' : 'Va a aparecer en tu link de pedidos.'}</div>
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={touch('email')} autoComplete="email" placeholder="vos@ejemplo.com" className={emailErr ? 'err' : ''} aria-invalid={emailErr || undefined} />
              {emailErr && <div className="hint err">{email ? 'Revisá el email: falta algo.' : 'Escribí tu email.'}</div>}
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={touch('pw')} autoComplete="new-password" placeholder="Creá una contraseña" invalid={pwErr} />
              {pwErr ? <div className="hint err">Usá al menos 8 caracteres.</div> : <StrengthMeter value={password} />}
            </div>
            {error && <div className="alert bad" role="alert">{error}</div>}
            <button className="btn block large" disabled={loading}>{loading && <span className="spin" aria-hidden="true" />}{loading ? 'Creando tu cuenta…' : 'Crear cuenta gratis'}</button>
          </form>
          <p className="muted" style={{ marginTop: 16, fontSize: 13, textAlign: 'center' }}>Al crear la cuenta aceptás los <Link href="/legal">términos y la política de privacidad</Link>.</p>
        </>
      )}
    </AuthShell>
  );
}
