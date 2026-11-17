# AutoFlow Cocina

Agenda de pedidos con cupos, señas con Mercado Pago, productos/stock/costos sincronizados desde Google Drive y bot de WhatsApp para pastelerías y cocina casera.

- Producción: https://autoflow-cocina.vercel.app (proyecto Vercel `autoflow-cocina`)
- Base de datos: Supabase `autoflow-cocina` (sa-east-1)
- Tarea cada 10 min: `pg_cron` en Supabase llama a `/api/cron/tick` (vence señas, sincroniza planillas). Respaldo diario con Vercel Cron.

## Variables de entorno (Vercel)

| Variable | Quién la carga | Para qué |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | ya cargadas | Conexión a Supabase |
| NEXT_PUBLIC_APP_URL | ya cargada | URL pública |
| APP_ENCRYPTION_KEY, CRON_SECRET, WHATSAPP_VERIFY_TOKEN | ya cargadas | Cifrado de tokens, cron y webhook de WhatsApp |
| SUPABASE_SERVICE_ROLE_KEY | **pendiente** | Catálogo público, webhooks y cron |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | **pendiente** | Conectar Google Drive |
| MP_PLATFORM_ACCESS_TOKEN | **pendiente** | Cobrar las suscripciones de AutoFlow |
| ALERT_WEBHOOK_URL | opcional | Webhook de Discord, Slack o Google Chat para avisos de errores (máx. 1 por hora por error). Los errores siempre quedan en la tabla `app_errors`. |

Después de cargar variables, hay que volver a desplegar (Deployments → Redeploy).

## Puesta en marcha

1. **Supabase → Project Settings → API Keys**: copiar la `service_role` (o una secret key) y cargarla en Vercel como `SUPABASE_SERVICE_ROLE_KEY` (tipo Sensitive).
2. **Supabase → Authentication → URL Configuration**: Site URL `https://autoflow-cocina.vercel.app` y Redirect URL `https://autoflow-cocina.vercel.app/**`.
3. **Supabase → Authentication → Emails → SMTP**: configurar un SMTP propio (Resend, Brevo, etc.). El correo incluido de Supabase tiene un límite muy bajo por hora.
4. **Google Cloud Console**:
   - Crear proyecto y habilitar **Google Drive API** y **Google Sheets API**.
   - Pantalla de consentimiento OAuth: tipo Externo, nombre «AutoFlow Cocina», política de privacidad `https://autoflow-cocina.vercel.app/legal`, scope `.../auth/drive.file` (no sensible) y publicar en Producción.
   - Credenciales → ID de cliente OAuth → Aplicación web, URI de redireccionamiento `https://autoflow-cocina.vercel.app/api/google/callback`.
   - Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Vercel.
5. **Mercado Pago (cuenta de AutoFlow, para cobrar suscripciones)**: crear aplicación en Developers, copiar Access Token de producción a `MP_PLATFORM_ACCESS_TOKEN`. En la app → Webhooks: URL `https://autoflow-cocina.vercel.app/api/billing/webhook`, evento «Planes y suscripciones».
6. Cada negocio conecta **su** Mercado Pago (señas) y **su** WhatsApp desde Configuración dentro de la app.

## Monitoreo

- `GET /api/health` responde 200 si la base contesta y el cron corrió en los últimos 30 min; si no, 503. Conectarlo a un monitor gratuito (UptimeRobot, Better Stack) que avise por mail.
- Errores de cron, webhooks de Mercado Pago y bot de WhatsApp: tabla `app_errors` (solo service role).

## Estructura

- `app/page.jsx` landing · `app/registro`, `app/login` auth
- `app/app/*` panel: agenda, pedidos, productos/recetas, insumos, configuración, plan
- `app/c/[slug]` catálogo público y estado del pedido
- `app/api/*` Google OAuth, webhooks de Mercado Pago (señas y suscripciones), WhatsApp y cron
- `lib/sheets.js` sincronización con Drive · `lib/costs.js` costos · `lib/orders.js` cupos y pedidos · `lib/bot.js` bot de WhatsApp
