import Link from 'next/link';
import { requireAdmin, overview, ago, QA_SCENARIOS } from '@/lib/admin';
import { RUBROS, RUBRO_KEYS } from '@/lib/rubros';
import { Flash } from '@/app/app/ui';
import ConfirmButton from '@/app/app/confirm-button';
import LinkForm from '@/app/admin/link-form';
import { createTestAccount, makeAccessLink, saveQa, resetTestData, deleteTestAccount } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const RESULTS = [['ok', 'Anda'], ['falla', 'Falla'], ['pendiente', 'Pendiente']];

export default async function Pruebas({ searchParams }) {
  const sp = await searchParams;
  const { admin, can } = await requireAdmin('view');
  const rows = await overview(admin);
  // Se prueban las cuentas de prueba y también los pilotos (el plan sirve para acompañarlos)
  const accounts = rows.filter((r) => r.bakery_id && (r.is_test || r.pilot_status));
  const tests = accounts.filter((r) => r.is_test);
  const current = accounts.find((r) => r.bakery_id === sp.cuenta) || tests[0] || accounts[0] || null;
  const { data: results } = current ? await admin.from('qa_results').select('*').eq('bakery_id', current.bakery_id) : { data: [] };
  const res = new Map((results || []).map((x) => [x.scenario, x]));
  const done = QA_SCENARIOS.filter(([k]) => res.get(k)?.result === 'ok').length;
  const fails = QA_SCENARIOS.filter(([k]) => res.get(k)?.result === 'falla').length;
  const here = current ? `/admin/pruebas?cuenta=${current.bakery_id}#plan` : '/admin/pruebas';

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Pruebas</h1>
          <p>Cuentas de prueba con datos de ejemplo para probar la app como un cliente, y un plan de pruebas para cada versión y cada piloto.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Nueva cuenta de prueba</h2>
          <p className="muted" style={{ fontSize: 13 }}>Se crea sin mandar mails, marcada como prueba (no suma en las métricas), con productos, insumos y pedidos de ejemplo del rubro. Para usarla tocá «Entrar» y abrí el link en una ventana de incógnito.</p>
          {can('manage') ? (
            <form action={createTestAccount}>
              <div className="row" style={{ gap: 8 }}>
                <select name="business_type" defaultValue="cocina" style={{ maxWidth: 220 }}>
                  {RUBRO_KEYS.map((k) => <option key={k} value={k}>{RUBROS[k].label}</option>)}
                </select>
                <input name="name" placeholder="Nombre (opcional)" style={{ maxWidth: 220 }} />
              </div>
              <label className="inline-label" style={{ margin: '10px 0', fontSize: 14 }}><input type="checkbox" name="seed" defaultChecked /> Cargar productos y pedidos de ejemplo</label>
              <button className="btn">Crear cuenta de prueba</button>
            </form>
          ) : <p className="muted">Tu perfil no puede crear cuentas.</p>}
        </div>

        <div className="card">
          <h2>Cuentas para probar</h2>
          {!accounts.length && <p className="muted">Todavía no hay cuentas de prueba ni pilotos.</p>}
          {accounts.map((a) => (
            <div key={a.bakery_id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span>
                <Link href={`/admin/pruebas?cuenta=${a.bakery_id}#plan`}><strong>{a.bakery_name}</strong></Link>
                {current?.bakery_id === a.bakery_id && <span className="badge" style={{ marginLeft: 6 }}>abierta</span>}
                <br /><small className="muted">{RUBROS[a.business_type]?.short} · {a.is_test ? 'prueba' : 'piloto'} · {a.orders_total} pedidos · creada {ago(a.bakery_created_at)}</small>
              </span>
              <a className="btn secondary small" href={`/c/${a.slug}`} target="_blank" rel="noreferrer">Ver link del cliente</a>
            </div>
          ))}
        </div>
      </div>

      {current && (
        <div className="card" id="plan">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0 }}>Plan de pruebas · {current.bakery_name}</h2>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{done} de {QA_SCENARIOS.length} andan{fails ? ` · ${fails} con fallas` : ''}. Marcá cada escenario después de probarlo en el celular.</p>
            </div>
            <Link href={`/admin/usuarios/${current.user_id}`} className="btn secondary small">Ficha de la cuenta</Link>
          </div>
          <div className="adm-progress" style={{ margin: '12px 0' }} aria-hidden="true">
            <i style={{ width: `${(100 * done) / QA_SCENARIOS.length}%`, background: 'var(--ok)' }} />
            <i style={{ width: `${(100 * fails) / QA_SCENARIOS.length}%`, background: 'var(--bad)' }} />
          </div>

          {current.is_test && can('manage') && (
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <LinkForm action={makeAccessLink} hidden={{ kind: 'magiclink', email: current.email }} label="Entrar a esta cuenta" className="btn dark small" />
              <form action={resetTestData} className="adm-inline">
                <input type="hidden" name="bakery_id" value={current.bakery_id} />
                <input type="hidden" name="back" value={here} />
                <input type="hidden" name="seed" value="on" />
                <ConfirmButton className="btn secondary small" message="Se borran pedidos, clientes, avisos, compras y el plan de pruebas de esta cuenta, y se vuelven a cargar los de ejemplo. ¿Seguir?">Reiniciar con datos de ejemplo</ConfirmButton>
              </form>
              <form action={deleteTestAccount}>
                <input type="hidden" name="bakery_id" value={current.bakery_id} />
                <input type="hidden" name="back" value={here} />
                <ConfirmButton className="btn danger small" message="Se borra la cuenta de prueba y todo su contenido. ¿Borrar?">Borrar</ConfirmButton>
              </form>
            </div>
          )}

          {QA_SCENARIOS.map(([key, title, desc]) => {
            const r = res.get(key);
            return (
              <div key={key} className="adm-qa">
                <div>
                  <div className="t">{title}</div>
                  <div className="d">{desc}</div>
                  {r && <div className="d" style={{ fontSize: 12 }}>{r.note ? `«${r.note}» · ` : ''}{r.tested_by} · {ago(r.at)}</div>}
                </div>
                {can('support') ? (
                  <form action={saveQa} className="adm-inline">
                    <input type="hidden" name="bakery_id" value={current.bakery_id} />
                    <input type="hidden" name="scenario" value={key} />
                    <input type="hidden" name="back" value={here} />
                    <input name="note" placeholder="Nota" defaultValue={r?.note || ''} style={{ width: 140 }} />
                    <span className="btns">
                      {RESULTS.map(([v, l]) => (
                        <button key={v} name="result" value={v} className={r?.result === v ? `on-${v}` : ''}>{l}</button>
                      ))}
                    </span>
                  </form>
                ) : <span className={`badge ${r?.result === 'ok' ? 'ok' : r?.result === 'falla' ? 'bad' : ''}`}>{r?.result || '—'}</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
