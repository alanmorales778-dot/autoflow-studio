import Link from 'next/link';
import { getContext } from '@/lib/session';
import { createBakery, changeOrderStatus, loadExampleData, dismissOnboarding } from './actions';
import { onboardingSteps } from '@/lib/onboarding';
import { Flash, StatusBadge } from './ui';
import { todayAR, addDays, dateLabel, weekdayOf, money, slugify } from '@/lib/format';
import { isHolding } from '@/lib/orders';
import { appUrl } from '@/lib/env';
import { balanceDue, reminderLink } from '@/lib/balance';
import { optionsSummary } from '@/lib/options';
import { productionOrders, shoppingList } from '@/lib/production';

export default async function Agenda({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, user, access } = await getContext();

  if (!bakery) {
    const suggested = user.user_metadata?.business_name || '';
    return (
      <div className="narrow" style={{ marginTop: 0 }}>
        <div className="card">
          <h1>Configurá tu negocio</h1>
          <p className="muted">Un paso y ya tenés tu link de pedidos.</p>
          <Flash sp={sp} />
          <form action={createBakery}>
            <div className="field">
              <label>Nombre del emprendimiento</label>
              <input name="name" required defaultValue={suggested} />
            </div>
            <div className="field">
              <label>Tu link de pedidos</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{appUrl().replace(/^https?:\/\//, '')}/c/</span>
                <input name="slug" defaultValue={slugify(suggested)} placeholder="dulce-lola" />
              </div>
            </div>
            <div className="field">
              <label>WhatsApp de contacto (opcional)</label>
              <input name="whatsapp" placeholder="11 5555-5555" />
            </div>
            <button className="btn block">Crear mi negocio</button>
          </form>
        </div>
      </div>
    );
  }

  const today = todayAR();
  const until = addDays(today, 13);
  const [{ data: orders }, { data: rules }, { data: products }, { data: blocked }] = await Promise.all([
    supabase.from('orders').select('*').eq('bakery_id', bakery.id).gte('date', today).lte('date', until).in('status', ['pendiente_sena', 'confirmado', 'entregado']).order('date').order('created_at'),
    supabase.from('capacity_rules').select('*').eq('bakery_id', bakery.id),
    supabase.from('products').select('id,name,price,min_price,cost_error').eq('bakery_id', bakery.id).not('sheet_row', 'is', null),
    supabase.from('blocked_dates').select('date').eq('bakery_id', bakery.id).gte('date', today).lte('date', until),
  ]);
  const { data: unpaid } = await supabase
    .from('orders')
    .select('total,deposit_amount,paid_at,balance_paid_at')
    .eq('bakery_id', bakery.id)
    .in('status', ['confirmado', 'entregado'])
    .is('balance_paid_at', null)
    .lt('date', today)
    .limit(500);
  const owed = (unpaid || []).map(balanceDue).filter((n) => n > 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: paidWeek } = await supabase.from('orders').select('deposit_amount').eq('bakery_id', bakery.id).gte('paid_at', weekAgo).limit(1000);
  const depositsWeek = (paidWeek || []).reduce((s, o) => s + Number(o.deposit_amount || 0), 0);
  let shopping = null;
  if (access.costs) {
    const soon = await productionOrders(supabase, bakery.id, today, addDays(today, 2));
    const ids = [...new Set(soon.map((o) => o.product_id).filter(Boolean))];
    if (ids.length) {
      const [{ data: items }, { data: ingredients }] = await Promise.all([
        supabase.from('recipe_items').select('*').in('product_id', ids),
        supabase.from('ingredients').select('*').eq('bakery_id', bakery.id),
      ]);
      const list = shoppingList(soon, items || [], ingredients || []);
      if (list.rows.length) shopping = { rows: [...list.rows].sort((a, b) => (b.exactCost || 0) - (a.exactCost || 0)), orders: soon.length, total: list.rows.reduce((s, r) => s + (r.estCost || 0), 0) };
    }
  }
  const onboarding = bakery.onboarding_dismissed_at ? null : await onboardingSteps(supabase, bakery, access);
  const showOnboarding = onboarding && onboarding.done < onboarding.total;
  const now = new Date();
  const active = (orders || []).filter((o) => o.status !== 'pendiente_sena' || isHolding(o, now));
  const blockedSet = new Set((blocked || []).map((b) => b.date));
  const underMin = access.costs ? (products || []).filter((p) => p.min_price && Number(p.price) < Number(p.min_price)) : [];
  const catalogUrl = `${appUrl()}/c/${bakery.slug}`;
  const tomorrowOrders = active.filter((o) => o.date === addDays(today, 1) && o.status === 'confirmado');
  const todayOrders = active.filter((o) => o.date === today);
  const todayWaiting = todayOrders.filter((o) => o.status === 'pendiente_sena').length;
  const upcomingBalance = active.filter((o) => o.status === 'confirmado').reduce((s, o) => s + balanceDue(o), 0);

  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const dayOrders = active.filter((o) => o.date === d);
    const wd = weekdayOf(d);
    const dayRules = (rules || []).filter((r) => r.weekday === wd);
    const usage = dayRules.map((r) => ({
      label: r.category === '*' ? 'Total' : r.category,
      max: r.max_units,
      used: dayOrders.filter((o) => o.status !== 'cancelado' && (r.category === '*' || o.category === r.category)).reduce((s, o) => s + o.quantity, 0),
    }));
    days.push({ d, dayOrders, usage });
  }
  const todayCap = days[0].usage.find((u) => u.label === 'Total') || days[0].usage[0] || null;

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Agenda</h1>
          <p>Próximos 14 días · {dateLabel(today)} es hoy</p>
        </div>
        <div className="row">
          <Link href="/cocina" className="btn secondary small">Modo cocina</Link>
          <Link href="/app/pedidos#nuevo" className="btn small">+ Cargar pedido</Link>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <span className="l">Pedidos para hoy</span>
          <span className="v">{todayOrders.length}</span>
          <small>{todayWaiting ? `${todayWaiting} esperando seña` : todayOrders.length ? 'Todos confirmados' : 'Día libre'}</small>
        </div>
        <div className="card kpi">
          <span className="l">Señas cobradas · últimos 7 días</span>
          <span className="v">{money(depositsWeek)}</span>
          <small>{bakery.mp_access_token_enc ? 'Por Mercado Pago' : 'Conectá Mercado Pago para cobrarlas solas'}</small>
        </div>
        <div className="card kpi">
          <span className="l">Saldo por cobrar · 14 días</span>
          <span className="v">{money(upcomingBalance)}</span>
          <small>al entregar</small>
        </div>
        <div className="card kpi">
          <span className="l">Cupo de hoy</span>
          {todayCap ? (
            <>
              <span className="v">{todayCap.used} / {todayCap.max}</span>
              <div className={`bar ${todayCap.used >= todayCap.max ? 'full' : ''}`}><span style={{ width: `${Math.min(100, Math.round((todayCap.used / Math.max(1, todayCap.max)) * 100))}%` }} /></div>
            </>
          ) : (
            <>
              <span className="v">Sin límite</span>
              <small><Link href="/app/configuracion#cupos">Poner cupos</Link></small>
            </>
          )}
        </div>
      </div>

      {shopping && (
        <div className="card callout warn">
          <span className="ico" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
          </span>
          <div style={{ flex: '1 1 320px' }}>
            <strong>Compras para los próximos 3 días</strong>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 2 }}>
              Según las recetas de {shopping.orders} {shopping.orders === 1 ? 'pedido' : 'pedidos'} vas a usar{' '}
              {shopping.rows.slice(0, 4).map((r) => `${r.needed} de ${r.name.toLowerCase()}`).join(', ')}
              {shopping.rows.length > 4 ? ` y ${shopping.rows.length - 4} insumos más` : ''}
              {shopping.total ? ` (unos ${money(shopping.total)})` : ''}. Revisá qué te falta.
            </div>
          </div>
          <Link className="btn small" href={`/app/produccion?desde=${today}&hasta=${addDays(today, 2)}`}>Ver lista de compras</Link>
        </div>
      )}

      {showOnboarding ? (
        <div className="card onboarding">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Primeros pasos · {onboarding.done} de {onboarding.total}</h2>
            <form action={dismissOnboarding}><button className="btn secondary small">Ocultar</button></form>
          </div>
          <div className="progress"><span style={{ width: `${Math.round((onboarding.done / onboarding.total) * 100)}%` }} /></div>
          <ol className="steps">
            {onboarding.steps.map((st) => (
              <li key={st.key} className={st.done ? 'done' : ''}>
                <span className="check" aria-hidden="true">{st.done ? '✓' : ''}</span>
                <div style={{ flex: 1 }}>
                  <strong>{st.title}</strong>
                  {!st.done && <div className="muted" style={{ fontSize: 13 }}>{st.hint}</div>}
                </div>
                {!st.done && (
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    {st.example && !bakery.sheet_productos_id && (
                      <form action={loadExampleData}><button className="btn secondary small">Usar ejemplo</button></form>
                    )}
                    {st.external ? (
                      <a className="btn small" href={st.href} target="_blank" rel="noreferrer">Abrir ↗</a>
                    ) : (
                      <Link className="btn small" href={st.href}>Ir</Link>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          {!bakery.sheet_productos_id && !(products || []).length && (
            <div className="alert warn">Cargá tus productos: <Link href="/app/productos">subí un Excel o CSV</Link> o <Link href="/app/configuracion#drive">conectá Google Drive</Link> para que se actualicen solos.</div>
          )}
          {!bakery.mp_access_token_enc && (
            <div className="alert warn">Conectá Mercado Pago para cobrar señas automáticas. Mientras tanto, los pedidos quedan pendientes y coordinás el pago a mano. <Link href="/app/configuracion#mercadopago">Conectar</Link></div>
          )}
        </>
      )}
      {bakery.last_sync_error && <div className="alert bad">Problema con tus planillas: {bakery.last_sync_error}</div>}
      {owed.length > 0 && (
        <div className="alert warn">
          Te deben <strong>{money(owed.reduce((a, b) => a + b, 0))}</strong> de {owed.length} {owed.length === 1 ? 'pedido que ya pasó' : 'pedidos que ya pasaron'}. <Link href="/app/cobros">Ver y recordar</Link>
        </div>
      )}
      {underMin.length > 0 && (
        <div className="alert bad">
          <strong>{underMin.length} {underMin.length === 1 ? 'producto está' : 'productos están'} por debajo de tu margen:</strong>{' '}
          {underMin.slice(0, 4).map((p) => `${p.name} (${money(p.price)}, mínimo ${money(p.min_price)})`).join(' · ')}{' '}
          <Link href="/app/productos">Revisar precios</Link>
        </div>
      )}

      {tomorrowOrders.length > 0 && (
        <div className="card">
          <h2>Mañana: {tomorrowOrders.length} {tomorrowOrders.length === 1 ? 'entrega' : 'entregas'}</h2>
          <p className="muted">Mandales un recordatorio con el saldo y el link de pago. Se abre tu WhatsApp con el mensaje listo.</p>
          {tomorrowOrders.map((o) => {
            const link = o.customer_phone ? reminderLink(bakery, o) : null;
            return (
              <div key={o.id} className="order-line row between">
                <span>{o.customer_name} · {o.quantity} × {o.product_name}{o.slot ? ` · ${o.slot}` : ''}{balanceDue(o) > 0 ? ` · saldo ${money(balanceDue(o))}` : ' · pagado'}</span>
                {link ? <a className="btn small" href={link} target="_blank" rel="noreferrer">Recordar</a> : <small className="muted">sin teléfono</small>}
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="row between">
          <div>
            <strong>Tu link de pedidos:</strong> <a href={catalogUrl} target="_blank" rel="noreferrer">{catalogUrl}</a>
          </div>
          <span className="muted">Compartilo en Instagram y WhatsApp</span>
        </div>
      </div>

      <div className="grid grid-2">
        {days.map(({ d, dayOrders, usage }) => (
          <div key={d} className={`card day ${dayOrders.length ? '' : 'empty'} ${d === today ? 'today' : ''}`} style={{ marginBottom: 0 }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{d === today ? 'Hoy · ' : ''}{dateLabel(d)}</h3>
              {blockedSet.has(d) ? <span className="badge bad">Bloqueado</span> : null}
            </div>
            {usage.length > 0 && (
              <div className="row" style={{ margin: '6px 0' }}>
                {usage.map((u) => (
                  <span key={u.label} className={`badge ${u.used >= u.max ? 'bad' : u.used >= u.max * 0.75 ? 'warn' : 'ok'}`}>
                    {u.label}: {u.used}/{u.max}
                  </span>
                ))}
              </div>
            )}
            {dayOrders.length === 0 ? (
              <p className="muted" style={{ margin: '6px 0 0' }}>Sin pedidos</p>
            ) : (
              dayOrders.map((o) => (
                <div key={o.id} className="order-line">
                  <div className="row between">
                    <strong>{o.quantity} × {o.product_name}</strong>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ''}{o.slot ? ` · ${o.slot}` : ''} · {o.fulfillment === 'envio' ? `Envío: ${o.address}` : 'Retira'}
                    {o.options?.length > 0 && <><br />{optionsSummary(o.options)}</>}
                    {o.dedication && <><br />Dedicatoria: «{o.dedication}»</>}
                    {balanceDue(o) > 0 && o.status !== 'pendiente_sena' && <><br />Saldo a cobrar: {money(balanceDue(o))}</>}
                  </div>
                  {o.allergies && <span className="badge bad">⚠ {o.allergies}</span>}
                  {o.status === 'confirmado' && (
                    <form action={changeOrderStatus} style={{ marginTop: 6 }}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="status" value="entregado" />
                      <input type="hidden" name="back" value="/app" />
                      <button className="btn secondary small">Marcar entregado</button>
                    </form>
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </>
  );
}
