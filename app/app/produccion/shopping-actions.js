'use server';

import { requireBakery } from '@/lib/session';
import { sanitizeItem, sanitizePatch, isUuid } from '@/lib/shopping';

// Acciones de la lista de compras editable. Las llama el navegador después de actualizar
// la pantalla (Optimistic UI): si algo falla, devuelven { ok: false } y la pantalla vuelve atrás.

const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

function fail(error, fallback = 'No se pudo guardar.') {
  return { ok: false, missingTable: MISSING_TABLE.has(error?.code), error: error?.message || fallback };
}

export async function addShoppingItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 200) return fail(null, 'Nada para agregar.');
  const items = rawItems.map(sanitizeItem);
  if (items.some((i) => !i)) return fail(null, 'Revisá el nombre, la cantidad y el costo.');
  const { supabase, bakery } = await requireBakery();
  const { error } = await supabase.from('shopping_items').upsert(items.map((i) => ({ ...i, bakery_id: bakery.id })), { onConflict: 'id' });
  if (error) return fail(error);
  return { ok: true };
}

export async function updateShoppingItem(id, rawPatch) {
  if (!isUuid(id)) return fail(null, 'Ítem inválido.');
  const patch = sanitizePatch(rawPatch);
  if (!patch) return fail(null, 'Revisá el valor que escribiste.');
  const { supabase, bakery } = await requireBakery();
  const { error } = await supabase.from('shopping_items').update(patch).eq('id', id).eq('bakery_id', bakery.id);
  if (error) return fail(error);
  return { ok: true };
}

export async function deleteShoppingItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every(isUuid)) return fail(null, 'Nada para borrar.');
  const { supabase, bakery } = await requireBakery();
  const { error } = await supabase.from('shopping_items').delete().in('id', ids).eq('bakery_id', bakery.id);
  if (error) return fail(error, 'No se pudo borrar.');
  return { ok: true };
}
