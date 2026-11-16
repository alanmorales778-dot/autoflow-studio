import { decrypt, hmacSha256Hex, safeEqual } from './crypto';

const V = () => process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';

export async function waSend(bakery, payload) {
  if (!bakery.wa_phone_number_id || !bakery.wa_token_enc) return null;
  const token = decrypt(bakery.wa_token_enc);
  const res = await fetch(`https://graph.facebook.com/${V()}/${bakery.wa_phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${json?.error?.message || res.statusText}`);
  return json;
}

export const waText = (to, body) => ({ to, type: 'text', text: { body: body.slice(0, 4000), preview_url: true } });

export const waButtons = (to, body, buttons) => ({
  to,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: { text: body.slice(0, 1024) },
    action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
  },
});

export const waList = (to, body, button, sectionTitle, rows) => ({
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: { text: body.slice(0, 1024) },
    action: {
      button: button.slice(0, 20),
      sections: [
        {
          title: sectionTitle.slice(0, 24),
          rows: rows.slice(0, 10).map((r) => ({ id: r.id.slice(0, 200), title: r.title.slice(0, 24), description: (r.description || '').slice(0, 72) })),
        },
      ],
    },
  },
});

export function verifyMetaSignature(rawBody, header, appSecretEnc) {
  if (!appSecretEnc) return true; // sin app secret cargado no se puede validar
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = `sha256=${hmacSha256Hex(decrypt(appSecretEnc), rawBody)}`;
  return safeEqual(expected, header);
}
