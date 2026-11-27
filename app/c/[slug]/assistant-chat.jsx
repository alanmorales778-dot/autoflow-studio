'use client';

import { useEffect, useRef, useState } from 'react';

const fmt = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const KEY = (slug) => `hk-asst:${slug}`;

function readStore(slug) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(slug)) || 'null');
    return v && v.c && v.t ? v : null;
  } catch {
    return null;
  }
}
function writeStore(slug, v) {
  try {
    if (v) localStorage.setItem(KEY(slug), JSON.stringify(v));
    else localStorage.removeItem(KEY(slug));
  } catch {}
}

// Chat del Asistente IA. En el catálogo es un botón flotante que abre el panel;
// en la app (inline + test) es la ventana «Probá tu asistente».
export default function AssistantChat({ slug, botName, bizName, logoUrl, greeting, starters = [], wa, test = false, inline = false, lift = false }) {
  const [open, setOpen] = useState(inline);
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [askContact, setAskContact] = useState(false);
  const [contactDone, setContactDone] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const loaded = useRef(false);

  // Retomar la charla guardada en este navegador (no en la prueba).
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    if (test) return;
    const s = readStore(slug);
    if (!s) return;
    fetch(`/api/asistente/${encodeURIComponent(slug)}?c=${s.c}&t=${encodeURIComponent(s.t)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) { writeStore(slug, null); return; }
        setConv(s);
        setMsgs(d.messages || []);
        setContactDone(!!d.contact);
      })
      .catch(() => {});
  }, [open, slug, test]);

  // Mientras el chat está abierto, buscar respuestas nuevas (por ejemplo, si contestó el dueño).
  useEffect(() => {
    if (!open || !conv) return undefined;
    const id = setInterval(() => {
      if (document.hidden || busy) return;
      const last = [...msgs].reverse().find((m) => m.at)?.at;
      fetch(`/api/asistente/${encodeURIComponent(slug)}?c=${conv.c}&t=${encodeURIComponent(conv.t)}${last ? `&after=${encodeURIComponent(last)}` : ''}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.messages?.length) return;
          setMsgs((cur) => [...cur, ...d.messages.filter((m) => !cur.some((x) => x.id === m.id))]);
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [open, conv, msgs, busy, slug]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, askContact, open]);

  useEffect(() => {
    if (open && !inline) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, inline]);

  async function send(raw) {
    const t = String(raw ?? text).trim().slice(0, 600);
    if (!t || busy) return;
    setErr('');
    setText('');
    const temp = { id: `tmp-${Date.now()}`, role: 'cliente', text: t, products: [], suggestions: [] };
    setMsgs((cur) => [...cur, temp]);
    setBusy(true);
    try {
      const r = await fetch(`/api/asistente/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ c: conv?.c, t: conv?.t, text: t, test }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) {
        setMsgs((cur) => cur.filter((m) => m.id !== temp.id));
        setText(t);
        setErr(r.status === 429 ? 'Esperá un segundo y volvé a mandar.' : r.status === 403 ? 'El asistente está apagado en este momento.' : 'No se pudo enviar. Probá de nuevo.');
        return;
      }
      if (d.c && d.t && (!conv || conv.c !== d.c)) {
        const s = { c: d.c, t: d.t };
        setConv(s);
        if (!test) writeStore(slug, s);
      }
      setMsgs((cur) => [...cur.filter((m) => m.id !== temp.id), ...(d.messages || []).filter((m) => !cur.some((x) => x.id === m.id))]);
      if (d.askContact && !contactDone) setAskContact(true);
    } catch {
      setMsgs((cur) => cur.filter((m) => m.id !== temp.id));
      setText(t);
      setErr('Sin conexión. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function sendContact(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch(`/api/asistente/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ c: conv?.c, t: conv?.t, test, contact: { name: fd.get('name'), phone: fd.get('phone') } }),
    }).catch(() => null);
    if (r?.ok) {
      setAskContact(false);
      setContactDone(true);
      setMsgs((cur) => [...cur, { id: `ok-${Date.now()}`, role: 'ia', text: `¡Listo! ${bizName} te va a escribir a ese WhatsApp. También podés seguir por acá.`, products: [], suggestions: [] }]);
    } else {
      setErr('Revisá el número de WhatsApp.');
    }
  }

  function restart() {
    writeStore(slug, null);
    setConv(null);
    setMsgs([]);
    setAskContact(false);
    setContactDone(false);
    setErr('');
  }

  const lastAi = [...msgs].reverse().find((m) => m.role !== 'cliente');
  const chips = !msgs.length ? starters : (lastAi && msgs[msgs.length - 1] === lastAi ? lastAi.suggestions || [] : []);
  const productHref = (id) => `/c/${slug}?p=${id}`;

  const panel = (
    <div className={`asst-panel ${inline ? 'inline' : ''}`} role={inline ? undefined : 'dialog'} aria-label={`Chat con ${botName}`}>
      <div className="asst-head">
        <span className="asst-ava" aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" /> : (bizName || '?').trim().charAt(0).toUpperCase()}</span>
        <div className="asst-who">
          <b>{botName}{test ? ' · prueba' : ''}</b>
          <small><span className="asst-dot" aria-hidden="true" />Asistente con IA de {bizName}</small>
        </div>
        <div className="asst-head-actions">
          {msgs.length > 0 && <button type="button" className="asst-icon" onClick={restart} title="Empezar de nuevo" aria-label="Empezar una charla nueva">↺</button>}
          {!inline && <button type="button" className="asst-icon" onClick={() => setOpen(false)} aria-label="Cerrar el chat">✕</button>}
        </div>
      </div>
      <div className="asst-list" ref={listRef} aria-live="polite">
        <div className="asst-msg ia"><p>{greeting}</p></div>
        {msgs.map((m) => (
          <div key={m.id} className={`asst-msg ${m.role}`}>
            {m.role === 'dueno' && <span className="asst-from">{bizName}</span>}
            <p>{m.text}</p>
            {m.products?.length > 0 && (
              <div className="asst-cards">
                {m.products.map((p) => (
                  <a key={p.id} className="asst-card" href={productHref(p.id)} {...(test ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    <span className="asst-card-img">{p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <span aria-hidden="true">{p.name.charAt(0)}</span>}</span>
                    <span className="asst-card-txt"><b>{p.name}</b><span className="num">{fmt(p.price)}</span>{p.left === 0 && <span className="bad">Sin lugar</span>}</span>
                    <span className="asst-card-go" aria-hidden="true">›</span>
                  </a>
                ))}
              </div>
            )}
            {m.handoff && m.role === 'ia' && wa && <a className="asst-wa" href={wa} target="_blank" rel="noreferrer">Escribir por WhatsApp</a>}
          </div>
        ))}
        {busy && <div className="asst-msg ia typing" aria-label={`${botName} está escribiendo`}><span /><span /><span /></div>}
        {askContact && !contactDone && (
          <form className="asst-contact" onSubmit={sendContact}>
            <p>¿Querés que {bizName} te escriba? Dejá tu WhatsApp:</p>
            <input name="name" placeholder="Tu nombre" maxLength={80} autoComplete="name" />
            <input name="phone" placeholder="Tu WhatsApp" required inputMode="tel" maxLength={40} autoComplete="tel" />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn small">Enviar</button>
              <button type="button" className="btn secondary small" onClick={() => setAskContact(false)}>Ahora no</button>
            </div>
          </form>
        )}
      </div>
      {chips.length > 0 && !busy && (
        <div className="asst-chips">
          {chips.map((c) => <button key={c} type="button" onClick={() => send(c)}>{c}</button>)}
        </div>
      )}
      {err && <div className="asst-err" role="alert">{err}</div>}
      <form className="asst-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escribí tu pregunta…"
          rows={1}
          maxLength={600}
          aria-label="Tu mensaje"
        />
        <button className="asst-send" disabled={busy || !text.trim()} aria-label="Enviar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </form>
      <div className="asst-foot">Responde una IA con los datos del negocio. Puede equivocarse.{!test && <> {wa ? <a href={wa} target="_blank" rel="noreferrer">Hablar con una persona</a> : <button type="button" onClick={() => send('Quiero hablar con una persona')}>Hablar con una persona</button>}</>}</div>
    </div>
  );

  if (inline) return panel;
  return (
    <>
      {open && panel}
      {!open && (
        <button type="button" className={`asst-fab ${lift ? 'lift' : ''}`} onClick={() => setOpen(true)} aria-label={`Abrir el chat con ${botName}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></svg>
          <span>Preguntá</span>
        </button>
      )}
    </>
  );
}
