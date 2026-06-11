"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";

type Segment = "all" | "inactive" | "tag";

export default function CampaignsPage() {
  const { t } = useLanguage();

  // Formulaire
  const [name, setName]       = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [tagId, setTagId]     = useState("");
  const [tags, setTags]       = useState<any[]>([]);

  // Preview
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Envoi
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg]     = useState("");

  // Historique
  const [campaigns, setCampaigns]     = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = () =>
    api.getCampaigns().then(setCampaigns).finally(() => setHistoryLoading(false));

  useEffect(() => {
    loadHistory();
    api.getTags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    const tid = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await api.getCampaignPreview(segment === "tag" ? "tag" : segment, segment === "tag" ? tagId || undefined : undefined);
        setPreviewCount(res.count);
      } catch { setPreviewCount(null); }
      finally { setPreviewLoading(false); }
    }, 400);
    return () => clearTimeout(tid);
  }, [segment, tagId]);

  const handleSend = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    if (!previewCount) return;
    setSending(true); setSuccessMsg(""); setErrorMsg("");
    try {
      const res = await api.sendCampaign({
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        segment: segment === "tag" ? "tag" : segment,
        tag_id: segment === "tag" ? tagId || undefined : undefined,
      });
      setSuccessMsg(`${t.campaigns_success} (${res.sent_count} ${t.campaigns_recipients})`);
      setName(""); setSubject(""); setBody(""); setSegment("all"); setTagId("");
      loadHistory();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Erreur");
    } finally { setSending(false); }
  };

  const SEGMENT_OPTIONS: { key: Segment; label: string }[] = [
    { key: "all",      label: t.campaigns_seg_all },
    { key: "inactive", label: t.campaigns_seg_inactive },
    { key: "tag",      label: t.campaigns_seg_tag },
  ];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t.campaigns_title}</h1>
        <Link
          href="/dashboard/contacts"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span className="hidden sm:inline">Contacts</span>
        </Link>
      </div>

      {/* Formulaire nouvelle campagne */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <h2 className="font-semibold text-gray-900">{t.campaigns_new}</h2>
        </div>

        {/* Explication */}
        <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-xs text-blue-700 leading-relaxed">{t.campaigns_explain}</p>
        </div>

        {/* Nom interne */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{t.campaigns_name_label}</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder={t.campaigns_name_ph}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>

        {/* Segment */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{t.campaigns_segment}</label>
          <div className="flex flex-col gap-2">
            {SEGMENT_OPTIONS.map(opt => (
              <label key={opt.key} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${segment === opt.key ? "border-primary-400 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="segment" value={opt.key} checked={segment === opt.key}
                  onChange={() => setSegment(opt.key)} className="accent-primary-600 w-4 h-4 flex-shrink-0" />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
          {segment === "tag" && tags.length > 0 && (
            <select value={tagId} onChange={e => setTagId(e.target.value)}
              className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="">— choisir une étiquette —</option>
              {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
          )}

          {/* Preview count */}
          <div className={`mt-2 text-xs font-medium px-3 py-2 rounded-lg inline-flex items-center gap-1.5 ${previewCount === 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"}`}>
            {previewLoading
              ? <span className="text-gray-400">…</span>
              : previewCount === null ? null
              : previewCount === 0
                ? <><span>⚠</span> {t.campaigns_no_contacts}</>
                : <><span className="font-bold text-primary-700">{previewCount}</span> {t.campaigns_preview_count}</>
            }
          </div>
        </div>

        {/* Objet */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{t.campaigns_subject_label}</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder={t.campaigns_subject_ph}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{t.campaigns_body_label}</label>
          <p className="text-xs text-gray-400 mb-1.5">💡 Utilisez <code className="bg-gray-100 px-1 rounded">{"{prenom}"}</code> pour personnaliser avec le prénom du client.</p>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            rows={7}
            placeholder={t.campaigns_body_ph}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-y" />
        </div>

        {/* Messages retour */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        {/* Bouton envoi */}
        <button
          onClick={handleSend}
          disabled={sending || !name.trim() || !subject.trim() || !body.trim() || !previewCount}
          className="w-full rounded-xl bg-primary-600 text-white py-3 font-semibold text-sm hover:bg-primary-700 disabled:opacity-40 transition-all active:scale-[0.99] shadow-sm">
          {sending ? t.campaigns_sending : t.campaigns_send}
        </button>
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t.campaigns_history}</h2>
        {historyLoading
          ? <div className="text-center py-8 text-gray-400">…</div>
          : campaigns.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">{t.campaigns_empty}</p>
            : (
              <div className="space-y-2">
                {campaigns.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.subject}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-block text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                        {t.campaigns_sent_badge}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{c.sent_count} {t.campaigns_recipients}</p>
                      <p className="text-xs text-gray-400">{formatDate(c.sent_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
        }
      </div>

    </div>
  );
}
