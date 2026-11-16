'use server';

import { redirect } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { createOrder } from '@/lib/orders';
import { moduleAccess } from '@/lib/modules';
import { pushStockToSheet } from '@/lib/sheets';

const str = (fd, k) => String(fd.get(k) ?? '').trim();

export async function placeOrder(fd) {
  const slug = str(fd, 'slug');
  const productId = str(fd, 'product_id');
  const qty = str(fd, 'quantity');
  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('*').eq('slug', slug).maybeSingle();
  if (!bakery) redirect('/');
  const { data: sub } = await admin.from('subscriptions').select('*').eq('bakery_id', bakery.id).maybeSingle();
  if (!moduleAccess(sub).base) redirect(`/c/${slug}`);
  const { data: product } = await admin.from('products').select('*').eq('id', productId).eq('bakery_id', bakery.id).eq('visible', true).maybeSingle();
  if (!product) redirect(`/c/${slug}`);

  // anti-spam simple: campo trampa invisible
  if (str(fd, 'website')) redirect(`/c/${slug}`);

  let order = null;
  let err = null;
  try {
    order = await createOrder(admin, bakery, product, {
      quantity: qty,
      date: str(fd, 'date'),
      slot: str(fd, 'slot'),
      fulfillment: str(fd, 'fulfillment'),
      address: str(fd, 'address'),
      customer_name: str(fd, 'customer_name'),
      customer_phone: str(fd, 'customer_phone'),
      notes: str(fd, 'notes'),
      channel: 'web',
    });
    await pushStockToSheet(admin, bakery, [product.id]);
  } catch (e) {
    err = e.message;
  }
  if (err) redirect(`/c/${slug}?p=${productId}&q=${encodeURIComponent(qty)}&error=${encodeURIComponent(err)}`);
  if (order.payment_url) redirect(order.payment_url);
  redirect(`/c/${slug}/pedido/${order.id}?t=${order.public_token}`);
}
