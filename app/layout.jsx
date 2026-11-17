import { Inter, Inter_Tight, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const interTight = Inter_Tight({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-inter-tight', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata = {
  title: 'AutoFlow Cocina — Pedidos, señas y costos para pastelería',
  description: 'Agenda de pedidos con cupos, señas automáticas con Mercado Pago, costos que se actualizan desde tu Excel o Google Drive y bot de WhatsApp.',
};

export const viewport = { themeColor: '#faf7f2' };

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${interTight.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
