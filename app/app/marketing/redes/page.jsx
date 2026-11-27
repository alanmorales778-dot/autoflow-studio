import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';
import { Flash } from '../../ui';
import Submit from '../submit';
import MarketingLocked from '../locked';
import { disconnectInstagram } from '../actions';
import { hasInstagram, getIgAccount } from '@/lib/instagram';
import { dateTimeLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Redes({ searchParams }) {
  const sp = await searchParams;
  const { bakery, access } = await requireBakery();
  if (!access.marketing) return (<><h1>Redes</h1><MarketingLocked /></>);
  const igOn = hasInstagram();
  const ig = igOn ? await getIgAccount(createAdmin(), bakery.id) : null;

  return (
    <div className="narrow" style={{ marginTop: 0 }}>
      <Link href="/app/marketing" className="back-link">← Marketing</Link>
      <h1>Redes</h1>
      <p className="muted">Conectá tus redes para que las publicaciones que aprobás se publiquen solas el día y la hora que elijas. Nada se publica sin tu aprobación.</p>
      <Flash sp={sp} />

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Instagram</h2>
            {ig ? (
              <p style={{ margin: '4px 0 0' }}>
                Conectado{ig.username ? <> como <strong>@{ig.username}</strong></> : ''}
                {ig.status === 'vencida' && <span className="badge bad" style={{ marginLeft: 8 }}>Permiso vencido</span>}
                {ig.token_expires_at && ig.status === 'ok' && <span className="muted"> · el permiso se renueva solo (vence el {dateTimeLabel(ig.token_expires_at)})</span>}
              </p>
            ) : (
              <p className="muted" style={{ margin: '4px 0 0' }}>{igOn ? 'Necesitás una cuenta profesional (de empresa o de creador).' : 'Próximamente vas a poder conectarlo desde acá.'}</p>
            )}
          </div>
          {igOn && (!ig || ig.status !== 'ok') && <a className="btn" href="/api/meta/instagram/connect">{ig ? 'Volver a conectar' : 'Conectar Instagram'}</a>}
          {ig && (
            <form action={disconnectInstagram}>
              <Submit className="btn secondary small" pending="Desconectando…">Desconectar</Submit>
            </form>
          )}
        </div>
        {igOn && (
          <p className="hint" style={{ marginBottom: 0 }}>
            Por ahora se publican solos los posteos de foto de un producto (con la foto JPG del producto). Reels, historias y carruseles se suben a mano con el guion.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: 0 }}>Facebook</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>Próximamente. Mientras tanto, copiá el texto para Facebook de cada publicación y subila desde tu página.</p>
      </div>

      <div className="card">
        <h2 style={{ margin: 0 }}>TikTok</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>Próximamente. Los guiones de reels sirven también para TikTok.</p>
      </div>

      <p className="hint">Tus datos de Instagram se guardan cifrados. Cómo borrarlos: <Link href="/legal/borrado">Borrado de datos</Link>.</p>
    </div>
  );
}
