import Link from 'next/link';
import { getContext } from '@/lib/session';
import { signOut } from './actions';
import Logo from '../logo';
import Sidebar from './sidebar';

export const dynamic = 'force-dynamic';

function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'AF';
}

export default async function AppLayout({ children }) {
  const { bakery, access, user } = await getContext();
  const daysLeft = access.trial ? Math.max(0, Math.ceil((new Date(access.trialEnds) - new Date()) / 86400000)) : null;

  if (!bakery) {
    return (
      <>
        <header className="app-top">
          <div className="app-top-in">
            <Logo href="/app" />
            <div className="end">
              <form action={signOut}><button className="btn secondary small">Salir ({user.email})</button></form>
            </div>
          </div>
        </header>
        <main className="container page fade-in">{children}</main>
      </>
    );
  }

  return (
    <>
      <header className="app-top no-print">
        <div className="app-top-in">
          <Logo href="/app" />
          <span className="sep" aria-hidden="true" />
          <span className="biz">{bakery.name}</span>
          {access.trial && <Link href="/app/plan" className="badge warn">Prueba gratis · {daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`}</Link>}
          {!access.base && <Link href="/app/plan" className="badge bad">Plan inactivo</Link>}
          <div className="end">
            <a className="btn secondary small" href={`/c/${bakery.slug}`} target="_blank" rel="noreferrer">
              Mi catálogo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
            </a>
            <Link className="btn dark small" href="/cocina">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 13.9A4 4 0 0 1 7.5 6a5 5 0 0 1 9 0A4 4 0 0 1 18 13.9V21H6z" /><path d="M6 17h12" /></svg>
              Modo cocina
            </Link>
            <span className="avatar" aria-hidden="true">{initials(bakery.name)}</span>
            <form action={signOut}><button className="btn secondary small">Salir</button></form>
          </div>
        </div>
      </header>
      <div className="shell">
        <Sidebar />
        <main className="content fade-in">
          {!access.base && (
            <div className="alert bad">Tu prueba terminó o la suscripción no está activa: tu catálogo y el bot no toman pedidos nuevos. <Link href="/app/plan">Activar plan</Link></div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
