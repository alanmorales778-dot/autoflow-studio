import Link from 'next/link';
import { getContext } from '@/lib/session';
import { signOut } from './actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  const { bakery, access, user } = await getContext();
  const daysLeft = access.trial ? Math.max(0, Math.ceil((new Date(access.trialEnds) - new Date()) / 86400000)) : null;
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link href="/app" className="logo">AutoFlow <span>Cocina</span></Link>
          {bakery ? (
            <nav className="nav">
              <Link href="/app">Agenda</Link>
              <Link href="/app/pedidos">Pedidos</Link>
              <Link href="/app/productos">Productos</Link>
              <Link href="/app/insumos">Insumos</Link>
              <Link href="/app/configuracion">Configuración</Link>
              <Link href="/app/plan">Plan</Link>
              <a href={`/c/${bakery.slug}`} target="_blank" rel="noreferrer">Mi catálogo ↗</a>
              <form action={signOut}><button className="btn secondary small" style={{ marginLeft: 6 }}>Salir</button></form>
            </nav>
          ) : (
            <form action={signOut}><button className="btn secondary small">Salir ({user.email})</button></form>
          )}
        </div>
      </header>
      <main className="container page">
        {bakery && access.trial && (
          <div className="alert info">Prueba gratis: te quedan <strong>{daysLeft} días</strong> con todos los módulos. <Link href="/app/plan">Elegir plan</Link></div>
        )}
        {bakery && !access.base && (
          <div className="alert bad">Tu prueba terminó o la suscripción no está activa: tu catálogo y el bot no toman pedidos nuevos. <Link href="/app/plan">Activar plan</Link></div>
        )}
        {children}
      </main>
    </>
  );
}
