'use client';

import { useActionState, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { sendFeedback } from './feedback-actions';

const KINDS = [['idea', 'Idea'], ['error', 'Algo no anda'], ['elogio', 'Me gustó'], ['otro', 'Otro']];

// Botón «Comentar» para negocios piloto y cuentas de prueba.
export default function Feedback() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('idea');
  const [rating, setRating] = useState(0);
  const [thanks, setThanks] = useState(false);
  const [state, action, pending] = useActionState(sendFeedback, null);

  useEffect(() => {
    if (state?.ok) {
      setRating(0);
      setThanks(true);
      const t = setTimeout(() => setOpen(false), 1800);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <button type="button" className="fb-fab" onClick={() => { setThanks(false); setOpen((o) => !o); }} aria-expanded={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        Comentar
      </button>
      {open && (
        <div className="fb-panel" role="dialog" aria-label="Enviar un comentario">
          {thanks ? (
            <p style={{ margin: 0 }}><strong>¡Gracias!</strong> Lo lee el equipo de HakkiraApp.</p>
          ) : (
            <form action={action} key={state?.at || 'f'}>
              <strong style={{ display: 'block', marginBottom: 8 }}>¿Qué nos querés contar?</strong>
              <div className="fb-kinds" role="radiogroup" aria-label="Tipo">
                {KINDS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
              </div>
              <div className="fb-stars" aria-label="¿Qué tan útil te resulta HakkiraApp?">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= rating ? 'on' : ''} onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} de 5`}>★</button>)}
              </div>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="rating" value={rating || ''} />
              <input type="hidden" name="page" value={path} />
              <textarea name="message" rows={4} required minLength={3} maxLength={2000} placeholder={kind === 'error' ? 'Qué estabas haciendo y qué pasó' : 'Escribí acá…'} />
              {state?.error && <div className="alert bad" style={{ marginTop: 8 }}>{state.error}</div>}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
                <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>Cerrar</button>
                <button className="btn small" disabled={pending}>{pending ? 'Enviando…' : 'Enviar'}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
