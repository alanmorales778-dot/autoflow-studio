'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';

// Fotos y videos de un producto. Los archivos van directo del navegador a Storage con un link firmado
// (así un video de 30 MB no pasa por el servidor, que corta en 4,5 MB) y acá solo se anota la dirección.

const MAX_ITEMS = 12;
const EXT = { image: ['jpg', 'png', 'webp'], video: ['mp4', 'mov', 'webm'] };
const BUCKET = 'productos';

async function ownProduct(id) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const { data: product } = await admin.from('products').select('id,gallery,photo_url,tryon_url').eq('id', String(id || '')).eq('bakery_id', bakery.id).maybeSingle();
  if (!product) throw new Error('No encontramos ese producto.');
  return { bakery, admin, product, gallery: Array.isArray(product.gallery) ? product.gallery : [] };
}

function publicUrl(admin, path) {
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function pathOf(url) {
  const p = String(url || '').split(`/storage/v1/object/public/${BUCKET}/`)[1];
  return p ? decodeURIComponent(p) : null;
}

function refresh(bakery, id) {
  revalidatePath(`/app/productos/${id}`);
  revalidatePath('/app/productos');
  revalidatePath(`/c/${bakery.slug}`);
}

// Pide un link para subir un archivo. kind: image | video | tryon
export async function signMediaUpload(productId, kind, ext) {
  try {
    const { bakery, admin, product, gallery } = await ownProduct(productId);
    const e = String(ext || '').toLowerCase().replace('jpeg', 'jpg').replace('quicktime', 'mov');
    const allowed = kind === 'tryon' ? ['png'] : EXT[kind];
    if (!allowed || !allowed.includes(e)) return { error: kind === 'video' ? 'El video tiene que ser MP4, MOV o WEBM.' : 'La foto tiene que ser JPG, PNG o WEBP.' };
    if (kind !== 'tryon' && gallery.length >= MAX_ITEMS) return { error: `Llegaste al máximo de ${MAX_ITEMS} fotos y videos. Borrá alguno para subir otro.` };
    const path = `${bakery.id}/${product.id}-${kind === 'tryon' ? 'probador' : 'g'}-${crypto.randomBytes(6).toString('hex')}.${e}`;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: 'No se pudo preparar la subida. Probá de nuevo.' };
    return { path, token: data.token };
  } catch (err) {
    return { error: err.message || 'No se pudo preparar la subida.' };
  }
}

// Anota en el producto un archivo ya subido.
export async function addMedia(productId, path, kind) {
  try {
    const { bakery, admin, product, gallery } = await ownProduct(productId);
    if (!['image', 'video'].includes(kind)) return { error: 'Tipo de archivo no válido.' };
    if (!String(path).startsWith(`${bakery.id}/${product.id}-g-`)) return { error: 'Archivo no válido.' };
    if (gallery.length >= MAX_ITEMS) return { error: `Máximo ${MAX_ITEMS} fotos y videos.` };
    const url = publicUrl(admin, path);
    const next = [...gallery, { url, kind }];
    const patch = { gallery: next };
    // Si todavía no tiene foto principal, la primera foto pasa a ser la portada.
    if (!product.photo_url && kind === 'image') patch.photo_url = url;
    const { error } = await admin.from('products').update(patch).eq('id', product.id);
    if (error) return { error: 'No se pudo guardar. Probá de nuevo.' };
    refresh(bakery, product.id);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}

export async function removeMedia(productId, url) {
  try {
    const { bakery, admin, product, gallery } = await ownProduct(productId);
    const next = gallery.filter((g) => g.url !== url);
    const patch = { gallery: next };
    if (product.photo_url === url) patch.photo_url = next.find((g) => g.kind === 'image')?.url || null;
    await admin.from('products').update(patch).eq('id', product.id);
    const p = pathOf(url);
    if (p && p.startsWith(`${bakery.id}/`)) await admin.storage.from(BUCKET).remove([p]);
    refresh(bakery, product.id);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}

// Mueve un archivo de lugar (dir -1 / +1) o lo pone de portada (cover).
export async function arrangeMedia(productId, url, action) {
  try {
    const { bakery, admin, product, gallery } = await ownProduct(productId);
    const i = gallery.findIndex((g) => g.url === url);
    if (i < 0) return { error: 'No encontramos ese archivo.' };
    const next = [...gallery];
    const patch = {};
    if (action === 'cover') {
      if (next[i].kind !== 'image') return { error: 'La portada tiene que ser una foto.' };
      patch.photo_url = next[i].url;
      const [it] = next.splice(i, 1);
      next.unshift(it);
    } else {
      const j = i + (action === 'up' ? -1 : 1);
      if (j < 0 || j >= next.length) return { ok: true };
      [next[i], next[j]] = [next[j], next[i]];
    }
    patch.gallery = next;
    await admin.from('products').update(patch).eq('id', product.id);
    refresh(bakery, product.id);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}

// Probador virtual: guarda (o quita) la imagen del armazón sin fondo.
export async function saveTryon(productId, path) {
  try {
    const { bakery, admin, product } = await ownProduct(productId);
    if (path && !String(path).startsWith(`${bakery.id}/${product.id}-probador-`)) return { error: 'Archivo no válido.' };
    const url = path ? publicUrl(admin, path) : null;
    await admin.from('products').update({ tryon_url: url }).eq('id', product.id);
    const old = pathOf(product.tryon_url);
    if (old && old.startsWith(`${bakery.id}/`)) await admin.storage.from(BUCKET).remove([old]);
    refresh(bakery, product.id);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}
