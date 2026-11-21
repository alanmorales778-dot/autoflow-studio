import Link from 'next/link';
import { getContext } from '@/lib/session';
import { createBakery, changeOrderStatus, loadExampleData, dismissOnboarding } from './actions';
import { onboardingSteps } from '@/lib/onboarding';
import { Flash, StatusBadge } from './ui';
import CopyLink from './copy-link';
import { todayAR, addDays, dateLabel, weekdayOf, money, slugify } from '@/lib/format';
import { isHolding } from '@/lib/orders';
import { appUrl } from '@/lib/env';
import { balanceDue, reminderLink } from '@/lib/balance';
import { optionsSummary } from '@/lib/options';
import { productionOrders, shoppingList } from '@/lib/production';
import { RUBROS, RUBRO_KEYS, rubroOf } from '@/lib/rubros';
import { slotLoad } from '@/lib/slots';

export default async function Agenda({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, user, access } = await getContext();

  if (!bakery) {
    const suggested = user.user_metadata?.business_name || '';
    const r = rubroOf(user.user_metadata?.business_type);
    return (
      <div className="narrow" style={{ marginTop: 0 }}>
        <div className="card">
          <h1>Configurá tu negocio</h1>
          <p className="muted">Un paso y ya tenés tu link de pedidos.</p>
          <Flash sp={sp} />
          <form action={createBakery}>
            <div className="field">
              <label>Rubro</label>
              <select name="business_type" defaultValue={r.key}>
                {RUBRO_KEYS.map((k) => <option key={k} value={k}>{RUBROS[k].label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Nombre del emprendimiento</label>
              <input name="name" required defaultValue={suggested} placeholder={r.bizPh} />
            </div>
            <div className="field">
              <label>Tu link de pedidos</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{appUrl().replace(/^https?:\/\//, '')}/c/</span>
                <input name="slug" defaultValue={slugify(suggested)} placeholder={r.slugPh} />
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

  const T = rubroOf(bakery);
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

  // Todo lo que hay que mirar, en una sola lista (antes eran varios avisos sueltos)
  const todo = [];
  if (bakery.last_sync_error) todo.push({ tone: 'bad', text: <>Problema con tus planillas: {bakery.last_sync_error}</>, href: '/app/configuracion#drive', cta: 'Revisar' });
  if (owed.length > 0) todo.push({ tone: 'warn', text: <>Te deben <strong>{money(owed.reduce((a, b) => a + b, 0))}</strong> de {owed.length} {owed.length === 1 ? `${T.order} que ya pasó` : `${T.orders.toLowerCase()} que ya pasaron`}.</>, href: '/app/cobros', cta: 'Cobrar' });
  if (underMin.length > 0) todo.push({ tone: 'bad', text: <><strong>{underMin.length} {underMin.length === 1 ? `${T.item} está` : `${T.items.toLowerCase()} están`} por debajo de tu margen</strong>: {underMin.slice(0, 3).map((p) => p.name).join(', ')}{underMin.length > 3 ? '…' : ''}</>, href: '/app/productos', cta: 'Ver precios' });
  if (!bakery.pickup_address && active.some((o) => o.fulfillment === 'retiro')) todo.push({ tone: 'warn', text: <>Tenés {T.orders.toLowerCase()} «{T.retiro.toLowerCase()}» y falta tu dirección.</>, href: '/app/configuracion', cta: 'Cargar' });
  if (shopping) todo.push({ tone: 'info', text: <>Para los próximos 3 días vas a usar {shopping.rows.slice(0, 3).map((r) => r.name.toLowerCase()).join(', ')}{shopping.rows.length > 3 ? ` y ${shopping.rows.length - 3} más` : ''}{shopping.total ? ` (unos ${money(shopping.total)})` : ''}.</>, href: `/app/produccion?desde=${today}&hasta=${addDays(today, 2)}&ver=compras`, cta: 'Lista de compras' });
  if (!showOnboarding && !bakery.sheet_productos_id && !(products || []).length) todo.push({ tone: 'warn', text: <>Todavía no cargaste tus {T.items.toLowerCase()}.</>, href: '/app/productos', cta: 'Cargar' });
  if (!showOnboarding && !bakery.mp_access_token_enc) todo.push({ tone: 'info', text: <>Conectá Mercado Pago para cobrar las señas solas.</>, href: '/app/configuracion#mercadopago', cta: 'Conectar' });

  if (tomorrowOrders.length > 0) todo.push({ tone: 'info', text: <>Mañana {tomorrowOrders.length === 1 ? 'tenés 1' : `tenés ${tomorrowOrders.length}`} {tomorrowOrders.length === 1 ? T.order : T.orders.toLowerCase()}. Mandá el recordatorio con el saldo.</>, href: `/app?dia=${addDays(today, 1)}#dia`, cta: 'Recordar' });

  const sel = days.find((x) => x.d === sp?.dia) || days[0];
  const selDate = sel.d;
  const selOrders = [...sel.dayOrders].sort((a, b) => (a.slot || '99').localeCompare(b.slot || '99'));
  const groups = [];
  for (const o of selOrders) {
    const key = o.slot || '';
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(o); else groups.push({ key, items: [o] });
  }
  const selCap = sel.usage.find((u) => u.label === 'Total') || sel.usage[0] || null;
  const selBalance = selOrders.filter((o) => o.status !== 'pendiente_sena').reduce((s, o) => s + balanceDue(o), 0);
  const selWaiting = selOrders.filter((o) => o.status === 'pendiente_sena').length;
  const isToday = selDate === today;
  const isTomorrow = selDate === addDays(today, 1);
  const dayTitle = isToday ? 'Hoy' : isTomorrow ? 'Mañana' : dateLabel(selDate);
  const maxCount = Math.max(1, ...days.map((x) => x.dayOrders.length));
  const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const loadSlots = bakery.slot_capacity && (bakery.slots || []).length > 0
    ? slotLoad(bakery.slots, sel.dayOrders.filter((o) => o.status === 'entregado' || isHolding(o)))
    : null;

  return (
    <>
      <Flash sp={sp} />

      {showOnboarding && (
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
      )}

      <div className="hoy-layout">
        <section className="hoy" id="dia" aria-label="Tu día">
          <header className="hoy-head">
            <div>
              <p className="hoy-date">{isToday || isTomorrow ? dateLabel(selDate) : (blockedSet.has(selDate) ? 'Día bloqueado' : 'Próximo')}</p>
              <h1 className="hoy-title">{dayTitle}</h1>
              <p className="hoy-sum">
                {selOrders.length === 0
                  ? (isToday ? 'Día libre. Buen momento para preparar lo que viene.' : 'Sin nada agendado.')
                  : <>{selOrders.length} {selOrders.length === 1 ? T.order : T.orders.toLowerCase()}{selBalance > 0 ? <> · <strong>{money(selBalance)}</strong> a cobrar</> : ''}{selWaiting ? ` · ${selWaiting} sin seña` : ''}</>}
              </p>
            </div>
            <div className="hoy-actions">
              <CopyLink value={catalogUrl} label="Copiar mi link" />
              <Link href="/app/pedidos?nuevo=1#nuevo" className="btn small hide-mobile">+ Cargar {T.order}</Link>
            </div>
          </header>

          <nav className="week" aria-label="Elegí el día">
            {days.map(({ d, dayOrders }) => {
              const n = dayOrders.length;
              const cls = ['wk', d === selDate ? 'on' : '', d === today ? 'is-today' : '', blockedSet.has(d) ? 'blocked' : '', n ? '' : 'free'].join(' ');
              return (
                <Link key={d} href={d === today ? '/app#dia' : `/app?dia=${d}#dia`} className={cls} aria-current={d === selDate ? 'date' : undefined} scroll={false}>
                  <span className="wk-d">{d === today ? 'hoy' : WD[weekdayOf(d)]}</span>
                  <span className="wk-n">{Number(d.slice(8))}</span>
                  <span className="wk-load" aria-label={`${n} ${n === 1 ? T.order : T.orders.toLowerCase()}`}>
                    <span style={{ width: `${n ? Math.max(18, Math.round((n / maxCount) * 100)) : 0}%` }} />
                  </span>
                </Link>
              );
            })}
          </nav>

          {(selCap || loadSlots) && (
            <div className="hoy-cap">
              {selCap && (
                <div className="cap-line">
                  <span>Cupo {selCap.label === 'Total' ? 'del día' : selCap.label}</span>
                  <div className={`bar ${selCap.used >= selCap.max ? 'full' : ''}`}><span style={{ width: `${Math.min(100, Math.round((selCap.used / Math.max(1, selCap.max)) * 100))}%` }} /></div>
                  <strong className="num">{selCap.used}/{selCap.max}</strong>
                </div>
              )}
              {loadSlots && selOrders.length > 0 && (
                <div className="slot-chips" aria-label="Ocupación por horario">
                  {bakery.slots.map((sl) => (
                    <span key={sl} className={`slot-chip ${loadSlots[sl] >= bakery.slot_capacity ? 'full' : loadSlots[sl] > 0 ? 'some' : ''}`}>{sl}<b className="num">{loadSlots[sl]}/{bakery.slot_capacity}</b></span>
                  ))}
                </div>
              )}
            </div>
          )}

          {selOrders.length === 0 ? (
            <div className="hoy-empty">
              <p>{blockedSet.has(selDate) ? 'Este día está bloqueado: no se pueden pedir.' : `Cuando alguien pida por tu link, aparece acá.`}</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link href="/app/pedidos?nuevo=1#nuevo" className="btn secondary small">+ Cargar {T.order} a mano</Link>
              </div>
            </div>
          ) : (
            <ol className="timeline">
              {groups.map((g) => (
                <li key={g.key || 'sin'} className="tl-group">
                  <div className="tl-time num">{g.key || '—'}</div>
                  <div className="tl-items">
                    {g.items.map((o) => {
                      const due = balanceDue(o);
                      const remind = !isToday && o.status === 'confirmado' && o.customer_phone ? reminderLink(bakery, o) : null;
                      return (
                        <article key={o.id} className={`tl-card st-${o.status}`}>
                          <div className="tl-top">
                            <strong className="tl-what">{o.quantity > 1 ? `${o.quantity} × ` : ''}{o.product_name}</strong>
                            <StatusBadge status={o.status} />
                          </div>
                          <div className="tl-who">
                            {o.customer_name}
                            <span className="tl-sep">{o.fulfillment === 'envio' ? `${T.envio}${o.address ? `: ${o.address}` : ''}` : T.retiro}</span>
                          </div>
                          {(o.options?.length > 0 || o.dedication) && (
                            <div className="tl-note">
                              {o.options?.length > 0 && optionsSummary(o.options)}
                              {o.options?.length > 0 && o.dedication ? ' · ' : ''}
                              {o.dedication && <>{T.note1.label}: «{o.dedication}»</>}
                            </div>
                          )}
                          {o.allergies && <span className="badge bad">⚠ {o.allergies}</span>}
                          <div className="tl-foot">
                            <span className={`tl-money num ${due > 0 && o.status !== 'pendiente_sena' ? '' : 'paid'}`}>
                              {o.status === 'pendiente_sena' ? 'Esperando seña' : due > 0 ? `Saldo ${money(due)}` : 'Pagado'}
                            </span>
                            <div className="tl-btns">
                              {remind && <a className="btn small" href={remind} target="_blank" rel="noreferrer">Recordar</a>}
                              {o.status === 'confirmado' && selDate <= today && (
                                <form action={changeOrderStatus}>
                                  <input type="hidden" name="id" value={o.id} />
                                  <input type="hidden" name="status" value="entregado" />
                                  <input type="hidden" name="back" value={isToday ? '/app' : `/app?dia=${selDate}`} />
                                  <button className="btn small">{T.link.mode === 'visita' ? 'Terminado' : T.key === 'belleza' ? 'Atendido' : 'Entregado'}</button>
                                </form>
                              )}
                              <Link className="btn ghost small" href={`/app/pedidos?editar=${o.id}#p-${o.id}`}>Editar</Link>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="hoy-side">
          {todo.length > 0 && (
            <div className="card todo">
              <h2>Para revisar</h2>
              <ul>
                {todo.map((it, i) => (
                  <li key={i} className={`todo-${it.tone}`}>
                    <span className="todo-dot" aria-hidden="true" />
                    <span className="todo-text">{it.text}</span>
                    <Link className="btn secondary small" href={it.href}>{it.cta}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card stats">
            <div className="stat">
              <span>Señas cobradas, 7 días</span>
              <strong className="num">{money(depositsWeek)}</strong>
            </div>
            <div className="stat">
              <span>Saldo por cobrar, 14 días</span>
              <strong className="num">{money(upcomingBalance)}</strong>
            </div>
            <div className="stat">
              <span>Cupo de hoy</span>
              {todayCap ? <strong className="num">{todayCap.used} de {todayCap.max}</strong> : <Link href="/app/configuracion#cupos">Poner cupos</Link>}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
