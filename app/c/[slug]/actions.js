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
