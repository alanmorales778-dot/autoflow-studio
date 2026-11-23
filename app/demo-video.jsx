'use client';

import { useEffect, useRef, useState } from 'react';

// Video de la app funcionando: no se descarga hasta que el visitante llega a esta parte.
export default function DemoVideo({ src, poster }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); el.play?.().catch(() => {}); } else el.pause?.();
    }, { rootMargin: '200px 0px', threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className="demo-video"
      src={on ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      preload="none"
      aria-label="Video: un cliente pide desde el link, el pedido aparece en Hoy, se arma la lista de compras y se ve la ganancia del mes"
    />
  );
}
