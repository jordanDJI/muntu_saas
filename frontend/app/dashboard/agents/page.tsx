"use client";
import { useEffect, useRef, useState } from "react";
import { api, supabase } from "../../../lib/api";
import { UpgradeGate } from "../components/UpgradeGate";
import { useSubscription } from "../../../contexts/SubscriptionContext";
import type { FeatureKey } from "../../../contexts/SubscriptionContext";
import { useLanguage } from "../../../contexts/LanguageContext";

const AGENT_FEATURE: Record<string, FeatureKey> = {
  support_client:   "agent_support",
  assistant_tenant: "agent_assistant",
};

const AGENT_ORDER = ["vitrine", "support_client", "assistant_tenant"] as const;
type AgentType = typeof AGENT_ORDER[number];

type ChatMsg = { role: "user" | "assistant"; content: string };
type Panel = AgentType | "syntheses";

function AgentIcon({ type }: { type: AgentType }) {
  if (type === "vitrine")
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg>;
  if (type === "support_client")
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4-.8L3 20l1.4-4.2A7.8 7.8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>;
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" d="M9.75 3.104A9 9 0 0112 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9c0-1.04.177-2.04.5-2.97"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/></svg>;
}

// ── Agent 2 — panneau de configuration enrichi (4 onglets) ───────────────────

type FaqPair = { q: string; a: string };
type QuoteVar = { name: string; label: string; type: "text" | "number" | "select" };
type A2Tab = "identity" | "knowledge" | "quote" | "behavior" | "docs";

function Agent2Panel({
  cfg,
  onUpdate,
  saving,
  saveOk,
}: {
  cfg: any;
  onUpdate: (type: string, field: string, value: any) => Promise<void>;
  saving: string | null;
  saveOk: string | null;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<A2Tab>("identity");

  // Identité
  const [personaName, setPersonaName] = useState(cfg.persona_name ?? "");
  const [personaTone, setPersonaTone] = useState(cfg.persona_tone ?? "friendly");

  // Connaissance métier
  const [knowledge, setKnowledge] = useState(cfg.knowledge_base ?? "");
  const [faqPairs, setFaqPairs] = useState<FaqPair[]>(cfg.faq_pairs ?? []);

  // Devis
  const [quoteEnabled, setQuoteEnabled] = useState<boolean>(cfg.quote_enabled ?? false);
  const [quoteVars, setQuoteVars] = useState<QuoteVar[]>(cfg.quote_variables ?? []);

  // Comportement
  const [escalation, setEscalation] = useState((cfg.escalation_triggers ?? []).join(", "));
  const [urgent, setUrgent] = useState((cfg.urgent_keywords ?? []).join(", "));
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(cfg.memory_enabled ?? true);
  const [photoEnabled, setPhotoEnabled] = useState<boolean>(cfg.photo_diagnosis_enabled ?? false);
  const [diagEnabled, setDiagEnabled] = useState<boolean>(cfg.diagnostic_mode_enabled ?? false);
  const [followupEnabled, setFollowupEnabled] = useState<boolean>(cfg.followup_enabled ?? false);
  const [followupDelay, setFollowupDelay] = useState<number>(cfg.followup_delay_hours ?? 24);
  const [followupMsg, setFollowupMsg] = useState<string>(cfg.followup_message ?? "");

  // Documents RAG
  const [docs, setDocs] = useState<{ filename: string; chunk_count: number }[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      const res = await api.ragDocuments();
      setDocs(res ?? []);
    } catch {
      // silent
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "docs") loadDocs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const save = async (field: string, value: any) => { await onUpdate("support_client", field, value); };

  const TABS: { key: A2Tab; label: string; icon: string }[] = [
    { key: "identity",  label: t.agt_a2_tab_identity,  icon: "👤" },
    { key: "knowledge", label: t.agt_a2_tab_knowledge,  icon: "🧠" },
    { key: "quote",     label: t.agt_a2_tab_quote,      icon: "💶" },
    { key: "behavior",  label: t.agt_a2_tab_behavior,   icon: "⚡" },
    { key: "docs",      label: t.agt_a2_tab_docs,       icon: "📄" },
  ];

  const tabBtn = (k: A2Tab, label: string, icon: string) => (
    <button
      key={k}
      onClick={() => setTab(k)}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
        tab === k ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      <span>{icon}</span>{label}
    </button>
  );

  const tones = [
    { v: "friendly",  label: t.agt_a2_tone_friendly,  desc: t.agt_a2_tone_friendly_desc },
    { v: "formal",    label: t.agt_a2_tone_formal,     desc: t.agt_a2_tone_formal_desc },
    { v: "technical", label: t.agt_a2_tone_technical,  desc: t.agt_a2_tone_technical_desc },
  ] as { v: string; label: string; desc: string }[];

  return (
    <div className="space-y-4">
      {/* Canal info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
        <p className="font-medium text-blue-800">{t.agt_a2_channel_title}</p>
        <p>{t.agt_a2_channel_desc}</p>
        <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-1">{t.agt_a2_whatsapp_pending}</p>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex gap-1 p-2 border-b border-gray-100 bg-gray-50 flex-wrap">
          {TABS.map(({ key, label, icon }) => tabBtn(key, label, icon))}
        </div>

        <div className="p-4 sm:p-5 space-y-4">

          {/* ── Identité ─────────────────────────────────────────── */}
          {tab === "identity" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{t.agt_a2_persona_name_label}</label>
                <input
                  type="text"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  onBlur={() => save("persona_name", personaName)}
                  placeholder={t.agt_a2_persona_name_ph}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <p className="text-xs text-gray-400 mt-1">{t.agt_a2_persona_name_hint}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">{t.agt_a2_tone_label}</label>
                <div className="grid grid-cols-3 gap-2">
                  {tones.map(({ v, label, desc }) => (
                    <button
                      key={v}
                      onClick={() => { setPersonaTone(v); save("persona_tone", v); }}
                      className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                        personaTone === v
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-600"
                      }`}
                    >
                      <p className="font-medium">{label}</p>
                      <p className="text-gray-400 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {saveOk === "support_client" && <p className="text-xs text-green-600">✓ Sauvegardé</p>}
            </div>
          )}

          {/* ── Connaissance métier ───────────────────────────────── */}
          {tab === "knowledge" && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {t.agt_a2_knowledge_label}
                </label>
                <p className="text-xs text-gray-400 mb-2">{t.agt_a2_knowledge_desc}</p>
                <textarea
                  rows={8}
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                  onBlur={() => save("knowledge_base", knowledge)}
                  placeholder={t.agt_a2_knowledge_ph}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">{t.agt_a2_faq_label}</label>
                  <button
                    onClick={() => setFaqPairs((p) => [...p, { q: "", a: "" }])}
                    className="text-xs text-primary-600 hover:underline font-medium"
                  >
                    {t.agt_a2_add}
                  </button>
                </div>
                {faqPairs.length === 0 && (
                  <p className="text-xs text-gray-400">{t.agt_a2_faq_empty}</p>
                )}
                <div className="space-y-3">
                  {faqPairs.map((pair, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
                      <input
                        type="text"
                        value={pair.q}
                        onChange={(e) => {
                          const next = [...faqPairs];
                          next[i] = { ...next[i], q: e.target.value };
                          setFaqPairs(next);
                        }}
                        onBlur={() => save("faq_pairs", faqPairs)}
                        placeholder={t.agt_a2_faq_q_ph}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
                      />
                      <textarea
                        rows={2}
                        value={pair.a}
                        onChange={(e) => {
                          const next = [...faqPairs];
                          next[i] = { ...next[i], a: e.target.value };
                          setFaqPairs(next);
                        }}
                        onBlur={() => save("faq_pairs", faqPairs)}
                        placeholder={t.agt_a2_faq_a_ph}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white resize-none focus:outline-none focus:ring-1 focus:ring-primary-400"
                      />
                      <button
                        onClick={() => { const next = faqPairs.filter((_, j) => j !== i); setFaqPairs(next); save("faq_pairs", next); }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        {t.agt_a2_delete}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {saveOk === "support_client" && <p className="text-xs text-green-600">✓ Sauvegardé</p>}
            </div>
          )}

          {/* ── Devis indicatif ───────────────────────────────────── */}
          {tab === "quote" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t.agt_a2_quote_label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.agt_a2_quote_desc}</p>
                </div>
                <button
                  onClick={() => { const next = !quoteEnabled; setQuoteEnabled(next); save("quote_enabled", next); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${quoteEnabled ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${quoteEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {quoteEnabled && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">{t.agt_a2_quote_vars_label}</label>
                    <button
                      onClick={() => setQuoteVars((v) => [...v, { name: "", label: "", type: "text" }])}
                      className="text-xs text-primary-600 hover:underline font-medium"
                    >
                      {t.agt_a2_add}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{t.agt_a2_quote_vars_desc}</p>
                  {quoteVars.length === 0 && (
                    <p className="text-xs text-gray-400">{t.agt_a2_quote_vars_empty}</p>
                  )}
                  <div className="space-y-2">
                    {quoteVars.map((v, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={v.label}
                          onChange={(e) => { const next = [...quoteVars]; next[i] = { ...next[i], label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, "_") }; setQuoteVars(next); }}
                          onBlur={() => save("quote_variables", quoteVars)}
                          placeholder={t.agt_a2_quote_var_ph}
                          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        />
                        <select
                          value={v.type}
                          onChange={(e) => { const next = [...quoteVars]; next[i] = { ...next[i], type: e.target.value as "text" | "number" | "select" }; setQuoteVars(next); save("quote_variables", next); }}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 focus:outline-none"
                        >
                          <option value="text">{t.agt_a2_type_text}</option>
                          <option value="number">{t.agt_a2_type_number}</option>
                        </select>
                        <button onClick={() => { const next = quoteVars.filter((_, j) => j !== i); setQuoteVars(next); save("quote_variables", next); }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {saveOk === "support_client" && <p className="text-xs text-green-600">✓ Sauvegardé</p>}
            </div>
          )}

          {/* ── Comportement ──────────────────────────────────────── */}
          {tab === "behavior" && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{t.agt_a2_escalation_label}</label>
                <p className="text-xs text-gray-400 mb-1.5">{t.agt_a2_escalation_desc}</p>
                <input
                  type="text"
                  value={escalation}
                  onChange={(e) => setEscalation(e.target.value)}
                  onBlur={() => save("escalation_triggers", escalation.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder={t.agt_a2_escalation_ph}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{t.agt_a2_urgent_label}</label>
                <p className="text-xs text-gray-400 mb-1.5">{t.agt_a2_urgent_desc}</p>
                <input
                  type="text"
                  value={urgent}
                  onChange={(e) => setUrgent(e.target.value)}
                  onBlur={() => save("urgent_keywords", urgent.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder={t.agt_a2_urgent_ph}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t.agt_a2_memory_label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.agt_a2_memory_desc}</p>
                </div>
                <button
                  onClick={() => { const next = !memoryEnabled; setMemoryEnabled(next); save("memory_enabled", next); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${memoryEnabled ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${memoryEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Photo pré-diagnostic */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t.agt_a2_photo_label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.agt_a2_photo_desc}</p>
                </div>
                <button
                  onClick={() => { const next = !photoEnabled; setPhotoEnabled(next); save("photo_diagnosis_enabled", next); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${photoEnabled ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${photoEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Note #brief */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
                💡 {t.agt_a2_brief_hint}
              </div>

              {/* Mode diagnostic guidé */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t.agt_a2_diag_label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.agt_a2_diag_desc}</p>
                </div>
                <button
                  onClick={() => { const next = !diagEnabled; setDiagEnabled(next); save("diagnostic_mode_enabled", next); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${diagEnabled ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${diagEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Suivi post-RDV */}
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t.agt_a2_followup_label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.agt_a2_followup_desc}</p>
                  </div>
                  <button
                    onClick={() => { const next = !followupEnabled; setFollowupEnabled(next); save("followup_enabled", next); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${followupEnabled ? "bg-green-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${followupEnabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                {followupEnabled && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">{t.agt_a2_followup_delay}</label>
                      <input
                        type="number"
                        min={1}
                        max={168}
                        value={followupDelay}
                        onChange={(e) => setFollowupDelay(Number(e.target.value))}
                        onBlur={() => save("followup_delay_hours", followupDelay)}
                        className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">{t.agt_a2_followup_msg_label}</label>
                      <textarea
                        rows={3}
                        value={followupMsg}
                        onChange={(e) => setFollowupMsg(e.target.value)}
                        onBlur={() => save("followup_message", followupMsg)}
                        placeholder={t.agt_a2_followup_msg_ph}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {saveOk === "support_client" && <p className="text-xs text-green-600">✓ Sauvegardé</p>}
            </div>
          )}

          {/* ── Documents RAG ──────────────────────────────────────── */}
          {tab === "docs" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">{t.agt_a2_docs_label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.agt_a2_docs_desc}</p>
              </div>

              {/* Upload */}
              <label className={`flex items-center gap-2 cursor-pointer w-fit ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      await api.ragUpload(file);
                      await loadDocs();
                    } catch {
                      // silent
                    } finally {
                      setUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
                  📄 {uploading ? t.agt_a2_docs_uploading : t.agt_a2_docs_upload}
                </span>
              </label>

              {/* Liste des documents */}
              {docsLoading ? (
                <div className="text-xs text-gray-400">Chargement…</div>
              ) : docs.length === 0 ? (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">{t.agt_a2_docs_empty}</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((doc) => (
                    <li key={doc.filename} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm text-gray-700 font-medium truncate max-w-[220px]">{doc.filename}</p>
                        <p className="text-xs text-gray-400">{doc.chunk_count} {t.agt_a2_docs_chunks}</p>
                      </div>
                      <button
                        onClick={async () => {
                          setDeletingDoc(doc.filename);
                          try {
                            await api.ragDeleteDocument(doc.filename);
                            await loadDocs();
                          } catch {
                            // silent
                          } finally {
                            setDeletingDoc(null);
                          }
                        }}
                        disabled={deletingDoc === doc.filename}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 ml-2 shrink-0"
                      >
                        {deletingDoc === doc.filename ? "…" : t.agt_a2_docs_delete}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { hasFeature } = useSubscription();
  const { t } = useLanguage();

  const SIDEBAR_LABELS: Record<AgentType, { name: string; role: string }> = {
    vitrine:          { name: t.agt_vitrine_label,   role: t.agt_vitrine_role },
    support_client:   { name: t.agt_support_label,   role: t.agt_support_role },
    assistant_tenant: { name: t.agt_assistant_label, role: t.agt_assistant_role },
  };

  const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
    vitrine:          t.agt_vitrine_desc,
    support_client:   t.agt_support_desc,
    assistant_tenant: t.agt_assistant_desc,
  };
  const [configs, setConfigs]             = useState<any[]>([]);
  const [syntheses, setSyntheses]         = useState<any[]>([]);
  const [selected, setSelected]           = useState<Panel>("assistant_tenant");
  const [activeTab, setActiveTab]         = useState<"chat" | "config">("chat");
  const [saving, setSaving]               = useState<string | null>(null);
  const [saveOk, setSaveOk]               = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [userName, setUserName]           = useState("");
  const [myRole, setMyRole]               = useState("member");
  const [mobileView, setMobileView]       = useState<"list" | "panel">("panel");

  // Chat
  const [chatMessages, setChatMessages]   = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]         = useState("");
  const [inputHeight, setInputHeight]     = useState(42);
  const [chatLoading, setChatLoading]     = useState(false);
  const [chatConvId, setChatConvId]       = useState<string | null>(null);
  const chatEndRef                        = useRef<HTMLDivElement>(null);
  const inputRef                          = useRef<HTMLTextAreaElement>(null);

  // Telegram
  const [tgLoading, setTgLoading]         = useState(false);
  const [tgMsg, setTgMsg]                 = useState<{ ok: boolean; text: string } | null>(null);
  const [botUsername, setBotUsername]     = useState("");
  const [activateUrl, setActivateUrl]     = useState("");

  useEffect(() => {
    api.getAgentConfigs().then((cfgs) => {
      setConfigs(cfgs);
      const a3 = cfgs.find((c: any) => c.agent_type === "assistant_tenant");
      if (a3?.telegram_bot_token) {
        api.getTelegramBotInfo().then((i) => { setBotUsername(i.username); setActivateUrl(i.activate_url); }).catch(() => {});
      }
    }).catch(console.error);
    api.getAgentSyntheses().then(setSyntheses).catch(console.error);
    api.getMyRole().then(({ role }) => setMyRole(role)).catch(() => {});
    api.assistantHistory().then(({ conversation_id, messages }) => {
      if (conversation_id) setChatConvId(conversation_id);
      if (messages.length > 0)
        setChatMessages(messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }).catch(console.error);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const m = user.user_metadata ?? {};
      setUserName([m.first_name, m.last_name].filter(Boolean).join(" ") || m.full_name || user.email?.split("@")[0] || "");
    });
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "auto" }); }, [chatMessages]);

  const config = (type: AgentType) => configs.find((c) => c.agent_type === type);

  const handleSelect = (panel: Panel) => {
    setSelected(panel);
    if (panel === "assistant_tenant") setActiveTab("chat");
    setMobileView("panel");
  };

  const handleUpdate = async (agentType: string, field: string, value: string | number) => {
    setSaving(agentType); setError(null);
    try {
      const updated = await api.updateAgentConfig(agentType, { [field]: value });
      setConfigs((prev) => prev.map((c) => (c.agent_type === agentType ? updated : c)));
      setSaveOk(agentType);
      setTimeout(() => setSaveOk(null), 2000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  };

  const toggleStatus = (c: any) => handleUpdate(c.agent_type, "status", c.status === "active" ? "inactive" : "active");

  const setupTelegram = async () => {
    setTgLoading(true); setTgMsg(null);
    try {
      const res = await api.setupTelegramWebhook();
      if (res.bot_username) setBotUsername(res.bot_username);
      api.getTelegramBotInfo().then((i) => { setBotUsername(i.username); setActivateUrl(i.activate_url); }).catch(() => {});
      setTgMsg({ ok: true, text: `Webhook enregistré${res.bot_username ? ` (@${res.bot_username})` : ""}` });
    } catch (e: any) { setTgMsg({ ok: false, text: e.message }); }
    finally { setTgLoading(false); }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setInputHeight(42);
    setChatMessages((p) => [...p, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const res = await api.assistantChat({ message: text, conversation_id: chatConvId });
      setChatConvId(res.conversation_id);
      setChatMessages((p) => [...p, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      setChatMessages((p) => [...p, { role: "assistant", content: `Erreur : ${e.message}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // ── Back button (mobile only) ──────────────────────────────────────────────
  const BackButton = () => (
    <button
      onClick={() => setMobileView("list")}
      className="md:hidden flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      {t.agt_back}
    </button>
  );

  // ── Config panel ──────────────────────────────────────────────────────────
  const ConfigPanel = ({ type }: { type: AgentType }) => {
    const cfg = config(type);
    if (!cfg) return <div className="p-8 text-gray-400 text-sm">{t.dash_loading}</div>;
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-2xl w-full mx-auto">

        {/* Statut */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 sm:px-5 py-4">
          <div className="flex-1 min-w-0 pr-4">
            <p className="font-medium text-gray-800">{t.agt_agent_status}</p>
            <p className="text-xs text-gray-400 mt-0.5">{AGENT_DESCRIPTIONS[type]}</p>
          </div>
          <button
            onClick={() => toggleStatus(cfg)}
            disabled={saving === type}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${cfg.status === "active" ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${cfg.status === "active" ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Prompt système */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 sm:px-5 py-4 space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {t.agt_system_prompt} <span className="text-gray-400 font-normal">{t.agt_optional}</span>
          </label>
          <textarea
            rows={5}
            defaultValue={cfg.system_prompt ?? ""}
            onBlur={(e) => { if (e.target.value !== (cfg.system_prompt ?? "")) handleUpdate(type, "system_prompt", e.target.value); }}
            placeholder={`Ex : Tu es l'assistant de ${userName || "votre nom"}, réponds toujours en français, sois bienveillant…`}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50"
          />
          {saveOk === type && <p className="text-xs text-green-600">{t.agt_saved}</p>}
        </div>

        {/* Agent 2 — panneau de configuration enrichi */}
        {type === "support_client" && <Agent2Panel cfg={cfg} onUpdate={handleUpdate} saving={saving} saveOk={saveOk} />}

        {/* Agent 3 — Telegram + synthèse */}
        {type === "assistant_tenant" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 px-4 sm:px-5 py-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">{t.agt_telegram_bot}</p>
              {(myRole === "owner" || myRole === "admin") ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Token — créez le bot sur{" "}
                      <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline text-primary-600">@BotFather</a>
                    </label>
                    <input
                      type="text"
                      defaultValue={cfg.telegram_bot_token ?? ""}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (cfg.telegram_bot_token ?? "")) { handleUpdate(type, "telegram_bot_token", v); setBotUsername(""); } }}
                      placeholder="123456789:AAF..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={setupTelegram}
                      disabled={tgLoading || !cfg.telegram_bot_token}
                      className="text-sm bg-primary-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-primary-700 disabled:opacity-40 transition-colors"
                    >
                      {tgLoading ? "Enregistrement…" : "Enregistrer le webhook"}
                    </button>
                    {tgMsg && <span className={`text-xs ${tgMsg.ok ? "text-green-600" : "text-red-600"}`}>{tgMsg.ok ? "✓ " : "✗ "}{tgMsg.text}</span>}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">Configuration réservée au propriétaire / admin.</p>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-2">Activer l'assistant sur votre Telegram personnel</p>
                {cfg.telegram_notify_chat_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-1 font-medium">✓ Activé</span>
                    <button onClick={() => handleUpdate(type, "telegram_notify_chat_id", "")} className="text-xs text-red-500 hover:underline">Désactiver</button>
                  </div>
                ) : activateUrl ? (
                  <a href={activateUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors">
                    {botUsername ? `Ouvrir @${botUsername} et activer` : "Activer l'assistant Telegram"}
                  </a>
                ) : (
                  <p className="text-xs text-gray-400">{cfg.telegram_bot_token ? "Enregistrez d'abord le webhook." : "Entrez le token du bot ci-dessus."}</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 sm:px-5 py-4 space-y-2">
              <label className="text-sm font-medium text-gray-700">Fréquence de synthèse <span className="text-gray-400 font-normal">(minutes)</span></label>
              <input
                type="number" min={30} max={1440}
                defaultValue={cfg.synthesis_schedule_minutes}
                onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== cfg.synthesis_schedule_minutes) handleUpdate(type, "synthesis_schedule_minutes", v); }}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <p className="text-xs text-gray-400">Min 30 min — Max 1440 min (24h)</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Chat panel (Agent 3) ───────────────────────────────────────────────────
  const isChatActive = config("assistant_tenant")?.status === "active";

  // ── Synthèses panel ────────────────────────────────────────────────────────
  const SynthesesPanel = () => (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-2xl w-full mx-auto">
      <h2 className="font-semibold text-gray-800 text-lg">{t.agt_syntheses_title}</h2>
      {syntheses.length === 0
        ? <p className="text-gray-400 text-sm">Aucune synthèse générée pour le moment.</p>
        : syntheses.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-2">
            <p className="text-xs text-gray-400">
              {new Date(s.period_start).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
              {" → "}
              {new Date(s.period_end).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{s.content}</p>
          </div>
        ))
      }
    </div>
  );

  const currentAgentType = AGENT_ORDER.includes(selected as AgentType) ? selected as AgentType : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        id="agents-list"
        className={`bg-gray-900 flex flex-col shrink-0 ${
          mobileView === "panel" ? "hidden md:flex md:w-56" : "flex w-full md:w-56"
        }`}
      >
        <div className="px-4 py-4 border-b border-gray-700">
          <p className="text-white font-semibold text-sm">{t.agt_title}</p>
          <p className="text-gray-500 text-xs mt-0.5">Propulsé par Gemini</p>
        </div>

        <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto">
          {AGENT_ORDER.map((type) => {
            const cfg = config(type);
            const isActive = cfg?.status === "active";
            const isSelected = selected === type;
            return (
              <button
                key={type}
                onClick={() => handleSelect(type)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <div className={`shrink-0 ${isSelected ? "text-primary-400" : "text-gray-500"}`}>
                  <AgentIcon type={type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{SIDEBAR_LABELS[type].name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-green-400" : "bg-gray-600"}`} />
                    <p className="text-xs text-gray-500 truncate">{SIDEBAR_LABELS[type].role}</p>
                  </div>
                </div>
                {/* Chevron on mobile */}
                <svg className="w-4 h-4 text-gray-600 shrink-0 md:hidden" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            );
          })}
        </nav>

        {/* Synthèses */}
        <button
          onClick={() => { setSelected("syntheses"); setMobileView("panel"); }}
          className={`flex items-center gap-3 px-4 py-3 border-t border-gray-700 transition-colors ${
            selected === "syntheses" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span className="text-sm font-medium flex-1 text-left">{t.agt_syntheses}</span>
          {syntheses.length > 0 && (
            <span className="bg-primary-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
              {syntheses.length}
            </span>
          )}
          <svg className="w-4 h-4 text-gray-600 shrink-0 md:hidden" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </aside>

      {/* ── Contenu principal ───────────────────────────────────────────────── */}
      <main
        id="agent-panel"
        className={`flex-1 flex-col overflow-hidden bg-gray-50 relative ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {error && (
          <div className="bg-red-50 border-b border-red-100 px-4 sm:px-6 py-2 text-xs text-red-700">{error}</div>
        )}

        {/* Agent 3 — tabs Chat / Configuration */}
        {selected === "assistant_tenant" && (
          <>
            <div className="bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-1 shrink-0">
              <BackButton />
              <button
                onClick={() => setActiveTab("chat")}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "chat" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4-.8L3 20l1.4-4.2A7.8 7.8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                {t.agt_chat_tab}
              </button>
              <button
                onClick={() => setActiveTab("config")}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "config" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                {t.agt_config_tab}
              </button>
            </div>
            {activeTab === "chat" ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-gray-400">
                      <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center">
                        <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" d="M9.75 3.104A9 9 0 0112 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9c0-1.04.177-2.04.5-2.97"/>
                          <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-600">Bonjour{userName ? `, ${userName.split(" ")[0]}` : ""} !</p>
                        <p className="text-sm mt-1">Posez une question sur vos RDV, vos demandes ou votre planning.</p>
                        {!isChatActive && <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-1 rounded-full">Agent inactif — activez-le dans Configuration</p>}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center mr-2 mt-1 shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.75 1.104A9 9 0 1118.5 10a9.006 9.006 0 01-8.75-8.896z"/></svg>
                        </div>
                      )}
                      <div className={`max-w-[80%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary-600 text-white rounded-tr-sm"
                          : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center mr-2 shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.75 1.104A9 9 0 1118.5 10a9.006 9.006 0 01-8.75-8.896z"/></svg>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                        <div className="flex gap-1 items-center">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                {/* Input */}
                <div className="border-t border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-end gap-3 max-w-3xl mx-auto">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={chatInput}
                      onChange={(e) => { setChatInput(e.target.value); e.target.style.height = "auto"; setInputHeight(Math.min(e.target.scrollHeight, 200)); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                      placeholder={t.agt_question_ph}
                      disabled={!isChatActive}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 bg-gray-50 overflow-y-auto"
                      style={{ height: `${inputHeight}px` }}
                    />
                    <button
                      onClick={sendChat}
                      disabled={chatLoading || !chatInput.trim() || !isChatActive}
                      className="h-[42px] w-[42px] bg-primary-600 text-white rounded-xl flex items-center justify-center hover:bg-primary-700 disabled:opacity-40 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : <ConfigPanel type="assistant_tenant" />}
          </>
        )}

        {/* Agents 1 & 2 — config uniquement */}
        {currentAgentType && currentAgentType !== "assistant_tenant" && (
          <>
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0 flex items-center gap-3">
              <BackButton />
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{SIDEBAR_LABELS[currentAgentType].name}</p>
                <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{AGENT_DESCRIPTIONS[currentAgentType]}</p>
              </div>
            </div>
            <ConfigPanel type={currentAgentType} />
          </>
        )}

        {/* Synthèses */}
        {selected === "syntheses" && (
          <>
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0 flex items-center gap-3">
              <BackButton />
              <p className="font-semibold text-gray-800">{t.agt_syntheses_recent}</p>
            </div>
            <SynthesesPanel />
          </>
        )}

        {/* Feature gate overlay */}
        {(() => {
          const feat = AGENT_FEATURE[selected];
          if (!feat || hasFeature(feat)) return null;
          return (
            <div className="absolute inset-0 flex items-center justify-center p-8 z-10" style={{ background: "rgba(241,237,230,0.96)" }}>
              <UpgradeGate feature={feat}><></></UpgradeGate>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
