'use client';

import { useEffect, useState } from 'react';

const Ico = ({ d, color = '#C2410C', size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(Array.isArray(d) ? d : [d]).map((p) => <path key={p} d={p} />)}
  </svg>
);

// Demo animada de la landing. Rota sola por los rubros cada 12 s (lo que dura la animación) hasta que la persona elige uno.
export default function RubroDemo({ rubros }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % rubros.length), 12000);
    return () => clearInterval(t);
  }, [auto, rubros.length]);
  const r = rubros[i];
  const d = r.demo;

  return (
    <div>
      <div className="demo-tabs" role="tablist" aria-label="Ver la demo por rubro">
        {rubros.map((x, k) => (
          <button key={x.key} type="button" role="tab" aria-selected={k === i} className={`chip ${k === i ? 'on' : ''}`} onClick={() => { setI(k); setAuto(false); }}>
            <Ico d={x.icon} color="currentColor" size={15} />
            {x.short}
          </button>
        ))}
      </div>
      <div key={r.key} className="mock fade-in" role="img" aria-label={`Ejemplo para ${r.label}: llega un pedido, se cobra la seña, el día se completa y aparece una alerta de costo`}>
        <div className="mock-win">
          <div className="mock-bar">
            <i /><i /><i />
            <span className="mock-url">HakkiraApp · {r.label}</span>
            <span className="mock-clock"><Ico d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" color="currentColor" size={14} />23:14</span>
          </div>
          <div className="mock-body">
            <div className="row between" style={{ alignItems: 'baseline' }}>
              <strong className="disp" style={{ fontSize: 18 }}>{d.day}</strong>
              <small>{r.key === 'cocina' ? 'Ejemplo: pastelería' : 'Ejemplo'}</small>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row between" style={{ fontSize: 13, color: 'var(--ink-2)', flexWrap: 'nowrap' }}>
                <strong>{d.cap}</strong>
                <span style={{ position: 'relative', minWidth: 130, textAlign: 'right' }}>
                  <span className="swap-a num" style={{ position: 'absolute', right: 0 }}>{d.capCount}</span>
                  <span className="swap-b" style={{ position: 'absolute', right: 0, color: 'var(--bad)', fontWeight: 700 }}>Completo · cerrado</span>&nbsp;
                </span>
              </div>
              <div className="bar"><div className="fillbar" /></div>
            </div>
            <div className="mock-card n n1" style={{ alignItems: 'flex-start', boxShadow: '0 10px 24px -16px rgba(24,24,27,.35)' }}>
              <span className="ic pulse" style={{ background: 'var(--brand-soft)' }}><Ico d={['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0']} /></span>
              <div><strong>{r.key === 'belleza' ? 'Turno nuevo desde tu link' : 'Pedido nuevo desde tu link'}</strong><div className="sub">{d.order}</div></div>
            </div>
            <div className="mock-card n n2" style={{ borderColor: '#c9e8d3', background: '#f4fbf6' }}>
              <span className="ic" style={{ background: 'var(--ok-soft)' }}><Ico d="m5 12 5 5 9-10" color="#15803D" /></span>
              <div style={{ flex: 1 }}><strong>Seña cobrada</strong> <span className="sub">· Mercado Pago</span></div>
              <strong className="disp num" style={{ color: 'var(--ok)' }}>{d.deposit}</strong>
            </div>
            <div className="mock-card n n3">
              <span className="ic" style={{ background: 'var(--sunken)' }}><Ico d={['M8 2v4M16 2v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm9 16 2 2 4-4']} color="#3f3f46" /></span>
              <div><strong>{d.day} completo</strong> <span className="sub">· tu link ya no lo ofrece</span></div>
            </div>
            <div className="mock-card n n4" style={{ flexDirection: 'column', alignItems: 'stretch', borderColor: 'var(--warn-line)', background: '#fafaf9', position: 'relative' }}>
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <span className="ic" style={{ background: 'var(--warn-soft)' }}><Ico d={['M3 17 9 11l4 4 8-8', 'M14 7h7v7']} color="#B45309" /></span>
                <div><strong>{d.alert}</strong><div className="sub">{d.alertSub} <strong className="num">{d.price}</strong></div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
                <span className="mock-btn"><span className="lbl-a">Actualizar precio</span><span className="lbl-b">Actualizado</span></span>
                <svg className="mock-cursor" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2v18l5-5 3.5 7 3-1.5L12 13.5h7z" fill="#18181b" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
