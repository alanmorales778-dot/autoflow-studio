import { requireBakery } from '@/lib/session';
import {
  saveSettings, uploadLogo, removeLogo, addCapacity, deleteCapacity, addBlocked, deleteBlocked, saveMpToken, removeMpToken, saveWhatsapp, disconnectGoogle, syncNow, rotateCalendarToken, disableCalendar, saveNotifications,
} from '../actions';
import { mailEnabled } from '@/lib/notify';
import { Flash, Locked } from '../ui';
import { WEEKDAYS, dateLabel, todayAR, dateTimeLabel } from '@/lib/format';
import { sheetUrl } from '@/lib/google';
import { appUrl, has } from '@/lib/env';
import { calendarUrl } from '@/lib/ics';
import CopyField from './copy-field';
import HashOpener from '../hash-opener';
import PhotoPicker from '../photo-picker';
import PushSettings from '../push-settings';
import { vapidPublicKey } from '@/lib/webpush';
import { prefsOf } from '@/lib/notifications';
import Link from 'next/link';
import { RUBROS, RUBRO_KEYS, rubroOf } from '@/lib/rubros';

export default async function Configuracion({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access, user } = await requireBakery();
  const { count: pushDevices } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id);
  const [{ data: rules }, { data: blocked }, { data: cats }] = await Promise.all([
    supabase.from('capacity_rules').select('*').eq('bakery_id', bakery.id).order('category').order('weekday'),
    supabase.from('blocked_dates').select('*').eq('bakery_id', bakery.id).gte('date', todayAR()).order('date'),
    supabase.from('products').select('category').eq('bakery_id', bakery.id).not('sheet_row', 'is', null),
  ]);
  const categories = [...new Set((cats || []).map((c) => c.category))];
  const t = rubroOf(bakery);

  return (
    <>
      <HashOpener />
      <h1>Ajustes</h1>
      <Flash sp={sp} />
      <nav className="tabs-bar no-print" aria-label="Ir a">
        <a href="#negocio">Tu negocio</a>
        <a href="#cupos">Cupos y días</a>
        <a href="#mercadopago">Cobros</a>
        <a href="#avisos">Avisos</a>
        <a href="#mas">Más opciones</a>
      </nav>

      {/* Negocio */}
      <div className="card" id="negocio">
        <h2>Tu negocio</h2>
        <div className="biz-head">
          <PhotoPicker action={uploadLogo} current={bakery.logo_url} shape="square" maxSide={600} keepPng label="Subir logo" changeLabel="Cambiar" placeholder={(bakery.name || '?').trim().charAt(0).toUpperCase()} />
          <div>
            <strong>Logo</strong>
            <p className="muted" style={{ margin: '2px 0 8px', fontSize: 13 }}>Se ve en tu catálogo y arriba en la app. Mejor cuadrado y con fondo blanco o transparente.</p>
            {bakery.logo_url && <form action={removeLogo}><button className="btn danger small">Quitar logo</button></form>}
          </div>
        </div>
        <form action={saveSettings}>
          <fieldset className="set">
            <legend>Datos que ven tus clientes</legend>
            <div className="grid grid-3">
              <div className="field"><label>Nombre</label><input name="name" defaultValue={bakery.name} required /></div>
              <div className="field"><label>Link (después de /c/)</label><input name="slug" defaultValue={bakery.slug} required /></div>
              <div className="field"><label>WhatsApp de contacto</label><input name="whatsapp_contact" defaultValue={bakery.whatsapp_contact || ''} inputMode="tel" placeholder="11 5555-5555" /></div>
              <div className="field"><label>Dirección del local o de retiro</label><input name="pickup_address" defaultValue={bakery.pickup_address || ''} placeholder="Ej: Av. Siempreviva 742, Palermo" /></div>
              <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label className="inline-label" style={{ minHeight: 44 }}><input type="checkbox" name="delivery_enabled" defaultChecked={bakery.delivery_enabled} /> Ofrezco «{t.envio.toLowerCase()}»</label>
              </div>
              <div className="field"><label>Rubro</label><select name="business_type" defaultValue={t.key}>{RUBRO_KEYS.map((k) => <option key={k} value={k}>{RUBROS[k].label}</option>)}</select><div className="hint">Cambia los nombres de la app. No borra nada.</div></div>
            </div>
          </fieldset>
          <fieldset className="set">
            <legend>Cuándo te pueden {t.key === 'belleza' ? 'reservar' : 'pedir'}</legend>
            <div className="grid grid-3">
              <div className="field"><label>Horarios o franjas (uno por línea)</label><textarea name="slots" defaultValue={(bakery.slots || []).join('\n')} /></div>
              <div className="field"><label>Días mínimos de anticipación</label><input name="min_days_ahead" type="number" min="0" defaultValue={bakery.min_days_ahead} /><div className="hint">0 = se puede para hoy.</div></div>
              <div className="field"><label>Hasta cuántos días adelante</label><input name="max_days_ahead" type="number" min="1" defaultValue={bakery.max_days_ahead} /></div>
              <div className="field"><label>Clientes a la vez por horario</label><input name="slot_capacity" type="number" min="1" max="100" defaultValue={bakery.slot_capacity ?? ''} placeholder="Sin límite" /><div className="hint">Para turnos: cuántas personas atienden a la vez. Vacío = sin límite.</div></div>
            </div>
          </fieldset>
          <fieldset className="set">
            <legend>Seña</legend>
            <div className="grid grid-3">
              <div className="field"><label>Seña (% del total)</label><input name="deposit_percent" type="number" min="0" max="100" defaultValue={bakery.deposit_percent} /><div className="hint">0 = no pedís seña.</div></div>
              <div className="field"><label>Minutos para pagarla (con Mercado Pago)</label><input name="hold_minutes" type="number" min="5" max="1440" defaultValue={bakery.hold_minutes} /></div>
              <div className="field"><label>Horas que se guarda el lugar sin Mercado Pago</label><input name="manual_hold_hours" type="number" min="0" max="168" defaultValue={bakery.manual_hold_hours ?? 24} /><div className="hint">Si no marcás la seña como cobrada, {t.order === 'reserva' || t.order === 'turno' ? 'se libera el lugar' : 'el cupo se libera'}. 0 = no vence.</div></div>
            </div>
          </fieldset>
          <fieldset className="set">
            <legend>Precios</legend>
            <div className="grid grid-3">
              <div className="field"><label>Margen que querés ganar (%)</label><input name="margin_percent" inputMode="decimal" defaultValue={Number(bakery.margin_percent)} /></div>
              <div className="field"><label>Gastos fijos: luz, gas, alquiler (%)</label><input name="overhead_percent" inputMode="decimal" defaultValue={Number(bakery.overhead_percent)} /><div className="hint">Se suman al costo de cada {t.item}.</div></div>
            </div>
          </fieldset>
          <button className="btn">Guardar cambios</button>
        </form>
      </div>

      {/* Cupos */}
      <div className="card" id="cupos">
        <h2>Cupos por día</h2>
        <p className="muted">{t.capTitle.replace(/^Poné c/, 'C')}. Cuando se llena, esa fecha deja de ofrecerse. Usá «Todas» para un tope general, o una de tus categorías (ej: {t.capExample}). Sin reglas, no hay límite.</p>
        {rules && rules.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead><tr><th>Categoría</th><th>Día</th><th>Máximo</th><th></th></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.category === '*' ? 'Todas' : r.category}</td>
                    <td>{WEEKDAYS[r.weekday]}</td>
                    <td>{r.max_units} unidades</td>
                    <td><form action={deleteCapacity}><input type="hidden" name="id" value={r.id} /><button className="btn danger small">Quitar</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={addCapacity} className="grid grid-3">
          <div className="field">
            <label>Categoría</label>
            <select name="category">
              <option value="*">Todas</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Día</label>
            <select name="weekday">
              <option value="all">Todos los días</option>
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="field"><label>Máximo de unidades</label><input name="max_units" type="number" min="0" required placeholder="Ej: 4" /></div>
          <div><button className="btn">Agregar cupo</button></div>
        </form>
      </div>

      {/* Fechas bloqueadas */}
      <div className="card">
        <h2>Días sin {t.orders.toLowerCase()}</h2>
        <p className="muted">Feriados, vacaciones o días que ya tenés completos.</p>
        <div className="row" style={{ marginBottom: 12 }}>
          {(blocked || []).map((b) => (
            <form key={b.date} action={deleteBlocked} className="row" style={{ gap: 4 }}>
              <input type="hidden" name="date" value={b.date} />
              <span className="badge bad">{dateLabel(b.date)}</span>
              <button className="btn danger small">×</button>
            </form>
          ))}
        </div>
        <form action={addBlocked} className="row">
          <input type="date" name="date" required style={{ maxWidth: 200 }} />
          <button className="btn secondary">Bloquear día</button>
        </form>
      </div>

      {/* Mercado Pago */}
      <div className="card" id="mercadopago">
        <h2>Mercado Pago (cobro de señas)</h2>
        {bakery.mp_access_token_enc ? (
          <div className="row">
            <span className="badge ok">Conectado</span>
            <form action={removeMpToken}><button className="btn danger small">Desconectar</button></form>
          </div>
        ) : (
          <p className="muted">Sin conectar: quedan «esperando seña» y la coordinás a mano.</p>
        )}
        <details style={{ margin: '12px 0' }}>
          <summary>¿Dónde consigo el Access Token?</summary>
          <ol>
            <li>Entrá a <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer">Mercado Pago Developers → Tus integraciones</a> con tu cuenta de vendedor.</li>
            <li>Creá una aplicación (tipo «Pagos online», producto «Checkout Pro»).</li>
            <li>En «Credenciales de producción» copiá el <strong>Access Token</strong> (empieza con APP_USR-).</li>
          </ol>
          <p className="muted">La plata de las señas entra directo a tu cuenta de Mercado Pago.</p>
        </details>
        <form action={saveMpToken} className="row">
          <input name="mp_token" type="password" placeholder="APP_USR-…" autoComplete="off" style={{ maxWidth: 420 }} />
          <button className="btn">{bakery.mp_access_token_enc ? 'Reemplazar token' : 'Conectar'}</button>
        </form>
      </div>

      <div className="card" id="avisos">
        <h2>Avisos en el celular</h2>
        <p className="muted" style={{ marginTop: 0 }}>Te avisamos al instante aunque tengas la app cerrada. Activalo en cada celular o computadora donde lo quieras.</p>
        <PushSettings vapidKey={vapidPublicKey()} prefs={prefsOf(bakery)} devices={pushDevices || 0} labels={{ orderCap: t.orderCap }} />
      </div>

      <h2 id="mas" style={{ margin: '28px 0 10px', fontSize: 17, color: 'var(--muted)' }}>Más opciones</h2>
      {/* Calendario */}
      <details className="card fold" id="calendario">
        <summary><h2>Ver tus {t.orders.toLowerCase()} en el calendario</h2></summary>
        <p className="muted">Sumalos a Google Calendar o al calendario del celular. Se actualiza solo (Google tarda unas horas en refrescar). Los cambios se hacen siempre acá en AutoFlow.</p>
        {bakery.calendar_token ? (
          <>
            <CopyField value={calendarUrl(bakery.calendar_token)} />
            <details style={{ margin: '12px 0' }}>
              <summary>Cómo agregarlo</summary>
              <ol>
                <li><strong>Google Calendar</strong> (desde la compu): en <a href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">Otros calendarios → Desde URL</a>, pegá el enlace y tocá «Agregar calendario». Después aparece también en el celular.</li>
                <li><strong>iPhone</strong>: Ajustes → Calendario → Cuentas → Agregar cuenta → Otra → Agregar calendario suscrito, y pegá el enlace.</li>
                <li><strong>Outlook</strong>: Agregar calendario → Suscribirse desde la web.</li>
              </ol>
              <p className="muted">⏳ = esperando seña · ✔ = entregado. Cada evento trae opciones, {t.note1.label.toLowerCase()}, {t.note2.label.toLowerCase()} y el saldo a cobrar.</p>
            </details>
            <p className="muted" style={{ fontSize: 13 }}>Cualquiera que tenga este enlace puede ver tus {t.orders.toLowerCase()}. Si lo compartiste por error, regeneralo.</p>
            <div className="row">
              <form action={rotateCalendarToken}><button className="btn secondary small">Regenerar enlace</button></form>
              <form action={disableCalendar}><button className="btn danger small">Desactivar</button></form>
            </div>
          </>
        ) : (
          <form action={rotateCalendarToken}><button className="btn">Crear enlace de calendario</button></form>
        )}
      </details>

      {/* Avisos: solo se muestra cuando el envío de mails está configurado en el servidor */}
      {mailEnabled() && (
      <details className="card fold" id="avisos-mail">
        <summary><h2>Avisos por mail</h2></summary>
        <p className="muted">Te mandamos un mail cuando entra algo desde tu link o WhatsApp, y cuando se cobra una seña por Mercado Pago.</p>
        <form action={saveNotifications} className="grid grid-2" style={{ alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="notify_email">Mandar los avisos a</label>
            <input id="notify_email" name="notify_email" type="email" defaultValue={bakery.notify_email || ''} placeholder={`${user.email} (el de tu cuenta)`} />
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <label className="inline-label" style={{ margin: 0 }}><input type="checkbox" name="notify_orders" defaultChecked={bakery.notify_orders !== false} /> Avisarme cada {t.order} nuevo</label>
            <button className="btn secondary">Guardar avisos</button>
          </div>
        </form>
      </details>
      )}

      {/* Google Drive: solo si la conexión con Google está configurada en el servidor */}
      {has.google() && (
      <details className="card fold" id="drive">
        <summary><h2>Google Drive (productos, stock e insumos)</h2></summary>
        <p className="muted">Opcional. Si preferís, podés cargar todo subiendo un Excel o CSV desde <a href="/app/productos">Productos</a> e <a href="/app/insumos">Insumos</a>. Con Drive conectado, los cambios en tus planillas se toman solos cada 10 minutos.</p>
        {bakery.google_refresh_token_enc ? (
          <>
            <p>Conectado{bakery.google_email ? ` como ${bakery.google_email}` : ''}. Última sincronización: {dateTimeLabel(bakery.last_sync_at)}.</p>
            <div className="row">
              {bakery.sheet_productos_id && <a className="btn secondary" href={sheetUrl(bakery.sheet_productos_id)} target="_blank" rel="noreferrer">Planilla de productos y stock ↗</a>}
              {bakery.sheet_insumos_id && <a className="btn secondary" href={sheetUrl(bakery.sheet_insumos_id)} target="_blank" rel="noreferrer">Planilla de insumos ↗</a>}
              <form action={syncNow}><input type="hidden" name="back" value="/app/configuracion" /><button className="btn">Actualizar ahora</button></form>
              <form action={disconnectGoogle}><button className="btn danger">Desconectar</button></form>
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Editá solo las columnas blancas. Las grises (Reservado, Disponible, Costo, Precio mínimo, Margen) las completa AutoFlow.</p>
          </>
        ) : (
          <>
            <p>Al conectar, creamos dos planillas en tu Google Drive: <strong>Insumos</strong> (precios de lo que comprás) y <strong>Productos y stock</strong> (lo que vendés). AutoFlow solo puede ver esas dos planillas, nada más de tu Drive.</p>
            <a className="btn" href="/api/google/connect">Conectar Google Drive</a>
          </>
        )}
      </details>
      )}

      {/* WhatsApp */}
      <details className="card fold" id="whatsapp">
        <summary><h2>Bot de WhatsApp</h2></summary>
        {!access.whatsapp && <Locked title="Módulo Bot de WhatsApp">Activalo para que tus clientes pidan solos por WhatsApp.</Locked>}
        <p className="muted">Usa la API oficial de WhatsApp (Meta). Necesitás un número que no esté usando la app común de WhatsApp.</p>
        <details style={{ margin: '12px 0' }}>
          <summary>Paso a paso para conectarlo</summary>
          <ol>
            <li>En <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">Meta for Developers</a> creá una app tipo «Empresa» y agregá el producto WhatsApp.</li>
            <li>En WhatsApp → Configuración de la API, agregá tu número y copiá el <strong>Identificador del número de teléfono</strong>.</li>
            <li>Creá un token permanente (Usuario del sistema en el Business Manager con permiso whatsapp_business_messaging).</li>
            <li>En WhatsApp → Configuración → Webhook, pegá la URL <code>{appUrl()}/api/whatsapp/webhook</code> y el token de verificación <code>{process.env.WHATSAPP_VERIFY_TOKEN || '(pendiente de configurar)'}</code>. Suscribite al campo <strong>messages</strong>.</li>
            <li>Opcional pero recomendado: copiá la Clave secreta de la app (Configuración → Básica) para validar los mensajes.</li>
          </ol>
        </details>
        <form action={saveWhatsapp}>
          <div className="grid grid-3">
            <div className="field"><label>ID del número de teléfono</label><input name="wa_phone_number_id" defaultValue={bakery.wa_phone_number_id || ''} /></div>
            <div className="field"><label>Token de acceso {bakery.wa_token_enc ? '(guardado)' : ''}</label><input name="wa_token" type="password" autoComplete="off" placeholder={bakery.wa_token_enc ? '•••••• (dejar vacío para no cambiar)' : ''} /></div>
            <div className="field"><label>Clave secreta de la app {bakery.wa_app_secret_enc ? '(guardada)' : ''}</label><input name="wa_app_secret" type="password" autoComplete="off" /></div>
          </div>
          <button className="btn">Guardar WhatsApp</button>
        </form>
      </details>
      <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
        <Link href="/app/actividad">Ver la actividad de tu cuenta</Link> · <a href="/nueva-clave">Cambiar mi contraseña</a>
      </p>
    </>
  );
}
