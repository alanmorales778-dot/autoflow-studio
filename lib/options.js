// Opciones de personalización de un producto (ej. tamaño, relleno, cobertura).
// Formato de texto, un grupo por línea:
//   Relleno: Dulce de leche | Mousse de chocolate +2000 | Frutos rojos +3500
//   Tamaño*: 15 cm | 20 cm +6000 | 25 cm +12000        (* = obligatorio)
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
        const m = c.match(/^(.*?)\s*\+\s*\$?\s*([\d.,]+)\s*$/);
        if (m) return { label: m[1].trim(), delta: parseNum(m[2]) || 0 };
        return { label: c, delta: 0 };
      })
      .filter((c) => c.label)
      .slice(0, 20);
    if (choices.length) groups.push({ name: name.slice(0, 40), required, choices });
  }
  return groups.slice(0, 8);
}

export function formatOptionsText(groups) {
  return (groups || [])
    .map((g) => `${g.name}${g.required ? '*' : ''}: ${g.choices.map((c) => (c.delta ? `${c.label} +${c.delta}` : c.label)).join(' | ')}`)
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
    out.push({ group: g.name, label: c.label, delta: Number(c.delta) || 0 });
  });
  return out;
}

export function optionsSummary(opts) {
  return (opts || []).map((o) => `${o.group}: ${o.label}`).join(' · ');
}

export function hasRequiredOptions(product) {
  return (product.options || []).some((g) => g.required);
}
