"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";
import DemandPotentialCard from "./DemandPotentialCard";
import { UpgradeGate } from "../components/UpgradeGate";

// ── Types ─────────────────────────────────────────────────────────────────────

type Summary = {
  period_days: number;
  contacts_total: number;
  leads_total: number;
  leads_by_source: Record<string, number>;
  leads_by_status: Record<string, number>;
  appointments_total: number;
  appointments_by_status: Record<string, number>;
  pageviews: number;
  unique_sessions: number;
  sections_viewed: Record<string, number>;
  cta_clicks: Record<string, number>;
  chatbot_conversations: number;
  chatbot_messages: number;
  form_opens: number;
  form_submits: number;
  conversion_lead_rate: number | null;
  conversion_appt_rate: number | null;
};

// ── Static color maps (not i18n) ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new:         "#0D4B58",
  contacted:   "#4E7EA8",
  qualified:   "#6B8A7A",
  scheduled:   "#1A7A8F",
  closed_won:  "#1D7A4A",
  closed_lost: "#BF3333",
  inconnu:     "#e5e7eb",
};

const APPT_STATUS_COLORS: Record<string, string> = {
  confirmed: "#22c55e",
  pending:   "#f59e0b",
  cancelled: "#ef4444",
};

const SECTION_COLORS: Record<string, string> = {
  hero:         "#4E7EA8",
  "a-propos":   "#6B8A7A",
  prestations:  "#0D4B58",
  contact:      "#1D7A4A",
  galerie:      "#7C5DBF",
  temoignages:  "#C47B1E",
  services:     "#1A7A8F",
  about:        "#6B8A7A",
  footer:       "#AAB0C0",
};

function SectionIcon({ section }: { section: string }) {
  const cls = "w-4 h-4";
  switch (section) {
    case "hero": return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
    );
    case "a-propos": case "about": return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    );
    case "prestations": case "services": return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
    );
    case "contact": return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
    );
    case "galerie": return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    );
    case "temoignages": return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    );
    default: return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
      </svg>
    );
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = "#0D4B58", icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, color = "#0D4B58" }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = Math.round((value / Math.max(max, 1)) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-36 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-bold text-gray-800 w-8 text-right shrink-0">{value}</span>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-bold text-gray-800 mb-4">{children}</p>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic py-2">{text}</p>;
}

function DonutSlice({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const { t } = useLanguage();
  if (total === 0) return <Empty text={t.ana_no_data} />;
  return (
    <div className="space-y-2.5 mt-1">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
          <span className="text-sm text-gray-600 flex-1 truncate">{d.label}</span>
          <span className="text-sm font-bold text-gray-800">{d.value}</span>
          <span className="text-xs text-gray-400 w-10 text-right">{Math.round(d.value / total * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────────

function FunnelStep({ label, value, rate, color, isLast = false }: {
  label: string; value: number; rate?: number; color: string; isLast?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center">
      <div className="w-full rounded-xl text-white font-bold text-xl py-4 text-center" style={{ background: color }}>
        {value.toLocaleString("fr-BE")}
      </div>
      <p className="text-xs text-center text-gray-600 font-medium mt-1.5">{label}</p>
      {rate !== undefined && (
        <p className="text-[10px] text-gray-400 mt-0.5">{rate}{t.ana_pct_prev}</p>
      )}
      {!isLast && <div className="w-6 h-4 flex items-center justify-center text-gray-300 text-lg mt-1">↓</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// PERIODS built inside component below (needs t)

export default function AnalyticsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [days, setDays]           = useState<7 | 30 | 90>(30);
  const [data, setData]           = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ── i18n label maps (inside component so t is available) ─────────────────────

  const SOURCE_LABELS: Record<string, string> = {
    contact_form:   t.ana_source_form,
    site_form:      t.ana_source_form,
    website:        t.ana_source_web,
    dashboard:      t.ana_source_dashboard,
    "Bouche à oreille":            t.ana_source_word_of_mouth,
    "Google / Recherche en ligne": t.ana_source_google,
    "Réseaux sociaux":             t.ana_source_social,
    "Recommandation":              t.ana_source_referral,
    "Flyer / Affiche":             t.ana_source_flyer,
    "Autre":                       t.ana_source_other,
    inconnu:                       t.ana_source_unknown,
  };

  const STATUS_LABELS: Record<string, string> = {
    new:         t.lead_status_new,
    contacted:   t.lead_status_contacted,
    qualified:   t.lead_status_qualified,
    scheduled:   t.lead_status_scheduled,
    closed_won:  t.lead_status_won,
    closed_lost: t.lead_status_lost,
    inconnu:     t.ana_source_unknown,
  };

  const APPT_STATUS_LABELS: Record<string, string> = {
    confirmed: t.ana_appt_confirmed,
    pending:   t.ana_appt_pending,
    cancelled: t.ana_appt_cancelled,
  };

  const CTA_LABELS: Record<string, string> = {
    phone:            t.ana_cta_phone,
    email:            t.ana_cta_email,
    social_facebook:  t.ana_cta_facebook,
    social_instagram: t.ana_cta_instagram,
    social_linkedin:  t.ana_cta_linkedin,
    chatbot:          t.ana_cta_chatbot,
    booking:          t.ana_cta_booking,
    autre:            t.ana_cta_other,
  };

  const SECTION_LABELS: Record<string, string> = {
    hero:         t.ana_section_home,
    "a-propos":   t.ana_section_about,
    about:        t.ana_section_about,
    prestations:  t.ana_section_services,
    services:     t.ana_section_services,
    contact:      t.ana_section_contact,
    galerie:      t.ana_section_gallery,
    temoignages:  t.ana_section_reviews,
    footer:       t.ana_section_footer,
  };

  const PERIODS = [
    { value: 7  as const, label: t.ana_period_7d },
    { value: 30 as const, label: t.ana_period_30d },
    { value: 90 as const, label: t.ana_period_90d },
  ];

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const s = await api.getAnalyticsSummary(days);
      setData(s);
      setRefreshedAt(new Date());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [days]);

  const handleDownload = async () => {
    setDownloading(true);
    try { await api.downloadAnalyticsReport(days); }
    catch (e: any) { setErr(`PDF : ${e.message}`); }
    finally { setDownloading(false); }
  };

  useEffect(() => { load(); }, [load]);

  const hasBehavioural = (data?.pageviews ?? 0) > 0;

  const pct = (a: number, b: number) => b > 0 ? Math.round(a / b * 100) : undefined;

  // Lead status pie data
  const leadStatusData = data
    ? Object.entries(data.leads_by_status)
        .sort(([, a], [, b]) => b - a)
        .map(([st, n]) => ({ label: STATUS_LABELS[st] ?? st, value: n, color: STATUS_COLORS[st] ?? "#e5e7eb" }))
    : [];

  // Appt status pie data
  const apptStatusData = data
    ? Object.entries(data.appointments_by_status)
        .sort(([, a], [, b]) => b - a)
        .map(([st, n]) => ({ label: APPT_STATUS_LABELS[st] ?? st, value: n, color: APPT_STATUS_COLORS[st] ?? "#e5e7eb" }))
    : [];

  const maxSource = data ? Math.max(1, ...Object.values(data.leads_by_source)) : 1;
  const maxSection = data ? Math.max(1, ...Object.values(data.sections_viewed)) : 1;
  const maxCta     = data ? Math.max(1, ...Object.values(data.cta_clicks)) : 1;

  return (
    <UpgradeGate feature="analytics">
    <div className="min-h-screen bg-gray-50 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 sticky top-14 z-20">
        <button onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          {t.sett_back}
        </button>

        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
          {refreshedAt && (
            <p className="text-xs text-gray-400">
              {t.ana_updated_at} {refreshedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Tracking badge */}
        <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${hasBehavioural ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${hasBehavioural ? "bg-green-500" : "bg-amber-400"}`} />
          {hasBehavioural ? t.ana_tracking_active : t.ana_tracking_inactive}
        </div>

        {/* PDF download */}
        <button
          onClick={handleDownload}
          disabled={downloading || !data}
          title={t.ana_pdf_btn}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          {downloading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          )}
          {downloading ? t.sett_saving : "PDF"}
        </button>

        {/* Refresh */}
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40 transition-colors">
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>

        {/* Period selector */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setDays(p.value)}
              className={`px-3 py-1 rounded-md font-medium text-xs transition-colors ${days === p.value ? "bg-white shadow text-primary-600" : "text-gray-500 hover:text-gray-800"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="m-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm">{err}</div>}

      {!loading && data && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

          {/* ── KPIs ─────────────────────────────────────────────────────── */}
          <div id="analytics-kpis" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label={t.ana_kpi_views}
              value={hasBehavioural ? data.pageviews.toLocaleString("fr-BE") : "—"}
              sub={hasBehavioural ? t.ana_sessions_sub.replace("{n}", String(data.unique_sessions)) : t.ana_tracking_inactive}
              color="#4E7EA8"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
            />
            <KpiCard
              label={t.ana_kpi_leads}
              value={data.leads_total}
              sub={t.ana_on_period.replace("{n}", String(days))}
              color="#0D4B58"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>}
            />
            <KpiCard
              label={t.ana_kpi_appts}
              value={data.appointments_total}
              sub={t.ana_confirmed_sub.replace("{n}", String(data.appointments_by_status["confirmed"] ?? 0))}
              color="#1D7A4A"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>}
            />
            <KpiCard
              label={t.ana_kpi_contacts}
              value={data.contacts_total}
              sub="CRM"
              color="#4A6757"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
            />
            <KpiCard
              label={t.ana_kpi_conversion}
              value={data.conversion_appt_rate != null ? `${data.conversion_appt_rate}%` : "—"}
              sub={t.ana_conv_label}
              color="#DDAA40"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
            />
          </div>

          {/* ── Entonnoir ────────────────────────────────────────────────── */}
          <Card>
            <CardTitle>{t.ana_funnel_title}</CardTitle>
            <div className="grid grid-cols-5 gap-2">
              <FunnelStep label={t.ana_funnel_views} value={data.pageviews} color="#4E7EA8" />
              <FunnelStep label={t.ana_funnel_form_open} value={data.form_opens}
                rate={pct(data.form_opens, data.pageviews)} color="#2E94A8" />
              <FunnelStep label={t.ana_funnel_submitted} value={data.form_submits}
                rate={pct(data.form_submits, data.form_opens)} color="#1A7A8F" />
              <FunnelStep label={t.ana_funnel_leads} value={data.leads_total}
                rate={pct(data.leads_total, data.form_submits)} color="#0D4B58" />
              <FunnelStep label={t.ana_funnel_appts} value={data.appointments_total}
                rate={pct(data.appointments_total, data.leads_total)} color="#1D7A4A" isLast />
            </div>
            {!hasBehavioural && (
              <p className="mt-4 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Les premières étapes (Vues, Form. ouvert, Soumis) seront remplies dès que des visiteurs accèdent à votre site public.
              </p>
            )}
          </Card>

          {/* ── Sources + Statuts leads ──────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardTitle>{t.ana_sources_title}</CardTitle>
              {Object.keys(data.leads_by_source).length === 0
                ? <Empty text={t.ana_no_leads} />
                : <div className="space-y-3">
                    {Object.entries(data.leads_by_source)
                      .sort(([, a], [, b]) => b - a)
                      .map(([src, n]) => (
                        <BarRow key={src} label={SOURCE_LABELS[src] ?? src} value={n} max={maxSource} />
                      ))}
                  </div>}
            </Card>

            <Card>
              <CardTitle>{t.ana_pipeline_title}</CardTitle>
              <DonutSlice data={leadStatusData} />
            </Card>
          </div>

          {/* ── Rendez-vous ──────────────────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardTitle>{t.ana_appt_status_title}</CardTitle>
              <DonutSlice data={apptStatusData} />
            </Card>

            {/* Chatbot */}
            <Card>
              <CardTitle>{t.ana_chatbot_title}</CardTitle>
              {!hasBehavioural
                ? <Empty text={t.ana_no_tracking} />
                : <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-primary-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-extrabold text-primary-700">{data.chatbot_conversations}</p>
                        <p className="text-xs text-primary-500 mt-1">{t.ana_chatbot_convs}</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-extrabold text-purple-700">{data.chatbot_messages}</p>
                        <p className="text-xs text-purple-500 mt-1">{t.ana_chatbot_msgs}</p>
                      </div>
                    </div>
                    {data.chatbot_conversations > 0 && (
                      <div className="text-sm text-gray-500 flex items-center justify-between border-t pt-3">
                        <span>{t.ana_chatbot_per_conv}</span>
                        <strong className="text-gray-800">
                          {(data.chatbot_messages / data.chatbot_conversations).toFixed(1)}
                        </strong>
                      </div>
                    )}
                    {data.form_opens > 0 && (
                      <div className="text-sm text-gray-500 flex items-center justify-between">
                        <span>{t.ana_chatbot_rate}</span>
                        <strong className="text-gray-800">
                          {data.pageviews > 0 ? Math.round(data.chatbot_conversations / data.pageviews * 100) : 0}%
                        </strong>
                      </div>
                    )}
                  </div>}
            </Card>
          </div>

          {/* ── Comportement site ────────────────────────────────────────── */}
          <div id="analytics-behavioral">
            {hasBehavioural ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle>{t.ana_sections_title}</CardTitle>
                    {Object.keys(data.sections_viewed).length > 0 && (
                      <span className="text-xs text-gray-400">
                        {Object.keys(data.sections_viewed).length} section{Object.keys(data.sections_viewed).length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {Object.keys(data.sections_viewed).length === 0
                    ? <Empty text={t.ana_no_sections} />
                    : (() => {
                        const sorted = Object.entries(data.sections_viewed).sort(([, a], [, b]) => b - a);
                        const total  = sorted.reduce((s, [, n]) => s + n, 0);
                        const topSec = sorted[0];
                        return (
                          <div>
                            <div className="space-y-2.5">
                              {sorted.map(([sec, n]) => {
                                const color = SECTION_COLORS[sec] ?? "#0891b2";
                                const pct   = Math.round(n / Math.max(maxSection, 1) * 100);
                                const viewP = data.pageviews > 0 ? Math.round(n / data.pageviews * 100) : 0;
                                return (
                                  <div key={sec} className="flex items-center gap-3">
                                    {/* Icône */}
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                      style={{ backgroundColor: `${color}18`, color }}
                                    >
                                      <SectionIcon section={sec} />
                                    </div>
                                    {/* Barre + label */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-gray-700 truncate">
                                          {SECTION_LABELS[sec] ?? sec}
                                        </span>
                                        <span className="text-xs text-gray-400 ml-2 shrink-0">
                                          {viewP}% {t.ana_pct_views}
                                        </span>
                                      </div>
                                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-1.5 rounded-full transition-all"
                                          style={{ width: `${pct}%`, background: color }}
                                        />
                                      </div>
                                    </div>
                                    {/* Compteur */}
                                    <span className="text-sm font-bold text-gray-800 w-7 text-right shrink-0">{n}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Résumé bas de card */}
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                              <span className="text-xs text-gray-400">
                                {t.ana_top_section}
                              </span>
                              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ background: SECTION_COLORS[topSec[0]] ?? "#0891b2" }}
                                />
                                {SECTION_LABELS[topSec[0]] ?? topSec[0]}
                                <span className="text-gray-400 font-normal ml-1">
                                  ({data.pageviews > 0 ? Math.round(topSec[1] / data.pageviews * 100) : 0}% {t.ana_pct_views})
                                </span>
                              </span>
                            </div>
                          </div>
                        );
                      })()
                  }
                </Card>

                <Card>
                  <CardTitle>{t.ana_cta_title}</CardTitle>
                  {Object.keys(data.cta_clicks).length === 0
                    ? <Empty text={t.ana_no_clicks} />
                    : <div className="space-y-3">
                        {Object.entries(data.cta_clicks)
                          .sort(([, a], [, b]) => b - a)
                          .map(([action, n]) => (
                            <BarRow key={action} label={CTA_LABELS[action] ?? action} value={n} max={maxCta} color="#f59e0b" />
                          ))}
                      </div>}
                </Card>
              </div>
            ) : (
              <Card className="border-amber-200 bg-amber-50">
                <div className="flex gap-3 items-start">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"/>
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">Tracking comportemental en attente de données</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Le script de tracking est actif sur votre site. Les métriques comportementales
                      (vues, sections, clics, chatbot) apparaîtront automatiquement dès les premières visites.
                    </p>
                    <p className="text-xs text-amber-600 mt-2 font-medium">
                      Note : L'acquisition de trafic (sources, appareils, pays) est gérée par vos outils GA4 / Meta Pixel configurés dans le site-builder étape 8.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* ── Potentiel de demande locale ──────────────────────────────── */}
          <div id="analytics-demand">
            <DemandPotentialCard />
          </div>

        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {t.dash_loading}
        </div>
      )}
    </div>
    </UpgradeGate>
  );
}
