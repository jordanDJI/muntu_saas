"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useSectorVocab } from "../../../lib/useSectorVocab";

const SendReminderModal = dynamic(() => import("../../../components/SendReminderModal"), { ssr: false });

type Filter = "all" | "todo" | "done" | "payment";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

const today = () => new Date().toISOString().split("T")[0];

export default function RemindersPage() {
  const { t } = useLanguage();
  const { vocab } = useSectorVocab();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todo");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [modalReminderId, setModalReminderId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filter === "todo") params.done = false;
      else if (filter === "done") params.done = true;
      // "payment" et "all" : pas de filtre done → retourne tout
      const data = await api.getReminders(params);
      setReminders(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const markDone = async (id: string) => {
    await api.updateReminder(id, { done: true });
    load();
  };

  const remove = async (id: string) => {
    await api.deleteReminder(id);
    load();
  };

  const openSendModal = (id: string) => setModalReminderId(id);

  const handleModalSent = (id: string, _sentAt: string) => {
    setSentIds(prev => new Set(prev).add(id));
    load();
  };

  // Partition en 3 sections
  const todayStr = today();
  const overdue: any[]  = [];
  const upcoming: any[] = [];
  const done: any[]     = [];

  const displayedReminders = filter === "payment"
    ? reminders.filter(r => r.reminder_type === "payment")
    : reminders;

  for (const r of displayedReminders) {
    if (r.done) { done.push(r); continue; }
    if (r.due_date < todayStr) overdue.push(r);
    else upcoming.push(r);
  }

  const paymentCount = reminders.filter(r => r.reminder_type === "payment" && !r.done).length;

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: "all",     label: t.reminders_filter_all },
    { key: "todo",    label: t.reminders_filter_todo },
    { key: "done",    label: t.reminders_filter_done },
    { key: "payment", label: t.reminders_filter_payment, count: paymentCount },
  ];

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Retour vers contacts */}
      <Link href="/dashboard/contacts"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-primary-700 hover:border-primary-200 transition-all active:scale-95 group">
        <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        {vocab.contacts}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t.reminders_title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{reminders.length} {reminders.length !== 1 ? t.reminders_count_pl : t.reminders_count}</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              filter === f.key
                ? f.key === "payment"
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-primary-600 text-white border-primary-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-primary-300 hover:text-primary-600"
            }`}>
            {f.label}
            {f.count != null && f.count > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                filter === f.key ? "bg-white/20 text-white" : "bg-red-100 text-red-600"
              }`}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">{t.dash_loading}</div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          {t.reminders_empty}
        </div>
      ) : (
        <div className="space-y-6">
          <ReminderSection
            title={t.reminders_section_overdue}
            items={overdue}
            variant="overdue"
            onDone={markDone}
            onDelete={remove}
            onSend={openSendModal}
            sentIds={sentIds}
            t={t}
          />
          <ReminderSection
            title={t.reminders_section_upcoming}
            items={upcoming}
            variant="upcoming"
            onDone={markDone}
            onDelete={remove}
            onSend={openSendModal}
            sentIds={sentIds}
            t={t}
          />
          <ReminderSection
            title={t.reminders_section_done}
            items={done}
            variant="done"
            onDone={markDone}
            onDelete={remove}
            onSend={openSendModal}
            sentIds={sentIds}
            t={t}
          />
        </div>
      )}

    {modalReminderId && (
      <SendReminderModal
        reminderId={modalReminderId}
        onClose={() => setModalReminderId(null)}
        onSent={handleModalSent}
      />
    )}
    </div>
  );
}

function ReminderSection({
  title, items, variant, onDone, onDelete, onSend, sentIds, t,
}: {
  title: string;
  items: any[];
  variant: "overdue" | "upcoming" | "done";
  onDone: (id: string) => void;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  sentIds: Set<string>;
  t: any;
}) {
  if (items.length === 0) return null;

  const headerCls = {
    overdue:  "text-red-500",
    upcoming: "text-primary-600",
    done:     "text-gray-400",
  }[variant];

  return (
    <div>
      <div className={`flex items-center gap-2 mb-2`}>
        {variant === "overdue" && (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        )}
        {variant === "upcoming" && (
          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        )}
        {variant === "done" && (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        )}
        <h2 className={`text-xs font-bold uppercase tracking-wide ${headerCls}`}>
          {title} <span className="font-normal">({items.length})</span>
        </h2>
      </div>

      <div className="space-y-2">
        {items.map(r => (
          <ReminderRow
            key={r.id}
            reminder={r}
            variant={variant}
            onDone={onDone}
            onDelete={onDelete}
            onSend={onSend}
            sentIds={sentIds}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function ReminderRow({
  reminder: r, variant, onDone, onDelete, onSend, sentIds, t,
}: {
  reminder: any;
  variant: "overdue" | "upcoming" | "done";
  onDone: (id: string) => void;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  sentIds: Set<string>;
  t: any;
}) {
  const cardCls = {
    overdue:  "bg-red-50 border-red-200",
    upcoming: "bg-white border-gray-100",
    done:     "bg-gray-50 border-gray-100 opacity-60",
  }[variant];

  const dateCls = {
    overdue:  "text-red-600 font-semibold",
    upcoming: "text-amber-600 font-semibold",
    done:     "text-gray-400",
  }[variant];

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border shadow-sm ${cardCls}`}>
      {/* Checkbox */}
      {!r.done && (
        <input
          type="checkbox"
          checked={false}
          onChange={() => onDone(r.id)}
          className="w-4 h-4 accent-primary-600 cursor-pointer flex-shrink-0"
          title="Marquer comme fait"
        />
      )}
      {r.done && (
        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      )}

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs ${dateCls}`}>{formatDate(r.due_date)}</span>
          {r.reminder_type === "payment" ? (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-violet-100 text-violet-700">
              🧾 {t[`reminder_type_payment`] ?? "Paiement"}
            </span>
          ) : r.reminder_type && r.reminder_type !== "custom" ? (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
              {t[`reminder_type_${r.reminder_type}`] ?? r.reminder_type}
            </span>
          ) : null}
          {r.contact && (
            <Link
              href={`/dashboard/contacts/${r.contact_id}`}
              className="text-sm font-semibold text-gray-800 hover:text-primary-600 transition-colors truncate">
              {r.contact.first_name} {r.contact.last_name}
            </Link>
          )}
          {(r.sent_at || sentIds.has(r.id)) && (
            <span className="text-xs text-green-600 font-semibold">{t.reminder_sent_ok}</span>
          )}
        </div>
        {r.note && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{r.note}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!r.done && !r.sent_at && !sentIds.has(r.id) && r.contact?.email && (
          <button
            onClick={() => onSend(r.id)}
            title={t.reminder_send_now}
            className="p-1.5 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </button>
        )}
        {!r.done && (
          <button
            onClick={() => onDone(r.id)}
            title="Marquer fait"
            className="text-xs font-medium text-green-600 hover:text-green-800 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap hidden sm:block">
            ✓ Fait
          </button>
        )}
        <Link
          href={`/dashboard/contacts/${r.contact_id}`}
          title="Voir la fiche"
          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </Link>
        <button
          onClick={() => onDelete(r.id)}
          title="Supprimer"
          className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
