import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { Flash } from '../../ui';
import Submit from '../submit';
import MarketingLocked from '../locked';
import { createPiece } from '../actions';
import { KINDS, loadProducts } from '@/lib/marketing';
import { money, todayAR, addDays } from '@/lib/format';

export const maxDuration = 60;

export default async function Crear({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.marketing) return (<><h1>Crear publicación</h1><MarketingLocked /></>);
  const products = (await loadProducts(supabase, bakery.id)).filter((p) => p.visible !== false);
  const pre = products.find((p) => p.id === sp.producto)?.id || '';

  return (
    <div className="narrow" style={{ marginTop: 0 }}>
      <Link href="/app/marketing" className="back-link">← Marketing</Link>
      <h1>Crear publicación</h1>
      <p className="muted">Decile al agente qué querés publicar. Arma el texto, los hashtags y, si es un reel, el guion con 3 ganchos. Después la revisás y la aprobás.</p>
      <Flash sp={sp} />
      <form action={createPiece} className="card">
        <div className="field">
          <label>Formato</label>
          <div className="stack">
            {Object.entries(KINDS).map(([k, v], i) => (
              <label key={k} className="inline-label"><input type="radio" name="kind" value={k} defaultChecked={i === 1} /> <strong>{v.label}</strong> — {v.hint}</label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="product_id">Producto (opcional)</label>
          <select id="product_id" name="product_id" defaultValue={pre}>
            <option value="">Que elija el agente</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="request">¿Qué querés contar? (opcional)</label>
          <textarea id="request" name="request" rows={3} maxLength={600} placeholder="Ej: que ya tomamos pedidos para Navidad, que se reserva con seña y que quedan pocos lugares" />
        </div>
        <div className="field">
          <label htmlFor="date">¿Para qué día?</label>
          <input id="date" type="date" name="date" defaultValue={addDays(todayAR(), 1)} min={todayAR()} />
        </div>
        <div className="field">
          <label>Redes</label>
          <div className="row" style={{ gap: 14 }}>
            <label className="inline-label"><input type="checkbox" name="net_instagram" defaultChecked /> Instagram</label>
            <label className="inline-label"><input type="checkbox" name="net_facebook" defaultChecked /> Facebook</label>
            <label className="inline-label"><input type="checkbox" name="net_tiktok" /> TikTok</label>
          </div>
        </div>
        <Submit className="btn block" pending="El agente está escribiendo… (hasta 30 segundos)">Crear con IA</Submit>
      </form>
    </div>
  );
}
