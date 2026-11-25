// Seña por transferencia: el cliente sube el comprobante, la IA lo lee y, si coincide
// (monto, fecha reciente y destinatario), el pedido se confirma solo. Si algo no coincide
// queda «para revisar» y el negocio recibe un aviso. El archivo va a un depósito privado.
import crypto from 'node:crypto';
import { askAI, useAI } from './ai';
import { normName, money, dateLabel } from './format';
import { confirmPaidOrder } from './lifecycle';
import { notify } from './notifications';

const SCHEMA = {
  type: 'object',
  properties: {
    es_comprobante: { type: 'boolean', description: 'true si es un comprobante de transferencia o pago bancario/billetera legible' },
    monto: { type: 'number', description: 'Importe transferido en pesos, sin separadores de miles' },
    fecha: { type: 'string', description: 'Fecha de la operación en formato AAAA-MM-DD' },
    destinatario: { type: 'string', description: 'Nombre de quien recibe la plata' },
    alias_o_cbu: { type: 'string', description: 'Alias, CBU o CVU de destino tal como figura' },
    operacion: { type: 'string', description: 'Número o código de operación/transacción' },
  },
  required: ['es_comprobante'],
};

const PROMPT = 'Sos el asistente de HakkiraApp en Argentina. Leé este comprobante de transferencia (banco, Mercado Pago, Ualá, Brubank, etc.) y devolvé sus datos. Si no es un comprobante o no se lee, es_comprobante = false. No inventes datos: dejá vacío lo que no figure.';

const norm = (s) => normName(String(s || '')).replace(/[^a-z0-9]/g, '');

export function transferEnabled(bakery) {
  return !!(bakery?.transfer_alias && String(bakery.transfer_alias).trim());
}

// Revisa lo leído contra el pedido y el negocio. Devuelve { ok, reason }.
export function checkReceipt(read, order, bakery, today = new Date()) {
  if (!read || read.es_comprobante === false) return { ok: false, reason: 'No pudimos leer el comprobante automáticamente.' };
  const amount = Number(read.monto);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'No se ve el monto en el comprobante.' };
  if (amount + 1 < Number(order.deposit_amount)) return { ok: false, reason: `El comprobante es por ${money(amount)} y la seña es de ${money(order.deposit_amount)}.` };
  if (read.fecha && /^\d{4}-\d{2}-\d{2}$/.test(read.fecha)) {
    const days = (today.getTime() - new Date(`${read.fecha}T12:00:00-03:00`).getTime()) / 86400000;
    if (days > 4 || days < -1) return { ok: false, reason: `La fecha del comprobante (${dateLabel(read.fecha)}) no es de estos días.` };
  }
  const dest = norm(`${read.destinatario} ${read.alias_o_cbu}`);
  const alias = norm(bakery.transfer_alias);
  const holderWords = normName(bakery.transfer_holder || '').split(/\s+/).filter((w) => w.length >= 3);
  const aliasOk = alias && dest.includes(alias);
  const holderOk = holderWords.length && holderWords.filter((w) => dest.includes(norm(w))).length >= Math.min(2, holderWords.length);
  if (!aliasOk && !holderOk) return { ok: false, reason: 'El destinatario del comprobante no coincide con tu alias o tu nombre.' };
  return { ok: true, reason: null };
}

export async function submitReceipt(admin, bakery, order, file) {
  if (!['pendiente_sena', 'vencido'].includes(order.status)) throw new Error('Este pedido ya no espera la seña.');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) throw new Error('Elegí la foto o el PDF del comprobante.');
  if (file.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB. Probá con una captura de pantalla.');
  const type = String(file.type || '').toLowerCase();
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(type)) throw new Error('Subí una foto (JPG o PNG) o un PDF del comprobante.');
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${bakery.id}/${order.id}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const { error } = await admin.storage.from('comprobantes').upload(path, buf, { contentType: type, upsert: false });
  if (error) throw new Error('No se pudo subir el comprobante. Probá de nuevo.');
  if (order.receipt_path) await admin.storage.from('comprobantes').remove([order.receipt_path]).catch(() => {});

  let read = null;
  if (await useAI(admin, bakery.id, 'comprobante', 60)) read = await askAI({ media: { type, data: buf.toString('base64') } }, PROMPT, SCHEMA, 'receipt-ai');
  let check = checkReceipt(read, order, bakery);
  // El mismo comprobante no sirve para dos pedidos
  const op = String(read?.operacion || '').trim();
  if (check.ok && op) {
    const { data: dup } = await admin.from('orders').select('id').eq('bakery_id', bakery.id).neq('id', order.id).eq('receipt_check->>operacion', op).limit(1);
    if (dup?.length) check = { ok: false, reason: 'Ese comprobante ya se usó en otro pedido.' };
  }
  const receipt_check = { ok: check.ok, reason: check.reason, monto: read?.monto ?? null, fecha: read?.fecha ?? null, destinatario: read?.destinatario ?? null, operacion: op || null, at: new Date().toISOString() };
  await admin.from('orders').update({ receipt_path: path, receipt_check }).eq('id', order.id);

  if (check.ok) {
    const updated = await confirmPaidOrder(admin, order.id, op ? `transferencia:${op}` : 'transferencia', Number(read.monto));
    return { ok: true, order: updated };
  }
  await notify(admin, bakery, {
    kind: 'pagado',
    title: `${order.customer_name} mandó un comprobante para revisar`,
    body: `${check.reason} ${order.quantity} × ${order.product_name} · ${dateLabel(order.date)}. Si está bien, tocá «Seña cobrada».`,
    url: '/app/pedidos?f=pendiente_sena',
  });
  return { ok: false, reason: check.reason };
}
