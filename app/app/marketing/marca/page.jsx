import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { Flash } from '../../ui';
import Submit from '../submit';
import MarketingLocked from '../locked';
import { saveBrand } from '../actions';
import { loadBrand } from '@/lib/marketing';

function Field({ name, label, hint, placeholder, value, max = 300, rows = 2 }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {hint && <p className="hint" style={{ margin: '0 0 6px' }}>{hint}</p>}
      <textarea id={name} name={name} rows={rows} maxLength={max} defaultValue={value || ''} placeholder={placeholder} />
    </div>
  );
}

export default async function Marca({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.marketing) return (<><h1>Perfil de marca</h1><MarketingLocked /></>);
  const b = (await loadBrand(supabase, bakery.id)) || {};

  return (
    <div className="narrow" style={{ marginTop: 0 }}>
      <Link href="/app/marketing" className="back-link">← Marketing</Link>
      <h1>Perfil de marca</h1>
      <p className="muted">Con esto el agente escribe como vos. Los productos, precios y condiciones los toma solo de tu cuenta.</p>
      <Flash sp={sp} />
      <form action={saveBrand} className="card">
        <Field name="tone" label="¿Cómo habla tu marca?" placeholder="Ej: cercana y divertida, como una amiga que cocina rico" value={b.tone} />
        <Field name="audience" label="¿A quién le vendés?" placeholder="Ej: mamás de 30 a 45 de zona norte que organizan cumpleaños" value={b.audience} />
        <Field name="differential" label="¿Qué te hace distinto?" placeholder="Ej: todo casero, sin premezclas, entregamos el mismo día" value={b.differential} />
        <Field name="pillars" label="Temas fijos de tu cuenta (3)" hint="Así Instagram entiende de qué habla tu cuenta." placeholder="Ej: tortas de cumpleaños, detrás de escena, tips para conservar" value={b.pillars} />
        <Field name="location" label="Zona o barrio" placeholder="Ej: Palermo, CABA" value={b.location} max={120} rows={1} />
        <Field name="hashtags" label="Tus hashtags (opcional)" placeholder="#dulcelola #tortaspalermo" value={b.hashtags} />
        <Field name="banned_words" label="Palabras que nunca hay que usar" placeholder="Ej: barato, oferta, delicioso" value={b.banned_words} />
        <Field name="examples" label="Publicaciones que te gustan (pegá 1 a 3)" hint="De tu cuenta o de otras. El agente copia el estilo, no el texto." value={b.examples} max={1500} rows={4} />
        <label className="inline-label"><input type="checkbox" name="emojis" defaultChecked={b.emojis !== false} /> Usar emojis (con moderación)</label>
        <div style={{ marginTop: 14 }}><Submit className="btn block" pending="Guardando…">Guardar perfil</Submit></div>
      </form>
    </div>
  );
}
