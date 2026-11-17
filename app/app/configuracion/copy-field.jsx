'use client';

import { useState } from 'react';

export default function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="row" style={{ gap: 8 }}>
      <input readOnly value={value} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 240, fontSize: 13 }} />
      <button type="button" className="btn" onClick={copy}>{copied ? '¡Copiado!' : 'Copiar enlace'}</button>
    </div>
  );
}
