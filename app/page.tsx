"use client";

import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import {
  Zap,
  Code2,
  Globe,
  FileText,
  ArrowRight,
  Sparkles,
  Shield,
  Timer,
  Star,
  ChevronRight,
  Workflow,
  Bot,
  Palette,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useRef } from "react";

const services = [
  {
    icon: Code2,
    title: "Automatizaciones Express",
    subtitle: "con Apps Script",
    description:
      "Genera código listo para usar en Google Sheets, Calendar y Gmail. Nuestra IA crea el script y la guía paso a paso.",
    color: "from-indigo-500 to-violet-600",
    shadowColor: "shadow-indigo-500/20",
    href: "/agente-script",
    features: ["Turnos en Calendar", "Envío de facturas", "Webhooks a Sheets"],
  },
  {
    icon: Workflow,
    title: "Automatizaciones Complejas",
    subtitle: "a Medida",
    description:
      "Flujos empresariales avanzados con APIs, integraciones complejas y procesos multi-etapa diseñados para tu empresa.",
    color: "from-purple-500 to-pink-600",
    shadowColor: "shadow-purple-500/20",
    href: "/solicitud-compleja",
    features: ["APIs externas", "Flujos multi-step", "Reportes automáticos"],
  },
  {
    icon: Globe,
    title: "Diseño Web Inteligente",
    subtitle: "con Prototipado en Vivo",
    description:
      "Crea la landing page de tu negocio conversando con IA. Preview en tiempo real y cotización instantánea.",
    color: "from-cyan-500 to-blue-600",
    shadowColor: "shadow-cyan-500/20",
    href: "/crear-web",
    features: ["Chat con IA", "Preview en vivo", "Exportar proyecto"],
  },
];

const stats = [
  { value: "500+", label: "Scripts Generados" },
  { value: "98%", label: "Satisfacción" },
  { value: "3min", label: "Tiempo Promedio" },
  { value: "0", label: "Licencias Extra" },
];

const benefits = [
  {
    icon: Timer,
    title: "Implementación Rápida",
    description: "De idea a producción en minutos, no semanas.",
  },
  {
    icon: Shield,
    title: "Sin Costos Ocultos",
    description: "Usa las herramientas de Google que ya tenés.",
  },
  {
    icon: Sparkles,
    title: "IA de Última Generación",
    description: "Código optimizado generado por inteligencia artificial.",
  },
  {
    icon: Star,
    title: "Soporte Experto",
    description: "Equipo especializado en Google Workspace.",
  },
];

export default function HomePage() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".animate-on-scroll").forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <main className="min-h-screen">
      <Navbar />

      {/* ====== HERO SECTION ====== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated background orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl"
        />

        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
            <Bot className="w-4 h-4" />
            Potenciado por Inteligencia Artificial
            <Sparkles className="w-4 h-4" />
          </div>

          {/* Main heading */}
          <h1 className="animate-slide-up text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            Automatiza tu
            <br />
            <span className="gradient-text">Google Workspace</span>
            <br />
            <span className="text-muted-foreground text-3xl sm:text-4xl lg:text-5xl font-semibold">
              sin pagar licencias caras
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-slide-up text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ animationDelay: "0.1s" }}
          >
            Genera scripts de Apps Script con IA, automatiza flujos empresariales
            y diseña landing pages conversando — todo desde una sola plataforma.
          </p>

          {/* CTA Buttons */}
          <div
            className="animate-slide-up flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animationDelay: "0.2s" }}
          >
            <Link href="/agente-script" className="gradient-btn text-lg !px-8 !py-4 group">
              <Zap className="w-5 h-5 mr-2" />
              Generar Script Gratis
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/servicios"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-medium text-muted-foreground hover:text-foreground border border-border hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-300"
            >
              Ver Servicios
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Stats */}
          <div
            className="animate-slide-up mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-2xl mx-auto"
            style={{ animationDelay: "0.3s" }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold gradient-text">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground animate-pulse-glow">
          <span className="text-xs tracking-widest uppercase">Explorar</span>
          <div className="w-5 h-8 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1">
            <div className="w-1 h-2 rounded-full bg-muted-foreground/50 animate-slide-down" />
          </div>
        </div>
      </section>

      {/* ====== SERVICES SECTION ====== */}
      <section className="py-32 relative">
        <div className="section-divider mb-32" />
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tres formas de{" "}
              <span className="gradient-text">potenciar tu negocio</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Elige la modalidad que mejor se adapte a tu necesidad. Desde scripts
              express hasta soluciones empresariales complejas.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Link
                  key={service.title}
                  href={service.href}
                  className="animate-on-scroll group"
                  style={{ transitionDelay: `${index * 0.15}s` }}
                >
                  <div className="glass-card h-full p-8 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-2">
                    {/* Icon */}
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-6 shadow-lg ${service.shadowColor} group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold mb-1 group-hover:text-white transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-sm text-indigo-400 font-medium mb-3">
                      {service.subtitle}
                    </p>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      {service.description}
                    </p>

                    {/* Features list */}
                    <ul className="space-y-2 mb-6">
                      {service.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <div className="flex items-center gap-2 text-sm font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors">
                      Explorar
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====== BENEFITS SECTION ====== */}
      <section className="py-32 relative">
        <div className="section-divider mb-32" />
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              ¿Por qué{" "}
              <span className="gradient-text">AutoFlow Studio</span>?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              La forma más inteligente de automatizar tu trabajo.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="animate-on-scroll glass-card p-6 text-center hover:border-indigo-500/20 transition-all duration-300"
                  style={{ transitionDelay: `${i * 0.1}s` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="font-semibold mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {b.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====== CTA SECTION ====== */}
      <section className="py-32 relative">
        <div className="section-divider mb-32" />
        <div className="max-w-4xl mx-auto px-4 text-center animate-on-scroll">
          <div className="glass-card p-12 lg:p-16 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <Palette className="w-12 h-12 text-indigo-400 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                ¿Listo para crear tu{" "}
                <span className="gradient-text">landing page</span>?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                Conversá con nuestra IA, diseñá tu web en tiempo real y recibí
                una cotización personalizada.
              </p>
              <Link href="/crear-web" className="gradient-btn text-lg !px-10 !py-4 group">
                <Globe className="w-5 h-5 mr-2" />
                Empezar a Diseñar
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold gradient-text">AutoFlow Studio</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/servicios" className="hover:text-foreground transition-colors">
                Servicios
              </Link>
              <Link href="/agente-script" className="hover:text-foreground transition-colors">
                Script Express
              </Link>
              <Link href="/crear-web" className="hover:text-foreground transition-colors">
                Crear Web
              </Link>
              <Link href="/admin" className="hover:text-foreground transition-colors">
                Admin
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} AutoFlow Studio. Todos los derechos
              reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
