import Link from 'next/link';

export const metadata = { title: 'Términos y privacidad — AutoFlow Cocina' };

export default function Legal() {
  return (
    <main className="container page" style={{ maxWidth: 760 }}>
      <Link href="/">← Volver</Link>
      <h1 style={{ marginTop: 16 }}>Términos de uso y política de privacidad</h1>
      <p className="muted">Última actualización: noviembre de 2026.</p>

      <h2>Qué hace AutoFlow Cocina</h2>
      <p>AutoFlow Cocina es un servicio de AutoFlow Studio que ayuda a negocios gastronómicos a gestionar pedidos, cupos de producción, señas, costos y stock.</p>

      <h2>Datos que tratamos</h2>
      <p>Guardamos los datos de tu cuenta (email), los datos de tu negocio, tus productos, insumos y recetas, y los pedidos de tus clientes (nombre, teléfono, dirección de entrega y detalle del pedido). Usamos esos datos solo para prestar el servicio. No los vendemos ni los compartimos con terceros, salvo con los proveedores necesarios para funcionar (Supabase para la base de datos, Vercel para el alojamiento, Mercado Pago para los cobros, Meta para WhatsApp y Google para tus planillas).</p>

      <h2>Acceso a Google Drive</h2>
      <p>Si conectás Google Drive, AutoFlow pide acceso únicamente a los archivos que la propia app crea en tu Drive (permiso «drive.file»). No puede ver ni modificar el resto de tus archivos. Usamos ese acceso solo para leer tus insumos, productos y stock, y para escribir las columnas calculadas por AutoFlow. Podés revocar el acceso cuando quieras desde tu cuenta de Google o desde Configuración. El uso de la información recibida de las APIs de Google cumple la Política de datos de usuario de los servicios de API de Google, incluidos los requisitos de uso limitado.</p>

      <h2>Credenciales</h2>
      <p>Las credenciales de Mercado Pago y WhatsApp que cargues se guardan cifradas y solo se usan para generar cobros y enviar mensajes en nombre de tu negocio.</p>

      <h2>Tus derechos</h2>
      <p>Podés pedir acceso, corrección o eliminación de tus datos en cualquier momento, conforme a la Ley 25.326 de Protección de Datos Personales. Escribinos desde el email de tu cuenta.</p>

      <h2>Pagos y cancelación</h2>
      <p>La suscripción se cobra mensualmente por Mercado Pago. Podés cancelarla cuando quieras desde Mercado Pago; el servicio sigue activo hasta el fin del período pagado.</p>

      <h2>Responsabilidad</h2>
      <p>AutoFlow calcula costos y precios sugeridos a partir de los datos que cargás. Las decisiones de precio y la relación con tus clientes son responsabilidad de tu negocio.</p>
    </main>
  );
}
