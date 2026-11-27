import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { Flash } from '../../ui';
import Submit from '../../marketing/submit';
import AssistantLocked from '../locked';
import AssistantChat from '@/app/c/[slug]/assistant-chat';
import { saveSettings, addKnowledge, updateKnowledge, deleteKnowledge } from '../actions';
import { loadSettings, defaultGreeting, starterSuggestions } from '@/lib/assistant';
import { rubroOf } from '@/lib/rubros';
import { money } from '@/lib/format';

export const maxDuration = 60;

const SOURCE = { manual: 'Cargada por vos', aprendida: 'Aprendida de una charla', nota: 'Nota' };

export default async function Entrenar({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.assistant) {
    return (
      <>
        <div className="page-head"><div><h1>Entrenar al asistente</h1></div></div>
        <AssistantLocked />
      </>
    );
  }
  const t = rubroOf(bakery);
  const [settings, { data: knowledge }, { count: productCount }] = await Promise.all([
    loadSettings(supabase, bakery.id),
    supabase.from('assistant_knowledge').select('*').eq('bakery_id', bakery.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).eq('visible', true).not('sheet_row', 'is', null),
  ]);
  const name = settings.name || 'Asistente';
  const waDigits = String(bakery.whatsapp_contact || '').replace(/\D/g, '');
  const wa = waDigits ? `https://wa.me/${waDigits.startsWith('54') ? waDigits : `549${waDigits.replace(/^0/, '')}`}` : null;
  const notes = (knowledge || []).filter((k) => !k.question);
  const faqs = (knowledge || []).filter((k) => k.question);

  // Lo que ya sabe sin que le enseñes nada (sale de tus productos y Ajustes).
  const auto = [
    [`${productCount || 0} ${t.items.toLowerCase()} visibles con precio, descripción, opciones y stock`, '/app/productos'],
    [bakery.pickup_address ? `Dirección: ${bakery.pickup_address}` : 'Sin dirección cargada', '/app/configuracion#negocio'],
    [bakery.delivery_enabled ? `${t.envio}${Number(bakery.delivery_fee) > 0 ? `: ${money(bakery.delivery_fee)}` : ''}` : `Sin ${t.envio.toLowerCase()}`, '/app/configuracion'],
    [`Anticipación: ${bakery.min_days_ahead ?? 1} día(s) · hasta ${bakery.max_days_ahead ?? 21} días adelante · días y horarios con lugar`, '/app/configuracion'],
    [bakery.deposit_percent > 0 ? `Seña del ${bakery.deposit_percent} %` : 'Sin seña', '/app/configuracion'],
    [bakery.policy_text ? 'Tus condiciones para el cliente' : 'Sin condiciones cargadas', '/app/configuracion'],
  ];

  return (
    <>
      <Link href="/app/asistente" className="back-link">← Asistente IA</Link>
      <div className="page-head">
        <div>
          <h1>Entrenar y probar</h1>
          <p>Enseñale lo que te preguntan siempre y probalo como si fueras un cliente.</p>
        </div>
      </div>
      <Flash sp={sp} />

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card" id="sabe">
            <h2>Lo que ya sabe solo</h2>
            <p className="muted">Lo lee de tu cuenta cada vez que responde. Si cambiás un precio, lo sabe al instante.</p>
            <ul className="checks">
              {auto.map(([label, href]) => <li key={label}>{label} <Link href={href} style={{ fontSize: 13 }}>Cambiar</Link></li>)}
            </ul>
          </div>

          <div className="card">
            <h2>Enseñale algo</h2>
            <p className="muted">Escribilo como se lo contarías a alguien que atiende por vos.</p>
            <form action={addKnowledge}>
              <div className="field"><textarea name="answer" rows={3} maxLength={1000} required placeholder="Ej: Los domingos no abrimos. Hacemos tortas sin TACC con 72 h de anticipación. Aceptamos transferencia y efectivo." /></div>
              <Submit pending="Guardando…">Guardar</Submit>
            </form>
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>O cargá una pregunta con su respuesta</summary>
              <form action={addKnowledge} style={{ marginTop: 10 }}>
                <div className="field"><label>Pregunta del cliente</label><input name="question" maxLength={300} required placeholder="¿Hacen envíos a Quilmes?" /></div>
                <div className="field"><label>Respuesta</label><textarea name="answer" rows={2} maxLength={1000} required placeholder="Sí, los sábados, por $ 3.000." /></div>
                <Submit pending="Guardando…">Guardar pregunta</Submit>
              </form>
            </details>
          </div>

          <div className="card">
            <h2>Lo que le enseñaste <small className="muted">{(knowledge || []).length}</small></h2>
            {!(knowledge || []).length ? <p className="muted" style={{ margin: 0 }}>Todavía nada. Cuando no sepa algo en una charla, te lo va a preguntar en la pantalla del asistente.</p> : (
              <div className="stack">
                {[...notes, ...faqs].map((k) => (
                  <details key={k.id} className="card" style={{ margin: 0, background: 'var(--sunken)' }}>
                    <summary style={{ cursor: 'pointer' }}>
                      {k.question ? <><strong>{k.question}</strong> → {k.answer.slice(0, 90)}{k.answer.length > 90 ? '…' : ''}</> : <>{k.answer.slice(0, 120)}{k.answer.length > 120 ? '…' : ''}</>}
                      {' '}<span className="badge">{SOURCE[k.source] || k.source}</span>
                    </summary>
                    <form action={updateKnowledge} style={{ marginTop: 10 }}>
                      <input type="hidden" name="id" value={k.id} />
                      {k.question !== null && <div className="field"><label>Pregunta</label><input name="question" defaultValue={k.question} maxLength={300} /></div>}
                      <div className="field"><label>{k.question ? 'Respuesta' : 'Nota'}</label><textarea name="answer" defaultValue={k.answer} rows={3} maxLength={1000} required /></div>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn small">Guardar cambios</button>
                      </div>
                    </form>
                    <form action={deleteKnowledge} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={k.id} />
                      <button className="btn secondary small">Borrar</button>
                    </form>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="card" id="ajustes">
            <h2>Cómo se presenta</h2>
            <form action={saveSettings}>
              <input type="hidden" name="back" value="/app/asistente/entrenar#ajustes" />
              <label className="inline-label" style={{ marginBottom: 12 }}><input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> <strong>Asistente prendido en mi catálogo</strong></label>
              <div className="field"><label>Nombre</label><input name="name" defaultValue={name} maxLength={40} /></div>
              <div className="field"><label>Saludo</label><textarea name="greeting" rows={2} maxLength={300} defaultValue={settings.greeting || ''} placeholder={defaultGreeting(bakery, name)} /></div>
              <div className="field"><label>Cómo habla</label><input name="tone" maxLength={300} defaultValue={settings.tone || ''} placeholder="Ej: cercano y alegre, con algún emoji; trata de vos" /></div>
              <div className="field"><label>Indicaciones extra</label><textarea name="instructions" rows={3} maxLength={1500} defaultValue={settings.instructions || ''} placeholder="Ej: Si preguntan por tortas para más de 30 personas, decí que se cotizan aparte y pedí que escriban por WhatsApp." /></div>
              <label className="inline-label" style={{ marginBottom: 12 }}><input type="checkbox" name="ask_contact" defaultChecked={settings.ask_contact} /> Cuando te necesita, pedirle al cliente su WhatsApp</label>
              <Submit pending="Guardando…">Guardar</Submit>
            </form>
          </div>
        </div>

        <div className="card" id="probar" style={{ position: 'sticky', top: 84 }}>
          <h2>Probalo</h2>
          <p className="muted">Escribile como si fueras un cliente. Usa lo mismo que en tu catálogo; las pruebas no cuentan para tu límite.</p>
          <AssistantChat
            slug={bakery.slug}
            botName={name}
            bizName={bakery.name}
            logoUrl={bakery.logo_url}
            greeting={settings.greeting || defaultGreeting(bakery, name)}
            starters={starterSuggestions(bakery)}
            wa={wa}
            test
            inline
          />
        </div>
      </div>
    </>
  );
}
