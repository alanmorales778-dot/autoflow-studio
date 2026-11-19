import Link from 'next/link';
import Logo from '../logo';

export const metadata = { title: 'Términos y privacidad — AutoFlow' };

const CONTACT = 'alan.morales778@gmail.com';

export default function Legal() {
  return (
    <>
      <header className="topbar">
        <div className="container"><Logo /><Link href="/" className="btn secondary small">Volver al inicio</Link></div>
      </header>
      <main className="container page" style={{ maxWidth: 760 }}>
        <h1>Términos de uso y política de privacidad</h1>
        <p className="muted">Última actualización: 17 de noviembre de 2026.</p>

        <nav className="card" aria-label="Índice" style={{ fontSize: 14 }}>
          <strong>En esta página</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li><a href="#servicio">El servicio</a></li>
            <li><a href="#cuenta">Tu cuenta y uso aceptable</a></li>
            <li><a href="#pagos">Prueba, pagos y cancelación</a></li>
            <li><a href="#roles">Quién es responsable de cada dato</a></li>
            <li><a href="#datos">Datos que tratamos y para qué</a></li>
            <li><a href="#salud">Alergias y restricciones alimentarias</a></li>
            <li><a href="#proveedores">Proveedores que usamos</a></li>
            <li><a href="#google">Acceso a Google Drive</a></li>
            <li><a href="#seguridad">Seguridad y conservación</a></li>
            <li><a href="#derechos">Tus derechos</a></li>
            <li><a href="#responsabilidad">Responsabilidad</a></li>
            <li><a href="#cambios">Cambios y contacto</a></li>
          </ol>
        </nav>

        <h2 id="servicio">1. El servicio</h2>
        <p>AutoFlow es un servicio de AutoFlow Studio que ayuda a negocios que trabajan por encargo, turno o reserva (cocina, belleza, regalos, talleres, alquileres y otros) a tomar pedidos online, administrar cupos de producción, cobrar señas, calcular costos y llevar el stock. Al crear una cuenta aceptás estos términos.</p>

        <h2 id="cuenta">2. Tu cuenta y uso aceptable</h2>
        <p>Sos responsable de la información que cargás, de mantener segura tu contraseña y de lo que pase desde tu cuenta. No podés usar el servicio para vender productos ilegales, enviar mensajes no solicitados ni cargar datos de terceros sin derecho a hacerlo. Podemos suspender cuentas que incumplan estas reglas, avisando antes salvo que haya un riesgo urgente.</p>

        <h2 id="pagos">3. Prueba, pagos y cancelación</h2>
        <p>Las cuentas nuevas tienen 14 días de prueba con todos los módulos, sin tarjeta. Después, la suscripción se cobra por mes y por adelantado con Mercado Pago, según los módulos elegidos. Los precios están en pesos e incluyen impuestos; si cambian, te avisamos con al menos 30 días de anticipación. Podés cancelar cuando quieras desde Mercado Pago o escribiéndonos: el servicio sigue activo hasta el fin del período pagado y no hay reintegros por períodos parciales. Las señas y pagos de tus clientes van directo a tu cuenta de Mercado Pago; AutoFlow no los retiene ni cobra comisión sobre ellos.</p>

        <h2 id="roles">4. Quién es responsable de cada dato</h2>
        <p>Para los datos de tu cuenta y de tu suscripción, AutoFlow Studio es el responsable. Para los datos de tus clientes (los que dejan al hacer un pedido), el responsable es tu negocio y AutoFlow actúa como encargado del tratamiento: los procesa solo para prestarte el servicio y siguiendo tus instrucciones. Tu negocio debe informar a sus clientes cómo usa sus datos.</p>

        <h2 id="datos">5. Datos que tratamos y para qué</h2>
        <ul>
          <li><strong>Tu cuenta:</strong> email, nombre del negocio, dirección de retiro y WhatsApp de contacto. Para darte acceso y mostrar tu catálogo.</li>
          <li><strong>Tu operación:</strong> productos o servicios, precios, insumos o materiales, recetas, cupos y stock. Para calcular costos, disponibilidad y producción.</li>
          <li><strong>Pedidos de tus clientes:</strong> nombre, teléfono, dirección de entrega si hay envío, detalle del pedido, notas como dedicatoria o detalle, foto de referencia y alergias o sensibilidades si las indican. Para preparar y entregar el pedido y cobrar la seña y el saldo.</li>
          <li><strong>Datos técnicos:</strong> registros de errores y de uso del servicio. Para mantenerlo funcionando y seguro.</li>
        </ul>
        <p>No vendemos datos ni los usamos para publicidad. Solo usamos cookies necesarias para mantener tu sesión iniciada.</p>

        <h2 id="salud">6. Alergias y restricciones alimentarias</h2>
        <p>Las alergias y restricciones que un cliente indica son datos de salud, que la ley considera sensibles. Se piden de forma opcional, se usan únicamente para preparar ese pedido de forma segura y solo los ve el negocio que recibe el pedido. El cliente puede pedir al negocio que los borre en cualquier momento.</p>

        <h2 id="proveedores">7. Proveedores que usamos</h2>
        <p>Para funcionar usamos: Supabase (base de datos, servidores en San Pablo, Brasil), Vercel (alojamiento), Mercado Pago (cobros), Meta (WhatsApp, solo si activás el bot), Google (tus planillas, solo si conectás Drive, y el envío de emails). Algunos de estos servicios guardan datos fuera de Argentina, en países con niveles de protección adecuados o bajo contratos que exigen protegerlos.</p>

        <h2 id="google">8. Acceso a Google Drive</h2>
        <p>Si conectás Google Drive, AutoFlow pide acceso únicamente a los archivos que la propia app crea en tu Drive (permiso «drive.file»). No puede ver ni modificar el resto de tus archivos. Usamos ese acceso solo para leer tus insumos, productos y stock, y para escribir las columnas calculadas por AutoFlow. Podés revocarlo cuando quieras desde tu cuenta de Google o desde Ajustes. El uso de la información recibida de las APIs de Google cumple la Política de datos de usuario de los servicios de API de Google, incluidos los requisitos de uso limitado.</p>

        <h2 id="seguridad">9. Seguridad y conservación</h2>
        <p>La información viaja cifrada. Las credenciales de Mercado Pago y WhatsApp que cargues se guardan cifradas y solo se usan para cobrar y enviar mensajes en nombre de tu negocio. Cada negocio solo puede ver sus propios datos. Conservamos tus datos mientras tengas la cuenta; si la das de baja, los borramos dentro de los 30 días, salvo lo que la ley nos obligue a guardar (por ejemplo, comprobantes de pago).</p>

        <h2 id="derechos">10. Tus derechos</h2>
        <p>Podés pedir acceso, corrección, actualización o eliminación de tus datos en cualquier momento, sin costo, escribiendo a <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Respondemos dentro de los 10 días hábiles. Si no quedás conforme, podés reclamar ante la Agencia de Acceso a la Información Pública (AAIP), autoridad de control de la Ley 25.326 de Protección de Datos Personales.</p>

        <h2 id="responsabilidad">11. Responsabilidad</h2>
        <p>AutoFlow calcula costos, márgenes y precios sugeridos con los datos que cargás: las decisiones de precio, la elaboración de los productos y la relación con tus clientes son responsabilidad de tu negocio. Trabajamos para que el servicio esté siempre disponible, pero puede haber interrupciones por mantenimiento o fallas de proveedores. En ningún caso nuestra responsabilidad supera lo que pagaste por el servicio en los últimos 3 meses.</p>

        <h2 id="cambios">12. Cambios y contacto</h2>
        <p>Si cambiamos estos términos de forma importante, te avisamos por email o dentro de la app antes de que rijan. Estos términos se rigen por las leyes de la República Argentina. Contacto: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </main>
      <footer className="footer"><div className="container">© {new Date().getFullYear()} AutoFlow</div></footer>
    </>
  );
}
