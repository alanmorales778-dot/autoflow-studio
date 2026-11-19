// Cupo por horario: cuántos clientes se atienden a la vez en cada horario, teniendo en cuenta
// cuánto dura cada servicio. Un turno de 90 min que empieza 10:00 también ocupa el horario de 11:00.
// Funciones puras (sin base de datos) para poder probarlas sueltas.

// "10:00", "10:00 a 13:00", "9.30 hs", "16 a 20" → minutos desde las 0 h. "Mañana" → null.
export function slotStart(slot) {
  const m = String(slot || '').match(/(\d{1,2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Horarios que ocupa un pedido que empieza en `slot` y dura `duration` minutos.
// Sin duración (o con horarios sin hora, como "Mañana") ocupa solo su propio horario.
export function coveredSlots(slots, slot, duration) {
  const start = slotStart(slot);
  if (start === null || !duration) return slots.includes(slot) ? [slot] : [];
  const end = start + Number(duration);
  const out = slots.filter((s) => {
    const st = slotStart(s);
    return st !== null && st >= start && st < end;
  });
  return out.length ? out : slots.includes(slot) ? [slot] : [];
}

// Unidades ocupadas por horario en un día. `orders` ya filtrados por fecha y vigentes.
export function slotLoad(slots, orders) {
  const used = Object.fromEntries(slots.map((s) => [s, 0]));
  for (const o of orders) {
    for (const s of coveredSlots(slots, o.slot, o.duration_minutes)) used[s] += Number(o.quantity) || 1;
  }
  return used;
}

// Horarios que todavía aceptan un pedido de `qty` unidades con esa duración.
// `left` = lugares libres en ese horario (el mínimo entre los horarios que ocuparía).
export function openSlots(slots, orders, capacity, duration, qty = 1) {
  if (!capacity) return slots.map((s) => ({ slot: s, left: null }));
  const used = slotLoad(slots, orders);
  return slots.map((s) => {
    const cover = coveredSlots(slots, s, duration);
    const left = Math.min(...cover.map((c) => capacity - used[c]));
    return { slot: s, left: left >= qty ? left : 0 };
  });
}
