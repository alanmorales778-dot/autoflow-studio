// Escena del hero: los mensajes sueltos del WhatsApp se convierten en el día ordenado de AutoFlow.
// Una sola animación al cargar (respeta «reducir movimiento»).
const CHATS = [
  { t: 'Hola! Tenés lugar para una torta el sábado? Es para el cumple de mi hija 🎂', h: '22:41' },
  { t: '¿Cuánto es la seña? ¿Te transfiero?', h: '22:43' },
  { t: 'Te mando una foto de cómo la quiero', h: '22:44', photo: true },
];

const DAY = [
  { time: '10:00', what: 'Torta Rogel', who: 'Martina G.', tag: 'Seña ✓', ok: true },
  { time: '11:30', what: 'Box desayuno', who: 'Lucas P.', tag: 'Saldo $ 16.000' },
  { time: '16:00', what: 'Alfajores x24', who: 'Sofía R.', tag: 'Seña ✓', ok: true },
];

export default function HeroStage() {
  return (
    <div className="stage" aria-hidden="true">
      <div className="stage-chats">
        {CHATS.map((c, i) => (
          <div key={i} className="bubble" style={{ '--d': `${0.15 + i * 0.28}s` }}>
            {c.photo && <span className="bubble-photo" />}
            <span>{c.t}</span>
            <em>{c.h}</em>
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
            <span><b>Seña cobrada</b> Martina pagó $ 19.000</span>
          </div>
          <span className="ph-date">Sábado 22</span>
          <strong className="ph-title">Hoy</strong>
          <span className="ph-sum">3 pedidos · <b>$ 54.000</b> a cobrar</span>
          <div className="ph-week">
            {['hoy', 'dom', 'lun', 'mar', 'mié'].map((d, i) => (
              <span key={d} className={i === 0 ? 'on' : ''}><i>{d}</i><b>{22 + i}</b></span>
            ))}
          </div>
          <div className="ph-list">
            {DAY.map((o, i) => (
              <div key={o.time} className="ph-card" style={{ '--d': `${0.95 + i * 0.18}s` }}>
                <span className="ph-time">{o.time}</span>
                <div>
                  <b>{o.what}</b>
                  <span>{o.who}</span>
                </div>
                <span className={`ph-tag ${o.ok ? 'ok' : ''}`}>{o.tag}</span>
              </div>
            ))}
          </div>
          <div className="ph-profit">
            <span>Te deja este mes</span>
            <b>$ 182.780</b>
            <em>↑ 12 % más que en octubre</em>
          </div>
        </div>
      </div>
    </div>
  );
}
