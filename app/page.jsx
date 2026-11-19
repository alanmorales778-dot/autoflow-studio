import Link from 'next/link';
import { PRICES } from '@/lib/modules';
import { RUBROS, publicRubros } from '@/lib/rubros';
import Logo from './logo';
import PlanBuilder from './plan-builder';
import RubroDemo from './rubro-demo';

const Ico = ({ d, color = '#C2410C', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(Array.isArray(d) ? d : [d]).map((p) => <path key={p} d={p} />)}
  </svg>
);

const EJEMPLO = [
  ['Carga sus productos', 'Sube un Excel con sus tortas y alfajores, y la receta de cada una con lo que lleva.'],
  ['Pone su cupo', 'Hasta 6 tortas por sábado: es lo que entra en el horno.'],
  ['Comparte el link', 'Lo deja en la bio de Instagram y en el estado de WhatsApp.'],
  ['Le piden a las 23:14', 'El cliente elige la torta, la fecha y la franja, y paga la seña con Mercado Pago. Si no paga, el lugar se libera solo.'],
  ['Cocina tranquila', 'El viernes abre el modo cocina: cada pedido con su dedicatoria y las alergias resaltadas.'],
  ['No vende a pérdida', 'Sube la manteca y AutoFlow le avisa qué torta quedó con poco margen y a cuánto venderla.'],
];

const VOCAB = [
  ['Producto', 'Servicio', 'Artículo para alquilar'],
  ['Receta e insumos', 'Materiales por servicio', 'Gastos por alquiler'],
  ['Cupo de horno', 'Turnos por día', 'Unidades disponibles'],
  ['Dedicatoria y alergias', 'Referencia y sensibilidades', 'Detalle del evento'],
  ['Modo cocina', 'Turnos del día', 'Modo armado'],
];

export default function Home() {
  const rubros = publicRubros();
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Logo />
          <nav className="nav" aria-label="Principal">
            <a href="#rubros">Rubros</a>
            <a href="#ejemplo">Ejemplo</a>
            <a href="#precios">Precios</a>
            <Link href="/login">Ingresar</Link>
            <Link href="/registro" className="btn" style={{ marginLeft: 6 }}>Probar gratis</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero grain" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="container hero-grid">
            <div>
              <span className="pill"><span className="dot" />Para negocios que trabajan por encargo, turno o reserva</span>
              <h1>Tus clientes piden solos, la seña entra sola y el día se cierra cuando no das más.</h1>
              <p className="lead">
                AutoFlow es tu link de pedidos con agenda, cupos, cobro de seña por Mercado Pago y costos al día. Sirve para una pastelería, un estudio de uñas, un
                emprendimiento de desayunos sorpresa o un taller: elegís tu rubro y la herramienta habla tu idioma.
              </p>
              <div className="row" style={{ marginTop: 28 }}>
                <Link href="/registro" className="btn large">
                  Empezar 14 días gratis
                  <Ico d={['M5 12h14', 'm13 6 6 6-6 6']} color="currentColor" size={18} />
                </Link>
                <a href="#ejemplo" className="btn large secondary">Ver un ejemplo</a>
              </div>
              <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>Sin tarjeta para la prueba. Cancelás cuando quieras.</p>
            </div>
            <RubroDemo rubros={rubros} />
          </div>
        </section>

        <section id="rubros" className="section container">
          <span className="eyebrow">Rubros</span>
          <h2 className="big">Un mismo sistema, adaptado a lo que hacés.</h2>
          <p className="lead" style={{ maxWidth: 680 }}>Elegís tu rubro al crear la cuenta y AutoFlow cambia los nombres, los datos que pide en cada pedido, los ejemplos para arrancar y la pantalla de trabajo del día. Lo podés cambiar cuando quieras.</p>
          <div className="grid grid-3 rubro-grid" style={{ marginTop: 32 }}>
            {rubros.map((r) => (
              <Link key={r.key} href={`/registro?rubro=${r.key}`} className={`card rubro-card ${r.key === 'cocina' ? 'featured' : ''}`}>
                <span className="ico"><Ico d={r.icon} /></span>
                <div>
                  <h3>{r.label}{r.key === 'cocina' && <span className="badge" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Ejemplo completo</span>}</h3>
                  <p>{r.ejemplos}.</p>
                </div>
                <span className="go">Empezar con {r.short.toLowerCase()} →</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="section container" style={{ paddingTop: 0 }}>
          <span className="eyebrow">Cómo funciona</span>
          <h2 className="big">Tres cosas que hoy hacés a mano, resueltas solas.</h2>
          <div className="grid grid-3" style={{ marginTop: 36 }}>
            <article className="card feature">
              <span className="ico"><Ico d={['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7']} /></span>
              <small style={{ fontWeight: 600 }}>01 · Tu link de pedidos</small>
              <h3>Te piden a cualquier hora, sin escribirte</h3>
              <p>Lo ponés en Instagram o en tu estado de WhatsApp. El cliente elige qué quiere, el día y el horario, y deja sus datos. Vos te levantás con todo ordenado y te llega un mail por cada pedido.</p>
            </article>
            <article className="card feature">
              <span className="ico"><Ico d={['M8 2v4M16 2v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']} /></span>
              <small style={{ fontWeight: 600 }}>02 · Cupos y seña</small>
              <h3>El día se cierra cuando no das abasto</h3>
              <p>Definís cuántos pedidos o turnos tomás por día. Al llenarse, la fecha desaparece del link. La seña se cobra con Mercado Pago y, si no la pagan a tiempo, el lugar se libera solo.</p>
            </article>
            <article className="card feature">
              <span className="ico"><Ico d={['M3 17 9 11l4 4 8-8', 'M14 7h7v7']} /></span>
              <small style={{ fontWeight: 600 }}>03 · Costos al día</small>
              <h3>Sube un material, se recalcula tu precio</h3>
              <p>Cargás lo que comprás con un Excel o desde Google Drive y qué lleva cada producto o servicio. Ves tu costo real, el precio mínimo para ganar lo que querés y una alerta si estás vendiendo a pérdida.</p>
            </article>
          </div>
        </section>

        <section id="ejemplo" className="section-band">
          <div className="container section">
            <div className="hero-grid" style={{ alignItems: 'start', gap: 48 }}>
              <div>
                <span className="eyebrow">Ejemplo</span>
                <h2 className="big" style={{ marginTop: 6 }}>Así se usa en una pastelería.</h2>
                <p className="lead">Un caso de ejemplo de punta a punta, con todos los módulos. En tu rubro es igual: cambian los nombres, no el sistema.</p>
                <div className="card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
                  <table className="vocab">
                    <thead><tr><th>{RUBROS.cocina.short}</th><th>{RUBROS.belleza.short}</th><th>{RUBROS.eventos.short}</th></tr></thead>
                    <tbody>{VOCAB.map((row) => <tr key={row[0]}>{row.map((c) => <td key={c}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
              <ol className="story">
                {EJEMPLO.map(([t, p], k) => (
                  <li key={t}>
                    <span className="n num">{String(k + 1).padStart(2, '0')}</span>
                    <div><strong>{t}</strong><p>{p}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="precios" className="section container" style={{ paddingBottom: 88 }}>
          <PlanBuilder prices={PRICES} />
        </section>

        <section className="container" style={{ paddingBottom: 88 }}>
          <div className="cta-band">
            <div style={{ maxWidth: 620 }}>
              <h2>Esta noche, que los pedidos se tomen solos.</h2>
              <p>Lo configurás en una tarde: elegís tu rubro, cargás lo que vendés con un Excel, ponés tus cupos y compartís el link.</p>
            </div>
            <Link href="/registro" className="btn large">Empezar 14 días gratis</Link>
          </div>
        </section>
      </main>

      <footer className="footer" style={{ marginTop: 0 }}>
        <div className="container row between">
          <span>© {new Date().getFullYear()} AutoFlow</span>
          <Link href="/legal" style={{ color: 'var(--muted)' }}>Términos y privacidad</Link>
        </div>
      </footer>
    </>
  );
}
