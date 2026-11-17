'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const KIND = {
  pedido: ['Pedido', '#fdba74'],
  pago: ['Pago', '#86efac'],
  cupo: ['Cupo', '#93c5fd'],
  cocina: ['Cocina', '#f9a8d4'],
  costo: ['Costos', '#fcd34d'],
  sistema: ['Sistema', '#c4b5a8'],
};
const FILTERS = [['todo', 'Todo'], ['pedido', 'Pedidos'], ['pago', 'Pagos'], ['cupo', 'Cupos'], ['cocina', 'Cocina'], ['costo', 'Costos'], ['sistema', 'Sistema']];
const fmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Feed({ events }) {
  const router = useRouter();
  const [filter, setFilter] = useState('todo');
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);
  const shown = events.filter((e) => filter === 'todo' || e.kind === filter);

  return (
    <>
      <div className="row" role="group" aria-label="Filtrar" style={{ gap: 8, marginBottom: 14 }}>
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" className={`chip ${filter === id ? 'on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      <div className="log">
        <div className="log-head"><span className="live" aria-hidden="true" />en vivo · se actualiza cada 30 s · {shown.length} eventos</div>
        {shown.length === 0 ? (
          <div className="log-row"><span className="m" style={{ gridColumn: '1 / -1', color: '#bfae9f' }}>Sin movimientos todavía. Cuando entren pedidos y pagos los vas a ver acá.</span></div>
        ) : (
          shown.map((e, i) => (
            <div key={`${e.at}-${i}`} className="log-row">
              <span className="t">{fmt.format(new Date(e.at)).replace(',', '')}</span>
              <span className="k" style={{ color: KIND[e.kind][1] }}>{KIND[e.kind][0]}</span>
              <span className="m">{e.msg}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
