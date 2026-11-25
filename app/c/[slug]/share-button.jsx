'use client';

import { useState } from 'react';

// Compartir el link del negocio: hoja nativa del celular o, si no hay, copiar.
export default function ShareButton({ title }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.href.split('?')[0];
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* canceló */ }
    }
    try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* sin permiso */ }
  }
  return (
    <button type="button" className="sh-btn" onClick={share} aria-label="Compartir este link">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="m16 6-4-4-4 4" /><path d="M12 2v13" /></svg>
      <span>{done ? 'Link copiado' : 'Compartir'}</span>
    </button>
  );
}
