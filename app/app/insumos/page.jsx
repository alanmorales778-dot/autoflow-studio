import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { syncNow, importFile, saveIngredient, deleteIngredient } from '../actions';
import ConfirmButton from '../confirm-button';
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

      {!fromDrive && (
        <details className="card fold" id="nuevo" open={!ingredients || ingredients.length === 0 || !!sp.nuevo}>
          <summary><h2>Agregar {T.insumo.toLowerCase()}</h2></summary>
          <form action={saveIngredient} style={{ marginTop: 12 }}>
            <IngredientFields T={T} />
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Ejemplo: un paquete de 1 kg de harina a $ 1.400 → cantidad 1000, unidad g, precio 1400.</p>
            <button className="btn">Agregar</button>
          </form>
        </details>
      )}

      <div className="card">
        {!ingredients || ingredients.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin {T.insumos.toLowerCase()} todavía.</p>
        ) : (
          <ul className="items">
            {ingredients.map((i) => (
              <li key={i.id} className="item">
                <div className="item-head">
                  <div>
                    <div className="item-title">{i.name}</div>
                    <div className="item-sub">
                      {i.purchase_unit ? `${i.purchase_unit} · ` : ''}{i.qty ?? '—'} {i.unit}{i.supplier ? ` · ${i.supplier}` : ''}{i.updated_label ? ` · actualizado ${i.updated_label}` : ''}
                    </div>
                  </div>
                  {i.error ? <span className="badge bad">{i.error}</span> : fromDrive ? <span className="item-title money-col">{money(i.price)}</span> : null}
                </div>
                {!fromDrive && (
                  <div className="item-actions">
                    <form action={saveIngredient} className="row" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                      <input type="hidden" name="id" value={i.id} />
                      <div style={{ position: 'relative', flex: '0 0 auto' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>$</span>
                        <input name="price" inputMode="decimal" defaultValue={i.price ?? ''} aria-label={`Precio de ${i.name}`} style={{ width: 120, paddingLeft: 24 }} />
                      </div>
                      <button className="btn secondary small">Guardar</button>
                    </form>
                    <details className="fold">
                      <summary className="btn secondary small">Editar</summary>
                      <div className="fold-body">
                        <form action={saveIngredient}>
                          <input type="hidden" name="id" value={i.id} />
                          <IngredientFields T={T} i={i} />
                          <button className="btn small">Guardar</button>
                        </form>
                        <form action={deleteIngredient} style={{ marginTop: 10 }}>
                          <input type="hidden" name="id" value={i.id} />
                          <ConfirmButton className="btn danger small" message={`¿Borrar ${i.name}? Si alguna receta lo usa, ese producto queda sin costo hasta que lo reemplaces.`}>Borrar {T.insumo.toLowerCase()}</ConfirmButton>
                        </form>
                      </div>
                    </details>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!sp.vista && (
        <details className="fold" style={{ marginTop: 8 }}>
          <summary className="btn secondary small">Cargar o descargar muchos con un Excel</summary>
          <div style={{ marginTop: 12 }}><UploadCard kind="insumos" action={importFile} driveConnected={!!bakery.sheet_insumos_id} /></div>
        </details>
      )}
    </>
  );
}

function IngredientFields({ T, i = {} }) {
  return (
    <div className="grid grid-3" style={{ gap: 10 }}>
      <div className="field"><label>Nombre</label><input name="name" required defaultValue={i.name || ''} placeholder="Ej: Harina 0000" /></div>
      <div className="field"><label>Presentación (opcional)</label><input name="purchase_unit" defaultValue={i.purchase_unit || ''} placeholder="Ej: Paquete 1 kg" /></div>
      <div className="field"><label>Proveedor (opcional)</label><input name="supplier" defaultValue={i.supplier || ''} /></div>
      <div className="field"><label>Trae (cantidad)</label><input name="qty" required inputMode="decimal" defaultValue={i.qty ?? ''} placeholder="Ej: 1000" /></div>
      <div className="field"><label>Unidad</label><select name="unit" defaultValue={i.unit || 'g'}>{RECIPE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
      <div className="field"><label>Precio de la presentación</label><input name="price" required inputMode="decimal" defaultValue={i.price ?? ''} placeholder="Ej: 1400" /></div>
    </div>
  );
}
