import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { moduleAccess } from '@/lib/modules';
import { availableDates, reservedByProduct } from '@/lib/orders';
import { money, dateLabel, WEEKDAYS } from '@/lib/format';
import { placeOrder, placeSubscription } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await createAdmin().from('bakeries').select('name').eq('slug', slug).maybeSingle();
  return { title: data ? `${data.name} — Hacé tu pedido` : 'Catálogo' };
}

function waLink(num) {
  const digits = String(num || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('54') ? digits : `549${digits.replace(/^0/, '')}`}`;
}

const Trap = () => <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />;

function DeliveryFields({ bakery }) {
  return (
    <>
      {(bakery.slots || []).length > 0 && (
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
      <div className="field">
        <label>Entrega</label>
        <select name="fulfillment">
          <option value="retiro">Retiro{bakery.pickup_address ? ` en ${bakery.pickup_address}` : ''}</option>
          {bakery.delivery_enabled && <option value="envio">Envío a domicilio</option>}
        </select>
      </div>
      {bakery.delivery_enabled && <div className="field"><label>Dirección (solo si es envío)</label><input name="address" placeholder="Calle, número, piso, localidad" /></div>}
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
  const qty = Math.max(1, Math.min(50, Number(sp.q) || 1));
  const dates = selected && open && !subMode ? await availableDates(admin, bakery, selected, qty) : [];
  const wa = waLink(bakery.whatsapp_contact);
  const depositPct = bakery.deposit_percent;
  const groups = selected?.options || [];

  return (
    <>
      <header className="store-head">
        <div className="container">
          <Link href={`/c/${slug}`} className="store-avatar" aria-label={`${bakery.name}, inicio`}>{(bakery.name || '?').trim().charAt(0).toUpperCase()}</Link>
          <div style={{ flex: '1 1 320px' }}>
            <h1 className="disp">{bakery.name}</h1>
            <div className="store-chips">
              {bakery.pickup_address && <span>Retiro en {bakery.pickup_address}</span>}
              {bakery.delivery_enabled && <span>Hace envíos</span>}
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
              <Link href={`/c/${slug}`}>← Ver todos los productos</Link>
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
                  <h2>Tu pedido</h2>
                  <form method="get" className="row" style={{ marginBottom: 12 }}>
                    <input type="hidden" name="p" value={selected.id} />
                    <label style={{ margin: 0 }}>Cantidad</label>
                    <input name="q" type="number" min="1" max="50" defaultValue={qty} style={{ maxWidth: 90 }} />
                    <button className="btn secondary small">Ver fechas</button>
                  </form>
                  {left(selected) === 0 ? (
                    <div className="alert warn">Agotado por ahora.</div>
                  ) : left(selected) !== null && left(selected) < qty ? (
                    <div className="alert warn">Solo quedan {left(selected)} unidades.</div>
                  ) : dates.length === 0 ? (
                    <div className="alert warn">No quedan fechas disponibles para {qty} {qty === 1 ? 'unidad' : 'unidades'} en los próximos días.</div>
                  ) : (
                    <form action={placeOrder}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="product_id" value={selected.id} />
                      <input type="hidden" name="quantity" value={qty} />
                      <Trap />
                      {groups.map((g, gi) => (
                        <div className="field" key={gi}>
                          <label>{g.name}{g.required ? '' : ' (opcional)'}</label>
                          <select name={`opt_${gi}`} required={g.required} defaultValue="">
                            <option value="" disabled={g.required}>{g.required ? 'Elegí una opción' : 'Sin elegir'}</option>
                            {g.choices.map((c, ci) => <option key={ci} value={ci}>{c.label}{c.delta ? ` (+${money(c.delta)})` : ''}</option>)}
                          </select>
                        </div>
                      ))}
                      <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
                        <legend style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', marginBottom: 6, padding: 0 }}>Fecha · solo te mostramos días con lugar</legend>
                        <div className="dates">
                          {dates.map((d, i) => {
                            const [wd, dm] = dateLabel(d.date).split(' ');
                            return (
                              <label key={d.date} className="date-opt" style={{ margin: 0 }}>
                                <input type="radio" name="date" value={d.date} required defaultChecked={i === 0} />
                                <span>
                                  <span className="wd">{wd}</span>
                                  <span className="dn">{dm.split('/')[0]}</span>
                                  <span className={`lf ${d.left !== null && d.left <= 1 ? 'low' : ''}`}>{d.left === null ? `${dm}` : d.left <= 1 ? 'Queda 1' : d.left <= 3 ? `Quedan ${d.left}` : dm}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                      <DeliveryFields bakery={bakery} />
                      <div className="field"><label>¿Para qué ocasión? (opcional)</label><input name="occasion" placeholder="Ej: cumple de Sofi, aniversario" /></div>
                      <div className="field"><label>Dedicatoria (opcional)</label><input name="dedication" maxLength={200} placeholder="Ej: ¡Feliz cumple Sofi!" /></div>
                      <div className="field"><label>Alergias o restricciones (opcional)</label><input name="allergies" placeholder="Ej: sin TACC, sin frutos secos" /></div>
                      <div className="field"><label>Foto de referencia (opcional)</label><input name="foto" type="file" accept="image/jpeg,image/png,image/webp" /></div>
                      <div className="field"><label>Otras aclaraciones (opcional)</label><input name="notes" /></div>
                      <div className="summary" style={{ marginBottom: 12 }}>
                        Precio base: <strong>{money(Number(selected.price) * qty)}</strong>{groups.some((g) => g.choices.some((c) => c.delta)) ? ' + opciones elegidas' : ''}
                        {depositPct > 0 && <> · Seña: {depositPct}% del total</>}
                        {depositPct > 0 && bakery.mp_access_token_enc && <div className="muted" style={{ fontSize: 13 }}>Vas a pagar la seña con Mercado Pago. Tenés {bakery.hold_minutes} minutos; si no, el cupo se libera.</div>}
                      </div>
                      <button className="btn block">{depositPct > 0 && bakery.mp_access_token_enc ? 'Confirmar y pagar seña' : 'Enviar pedido'}</button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <h2 className="disp" style={{ fontSize: 24 }}>Elegí qué querés</h2>
            {!products || products.length === 0 ? (
              <p className="muted">Todavía no hay productos cargados.</p>
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
                            <Link className="btn small" href={`/c/${slug}?p=${p.id}`}>Pedir</Link>
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
      <footer className="footer"><div className="container">Pedidos online con <Link href="/">AutoFlow Cocina</Link></div></footer>
    </>
  );
}
