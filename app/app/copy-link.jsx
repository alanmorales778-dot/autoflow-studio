'use client';

import { useState } from 'react';

// Botón chico que copia un enlace (ej. el link de pedidos) y confirma con «¡Copiado!».
export default function CopyLink({ value, label = 'Copiar link', className = 'btn secondary small' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiá tu link:', value);
    }
  }
  return (
    <button type="button" className={className} onClick={copy} title={value}>
      {copied ? '¡Copiado!' : label}
    </button>
  );
}
