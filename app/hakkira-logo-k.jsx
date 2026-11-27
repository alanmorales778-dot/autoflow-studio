'use client';

// Logo principal de HakkiraApp para el hero de la landing (versión K · Capas del servicio).
// Un pedido (pelota roja) atraviesa 3 placas de vidrio: Pedido por link → Agenda y cobro → Tu ganancia.
// Se abre y se cierra en un ciclo de 8 s, sigue al mouse y respeta «reducir movimiento».
// Sin dependencias. Fuentes: Bricolage Grotesque 800, Inter y JetBrains Mono (cargadas en app/layout.jsx).
// `width`/`height`: tamaño de la escena a escala 1; se achica sola al ancho disponible.

import { useEffect, useRef, useState } from 'react';


function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [n >> 16, (n >> 8) & 255, n & 255];
  return '#' + rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

const CSS = `
@keyframes hkView{0%,100%{transform:rotateX(24deg) rotateY(-34deg)}50%{transform:rotateX(18deg) rotateY(-24deg)}}
@keyframes hkF{0%,68%{transform:translateZ(120px)}80%,88%{transform:translateZ(16px)}100%{transform:translateZ(120px)}}
@keyframes hkB{0%,68%{transform:translateZ(-120px)}80%,88%{transform:translateZ(-16px)}100%{transform:translateZ(-120px)}}
@keyframes hkBall{0%{transform:translateZ(320px) scale(.7);opacity:0}5%{opacity:1}15%{transform:translateZ(122px) scale(1)}32%{transform:translateZ(2px)}50%{transform:translateZ(-116px) scale(1);opacity:1}55%{transform:translateZ(-118px) scale(1.7);opacity:0}100%{transform:translateZ(320px) scale(.7);opacity:0}}
@keyframes hkRip{0%{opacity:.95;transform:translateZ(2px) scale(.4)}14%{opacity:0;transform:translateZ(2px) scale(2.6)}15%,100%{opacity:0;transform:translateZ(2px) scale(.4)}}
@keyframes hkCell{0%,31%{background-color:rgba(24,24,27,.08)}33%,80%{background-color:var(--hk-acc)}84%,100%{background-color:rgba(24,24,27,.08)}}
@keyframes hkCash{0%,49%{transform:scale(1);text-shadow:none}53%{transform:scale(1.28);text-shadow:0 0 28px rgba(255,255,255,.9)}62%,80%{transform:scale(1.08);text-shadow:0 0 14px rgba(255,255,255,.5)}92%,100%{transform:scale(1);text-shadow:none}}
@keyframes hkLab{0%,66%{opacity:1;transform:translateZ(2px)}74%,90%{opacity:0;transform:translateZ(2px) translateX(-10px)}97%,100%{opacity:1;transform:translateZ(2px)}}
@keyframes hkSheen{0%{transform:translateX(-170%) rotate(20deg)}30%,100%{transform:translateX(170%) rotate(20deg)}}
.hk-k *{box-sizing:border-box}
.hk-k .v{animation:hkView 12s ease-in-out infinite}
.hk-k .f{animation:hkF 8s cubic-bezier(.65,0,.25,1) infinite}
.hk-k .b{animation:hkB 8s cubic-bezier(.65,0,.25,1) infinite}
.hk-k .ball{animation:hkBall 8s cubic-bezier(.45,0,.55,1) infinite}
.hk-k .rip{opacity:0;animation:hkRip 8s ease-out infinite}
.hk-k .cell{animation:hkCell 8s step-end infinite}
.hk-k .cash{animation:hkCash 8s ease-out infinite}
.hk-k .lab{animation:hkLab 8s ease-in-out infinite}
.hk-k .sheen{position:absolute;top:-40%;left:0;width:45%;height:180%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:hkSheen 8s ease-in-out infinite}
.hk-k .pane{position:absolute;inset:0;transform-style:preserve-3d}
.hk-k .face{position:absolute;inset:0;border-radius:44px;overflow:hidden}
.hk-k .pill{position:absolute;left:198px;top:58px;white-space:nowrap;display:flex;align-items:center;gap:10px;padding:10px 16px 10px 10px;border-radius:16px;background:rgba(255,255,255,.92);box-shadow:0 10px 26px rgba(0,0,0,.12),inset 0 0 0 1px rgba(255,255,255,.9);font-family:Inter,system-ui,sans-serif}
.hk-k .num{width:30px;height:30px;border-radius:10px;color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center}
.hk-k .t1{display:block;font-size:15px;font-weight:700;color:#18181B}
.hk-k .t2{display:block;font-size:12px;color:#52525B}
@media (max-width:520px){.hk-k .t2{display:none}.hk-k .pill{padding:8px 14px 8px 8px}}
@media (prefers-reduced-motion: reduce){
.hk-k .v,.hk-k .f,.hk-k .b,.hk-k .ball,.hk-k .rip,.hk-k .cell,.hk-k .cash,.hk-k .lab,.hk-k .sheen{animation:none}
.hk-k .f{transform:translateZ(120px)}.hk-k .b{transform:translateZ(-120px)}.hk-k .ball,.hk-k .rip{opacity:0}.hk-k .lab{transform:translateZ(2px)}
}`;

const SLICES = [-6, -4, -2];
const FILLED = [0, 1, 3, 4, 7, 9, 10];

function Bag({ size = 84 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M24 40 H76 L71 82 Q70 88 64 88 H36 Q30 88 29 82 Z" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinejoin="round" />
      <path d="M38 40 V32 Q38 20 50 20 Q62 20 62 32 V40" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function Pill({ n, title, sub, accent, top }) {
  return (
    <div className="pill lab" style={{ top }}>
      <span className="num" style={{ background: accent }}>{n}</span>
      <span><span className="t1">{title}</span><span className="t2">{sub}</span></span>
    </div>
  );
}

export default function HakkiraLogoK({ accent = '#DC2626', showLabels = true, width: BASE_W = 1040, height: BASE_H = 520 }) {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / BASE_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [BASE_W]);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: Math.round(-y * 16), y: Math.round(x * 26) });
  };

  const red = {
    light: shade(accent, 0.4), dark: shade(accent, -0.4), edge: shade(accent, -0.5),
    glow: rgba(accent, 0.28), glowStrong: rgba(accent, 0.8), shadow: rgba(accent, 0.35),
    ball: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${shade(accent, 0.45)} 18%, ${accent} 55%, ${shade(accent, -0.5)} 100%)`,
  };
  const rip = (color, delay) => (
    <span className="rip" style={{ position: 'absolute', left: 67, top: 55, width: 80, height: 80, borderRadius: '50%', border: `3px solid ${color}`, animationDelay: delay }} />
  );

  return (
    <div ref={boxRef} className="hk-k" style={{ width: '100%', maxWidth: BASE_W, height: BASE_H * scale, margin: '0 auto', position: 'relative' }}>
      <style>{CSS}</style>
      <div
        role="img"
        aria-label="Logo de HakkiraApp: un pedido atraviesa tres capas de vidrio, pedido por link, agenda y cobro, y tu ganancia"
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{ position: 'absolute', left: '50%', top: 0, width: BASE_W, height: BASE_H, marginLeft: -BASE_W / 2, transform: `scale(${scale})`, transformOrigin: '50% 0', perspective: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ position: 'absolute', left: BASE_W / 2 - 170, top: BASE_H / 2 - 170, width: 340, height: 340, borderRadius: '50%', background: `radial-gradient(closest-side, ${red.glow}, transparent)` }} />
        <div style={{ transformStyle: 'preserve-3d', transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform .35s ease-out' }}>
          <div className="v" style={{ position: 'relative', width: 180, height: 180, marginLeft: showLabels ? -120 : 0, transformStyle: 'preserve-3d' }}>
            {/* 3 · Tu ganancia */}
            <div className="pane b">
              {SLICES.map((z) => <div key={z} className="face" style={{ transform: `translateZ(${z}px)`, background: red.edge }} />)}
              <div className="face" style={{ background: `linear-gradient(145deg, ${red.light} 0%, ${accent} 45%, ${red.dark} 100%)`, boxShadow: `0 30px 60px ${red.shadow}, inset 0 1px 0 rgba(255,255,255,.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="cash" style={{ display: 'inline-block', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 84, lineHeight: 1, color: '#FFFFFF' }}>$</span>
                <span className="sheen" style={{ animationDelay: '4.2s' }} />
              </div>
              {rip('#FFFFFF', '-4s')}
              {showLabels && <Pill n="3" title="Tu ganancia" sub="Sabés cuánto te quedó" accent={accent} top={124} />}
            </div>
            {/* 2 · Agenda y cobro */}
            <div className="pane">
              {SLICES.map((z) => <div key={z} className="face" style={{ transform: `translateZ(${z}px)`, background: 'rgba(255,255,255,.35)' }} />)}
              <div className="face" style={{ background: 'linear-gradient(150deg, rgba(255,255,255,.9) 0%, rgba(255,255,255,.62) 100%)', boxShadow: 'inset 0 1px 0 #FFFFFF, inset 0 0 0 1.5px rgba(255,255,255,.85), 0 24px 44px rgba(0,0,0,.10)' }}>
                <div style={{ position: 'absolute', left: 24, top: 24, right: 24, height: 18, borderRadius: 6, background: 'rgba(24,24,27,.85)' }} />
                <div style={{ position: 'absolute', left: 24, top: 54, right: 24, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, '--hk-acc': accent }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} className={i === 6 ? 'cell' : undefined} style={{ height: 22, borderRadius: 7, backgroundColor: FILLED.includes(i) ? 'rgba(24,24,27,.6)' : 'rgba(24,24,27,.08)' }} />
                  ))}
                </div>
                <span className="sheen" style={{ animationDelay: '2.5s' }} />
              </div>
              {rip(accent, '-5.44s')}
              {showLabels && <Pill n="2" title="Agenda y cobro" sub="Se ubica en un horario y se cobra la seña" accent={accent} top={58} />}
            </div>
            {/* 1 · Pedido por link */}
            <div className="pane f">
              {SLICES.map((z) => <div key={z} className="face" style={{ transform: `translateZ(${z}px)`, background: 'rgba(24,24,27,.55)' }} />)}
              <div className="face" style={{ background: 'linear-gradient(150deg, rgba(63,63,70,.93) 0%, rgba(24,24,27,.94) 55%, rgba(9,9,11,.96) 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 1px rgba(255,255,255,.08), 0 26px 44px rgba(0,0,0,.28)' }}>
                <span style={{ position: 'absolute', left: 48, top: 26 }}><Bag /></span>
                <span style={{ position: 'absolute', left: 22, right: 22, bottom: 22, height: 30, borderRadius: 15, background: 'rgba(255,255,255,.1)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#E4E4E7' }}>/c/tu-negocio</span>
                <span className="sheen" style={{ animationDelay: '.6s' }} />
              </div>
              {rip(accent, '-6.8s')}
              {showLabels && <Pill n="1" title="Pedido por link" sub="Tu cliente pide solo, a cualquier hora" accent={accent} top={-8} />}
            </div>
            {/* El pedido */}
            <div className="ball" style={{ position: 'absolute', left: 93, top: 81, width: 28, height: 28, borderRadius: '50%', background: red.ball, boxShadow: `0 0 22px ${red.glowStrong}` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Nombre chico (barra de la app y menú de la landing): h y pelota en rojo.
export function HakkiraWordmark({ size = 28, accent = '#DC2626', color = 'inherit' }) {
  return (
    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: size, letterSpacing: '-0.04em', color, lineHeight: 1 }}>
      <span style={{ color: accent }}>h</span>akk
      <span style={{ position: 'relative', display: 'inline-block', color: 'inherit' }}>
        ı<span style={{ position: 'absolute', left: '50%', top: '0.12em', width: '0.24em', height: '0.24em', borderRadius: '50%', background: accent, transform: 'translate(-50%, -50%)' }} />
      </span>
      ra
    </span>
  );
}
