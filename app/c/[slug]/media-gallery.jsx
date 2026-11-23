'use client';

import { useEffect, useRef, useState } from 'react';

// Galería del producto en el link: deslizar con el dedo, videos que se reproducen solos (sin sonido)
// y fotos que se abren en pantalla completa y se amplían con un toque.
export default function MediaGallery({ items, name }) {
  const track = useRef(null);
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(null);
  const [big, setBig] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const on = () => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);

  // Los videos solo corren cuando están a la vista (ahorra datos y batería).
  useEffect(() => {
    const vids = track.current?.querySelectorAll('video') || [];
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio > 0.6) e.target.play().catch(() => {}); else e.target.pause();
    }), { threshold: [0, 0.6, 1] });
    vids.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [items]);

  useEffect(() => {
    if (!zoom) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setZoom(null); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [zoom]);

  const go = (k) => track.current?.scrollTo({ left: k * track.current.clientWidth, behavior: 'smooth' });

  if (!items.length) return <div className="ph" aria-hidden="true">{name.charAt(0)}</div>;
  return (
    <div className="mg">
      <div className="mg-track" ref={track}>
        {items.map((it, k) => (
          <div className="mg-slide" key={it.url}>
            {it.kind === 'video' ? (
              <video src={it.url} muted loop playsInline autoPlay={k === 0} preload={k === 0 ? 'auto' : 'metadata'} aria-label={`Video de ${name}`} />
            ) : (
              <button type="button" className="mg-img" onClick={() => { setZoom(it.url); setBig(false); }} aria-label="Ver en pantalla completa">
                <img src={it.url} alt={k === 0 ? name : `${name}, foto ${k + 1}`} loading={k === 0 ? 'eager' : 'lazy'} />
              </button>
            )}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <div className="mg-dots" role="tablist" aria-label="Fotos y videos">
            {items.map((it, k) => (
              <button key={it.url} type="button" role="tab" aria-selected={k === i} aria-label={`${it.kind === 'video' ? 'Video' : 'Foto'} ${k + 1} de ${items.length}`} className={k === i ? 'on' : ''} onClick={() => go(k)} />
            ))}
          </div>
          <span className="mg-count num">{i + 1}/{items.length}</span>
        </>
      )}
      {zoom && (
        <div className="mg-zoom" role="dialog" aria-modal="true" aria-label="Foto ampliada">
          <div className={`mg-zoom-body ${big ? 'big' : ''}`} onClick={() => setBig((b) => !b)}>
            <img src={zoom} alt={name} />
          </div>
          <p className="mg-zoom-hint">{big ? 'Tocá para achicar' : 'Tocá para ampliar'}</p>
          <button type="button" className="mg-close" onClick={() => setZoom(null)} aria-label="Cerrar">✕</button>
        </div>
      )}
    </div>
  );
}
