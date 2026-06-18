"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";

type View = "day" | "week" | "month";

interface Appt {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  scheduled_at: string;
  end_at: string;
  notes: string | null;
  party_size: number;
  tenant_id: string;
  tenant_name: string;
  tenant_color: string;
  contact_name: string;
  contact: { id: string; first_name: string; last_name: string; email: string } | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: Record<string, string> }> = {
  pending:   { bg: "rgba(221,170,64,.15)", color: "#DDAA40", label: { fr: "En attente", en: "Pending",   de: "Ausstehend",  nl: "In behandeling" } },
  confirmed: { bg: "rgba(13,148,136,.15)", color: "#0D9488", label: { fr: "Confirmé",   en: "Confirmed", de: "Bestätigt",   nl: "Bevestigd"      } },
  cancelled: { bg: "rgba(220,38,38,.12)",  color: "#DC2626", label: { fr: "Annulé",     en: "Cancelled", de: "Abgesagt",    nl: "Geannuleerd"    } },
};

function locale(lang: string) {
  return lang === "fr" ? "fr-FR" : lang === "de" ? "de-DE" : lang === "nl" ? "nl-NL" : "en-GB";
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(d: Date, lang: string) {
  return d.toLocaleDateString(locale(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtShort(d: Date, lang: string) {
  return d.toLocaleDateString(locale(lang), { weekday: "short", day: "numeric", month: "short" });
}
function fmtMonth(d: Date, lang: string) {
  return d.toLocaleDateString(locale(lang), { month: "long", year: "numeric" });
}
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r;
}
function weekStart(d: Date) {
  const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r;
}
function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function groupByDay(appts: Appt[]): Record<string, Appt[]> {
  const g: Record<string, Appt[]> = {};
  for (const a of appts) {
    const k = a.scheduled_at.slice(0, 10);
    if (!g[k]) g[k] = [];
    g[k].push(a);
  }
  return g;
}

interface ModalState { appt: Appt; note: string; saving: boolean; toast: string; }

export default function SecretaryPage() {
  const { t, lang } = useLanguage();
  const [view, setView] = useState<View>("day");
  const [current, setCurrent] = useState(new Date());
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  // Anchor date sent to backend (first day of period)
  const dateStr =
    view === "week"  ? isoDate(weekStart(current)) :
    view === "month" ? isoDate(monthStart(current)) :
    isoDate(current);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAppts(await api.getSecretaryAppointments(dateStr, view)); }
    catch { setAppts([]); }
    finally { setLoading(false); }
  }, [dateStr, view]);

  useEffect(() => { load(); }, [load]);

  const navigate = (dir: -1 | 1) => {
    if (view === "month") setCurrent((c) => addMonths(c, dir));
    else if (view === "week") setCurrent((c) => addDays(c, dir * 7));
    else setCurrent((c) => addDays(c, dir));
  };

  const openModal  = (appt: Appt) => setModal({ appt, note: appt.notes ?? "", saving: false, toast: "" });
  const closeModal = () => setModal(null);

  const saveNote = async () => {
    if (!modal) return;
    setModal((m) => m ? { ...m, saving: true } : m);
    try {
      await api.updateSecretaryAppointment(modal.appt.id, { notes: modal.note });
      setAppts((prev) => prev.map((a) => a.id === modal.appt.id ? { ...a, notes: modal.note } : a));
      setModal((m) => m ? { ...m, saving: false, appt: { ...m.appt, notes: modal.note }, toast: t.sec_note_saved } : m);
      setTimeout(() => setModal((m) => m ? { ...m, toast: "" } : m), 2000);
    } catch { setModal((m) => m ? { ...m, saving: false } : m); }
  };

  const changeStatus = async (status: "confirmed" | "cancelled") => {
    if (!modal) return;
    setModal((m) => m ? { ...m, saving: true } : m);
    try {
      await api.updateSecretaryAppointment(modal.appt.id, { status });
      setAppts((prev) => prev.map((a) => a.id === modal.appt.id ? { ...a, status } : a));
      setModal((m) => m ? { ...m, saving: false, appt: { ...m.appt, status }, toast: t.sec_status_updated } : m);
      setTimeout(() => setModal((m) => m ? { ...m, toast: "" } : m), 2000);
    } catch { setModal((m) => m ? { ...m, saving: false } : m); }
  };

  // Period label in header
  const periodLabel =
    view === "month" ? fmtMonth(current, lang) :
    view === "week"  ? `${fmtShort(weekStart(current), lang)} — ${fmtShort(addDays(weekStart(current), 6), lang)}` :
    fmtDay(current, lang);

  // Days to iterate (for multi-day views)
  const days: Date[] =
    view === "month" ? (() => {
      const s = monthStart(current);
      const count = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      return Array.from({ length: count }, (_, i) => addDays(s, i));
    })() :
    view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(current), i)) :
    [current];

  const todayStr = isoDate(new Date());
  const grouped  = groupByDay(appts);
  const VIEW_LABELS: Record<View, string> = { day: t.sec_view_day, week: t.sec_view_week, month: t.sec_view_month };

  return (
    <div className="min-h-screen pb-12 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-main, #0f172a)" }}>{t.sec_title}</h1>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgba(13,75,88,.2)" }}>
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={view === v ? { background: "#0D4B58", color: "#fff" } : { background: "transparent", color: "var(--text-muted, #64748b)" }}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation date */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" style={{ color: "var(--text-muted, #64748b)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span className="flex-1 text-center text-sm font-semibold capitalize" style={{ color: "var(--text-main, #0f172a)" }}>
            {periodLabel}
          </span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" style={{ color: "var(--text-muted, #64748b)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
            style={{ borderColor: "rgba(13,75,88,.25)", color: "#0D4B58" }}
          >
            {t.sec_today}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#0D9488", borderTopColor: "transparent" }} />
          </div>
        ) : appts.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--text-muted, #94a3b8)" }}>
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <p className="text-sm">{t.sec_no_appts}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {days.map((day) => {
              const key = isoDate(day);
              const dayAppts = grouped[key];
              if (!dayAppts) return null;
              return (
                <div key={key}>
                  {/* Day header (week/month) */}
                  {view !== "day" && (
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full"
                        style={key === todayStr
                          ? { background: "#0D4B58", color: "#fff" }
                          : { color: "var(--text-muted, #64748b)" }}
                      >
                        {fmtShort(day, lang)}
                      </span>
                      <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,.07)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted, #94a3b8)" }}>
                        {dayAppts.length} RDV
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {dayAppts.map((appt) => {
                      const st = STATUS_STYLES[appt.status] ?? STATUS_STYLES.pending;
                      return (
                        <button
                          key={appt.id}
                          onClick={() => openModal(appt)}
                          className="w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-all"
                          style={{ background: "#fff", borderColor: "rgba(0,0,0,.07)" }}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: appt.tenant_color }} />
                          <span className="text-xs font-mono font-semibold w-10 shrink-0" style={{ color: "var(--text-muted, #64748b)" }}>
                            {fmtTime(appt.scheduled_at)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-main, #0f172a)" }}>{appt.contact_name}</p>
                            <p className="text-xs truncate" style={{ color: "var(--text-muted, #64748b)" }}>{appt.tenant_name}</p>
                          </div>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.color }}>
                            {st.label[lang] ?? st.label.fr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#fff" }}>
            {/* Header modal */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(0,0,0,.07)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold truncate" style={{ color: "#0f172a" }}>{modal.appt.contact_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: modal.appt.tenant_color }} />
                    <span className="text-xs" style={{ color: "#64748b" }}>{modal.appt.tenant_name}</span>
                  </div>
                </div>
                <button onClick={closeModal} className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" style={{ color: "#475569" }}>
                <span>{fmtDay(new Date(modal.appt.scheduled_at), lang).split(",")[0]} · {fmtTime(modal.appt.scheduled_at)} – {fmtTime(modal.appt.end_at)}</span>
                {modal.appt.party_size > 1 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{modal.appt.party_size} pers.</span>
                )}
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: (STATUS_STYLES[modal.appt.status] ?? STATUS_STYLES.pending).bg, color: (STATUS_STYLES[modal.appt.status] ?? STATUS_STYLES.pending).color }}
                >
                  {(STATUS_STYLES[modal.appt.status] ?? STATUS_STYLES.pending).label[lang] ?? (STATUS_STYLES[modal.appt.status] ?? STATUS_STYLES.pending).label.fr}
                </span>
              </div>
            </div>

            {/* Note */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,.07)" }}>
              <div className="flex gap-2">
                <textarea
                  rows={3}
                  value={modal.note}
                  onChange={(e) => setModal((m) => m ? { ...m, note: e.target.value } : m)}
                  placeholder={t.sec_note_ph}
                  className="flex-1 resize-none rounded-lg border text-sm px-3 py-2 focus:outline-none transition-colors"
                  style={{ borderColor: "rgba(0,0,0,.12)", color: "#0f172a" }}
                />
                <button
                  onClick={saveNote}
                  disabled={modal.saving}
                  className="self-end px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ background: "#0D4B58", color: "#fff" }}
                >
                  {modal.saving ? "…" : t.sec_note_save}
                </button>
              </div>
              {modal.toast && <p className="mt-1.5 text-xs font-medium" style={{ color: "#0D9488" }}>{modal.toast}</p>}
            </div>

            {/* Actions */}
            {modal.appt.status !== "cancelled" && (
              <div className="px-5 py-4 flex gap-3">
                {modal.appt.status !== "confirmed" && (
                  <button
                    onClick={() => changeStatus("confirmed")}
                    disabled={modal.saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ background: "rgba(13,148,136,.1)", color: "#0D9488" }}
                  >
                    ✓ {t.sec_confirm}
                  </button>
                )}
                <button
                  onClick={() => changeStatus("cancelled")}
                  disabled={modal.saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ background: "rgba(220,38,38,.08)", color: "#DC2626" }}
                >
                  ✕ {t.sec_cancel_appt}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
