import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { Flash } from '../../ui';
import Submit from '../submit';
import MarketingLocked from '../locked';
import { createKit } from '../actions';
import { GOALS, loadProducts, usage } from '@/lib/marketing';
import { MARKETING_LIMITS } from '@/lib/modules';
import { money, dateTimeLabel } from '@/lib/format';

export const maxDuration = 60;

export default async function Vender({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.marketing) return (<><h1>Vendé este producto</h1><MarketingLocked /></>);
  const [products, { data: kits }, u] = await Promise.all([
    loadProducts(supabase, bakery.id),
    supabase.from('marketing_kits').select('id,product_name,goal,created_at').eq('bakery_id', bakery.id).order('created_at', { ascending: false }).limit(20),
    usage(supabase, bakery.id),
  ]);
  const pre = products.find((p) => p.id === sp.producto)?.id || '';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vendé este producto</h1>
          <p>Elegí un producto y el agente arma todo para venderlo: guiones, posteos, mensajes de WhatsApp, speech cara a cara y respuestas a objeciones.</p>
        </div>
        <Link className="btn secondary" href="/app/marketing">← Marketing</Link>
      </div>
      <Flash sp={sp} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form action={createKit} className="card">
          <h2>Armar un kit de venta</h2>
          {products.length === 0 ? (
            <p>Primero cargá un producto con precio. <Link href="/app/productos?nuevo=1">Cargar producto →</Link></p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="product_id">Producto</label>
                <select id="product_id" name="product_id" required defaultValue={pre}>
                  <option value="" disabled>Elegí uno</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Objetivo</label>
                <div className="stack">
                  {Object.entries(GOALS).map(([k, v], i) => (
                    <label key={k} className="inline-label"><input type="radio" name="goal" value={k} defaultChecked={i === 1} /> {v}</label>
                  ))}
                </div>
              </div>
              <p className="hint">Opcional, pero mejora mucho el resultado:</p>
              <div className="field"><label htmlFor="publico">¿A quién se lo querés vender?</label><input id="publico" name="publico" maxLength={300} placeholder="Ej: parejas que festejan aniversario" /></div>
              <div className="field"><label htmlFor="distinto">¿Qué lo hace distinto?</label><input id="distinto" name="distinto" maxLength={300} placeholder="Ej: lo hacemos a pedido, con dulce de leche casero" /></div>
              <div className="field"><label htmlFor="promo">¿Hay promo o fecha límite?</label><input id="promo" name="promo" maxLength={300} placeholder="Ej: 10 % off hasta el domingo (dejalo vacío si no hay)" /></div>
              <div className="field"><label htmlFor="donde">¿Dónde lo vendés?</label><input id="donde" name="donde" maxLength={200} placeholder="Ej: Instagram, WhatsApp y en la feria del sábado" /></div>
              <Submit className="btn block" pending="Armando el kit… (hasta 50 segundos)">Armar kit de venta</Submit>
              <p className="hint">Te quedan {u.kitsLeft} de {MARKETING_LIMITS.kits} kits este mes.</p>
            </>
          )}
        </form>

        <div className="card">
          <h2>Kits anteriores</h2>
          {(kits || []).length === 0 ? <p className="muted" style={{ margin: 0 }}>Todavía no armaste ninguno.</p> : (
            <ul className="items">
              {kits.map((k) => (
                <li key={k.id} className="item">
                  <Link href={`/app/marketing/kit/${k.id}`} className="item-title" style={{ textDecoration: 'none' }}>{k.product_name}</Link>
                  <div className="item-meta"><span>{GOALS[k.goal]}</span><span>{dateTimeLabel(k.created_at)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
