import Link from 'next/link';
import { PRICES } from '@/lib/modules';
import Logo from './logo';
import PlanBuilder from './plan-builder';

const Ico = ({ d, color = '#C2410C', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p) => <path key={p} d={p} />)}
  </svg>
);

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Logo />
          <nav className="nav" aria-label="Principal">
            <a href="#como-funciona">Cómo funciona</a>
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
              <span className="pill"><span className="dot" />Pastelerías · viandas · cocina casera · hamburgueserías</span>
              <h1>Dejá de responder pedidos a las 11 de la noche y de vender a pérdida.</h1>
              <p className="lead">
                Tus clientes piden solos desde tu link. La agenda cierra el día cuando el horno o la plancha no dan más, la seña entra por Mercado Pago y, cuando sube un
                ingrediente, AutoFlow recalcula el costo de cada receta y te dice a cuánto vender.
              </p>
              <div className="row" style={{ marginTop: 28 }}>
                <Link href="/registro" className="btn large">
                  Empezar 14 días gratis
                  <Ico d={['M5 12h14', 'm13 6 6 6-6 6']} color="currentColor" size={18} />
                </Link>
                <a href="#como-funciona" className="btn large secondary">Ver cómo funciona</a>
              </div>
              <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>Sin tarjeta para la prueba. Cancelás cuando quieras.</p>
            </div>

            <div className="mock" role="img" aria-label="Animación: llega un pedido a las 23:14, se cobra la seña, el sábado se completa y aparece una alerta de costo">
              <div className="mock-win">
                <div className="mock-bar">
                  <i /><i /><i />
                  <span className="mock-url">tu panel de AutoFlow</span>
                  <span className="mock-clock"><Ico d={['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z']} color="currentColor" size={14} />23:14</span>
                </div>
                <div className="mock-body">
                  <div className="row between" style={{ alignItems: 'baseline' }}>
                    <strong className="disp" style={{ fontSize: 18 }}>Sábado 22</strong>
                    <small>Ejemplo</small>
                  </div>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="row between" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                      <strong>Cupo de horno · Tortas</strong>
                      <span style={{ position: 'relative', minWidth: 130, textAlign: 'right' }}>
                        <span className="swap-a num" style={{ position: 'absolute', right: 0 }}>5 de 6</span>
                        <span className="swap-b" style={{ position: 'absolute', right: 0, color: 'var(--bad)', fontWeight: 700 }}>Completo · cerrado</span>&nbsp;
                      </span>
                    </div>
                    <div className="bar"><div className="fillbar" /></div>
                  </div>
                  <div className="mock-card n n1" style={{ alignItems: 'flex-start', boxShadow: '0 10px 24px -16px rgba(31,25,21,.35)' }}>
                    <span className="ic pulse" style={{ background: 'var(--brand-soft)' }}><Ico d={['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0']} size={18} /></span>
                    <div><strong>Nuevo pedido desde tu link</strong><div className="sub">Torta Rogel · sáb 22 · 10 a 13 h · Martina G.</div></div>
                  </div>
                  <div className="mock-card n n2" style={{ borderColor: '#c9e8d3', background: '#f4fbf6' }}>
                    <span className="ic" style={{ background: 'var(--ok-soft)' }}><Ico d={['m5 12 5 5 9-10']} color="#15803D" size={18} /></span>
                    <div style={{ flex: 1 }}><strong>Seña cobrada</strong> <span className="sub">· Mercado Pago</span></div>
                    <strong className="disp num" style={{ color: 'var(--ok)' }}>$ 18.500</strong>
                  </div>
                  <div className="mock-card n n3">
                    <span className="ic" style={{ background: 'var(--sunken)' }}><Ico d={['M8 2v4M16 2v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm9 16 2 2 4-4']} color="#4A3F37" size={18} /></span>
                    <div><strong>Sábado 22 completo</strong> <span className="sub">· tu link ya no lo ofrece</span></div>
                  </div>
                  <div className="mock-card n n4" style={{ flexDirection: 'column', alignItems: 'stretch', borderColor: 'var(--warn-line)', background: '#fffaf1', position: 'relative' }}>
                    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <span className="ic" style={{ background: 'var(--warn-soft)' }}><Ico d={['M3 17 9 11l4 4 8-8', 'M14 7h7v7']} color="#B45309" size={18} /></span>
                      <div><strong>Subió la manteca 14 %</strong><div className="sub">La Rogel quedó con 9 % de margen. Precio sugerido: <strong className="num">$ 38.900</strong></div></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
                      <span className="mock-btn"><span className="lbl-a">Actualizar precio</span><span className="lbl-b">Actualizado</span></span>
                      <svg className="mock-cursor" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2v18l5-5 3.5 7 3-1.5L12 13.5h7z" fill="#1F1915" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="section container">
          <span className="eyebrow">Cómo funciona</span>
          <h2 className="big">Tres cosas que hoy hacés a mano, resueltas solas.</h2>
          <div className="grid grid-3" style={{ marginTop: 36 }}>
            <article className="card feature">
              <span className="ico"><Ico d={['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7']} /></span>
              <small style={{ fontWeight: 600 }}>01 · Tu link de pedidos</small>
              <h3>Te piden a cualquier hora, sin escribirte</h3>
              <p>Lo ponés en Instagram o en tu estado de WhatsApp. El cliente elige producto, fecha y franja, y deja sus datos. Vos te levantás con los pedidos ordenados.</p>
            </article>
            <article className="card feature">
              <span className="ico"><Ico d={['M8 2v4M16 2v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']} /></span>
              <small style={{ fontWeight: 600 }}>02 · Cupos y seña</small>
              <h3>El día se cierra cuando el horno no da más</h3>
              <p>Definís cuántas tortas o cuántas hamburguesas salen por día. Al llenarse, la fecha desaparece del link. La seña se cobra con Mercado Pago y, si no la pagan a tiempo, el cupo se libera solo.</p>
            </article>
            <article className="card feature">
              <span className="ico"><Ico d={['M3 17 9 11l4 4 8-8', 'M14 7h7v7']} /></span>
              <small style={{ fontWeight: 600 }}>03 · Costos al día</small>
              <h3>Sube la harina, se recalcula tu precio</h3>
              <p>Cargás tus insumos con un Excel o desde Google Drive. Cada receta tiene su costo real, tu precio mínimo para ganar el margen que elegiste y una alerta si estás vendiendo a pérdida.</p>
            </article>
          </div>
        </section>

        <section id="precios" className="section container" style={{ paddingBottom: 88 }}>
          <PlanBuilder prices={PRICES} />
        </section>

        <section className="container" style={{ paddingBottom: 88 }}>
          <div className="cta-band">
            <div style={{ maxWidth: 620 }}>
              <h2>Esta noche, que los pedidos se tomen solos.</h2>
              <p>Lo configurás en una tarde: cargás tus productos con un Excel, ponés tus cupos y compartís el link.</p>
            </div>
            <Link href="/registro" className="btn large">Empezar 14 días gratis</Link>
          </div>
        </section>
      </main>

      <footer className="footer" style={{ marginTop: 0 }}>
        <div className="container row between">
          <span>© {new Date().getFullYear()} AutoFlow Cocina</span>
          <Link href="/legal" style={{ color: 'var(--muted)' }}>Términos y privacidad</Link>
        </div>
      </footer>
    </>
  );
}
