'use client';

import { useRef, useState } from 'react';
import { money } from '@/lib/format';
import { categoryLabel, guessCategory, qtyLabel, splitNameQty } from '@/lib/shopping';
import s from './shopping.module.css';

// Un solo campo: «Harina 0000 5 kg $6500» + Enter. Cantidad, precio y categoría se entienden solos
// (y se pueden corregir después tocando el ítem).
export default function QuickAdd({ onAdd, cats, example = 'Harina 5 kg $6500' }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const parsed = text.trim() ? splitNameQty(text) : null;
  const category = parsed?.name ? guessCategory(parsed.name, cats) : null;

  function submit(e) {
    e.preventDefault();
    if (!parsed?.name) { inputRef.current?.focus(); return; }
    onAdd({ name: parsed.name, qty: parsed.qty, unit: parsed.unit, est_cost: parsed.est_cost, category });
    setText('');
    inputRef.current?.focus();
  }

  const preview = parsed?.name
    ? [parsed.name, qtyLabel(parsed.qty, parsed.unit), parsed.est_cost !== null && money(parsed.est_cost), categoryLabel(category, cats)].filter(Boolean).join(' · ')
    : null;

  return (
    <form className={`${s.quickAdd} no-print`} onSubmit={submit} noValidate>
      <div className={s.quickRow}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Agregar… ej. ${example}`}
          aria-label="Agregar a la lista: nombre, cantidad y precio"
          enterKeyHint="done"
          autoComplete="off"
        />
        <button className={`btn ${s.press} ${s.quickBtn}`} type="submit" aria-label="Agregar" disabled={!parsed?.name}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
        </button>
      </div>
      <p className={s.quickPreview} aria-live="polite">
        {preview ? <>Se agrega: <strong>{preview}</strong></> : 'Nombre, cantidad y $precio. Enter para agregar.'}
      </p>
    </form>
  );
}
