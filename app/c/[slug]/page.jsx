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
import MediaGallery from './media-gallery';
import Tryon from './tryon';
import ShareButton from './share-button';
import AssistantChat from './assistant-chat';
import { loadSettings, defaultGreeting, starterSuggestions } from '@/lib/assistant';

// Portada + galería, sin repetir la portada si también está en la galería.
function mediaOf(p) {
  const g = Array.isArray(p.gallery) ? p.gallery : [];
  const out = p.photo_url ? [{ url: p.photo_url, kind: 'image' }] : [];
  for (const it of g) if (it?.url && !out.some((o) => o.url === it.url)) out.push(it);
  return out;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const admin = createAdmin();
  const { data } = await admin.from('bakeries').select('id,name,business_type,logo_url,pickup_address,policy_text').eq('slug', slug).maybeSingle();
  const L = rubroOf(data).link;
  const title = data ? `${data.name} — ${L.mode === 'turno' ? 'Reservá tu turno' : L.mode === 'reserva' ? 'Reservá tu fecha' : L.mode === 'visita' ? 'Pedí una visita' : 'Hacé tu pedido'}` : 'Catálogo';
  if (!data) return { title };
  // Vista previa al compartir el link por WhatsApp o Instagram: foto del primer producto (o el logo).
  const { data: first } = await admin.from('products').select('name,photo_url').eq('bakery_id', data.id).eq('visible', true).not('sheet_row', 'is', null).not('photo_url', 'is', null).order('sheet_row').limit(1).maybeSingle();
  const image = first?.photo_url || data.logo_url || null;
  const description = `${L.mode === 'turno' ? 'Elegí día y horario' : 'Elegí, pedí y reservá'} online${data.pickup_address ? ` · ${data.pickup_address}` : ''}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [image] } : {}) },
  };
}

function waLink(num) {
  const digits = String(num || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('54') ? digits : `549${digits.replace(/^0/, '')}`}`;
}

const Trap = () => <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />;

function DeliveryFields({ bakery, noSlots = false, part = 'all' }) {
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
      {part !== 'who' && <FulfillmentFields
        retiroLabel={`${rubroOf(bakery).retiro}${bakery.pickup_address ? ` · ${bakery.pickup_address}` : ''}`}
        envioLabel={rubroOf(bakery).envio}
        deliveryEnabled={!!bakery.delivery_enabled}
        noPickupAddress={!bakery.pickup_address}
        preferEnvio={rubroOf(bakery).link.mode === 'visita'}
        label={rubroOf(bakery).link.mode === 'visita' ? 'Dónde' : 'Entrega'}
      />}
      {part !== 'where' && (
        <div className="two-fields">
          <div className="field"><label>Tu nombre</label><input name="customer_name" required autoComplete="name" /></div>
          <div className="field"><label>Tu WhatsApp</label><input name="customer_phone" required inputMode="tel" autoComplete="tel" placeholder="11 5555-5555" /></div>
        </div>
      )}
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
  const access = moduleAccess(sub, bakery);
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
  const [{ count: couponCount }, { data: reviews }] = await Promise.all([
    admin.from('coupons').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).eq('active', true),
    admin.from('reviews').select('rating,comment,name,created_at').eq('bakery_id', bakery.id).eq('visible', true).order('created_at', { ascending: false }).limit(50),
  ]);
  const avgRating = reviews?.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null;
  // Asistente IA: chat en el catálogo si el negocio tiene el módulo y no lo apagó.
  const asst = access.assistant ? await loadSettings(admin, bakery.id) : null;
  const chatOn = !!asst?.enabled;
  const list = products || [];
  // Vidriera: portada con la primera foto, próximo día con lugar y productos por categoría.
  const coverUrl = list.map((p) => mediaOf(p).find((m) => m.kind === 'image')?.url).find(Boolean) || null;
  const firstAvail = !selected && open && list.length ? list.find((p) => left(p) !== 0) : null;
  const nextDates = firstAvail ? await availableDates(admin, bakery, firstAvail, 1) : [];
  const nextLabel = nextDates[0] ? (() => { const [wd, dm] = dateLabel(nextDates[0].date).split(' '); return `${wd} ${dm.split('/')[0]}`; })() : null;
  const cats = [...new Set(list.map((p) => (p.category || '').trim()).filter(Boolean))];
  const sections = cats.length > 1 && list.length >= Math.max(6, cats.length * 3) ? [...cats.map((c) => ({ name: c, items: list.filter((p) => (p.category || '').trim() === c) })), { name: 'Otros', items: list.filter((p) => !(p.category || '').trim()) }].filter((g) => g.items.length) : [{ name: null, items: list }];
  const asList = L.mode === 'turno' || L.mode === 'visita';
  const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

  return (
    <>
      <header className="shop-hero">
        <div className="shop-cover" style={coverUrl ? { backgroundImage: `url("${coverUrl.replace(/"/g, '%22')}")` } : undefined} aria-hidden="true" />
        <div className="container shop-id">
          <Link href={`/c/${slug}`} className={`store-avatar shop-logo ${bakery.logo_url ? 'has-logo' : ''}`} aria-label={`${bakery.name}, inicio`}>{bakery.logo_url ? <img src={bakery.logo_url} alt="" /> : (bakery.name || '?').trim().charAt(0).toUpperCase()}</Link>
          <div className="shop-name">
            <h1 className="disp">{bakery.name}</h1>
            <p className="shop-status">
              {open ? <><span className="live" aria-hidden="true" />{L.mode === 'turno' ? 'Tomando turnos' : L.mode === 'visita' ? 'Tomando visitas' : L.mode === 'reserva' ? 'Tomando reservas' : 'Tomando pedidos'}{nextLabel ? <> · próximo lugar <b>{nextLabel}</b></> : ''}</> : 'Por ahora no toma pedidos online'}
              {avgRating && reviews.length >= 3 && <> · <a href="#resenas">★ {avgRating.toFixed(1).replace('.', ',')} ({reviews.length})</a></>}
            </p>
          </div>
          <div className="shop-actions">
            {wa && (
              <a className="sh-btn wa" href={wa} target="_blank" rel="noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>
                <span>WhatsApp</span>
              </a>
            )}
            <ShareButton title={bakery.name} />
          </div>
        </div>
        <div className="container shop-info">
          {bakery.pickup_address && (
            <span className="si">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
              {bakery.pickup_address}{maps && <a href={maps} target="_blank" rel="noreferrer">Cómo llegar</a>}
            </span>
          )}
          {bakery.delivery_enabled && <span className="si">{t.envio}{Number(bakery.delivery_fee) > 0 ? ` · ${money(bakery.delivery_fee)}${Number(bakery.free_delivery_from) > 0 ? ` (gratis desde ${money(bakery.free_delivery_from)})` : ''}` : ''}</span>}
          {bakery.min_days_ahead > 0 && <span className="si">Con {bakery.min_days_ahead} {bakery.min_days_ahead === 1 ? 'día' : 'días'} de anticipación</span>}
          {depositPct > 0 && <span className="si brand">Seña del {depositPct} % para reservar</span>}
        </div>
      </header>
      <main className="container page">
        {!open && <div className="alert warn">{access.assistantOnly && chatOn ? `Consultá lo que necesites con el asistente${wa ? ' y hacé tu pedido por WhatsApp' : ''}.` : <>Por el momento este negocio no está tomando pedidos online.{wa ? ' Escribile por WhatsApp.' : ''}</>}</div>}

        {selected && open ? (
          <div className="pdetail">
            <div className="pdetail-media">
              <Link href={`/c/${slug}`} className="back-link">← Ver todo</Link>
              <div className="card product-card product-detail" style={{ marginTop: 12 }}>
                <MediaGallery items={mediaOf(selected)} name={selected.name} />
                <h2>{selected.name}</h2>
                <div className="price">{money(selected.price)}{groups.some((g) => g.choices.some((c) => c.delta)) ? <small className="muted" style={{ fontSize: 14 }}> base</small> : null}</div>
                {selected.description && <p className="muted">{selected.description}</p>}
                {selected.tryon_url && (
                  <Tryon
                    frames={[selected, ...products.filter((p) => p.tryon_url && p.id !== selected.id)].map((p) => ({ id: p.id, name: p.name, url: p.tryon_url }))}
                    initialId={selected.id}
                  />
                )}
                {selected.allow_subscription && access.recurring && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <Link className={`btn small ${subMode ? 'secondary' : ''}`} href={`/c/${slug}?p=${selected.id}`}>Pedido único</Link>
                    <Link className={`btn small ${subMode ? '' : 'secondary'}`} href={`/c/${slug}?p=${selected.id}&modo=suscripcion`}>Recibilo todas las semanas</Link>
                  </div>
                )}
              </div>
            </div>

            <div className="card order-card">
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
                      {groups.length > 0 && (
                        <div className="ostep">
                          <h3 className="ostep-t"><span>1</span>Personalizalo</h3>
                          {groups.map((g, gi) => (
                            <div className="field" key={gi}>
                              <label>{g.name}{g.required ? '' : ' (opcional)'}</label>
                              <select name={`opt_${gi}`} required={g.required} defaultValue="">
                                <option value="" disabled={g.required}>{g.required ? 'Elegí una opción' : 'Sin elegir'}</option>
                                {g.choices.map((c, ci) => <option key={ci} value={ci}>{c.label}{c.delta ? ` (+${money(c.delta)})` : ''}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="ostep">
                        <h3 className="ostep-t"><span>{groups.length ? 2 : 1}</span>{L.when}</h3>
                        <DateSlotPicker
                          dates={dates.map((d) => { const [wd, dm] = dateLabel(d.date).split(' '); return { ...d, wd, dm, dn: dm.split('/')[0] }; })}
                          allSlots={bakery.slots || []}
                          perSlot={!!bakery.slot_capacity}
                          title="Día"
                        />
                        <DeliveryFields bakery={bakery} noSlots part="where" />
                      </div>
                      <div className="ostep">
                        <h3 className="ostep-t"><span>{groups.length ? 3 : 2}</span>Tus datos</h3>
                        <DeliveryFields bakery={bakery} noSlots part="who" />
                        <div className="field"><label>{t.note1.label} (opcional)</label><input name="dedication" maxLength={200} placeholder={t.note1.ph} /></div>
                        <div className="field"><label>{t.note2.label} (opcional)</label><input name="allergies" placeholder={t.note2.ph} /></div>
                        <details className="more-fold">
                          <summary>Agregar más detalles (opcional)</summary>
                          {L.occasion && <div className="field"><label>¿Para qué ocasión?</label><input name="occasion" placeholder="Ej: cumple de Sofi, aniversario" /></div>}
                          {L.photo && <div className="field"><label>{t.photoLabel || 'Foto de referencia'}</label><PhotoField /></div>}
                          <div className="field"><label>Otras aclaraciones</label><input name="notes" /></div>
                          {couponCount > 0 && <div className="field"><label>Cupón de descuento</label><input name="coupon_code" maxLength={20} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></div>}
                        </details>
                      </div>
                      <div className="summary" style={{ marginBottom: 12 }}>
                        {qty > 1 && <>{qty} unidades · </>}{L.mode === 'visita' ? 'Precio de referencia' : 'Precio base'}: <strong>{money(Number(selected.price) * qty)}</strong>{groups.some((g) => g.choices.some((c) => c.delta)) ? ' + opciones elegidas' : ''}
                        {depositPct > 0 && <> · Seña: {depositPct}% del total</>}
                        {bakery.delivery_enabled && Number(bakery.delivery_fee) > 0 && <div className="muted" style={{ fontSize: 13 }}>{t.envio}: {money(bakery.delivery_fee)}{Number(bakery.free_delivery_from) > 0 ? ` (gratis desde ${money(bakery.free_delivery_from)})` : ''}.</div>}
                        {depositPct > 0 && bakery.mp_access_token_enc && <div className="muted" style={{ fontSize: 13 }}>Vas a pagar la seña con Mercado Pago. Tenés {bakery.hold_minutes} minutos; si no, el cupo se libera.</div>}
                      </div>
                      {bakery.policy_text && <div className="policy"><strong>Antes de confirmar</strong><p>{bakery.policy_text}</p></div>}
                      <div className="order-submit">
                        <button className="btn block large">{depositPct > 0 && bakery.mp_access_token_enc ? 'Confirmar y pagar seña' : L.submit}<span className="os-price num">{money(Number(selected.price) * qty)}</span></button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="shop-bar">
              <h2 className="disp">{L.pick}</h2>
              {bakery.policy_text && <details className="policy-fold"><summary>Condiciones</summary><p>{bakery.policy_text}</p></details>}
            </div>
            {sections.length > 1 && (
              <nav className="cat-nav" aria-label="Categorías">
                {sections.map((g) => <a key={g.name} href={`#cat-${encodeURIComponent(g.name)}`}>{g.name}<b className="num">{g.items.length}</b></a>)}
              </nav>
            )}
            {list.length === 0 ? (
              <div className="shop-empty"><p>Todavía no hay nada cargado.</p>{wa && <a className="btn" href={wa} target="_blank" rel="noreferrer">Escribinos por WhatsApp</a>}</div>
            ) : sections.map((g) => (
              <section key={g.name || 'todo'} id={g.name ? `cat-${encodeURIComponent(g.name)}` : undefined} className="shop-sec">
                {g.name && <h3 className="shop-sec-t">{g.name}</h3>}
                <div className={asList ? 'svc-list' : 'shop-grid2'}>
                  {g.items.map((p) => {
                    const l = left(p);
                    const m = mediaOf(p);
                    const cover = m.find((x) => x.kind === 'image');
                    const hasVideo = m.some((x) => x.kind === 'video');
                    const nImg = m.filter((x) => x.kind === 'image').length;
                    const tag = p.tryon_url ? 'Probátelos' : hasVideo ? '▶ Video' : nImg > 1 ? `${nImg} fotos` : null;
                    const href = `/c/${slug}?p=${p.id}`;
                    if (asList) {
                      return (
                        <Link key={p.id} href={href} className={`svc ${l === 0 || !open ? 'off' : ''}`}>
                          <span className="svc-img">{cover ? <img src={cover.url} alt="" loading="lazy" /> : <span className="ph" aria-hidden="true">{p.name.charAt(0)}</span>}</span>
                          <span className="svc-txt">
                            <b>{p.name}</b>
                            {p.description && <span className="svc-desc">{p.description}</span>}
                            <span className="svc-meta">
                              {p.duration_minutes ? <span>{fmtDur(p.duration_minutes)}</span> : null}
                              {tag && <span>{tag}</span>}
                              {l === 0 && <span className="bad">Sin lugar</span>}
                            </span>
                          </span>
                          <span className="svc-end"><b className="num">{L.mode === 'visita' ? 'desde ' : ''}{money(p.price)}</b><span className="svc-go" aria-hidden="true">›</span></span>
                        </Link>
                      );
                    }
                    return (
                      <Link key={p.id} href={href} className={`pcard ${l === 0 || !open ? 'off' : ''}`}>
                        <span className="pcard-img">
                          {cover ? <img src={cover.url} alt="" loading="lazy" /> : <span className="ph" aria-hidden="true">{p.name.charAt(0)}</span>}
                          {tag && <span className="pcard-tag">{tag}</span>}
                          {l === 0 ? <span className="pcard-tag out">Agotado</span> : l !== null && l <= 3 ? <span className="pcard-tag few">Quedan {l}</span> : null}
                        </span>
                        <span className="pcard-name">{p.name}</span>
                        {p.description && <span className="pcard-desc">{p.description}</span>}
                        <span className="pcard-foot">
                          <b className="num">{money(p.price)}</b>
                          {open && l !== 0 && <span className="pcard-add" aria-hidden="true">+</span>}
                        </span>
                        {(p.options || []).length > 0 && <span className="pcard-opt">Personalizable</span>}
                      </Link>
                    );
                  })}
                </div>
                {g.items.some((p) => p.allow_subscription) && access.recurring && open && (
                  <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Algunos se pueden recibir todas las semanas: elegilo y tocá «Recibilo todas las semanas».</p>
                )}
              </section>
            ))}
            {reviews?.length >= 3 && (
              <section id="resenas" className="shop-sec">
                <h2 className="disp" style={{ fontSize: 22 }}>Lo que dicen {avgRating ? <small className="muted" style={{ fontSize: 15 }}>★ {avgRating.toFixed(1).replace('.', ',')} · {reviews.length}</small> : null}</h2>
                <div className="grid grid-3">
                  {reviews.filter((r) => r.comment).slice(0, 6).map((r, i) => (
                    <div key={i} className="card" style={{ margin: 0 }}>
                      <div aria-label={`${r.rating} de 5`}>{'★'.repeat(r.rating)}<span className="muted">{'★'.repeat(5 - r.rating)}</span></div>
                      <p style={{ margin: '6px 0' }}>«{r.comment}»</p>
                      <small className="muted">{r.name || 'Cliente'}</small>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {chatOn && (
        <AssistantChat
          slug={slug}
          botName={asst.name || 'Asistente'}
          bizName={bakery.name}
          logoUrl={bakery.logo_url}
          greeting={asst.greeting || defaultGreeting(bakery, asst.name || 'Asistente')}
          starters={starterSuggestions(bakery)}
          wa={wa}
          lift={!!selected}
        />
      )}
      {!chatOn && !selected && wa && <a className="wa-float" href={wa} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg></a>}
      <footer className="footer shop-foot"><div className="container">Pedidos online con <Link href="/">HakkiraApp</Link></div></footer>
    </>
  );
}
