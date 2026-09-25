# ⚡ AutoFlow Studio

> **Agencia de Automatizaciones con Google Workspace & Generador de Landing Pages con IA**
> Ahorra miles de dólares en suscripciones costosas (Zapier/Make/Airtable) con código Apps Script nativo, gratuito y sin cuotas mensuales.

---

## 🚀 Características Principales

### 1. 🤖 Generador de Automatizaciones Google Apps Script (/agente-script)
- **8 Automatizaciones Profesionales listas para copiar y pegar:**
  1. 📄 **Generador de Facturas/Recibos PDF**: Google Sheets + Google Docs + Gmail.
  2. 💬 **Notificaciones de WhatsApp Web**: Envío automático con wa.me desde Sheets.
  3. 👥 **Mini-CRM con Gmail Sync**: Registro de interacciones y seguimiento de leads.
  4. 🌐 **Web Scraper & Monitor de Precios**: Extracción con UrlFetchApp y alertas de cambios.
  5. 🔗 **Webhook Receiver en Sheets**: API REST serverless gratuita sin infraestructura.
  6. ✉️ **Auto-Responder Inteligente Gmail**: Respuestas automatizadas con reglas avanzadas y antispam.
  7. 📅 **Sincronizador Sheets a Google Calendar**: Agenda reuniones y eventos desde hojas de cálculo.
  8. 📁 **Organizador & Backup en Google Drive**: Clasificación por carpetas y compresión de adjuntos.
- **Generación Personalizada con IA**: Prompt abierto para crear cualquier script Apps Script a medida con IA (Google Gemini / OpenAI).
- **Simulador Interactivo**: Ejecución y prueba en tiempo real dentro del navegador con consola interactiva y logs paso a paso.
- **Modales de Instalación**: Guía paso a paso para instalar en Google Sheets/Drive en 2 minutos.

### 2. 🎨 Creador de Landing Pages con IA (/crear-web)
- Prototipador interactivo tipo "v0 / Lovable" en tiempo real.
- Generación de código HTML5 + Tailwind CSS completo.
- Vista previa responsiva instantánea (Desktop, Tablet, Mobile) y modo código.
- Exportación directa en un clic (.HTML).

### 3. 💼 Cotizador & Solicitudes Complejas (/solicitud-compleja)
- Formulario guiado paso a paso con cálculo de presupuesto estimado en tiempo real.
- Asignación de plazos y SLA según la complejidad del proyecto.
- Generación automática de tickets de servicio con ID de seguimiento.

### 4. 📊 Panel de Administración (/admin)
- Gestión de tickets y cotizaciones.
- Filtros por estado (*Pendiente, En Progreso, Completado*) y métricas clave.

---

## 🛠️ Stack Tecnológico

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router), TypeScript, React, Tailwind CSS, Lucide React.
- **Base de Datos**: [Prisma ORM](https://www.prisma.io/) con SQLite local (listo para PostgreSQL / Supabase en producción).
- **Inteligencia Artificial**: Google Gemini API (soporta fallback nativo a OpenAI y motor de simulación inteligente offline sin costo).
- **Despliegue**: Optimizado para [Vercel](https://vercel.com/) y GitHub.

---

## 📦 Instalación Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/autoflow-studio.git
cd autoflow-studio

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (opcional)
# Crea un archivo .env.local con:
# GEMINI_API_KEY=tu_api_key_de_gemini
# OPENAI_API_KEY=tu_api_key_de_openai

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🚢 Despliegue en Vercel (Paso a Paso)

### Opción A: Despliegue con GitHub (Recomendado)
1. Sube tu código a un repositorio de GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: AutoFlow Studio initial release"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/autoflow-studio.git
   git push -u origin main
   ```
2. Ve a [Vercel](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
3. Haz clic en **"Add New..."** → **"Project"**.
4. Selecciona tu repositorio `autoflow-studio`.
5. En la sección **Environment Variables**, añade:
   - `GEMINI_API_KEY` (tu clave de Google AI Studio, gratuita)
6. Haz clic en **Deploy**. ¡Tu proyecto estará en línea en menos de 2 minutos!

---

## 📄 Licencia

MIT License. Desarrollado con ❤️ para automatizar negocios y eliminar tareas repetitivas.
