import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { rubroOf } from '@/lib/rubros';
import { StatusBadge } from '../ui';
import { money, dateLabel, normName } from '@/lib/format';

// Buscador único: pedidos, clientes, productos e insumos en un solo lugar.
export default async function Buscar({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery } = await requireBakery();
  const T = rubroOf(bakery);
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const needle = normName(q);
  const digits = q.replace(/\D/g, '');
  const match = (...vals) => vals.some((v) => normName(v || '').includes(needle)) || (digits.length >= 3 && vals.some((v) => String(v || '').replace(/\D/g, '').includes(digits)));

  let orders = [];
  let customers = [];
  let products = [];
  let ingredients = [];
  if (q.length >= 2) {
    const [o, c, p, i] = await Promise.all([
      supabase.from('orders').select('id,date,slot,quantity,product_name,customer_name,customer_phone,status,total').eq('bakery_id', bakery.id).order('date', { ascending: false }).limit(400),
      supabase.from('customers').select('id,name,phone,email').eq('bakery_id', bakery.id).limit(500),
      supabase.from('products').select('id,name,price,category,photo_url').eq('bakery_id', bakery.id).not('sheet_row', 'is', null),
      supabase.from('ingredients').select('id,name,price,purchase_unit,supplier').eq('bakery_id', bakery.id),
    ]);
    orders = (o.data || []).filter((x) => match(x.customer_name, x.product_name, x.customer_phone)).slice(0, 12);
    customers = (c.data || []).filter((x) => match(x.name, x.phone, x.email)).slice(0, 8);
    products = (p.data || []).filter((x) => match(x.name, x.category)).slice(0, 8);
    ingredients = (i.data || []).filter((x) => match(x.name, x.supplier)).slice(0, 8);
  }
  const total = orders.length + customers.length + products.length + ingredients.length;

  return (
    <>
      <h1>Buscar</h1>
      <form method="get" className="search-big" role="search">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" /></svg>
        <input name="q" defaultValue={q} autoFocus placeholder={`Nombre, teléfono, ${T.item} o ${T.insumo.toLowerCase()}`} aria-label="Qué buscás" enterKeyHint="search" />
        <button className="btn">Buscar</button>
      </form>

      {q.length < 2 ? (
        <p className="muted">Escribí al menos 2 letras. Busca en {T.orders.toLowerCase()}, clientes, {T.items.toLowerCase()} y {T.insumos.toLowerCase()} a la vez.</p>
      ) : total === 0 ? (
        <div className="card"><p style={{ margin: 0 }}>No encontramos nada con «{q}». Probá con otra parte del nombre o el teléfono.</p></div>
      ) : (
        <div className="search-results">
          {orders.length > 0 && (
            <section className="card">
              <h2>{T.orders} <span className="count-pill">{orders.length}</span></h2>
              <ul className="items">
                {orders.map((o) => (
                  <li key={o.id} className="item">
                    <Link href={`/app/pedidos?q=${encodeURIComponent(o.customer_name)}&f=${['pendiente_sena', 'confirmado'].includes(o.status) ? 'activos' : o.status === 'entregado' ? 'entregado' : 'cancelado,vencido'}#p-${o.id}`} className="item-link">
                      <div className="item-head">
                        <div>
                          <div className="item-title">{o.quantity} × {o.product_name}</div>
                          <div className="item-sub">{o.customer_name} · {dateLabel(o.date)}{o.slot ? ` · ${o.slot}` : ''}</div>
                        </div>
                        <StatusBadge status={o.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {customers.length > 0 && (
            <section className="card">
              <h2>Clientes <span className="count-pill">{customers.length}</span></h2>
              <ul className="items">
                {customers.map((c) => (
                  <li key={c.id} className="item">
                    <Link href={`/app/clientes?q=${encodeURIComponent(c.name)}`} className="item-link">
                      <div className="item-title">{c.name}</div>
                      <div className="item-sub">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {products.length > 0 && (
            <section className="card">
              <h2>{T.items} <span className="count-pill">{products.length}</span></h2>
              <ul className="items">
                {products.map((p) => (
                  <li key={p.id} className="item">
                    <Link href={`/app/productos/${p.id}`} className="item-link item-head" style={{ alignItems: 'center' }}>
                      <span className={`thumb ${p.photo_url ? '' : 'empty'}`}>{p.photo_url ? <img src={p.photo_url} alt="" /> : <span>{p.name.charAt(0)}</span>}</span>
                      <span style={{ flex: 1 }}><span className="item-title">{p.name}</span><span className="item-sub" style={{ display: 'block' }}>{p.category}</span></span>
                      <span className="item-title money-col">{money(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {ingredients.length > 0 && (
            <section className="card">
              <h2>{T.insumos} <span className="count-pill">{ingredients.length}</span></h2>
              <ul className="items">
                {ingredients.map((i) => (
                  <li key={i.id} className="item">
                    <Link href="/app/insumos" className="item-link item-head">
                      <span><span className="item-title">{i.name}</span><span className="item-sub" style={{ display: 'block' }}>{[i.purchase_unit, i.supplier].filter(Boolean).join(' · ')}</span></span>
                      <span className="item-title money-col">{money(i.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
