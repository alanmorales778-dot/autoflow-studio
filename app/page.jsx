import Link from 'next/link';
import { PRICES } from '@/lib/modules';
import { money } from '@/lib/format';

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link href="/" className="logo">AutoFlow <span>Cocina</span></Link>
          <nav className="nav">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <Link href="/login">Ingresar</Link>
            <Link href="/registro" className="btn small">Probar gratis</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero container">
          <span className="badge">Para pastelerías, viandas y cocina casera</span>
          <h1 style={{ marginTop: 16 }}>Dejá de responder pedidos a las 11 de la noche y de vender a pérdida.</h1>
          <p>
            AutoFlow Cocina ordena tus pedidos por día, bloquea los cupos cuando el horno no da más, cobra la seña con
            Mercado Pago y recalcula el costo de tus recetas cada vez que actualizás un precio, subiendo un Excel o desde Google Drive.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href="/registro" className="btn">Empezar 14 días gratis</Link>
            <a href="#como-funciona" className="btn secondary">Ver cómo funciona</a>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>Sin tarjeta para la prueba. Cancelás cuando quieras.</p>
        </section>

        <section id="como-funciona" className="container">
          <div className="grid grid-3">
            <div className="card feature">
              <span className="badge">1 · Agenda y señas</span>
              <h3>Nunca más dos tortas de más para el sábado</h3>
              <p>Definís cuántas unidades podés hacer por día. Cuando se llena, la fecha se cierra sola. Tus clientes piden desde tu link y pagan el 50% de seña; si no pagan en 30 minutos, el cupo se libera.</p>
            </div>
            <div className="card feature">
              <span className="badge">2 · Costos y stock desde Excel o Drive</span>
              <h3>Subió la manteca: tus precios se recalculan</h3>
              <p>Subís tu Excel de insumos o los actualizás en Google Drive. AutoFlow recalcula el costo de cada receta, te dice el precio mínimo para ganar tu margen y te avisa qué productos estás vendiendo a pérdida.</p>
            </div>
            <div className="card feature">
              <span className="badge">3 · Bot de WhatsApp</span>
              <h3>Tus clientes piden solos por WhatsApp</h3>
              <p>Muestra tu catálogo, toma el pedido, ofrece fechas con cupo, manda el link de seña y confirma cuando se paga. Vos solo ves los pedidos confirmados en tu agenda.</p>
            </div>
          </div>
        </section>

        <section id="precios" className="container" style={{ marginTop: 48 }}>
          <h2>Precios</h2>
          <p className="muted">Arrancás con la base y sumás módulos cuando los necesitás. Precios finales en pesos, por mes.</p>
          <div className="grid grid-3">
            <div className="card">
              <h3>Base: Agenda + Señas</h3>
              <div className="price">{money(PRICES.base)}</div>
              <p className="muted">por mes</p>
              <ul>
                <li>Catálogo online con tu link</li>
                <li>Cupos por día y franja horaria</li>
                <li>Seña con Mercado Pago que vence sola</li>
                <li>Productos y stock desde Excel o Google Drive</li>
              </ul>
            </div>
            <div className="card">
              <h3>+ Costos</h3>
              <div className="price">+{money(PRICES.costs)}</div>
              <p className="muted">por mes</p>
              <ul>
                <li>Recetas con costo real</li>
                <li>Precio mínimo según tu margen</li>
                <li>Alertas de venta a pérdida</li>
                <li>Recálculo al cambiar un insumo</li>
              </ul>
            </div>
            <div className="card">
              <h3>+ Bot de WhatsApp</h3>
              <div className="price">+{money(PRICES.whatsapp)}</div>
              <p className="muted">por mes + costo de mensajes de Meta</p>
              <ul>
                <li>Toma pedidos 24/7</li>
                <li>Ofrece solo fechas con cupo</li>
                <li>Cobra la seña y confirma solo</li>
                <li>Libera el cupo si no pagan</li>
              </ul>
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <Link href="/registro" className="btn">Probar todo gratis 14 días</Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container row between">
          <span>© {new Date().getFullYear()} AutoFlow Studio</span>
          <Link href="/legal">Términos y privacidad</Link>
        </div>
      </footer>
    </>
  );
}
