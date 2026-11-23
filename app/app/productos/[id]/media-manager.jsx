'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { signMediaUpload, addMedia, removeMedia, arrangeMedia } from '../media-actions';

// Fotos en alta (hasta 2400 px) y videos cortos, subidos directo a Storage.
const MAX_VIDEO_MB = 50;
const MAX_VIDEO_SEC = 60;

async function shrinkHigh(file) {
  if (!/^image\//.test(file.type) || file.type === 'image/gif') return file;
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024 && /jpe?g|webp/.test(file.type)) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
}

function videoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { resolve(v.duration); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(file);
  });
}

export function useUploader() {
  const [sb] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  return async (productId, kind, file, ext) => {
    const signed = await signMediaUpload(productId, kind, ext);
    if (signed.error) throw new Error(signed.error);
    const { error } = await sb.storage.from('productos').uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
    if (error) throw new Error('No se pudo subir el archivo. Revisá la conexión y probá de nuevo.');
    return signed.path;
  };
}

export default function MediaManager({ productId, items = [], cover, title, hint }) {
  const router = useRouter();
  const upload = useUploader();
  const input = useRef(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  async function take(files) {
    setError('');
    const list = [...(files || [])];
    if (!list.length) return;
    for (let k = 0; k < list.length; k++) {
      const f = list[k];
      const isVideo = /^video\//.test(f.type) || /\.(mp4|mov|webm)$/i.test(f.name);
      setBusy(list.length > 1 ? `Subiendo ${k + 1} de ${list.length}…` : isVideo ? 'Subiendo video…' : 'Subiendo foto…');
      try {
        if (isVideo) {
          if (f.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`El video pesa más de ${MAX_VIDEO_MB} MB. Grabá uno más corto (10 a 20 segundos alcanza).`);
          const d = await videoDuration(f);
          if (d && d > MAX_VIDEO_SEC + 1) throw new Error(`El video dura más de ${MAX_VIDEO_SEC} segundos. Recortalo en el celular y subilo de nuevo.`);
          const ext = (f.name.match(/\.(mp4|mov|webm)$/i)?.[1] || f.type.split('/')[1] || 'mp4').toLowerCase();
          const path = await upload(productId, 'video', f, ext);
          const r = await addMedia(productId, path, 'video');
          if (r.error) throw new Error(r.error);
        } else {
          if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic)$/i.test(f.name)) throw new Error('Elegí fotos (JPG, PNG o WEBP) o videos (MP4 o MOV).');
          const small = await shrinkHigh(f);
          const ext = small.type === 'image/png' ? 'png' : small.type === 'image/webp' ? 'webp' : 'jpg';
          const path = await upload(productId, 'image', small, ext);
          const r = await addMedia(productId, path, 'image');
          if (r.error) throw new Error(r.error);
        }
      } catch (e) {
        setError(e.message);
        break;
      }
    }
    setBusy('');
    if (input.current) input.current.value = '';
    router.refresh();
  }

  function act(fn) {
    start(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="media-mgr">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: 13, maxWidth: '60ch' }}>{hint}</p>
        </div>
        <span className="muted num" style={{ fontSize: 12 }}>{items.length} de 12</span>
      </div>
      <ul className="media-grid">
        {items.map((it, i) => (
          <li key={it.url} className={`media-cell ${it.url === cover ? 'is-cover' : ''}`}>
            {it.kind === 'video'
              ? <video src={`${it.url}#t=0.1`} muted playsInline preload="metadata" />
              : <img src={it.url} alt="" loading="lazy" />}
            {it.kind === 'video' && <span className="media-tag">▶ Video</span>}
            {it.url === cover && <span className="media-tag cover">Portada</span>}
            <div className="media-tools">
              <button type="button" onClick={() => act(() => arrangeMedia(productId, it.url, 'up'))} disabled={i === 0 || pending} aria-label="Mover antes">←</button>
              {it.kind === 'image' && it.url !== cover && <button type="button" onClick={() => act(() => arrangeMedia(productId, it.url, 'cover'))} disabled={pending}>Portada</button>}
              <button type="button" onClick={() => act(() => arrangeMedia(productId, it.url, 'down'))} disabled={i === items.length - 1 || pending} aria-label="Mover después">→</button>
              <button type="button" className="del" onClick={() => { if (confirm('¿Borrar este archivo?')) act(() => removeMedia(productId, it.url)); }} disabled={pending} aria-label="Borrar">✕</button>
            </div>
          </li>
        ))}
        {items.length < 12 && (
          <li>
            <button type="button" className="media-add" onClick={() => input.current?.click()} disabled={!!busy}>
              <span aria-hidden="true">+</span>
              {busy || 'Fotos o video'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => take(e.target.files)} />
      {error && <p className="hint err" role="alert">{error}</p>}
      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Fotos en alta calidad (se pueden ampliar con el dedo). Videos de hasta {MAX_VIDEO_SEC} segundos y {MAX_VIDEO_MB} MB: en tu link se reproducen solos, sin sonido.</p>
    </div>
  );
}
