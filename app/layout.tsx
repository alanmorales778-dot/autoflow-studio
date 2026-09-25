import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoFlow Studio | Automatizaciones Google Workspace & Diseño Web con IA",
  description:
    "Plataforma de automatizaciones nativas en Google Workspace sin pagar licencias caras. Generador Express de Apps Script, cotizador de flujos empresariales y diseño web inteligente con IA.",
  keywords: [
    "automatización",
    "google workspace",
    "apps script",
    "diseño web",
    "IA",
    "google sheets",
    "gmail automatización",
  ],
  openGraph: {
    title: "AutoFlow Studio",
    description: "Automatizaciones Google Workspace & Diseño Web con IA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="font-sans antialiased min-h-screen bg-background">
        <div className="mesh-gradient fixed inset-0 -z-10" />
        {children}
      </body>
    </html>
  );
}
