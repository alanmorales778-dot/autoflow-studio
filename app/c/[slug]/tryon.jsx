'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Probador virtual de anteojos: la cámara del celular detecta la cara (MediaPipe, corre en el
// teléfono; la imagen no se manda a ningún lado) y dibuja el armazón sobre los ojos.
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise = null;
async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(/* webpackIgnore: true */ `${VISION}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      const make = (delegate) => vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      try { return await make('GPU'); } catch { return make('CPU'); }
    })().catch((e) => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

function loadImg(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
}

// Pone el armazón según los rabillos externos de los ojos (puntos 33 y 263 de MediaPipe).
function placeGlasses(ctx, frame, pts, W, H, mirror, prev) {
  const P = (k) => ({ x: mirror ? W - pts[k].x * W : pts[k].x * W, y: pts[k].y * H });
  let a = P(263), b = P(33);
  if (a.x > b.x) [a, b] = [b, a];
  const eye = Math.hypot(b.x - a.x, b.y - a.y);
  // Giro de la cabeza (de costado): achica un poco el armazón en horizontal.
  const nose = P(1);
  const ratio = Math.min(1, Math.max(0.55, 1 - Math.abs((nose.x - a.x) / Math.max(1, b.x - a.x) - 0.5) * 0.9));
  let cur = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    ang: Math.atan2(b.y - a.y, b.x - a.x),
    w: eye * 1.55,
    sx: ratio,
  };
  if (prev) {
    const k = 0.55; // suaviza el temblor entre cuadros
    cur = { x: prev.x + (cur.x - prev.x) * k, y: prev.y + (cur.y - prev.y) * k, ang: prev.ang + (cur.ang - prev.ang) * k, w: prev.w + (cur.w - prev.w) * k, sx: prev.sx + (cur.sx - prev.sx) * k };
  }
  const h = cur.w * (frame.height / frame.width);
  ctx.save();
  ctx.translate(cur.x, cur.y);
  ctx.rotate(cur.ang);
  ctx.scale(cur.sx, 1);
  ctx.drawImage(frame, -cur.w / 2, -h * 0.47, cur.w, h);
  ctx.restore();
  return cur;
}

export default function Tryon({ frames, initialId }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | loading | live | photo | error
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState(() => Math.max(0, frames.findIndex((f) => f.id === initialId)));
  const video = useRef(null);
  const canvas = useRef(null);
  const stream = useRef(null);
  const raf = useRef(0);
  const frameImg = useRef(null);
  const prev = useRef(null);
  const photo = useRef(null);
  const fileIn = useRef(null);
  const [face, setFace] = useState(true);
  const faceRef = useRef(true);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    loadImg(frames[sel].url).then((im) => { if (alive) { frameImg.current = im; if (state === 'photo') drawPhoto(); } }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, frames]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function start() {
    setOpen(true);
    setState('loading');
    setMsg('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no-cam'), { name: 'NotFoundError' });
      const [lm, s] = await Promise.all([
        getLandmarker(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false }),
      ]);
      stream.current = s;
      const v = video.current;
      v.srcObject = s;
      await v.play();
      await lm.setOptions({ runningMode: 'VIDEO' });
      setState('live');
      prev.current = null;
      let last = -1;
      const loop = () => {
        const c = canvas.current;
        if (!c || !stream.current) return;
        const W = v.videoWidth, H = v.videoHeight;
        if (W && H) {
          if (c.width !== W) { c.width = W; c.height = H; }
          const ctx = c.getContext('2d');
          ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, W, H); ctx.restore();
          if (v.currentTime !== last) {
            last = v.currentTime;
            const r = lm.detectForVideo(v, performance.now());
            const pts = r.faceLandmarks?.[0];
            if (pts && frameImg.current) prev.current = placeGlasses(ctx, frameImg.current, pts, W, H, true, prev.current);
            else prev.current = null;
            if (!!pts !== faceRef.current) { faceRef.current = !!pts; setFace(!!pts); }
          } else if (prev.current && frameImg.current) {
            const p = prev.current;
            const h = p.w * (frameImg.current.height / frameImg.current.width);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.scale(p.sx, 1); ctx.drawImage(frameImg.current, -p.w / 2, -h * 0.47, p.w, h); ctx.restore();
          }
        }
        raf.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      stop();
      setState('error');
      setMsg(e?.name === 'NotAllowedError'
        ? 'No diste permiso para usar la cámara. Podés permitirlo en el candado de la barra de direcciones, o probártelos con una selfie.'
        : e?.name === 'NotFoundError' || e?.name === 'NotReadableError'
          ? 'No pudimos abrir la cámara. Probátelos con una selfie.'
          : 'No pudimos cargar el probador (revisá la conexión). Podés probar con una selfie.');
    }
  }

  async function drawPhoto() {
    const c = canvas.current, im = photo.current;
    if (!c || !im) return;
    const lm = await getLandmarker();
    await lm.setOptions({ runningMode: 'IMAGE' });
    const scale = Math.min(1, 1280 / Math.max(im.width, im.height));
    const W = Math.round(im.width * scale), H = Math.round(im.height * scale);
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(im, 0, 0, W, H);
    const r = lm.detect(c);
    const pts = r.faceLandmarks?.[0];
    if (!pts) { setMsg('No encontramos una cara en la foto. Probá con una selfie de frente y con buena luz.'); return; }
    setMsg('');
    if (frameImg.current) placeGlasses(ctx, frameImg.current, pts, W, H, false, null);
  }

  async function usePhoto(file) {
    if (!file) return;
    stop();
    setOpen(true);
    setState('loading');
    try {
      const url = URL.createObjectURL(file);
      photo.current = await loadImg(url);
      setState('photo');
      await new Promise((r) => requestAnimationFrame(r));
      await drawPhoto();
    } catch {
      setState('error');
      setMsg('No pudimos abrir esa foto. Probá con otra.');
    }
    if (fileIn.current) fileIn.current.value = '';
  }

  async function snap() {
    const c = canvas.current;
    if (!c) return;
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `probando-${frames[sel].name.replace(/\W+/g, '-').toLowerCase()}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: frames[sel].name }); return; } catch { /* canceló */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
  }

  function close() {
    stop();
    setOpen(false);
    setState('idle');
  }

  return (
    <>
      <div className="tryon-cta">
        <button type="button" className="btn block" onClick={start}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="6.5" cy="14" r="3.5" /><circle cx="17.5" cy="14" r="3.5" /><path d="M10 14h4M3 14l1.5-6M21 14l-1.5-6" /></svg>
          Probátelos con tu cámara
        </button>
        <button type="button" className="tryon-alt" onClick={() => fileIn.current?.click()}>o con una selfie</button>
        <input ref={fileIn} type="file" accept="image/*" hidden onChange={(e) => usePhoto(e.target.files?.[0])} />
      </div>
      {open && (
        <div className="tryon" role="dialog" aria-modal="true" aria-label="Probador virtual">
          <div className="tryon-stage">
            <video ref={video} playsInline muted className="tryon-video" />
            <canvas ref={canvas} className="tryon-canvas" />
            {state === 'loading' && <p className="tryon-note">Preparando el probador…</p>}
            {state === 'live' && !face && <p className="tryon-hint">Mirá de frente a la cámara</p>}
            {(state === 'error' || msg) && state !== 'loading' && (
              <div className="tryon-note">
                <p>{msg}</p>
                <button type="button" className="btn small" onClick={() => fileIn.current?.click()}>Usar una selfie</button>
              </div>
            )}
          </div>
          <div className="tryon-bar">
            {frames.length > 1 && (
              <div className="tryon-frames">
                {frames.map((f, k) => (
                  <button key={f.id} type="button" className={k === sel ? 'on' : ''} onClick={() => setSel(k)} aria-label={`Probar ${f.name}`} title={f.name}>
                    <img src={f.url} alt="" />
                  </button>
                ))}
              </div>
            )}
            <p className="tryon-name">{frames[sel].name}</p>
            <div className="tryon-actions">
              <button type="button" className="btn secondary" onClick={close}>Cerrar</button>
              <button type="button" className="btn" onClick={snap} disabled={!(state === 'live' || state === 'photo')}>Sacar foto</button>
            </div>
            <p className="tryon-privacy">La imagen queda en tu celular: no se guarda ni se envía.</p>
          </div>
        </div>
      )}
    </>
  );
}
