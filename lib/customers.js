export function normPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  // quitar el 15 de celulares escritos a la antigua (ej. 011 15 5555 5555 -> 11 5555 5555)
  // el código de área tiene 2, 3 o 4 dígitos (11, 351, 2944)
  if (d.length === 12) {
    for (const i of [2, 3, 4]) {
      if (d.slice(i, i + 2) === '15') { d = d.slice(0, i) + d.slice(i + 2); break; }
    }
  }
  return d.length >= 8 ? d.slice(-10) : null;
}

// Link de WhatsApp con mensaje pre-armado (no usa la API: abre el WhatsApp del negocio)
export function waMeLink(phone, text) {
  const n = normPhone(phone);
  if (!n) return null;
  return `https://wa.me/549${n}?text=${encodeURIComponent(text)}`;
}

// Busca al cliente por teléfono; si no existe, lo crea. Si ya existe NO pisa el nombre ni el teléfono
// que tiene guardados (el negocio puede haberlos corregido a mano): solo completa el email si faltaba.
export async function upsertCustomer(admin, bakeryId, { name, phone, email }) {
  const phone_norm = normPhone(phone);
  if (!phone_norm) return null;
  const cleanEmail = email ? String(email).slice(0, 160) : null;
  const { data: existing } = await admin.from('customers').select('id,email').eq('bakery_id', bakeryId).eq('phone_norm', phone_norm).maybeSingle();
  if (existing) {
    if (cleanEmail && !existing.email) await admin.from('customers').update({ email: cleanEmail }).eq('id', existing.id);
    return existing.id;
  }
  const row = { bakery_id: bakeryId, phone_norm, name: String(name || 'Cliente').slice(0, 120), phone: String(phone).slice(0, 40) };
  if (cleanEmail) row.email = cleanEmail;
  const { data, error } = await admin.from('customers').insert(row).select('id').single();
  if (!error) return data.id;
  // Dos pedidos al mismo tiempo del mismo teléfono: el otro ya lo creó.
  const { data: again } = await admin.from('customers').select('id').eq('bakery_id', bakeryId).eq('phone_norm', phone_norm).maybeSingle();
  return again?.id || null;
}
