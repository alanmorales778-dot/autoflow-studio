import { requireBakery } from '@/lib/session';
import { Flash } from '../ui';
import { todayAR, addDays, dateLabel, money } from '@/lib/format';
import { waMeLink } from '@/lib/customers';
import { appUrl } from '@/lib/env';

export default async function Clientes({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery } = await requireBakery();
  const today = todayAR();
  const catalog = `${appUrl()}/c/${bakery.slug}`;
  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase.from('customers').select('*').eq('bakery_id', bakery.id),
    supabase
      .from('orders')
      .select('id,customer_id,customer_name,customer_phone,product_name,date,total,status,occasion')
      .eq('bakery_id', bakery.id)
      .in('status', ['confirmado', 'entregado'])
      .gte('date', addDays(today, -730))
      .order('date', { ascending: false })
      .limit(5000),
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

  return (
    <>
      <Flash sp={sp} />
      <h1>Clientes</h1>
      <p className="muted">Se arma solo con los pedidos (web, WhatsApp y cargados a mano). Los mensajes se abren en tu WhatsApp, listos para enviar.</p>

      <div className="card">
        <h2>Ocasiones para recordar (próximos 30 días)</h2>
        <p className="muted">Clientes que hace un año pidieron para una fecha que se viene. Es el momento ideal para escribirles.</p>
        {occasions.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nada para recordar por ahora.</p>
        ) : (
          occasions.map((o) => {
            const name = String(o.customer_name).split(' ')[0];
            const anniversary = addDays(o.date, 365);
            const text = `¡Hola ${name}! El año pasado te hicimos ${o.product_name}${o.occasion ? ` para ${o.occasion}` : ''} (${dateLabel(o.date)}). ¿Lo festejamos de nuevo este año? 🎂 Podés pedir acá: ${catalog}`;
            const link = waMeLink(o.customer_phone, text);
            return (
              <div key={o.id} className="order-line row between">
                <span><strong>{o.customer_name}</strong> · {o.product_name}{o.occasion ? ` · ${o.occasion}` : ''} · se cumple el {dateLabel(anniversary)}</span>
                {link && <a className="btn small" href={link} target="_blank" rel="noreferrer">Escribirle</a>}
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <h2>Mensaje para todos (preventas y fechas especiales)</h2>
        <p className="muted">Ej.: «¡Abrimos la preventa del Día de la Madre! Hay cupos limitados: {catalog}». Escribí el mensaje y te armamos un botón por cliente.</p>
        <form method="get" className="stack">
          <textarea name="msg" defaultValue={campaign} placeholder="Escribí tu mensaje" />
          <div className="row">
            <button className="btn">Preparar mensajes</button>
            <a className="btn secondary" href={`/app/clientes?msg=${encodeURIComponent(`¡Hola! Te extrañamos 😊 Esta semana tenemos cupos libres. Pedí acá: ${catalog}`)}`}>Usar mensaje «te extrañamos»</a>
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
            <p className="muted" style={{ fontSize: 13 }}>Tip: escribí {'{nombre}'} en el mensaje y se reemplaza por el nombre de cada cliente.</p>
          </div>
        )}
      </div>

      <div className="card table-wrap">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Todos los clientes ({list.length})</h2>
          {inactive.length > 0 && <span className="badge warn">{inactive.length} sin pedir hace más de 60 días</span>}
        </div>
        {list.length === 0 ? (
          <p className="muted">Todavía no hay clientes. Aparecen solos cuando entran pedidos.</p>
        ) : (
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Cliente</th><th>Pedidos</th><th>Total comprado</th><th>Último pedido</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => {
                const link = waMeLink(c.phone, `¡Hola ${String(c.name).split(' ')[0]}! `);
                return (
                  <tr key={c.id}>
                    <td>{c.name}<br /><small>{c.phone}{c.email ? ` · ${c.email}` : ''}</small></td>
                    <td>{c.count}</td>
                    <td>{money(c.spent)}</td>
                    <td>{c.last ? <>{dateLabel(c.last)}<br /><small>{c.lastProduct}</small></> : '—'}</td>
                    <td>{link && <a className="btn secondary small" href={link} target="_blank" rel="noreferrer">WhatsApp</a>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
