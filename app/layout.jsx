import './globals.css';

export const metadata = {
  title: 'AutoFlow Cocina — Pedidos, señas y costos para pastelería',
  description: 'Agenda de pedidos con cupos, señas automáticas con Mercado Pago, costos que se actualizan desde tu Google Drive y bot de WhatsApp.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
