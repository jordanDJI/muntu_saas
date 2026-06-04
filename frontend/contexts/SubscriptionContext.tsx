"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../lib/api";

export type PlanFeatures = {
  max_contacts: number;
  max_team_members: number;
  analytics: boolean;
  analytics_roi: boolean;
  agent_vitrine: boolean;
  agent_support: boolean;
  agent_assistant: boolean;
  embed_widget: boolean;
  custom_css: boolean;
  multi_page_site: boolean;
  multi_tenant: boolean;
  booking: boolean;
  crm: boolean;
};

export type FeatureKey = keyof PlanFeatures;

const ESSENTIEL_FEATURES: PlanFeatures = {
  max_contacts: 100,
  max_team_members: 1,
  analytics: false,
  analytics_roi: false,
  agent_vitrine: true,
  agent_support: false,
  agent_assistant: false,
  embed_widget: false,
  custom_css: false,
  multi_page_site: true,
  multi_tenant: false,
  booking: true,
  crm: true,
};

type SubscriptionCtx = {
  planName: string;
  status: string;
  features: PlanFeatures;
  hasFeature: (key: FeatureKey) => boolean;
  trialDaysLeft: number | null;
  loading: boolean;
};

const SubscriptionContext = createContext<SubscriptionCtx>({
  planName: "Essentiel",
  status: "trial",
  features: ESSENTIEL_FEATURES,
  hasFeature: () => false,
  trialDaysLeft: null,
  loading: true,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [planName, setPlanName] = useState("Essentiel");
  const [status, setStatus] = useState("trial");
  const [features, setFeatures] = useState<PlanFeatures>(ESSENTIEL_FEATURES);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMySubscription()
      .then((data) => {
        setPlanName(data.plan_name ?? "Essentiel");
        setStatus(data.status ?? "trial");
        setFeatures({ ...ESSENTIEL_FEATURES, ...(data.features ?? {}) });
        setTrialDaysLeft(data.trial_days_left ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasFeature = (key: FeatureKey): boolean => {
    const val = features[key];
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0 && val !== 1;
    return false;
  };

  return (
    <SubscriptionContext.Provider value={{ planName, status, features, hasFeature, trialDaysLeft, loading }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
