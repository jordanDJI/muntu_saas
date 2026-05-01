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

  // Site builder — prestations
  getSiteOffers: (siteId: string) => apiFetch<any[]>(`/api/v1/sites/${siteId}/offers`),
  replaceSiteOffers: (siteId: string, offers: object[]) =>
    apiFetch(`/api/v1/sites/${siteId}/offers`, { method: "PUT", body: JSON.stringify(offers) }),

  // Site builder — témoignages
  getSiteTestimonials: (siteId: string) => apiFetch<any[]>(`/api/v1/sites/${siteId}/testimonials`),
  replaceSiteTestimonials: (siteId: string, testimonials: object[]) =>
    apiFetch(`/api/v1/sites/${siteId}/testimonials`, { method: "PUT", body: JSON.stringify(testimonials) }),

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

  // Agents IA — config
  getAgentConfigs: () => apiFetch<any[]>("/api/v1/agents/config"),
  getAgentConfig: (agentType: string) => apiFetch<any>(`/api/v1/agents/config/${agentType}`),
  updateAgentConfig: (agentType: string, body: object) =>
    apiFetch<any>(`/api/v1/agents/config/${agentType}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Agents IA — liens client (Agent 2)
  createAgentLink: (body: { contact_id: string; channel?: string; expiry_days?: number }) =>
    apiFetch<any>("/api/v1/agents/links", { method: "POST", body: JSON.stringify(body) }),
  getAgentLinks: () => apiFetch<any[]>("/api/v1/agents/links"),

  // Agents IA — OCR
  uploadOCRDocument: (contactId: string, file: File, appointmentId?: string) => {
    const form = new FormData();
    form.append("file", file);
    const qs = new URLSearchParams({ contact_id: contactId });
    if (appointmentId) qs.set("appointment_id", appointmentId);
    return apiFetch<any>(`/api/v1/agents/ocr?${qs}`, { method: "POST", body: form, headers: {} });
  },
  getOCRSummaries: (contactId: string) => apiFetch<any[]>(`/api/v1/agents/ocr/${contactId}`),

  // Agents IA — synthèses (Worker 4)
  getAgentSyntheses: (limit = 10) => apiFetch<any[]>(`/api/v1/agents/synthesis?limit=${limit}`),

  // Calendrier — disponibilités
  getAvailability: () => apiFetch<any[]>("/api/v1/calendar/availability"),
  replaceAvailability: (slots: object[]) =>
    apiFetch("/api/v1/calendar/availability", { method: "PUT", body: JSON.stringify(slots) }),

  // Calendrier — blocages
  getBlocked: () => apiFetch<any[]>("/api/v1/calendar/blocked"),
  createBlocked: (body: object) =>
    apiFetch("/api/v1/calendar/blocked", { method: "POST", body: JSON.stringify(body) }),
  deleteBlocked: (id: string) =>
    apiFetch(`/api/v1/calendar/blocked/${id}`, { method: "DELETE" }),

  // Calendrier — contacts (recherche inline)
  searchContacts: (q: string) => apiFetch<any[]>(`/api/v1/calendar/contacts?q=${encodeURIComponent(q)}`),

  // Calendrier — rendez-vous (vue calendrier)
  getCalendarAppointments: (params?: { start?: string; end?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiFetch<any[]>(`/api/v1/calendar/appointments${qs}`);
  },
  createCalendarAppointment: (body: object) =>
    apiFetch("/api/v1/calendar/appointments", { method: "POST", body: JSON.stringify(body) }),

  // Booking public (sans auth)
  getPublicAvailableDays: (tenantSlug: string, year: number, month: number) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/available-days?year=${year}&month=${month}`)
      .then((r) => r.json()) as Promise<number[]>;
  },
  getPublicSlots: (tenantSlug: string, date: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/slots?date=${date}`)
      .then((r) => r.json()) as Promise<any[]>;
  },
  publicBook: (tenantSlug: string, body: object) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      return r.json();
    });
  },
};
