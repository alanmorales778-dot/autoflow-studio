import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { syncNow, importFile, saveIngredient } from '../actions';
import { Flash, Locked, UploadCard } from '../ui';
import ImportPreview from '../import-preview';
import { money, dateTimeLabel } from '@/lib/format';
import { sheetUrl } from '@/lib/google';
import { has } from '@/lib/env';
import { RECIPE_UNITS } from '@/lib/costs';

export default async function Insumos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const { data: ingredients } = await supabase.from('ingredients').select('*').eq('bakery_id', bakery.id).order('sheet_row');
  const fromDrive = !!bakery.sheet_insumos_id;
  const drive = has.google();

  return (
    <>
      <Flash sp={sp} />
      <div className="row between">
        <h1 style={{ margin: 0 }}>{T.insumos}</h1>
        <div className="row">
          {bakery.sheet_insumos_id && <a className="btn secondary small" href={sheetUrl(bakery.sheet_insumos_id)} target="_blank" rel="noreferrer">Abrir planilla de {T.insumos.toLowerCase()} ↗</a>}
          {bakery.sheet_insumos_id && <form action={syncNow}><input type="hidden" name="back" value="/app/insumos" /><button className="btn small">Actualizar desde Drive</button></form>}
        </div>
      </div>
      <p className="muted">
        {fromDrive ? <>Última actualización: {dateTimeLabel(bakery.last_sync_at)}. AutoFlow revisa tu planilla de Drive cada 10 minutos.</> : <>Cuando cambia un precio, cambialo acá y tocá «Guardar»: el costo de tus {T.items.toLowerCase()} se recalcula al instante. Si son muchos, subí un archivo{drive ? <> o <Link href="/app/configuracion#drive">conectá Google Drive</Link></> : ''}.</>}
      </p>
      {!access.costs && <Locked title="Módulo de Costos">Con el módulo de Costos, cada cambio de precio acá recalcula el costo de todos tus {T.items.toLowerCase()}.</Locked>}
      {bakery.last_sync_error && <div className="alert bad">{bakery.last_sync_error}</div>}

      <ImportPreview bakery={bakery} kind="insumos" id={sp.vista} />
      {!sp.vista && <UploadCard kind="insumos" action={importFile} driveConnected={!!bakery.sheet_insumos_id} />}

      <div className="card table-wrap">
        {!ingredients || ingredients.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin {T.insumos.toLowerCase()} todavía. Agregá el primero abajo o subí un archivo.</p>
        ) : (
          <table>
            <thead><tr><th>{T.insumo}</th><th>Presentación</th><th>Precio</th><th>Proveedor</th><th>Actualizado</th><th>Estado</th></tr></thead>
            <tbody>
              {ingredients.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.purchase_unit ? `${i.purchase_unit} · ` : ''}{i.qty ?? '—'} {i.unit}</td>
                  <td>
                    {fromDrive ? money(i.price) : (
                      <form action={saveIngredient} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <input type="hidden" name="id" value={i.id} />
                        <input name="price" inputMode="decimal" defaultValue={i.price ?? ''} aria-label={`Precio de ${i.name}`} style={{ maxWidth: 110 }} />
                        <button className="btn secondary small">Guardar</button>
                      </form>
                    )}
                  </td>
                  <td>{i.supplier || ''}</td>
                  <td>{i.updated_label || ''}</td>
                  <td>{i.error ? <span className="badge bad">{i.error}</span> : <span className="badge ok">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!fromDrive && (
        <div className="card" id="nuevo">
          <h2>Agregar {T.insumo.toLowerCase()}</h2>
          <form action={saveIngredient}>
            <div className="grid grid-3" style={{ gap: 8 }}>
              <div className="field"><label>Nombre</label><input name="name" required placeholder="Ej: Harina 0000" /></div>
              <div className="field"><label>Presentación (opcional)</label><input name="purchase_unit" placeholder="Ej: Paquete 1 kg" /></div>
              <div className="field"><label>Proveedor (opcional)</label><input name="supplier" /></div>
              <div className="field"><label>Trae (cantidad)</label><input name="qty" required inputMode="decimal" placeholder="Ej: 1000" /></div>
              <div className="field"><label>Unidad</label><select name="unit" defaultValue="g">{RECIPE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
              <div className="field"><label>Precio de la presentación</label><input name="price" required inputMode="decimal" placeholder="Ej: 1400" /></div>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Ejemplo: un paquete de 1 kg de harina a $ 1.400 → cantidad 1000, unidad g, precio 1400.</p>
            <button className="btn">Agregar</button>
          </form>
        </div>
      )}
    </>
  );
}
