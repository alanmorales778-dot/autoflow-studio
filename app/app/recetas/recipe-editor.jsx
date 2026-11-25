import { RECIPE_UNITS, normUnit } from '@/lib/costs';
import { money, normName, num } from '@/lib/format';

// Formulario de receta completa: rinde, ingredientes (editables en el lugar) y pasos.
// Sirve para editar una receta guardada y para corregir lo que se leyó de una foto antes de guardarlo.
// Para quitar un ingrediente se borra su nombre; las filas vacías no se guardan.
export default function RecipeEditor({ action, hidden = {}, items = [], recipeYield = 1, notes = '', ingredients = [], T, overheadPercent = 0, extraRows = 4, submitLabel = 'Guardar receta', disabled = false, children }) {
  const byName = new Map(ingredients.map((i) => [normName(i.name), i]));
  const lineCost = (it) => {
    const ing = byName.get(normName(it.name));
    const iu = ing && normUnit(ing.unit);
    const ru = normUnit(it.unit);
    if (!ing || ing.error || !iu || !ru || iu.base !== ru.base || !(Number(it.qty) > 0)) return null;
    return (Number(ing.price) / (Number(ing.qty) * iu.factor)) * Number(it.qty) * ru.factor;
  };
  const costs = items.map(lineCost);
  const complete = items.length > 0 && costs.every((c) => c !== null);
  const batch = costs.reduce((s, c) => s + (c || 0), 0) * (1 + Number(overheadPercent || 0) / 100);
  const y = Number(recipeYield) > 0 ? Number(recipeYield) : 1;
  const rows = [...items, ...Array.from({ length: extraRows }, () => ({ name: '', qty: '', unit: 'g', blank: true }))];
  const listId = `ing-${Object.values(hidden).join('-') || 'nuevo'}`.replace(/[^\w-]/g, '');

  return (
    <form action={action} className="recipe-editor">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v ?? ''} />)}
      {children}
      <div className="field" style={{ maxWidth: 340 }}>
        <label>Rinde: ¿cuántas unidades da esta receta?</label>
        <input name="recipe_yield" inputMode="decimal" defaultValue={num(y, 3).replace(/\./g, '')} disabled={disabled} />
        <div className="hint">Ej.: si con esta receta salen 24 alfajores, poné 24. El costo se divide por este número.</div>
      </div>

      <datalist id={listId}>{ingredients.map((i) => <option key={i.id || i.name} value={i.name} />)}</datalist>
      <div className="table-wrap">
        <table className="recipe-table">
          <thead><tr><th>{T.insumo}</th><th style={{ width: 120 }}>Cantidad</th><th style={{ width: 90 }}>Unidad</th><th style={{ width: 110 }}>Costo</th></tr></thead>
          <tbody>
            {rows.map((it, i) => {
              const known = !it.blank && byName.get(normName(it.name));
              const c = it.blank ? null : costs[i];
              return (
                <tr key={i} className={it.estimated ? 'estimated' : ''}>
                  <td>
                    <input name="name" list={listId} defaultValue={it.name} placeholder={it.blank ? 'Agregar…' : ''} aria-label={`${T.insumo} ${i + 1}`} disabled={disabled} />
                    {!it.blank && !known && <small style={{ color: 'var(--bad)' }}>No está en tu lista de {T.insumos.toLowerCase()}.</small>}
                    {it.estimated && <small style={{ color: 'var(--warn)' }}>Revisá la cantidad{it.original ? ` (decía «${it.original}»)` : ''}.</small>}
                  </td>
                  <td><input name="qty" inputMode="decimal" defaultValue={it.qty === '' || it.qty === undefined ? '' : String(it.qty).replace('.', ',')} aria-label={`Cantidad ${i + 1}`} disabled={disabled} /></td>
                  <td>
                    <select name="unit" defaultValue={RECIPE_UNITS.includes(it.unit) ? it.unit : 'g'} aria-label={`Unidad ${i + 1}`} disabled={disabled}>
                      {RECIPE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="money-col">{it.blank ? '' : c === null ? '—' : money(c)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Para quitar un {T.insumo.toLowerCase()}, borrá su nombre. ¿Necesitás más filas? Guardá y van a aparecer otras vacías. Podés usar otra receta como ingrediente (por ejemplo «Relleno de dulce de leche»): escribí el nombre del producto y la cantidad en las unidades de su rinde.</p>

      {items.length > 0 && (
        <div className="row" style={{ gap: 20, margin: '6px 0 14px' }}>
          <div><small className="muted">Receta completa{Number(overheadPercent) ? ` (con ${num(overheadPercent, 0)} % de indirectos)` : ''}</small><div className="price">{complete ? money(batch) : '—'}</div></div>
          <div><small className="muted">Por unidad (÷ {num(y, 3)})</small><div className="price">{complete ? money(batch / y) : '—'}</div></div>
          {!complete && <div className="muted" style={{ alignSelf: 'center', fontSize: 13 }}>Para ver el costo, todos los {T.insumos.toLowerCase()} tienen que estar en tu lista con precio y una unidad compatible.</div>}
        </div>
      )}

      <div className="field">
        <label>Preparación (opcional)</label>
        <textarea name="recipe_notes" rows={4} defaultValue={notes || ''} maxLength={6000} placeholder="Pasos, temperatura del horno, tiempos…" disabled={disabled} />
      </div>
      {!disabled && <button className="btn">{submitLabel}</button>}
    </form>
  );
}
