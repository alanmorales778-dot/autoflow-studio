"use client";

import { useState } from "react";
import Navbar from "@/components/shared/Navbar";
import {
  FileText,
  CheckCircle2,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  Mail,
  User,
  Wrench,
  BarChart3,
  Target,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const toolOptions = [
  "Google Sheets",
  "Google Docs",
  "Google Slides",
  "Gmail",
  "Google Calendar",
  "Google Drive",
  "Google Forms",
  "Google Chat",
  "APIs Externas",
  "CRM (HubSpot, Salesforce)",
  "Bases de datos",
  "Otro",
];

const volumeOptions = [
  "Menos de 100 registros/mes",
  "100-500 registros/mes",
  "500-2000 registros/mes",
  "2000-10000 registros/mes",
  "Más de 10000 registros/mes",
];

interface FormData {
  clientName: string;
  clientEmail: string;
  company: string;
  tools: string[];
  volume: string;
  objective: string;
  description: string;
}

export default function SolicitudComplejaPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    clientName: "",
    clientEmail: "",
    company: "",
    tools: [],
    volume: "",
    objective: "",
    description: "",
  });

  const totalSteps = 4;

  const toggleTool = (tool: string) => {
    setFormData((prev) => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter((t) => t !== tool)
        : [...prev.tools, tool],
    }));
  };

  const canAdvance = () => {
    switch (step) {
      case 1:
        return formData.clientName.trim() && formData.clientEmail.trim();
      case 2:
        return formData.tools.length > 0;
      case 3:
        return formData.volume && formData.objective.trim();
      case 4:
        return formData.description.trim();
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "complex",
          ...formData,
          tools: JSON.stringify(formData.tools),
        }),
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen">
        <Navbar />
        <section className="pt-32 px-4">
          <div className="max-w-lg mx-auto text-center glass-card p-12">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-3">
              ¡Solicitud Enviada!
            </h2>
            <p className="text-muted-foreground mb-6">
              Recibimos tu solicitud de automatización compleja. Nuestro equipo
              te contactará en las próximas 24hs con un presupuesto personalizado.
            </p>
            <div className="glass-card p-4 text-left text-sm space-y-2 mb-6">
              <p>
                <span className="text-muted-foreground">Nombre:</span>{" "}
                <span className="font-medium">{formData.clientName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{formData.clientEmail}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Herramientas:</span>{" "}
                <span className="font-medium">{formData.tools.join(", ")}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Estado:</span>{" "}
                <span className="status-badge status-pending">
                  Pendiente de Presupuesto
                </span>
              </p>
            </div>
            <a href="/" className="gradient-btn">
              Volver al Inicio
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Navbar />

      <section className="pt-28 pb-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Automatización a Medida
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Cotizador de{" "}
            <span className="gradient-text">Automatizaciones Complejas</span>
          </h1>
          <p className="text-muted-foreground">
            Contanos sobre tu proyecto y te enviamos un presupuesto en 24 horas.
          </p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-4 pb-32">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all",
                  i + 1 <= step
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                {i + 1 < step ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < totalSteps - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 rounded transition-all",
                    i + 1 < step ? "bg-indigo-500" : "bg-muted/30"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Contact Info */}
        {step === 1 && (
          <div className="glass-card p-8 animate-fade-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <User className="w-5 h-5 text-indigo-400" />
              Datos de Contacto
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                  placeholder="Juan Pérez"
                  className="w-full bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, clientEmail: e.target.value })
                  }
                  placeholder="juan@empresa.com"
                  className="w-full bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Empresa (opcional)
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                  placeholder="Mi Empresa S.A."
                  className="w-full bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Tools */}
        {step === 2 && (
          <div className="glass-card p-8 animate-fade-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Wrench className="w-5 h-5 text-indigo-400" />
              Herramientas Involucradas
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Seleccioná todas las herramientas que forman parte de tu flujo de
              trabajo:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {toolOptions.map((tool) => {
                const isSelected = formData.tools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={cn(
                      "p-3 rounded-xl text-sm text-left transition-all border",
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                        : "bg-muted/20 border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-indigo-500 border-indigo-500"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                      {tool}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Volume & Objective */}
        {step === 3 && (
          <div className="glass-card p-8 animate-fade-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Volumen y Objetivo
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3">
                  Volumen de datos mensual *
                </label>
                <div className="space-y-2">
                  {volumeOptions.map((v) => (
                    <button
                      key={v}
                      onClick={() => setFormData({ ...formData, volume: v })}
                      className={cn(
                        "w-full p-3 rounded-xl text-sm text-left transition-all border",
                        formData.volume === v
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                          : "bg-muted/20 border-transparent text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Objetivo principal *
                </label>
                <input
                  type="text"
                  value={formData.objective}
                  onChange={(e) =>
                    setFormData({ ...formData, objective: e.target.value })
                  }
                  placeholder="Ej: Automatizar la facturación mensual y envío de reportes"
                  className="w-full bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Description */}
        {step === 4 && (
          <div className="glass-card p-8 animate-fade-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Target className="w-5 h-5 text-indigo-400" />
              Descripción del Proyecto
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Describí tu flujo de trabajo actual y lo que querés
                  automatizar *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describí con el mayor detalle posible: qué pasos se hacen manualmente, qué datos se procesan, con qué frecuencia, quién lo usa, etc."
                  rows={6}
                  className="w-full bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30 resize-none transition-all"
                />
              </div>
              <div className="glass-card p-4 bg-muted/20">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Paperclip className="w-4 h-4" />
                  Adjuntos (opcional)
                </div>
                <p className="text-xs text-muted-foreground">
                  Podés enviar capturas de pantalla o diagramas a nuestro email
                  después de enviar el formulario.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className={cn(
                "gradient-btn !px-6 !py-2.5 text-sm",
                !canAdvance() && "opacity-50 cursor-not-allowed"
              )}
            >
              Siguiente
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
              className={cn(
                "gradient-btn !px-6 !py-2.5 text-sm",
                (!canAdvance() || submitting) && "opacity-50 cursor-not-allowed"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Solicitud
                </>
              )}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
