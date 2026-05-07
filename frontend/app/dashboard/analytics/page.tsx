"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

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

// ── Label maps ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  site_form:                    "Formulaire site",
  website:                      "Site internet",
  dashboard:                    "Dashboard",
  "Bouche à oreille":           "Bouche à oreille",
  "Google / Recherche en ligne":"Google / Recherche",
  "Réseaux sociaux":            "Réseaux sociaux",
  "Recommandation":             "Recommandation",
  "Flyer / Affiche":            "Flyer / Affiche",
  "Autre":                      "Autre",
  inconnu:                      "Inconnu",
};

const STATUS_COLORS: Record<string, string> = {
  new:         "#6366f1",
  contacted:   "#3b82f6",
  qualified:   "#8b5cf6",
  scheduled:   "#10b981",
  closed_won:  "#22c55e",
  closed_lost: "#94a3b8",
  inconnu:     "#e5e7eb",
};

const STATUS_LABELS: Record<string, string> = {
  new:         "Nouveau",
  contacted:   "Contacté",
  qualified:   "Qualifié",
  scheduled:   "RDV planifié",
  closed_won:  "Gagné",
  closed_lost: "Perdu",
  inconnu:     "Inconnu",
};

const APPT_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmé",
  pending:   "En attente",
  cancelled: "Annulé",
};

const APPT_STATUS_COLORS: Record<string, string> = {
  confirmed: "#22c55e",
  pending:   "#f59e0b",
  cancelled: "#ef4444",
};

const CTA_LABELS: Record<string, string> = {
  phone:            "Téléphone",
  email:            "Email",
  social_facebook:  "Facebook",
  social_instagram: "Instagram",
  social_linkedin:  "LinkedIn",
  chatbot:          "Chatbot",
  booking:          "Réservation",
  autre:            "Autre",
};

const SECTION_LABELS: Record<string, string> = {
  hero:        "Accueil",
  "a-propos":  "À propos",
  prestations: "Prestations",
  contact:     "Contact",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = "#6366f1", icon }: {
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

function BarRow({ label, value, max, color = "#6366f1" }: {
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
  if (total === 0) return <Empty text="Aucune donnée." />;
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
  return (
    <div className="flex flex-col items-center">
      <div className="w-full rounded-xl text-white font-bold text-xl py-4 text-center" style={{ background: color }}>
        {value.toLocaleString("fr-BE")}
      </div>
      <p className="text-xs text-center text-gray-600 font-medium mt-1.5">{label}</p>
      {rate !== undefined && (
        <p className="text-[10px] text-gray-400 mt-0.5">{rate}% du préc.</p>
      )}
      {!isLast && <div className="w-6 h-4 flex items-center justify-center text-gray-300 text-lg mt-1">↓</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PERIODS = [
  { value: 7,  label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
] as const;

export default function AnalyticsPage() {
  const router = useRouter();
  const [days, setDays]           = useState<7 | 30 | 90>(30);
  const [data, setData]           = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const s = await api.getAnalyticsSummary(days);
      setData(s);
      setRefreshedAt(new Date());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [days]);

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
    <div className="min-h-screen bg-gray-50 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 sticky top-14 z-20">
        <button onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Retour
        </button>

        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
          {refreshedAt && (
            <p className="text-xs text-gray-400">
              Mis à jour {refreshedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Tracking badge */}
        <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${hasBehavioural ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${hasBehavioural ? "bg-green-500" : "bg-amber-400"}`} />
          {hasBehavioural ? "Tracking actif" : "Tracking inactif"}
        </div>

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
              className={`px-3 py-1 rounded-md font-medium text-xs transition-colors ${days === p.value ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-gray-800"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="m-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm">{err}</div>}

      {!loading && data && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

          {/* ── KPIs ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Vues de page"
              value={hasBehavioural ? data.pageviews.toLocaleString("fr-BE") : "—"}
              sub={hasBehavioural ? `${data.unique_sessions} sessions` : "Tracking non actif"}
              color="#3b82f6"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
            />
            <KpiCard
              label="Demandes"
              value={data.leads_total}
              sub={`sur ${days} jours`}
              color="#6366f1"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>}
            />
            <KpiCard
              label="Rendez-vous"
              value={data.appointments_total}
              sub={`${data.appointments_by_status["confirmed"] ?? 0} confirmés`}
              color="#10b981"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>}
            />
            <KpiCard
              label="Contacts"
              value={data.contacts_total}
              sub="total CRM"
              color="#8b5cf6"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
            />
            <KpiCard
              label="Conversion"
              value={data.conversion_appt_rate != null ? `${data.conversion_appt_rate}%` : "—"}
              sub="Demandes → RDV"
              color="#f59e0b"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
            />
          </div>

          {/* ── Entonnoir ────────────────────────────────────────────────── */}
          <Card>
            <CardTitle>Entonnoir de conversion</CardTitle>
            <div className="grid grid-cols-5 gap-2">
              <FunnelStep label="Vues" value={data.pageviews} color="#3b82f6" />
              <FunnelStep label="Form. ouvert" value={data.form_opens}
                rate={pct(data.form_opens, data.pageviews)} color="#6366f1" />
              <FunnelStep label="Soumis" value={data.form_submits}
                rate={pct(data.form_submits, data.form_opens)} color="#8b5cf6" />
              <FunnelStep label="Demandes" value={data.leads_total}
                rate={pct(data.leads_total, data.form_submits)} color="#0ea5e9" />
              <FunnelStep label="RDV" value={data.appointments_total}
                rate={pct(data.appointments_total, data.leads_total)} color="#10b981" isLast />
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
              <CardTitle>Sources des demandes</CardTitle>
              {Object.keys(data.leads_by_source).length === 0
                ? <Empty text="Aucune demande sur la période." />
                : <div className="space-y-3">
                    {Object.entries(data.leads_by_source)
                      .sort(([, a], [, b]) => b - a)
                      .map(([src, n]) => (
                        <BarRow key={src} label={SOURCE_LABELS[src] ?? src} value={n} max={maxSource} />
                      ))}
                  </div>}
            </Card>

            <Card>
              <CardTitle>Pipeline des demandes</CardTitle>
              <DonutSlice data={leadStatusData} />
            </Card>
          </div>

          {/* ── Rendez-vous ──────────────────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardTitle>Rendez-vous par statut</CardTitle>
              <DonutSlice data={apptStatusData} />
            </Card>

            {/* Chatbot */}
            <Card>
              <CardTitle>Activité chatbot IA</CardTitle>
              {!hasBehavioural
                ? <Empty text="Tracking non actif — les données apparaîtront dès les premières visites." />
                : <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-indigo-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-extrabold text-indigo-700">{data.chatbot_conversations}</p>
                        <p className="text-xs text-indigo-500 mt-1">Conversations</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-extrabold text-purple-700">{data.chatbot_messages}</p>
                        <p className="text-xs text-purple-500 mt-1">Messages</p>
                      </div>
                    </div>
                    {data.chatbot_conversations > 0 && (
                      <div className="text-sm text-gray-500 flex items-center justify-between border-t pt-3">
                        <span>Messages par conversation</span>
                        <strong className="text-gray-800">
                          {(data.chatbot_messages / data.chatbot_conversations).toFixed(1)}
                        </strong>
                      </div>
                    )}
                    {data.form_opens > 0 && (
                      <div className="text-sm text-gray-500 flex items-center justify-between">
                        <span>Taux engagement chatbot</span>
                        <strong className="text-gray-800">
                          {data.pageviews > 0 ? Math.round(data.chatbot_conversations / data.pageviews * 100) : 0}%
                        </strong>
                      </div>
                    )}
                  </div>}
            </Card>
          </div>

          {/* ── Comportement site ────────────────────────────────────────── */}
          {hasBehavioural && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardTitle>Sections les plus consultées</CardTitle>
                {Object.keys(data.sections_viewed).length === 0
                  ? <Empty text="Aucune section trackée." />
                  : <div className="space-y-3">
                      {Object.entries(data.sections_viewed)
                        .sort(([, a], [, b]) => b - a)
                        .map(([sec, n]) => (
                          <BarRow key={sec} label={SECTION_LABELS[sec] ?? sec} value={n} max={maxSection} color="#0891b2" />
                        ))}
                    </div>}
              </Card>

              <Card>
                <CardTitle>Clics & interactions</CardTitle>
                {Object.keys(data.cta_clicks).length === 0
                  ? <Empty text="Aucun clic enregistré." />
                  : <div className="space-y-3">
                      {Object.entries(data.cta_clicks)
                        .sort(([, a], [, b]) => b - a)
                        .map(([action, n]) => (
                          <BarRow key={action} label={CTA_LABELS[action] ?? action} value={n} max={maxCta} color="#f59e0b" />
                        ))}
                    </div>}
              </Card>
            </div>
          )}

          {/* ── Bannière tracking inactif ────────────────────────────────── */}
          {!hasBehavioural && (
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
      )}

      {loading && (
        <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Chargement…
        </div>
      )}
    </div>
  );
}
