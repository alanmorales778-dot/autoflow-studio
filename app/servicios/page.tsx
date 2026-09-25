"use client";

import Navbar from "@/components/shared/Navbar";
import Link from "next/link";
import {
  Code2,
  Workflow,
  Globe,
  ArrowRight,
  CheckCircle2,
  Zap,
  Clock,
  Users,
  BarChart3,
  Mail,
  Calendar,
  FileSpreadsheet,
  Webhook,
  Paintbrush,
  MessageSquare,
  Eye,
} from "lucide-react";

const serviceDetails = [
  {
    id: "express",
    icon: Code2,
    title: "Automatizaciones Express con Apps Script",
    description:
      "Genera código listo para usar directamente en Google Sheets, Calendar y Gmail. Nuestra IA escribe el script y crea la guía visual para que lo implementes en minutos.",
    color: "from-indigo-500 to-violet-600",
    price: "Gratis",
    priceNote: "Generación ilimitada",
    href: "/agente-script",
    cta: "Generar Script Ahora",
    features: [
      {
        icon: Calendar,
        title: "Turnos en Calendar",
        desc: "Crea eventos automáticamente desde una hoja de cálculo.",
      },
      {
        icon: Mail,
        title: "Facturas por Gmail",
        desc: "Envía emails con diseño profesional a tus clientes.",
      },
      {
        icon: Webhook,
        title: "Webhook a Sheets",
        desc: "Recibe datos de cualquier servicio externo en tu Sheet.",
      },
      {
        icon: Zap,
        title: "Prompt Libre",
        desc: "Describe tu necesidad y la IA genera el código.",
      },
    ],
    steps: [
      "Elegí un template o escribí tu prompt",
      "La IA genera el código optimizado",
      "Copiá y pegá en Apps Script",
      "¡Listo! Tu automatización funciona",
    ],
  },
  {
    id: "complex",
    icon: Workflow,
    title: "Automatizaciones Complejas a Medida",
    description:
      "Para flujos empresariales que requieren integración con APIs externas, procesamiento de grandes volúmenes de datos y lógica de negocio avanzada.",
    color: "from-purple-500 to-pink-600",
    price: "Personalizado",
    priceNote: "Cotización en 24hs",
    href: "/solicitud-compleja",
    cta: "Solicitar Cotización",
    features: [
      {
        icon: BarChart3,
        title: "Reportes Automáticos",
        desc: "Genera y distribuye reportes sin intervención manual.",
      },
      {
        icon: Users,
        title: "Flujos Multi-Equipo",
        desc: "Coordina procesos entre diferentes áreas de tu empresa.",
      },
      {
        icon: FileSpreadsheet,
        title: "Integraciones API",
        desc: "Conecta Google Workspace con cualquier servicio externo.",
      },
      {
        icon: Clock,
        title: "Tareas Programadas",
        desc: "Ejecuta procesos automáticos en horarios definidos.",
      },
    ],
    steps: [
      "Describí tu flujo de trabajo actual",
      "Nuestro equipo analiza y diseña la solución",
      "Recibís la cotización detallada",
      "Implementación y soporte continuo",
    ],
  },
  {
    id: "web",
    icon: Globe,
    title: "Diseño Web Inteligente con Prototipado en Vivo",
    description:
      "Diseñá la landing page de tu negocio conversando con IA. Ves el resultado en tiempo real y cuando estés conforme, lo construimos para vos.",
    color: "from-cyan-500 to-blue-600",
    price: "Preview Gratis",
    priceNote: "Desarrollo desde cotización",
    href: "/crear-web",
    cta: "Diseñar mi Web",
    features: [
      {
        icon: MessageSquare,
        title: "Chat con IA",
        desc: "Conversá naturalmente sobre tu visión del sitio.",
      },
      {
        icon: Eye,
        title: "Preview en Vivo",
        desc: "Ves los cambios en tiempo real mientras conversás.",
      },
      {
        icon: Paintbrush,
        title: "Personalización Total",
        desc: "Colores, secciones y contenido a tu medida.",
      },
      {
        icon: Zap,
        title: "Cotización Instantánea",
        desc: "Al finalizar, recibís presupuesto para el desarrollo.",
      },
    ],
    steps: [
      "Iniciá una conversación con la IA",
      "Describí tu negocio y preferencias",
      "Mira el diseño en la preview en vivo",
      "Finalizá y recibí la cotización",
    ],
  },
];

export default function ServiciosPage() {
  return (
    <main className="min-h-screen">
      <Navbar />

      {/* Header */}
      <section className="pt-32 pb-16 text-center px-4">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Nuestros <span className="gradient-text">Servicios</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Todo lo que necesitás para automatizar tu trabajo con Google Workspace
          y crear tu presencia web profesional.
        </p>
      </section>

      {/* Services Detail */}
      <section className="max-w-6xl mx-auto px-4 pb-32 space-y-24">
        {serviceDetails.map((service, idx) => {
          const Icon = service.icon;
          const isReversed = idx % 2 !== 0;

          return (
            <div key={service.id} className="glass-card overflow-hidden">
              <div className="p-8 lg:p-12">
                {/* Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-10">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center shadow-lg flex-shrink-0`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl lg:text-3xl font-bold mb-2">
                      {service.title}
                    </h2>
                    <p className="text-muted-foreground">
                      {service.description}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold gradient-text">
                      {service.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {service.priceNote}
                    </div>
                  </div>
                </div>

                {/* Features Grid */}
                <div className="grid sm:grid-cols-2 gap-4 mb-10">
                  {service.features.map((f) => {
                    const FIcon = f.icon;
                    return (
                      <div
                        key={f.title}
                        className="flex gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                          <FIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{f.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Steps */}
                <div className="flex flex-wrap gap-3 mb-8">
                  {service.steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      {step}
                      {i < service.steps.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-muted-foreground/50 ml-1" />
                      )}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href={service.href}
                  className="gradient-btn group"
                >
                  {service.cta}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
