import Link from 'next/link';
import { PRICES } from '@/lib/modules';
import { RUBROS, publicRubros } from '@/lib/rubros';
import Logo from './logo';
import PlanBuilder from './plan-builder';
import RubroDemo from './rubro-demo';
import Ahorro from './ahorro';

const Ico = ({ d, color = '#C2410C', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(Array.isArray(d) ? d : [d]).map((p) => <path key={p} d={p} />)}
  </svg>
);

const DOLORES = [
  {
    ico: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    t: 'Contestás lo mismo todo el día',
    p: 'Precio, fechas, si hay lugar, cómo se paga. Si te llegan 40 consultas por día y cada una lleva 6 minutos, son 4 horas pegado al celular. Y el mensaje que no contestaste a tiempo es una venta que se fue.',
  },
  {
    ico: 'M18 6 6 18M6 6l12 12',
    t: 'Te reservan, no pagan y no vienen',
    p: 'Sin seña, cada pedido o turno que se cae es un lugar que le negaste a otro cliente. Y perseguir a alguien para que pague la seña es incómodo.',
  },
  {
    ico: ['M3 17 9 11l4 4 8-8', 'M14 7h7v7'],
    t: 'Sube todo, menos tu precio',
    p: 'En 2026, 3 de cada 4 pymes tuvieron subas de costos y solo 1 de cada 3 pudo subir sus precios. Si no recalculás seguido, sin darte cuenta vendés con poco margen o a pérdida.',
  },
  {
    ico: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    t: 'No sabés cuánto ganás de verdad',
    p: 'Entre materiales, envases, luz y tu tiempo, es fácil olvidarse costos. Facturás, pero no sabés qué producto deja plata y cuál solo te da trabajo.',
  },
];

const ANTES_DESPUES = [
  ['Respondés precios y fechas uno por uno', 'El cliente ve precios, fechas y horarios libres en tu link y pide solo'],
  ['Anotás en un cuaderno o en el chat', 'Cada pedido queda en la agenda con todos sus datos, y te llega un mail'],
  ['Aceptás de más y después no llegás', 'El día se cierra solo cuando se llena tu cupo'],
  ['Perseguís a la gente para la seña', 'La seña se paga con Mercado Pago y, si no la pagan, el lugar se libera'],
  ['Te enterás tarde de que subió la harina', 'Actualizás el precio del insumo y ves qué producto quedó en riesgo y a cuánto venderlo'],
  ['Cobrar el saldo depende de tu memoria', 'Ves quién debe cuánto y le mandás el link de pago en un toque'],
];

const VOCAB = [
  ['Producto', 'Servicio', 'Artículo para alquilar'],
  ['Receta e insumos', 'Materiales por servicio', 'Gastos por alquiler'],
  ['Cupo de horno', 'Turnos por horario', 'Unidades disponibles'],
  ['Dedicatoria y alergias', 'Referencia y sensibilidades', 'Detalle del evento'],
  ['Modo cocina', 'Turnos del día', 'Modo armado'],
];

const EJEMPLO = [
  ['Carga sus productos', 'Sube un Excel con sus tortas y alfajores, y qué lleva cada uno.'],
  ['Pone su cupo', 'Hasta 6 tortas por sábado: es lo que entra en el horno.'],
  ['Comparte el link', 'Lo deja en la bio de Instagram y en el estado de WhatsApp.'],
  ['Le piden a las 23:14', 'El cliente elige la torta, la fecha y la franja, y paga la seña con Mercado Pago. Si no paga, el lugar se libera solo.'],
  ['Cocina tranquila', 'El viernes abre el modo cocina: cada pedido con su dedicatoria y las alergias resaltadas.'],
  ['No vende a pérdida', 'Sube la manteca y AutoFlow le avisa qué torta quedó con poco margen y a cuánto venderla.'],
];

const FAQ = [
  ['¿Mis clientes tienen que descargar algo?', 'No. Entran a tu link desde el celular, eligen y listo. No necesitan cuenta ni app.'],
  ['¿Tengo que dejar de usar WhatsApp?', 'No. Seguís atendiendo por WhatsApp como siempre, pero en vez de explicar todo mandás tu link. Si querés, el bot de WhatsApp toma los pedidos por vos.'],
  ['¿AutoFlow se queda con un porcentaje de mis ventas?', 'No. Pagás el plan mensual y nada más. Mercado Pago cobra su comisión habitual por cada cobro, igual que hoy.'],
  ['¿Y si no uso Mercado Pago?', 'Podés tomar pedidos igual. La seña la coordinás vos y el lugar queda reservado las horas que elijas; si no se confirma, se libera solo.'],
  ['¿Necesito saber de computación?', 'Si usás Instagram o una planilla, te alcanza. Arrancás con productos de ejemplo de tu rubro y los cambiás por los tuyos, o subís tu Excel.'],
  ['¿Sirve si tengo un equipo o muchos productos?', 'Sí. Ponés cupos por categoría y por horario, ves la hoja de producción del día, la rentabilidad de cada producto y exportás todo a Excel.'],
  ['¿Emite factura electrónica?', 'Todavía no: por ahora seguís facturando como hoy. Es una de las próximas funciones.'],
  ['¿Qué pasa cuando terminan los 14 días?', 'Elegís los módulos que te sirven y pagás por mes. Si no seguís, no se te cobra nada: la prueba no pide tarjeta.'],
];

export default function Home() {
  const rubros = publicRubros();
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Logo />
          <nav className="nav" aria-label="Principal">
            <a href="#problemas">Problemas</a>
            <a href="#rubros">Rubros</a>
            <a href="#ahorro">Cuánto ahorrás</a>
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
              <span className="pill"><span className="dot" />Para emprendedores y pymes que trabajan por encargo, turno o reserva</span>
              <h1>Vendé por encargo sin vivir pegado al WhatsApp.</h1>
              <p className="lead">
                Tu link toma pedidos y turnos las 24 horas, cobra la seña por Mercado Pago, cierra el día cuando no das más y te avisa cuando un aumento te
                come la ganancia. Vos hacés lo tuyo; AutoFlow ordena el resto.
              </p>
              <div className="row" style={{ marginTop: 28 }}>
                <Link href="/registro" className="btn large">
                  Empezar 14 días gratis
                  <Ico d={['M5 12h14', 'm13 6 6 6-6 6']} color="currentColor" size={18} />
                </Link>
                <a href="#ejemplo" className="btn large secondary">Ver un ejemplo</a>
              </div>
              <ul className="trust">
                <li><Ico d="m5 12 5 5 9-10" color="#15803D" size={16} />Listo en una tarde</li>
                <li><Ico d="m5 12 5 5 9-10" color="#15803D" size={16} />Sin comisión por venta</li>
                <li><Ico d="m5 12 5 5 9-10" color="#15803D" size={16} />Prueba sin tarjeta</li>
              </ul>
            </div>
            <RubroDemo rubros={rubros} />
          </div>
        </section>

        <section id="problemas" className="section container">
          <span className="eyebrow">¿Te suena?</span>
          <h2 className="big">Vender por encargo es lindo hasta que el negocio crece.</h2>
          <p className="lead" style={{ maxWidth: 680 }}>Cuando todo depende de que vos contestes cada mensaje, el chat decide cuánto podés vender. Estos son los problemas que más se repiten.</p>
          <div className="grid pain-grid" style={{ marginTop: 32 }}>
            {DOLORES.map((d) => (
              <article key={d.t} className="card pain">
                <span className="ico"><Ico d={d.ico} color="#B91C1C" /></span>
                <h3>{d.t}</h3>
                <p>{d.p}</p>
              </article>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Dato de costos y precios: Encuesta Coyuntural de la Fundación Observatorio PyME, 2026. Las 4 horas por día son una cuenta de ejemplo.</p>
        </section>

        <section className="section container" style={{ paddingTop: 40 }}>
          <span className="eyebrow">La solución</span>
          <h2 className="big">Lo que hoy hacés a mano, AutoFlow lo hace solo.</h2>
          <div className="card" style={{ marginTop: 28, padding: 0, overflow: 'hidden' }}>
            <table className="vs">
              <thead><tr><th>Hoy</th><th>Con AutoFlow</th></tr></thead>
              <tbody>
                {ANTES_DESPUES.map(([a, b]) => (
                  <tr key={a}>
                    <td><span className="vs-c"><Ico d="M18 6 6 18M6 6l12 12" color="#B91C1C" size={16} />{a}</span></td>
                    <td><span className="vs-c"><Ico d="m5 12 5 5 9-10" color="#15803D" size={16} />{b}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="rubros" className="section container">
          <span className="eyebrow">Rubros</span>
          <h2 className="big">Un mismo sistema, adaptado a lo que hacés.</h2>
          <p className="lead" style={{ maxWidth: 680 }}>Elegís tu rubro al crear la cuenta y AutoFlow cambia los nombres, los datos que pide en cada pedido, los ejemplos para arrancar y la pantalla de trabajo del día.</p>
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

        <section id="como-funciona" className="section container" style={{ paddingTop: 40 }}>
          <span className="eyebrow">Cómo empezar</span>
          <h2 className="big">Lo configurás a la tarde. A la noche ya toma pedidos.</h2>
          <div className="grid grid-3" style={{ marginTop: 32 }}>
            <article className="card feature">
              <span className="ico"><Ico d={['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8M8 17h5']} /></span>
              <small style={{ fontWeight: 600 }}>Paso 1 · 15 minutos</small>
              <h3>Cargás lo que vendés</h3>
              <p>Elegís tu rubro y arrancás con ejemplos, o subís tu Excel con productos, precios y stock. Si querés, sumás qué lleva cada uno para saber el costo.</p>
            </article>
            <article className="card feature">
              <span className="ico"><Ico d={['M8 2v4M16 2v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']} /></span>
              <small style={{ fontWeight: 600 }}>Paso 2 · 10 minutos</small>
              <h3>Ponés tus reglas</h3>
              <p>Cuántos pedidos o turnos tomás por día y por horario, con cuántos días de anticipación y qué porcentaje de seña pedís.</p>
            </article>
            <article className="card feature">
              <span className="ico"><Ico d={['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7']} /></span>
              <small style={{ fontWeight: 600 }}>Paso 3 · 1 minuto</small>
              <h3>Compartís tu link</h3>
              <p>En la bio de Instagram, en el estado y en las respuestas rápidas de WhatsApp. Desde ahí, los pedidos llegan ordenados y con la seña cobrada.</p>
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
                    <span className="idx num">{String(k + 1).padStart(2, '0')}</span>
                    <div><strong>{t}</strong><p>{p}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="ahorro" className="section container">
          <span className="eyebrow">Cuánto ahorrás</span>
          <h2 className="big">Hacé la cuenta con tus números.</h2>
          <p className="lead" style={{ maxWidth: 680 }}>Mové las barras y mirá cuánto tiempo y plata se te va hoy en tomar pedidos a mano y en los que se caen.</p>
          <div style={{ marginTop: 28 }}><Ahorro price={PRICES.base} /></div>
        </section>

        <section className="section container" style={{ paddingTop: 40 }}>
          <span className="eyebrow">Para quién es</span>
          <h2 className="big">Arrancás chico y crece con vos.</h2>
          <div className="grid grid-2" style={{ marginTop: 28 }}>
            <article className="card audience">
              <h3>Si emprendés solo o con poca gente</h3>
              <ul className="checks">
                <li>Dejás de contestar lo mismo y recuperás horas por semana</li>
                <li>Cobrás la seña antes de comprar los materiales</li>
                <li>Sabés a cuánto vender para no trabajar gratis</li>
                <li>Todo desde el celular, sin instalar nada</li>
              </ul>
            </article>
            <article className="card audience">
              <h3>Si sos una pyme con más volumen</h3>
              <ul className="checks">
                <li>Cupos por categoría y por horario para no sobrevender</li>
                <li>Hoja de producción y lista de compras del día</li>
                <li>Rentabilidad por producto y simulador de aumentos</li>
                <li>Pedidos recurrentes, bot de WhatsApp y exportación a Excel</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="precios" className="section container" style={{ paddingBottom: 40 }}>
          <PlanBuilder prices={PRICES} />
        </section>

        <section id="preguntas" className="section container" style={{ paddingTop: 40, paddingBottom: 88 }}>
          <span className="eyebrow">Preguntas frecuentes</span>
          <h2 className="big">Lo que todos preguntan antes de empezar.</h2>
          <div className="faq" style={{ marginTop: 28 }}>
            {FAQ.map(([q, a]) => (
              <details key={q} className="card">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container" style={{ paddingBottom: 88 }}>
          <div className="cta-band">
            <div style={{ maxWidth: 620 }}>
              <h2>Esta noche, que los pedidos se tomen solos.</h2>
              <p>14 días gratis con todos los módulos. Sin tarjeta y sin comisión por venta.</p>
            </div>
            <Link href="/registro" className="btn large">Empezar gratis</Link>
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
