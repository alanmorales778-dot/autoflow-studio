'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveTryon } from '../media-actions';
import { useUploader } from './media-manager';

// Saca el fondo de una foto del armazón de frente: toma el color de las esquinas como fondo y lo
// vuelve transparente (también dentro de los cristales, así se ve la cara a través). Recorta lo que sobra.
export async function cutoutFrame(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Color de fondo: promedio de las 4 esquinas (bloques de 12 px).
  let r = 0, g = 0, b = 0, n = 0;
  for (const [x0, y0] of [[0, 0], [w - 12, 0], [0, h - 12], [w - 12, h - 12]]) {
    for (let y = y0; y < y0 + 12; y++) for (let x = x0; x < x0 + 12; x++) {
      const k = (y * w + x) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++;
    }
  }
  r /= n; g /= n; b /= n;
  const HARD = 38, SOFT = 78;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4;
    const dist = Math.hypot(d[k] - r, d[k + 1] - g, d[k + 2] - b);
    let a = dist <= HARD ? 0 : dist >= SOFT ? 255 : Math.round(((dist - HARD) / (SOFT - HARD)) * 255);
    d[k + 3] = a;
    if (a > 60) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX <= minX || maxY <= minY) throw new Error('No encontramos el armazón en la foto. Sacala sobre un fondo liso y que se vea entero.');
  const coverage = ((maxX - minX) * (maxY - minY)) / (w * h);
  if (coverage > 0.97) throw new Error('El fondo no es liso. Sacá la foto sobre una hoja blanca, sin sombras fuertes.');
  ctx.putImageData(img, 0, 0);
  const pad = 6;
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + pad * 2), ch = Math.min(h - cy, maxY - minY + pad * 2);
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(c, cx, cy, cw, ch, 0, 0, cw, ch);
  const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
  return new File([blob], 'armazon.png', { type: 'image/png' });
}

export default function TryonManager({ productId, current }) {
  const router = useRouter();
  const upload = useUploader();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  async function take(file) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const png = await cutoutFrame(file);
      setPreview(URL.createObjectURL(png));
      const path = await upload(productId, 'tryon', png, 'png');
      const r = await saveTryon(productId, path);
      if (r.error) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setError(e.message || 'No se pudo procesar la foto.');
    }
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  const img = preview || current;
  return (
    <div className="tryon-mgr">
      <div className="tryon-steps">
        <h3 style={{ margin: 0 }}>Probador virtual</h3>
        <p className="muted" style={{ margin: '2px 0 10px', fontSize: 13 }}>Tu cliente se los prueba con la cámara del celular, desde tu link. Para que funcione:</p>
        <ol className="muted" style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
          <li>Apoyá el armazón abierto sobre una hoja blanca (si es blanco, usá un fondo oscuro).</li>
          <li>Sacale una foto bien de frente, desde arriba, sin sombras fuertes.</li>
          <li>Subila acá: le sacamos el fondo solos.</li>
        </ol>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn small" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Procesando…' : img ? 'Cambiar foto del armazón' : 'Subir foto del armazón'}</button>
          {current && !busy && <button type="button" className="btn ghost small" onClick={async () => { await saveTryon(productId, null); setPreview(null); router.refresh(); }}>Quitar</button>}
        </div>
        {error && <p className="hint err" role="alert">{error}</p>}
      </div>
      <div className="tryon-preview" aria-label="Vista del armazón sin fondo">
        {img ? <img src={img} alt="Armazón sin fondo" /> : <span className="muted" style={{ fontSize: 13 }}>Acá vas a ver el armazón sin fondo</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => take(e.target.files?.[0])} />
    </div>
  );
}
