"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/api";
import { useLanguage } from "../../contexts/LanguageContext";

const NAV_HREFS = [
  { href: "/dashboard",              tKey: "nav_db",       icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> },
  { href: "/dashboard/leads",        tKey: "nav_leads",    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z"/></svg> },
  { href: "/dashboard/appointments", tKey: "nav_appts",    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { href: "/dashboard/site-builder", tKey: "nav_site",      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg> },
  { href: "/dashboard/analytics",    tKey: "nav_analytics", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
  { href: "/dashboard/agents",       tKey: "nav_agents",    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104A9 9 0 0112 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9c0-1.04.177-2.04.5-2.97"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4"/></svg> },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  const NAV = NAV_HREFS.map((n) => ({ ...n, label: t[n.tKey] }));

  useEffect(() => {
    // Fast path: read session from localStorage immediately, no server roundtrip
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
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
    <div data-dash-dark className="min-h-screen bg-gray-50">
      {/* Navbar fixe */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14" style={{ background: "var(--bg-nav)", borderBottom: "1px solid rgba(170,189,216,.1)" }}>
        <div className="max-w-6xl mx-auto h-full px-4 grid grid-cols-3 items-center">

          {/* Colonne gauche — logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="Klientys" className="h-16 w-auto" />
              <span className="font-semibold text-white tracking-wide text-sm" style={{ fontFamily: "Georgia, Palatino, serif", fontStyle: "italic" }}>
                Klientys
              </span>
            </Link>
          </div>

          {/* Colonne centre — liens desktop */}
          <div className="hidden md:flex items-center justify-center gap-0.5">
            {NAV.map((n) => {
              const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "text-white" : "text-slate-300 hover:text-white"
                  }`}
                style={active ? { background: "rgba(13,75,88,.45)" } : undefined}
                >
                  {n.icon}
                  {n.label}
                </Link>
              );
            })}
          </div>

          {/* Colonne droite — lien site + déconnexion / burger */}
          <div className="flex items-center justify-end gap-1">
            {tenantSlug && !pathname.startsWith("/dashboard/site-builder") && (
              <a
                href={`/${tenantSlug}`}
                target="_blank"
                rel="noreferrer"
                title="Voir mon site publié"
                className="hidden md:inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Mon site
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
            <button
              onClick={logout}
              className="hidden md:inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
              {t.nav_logout}
            </button>
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
        <div className="fixed top-14 inset-x-0 z-40 p-3 space-y-1 md:hidden" style={{ background: "var(--bg-nav)", borderBottom: "1px solid rgba(170,189,216,.1)" }}>
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-slate-300 hover:text-white"
                }`}
                style={active ? { background: "rgba(13,75,88,.4)" } : undefined}
              >
                {n.icon}{n.label}
              </Link>
            );
          })}
          <Link
            href="/dashboard/settings"
            onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith("/dashboard/settings") ? "text-white" : "text-slate-300 hover:text-white"}`}
            style={pathname.startsWith("/dashboard/settings") ? { background: "rgba(13,75,88,.4)" } : undefined}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-cyan-300 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Mon site
            </a>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors w-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Déconnexion
          </button>
        </div>
      )}

      {/* Contenu — offset pour la navbar */}
      <div className="pt-14">
        {children}
      </div>
    </div>
  );
}
