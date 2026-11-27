import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireBakery } from '@/lib/session';
import { Flash } from '../../../ui';
import CopyLink from '../../../copy-link';
import ConfirmButton from '../../../confirm-button';
import Submit from '../../submit';
import MarketingLocked from '../../locked';
import { approvePiece, rejectPiece, requestChanges, editPiece, markPublished, deletePiece } from '../../actions';
import { KINDS, STATUS } from '@/lib/marketing';
import { dateLabel, todayAR } from '@/lib/format';

export const maxDuration = 60;

const NET = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

function scriptText(c) {
  const lines = [];
  if (c.ganchos?.length) lines.push('GANCHOS', ...c.ganchos.map((g, i) => `${i + 1}. ${g}`), '');
  if (c.escenas?.length) lines.push('ESCENAS', ...c.escenas.map((e) => `${e.segundos} s · ${e.toma}${e.texto_pantalla ? ` · En pantalla: ${e.texto_pantalla}` : ''}${e.voz ? ` · Voz: ${e.voz}` : ''}`), '');
  if (c.placas?.length) lines.push('PLACAS', ...c.placas.map((p, i) => `${i + 1}. ${p.titulo}: ${p.texto}`), '');
  if (c.speech) lines.push('PARA LEER A CÁMARA', c.speech);
  return lines.join('\n').trim();
}

export default async function Pieza({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.marketing) return (<><h1>Publicación</h1><MarketingLocked /></>);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: it } = await supabase.from('marketing_items').select('*').eq('bakery_id', bakery.id).eq('id', id).maybeSingle();
  if (!it) notFound();
  const { data: product } = it.product_id ? await supabase.from('products').select('id,name').eq('id', it.product_id).maybeSingle() : { data: null };
  const c = it.content || {};
  const tags = (c.hashtags || []).join(' ');
  const igText = [c.texto, tags].filter(Boolean).join('\n\n');
  const fbText = [c.texto_facebook || c.texto, tags].filter(Boolean).join('\n\n');
  const script = scriptText(c);
  const pending = it.status === 'para_aprobar';
  const badge = it.status === 'aprobada' || it.status === 'publicada' ? 'ok' : it.status === 'rechazada' ? 'bad' : 'warn';

  return (
    <>
      <Link href={`/app/marketing?ver=${it.status}`} className="back-link">← Marketing</Link>
      <div className="page-head">
        <div>
          <h1>{it.title}</h1>
          <p>
            {KINDS[it.kind]?.label} · {(it.networks || []).map((n) => NET[n] || n).join(', ')}
            {it.scheduled_for ? ` · para el ${dateLabel(it.scheduled_for)}` : ''}
            {product ? <> · <Link href={`/app/productos/${product.id}`}>{product.name}</Link></> : null}
          </p>
        </div>
        <span className={`badge ${badge}`}>{STATUS[it.status]}</span>
      </div>
      <Flash sp={sp} />
      {(c.alertas || []).map((a) => <div key={a} className="alert warn">{a}</div>)}
      {it.status === 'rechazada' && it.reject_reason && <div className="alert info">Motivo del rechazo: {it.reject_reason}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <img src={`/api/marketing/imagen/${it.id}?v=${encodeURIComponent(it.updated_at)}`} alt="Imagen sugerida para la publicación" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', display: 'block' }} />
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <a className="btn secondary small" href={`/api/marketing/imagen/${it.id}?descargar=1`}>Descargar imagen</a>
            {c.idea_visual && <span className="muted" style={{ fontSize: 13 }}>Idea: {c.idea_visual}</span>}
          </div>
          <h3 style={{ marginTop: 16 }}>Texto para Instagram</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{c.texto}</p>
          {tags && <p className="muted" style={{ wordBreak: 'break-word' }}>{tags}</p>}
          <div className="row" style={{ gap: 8 }}>
            <CopyLink value={igText} label="Copiar texto de Instagram" />
            <CopyLink value={fbText} label="Copiar texto de Facebook" />
            {script && <CopyLink value={script} label="Copiar guion" />}
          </div>
        </div>

        <div>
          {pending && (
            <div className="card">
              <h2>¿La aprobás?</h2>
              <form action={approvePiece}>
                <input type="hidden" name="id" value={it.id} />
                <div className="field">
                  <label htmlFor="date">Fecha de publicación</label>
                  <input id="date" type="date" name="date" defaultValue={it.scheduled_for || todayAR()} min={todayAR()} />
                </div>
                <Submit className="btn block" pending="Aprobando…">Aprobar</Submit>
              </form>
              <form action={requestChanges} style={{ marginTop: 14 }}>
                <input type="hidden" name="id" value={it.id} />
                <div className="field">
                  <label htmlFor="feedback">Pedir cambios</label>
                  <textarea id="feedback" name="feedback" rows={2} maxLength={600} placeholder="Ej: más corto, sin emojis, nombrá que hacemos envíos" />
                </div>
                <Submit className="btn secondary block" pending="Rehaciendo… (hasta 30 segundos)">Rehacer con estos cambios</Submit>
                {it.revisions > 0 && <p className="hint">Cambios pedidos: {it.revisions} de 5.</p>}
              </form>
              <form action={rejectPiece} style={{ marginTop: 14 }}>
                <input type="hidden" name="id" value={it.id} />
                <div className="field">
                  <label htmlFor="reason">Rechazar (el agente aprende del motivo)</label>
                  <input id="reason" name="reason" maxLength={300} placeholder="Ej: no promocionamos ese producto en verano" />
                </div>
                <Submit className="btn secondary block" pending="Guardando…">Rechazar</Submit>
              </form>
            </div>
          )}

          {it.status === 'aprobada' && (
            <div className="card">
              <h2>Lista para publicar</h2>
              <ol style={{ paddingLeft: 18 }}>
                <li>Descargá la imagen o grabá el video siguiendo el guion.</li>
                <li>Copiá el texto y pegalo al subirla en {(it.networks || []).map((n) => NET[n] || n).join(' y ')}.</li>
                <li>Marcala como publicada para llevar la cuenta.</li>
              </ol>
              <form action={markPublished}>
                <input type="hidden" name="id" value={it.id} />
                <Submit className="btn block" pending="Guardando…">Ya la publiqué</Submit>
              </form>
            </div>
          )}

          {c.ganchos?.length > 0 && (
            <div className="card">
              <h3>Ganchos para los primeros 3 segundos</h3>
              <ol style={{ paddingLeft: 18, margin: 0 }}>{c.ganchos.map((g) => <li key={g}>{g}</li>)}</ol>
            </div>
          )}

          {c.escenas?.length > 0 && (
            <div className="card">
              <h3>Guion</h3>
              <table className="recipe-table" style={{ width: '100%' }}>
                <thead><tr><th>Seg.</th><th>Toma</th><th>En pantalla</th><th>Voz</th></tr></thead>
                <tbody>{c.escenas.map((e, i) => <tr key={i}><td>{e.segundos}</td><td>{e.toma}</td><td>{e.texto_pantalla}</td><td>{e.voz}</td></tr>)}</tbody>
              </table>
            </div>
          )}

          {c.placas?.length > 0 && (
            <div className="card">
              <h3>{it.kind === 'historia' ? 'Pantallas de la historia' : 'Placas'}</h3>
              <ol style={{ paddingLeft: 18, margin: 0 }}>{c.placas.map((p, i) => <li key={i}><strong>{p.titulo}</strong>: {p.texto}</li>)}</ol>
            </div>
          )}

          {c.speech && (
            <div className="card">
              <h3>Para leer a cámara</h3>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{c.speech}</p>
            </div>
          )}

          {c.horario && <p className="muted">Mejor momento sugerido: {c.horario}</p>}

          {it.status !== 'publicada' && (
            <details className="card">
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Editar a mano</summary>
              <form action={editPiece} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={it.id} />
                <div className="field"><label htmlFor="texto">Texto para Instagram</label><textarea id="texto" name="texto" rows={6} maxLength={2200} defaultValue={c.texto || ''} /></div>
                <div className="field"><label htmlFor="texto_facebook">Texto para Facebook</label><textarea id="texto_facebook" name="texto_facebook" rows={4} maxLength={2200} defaultValue={c.texto_facebook || ''} /></div>
                {c.speech ? <div className="field"><label htmlFor="speech">Para leer a cámara</label><textarea id="speech" name="speech" rows={4} maxLength={1500} defaultValue={c.speech} /></div> : null}
                <div className="field"><label htmlFor="hashtags">Hashtags</label><input id="hashtags" name="hashtags" defaultValue={tags} /></div>
                <div className="field"><label htmlFor="edate">Fecha</label><input id="edate" type="date" name="date" defaultValue={it.scheduled_for || ''} /></div>
                <Submit className="btn block" pending="Guardando…">Guardar cambios</Submit>
              </form>
            </details>
          )}

          <form action={deletePiece} style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={it.id} />
            <ConfirmButton className="btn secondary small" message="¿Borrar esta publicación? No se puede deshacer.">Borrar publicación</ConfirmButton>
          </form>
        </div>
      </div>
    </>
  );
}
