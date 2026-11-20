'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Cantidad: al cambiarla se recalculan solas las fechas con lugar (antes había que tocar «Ver fechas»
// y si no se tocaba, el pedido se guardaba con la cantidad vieja).
export function QtyPicker({ productId, qty }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(String(qty));
  const [pending, startTransition] = useTransition();
  const timer = useRef(null);

  useEffect(() => setValue(String(qty)), [qty]);

  const go = (v) => {
    const n = Math.max(1, Math.min(50, Math.floor(Number(v)) || 1));
    if (n === qty) return;
    const params = new URLSearchParams();
    params.set('p', productId);
    params.set('q', String(n));
    if (sp.get('error')) params.delete('error');
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  };

  const onChange = (e) => {
    setValue(e.target.value);
    clearTimeout(timer.current);
    const v = e.target.value;
    if (v === '') return;
    timer.current = setTimeout(() => go(v), 450);
  };

  return (
    <form method="get" className="row" style={{ marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); go(value); }}>
      <input type="hidden" name="p" value={productId} />
      <label htmlFor="qty" style={{ margin: 0 }}>Cantidad</label>
      <span className="row" style={{ gap: 6 }}>
        <button type="button" className="btn secondary small" aria-label="Uno menos" onClick={() => { const n = Math.max(1, (Number(value) || 1) - 1); setValue(String(n)); go(n); }}>−</button>
        <input id="qty" name="q" type="number" min="1" max="50" inputMode="numeric" value={value} onChange={onChange} onBlur={() => value === '' && setValue(String(qty))} style={{ maxWidth: 80, textAlign: 'center' }} />
        <button type="button" className="btn secondary small" aria-label="Uno más" onClick={() => { const n = Math.min(50, (Number(value) || 1) + 1); setValue(String(n)); go(n); }}>+</button>
      </span>
      <span className="muted" style={{ fontSize: 13 }} aria-live="polite">{pending ? 'Buscando fechas…' : ''}</span>
      <noscript><button className="btn secondary small">Ver fechas</button></noscript>
    </form>
  );
}

// Entrega: con «envío» la dirección pasa a ser obligatoria (se valida antes de mandar).
export function FulfillmentFields({ retiroLabel, envioLabel, deliveryEnabled, noPickupAddress }) {
  const [mode, setMode] = useState('retiro');
  return (
    <>
      <div className="field">
        <label htmlFor="fulfillment">Entrega</label>
        <select id="fulfillment" name="fulfillment" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="retiro">{retiroLabel}</option>
          {deliveryEnabled && <option value="envio">{envioLabel}</option>}
        </select>
        {mode === 'retiro' && noPickupAddress && <div className="hint">El negocio te confirma la dirección de retiro por WhatsApp.</div>}
      </div>
      {deliveryEnabled && mode === 'envio' && (
        <div className="field">
          <label htmlFor="address">Dirección de entrega</label>
          <input id="address" name="address" required autoComplete="street-address" placeholder="Calle, número, piso, localidad" />
        </div>
      )}
    </>
  );
}

// Guarda lo que el cliente va escribiendo (solo en este navegador, mientras la pestaña está abierta)
// y lo repone si el pedido vuelve con un error, para no tener que cargar todo de nuevo.
export function FormMemory({ storageKey, restore }) {
  const ref = useRef(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const skip = (el) => !el.name || ['hidden', 'file', 'submit', 'button'].includes(el.type) || el.name === 'website' || el.name.startsWith('$');
    const read = () => { try { return JSON.parse(sessionStorage.getItem(storageKey) || '{}'); } catch { return {}; } };
    const save = () => {
      const data = {};
      for (const el of form.elements) {
        if (skip(el)) continue;
        if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; continue; }
        if (el.type === 'checkbox') { data[el.name] = el.checked; continue; }
        data[el.name] = el.value;
      }
      try { sessionStorage.setItem(storageKey, JSON.stringify(data)); } catch {}
    };
    if (restore) {
      const data = read();
      const setVal = (el, v) => {
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      // Primero fecha y entrega (cambian qué otros campos aparecen), después el resto.
      const order = ['date', 'fulfillment', 'slot'];
      const names = [...order.filter((n) => n in data), ...Object.keys(data).filter((n) => !order.includes(n))];
      const apply = (name) => {
        const v = data[name];
        const els = [...form.elements].filter((el) => el.name === name && !skip(el));
        els.forEach((el) => {
          if (el.type === 'radio') { if (el.value === v && !el.disabled && !el.checked) el.click(); }
          else if (el.type === 'checkbox') { if (el.checked !== !!v) el.click(); }
          else if (v !== undefined && el.value !== v) setVal(el, v);
        });
      };
      // Los campos que dependen de otros aparecen después de un render: aplicamos en dos pasadas.
      names.forEach(apply);
      setTimeout(() => names.forEach(apply), 60);
    }
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    return () => { form.removeEventListener('input', save); form.removeEventListener('change', save); };
  }, [storageKey, restore]);
  return <span ref={ref} hidden />;
}
