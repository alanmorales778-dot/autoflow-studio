import './globals.css';
import WebVitals from './web-vitals';
import FieldLabels from './field-labels';

// Las fuentes se cargan desde el navegador (no en el build): el build de Vercel
// no siempre puede descargar Google Fonts y eso hacía fallar el deploy.
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap';

export const metadata = {
  title: 'HakkiraApp — Pedidos, turnos, señas y costos para negocios por encargo',
  description: 'Link de pedidos y turnos con cupos por día, señas automáticas con Mercado Pago, costos que se actualizan desde tu Excel o Google Drive y bot de WhatsApp.',
  applicationName: 'HakkiraApp',
  appleWebApp: { capable: true, title: 'HakkiraApp', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/icon-192.png', sizes: '192x192' }], apple: '/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport = { themeColor: '#fafaf9' };

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <WebVitals />
        <FieldLabels />
        {children}
      </body>
    </html>
  );
}
