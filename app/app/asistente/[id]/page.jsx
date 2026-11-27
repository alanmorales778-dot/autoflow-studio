import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireBakery } from '@/lib/session';
import { Flash } from '../../ui';
import Submit from '../../marketing/submit';
import { ownerReply, setConversation, teachAnswer, deleteConversation } from '../actions';
import { STATUS } from '@/lib/assistant';
import { money, whenLabel } from '@/lib/format';
import ConfirmButton from '../../confirm-button';

function waLink(num) {
  const digits = String(num || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('54') ? digits : `549${digits.replace(/^0/, '')}`}`;
}

export default async function Conversacion({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  if (!access.assistant || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: conv } = await supabase.from('assistant_conversations').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!conv) notFound();
  const { data: msgs } = await supabase.from('assistant_messages').select('*').eq('conversation_id', id).order('created_at').limit(200);
  if (conv.unread_owner) await supabase.from('assistant_conversations').update({ unread_owner: false }).eq('id', id);
  const paused = conv.paused_until && new Date(conv.paused_until) > new Date();
  const wa = waLink(conv.customer_phone);
  const lastQuestion = [...(msgs || [])].reverse().find((m) => m.role === 'cliente')?.text || '';
  const here = `/app/asistente/${id}`;

  return (
    <>
      <Link href="/app/asistente" className="back-link">← Conversaciones</Link>
      <div className="page-head">
        <div>
          <h1>{conv.customer_name || (conv.channel === 'prueba' ? 'Tu prueba' : 'Cliente del catálogo')}</h1>
          <p>
            {paused ? <span className="badge">Atendés vos hasta {whenLabel(conv.paused_until)}</span> : <span className={`badge ${conv.status === 'necesita' ? 'warn' : conv.status === 'resuelta' ? 'ok' : ''}`}>{STATUS[conv.status]}</span>}
            {' '}Empezó {whenLabel(conv.created_at)}{conv.customer_phone ? <> · WhatsApp {conv.customer_phone}</> : ''}
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {wa && <a className="btn secondary" href={wa} target="_blank" rel="noreferrer">Escribirle por WhatsApp</a>}
          {paused || conv.status !== 'ia' ? (
            <form action={setConversation}><input type="hidden" name="conversation_id" value={id} /><input type="hidden" name="what" value="ia" /><button className="btn secondary">Devolverle la charla a la IA</button></form>
          ) : (
            <form action={setConversation}><input type="hidden" name="conversation_id" value={id} /><input type="hidden" name="what" value="pausar" /><button className="btn secondary">Tomar la charla</button></form>
          )}
          {conv.status !== 'resuelta' && <form action={setConversation}><input type="hidden" name="conversation_id" value={id} /><input type="hidden" name="what" value="resuelta" /><button className="btn">Marcar resuelta</button></form>}
        </div>
      </div>
      <Flash sp={sp} />

      <div className="card">
        <div className="asst-thread">
          {(msgs || []).map((m) => (
            <div key={m.id} className={`asst-msg ${m.role}`}>
              <span className="asst-meta">{m.role === 'cliente' ? 'Cliente' : m.role === 'dueno' ? 'Vos' : 'Asistente IA'} · {whenLabel(m.created_at)}</span>
              <p>{m.text}</p>
              {(m.meta?.products || []).length > 0 && (
                <span className="asst-meta">Le mostró: {m.meta.products.map((p) => `${p.name} (${money(p.price)})`).join(', ')}</span>
              )}
              {m.meta?.handoff && <span className="asst-meta" style={{ color: 'var(--warn)' }}>Pidió que respondas vos</span>}
              {m.meta?.price_blocked && <span className="asst-meta" style={{ color: 'var(--warn)' }}>Frené un precio que no coincidía con tu catálogo</span>}
              {m.meta?.unknown && !m.learned && (
                <details className="card" style={{ margin: '4px 0 0', background: 'var(--sunken)' }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>No lo sabía: enseñale la respuesta</summary>
                  <form action={teachAnswer} style={{ marginTop: 8 }}>
                    <input type="hidden" name="message_id" value={m.id} />
                    <input type="hidden" name="back" value={here} />
                    <div className="field"><label>Pregunta</label><input name="question" defaultValue={m.meta?.question || ''} maxLength={300} /></div>
                    <div className="field"><label>Tu respuesta</label><textarea name="answer" rows={2} maxLength={1000} required /></div>
                    <label className="inline-label" style={{ marginBottom: 8 }}><input type="checkbox" name="send" defaultChecked /> Mandársela al cliente</label>
                    <Submit pending="Guardando…" className="btn small">Guardar y enseñar</Submit>
                  </form>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {conv.channel === 'catalogo' && (
        <div className="card">
          <h2>Responder en el chat</h2>
          <p className="muted">El cliente lo ve en el chat del catálogo si lo tiene abierto o cuando vuelve a entrar. La IA queda en pausa en esta charla por 12 horas.{conv.customer_phone ? ' Si ya no está en el catálogo, mejor escribile por WhatsApp.' : ''}</p>
          <form action={ownerReply}>
            <input type="hidden" name="conversation_id" value={id} />
            <div className="field"><textarea name="text" rows={3} maxLength={1500} required placeholder="Escribí tu respuesta…" /></div>
            <details style={{ marginBottom: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 14 }}>Guardar esta respuesta para que la IA la use la próxima vez</summary>
              <label className="inline-label" style={{ margin: '8px 0' }}><input type="checkbox" name="save" /> Sí, guardarla</label>
              <div className="field"><label>¿A qué pregunta responde?</label><input name="question" defaultValue={lastQuestion.slice(0, 300)} maxLength={300} /></div>
            </details>
            <Submit pending="Enviando…">Enviar</Submit>
          </form>
        </div>
      )}

      <form action={deleteConversation} style={{ marginTop: 8 }}>
        <input type="hidden" name="conversation_id" value={id} />
        <ConfirmButton className="btn secondary small" message="¿Borrar esta conversación? No se puede deshacer.">Borrar conversación</ConfirmButton>
      </form>
    </>
  );
}
