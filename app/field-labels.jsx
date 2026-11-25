'use client';

import { useEffect } from 'react';

// Muchos formularios usan <div class="field"><label>Texto</label><input/></div> sin `for`/`id`.
// Este componente une cada etiqueta con su campo para que los lectores de pantalla y el
// autocompletar del celular sepan qué es cada uno. Revisa de nuevo cuando la página cambia.
let seq = 0;

function link(root) {
  root.querySelectorAll('.field > label:not([for])').forEach((label) => {
    if (label.querySelector('input,select,textarea')) return; // ya envuelve su campo
    let el = label.nextElementSibling;
    while (el && !el.matches('input,select,textarea') && !el.querySelector('input,select,textarea')) el = el.nextElementSibling;
    if (!el) return;
    const field = el.matches('input,select,textarea') ? el : el.querySelector('input:not([type=hidden]),select,textarea');
    if (!field || field.type === 'hidden') return;
    if (!field.id) field.id = `fld-${++seq}`;
    label.htmlFor = field.id;
  });
}

export default function FieldLabels() {
  useEffect(() => {
    link(document);
    const obs = new MutationObserver(() => link(document));
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
