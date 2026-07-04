"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "../../../../lib/api";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useSubscription } from "../../../../contexts/SubscriptionContext";

const SendReminderModal = dynamic(() => import("../../../../components/SendReminderModal"), { ssr: false });

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



function TagPill({ tag, onRemove }: { tag: any; onRemove?: () => void }) {
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

const LEAD_STATUS_CLS: Record<string, string> = {
  new: "badge-status badge-new",
  contacted: "badge-status badge-contacted",
  qualified: "badge-status badge-qualified",
  scheduled: "badge-status badge-scheduled",
  converted: "badge-status badge-confirmed",
  lost: "badge-status badge-lost",
};

export default function ContactDetailPage() {
  const { t } = useLanguage();

  const APPT_STATUS: Record<string, { label: string; cls: string }> = {
    confirmed: { label: t.apt_status_confirmed, cls: "badge-status badge-confirmed" },
    pending:   { label: t.apt_status_pending,   cls: "badge-status badge-new" },
    cancelled: { label: t.apt_status_cancelled, cls: "badge-status badge-lost" },
    refused:   { label: t.apt_status_refused,   cls: "badge-status badge-lost" },
  };

  const LEAD_STATUS: Record<string, string> = {
    new:       t.lead_status_new,
    contacted: t.lead_status_contacted,
    qualified: t.lead_status_qualified,
    scheduled: t.lead_status_scheduled,
    converted: t.lead_status_converted,
    lost:      t.lead_status_lost,
  };

  const INV_STATUS: Record<string, { label: string; bg: string; text: string }> = {
    draft:     { label: t.inv_status_draft,      bg: "#F9FAFB", text: "#6B7280" },
    sent:      { label: t.inv_status_sent,        bg: "#EFF6FF", text: "#2563EB" },
    paid:      { label: t.inv_status_paid,        bg: "#F0FDF4", text: "#16A34A" },
    overdue:   { label: t.inv_status_overdue,     bg: "#FEF2F2", text: "#DC2626" },
    cancelled: { label: t.inv_status_cancelled,   bg: "#F9FAFB", text: "#9CA3AF" },
  };
  const { hasFeature, features } = useSubscription();
  const { id } = useParams() as { id: string };

  const [contact, setContact] = useState<any>(null);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Timeline
  const [activities, setActivities] = useState<any[]>([]);
  const [activityType, setActivityType] = useState("note");
  const [activityContent, setActivityContent] = useState("");
  const [addingActivity, setAddingActivity] = useState(false);

  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [reminderType, setReminderType] = useState("custom");
  const [reminderAutoSend, setReminderAutoSend] = useState(false);
  const [addingReminder, setAddingReminder] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [modalReminderId, setModalReminderId] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);

  const [invoices, setInvoices] = useState<any[]>([]);

  // Pièces jointes
  const [attachments, setAttachments]     = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Lien Telegram
  const [botUsername, setBotUsername]     = useState("");
  const [generatingTg, setGeneratingTg]   = useState(false);
  const [tgLinkModal, setTgLinkModal]     = useState<{ link: string } | null>(null);
  const [tgCopied, setTgCopied]           = useState(false);

  // Édition infos contact
  const [editingInfo, setEditingInfo]     = useState(false);
  const [editFirst, setEditFirst]         = useState("");
  const [editLast, setEditLast]           = useState("");
  const [editEmail, setEditEmail]         = useState("");
  const [editPhone, setEditPhone]         = useState("");
  const [savingInfo, setSavingInfo]       = useState(false);

  const fetchContact = () =>
    api.getContact(id)
      .then(c => { setContact(c); setNotes(c.notes ?? ""); })
      .finally(() => setLoading(false));

  const fetchActivities = () =>
    api.getActivities(id).then(setActivities).catch(() => {});

  const fetchAttachments = () =>
    api.listAttachments(id).then(setAttachments).catch(() => {});

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingFile(true);
    try {
      await api.uploadAttachment(id, file);
      fetchAttachments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingFile(false); }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm(t.attachments_delete + " ?")) return;
    await api.deleteAttachment(id, attachmentId);
    fetchAttachments();
  };

  useEffect(() => {
    fetchContact();
    fetchActivities();
    fetchAttachments();
    api.getInvoices({ contact_id: id, limit: 50 })
      .then((r: any) => setInvoices(Array.isArray(r) ? r : (r.invoices ?? [])))
      .catch(() => {});
    api.getTags().then(setAllTags).catch(() => {});
    if (hasFeature("agent_support")) {
      api.getTelegramBotInfo().then(info => setBotUsername(info.username)).catch(() => {});
    }
  }, [id]);

  const addActivity = async () => {
    if (!activityContent.trim()) return;
    setAddingActivity(true);
    try {
      await api.createActivity(id, { type: activityType, content: activityContent.trim() });
      setActivityContent("");
      fetchActivities();
    } finally { setAddingActivity(false); }
  };

  const deleteActivity = async (activityId: string) => {
    await api.deleteActivity(id, activityId);
    fetchActivities();
  };

  const generateTelegramLink = async () => {
    setGeneratingTg(true);
    try {
      const agentLink = await api.createAgentLink({ contact_id: id, channel: "telegram" });
      const link = `https://t.me/${botUsername}?start=${agentLink.token}`;
      setTgLinkModal({ link });
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setGeneratingTg(false); }
  };

  const copyTgLink = async () => {
    if (!tgLinkModal) return;
    await navigator.clipboard.writeText(tgLinkModal.link);
    setTgCopied(true);
    setTimeout(() => setTgCopied(false), 2000);
  };

  const openEditInfo = () => {
    setEditFirst(contact?.first_name ?? "");
    setEditLast(contact?.last_name ?? "");
    setEditEmail(contact?.email ?? "");
    setEditPhone(contact?.phone ?? "");
    setEditingInfo(true);
  };

  const saveContactInfo = async () => {
    setSavingInfo(true);
    try {
      await api.updateContact(id, {
        first_name: editFirst || undefined,
        last_name:  editLast  || undefined,
        email:      editEmail || undefined,
        phone:      editPhone || undefined,
      });
      setEditingInfo(false);
      fetchContact();
    } finally { setSavingInfo(false); }
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      await api.updateContact(id, { notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally { setNotesSaving(false); }
  };

  const addTag = async (tagId: string) => {
    await api.addTagToContact(id, tagId);
    setShowTagPicker(false);
    fetchContact();
  };

  const removeTag = async (tagId: string) => {
    await api.removeTagFromContact(id, tagId);
    fetchContact();
  };

  const addReminder = async () => {
    if (!reminderDate) return;
    setAddingReminder(true);
    try {
      await api.createReminder({
        contact_id: id,
        due_date: reminderDate,
        note: reminderNote || undefined,
        reminder_type: reminderType,
        auto_send: reminderAutoSend,
      });
      setReminderDate(""); setReminderNote(""); setReminderType("custom"); setReminderAutoSend(false);
      setShowReminderForm(false);
      fetchContact();
    } finally { setAddingReminder(false); }
  };

  const handleSendReminderNow = (rid: string) => {
    setModalReminderId(rid);
  };

  const handleModalSent = (rid: string, sentAt: string) => {
    setSentIds(prev => new Set(prev).add(rid));
    fetchContact();
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingReminders = (contact?.reminders ?? []).filter(
    (r: any) => !r.done && r.due_date >= todayStr
  );
  const pastReminders = (contact?.reminders ?? []).filter(
    (r: any) => r.done || r.due_date < todayStr
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">{t.dash_loading}</div>
  );
  if (!contact) return (
    <div className="flex items-center justify-center py-24 text-red-500">Contact introuvable</div>
  );

  const assignedTagIds = new Set((contact.tags ?? []).map((tag: any) => tag.id));
  const availableTags = allTags.filter(tag => !assignedTagIds.has(tag.id));

  return (
    <>
    <div className="max-w-4xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Back */}
      <Link href="/dashboard/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        {t.crm_back}
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-5">
          {/* Avatar */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary-100 text-primary-700 font-bold text-lg sm:text-2xl flex items-center justify-center flex-shrink-0">
            {(contact.first_name?.[0] ?? contact.last_name?.[0] ?? "?").toUpperCase()}
          </div>

          {/* Name + contact info + KPIs */}
          <div className="flex-1 min-w-0">
            {!editingInfo ? (
              <>
                {/* Name row + KPIs — stack on mobile, side by side on sm+ */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                        {contact.first_name} {contact.last_name}
                      </h1>
                      {contact.is_inactive && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {t.crm_inactive_badge}
                        </span>
                      )}
                      <button onClick={openEditInfo}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        <span className="hidden sm:inline">{t.contact_edit_btn}</span>
                      </button>
                    </div>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`}
                          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors min-w-0">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                          </svg>
                          <span className="truncate">{contact.email}</span>
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`}
                          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors flex-shrink-0">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                          </svg>
                          {contact.phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    {contact.client_value > 0 && (
                      <div className="text-center bg-amber-50 border border-amber-200 rounded-xl px-3 sm:px-5 py-2 sm:py-3">
                        <p className="text-base sm:text-lg font-bold text-amber-600">
                          {contact.client_value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{t.crm_value_label}</p>
                      </div>
                    )}
                    <div className="text-center bg-primary-50 border border-primary-200 rounded-xl px-3 sm:px-5 py-2 sm:py-3">
                      <p className="text-base sm:text-lg font-bold text-primary-700">{contact.appointments_count ?? 0}</p>
                      <p className="text-xs text-gray-400 mt-0.5">RDV</p>
                    </div>
                    {(() => {
                      const totalF = invoices
                        .filter(i => i.status !== "cancelled")
                        .reduce((s: number, i: any) => s + (i.total ?? 0), 0);
                      if (totalF === 0) return null;
                      return (
                        <div className="text-center bg-violet-50 border border-violet-200 rounded-xl px-3 sm:px-5 py-2 sm:py-3">
                          <p className="text-base sm:text-lg font-bold text-violet-600">
                            {totalF.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">Facturé</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 w-full">
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{t.contact_edit_explain}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t.contact_firstname}</label>
                    <input value={editFirst} onChange={e => setEditFirst(e.target.value)}
                      className="w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t.contact_lastname}</label>
                    <input value={editLast} onChange={e => setEditLast(e.target.value)}
                      className="w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t.contact_email_label}</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                    className="w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t.contact_phone_label}</label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    className="w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveContactInfo} disabled={savingInfo}
                    className="flex-1 bg-primary-600 text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-primary-700 disabled:opacity-50 transition-colors">
                    {savingInfo ? "…" : t.contact_edit_save}
                  </button>
                  <button onClick={() => setEditingInfo(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-4">
                    {t.contact_edit_cancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bouton lien Telegram */}
        {botUsername && (
          <div className="pt-3 border-t border-gray-100 mt-4">
            <button
              onClick={generateTelegramLink}
              disabled={generatingTg}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors active:scale-95"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.46l-2.945-.92c-.64-.203-.654-.64.136-.954l11.498-4.43c.534-.194 1.001.13.835.965z"/>
              </svg>
              {generatingTg ? t.tg_link_generating : t.tg_link_btn}
            </button>
          </div>
        )}
      </div>

      {/* Grid 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 sm:gap-5">

        {/* Colonne gauche — timeline */}
        <div className="space-y-5">

          {/* RDV */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.crm_appts_section}</h3>
              {(contact.appointments ?? []).length > 0 && (
                <span className="text-xs text-gray-400">{(contact.appointments ?? []).length} total</span>
              )}
            </div>
            {(contact.appointments ?? []).length === 0
              ? <p className="text-sm text-gray-400">Aucun rendez-vous</p>
              : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {(contact.appointments ?? []).map((a: any) => {
                    const s = APPT_STATUS[a.status] ?? { label: a.status, cls: "badge-status" };
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg flex-wrap">
                        <span className={s.cls}>{s.label}</span>
                        <span className="text-sm text-gray-700 font-medium flex-1">
                          {a.service_offer?.name ?? t.apt_default_label}
                          {a.service_offer?.price_eur ? ` — ${a.service_offer.price_eur} €` : ""}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(a.scheduled_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          {/* Factures */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.inv_title}</h3>
              <div className="flex items-center gap-3">
                {invoices.length > 0 && (
                  <span className="text-xs text-gray-400">{invoices.length} total</span>
                )}
                <Link href="/dashboard/invoices"
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Nouvelle
                </Link>
              </div>
            </div>
            {invoices.length === 0
              ? <p className="text-sm text-gray-400">{t.inv_empty}</p>
              : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {invoices.map((inv: any) => {
                    const s = INV_STATUS[inv.status] ?? { label: inv.status, bg: "#F9FAFB", text: "#6B7280" };
                    return (
                      <div key={inv.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: s.bg, color: s.text }}>
                          {s.label}
                        </span>
                        <span className="text-xs font-mono text-gray-700 flex-1 min-w-0 truncate">{inv.number}</span>
                        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {(inv.total ?? 0).toLocaleString("fr-FR", { style: "currency", currency: inv.currency ?? "EUR" })}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(inv.issue_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          {/* Leads */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.crm_leads_section}</h3>
              {(contact.leads ?? []).length > 0 && (
                <span className="text-xs text-gray-400">{(contact.leads ?? []).length} total</span>
              )}
            </div>
            {(contact.leads ?? []).length === 0
              ? <p className="text-sm text-gray-400">Aucune demande</p>
              : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {(contact.leads ?? []).map((l: any) => (
                    <div key={l.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg flex-wrap">
                      <span className={LEAD_STATUS_CLS[l.status] ?? "badge-status"}>
                        {LEAD_STATUS[l.status] ?? l.status}
                      </span>
                      <span className="text-xs text-gray-400">{l.source}</span>
                      {l.notes && (
                        <span className="text-xs text-gray-500 flex-1 truncate">{l.notes}</span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(l.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>

        </div>

        {/* Colonne droite — sidebar */}
        <div className="space-y-4">

          {/* Timeline / Historique des échanges */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t.activity_title}</h3>

            {/* Formulaire ajout */}
            <div className="space-y-2 mb-4">
              <div className="flex gap-2">
                {(["note","call","email","meeting"] as const).map(type => {
                  const icons: Record<string, string> = {
                    note: "📝", call: "📞", email: "✉️", meeting: "🤝"
                  };
                  const labels: Record<string, string> = {
                    note: t.activity_note, call: t.activity_call,
                    email: t.activity_email_type, meeting: t.activity_meeting
                  };
                  return (
                    <button key={type} onClick={() => setActivityType(type)}
                      title={labels[type]}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${activityType === type
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-primary-300"}`}>
                      <span className="hidden sm:inline">{icons[type]} {labels[type]}</span>
                      <span className="sm:hidden text-base">{icons[type]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={activityContent}
                  onChange={e => setActivityContent(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addActivity(); }}
                  rows={2}
                  placeholder={t.activity_add_ph}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base sm:text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                />
                <button onClick={addActivity} disabled={addingActivity || !activityContent.trim()}
                  className="rounded-lg bg-primary-600 text-white px-3 py-2 text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 transition-colors active:scale-95 self-end">
                  {addingActivity ? "…" : t.activity_add_btn}
                </button>
              </div>
            </div>

            {/* Feed */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {activities.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">{t.activity_empty}</p>
                : activities.map((a: any) => {
                  const icons: Record<string, string> = { note: "📝", call: "📞", email: "✉️", meeting: "🤝" };
                  const d = new Date(a.created_at);
                  const dateStr = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
                  const timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={a.id} className="group flex gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span className="text-base mt-0.5 flex-shrink-0">{icons[a.type] ?? "📝"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{a.content}</p>
                        <p className="text-xs text-gray-400 mt-1">{dateStr} · {timeStr}</p>
                      </div>
                      <button onClick={() => deleteActivity(a.id)}
                        title={t.activity_delete}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-lg leading-none flex-shrink-0">
                        ×
                      </button>
                    </div>
                  );
                })
              }
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t.crm_tags_label}</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(contact.tags ?? []).length === 0
                ? <span className="text-sm text-gray-400">Aucun tag</span>
                : (contact.tags ?? []).map((tag: any) => (
                  <TagPill key={tag.id} tag={tag} onRemove={() => removeTag(tag.id)} />
                ))}
            </div>
            {availableTags.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTagPicker(v => !v)}
                  className="w-full text-left border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                  + {t.crm_tag_new}
                </button>
                {showTagPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => addTag(tag.id)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center">
                        <TagPill tag={tag} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pièces jointes */}
          {(() => {
            const maxFiles: number = (features as any).attachments_max ?? 0;
            const atLimit = attachments.length >= maxFiles && maxFiles > 0;
            const formatSize = (b: number) => b < 1048576 ? `${(b/1024).toFixed(0)} Ko` : `${(b/1048576).toFixed(1)} Mo`;
            return (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.attachments_title}</h3>
                  {maxFiles > 0 && (
                    <span className="text-xs text-gray-400">{attachments.length}/{maxFiles}</span>
                  )}
                </div>

                {maxFiles === 0 ? (
                  /* Plan insuffisant */
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
                    <p className="text-xs font-semibold text-amber-700 mb-1">📎 {t.attachments_plan_req}</p>
                    <a href="/dashboard/settings?section=abonnement"
                      className="text-xs text-primary-600 underline hover:text-primary-800">{t.attachments_upgrade}</a>
                  </div>
                ) : (
                  <>
                    {/* Liste des fichiers */}
                    {attachments.length === 0
                      ? <p className="text-sm text-gray-400 mb-3">{t.attachments_empty}</p>
                      : (
                        <div className="space-y-1.5 mb-3 max-h-52 overflow-y-auto pr-1">
                          {attachments.map((a: any) => (
                            <div key={a.id} className="group flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                              <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{a.file_name}</p>
                                <p className="text-xs text-gray-400">{formatSize(a.file_size)}</p>
                              </div>
                              {a.signed_url && (
                                <a href={a.signed_url} target="_blank" rel="noopener noreferrer" download={a.file_name}
                                  className="opacity-0 group-hover:opacity-100 text-primary-500 hover:text-primary-700 transition-all flex-shrink-0" title="Télécharger">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                  </svg>
                                </a>
                              )}
                              <button onClick={() => handleDeleteAttachment(a.id)}
                                title={t.attachments_delete}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-lg leading-none flex-shrink-0">×</button>
                            </div>
                          ))}
                        </div>
                      )
                    }

                    {/* Upload ou upsell */}
                    {atLimit ? (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-700">{t.attachments_limit_title}</p>
                        <p className="text-xs text-amber-600">{t.attachments_limit_desc}</p>
                        <div className="flex flex-col gap-1.5 pt-1">
                          <a href="/dashboard/settings?section=abonnement"
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-primary-400 hover:bg-primary-50 transition-colors group">
                            <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700">{t.attachments_pack_15}</span>
                            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                            </svg>
                          </a>
                          <a href="/dashboard/settings?section=abonnement"
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-primary-400 hover:bg-primary-50 transition-colors group">
                            <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700">{t.attachments_pack_25}</span>
                            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                            </svg>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <label className={`flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors cursor-pointer ${uploadingFile ? "opacity-60 pointer-events-none" : ""}`}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        {uploadingFile ? t.attachments_uploading : t.attachments_add}
                        <span className="ml-auto text-xs text-gray-400">{t.attachments_max_size}</span>
                        <input type="file" className="hidden" onChange={uploadFile} disabled={uploadingFile} />
                      </label>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* Relances */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t.crm_reminder_title}</h3>

            {/* Section À venir */}
            {upcomingReminders.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-primary-600 mb-1.5">{t.crm_reminder_upcoming_section}</p>
                <div className="space-y-1.5">
                  {upcomingReminders.map((r: any) => {
                    const alreadySent = r.sent_at || sentIds.has(r.id);
                    const hasEmail = !!contact.email;
                    return (
                      <div key={r.id} className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => api.updateReminder(r.id, { done: true }).then(fetchContact)}
                            className="accent-primary-600 cursor-pointer flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold text-amber-700">
                                {new Date(r.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                              </p>
                              {r.reminder_type && r.reminder_type !== "custom" && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                                  {(t as any)[`reminder_type_${r.reminder_type}`] ?? r.reminder_type}
                                </span>
                              )}
                              {r.auto_send && !alreadySent && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 font-medium">Auto</span>
                              )}
                              {alreadySent && (
                                <span className="text-xs text-green-600 font-semibold">{t.reminder_sent_ok}</span>
                              )}
                            </div>
                            {r.note && <p className="text-xs text-gray-500 mt-0.5">{r.note}</p>}
                          </div>
                          <button onClick={() => api.deleteReminder(r.id).then(fetchContact)}
                            className="text-gray-300 hover:text-red-400 transition-colors leading-none flex-shrink-0">×</button>
                        </div>
                        {/* Bouton envoyer */}
                        {!alreadySent && (
                          <button
                            onClick={() => handleSendReminderNow(r.id)}
                            disabled={!hasEmail}
                            title={!hasEmail ? t.reminder_no_email : undefined}
                            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg border border-primary-300 text-primary-700 bg-white hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                            {t.reminder_send_now}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section Passées / Faites */}
            {pastReminders.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 mb-1.5">{t.crm_reminder_past_section}</p>
                <div className="space-y-1.5">
                  {pastReminders.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100 opacity-60">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-gray-400">
                            {new Date(r.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                          {r.sent_at && (
                            <span className="text-xs text-green-600 font-medium">{t.reminder_sent_ok}</span>
                          )}
                        </div>
                        {r.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.note}</p>}
                      </div>
                      <button onClick={() => api.deleteReminder(r.id).then(fetchContact)}
                        className="text-gray-300 hover:text-red-400 transition-colors leading-none flex-shrink-0">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcomingReminders.length === 0 && pastReminders.length === 0 && !showReminderForm && (
              <p className="text-sm text-gray-400 mb-3">Aucune relance planifiée</p>
            )}


            {showReminderForm ? (
              <div className="space-y-2">
                {/* Type */}
                <select
                  value={reminderType}
                  onChange={e => setReminderType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                  {(["post_service","reactivation","quote_followup","payment","health_reminder","promo","custom"] as const).map(type => (
                    <option key={type} value={type}>
                      {(t as any)[`reminder_type_${type}`] ?? type}
                    </option>
                  ))}
                </select>
                {/* Date */}
                <input
                  type="date"
                  value={reminderDate}
                  onChange={e => setReminderDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                {/* Message */}
                <textarea
                  value={reminderNote}
                  onChange={e => setReminderNote(e.target.value)}
                  placeholder="Message à envoyer au client… (optionnel)"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                />
                {/* Hint factures impayées pour relance de paiement */}
                {reminderType === "payment" && (() => {
                  const unpaid = invoices.filter(i => i.status === "sent" || i.status === "overdue");
                  if (unpaid.length === 0) return null;
                  return (
                    <div className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2.5 space-y-2">
                      <p className="text-xs font-semibold text-violet-700">
                        🧾 {unpaid.length} facture{unpaid.length > 1 ? "s" : ""} en attente de paiement — cliquez pour pré-remplir la note
                      </p>
                      <div className="space-y-1">
                        {unpaid.map((inv: any) => (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => setReminderNote(
                              `Relance de paiement — Facture ${inv.number} du ${new Date(inv.issue_date).toLocaleDateString("fr-FR")} — ${(inv.total ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`
                            )}
                            className="w-full text-left flex items-center gap-2 p-2 rounded-lg bg-white border border-violet-200 hover:border-violet-500 hover:bg-violet-50 transition-colors">
                            <span className="text-xs font-mono text-gray-700 flex-1">{inv.number}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${inv.status === "overdue" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                              {inv.status === "overdue" ? "En retard" : "Envoyée"}
                            </span>
                            <span className="text-xs font-semibold text-violet-700">
                              {(inv.total ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* Toggle auto-send */}
                <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={reminderAutoSend}
                    onChange={e => setReminderAutoSend(e.target.checked)}
                    className="mt-0.5 accent-primary-600"
                  />
                  <span>{t.reminder_auto_send_label}
                    {!contact.email && (
                      <span className="ml-1 text-xs text-red-400">({t.reminder_no_email})</span>
                    )}
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={addReminder}
                    disabled={addingReminder || !reminderDate}
                    className="flex-1 bg-primary-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                    {addingReminder ? "…" : t.sett_save}
                  </button>
                  <button
                    onClick={() => setShowReminderForm(false)}
                    className="border border-gray-200 text-gray-500 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowReminderForm(true)}
                className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                + {t.crm_reminder_add}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>

    {/* Modal lien Telegram */}
    {tgLinkModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-lg">{t.tg_link_title}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.tg_link_explain}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="flex-1 text-xs font-mono text-gray-700 break-all select-all">{tgLinkModal.link}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyTgLink}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-primary-600 text-white rounded-xl px-4 py-2.5 hover:bg-primary-700 transition-colors"
              >
                {tgCopied ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>{t.tg_link_copied}</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{t.tg_link_copy}</>
                )}
              </button>
              <a href={tgLinkModal.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-xl px-4 py-2.5 hover:bg-blue-100 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.46l-2.945-.92c-.64-.203-.654-.64.136-.954l11.498-4.43c.534-.194 1.001.13.835.965z"/>
                </svg>
                {t.tg_link_open}
              </a>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="text-xs text-amber-700">{t.tg_link_note}</p>
          </div>

          <button onClick={() => { setTgLinkModal(null); setTgCopied(false); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1">
            {t.tg_link_close}
          </button>
        </div>
      </div>
    )}

    {modalReminderId && (
      <SendReminderModal
        reminderId={modalReminderId}
        onClose={() => setModalReminderId(null)}
        onSent={handleModalSent}
      />
    )}
    </>
  );
}
