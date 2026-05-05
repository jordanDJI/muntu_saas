"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, supabase } from "../../lib/api";

const LEAD_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:       { label: "Nouveau",    color: "bg-indigo-100 text-indigo-700" },
  contacted: { label: "Contacté",   color: "bg-blue-100 text-blue-700" },
  qualified: { label: "Qualifié",   color: "bg-purple-100 text-purple-700" },
  scheduled: { label: "RDV prévu",  color: "bg-green-100 text-green-700" },
  closed_won:  { label: "Gagné",    color: "bg-emerald-100 text-emerald-700" },
  closed_lost: { label: "Perdu",    color: "bg-gray-100 text-gray-500" },
};

const NAV_ITEMS = [
  {
    href: "/dashboard/site-builder",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
      </svg>
    ),
    label: "Mon site",
    desc: "Configurer et publier",
    accent: true,
  },
  {
    href: "/dashboard/appointments",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round"/>
        <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round"/>
        <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round"/>
      </svg>
    ),
    label: "Rendez-vous",
    desc: "Agenda et disponibilités",
  },
  {
    href: "/dashboard/leads",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
    label: "Demandes",
    desc: "Prospects et contacts",
  },
  {
    href: "/dashboard/agents",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
      </svg>
    ),
    label: "Agents IA",
    desc: "Assistant virtuel",
  },
  {
    href: "/dashboard/embed",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="8 6 2 12 8 18" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: "Intégrer",
    desc: "Widget & code embed",
  },
  {
    href: "/dashboard/settings",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
    label: "Paramètres",
    desc: "Mon compte",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [leads, setLeads]             = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tenantSlug, setTenantSlug]   = useState<string>("");
  const [loading, setLoading]         = useState(true);
  const [actioning, setActioning]     = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [l, a] = await Promise.all([
          api.getLeads(),
          api.getAppointments(),
        ]);
        setLeads(l);
        setAppointments(a);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: membership } = await supabase
            .from("membership")
            .select("tenant:tenant_id(slug)")
            .eq("user_id", user.id)
            .single();
          if (membership?.tenant) setTenantSlug((membership.tenant as any).slug ?? "");
        }
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

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          {tenantSlug && (
            <a href={`/${tenantSlug}`} target="_blank" rel="noreferrer"
              className="text-xs text-indigo-600 hover:underline mt-0.5 inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Voir mon site public
            </a>
          )}
        </div>
        <button onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Déconnexion
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nouvelles demandes</p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">{loading ? "—" : newLeads.length}</p>
          {newLeads.length > 0 && (
            <Link href="/dashboard/leads" className="text-xs text-indigo-500 hover:underline mt-1 inline-block">
              Traiter →
            </Link>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">RDV en attente</p>
          <p className={`text-3xl font-bold mt-1 ${pending.length > 0 ? "text-amber-500" : "text-gray-300"}`}>
            {loading ? "—" : pending.length}
          </p>
          {pending.length > 0 && (
            <Link href="/dashboard/appointments" className="text-xs text-amber-500 hover:underline mt-1 inline-block">
              À confirmer →
            </Link>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">RDV confirmés</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{loading ? "—" : confirmed.length}</p>
          <p className="text-xs text-gray-400 mt-1">À venir</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total contacts</p>
          <p className="text-3xl font-bold text-gray-700 mt-1">{loading ? "—" : leads.length}</p>
          <p className="text-xs text-gray-400 mt-1">Dans votre CRM</p>
        </div>
      </div>

      {/* Pending RDV action banner */}
      {!loading && pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-sm font-semibold text-amber-800">
              {pending.length} rendez-vous en attente de confirmation
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
                    {fmtDate(a.scheduled_at)} à {fmtTime(a.scheduled_at)}
                  </span>
                  {a.service_offer?.name && (
                    <span className="text-indigo-500 ml-2 text-xs">{a.service_offer.name}</span>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => confirmAppt(a.id)}
                    disabled={actioning === a.id}
                    className="bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {actioning === a.id ? "…" : "Confirmer"}
                  </button>
                  <button
                    onClick={() => cancelAppt(a.id)}
                    disabled={actioning === a.id}
                    className="border border-red-200 text-red-500 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Refuser
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800 text-sm">Dernières demandes</h2>
            <Link href="/dashboard/leads" className="text-xs text-indigo-600 hover:underline">Tout voir →</Link>
          </div>
          <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {loading && (
              <li className="px-5 py-4 text-sm text-gray-400">Chargement…</li>
            )}
            {!loading && leads.length === 0 && (
              <li className="px-5 py-6 text-center">
                <p className="text-sm text-gray-400">Aucune demande pour l'instant</p>
                <p className="text-xs text-gray-300 mt-1">Les prospects arriveront ici</p>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800 text-sm">Prochains RDV confirmés</h2>
            <Link href="/dashboard/appointments" className="text-xs text-indigo-600 hover:underline">Agenda →</Link>
          </div>
          <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {loading && (
              <li className="px-5 py-4 text-sm text-gray-400">Chargement…</li>
            )}
            {!loading && confirmed.length === 0 && (
              <li className="px-5 py-6 text-center">
                <p className="text-sm text-gray-400">Aucun RDV confirmé à venir</p>
                <p className="text-xs text-gray-300 mt-1">Les rendez-vous s'afficheront ici</p>
              </li>
            )}
            {confirmed.slice(0, 8).map((appt) => (
              <li key={appt.id} className="flex items-center px-5 py-3 gap-3">
                <div className="shrink-0 text-center bg-indigo-50 rounded-lg px-2 py-1 min-w-[48px]">
                  <p className="text-xs font-bold text-indigo-600 leading-none">{fmtDate(appt.scheduled_at)}</p>
                  <p className="text-xs text-indigo-400 mt-0.5">{fmtTime(appt.scheduled_at)}</p>
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
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Accès rapide</p>
        <nav className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-95 ${
                item.accent
                  ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
              }`}>
              <span className={item.accent ? "text-white opacity-90" : "text-indigo-500"}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{item.label}</p>
                <p className={`text-xs leading-tight mt-0.5 truncate ${item.accent ? "text-indigo-200" : "text-gray-400"}`}>
                  {item.desc}
                </p>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
