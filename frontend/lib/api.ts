import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (typeof window !== "undefined") {
    const tenantId = localStorage.getItem("klientys_tenant_id");
    if (tenantId) headers["X-Tenant-Id"] = tenantId;
  }
  return headers;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...headers, ...(options.headers ?? {}) },
    });
  } catch {
    throw new Error(`Serveur inaccessible (${API_URL}). Vérifiez votre connexion ou la configuration du backend.`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = typeof detail === "string" ? detail : `HTTP ${res.status}`;
    throw new Error(msg);
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
  getContactsCount: () => apiFetch<{ count: number }>("/api/v1/leads/contacts/count"),
  getLeads: (params?: { status?: string; audience_type?: string; limit?: number; offset?: number }) => {
    const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined));
    const qs = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered as any).toString() : "";
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
  confirmAppointment: (id: string) => apiFetch<any>(`/api/v1/appointments/${id}/confirm`, { method: "POST" }),
  cancelAppointment: (id: string) => apiFetch<any>(`/api/v1/appointments/${id}/cancel`, { method: "POST" }),

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

  // Upload photo site
  uploadSitePhoto: async (file: File, section: string): Promise<{ url: string }> => {
    const headers = await getAuthHeaders();
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/v1/uploads/photo?section=${encodeURIComponent(section)}`, {
        method: "POST",
        headers,
        body: form,
      });
    } catch {
      throw new Error(`Serveur inaccessible (${API_URL}).`);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

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

  // Agent 3 — chat assistant dashboard
  assistantHistory: () =>
    apiFetch<{ conversation_id: string | null; messages: { role: string; content: string }[] }>("/api/v1/assistant/history"),
  assistantChat: (body: { message: string; conversation_id?: string | null }) =>
    apiFetch<{ reply: string; conversation_id: string }>("/api/v1/assistant/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Telegram — infos bot (username pour les liens)
  getTelegramBotInfo: () =>
    apiFetch<{ username: string; activate_url: string }>("/api/v1/agents/telegram/info"),

  // Telegram — enregistrement webhook
  setupTelegramWebhook: () =>
    apiFetch<{ status: string; webhook_url: string; bot_username: string }>("/api/v1/agents/telegram/setup", {
      method: "POST",
    }),

  // Calendrier — disponibilités
  getAvailability: () => apiFetch<any[]>("/api/v1/calendar/availability"),
  replaceAvailability: (slots: object[]) =>
    apiFetch("/api/v1/calendar/availability", { method: "PUT", body: JSON.stringify(slots) }),

  // Calendrier — blocages
  getBlocked: () => apiFetch<any[]>("/api/v1/calendar/blocked"),
  createBlocked: (body: object) =>
    apiFetch("/api/v1/calendar/blocked", { method: "POST", body: JSON.stringify(body) }),
  updateBlocked: (id: string, body: object) =>
    apiFetch(`/api/v1/calendar/blocked/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
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

  // Membres d'équipe
  getMembers: () => apiFetch<{ members: any[]; pending: any[] }>("/api/v1/members/"),
  getMyRole: () => apiFetch<{ role: string }>("/api/v1/members/me/role"),
  inviteMember: (body: { email: string; role: string }) =>
    apiFetch("/api/v1/members/invite", { method: "POST", body: JSON.stringify(body) }),
  cancelInvite: (inviteId: string) =>
    apiFetch(`/api/v1/members/invite/${inviteId}`, { method: "DELETE" }),
  getInvite: (token: string) =>
    apiFetch<{ email: string; role: string; tenant_name: string }>(`/api/v1/members/invite/${token}`),
  acceptInvite: (token: string) =>
    apiFetch<{ status: string; tenant_id: string }>(`/api/v1/members/invite/${token}/accept`, { method: "POST" }),
  updateMemberRole: (userId: string, role: string) =>
    apiFetch(`/api/v1/members/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  removeMember: (userId: string) =>
    apiFetch(`/api/v1/members/${userId}`, { method: "DELETE" }),

  // Tenant info
  getMyTenant: () => apiFetch<{ id: string; slug: string; name: string }>("/api/v1/auth/me/tenant"),
  getMyTenants: () => apiFetch<{ id: string; slug: string; name: string; role: string }[]>("/api/v1/auth/me/tenants"),
  createTenant: (body: { name: string; slug: string; sector: string; country: string }) =>
    apiFetch<{ id: string; slug: string; name: string }>("/api/v1/tenants/", { method: "POST", body: JSON.stringify(body) }),

  // Subscription / plan
  getMySubscription: () => apiFetch<any>("/api/v1/subscriptions/plan"),

  // Tenant API key
  getTenantApiKey: () => apiFetch<{ api_key: string }>("/api/v1/tenants/api-key"),
  regenerateTenantApiKey: () => apiFetch<{ api_key: string }>("/api/v1/tenants/api-key/regenerate", { method: "POST" }),

  // Users — journal d'activité, export, suppression
  getActivityLog: (limit = 50) => apiFetch<any[]>(`/api/v1/users/activity-log?limit=${limit}`),
  logActivity: (body: { action: string; detail?: string }) =>
    apiFetch("/api/v1/users/log-activity", { method: "POST", body: JSON.stringify(body) }),
  exportData: async (): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/v1/users/export`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klientys-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  deleteAccount: () => apiFetch("/api/v1/users/delete-account", { method: "POST" }),
  getIntegrationsStatus: () => apiFetch<{ stripe: boolean; resend: boolean; gemini: boolean; whatsapp: boolean }>("/api/v1/users/integrations/status"),

  // Analytics
  getAnalyticsSummary: (days = 30) => apiFetch<any>(`/api/v1/analytics/summary?days=${days}`),
  getRoiPotential: (period = "month") => apiFetch<any>(`/api/v1/analytics/roi-potential?period=${period}`),

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
