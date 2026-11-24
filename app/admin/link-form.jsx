'use client';

import { useActionState, useState } from 'react';

// Formulario que llama a una acción del servidor y muestra el link que devuelve,
// con botones para copiarlo o mandarlo por WhatsApp / mail.
export default function LinkForm({ action, hidden = {}, label, className = 'btn secondary small', children, shareText }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);
  const text = state?.url ? `${shareText || 'Tu acceso a HakkiraApp'}: ${state.url}` : '';
  return (
    <div>
      <form action={formAction} className="row" style={{ gap: 8 }}>
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v ?? ''} />)}
        {children}
        <button className={className} disabled={pending}>{pending ? 'Generando…' : label}</button>
      </form>
      {state?.error && <div className="alert bad" style={{ marginTop: 10 }}>{state.error}</div>}
      {state?.url && (
        <div className="adm-link-box">
          <code>{state.url}</code>
          <button type="button" className="btn small" onClick={() => { navigator.clipboard?.writeText(state.url); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? 'Copiado ✓' : 'Copiar'}</button>
          <a className="btn secondary small" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          {state.email && <a className="btn secondary small" href={`mailto:${state.email}?subject=${encodeURIComponent('Tu acceso a HakkiraApp')}&body=${encodeURIComponent(text)}`}>Mail</a>}
          {state.note && <div className="muted" style={{ fontSize: 12, flexBasis: '100%' }}>{state.note}</div>}
        </div>
      )}
    </div>
  );
}
