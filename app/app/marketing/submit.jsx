'use client';

import { useFormStatus } from 'react-dom';

// Botón que avisa mientras la IA trabaja (puede tardar 10 a 40 segundos).
export default function Submit({ children, pending = 'Trabajando…', className = 'btn', name, value }) {
  const { pending: busy } = useFormStatus();
  return (
    <button className={className} disabled={busy} aria-busy={busy} name={name} value={value}>
      {busy ? pending : children}
    </button>
  );
}
