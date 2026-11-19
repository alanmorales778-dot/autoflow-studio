import { createAdmin } from '@/lib/supabase';
import { previewImport } from '@/lib/imports';
import { applyImport, discardImport } from './actions';

function List({ title, items, cls, limit = 8 }) {
  if (!items.length) return null;
  return (
    <div style={{ flex: '1 1 220px' }}>
      <div className="row" style={{ gap: 8, marginBottom: 6 }}><span className={`badge ${cls}`}>{items.length}</span><strong>{title}</strong></div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)' }}>
        {items.slice(0, limit).map((t) => <li key={t}>{t}</li>)}
        {items.length > limit && <li className="muted">y {items.length - limit} más</li>}
      </ul>
    </div>
  );
}

// Muestra qué va a pasar con el archivo subido y pide confirmación.
export default async function ImportPreview({ bakery, kind, id }) {
  if (!id) return null;
  const admin = createAdmin();
  const { data: pv } = await admin.from('import_previews').select('*').eq('id', id).eq('bakery_id', bakery.id).eq('kind', kind).maybeSingle();
  if (!pv) return <div className="alert warn">Esa vista previa ya no está disponible. Volvé a subir el archivo.</div>;
  let d;
  try {
    d = await previewImport(admin, bakery, kind, pv.rows, { replace: pv.replace });
  } catch (e) {
    return <div className="alert bad">{e.message}</div>;
  }
  const noun = kind === 'insumos' ? 'insumos' : 'productos';
  const nothing = !d.added.length && !d.changed.length && !d.removed.length;
  return (
    <div className="card fade-in" id="importar" style={{ borderColor: 'var(--brand-line)', boxShadow: '0 0 0 3px rgba(194,65,12,.08)' }}>
      <h2>Revisá antes de aplicar{pv.file_name ? ` · ${pv.file_name}` : ''}</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        El archivo tiene {d.total} {noun}. {d.same > 0 && `${d.same} quedan igual. `}Todavía no se cambió nada.
      </p>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20, margin: '14px 0' }}>
        <List title={`${noun.charAt(0).toUpperCase() + noun.slice(1)} nuevos`} items={d.added} cls="ok" />
        <List title={kind === 'insumos' ? 'Cambian de precio o cantidad' : 'Cambian de precio'} items={d.changed} cls="warn" />
        <List title={kind === 'insumos' ? 'Se borran (no están en el archivo)' : 'Se ocultan del catálogo'} items={d.removed} cls="bad" />
      </div>
      {d.invalid.length > 0 && <div className="alert warn">Con datos para revisar (se cargan igual, marcados): {d.invalid.slice(0, 6).join(', ')}{d.invalid.length > 6 ? '…' : ''}</div>}
      {d.removed.length > 0 && kind === 'insumos' && <div className="alert bad">Las recetas que usen los insumos borrados van a quedar sin costo hasta que los vuelvas a cargar.</div>}
      {nothing && <div className="alert info">El archivo no trae cambios respecto de lo que ya tenés.</div>}
      <div className="row">
        <form action={applyImport}><input type="hidden" name="id" value={pv.id} /><button className="btn">Aplicar cambios</button></form>
        <form action={discardImport}><input type="hidden" name="id" value={pv.id} /><input type="hidden" name="kind" value={kind} /><button className="btn secondary">Cancelar</button></form>
      </div>
    </div>
  );
}
