'use client';

import { useEffect, useRef, useState } from 'react';
import { money, num, parseNum } from '@/lib/format';
import { CATEGORIES, parseQty, qtyLabel } from '@/lib/shopping';
import s from './shopping.module.css';

const qtyText = (item) => (item.qty === null || item.qty === undefined ? '' : `${num(item.qty, 2)}${item.unit ? ` ${item.unit}` : ''}`);
const costText = (item) => (item.est_cost === null || item.est_cost === undefined ? '' : num(item.est_cost, 2));

// Un ítem de la lista. Tildar = comprado. Tocar el texto = se abre para editar todo en el lugar.
export default function ShoppingRow({ item, settling, open, onOpen, onClose, onToggle, onSave, onDelete }) {
  const done = item.bought || settling;
  const details = [qtyLabel(item.qty, item.unit), item.est_cost !== null && item.est_cost !== undefined ? money(item.est_cost) : null].filter(Boolean).join(' · ');

  return (
    <li className={`${s.row} ${done ? s.rowDone : ''} ${settling ? s.rowSettling : ''} ${open ? s.rowOpen : ''}`} data-cat={item.category}>
      <div className={s.rowLine}>
        <button
          type="button"
          className={`${s.check} ${s.press}`}
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Desmarcar ${item.name}` : `Marcar ${item.name} como comprado`}
          onClick={() => onToggle(item)}
        >
          <span className={s.checkBox}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><polyline points="3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
          </span>
        </button>
        <button type="button" className={s.rowText} aria-expanded={open} aria-label={`Editar ${item.name}`} onClick={() => (open ? onClose() : onOpen(item.id))}>
          <span className={s.name}>{item.name}</span>
          {details ? <span className={`${s.details} ${s.num}`}>{details}</span> : <span className={s.addDetails}>+ cantidad y precio</span>}
          {item.note && <span className={s.note}>{item.note}</span>}
        </button>
      </div>
      {open && <RowEditor item={item} onSave={onSave} onClose={onClose} onDelete={onDelete} />}
    </li>
  );
}

function RowEditor({ item, onSave, onClose, onDelete }) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(qtyText(item));
  const [cost, setCost] = useState(costText(item));
  const [category, setCategory] = useState(item.category);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function save(e) {
    e?.preventDefault();
    if (!name.trim()) { setError('Poné un nombre.'); return; }
    const q = parseQty(qty);
    if (!q) { setError('La cantidad va como «5 kg», «30 un» o «2 l».'); return; }
    let c = null;
    if (cost.trim()) {
      c = parseNum(cost);
      if (c === null || c < 0) { setError('El precio tiene que ser un número, ej. 6500.'); return; }
    }
    const patch = {};
    if (name.trim() !== item.name) patch.name = name.trim();
    if (q.qty !== (item.qty ?? null) || q.unit !== (item.unit || '')) { patch.qty = q.qty; patch.unit = q.unit; }
    if (c !== (item.est_cost ?? null)) patch.est_cost = c;
    if (category !== item.category) patch.category = category;
    if (Object.keys(patch).length) onSave(item, patch);
    onClose();
  }

  return (
    <form
      className={`${s.editor} no-print`}
      onSubmit={save}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      noValidate
    >
      <label className={s.field}>
        <span>Nombre</span>
        <input ref={nameRef} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} enterKeyHint="done" autoComplete="off" />
      </label>
      <div className={s.fieldRow}>
        <label className={s.field}>
          <span>Cantidad</span>
          <input className={s.num} value={qty} onChange={(e) => { setQty(e.target.value); setError(''); }} placeholder="5 kg" enterKeyHint="done" autoComplete="off" />
        </label>
        <label className={s.field}>
          <span>Precio estimado</span>
          <div className={s.money}>
            <span aria-hidden="true">$</span>
            <input className={s.num} value={cost} onChange={(e) => { setCost(e.target.value); setError(''); }} placeholder="0" inputMode="decimal" enterKeyHint="done" autoComplete="off" />
          </div>
        </label>
      </div>
      <div className={s.field}>
        <span>Pasillo</span>
        <div className={s.pills} role="radiogroup" aria-label="Pasillo">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={category === c.key} data-cat={c.key} className={`${s.pill} ${s.press} ${category === c.key ? s.pillOn : ''}`} onClick={() => setCategory(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className={s.formError} role="alert">{error}</p>}
      <div className={s.editorActions}>
        <button type="button" className={`${s.textBtn} ${s.textBtnDanger} ${s.press}`} onClick={() => onDelete(item)}>Eliminar</button>
        <span className={s.spacer} />
        <button type="button" className={`btn secondary small ${s.press}`} onClick={onClose}>Cancelar</button>
        <button type="submit" className={`btn small ${s.press}`}>Guardar</button>
      </div>
    </form>
  );
}
