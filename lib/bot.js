import { waSend, waText, waButtons, waList } from './whatsapp';
import { notifyOwner } from './notify';
import { availableDates, stockLeft, createOrder } from './orders';
import { money, dateLabel, normName } from './format';
import { appUrl } from './env';
import { hasRequiredOptions } from './options';

const SESSION_TTL_MS = 2 * 3600e3;

async function loadSession(admin, bakery, phone) {
  const { data } = await admin.from('wa_sessions').select('*').eq('bakery_id', bakery.id).eq('phone', phone).maybeSingle();
  if (!data || Date.now() - new Date(data.updated_at).getTime() > SESSION_TTL_MS) return {};
  return data.state || {};
}

async function saveSession(admin, bakery, phone, state) {
  await admin.from('wa_sessions').upsert({ bakery_id: bakery.id, phone, state, updated_at: new Date().toISOString() });
}

async function visibleProducts(admin, bakery) {
  const { data } = await admin
    .from('products')
    .select('*')
    .eq('bakery_id', bakery.id)
    .eq('visible', true)
    .not('sheet_row', 'is', null)
    .order('sheet_row');
  return data || [];
}

async function sendMenu(admin, bakery, to, name) {
  const products = await visibleProducts(admin, bakery);
  if (!products.length) {
    await waSend(bakery, waText(to, `¡Hola${name ? ` ${name}` : ''}! Por ahora no tenemos productos disponibles para pedir online. Escribinos más tarde 🙌`));
    return;
  }
  const rows = products.slice(0, 10).map((p) => ({ id: `p:${p.id}`, title: p.name, description: `${money(p.price)}${p.description ? ` · ${p.description}` : ''}` }));
  await waSend(
    bakery,
    waList(to, `¡Hola${name ? ` ${name}` : ''}! 👋 Soy el asistente de pedidos de ${bakery.name}.\n\nElegí qué querés pedir. En cualquier momento escribí *cancelar* para empezar de nuevo.`, 'Ver productos', 'Productos', rows),
  );
  if (products.length > 10) await waSend(bakery, waText(to, `Ver todo el catálogo: ${appUrl()}/c/${bakery.slug}`));
}

async function askDate(admin, bakery, to, state) {
  const { data: product } = await admin.from('products').select('*').eq('id', state.productId).single();
  const dates = (await availableDates(admin, bakery, product, state.qty)).slice(0, 10);
  if (!dates.length) {
    await waSend(bakery, waText(to, `Uy, no nos quedan fechas disponibles para ${state.qty} × ${product.name} en los próximos días. Probá con menos unidades o escribí *hola* para ver otros productos.`));
    return { step: 'menu' };
  }
  await waSend(
    bakery,
    waList(to, `¿Para qué día querés ${state.qty} × ${product.name}?`, 'Elegir fecha', 'Fechas disponibles', dates.map((d) => ({
      id: `d:${d.date}`,
      title: dateLabel(d.date),
      description: d.left === null ? '' : `Quedan ${d.left} cupos`,
    }))),
  );
  return { ...state, step: 'date' };
}

async function askSlot(admin, bakery, to, state) {
  const all = bakery.slots || [];
  let open = all.map((s, i) => ({ s, i }));
  if (bakery.slot_capacity && all.length) {
    // cupo por horario: solo se ofrecen los horarios con lugar ese día
    const { data: product } = await admin.from('products').select('*').eq('id', state.productId).single();
    const day = (await availableDates(admin, bakery, product, state.qty)).find((d) => d.date === state.date);
    const free = new Set((day?.slots || []).filter((x) => x.left > 0).map((x) => x.slot));
    open = open.filter((x) => free.has(x.s));
    if (!open.length) {
      await waSend(bakery, waText(to, 'Uy, ese día se acaban de ocupar todos los horarios. Escribí *hola* para elegir otra fecha.'));
      return { step: 'menu' };
    }
  }
  if (all.length <= 1) return askFulfillment(bakery, to, { ...state, slot: all[0] || null });
  const msg = '¿En qué horario?';
  const items = open.map(({ s, i }) => ({ id: `s:${i}`, title: s.slice(0, 24) }));
  if (items.length <= 3) await waSend(bakery, waButtons(to, msg, items.map((x) => ({ ...x, title: x.title.slice(0, 20) }))));
  else await waSend(bakery, waList(to, msg, 'Elegir horario', 'Horarios', items.slice(0, 10)));
  return { ...state, step: 'slot' };
}

async function askFulfillment(bakery, to, state) {
  if (!bakery.delivery_enabled) return { ...state, fulfillment: 'retiro', step: 'ready' };
  await waSend(bakery, waButtons(to, '¿Lo retirás o te lo enviamos?', [{ id: 'f:retiro', title: 'Retiro' }, { id: 'f:envio', title: 'Envío' }]));
  return { ...state, step: 'fulfillment' };
}

async function finish(admin, bakery, to, state, name) {
  const { data: product } = await admin.from('products').select('*').eq('id', state.productId).single();
  try {
    const order = await createOrder(admin, bakery, product, {
      quantity: state.qty,
      date: state.date,
      slot: state.slot,
      fulfillment: state.fulfillment,
      address: state.address,
      customer_name: name || 'Cliente WhatsApp',
      customer_phone: to,
      channel: 'whatsapp',
    });
    if (!order.payment_url) await notifyOwner(admin, bakery, order, 'nuevo');
    const resumen = `🧾 *Tu pedido*\n${order.quantity} × ${order.product_name}\nFecha: ${dateLabel(order.date)}${order.slot ? ` (${order.slot})` : ''}\n${order.fulfillment === 'envio' ? `Envío a: ${order.address}` : `Retiro en: ${bakery.pickup_address || 'a coordinar'}`}\nTotal: ${money(order.total)}`;
    if (order.status === 'confirmado') {
      await waSend(bakery, waText(to, `${resumen}\n\n✅ ¡Pedido confirmado! Gracias.`));
    } else if (order.payment_url) {
      await waSend(
        bakery,
        waText(to, `${resumen}\n\nPara confirmarlo, pagá la seña de *${money(order.deposit_amount)}* en los próximos ${bakery.hold_minutes} minutos:\n${order.payment_url}\n\nSi no se paga en ese tiempo, el cupo se libera.`),
      );
    } else {
      await waSend(bakery, waText(to, `${resumen}\n\nSeña: ${money(order.deposit_amount)}. Te escribimos en breve para coordinar el pago y confirmarlo.`));
    }
  } catch (e) {
    await waSend(bakery, waText(to, `No pudimos tomar el pedido: ${e.message}\nEscribí *hola* para intentarlo de nuevo.`));
  }
  return {};
}

export async function handleIncoming(admin, bakery, msg, contactName) {
  const to = msg.from;
  const name = contactName ? String(contactName).split(' ')[0] : '';
  let reply = null;
  if (msg.type === 'interactive') reply = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || null;
  const text = msg.type === 'text' ? String(msg.text?.body || '').trim() : '';
  const t = normName(text);

  let state = await loadSession(admin, bakery, to);

  if (['cancelar', 'salir', 'reiniciar'].includes(t)) {
    await saveSession(admin, bakery, to, {});
    await waSend(bakery, waText(to, 'Listo, cancelé el pedido en curso. Escribí *hola* cuando quieras empezar de nuevo.'));
    return;
  }

  if (reply && reply.startsWith('p:')) {
    const productId = reply.slice(2);
    const { data: product } = await admin.from('products').select('*').eq('id', productId).eq('bakery_id', bakery.id).maybeSingle();
    if (!product) return sendMenu(admin, bakery, to, name);
    if (hasRequiredOptions(product)) {
      await waSend(bakery, waText(to, `${product.name} se arma a tu gusto 🎂 Elegí las opciones y la fecha acá:\n${appUrl()}/c/${bakery.slug}?p=${product.id}`));
      return saveSession(admin, bakery, to, {});
    }
    const left = await stockLeft(admin, bakery, product);
    if (left === 0) {
      await waSend(bakery, waText(to, `${product.name} está agotado por ahora 😕 Escribí *hola* para ver otros productos.`));
      return saveSession(admin, bakery, to, {});
    }
    await waSend(
      bakery,
      waButtons(to, `${product.name} — ${money(product.price)} c/u.\n¿Cuántas unidades querés? (si son más de 3, escribí el número)`, [
        { id: 'q:1', title: '1' }, { id: 'q:2', title: '2' }, { id: 'q:3', title: '3' },
      ]),
    );
    return saveSession(admin, bakery, to, { step: 'qty', productId });
  }

  if (state.step === 'qty' && (reply?.startsWith('q:') || /^\d{1,3}$/.test(text))) {
    const qty = Math.max(1, Number(reply ? reply.slice(2) : text));
    const next = await askDate(admin, bakery, to, { ...state, qty });
    return saveSession(admin, bakery, to, next);
  }

  if (state.step === 'date' && reply?.startsWith('d:')) {
    const next = await askSlot(admin, bakery, to, { ...state, date: reply.slice(2) });
    if (next.step === 'ready') return saveSession(admin, bakery, to, await finish(admin, bakery, to, next, contactName));
    return saveSession(admin, bakery, to, next);
  }

  if (state.step === 'slot' && reply?.startsWith('s:')) {
    const slot = (bakery.slots || [])[Number(reply.slice(2))] || null;
    const next = await askFulfillment(bakery, to, { ...state, slot });
    if (next.step === 'ready') return saveSession(admin, bakery, to, await finish(admin, bakery, to, next, contactName));
    return saveSession(admin, bakery, to, next);
  }

  if (state.step === 'fulfillment' && reply?.startsWith('f:')) {
    const fulfillment = reply.slice(2) === 'envio' ? 'envio' : 'retiro';
    if (fulfillment === 'envio') {
      await waSend(bakery, waText(to, 'Perfecto. Escribime la dirección de entrega (calle, número, piso/depto y localidad).'));
      return saveSession(admin, bakery, to, { ...state, fulfillment, step: 'address' });
    }
    return saveSession(admin, bakery, to, await finish(admin, bakery, to, { ...state, fulfillment }, contactName));
  }

  if (state.step === 'address' && text.length >= 6) {
    return saveSession(admin, bakery, to, await finish(admin, bakery, to, { ...state, address: text }, contactName));
  }

  // cualquier otra cosa: mostrar el menú
  await saveSession(admin, bakery, to, {});
  return sendMenu(admin, bakery, to, name);
}
