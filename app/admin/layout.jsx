import Link from 'next/link';
import { requireAdmin, ROLES } from '@/lib/admin';
import Logo from '../logo';
import AdminNav from './nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · AutoFlow', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }) {
  const { user, role, admin } = await requireAdmin('view');
  const { count: newFeedback } = await admin.from('pilot_feedback').select('id', { count: 'exact', head: true }).eq('status', 'nuevo');
  const { count: errors24 } = await admin.from('app_errors').select('id', { count: 'exact', head: true }).gte('at', new Date(Date.now() - 86400000).toISOString());

  return (
    <>
      <header className="adm-top">
        <div className="adm-top-in">
          <Logo href="/admin" />
          <span className="tag">Admin</span>
          <div className="end">
            <span className="hide-mobile">{user.email} · {ROLES[role]?.label}</span>
            <Link href="/app">Ir a la app</Link>
            <a href="/" target="_blank" rel="noreferrer">Ver la página</a>
          </div>
        </div>
      </header>
      <AdminNav badges={{ pilotos: newFeedback || 0, rendimiento: errors24 || 0 }} />
      <main className="adm-main fade-in">{children}</main>
    </>
  );
}
