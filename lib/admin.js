// Panel de administración de HakkiraApp: quién entra, con qué permisos, y registro de todo lo que se hace.
// El acceso se decide en el servidor contra la tabla platform_admins (solo legible con la service role).
// Si alguien sin permiso abre /admin ve un 404: no se revela que el panel existe.
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createAdmin, createClient } from './supabase';
import { appUrl } from './env';

export const ROLES = {
  owner: { label: 'Dueño', desc: 'Todo, incluido sumar o sacar gente del equipo.' },
  admin: { label: 'Administrador', desc: 'Usuarios, planes, suspensiones, pilotos y cuentas de prueba.' },
  soporte: { label: 'Soporte', desc: 'Ver todo, extender pruebas, generar links de acceso y responder comentarios.' },
  lectura: { label: 'Solo lectura', desc: 'Ver métricas, usuarios y rendimiento, sin cambiar nada.' },
};

// Permisos por acción
const PERMS = {
  view: ['owner', 'admin', 'soporte', 'lectura'],
  support: ['owner', 'admin', 'soporte'],
  manage: ['owner', 'admin'],
  team: ['owner'],
};

export function can(role, perm) {
  return !!role && (PERMS[perm] || []).includes(role);
}

export const getAdminRole = cache(async (userId) => {
  if (!userId) return null;
  try {
    const { data } = await createAdmin().from('platform_admins').select('role').eq('user_id', userId).maybeSingle();
    return data?.role || null;
  } catch {
    return null;
  }
});

// Para páginas y acciones del panel. Sin sesión → login; sin rol → 404.
export async function requireAdmin(perm = 'view') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const role = await getAdminRole(user.id);
  if (!role) notFound();
  if (!can(role, perm)) throw new Error('Tu perfil no tiene permiso para hacer esto.');
  return { user, role, admin: createAdmin(), can: (p) => can(role, p) };
}

export async function audit(ctx, action, target, details = {}) {
  try {
    await ctx.admin.from('admin_audit').insert({ admin_id: ctx.user.id, admin_email: ctx.user.email, action, target: target ? String(target) : null, details });
  } catch (e) {
    console.error('[admin_audit]', e.message);
  }
}

// Link de acceso de un solo uso (invitación, nueva contraseña o entrada directa a una cuenta de prueba).
// No depende de las plantillas de mail de Supabase: el link lo comparte el equipo por WhatsApp o mail.
export async function accessLink(admin, type, email, { data, next } = {}) {
  const options = data ? { data } : undefined;
  const { data: res, error } = await admin.auth.admin.generateLink({ type, email, ...(options ? { options } : {}) });
  if (error) throw error;
  const token = res?.properties?.hashed_token;
  if (!token) throw new Error('Supabase no devolvió el token del link.');
  const p = new URLSearchParams({ token_hash: token, type, next: next || '/app' });
  return { url: `${appUrl()}/auth/callback?${p.toString()}`, userId: res?.user?.id || null };
}

export function pilotUrl(code) {
  return `${appUrl()}/piloto/${encodeURIComponent(code)}`;
}

export function randomCode(prefix = 'PILOTO') {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += abc[b % abc.length];
  return `${prefix}-${s}`;
}

// Estado de cuenta legible para tablas y filtros
export function accountState(r, now = Date.now()) {
  if (!r.bakery_id) return { key: 'sin_negocio', label: 'Sin negocio', cls: '' };
  if (r.suspended_at) return { key: 'suspendido', label: 'Suspendido', cls: 'bad' };
  if (r.sub_status === 'active') return { key: 'activo', label: 'Pagando', cls: 'ok' };
  if (r.sub_status === 'trial' && r.trial_ends_at && new Date(r.trial_ends_at).getTime() > now) return { key: 'prueba', label: 'En prueba', cls: 'warn' };
  if (r.sub_status === 'trial') return { key: 'vencido', label: 'Prueba vencida', cls: 'bad' };
  if (r.sub_status === 'paused') return { key: 'pausado', label: 'Pausado', cls: 'bad' };
  if (r.sub_status === 'cancelled') return { key: 'cancelado', label: 'Cancelado', cls: 'bad' };
  return { key: r.sub_status || 'sin_plan', label: r.sub_status || 'Sin plan', cls: '' };
}

export function daysLeft(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function ago(iso) {
  if (!iso) return '—';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 60) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export function bytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export async function overview(admin) {
  const { data, error } = await admin.rpc('admin_user_overview');
  if (error) throw error;
  return data || [];
}

// Escenarios del plan de pruebas (sirven para pilotos y para probar cada versión antes de vender)
export const QA_SCENARIOS = [
  ['registro', 'Alta', 'Crear cuenta, confirmar el mail y crear el negocio con su rubro'],
  ['catalogo', 'Catálogo', 'Cargar 2 productos con foto y precio; verlos en el link del cliente'],
  ['pedido_link', 'Pedido por link', 'Hacer un pedido desde el link del cliente en el celular'],
  ['cupo', 'Cupo', 'Completar el cupo de un horario y verificar que el link ya no lo ofrece'],
  ['sena', 'Seña', 'Pedido con seña: link de pago, vencimiento y confirmación'],
  ['agenda', 'Agenda', 'Ver el pedido en Hoy, marcar Recordar y Entregado'],
  ['compras', 'Compras', 'Lista de compras generada desde los pedidos de la semana'],
  ['costos', 'Costos', 'Cambiar el precio de un insumo y ver la ganancia y el precio sugerido'],
  ['avisos', 'Avisos', 'Activar la campanita y recibir el aviso de un pedido nuevo en el celular'],
  ['instalar', 'App instalable', 'Instalar la app en el celular (Android o iPhone)'],
  ['descargas', 'Descargas', 'Descargar pedidos y ganancias en Excel'],
  ['plan', 'Plan', 'Ver la pantalla de Plan y los días de prueba que quedan'],
];
