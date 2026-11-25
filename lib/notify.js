import { rubroOf } from '@/lib/rubros';
// Avisos por mail al dueño del negocio (pedido nuevo, seña cobrada).
// Usa SMTP (por ahora Gmail con contraseña de aplicación). Si faltan SMTP_USER / SMTP_PASS, no hace nada.
import nodemailer from 'nodemailer';
import { appUrl } from './env';
import { money, dateLabel } from './format';
import { optionsSummary } from './options';
import { reportError } from './alerts';
import { notify } from './notifications';

let transport = null;
function mailer() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

export const mailEnabled = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function ownerEmail(admin, bakery) {
  if (bakery.notify_email) return bakery.notify_email;
  const { data } = await admin.auth.admin.getUserById(bakery.owner_id);
  return data?.user?.email || null;
}

export async function sendMail({ to, subject, html, text }) {
  const t = mailer();
  if (!t || !to) return false;
  await t.sendMail({ from: `"${process.env.SMTP_FROM_NAME || 'HakkiraApp'}" <${process.env.SMTP_USER}>`, to, subject, html, text });
  return true;
}

function orderHtml(bakery, order, title, lead) {
  const T = rubroOf(bakery);
  const rows = [
    [T.item.charAt(0).toUpperCase() + T.item.slice(1), `${order.quantity} × ${order.product_name}`],
    order.options?.length ? ['Opciones', optionsSummary(order.options)] : null,
    ['Fecha', `${dateLabel(order.date)}${order.slot ? ` · ${order.slot}` : ''}`],
    ['Entrega', order.fulfillment === 'envio' ? `${T.envio}: ${order.address || '—'}` : T.retiro],
    ['Cliente', `${order.customer_name}${order.customer_phone ? ` · ${order.customer_phone}` : ''}`],
    order.dedication ? [T.note1.label, order.dedication] : null,
    order.allergies ? [T.note2.label, order.allergies] : null,
    order.notes ? ['Notas', order.notes] : null,
    ['Total', money(order.total)],
    ['Seña', `${money(order.deposit_amount)}${order.status === 'confirmado' ? ' · cobrada' : ' · pendiente'}`],
  ].filter(Boolean);
  const url = `${appUrl()}/app/pedidos`;
  return `<!doctype html><html><body style="margin:0;background:#fafaf9;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="font-weight:800;font-size:18px;margin-bottom:16px">Auto<span style="color:#c2410c">Flow</span></div>
    <div style="background:#fff;border:1px solid #e7e7e4;border-radius:16px;padding:24px">
      <h1 style="font-size:22px;margin:0 0 6px">${esc(title)}</h1>
      <p style="margin:0 0 18px;color:#3f3f46">${esc(lead)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#71717a;width:110px;vertical-align:top;border-top:1px solid #f4f4f2">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #f4f4f2;${T.note2.warn && k === T.note2.label ? 'color:#b91c1c;font-weight:700' : ''}">${esc(v)}</td></tr>`).join('')}</table>
      <a href="${url}" style="display:inline-block;margin-top:20px;background:#c2410c;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Ver en mi panel</a>
    </div>
    <p style="font-size:12px;color:#71717a;margin-top:16px">Te llega este aviso porque está activado en Ajustes → Avisos de ${esc(bakery.name)}.</p>
  </div></body></html>`;
}

// kind: 'nuevo' | 'pagado'
export async function notifyOwner(admin, bakery, order, kind = 'nuevo') {
  // Campanita + aviso al celular (siempre); el mail solo si está activado y configurado.
  if (bakery && ['web', 'whatsapp'].includes(order.channel) && !order.subscription_id) {
    const T = rubroOf(bakery);
    const when = `${dateLabel(order.date)}${order.slot ? ` · ${order.slot}` : ''}`;
    await notify(admin, bakery, kind === 'pagado'
      ? { kind: 'pagado', title: `Seña cobrada · ${order.customer_name}`, body: `${money(order.deposit_amount)} · ${order.quantity} × ${order.product_name} · ${when}`, url: `/app/pedidos?q=${encodeURIComponent(order.customer_name)}` }
      : { kind: 'nuevo', title: `${T.orderCap} nuevo · ${order.customer_name}`, body: `${order.quantity} × ${order.product_name} · ${when}${order.status === 'pendiente_sena' ? ' · esperando seña' : ' · confirmado'}`, url: `/app/pedidos?q=${encodeURIComponent(order.customer_name)}` });
  }
  try {
    if (!bakery?.notify_orders || !mailEnabled()) return;
    if (!['web', 'whatsapp'].includes(order.channel) || order.subscription_id) return;
    const to = await ownerEmail(admin, bakery);
    if (!to) return;
    const pend = order.status === 'pendiente_sena';
    const title = kind === 'pagado' ? `Seña cobrada: ${order.product_name}` : `Pedido nuevo: ${order.quantity} × ${order.product_name}`;
    const lead =
      kind === 'pagado'
        ? `${order.customer_name} pagó la seña de ${money(order.deposit_amount)}. El pedido quedó confirmado.`
        : pend
          ? `${order.customer_name} hizo un pedido para el ${dateLabel(order.date)}. Está esperando la seña${order.expires_at ? '' : ': coordiná el pago y marcalo como «Seña cobrada»'}.`
          : `${order.customer_name} hizo un pedido para el ${dateLabel(order.date)}. Ya está confirmado.`;
    await sendMail({
      to,
      subject: `${title} · ${dateLabel(order.date)}`,
      html: orderHtml(bakery, order, title, lead),
      text: `${title}\n${lead}\n\n${appUrl()}/app/pedidos`,
    });
  } catch (e) {
    await reportError('notify_owner', e, { bakeryId: bakery?.id });
  }
}
