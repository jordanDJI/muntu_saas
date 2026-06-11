"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useSubscription } from "../../../contexts/SubscriptionContext";

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  blue:   { bg: "#EFF6FF", text: "#2563EB" },
  green:  { bg: "#F0FDF4", text: "#16A34A" },
  red:    { bg: "#FEF2F2", text: "#DC2626" },
  orange: { bg: "#FFF7ED", text: "#EA580C" },
  purple: { bg: "#F5F3FF", text: "#7C3AED" },
  pink:   { bg: "#FDF2F8", text: "#DB2777" },
  teal:   { bg: "#F0FDFA", text: "#0D9488" },
  amber:  { bg: "#FFFBEB", text: "#D97706" },
  gray:   { bg: "#F9FAFB", text: "#6B7280" },
  indigo: { bg: "#EEF2FF", text: "#4338CA" },
};
const COLOR_OPTIONS = Object.keys(TAG_COLORS);

function TagPill({ tag, onRemove }: { tag: { name: string; color: string }; onRemove?: () => void }) {
  const c = TAG_COLORS[tag.color] ?? TAG_COLORS.blue;
  return (
    <span style={{ background: c.bg, color: c.text }}
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 leading-none ml-0.5">×</button>
      )}
    </span>
  );
}

function ManageTagsModal({ tags, onClose, onRefresh }: { tags: any[]; onClose: () => void; onRefresh: () => void }) {
  const { t } = useLanguage();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true); setError("");
    try {
      await api.createTag({ name: newName.trim(), color: newColor });
      setNewName(""); onRefresh();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{t.crm_manage_tags}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        {/* Explication */}
        <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-xs text-blue-700 leading-relaxed">{t.tag_modal_explain}</p>
        </div>
        <div className="flex gap-2">
          <input
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Nom du tag…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select value={newColor} onChange={e => setNewColor(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none">
            {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={handleCreate} disabled={creating || !newName.trim()}
            className="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
            +
          </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {tags.length === 0
            ? <p className="text-gray-400 text-sm">Aucun tag créé</p>
            : tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <TagPill tag={tag} />
                <button onClick={() => api.deleteTag(tag.id).then(onRefresh)}
                  className="text-red-400 hover:text-red-600 text-xs font-medium">
                  Supprimer
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function ImportGuideModal({ onClose, onConfirm, onDownload }: {
  onClose: () => void;
  onConfirm: () => void;
  onDownload: () => void;
}) {
  const { t } = useLanguage();
  const cols = [
    { key: "first_name",  label: t.csv_guide_col_fn,    example: "Marie" },
    { key: "last_name",   label: t.csv_guide_col_ln,    example: "Dupont" },
    { key: "email",       label: t.csv_guide_col_email, example: "marie@exemple.com" },
    { key: "phone",       label: t.csv_guide_col_phone, example: "+33 6 12 34 56 78" },
    { key: "notes",       label: t.csv_guide_col_notes, example: "Cliente fidèle" },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl max-w-lg max-h-[90dvh] flex flex-col rounded-t-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">{t.csv_guide_title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Explication */}
          <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-xs text-blue-700 leading-relaxed">{t.csv_guide_explain}</p>
          </div>

          {/* Colonnes */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">CSV</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cols.map(col => (
                  <tr key={col.key} className={col.key === "email" || col.key === "first_name" ? "bg-amber-50" : ""}>
                    <td className="px-3 py-2.5">
                      <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{col.key}</code>
                      {(col.key === "email" || col.key === "first_name") && (
                        <span className="ml-1 text-xs text-amber-600 font-semibold">*</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{col.label} <span className="text-gray-400 italic">({col.example})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-amber-700 font-medium">* {t.csv_guide_tip}</p>

          {/* Exemple visuel */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t.csv_guide_example}</p>
            <div className="bg-gray-900 rounded-xl p-3 overflow-x-auto">
              <code className="text-xs text-green-400 whitespace-pre font-mono">{
`first_name,last_name,email,phone,notes
Marie,Dupont,marie@exemple.com,+33612345678,Bonne cliente
Paul,Martin,paul.m@mail.com,,`
              }</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 flex-shrink-0 border-t border-gray-100">
          <button onClick={onDownload}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            {t.csv_guide_download}
          </button>
          <button onClick={onConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            {t.csv_guide_choose}
          </button>
          <button onClick={onClose}
            className="sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 active:scale-95 transition-all">
            {t.csv_guide_cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const { t } = useLanguage();
  const { hasFeature } = useSubscription();
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const LIMIT = 30;

  const fetchContacts = async (reset = false, currentOffset = 0) => {
    setLoading(true);
    try {
      const res = await api.getContacts({
        q: q || undefined,
        tag_id: tagFilter || undefined,
        inactive_only: inactiveOnly || undefined,
        limit: LIMIT,
        offset: currentOffset,
      });
      setContacts(reset ? res.contacts : prev => [...prev, ...res.contacts]);
      setTotal(res.total);
    } finally { setLoading(false); }
  };

  const fetchTags = () => api.getTags().then(setTags).catch(() => {});

  useEffect(() => { setOffset(0); fetchContacts(true, 0); }, [q, tagFilter, inactiveOnly]);
  useEffect(() => { fetchTags(); }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("");
    try {
      const res = await api.importContactsCsv(file);
      const msg = res.created > 0
        ? `✓ ${res.created} contact${res.created > 1 ? "s" : ""} importé${res.created > 1 ? "s" : ""}${res.skipped > 0 ? ` · ${res.skipped} ignoré${res.skipped > 1 ? "s" : ""} (déjà présents)` : ""}`
        : res.skipped > 0
          ? `⚠ Aucun contact importé — ${res.skipped} ligne${res.skipped > 1 ? "s" : ""} ignorée${res.skipped > 1 ? "s" : ""} (emails déjà présents ou colonnes non reconnues)`
          : "⚠ Aucun contact trouvé dans ce fichier. Vérifiez que la première ligne contient les en-têtes (first_name, last_name, email…).";
      setImportMsg(msg);
      fetchContacts(true, 0);
    } catch (err: any) {
      setImportMsg(`Erreur : ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const csv = "first_name,last_name,email,phone,notes\nMarie,Dupont,marie.dupont@exemple.com,+33 6 12 34 56 78,Cliente fidèle\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modele_contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const openFilePicker = () => {
    setShowImportGuide(false);
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const loadMore = async () => {
    const next = offset + LIMIT;
    setOffset(next);
    await fetchContacts(false, next);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t.crm_title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} contact{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/reminders"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors active:scale-95">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <span className="hidden sm:inline">{t.nav_reminders}</span>
          </Link>
          {hasFeature("campaigns") && (
            <Link href="/dashboard/campaigns"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors active:scale-95">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span className="hidden sm:inline">{t.campaigns_nav}</span>
            </Link>
          )}
          <button onClick={async () => { setExporting(true); try { await api.exportContactsCsv(); } finally { setExporting(false); } }}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors active:scale-95">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span className="hidden sm:inline">{exporting ? "…" : t.crm_export_csv}</span>
          </button>
          <button onClick={() => setShowTagsModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors active:scale-95">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z"/>
            </svg>
            <span className="hidden sm:inline">{t.crm_manage_tags}</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button onClick={() => setShowImportGuide(true)} disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-100 disabled:opacity-50 transition-colors active:scale-95">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            <span className="hidden sm:inline">{importing ? "…" : t.crm_import_csv}</span>
            {importing && <span className="sm:hidden">…</span>}
          </button>
        </div>
      </div>

      {/* Message import */}
      {importMsg && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${importMsg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {importMsg}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 sm:gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.crm_search_ph}
            className="w-full pl-9 pr-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
        </div>
        {tags.length > 0 && (
          <select value={tagFilter ?? ""} onChange={e => setTagFilter(e.target.value || null)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
            <option value="">{t.crm_filter_all}</option>
            {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        )}
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={inactiveOnly} onChange={e => setInactiveOnly(e.target.checked)}
            className="rounded accent-primary-600 w-4 h-4" />
          {t.crm_filter_inactive}
        </label>
      </div>

      {/* Liste */}
      {loading && contacts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
          {t.crm_empty}
        </div>
      ) : (
        <div className="space-y-2" id="contacts-list">
          {contacts.map(c => (
            <Link key={c.id} href={`/dashboard/contacts/${c.id}`}
              className="group flex items-center gap-3 sm:gap-4 p-4 sm:p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all active:scale-[0.99]">

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold text-base flex items-center justify-center flex-shrink-0 group-hover:bg-primary-200 transition-colors">
                {(c.first_name?.[0] ?? c.last_name?.[0] ?? "?").toUpperCase()}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">
                    {c.first_name} {c.last_name}
                  </span>
                  {c.is_inactive && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {t.crm_inactive_badge}
                    </span>
                  )}
                  {(c.tags ?? []).map((tag: any) => <TagPill key={tag.id} tag={tag} />)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              </div>

              {/* Valeur + dernier RDV */}
              <div className="text-right flex-shrink-0 hidden sm:block">
                {c.client_value > 0 && (
                  <p className="text-sm font-bold text-accent-600">
                    {c.client_value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
                )}
                {c.last_appointment_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(c.last_appointment_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </p>
                )}
              </div>

              <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* Charger plus */}
      {contacts.length < total && (
        <div className="text-center">
          <button onClick={loadMore} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {loading ? "…" : `Charger plus (${total - contacts.length} restants)`}
          </button>
        </div>
      )}

      {showTagsModal && (
        <ManageTagsModal
          tags={tags}
          onClose={() => setShowTagsModal(false)}
          onRefresh={() => { fetchTags(); fetchContacts(true, 0); }}
        />
      )}

      {showImportGuide && (
        <ImportGuideModal
          onClose={() => setShowImportGuide(false)}
          onConfirm={openFilePicker}
          onDownload={downloadTemplate}
        />
      )}
    </div>
  );
}
