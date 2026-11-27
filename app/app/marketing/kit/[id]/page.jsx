import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireBakery } from '@/lib/session';
import { Flash } from '../../../ui';
import CopyLink from '../../../copy-link';
import Submit from '../../submit';
import MarketingLocked from '../../locked';
import { kitToCampaign } from '../../actions';
import { GOALS, orderLink } from '@/lib/marketing';

const arr = (v) => (Array.isArray(v) ? v : []);
const scenesText = (escenas) => arr(escenas).map((e) => `${e.segundos} s · ${e.toma}${e.texto_pantalla ? ` · En pantalla: ${e.texto_pantalla}` : ''}${e.voz ? ` · Voz: ${e.voz}` : ''}`).join('\n');

function Section({ title, copy, children }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {copy ? <CopyLink value={copy} label="Copiar" /> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Scenes({ escenas }) {
  if (!arr(escenas).length) return null;
  return (
    <table className="recipe-table" style={{ width: '100%' }}>
      <thead><tr><th>Seg.</th><th>Toma</th><th>En pantalla</th><th>Voz</th></tr></thead>
      <tbody>{escenas.map((e, i) => <tr key={i}><td>{e.segundos}</td><td>{e.toma}</td><td>{e.texto_pantalla}</td><td>{e.voz}</td></tr>)}</tbody>
    </table>
  );
}

export default async function Kit({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.marketing) return (<><h1>Kit de venta</h1><MarketingLocked /></>);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: kit } = await supabase.from('marketing_kits').select('*').eq('bakery_id', bakery.id).eq('id', id).maybeSingle();
  if (!kit) notFound();
  const { count: used } = await supabase.from('marketing_items').select('id', { count: 'exact', head: true }).eq('kit_id', kit.id);
  const k = kit.content || {};
  const link = orderLink(bakery, access.base) || (bakery.whatsapp_contact ? `WhatsApp ${bakery.whatsapp_contact}` : 'el link de tu bio');
  const wa = String(k.whatsapp || '').replace(/\[link\]/gi, link);
  const f = k.ficha || {};
  const cc = k.cara_a_cara || {};
  const posteo = [k.posteo?.texto, arr(k.posteo?.hashtags).map((h) => `#${String(h).replace(/^#+/, '')}`).join(' ')].filter(Boolean).join('\n\n');

  return (
    <>
      <Link href="/app/marketing/vender" className="back-link">← Vendé este producto</Link>
      <div className="page-head">
        <div>
          <h1>Kit de venta: {kit.product_name}</h1>
          <p>{GOALS[kit.goal]}. Todo usa tus datos reales; revisalo antes de usarlo.</p>
        </div>
        {used ? (
          <Link className="btn secondary" href="/app/marketing">Ver la campaña →</Link>
        ) : (
          <form action={kitToCampaign}>
            <input type="hidden" name="id" value={kit.id} />
            <Submit pending="Creando campaña…">Convertir en campaña de 9 días</Submit>
          </form>
        )}
      </div>
      <Flash sp={sp} />
      {arr(k.alertas).map((a) => <div key={a} className="alert warn">{a}</div>)}
      {!used && <p className="muted">La campaña crea 5 publicaciones (2 reels, carrusel, historia y posteo) repartidas en 9 días. Cada una pasa por tu aprobación.</p>}

      <Section title="Ficha de venta" copy={[f.promesa, f.para_quien, ...arr(f.beneficios), f.diferencial, f.prueba].filter(Boolean).join('\n')}>
        <p><strong>Promesa:</strong> {f.promesa}</p>
        <p><strong>Para quién:</strong> {f.para_quien}</p>
        {arr(f.beneficios).length > 0 && <ul>{f.beneficios.map((b) => <li key={b}>{b}</li>)}</ul>}
        {f.diferencial && <p><strong>Diferencial:</strong> {f.diferencial}</p>}
        {f.prueba && <p style={{ marginBottom: 0 }}><strong>Prueba:</strong> {f.prueba}</p>}
      </Section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Section title="Reel de 30 segundos" copy={`GANCHOS\n${arr(k.reel30?.ganchos).map((g, i) => `${i + 1}. ${g}`).join('\n')}\n\nESCENAS\n${scenesText(k.reel30?.escenas)}`}>
          <p className="hint">3 ganchos para elegir:</p>
          <ol style={{ paddingLeft: 18 }}>{arr(k.reel30?.ganchos).map((g) => <li key={g}>{g}</li>)}</ol>
          <Scenes escenas={k.reel30?.escenas} />
        </Section>
        <Section title="Reel de 10 segundos (para probar)" copy={`${k.reel10?.gancho || ''}\n${scenesText(k.reel10?.escenas)}`}>
          <p><strong>Gancho:</strong> {k.reel10?.gancho}</p>
          <Scenes escenas={k.reel10?.escenas} />
          <p className="hint">Subilo como Trial Reel: Instagram lo muestra primero a gente que no te sigue.</p>
        </Section>
      </div>

      <Section title="Para leer a cámara" copy={k.speech_camara}>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{k.speech_camara}</p>
      </Section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Section title="Carrusel de 5 placas" copy={arr(k.carrusel).map((p, i) => `${i + 1}. ${p.titulo}: ${p.texto}`).join('\n')}>
          <ol style={{ paddingLeft: 18, margin: 0 }}>{arr(k.carrusel).map((p, i) => <li key={i}><strong>{p.titulo}</strong>: {p.texto}</li>)}</ol>
        </Section>
        <Section title="Texto del posteo" copy={posteo}>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{posteo}</p>
        </Section>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Section title="Mensaje de WhatsApp" copy={wa}>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{wa}</p>
          <p className="hint">Para clientes que ya te compraron o preguntaron. Mandalo desde tu WhatsApp.</p>
        </Section>
        <Section title="Respuesta a «comentá QUIERO»" copy={String(k.quiero || '').replace(/\[link\]/gi, link)}>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{String(k.quiero || '').replace(/\[link\]/gi, link)}</p>
          <p className="hint">Pedí en el posteo que comenten QUIERO y respondé con este mensaje por privado.</p>
        </Section>
      </div>

      <Section title="Speech para vender cara a cara" copy={[cc.apertura, ...arr(cc.preguntas), cc.presentacion, cc.cierre, cc.sumar].filter(Boolean).join('\n')}>
        <p><strong>Apertura:</strong> {cc.apertura}</p>
        {arr(cc.preguntas).length > 0 && <><p style={{ marginBottom: 4 }}><strong>Preguntas para entender qué necesita:</strong></p><ul>{cc.preguntas.map((q) => <li key={q}>{q}</li>)}</ul></>}
        <p><strong>Presentación:</strong> {cc.presentacion}</p>
        <p><strong>Cierre:</strong> {cc.cierre}</p>
        {cc.sumar && <p style={{ marginBottom: 0 }}><strong>Para sumar:</strong> {cc.sumar}</p>}
      </Section>

      <Section title="Respuestas a objeciones" copy={arr(k.objeciones).map((o) => `«${o.objecion}»\n${o.respuesta}`).join('\n\n')}>
        {arr(k.objeciones).map((o) => (
          <div key={o.objecion} style={{ marginBottom: 10 }}>
            <strong>«{o.objecion}»</strong>
            <p style={{ margin: '2px 0 0' }}>{o.respuesta}</p>
          </div>
        ))}
      </Section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Section title="Anuncio pago (orientativo)" copy={arr(k.anuncio?.textos).join('\n\n')}>
          <ol style={{ paddingLeft: 18 }}>{arr(k.anuncio?.textos).map((t) => <li key={t}>{t}</li>)}</ol>
          {k.anuncio?.publico && <p><strong>Público:</strong> {k.anuncio.publico}</p>}
          {k.anuncio?.presupuesto && <p style={{ marginBottom: 0 }}><strong>Presupuesto sugerido:</strong> {k.anuncio.presupuesto}</p>}
        </Section>
        <Section title="Descripción para tu catálogo" copy={k.catalogo}>
          <p style={{ margin: 0 }}>{k.catalogo}</p>
          {kit.product_id && <p className="hint"><Link href={`/app/productos/${kit.product_id}`}>Pegarla en la ficha del producto →</Link></p>}
        </Section>
      </div>
    </>
  );
}
