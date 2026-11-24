import { requireAdmin, ROLES } from '@/lib/admin';
import Logo from '@/app/logo';
import AdminNav from './nav';
import { adminSignOut } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · HakkiraApp', robots: { index: false, follow: false } };

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
            <a href="/" target="_blank" rel="noreferrer">Ver la página pública</a>
            <form action={adminSignOut}><button className="btn secondary small">Salir</button></form>
          </div>
        </div>
      </header>
      <AdminNav badges={{ pilotos: newFeedback || 0, rendimiento: errors24 || 0 }} />
      <main className="adm-main fade-in">{children}</main>
    </>
  );
}
