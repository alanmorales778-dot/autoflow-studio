import './globals.css';

// Las fuentes se cargan desde el navegador (no en el build): el build de Vercel
// no siempre puede descargar Google Fonts y eso hacía fallar el deploy.
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap';

export const metadata = {
  title: 'AutoFlow Cocina — Pedidos, señas y costos para pastelería',
  description: 'Agenda de pedidos con cupos, señas automáticas con Mercado Pago, costos que se actualizan desde tu Excel o Google Drive y bot de WhatsApp.',
};

export const viewport = { themeColor: '#faf7f2' };

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
