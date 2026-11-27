import Link from 'next/link';
import { PRICES, ASSISTANT_LIMITS } from '@/lib/modules';
import { money } from '@/lib/format';

// Lo que ve quien todavía no tiene el módulo: qué hace y cómo activarlo (solo o sumado al plan).
export default function AssistantLocked() {
  return (
    <div className="card">
      <h2>Tu asistente que atiende las 24 h</h2>
      <p>Un chat en tu catálogo que contesta a tus clientes cuando vos no podés, con tus productos, precios y lugares libres reales.</p>
      <ul>
        <li>Responde precios, fechas con lugar, envíos, seña y condiciones al instante.</li>
        <li>Recomienda productos y manda al cliente directo a pedir.</li>
        <li>Si no sabe algo, te avisa; tu respuesta queda guardada y la próxima vez contesta solo.</li>
        <li>Si el cliente necesita una persona, te avisa y le pide su WhatsApp.</li>
      </ul>
      <p className="muted">Incluye {ASSISTANT_LIMITS.conversations} conversaciones por mes. Lo podés contratar solo, sin el resto de HakkiraApp, por {money(PRICES.asistente)} por mes, o sumarlo a tu plan.</p>
      <Link className="btn" href="/app/plan">Activar Asistente IA</Link>
    </div>
  );
}
