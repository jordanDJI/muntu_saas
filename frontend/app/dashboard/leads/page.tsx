"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

const STATUSES = ["new", "contacted", "qualified", "scheduled", "closed_won", "closed_lost"];

const STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  contacted: "Contacté",
  qualified: "Qualifié",
  scheduled: "RDV planifié",
  closed_won: "Gagné",
  closed_lost: "Perdu",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-purple-100 text-purple-700",
  scheduled: "bg-indigo-100 text-indigo-700",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-gray-100 text-gray-500",
};

type LinkModal = {
  contactName: string;
  link: string;
};

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [botUsername, setBotUsername] = useState<string>("");
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModal | null>(null);
  const [copied, setCopied] = useState(false);
  const [noteSaving, setNoteSaving] = useState<string | null>(null);

  const load = (status?: string) => {
    api.getLeads(status ? { status } : undefined).then(setLeads).catch(console.error);
  };

  useEffect(() => {
    load(filter);
    api.getTelegramBotInfo()
      .then((info) => setBotUsername(info.username))
      .catch(() => {});
  }, []);

  useEffect(() => { load(filter); }, [filter]);

  const updateStatus = async (id: string, newStatus: string) => {
    await api.updateLead(id, { status: newStatus });
    load(filter);
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
        <h1 className="text-2xl font-bold">Demandes (leads)</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour au dashboard
        </button>
      </div>

      {/* Filtres par statut */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter(undefined)}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${!filter ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          Tous
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${filter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Cartes leads */}
      <div className="space-y-3">
        {leads.map((lead) => {
          const contactName = [lead.contact?.first_name, lead.contact?.last_name].filter(Boolean).join(" ") || "—";
          return (
            <div key={lead.id} className="bg-white rounded-xl shadow p-4 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{contactName}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {lead.contact?.email}
                    {lead.contact?.phone ? ` · ${lead.contact.phone}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {lead.request_type} — {lead.source}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </span>
                  <select
                    value={lead.status}
                    onChange={(e) => updateStatus(lead.id, e.target.value)}
                    className="text-sm border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {STATUSES.map((s) => (
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
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-yellow-50 placeholder-gray-400"
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
                    {/* Icône Telegram */}
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
        {leads.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">Aucune demande trouvée.</p>
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

            {/* Lien */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <span className="flex-1 text-xs font-mono text-gray-700 break-all select-all">
                  {linkModal.link}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-indigo-600 text-white rounded-xl px-4 py-2.5 hover:bg-indigo-700 transition-colors"
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
