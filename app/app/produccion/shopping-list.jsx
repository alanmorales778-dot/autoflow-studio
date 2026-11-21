'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { money } from '@/lib/format';
import { categoriesFor, categoryOf, sameName, suggestionToItem } from '@/lib/shopping';
import { addShoppingItems, deleteShoppingItems, updateShoppingItem } from './shopping-actions';
import QuickAdd from './quick-add';
import ShoppingRow from './shopping-row';
import s from './shopping.module.css';

const SETTLE_MS = 420; // tiempo que un ítem recién tildado queda tachado en su lugar antes de bajar a «Comprados»

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function reducer(items, a) {
  switch (a.type) {
    case 'add': {
      const ids = new Set(a.items.map((i) => i.id));
      return [...items.filter((i) => !ids.has(i.id)), ...a.items];
    }
    case 'update':
      return items.map((i) => (i.id === a.id ? { ...i, ...a.patch } : i));
    case 'remove': {
      const ids = new Set(a.ids);
      return items.filter((i) => !ids.has(i.id));
    }
    case 'replace':
      return a.items;
    default:
      return items;
  }
}

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k] ?? null]));
const sumCost = (list) => list.reduce((t, i) => t + (Number(i.est_cost) || 0), 0);
const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));

function readStore(key, fallback) {
  try { const v = window.localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function writeStore(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado o sin espacio */ }
}

export default function ShoppingList({ initialItems, mode, loadError, bakeryId, suggestions, suggestionsLocked, labels }) {
  const cats = useMemo(() => categoriesFor(labels.shopCats), [labels.shopCats]);
  const [items, dispatch] = useReducer(reducer, initialItems);
  const [settling, setSettling] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [boughtOpen, setBoughtOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState(null);
  const [ready, setReady] = useState(mode !== 'local'); // en modo local, no escribir hasta haber leído lo guardado
  const toastTimer = useRef(null);
  const storeKey = `autoflow:compras:${bakeryId}`;

  // ---------- Guardado en el dispositivo (solo si la tabla todavía no existe) ----------
  useEffect(() => {
    if (mode !== 'local') return;
    const saved = readStore(storeKey, []);
    if (Array.isArray(saved) && saved.length) dispatch({ type: 'replace', items: saved });
    setReady(true);
  }, [mode, storeKey]);

  useEffect(() => {
    if (mode === 'local' && ready) writeStore(storeKey, items);
  }, [items, mode, storeKey, ready]);

  useEffect(() => {
    if (!confirmClear) return undefined;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((msg, action = null) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, action, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 3500);
  }, []);

  // ---------- Optimistic UI: primero se ve el cambio, después se guarda; si falla, vuelve atrás ----------
  const sync = useCallback(async (call, rollback, failMsg = 'No se pudo guardar. Revisá tu conexión y probá de nuevo.') => {
    if (mode === 'local') return;
    try {
      const res = await call();
      if (!res?.ok) throw new Error(res?.error || 'error');
    } catch {
      dispatch(rollback);
      showToast(failMsg);
    }
  }, [mode, showToast]);

  const addItems = useCallback((newItems) => {
    const now = Date.now();
    const full = newItems.map((it, idx) => ({
      id: it.id || newId(),
      name: it.name,
      qty: it.qty ?? null,
      unit: it.unit || '',
      category: it.category || 'otros',
      est_cost: it.est_cost ?? null,
      note: it.note || '',
      source: it.source || 'manual',
      bought: !!it.bought,
      bought_at: it.bought_at || null,
      created_at: it.created_at || new Date(now + idx).toISOString(),
    }));
    dispatch({ type: 'add', items: full });
    sync(() => addShoppingItems(full.map(({ created_at, ...rest }) => rest)), { type: 'remove', ids: full.map((i) => i.id) });
  }, [sync]);

  const patchItem = useCallback((item, patch) => {
    const prev = pick(item, Object.keys(patch));
    dispatch({ type: 'update', id: item.id, patch });
    sync(() => updateShoppingItem(item.id, patch), { type: 'update', id: item.id, patch: prev });
  }, [sync]);

  const toggle = useCallback((item) => {
    const bought = !item.bought;
    if (bought) {
      setOpenId((cur) => (cur === item.id ? null : cur));
      setSettling((cur) => new Set(cur).add(item.id));
      setTimeout(() => setSettling((cur) => { const n = new Set(cur); n.delete(item.id); return n; }), SETTLE_MS);
    }
    patchItem(item, { bought, bought_at: bought ? new Date().toISOString() : null });
  }, [patchItem]);

  const restore = useCallback((list) => {
    dispatch({ type: 'add', items: list });
    sync(() => addShoppingItems(list.map(({ created_at, ...rest }) => rest)), { type: 'remove', ids: list.map((i) => i.id) });
  }, [sync]);

  const removeItems = useCallback((list, msg) => {
    setOpenId(null);
    dispatch({ type: 'remove', ids: list.map((i) => i.id) });
    sync(() => deleteShoppingItems(list.map((i) => i.id)), { type: 'add', items: list }, 'No se pudo borrar. Revisá tu conexión.');
    showToast(msg, { label: 'Deshacer', run: () => restore(list) });
  }, [sync, showToast, restore]);

  // ---------- Datos derivados ----------
  const pendingAll = useMemo(() => items.filter((i) => !i.bought), [items]);
  const boughtAll = useMemo(() => items.filter((i) => i.bought).sort((a, b) => String(b.bought_at).localeCompare(String(a.bought_at))), [items]);
  const budget = sumCost(pendingAll);
  const withoutCost = pendingAll.filter((i) => i.est_cost === null || i.est_cost === undefined).length;
  const progress = items.length ? Math.round((boughtAll.length / items.length) * 100) : 0;

  // Pendientes agrupados por pasillo (los recién tildados siguen visibles un instante, tachados)
  const showing = items.filter((i) => !i.bought || settling.has(i.id)).sort(byNewest);
  const groups = cats.map((c) => ({ ...c, items: showing.filter((i) => categoryOf(i, cats) === c.key) })).filter((g) => g.items.length);
  const singleGroup = groups.length === 1;

  const freshSuggestions = (suggestions || []).filter((r) => !pendingAll.some((i) => sameName(i.name, r.name)));

  const rowProps = {
    onToggle: toggle,
    onSave: patchItem,
    onOpen: setOpenId,
    onClose: () => setOpenId(null),
    onDelete: (item) => removeItems([item], `«${item.name}» eliminado`),
  };

  return (
    <section className={s.wrap} aria-label="Lista de compras">
      {/* Resumen en una línea */}
      <div className={s.summary}>
        <p className={s.summaryText}>
          {pendingAll.length === 0 ? (
            <strong>{items.length ? 'Todo comprado' : 'Lista vacía'}</strong>
          ) : (
            <>
              <strong className={s.num}>{pendingAll.length} por comprar</strong>
              {budget > 0 && <> · <span className={s.num}>{money(budget)}</span></>}
              {withoutCost > 0 && budget > 0 && <span className={s.muted}> · {withoutCost} sin precio</span>}
            </>
          )}
        </p>
        {mode === 'local' && <span className={s.localBadge} title="Se guarda en este dispositivo hasta que se active la sincronización">En este dispositivo</span>}
        {items.length > 0 && (
          <div className={s.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Avance de la compra">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      {loadError && <div className="alert warn">No pudimos traer tu lista guardada ({loadError}). Lo que cargues ahora se guarda igual.</div>}

      <QuickAdd onAdd={(it) => addItems([it])} cats={cats} example={labels.shopEx} />

      {/* Sugeridos por los pedidos: una línea que se abre */}
      {suggestionsLocked ? (
        <p className={`${s.suggestBar} ${s.suggestLocked} no-print`}>
          Con el módulo de Costos, AutoFlow te sugiere qué comprar según tus {labels.orders || 'pedidos'}. <a href="/app/plan">Ver planes →</a>
        </p>
      ) : freshSuggestions.length > 0 && (
        <div className={`${s.suggest} no-print`}>
          <div className={s.suggestBar}>
            <button type="button" className={s.suggestToggle} aria-expanded={suggestOpen} onClick={() => setSuggestOpen((v) => !v)}>
              <svg className={s.chev} viewBox="0 0 20 20" aria-hidden="true"><path d="M7 8l3 3 3-3" /></svg>
              {freshSuggestions.length} {freshSuggestions.length === 1 ? 'sugerido' : 'sugeridos'} por tus {labels.orders || 'pedidos'}
            </button>
            <button
              type="button"
              className={`${s.textBtn} ${s.textBtnBrand} ${s.press}`}
              onClick={() => {
                addItems(freshSuggestions.map((r) => suggestionToItem(r, newId(), cats)));
                showToast(`Se ${freshSuggestions.length === 1 ? 'agregó 1 ítem' : `agregaron ${freshSuggestions.length} ítems`}`);
                setSuggestOpen(false);
              }}
            >
              Agregar todos
            </button>
          </div>
          {suggestOpen && (
            <ul className={s.suggestList}>
              {freshSuggestions.map((r) => (
                <li key={r.name} className={s.suggestRow}>
                  <div className={s.suggestMain}>
                    <span className={s.suggestName}>{r.name}</span>
                    <span className={s.note}>{r.packLabel || `necesitás ${r.needed}`}{r.estCost !== null ? ` · ${money(r.estCost)}` : ''}{!r.known && ` · no está en tus ${labels.insumos.toLowerCase()}`}</span>
                  </div>
                  <button type="button" className={`${s.addMini} ${s.press}`} aria-label={`Agregar ${r.name}`} onClick={() => addItems([suggestionToItem(r, newId(), cats)])}>
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pendientes, por pasillo */}
      {items.length === 0 ? (
        <div className={s.empty}>
          <p><strong>Todavía no hay nada para comprar.</strong></p>
          <p>Escribí arriba lo que necesitás, por ejemplo <em>{labels.shopEx || 'Harina 5 kg $6500'}</em>, y apretá Enter.</p>
        </div>
      ) : showing.length === 0 ? (
        <div className={s.allDone}><span className={s.allDoneIcon} aria-hidden="true">✓</span>¡Compraste todo!</div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className={s.group} data-ci={g.ci}>
            {!singleGroup && (
              <div className={s.groupHead}>
                <span className={s.dot} aria-hidden="true" />
                <span>{g.label}</span>
                <span className={`${s.groupMeta} ${s.num}`}>{sumCost(g.items) > 0 ? money(sumCost(g.items)) : ''}</span>
              </div>
            )}
            <ul className={s.list}>
              {g.items.map((i) => <ShoppingRow key={i.id} cats={cats} item={i} settling={settling.has(i.id)} open={openId === i.id} {...rowProps} />)}
            </ul>
          </div>
        ))
      )}

      {/* Comprados, plegados */}
      {boughtAll.length > 0 && (
        <div className={s.boughtBlock}>
          <div className={s.boughtHead}>
            <button type="button" className={s.sectionToggle} aria-expanded={boughtOpen} onClick={() => setBoughtOpen((v) => !v)}>
              <svg className={s.chev} viewBox="0 0 20 20" aria-hidden="true"><path d="M7 8l3 3 3-3" /></svg>
              Comprados <span className={`${s.count} ${s.num}`}>{boughtAll.length}</span>
            </button>
            <div className={`${s.clearWrap} no-print`}>
              {confirmClear ? (
                <>
                  <span className={s.confirmText}>¿Borrar {boughtAll.length}?</span>
                  <button type="button" className={`${s.textBtn} ${s.textBtnDanger} ${s.press}`} onClick={() => { setConfirmClear(false); removeItems(boughtAll, `Se borraron ${boughtAll.length} comprados`); }}>Sí, borrar</button>
                  <button type="button" className={`${s.textBtn} ${s.press}`} onClick={() => setConfirmClear(false)}>No</button>
                </>
              ) : (
                <button type="button" className={`${s.textBtn} ${s.press}`} onClick={() => setConfirmClear(true)}>Limpiar</button>
              )}
            </div>
          </div>
          {boughtOpen && (
            <ul className={`${s.list} ${s.boughtList}`}>
              {boughtAll.map((i) => <ShoppingRow key={i.id} cats={cats} item={i} settling={false} open={openId === i.id} {...rowProps} />)}
            </ul>
          )}
        </div>
      )}

      {toast && (
        <div key={toast.key} className={`toast ${s.toast}`} role="status">
          <span>{toast.msg}</span>
          {toast.action && (
            <button type="button" className={s.toastBtn} onClick={() => { toast.action.run(); setToast(null); }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
