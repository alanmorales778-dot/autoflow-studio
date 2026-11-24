import Link from 'next/link';
import { getContext } from '@/lib/session';
import { signOut } from './actions';
import Logo from '../logo';
import Sidebar, { BottomNav } from './sidebar';
import Bell from './bell';
import InstallPrompt from './install-prompt';
import { vapidPublicKey } from '@/lib/webpush';
import { rubroOf } from '@/lib/rubros';
import { createAdmin } from '@/lib/supabase';
import Feedback from './feedback';

export const dynamic = 'force-dynamic';

function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'AF';
}

export default async function AppLayout({ children }) {
  const { supabase, bakery, access, user } = await getContext();
  const T = bakery ? rubroOf(bakery) : null;
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

  const { data: notifications } = await supabase.from('notifications').select('id,kind,title,body,url,read_at,created_at')
    .eq('bakery_id', bakery.id).order('created_at', { ascending: false }).limit(30);
  let isPilot = false;
  try {
    const { data: pp } = await createAdmin().from('pilot_participants').select('status').eq('bakery_id', bakery.id).maybeSingle();
    isPilot = !!pp && pp.status !== 'abandonado';
  } catch {}
  const showFeedback = isPilot || bakery.is_test;
  const terms = { items: T.items, insumos: T.insumos, workMode: T.workMode, orders: T.orders, order: T.order, prodTitle: T.prodTitle, recurring: access.recurring, recetas: T.key === 'cocina' ? 'Recetas' : 'Fichas de costo' };

  return (
    <>
      <header className="app-top no-print">
        <div className="app-top-in">
          <Logo href="/app" />
          <span className="sep" aria-hidden="true" />
          <span className="biz">{bakery.name}</span>
          {access.trial && <Link href="/app/plan" className="badge warn trial-badge"><span className="hide-mobile">Prueba gratis · </span>{daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`}</Link>}
          {!access.base && <Link href="/app/plan" className="badge bad">Plan inactivo</Link>}
          <div className="end">
            <form action="/app/buscar" className="top-search hide-mobile" role="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" /></svg>
              <input name="q" placeholder="Buscar…" aria-label={`Buscar ${T.orders.toLowerCase()}, clientes o ${T.items.toLowerCase()}`} />
            </form>
            <a className="btn secondary small hide-mobile" href={`/c/${bakery.slug}`} target="_blank" rel="noreferrer">
              Mi catálogo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
            </a>
            <Link className="btn dark small hide-mobile" href="/cocina">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 13.9A4 4 0 0 1 7.5 6a5 5 0 0 1 9 0A4 4 0 0 1 18 13.9V21H6z" /><path d="M6 17h12" /></svg>
              {T.workMode}
            </Link>
            <Bell initial={notifications || []} vapidKey={vapidPublicKey()} />
            <Link href="/app/configuracion#negocio" className={`avatar ${bakery.logo_url ? 'has-logo' : ''}`} title="Tu negocio">{bakery.logo_url ? <img src={bakery.logo_url} alt="" /> : initials(bakery.name)}</Link>
            <form action={signOut} className="hide-mobile"><button className="btn secondary small">Salir</button></form>
          </div>
        </div>
      </header>
      <div className="shell">
        <Sidebar terms={terms} />
        <main className="content fade-in">
          {access.status === 'suspended' && (
            <div className="alert bad">Tu cuenta está suspendida: tu link no toma pedidos. Escribinos para reactivarla.</div>
          )}
          {!access.base && access.status !== 'suspended' && (
            <div className="alert bad">Tu prueba terminó o la suscripción no está activa: tu catálogo y el bot no toman pedidos nuevos. <Link href="/app/plan">Activar plan</Link></div>
          )}
          {children}
        </main>
      </div>
      <BottomNav terms={terms} catalogUrl={`/c/${bakery.slug}`} signOutAction={signOut} />
      <InstallPrompt />
      {showFeedback && <Feedback />}
    </>
  );
}
