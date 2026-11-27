import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { hasAI } from '@/lib/ai';
import { Flash } from '../ui';
import Submit from './submit';
import { createWeekPlan } from './actions';
import MarketingLocked from './locked';
import { KINDS, STATUS, usage, upcomingDates } from '@/lib/marketing';
import { MARKETING_LIMITS } from '@/lib/modules';
import { dateLabel } from '@/lib/format';

export const maxDuration = 60;

const FILTERS = ['para_aprobar', 'aprobada', 'publicada', 'rechazada'];

export default async function Marketing({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.marketing) {
    return (
      <>
        <div className="page-head"><div><h1>Marketing IA</h1><p>Tu agente de marketing para redes sociales.</p></div></div>
        <Flash sp={sp} />
        <MarketingLocked />
      </>
    );
  }

  const ver = FILTERS.includes(sp.ver) ? sp.ver : 'para_aprobar';
  const [{ data: items }, { data: counts }, { data: brand }, { count: productCount }, u] = await Promise.all([
    supabase.from('marketing_items').select('id,kind,title,status,scheduled_for,created_at,content,product_id,source').eq('bakery_id', bakery.id).eq('status', ver)
      .order(ver === 'para_aprobar' || ver === 'aprobada' ? 'scheduled_for' : 'updated_at', { ascending: ver === 'para_aprobar' || ver === 'aprobada', nullsFirst: false }).limit(60),
    supabase.from('marketing_items').select('status').eq('bakery_id', bakery.id).in('status', ['para_aprobar', 'aprobada']).limit(500),
    supabase.from('marketing_brand').select('bakery_id').eq('bakery_id', bakery.id).maybeSingle(),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).not('sheet_row', 'is', null),
    usage(supabase, bakery.id),
  ]);
  const n = (s) => (counts || []).filter((c) => c.status === s).length;
  const next = upcomingDates(undefined, 30);
  const ai = hasAI();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Marketing IA</h1>
          <p>Tu agente arma las publicaciones con los datos de tu negocio. Nada se publica sin tu OK.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn secondary" href="/app/marketing/marca">Perfil de marca</Link>
          <Link className="btn secondary" href="/app/marketing/vender">Vendé este producto</Link>
          <Link className="btn" href="/app/marketing/crear">+ Crear publicación</Link>
        </div>
      </div>
      <Flash sp={sp} />

      {!ai && <div className="alert warn">La IA todavía no está configurada en el servidor: el agente no puede crear contenido.</div>}
      {!brand && <div className="alert info"><strong>Primer paso:</strong> contale al agente cómo habla tu marca. <Link href="/app/marketing/marca">Completar perfil de marca (2 minutos) →</Link></div>}
      {!productCount && <div className="alert info">Cargá tus {access.marketingOnly ? 'productos o servicios' : 'productos'} con precio y foto: el agente los usa para escribir. <Link href="/app/productos?nuevo=1">Cargar →</Link></div>}

      <div className="kpis">
        <div className="card kpi"><span className="l">Para aprobar</span><span className="v">{n('para_aprobar')}</span></div>
        <div className="card kpi"><span className="l">Aprobadas sin publicar</span><span className="v">{n('aprobada')}</span></div>
        <div className="card kpi"><span className="l">Publicaciones este mes</span><span className="v">{u.pieces} <small style={{ display: 'inline' }}>de {MARKETING_LIMITS.pieces}</small></span></div>
        <div className="card kpi"><span className="l">Kits de venta este mes</span><span className="v">{u.kits} <small style={{ display: 'inline' }}>de {MARKETING_LIMITS.kits}</small></span></div>
      </div>

      <div className="card">
        <div className="between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Plan de la semana</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>5 publicaciones para los próximos 7 días (al menos 2 reels), pensadas para tus productos que más dejan{next.length ? ` y para ${next[0][1]} (${dateLabel(next[0][0])})` : ''}.</p>
          </div>
          <form action={createWeekPlan}>
            <Submit pending="Armando el plan… (hasta 40 segundos)">Armar el plan de la semana</Submit>
          </form>
        </div>
      </div>

      <div className="filters" role="navigation" aria-label="Filtrar">
        {FILTERS.map((f) => (
          <Link key={f} href={`/app/marketing?ver=${f}`} className={`chip ${ver === f ? 'on' : ''}`}>{STATUS[f]}{f === 'para_aprobar' && n(f) ? ` (${n(f)})` : ''}</Link>
        ))}
      </div>

      <div className="card">
        {(items || []).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {ver === 'para_aprobar' ? 'No hay publicaciones esperando tu aprobación. Armá el plan de la semana o creá una publicación.' : `No hay publicaciones ${STATUS[ver].toLowerCase()}s.`}
          </p>
        ) : (
          <ul className="items">
            {items.map((it) => {
              const alerts = (it.content?.alertas || []).length;
              const hook = it.content?.ganchos?.[0] || it.content?.texto || '';
              return (
                <li key={it.id} className="item">
                  <div className="item-head">
                    <div>
                      <Link href={`/app/marketing/pieza/${it.id}`} className="item-title" style={{ textDecoration: 'none' }}>{it.title}</Link>
                      <div className="item-sub">{String(hook).slice(0, 140)}{String(hook).length > 140 ? '…' : ''}</div>
                    </div>
                    <span className="badge">{KINDS[it.kind]?.label || it.kind}</span>
                  </div>
                  <div className="item-meta">
                    {it.scheduled_for && <span>Para el {dateLabel(it.scheduled_for)}</span>}
                    {it.source === 'plan' && <span>Plan de la semana</span>}
                    {it.source === 'kit' && <span>Campaña de producto</span>}
                    {alerts > 0 && <span className="badge warn">{alerts === 1 ? '1 cosa para revisar' : `${alerts} cosas para revisar`}</span>}
                    <Link href={`/app/marketing/pieza/${it.id}`}>{ver === 'para_aprobar' ? 'Revisar y aprobar →' : 'Ver →'}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Cómo publicar</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Por ahora la publicación es manual: aprobás la publicación, copiás el texto, descargás la imagen y la subís desde tu celular a Instagram, Facebook o TikTok. Próximamente vas a poder conectar tus redes para que se publique sola, siempre después de tu aprobación.
        </p>
      </div>
    </>
  );
}
