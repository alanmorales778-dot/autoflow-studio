"use client";

import { useState } from "react";
import Navbar from "@/components/shared/Navbar";
import {
  Calendar,
  Mail,
  Webhook,
  Sparkles,
  Copy,
  Check,
  ChevronRight,
  Code2,
  BookOpen,
  Loader2,
  ArrowRight,
  Terminal,
  Reply,
  FileText,
  Package,
  Bell,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const templates = [
  {
    id: "calendar-shifts",
    icon: Calendar,
    title: "Turnos en Calendar",
    description:
      "Crea eventos automáticamente en Google Calendar desde una hoja de cálculo con datos de turnos.",
    color: "from-blue-500 to-cyan-500",
    tag: "Popular",
  },
  {
    id: "invoice-email",
    icon: Mail,
    title: "Facturas por Gmail",
    description:
      "Envía facturas con diseño profesional HTML por email a todos los clientes de tu lista.",
    color: "from-purple-500 to-pink-500",
    tag: "Popular",
  },
  {
    id: "webhook-sheets",
    icon: Webhook,
    title: "Webhook a Sheets",
    description:
      "Convierte tu Google Sheet en un receptor de webhooks para recibir datos de cualquier servicio.",
    color: "from-emerald-500 to-teal-500",
    tag: "",
  },
  {
    id: "auto-responder",
    icon: Reply,
    title: "Auto-Responder Gmail",
    description:
      "Responde emails automáticamente según palabras clave. Configura reglas desde una hoja de cálculo.",
    color: "from-amber-500 to-orange-500",
    tag: "Nuevo",
  },
  {
    id: "pdf-generator",
    icon: FileText,
    title: "Generador de PDFs",
    description:
      "Genera certificados, facturas o documentos PDF desde datos de Sheets y envíalos por email.",
    color: "from-rose-500 to-red-500",
    tag: "Nuevo",
  },
  {
    id: "inventory-control",
    icon: Package,
    title: "Control de Inventario",
    description:
      "Gestión de stock con alertas automáticas por email cuando un producto baja del mínimo.",
    color: "from-indigo-500 to-blue-500",
    tag: "Nuevo",
  },
  {
    id: "auto-reminders",
    icon: Bell,
    title: "Recordatorios Automáticos",
    description:
      "Envía alertas antes de vencimientos: pagos, contratos, renovaciones, deadlines.",
    color: "from-yellow-500 to-amber-500",
    tag: "Nuevo",
  },
  {
    id: "forms-crm",
    icon: Users,
    title: "Forms → CRM",
    description:
      "Convierte respuestas de Google Forms en un CRM completo con pipeline de ventas y estadísticas.",
    color: "from-teal-500 to-cyan-500",
    tag: "Nuevo",
  },
];

interface GuideStep {
  step: number;
  title: string;
  description: string;
}

interface GenerationResult {
  code: string;
  html?: string;
  guide: GuideStep[];
  explanation: string;
}

export default function AgenteScriptPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "guide">("code");

  const handleGenerate = async () => {
    if (!selectedTemplate && !customPrompt.trim()) return;

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: selectedTemplate || "custom",
          customPrompt: customPrompt || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
      setActiveTab("code");
    } catch (error) {
      console.error("Error generating script:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="min-h-screen">
      <Navbar />

      <section className="pt-28 pb-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-6">
            <Terminal className="w-4 h-4" />
            Generador con IA
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Generador Express de{" "}
            <span className="gradient-text">Apps Script</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Seleccioná un template predefinido o escribí tu necesidad. La IA genera
            el código y la guía de instalación.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-32">
        {/* Template Selector */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {templates.map((t) => {
            const Icon = t.icon;
            const isSelected = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplate(isSelected ? null : t.id);
                  setCustomPrompt("");
                }}
                className={cn(
                  "glass-card p-5 text-left transition-all duration-300 hover:-translate-y-1 relative",
                  isSelected && "ring-2 ring-indigo-500 border-indigo-500/30"
                )}
              >
                {t.tag && (
                  <span className={cn(
                    "absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full",
                    t.tag === "Nuevo" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                  )}>
                    {t.tag}
                  </span>
                )}
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center mb-3 shadow-lg`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{t.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                {isSelected && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 font-medium">
                    <Check className="w-3 h-3" /> Seleccionado
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Prompt */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold">Prompt Libre (Opcional)</h3>
          </div>
          <textarea
            value={customPrompt}
            onChange={(e) => {
              setCustomPrompt(e.target.value);
              if (e.target.value.trim()) setSelectedTemplate(null);
            }}
            placeholder="Ej: Quiero un script que lea datos de la Hoja1, filtre por fecha y envíe un resumen por email cada lunes a las 9am..."
            className="w-full h-32 bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30 resize-none transition-all"
          />
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              {selectedTemplate
                ? `Template seleccionado: ${templates.find((t) => t.id === selectedTemplate)?.title}`
                : customPrompt.trim()
                ? "Modo: Prompt personalizado"
                : "Seleccioná un template o escribí un prompt"}
            </p>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!selectedTemplate && !customPrompt.trim())}
              className={cn(
                "gradient-btn !px-6 !py-2.5 text-sm",
                (isGenerating || (!selectedTemplate && !customPrompt.trim())) &&
                  "opacity-50 cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generar Script
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="animate-slide-up space-y-6">
            {/* Explanation */}
            <div className="glass-card p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-emerald-400">
                    Script Generado Exitosamente
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("code")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === "code"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <Code2 className="w-4 h-4" />
                Código
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === "guide"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <BookOpen className="w-4 h-4" />
                Guía de Instalación
              </button>
            </div>

            {/* Code Panel */}
            {activeTab === "code" && (
              <div className="code-block">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      Code.gs
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copiar Código
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 custom-scrollbar max-h-[600px] overflow-y-auto">
                  <code>{result.code}</code>
                </pre>
              </div>
            )}

            {/* Guide Panel */}
            {activeTab === "guide" && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  Guía Paso a Paso
                </h3>
                <div className="space-y-4">
                  {result.guide.map((step, i) => (
                    <div key={i} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex-shrink-0">
                          {step.step}
                        </div>
                        {i < result.guide.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-2 min-h-[20px]" />
                        )}
                      </div>
                      <div className="pb-6">
                        <h4 className="font-semibold mb-1">{step.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
