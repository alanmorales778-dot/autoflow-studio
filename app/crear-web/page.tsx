"use client";

import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/shared/Navbar";
import {
  Send,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  Globe,
  Sparkles,
  Zap,
  Shield,
  Star,
  Rocket,
  Code2,
  Eye,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface WebProjectState {
  businessName: string;
  niche: string;
  sections: string[];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  tone: string;
  heroTitle: string;
  heroSubtitle: string;
  services: { title: string; description: string; icon: string }[];
  testimonials: { name: string; text: string; role: string }[];
  contactEnabled: boolean;
  footerText: string;
}

const DEFAULT_STATE: WebProjectState = {
  businessName: "Mi Negocio",
  niche: "general",
  sections: ["hero", "services", "contact"],
  colorPalette: {
    primary: "#6366f1",
    secondary: "#8b5cf6",
    accent: "#06b6d4",
    background: "#0f172a",
    text: "#f8fafc",
  },
  tone: "professional",
  heroTitle: "Bienvenido a Mi Negocio",
  heroSubtitle: "Soluciones profesionales para tu empresa",
  services: [
    { title: "Servicio 1", description: "Descripción del servicio principal", icon: "Zap" },
    { title: "Servicio 2", description: "Descripción del segundo servicio", icon: "Shield" },
    { title: "Servicio 3", description: "Descripción del tercer servicio", icon: "Star" },
  ],
  testimonials: [],
  contactEnabled: true,
  footerText: "© 2024 Mi Negocio. Todos los derechos reservados.",
};

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Star: <Star className="w-6 h-6" />,
  Rocket: <Rocket className="w-6 h-6" />,
  Globe: <Globe className="w-6 h-6" />,
  Code: <Code2 className="w-6 h-6" />,
};

// ====================================================
// LIVE PREVIEW RENDERER
// ====================================================
function LivePreview({ state }: { state: WebProjectState }) {
  const { colorPalette: c } = state;

  return (
    <div
      className="w-full h-full overflow-y-auto custom-scrollbar"
      style={{ backgroundColor: c.background, color: c.text }}
    >
      {/* Preview Navbar */}
      <nav
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
        style={{
          backgroundColor: `${c.background}dd`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${c.primary}22`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}
          >
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm" style={{ color: c.text }}>
            {state.businessName}
          </span>
        </div>
        <div className="flex gap-3 text-xs" style={{ color: `${c.text}88` }}>
          {state.sections.includes("services") && <span>Servicios</span>}
          {state.sections.includes("testimonials") && <span>Testimonios</span>}
          {state.sections.includes("contact") && <span>Contacto</span>}
        </div>
      </nav>

      {/* Hero Section */}
      {state.sections.includes("hero") && (
        <section className="relative px-6 py-16 text-center">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(circle at 30% 40%, ${c.primary}40, transparent 60%), radial-gradient(circle at 70% 60%, ${c.secondary}30, transparent 60%)`,
            }}
          />
          <div className="relative z-10">
            <h1
              className="text-2xl sm:text-3xl font-bold mb-3 leading-tight"
              style={{ color: c.text }}
            >
              {state.heroTitle}
            </h1>
            <p
              className="text-sm mb-6 max-w-md mx-auto"
              style={{ color: `${c.text}99` }}
            >
              {state.heroSubtitle}
            </p>
            <button
              className="px-5 py-2 rounded-lg text-sm font-medium text-white"
              style={{
                background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`,
                boxShadow: `0 4px 20px ${c.primary}40`,
              }}
            >
              Comenzar Ahora
            </button>
          </div>
        </section>
      )}

      {/* Services Section */}
      {state.sections.includes("services") && (
        <section className="px-6 py-12">
          <h2
            className="text-lg font-bold text-center mb-8"
            style={{ color: c.text }}
          >
            Nuestros Servicios
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {state.services.map((s, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{
                  backgroundColor: `${c.primary}10`,
                  border: `1px solid ${c.primary}20`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${c.primary}20`, color: c.primary }}
                >
                  {iconMap[s.icon] || <Zap className="w-6 h-6" />}
                </div>
                <h3
                  className="text-sm font-semibold mb-1"
                  style={{ color: c.text }}
                >
                  {s.title}
                </h3>
                <p className="text-xs" style={{ color: `${c.text}77` }}>
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials Section */}
      {state.sections.includes("testimonials") && state.testimonials.length > 0 && (
        <section className="px-6 py-12">
          <h2
            className="text-lg font-bold text-center mb-8"
            style={{ color: c.text }}
          >
            Lo que dicen nuestros clientes
          </h2>
          <div className="space-y-4">
            {state.testimonials.map((t, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{
                  backgroundColor: `${c.secondary}10`,
                  border: `1px solid ${c.secondary}20`,
                }}
              >
                <p className="text-sm italic mb-3" style={{ color: `${c.text}cc` }}>
                  &quot;{t.text}&quot;
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: c.primary, color: "white" }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: c.text }}>
                      {t.name}
                    </p>
                    <p className="text-[10px]" style={{ color: `${c.text}66` }}>
                      {t.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact Section */}
      {state.sections.includes("contact") && state.contactEnabled && (
        <section className="px-6 py-12">
          <h2
            className="text-lg font-bold text-center mb-8"
            style={{ color: c.text }}
          >
            Contacto
          </h2>
          <div
            className="p-6 rounded-xl space-y-4"
            style={{
              backgroundColor: `${c.primary}08`,
              border: `1px solid ${c.primary}15`,
            }}
          >
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre"
                readOnly
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: `${c.primary}10`,
                  color: c.text,
                  border: `1px solid ${c.primary}20`,
                }}
              />
              <input
                type="email"
                placeholder="Email"
                readOnly
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: `${c.primary}10`,
                  color: c.text,
                  border: `1px solid ${c.primary}20`,
                }}
              />
              <textarea
                placeholder="Mensaje"
                readOnly
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-xs resize-none"
                style={{
                  backgroundColor: `${c.primary}10`,
                  color: c.text,
                  border: `1px solid ${c.primary}20`,
                }}
              />
            </div>
            <button
              className="w-full py-2 rounded-lg text-xs font-medium text-white"
              style={{
                background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`,
              }}
            >
              Enviar Mensaje
            </button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer
        className="px-6 py-6 text-center"
        style={{
          borderTop: `1px solid ${c.primary}15`,
        }}
      >
        <p className="text-[10px]" style={{ color: `${c.text}44` }}>
          {state.footerText}
        </p>
      </footer>
    </div>
  );
}

// ====================================================
// MAIN PAGE COMPONENT
// ====================================================
export default function CrearWebPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [projectState, setProjectState] = useState<WebProjectState>(DEFAULT_STATE);
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat with greeting
  useEffect(() => {
    if (!chatInitialized.current) {
      chatInitialized.current = true;
      setMessages([
        {
          role: "assistant",
          content:
            "¡Hola! 👋 Soy tu asistente de diseño web. Vamos a crear la landing page perfecta para tu negocio.\n\n**¿Cómo se llama tu negocio y a qué se dedica?**\n\nPor ejemplo: *\"TechSolutions - Empresa de desarrollo de software\"*",
        },
      ]);
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          currentState: projectState,
          messageHistory: messages,
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      if (data.stateUpdate && Object.keys(data.stateUpdate).length > 0) {
        setProjectState((prev) => ({
          ...prev,
          ...data.stateUpdate,
          colorPalette: data.stateUpdate.colorPalette
            ? { ...prev.colorPalette, ...data.stateUpdate.colorPalette }
            : prev.colorPalette,
        }));
      }

      // Check if we should show finalize
      if (
        userMessage.toLowerCase().includes("finalizar") ||
        userMessage.toLowerCase().includes("listo") ||
        userMessage.toLowerCase().includes("terminar") ||
        data.message.includes("Finalizar y Solicitar Cotización")
      ) {
        setShowFinalize(true);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Hubo un error. Por favor intentá de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!clientEmail.trim()) return;
    setSaving(true);

    try {
      await fetch("/api/chat-web", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectState,
          chatHistory: messages,
          clientEmail,
          clientName,
          clientPhone,
        }),
      });
      setFinalized(true);
    } catch (error) {
      console.error("Error saving project:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />

      {/* Header */}
      <div className="pt-20 px-4 pb-3 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Constructor Web con IA</h1>
              <p className="text-xs text-muted-foreground">
                Chateá con la IA • Mirá el resultado en tiempo real
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Preview
            </div>
          </div>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0" style={{ height: "calc(100vh - 120px)" }}>
        {/* LEFT: Chat Panel */}
        <div className="lg:w-1/2 flex flex-col border-r border-border/50">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 animate-fade-in",
                  msg.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    msg.role === "user"
                      ? "bg-indigo-500/20"
                      : "bg-cyan-500/20"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] text-sm leading-relaxed",
                    msg.role === "user"
                      ? "chat-bubble-user text-white"
                      : "chat-bubble-assistant text-slate-200"
                  )}
                >
                  {msg.content.split("\n").map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-2" : ""}>
                      {line.split("**").map((part, k) =>
                        k % 2 === 1 ? (
                          <strong key={k} className="font-semibold">
                            {part}
                          </strong>
                        ) : (
                          <span key={k}>
                            {part.split("*").map((italic, l) =>
                              l % 2 === 1 ? (
                                <em key={l} className="opacity-80">
                                  {italic}
                                </em>
                              ) : (
                                italic
                              )
                            )}
                          </span>
                        )
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="chat-bubble-assistant">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Diseñando...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Finalize Panel */}
          {showFinalize && !finalized && (
            <div className="p-4 border-t border-border/50 bg-indigo-500/5 animate-slide-up">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Finalizar y Solicitar Cotización
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-muted/30 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30"
                />
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Tu email *"
                  className="w-full bg-muted/30 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30"
                />
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Teléfono (opcional)"
                  className="w-full bg-muted/30 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30"
                />
                <button
                  onClick={handleFinalize}
                  disabled={!clientEmail.trim() || saving}
                  className={cn(
                    "gradient-btn w-full !py-2.5 text-sm",
                    (!clientEmail.trim() || saving) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmar y Enviar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {finalized && (
            <div className="p-4 border-t border-border/50 bg-emerald-500/5 animate-slide-up">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-semibold text-sm text-emerald-400">
                    ¡Proyecto guardado!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Te contactaremos pronto con la cotización final.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          {!finalized && (
            <div className="p-4 border-t border-border/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Escribí tu mensaje..."
                  disabled={isLoading}
                  className="flex-1 bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500/30 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                    input.trim() && !isLoading
                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                      : "bg-muted/30 text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Live Preview */}
        <div className="lg:w-1/2 flex flex-col bg-slate-950">
          <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
              <span className="text-[10px] text-muted-foreground ml-2">
                {projectState.businessName || "preview"}.com
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Live Preview
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <LivePreview state={projectState} />
          </div>
        </div>
      </div>
    </main>
  );
}
