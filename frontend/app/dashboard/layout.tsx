"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OnbordaProvider, Onborda, useOnborda } from "onborda";
import { supabase, api } from "../../lib/api";
import { useLanguage } from "../../contexts/LanguageContext";
import { TenantProvider, useTenant } from "../../contexts/TenantContext";
import { SubscriptionProvider, useSubscription } from "../../contexts/SubscriptionContext";
import type { FeatureKey } from "../../contexts/SubscriptionContext";
import { COUNTRIES } from "../../lib/countries";
import OnboardingCard from "../../components/OnboardingCard";
import { ALL_TOURS, TOUR_MENU, PAGE_TOUR } from "./onboarding/tours";

// Page cible de chaque tour (vide = nav toujours visible, pas de redirect)
const TOUR_PAGE: Record<string, string> = {
  welcome:        "",
  dashboard:      "/dashboard",
  leads:          "/dashboard/leads",
  appointments:   "/dashboard/appointments",
  "site-builder": "/dashboard/site-builder",
  analytics:      "/dashboard/analytics",
  agents:         "/dashboard/agents",
  settings:       "/dashboard/settings",
};

// Feature d'abonnement requise pour afficher le tour dans le menu
const TOUR_REQUIRED_FEATURE: Partial<Record<string, FeatureKey>> = {
  analytics: "analytics",
};

const NAV_HREFS = [
  { href: "/dashboard",              tKey: "nav_db",       icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> },
  { href: "/dashboard/leads",        tKey: "nav_leads",    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z"/></svg> },
  { href: "/dashboard/appointments", tKey: "nav_appts",    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { href: "/dashboard/site-builder", tKey: "nav_site",      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg> },
  { href: "/dashboard/analytics",    tKey: "nav_analytics", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
  { href: "/dashboard/agents",       tKey: "nav_agents",    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104A9 9 0 0112 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9c0-1.04.177-2.04.5-2.97"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4"/></svg> },
] as const;

const SECTORS = [
  { value: "health",   label: "Santé" },
  { value: "coaching", label: "Coaching / Conseil" },
  { value: "trade",    label: "Artisan / Commerce" },
  { value: "beauty",   label: "Beauté / Bien-être" },
  { value: "finance",  label: "Finance" },
  { value: "other",    label: "Autre" },
];

function NewTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: "", slug: "", sector: "other", country: "BE" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slugify = (v: string) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.createTenant(form);
      onCreated(result.id);
    } catch (err: any) {
      setError(err.message ?? "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.55)" }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: "var(--bg-nav)", border: "1px solid rgba(170,189,216,.15)" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--l-gold)" }}>Business</p>
            <h2 className="text-white font-bold text-lg">Nouvel espace de travail</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Nom */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nom de l'espace *</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30 placeholder-slate-500"
              placeholder="Ex: Clinique du Parc"
              value={form.name}
              onChange={(e) => { set("name", e.target.value); set("slug", slugify(e.target.value)); }}
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">URL publique *</label>
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              <span className="text-xs text-slate-500 px-3 py-2 border-r border-white/10 shrink-0">votre-domaine.com/</span>
              <input
                className="flex-1 px-3 py-2 text-sm text-white bg-transparent focus:outline-none placeholder-slate-500"
                value={form.slug}
                onChange={(e) => set("slug", slugify(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Secteur + Pays */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Secteur</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30"
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
              >
                {SECTORS.map((s) => <option key={s.value} value={s.value} style={{ background: "#07222F" }}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Pays</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              >
                {COUNTRIES.map((c) => <option key={c.code} value={c.code} style={{ background: "#07222F" }}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: "#FC8181" }}>{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-opacity"
              style={{ background: "var(--l-teal-xl)", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Création…" : "Créer l'espace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TenantSwitcher() {
  const { tenants, activeTenant, switchTenant, reload } = useTenant();
  const { hasFeature } = useSubscription();
  const canMultiTenant = hasFeature("multi_tenant");
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (tenants.length <= 1 && !canMultiTenant) return null;

  const handleCreated = async (newId: string) => {
    setShowModal(false);
    await reload();
    switchTenant(newId);
  };

  return (
    <>
      <div ref={ref} className="relative hidden md:block">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors max-w-[160px]"
          title="Changer d'espace"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
          <span className="truncate">{activeTenant?.name ?? "—"}</span>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 w-56 rounded-xl py-1 z-50 shadow-xl" style={{ background: "var(--bg-nav)", border: "1px solid rgba(170,189,216,.15)" }}>
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => { switchTenant(t.id); setOpen(false); }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors ${t.id === activeTenant?.id ? "text-white" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
                style={t.id === activeTenant?.id ? { background: "rgba(13,75,88,.45)" } : undefined}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"/>
                </svg>
                <span className="truncate">{t.name}</span>
                {t.id === activeTenant?.id && (
                  <svg className="w-3 h-3 ml-auto shrink-0 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                )}
              </button>
            ))}

            {canMultiTenant && (
              <div className="border-t mt-1 pt-1" style={{ borderColor: "rgba(170,189,216,.1)" }}>
                <button
                  onClick={() => { setOpen(false); setShowModal(true); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  <span>Nouvel espace</span>
                  <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(221,170,64,.15)", color: "var(--l-gold)" }}>Business</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && <NewTenantModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </>
  );
}

// ── Auto-démarrage du tour de bienvenue au premier login ──────────────────────

function TourStarter() {
  const { startOnborda } = useOnborda();
  const pathname = usePathname();

  // Lance le tour en attente après une navigation inter-pages
  useEffect(() => {
    const pending = localStorage.getItem("klientys_pending_tour");
    if (!pending) return;
    const targetPage = TOUR_PAGE[pending];
    if (!targetPage || pathname !== targetPage) return;
    localStorage.removeItem("klientys_pending_tour");
    const t = setTimeout(() => startOnborda(pending), 500);
    return () => clearTimeout(t);
  }, [pathname, startOnborda]);

  // Tour de bienvenue au premier login (desktop uniquement)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      if (user.user_metadata?.onboarding_done) return;
      const t = setTimeout(async () => {
        startOnborda("welcome");
        await supabase.auth.updateUser({ data: { onboarding_done: true } });
      }, 800);
      return () => clearTimeout(t);
    });
  }, [startOnborda]);

  return null;
}

// ── Bouton d'aide avec menu déroulant ────────────────────────────────────────

function TourHelpMenu() {
  const { startOnborda } = useOnborda();
  const { hasFeature } = useSubscription();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleStart = (tour: string) => {
    setOpen(false);
    const targetPage = TOUR_PAGE[tour];
    if (targetPage && pathname !== targetPage) {
      localStorage.setItem("klientys_pending_tour", tour);
      router.push(targetPage);
    } else {
      startOnborda(tour);
    }
  };

  const pageTour = PAGE_TOUR[pathname];
  const visibleTours = TOUR_MENU.filter(item => {
    const req = TOUR_REQUIRED_FEATURE[item.tour];
    return !req || hasFeature(req);
  });

  return (
    <div ref={ref} className="relative" id="tour-help">
      <button
        onClick={() => setOpen(v => !v)}
        title="Guides et aide"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors font-bold text-sm"
      >
        ?
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-xl py-2 z-50 shadow-xl"
          style={{ background: "var(--bg-nav)", border: "1px solid rgba(170,189,216,.15)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest px-3 pb-1.5 pt-0.5" style={{ color: "rgba(170,189,216,.5)" }}>
            Guides interactifs
          </p>

          {pageTour && (!TOUR_REQUIRED_FEATURE[pageTour] || hasFeature(TOUR_REQUIRED_FEATURE[pageTour]!)) && (
            <>
              <button
                onClick={() => handleStart(pageTour)}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <span className="text-base">▶</span>
                <span className="font-medium">Guide de cette page</span>
              </button>
              <div className="h-px my-1" style={{ background: "rgba(170,189,216,.1)" }} />
            </>
          )}

          {visibleTours.map(item => (
            <button
              key={item.tour}
              onClick={() => handleStart(item.tour)}
              className="w-full text-left px-3 py-1.5 text-sm transition-colors"
              style={{ color: "#AABDD8" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileTourMenu({ onStart, pathname }: { onStart: () => void; pathname: string }) {
  const { startOnborda } = useOnborda();
  const { hasFeature } = useSubscription();
  const router = useRouter();
  const pageTour = PAGE_TOUR[pathname];
  const canSeePageTour = pageTour && (!TOUR_REQUIRED_FEATURE[pageTour] || hasFeature(TOUR_REQUIRED_FEATURE[pageTour]!));

  const handleStart = (tour: string) => {
    onStart();
    const targetPage = TOUR_PAGE[tour];
    if (targetPage && pathname !== targetPage) {
      localStorage.setItem("klientys_pending_tour", tour);
      setTimeout(() => router.push(targetPage), 100);
    } else {
      setTimeout(() => startOnborda(tour), 100);
    }
  };

  return (
    <div className="px-1 space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-widest px-2 pb-1" style={{ color: "rgba(170,189,216,.5)" }}>
        Guides interactifs
      </p>
      {canSeePageTour && (
        <button
          onClick={() => handleStart(pageTour)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          <span>▶</span> Guide de cette page
        </button>
      )}
      <button
        onClick={() => handleStart("welcome")}
        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors"
        style={{ color: "#AABDD8" }}
      >
        🗺 Visite guidée générale
      </button>
    </div>
  );
}

function TrialBanner() {
  const { status, trialDaysLeft, loading } = useSubscription();
  if (loading) return null;

  if (status === "trial_expired") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(4,14,21,.92)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}>
        <div style={{
          background: "var(--card-bg)", border: "1px solid rgba(170,189,216,.15)",
          borderRadius: "20px", padding: "40px 48px", maxWidth: "480px", width: "100%",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>⏰</div>
          <h2 style={{ color: "var(--text-primary)", fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}>
            Votre période d&apos;essai est terminée
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.6, marginBottom: "28px" }}>
            Les 14 jours d&apos;essai gratuit sont écoulés. Choisissez un plan pour continuer à accéder à votre tableau de bord et à tous vos clients.
          </p>
          <Link
            href="/dashboard/settings?section=abonnement"
            className="l-btn l-btn-primary"
            style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
          >
            Choisir un plan →
          </Link>
          <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
            Vos données sont conservées · Annulation à tout moment
          </p>
        </div>
      </div>
    );
  }

  if (status === "trial" && trialDaysLeft !== null && trialDaysLeft <= 3) {
    return (
      <div style={{
        background: trialDaysLeft <= 1 ? "rgba(191,51,51,.15)" : "rgba(221,170,64,.1)",
        borderBottom: `1px solid ${trialDaysLeft <= 1 ? "rgba(191,51,51,.3)" : "rgba(221,170,64,.25)"}`,
        padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "center",
        gap: "16px", flexWrap: "wrap", fontSize: "13px",
      }}>
        <span style={{ color: trialDaysLeft <= 1 ? "#FC8181" : "#DDAA40", fontWeight: 600 }}>
          {trialDaysLeft <= 1
            ? "⚠️ Dernier jour d'essai gratuit !"
            : `⚠️ Il vous reste ${trialDaysLeft} jours d'essai gratuit.`}
        </span>
        <Link
          href="/dashboard/settings?section=abonnement"
          style={{
            background: "var(--l-gold)", color: "#07222F", fontWeight: 700,
            fontSize: "12px", padding: "5px 14px", borderRadius: "100px",
            textDecoration: "none",
          }}
        >
          S&apos;abonner maintenant →
        </Link>
      </div>
    );
  }

  if (status === "trial" && trialDaysLeft !== null && trialDaysLeft > 3) {
    return (
      <div style={{
        background: "rgba(13,75,88,.12)", borderBottom: "1px solid rgba(13,75,88,.2)",
        padding: "8px 24px", display: "flex", alignItems: "center", justifyContent: "center",
        gap: "16px", flexWrap: "wrap", fontSize: "13px",
      }}>
        <span style={{ color: "var(--text-muted)" }}>
          🎉 Essai gratuit — {trialDaysLeft} jours restants
        </span>
        <Link
          href="/dashboard/settings?section=abonnement"
          style={{ color: "var(--teal-l)", fontWeight: 600, textDecoration: "none", fontSize: "12px" }}
        >
          Voir les plans →
        </Link>
      </div>
    );
  }

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  const NAV = NAV_HREFS.map((n) => ({ ...n, label: t[n.tKey] }));

  // Listen for live dark mode toggle from settings page
  useEffect(() => {
    const handler = (e: Event) => setDarkMode((e as CustomEvent<{ darkMode: boolean }>).detail.darkMode);
    window.addEventListener("klientys-darkmode", handler);
    return () => window.removeEventListener("klientys-darkmode", handler);
  }, []);

  useEffect(() => {
    // Fast path: read session from localStorage immediately, no server roundtrip
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        const prefs = session.user.user_metadata?.ui_prefs ?? {};
        setDarkMode(prefs.darkMode ?? false);
        supabase.from("membership")
          .select("tenant:tenant_id(slug)")
          .eq("user_id", session.user.id)
          .single()
          .then(({ data }) => { if (data?.tenant) setTenantSlug((data.tenant as any).slug ?? ""); });
      } else window.location.replace("/login");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") window.location.replace("/login");
      else if (event === "TOKEN_REFRESHED" && !session) window.location.replace("/login");
    });
    const interval = setInterval(async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) window.location.replace("/login");
    }, 10 * 60 * 1000);
    return () => { clearInterval(interval); subscription.unsubscribe(); };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--l-teal-xl)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <TenantProvider>
      <SubscriptionProvider>
      <OnbordaProvider>
        <Onborda steps={ALL_TOURS} cardComponent={OnboardingCard} shadowOpacity="0.6" shadowRgb="7,34,47">
    <div {...(darkMode ? { "data-dash-dark": "" } : {})} className="min-h-screen bg-gray-50">
      {/* Ancre invisible fixée au centre du viewport — cible pour la card de bienvenue */}
      <div id="onboarding-center" style={{ position: "fixed", top: "38%", left: "50%", width: 0, height: 0, pointerEvents: "none" }} />
      <TourStarter />
      {/* Navbar fixe */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14" style={{ background: "var(--bg-nav)", borderBottom: "1px solid rgba(170,189,216,.1)" }}>
        <div className="h-full px-3 md:px-4 flex items-center gap-2">

          {/* Logo */}
          <Link id="nav-logo" href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0 mr-1">
            <img src="/logo.png" alt="Klientys" className="h-9 w-auto" />
            <span className="hidden sm:block font-semibold text-white tracking-wide text-sm" style={{ fontFamily: "Georgia, Palatino, serif", fontStyle: "italic" }}>
              Klientys
            </span>
          </Link>

          {/* Nom plateforme — visible uniquement sur mobile */}
          <span className="md:hidden flex-1 text-center text-sm font-semibold text-white tracking-wide" style={{ fontFamily: "Georgia, Palatino, serif", fontStyle: "italic" }}>
            Klientys
          </span>

          {/* Liens nav — icônes seules sur md, icônes + labels sur lg */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {NAV.map((n) => {
              const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
              const navId = `nav-${n.href === "/dashboard" ? "dashboard" : n.href.split("/").pop()}`;
              return (
                <Link
                  key={n.href}
                  id={navId}
                  href={n.href}
                  title={n.label}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "text-white" : "text-slate-300 hover:text-white"
                  }`}
                  style={active ? { background: "rgba(13,75,88,.45)" } : undefined}
                >
                  {n.icon}
                  <span className="hidden lg:inline">{n.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Droite — actions */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <TenantSwitcher />

            {tenantSlug && !pathname.startsWith("/dashboard/site-builder") && (
              <a
                href={`/${tenantSlug}`}
                target="_blank"
                rel="noreferrer"
                title="Voir mon site publié"
                className="hidden md:inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                <span className="hidden lg:inline">Mon site</span>
              </a>
            )}

            <Link
              href="/dashboard/settings"
              title={t.nav_settings}
              className={`hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${pathname.startsWith("/dashboard/settings") ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/10"}`}
              style={pathname.startsWith("/dashboard/settings") ? { background: "rgba(13,75,88,.45)" } : undefined}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </Link>

            <TourHelpMenu />

            <button
              onClick={logout}
              title={t.nav_logout}
              className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </button>

            {/* Burger mobile */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="fixed top-14 inset-x-0 z-40 md:hidden overflow-y-auto max-h-[calc(100vh-3.5rem)]" style={{ background: "var(--bg-nav)", borderBottom: "1px solid rgba(170,189,216,.1)" }}>
          <div className="p-3 space-y-0.5">
            {NAV.map((n) => {
              const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                  style={active ? { background: "rgba(13,75,88,.4)" } : undefined}
                >
                  {n.icon}{n.label}
                </Link>
              );
            })}

            <div className="h-px my-2" style={{ background: "rgba(170,189,216,.1)" }} />

            <Link
              href="/dashboard/settings"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith("/dashboard/settings") ? "text-white" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
              style={pathname.startsWith("/dashboard/settings") ? { background: "rgba(13,75,88,.4)" } : undefined}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {t.nav_settings}
            </Link>

            {tenantSlug && !pathname.startsWith("/dashboard/site-builder") && (
              <a
                href={`/${tenantSlug}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-cyan-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Mon site
              </a>
            )}

            <div className="h-px my-2" style={{ background: "rgba(170,189,216,.1)" }} />

            {/* Tours depuis menu mobile */}
            <MobileTourMenu onStart={() => setMenuOpen(false)} pathname={pathname} />

            <div className="h-px my-2" style={{ background: "rgba(170,189,216,.1)" }} />

            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors w-full"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        </div>
      )}

      {/* Contenu — offset pour la navbar */}
      <div className="pt-14">
        <TrialBanner />
        {children}
      </div>
    </div>
        </Onborda>
      </OnbordaProvider>
      </SubscriptionProvider>
    </TenantProvider>
  );
}
