import crypto from 'node:crypto';

function key() {
  const s = process.env.APP_ENCRYPTION_KEY;
  if (!s) throw new Error('Falta configurar APP_ENCRYPTION_KEY en Vercel.');
  return crypto.createHash('sha256').update(s).digest();
}

export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  if (!payload) return null;
  const [iv, tag, enc] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export function sign(value) {
  const sig = crypto.createHmac('sha256', key()).update(String(value)).digest('base64url');
  return `${value}.${sig}`;
}

export function unsign(signed) {
  if (!signed || !signed.includes('.')) return null;
  const i = signed.lastIndexOf('.');
  const value = signed.slice(0, i);
  return safeEqual(sign(value), signed) ? value : null;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function hmacSha256Hex(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}
