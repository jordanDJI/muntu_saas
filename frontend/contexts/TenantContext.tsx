"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/api";

export type Tenant = { id: string; slug: string; name: string; role: string };

type TenantCtx = {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  switchTenant: (id: string) => void;
  reload: () => Promise<void>;
};

const TenantContext = createContext<TenantCtx>({
  tenants: [],
  activeTenant: null,
  switchTenant: () => {},
  reload: async () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    let data: Tenant[];
    try {
      const res = await fetch(`${API}/api/v1/auth/me/tenants`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }

    setTenants(data);
    const stored = localStorage.getItem("klientys_tenant_id");
    const active = data.find((t) => t.id === stored) ?? data[0] ?? null;
    setActiveTenant(active);
    if (active) localStorage.setItem("klientys_tenant_id", active.id);
  }, []);

  useEffect(() => { load(); }, [load]);

  const switchTenant = (id: string) => {
    const t = tenants.find((t) => t.id === id);
    if (!t) return;
    localStorage.setItem("klientys_tenant_id", id);
    setActiveTenant(t);
    window.location.reload();
  };

  return (
    <TenantContext.Provider value={{ tenants, activeTenant, switchTenant, reload: load }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
