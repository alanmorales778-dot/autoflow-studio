'use server';

import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { createOrder } from '@/lib/orders';
import { moduleAccess } from '@/lib/modules';
import { pushStockToSheet } from '@/lib/sheets';
import { safeEqual } from '@/lib/crypto';
import { ensureBalanceLink } from '@/lib/balance';
import { createCustomerSubscription, subscriptionStatusUrl } from '@/lib/recurring';
import { notifyOwner } from '@/lib/notify';
import { notify } from '@/lib/notifications';
import { submitReceipt } from '@/lib/receipts';
import { money, dateLabel } from '@/lib/format';

const str = (fd, k) => String(fd.get(k) ?? '').trim();

async function loadContext(slug) {
  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('*').eq('slug', slug).maybeSingle();
  if (!bakery) redirect('/');
  const { data: sub } = await admin.from('subscriptions').select('*').eq('bakery_id', bakery.id).maybeSingle();
  return { admin, bakery, access: moduleAccess(sub, bakery) };
}

async function uploadReference(admin, bakery, file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error('La foto es muy pesada (máximo 5 MB).');
  const type = String(file.type || '');
  if (!/^image\/(jpeg|png|webp|heic)$/.test(type)) throw new Error('La foto tiene que ser JPG, PNG o WEBP.');
  const ext = type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${bakery.id}/${crypto.randomBytes(12).toString('hex')}.${ext}`;
  const { error } = await admin.storage.from('referencias').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type });
  if (error) throw new Error('No se pudo subir la foto.');
  return admin.storage.from('referencias').getPublicUrl(path).data.publicUrl;
}

export async function placeOrder(fd) {
  const slug = str(fd, 'slug');
  const productId = str(fd, 'product_id');
  const qty = str(fd, 'quantity');
  const { admin, bakery, access } = await loadContext(slug);
  if (!access.base) redirect(`/c/${slug}`);
  const { data: product } = await admin.from('products').select('*').eq('id', productId).eq('bakery_id', bakery.id).eq('visible', true).maybeSingle();
  if (!product) redirect(`/c/${slug}`);
  if (str(fd, 'website')) redirect(`/c/${slug}`); // campo trampa anti-spam

  const selectedOptions = {};
  (product.options || []).forEach((_, gi) => { selectedOptions[gi] = str(fd, `opt_${gi}`); });

  let order = null;
  let err = null;
  let photoUrl = null;
  try {
    photoUrl = await uploadReference(admin, bakery, fd.get('foto'));
    order = await createOrder(admin, bakery, product, {
      quantity: qty,
      date: str(fd, 'date'),
      slot: str(fd, 'slot'),
      fulfillment: str(fd, 'fulfillment'),
      address: str(fd, 'address'),
      customer_name: str(fd, 'customer_name'),
      customer_phone: str(fd, 'customer_phone'),
      notes: str(fd, 'notes'),
      dedication: str(fd, 'dedication'),
      allergies: str(fd, 'allergies'),
      occasion: str(fd, 'occasion'),
      coupon_code: str(fd, 'coupon_code'),
      reference_photo_url: photoUrl,
      selectedOptions,
      channel: 'web',
    });
    await pushStockToSheet(admin, bakery, [product.id]);
    // Con link de Mercado Pago se avisa cuando entra la seña; sin link, ahora.
    if (!order.payment_url) await notifyOwner(admin, bakery, order, 'nuevo');
  } catch (e) {
    err = e.message;
    // si el pedido no se guardó, la foto de referencia que se subió queda sin uso: se borra
    const path = !order && photoUrl ? String(photoUrl).split('/storage/v1/object/public/referencias/')[1] : null;
    if (path) await admin.storage.from('referencias').remove([decodeURIComponent(path)]).catch(() => {});
  }
  if (err) redirect(`/c/${slug}?p=${productId}&q=${encodeURIComponent(qty)}&error=${encodeURIComponent(err)}`);
  if (order.payment_url) redirect(order.payment_url);
  redirect(`/c/${slug}/pedido/${order.id}?t=${order.public_token}`);
}

export async function payBalance(fd) {
  const slug = str(fd, 'slug');
  const id = str(fd, 'id');
  const t = str(fd, 't');
  const { admin, bakery } = await loadContext(slug);
  const { data: order } = await admin.from('orders').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!order || !safeEqual(order.public_token, t)) redirect(`/c/${slug}`);
  let url = null;
  let err = null;
  try {
    url = await ensureBalanceLink(admin, bakery, order);
  } catch (e) {
    err = e.message;
  }
  if (!url) redirect(`/c/${slug}/pedido/${id}?t=${t}&error=${encodeURIComponent(err || 'No se pudo generar el link de pago. Escribile al negocio.')}`);
  redirect(url);
}

export async function placeSubscription(fd) {
  const slug = str(fd, 'slug');
  const productId = str(fd, 'product_id');
  const { admin, bakery, access } = await loadContext(slug);
  if (!access.base || !access.recurring) redirect(`/c/${slug}`);
  const { data: product } = await admin.from('products').select('*').eq('id', productId).eq('bakery_id', bakery.id).eq('visible', true).eq('allow_subscription', true).maybeSingle();
  if (!product) redirect(`/c/${slug}`);
  if (str(fd, 'website')) redirect(`/c/${slug}`);
  let sub = null;
  let err = null;
  try {
    sub = await createCustomerSubscription(admin, bakery, product, {
      quantity: str(fd, 'quantity'),
      frequency_days: str(fd, 'frequency_days'),
      weekday: str(fd, 'weekday'),
      slot: str(fd, 'slot'),
      fulfillment: str(fd, 'fulfillment'),
      address: str(fd, 'address'),
      customer_name: str(fd, 'customer_name'),
      customer_phone: str(fd, 'customer_phone'),
      customer_email: str(fd, 'customer_email'),
      notes: str(fd, 'notes'),
    });
  } catch (e) {
    err = e.message;
  }
  if (err) redirect(`/c/${slug}?p=${productId}&modo=suscripcion&error=${encodeURIComponent(err)}`);
  if (sub.init_point) redirect(sub.init_point);
  redirect(subscriptionStatusUrl(bakery, sub).replace(/^https?:\/\/[^/]+/, ''));
}

// ---------- Acciones del cliente desde la página de su pedido (validan el token del link) ----------
async function loadOwnOrder(fd) {
  const slug = str(fd, 'slug');
  const id = str(fd, 'id');
  const t = str(fd, 't');
  const { admin, bakery } = await loadContext(slug);
  const { data: order } = await admin.from('orders').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!order || !safeEqual(order.public_token, t)) redirect(`/c/${slug}`);
  const here = `/c/${slug}/pedido/${id}?t=${encodeURIComponent(t)}`;
  return { admin, bakery, order, here };
}

const withMsg = (here, k, v) => `${here}&${k}=${encodeURIComponent(v)}`;

// Comprobante de transferencia de la seña
export async function uploadReceipt(fd) {
  const { admin, bakery, order, here } = await loadOwnOrder(fd);
  let r = null;
  let err = null;
  try {
    r = await submitReceipt(admin, bakery, order, fd.get('comprobante'));
  } catch (e) {
    err = e.message;
  }
  if (err) redirect(withMsg(here, 'error', err));
  redirect(withMsg(here, 'ok', r.ok ? '¡Listo! Verificamos tu comprobante y tu pedido quedó confirmado.' : 'Recibimos tu comprobante. El negocio lo va a revisar y te confirma.'));
}

// «Voy» / «No puedo» desde el recordatorio
export async function replyAttendance(fd) {
  const { admin, bakery, order, here } = await loadOwnOrder(fd);
  const reply = str(fd, 'reply') === 'no_puedo' ? 'no_puedo' : 'voy';
  if (!['confirmado', 'pendiente_sena'].includes(order.status)) redirect(here);
  await admin.from('orders').update({ customer_reply: reply, customer_reply_at: new Date().toISOString() }).eq('id', order.id);
  if (reply === 'no_puedo' || order.customer_reply !== reply) {
    await notify(admin, bakery, {
      kind: 'nuevo',
      title: reply === 'voy' ? `${order.customer_name} confirmó que va` : `${order.customer_name} avisó que no puede`,
      body: `${order.quantity} × ${order.product_name} · ${dateLabel(order.date)}${order.slot ? ` · ${order.slot}` : ''}${reply === 'no_puedo' ? '. Escribile para reprogramar o liberá el lugar cancelándolo.' : ''}`,
      url: '/app/pedidos',
    });
  }
  redirect(withMsg(here, 'ok', reply === 'voy' ? '¡Gracias por confirmar! Te esperamos.' : 'Gracias por avisar. El negocio te va a escribir para reprogramar.'));
}

// Reseña después de entregado
export async function submitReview(fd) {
  const { admin, bakery, order, here } = await loadOwnOrder(fd);
  if (order.status !== 'entregado') redirect(here);
  const rating = Math.round(Number(str(fd, 'rating')));
  if (!(rating >= 1 && rating <= 5)) redirect(withMsg(here, 'error', 'Elegí de 1 a 5 estrellas.'));
  const comment = str(fd, 'comment').slice(0, 500) || null;
  const { error } = await admin.from('reviews').insert({ bakery_id: bakery.id, order_id: order.id, rating, comment, name: String(order.customer_name || '').split(' ')[0].slice(0, 80) });
  if (error && error.code !== '23505') redirect(withMsg(here, 'error', 'No se pudo guardar. Probá de nuevo.'));
  if (!error) await notify(admin, bakery, { kind: 'sistema', title: `Nueva reseña: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`, body: comment ? `${order.customer_name}: «${comment.slice(0, 120)}»` : order.customer_name, url: '/app/clientes#resenas' });
  redirect(withMsg(here, 'ok', '¡Gracias por tu opinión!'));
}

// Presupuesto (oficios): el cliente lo acepta desde el link
export async function acceptQuote(fd) {
  const { admin, bakery, order, here } = await loadOwnOrder(fd);
  if (!order.quote_lines?.length || order.quote_accepted_at || !['pendiente_sena', 'confirmado'].includes(order.status)) redirect(here);
  await admin.from('orders').update({ quote_accepted_at: new Date().toISOString(), ...(Number(order.deposit_amount) > 0 ? {} : { status: 'confirmado' }) }).eq('id', order.id);
  await notify(admin, bakery, { kind: 'nuevo', title: `${order.customer_name} aceptó el presupuesto`, body: `${money(order.total)} · ${dateLabel(order.date)}${order.slot ? ` · ${order.slot}` : ''}`, url: '/app/pedidos' });
  redirect(withMsg(here, 'ok', '¡Presupuesto aceptado! Te esperamos.'));
}
