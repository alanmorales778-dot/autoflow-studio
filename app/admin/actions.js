'use server';

import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, audit, accessLink, randomCode, QA_SCENARIOS, ROLES } from '@/lib/admin';
import { seedTestBusiness } from '@/lib/admin-seed';
import { RUBROS, rubroOf } from '@/lib/rubros';
import { slugify } from '@/lib/format';
import { appUrl } from '@/lib/env';

const str = (fd, k) => String(fd.get(k) ?? '').trim();
const int = (fd, k, d) => {
  const n = parseInt(str(fd, k), 10);
  return Number.isFinite(n) ? n : d;
};

function back(path, { error, ok } = {}) {
  const p = new URLSearchParams();
  if (error) p.set('error', String(error).slice(0, 300));
  if (ok) p.set('ok', String(ok).slice(0, 300));
  const qs = p.toString();
  const [base, hash] = String(path || '/admin').split('#');
  redirect(qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}${hash ? `#${hash}` : ''}` : path);
}

// Volver a la pantalla desde donde se hizo la acción (solo rutas del panel)
function from(fd, fallback = '/admin') {
  const b = str(fd, 'back');
  return b.startsWith('/admin') ? b : fallback;
}

async function guard(perm, fd) {
  const ctx = await requireAdmin('view');
  if (!ctx.can(perm)) back(from(fd), { error: 'Tu perfil no tiene permiso para hacer esto.' });
  return ctx;
}

async function bakeryOf(ctx, id) {
  const { data } = await ctx.admin.from('bakeries').select('*').eq('id', id).maybeSingle();
  return data;
}

// ---------- Usuarios y planes ----------
export async function extendTrial(fd) {
  const ctx = await guard('support', fd);
  const id = str(fd, 'bakery_id');
  const days = Math.min(90, Math.max(1, int(fd, 'days', 7)));
  const { data: sub } = await ctx.admin.from('subscriptions').select('trial_ends_at,status').eq('bakery_id', id).maybeSingle();
  if (!sub) back(from(fd), { error: 'Ese negocio no tiene suscripción.' });
  const baseDate = Math.max(Date.now(), new Date(sub.trial_ends_at || Date.now()).getTime());
  const until = new Date(baseDate + days * 86400000).toISOString();
  const patch = { trial_ends_at: until, updated_at: new Date().toISOString() };
  if (sub.status !== 'active') patch.status = 'trial';
  const { error } = await ctx.admin.from('subscriptions').update(patch).eq('bakery_id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'extender_prueba', id, { days, until });
  revalidatePath('/admin', 'layout');
  back(from(fd), { ok: `Prueba extendida ${days} días.` });
}

export async function setPlan(fd) {
  const ctx = await guard('manage', fd);
  const id = str(fd, 'bakery_id');
  const status = str(fd, 'status');
  if (!['trial', 'active', 'paused', 'cancelled'].includes(status)) back(from(fd), { error: 'Estado inválido.' });
  const amount = str(fd, 'amount') ? Number(str(fd, 'amount').replace(/\./g, '').replace(',', '.')) : null;
  const patch = {
    status,
    has_costs: fd.get('has_costs') === 'on',
    has_whatsapp: fd.get('has_whatsapp') === 'on',
    has_recurring: fd.get('has_recurring') === 'on',
    amount: Number.isFinite(amount) ? amount : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await ctx.admin.from('subscriptions').update(patch).eq('bakery_id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'cambiar_plan', id, patch);
  revalidatePath('/admin', 'layout');
  back(from(fd), { ok: 'Plan actualizado.' });
}

export async function suspendBakery(fd) {
  const ctx = await guard('manage', fd);
  const id = str(fd, 'bakery_id');
  const reason = str(fd, 'reason').slice(0, 300) || null;
  const { error } = await ctx.admin.from('bakeries').update({ suspended_at: new Date().toISOString(), suspended_reason: reason }).eq('id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'suspender', id, { reason });
  revalidatePath('/admin', 'layout');
  back(from(fd), { ok: 'Negocio suspendido: su link ya no toma pedidos y el panel queda bloqueado.' });
}

export async function reactivateBakery(fd) {
  const ctx = await guard('manage', fd);
  const id = str(fd, 'bakery_id');
  const { error } = await ctx.admin.from('bakeries').update({ suspended_at: null, suspended_reason: null }).eq('id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'reactivar', id);
  revalidatePath('/admin', 'layout');
  back(from(fd), { ok: 'Negocio reactivado.' });
}

export async function toggleTestFlag(fd) {
  const ctx = await guard('manage', fd);
  const id = str(fd, 'bakery_id');
  const value = str(fd, 'value') === '1';
  const { error } = await ctx.admin.from('bakeries').update({ is_test: value }).eq('id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, value ? 'marcar_prueba' : 'desmarcar_prueba', id);
  revalidatePath('/admin', 'layout');
  back(from(fd), { ok: value ? 'Marcado como cuenta de prueba (no cuenta en las métricas).' : 'Ya no es cuenta de prueba.' });
}

export async function saveAdminNotes(fd) {
  const ctx = await guard('support', fd);
  const id = str(fd, 'bakery_id');
  const notes = str(fd, 'admin_notes').slice(0, 2000) || null;
  const { error } = await ctx.admin.from('bakeries').update({ admin_notes: notes }).eq('id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'notas', id);
  back(from(fd), { ok: 'Notas guardadas.' });
}

// Estas tres devuelven un link para mostrar en pantalla (se usan con useActionState).
export async function makeAccessLink(prev, fd) {
  try {
    const kind = str(fd, 'kind');
    const email = str(fd, 'email').toLowerCase();
    if (!email) return { error: 'Falta el email.' };
    const ctx = await requireAdmin('view');
    if (kind === 'recovery') {
      if (!ctx.can('support')) return { error: 'Tu perfil no tiene permiso.' };
      const { url } = await accessLink(ctx.admin, 'recovery', email, { next: '/nueva-clave' });
      await audit(ctx, 'link_nueva_clave', email);
      return { url, note: 'Link para que elija una contraseña nueva. Vale una sola vez y vence en 24 h.' };
    }
    if (kind === 'magiclink') {
      if (!ctx.can('manage')) return { error: 'Tu perfil no tiene permiso.' };
      const { data: row } = await ctx.admin.rpc('admin_user_overview');
      const r = (row || []).find((x) => x.email?.toLowerCase() === email);
      if (!r?.is_test) return { error: 'Solo se puede entrar directo a cuentas marcadas como prueba.' };
      const { url } = await accessLink(ctx.admin, 'magiclink', email, { next: '/app' });
      await audit(ctx, 'entrar_como_prueba', email);
      return { url, note: 'Abrilo en una ventana de incógnito: si lo abrís acá, se cierra tu sesión de admin.' };
    }
    return { error: 'Tipo de link inválido.' };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

export async function inviteUser(prev, fd) {
  try {
    const ctx = await requireAdmin('view');
    if (!ctx.can('manage')) return { error: 'Tu perfil no tiene permiso.' };
    const email = str(fd, 'email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Revisá el email.' };
    const business_type = rubroOf(str(fd, 'business_type')).key;
    const business_name = str(fd, 'business_name').slice(0, 80);
    const pilot_code = str(fd, 'pilot_code').toUpperCase() || undefined;
    const data = { business_type, ...(business_name ? { business_name } : {}), ...(pilot_code ? { pilot_code } : {}), invited_by: ctx.user.email };
    const { url } = await accessLink(ctx.admin, 'invite', email, { data, next: '/nueva-clave' });
    await audit(ctx, 'invitar_usuario', email, { business_type, pilot_code: pilot_code || null });
    revalidatePath('/admin/usuarios');
    return { url, email, note: 'Mandale este link: al abrirlo elige su contraseña y crea su negocio. Vale una sola vez y vence en 24 h.' };
  } catch (e) {
    const m = e.message || String(e);
    return { error: /already|registered|exists/i.test(m) ? 'Ese email ya tiene cuenta. Usá «Link para nueva contraseña» desde su ficha.' : m };
  }
}

// ---------- Pilotos ----------
export async function createInvite(fd) {
  const ctx = await guard('manage', fd);
  const label = str(fd, 'label').slice(0, 80);
  if (label.length < 2) back('/admin/pilotos', { error: 'Poné un nombre para la invitación (ej: Pastelerías Palermo).' });
  let code = str(fd, 'code').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!code) code = randomCode();
  if (code.length < 4) back('/admin/pilotos', { error: 'El código tiene que tener al menos 4 letras o números.' });
  const bt = str(fd, 'business_type');
  const expDays = int(fd, 'expires_days', 0);
  const row = {
    code,
    label,
    business_type: RUBROS[bt] ? bt : null,
    cohort: str(fd, 'cohort').slice(0, 40) || null,
    trial_days: Math.min(365, Math.max(1, int(fd, 'trial_days', 30))),
    max_uses: Math.min(1000, Math.max(1, int(fd, 'max_uses', 1))),
    expires_at: expDays > 0 ? new Date(Date.now() + expDays * 86400000).toISOString() : null,
    notes: str(fd, 'notes').slice(0, 500) || null,
    created_by: ctx.user.id,
  };
  const { error } = await ctx.admin.from('pilot_invites').insert(row);
  if (error) back('/admin/pilotos', { error: error.code === '23505' ? 'Ese código ya existe.' : error.message });
  await audit(ctx, 'crear_invitacion', code, row);
  revalidatePath('/admin/pilotos');
  back('/admin/pilotos#invitaciones', { ok: `Invitación ${code} creada. Copiá el link y mandalo.` });
}

export async function toggleInvite(fd) {
  const ctx = await guard('manage', fd);
  const id = str(fd, 'id');
  const active = str(fd, 'active') === '1';
  const { error } = await ctx.admin.from('pilot_invites').update({ active }).eq('id', id);
  if (error) back('/admin/pilotos', { error: error.message });
  await audit(ctx, active ? 'activar_invitacion' : 'pausar_invitacion', id);
  revalidatePath('/admin/pilotos');
  back('/admin/pilotos#invitaciones', { ok: active ? 'Invitación activa.' : 'Invitación pausada: el link ya no sirve.' });
}

export async function addParticipant(fd) {
  const ctx = await guard('manage', fd);
  const id = str(fd, 'bakery_id');
  const cohort = str(fd, 'cohort').slice(0, 40) || null;
  const { error } = await ctx.admin.from('pilot_participants').upsert({ bakery_id: id, cohort, status: 'activo', updated_at: new Date().toISOString() });
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'sumar_piloto', id, { cohort });
  revalidatePath('/admin', 'layout');
  back(from(fd), { ok: 'Sumado al programa piloto.' });
}

export async function setParticipant(fd) {
  const ctx = await guard('support', fd);
  const id = str(fd, 'bakery_id');
  const status = str(fd, 'status');
  if (!['activo', 'pausado', 'convertido', 'abandonado'].includes(status)) back(from(fd), { error: 'Estado inválido.' });
  const patch = { status, updated_at: new Date().toISOString() };
  if (fd.has('notes')) patch.notes = str(fd, 'notes').slice(0, 1000) || null;
  const { error } = await ctx.admin.from('pilot_participants').update(patch).eq('bakery_id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'estado_piloto', id, patch);
  revalidatePath('/admin', 'layout');
  back(from(fd), { ok: 'Piloto actualizado.' });
}

export async function setFeedback(fd) {
  const ctx = await guard('support', fd);
  const id = int(fd, 'id', 0);
  const status = str(fd, 'status');
  if (!['nuevo', 'visto', 'resuelto'].includes(status)) back(from(fd), { error: 'Estado inválido.' });
  const patch = { status };
  if (fd.has('admin_note')) patch.admin_note = str(fd, 'admin_note').slice(0, 1000) || null;
  const { error } = await ctx.admin.from('pilot_feedback').update(patch).eq('id', id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'comentario', String(id), patch);
  revalidatePath('/admin', 'layout');
  back(from(fd, '/admin/pilotos#comentarios'), { ok: 'Comentario actualizado.' });
}

// ---------- Cuentas y plan de pruebas ----------
export async function createTestAccount(fd) {
  const ctx = await guard('manage', fd);
  const rubro = rubroOf(str(fd, 'business_type'));
  const name = str(fd, 'name').slice(0, 60) || `Prueba ${rubro.short || rubro.label}`;
  const tag = crypto.randomBytes(3).toString('hex');
  const email = `prueba-${rubro.key}-${tag}@autoflow.test`;
  const password = crypto.randomBytes(24).toString('base64url'); // nadie la usa: se entra con link directo
  let bakeryId = null;
  let err = null;
  try {
    const { data: created, error: e1 } = await ctx.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { business_name: name, business_type: rubro.key, test_account: true },
    });
    if (e1) throw e1;
    const slug = `${slugify(name).slice(0, 26) || 'prueba'}-${tag}`;
    const { data: b, error: e2 } = await ctx.admin.from('bakeries').insert({
      owner_id: created.user.id,
      name,
      slug,
      business_type: rubro.key,
      slots: rubro.slots,
      slot_capacity: rubro.slotCapacity || null,
      is_test: true,
      ...(rubro.delivery ? { delivery_enabled: true } : {}),
      ...(rubro.minDays !== undefined ? { min_days_ahead: rubro.minDays } : {}),
    }).select('*').single();
    if (e2) throw e2;
    bakeryId = b.id;
    if (fd.get('seed') === 'on') await seedTestBusiness(ctx.admin, b, { orders: true });
    await audit(ctx, 'crear_cuenta_prueba', b.id, { email, rubro: rubro.key });
  } catch (e) {
    err = e.message || String(e);
  }
  revalidatePath('/admin', 'layout');
  if (err) back('/admin/pruebas', { error: `No se pudo crear la cuenta: ${err}` });
  back(`/admin/pruebas?cuenta=${bakeryId}#plan`, { ok: `Cuenta de prueba creada (${email}). Usá «Entrar» para abrirla en incógnito.` });
}

export async function resetTestData(fd) {
  const ctx = await guard('manage', fd);
  const b = await bakeryOf(ctx, str(fd, 'bakery_id'));
  if (!b?.is_test) back(from(fd), { error: 'Solo se pueden reiniciar cuentas marcadas como prueba.' });
  let err = null;
  try {
    for (const t of ['orders', 'customer_subscriptions', 'customers', 'notifications', 'shopping_items', 'qa_results']) {
      const { error } = await ctx.admin.from(t).delete().eq('bakery_id', b.id);
      if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(`${t}: ${error.message}`);
    }
    if (fd.get('seed') === 'on') await seedTestBusiness(ctx.admin, b, { orders: true });
    await audit(ctx, 'reiniciar_prueba', b.id);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/admin', 'layout');
  back(from(fd), err ? { error: err } : { ok: 'Datos de prueba reiniciados.' });
}

export async function deleteTestAccount(fd) {
  const ctx = await guard('manage', fd);
  const b = await bakeryOf(ctx, str(fd, 'bakery_id'));
  if (!b?.is_test) back(from(fd), { error: 'Solo se pueden borrar cuentas marcadas como prueba.' });
  const { error } = await ctx.admin.auth.admin.deleteUser(b.owner_id);
  if (error) back(from(fd), { error: error.message });
  await audit(ctx, 'borrar_cuenta_prueba', b.id, { name: b.name, slug: b.slug });
  revalidatePath('/admin', 'layout');
  back('/admin/pruebas', { ok: `Cuenta de prueba «${b.name}» borrada.` });
}

export async function saveQa(fd) {
  const ctx = await guard('support', fd);
  const bakery_id = str(fd, 'bakery_id');
  const scenario = str(fd, 'scenario');
  const result = str(fd, 'result');
  if (!QA_SCENARIOS.some(([k]) => k === scenario) || !['ok', 'falla', 'pendiente'].includes(result)) back(from(fd), { error: 'Dato inválido.' });
  const { error } = await ctx.admin.from('qa_results').upsert({ bakery_id, scenario, result, note: str(fd, 'note').slice(0, 500) || null, tested_by: ctx.user.email, at: new Date().toISOString() });
  if (error) back(from(fd), { error: error.message });
  revalidatePath('/admin/pruebas');
  back(from(fd), {});
}

// ---------- Rendimiento ----------
export async function runSelftest(fd) {
  const ctx = await guard('support', fd);
  const secret = process.env.CRON_SECRET;
  if (!secret) back('/admin/rendimiento', { error: 'Falta CRON_SECRET en Vercel.' });
  let msg = null;
  let err = null;
  try {
    const res = await fetch(`${appUrl()}/api/cron/selftest`, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55000), cache: 'no-store' });
    const j = await res.json();
    msg = j.ok ? `Autoprueba OK: ${j.total} controles sin fallas.` : null;
    if (!j.ok) err = `Autoprueba: fallaron ${j.failed?.length || '?'} de ${j.total}: ${(j.failed || []).map((f) => f.name).join(', ')}`;
  } catch (e) {
    err = `No se pudo correr la autoprueba: ${e.message}`;
  }
  await audit(ctx, 'correr_autoprueba', null, { ok: !err });
  revalidatePath('/admin/rendimiento');
  back('/admin/rendimiento', err ? { error: err } : { ok: msg });
}

// ---------- Equipo ----------
export async function addTeamMember(fd) {
  const ctx = await guard('team', fd);
  const email = str(fd, 'email').toLowerCase();
  const role = str(fd, 'role');
  if (!ROLES[role]) back('/admin/equipo', { error: 'Elegí un perfil.' });
  const { data: rows } = await ctx.admin.rpc('admin_user_overview');
  const u = (rows || []).find((r) => r.email?.toLowerCase() === email);
  if (!u) back('/admin/equipo', { error: 'Esa persona tiene que crear su cuenta primero (o invitala desde Usuarios).' });
  const { error } = await ctx.admin.from('platform_admins').upsert({ user_id: u.user_id, email: u.email, role, created_by: ctx.user.id });
  if (error) back('/admin/equipo', { error: error.message });
  await audit(ctx, 'sumar_equipo', email, { role });
  revalidatePath('/admin/equipo');
  back('/admin/equipo', { ok: `${email} ahora es ${ROLES[role].label}.` });
}

export async function setTeamRole(fd) {
  const ctx = await guard('team', fd);
  const userId = str(fd, 'user_id');
  const role = str(fd, 'role');
  if (!ROLES[role]) back('/admin/equipo', { error: 'Perfil inválido.' });
  if (userId === ctx.user.id && role !== 'owner') back('/admin/equipo', { error: 'No podés sacarte tu propio perfil de dueño.' });
  const { error } = await ctx.admin.from('platform_admins').update({ role }).eq('user_id', userId);
  if (error) back('/admin/equipo', { error: error.message });
  await audit(ctx, 'cambiar_perfil', userId, { role });
  revalidatePath('/admin/equipo');
  back('/admin/equipo', { ok: 'Perfil actualizado.' });
}

export async function removeTeamMember(fd) {
  const ctx = await guard('team', fd);
  const userId = str(fd, 'user_id');
  if (userId === ctx.user.id) back('/admin/equipo', { error: 'No podés sacarte a vos mismo del equipo.' });
  const { error } = await ctx.admin.from('platform_admins').delete().eq('user_id', userId);
  if (error) back('/admin/equipo', { error: error.message });
  await audit(ctx, 'sacar_equipo', userId);
  revalidatePath('/admin/equipo');
  back('/admin/equipo', { ok: 'Quitado del equipo.' });
}
