"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SupportLevel = "viewer" | "support" | "super_admin";

function getUserLevel(user: any): SupportLevel | null {
  if (!user) return null;
  if (user.app_metadata?.is_super_admin) return "super_admin";
  const role = user.app_metadata?.support_role;
  if (role === "viewer" || role === "support") return role;
  return null;
}

const ROLE_LABELS: Record<SupportLevel, string> = {
  viewer:      "Observateur",
  support:     "Support",
  super_admin: "Super Admin",
};

const NAV_ALL = [
  {
    href: "/admin",
    label: "Métriques",
    minLevel: "viewer" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "billing",
    href: "/admin/billing",
    label: "Facturation",
    minLevel: "super_admin" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/tenants",
    label: "Tenants",
    minLevel: "viewer" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/log",
    label: "Log",
    minLevel: "viewer" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    minLevel: "super_admin" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: "relances",
    href: "/admin/relances",
    label: "Relances",
    minLevel: "viewer" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: "/admin/support",
    label: "Support",
    minLevel: "super_admin" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    id: "logo-requests",
    href: "/admin/logo-requests",
    label: "Logos",
    minLevel: "support" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    id: "design-requests",
    href: "/admin/design-requests",
    label: "Design",
    minLevel: "support" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/config",
    label: "Config",
    minLevel: "super_admin" as SupportLevel,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const LEVEL_ORDER: Record<SupportLevel, number> = { viewer: 1, support: 2, super_admin: 3 };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready,         setReady]         = useState(false);
  const [userLevel,     setUserLevel]     = useState<SupportLevel | null>(null);
  const [inactiveCount,  setInactiveCount]  = useState<number | null>(null);
  const [logoPending,    setLogoPending]    = useState<number | null>(null);
  const [designPending,  setDesignPending]  = useState<number | null>(null);
  const [pastDueCount,   setPastDueCount]   = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const level = getUserLevel(user);
      if (!level) {
        router.replace("/dashboard");
        return;
      }
      setUserLevel(level);
      setReady(true);

      // Badges sidebar — non bloquant
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token ?? ""}` };

        const [inactiveRes, metricsRes, billingRes] = await Promise.allSettled([
          fetch(`${API}/api/v1/admin/inactive-tenants?days=30`, { headers }),
          fetch(`${API}/api/v1/admin/metrics`, { headers }),
          fetch(`${API}/api/v1/admin/billing`, { headers }),
        ]);

        if (inactiveRes.status === "fulfilled" && inactiveRes.value.ok) {
          const d = await inactiveRes.value.json();
          setInactiveCount(Array.isArray(d) ? d.length : 0);
        }
        if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
          const d = await metricsRes.value.json();
          setLogoPending(d.logo_requests_pending ?? 0);
          setDesignPending(d.design_requests_pending ?? 0);
        }
        if (billingRes.status === "fulfilled" && billingRes.value.ok) {
          const d = await billingRes.value.json();
          setPastDueCount(d.past_due_count ?? 0);
        }
      } catch { /* non bloquant */ }
    });
  }, [router]);

  const nav = NAV_ALL.filter((item) =>
    userLevel && LEVEL_ORDER[userLevel] >= LEVEL_ORDER[item.minLevel]
  );

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#071824" }}>
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid rgba(170,189,216,0.2)", borderTopColor: "#1A6E82" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#071824", color: "#EEF2F5" }}>
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col" style={{ background: "#07222F", borderRight: "1px solid rgba(170,189,216,0.08)" }}>

        {/* Brand */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(170,189,216,0.08)" }}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold tracking-wide" style={{ color: "#DDAA40" }}>Klientys</span>
          </div>
          <p className="text-[10px]" style={{ color: "rgba(170,189,216,0.45)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {userLevel === "super_admin" ? "Admin panel" : "Support panel"}
          </p>
          {userLevel && userLevel !== "super_admin" && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium"
              style={{ background: "rgba(221,170,64,0.12)", color: "#DDAA40", border: "1px solid rgba(221,170,64,0.25)" }}>
              {ROLE_LABELS[userLevel]}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const itemId = (item as any).id;
            const badge  =
              itemId === "relances"        && inactiveCount  ? inactiveCount  :
              itemId === "logo-requests"   && logoPending    ? logoPending    :
              itemId === "design-requests" && designPending  ? designPending  :
              itemId === "billing"         && pastDueCount   ? pastDueCount   : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={active ? {
                  background: "rgba(13,75,88,0.45)",
                  color: "#7DD8E8",
                  borderLeft: "2px solid #1A6E82",
                  paddingLeft: "10px",
                } : {
                  color: "rgba(170,189,216,0.55)",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "#AABDD8"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(170,189,216,0.55)"; }}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                    style={{ background: "rgba(224,96,96,0.18)", color: "#E06060" }}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 space-y-0.5" style={{ borderTop: "1px solid rgba(170,189,216,0.08)" }}>
          {userLevel === "super_admin" && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
              style={{ color: "rgba(170,189,216,0.35)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(170,189,216,0.7)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(170,189,216,0.35)"; }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard tenant
            </Link>
          )}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace("/login");
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ color: "rgba(170,189,216,0.35)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(224,96,96,0.7)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(170,189,216,0.35)"; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
