import Link from 'next/link';
import { PRICES } from '@/lib/modules';
import { money } from '@/lib/format';

// Lo que ve quien todavía no tiene el módulo: qué hace y cómo activarlo (solo o sumado al plan).
export default function MarketingLocked() {
  return (
    <div className="card">
      <h2>Tu agente de marketing</h2>
      <p>Crea tus publicaciones, guiones de reels y kits de venta con los datos reales de tu negocio. Vos aprobás todo antes de publicar.</p>
      <ul>
        <li>Plan de la semana con 5 publicaciones listas para aprobar.</li>
        <li>Guiones de reels con 3 ganchos para los primeros segundos.</li>
        <li>«Vendé este producto»: speech, mensajes de WhatsApp, respuestas a objeciones y campaña de 9 días.</li>
      </ul>
      <p className="muted">Lo podés contratar solo, sin el resto de HakkiraApp, por {money(PRICES.marketing)} por mes, o sumarlo a tu plan.</p>
      <Link className="btn" href="/app/plan">Activar Marketing IA</Link>
    </div>
  );
}
