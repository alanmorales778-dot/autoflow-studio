'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchNotifications, markNotificationsRead } from './notif-actions';
import { currentSubscription, enablePush, pushSupported, isIOS, isStandalone } from './push-client';

const ICONS = {
  nuevo: { cls: 'k-nuevo', d: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  pagado: { cls: 'k-pagado', d: 'M20 6 9 17l-5-5' },
  vencido: { cls: 'k-vencido', d: 'M12 7v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z' },
  resumen: { cls: 'k-resumen', d: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  sistema: { cls: 'k-sistema', d: 'M12 8v4M12 16h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z' },
};

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export default function Bell({ initial, vapidKey }) {
  const router = useRouter();
  const [items, setItems] = useState(initial || []);
  const [open, setOpen] = useState(false);
  const [push, setPush] = useState('checking'); // checking | on | off | unsupported | ios-install | denied
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);
  const unread = items.filter((n) => !n.read_at).length;

  const refresh = useCallback(async () => {
    try { setItems(await fetchNotifications()); } catch { /* sin conexión: queda lo que había */ }
  }, []);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  useEffect(() => {
    (async () => {
      if (!pushSupported()) { setPush(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'); return; }
      if (Notification.permission === 'denied') { setPush('denied'); return; }
      setPush((await currentSubscription()) ? 'on' : 'off');
    })();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      refresh();
      if (unread) {
        markNotificationsRead([]);
        // se ven como «nuevas» mientras el panel está abierto; al cerrarlo quedan leídas
        setTimeout(() => setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString(), _fresh: true }))), 50);
      }
    }
  }

  async function activate() {
    setBusy(true);
    const r = await enablePush(vapidKey);
    setBusy(false);
    setPush(r === 'ok' ? 'on' : r);
  }

  function go(n) {
    setOpen(false);
    router.push(n.url || '/app');
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button type="button" className={`bell ${open ? 'on' : ''}`} onClick={toggle} aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'} aria-expanded={open}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notificaciones">
          <div className="bell-head">
            <strong>Notificaciones</strong>
            <button type="button" className="bell-x" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
          </div>
          {push === 'off' && (
            <div className="bell-cta">
              <div>
                <strong>Recibilos en tu celular</strong>
                <span>Te avisamos al instante cuando entra un pedido o te pagan.</span>
              </div>
              <button type="button" className="btn small" onClick={activate} disabled={busy}>{busy ? 'Activando…' : 'Activar'}</button>
            </div>
          )}
          {push === 'ios-install' && (
            <div className="bell-cta">
              <div>
                <strong>En iPhone, primero instalá la app</strong>
                <span>Tocá Compartir <b>⬆︎</b> y después «Agregar a inicio». Abrila desde el ícono y activá los avisos.</span>
              </div>
            </div>
          )}
          {push === 'denied' && (
            <div className="bell-cta warn">
              <div>
                <strong>Los avisos están bloqueados</strong>
                <span>Habilitalos para este sitio desde la configuración del navegador.</span>
              </div>
            </div>
          )}
          <div className="bell-list">
            {items.length === 0 ? (
              <div className="bell-empty">
                <div className="bell-empty-ico" aria-hidden="true">🔔</div>
                <strong>Todo tranquilo por acá</strong>
                <span>Cuando entre un pedido, te paguen una seña o se venza una, aparece acá.</span>
              </div>
            ) : (
              items.map((n) => {
                const ic = ICONS[n.kind] || ICONS.sistema;
                return (
                  <button type="button" key={n.id} className={`bell-item ${!n.read_at || n._fresh ? 'unread' : ''}`} onClick={() => go(n)}>
                    <span className={`bell-ico ${ic.cls}`} aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={ic.d} /></svg>
                    </span>
                    <span className="bell-txt">
                      <span className="bell-title">{n.title}</span>
                      {n.body && <span className="bell-body">{n.body}</span>}
                      <span className="bell-time">{ago(n.created_at)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="bell-foot">
            {push === 'on' ? <span>✓ Avisos activados en este dispositivo</span> : <span />}
            <a href="/app/configuracion#avisos">Elegir qué avisos</a>
          </div>
        </div>
      )}
    </div>
  );
}
