'use client';

import { useState } from 'react';

const fmt = (n) => '$ ' + Math.round(n).toLocaleString('es-AR');

// Calculadora de la landing: cuánto tiempo y plata se va hoy en tomar pedidos a mano.
// Es una estimación: el usuario pone sus propios números.
export default function Ahorro({ price }) {
  const [pedidos, setPedidos] = useState(25);
  const [minutos, setMinutos] = useState(15);
  const [hora, setHora] = useState(6000);
  const [caidos, setCaidos] = useState(2);
  const [ticket, setTicket] = useState(20000);

  const MIN_CON_HAKKIRA = 2; // revisar y confirmar un pedido que ya llega completo
  const semanas = 4.3;
  const horas = Math.max(0, (pedidos * semanas * (minutos - MIN_CON_HAKKIRA)) / 60);
  const plataTiempo = horas * hora;
  const plataCaidos = caidos * semanas * ticket * 0.5; // la seña cubre la mitad de lo que hoy se pierde
  const total = plataTiempo + plataCaidos;
  const veces = price ? total / price : 0;

  // función (no componente) para que el slider no se vuelva a montar en cada cambio
  const row = ({ label, value, set, min, max, step, suffix }) => (
    <div className="calc-row" key={label}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <label style={{ margin: 0 }}>{label}</label>
        <strong className="num">{suffix === '$' ? fmt(value) : `${value} ${suffix}`}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
    </div>
  );

  return (
    <div className="calc card">
      <div className="calc-in">
        {row({ label: "Pedidos o turnos por semana", value: pedidos, set: setPedidos, min: 5, max: 200, step: 5, suffix: "", })}
        {row({ label: "Minutos de chat por pedido (precio, fechas, seña, dirección)", value: minutos, set: setMinutos, min: 3, max: 40, step: 1, suffix: "min", })}
        {row({ label: "Cuánto vale una hora tuya", value: hora, set: setHora, min: 2000, max: 30000, step: 500, suffix: "$", })}
        {row({ label: "Pedidos o turnos que se caen por semana (no pagan, no vienen)", value: caidos, set: setCaidos, min: 0, max: 20, step: 1, suffix: "", })}
        {row({ label: "Ticket promedio", value: ticket, set: setTicket, min: 3000, max: 150000, step: 1000, suffix: "$", })}
      </div>
      <div className="calc-out">
        <span className="muted" style={{ fontSize: 14 }}>Hoy se te van por mes</span>
        <div className="calc-big num">{Math.round(horas)} h</div>
        <span className="muted" style={{ fontSize: 14 }}>respondiendo lo mismo, más los pedidos que se caen. En plata:</span>
        <div className="calc-big num" style={{ color: 'var(--brand)' }}>{fmt(total)}</div>
        {veces >= 1 && <p style={{ margin: '8px 0 0', fontWeight: 600 }}>Es {veces >= 10 ? Math.round(veces) : veces.toFixed(1).replace('.', ',')} veces lo que cuesta HakkiraApp por mes.</p>}
        <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>Estimación con tus números: suponemos 2 minutos por pedido para revisarlo con HakkiraApp y que la seña recupera la mitad de lo que hoy se cae.</p>
      </div>
    </div>
  );
}
