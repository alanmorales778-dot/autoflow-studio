// Instagram con «Instagram Login» (Business Login for Instagram): conectar la cuenta profesional
// del negocio, guardar el token cifrado, renovarlo y publicar fotos aprobadas por el dueño.
// Se activa cuando están INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET (app de Meta aprobada o en modo desarrollo con testers).
import crypto from 'node:crypto';
import { appUrl } from './env';
import { encrypt, decrypt } from './crypto';

export const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
];

const VERSION = () => process.env.IG_API_VERSION || 'v26.0';
const GRAPH = 'https://graph.instagram.com';

export const hasInstagram = () => !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
export const igRedirectUri = () => `${appUrl()}/api/meta/instagram/callback`;

export function igAuthorizeUrl(state) {
  const p = new URLSearchParams({
    enable_fb_login: '0',
    force_authentication: '1',
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: igRedirectUri(),
    response_type: 'code',
    scope: IG_SCOPES.join(','),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

async function readJson(res, tag) {
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error || body?.error_type) {
    const msg = body?.error?.message || body?.error_message || body?.error?.error_user_msg || `HTTP ${res.status}`;
    const err = new Error(`${tag}: ${msg}`);
    err.code = body?.error?.code;
    err.subcode = body?.error?.error_subcode;
    throw err;
  }
  return body;
}

// Código de un solo uso → token corto → token largo (60 días) + datos de la cuenta.
export async function igExchangeCode(code) {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: igRedirectUri(),
    code: String(code).replace(/#_$/, ''),
  });
  const short = await readJson(await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, signal: AbortSignal.timeout(15000) }), 'ig-token');
  const s = Array.isArray(short?.data) ? short.data[0] : short;
  if (!s?.access_token) throw new Error('ig-token: sin token');
  const longRes = await fetch(`${GRAPH}/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: process.env.INSTAGRAM_APP_SECRET, access_token: s.access_token })}`, { signal: AbortSignal.timeout(15000) });
  const long = await readJson(longRes, 'ig-long-token');
  const me = await igGet('me', long.access_token, { fields: 'user_id,username,account_type' });
  const perms = Array.isArray(s.permissions) ? s.permissions.join(',') : String(s.permissions || '');
  return {
    token: long.access_token,
    expiresAt: new Date(Date.now() + Number(long.expires_in || 5184000) * 1000).toISOString(),
    userId: String(me.user_id || me.id || s.user_id),
    username: me.username || null,
    scopes: perms,
  };
}

export async function igRefresh(token) {
  const res = await fetch(`${GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })}`, { signal: AbortSignal.timeout(15000) });
  const body = await readJson(res, 'ig-refresh');
  return { token: body.access_token, expiresAt: new Date(Date.now() + Number(body.expires_in || 5184000) * 1000).toISOString() };
}

async function igGet(path, token, params = {}) {
  const res = await fetch(`${GRAPH}/${VERSION()}/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  return readJson(res, `ig-get ${path.split('/')[0]}`);
}

async function igPost(path, token, params = {}) {
  const res = await fetch(`${GRAPH}/${VERSION()}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30000),
  });
  return readJson(res, `ig-post ${path.split('/').pop()}`);
}

// Guarda o actualiza la cuenta conectada del negocio (solo servidor, con la clave admin).
export async function saveIgAccount(admin, bakeryId, acc) {
  const { error } = await admin.from('social_accounts').upsert({
    bakery_id: bakeryId,
    network: 'instagram',
    external_id: acc.userId,
    username: acc.username,
    token_enc: encrypt(acc.token),
    token_expires_at: acc.expiresAt,
    scopes: acc.scopes?.slice(0, 500) || null,
    status: 'ok',
    last_error: null,
    connected_at: new Date().toISOString(),
    refreshed_at: new Date().toISOString(),
  }, { onConflict: 'bakery_id,network' });
  if (error) throw error;
}

export async function getIgAccount(admin, bakeryId) {
  const { data } = await admin.from('social_accounts').select('*').eq('bakery_id', bakeryId).eq('network', 'instagram').maybeSingle();
  return data || null;
}

// Una foto: crear contenedor → esperar que esté listo → publicar → traer el link.
// imageUrl tiene que ser JPEG y público (Instagram lo descarga desde ahí).
export async function igPublishPhoto(account, { imageUrl, caption }) {
  const token = decrypt(account.token_enc);
  const igId = account.external_id;
  const container = await igPost(`${igId}/media`, token, { image_url: imageUrl, caption: String(caption || '').slice(0, 2200) });
  for (let i = 0; i < 6; i += 1) {
    const st = await igGet(container.id, token, { fields: 'status_code' });
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`ig-container: ${st.status_code}`);
    await new Promise((r) => setTimeout(r, 2500));
  }
  const pub = await igPost(`${igId}/media_publish`, token, { creation_id: container.id });
  let permalink = null;
  try {
    permalink = (await igGet(pub.id, token, { fields: 'permalink' })).permalink || null;
  } catch {}
  return { id: pub.id, permalink };
}

// ¿La foto sirve para Instagram? Tiene que ser JPEG y accesible sin sesión.
export async function isPublicJpeg(url) {
  if (!url || !/^https:\/\//.test(url)) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    return res.ok && /^image\/jpe?g/i.test(res.headers.get('content-type') || '');
  } catch {
    return false;
  }
}

// signed_request de Meta (desautorizar y borrado de datos): firma HMAC-SHA256 con el secreto de la app.
export function parseSignedRequest(signed, secret) {
  if (!signed || !secret || !signed.includes('.')) return null;
  const [sig, payload] = signed.split('.', 2);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig.replace(/=+$/, ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
