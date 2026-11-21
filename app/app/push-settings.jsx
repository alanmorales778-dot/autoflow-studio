'use client';

import { useEffect, useState } from 'react';
import { currentSubscription, enablePush, disablePush, pushSupported, isIOS, isStandalone } from './push-client';
import { sendTestPush, savePushPrefs } from './notif-actions';

const KINDS = [
  ['nuevo', 'Pedido nuevo', 'Cuando alguien pide o reserva desde tu link o WhatsApp.'],
  ['pagado', 'Seña cobrada', 'Cuando Mercado Pago confirma un pago.'],
  ['vencido', 'Seña vencida', 'Cuando alguien no pagó a tiempo y se liberó el lugar.'],
  ['resumen', 'Resumen de la mañana', 'A las 8: lo que tenés hoy, mañana y quién te debe.'],
];

export default function PushSettings({ vapidKey, prefs, devices, labels }) {
  const [state, setState] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      if (!pushSupported()) { setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'); return; }
      if (Notification.permission === 'denied') { setState('denied'); return; }
      setState((await currentSubscription()) ? 'on' : 'off');
    })();
  }, []);

  async function on() {
    setBusy(true); setMsg('');
    const r = await enablePush(vapidKey);
    setBusy(false);
    setState(r === 'ok' ? 'on' : r);
    if (r === 'ok') setMsg('¡Listo! Te mandamos uno de prueba.');
    if (r === 'ok') await sendTestPush();
  }
  async function off() {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setState('off');
    setMsg('Este dispositivo ya no recibe avisos.');
  }
  async function test() {
    setBusy(true);
    const r = await sendTestPush();
    setBusy(false);
    setMsg(r.ok ? 'Enviado: debería llegarte en unos segundos.' : 'No pudimos mandarlo. Desactivá y volvé a activar los avisos.');
  }

  return (
    <div className="push-settings">
      <div className="push-row">
        <div className="push-state">
          <span className={`push-dot ${state === 'on' ? 'on' : ''}`} aria-hidden="true" />
          <div>
            <strong>
              {state === 'on' && 'Avisos activados en este dispositivo'}
              {state === 'off' && 'Este dispositivo no recibe avisos'}
              {state === 'checking' && 'Revisando…'}
              {state === 'denied' && 'Avisos bloqueados en este navegador'}
              {state === 'unsupported' && 'Este navegador no permite avisos'}
              {state === 'ios-install' && 'En iPhone, primero instalá la app'}
              {state === 'error' && 'No se pudo activar'}
            </strong>
            <span className="hint">
              {state === 'ios-install' ? 'En Safari: Compartir ⬆︎ → «Agregar a inicio». Después abrila desde el ícono y volvé acá.'
                : state === 'denied' ? 'Habilitalos en la configuración del sitio (el candado al lado de la dirección).'
                  : `${devices} ${devices === 1 ? 'dispositivo recibe' : 'dispositivos reciben'} avisos de este negocio.`}
            </span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {(state === 'off' || state === 'error') && <button type="button" className="btn small" onClick={on} disabled={busy}>{busy ? 'Activando…' : 'Activar avisos'}</button>}
          {state === 'on' && <button type="button" className="btn secondary small" onClick={test} disabled={busy}>Mandar uno de prueba</button>}
          {state === 'on' && <button type="button" className="btn secondary small" onClick={off} disabled={busy}>Desactivar</button>}
        </div>
      </div>
      {msg && <p className="hint" role="status" style={{ marginTop: 8 }}>{msg}</p>}
      <form action={savePushPrefs} className="push-prefs" onChange={(e) => e.currentTarget.requestSubmit()}>
        {KINDS.map(([k, label, hint]) => (
          <label key={k} className="switch-row">
            <span>
              <strong>{k === 'nuevo' ? `${labels.orderCap} nuevo` : label}</strong>
              <span className="hint">{hint}</span>
            </span>
            <input type="checkbox" name={k} defaultChecked={prefs[k] !== false} className="switch" />
          </label>
        ))}
      </form>
    </div>
  );
}
