'use client';

import { useState } from 'react';

export default function Copy({ value, label = 'Copiar link' }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn secondary small" onClick={() => { navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1600); }}>
      {ok ? 'Copiado ✓' : label}
    </button>
  );
}
