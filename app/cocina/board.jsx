'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setPrepared } from './actions';

export default function Board({ items, labels = { note1: 'Dedicatoria', note2: 'Alergias', warn: true } }) {
  const router = useRouter();
  const [done, setDone] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.done])));
  const [, start] = useTransition();

  useEffect(() => { setDone(Object.fromEntries(items.map((i) => [i.id, i.done]))); }, [items]);
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(t);
  }, [router]);

  const count = items.filter((i) => done[i.id]).length;
  const pct = items.length ? Math.round((count / items.length) * 100) : 0;
  const toggle = (id) => {
    const next = !done[id];
    setDone((d) => ({ ...d, [id]: next }));
    start(async () => {
      const r = await setPrepared(id, next);
      if (!r?.ok) setDone((d) => ({ ...d, [id]: !next }));
    });
  };

  return (
    <>
      <div>
        <h1 className="disp" aria-live="polite">{items.length ? `${count} de ${items.length} listos` : 'Nada para preparar'}</h1>
      </div>
      <div className="kbar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <div className="kgrid">
        {items.map((k) => (
          <button key={k.id} type="button" className={`kc ${done[k.id] ? 'done' : ''}`} aria-pressed={!!done[k.id]} onClick={() => toggle(k.id)}>
            <span className="kbox" aria-hidden="true">
              {done[k.id] && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B1F12" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>}
            </span>
            <span style={{ flex: 1 }}>
              <span className="kt">{k.qty} × {k.product}</span>
              <span className="ks">{[k.slot, k.customer, k.mode].filter(Boolean).join(' · ')}</span>
              {k.options && <span className="ks">{k.options}</span>}
              {k.dedication && <span className="kn">{labels.note1}: «{k.dedication}»</span>}
              {k.allergies && <span className={`kn ${labels.warn ? 'allergy' : ''}`}>{labels.warn ? '⚠ ' : ''}{labels.note2}: {k.allergies}</span>}
              {k.notes && <span className="ks">Nota: {k.notes}</span>}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
