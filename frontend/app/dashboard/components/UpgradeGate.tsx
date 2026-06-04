"use client";
import Link from "next/link";
import { useSubscription, type FeatureKey } from "../../../contexts/SubscriptionContext";

const FEATURE_PLAN: Record<string, { label: string; plan: string; desc?: string }> = {
  analytics:       { label: "Analytics comportementaux", plan: "Pro" },
  analytics_roi:   { label: "Potentiel de demande locale", plan: "Pro" },
  agent_support:   { label: "Agent Support Client", plan: "Pro" },
  agent_assistant: { label: "Assistant IA personnel", plan: "Pro" },
  embed_widget:    { label: "Widget embarquable", plan: "Pro", desc: "Intégrez le chatbot IA et le formulaire de réservation sur n'importe quel site existant (WordPress, Wix, Squarespace…) via un simple copier-coller de code." },
  custom_css:      { label: "CSS personnalisé", plan: "Business" },
  multi_page_site: { label: "Site multi-pages", plan: "Pro" },
  multi_tenant:    { label: "Multi-espaces de travail", plan: "Business" },
};

export function UpgradeGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { hasFeature, loading } = useSubscription();

  if (loading) return null;
  if (hasFeature(feature)) return <>{children}</>;

  const info = FEATURE_PLAN[feature as string] ?? { label: String(feature), plan: "Pro" };

  return (
    <div className="bg-white rounded-2xl flex flex-col items-center justify-center text-center gap-4 p-10 min-h-[260px]">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: "rgba(13,75,88,.15)" }}
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
          style={{ color: "var(--l-teal-xl)" }}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--l-teal-xl)" }}>
          Plan {info.plan}
        </p>
        <h3 className="text-lg font-bold" style={{ color: "var(--l-text)" }}>{info.label}</h3>
        <p className="text-sm mt-1" style={{ color: "var(--l-text-2)" }}>
          {info.desc ?? `Passez au plan ${info.plan} pour débloquer cette fonctionnalité.`}
        </p>
      </div>
      <Link
        href="/dashboard/settings?section=abonnement"
        className="l-btn l-btn-primary"
        style={{ textDecoration: "none" }}
      >
        Passer au plan {info.plan}
      </Link>
    </div>
  );
}
