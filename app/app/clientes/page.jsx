import { requireBakery } from '@/lib/session';
import { rubroOf } from '@/lib/rubros';
import { updateCustomer, toggleReview, saveCoupon, toggleCoupon } from '../actions';
import { normName } from '@/lib/format';
import { Flash } from '../ui';
import { todayAR, addDays, dateLabel, money } from '@/lib/format';
import { waMeLink } from '@/lib/customers';
import { appUrl } from '@/lib/env';

export default async function Clientes({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery } = await requireBakery();
  const T = rubroOf(bakery);
  const today = todayAR();
  const catalog = `${appUrl()}/c/${bakery.slug}`;
  const [{ data: customers }, { data: orders }, { data: reviews }, { data: coupons }] = await Promise.all([
    supabase.from('customers').select('*').eq('bakery_id', bakery.id),
    supabase
      .from('orders')
      .select('id,customer_id,customer_name,customer_phone,product_name,date,total,status,occasion')
      .eq('bakery_id', bakery.id)
      .in('status', ['confirmado', 'entregado'])
      .gte('date', addDays(today, -730))
      .order('date', { ascending: false })
      .limit(5000),
    supabase.from('reviews').select('*').eq('bakery_id', bakery.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('coupons').select('*').eq('bakery_id', bakery.id).order('created_at', { ascending: false }),
  ]);

  const stats = new Map();
  for (const o of orders || []) {
    if (!o.customer_id) continue;
    if (!stats.has(o.customer_id)) stats.set(o.customer_id, { count: 0, spent: 0, last: o.date, lastProduct: o.product_name });
    const s = stats.get(o.customer_id);
    s.count += 1;
    s.spent += Number(o.total);
  }
  const list = (customers || [])
    .map((c) => ({ ...c, ...(stats.get(c.id) || { count: 0, spent: 0, last: null, lastProduct: null }) }))
    .sort((a, b) => b.spent - a.spent);

  // Ocasiones: pedidos de hace un año cuya fecha se cumple en los próximos 30 días
  const fromPast = addDays(today, -365);
  const toPast = addDays(today, -335);
  const occasions = (orders || [])
    .filter((o) => o.date >= fromPast && o.date <= toPast && o.customer_phone)
    .reverse();

  const campaign = typeof sp.msg === 'string' && sp.msg.trim() ? sp.msg.trim().slice(0, 600) : '';
  const inactive = list.filter((c) => c.last && c.last < addDays(today, -60));
  // Recompra: clientes que compraron más de una vez o gastaron bien, y no piden hace 30 días o más.
  const winBack = list
    .filter((c) => c.phone && c.last && c.last <= addDays(today, -30) && (c.count >= 2 || c.spent > 0))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 12);
  const daysSince = (d) => Math.round((new Date(`${today}T12:00:00Z`) - new Date(`${d}T12:00:00Z`)) / 86400000);
  const avg = reviews?.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null;

  const search = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const needle = normName(search);
  const digits = search.replace(/\D/g, '');
  const shown = list.filter((c) => !needle || normName(c.name).includes(needle) || (digits.length >= 3 && String(c.phone || '').replace(/\D/g, '').includes(digits)));

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>Se arma solo con cada {T.order} que entra. Tocá «Editar» para corregir un nombre o teléfono.</p>
        </div>
      </div>

      {occasions.length > 0 && (
        <div className="card todo">
          <h2>Para escribirles: hace un año te compraron para esta fecha</h2>
          <ul>
            {occasions.map((o) => {
              const name = String(o.customer_name).split(' ')[0];
              const anniversary = addDays(o.date, 365);
              const text = `¡Hola ${name}! El año pasado te hicimos ${o.product_name}${o.occasion ? ` para ${o.occasion}` : ''} (${dateLabel(o.date)}). ${T.key === 'cocina' ? '¿Lo festejamos de nuevo este año? 🎂' : '¿Lo repetimos este año?'} Podés pedir acá: ${catalog}`;
              const link = waMeLink(o.customer_phone, text);
              return (
                <li key={o.id} className="todo-info">
                  <span className="todo-dot" aria-hidden="true" />
                  <span className="todo-text"><strong>{o.customer_name}</strong> · {o.product_name}{o.occasion ? ` · ${o.occasion}` : ''} · se cumple el {dateLabel(anniversary)}</span>
                  {link && <a className="btn secondary small" href={link} target="_blank" rel="noreferrer">Escribirle</a>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form method="get" className="row" style={{ marginBottom: 12, gap: 8, flexWrap: 'nowrap' }}>
        <input type="search" name="q" defaultValue={search} placeholder="Nombre o teléfono" aria-label="Buscar clientes" />
        <button className="btn secondary">Buscar</button>
      </form>

      <div className="card">
        <div className="row between" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>{search ? `${shown.length} de ${list.length} clientes` : `${list.length} clientes`}</h2>
          {inactive.length > 0 && <span className="badge warn">{inactive.length} sin pedir hace más de 60 días</span>}
        </div>
        {list.length === 0 ? (
          <p className="muted">Todavía no hay clientes. Aparecen solos cuando entran pedidos.</p>
        ) : shown.length === 0 ? (
          <p className="muted">Nadie coincide con «{search}».</p>
        ) : (
          <ul className="items">
            {shown.map((c) => {
              const link = waMeLink(c.phone, `¡Hola ${String(c.name).split(' ')[0]}! `);
              return (
                <li key={c.id} className="item">
                  <div className="item-head">
                    <div>
                      <div className="item-title">{c.name}</div>
                      <div className="item-sub">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                    </div>
                    <div className="money-col">
                      <div className="item-title">{money(c.spent)}</div>
                      <div className="item-sub">{c.count} {c.count === 1 ? T.order : T.orders.toLowerCase()}</div>
                    </div>
                  </div>
                  {(c.last || c.notes) && (
                    <div className="item-meta">
                      {c.last && (c.last > today ? <span className="badge ok">Próximo: {dateLabel(c.last)}</span> : <span>Último: {dateLabel(c.last)} · {c.lastProduct}</span>)}
                      {c.notes && <span>📝 {c.notes}</span>}
                    </div>
                  )}
                  <div className="item-actions">
                    {link && <a className="btn secondary small" href={link} target="_blank" rel="noreferrer">WhatsApp</a>}
                    <details className="fold">
                      <summary className="btn secondary small">Editar</summary>
                      <form action={updateCustomer} className="fold-body">
                        <input type="hidden" name="id" value={c.id} />
                        <div className="grid grid-3" style={{ gap: 10 }}>
                          <div className="field"><label>Nombre</label><input name="name" defaultValue={c.name} required /></div>
                          <div className="field"><label>Teléfono</label><input name="phone" defaultValue={c.phone || ''} inputMode="tel" required /></div>
                          <div className="field"><label>Email (opcional)</label><input name="email" type="email" defaultValue={c.email || ''} /></div>
                        </div>
                        <div className="field"><label>Nota (solo la ves vos)</label><input name="notes" defaultValue={c.notes || ''} placeholder="Ej: celíaca, prefiere retirar a la tarde" /></div>
                        <button className="btn small">Guardar</button>
                      </form>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <details className="card fold" open={!!campaign}>
        <summary><h2>Mandar un mensaje a todos</h2></summary>
        <p className="muted" style={{ marginTop: 8 }}>Para preventas y fechas especiales. Escribí el mensaje y te armamos un botón por cliente que abre tu WhatsApp con el texto listo.</p>
        <form method="get" className="stack">
          <textarea name="msg" defaultValue={campaign} placeholder={`Ej.: ¡Abrimos la preventa del Día de la Madre! Hay cupos limitados: ${catalog}`} />
          <div className="row">
            <button className="btn">Preparar mensajes</button>
            <a className="btn secondary" href={`/app/clientes?msg=${encodeURIComponent(`¡Hola {nombre}! Te extrañamos 😊 Esta semana tenemos cupos libres. Pedí acá: ${catalog}`)}`}>Usar «te extrañamos»</a>
          </div>
        </form>
        {campaign && (
          <div style={{ marginTop: 12 }}>
            <p><strong>{list.filter((c) => c.phone).length} clientes.</strong> Tocá cada botón para abrir el chat con el mensaje listo.</p>
            <div className="row">
              {list.filter((c) => c.phone).map((c) => {
                const link = waMeLink(c.phone, campaign.replace(/\{nombre\}/gi, String(c.name).split(' ')[0]));
                return link ? <a key={c.id} className="btn secondary small" href={link} target="_blank" rel="noreferrer">{c.name}</a> : null;
              })}
            </div>
          </div>
        )}
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Tip: escribí {'{nombre}'} y se reemplaza por el nombre de cada cliente.</p>
      </details>

      {winBack.length > 0 && (
        <div className="card" id="volver">
          <h2>Para volver a escribirles</h2>
          <p className="muted">Clientes que te compraron y hace 30 días o más que no piden. Un mensaje a tiempo suele traer el próximo {T.order}.</p>
          <ul className="items">
            {winBack.map((c) => {
              const first = String(c.name).split(' ')[0];
              const text = `¡Hola ${first}! ¿Cómo estás? Te escribo de ${bakery.name}. Hace un tiempito que no nos ${T.key === 'belleza' ? 'visitás' : 'pedís'}${c.lastProduct ? ` (la última vez fue ${c.lastProduct})` : ''}. Si querés repetir, acá está todo: ${catalog} ¡Te esperamos!`;
              const link = waMeLink(c.phone, text);
              return (
                <li key={c.id} className="item">
                  <div className="item-head">
                    <div><strong>{c.name}</strong><div className="item-sub">{c.count} {c.count === 1 ? T.order : T.orders.toLowerCase()} · {money(c.spent)} · último hace {daysSince(c.last)} días</div></div>
                    {link && <a className="btn small" href={link} target="_blank" rel="noreferrer">Escribirle</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card" id="cupones">
        <h2>Cupones de descuento</h2>
        <p className="muted">Para fechas especiales o para recompensar a tus clientes. Tu cliente escribe el código al pedir por tu link.</p>
        {(coupons || []).length > 0 && (
          <table className="table" style={{ marginBottom: 12 }}>
            <thead><tr><th>Código</th><th>Descuento</th><th>Vigencia</th><th>Usos</th><th></th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.code}</td>
                  <td>{c.kind === 'percent' ? `${Number(c.value)} %` : money(c.value)}</td>
                  <td>{c.starts_on ? dateLabel(c.starts_on) : 'Ya'} → {c.ends_on ? dateLabel(c.ends_on) : 'sin fin'}</td>
                  <td>{c.uses}{c.max_uses ? ` de ${c.max_uses}` : ''}</td>
                  <td>
                    <form action={toggleCoupon}><input type="hidden" name="id" value={c.id} /><button className="btn secondary small">{c.active ? 'Pausar' : 'Activar'}</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={saveCoupon} className="grid grid-3" style={{ gap: 10 }}>
          <div className="field"><label>Código</label><input name="code" required maxLength={20} placeholder="Ej: MAMA10" style={{ textTransform: 'uppercase' }} /></div>
          <div className="field"><label>Tipo</label><select name="kind" defaultValue="percent"><option value="percent">Porcentaje (%)</option><option value="amount">Monto fijo ($)</option></select></div>
          <div className="field"><label>Valor</label><input name="value" required inputMode="decimal" placeholder="Ej: 10" /></div>
          <div className="field"><label>Desde (opcional)</label><input name="starts_on" type="date" /></div>
          <div className="field"><label>Hasta (opcional)</label><input name="ends_on" type="date" /></div>
          <div className="field"><label>Máximo de usos (opcional)</label><input name="max_uses" type="number" min="1" placeholder="Sin límite" /></div>
          <div><button className="btn">Crear cupón</button></div>
        </form>
      </div>

      <div className="card" id="resenas">
        <h2>Reseñas {avg ? <small className="muted">★ {avg.toFixed(1).replace('.', ',')} · {reviews.length}</small> : null}</h2>
        <p className="muted">Cuando marcás un {T.order} como {T.link.mode === 'visita' ? 'terminado' : 'entregado'}, tu cliente puede dejarte su opinión desde su link. Con 3 o más se muestran en tu catálogo.</p>
        {!(reviews || []).length ? <p className="muted" style={{ margin: 0 }}>Todavía no hay reseñas.</p> : (
          <ul className="items">
            {reviews.map((r) => (
              <li key={r.id} className="item">
                <div className="item-head">
                  <div>
                    <div>{'★'.repeat(r.rating)}<span className="muted">{'★'.repeat(5 - r.rating)}</span> <strong>{r.name || 'Cliente'}</strong> <span className="muted">· {dateLabel(String(r.created_at).slice(0, 10))}</span></div>
                    {r.comment && <div className="item-sub">«{r.comment}»</div>}
                  </div>
                  <form action={toggleReview}><input type="hidden" name="id" value={r.id} /><button className="btn secondary small">{r.visible ? 'Ocultar' : 'Mostrar'}</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
