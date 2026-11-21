'use client';

import { useEffect, useState } from 'react';

// Aviso de «listo» que aparece abajo y se va solo. Saca ?ok= de la dirección para que no se repita al recargar.
export default function FlashToast({ message }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('ok')) {
        url.searchParams.delete('ok');
        window.history.replaceState(window.history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
      }
    } catch { /* nada */ }
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, [message]);
  if (!show) return null;
  return (
    <div className="toast toast-ok" role="status" onClick={() => setShow(false)}>
      <span className="toast-check" aria-hidden="true">✓</span>
      {message}
    </div>
  );
}
