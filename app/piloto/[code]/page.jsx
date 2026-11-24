import Link from 'next/link';
import { createAdmin } from '@/lib/supabase';
import { RUBROS } from '@/lib/rubros';
import { AuthShell } from '../../auth-shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invitación piloto · HakkiraApp', robots: { index: false, follow: false } };

const ASK = [
  'Usarlo con pedidos o turnos reales durante la prueba.',
  'Contarnos qué te sirve y qué no con el botón «Comentar» dentro de la app.',
  'Una charla corta de 15 minutos al final para ver si te sirve.',
];

export default async function Piloto({ params }) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  let inv = null;
  try {
    const { data } = await createAdmin().from('pilot_invites').select('code,label,business_type,trial_days,max_uses,uses,expires_at,active').eq('code', code).maybeSingle();
    inv = data;
  } catch {}
  const problem = !inv ? 'Este link de invitación no existe. Revisá que esté completo.'
    : !inv.active ? 'Esta invitación está pausada. Escribinos y te pasamos una nueva.'
    : inv.expires_at && new Date(inv.expires_at) < new Date() ? 'Esta invitación ya venció. Escribinos y te pasamos una nueva.'
    : inv.uses >= inv.max_uses ? 'Esta invitación ya se usó. Si sos vos, ingresá con tu cuenta.'
    : null;
  const rubro = inv?.business_type ? RUBROS[inv.business_type] : null;
  const qs = new URLSearchParams({ piloto: code, ...(rubro ? { rubro: rubro.key } : {}) }).toString();

  return (
    <AuthShell>
      {problem ? (
        <div className="fade-in">
          <h1 className="disp">Invitación no disponible</h1>
          <p style={{ color: 'var(--ink-2)' }}>{problem}</p>
          <div className="row" style={{ marginTop: 16 }}>
            <Link href="/registro" className="btn">Probar 14 días gratis</Link>
            <Link href="/login" className="btn secondary">Ingresar</Link>
          </div>
        </div>
      ) : (
        <div className="fade-in">
          <span className="badge warn" style={{ marginBottom: 12 }}>Programa piloto</span>
          <h1 className="disp">Te invitamos a probar HakkiraApp {inv.trial_days} días gratis</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 16 }}>
            Sos parte de los primeros negocios{rubro ? ` de ${rubro.label.toLowerCase()}` : ''} que lo usan. Tenés todos los módulos incluidos, sin tarjeta y sin comisión por venta.
          </p>
          <div className="card" style={{ margin: '16px 0' }}>
            <strong>Lo único que te pedimos</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--ink-2)' }}>
              {ASK.map((a) => <li key={a} style={{ marginBottom: 4 }}>{a}</li>)}
            </ul>
          </div>
          <Link href={`/registro?${qs}`} className="btn block large">Crear mi cuenta piloto</Link>
          <p className="muted" style={{ marginTop: 12, fontSize: 13, textAlign: 'center' }}>¿Ya tenés cuenta? <Link href="/login">Ingresá</Link> y escribinos para sumarte al piloto.</p>
          <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Código <span className="mono">{inv.code}</span></p>
        </div>
      )}
    </AuthShell>
  );
}
