"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";

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
    b2c_appointment: "Prise de RDV", b2b_appointment: "Prise de RDV (B2B)",
    contact: "Prise de contact", information: "Demande d'info",
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
    api.getTelegramBotInfo()
      .then((info) => setBotUsername(info.username))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.getLeads({ limit: 500, offset: 0 })
      .then((all: any[]) => {
        const counts: Record<string, number> = {};
        for (const l of all) counts[l.status] = (counts[l.status] ?? 0) + 1;
        setStatusCounts(counts);
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

  const updateStatus = async (id: string, newStatus: string) => {
    await api.updateLead(id, { status: newStatus });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t.lead_title}</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t.sett_back}
        </button>
      </div>

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
