import { rubroOf, mapsUrl } from '@/lib/rubros';
import DateSlotPicker from './date-slot-picker';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { moduleAccess } from '@/lib/modules';
import { availableDates, reservedByProduct } from '@/lib/orders';
import { money, dateLabel, WEEKDAYS } from '@/lib/format';
import { placeOrder, placeSubscription } from './actions';
import { QtyPicker, FulfillmentFields, FormMemory, PhotoField } from './order-helpers';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await createAdmin().from('bakeries').select('name,business_type').eq('slug', slug).maybeSingle();
  const L = rubroOf(data).link;
  return { title: data ? `${data.name} — ${L.mode === 'turno' ? 'Reservá tu turno' : L.mode === 'reserva' ? 'Reservá tu fecha' : 'Hacé tu pedido'}` : 'Catálogo' };
}

function waLink(num) {
  const digits = String(num || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('54') ? digits : `549${digits.replace(/^0/, '')}`}`;
}

const Trap = () => <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />;

function DeliveryFields({ bakery, noSlots = false }) {
  return (
    <>
      {!noSlots && (bakery.slots || []).length > 0 && (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
          <legend style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', marginBottom: 6, padding: 0 }}>Horario</legend>
          <div className="dates">
            {bakery.slots.map((s, i) => (
              <label key={s} className="date-opt" style={{ margin: 0 }}>
                <input type="radio" name="slot" value={s} defaultChecked={i === 0} />
                <span style={{ minWidth: 120, padding: '12px 14px', fontWeight: 600, fontSize: 15 }}>{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <FulfillmentFields
        retiroLabel={`${rubroOf(bakery).retiro}${bakery.pickup_address ? ` · ${bakery.pickup_address}` : ''}`}
        envioLabel={rubroOf(bakery).envio}
        deliveryEnabled={!!bakery.delivery_enabled}
        noPickupAddress={!bakery.pickup_address}
      />
      <div className="field"><label>Tu nombre</label><input name="customer_name" required autoComplete="name" /></div>
      <div className="field"><label>Tu WhatsApp</label><input name="customer_phone" required inputMode="tel" autoComplete="tel" placeholder="11 5555-5555" /></div>
    </>
  );
}

export default async function Catalogo({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('*').eq('slug', slug).maybeSingle();
  if (!bakery) notFound();
  const t = rubroOf(bakery);
  const L = t.link;
  const maps = mapsUrl(bakery.pickup_address);
  const { data: sub } = await admin.from('subscriptions').select('*').eq('bakery_id', bakery.id).maybeSingle();
  const access = moduleAccess(sub);
  const open = access.base;
  const { data: products } = await admin
    .from('products')
    .select('*')
    .eq('bakery_id', bakery.id)
    .eq('visible', true)
    .not('sheet_row', 'is', null)
    .order('sheet_row');
  const reserved = await reservedByProduct(admin, bakery.id);
  const left = (p) => (p.stock_loaded === null ? null : Math.max(0, p.stock_loaded - (reserved.get(p.id) || 0)));

  const selected = sp.p ? (products || []).find((p) => p.id === sp.p) : null;
  const subMode = sp.modo === 'suscripcion' && selected?.allow_subscription && access.recurring;
  const qty = L.qty ? Math.max(1, Math.min(50, Number(sp.q) || 1)) : 1;
  const dates = selected && open && !subMode ? await availableDates(admin, bakery, selected, qty) : [];
  const wa = waLink(bakery.whatsapp_contact);
  const depositPct = bakery.deposit_percent;
  const groups = selected?.options || [];

  return (
    <>
      <header className="store-head">
        <div className="container">
          <Link href={`/c/${slug}`} className={`store-avatar ${bakery.logo_url ? 'has-logo' : ''}`} aria-label={`${bakery.name}, inicio`}>{bakery.logo_url ? <img src={bakery.logo_url} alt="" /> : (bakery.name || '?').trim().charAt(0).toUpperCase()}</Link>
          <div style={{ flex: '1 1 320px' }}>
            <h1 className="disp">{bakery.name}</h1>
            {bakery.pickup_address && (
              <p className="store-addr">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                <span>{bakery.pickup_address}</span>
                {maps && <a href={maps} target="_blank" rel="noreferrer">Cómo llegar</a>}
              </p>
            )}
            <div className="store-chips">
              {bakery.delivery_enabled && <span>{t.envio}</span>}
              {bakery.min_days_ahead > 0 && <span>Pedí con {bakery.min_days_ahead} {bakery.min_days_ahead === 1 ? 'día' : 'días'} de anticipación</span>}
              {depositPct > 0 && <span className="brand">Seña del {depositPct} % para reservar</span>}
            </div>
          </div>
          {wa && <a className="btn secondary" href={wa} target="_blank" rel="noreferrer">Consultas por WhatsApp</a>}
        </div>
      </header>
      <main className="container page">
        {!open && <div className="alert warn">Por el momento este negocio no está tomando pedidos online.{wa ? ' Escribile por WhatsApp.' : ''}</div>}

        {selected && open ? (
          <div className="grid grid-2">
            <div>
              <Link href={`/c/${slug}`}>← Ver todo</Link>
              <div className="card product-card" style={{ marginTop: 12 }}>
                {selected.photo_url ? <img src={selected.photo_url} alt={selected.name} /> : <div className="ph" aria-hidden="true">{selected.name.charAt(0)}</div>}
                <h2>{selected.name}</h2>
                <div className="price">{money(selected.price)}{groups.some((g) => g.choices.some((c) => c.delta)) ? <small className="muted" style={{ fontSize: 14 }}> base</small> : null}</div>
                {selected.description && <p className="muted">{selected.description}</p>}
                {selected.allow_subscription && access.recurring && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <Link className={`btn small ${subMode ? 'secondary' : ''}`} href={`/c/${slug}?p=${selected.id}`}>Pedido único</Link>
                    <Link className={`btn small ${subMode ? '' : 'secondary'}`} href={`/c/${slug}?p=${selected.id}&modo=suscripcion`}>Recibilo todas las semanas</Link>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              {sp.error && <div className="alert bad">{sp.error}</div>}
              {subMode ? (
                <>
                  <h2>Suscripción</h2>
                  <p className="muted">Te lo preparamos y entregamos el mismo día cada semana o cada 15 días.{bakery.mp_access_token_enc ? ' Se cobra automáticamente con Mercado Pago antes de cada entrega. Podés pausarla o cancelarla cuando quieras.' : ' El negocio te contacta para coordinar el pago.'}</p>
                  <form action={placeSubscription}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="product_id" value={selected.id} />
                    <Trap />
                    <FormMemory storageKey={`af-susc-${selected.id}`} restore={!!sp.error} />
                    <div className="grid grid-2" style={{ gap: 8 }}>
                      <div className="field"><label>Cantidad por entrega</label><input name="quantity" type="number" min="1" max="50" defaultValue="1" /></div>
                      <div className="field">
                        <label>Frecuencia</label>
                        <select name="frequency_days"><option value="7">Cada semana</option><option value="14">Cada 15 días</option></select>
                      </div>
                    </div>
                    <div className="field">
                      <label>Día de entrega</label>
                      <select name="weekday" defaultValue="1">{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
                    </div>
                    <DeliveryFields bakery={bakery} />
                    {bakery.mp_access_token_enc && <div className="field"><label>Tu email (para el débito de Mercado Pago)</label><input name="customer_email" type="email" required autoComplete="email" /></div>}
                    <div className="field"><label>Aclaraciones (opcional)</label><input name="notes" /></div>
                    <div className="summary" style={{ marginBottom: 12 }}>{money(selected.price)} por unidad en cada entrega.</div>
                    <button className="btn block">{bakery.mp_access_token_enc ? 'Suscribirme con Mercado Pago' : 'Pedir suscripción'}</button>
                  </form>
                </>
              ) : (
                <>
                  <h2>{L.form}</h2>
                  {L.qty && <QtyPicker productId={selected.id} qty={qty} />}
                  {left(selected) === 0 ? (
                    <div className="alert warn">Agotado por ahora.</div>
                  ) : left(selected) !== null && left(selected) < qty ? (
                    <div className="alert warn">Solo quedan {left(selected)} unidades.</div>
                  ) : dates.length === 0 ? (
                    <div className="alert warn">No quedan {L.mode === 'turno' ? 'turnos' : 'fechas'} disponibles{L.qty ? ` para ${qty} ${qty === 1 ? 'unidad' : 'unidades'}` : ''} en los próximos días.{wa ? ' Escribinos por WhatsApp y vemos.' : ''}</div>
                  ) : (
                    <form action={placeOrder}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="product_id" value={selected.id} />
                      <input type="hidden" name="quantity" value={qty} />
                      <Trap />
                      <FormMemory storageKey={`af-pedido-${selected.id}`} restore={!!sp.error} />
                      {groups.map((g, gi) => (
                        <div className="field" key={gi}>
                          <label>{g.name}{g.required ? '' : ' (opcional)'}</label>
                          <select name={`opt_${gi}`} required={g.required} defaultValue="">
                            <option value="" disabled={g.required}>{g.required ? 'Elegí una opción' : 'Sin elegir'}</option>
                            {g.choices.map((c, ci) => <option key={ci} value={ci}>{c.label}{c.delta ? ` (+${money(c.delta)})` : ''}</option>)}
                          </select>
                        </div>
                      ))}
                      <DateSlotPicker
                        dates={dates.map((d) => { const [wd, dm] = dateLabel(d.date).split(' '); return { ...d, wd, dm, dn: dm.split('/')[0] }; })}
                        allSlots={bakery.slots || []}
                        perSlot={!!bakery.slot_capacity}
                        title={L.when}
                      />
                      <DeliveryFields bakery={bakery} noSlots />
                      {L.occasion && <div className="field"><label>¿Para qué ocasión? (opcional)</label><input name="occasion" placeholder="Ej: cumple de Sofi, aniversario" /></div>}
                      <div className="field"><label>{t.note1.label} (opcional)</label><input name="dedication" maxLength={200} placeholder={t.note1.ph} /></div>
                      <div className="field"><label>{t.note2.label} (opcional)</label><input name="allergies" placeholder={t.note2.ph} /></div>
                      {L.photo && <div className="field"><label>{t.photoLabel || 'Foto de referencia'} (opcional)</label><PhotoField /></div>}
                      <div className="field"><label>Otras aclaraciones (opcional)</label><input name="notes" /></div>
                      <div className="summary" style={{ marginBottom: 12 }}>
                        {qty > 1 && <>{qty} unidades · </>}Precio base: <strong>{money(Number(selected.price) * qty)}</strong>{groups.some((g) => g.choices.some((c) => c.delta)) ? ' + opciones elegidas' : ''}
                        {depositPct > 0 && <> · Seña: {depositPct}% del total</>}
                        {depositPct > 0 && bakery.mp_access_token_enc && <div className="muted" style={{ fontSize: 13 }}>Vas a pagar la seña con Mercado Pago. Tenés {bakery.hold_minutes} minutos; si no, el cupo se libera.</div>}
                      </div>
                      {bakery.policy_text && <div className="policy"><strong>Antes de confirmar</strong><p>{bakery.policy_text}</p></div>}
                      <button className="btn block">{depositPct > 0 && bakery.mp_access_token_enc ? 'Confirmar y pagar seña' : L.submit}</button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <h2 className="disp" style={{ fontSize: 24 }}>{L.pick}</h2>
            {bakery.policy_text && <details className="policy-fold"><summary>Condiciones</summary><p>{bakery.policy_text}</p></details>}
            {!products || products.length === 0 ? (
              <p className="muted">Todavía no hay nada cargado. Escribinos por WhatsApp.</p>
            ) : (
              <div className="grid grid-3">
                {products.map((p) => {
                  const l = left(p);
                  return (
                    <div key={p.id} className="card product-card">
                      {p.photo_url ? <img src={p.photo_url} alt={p.name} /> : <div className="ph" aria-hidden="true">{p.name.charAt(0)}</div>}
                      <h3>{p.name}</h3>
                      <div className="grow">
                        {p.description && <p className="muted" style={{ fontSize: 14 }}>{p.description}</p>}
                        {(p.options || []).length > 0 && <p className="muted" style={{ fontSize: 13 }}>Personalizable</p>}
                      </div>
                      <div className="row between">
                        <strong className="price" style={{ fontSize: 18 }}>{money(p.price)}</strong>
                        {l === 0 ? <span className="badge bad">Agotado</span> : open ? (
                          <span className="row" style={{ gap: 6 }}>
                            {p.allow_subscription && access.recurring && <Link className="btn secondary small" href={`/c/${slug}?p=${p.id}&modo=suscripcion`}>Suscribirme</Link>}
                            <Link className="btn small" href={`/c/${slug}?p=${p.id}`}>{L.cta}</Link>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="footer"><div className="container">Pedidos online con <Link href="/">AutoFlow</Link></div></footer>
    </>
  );
}
