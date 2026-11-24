import Link from 'next/link';
import { PRICES } from '@/lib/modules';
import { RUBROS, publicRubros } from '@/lib/rubros';
import Logo from './logo';
import PlanBuilder from './plan-builder';
import HeroStage from './hero-stage';
import DemoVideo from './demo-video';
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

// Un pedido entra y se anota solo en todo lo demás: es lo que nos diferencia de juntar apps sueltas.
const CONECTA = [
  { t: 'Aparece en tu día', p: 'En Hoy, en su horario, con todo lo que pidió el cliente.', ui: 'agenda' },
  { t: 'Ocupa su lugar', p: 'Se descuenta del cupo. Cuando el día se llena, tu link deja de ofrecerlo.', ui: 'cupo' },
  { t: 'Queda la seña y el saldo', p: 'Sabés qué cobraste, qué falta y a quién recordárselo.', ui: 'cobro' },
  { t: 'Suma a tu lista de compras', p: 'Lo que vas a usar en insumos, agrupado por pasillo.', ui: 'compras' },
  { t: 'Calcula cuánto te deja', p: 'Ganancia por pedido, por producto y por mes, comparada con el anterior.', ui: 'ganancia' },
  { t: 'Te avisa si un aumento te come el margen', p: 'Cambiás el precio de un insumo y ves qué producto quedó corto y a cuánto venderlo.', ui: 'aviso' },
];

const COMPARA = {
  cols: ['Catálogo por WhatsApp', 'App de turnos', 'Planilla de Excel', 'HakkiraApp'],
  rows: [
    ['El cliente elige y pide desde un link', 'si', 'si', 'no', 'si'],
    ['Fecha, horario y cupo por día', 'no', 'si', 'no', 'si'],
    ['Seña y saldo de cada pedido', 'no', 'si', 'mano', 'si'],
    ['Lista de compras según lo que vendiste', 'no', 'no', 'mano', 'si'],
    ['Costo y ganancia de cada producto', 'no', 'no', 'mano', 'si'],
    ['Aviso cuando sube un insumo', 'no', 'no', 'no', 'si'],
    ['Se adapta a tu rubro', 'no', 'solo turnos', 'mano', 'si'],
  ],
};

const CELU = [
  { ico: ['M12 2v14', 'm7 11 5 5 5-5', 'M5 21h14'], t: 'Se instala como una app', p: 'Desde el navegador, en Android y iPhone. Sin tiendas ni descargas pesadas.' },
  { ico: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'], t: 'Te avisa al instante', p: 'Pedido nuevo, seña pagada, reserva vencida y un resumen a la mañana con lo del día.' },
  { ico: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'], t: 'Sabés si vas mejor que el mes pasado', p: 'Ventas, ganancia y cobros con la comparación hecha, y un gráfico simple de 6 meses.' },
  { ico: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M12 18v-6', 'm9 15 3 3 3-3'], t: 'Tus datos son tuyos', p: 'Bajás pedidos, clientes, productos y ganancias en Excel cuando quieras.' },
];

const MODO = { turno: 'Tu cliente reserva turno con día y hora', pedido: 'Tu cliente pide con fecha de entrega o retiro', reserva: 'Tu cliente reserva la fecha de su evento', visita: 'Tu cliente pide una visita con día, franja y foto del problema' };


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
  ['No vende a pérdida', 'Sube la manteca y HakkiraApp le avisa qué torta quedó con poco margen y a cuánto venderla.'],
];

const FAQ = [
  ['¿Mis clientes tienen que descargar algo?', 'No. Entran a tu link desde el celular, eligen y listo. No necesitan cuenta ni app.'],
  ['¿Tengo que dejar de usar WhatsApp?', 'No. Seguís atendiendo por WhatsApp como siempre, pero en vez de explicar todo mandás tu link. Si querés, el bot de WhatsApp toma los pedidos por vos.'],
  ['¿HakkiraApp se queda con un porcentaje de mis ventas?', 'No. Pagás el plan mensual y nada más. Mercado Pago cobra su comisión habitual por cada cobro, igual que hoy.'],
  ['¿Y si no uso Mercado Pago?', 'Podés tomar pedidos igual. La seña la coordinás vos y el lugar queda reservado las horas que elijas; si no se confirma, se libera solo.'],
  ['¿Necesito saber de computación?', 'Si usás Instagram o una planilla, te alcanza. Arrancás con productos de ejemplo de tu rubro y los cambiás por los tuyos, o subís tu Excel.'],
  ['¿Sirve si tengo un equipo o muchos productos?', 'Sí. Ponés cupos por categoría y por horario, ves la hoja de producción del día, la rentabilidad de cada producto y exportás todo a Excel.'],
  ['¿Puedo llevarme mis datos?', 'Sí. Desde Ajustes bajás en Excel tus pedidos, clientes, productos, insumos y ganancias, cuando quieras.'],
  ['¿Hay que instalar algo?', 'No hace falta. Funciona desde el navegador, y si querés la instalás en el celular como una app para recibir avisos.'],
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
            <a href="#conectado">Cómo funciona</a>
            <a href="#rubros">Rubros</a>
            <a href="#compara">Por qué HakkiraApp</a>
            <a href="#precios">Precios</a>
            <Link href="/login">Ingresar</Link>
            <Link href="/registro" className="btn" style={{ marginLeft: 6 }}>Probar gratis</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero2">
          <div className="container hero2-grid">
            <div className="hero2-copy">
              <p className="hero2-kicker"><span className="dot" />Para quien vende por encargo, con turno o reserva</p>
              <h1>Del chat lleno de mensajes al día ordenado.</h1>
              <p className="lead">
                Tu link toma los pedidos y turnos, cobra la seña y te dice cuánto ganás con cada uno.
                Vos abrís <b>Hoy</b> y ya sabés qué hacer.
              </p>
              <div className="hero2-cta">
                <Link href="/registro" className="btn large">
                  Probar 14 días gratis
                  <Ico d={['M5 12h14', 'm13 6 6 6-6 6']} color="currentColor" size={18} />
                </Link>
                <a href="#video" className="btn large ghost">Ver el video</a>
              </div>
              <ul className="trust">
                <li><Ico d="m5 12 5 5 9-10" color="#15803D" size={16} />Listo en una tarde</li>
                <li><Ico d="m5 12 5 5 9-10" color="#15803D" size={16} />Sin comisión por venta</li>
                <li><Ico d="m5 12 5 5 9-10" color="#15803D" size={16} />Sin tarjeta</li>
              </ul>
            </div>
            <HeroStage />
          </div>
          <div className="container">
            <ul className="hero2-rubros" aria-label="Rubros">
              {rubros.map((r) => (
                <li key={r.key}><Link href={`/registro?rubro=${r.key}`}><Ico d={r.icon} size={16} />{r.short}</Link></li>
              ))}
            </ul>
          </div>
        </section>

        <section id="video" className="section container demo">
          <div className="demo-grid">
            <div>
              <span className="eyebrow">En 35 segundos</span>
              <h2 className="big">Así se ve un pedido, de punta a punta.</h2>
              <ol className="demo-steps">
                <li><b>Tu cliente entra a tu link</b> y elige lo que quiere.</li>
                <li><b>Elige día y horario</b>: solo ve los que tienen lugar.</li>
                <li><b>Paga la seña</b> y le queda el detalle de su pedido.</li>
                <li><b>A vos te avisa</b> y aparece en Hoy, en su horario.</li>
                <li><b>Anotás lo que hay que comprar</b>, agrupado por pasillo.</li>
                <li><b>Ves cuánto vendiste</b> y cuánto te quedó este mes.</li>
              </ol>
              <Link href="/registro" className="btn large" style={{ marginTop: 8 }}>Probarlo con mi negocio</Link>
            </div>
            <div className="demo-phone">
              <div className="phone phone-video">
                <div className="phone-notch" />
                <div className="phone-screen"><DemoVideo src="/demo/hakkiraapp-demo.mp4" poster="/demo/hakkiraapp-demo.jpg" /></div>
              </div>
            </div>
          </div>
        </section>

        <section id="conectado" className="section container">
          <span className="eyebrow">Cómo funciona</span>
          <h2 className="big">Entra un pedido. Todo lo demás se acomoda solo.</h2>
          <p className="lead" style={{ maxWidth: 680 }}>Lo que en otras herramientas son pantallas que no se hablan, en HakkiraApp es un solo pedido que llega a todos lados.</p>
          <div className="flow">
            <div className="flow-ticket" aria-hidden="true">
              <span className="ft-tag">Pedido nuevo · 23:14</span>
              <strong className="ft-what">Torta Rogel</strong>
              <span className="ft-line">Sábado 22 · 10 a 13 h · retira</span>
              <span className="ft-line">Martina G. · «Feliz cumple, Sofi»</span>
              <span className="ft-pay"><span className="ft-ok">Seña pagada</span><b className="num">$ 19.000</b></span>
            </div>
            <ol className="flow-list">
              {CONECTA.map((c) => (
                <li key={c.t} className="flow-item">
                  <div className="fi-txt"><h3>{c.t}</h3><p>{c.p}</p></div>
                  <div className={`fi-ui ui-${c.ui}`} aria-hidden="true">
                    {c.ui === 'agenda' && <><span className="u-time num">10:00</span><span className="u-chip"><b>Torta Rogel</b> Martina G.</span></>}
                    {c.ui === 'cupo' && <><span className="u-lab">Tortas del sábado</span><span className="u-bar"><i style={{ width: '83%' }} /></span><b className="num">5 de 6</b></>}
                    {c.ui === 'cobro' && <><span className="u-ok">Seña <b className="num">$ 19.000</b> ✓</span><span className="u-due">Saldo <b className="num">$ 19.000</b></span></>}
                    {c.ui === 'compras' && <><span className="u-li">Dulce de leche <b className="num">1,2 kg</b></span><span className="u-li">Harina 0000 <b className="num">500 g</b></span><span className="u-li">Caja de torta <b className="num">1</b></span></>}
                    {c.ui === 'ganancia' && <><span className="u-big num">$ 18.400</span><span className="u-up">↑ 12 % más que en octubre</span></>}
                    {c.ui === 'aviso' && <><span className="u-warn">Subió la manteca 18 %</span><span className="u-li">Rogel quedó en 31 % · sugerido <b className="num">$ 41.500</b></span></>}
                  </div>
                </li>
              ))}
            </ol>
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

        <section id="rubros" className="section container">
          <span className="eyebrow">Rubros</span>
          <h2 className="big">Un mismo sistema, adaptado a lo que hacés.</h2>
          <p className="lead" style={{ maxWidth: 680 }}>Elegís tu rubro al crear la cuenta y HakkiraApp cambia los nombres, lo que ve tu cliente en el link, los datos que pide y la pantalla de trabajo del día.</p>
          <div className="grid grid-3 rubro-grid" style={{ marginTop: 32 }}>
            {rubros.map((r) => (
              <Link key={r.key} href={`/registro?rubro=${r.key}`} className={`card rubro-card ${r.key === 'cocina' ? 'featured' : ''}`}>
                <span className="ico"><Ico d={r.icon} /></span>
                <div>
                  <h3>{r.label}{r.key === 'cocina' && <span className="badge" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Ejemplo completo</span>}</h3>
                  <p>{r.ejemplos}.</p>
                  <p className="rubro-mode">{r.key === 'optica' ? 'Tu cliente pide y elige día y horario para retirar' : MODO[r.link?.mode] || MODO.pedido}.</p>
                </div>
                <span className="go">Empezar con {r.short.toLowerCase()} →</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="compara" className="section container" style={{ paddingTop: 40 }}>
          <span className="eyebrow">Por qué HakkiraApp</span>
          <h2 className="big">En vez de juntar tres herramientas que no se hablan.</h2>
          <p className="lead" style={{ maxWidth: 680 }}>Hay buenos catálogos, buenas apps de turnos y planillas para todo. Lo que no hay es algo que una el pedido con lo que cobrás, lo que comprás y lo que ganás.</p>
          <div className="card table-wrap compare" style={{ marginTop: 28 }}>
            <table>
              <thead><tr><th /><th>{COMPARA.cols[0]}</th><th>{COMPARA.cols[1]}</th><th>{COMPARA.cols[2]}</th><th className="us">{COMPARA.cols[3]}</th></tr></thead>
              <tbody>
                {COMPARA.rows.map(([label, ...vals]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {vals.map((v, k) => (
                      <td key={k} className={k === 3 ? 'us' : ''}>
                        {v === 'si' ? <Ico d="m5 12 5 5 9-10" color={k === 3 ? '#C2410C' : '#15803D'} size={18} /> : v === 'no' ? <span className="c-no" aria-label="No">—</span> : <span className="c-mid">{v === 'mano' ? 'a mano' : v}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-4 celu" style={{ marginTop: 28 }}>
            {CELU.map((c) => (
              <article key={c.t} className="celu-item">
                <span className="ico"><Ico d={c.ico} /></span>
                <h3>{c.t}</h3>
                <p>{c.p}</p>
              </article>
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
              <h2>Esta noche tu link ya puede estar tomando pedidos.</h2>
              <p>14 días gratis con todos los módulos. Sin tarjeta y sin comisión por venta.</p>
            </div>
            <Link href="/registro" className="btn large">Empezar gratis</Link>
          </div>
        </section>
      </main>

      <footer className="footer" style={{ marginTop: 0 }}>
        <div className="container row between">
          <span>© {new Date().getFullYear()} HakkiraApp</span>
          <Link href="/legal" style={{ color: 'var(--muted)' }}>Términos y privacidad</Link>
        </div>
      </footer>
    </>
  );
}
