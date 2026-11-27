import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { hasAI } from '@/lib/ai';
import { Flash } from '../ui';
import AssistantLocked from './locked';
import Submit from '../marketing/submit';
import { teachAnswer, dismissUnknown, toggleEnabled } from './actions';
import { loadSettings, monthUsage, STATUS } from '@/lib/assistant';
import { whenLabel } from '@/lib/format';

const FILTERS = { necesita: 'Te necesitan', todas: 'Todas', resuelta: 'Resueltas', prueba: 'Pruebas' };

export default async function Asistente({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.assistant) {
    return (
      <>
        <div className="page-head"><div><h1>Asistente IA</h1><p>Atiende tu catálogo cuando vos no podés.</p></div></div>
        <Flash sp={sp} />
        <AssistantLocked />
      </>
    );
  }

  const ver = FILTERS[sp.ver] ? sp.ver : 'todas';
  let q = supabase.from('assistant_conversations').select('id,status,channel,customer_name,customer_phone,unread_owner,last_message_at,messages_count,paused_until')
    .eq('bakery_id', bakery.id).order('last_message_at', { ascending: false }).limit(60);
  if (ver === 'prueba') q = q.eq('channel', 'prueba');
  else q = q.eq('channel', 'catalogo');
  if (ver === 'necesita' || ver === 'resuelta') q = q.eq('status', ver);

  const [settings, usage, { data: convs }, { count: needCount }, { data: unknown }, { count: knowCount }, { count: aiCount }] = await Promise.all([
    loadSettings(supabase, bakery.id),
    monthUsage(supabase, bakery.id, access),
    q,
    supabase.from('assistant_conversations').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).eq('channel', 'catalogo').eq('status', 'necesita'),
    supabase.from('assistant_messages').select('id,conversation_id,meta,created_at').eq('bakery_id', bakery.id).eq('role', 'ia').eq('learned', false).eq('meta->>unknown', 'true').order('created_at', { ascending: false }).limit(10),
    supabase.from('assistant_knowledge').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id),
    supabase.from('assistant_messages').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).eq('role', 'ia').gte('created_at', `${new Date().toISOString().slice(0, 7)}-01`),
  ]);

  // Último mensaje de cada charla para mostrar en la lista.
  const ids = (convs || []).map((c) => c.id);
  const { data: lastMsgs } = ids.length
    ? await supabase.from('assistant_messages').select('conversation_id,role,text,created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(300)
    : { data: [] };
  const lastOf = new Map();
  for (const m of lastMsgs || []) if (!lastOf.has(m.conversation_id)) lastOf.set(m.conversation_id, m);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Asistente IA</h1>
          <p>Atiende tu catálogo las 24 h con tus productos, precios y lugares reales. Lo que no sabe, te lo pregunta.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn secondary" href={`/c/${bakery.slug}`} target="_blank" rel="noreferrer">Verlo en mi catálogo ↗</a>
          <Link className="btn" href="/app/asistente/entrenar">Entrenar y probar</Link>
        </div>
      </div>
      <Flash sp={sp} />

      {!hasAI() && <div className="alert warn">La IA todavía no está configurada en el servidor: el asistente no puede responder.</div>}
      {!settings.enabled ? (
        <div className="alert warn row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>El asistente está <strong>apagado</strong>: tu catálogo muestra solo el botón de WhatsApp.</span>
          <form action={toggleEnabled}><input type="hidden" name="enabled" value="1" /><button className="btn small">Prenderlo</button></form>
        </div>
      ) : (!knowCount && !sp.ok) ? (
        <div className="alert info"><strong>Primer paso:</strong> ya conoce tus productos, precios y condiciones. Enseñale lo que te preguntan siempre (envíos, sin TACC, formas de pago…). <Link href="/app/asistente/entrenar#sabe">Enseñarle →</Link></div>
      ) : null}
      {access.assistantOnly && <div className="alert info">Tu catálogo muestra tus productos y el asistente, pero no toma pedidos online: el asistente manda a los clientes a tu WhatsApp. Con la Base, además reservan y pagan la seña solos. <Link href="/app/plan">Ver planes →</Link></div>}

      <div className="kpis">
        <div className="card kpi"><span className="l">Conversaciones este mes</span><span className="v">{usage.used} <small style={{ display: 'inline' }}>de {usage.limit}</small></span></div>
        <div className="card kpi"><span className="l">Te necesitan</span><span className="v">{needCount || 0}</span></div>
        <div className="card kpi"><span className="l">Preguntas para enseñarle</span><span className="v">{(unknown || []).length}</span></div>
        <div className="card kpi"><span className="l">Respuestas de la IA este mes</span><span className="v">{aiCount || 0}</span></div>
      </div>

      {(unknown || []).length > 0 && (
        <div className="card" id="aprender">
          <h2>No supo responder esto</h2>
          <p className="muted">Contestá una vez y lo aprende para siempre. Si querés, también le llega la respuesta al cliente en el chat.</p>
          <div className="stack">
            {unknown.map((m) => (
              <details key={m.id} className="card" style={{ margin: 0, background: 'var(--sunken)' }}>
                <summary style={{ cursor: 'pointer' }}><strong>«{m.meta?.question || 'Pregunta del cliente'}»</strong> <span className="muted" style={{ fontSize: 13 }}>· {whenLabel(m.created_at)}</span></summary>
                <form action={teachAnswer} style={{ marginTop: 10 }}>
                  <input type="hidden" name="message_id" value={m.id} />
                  <input type="hidden" name="back" value="/app/asistente#aprender" />
                  <div className="field"><label>Pregunta</label><input name="question" defaultValue={m.meta?.question || ''} maxLength={300} /></div>
                  <div className="field"><label>Tu respuesta</label><textarea name="answer" rows={3} maxLength={1000} required placeholder="Ej: Sí, hacemos envíos a Quilmes por $ 3.000." /></div>
                  <label className="inline-label" style={{ marginBottom: 10 }}><input type="checkbox" name="send" defaultChecked /> Mandarle esta respuesta al cliente en el chat</label>
                  <div className="row" style={{ gap: 8 }}>
                    <Submit pending="Guardando…">Guardar y enseñar</Submit>
                    <Link className="btn secondary" href={`/app/asistente/${m.conversation_id}`}>Ver la charla</Link>
                  </div>
                </form>
                <form action={dismissUnknown} style={{ marginTop: 8 }}>
                  <input type="hidden" name="message_id" value={m.id} />
                  <input type="hidden" name="back" value="/app/asistente#aprender" />
                  <button className="btn secondary small">No hace falta</button>
                </form>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className="filters" role="navigation" aria-label="Filtrar">
        {Object.entries(FILTERS).map(([k, label]) => (
          <Link key={k} href={`/app/asistente?ver=${k}`} className={`chip ${ver === k ? 'on' : ''}`}>{label}{k === 'necesita' && needCount ? ` (${needCount})` : ''}</Link>
        ))}
      </div>

      <div className="card">
        {(convs || []).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {ver === 'necesita' ? 'Nadie te está esperando.' : ver === 'prueba' ? 'Todavía no probaste tu asistente.' : 'Todavía no hay conversaciones. Compartí el link de tu catálogo: el chat aparece abajo a la derecha.'}
            {' '}{ver !== 'necesita' && <Link href="/app/asistente/entrenar#probar">Probalo vos →</Link>}
          </p>
        ) : (
          <div>
            {convs.map((c) => {
              const last = lastOf.get(c.id);
              const paused = c.paused_until && new Date(c.paused_until) > new Date();
              return (
                <Link key={c.id} href={`/app/asistente/${c.id}`} className="asst-row">
                  {c.unread_owner ? <span className="asst-unread" aria-label="Sin leer" /> : <span style={{ width: 8 }} />}
                  <span className="mid">
                    <span className="who">{c.customer_name || (c.channel === 'prueba' ? 'Tu prueba' : 'Cliente del catálogo')}{c.customer_phone ? ` · ${c.customer_phone}` : ''}</span>
                    <span className="snip">{last ? `${last.role === 'cliente' ? '' : last.role === 'dueno' ? 'Vos: ' : 'IA: '}${last.text}` : '—'}</span>
                  </span>
                  {paused ? <span className="badge">Atendés vos</span> : <span className={`badge ${c.status === 'necesita' ? 'warn' : c.status === 'resuelta' ? 'ok' : ''}`}>{STATUS[c.status]}</span>}
                  <span className="when">{whenLabel(c.last_message_at)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
