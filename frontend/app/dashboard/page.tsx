"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, supabase } from "../../lib/api";
import { useLanguage } from "../../contexts/LanguageContext";

const DemandPotentialCard = dynamic(() => import("./analytics/DemandPotentialCard"), { ssr: false });

const LEAD_STATUS_COLOR: Record<string, string> = {
  new:         "bg-blue-100 text-blue-700",
  contacted:   "bg-amber-100 text-amber-700",
  qualified:   "bg-purple-100 text-purple-700",
  scheduled:   "bg-primary-100 text-primary-700",
  closed_won:  "bg-green-100 text-green-700",
  closed_lost: "bg-red-100 text-red-500",
};

const NAV_ITEM_DEFS = [
  { href: "/dashboard/site-builder", labelKey: "nav_site",     descKey: "nav_site_desc",     accent: true,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg> },
  { href: "/dashboard/appointments", labelKey: "nav_appts",    descKey: "nav_appts_desc",    accent: false,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round"/></svg> },
  { href: "/dashboard/leads",        labelKey: "nav_leads",    descKey: "nav_leads_desc",    accent: false,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg> },
  { href: "/dashboard/agents",       labelKey: "nav_agents",   descKey: "nav_agents_desc",   accent: false,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg> },
  { href: "/dashboard/embed",        labelKey: "nav_embed",    descKey: "nav_embed_desc",    accent: false,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" strokeLinecap="round" strokeLinejoin="round"/><polyline points="8 6 2 12 8 18" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: "/dashboard/settings",     labelKey: "nav_settings", descKey: "nav_settings_desc", accent: false,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
];

export default function DashboardPage() {
  const { t } = useLanguage();
  const [leads, setLeads]             = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tenantSlug, setTenantSlug]   = useState<string>("");
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actioning, setActioning]     = useState<string | null>(null);
  const [kpis, setKpis]               = useState<string[] | null>(null);

  const NAV_ITEMS = NAV_ITEM_DEFS.map(d => ({ ...d, label: t[d.labelKey], desc: t[d.descKey] }));

  const LEAD_STATUS_LABEL: Record<string, { label: string; color: string }> = {
    new:         { label: t.lead_status_new,       color: LEAD_STATUS_COLOR.new },
    contacted:   { label: t.lead_status_contacted, color: LEAD_STATUS_COLOR.contacted },
    qualified:   { label: t.lead_status_qualified, color: LEAD_STATUS_COLOR.qualified },
    scheduled:   { label: t.lead_status_scheduled, color: LEAD_STATUS_COLOR.scheduled },
    closed_won:  { label: t.lead_status_won,       color: LEAD_STATUS_COLOR.closed_won },
    closed_lost: { label: t.lead_status_lost,      color: LEAD_STATUS_COLOR.closed_lost },
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [l, a, cc] = await Promise.all([
          api.getLeads(),
          api.getAppointments(),
          api.getContactsCount(),
        ]);
        setLeads(l);
        setAppointments(a);
        setContactsCount(cc.count);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const prefs = user.user_metadata?.dashboard_kpis;
          if (Array.isArray(prefs)) setKpis(prefs);
        }
        try {
          const tenant = await api.getMyTenant();
          if (tenant?.slug) setTenantSlug(tenant.slug);
        } catch { /* slug reste vide */ }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const now         = new Date();
  const upcoming    = appointments
    .filter((a) => a.status !== "cancelled" && new Date(a.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const pending     = upcoming.filter((a) => a.status === "pending");
  const confirmed   = upcoming.filter((a) => a.status === "confirmed");
  const newLeads    = leads.filter((l) => l.status === "new");

  // Site performance metrics
  const dayStart = (offset: number) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    return d;
  };
  const weeklyBars = Array.from({ length: 7 }, (_, i) => {
    const from = dayStart(6 - i);
    const to   = dayStart(5 - i);
    const dayLeads = leads.filter((l) => {
      const t = new Date(l.created_at);
      return t >= from && t < to;
    }).length;
    const dayAppts = appointments.filter((a) => {
      const t = new Date(a.created_at ?? a.scheduled_at);
      return t >= from && t < to;
    }).length;
    return {
      label: from.toLocaleDateString("fr-BE", { weekday: "short" }),
      leads: dayLeads,
      appts: dayAppts,
      total: dayLeads + dayAppts,
    };
  });
  const maxBar = Math.max(...weeklyBars.map((d) => d.total), 1);
  const last30 = dayStart(30);
  const leadsLast30 = leads.filter((l) => new Date(l.created_at) >= last30).length;
  const apptsLast30 = appointments.filter((a) => new Date(a.created_at ?? a.scheduled_at) >= last30).length;
  const closedAppts = appointments.filter((a) => ["confirmed", "cancelled"].includes(a.status));
  const convRate = closedAppts.length > 0
    ? Math.round((appointments.filter((a) => a.status === "confirmed").length / closedAppts.length) * 100)
    : 0;

  const confirmAppt = async (id: string) => {
    setActioning(id);
    try { await api.confirmAppointment(id); const a = await api.getAppointments(); setAppointments(a); }
    finally { setActioning(null); }
  };
  const cancelAppt = async (id: string) => {
    setActioning(id);
    try { await api.cancelAppointment(id); const a = await api.getAppointments(); setAppointments(a); }
    finally { setActioning(null); }
  };

  const showKpi = (id: string) => kpis === null || kpis.includes(id);
  const perfColCount = [showKpi("leads_30d"), showKpi("rdv_30d"), showKpi("conv_rate")].reduce((n, v) => n + (v ? 1 : 0), 0);
  const perfGridClass = perfColCount === 3 ? "grid-cols-3" : perfColCount === 2 ? "grid-cols-2" : "grid-cols-1";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.dash_title}</h1>
        {tenantSlug && (
          <div className="flex items-center gap-3 mt-0.5">
            <a href={`/${tenantSlug}`} target="_blank" rel="noreferrer"
              className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              {t.dash_view_site}
            </a>
            <a href={`/${tenantSlug}?preview=1`} target="_blank" rel="noreferrer"
              className="text-xs text-amber-600 hover:underline inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              Prévisualiser
            </a>
          </div>
        )}
      </div>

      {/* KPIs */}
      {[showKpi("new_leads"), showKpi("pending"), showKpi("confirmed"), showKpi("contacts")].some(Boolean) && (
        <div id="dash-kpis" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {showKpi("new_leads") && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t.kpi_new_leads}</p>
              <p className="text-3xl font-bold text-primary-600 mt-1">{loading ? "—" : newLeads.length}</p>
              {newLeads.length > 0 && (
                <Link href="/dashboard/leads" className="text-xs text-primary-500 hover:underline mt-1 inline-block">
                  {t.kpi_treat}
                </Link>
              )}
            </div>
          )}
          {showKpi("pending") && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t.kpi_pending}</p>
              <p className={`text-3xl font-bold mt-1 ${pending.length > 0 ? "text-amber-500" : "text-gray-300"}`}>
                {loading ? "—" : pending.length}
              </p>
              {pending.length > 0 && (
                <Link href="/dashboard/appointments" className="text-xs text-amber-500 hover:underline mt-1 inline-block">
                  {t.kpi_to_confirm}
                </Link>
              )}
            </div>
          )}
          {showKpi("confirmed") && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t.kpi_confirmed_appts}</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{loading ? "—" : confirmed.length}</p>
              <p className="text-xs text-gray-400 mt-1">{t.kpi_upcoming}</p>
            </div>
          )}
          {showKpi("contacts") && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t.kpi_contacts}</p>
              <p className="text-3xl font-bold text-gray-700 mt-1">{loading || contactsCount === null ? "—" : contactsCount}</p>
              <p className="text-xs text-gray-400 mt-1">{t.kpi_distinct}</p>
            </div>
          )}
        </div>
      )}

      {/* Pending RDV action banner */}
      {!loading && pending.length > 0 && (
        <div id="dash-pending" className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-sm font-semibold text-amber-800">
              {pending.length} {t.dash_pending_banner}
            </p>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3 bg-white border border-amber-100 rounded-lg px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">
                    {a.contact?.first_name} {a.contact?.last_name}
                  </span>
                  <span className="text-gray-400 ml-2 text-xs">
                    {fmtDate(a.scheduled_at)} {t.dash_at} {fmtTime(a.scheduled_at)}
                  </span>
                  {a.service_offer?.name && (
                    <span className="text-primary-500 ml-2 text-xs">{a.service_offer.name}</span>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => confirmAppt(a.id)}
                    disabled={actioning === a.id}
                    className="bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {actioning === a.id ? "…" : t.dash_confirm}
                  </button>
                  <button
                    onClick={() => cancelAppt(a.id)}
                    disabled={actioning === a.id}
                    className="border border-red-200 text-red-500 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {t.dash_refuse}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: leads + appointments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Recent leads */}
        <div id="dash-recent-leads" className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800 text-sm">{t.dash_recent_leads}</h2>
            <Link href="/dashboard/leads" className="text-xs text-primary-600 hover:underline">{t.dash_see_all}</Link>
          </div>
          <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {loading && (
              <li className="px-5 py-4 text-sm text-gray-400">{t.dash_loading}</li>
            )}
            {!loading && leads.length === 0 && (
              <li className="px-5 py-6 text-center">
                <p className="text-sm text-gray-400">{t.dash_no_leads}</p>
                <p className="text-xs text-gray-300 mt-1">{t.dash_leads_hint}</p>
              </li>
            )}
            {leads.slice(0, 8).map((lead) => {
              const st = LEAD_STATUS_LABEL[lead.status] ?? { label: lead.status, color: "bg-gray-100 text-gray-500" };
              return (
                <li key={lead.id}>
                  <Link href="/dashboard/leads"
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {lead.contact?.first_name} {lead.contact?.last_name}
                      </p>
                      {lead.created_at && (
                        <p className="text-xs text-gray-400">
                          {new Date(lead.created_at).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${st.color}`}>
                      {st.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Upcoming confirmed appointments */}
        <div id="dash-upcoming-appts" className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800 text-sm">{t.dash_upcoming_appts}</h2>
            <Link href="/dashboard/appointments" className="text-xs text-primary-600 hover:underline">{t.dash_agenda}</Link>
          </div>
          <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {loading && (
              <li className="px-5 py-4 text-sm text-gray-400">{t.dash_loading}</li>
            )}
            {!loading && confirmed.length === 0 && (
              <li className="px-5 py-6 text-center">
                <p className="text-sm text-gray-400">{t.dash_no_appts}</p>
                <p className="text-xs text-gray-300 mt-1">{t.dash_appts_hint}</p>
              </li>
            )}
            {confirmed.slice(0, 8).map((appt) => (
              <li key={appt.id} className="flex items-center px-5 py-3 gap-3">
                <div className="shrink-0 text-center bg-primary-50 rounded-lg px-2 py-1 min-w-[48px]">
                  <p className="text-xs font-bold text-primary-600 leading-none">{fmtDate(appt.scheduled_at)}</p>
                  <p className="text-xs text-primary-400 mt-0.5">{fmtTime(appt.scheduled_at)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {appt.contact?.first_name} {appt.contact?.last_name}
                  </p>
                  {appt.service_offer?.name && (
                    <p className="text-xs text-gray-400 truncate">{appt.service_offer.name}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Navigation */}
      <div id="dash-nav">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.dash_quick_access}</p>
        <nav className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-95 ${
                item.accent
                  ? "bg-primary-600 border-primary-600 text-white hover:bg-primary-700"
                  : "bg-white border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50"
              }`}>
              <span className={item.accent ? "text-white opacity-90" : "text-primary-500"}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{item.label}</p>
                <p className={`text-xs leading-tight mt-0.5 truncate ${item.accent ? "text-primary-200" : "text-gray-400"}`}>
                  {item.desc}
                </p>
              </div>
            </Link>
          ))}
        </nav>
      </div>

      {/* Site performance */}
      {(showKpi("leads_30d") || showKpi("rdv_30d") || showKpi("conv_rate") || showKpi("activity")) && (
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.dash_perf_title}</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5">
          {(showKpi("leads_30d") || showKpi("rdv_30d") || showKpi("conv_rate")) && (
          <div className={`grid gap-4 text-center ${perfGridClass}`}>
            {showKpi("leads_30d") && (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-primary-600">{loading ? "—" : leadsLast30}</p>
              <p className="text-xs text-gray-500">{t.dash_requests}</p>
              <p className="text-[10px] text-gray-400">{t.dash_30d}</p>
            </div>
            )}
            {showKpi("rdv_30d") && (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-600">{loading ? "—" : apptsLast30}</p>
              <p className="text-xs text-gray-500">{t.dash_bookings}</p>
              <p className="text-[10px] text-gray-400">{t.dash_30d}</p>
            </div>
            )}
            {showKpi("conv_rate") && (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-amber-600">{loading ? "—" : `${convRate}%`}</p>
              <p className="text-xs text-gray-500">{t.dash_conv_rate}</p>
              <p className="text-[10px] text-gray-400">{t.dash_rdv_conf_of}</p>
            </div>
            )}
          </div>
          )}

          {showKpi("activity") && (
          <div>
            <p className="text-xs text-gray-400 mb-3">{t.dash_activity}</p>
            {loading ? (
              <div className="h-20 flex items-center justify-center text-sm text-gray-300">{t.dash_loading}</div>
            ) : (
              <div className="flex items-end gap-1.5 h-20">
                {weeklyBars.map((d, i) => {
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-stretch justify-end" style={{ height: 64 }}>
                        {d.appts > 0 && (
                          <div
                            className="w-full bg-green-400 rounded-t-sm"
                            style={{ height: Math.round((d.appts / maxBar) * 64) }}
                            title={`${d.appts} RDV`}
                          />
                        )}
                        {d.leads > 0 && (
                          <div
                            className={`w-full bg-primary-500 ${d.appts === 0 ? "rounded-t-sm" : ""}`}
                            style={{ height: Math.round((d.leads / maxBar) * 64) }}
                            title={`${d.leads} demandes`}
                          />
                        )}
                        {d.total === 0 && (
                          <div className="w-full bg-gray-100 rounded-sm" style={{ height: 3 }} />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 capitalize">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary-500 inline-block" /> {t.dash_requests}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> {t.dash_bookings}
              </span>
            </div>
          </div>
          )}
        </div>
      </div>
      )}

      {/* Potentiel de demande locale */}
      {showKpi("demand_potential") && <DemandPotentialCard />}

      {/* Lien site */}
      {!loading && (
        tenantSlug ? (
          <div className="flex gap-2">
            <a
              href={`/${tenantSlug}?preview=1`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              Prévisualiser mon site
            </a>
            <a
              href={`/${tenantSlug}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary-200 text-primary-600 hover:bg-primary-50 hover:border-primary-400 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Voir le site publié
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Site non configuré
          </div>
        )
      )}
    </div>
  );
}
