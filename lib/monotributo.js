// Topes de ingresos brutos anuales del Monotributo (ARCA), vigentes desde agosto de 2026.
// Fuente: iProfesional, 29/07/2026 (topes mensuales publicados × 12). Se actualizan cada 6 meses
// (febrero y agosto): cuando cambien, actualizar MONOTRIBUTO_TOPES y MONOTRIBUTO_VIGENCIA.
export const MONOTRIBUTO_VIGENCIA = 'agosto 2026';
export const MONOTRIBUTO_TOPES = {
  A: 12009410, B: 17595183, C: 24670494, D: 30628651, E: 36028231, F: 45151659,
  G: 53995799, H: 81924660, I: 91699762, J: 105012519, K: 126610839,
};
const ORDER = Object.keys(MONOTRIBUTO_TOPES);

// Estado frente al tope con lo vendido en los últimos 12 meses.
export function monotributoStatus(cat, sales12m) {
  const cap = MONOTRIBUTO_TOPES[cat];
  if (!cap) return null;
  const pct = Math.round((sales12m / cap) * 1000) / 10;
  const next = ORDER[ORDER.indexOf(cat) + 1] || null;
  const fits = ORDER.find((c) => MONOTRIBUTO_TOPES[c] >= sales12m) || null;
  return { cat, cap, pct, left: Math.max(0, cap - sales12m), next, fits, over: sales12m > cap, excluded: sales12m > MONOTRIBUTO_TOPES.K };
}
