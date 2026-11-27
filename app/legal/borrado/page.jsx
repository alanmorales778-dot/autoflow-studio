import Link from 'next/link';
import Logo from '../../logo';
import { createAdmin } from '@/lib/supabase';

export const metadata = { title: 'Borrado de datos — HakkiraApp' };
export const dynamic = 'force-dynamic';

const CONTACT = 'alan.morales778@gmail.com';

// Instrucciones de borrado de datos (las pide Meta para conectar Instagram y Facebook) y estado de un pedido por código.
export default async function Borrado({ searchParams }) {
  const sp = await searchParams;
  const code = /^[a-f0-9]{16}$/.test(String(sp?.codigo || '')) ? sp.codigo : null;
  let req = null;
  if (code) {
    try {
      const { data } = await createAdmin().from('data_deletion_requests').select('code,status,created_at').eq('code', code).maybeSingle();
      req = data;
    } catch {}
  }

  return (
    <>
      <header className="topbar">
        <div className="container"><Logo /><Link href="/" className="btn secondary small">Volver al inicio</Link></div>
      </header>
      <main className="container page" style={{ maxWidth: 760 }}>
        <h1>Borrado de datos</h1>
        {code && (
          <div className={`alert ${req ? 'ok' : 'warn'}`}>
            {req ? <>Pedido <strong>{req.code}</strong>: los datos de tu cuenta de Instagram o Facebook ya se borraron de HakkiraApp.</> : 'No encontramos un pedido con ese código. Escribinos y lo revisamos.'}
          </div>
        )}
        <h2>Si conectaste Instagram o Facebook</h2>
        <p>Podés borrar en cualquier momento los datos que HakkiraApp guarda de tu cuenta de Instagram o Facebook (el identificador de la cuenta, el nombre de usuario y el permiso para publicar):</p>
        <ol>
          <li><strong>Desde HakkiraApp:</strong> entrá a Marketing IA → Redes y tocá «Desconectar». Se borra al instante.</li>
          <li><strong>Desde Instagram:</strong> Configuración → Apps y sitios web → HakkiraApp → Quitar. Meta nos avisa y borramos los datos automáticamente.</li>
          <li><strong>Desde Facebook:</strong> Configuración → Apps y sitios web → HakkiraApp → Quitar → marcá «Eliminar publicaciones, videos o eventos» si querés, y confirmá. Meta nos avisa y borramos los datos.</li>
        </ol>
        <p>Las publicaciones que ya se subieron a tu cuenta quedan en Instagram o Facebook: se borran desde esas apps.</p>
        <h2>Borrar toda tu cuenta de HakkiraApp</h2>
        <p>Escribinos a <a href={`mailto:${CONTACT}`}>{CONTACT}</a> desde el mail de tu cuenta. Borramos tus datos dentro de los 30 días, salvo lo que la ley nos obligue a guardar (por ejemplo, comprobantes de pago). Más detalles en <Link href="/legal">Términos y privacidad</Link>.</p>
      </main>
    </>
  );
}
