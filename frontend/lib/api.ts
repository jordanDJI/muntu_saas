import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  // getUser() valide la session côté serveur Supabase et rafraîchit si nécessaire
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...headers, ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Sites
  getSites: () => apiFetch<any[]>("/api/v1/sites/"),
  createSite: (body: object) => apiFetch("/api/v1/sites/", { method: "POST", body: JSON.stringify(body) }),
  updateSite: (id: string, body: object) => apiFetch(`/api/v1/sites/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  publishSite: (id: string) => apiFetch(`/api/v1/sites/${id}/publish`, { method: "POST" }),
  unpublishSite: (id: string) => apiFetch(`/api/v1/sites/${id}/unpublish`, { method: "POST" }),

  // Leads
  getLeads: (params?: { status?: string; audience_type?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiFetch<any[]>(`/api/v1/leads/${qs}`);
  },
  updateLead: (id: string, body: object) => apiFetch(`/api/v1/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Appointments
  getAppointments: (params?: { status?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiFetch<any[]>(`/api/v1/appointments/${qs}`);
  },
  createAppointment: (body: object) => apiFetch("/api/v1/appointments/", { method: "POST", body: JSON.stringify(body) }),
  updateAppointment: (id: string, body: object) => apiFetch(`/api/v1/appointments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Subscriptions
  createCheckout: (body: object) => apiFetch("/api/v1/subscriptions/checkout", { method: "POST", body: JSON.stringify(body) }),
};
