import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { syncNow, importFile } from '../actions';
import { Flash, Locked, UploadCard } from '../ui';
import { money, dateTimeLabel } from '@/lib/format';
import { sheetUrl } from '@/lib/google';

export default async function Insumos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const { data: ingredients } = await supabase.from('ingredients').select('*').eq('bakery_id', bakery.id).order('sheet_row');

  return (
    <>
      <Flash sp={sp} />
      <div className="row between">
        <h1 style={{ margin: 0 }}>Insumos</h1>
        <div className="row">
          {bakery.sheet_insumos_id && <a className="btn secondary small" href={sheetUrl(bakery.sheet_insumos_id)} target="_blank" rel="noreferrer">Abrir planilla de insumos ↗</a>}
          {bakery.sheet_insumos_id && <form action={syncNow}><input type="hidden" name="back" value="/app/insumos" /><button className="btn small">Actualizar desde Drive</button></form>}
        </div>
      </div>
      <p className="muted">
        Última actualización: {dateTimeLabel(bakery.last_sync_at)}.
        {bakery.sheet_insumos_id ? ' AutoFlow revisa tu planilla de Drive cada 10 minutos.' : <> Podés subir un archivo o <Link href="/app/configuracion#drive">conectar Google Drive</Link> para que se actualice solo.</>}
      </p>
      {!access.costs && <Locked title="Módulo de Costos">Con el módulo de Costos, cada cambio de precio acá recalcula el costo de todas tus recetas.</Locked>}
      {bakery.last_sync_error && <div className="alert bad">{bakery.last_sync_error}</div>}

      <UploadCard kind="insumos" action={importFile} driveConnected={!!bakery.sheet_insumos_id} />

      <div className="card table-wrap">
        {!ingredients || ingredients.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin insumos todavía. Subí un archivo o conectá Google Drive.</p>
        ) : (
          <table>
            <thead><tr><th>Insumo</th><th>Presentación</th><th>Precio</th><th>Proveedor</th><th>Actualizado</th><th>Estado</th></tr></thead>
            <tbody>
              {ingredients.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.purchase_unit ? `${i.purchase_unit} · ` : ''}{i.qty ?? '—'} {i.unit}</td>
                  <td>{money(i.price)}</td>
                  <td>{i.supplier || ''}</td>
                  <td>{i.updated_label || ''}</td>
                  <td>{i.error ? <span className="badge bad">{i.error}</span> : <span className="badge ok">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
