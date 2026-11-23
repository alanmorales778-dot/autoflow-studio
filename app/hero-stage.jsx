'use client';

import { useEffect, useRef, useState } from 'react';

// Escena del hero: los mensajes sueltos del WhatsApp se convierten en el día ordenado de AutoFlow.
// Va pasando sola por varios rubros (se frena si la pestaña no está a la vista o si el
// visitante pidió «reducir movimiento»); también se puede elegir el rubro tocando abajo.
const SCENES = [
  {
    key: 'cocina', label: 'Pastelería', photo: 'p-cake',
    chats: ['Hola! Tenés lugar para una torta el sábado? Es para el cumple de mi hija 🎂', '¿Cuánto es la seña? ¿Te transfiero?', 'Te mando una foto de cómo la quiero'],
    times: ['22:41', '22:43', '22:44'],
    toast: ['Seña cobrada', 'Martina pagó $ 19.000'],
    sum: ['3 pedidos', '$ 54.000'],
    day: [['10:00', 'Torta Rogel', 'Martina G.', 'Seña ✓', 1], ['11:30', 'Box desayuno', 'Lucas P.', 'Saldo $ 16.000', 0], ['16:00', 'Alfajores x24', 'Sofía R.', 'Seña ✓', 1]],
    profit: ['$ 182.780', '↑ 12 % más que en octubre'],
  },
  {
    key: 'belleza', label: 'Uñas', photo: 'p-nails',
    chats: ['Hola! Tenés turno para esculpidas el viernes?', '¿Cuánto sale con diseño?', 'Quiero algo así 💅'],
    times: ['20:12', '20:13', '20:15'],
    toast: ['Turno reservado', 'Caro eligió viernes 10:00'],
    sum: ['3 turnos', '$ 41.000'],
    day: [['10:00', 'Esculpidas', 'Caro M.', 'Seña ✓', 1], ['11:30', 'Semipermanente', 'Juli R.', 'Saldo $ 12.000', 0], ['15:00', 'Lifting', 'Ana P.', 'Seña ✓', 1]],
    profit: ['$ 246.300', '↑ 9 % más que en octubre'],
  },
  {
    key: 'optica', label: 'Óptica', photo: 'p-glasses',
    chats: ['Hola! ¿Tienen este armazón en negro?', '¿Puedo pasar a buscarlos el sábado a la mañana?', 'Te paso la receta'],
    times: ['18:02', '18:04', '18:05'],
    toast: ['Listos para retirar', 'Avisale a Marta por WhatsApp'],
    sum: ['3 retiros', '$ 120.000'],
    day: [['10:00', 'Armazón + cristales', 'Pablo D.', 'Seña ✓', 1], ['12:00', 'Multifocales', 'Marta L.', 'Saldo $ 85.000', 0], ['17:00', 'Lentes de contacto', 'Sol V.', 'Pagado ✓', 1]],
    profit: ['$ 398.500', '↑ 6 % más que en octubre'],
  },
  {
    key: 'oficios', label: 'Electricista', photo: 'p-panel',
    chats: ['Hola, me salta la térmica cuando prendo el horno', '¿Podés venir mañana a la mañana?', 'Así está el tablero'],
    times: ['21:30', '21:31', '21:33'],
    toast: ['Presupuesto aceptado', 'Diego confirmó $ 85.000'],
    sum: ['3 visitas', '$ 115.000'],
    day: [['8 a 12', 'Revisión eléctrica', 'Laura P.', 'Visita ✓', 1], ['11:00', 'Cambio de térmica', 'Diego S.', 'Saldo $ 85.000', 0], ['14 a 18', 'Instalar toma', 'Vero M.', 'Seña ✓', 1]],
    profit: ['$ 412.000', '↑ 15 % más que en octubre'],
  },
];
const EVERY = 7500;

export default function HeroStage() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !auto) return undefined;
    let visible = true;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
    if (io && ref.current) io.observe(ref.current);
    const t = setInterval(() => { if (visible && !document.hidden) setI((k) => (k + 1) % SCENES.length); }, EVERY);
    return () => { clearInterval(t); io?.disconnect(); };
  }, [auto]);

  const s = SCENES[i];
  return (
    <div className="stage-wrap" ref={ref}>
      <div className="stage" key={s.key} aria-hidden="true">
        <div className="stage-chats">
          {s.chats.map((c, k) => (
            <div key={k} className="bubble" style={{ '--d': `${0.15 + k * 0.28}s` }}>
              {k === 2 && <span className={`bubble-photo ${s.photo}`} />}
              <span>{c}</span>
              <em>{s.times[k]}</em>
            </div>
          ))}
          <svg className="stage-arrow" viewBox="0 0 120 60" fill="none">
            <path d="M4 30c30-22 70-22 104-2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 7" />
            <path d="m98 18 12 11-15 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="phone">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="ph-toast" style={{ '--d': '1.75s' }}>
              <span className="ph-toast-ico" />
              <span><b>{s.toast[0]}</b>{s.toast[1]}</span>
            </div>
            <span className="ph-date">Sábado 22</span>
            <strong className="ph-title">Hoy</strong>
            <span className="ph-sum">{s.sum[0]} · <b>{s.sum[1]}</b> a cobrar</span>
            <div className="ph-week">
              {['hoy', 'dom', 'lun', 'mar', 'mié'].map((d, k) => (
                <span key={d} className={k === 0 ? 'on' : ''}><i>{d}</i><b>{22 + k}</b></span>
              ))}
            </div>
            <div className="ph-list">
              {s.day.map(([time, what, who, tag, ok], k) => (
                <div key={time + what} className="ph-card" style={{ '--d': `${0.95 + k * 0.18}s` }}>
                  <span className="ph-time">{time}</span>
                  <div><b>{what}</b><span>{who}</span></div>
                  <span className={`ph-tag ${ok ? 'ok' : ''}`}>{tag}</span>
                </div>
              ))}
            </div>
            <div className="ph-profit">
              <span>Te deja este mes</span>
              <b>{s.profit[0]}</b>
              <em>{s.profit[1]}</em>
            </div>
          </div>
        </div>
      </div>

      <div className="stage-tabs" role="tablist" aria-label="Ver el ejemplo de otro rubro">
        {SCENES.map((x, k) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={k === i}
            className={k === i ? 'on' : ''}
            style={{ '--t': `${EVERY}ms` }}
            onClick={() => { setI(k); setAuto(false); }}
          >
            {x.label}
            {k === i && auto && <i key={`p${i}`} className="tab-prog" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
