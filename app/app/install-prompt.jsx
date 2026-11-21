'use client';

import { useEffect, useState } from 'react';
import { registerSW, isStandalone, isIOS } from './push-client';

const KEY = 'af-install-hidden-until';

// Registra la app y, si todavía no está instalada, ofrece agregarla a la pantalla de inicio.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [mode, setMode] = useState(null); // 'android' | 'ios' | null
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    registerSW();
    if (isStandalone()) return undefined;
    let hiddenUntil = 0;
    try { hiddenUntil = Number(localStorage.getItem(KEY) || 0); } catch { /* nada */ }
    if (Date.now() < hiddenUntil) return undefined;
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setMode('android'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)) setMode('ios');
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function hide(days = 14) {
    try { localStorage.setItem(KEY, String(Date.now() + days * 86400000)); } catch { /* nada */ }
    setMode(null);
    setSteps(false);
  }

  async function install() {
    if (mode === 'ios') { setSteps(true); return; }
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    hide(outcome === 'accepted' ? 3650 : 14);
  }

  if (!mode) return null;
  return (
    <>
      <div className="install no-print" role="region" aria-label="Instalar la app">
        <img src="/icon-192.png" alt="" width="40" height="40" />
        <div className="install-txt">
          <strong>Instalá AutoFlow</strong>
          <span>Entrá de un toque y recibí avisos.</span>
        </div>
        <button type="button" className="btn small" onClick={install}>Instalar</button>
        <button type="button" className="install-x" onClick={() => hide()} aria-label="Ahora no">✕</button>
      </div>
      {steps && (
        <div className="sheet-backdrop" onClick={() => setSteps(false)}>
          <div className="sheet" role="dialog" aria-label="Instalar en iPhone" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" aria-hidden="true" />
            <h2>Instalar en iPhone</h2>
            <ol className="ios-steps">
              <li><span className="n">1</span>Tocá el botón <b>Compartir</b> <span className="ios-share" aria-hidden="true">⬆︎</span> abajo en Safari.</li>
              <li><span className="n">2</span>Elegí <b>«Agregar a inicio»</b>.</li>
              <li><span className="n">3</span>Abrí AutoFlow desde el ícono nuevo y activá los avisos con la 🔔.</li>
            </ol>
            <button type="button" className="btn" style={{ width: '100%' }} onClick={() => hide(30)}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}
