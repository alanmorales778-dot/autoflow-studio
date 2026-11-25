// Opciones de personalización de un producto (ej. tamaño, relleno, cobertura).
// Formato de texto, un grupo por línea:
//   Relleno: Dulce de leche | Mousse de chocolate +2000 | Frutos rojos +3500
//   Tamaño*: 15 cm | 20 cm +6000 x1.5 | 25 cm +12000 x2   (* = obligatorio; x1.5 = lleva 1,5 veces la receta)
import { parseNum } from './format';

export function parseOptionsText(text) {
  const groups = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes(':')) continue;
    const i = line.indexOf(':');
    let name = line.slice(0, i).trim();
    const required = name.endsWith('*');
    name = name.replace(/\*$/, '').trim();
    if (!name) continue;
    const choices = line
      .slice(i + 1)
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        let rest = c;
        let factor = null;
        const fx = rest.match(/\s+[x×]\s*([\d.,]+)\s*$/i);
        if (fx) {
          const f = parseNum(fx[1]);
          if (f && f > 0 && f <= 20) factor = f;
          rest = rest.slice(0, fx.index).trim();
        }
        const m = rest.match(/^(.*?)\s*\+\s*\$?\s*([\d.,]+)\s*$/);
        const out = m ? { label: m[1].trim(), delta: parseNum(m[2]) || 0 } : { label: rest, delta: 0 };
        if (factor && factor !== 1) out.factor = factor;
        return out;
      })
      .filter((c) => c.label)
      .slice(0, 20);
    if (choices.length) groups.push({ name: name.slice(0, 40), required, choices });
  }
  return groups.slice(0, 8);
}

export function formatOptionsText(groups) {
  return (groups || [])
    .map((g) => `${g.name}${g.required ? '*' : ''}: ${g.choices.map((c) => `${c.label}${c.delta ? ` +${c.delta}` : ''}${c.factor ? ` x${String(c.factor).replace('.', ',')}` : ''}`).join(' | ')}`)
    .join('\n');
}

// selected: { [groupIndex]: choiceIndex | '' }
export function resolveSelection(groups, selected) {
  const out = [];
  (groups || []).forEach((g, gi) => {
    const v = selected?.[gi];
    if (v === undefined || v === null || v === '') {
      if (g.required) throw new Error(`Elegí una opción de «${g.name}».`);
      return;
    }
    const c = g.choices[Number(v)];
    if (!c) throw new Error(`Opción inválida en «${g.name}».`);
    out.push({ group: g.name, label: c.label, delta: Number(c.delta) || 0, ...(Number(c.factor) > 0 ? { factor: Number(c.factor) } : {}) });
  });
  return out;
}

export function optionsSummary(opts) {
  return (opts || []).map((o) => `${o.group}: ${o.label}`).join(' · ');
}

export function hasRequiredOptions(product) {
  return (product.options || []).some((g) => g.required);
}

// Cuántas veces la receta lleva un pedido según las opciones elegidas (1 si ninguna cambia el tamaño).
export function recipeFactor(opts) {
  return (opts || []).reduce((f, o) => f * (Number(o.factor) > 0 ? Number(o.factor) : 1), 1);
}
