"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DesignRequestModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const { t } = useLanguage();

  const ASPECTS = [
    { key: "colors",     label: t.design_req_aspect_colors },
    { key: "font",       label: t.design_req_aspect_font },
    { key: "logo",       label: t.design_req_aspect_logo },
    { key: "photos",     label: t.design_req_aspect_photos },
    { key: "structure",  label: t.design_req_aspect_structure },
    { key: "page",       label: t.design_req_aspect_page },
    { key: "animation",  label: t.design_req_aspect_animation },
  ];

  const [aspects,     setAspects]     = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [examples,    setExamples]    = useState("");
  const [hasPhotos,   setHasPhotos]   = useState<"yes" | "no" | "">("");
  const [deadline,    setDeadline]    = useState("");
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState("");

  const toggle = (key: string) =>
    setAspects(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const send = async () => {
    if (aspects.length === 0) { setError(t.design_req_error_aspect); return; }
    if (!description.trim())  { setError(t.design_req_error_desc);   return; }
    setError(""); setSending(true);

    const aspectLabels = aspects.map(a => ASPECTS.find(x => x.key === a)?.label ?? a).join(", ");
    const message = [
      `Aspects : ${aspectLabels}`,
      ``,
      `Description : ${description.trim()}`,
      examples.trim()   ? `Références : ${examples.trim()}`                               : "",
      hasPhotos         ? `Photos disponibles : ${hasPhotos === "yes" ? "Oui" : "Non"}`   : "",
      deadline.trim()   ? `Délai : ${deadline.trim()}`                                     : "",
    ].filter(Boolean).join("\n");

    try {
      // Créer le ticket support en premier pour récupérer son ID
      const ticket = await api.createSupportTicket({
        subject:     `[Design] ${aspectLabels}`,
        body:        message,
        priority:    "normal",
        ticket_type: "design_request",
      });
      // Créer la design_request liée au ticket
      await api.createDesignRequest({
        message,
        is_additional:    false,
        support_ticket_id: ticket?.id,
      });
      setSent(true);
      onSuccess?.();
    } catch (e: any) {
      setError(e.message ?? "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#fff", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-start justify-between"
          style={{ background: "linear-gradient(135deg, #0D4B58 0%, #1A6E82 100%)" }}>
          <div>
            <h2 className="text-base font-semibold text-white">{t.design_req_title}</h2>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{t.design_req_subtitle}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none ml-4">×</button>
        </div>

        {sent ? (
          <div className="px-6 py-10 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="font-semibold text-gray-800 mb-2">{t.design_req_success_title}</h3>
            <p className="text-sm text-gray-500 mb-6">{t.design_req_success_body}</p>
            <button onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ background: "#0D4B58" }}>
              {t.design_req_close}
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">

            {/* Aspects */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.design_req_aspects_label} <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map(a => {
                  const active = aspects.includes(a.key);
                  return (
                    <button key={a.key} onClick={() => toggle(a.key)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                      style={{
                        background:  active ? "#0D4B58" : "#f9fafb",
                        color:       active ? "#fff"    : "#374151",
                        borderColor: active ? "#0D4B58" : "#e5e7eb",
                      }}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.design_req_desc_label} <span className="text-red-500">*</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={4} placeholder={t.design_req_desc_ph}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-teal-600" />
            </div>

            {/* Exemples */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.design_req_examples_label} <span className="text-gray-400 font-normal text-xs ml-1">(optionnel)</span>
              </label>
              <input value={examples} onChange={e => setExamples(e.target.value)}
                placeholder={t.design_req_examples_ph}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-600" />
              <p className="text-xs text-gray-400 mt-1">{t.design_req_examples_hint}</p>
            </div>

            {/* Photos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.design_req_photos_label}</label>
              <div className="flex gap-3">
                {([["yes", t.design_req_photos_yes], ["no", t.design_req_photos_no]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setHasPhotos(v)}
                    className="flex-1 py-2 rounded-xl text-sm border transition-all"
                    style={{
                      background:  hasPhotos === v ? "#f0fafa" : "#f9fafb",
                      borderColor: hasPhotos === v ? "#0D4B58" : "#e5e7eb",
                      color:       hasPhotos === v ? "#0D4B58" : "#374151",
                      fontWeight:  hasPhotos === v ? 600 : 400,
                    }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Délai */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.design_req_deadline_label} <span className="text-gray-400 font-normal text-xs ml-1">(optionnel)</span>
              </label>
              <input value={deadline} onChange={e => setDeadline(e.target.value)}
                placeholder={t.design_req_deadline_ph}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-600" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-3 pt-1 pb-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                {t.design_req_cancel}
              </button>
              <button onClick={send} disabled={sending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ background: "#0D4B58" }}>
                {sending ? t.design_req_sending : t.design_req_send}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
