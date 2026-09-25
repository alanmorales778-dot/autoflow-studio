"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/shared/Navbar";
import {
  LayoutDashboard,
  Globe,
  FileText,
  Eye,
  MessageSquare,
  Clock,
  User,
  Mail,
  Phone,
  RefreshCw,
  ChevronRight,
  X,
  Zap,
  Shield,
  Star,
  Rocket,
  Code2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebProject {
  id: string;
  businessName: string;
  niche: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  wireframeJson: string;
  chatHistory: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  type: string;
  clientName: string;
  clientEmail: string;
  description: string;
  tools: string;
  volume: string;
  objective: string;
  status: string;
  createdAt: string;
}

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Star: <Star className="w-5 h-5" />,
  Rocket: <Rocket className="w-5 h-5" />,
  Globe: <Globe className="w-5 h-5" />,
  Code: <Code2 className="w-5 h-5" />,
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"projects" | "tickets">("projects");
  const [projects, setProjects] = useState<WebProject[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<WebProject | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, ticketRes] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch("/api/tickets"),
      ]);
      const projData = await projRes.json();
      const ticketData = await ticketRes.json();
      setProjects(Array.isArray(projData) ? projData : []);
      setTickets(Array.isArray(ticketData) ? ticketData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "STAND_BY":
        return <span className="status-badge status-standby">🔵 Stand By</span>;
      case "PENDING":
        return <span className="status-badge status-pending">🟡 Pendiente</span>;
      case "IN_PROGRESS":
        return <span className="status-badge status-pending">🟠 En Progreso</span>;
      case "QUOTED":
        return <span className="status-badge status-standby">💰 Cotizado</span>;
      case "COMPLETED":
        return <span className="status-badge status-completed">✅ Completado</span>;
      default:
        return <span className="status-badge status-pending">{status}</span>;
    }
  };

  const renderProjectPreview = (project: WebProject) => {
    try {
      const state = JSON.parse(project.wireframeJson || "{}");
      const c = state.colorPalette || {
        primary: "#6366f1",
        secondary: "#8b5cf6",
        background: "#0f172a",
        text: "#f8fafc",
      };

      return (
        <div
          className="w-full rounded-xl overflow-hidden"
          style={{ backgroundColor: c.background, color: c.text }}
        >
          {/* Mini Hero */}
          <div className="p-6 text-center relative">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${c.primary}40, transparent)`,
              }}
            />
            <h3 className="text-lg font-bold relative z-10" style={{ color: c.text }}>
              {state.heroTitle || project.businessName}
            </h3>
            <p className="text-xs mt-1 relative z-10" style={{ color: `${c.text}88` }}>
              {state.heroSubtitle || ""}
            </p>
          </div>

          {/* Mini Services */}
          {state.services && (
            <div className="px-4 pb-4 grid grid-cols-3 gap-2">
              {state.services.slice(0, 3).map((s: any, i: number) => (
                <div
                  key={i}
                  className="p-2 rounded-lg text-center"
                  style={{ backgroundColor: `${c.primary}15` }}
                >
                  <div
                    className="w-6 h-6 rounded mx-auto mb-1 flex items-center justify-center text-xs"
                    style={{ backgroundColor: `${c.primary}30`, color: c.primary }}
                  >
                    {iconMap[s.icon] || "⚡"}
                  </div>
                  <p className="text-[9px] font-medium truncate" style={{ color: c.text }}>
                    {s.title}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } catch {
      return (
        <div className="p-8 text-center text-muted-foreground text-sm">
          Sin preview disponible
        </div>
      );
    }
  };

  const renderChatHistory = (project: WebProject) => {
    try {
      const history = JSON.parse(project.chatHistory || "[]");
      return (
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
          {history.map((msg: any, i: number) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs",
                  msg.role === "user" ? "bg-indigo-500/20" : "bg-cyan-500/20"
                )}
              >
                {msg.role === "user" ? "U" : "AI"}
              </div>
              <div
                className={cn(
                  "max-w-[85%] px-3 py-2 rounded-lg text-xs",
                  msg.role === "user"
                    ? "bg-indigo-500/20 text-indigo-200"
                    : "bg-muted/30 text-slate-300"
                )}
              >
                {msg.content.substring(0, 200)}
                {msg.content.length > 200 && "..."}
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin historial de chat
            </p>
          )}
        </div>
      );
    } catch {
      return (
        <p className="text-sm text-muted-foreground text-center py-4">
          Error al cargar historial
        </p>
      );
    }
  };

  return (
    <main className="min-h-screen">
      <Navbar />

      <section className="pt-28 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Panel de Control</h1>
                <p className="text-sm text-muted-foreground">
                  Gestión de proyectos y tickets
                </p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Actualizar
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-4">
              <div className="text-2xl font-bold gradient-text">{projects.length}</div>
              <div className="text-xs text-muted-foreground">Proyectos Web</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-2xl font-bold text-amber-400">
                {projects.filter((p) => p.status === "STAND_BY").length}
              </div>
              <div className="text-xs text-muted-foreground">En Stand By</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-2xl font-bold text-blue-400">{tickets.length}</div>
              <div className="text-xs text-muted-foreground">Tickets</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-2xl font-bold text-emerald-400">
                {tickets.filter((t) => t.status === "PENDING").length}
              </div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("projects")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "projects"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Globe className="w-4 h-4" />
              Proyectos Web ({projects.length})
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "tickets"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <FileText className="w-4 h-4" />
              Tickets ({tickets.length})
            </button>
          </div>

          {/* Projects List */}
          {activeTab === "projects" && (
            <div className="space-y-4">
              {projects.length === 0 && !loading && (
                <div className="glass-card p-12 text-center">
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">
                    No hay proyectos web aún. Los proyectos aparecerán cuando los
                    clientes usen el constructor web.
                  </p>
                </div>
              )}
              {projects.map((project) => (
                <div key={project.id} className="glass-card p-6">
                  <div className="flex items-start gap-6">
                    {/* Mini Preview */}
                    <div className="w-48 flex-shrink-0 hidden lg:block">
                      {renderProjectPreview(project)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{project.businessName}</h3>
                        {getStatusBadge(project.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {project.niche || "Sin nicho especificado"}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {project.clientName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {project.clientName}
                          </span>
                        )}
                        {project.clientEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {project.clientEmail}
                          </span>
                        )}
                        {project.clientPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {project.clientPhone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{" "}
                          {new Date(project.createdAt).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setSelectedProject(project);
                          setShowPreview(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                      <button
                        onClick={() => setSelectedProject(project)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat
                      </button>
                    </div>
                  </div>

                  {/* Expanded Chat History */}
                  {selectedProject?.id === project.id && !showPreview && (
                    <div className="mt-6 pt-6 border-t border-border/50 animate-slide-up">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-cyan-400" />
                          Historial del Chat
                        </h4>
                        <button
                          onClick={() => setSelectedProject(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {renderChatHistory(project)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tickets List */}
          {activeTab === "tickets" && (
            <div className="space-y-4">
              {tickets.length === 0 && !loading && (
                <div className="glass-card p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">
                    No hay tickets aún. Los tickets aparecerán cuando los
                    clientes envíen solicitudes de automatización.
                  </p>
                </div>
              )}
              {tickets.map((ticket) => (
                <div key={ticket.id} className="glass-card p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold">
                          {ticket.type === "complex"
                            ? "Automatización Compleja"
                            : "Automatización Express"}
                        </h3>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 max-w-2xl">
                        {ticket.description?.substring(0, 200)}
                        {ticket.description?.length > 200 && "..."}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {ticket.clientName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {ticket.clientEmail}
                        </span>
                        {ticket.volume && (
                          <span>Vol: {ticket.volume}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{" "}
                          {new Date(ticket.createdAt).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                      {ticket.tools && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {JSON.parse(ticket.tools).map((tool: string) => (
                            <span
                              key={tool}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-6">
                  <div className="shimmer h-4 w-48 rounded mb-3" />
                  <div className="shimmer h-3 w-96 rounded mb-2" />
                  <div className="shimmer h-3 w-64 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Preview Modal */}
      {showPreview && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="font-semibold text-sm">
                Preview: {selectedProject.businessName}
              </h3>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setSelectedProject(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderProjectPreview(selectedProject)}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
