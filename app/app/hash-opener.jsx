'use client';

import { useEffect } from 'react';

// Si la dirección trae #algo y ese bloque está plegado (<details>), lo abre y lo muestra.
export default function HashOpener() {
  useEffect(() => {
    function open() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      const d = el && (el.tagName === 'DETAILS' ? el : el.closest('details'));
      if (d && !d.open) {
        d.open = true;
        el.scrollIntoView({ block: 'start' });
      }
    }
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
