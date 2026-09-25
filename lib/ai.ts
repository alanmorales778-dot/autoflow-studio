// ============================================================
// AutoFlow Studio - AI Integration Layer
// Supports: OpenAI, Google Gemini, or Built-in Mock
// ============================================================

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ScriptGenerationResult {
  code: string;
  html?: string;
  guide: {
    step: number;
    title: string;
    description: string;
  }[];
  explanation: string;
}

export interface WebProjectState {
  businessName: string;
  niche: string;
  sections: string[];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  tone: string;
  heroTitle: string;
  heroSubtitle: string;
  services: { title: string; description: string; icon: string }[];
  testimonials: { name: string; text: string; role: string }[];
  contactEnabled: boolean;
  footerText: string;
}

const DEFAULT_WEB_STATE: WebProjectState = {
  businessName: "Mi Negocio",
  niche: "general",
  sections: ["hero", "services", "contact"],
  colorPalette: {
    primary: "#6366f1",
    secondary: "#8b5cf6",
    accent: "#06b6d4",
    background: "#0f172a",
    text: "#f8fafc",
  },
  tone: "professional",
  heroTitle: "Bienvenido a Mi Negocio",
  heroSubtitle: "Soluciones profesionales para tu empresa",
  services: [
    {
      title: "Servicio 1",
      description: "Descripción del servicio principal",
      icon: "Zap",
    },
    {
      title: "Servicio 2",
      description: "Descripción del segundo servicio",
      icon: "Shield",
    },
    {
      title: "Servicio 3",
      description: "Descripción del tercer servicio",
      icon: "Star",
    },
  ],
  testimonials: [],
  contactEnabled: true,
  footerText: "© 2024 Mi Negocio. Todos los derechos reservados.",
};

// ============================================================
// Mock AI for development (no API key required)
// ============================================================

const SCRIPT_TEMPLATES: Record<string, ScriptGenerationResult> = {
  "calendar-shifts": {
    code: `/**
 * AutoFlow Studio - Gestor de Turnos en Google Calendar
 * Generado automáticamente por IA
 */

// Configuración
const CALENDAR_ID = 'primary';
const SHEET_NAME = 'Turnos';
const DURATION_MINUTES = 60;

/**
 * Crea turnos en Google Calendar desde la hoja de cálculo
 */
function crearTurnosDesdeSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + SHEET_NAME + '"');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  let creados = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const nombre = row[0];    // Columna A: Nombre del cliente
    const fecha = new Date(row[1]); // Columna B: Fecha
    const hora = row[2];      // Columna C: Hora (ej: "10:00")
    const servicio = row[3];  // Columna D: Tipo de servicio
    
    if (!nombre || !fecha) continue;
    
    // Parsear hora
    const [h, m] = hora.toString().split(':').map(Number);
    fecha.setHours(h, m, 0, 0);
    
    const fin = new Date(fecha.getTime() + DURATION_MINUTES * 60 * 1000);
    
    // Crear evento
    const event = calendar.createEvent(
      \`📅 Turno: \${nombre} - \${servicio}\`,
      fecha,
      fin,
      {
        description: \`Cliente: \${nombre}\\nServicio: \${servicio}\\nCreado por AutoFlow Studio\`,
        location: 'Consultorio Principal'
      }
    );
    
    // Marcar como procesado en la hoja
    sheet.getRange(i + 1, headers.length + 1).setValue('✅ Creado');
    sheet.getRange(i + 1, headers.length + 2).setValue(event.getId());
    creados++;
  }
  
  SpreadsheetApp.getUi().alert(\`Se crearon \${creados} turnos exitosamente.\`);
}

/**
 * Menú personalizado
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('Crear Turnos', 'crearTurnosDesdeSheet')
    .addItem('Ver Calendario', 'abrirCalendario')
    .addToUi();
}

function abrirCalendario() {
  const html = HtmlService.createHtmlOutput('<script>window.open("https://calendar.google.com");google.script.host.close();</script>');
  SpreadsheetApp.getUi().showModalDialog(html, 'Abriendo calendario...');
}`,
    guide: [
      {
        step: 1,
        title: "Abrir Google Sheets",
        description:
          'Abre la hoja de cálculo donde tengas los datos de turnos. Las columnas deben ser: A=Nombre, B=Fecha, C=Hora, D=Servicio.',
      },
      {
        step: 2,
        title: "Abrir el Editor de Apps Script",
        description:
          'Ve al menú Extensiones → Apps Script. Se abrirá el editor en una nueva pestaña.',
      },
      {
        step: 3,
        title: "Pegar el Código",
        description:
          'Borra todo el contenido del archivo Code.gs y pega el código generado. Guarda con Ctrl+S.',
      },
      {
        step: 4,
        title: "Autorizar Permisos",
        description:
          'Haz clic en ▶ (Ejecutar) → Selecciona "crearTurnosDesdeSheet" → Autoriza los permisos de Calendar y Sheets cuando se te solicite.',
      },
      {
        step: 5,
        title: "Usar el Menú",
        description:
          'Recarga la hoja. Verás un nuevo menú "🚀 AutoFlow" con la opción de crear turnos automáticamente.',
      },
    ],
    explanation:
      "Este script lee los datos de turnos desde tu hoja de cálculo y crea eventos automáticamente en Google Calendar. Incluye un menú personalizado para ejecutarlo fácilmente.",
  },
  "invoice-email": {
    code: `/**
 * AutoFlow Studio - Envío de Facturas por Gmail
 * Generado automáticamente por IA
 */

const CONFIG = {
  SHEET_NAME: 'Facturas',
  TEMPLATE_DOC_ID: '', // ID del Google Doc template (dejar vacío para usar template por defecto)
  SENDER_NAME: 'Mi Empresa',
  SUBJECT_PREFIX: 'Factura',
};

/**
 * Envía facturas por email a los clientes listados en la hoja
 */
function enviarFacturas() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.SHEET_NAME + '"');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  let enviados = 0;
  let errores = 0;
  
  for (let i = 1; i < data.length; i++) {
    const [cliente, email, concepto, monto, moneda, estado] = data[i];
    
    if (!email || estado === '✅ Enviado') continue;
    
    try {
      const nroFactura = \`FAC-\${String(i).padStart(4, '0')}\`;
      const htmlBody = generarHTMLFactura(cliente, nroFactura, concepto, monto, moneda || 'ARS');
      
      GmailApp.sendEmail(email, \`\${CONFIG.SUBJECT_PREFIX} \${nroFactura} - \${concepto}\`, '', {
        htmlBody: htmlBody,
        name: CONFIG.SENDER_NAME,
      });
      
      sheet.getRange(i + 1, 6).setValue('✅ Enviado');
      sheet.getRange(i + 1, 7).setValue(new Date());
      enviados++;
    } catch (e) {
      sheet.getRange(i + 1, 6).setValue('❌ Error');
      errores++;
    }
  }
  
  SpreadsheetApp.getUi().alert(
    \`Proceso completado:\\n✅ Enviados: \${enviados}\\n❌ Errores: \${errores}\`
  );
}

/**
 * Genera HTML de factura con diseño profesional
 */
function generarHTMLFactura(cliente, nro, concepto, monto, moneda) {
  return \`
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; color: white;">
      <h1 style="margin: 0; font-size: 24px;">\${CONFIG.SENDER_NAME}</h1>
      <p style="margin: 5px 0 0; opacity: 0.9;">Factura \${nro}</p>
    </div>
    <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0;">
      <p style="color: #475569;">Estimado/a <strong>\${cliente}</strong>,</p>
      <p style="color: #475569;">Adjuntamos el detalle de su factura:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f1f5f9;">
          <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">Concepto</td>
          <td style="padding: 12px; border: 1px solid #e2e8f0;">\${concepto}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold;">Monto</td>
          <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 20px; color: #6366f1; font-weight: bold;">
            \${moneda} \${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      </table>
      <p style="color: #94a3b8; font-size: 12px;">Generado automáticamente por AutoFlow Studio</p>
    </div>
    <div style="background: #1e293b; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="color: #94a3b8; margin: 0; font-size: 12px;">
        Este es un email automático. No responder a esta dirección.
      </p>
    </div>
  </div>\`;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('📧 Enviar Facturas', 'enviarFacturas')
    .addToUi();
}`,
    guide: [
      {
        step: 1,
        title: "Preparar la Hoja de Cálculo",
        description:
          'Crea una hoja llamada "Facturas" con columnas: A=Cliente, B=Email, C=Concepto, D=Monto, E=Moneda (ARS/USD).',
      },
      {
        step: 2,
        title: "Abrir Apps Script",
        description:
          "Ve a Extensiones → Apps Script y pega el código generado.",
      },
      {
        step: 3,
        title: "Configurar el Remitente",
        description:
          'Modifica CONFIG.SENDER_NAME con el nombre de tu empresa.',
      },
      {
        step: 4,
        title: "Autorizar y Ejecutar",
        description:
          "Ejecuta enviarFacturas() y autoriza los permisos de Gmail. Las facturas se enviarán automáticamente.",
      },
      {
        step: 5,
        title: "Verificar Estado",
        description:
          'La columna F se actualizará con "✅ Enviado" o "❌ Error" para cada fila procesada.',
      },
    ],
    explanation:
      "Este script toma datos de facturas desde Google Sheets y envía emails profesionales con diseño HTML a cada cliente. Marca automáticamente las facturas enviadas.",
  },
  "webhook-sheets": {
    code: `/**
 * AutoFlow Studio - Webhook receptor en Google Sheets
 * Generado automáticamente por IA
 */

/**
 * Maneja requests POST (webhook receptor)
 * URL del webhook: [se genera al publicar como Web App]
 */
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Webhook Data') 
      || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Webhook Data');
    
    let data;
    
    if (e.postData) {
      data = JSON.parse(e.postData.contents);
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'No data received' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Si es el primer registro, crear headers
    if (sheet.getLastRow() === 0) {
      const headers = ['Timestamp', ...Object.keys(data)];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#6366f1')
        .setFontColor('white')
        .setFontWeight('bold');
    }
    
    // Agregar datos
    const timestamp = new Date().toISOString();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map((h, i) => {
      if (i === 0) return timestamp;
      const value = data[h];
      return typeof value === 'object' ? JSON.stringify(value) : value || '';
    });
    
    sheet.appendRow(row);
    
    // Formateo automático
    const lastRow = sheet.getLastRow();
    if (lastRow % 2 === 0) {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#f8fafc');
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: true, 
        message: \`Datos guardados en fila \${lastRow}\`,
        timestamp: timestamp 
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Maneja requests GET (health check)
 */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ 
      status: 'active',
      service: 'AutoFlow Webhook',
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test local del webhook
 */
function testWebhook() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        nombre: 'Juan Pérez',
        email: 'juan@example.com',
        producto: 'Plan Pro',
        monto: 15000,
        fuente: 'Landing Page'
      })
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('🧪 Test Webhook', 'testWebhook')
    .addItem('📋 Ver Instrucciones', 'mostrarInstrucciones')
    .addToUi();
}

function mostrarInstrucciones() {
  const html = HtmlService.createHtmlOutput(\`
    <div style="font-family: Arial; padding: 20px;">
      <h2>📡 Instrucciones del Webhook</h2>
      <ol>
        <li>Ve a <b>Publicar → Implementar como aplicación web</b></li>
        <li>En "Ejecutar como": selecciona <b>Yo</b></li>
        <li>En "Quién tiene acceso": selecciona <b>Cualquier persona</b></li>
        <li>Copia la URL generada</li>
        <li>Usa esa URL como endpoint en tu formulario o servicio externo</li>
      </ol>
      <p><b>Formato esperado (JSON):</b></p>
      <pre style="background: #f1f5f9; padding: 10px; border-radius: 8px;">
{
  "nombre": "Juan",
  "email": "juan@test.com",
  "producto": "Plan Pro"
}</pre>
    </div>
  \`).setWidth(500).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Webhook - Instrucciones');
}`,
    guide: [
      {
        step: 1,
        title: "Crear el Script",
        description:
          "Abre una Google Sheet nueva → Extensiones → Apps Script → Pega el código.",
      },
      {
        step: 2,
        title: "Publicar como Web App",
        description:
          'En Apps Script: Implementar → Nueva implementación → Tipo: Aplicación web → Acceso: "Cualquier persona" → Implementar.',
      },
      {
        step: 3,
        title: "Copiar URL del Webhook",
        description:
          "Copia la URL generada. Esta es tu endpoint para recibir datos.",
      },
      {
        step: 4,
        title: "Testear",
        description:
          'Usa el menú "🚀 AutoFlow → Test Webhook" para verificar que funciona, o envía un POST con curl/Postman.',
      },
      {
        step: 5,
        title: "Conectar con tu App",
        description:
          "Configura tu formulario o servicio para enviar datos JSON vía POST a la URL del webhook.",
      },
    ],
    explanation:
      "Este script convierte tu Google Sheet en un receptor de webhooks. Cualquier servicio externo puede enviar datos JSON por POST y se guardarán automáticamente como filas.",
  },
  "auto-responder": {
    code: `/**
 * AutoFlow Studio - Auto-Responder Inteligente de Gmail
 * Responde automáticamente emails según reglas configurables
 */

const RESPONDER_CONFIG = {
  SHEET_NAME: 'Reglas',
  CHECK_INTERVAL_MINUTES: 5,
  LABEL_PROCESADO: 'AutoFlow-Respondido',
  MAX_EMAILS_POR_EJECUCION: 20,
};

/**
 * Procesa emails no leídos y responde según las reglas de la hoja
 */
function procesarEmailsNuevos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESPONDER_CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Crea una hoja llamada "' + RESPONDER_CONFIG.SHEET_NAME + '" con las columnas: Palabra Clave | Respuesta | Activa (SI/NO)');
    return;
  }
  
  const reglas = sheet.getDataRange().getValues().slice(1).filter(r => r[2] === 'SI');
  
  // Buscar emails no leídos sin el label de procesado
  const label = GmailApp.getUserLabelByName(RESPONDER_CONFIG.LABEL_PROCESADO) 
    || GmailApp.createLabel(RESPONDER_CONFIG.LABEL_PROCESADO);
  
  const threads = GmailApp.search('is:unread -label:' + RESPONDER_CONFIG.LABEL_PROCESADO, 0, RESPONDER_CONFIG.MAX_EMAILS_POR_EJECUCION);
  let respondidos = 0;
  
  threads.forEach(thread => {
    const mensaje = thread.getMessages()[thread.getMessageCount() - 1];
    const asunto = mensaje.getSubject().toLowerCase();
    const cuerpo = mensaje.getPlainBody().toLowerCase();
    const remitente = mensaje.getFrom();
    
    for (const regla of reglas) {
      const palabraClave = regla[0].toString().toLowerCase();
      const respuesta = regla[1].toString();
      
      if (asunto.includes(palabraClave) || cuerpo.includes(palabraClave)) {
        const htmlRespuesta = \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
            <h2 style="margin: 0;">Respuesta Automática</h2>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0;">
            <p>\${respuesta}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              Este es un mensaje automático. Un humano revisará tu consulta pronto.
            </p>
          </div>
        </div>\`;
        
        mensaje.reply('', {
          htmlBody: htmlRespuesta,
          name: 'Asistente Automático'
        });
        
        thread.addLabel(label);
        respondidos++;
        break;
      }
    }
  });
  
  if (respondidos > 0) {
    Logger.log('Se respondieron ' + respondidos + ' emails automáticamente.');
  }
}

/**
 * Configura el trigger automático cada X minutos
 */
function activarAutoResponder() {
  // Eliminar triggers anteriores
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'procesarEmailsNuevos') ScriptApp.deleteTrigger(t);
  });
  
  ScriptApp.newTrigger('procesarEmailsNuevos')
    .timeBased()
    .everyMinutes(RESPONDER_CONFIG.CHECK_INTERVAL_MINUTES)
    .create();
  
  SpreadsheetApp.getUi().alert('✅ Auto-responder activado. Se revisarán emails cada ' + RESPONDER_CONFIG.CHECK_INTERVAL_MINUTES + ' minutos.');
}

function desactivarAutoResponder() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'procesarEmailsNuevos') ScriptApp.deleteTrigger(t);
  });
  SpreadsheetApp.getUi().alert('❌ Auto-responder desactivado.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('▶ Activar Auto-Responder', 'activarAutoResponder')
    .addItem('⏹ Desactivar', 'desactivarAutoResponder')
    .addItem('🧪 Test Manual', 'procesarEmailsNuevos')
    .addToUi();
}`,
    guide: [
      {
        step: 1,
        title: "Crear Hoja de Reglas",
        description:
          'En una Google Sheet, crea una hoja llamada "Reglas" con 3 columnas: A = Palabra Clave, B = Respuesta, C = Activa (SI/NO). Ejemplo: "presupuesto" | "Gracias por contactarnos..." | SI',
      },
      {
        step: 2,
        title: "Pegar el Script",
        description:
          "Extensiones → Apps Script → Pega el código. Guarda con Ctrl+S.",
      },
      {
        step: 3,
        title: "Activar Auto-Responder",
        description:
          'Recarga la hoja. Usa el menú "🚀 AutoFlow → Activar Auto-Responder". Autoriza los permisos de Gmail.',
      },
      {
        step: 4,
        title: "Personalizar Intervalo",
        description:
          "Modifica CHECK_INTERVAL_MINUTES para cambiar cada cuántos minutos revisa emails (por defecto: 5).",
      },
      {
        step: 5,
        title: "Agregar Reglas",
        description:
          'Agrega filas a la hoja "Reglas" para definir nuevas respuestas automáticas según palabras clave.',
      },
    ],
    explanation:
      "Este script revisa automáticamente tu Gmail cada 5 minutos y responde con mensajes predefinidos según palabras clave. Las reglas se configuran desde una Google Sheet.",
  },
  "pdf-generator": {
    code: `/**
 * AutoFlow Studio - Generador de PDFs / Certificados desde Sheets
 * Crea documentos PDF personalizados y los envía por email
 */

const PDF_CONFIG = {
  SHEET_NAME: 'Datos',
  TEMPLATE_DOC_ID: '', // ID del Google Doc template (usar marcadores como {{nombre}}, {{curso}}, etc.)
  OUTPUT_FOLDER_NAME: 'PDFs Generados',
  SEND_EMAIL: true,
};

/**
 * Genera PDFs desde un template de Google Docs
 * Reemplaza marcadores {{campo}} con datos de la hoja
 */
function generarPDFs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PDF_CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + PDF_CONFIG.SHEET_NAME + '"');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim());
  
  // Crear o encontrar carpeta de salida
  let folder;
  const folders = DriveApp.getFoldersByName(PDF_CONFIG.OUTPUT_FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(PDF_CONFIG.OUTPUT_FOLDER_NAME);
  }
  
  let generados = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const estado = row[headers.indexOf('Estado')] || '';
    if (estado === '✅ Generado') continue;
    
    // Si hay template, usar Google Docs; si no, crear HTML directo
    let pdfBlob;
    const nombre = row[0] || 'Documento';
    
    if (PDF_CONFIG.TEMPLATE_DOC_ID) {
      // Copiar template y reemplazar marcadores
      const templateDoc = DriveApp.getFileById(PDF_CONFIG.TEMPLATE_DOC_ID);
      const copy = templateDoc.makeCopy('Temp_' + nombre, folder);
      const doc = DocumentApp.openById(copy.getId());
      const body = doc.getBody();
      
      headers.forEach((header, idx) => {
        body.replaceText('{{' + header + '}}', row[idx] || '');
      });
      
      doc.saveAndClose();
      pdfBlob = copy.getAs('application/pdf');
      pdfBlob.setName(nombre + '.pdf');
      DriveApp.removeFile(copy); // Eliminar copia temporal
    } else {
      // Generar HTML → PDF sin template
      const campos = headers.map((h, idx) => 
        '<tr><td style="padding:8px;font-weight:bold;background:#f1f5f9;">' + h + '</td><td style="padding:8px;">' + (row[idx] || '') + '</td></tr>'
      ).join('');
      
      const html = \`
      <html><head><style>
        body { font-family: Arial; padding: 40px; }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        td { border: 1px solid #e2e8f0; }
        .footer { text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px; }
      </style></head><body>
        <div class="header">
          <h1>\${nombre}</h1>
          <p>Documento generado automáticamente</p>
        </div>
        <table>\${campos}</table>
        <div class="footer">
          <p>Generado por AutoFlow Studio - \${new Date().toLocaleDateString('es-AR')}</p>
        </div>
      </body></html>\`;
      
      pdfBlob = HtmlService.createHtmlOutput(html).getBlob().getAs('application/pdf');
      pdfBlob.setName(nombre + '.pdf');
    }
    
    // Guardar PDF en Drive
    const pdfFile = folder.createFile(pdfBlob);
    
    // Enviar por email si está configurado
    const emailIdx = headers.indexOf('Email') !== -1 ? headers.indexOf('Email') : headers.indexOf('email');
    if (PDF_CONFIG.SEND_EMAIL && emailIdx !== -1 && row[emailIdx]) {
      GmailApp.sendEmail(row[emailIdx], 'Tu documento: ' + nombre, '', {
        htmlBody: '<p>Hola ' + nombre + ',</p><p>Adjuntamos tu documento PDF.</p><p>Saludos,<br>AutoFlow Studio</p>',
        attachments: [pdfBlob],
        name: 'AutoFlow Studio'
      });
    }
    
    // Marcar como generado
    const estadoIdx = headers.indexOf('Estado');
    if (estadoIdx !== -1) {
      sheet.getRange(i + 1, estadoIdx + 1).setValue('✅ Generado');
    }
    sheet.getRange(i + 1, headers.length + 1).setValue(pdfFile.getUrl());
    generados++;
  }
  
  SpreadsheetApp.getUi().alert(\`Se generaron \${generados} PDFs en la carpeta "\${PDF_CONFIG.OUTPUT_FOLDER_NAME}".\`);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('📄 Generar PDFs', 'generarPDFs')
    .addItem('📁 Abrir Carpeta PDFs', 'abrirCarpeta')
    .addToUi();
}

function abrirCarpeta() {
  const folders = DriveApp.getFoldersByName(PDF_CONFIG.OUTPUT_FOLDER_NAME);
  if (folders.hasNext()) {
    const url = folders.next().getUrl();
    const html = HtmlService.createHtmlOutput('<script>window.open("' + url + '");google.script.host.close();</script>');
    SpreadsheetApp.getUi().showModalDialog(html, 'Abriendo carpeta...');
  }
}`,
    guide: [
      {
        step: 1,
        title: "Preparar la Hoja de Datos",
        description:
          'Crea una hoja llamada "Datos" con los campos que quieras en el PDF (ej: Nombre, Email, Curso, Fecha). Agrega una columna "Estado" al final.',
      },
      {
        step: 2,
        title: "Template Opcional (Google Doc)",
        description:
          'Crea un Google Doc con marcadores {{Nombre}}, {{Curso}}, etc. Copia su ID de la URL y pégalo en TEMPLATE_DOC_ID. Si no usas template, se genera un PDF automático.',
      },
      {
        step: 3,
        title: "Pegar el Script",
        description:
          "Ve a Extensiones → Apps Script, pega el código y guarda.",
      },
      {
        step: 4,
        title: "Generar PDFs",
        description:
          'Usa el menú "🚀 AutoFlow → Generar PDFs". Se crean en una carpeta de Drive y se envían por email si hay columna Email.',
      },
      {
        step: 5,
        title: "Verificar",
        description:
          'La columna "Estado" se marcará como "✅ Generado" y la última columna tendrá el link al PDF en Drive.',
      },
    ],
    explanation:
      "Genera documentos PDF profesionales desde datos en Google Sheets. Usa un template de Google Docs con marcadores o genera PDFs automáticos con diseño. Opcionalmente envía cada PDF por email.",
  },
  "inventory-control": {
    code: `/**
 * AutoFlow Studio - Control de Inventario con Alertas
 * Gestión de stock con notificaciones automáticas
 */

const INVENTORY_CONFIG = {
  SHEET_PRODUCTOS: 'Inventario',
  SHEET_MOVIMIENTOS: 'Movimientos',
  ALERT_EMAIL: '', // Email para recibir alertas (dejar vacío para usar el del usuario)
  STOCK_MINIMO_DEFAULT: 10,
};

/**
 * Registra una entrada o salida de stock
 */
function registrarMovimiento() {
  const ui = SpreadsheetApp.getUi();
  
  const producto = ui.prompt('📦 Producto', 'Nombre del producto:', ui.ButtonSet.OK_CANCEL);
  if (producto.getSelectedButton() !== ui.Button.OK) return;
  
  const tipo = ui.prompt('📊 Tipo', 'Ingrese "entrada" o "salida":', ui.ButtonSet.OK_CANCEL);
  if (tipo.getSelectedButton() !== ui.Button.OK) return;
  
  const cantidad = ui.prompt('🔢 Cantidad', 'Cantidad:', ui.ButtonSet.OK_CANCEL);
  if (cantidad.getSelectedButton() !== ui.Button.OK) return;
  
  const cantidadNum = parseInt(cantidad.getResponseText());
  const tipoMov = tipo.getResponseText().toLowerCase().trim();
  
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    ui.alert('❌ Cantidad inválida');
    return;
  }
  
  // Registrar en hoja de movimientos
  let movSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVENTORY_CONFIG.SHEET_MOVIMIENTOS);
  if (!movSheet) {
    movSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(INVENTORY_CONFIG.SHEET_MOVIMIENTOS);
    movSheet.appendRow(['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Usuario']);
    movSheet.getRange(1, 1, 1, 5).setBackground('#6366f1').setFontColor('white').setFontWeight('bold');
  }
  
  movSheet.appendRow([
    new Date(),
    producto.getResponseText(),
    tipoMov === 'entrada' ? '📥 Entrada' : '📤 Salida',
    cantidadNum,
    Session.getActiveUser().getEmail()
  ]);
  
  // Actualizar stock en inventario
  actualizarStock(producto.getResponseText(), tipoMov === 'entrada' ? cantidadNum : -cantidadNum);
  
  ui.alert('✅ Movimiento registrado: ' + tipoMov + ' de ' + cantidadNum + ' unidades de ' + producto.getResponseText());
}

/**
 * Actualiza el stock de un producto
 */
function actualizarStock(nombreProducto, cambio) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVENTORY_CONFIG.SHEET_PRODUCTOS);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(INVENTORY_CONFIG.SHEET_PRODUCTOS);
    sheet.appendRow(['Producto', 'Stock Actual', 'Stock Mínimo', 'Estado', 'Última Actualización']);
    sheet.getRange(1, 1, 1, 5).setBackground('#6366f1').setFontColor('white').setFontWeight('bold');
  }
  
  const data = sheet.getDataRange().getValues();
  let encontrado = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === nombreProducto.toLowerCase()) {
      const nuevoStock = (data[i][1] || 0) + cambio;
      const stockMinimo = data[i][2] || INVENTORY_CONFIG.STOCK_MINIMO_DEFAULT;
      
      sheet.getRange(i + 1, 2).setValue(Math.max(0, nuevoStock));
      sheet.getRange(i + 1, 4).setValue(nuevoStock <= stockMinimo ? '⚠️ BAJO' : '✅ OK');
      sheet.getRange(i + 1, 5).setValue(new Date());
      
      // Color condicional
      if (nuevoStock <= stockMinimo) {
        sheet.getRange(i + 1, 1, 1, 5).setBackground('#fef2f2');
      } else {
        sheet.getRange(i + 1, 1, 1, 5).setBackground('white');
      }
      
      // Alerta si stock bajo
      if (nuevoStock <= stockMinimo && nuevoStock >= 0) {
        enviarAlertaStock(nombreProducto, nuevoStock, stockMinimo);
      }
      
      encontrado = true;
      break;
    }
  }
  
  if (!encontrado) {
    const nuevoStock = Math.max(0, cambio);
    sheet.appendRow([nombreProducto, nuevoStock, INVENTORY_CONFIG.STOCK_MINIMO_DEFAULT, nuevoStock <= INVENTORY_CONFIG.STOCK_MINIMO_DEFAULT ? '⚠️ BAJO' : '✅ OK', new Date()]);
  }
}

/**
 * Envía alerta por email cuando el stock está bajo
 */
function enviarAlertaStock(producto, stockActual, stockMinimo) {
  const email = INVENTORY_CONFIG.ALERT_EMAIL || Session.getActiveUser().getEmail();
  
  GmailApp.sendEmail(email, '⚠️ Alerta de Stock Bajo: ' + producto, '', {
    htmlBody: \`
    <div style="font-family: Arial; max-width: 500px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ef4444, #f97316); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0;">⚠️ Stock Bajo</h2>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e2e8f0;">
        <p><strong>Producto:</strong> \${producto}</p>
        <p><strong>Stock Actual:</strong> <span style="color: #ef4444; font-size: 24px; font-weight: bold;">\${stockActual}</span></p>
        <p><strong>Stock Mínimo:</strong> \${stockMinimo}</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Alerta generada por AutoFlow Studio</p>
      </div>
    </div>\`,
    name: 'AutoFlow - Inventario'
  });
}

/**
 * Genera reporte de inventario
 */
function generarReporteInventario() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVENTORY_CONFIG.SHEET_PRODUCTOS);
  if (!sheet || sheet.getLastRow() <= 1) {
    SpreadsheetApp.getUi().alert('No hay datos de inventario aún.');
    return;
  }
  
  const data = sheet.getDataRange().getValues().slice(1);
  const bajos = data.filter(r => r[3] === '⚠️ BAJO');
  const total = data.reduce((sum, r) => sum + (r[1] || 0), 0);
  
  SpreadsheetApp.getUi().alert(
    '📊 Reporte de Inventario\\n\\n' +
    'Total productos: ' + data.length + '\\n' +
    'Total unidades: ' + total + '\\n' +
    'Productos con stock bajo: ' + bajos.length + '\\n' +
    (bajos.length > 0 ? '\\n⚠️ Bajo stock: ' + bajos.map(r => r[0]).join(', ') : '\\n✅ Todo el inventario está OK')
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('📦 Registrar Movimiento', 'registrarMovimiento')
    .addItem('📊 Ver Reporte', 'generarReporteInventario')
    .addToUi();
}`,
    guide: [
      {
        step: 1,
        title: "Pegar el Script",
        description:
          "Abre una Google Sheet → Extensiones → Apps Script → Pega el código. Guarda.",
      },
      {
        step: 2,
        title: "Configurar Email de Alertas",
        description:
          'En el código, modifica ALERT_EMAIL con tu email para recibir alertas de stock bajo. Si lo dejas vacío, usa el email de tu cuenta.',
      },
      {
        step: 3,
        title: "Registrar Productos",
        description:
          'Usa el menú "🚀 AutoFlow → Registrar Movimiento" para agregar entradas y salidas de stock. Las hojas se crean automáticamente.',
      },
      {
        step: 4,
        title: "Alertas Automáticas",
        description:
          "Cuando un producto baja del stock mínimo (10 por defecto), recibirás un email de alerta. Las filas se pintan en rojo.",
      },
      {
        step: 5,
        title: "Ver Reporte",
        description:
          'Usa "Ver Reporte" para un resumen rápido del inventario y los productos con stock bajo.',
      },
    ],
    explanation:
      "Sistema de control de inventario completo en Google Sheets. Registra entradas/salidas, controla stock mínimo, envía alertas por email cuando un producto está bajo y genera reportes.",
  },
  "auto-reminders": {
    code: `/**
 * AutoFlow Studio - Recordatorios Automáticos por Email
 * Envía recordatorios antes de fechas de vencimiento
 */

const REMINDER_CONFIG = {
  SHEET_NAME: 'Vencimientos',
  DIAS_ANTES: [7, 3, 1, 0], // Enviar recordatorio 7, 3, 1 y 0 días antes
  CHECK_HORA: 9, // Hora del día para revisar (9 AM)
};

/**
 * Revisa vencimientos y envía recordatorios
 */
function revisarVencimientos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REMINDER_CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Crea una hoja "' + REMINDER_CONFIG.SHEET_NAME + '" con columnas: Tarea | Responsable (Email) | Fecha Vencimiento | Estado');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let enviados = 0;
  
  for (let i = 1; i < data.length; i++) {
    const tarea = data[i][0];
    const email = data[i][1];
    const fechaVenc = new Date(data[i][2]);
    const estado = data[i][3] || '';
    
    if (!email || !fechaVenc || estado === '✅ Completado') continue;
    
    fechaVenc.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
    
    // Verificar si hoy corresponde enviar recordatorio
    if (REMINDER_CONFIG.DIAS_ANTES.includes(diasRestantes)) {
      const urgencia = diasRestantes <= 0 ? '🔴 VENCIDO' : diasRestantes <= 1 ? '🟠 MAÑANA' : diasRestantes <= 3 ? '🟡 PRONTO' : '🔵 PRÓXIMO';
      const colorBg = diasRestantes <= 0 ? '#ef4444' : diasRestantes <= 1 ? '#f97316' : diasRestantes <= 3 ? '#eab308' : '#6366f1';
      
      GmailApp.sendEmail(email, \`\${urgencia} Recordatorio: \${tarea}\`, '', {
        htmlBody: \`
        <div style="font-family: Arial; max-width: 500px; margin: 0 auto;">
          <div style="background: \${colorBg}; padding: 24px; border-radius: 12px 12px 0 0; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 32px;">\${diasRestantes <= 0 ? '⏰' : '📅'}</h1>
            <h2 style="margin: 8px 0 0;">\${urgencia}</h2>
          </div>
          <div style="background: #fff; padding: 24px; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0;">\${tarea}</h3>
            <p><strong>Fecha de vencimiento:</strong> \${fechaVenc.toLocaleDateString('es-AR')}</p>
            <p><strong>Días restantes:</strong> \${diasRestantes <= 0 ? 'VENCIDO' : diasRestantes + ' día(s)'}</p>
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 16px;">
              <p style="margin: 0; color: #64748b; font-size: 13px;">
                \${diasRestantes <= 0 
                  ? '⚡ Esta tarea ya venció. Por favor completala lo antes posible.' 
                  : diasRestantes === 1 
                    ? '⚡ Esta tarea vence mañana. ¡No te olvides!'
                    : '📌 Te enviamos este recordatorio para que puedas planificarte.'}
              </p>
            </div>
          </div>
          <div style="text-align: center; padding: 16px;">
            <p style="color: #94a3b8; font-size: 11px;">AutoFlow Studio - Recordatorios Automáticos</p>
          </div>
        </div>\`,
        name: 'AutoFlow Recordatorios'
      });
      
      // Registrar envío
      const logCol = headers.length + 1;
      const prevLog = sheet.getRange(i + 1, logCol).getValue() || '';
      sheet.getRange(i + 1, logCol).setValue(prevLog + (prevLog ? '\\n' : '') + '📧 ' + new Date().toLocaleDateString('es-AR') + ' (' + diasRestantes + 'd)');
      enviados++;
    }
    
    // Colorear fila según urgencia
    if (diasRestantes <= 0) {
      sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#fef2f2');
    } else if (diasRestantes <= 3) {
      sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#fffbeb');
    }
  }
  
  if (enviados > 0) Logger.log('Se enviaron ' + enviados + ' recordatorios.');
}

/**
 * Activa la revisión diaria automática
 */
function activarRecordatorios() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'revisarVencimientos') ScriptApp.deleteTrigger(t);
  });
  
  ScriptApp.newTrigger('revisarVencimientos')
    .timeBased()
    .atHour(REMINDER_CONFIG.CHECK_HORA)
    .everyDays(1)
    .create();
  
  SpreadsheetApp.getUi().alert('✅ Recordatorios activados. Se revisarán cada día a las ' + REMINDER_CONFIG.CHECK_HORA + ':00 AM.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('▶ Activar Recordatorios Diarios', 'activarRecordatorios')
    .addItem('🔍 Revisar Ahora', 'revisarVencimientos')
    .addToUi();
}`,
    guide: [
      {
        step: 1,
        title: "Crear la Hoja de Vencimientos",
        description:
          'Crea una hoja "Vencimientos" con columnas: A = Tarea, B = Email del responsable, C = Fecha de vencimiento, D = Estado.',
      },
      {
        step: 2,
        title: "Pegar el Script",
        description:
          "Extensiones → Apps Script → Pega el código y guarda.",
      },
      {
        step: 3,
        title: "Activar Recordatorios",
        description:
          'Menú "🚀 AutoFlow → Activar Recordatorios Diarios". Se enviará un email a las 9 AM todos los días si hay vencimientos próximos.',
      },
      {
        step: 4,
        title: "Personalizar",
        description:
          "En DIAS_ANTES puedes cambiar cuántos días antes se envían alertas. Por defecto: 7, 3, 1 y 0 (día del vencimiento).",
      },
      {
        step: 5,
        title: "Completar Tareas",
        description:
          'Marca "✅ Completado" en la columna Estado para dejar de recibir recordatorios de esa tarea.',
      },
    ],
    explanation:
      "Envía recordatorios automáticos por email antes de que venzan tareas o plazos. Configura los días de anticipación y el sistema se encarga de avisar. Ideal para vencimientos, renovaciones, pagos y más.",
  },
  "forms-crm": {
    code: `/**
 * AutoFlow Studio - Google Forms → CRM Organizado
 * Convierte respuestas de formularios en un CRM funcional
 */

const CRM_CONFIG = {
  SHEET_RESPUESTAS: 'Respuestas',
  SHEET_CRM: 'CRM',
  SHEET_STATS: 'Estadísticas',
  EMAIL_NOTIFICACION: '', // Email para notificar nuevos leads (vacío = email del usuario)
  ESTADOS: ['🆕 Nuevo', '📞 Contactado', '💬 En Negociación', '💰 Cerrado', '❌ Perdido'],
};

/**
 * Se ejecuta automáticamente cuando llega una respuesta del formulario
 */
function onFormSubmit(e) {
  const respuestas = e.namedValues;
  
  // Obtener o crear hoja CRM
  let crmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CRM_CONFIG.SHEET_CRM);
  if (!crmSheet) {
    crmSheet = crearHojaCRM();
  }
  
  // Extraer datos del lead
  const nombre = respuestas['Nombre'] ? respuestas['Nombre'][0] : 'Sin nombre';
  const email = respuestas['Email'] ? respuestas['Email'][0] : '';
  const telefono = respuestas['Teléfono'] ? respuestas['Teléfono'][0] : respuestas['Telefono'] ? respuestas['Telefono'][0] : '';
  const consulta = Object.entries(respuestas)
    .filter(([key]) => !['Nombre', 'Email', 'Teléfono', 'Telefono', 'Timestamp'].includes(key))
    .map(([key, val]) => key + ': ' + val[0])
    .join(' | ');
  
  // Agregar al CRM
  const nuevaFila = [
    new Date(), // Fecha
    nombre,
    email,
    telefono,
    consulta,
    CRM_CONFIG.ESTADOS[0], // Estado: Nuevo
    '', // Notas
    '', // Próximo seguimiento
    Session.getActiveUser().getEmail(), // Asignado
  ];
  
  crmSheet.appendRow(nuevaFila);
  
  // Formato condicional para nuevo lead
  const lastRow = crmSheet.getLastRow();
  crmSheet.getRange(lastRow, 1, 1, nuevaFila.length).setBackground('#eff6ff');
  
  // Notificar por email
  enviarNotificacionNuevoLead(nombre, email, telefono, consulta);
  
  // Actualizar estadísticas
  actualizarEstadisticas();
}

/**
 * Crea la hoja CRM con formato profesional
 */
function crearHojaCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const crmSheet = ss.insertSheet(CRM_CONFIG.SHEET_CRM);
  
  const headers = ['Fecha', 'Nombre', 'Email', 'Teléfono', 'Consulta/Interés', 'Estado', 'Notas', 'Próximo Seguimiento', 'Asignado'];
  crmSheet.appendRow(headers);
  
  // Formato de header
  const headerRange = crmSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#6366f1').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');
  
  // Anchos de columna
  crmSheet.setColumnWidth(1, 120);
  crmSheet.setColumnWidth(2, 150);
  crmSheet.setColumnWidth(3, 200);
  crmSheet.setColumnWidth(4, 130);
  crmSheet.setColumnWidth(5, 300);
  crmSheet.setColumnWidth(6, 150);
  crmSheet.setColumnWidth(7, 250);
  crmSheet.setColumnWidth(8, 130);
  crmSheet.setColumnWidth(9, 150);
  
  // Validación de datos para Estado
  const estadoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CRM_CONFIG.ESTADOS)
    .setAllowInvalid(false)
    .build();
  crmSheet.getRange(2, 6, 500, 1).setDataValidation(estadoRule);
  
  // Freezar header
  crmSheet.setFrozenRows(1);
  
  return crmSheet;
}

/**
 * Notifica por email cuando llega un nuevo lead
 */
function enviarNotificacionNuevoLead(nombre, email, telefono, consulta) {
  const destino = CRM_CONFIG.EMAIL_NOTIFICACION || Session.getActiveUser().getEmail();
  
  GmailApp.sendEmail(destino, '🆕 Nuevo Lead: ' + nombre, '', {
    htmlBody: \`
    <div style="font-family: Arial; max-width: 500px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10b981, #06b6d4); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0;">🆕 Nuevo Lead</h2>
        <p style="margin: 4px 0 0; opacity: 0.9;">Recibido desde Google Forms</p>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e2e8f0;">
        <table style="width: 100%;">
          <tr><td style="padding: 8px; color: #64748b;">Nombre</td><td style="padding: 8px; font-weight: bold;">\${nombre}</td></tr>
          <tr><td style="padding: 8px; color: #64748b;">Email</td><td style="padding: 8px;">\${email}</td></tr>
          <tr><td style="padding: 8px; color: #64748b;">Teléfono</td><td style="padding: 8px;">\${telefono || 'No proporcionado'}</td></tr>
          <tr><td style="padding: 8px; color: #64748b;">Consulta</td><td style="padding: 8px;">\${consulta}</td></tr>
        </table>
      </div>
    </div>\`,
    name: 'AutoFlow CRM'
  });
}

/**
 * Actualiza hoja de estadísticas
 */
function actualizarEstadisticas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const crmSheet = ss.getSheetByName(CRM_CONFIG.SHEET_CRM);
  if (!crmSheet || crmSheet.getLastRow() <= 1) return;
  
  let statsSheet = ss.getSheetByName(CRM_CONFIG.SHEET_STATS);
  if (!statsSheet) {
    statsSheet = ss.insertSheet(CRM_CONFIG.SHEET_STATS);
  }
  statsSheet.clear();
  
  const data = crmSheet.getDataRange().getValues().slice(1);
  
  statsSheet.appendRow(['📊 Estadísticas del CRM']);
  statsSheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  statsSheet.appendRow(['Actualizado: ' + new Date().toLocaleString('es-AR')]);
  statsSheet.appendRow(['']);
  
  statsSheet.appendRow(['Estado', 'Cantidad', 'Porcentaje']);
  statsSheet.getRange(4, 1, 1, 3).setBackground('#6366f1').setFontColor('white').setFontWeight('bold');
  
  CRM_CONFIG.ESTADOS.forEach(estado => {
    const count = data.filter(r => r[5] === estado).length;
    const pct = data.length > 0 ? ((count / data.length) * 100).toFixed(1) + '%' : '0%';
    statsSheet.appendRow([estado, count, pct]);
  });
  
  statsSheet.appendRow(['']);
  statsSheet.appendRow(['Total Leads', data.length]);
  statsSheet.getRange(statsSheet.getLastRow(), 1, 1, 2).setFontWeight('bold');
}

/**
 * Configura el trigger automático para Google Forms
 */
function configurarTriggerFormulario() {
  // Verificar si hay formulario vinculado
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Eliminar triggers anteriores
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
  
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  
  // Crear hoja CRM si no existe
  if (!ss.getSheetByName(CRM_CONFIG.SHEET_CRM)) {
    crearHojaCRM();
  }
  
  SpreadsheetApp.getUi().alert('✅ CRM configurado. Cada nueva respuesta del formulario se procesará automáticamente.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('⚙️ Configurar CRM para Formulario', 'configurarTriggerFormulario')
    .addItem('📊 Actualizar Estadísticas', 'actualizarEstadisticas')
    .addToUi();
}`,
    guide: [
      {
        step: 1,
        title: "Crear un Google Forms",
        description:
          'Crea un formulario con los campos que necesites (al menos: Nombre y Email). Vincúlalo a una Google Sheet (Respuestas → Crear hoja).',
      },
      {
        step: 2,
        title: "Abrir la Sheet y Pegar el Script",
        description:
          "En la hoja vinculada al formulario → Extensiones → Apps Script → Pega el código.",
      },
      {
        step: 3,
        title: "Configurar el CRM",
        description:
          'Menú "🚀 AutoFlow → Configurar CRM para Formulario". Esto crea la hoja CRM y activa el trigger automático.',
      },
      {
        step: 4,
        title: "Recibir Leads",
        description:
          'Cada respuesta del formulario se agrega automáticamente al CRM con estado "🆕 Nuevo" y te envía un email de notificación.',
      },
      {
        step: 5,
        title: "Gestionar Pipeline",
        description:
          'Usa el dropdown de Estado en la hoja CRM para mover leads: Nuevo → Contactado → En Negociación → Cerrado. La hoja "Estadísticas" se actualiza automáticamente.',
      },
    ],
    explanation:
      "Convierte las respuestas de Google Forms en un CRM completo. Cada nuevo lead se registra automáticamente, te notifica por email y puedes gestionar el pipeline de ventas con estados configurables.",
  },
};

// ============================================================
// Script generation (mock with smart templates)
// ============================================================

export async function generateAppsScript(
  templateType: string,
  customPrompt?: string
): Promise<ScriptGenerationResult> {
  // Check for API key to use real LLM
  const apiKey =
    process.env.OPENAI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (apiKey && customPrompt) {
    // TODO: Implement real LLM call when API key is available
    // For now, fall through to mock
  }

  // Use mock templates
  if (templateType in SCRIPT_TEMPLATES) {
    return SCRIPT_TEMPLATES[templateType];
  }

  // Custom prompt - generate a basic template
  return {
    code: `/**
 * AutoFlow Studio - Script Personalizado
 * Prompt: ${customPrompt || "Sin prompt especificado"}
 * 
 * NOTA: Este es un template base. Con una API key de OpenAI o Gemini
 * configurada, se generará código específico para tu necesidad.
 */

function main() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('🚀 AutoFlow Studio', 
    'Tu script personalizado está listo.\\n\\n' +
    'Modifica esta función según tu necesidad:\\n' +
    '${customPrompt?.replace(/'/g, "\\'")}', 
    ui.ButtonSet.OK);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 AutoFlow')
    .addItem('Ejecutar Script', 'main')
    .addToUi();
}`,
    guide: [
      {
        step: 1,
        title: "Abrir Apps Script",
        description: "Extensiones → Apps Script en tu Google Sheet.",
      },
      {
        step: 2,
        title: "Pegar y Personalizar",
        description:
          "Pega el código y modifica la función main() según tu necesidad.",
      },
      {
        step: 3,
        title: "Ejecutar",
        description: "Guarda, ejecuta y autoriza los permisos necesarios.",
      },
    ],
    explanation:
      "Template base para tu automatización personalizada. Configura una API key para generar código específico con IA.",
  };
}

// ============================================================
// Web builder chat (mock AI conversation)
// ============================================================

const WEB_BUILDER_RESPONSES: Record<string, { message: string; stateUpdate: Partial<WebProjectState> }> = {
  greeting: {
    message:
      "¡Hola! 👋 Soy tu asistente de diseño web. Vamos a crear la landing page perfecta para tu negocio.\n\n**¿Cómo se llama tu negocio y a qué se dedica?**\n\nPor ejemplo: *\"TechSolutions - Empresa de desarrollo de software\"*",
    stateUpdate: {},
  },
};

export async function processWebChatMessage(
  userMessage: string,
  currentState: WebProjectState,
  messageHistory: ChatMessage[]
): Promise<{ message: string; stateUpdate: Partial<WebProjectState> }> {
  const msgLower = userMessage.toLowerCase();
  const messageCount = messageHistory.filter((m) => m.role === "user").length;

  // Intelligent mock responses based on conversation flow
  if (messageCount === 0) {
    // First message - extract business name
    const businessName = userMessage.split("-")[0]?.trim() || userMessage.trim();
    const niche = userMessage.split("-")[1]?.trim() || "servicios profesionales";

    return {
      message: `¡Excelente! **${businessName}** suena genial. ${niche ? `Veo que se dedican a ${niche}.` : ""}\n\nAhora necesito saber:\n\n**¿Qué secciones te gustaría incluir en tu landing page?**\n\n1. 🏠 Hero (presentación principal)\n2. 💼 Servicios\n3. ⭐ Testimonios de clientes\n4. 📧 Formulario de contacto\n5. 🔗 Todas las anteriores\n\n*Puedes elegir varias o decirme "todas"*`,
      stateUpdate: {
        businessName,
        niche,
        heroTitle: `Bienvenido a ${businessName}`,
        heroSubtitle: `Expertos en ${niche}`,
        footerText: `© ${new Date().getFullYear()} ${businessName}. Todos los derechos reservados.`,
      },
    };
  }

  if (messageCount === 1) {
    // Second message - sections selection
    const allSections = msgLower.includes("todas") || msgLower.includes("5") || msgLower.includes("all");
    const sections: string[] = [];

    if (allSections || msgLower.includes("hero") || msgLower.includes("1")) sections.push("hero");
    if (allSections || msgLower.includes("servicio") || msgLower.includes("2")) sections.push("services");
    if (allSections || msgLower.includes("testimonio") || msgLower.includes("3")) sections.push("testimonials");
    if (allSections || msgLower.includes("contacto") || msgLower.includes("4")) sections.push("contact");

    if (sections.length === 0) sections.push("hero", "services", "contact");

    return {
      message: `Perfecto, vamos a incluir: ${sections.map((s) => `**${s}**`).join(", ")}.\n\n¡Ahora la parte divertida! **¿Qué estilo de colores prefieres?**\n\n🎨 **Opciones:**\n- 🔵 **Profesional**: Azules y grises elegantes\n- 🟣 **Moderno**: Violetas y gradientes vibrantes\n- 🟢 **Natural**: Verdes y tonos tierra\n- 🔴 **Bold**: Rojos y naranjas energéticos\n- 🌙 **Dark Premium**: Oscuro con acentos neón\n\n*O describe tu propia paleta de colores*`,
      stateUpdate: {
        sections,
        contactEnabled: sections.includes("contact"),
      },
    };
  }

  if (messageCount === 2) {
    // Third message - color palette
    let palette = { ...currentState.colorPalette };

    if (msgLower.includes("profesional") || msgLower.includes("azul")) {
      palette = { primary: "#2563eb", secondary: "#1e40af", accent: "#06b6d4", background: "#0f172a", text: "#f8fafc" };
    } else if (msgLower.includes("moderno") || msgLower.includes("violeta") || msgLower.includes("morado")) {
      palette = { primary: "#8b5cf6", secondary: "#6366f1", accent: "#ec4899", background: "#0f0a1e", text: "#f8fafc" };
    } else if (msgLower.includes("natural") || msgLower.includes("verde")) {
      palette = { primary: "#16a34a", secondary: "#15803d", accent: "#eab308", background: "#052e16", text: "#f0fdf4" };
    } else if (msgLower.includes("bold") || msgLower.includes("rojo")) {
      palette = { primary: "#ef4444", secondary: "#f97316", accent: "#fbbf24", background: "#1c1917", text: "#fef2f2" };
    } else if (msgLower.includes("dark") || msgLower.includes("oscuro") || msgLower.includes("neón") || msgLower.includes("neon")) {
      palette = { primary: "#06b6d4", secondary: "#8b5cf6", accent: "#22d3ee", background: "#020617", text: "#e2e8f0" };
    }

    return {
      message: `¡Me encanta esa elección! Ya puedes ver los colores en la preview. 🎨\n\n**Ahora, cuéntame sobre tus servicios.** ¿Cuáles son los 3 servicios principales que ofreces?\n\n*Formato sugerido:*\n- Servicio 1: Descripción breve\n- Servicio 2: Descripción breve\n- Servicio 3: Descripción breve`,
      stateUpdate: {
        colorPalette: palette,
      },
    };
  }

  if (messageCount === 3) {
    // Fourth message - services
    const lines = userMessage.split("\n").filter((l) => l.trim().length > 0);
    const icons = ["Zap", "Shield", "Star", "Rocket", "Globe", "Code"];
    const services = lines.map((line, i) => {
      const parts = line.replace(/^[-•*\d.)\s]+/, "").split(":");
      return {
        title: parts[0]?.trim() || `Servicio ${i + 1}`,
        description: parts[1]?.trim() || line.trim(),
        icon: icons[i] || "Star",
      };
    });

    if (services.length === 0) {
      services.push(
        { title: "Consultoría", description: "Asesoramiento profesional personalizado", icon: "Zap" },
        { title: "Implementación", description: "Desarrollo y puesta en marcha", icon: "Code" },
        { title: "Soporte", description: "Asistencia continua 24/7", icon: "Shield" }
      );
    }

    return {
      message: `¡Genial! Ya agregué ${services.length} servicios a tu landing page. 🚀\n\nMira la preview actualizada →\n\n**Tu landing page está casi lista.** ¿Deseas hacer algún ajuste o estás listo para finalizar?\n\n- 📝 *\"Quiero cambiar el título\"*\n- 🎨 *\"Cambiar colores\"*\n- ✅ *\"Finalizar\"* - Guarda el proyecto y solicita cotización`,
      stateUpdate: {
        services,
      },
    };
  }

  // Handle finalization
  if (msgLower.includes("finalizar") || msgLower.includes("listo") || msgLower.includes("terminar")) {
    return {
      message: `🎉 **¡Tu landing page está lista!**\n\nResumen del proyecto:\n- **Negocio:** ${currentState.businessName}\n- **Secciones:** ${currentState.sections.join(", ")}\n- **Servicios:** ${currentState.services.length} configurados\n\nPara continuar con el desarrollo final, haz clic en **"Finalizar y Solicitar Cotización"** abajo.\n\nNuestro equipo te contactará con el presupuesto final. ¡Gracias por usar AutoFlow Studio! 🚀`,
      stateUpdate: {},
    };
  }

  // Handle title changes
  if (msgLower.includes("título") || msgLower.includes("titulo")) {
    const newTitle = userMessage.replace(/.*(?:título|titulo)[:\s]*/i, "").trim() || currentState.heroTitle;
    return {
      message: `¡Listo! Título actualizado a: **"${newTitle}"**\n\n¿Algo más que quieras ajustar o **finalizamos**?`,
      stateUpdate: { heroTitle: newTitle },
    };
  }

  // Default response
  return {
    message: `Entendido. He aplicado tu feedback al diseño.\n\n¿Algo más que quieras ajustar? Cuando estés listo, dime **"finalizar"** para guardar el proyecto y solicitar la cotización final.`,
    stateUpdate: {},
  };
}

export { DEFAULT_WEB_STATE };
export type { WebProjectState as WebState };
