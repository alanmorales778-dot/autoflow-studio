import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { Flash, Locked } from '../ui';
import { normName } from '@/lib/format';
import { costBreakdown } from '@/lib/costs';
import Simulator from './simulator';
import { liveCosts } from '@/lib/sheets';

export default async function Costos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);

  if (!access.costs) {
    return (
      <>
        <div className="page-head"><div><h1>Costos e inflación</h1></div></div>
        <Locked title="Simulador de inflación">Con el módulo de Costos simulás subas de insumos y ves qué productos dejan de ser negocio antes de que pase.</Locked>
      </>
    );
  }

  const [{ data: rawProducts }, { data: ingredients }, live] = await Promise.all([
    supabase.from('products').select('id,name,price,cost,cost_error').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row'),
    supabase.from('ingredients').select('*').eq('bakery_id', bakery.id),
    liveCosts(supabase, bakery),
  ]);
  const products = (rawProducts || []).map((p) => ({ ...p, cost_error: live.get(p.id)?.error ?? p.cost_error }));
  const ids = (products || []).map((p) => p.id);
  const { data: items } = ids.length ? await supabase.from('recipe_items').select('*').in('product_id', ids) : { data: [] };
  const ingByName = new Map((ingredients || []).map((i) => [normName(i.name), i]));
  const byProduct = new Map();
  for (const it of items || []) {
    if (!byProduct.has(it.product_id)) byProduct.set(it.product_id, []);
    byProduct.get(it.product_id).push(it);
  }

  const rows = (products || [])
    .filter((p) => !p.cost_error)
    .map((p) => ({ id: p.id, name: p.name, price: Number(p.price) || 0, parts: costBreakdown(byProduct.get(p.id), ingByName) }))
    .filter((r) => r.parts.length && r.price > 0);
  const incomplete = (products || []).filter((p) => p.cost_error && p.cost_error !== 'Sin receta cargada').map((p) => p.name);
  const missing = (products || []).filter((p) => (!p.cost_error || p.cost_error === 'Sin receta cargada') && !rows.find((r) => r.id === p.id)).map((p) => p.name);

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Costos e inflación</h1>
          <p>Simulá una suba de {T.insumos.toLowerCase()} y mirá qué {T.items.toLowerCase()} dejan de ser negocio antes de que pase. Nada cambia hasta que aplicás.</p>
        </div>
        <Link href="/app/insumos" className="btn secondary small">Actualizar precios de {T.insumos.toLowerCase()}</Link>
      </div>
      {rows.length === 0 ? (
        <div className="card">
          <h2>{incomplete.length ? 'Hay fichas incompletas' : 'Todavía no hay nada con costo'}</h2>
          <p className="muted" style={{ marginBottom: 12 }}>Cargá tus {T.insumos.toLowerCase()} y qué lleva cada {T.item} para usar el simulador.</p>
          <Link href="/app/productos" className="btn">Ir a {T.items}</Link>
        </div>
      ) : (
        <Simulator rows={rows} overhead={Number(bakery.overhead_percent) || 0} margin={Number(bakery.margin_percent) || 0} drive={!!bakery.google_refresh_token_enc} />
      )}
      {incomplete.length > 0 && <div className="alert warn" style={{ marginTop: 12 }}>Receta incompleta, no entran en la simulación hasta que la completes: {incomplete.join(', ')}. <Link href="/app/productos">Revisar</Link></div>}
      {missing.length > 0 && rows.length > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Sin receta o sin precio, no entran en la simulación: {missing.join(', ')}.</p>}
    </>
  );
}
