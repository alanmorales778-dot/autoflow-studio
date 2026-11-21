'use client';

import { useRef, useState } from 'react';

// Elegir una foto con un toque (o arrastrándola): la achica en el navegador y la sube sola.
// Así una foto de celular de 8 MB queda en ~300 KB y nunca choca con el límite del servidor.
async function shrink(file, maxSide, keepPng) {
  if (!/^image\//.test(file.type) || file.type === 'image/gif') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // formato que el navegador no puede abrir (ej. HEIC en Windows): se manda tal cual
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  const png = keepPng && file.type === 'image/png';
  if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = png ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.85));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + (png ? '.png' : '.jpg'), { type });
}

export default function PhotoPicker({ action, hidden = {}, current, label = 'Elegir foto', changeLabel = 'Cambiar foto', maxSide = 1600, keepPng = false, shape = 'wide', placeholder }) {
  const formRef = useRef(null);
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);

  async function take(file) {
    setError('');
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
      setError('Elegí una imagen JPG, PNG o WEBP.');
      return;
    }
    setBusy(true);
    const small = await shrink(file, maxSide, keepPng);
    if (small.size > 4 * 1024 * 1024) {
      setBusy(false);
      setError('La foto es muy pesada. Probá con otra o sacale una captura de pantalla.');
      return;
    }
    setPreview(URL.createObjectURL(small));
    const dt = new DataTransfer();
    dt.items.add(small);
    inputRef.current.files = dt.files;
    formRef.current.requestSubmit();
  }

  const img = preview || current;
  return (
    <form ref={formRef} action={action} className={`photo-picker ${shape}`}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input ref={inputRef} type="file" name="foto" accept="image/jpeg,image/png,image/webp,image/heic" className="photo-input" onChange={(e) => take(e.target.files?.[0])} tabIndex={-1} aria-hidden="true" />
      <button
        type="button"
        className={`photo-drop ${over ? 'over' : ''} ${img ? 'has' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
        disabled={busy}
        aria-label={img ? changeLabel : label}
      >
        {img ? <img src={img} alt="" /> : <span className="photo-ph">{placeholder}</span>}
        <span className="photo-cta">{busy ? 'Subiendo…' : img ? changeLabel : label}</span>
      </button>
      {error && <p className="hint err" role="alert">{error}</p>}
    </form>
  );
}
