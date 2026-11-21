'use client';

import { useState } from 'react';
import Link from 'next/link';

const fmt = (n) => '$ ' + n.toLocaleString('es-AR');

export default function PlanBuilder({ prices }) {
  const [on, setOn] = useState({ costs: true, recurring: false, whatsapp: false });
  const [bump, setBump] = useState(0);
  const mods = [
    { key: 'costs', name: 'Costos y producción', price: prices.costs, desc: 'Costo real de cada producto o servicio según lo que lleva, precio mínimo según tu margen, alerta de venta a pérdida, simulador de inflación, hoja de producción, pantalla de trabajo del día y lista de compras.' },
    { key: 'recurring', name: 'Pedidos recurrentes', price: prices.recurring, desc: 'Viandas, cajas, turnos fijos o abonos por suscripción semanal o quincenal, con débito automático. Los pedidos se arman solos 7 días antes.' },
    { key: 'whatsapp', name: 'Bot de WhatsApp', price: prices.whatsapp, desc: 'Toma pedidos por WhatsApp a toda hora, ofrece solo fechas con cupo y manda el link de la seña. Los mensajes de Meta se pagan aparte.' },
  ];
  const chosen = mods.filter((m) => on[m.key]);
  const total = prices.base + chosen.reduce((s, m) => s + m.price, 0);
  const toggle = (k) => { setOn((s) => ({ ...s, [k]: !s[k] })); setBump((b) => b + 1); };

  return (
    <div className="hero-grid" style={{ alignItems: 'start', gap: 40 }}>
      <div style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="eyebrow">Precios</span>
        <h2 className="big" style={{ margin: 0 }}>Pagás la base y sumás solo lo que usás.</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 17, margin: 0 }}>Precios finales en pesos, por mes. Los primeros 14 días tenés todos los módulos activados.</p>
        <div className="card plan-total" style={{ marginTop: 8, padding: 24 }}>
          <div className="muted" style={{ fontSize: 14 }}>Tu plan con lo que elegiste</div>
          <div key={bump} className="price pop">{fmt(total)}<span style={{ fontSize: 16, fontWeight: 600, color: '#d4d4d8' }}> /mes</span></div>
          <div className="muted" style={{ fontSize: 14 }}>{chosen.length ? 'Base + ' + chosen.map((m) => m.name).join(' + ') : 'Solo la base'}</div>
          <Link className="btn large block" href="/registro" style={{ marginTop: 16 }}>Empezar 14 días gratis</Link>
        </div>
      </div>
      <div>
        <div className="card mod on">
          <div className="row between">
            <div>
              <h3>Base · Agenda + Señas</h3>
              <small>Incluido siempre</small>
            </div>
            <div className="price" style={{ fontSize: 24 }}>{fmt(prices.base)}</div>
          </div>
          <ul className="checks">
            <li>Catálogo online con tu link</li>
            <li>Cupos o turnos por día y por horario</li>
            <li>Seña con Mercado Pago que vence sola</li>
            <li>Cobro del saldo y recordatorios</li>
            <li>Pedidos personalizados con opciones, notas y foto</li>
            <li>Aviso por mail de cada pedido nuevo</li>
            <li>Productos y stock desde Excel o Drive</li>
            <li>Tus pedidos en Google Calendar</li>
            <li>Registro de actividad</li>
          </ul>
        </div>
        {mods.map((m) => (
          <div key={m.key} className={`card mod ${on[m.key] ? 'on' : ''}`}>
            <div className="row between">
              <div className="row" style={{ gap: 14 }}>
                <button type="button" className={`switch ${on[m.key] ? 'on' : ''}`} aria-pressed={on[m.key]} aria-label={(on[m.key] ? 'Quitar ' : 'Sumar ') + m.name} onClick={() => toggle(m.key)} />
                <h3>{m.name}</h3>
              </div>
              <div className="price" style={{ fontSize: 22, color: 'var(--ink-2)' }}>+ {fmt(m.price)}</div>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)' }}>{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
