'use client';

import { useMemo, useState } from 'react';
import { applySimulatedPrices } from '../actions';

const fmt = (n) => '$ ' + Math.round(n).toLocaleString('es-AR');
const pct = (n) => (Math.round(n * 10) / 10).toLocaleString('es-AR') + ' %';

export default function Simulator({ rows, overhead, margin, drive }) {
  // Los 4 insumos que más pesan en el costo total: tienen su propio control.
  const top = useMemo(() => {
    const tot = new Map();
    rows.forEach((r) => r.parts.forEach((p) => {
      const t = tot.get(p.key) || { key: p.key, name: p.name, cost: 0 };
      t.cost += p.cost;
      tot.set(p.key, t);
    }));
    return [...tot.values()].sort((a, b) => b.cost - a.cost).slice(0, 4);
  }, [rows]);

  const [general, setGeneral] = useState(0);
  const [extra, setExtra] = useState({});
  const [target, setTarget] = useState(String(Math.round(margin)));
  const [preset, setPreset] = useState(null);
  const [pending, setPending] = useState(false);

  const t = Math.min(90, Math.max(0, parseFloat(target) || 0));
  const presets = [
    { id: 'mes', label: 'Inflación del mes · 3 %', g: 3, e: {} },
    { id: 'tri', label: 'Trimestre · 10 %', g: 10, e: {} },
    { id: 'top', label: `Suba fuerte de ${top[0] ? top[0].name.toLowerCase() : 'tu insumo principal'}`, g: 3, e: top[0] ? { [top[0].key]: 35 } : {} },
  ];

  const calc = rows.map((r) => {
    const raw = r.parts.reduce((s, p) => s + p.cost, 0);
    const nraw = r.parts.reduce((s, p) => s + p.cost * (1 + general / 100) * (1 + (extra[p.key] || 0) / 100), 0);
    const cost = raw * (1 + overhead / 100);
    const nc = nraw * (1 + overhead / 100);
    const mNow = ((r.price - cost) / r.price) * 100;
    const m = ((r.price - nc) / r.price) * 100;
    const sugg = Math.ceil(nc / (1 - t / 100) / 100) * 100;
    const risk = m < t - 0.05;
    return { ...r, cost, nc, mNow, m, sugg, risk };
  });
  const risky = calc.filter((c) => c.risk && c.sugg > c.price);
  const avg = (k) => calc.reduce((s, c) => s + c[k], 0) / calc.length;
  const touched = general > 0 || Object.values(extra).some(Boolean);

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
      <section className="card" aria-label="Simulador" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label>Escenarios rápidos</label>
          <div className="row" style={{ gap: 8 }}>
            {presets.map((p) => (
              <button key={p.id} type="button" className={`chip ${preset === p.id ? 'on' : ''}`} onClick={() => { setGeneral(p.g); setExtra(p.e); setPreset(p.id); }}>{p.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="row between"><label htmlFor="g" style={{ margin: 0 }}>Suba general de insumos</label><strong className="num" style={{ color: general ? 'var(--brand-h)' : 'var(--muted)' }}>+{general} %</strong></div>
          <input id="g" type="range" min="0" max="60" value={general} onChange={(e) => { setGeneral(Number(e.target.value)); setPreset(null); }} />
        </div>
        {top.map((i) => (
          <div key={i.key}>
            <div className="row between"><label htmlFor={`e-${i.key}`} style={{ margin: 0 }}>{i.name} (extra)</label><strong className="num" style={{ color: extra[i.key] ? 'var(--brand-h)' : 'var(--muted)' }}>+{extra[i.key] || 0} %</strong></div>
            <input id={`e-${i.key}`} type="range" min="0" max="60" value={extra[i.key] || 0} onChange={(e) => { setExtra((x) => ({ ...x, [i.key]: Number(e.target.value) })); setPreset(null); }} />
          </div>
        ))}
        <div style={{ height: 1, background: 'var(--line)' }} />
        <div className="row between">
          <label htmlFor="tm" style={{ margin: 0 }}>Margen que querés ganar</label>
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <input id="tm" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, '').slice(0, 2))} style={{ width: 72, textAlign: 'right' }} />
            <strong>%</strong>
          </div>
        </div>
        <small>Incluye tus indirectos ({pct(overhead)}). Cambiás los dos en Ajustes.</small>
      </section>

      <section style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kpis" style={{ marginBottom: 0 }}>
          <div className="card kpi"><span className="l">Margen promedio hoy</span><span className="v">{pct(avg('mNow'))}</span></div>
          <div className="card kpi"><span className="l">Con la suba simulada</span><span className="v" style={{ color: avg('m') < t ? 'var(--warn)' : 'var(--ok)' }}>{pct(avg('m'))}</span></div>
          <div className="card kpi"><span className="l">Productos en riesgo</span><span className="v" style={{ color: risky.length ? 'var(--bad)' : 'var(--ok)' }}>{risky.length}</span></div>
        </div>
        <div className="card table-wrap" style={{ padding: 0, marginBottom: 0 }}>
          <table>
            <thead><tr><th style={{ paddingLeft: 18 }}>Producto</th><th className="r">Costo hoy</th><th className="r">Costo nuevo</th><th className="r">Precio</th><th className="r">Margen</th><th className="r">Sugerido</th><th>Estado</th></tr></thead>
            <tbody>
              {calc.map((c) => {
                const st = c.m < 0 ? ['A pérdida', 'bad', 'var(--bad)'] : c.risk ? ['Bajo tu margen', 'warn', 'var(--warn)'] : ['Bien', 'ok', 'var(--ok)'];
                return (
                  <tr key={c.id}>
                    <td style={{ paddingLeft: 18, fontWeight: 600, minWidth: 160 }}>{c.name}</td>
                    <td className="r muted">{fmt(c.cost)}</td>
                    <td className="r">{touched ? fmt(c.nc) : '—'}</td>
                    <td className="r" style={{ fontWeight: 600 }}>{fmt(c.price)}</td>
                    <td className="r" style={{ fontWeight: 700, color: st[2] }}>{pct(c.m)}</td>
                    <td className="r" style={{ color: 'var(--brand-h)', fontWeight: 600 }}>{c.risk && c.sugg > c.price ? fmt(c.sugg) : '—'}</td>
                    <td><span className={`badge ${st[1]}`}>{st[0]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action={applySimulatedPrices} onSubmit={() => setPending(true)} className="card row between" style={{ marginBottom: 0 }}>
          <input type="hidden" name="prices" value={JSON.stringify(risky.map((c) => ({ id: c.id, price: c.sugg })))} />
          <span style={{ fontSize: 14, color: 'var(--ink-2)', flex: '1 1 260px' }}>
            {risky.length
              ? `${risky.length} ${risky.length === 1 ? 'producto queda' : 'productos quedan'} por debajo del ${t} % que querés ganar.${drive ? ' También se actualiza tu planilla de Drive.' : ''}`
              : 'Todos tus productos cubren el margen que elegiste.'}
          </span>
          <button className="btn" disabled={!risky.length || pending}>{pending ? 'Aplicando…' : risky.length ? `Aplicar precio sugerido a ${risky.length}` : 'Precios al día'}</button>
        </form>
      </section>
    </div>
  );
}
