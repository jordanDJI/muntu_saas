"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useSubscription } from "../../../contexts/SubscriptionContext";
import { useSectorVocab } from "../../../lib/useSectorVocab";

const PAGE_SIZE = 10;

const STATUSES = ["new", "contacted", "qualified", "scheduled", "closed_won", "closed_lost"];
const APPT_STATUSES = ["scheduled", "closed_won", "closed_lost"];

const STATUS_COLORS: Record<string, string> = {
  new:         "badge-status badge-new",
  contacted:   "badge-status badge-contacted",
  qualified:   "badge-status badge-qualified",
  scheduled:   "badge-status badge-scheduled",
  closed_won:  "badge-status badge-won",
  closed_lost: "badge-status badge-lost",
};


type LinkModal = {
  contactName: string;
  link: string;
};

export default function LeadsPage() {
  const { t } = useLanguage();
  const { hasFeature } = useSubscription();
  const { vocab, leadTypes } = useSectorVocab();
  const router = useRouter();

  const STATUS_LABELS: Record<string, string> = {
    new:         t.lead_status_new,
    contacted:   t.lead_status_contacted,
    qualified:   t.lead_status_qualified,
    scheduled:   t.lead_status_scheduled,
    closed_won:  t.lead_status_won,
    closed_lost: t.lead_status_lost,
  };

  const SOURCE_LABELS: Record<string, string> = {
    website:   "Site web",   chatbot:   "Chatbot",    whatsapp: "WhatsApp",
    telegram:  "Telegram",  phone:     "Téléphone",  manual:   "Manuel",
    referral:  "Recommandation",       dashboard: "Dashboard",
  };

  const TYPE_LABELS: Record<string, string> = {
    b2c_appointment: `Prise de ${vocab.appointment.toLowerCase()}`, b2b_appointment: `Prise de ${vocab.appointment.toLowerCase()} (B2B)`,
    contact: "Prise de contact", information: "Demande d'info",
    ...Object.fromEntries(leadTypes.map((lt) => [lt.value, lt.label])),
  };
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [botUsername, setBotUsername] = useState<string>("");
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModal | null>(null);
  const [copied, setCopied] = useState(false);
  const [noteSaving, setNoteSaving] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("leads_view") as any) ?? "list";
    return "list";
  });
  const [kanbanLeads, setKanbanLeads] = useState<any[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  type SchedulingModal = {
    leadId: string;
    contactId: string;
    contactName: string;
    appointments: any[];
    selectedApptId: string;
    loading: boolean;
  };
  const [schedulingModal, setSchedulingModal] = useState<SchedulingModal | null>(null);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (offset: number, currentFilter?: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: PAGE_SIZE, offset };
      if (currentFilter) params.status = currentFilter;
      const data = await api.getLeads(params);
      setLeads((prev) => (offset === 0 ? data : [...prev, ...data]));
      setHasMore(data.length === PAGE_SIZE);
      offsetRef.current = offset + data.length;
    } catch (e) {
      console.error(e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFeature("agent_support")) return;
    api.getTelegramBotInfo()
      .then((info) => setBotUsername(info.username))
      .catch(() => {});
  }, [hasFeature]);

  useEffect(() => {
    api.getLeads({ limit: 500, offset: 0 })
      .then((all: any[]) => {
        const counts: Record<string, number> = {};
        for (const l of all) counts[l.status] = (counts[l.status] ?? 0) + 1;
        setStatusCounts(counts);
        setKanbanLeads(all); // réutilise les mêmes données pour le kanban
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    offsetRef.current = 0;
    setHasMore(true);
    setLeads([]);
    loadPage(0, filter);
  }, [filter, loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadPage(offsetRef.current, filter);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filter, loadPage]);

  const switchView = (mode: "list" | "kanban") => {
    setViewMode(mode);
    localStorage.setItem("leads_view", mode);
    if (mode === "kanban" && kanbanLeads.length === 0) loadKanban();
  };

  const loadKanban = async () => {
    setKanbanLoading(true);
    try {
      const data = await api.getLeads({ limit: 500, offset: 0 });
      setKanbanLeads(data);
    } finally { setKanbanLoading(false); }
  };

  const applyStatus = async (id: string, newStatus: string) => {
    await api.updateLead(id, { status: newStatus });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    setKanbanLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    setStatusCounts(prev => {
      const lead = [...leads, ...kanbanLeads].find(l => l.id === id);
      if (!lead) return prev;
      const next = { ...prev };
      if (next[lead.status] > 0) next[lead.status]--;
      next[newStatus] = (next[newStatus] ?? 0) + 1;
      return next;
    });
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const lead = [...leads, ...kanbanLeads].find(l => l.id === id);
    const oldStatus = lead?.status;

    // Interception tout statut → RDV planifié
    if (newStatus === "scheduled" && oldStatus !== "scheduled") {
      const contactId = lead?.contact_id ?? lead?.contact?.id;
      const contactName = [lead?.contact?.first_name, lead?.contact?.last_name].filter(Boolean).join(" ") || "—";
      setSchedulingModal({ leadId: id, contactId, contactName, appointments: [], selectedApptId: "", loading: true });
      try {
        const appts = await api.getAppointments({ contact_id: contactId, future_only: true });
        const active = appts.filter(a => a.status !== "cancelled" && a.status !== "refused");
        setSchedulingModal(m => m ? { ...m, appointments: active, selectedApptId: active[0]?.id ?? "", loading: false } : null);
      } catch {
        setSchedulingModal(m => m ? { ...m, loading: false } : null);
      }
      return;
    }

    await applyStatus(id, newStatus);
  };

  const saveNote = async (id: string, note: string) => {
    setNoteSaving(id);
    try {
      await api.updateLead(id, { internal_note: note });
    } finally {
      setNoteSaving(null);
    }
  };

  const NOTE_STATUSES = new Set(["qualified", "scheduled", "closed_won", "closed_lost"]);

  const generateTelegramLink = async (lead: any) => {
    const contactId = lead.contact_id ?? lead.contact?.id;
    if (!contactId) return;

    setGeneratingFor(lead.id);
    try {
      const agentLink = await api.createAgentLink({ contact_id: contactId, channel: "telegram" });
      const deepLink = `https://t.me/${botUsername}?start=${agentLink.token}`;
      const contactName = [lead.contact?.first_name, lead.contact?.last_name].filter(Boolean).join(" ") || "ce client";
      setLinkModal({ contactName, link: deepLink });
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  const copyLink = async () => {
    if (!linkModal) return;
    await navigator.clipboard.writeText(linkModal.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`mx-auto p-4 sm:p-6 space-y-5 ${viewMode === "kanban" ? "max-w-full" : "max-w-4xl"}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold">{vocab.leads}</h1>
        <div className="flex items-center gap-2">
          {/* Toggle vue */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button onClick={() => switchView("list")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === "list" ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
              {t.leads_view_list}
            </button>
            <button onClick={() => switchView("kanban")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === "kanban" ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="13" rx="1"/><rect x="17" y="3" width="5" height="16" rx="1"/>
              </svg>
              {t.leads_view_kanban}
            </button>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">{t.sett_back}</span>
          </button>
        </div>
      </div>

      {/* ── VUE KANBAN ──────────────────────────────────────────────────── */}
      {viewMode === "kanban" && (
        <div className="overflow-x-auto pb-4">
          {kanbanLoading
            ? <div className="text-center py-16 text-gray-400">Chargement…</div>
            : (
              <div className="flex gap-3 min-w-max">
                {STATUSES.map(col => {
                  const cards = kanbanLeads.filter(l => l.status === col);
                  const isOver = dragOverCol === col;

                  // Couleurs identiques aux badges de la vue liste
                  const COL_STYLE: Record<string, { bg: string; text: string; border: string; colBg: string }> = {
                    new:         { bg: "#E0F7FA", text: "#0D4B58", border: "#80DEEA", colBg: "#F0FAFB" },
                    contacted:   { bg: "#FFF8E1", text: "#6D4C00", border: "#FFE082", colBg: "#FFFDF0" },
                    qualified:   { bg: "#EEF2FF", text: "#1E3A8A", border: "#A5B4FC", colBg: "#F5F7FF" },
                    scheduled:   { bg: "#F0EFFE", text: "#4338CA", border: "#A78BFA", colBg: "#F7F5FF" },
                    closed_won:  { bg: "#F0FDF4", text: "#14532D", border: "#86EFAC", colBg: "#F5FFF8" },
                    closed_lost: { bg: "#FEF2F2", text: "#991B1B", border: "#FCA5A5", colBg: "#FFF8F8" },
                  };
                  const cs = COL_STYLE[col] ?? { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB", colBg: "#F9FAFB" };

                  return (
                    <div key={col}
                      onDragOver={e => { e.preventDefault(); setDragOverCol(col); }}
                      onDragLeave={() => setDragOverCol(null)}
                      onDrop={e => {
                        e.preventDefault();
                        const leadId = e.dataTransfer.getData("lead_id");
                        if (leadId) updateStatus(leadId, col);
                        setDragOverCol(null);
                      }}
                      style={{ borderColor: isOver ? cs.border : cs.border, backgroundColor: isOver ? cs.bg : cs.colBg }}
                      className="w-64 flex flex-col rounded-2xl border-2 transition-colors">
                      {/* En-tête colonne — couleur du badge statut */}
                      <div style={{ backgroundColor: cs.bg, borderBottomColor: cs.border }}
                        className="px-3 py-2.5 flex items-center justify-between border-b rounded-t-2xl">
                        <span style={{ color: cs.text }} className="text-xs font-bold uppercase tracking-wide">{STATUS_LABELS[col]}</span>
                        <span style={{ background: "white", color: cs.text, borderColor: cs.border }}
                          className="text-xs font-bold border rounded-full px-2 py-0.5">{cards.length}</span>
                      </div>
                      {/* Cartes */}
                      <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                        {cards.map(lead => {
                          const contactName = [lead.contact?.first_name, lead.contact?.last_name].filter(Boolean).join(" ") || "—";
                          return (
                            <div key={lead.id}
                              draggable
                              onDragStart={e => e.dataTransfer.setData("lead_id", lead.id)}
                              style={{ borderLeftColor: cs.border }}
                              className="bg-white rounded-xl border border-gray-100 border-l-4 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group">
                              <p className="font-semibold text-sm text-gray-900 truncate">{contactName}</p>
                              {lead.contact?.email && (
                                <p className="text-xs text-gray-400 truncate">{lead.contact.email}</p>
                              )}
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-400">
                                  {new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                </span>
                                <select
                                  value={lead.status}
                                  onChange={e => updateStatus(lead.id, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400 max-w-[110px]">
                                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                                </select>
                              </div>
                              {lead.notes && (
                                <p className="mt-1.5 text-xs text-gray-500 italic line-clamp-2 border-t border-gray-50 pt-1.5">
                                  {lead.notes}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {cards.length === 0 && (
                          <div style={{ borderColor: cs.border, color: cs.text }}
                            className="h-16 flex items-center justify-center rounded-xl border-2 border-dashed text-xs opacity-40 transition-colors">
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {/* ── VUE LISTE ────────────────────────────────────────────────────── */}
      {viewMode === "list" && <>

      {/* Filtres par statut */}
      <div id="leads-filters" className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter(undefined)}
          className={`filter-btn inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${!filter ? "filter-btn-active" : ""}`}
        >
          {t.lead_all}
          {Object.values(statusCounts).reduce((a, b) => a + b, 0) > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none bg-white/20">
              {Object.values(statusCounts).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`filter-btn inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${filter === s ? "filter-btn-active" : ""}`}
          >
            {STATUS_LABELS[s]}
            {statusCounts[s] ? (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none bg-white/20">
                {statusCounts[s]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Cartes leads */}
      <div id="leads-list" className="space-y-3">
        {leads.map((lead) => {
          const contactName = [lead.contact?.first_name, lead.contact?.last_name].filter(Boolean).join(" ") || "—";
          const isApptLead = lead.request_type === "b2c_appointment" || lead.request_type === "b2b_appointment";
          const availableStatuses = isApptLead ? APPT_STATUSES : STATUSES;
          return (
          <div key={lead.id} className="bg-white rounded-xl shadow p-4 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{contactName}</p>
                    {isApptLead && (
                      <span className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-600 border border-primary-200 rounded-full px-2 py-0.5 font-medium shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                        RDV
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {lead.contact?.email}
                    {lead.contact?.phone ? ` · ${lead.contact.phone}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{TYPE_LABELS[lead.request_type] ?? lead.request_type}</span>
                    {lead.source && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>{SOURCE_LABELS[lead.source] ?? lead.source}</span>
                      </>
                    )}
                    {lead.created_at && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>{new Date(lead.created_at).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </span>
                  <select
                    value={lead.status}
                    onChange={(e) => updateStatus(lead.id, e.target.value)}
                    className="text-sm border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    {availableStatuses.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aperçu message du prospect */}
              {lead.notes && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 italic border-l-2 border-gray-200">
                  <span className="not-italic font-medium text-gray-400 mr-1">Message :</span>
                  {lead.notes.length > 180 ? lead.notes.slice(0, 180) + "…" : lead.notes}
                </div>
              )}

              {/* Note interne — visible dès que le lead est qualifié */}
              {NOTE_STATUSES.has(lead.status) && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Note interne
                    {noteSaving === lead.id && <span className="ml-1 text-gray-400">Sauvegarde…</span>}
                  </label>
                  <textarea
                    rows={2}
                    defaultValue={lead.internal_note ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (lead.internal_note ?? "")) {
                        saveNote(lead.id, e.target.value);
                      }
                    }}
                    placeholder="Rappel mémo, contexte de la qualification, prochaine étape…"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-primary-300 bg-yellow-50 placeholder-gray-400"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-gray-50">
                {botUsername ? (
                  <button
                    onClick={() => generateTelegramLink(lead)}
                    disabled={generatingFor === lead.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.46l-2.945-.92c-.64-.203-.654-.64.136-.954l11.498-4.43c.534-.194 1.001.13.835.965z"/>
                    </svg>
                    {generatingFor === lead.id ? "Génération…" : "Lien Telegram"}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 py-1.5">
                    Configurez le bot Telegram dans Agents IA pour générer des liens.
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {!loading && leads.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">{t.lead_none}.</p>
        )}

        {/* Sentinel infinite scroll */}
        {hasMore && (
          <div ref={sentinelRef} className="h-10 flex items-center justify-center">
            {loading && (
              <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        )}

        {!hasMore && leads.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-2">Tous les leads sont affichés.</p>
        )}
      </div>

      </> /* fin vue liste */}

      {/* ── Modal Qualifié → RDV planifié ───────────────────────────────── */}
      {schedulingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-2xl shadow-2xl max-w-lg max-h-[90dvh] flex flex-col rounded-t-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Passage à "{vocab.appointment} planifié(e)"</h3>
                <p className="text-xs text-gray-500 mt-0.5">{schedulingModal.contactName}</p>
              </div>
              <button onClick={() => setSchedulingModal(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">×</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-5">
              {schedulingModal.loading ? (
                <div className="text-center py-8 text-gray-400">Vérification des {vocab.appointments.toLowerCase()}…</div>
              ) : schedulingModal.appointments.length > 0 ? (
                /* ── CAS 1 : RDV futurs trouvés ── */
                <div className="space-y-4">
                  <div className="flex gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    <p className="text-xs text-green-800 leading-relaxed">
                      {schedulingModal.appointments.length} {vocab.appointment.toLowerCase()} futur{schedulingModal.appointments.length > 1 ? "s" : ""} trouvé{schedulingModal.appointments.length > 1 ? "s" : ""} pour ce {vocab.contact.toLowerCase()}. Choisissez celui qui correspond à cette demande.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {schedulingModal.appointments.map(a => {
                      const d = new Date(a.scheduled_at);
                      const dateStr = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
                      const timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                      const isSelected = schedulingModal.selectedApptId === a.id;
                      return (
                        <label key={a.id}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${isSelected ? "border-primary-400 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}>
                          <input type="radio" name="appt" value={a.id} checked={isSelected}
                            onChange={() => setSchedulingModal(m => m ? { ...m, selectedApptId: a.id } : null)}
                            className="accent-primary-600 w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-sm text-gray-900 capitalize">{dateStr} à {timeStr}</p>
                            {a.service_offer?.name && <p className="text-xs text-gray-500">{a.service_offer.name}</p>}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${a.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {a.status === "confirmed" ? "Confirmé" : "En attente"}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── CAS 2 : Aucun RDV futur ── */
                <div className="space-y-4">
                  <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Aucun {vocab.appointment.toLowerCase()} futur trouvé pour <strong>{schedulingModal.contactName}</strong>. Pour passer en "{vocab.appointment} planifié(e)", vous devez d'abord créer {vocab.appointment.toLowerCase()} avec ce {vocab.contact.toLowerCase()}.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">Ou si la situation a changé, vous pouvez fermer ce lead directement :</p>
                  <div className="flex gap-2">
                    <button onClick={async () => { await applyStatus(schedulingModal.leadId, "closed_won"); setSchedulingModal(null); }}
                      className="flex-1 rounded-xl border-2 border-green-200 bg-green-50 text-green-800 py-2.5 text-sm font-semibold hover:bg-green-100 active:scale-95 transition-all">
                      ✓ Marquer Gagné
                    </button>
                    <button onClick={async () => { await applyStatus(schedulingModal.leadId, "closed_lost"); setSchedulingModal(null); }}
                      className="flex-1 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 py-2.5 text-sm font-semibold hover:bg-red-100 active:scale-95 transition-all">
                      ✗ Marquer Perdu
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 flex-shrink-0 border-t border-gray-100">
              {schedulingModal.appointments.length > 0 ? (
                <>
                  <button onClick={() => setSchedulingModal(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 active:scale-95 transition-all">
                    Annuler
                  </button>
                  <button
                    disabled={!schedulingModal.selectedApptId}
                    onClick={async () => {
                      await applyStatus(schedulingModal.leadId, "scheduled");
                      setSchedulingModal(null);
                    }}
                    className="flex-1 rounded-xl bg-primary-600 text-white py-2.5 text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 active:scale-95 transition-all shadow-sm">
                    Confirmer — passer en RDV planifié →
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setSchedulingModal(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 active:scale-95 transition-all">
                    Annuler
                  </button>
                  <a href={`/dashboard/appointments`}
                    onClick={() => applyStatus(schedulingModal.leadId, "scheduled")}
                    className="flex-1 rounded-xl bg-primary-600 text-white py-2.5 text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/>
                    </svg>
                    Créer un RDV →
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal lien Telegram */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-lg">Lien d'invitation Telegram</h2>
              <p className="text-sm text-gray-500 mt-1">
                Envoyez ce lien à <span className="font-medium text-gray-700">{linkModal.contactName}</span> par SMS, email ou autre.
                Quand il clique et appuie START, il est automatiquement lié à votre bot.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <span className="flex-1 text-xs font-mono text-gray-700 break-all select-all">
                  {linkModal.link}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-primary-600 text-white rounded-xl px-4 py-2.5 hover:bg-primary-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copié !
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copier le lien
                    </>
                  )}
                </button>
                <a
                  href={linkModal.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-xl px-4 py-2.5 hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.46l-2.945-.92c-.64-.203-.654-.64.136-.954l11.498-4.43c.534-.194 1.001.13.835.965z"/>
                  </svg>
                  Ouvrir
                </a>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-xs text-amber-700">
                Ce lien est à usage unique et expire selon la durée configurée. Une fois que le client appuie START, il peut vous écrire directement sur Telegram.
              </p>
            </div>

            <button
              onClick={() => { setLinkModal(null); setCopied(false); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
