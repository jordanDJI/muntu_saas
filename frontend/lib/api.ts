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
    throw new Error("Service temporairement indisponible. Veuillez réessayer dans quelques instants.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    if (res.status === 403 && typeof detail === "string") {
      if (typeof window !== "undefined") {
        // Stale X-Tenant-Id — clear it so subsequent calls use JWT fallback
        if (detail.includes("Accès refusé à ce tenant")) {
          localStorage.removeItem("klientys_tenant_id");
        }
        // No tenant at all — redirect to onboarding to complete setup
        if (detail.includes("Aucun tenant associé") && window.location.pathname.startsWith("/dashboard")) {
          window.location.replace("/onboarding?no_tenant=1");
          return new Promise(() => {}); // never resolves — page is navigating away
        }
      }
    }
    const msg = typeof detail === "string" ? detail : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (res.status === 204) return null as T;
  const ct = res.headers.get("content-type");
  if (!ct?.includes("application/json")) return null as T;
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

  // Design requests
  createDesignRequest: (body: { message: string; is_additional: boolean; site_id?: string }) =>
    apiFetch("/api/v1/design-requests/", { method: "POST", body: JSON.stringify(body) }),
  getMyDesignRequests: () => apiFetch<any[]>("/api/v1/design-requests/mine"),
  adminGetDesignRequests: (status?: string) =>
    apiFetch<any[]>(`/api/v1/admin/design-requests${status ? `?status=${status}` : ""}`),
  adminUpdateDesignRequest: (id: string, body: { status?: string; admin_notes?: string }) =>
    apiFetch(`/api/v1/admin/design-requests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Logo requests
  logoChat: (messages: { role: string; content: string }[], lang: string) =>
    apiFetch<any>("/api/v1/logo-requests/chat", { method: "POST", body: JSON.stringify({ messages, lang }) }),
  createLogoRequest: (body: { brief: object; chat_history: object[]; price_tier: string }) =>
    apiFetch<any>("/api/v1/logo-requests/", { method: "POST", body: JSON.stringify(body) }),
  logoCheckout: (requestId: string, successUrl: string, cancelUrl: string) =>
    apiFetch<{ checkout_url: string }>(`/api/v1/logo-requests/${requestId}/checkout`, {
      method: "POST",
      body: JSON.stringify({ success_url: successUrl, cancel_url: cancelUrl }),
    }),
  getMyLogoRequests: () => apiFetch<any[]>("/api/v1/logo-requests/mine"),
  adminGetLogoRequests: (status?: string) =>
    apiFetch<any[]>(`/api/v1/logo-requests/admin/all${status ? `?status=${status}` : ""}`),
  adminUpdateLogoRequest: (id: string, body: { status?: string; admin_notes?: string }) =>
    apiFetch(`/api/v1/logo-requests/admin/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Leads
  getContactsCount: () => apiFetch<{ count: number }>("/api/v1/leads/contacts/count"),
  getLeads: (params?: { status?: string; audience_type?: string; limit?: number; offset?: number }) => {
    const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined));
    const qs = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered as any).toString() : "";
    return apiFetch<any[]>(`/api/v1/leads/${qs}`);
  },
  updateLead: (id: string, body: object) => apiFetch(`/api/v1/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Appointments
  getAppointments: (params?: { status?: string; contact_id?: string; future_only?: boolean }) => {
    const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== false));
    const qs = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered as any).toString() : "";
    return apiFetch<any[]>(`/api/v1/appointments/${qs}`);
  },
  createAppointment: (body: object) => apiFetch("/api/v1/appointments/", { method: "POST", body: JSON.stringify(body) }),
  updateAppointment: (id: string, body: object) => apiFetch(`/api/v1/appointments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  confirmAppointment: (id: string) => apiFetch<any>(`/api/v1/appointments/${id}/confirm`, { method: "POST" }),
  cancelAppointment: (id: string) => apiFetch<any>(`/api/v1/appointments/${id}/cancel`, { method: "POST" }),

  // Subscriptions
  getPlans: () => apiFetch<{ id: string; name: string; price_monthly: number; stripe_price_id: string }[]>("/api/v1/subscriptions/plans"),
  createCheckout: (body: object) => apiFetch<{ checkout_url: string }>("/api/v1/subscriptions/checkout", { method: "POST", body: JSON.stringify(body) }),
  billingPortal: () => apiFetch<{ url: string }>("/api/v1/subscriptions/billing-portal", { method: "POST" }),

  // Agents IA — config
  getAgentConfigs: () => apiFetch<any[]>("/api/v1/agents/config"),
  getAgentConfig: (agentType: string) => apiFetch<any>(`/api/v1/agents/config/${agentType}`),
  updateAgentConfig: (agentType: string, body: object) =>
    apiFetch<any>(`/api/v1/agents/config/${agentType}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Agents IA — liens client (Agent 2)
  createAgentLink: (body: { contact_id: string; channel?: string; expiry_days?: number }) =>
    apiFetch<any>("/api/v1/agents/links", { method: "POST", body: JSON.stringify(body) }),
  getAgentLinks: () => apiFetch<any[]>("/api/v1/agents/links"),

  // Agents IA — RAG (base documentaire, Wave 3)
  ragDocuments: () => apiFetch<{ filename: string; chunk_count: number }[]>("/api/v1/agents/rag/documents"),
  ragUpload: async (file: File): Promise<void> => {
    const headers = await getAuthHeaders();
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/v1/agents/rag/upload`, { method: "POST", headers, body: form });
    } catch {
      throw new Error("Impossible d'envoyer le fichier. Vérifiez votre connexion et réessayez.");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
  },
  ragDeleteDocument: (filename: string) =>
    apiFetch<void>(`/api/v1/agents/rag/documents?filename=${encodeURIComponent(filename)}`, { method: "DELETE" }),

  // Agents IA — suivi post-RDV (Wave 3)
  sendFollowup: (apptId: string) =>
    apiFetch<{ sent: boolean; channel: string }>(`/api/v1/agents/followup/${apptId}`, { method: "POST" }),

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
      throw new Error("Impossible d'envoyer le fichier. Vérifiez votre connexion et réessayez.");
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
  getMyPermissions: () => apiFetch<{ role: string; permissions: string[] }>("/api/v1/members/me/permissions"),
  inviteMember: (body: { email: string; role: string; permissions?: string[] }) =>
    apiFetch("/api/v1/members/invite", { method: "POST", body: JSON.stringify(body) }),
  cancelInvite: (inviteId: string) =>
    apiFetch(`/api/v1/members/invite/${inviteId}`, { method: "DELETE" }),
  getInvite: (token: string) =>
    apiFetch<{ email: string; role: string; tenant_name: string }>(`/api/v1/members/invite/${token}`),
  acceptInvite: (token: string) =>
    apiFetch<{ status: string; tenant_id: string }>(`/api/v1/members/invite/${token}/accept`, { method: "POST" }),
  signupViaInvite: (token: string, password: string) =>
    apiFetch<{ status: string; email: string }>(`/api/v1/members/invite/${token}/signup`, { method: "POST", body: JSON.stringify({ password }) }),
  updateMemberRole: (userId: string, role: string) =>
    apiFetch(`/api/v1/members/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  updateMemberPermissions: (userId: string, permissions: string[]) =>
    apiFetch(`/api/v1/members/${userId}/permissions`, { method: "PATCH", body: JSON.stringify({ permissions }) }),
  removeMember: (userId: string) =>
    apiFetch(`/api/v1/members/${userId}`, { method: "DELETE" }),

  // Tenant info
  getMyTenant: () => apiFetch<{ id: string; slug: string; name: string; sector?: string; country?: string }>("/api/v1/auth/me/tenant"),
  getMyTenants: () => apiFetch<{ id: string; slug: string; name: string; role: string }[]>("/api/v1/auth/me/tenants"),
  createTenant: (body: { name: string; slug: string; sector: string; country: string }) =>
    apiFetch<{ id: string; slug: string; name: string }>("/api/v1/tenants/", { method: "POST", body: JSON.stringify(body) }),

  // Subscription / plan
  getMySubscription: () => apiFetch<any>("/api/v1/subscriptions/plan"),

  // Tenant API key
  getTenantApiKey: () => apiFetch<{ api_key: string }>("/api/v1/tenants/api-key"),
  regenerateTenantApiKey: () => apiFetch<{ api_key: string }>("/api/v1/tenants/api-key/regenerate", { method: "POST" }),

  // Users — journal d'activité, export, suppression
  getActivityLog: (limit = 10, offset = 0) => apiFetch<any[]>(`/api/v1/users/activity-log?limit=${limit}&offset=${offset}`),
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

  // Complétion du profil
  getProfileCompletion: () => apiFetch<{ score: number; steps: { key: string; done: boolean; link: string }[] }>("/api/v1/profile/completion"),

  // Secrétariat (Business) — vue unifiée multi-tenant
  getSecretaryAppointments: (date: string, view: "day" | "week" | "month" = "day") =>
    apiFetch<any[]>(`/api/v1/secretary/appointments?date=${date}&view=${view}`),
  updateSecretaryAppointment: (id: string, body: { status?: string; notes?: string }) =>
    apiFetch<any>(`/api/v1/secretary/appointments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  getSecretarySites: () =>
    apiFetch<{ tenant_id: string; tenant_name: string; tenant_slug: string; site_title: string | null; site_status: string | null }[]>("/api/v1/secretary/sites"),
  getSecretaryActivityLog: (limit = 20, offset = 0) =>
    apiFetch<any[]>(`/api/v1/secretary/activity-log?limit=${limit}&offset=${offset}`),

  // Analytics
  getAnalyticsSummary: (days = 30) => apiFetch<any>(`/api/v1/analytics/summary?days=${days}`),
  getRoiPotential: (period = "month") => apiFetch<any>(`/api/v1/analytics/roi-potential?period=${period}`),
  downloadAnalyticsReport: async (days = 30): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/v1/analytics/report.pdf?days=${days}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-analytics-${days}j.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Google Analytics (GA4)
  getGoogleAnalyticsStatus: () => apiFetch<{ connected: boolean; property_configured: boolean; ga4_property_id: string | null; connected_at: string | null }>("/api/v1/analytics/google/status"),
  getGoogleAnalyticsAuthUrl: () => apiFetch<{ url: string }>("/api/v1/analytics/google/auth-url"),
  getGoogleAnalyticsProperties: () => apiFetch<{ properties: { id: string; name: string; account: string }[] }>("/api/v1/analytics/google/properties"),
  configureGoogleAnalytics: (ga4_property_id: string) => apiFetch("/api/v1/analytics/google/configure", { method: "PATCH", body: JSON.stringify({ ga4_property_id }) }),
  getGoogleAnalyticsData: (days = 30) => apiFetch<{ rows: any[]; property_id: string }>(`/api/v1/analytics/google/data?days=${days}`),

  // Domaines personnalisés
  getDomain: () => apiFetch<any>("/api/v1/domains/my"),
  connectDomain: (domain: string) =>
    apiFetch<any>("/api/v1/domains/connect", { method: "POST", body: JSON.stringify({ domain }) }),
  pollDomainStatus: () => apiFetch<any>("/api/v1/domains/status"),
  deleteDomain: () => apiFetch<any>("/api/v1/domains/my", { method: "DELETE" }),
  searchDomains: (query: string) =>
    apiFetch<any[]>(`/api/v1/domains/search?query=${encodeURIComponent(query)}`),
  createDomainPurchaseCheckout: (
    domain: string,
    autoRenew: boolean,
    successUrl: string,
    cancelUrl: string,
  ) =>
    apiFetch<{ checkout_url: string }>("/api/v1/domains/purchase", {
      method: "POST",
      body: JSON.stringify({
        domain,
        auto_renew: autoRenew,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    }),
  createDomainAddonCheckout: (successUrl: string, cancelUrl: string) =>
    apiFetch<{ checkout_url: string }>("/api/v1/domains/addon/checkout", {
      method: "POST",
      body: JSON.stringify({ success_url: successUrl, cancel_url: cancelUrl }),
    }),

  // Annuaire public
  getDirectoryListing: () => apiFetch<any>("/api/v1/directory/my-listing"),
  directoryOptIn: (body: object) => apiFetch("/api/v1/directory/opt-in", { method: "POST", body: JSON.stringify(body) }),
  directoryOptOut: () => apiFetch("/api/v1/directory/opt-out", { method: "DELETE" }),

  // CRM — Contacts enrichis
  getContacts: (params?: { q?: string; tag_id?: string; inactive_only?: boolean; limit?: number; offset?: number }) => {
    const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null));
    const qs = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered as any).toString() : "";
    return apiFetch<{ contacts: any[]; total: number; offset: number; limit: number }>(`/api/v1/contacts/${qs}`);
  },
  getContact: (id: string) => apiFetch<any>(`/api/v1/contacts/${id}`),
  updateContact: (id: string, body: { notes?: string; first_name?: string; last_name?: string; email?: string; phone?: string }) =>
    apiFetch<any>(`/api/v1/contacts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  importContactsCsv: async (file: File): Promise<{ created: number; skipped: number; errors: string[] }> => {
    const headers = await getAuthHeaders();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/contacts/import`, { method: "POST", headers, body: form });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail ?? `HTTP ${res.status}`); }
    return res.json();
  },

  // CRM — Tags
  getTags: () => apiFetch<any[]>("/api/v1/tags"),
  createTag: (body: { name: string; color: string }) =>
    apiFetch<any>("/api/v1/tags", { method: "POST", body: JSON.stringify(body) }),
  updateTag: (id: string, body: { name?: string; color?: string }) =>
    apiFetch<any>(`/api/v1/tags/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTag: (id: string) => apiFetch(`/api/v1/tags/${id}`, { method: "DELETE" }),
  addTagToContact: (contactId: string, tagId: string) =>
    apiFetch<any>(`/api/v1/contacts/${contactId}/tags/${tagId}`, { method: "POST" }),
  removeTagFromContact: (contactId: string, tagId: string) =>
    apiFetch(`/api/v1/contacts/${contactId}/tags/${tagId}`, { method: "DELETE" }),

  // CRM — Relances
  getReminders: (params?: { contact_id?: string; done?: boolean; upcoming_only?: boolean }) => {
    const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined));
    const qs = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered as any).toString() : "";
    return apiFetch<any[]>(`/api/v1/reminders/${qs}`);
  },
  createReminder: (body: { contact_id: string; due_date: string; note?: string; reminder_type?: string; auto_send?: boolean }) =>
    apiFetch<any>("/api/v1/reminders/", { method: "POST", body: JSON.stringify(body) }),
  updateReminder: (id: string, body: { due_date?: string; note?: string; done?: boolean; reminder_type?: string; auto_send?: boolean }) =>
    apiFetch<any>(`/api/v1/reminders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteReminder: (id: string) => apiFetch(`/api/v1/reminders/${id}`, { method: "DELETE" }),
  getReminderPreview: (id: string) =>
    apiFetch<{ subject: string; body: string; contact_email: string; contact_name: string }>(
      `/api/v1/reminders/${id}/preview`
    ),
  sendReminder: (id: string, opts?: { subject_override?: string; message_override?: string }) =>
    apiFetch<{ sent: boolean; sent_at: string }>(`/api/v1/reminders/${id}/send`, {
      method: "POST",
      body: JSON.stringify(opts ?? {}),
    }),

  // CRM — Export CSV (téléchargement direct)
  exportContactsCsv: async (): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/v1/contacts/export`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  },

  // CRM — Activités (timeline)
  getActivities: (contactId: string) =>
    apiFetch<any[]>(`/api/v1/contacts/${contactId}/activities`),
  createActivity: (contactId: string, body: { type: string; content: string }) =>
    apiFetch<any>(`/api/v1/contacts/${contactId}/activities`, { method: "POST", body: JSON.stringify(body) }),
  deleteActivity: (contactId: string, activityId: string) =>
    apiFetch(`/api/v1/contacts/${contactId}/activities/${activityId}`, { method: "DELETE" }),

  // Pièces jointes par contact
  listAttachments: (contactId: string) =>
    apiFetch<any[]>(`/api/v1/contacts/${contactId}/attachments`),
  uploadAttachment: async (contactId: string, file: File) => {
    const headers = await getAuthHeaders();
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/v1/contacts/${contactId}/attachments`, {
        method: "POST",
        headers,
        body: form,
      });
    } catch {
      throw new Error("Service temporairement indisponible.");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
  deleteAttachment: (contactId: string, attachmentId: string) =>
    apiFetch(`/api/v1/contacts/${contactId}/attachments/${attachmentId}`, { method: "DELETE" }),

  // Campagnes email
  getCampaigns: () => apiFetch<any[]>("/api/v1/campaigns/"),
  getCampaignPreview: (segment: string, tagId?: string) => {
    const qs = new URLSearchParams({ segment });
    if (tagId) qs.set("tag_id", tagId);
    return apiFetch<{ count: number }>(`/api/v1/campaigns/preview?${qs}`);
  },
  sendCampaign: (body: { name: string; subject: string; body: string; segment: string; tag_id?: string }) =>
    apiFetch<any>("/api/v1/campaigns/", { method: "POST", body: JSON.stringify(body) }),

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

  // PayPal public endpoints (no auth)
  publicCreatePaypalOrder: (tenantSlug: string, body: object) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/paypal-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      return r.json() as Promise<{ order_id: string; approve_url: string }>;
    });
  },
  publicCapturePaypalAndBook: (tenantSlug: string, body: object) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return fetch(`${apiUrl}/api/v1/booking/${tenantSlug}/paypal-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail ?? `HTTP ${r.status}`); }
      return r.json();
    });
  },

  // Booking config (questions + dépôt PayPal) — tenant authentifié
  getBookingConfig: (siteId: string) =>
    apiFetch<{ booking_questions: any[]; deposit: any; paypal_configured: boolean }>(`/api/v1/sites/${siteId}/booking-config`),
  updateBookingConfig: (siteId: string, body: object) =>
    apiFetch(`/api/v1/sites/${siteId}/booking-config`, { method: "PATCH", body: JSON.stringify(body) }),

  // Facturation électronique
  getInvoiceSettings: () => apiFetch<any>("/api/v1/invoices/settings"),
  updateInvoiceSettings: (body: object) => apiFetch("/api/v1/invoices/settings", { method: "PATCH", body: JSON.stringify(body) }),
  getInvoices: (params?: { status?: string; contact_id?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) as any).toString() : "";
    return apiFetch<{ invoices: any[]; total: number; offset: number; limit: number }>(`/api/v1/invoices/${qs}`);
  },
  createInvoice: (body: object) => apiFetch<any>("/api/v1/invoices/", { method: "POST", body: JSON.stringify(body) }),
  getInvoice: (id: string) => apiFetch<any>(`/api/v1/invoices/${id}`),
  updateInvoice: (id: string, body: object) => apiFetch<any>(`/api/v1/invoices/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteInvoice: (id: string) => apiFetch<void>(`/api/v1/invoices/${id}`, { method: "DELETE" }),
  invoiceFromAppointment: (apptId: string) => apiFetch<any>(`/api/v1/invoices/from-appointment/${apptId}`, { method: "POST" }),
  generateInvoiceFiles: (id: string) => apiFetch<any>(`/api/v1/invoices/${id}/generate`, { method: "POST" }),
  sendInvoice: (id: string) => apiFetch<any>(`/api/v1/invoices/${id}/send`, { method: "POST" }),
  markInvoicePaid: (id: string) => apiFetch<any>(`/api/v1/invoices/${id}/mark-paid`, { method: "POST" }),
  cancelInvoice: (id: string) => apiFetch<any>(`/api/v1/invoices/${id}/cancel`, { method: "POST" }),
  downloadInvoicePdf: async (id: string, number: string) => {
    const headers = await getAuthHeaders();
    const r = await fetch(`${API_URL}/api/v1/invoices/${id}/pdf`, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${number}.pdf`; a.click();
    URL.revokeObjectURL(url);
  },
  downloadInvoiceUbl: async (id: string, number: string) => {
    const headers = await getAuthHeaders();
    const r = await fetch(`${API_URL}/api/v1/invoices/${id}/ubl`, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${number}.ubl.xml`; a.click();
    URL.revokeObjectURL(url);
  },

  // ── Support interne ────────────────────────────────────────────────────────
  createSupportTicket: (body: { subject: string; body: string; priority?: string }) =>
    apiFetch<any>("/api/v1/support/tickets", { method: "POST", body: JSON.stringify(body) }),
  listSupportTickets: () => apiFetch<any[]>("/api/v1/support/tickets"),
  getSupportTicket: (id: string) => apiFetch<any>(`/api/v1/support/tickets/${id}`),
  replySupportTicket: (id: string, body: string) =>
    apiFetch<any>(`/api/v1/support/tickets/${id}/reply`, { method: "POST", body: JSON.stringify({ body }) }),

  // ── Web Push ───────────────────────────────────────────────────────────────
  getVapidPublicKey: () => apiFetch<{ public_key: string }>("/api/v1/push/vapid-public-key"),
  subscribePush: (subscription: object) =>
    apiFetch<any>("/api/v1/push/subscribe", { method: "POST", body: JSON.stringify({ subscription }) }),
  unsubscribePush: () => apiFetch<any>("/api/v1/push/subscribe", { method: "DELETE" }),
  subscribeContactPush: (contact_id: string, tenant_id: string, subscription: object) =>
    fetch(`${API_URL}/api/v1/push/subscribe/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id, tenant_id, subscription }),
    }),

  // ── Admin support ──────────────────────────────────────────────────────────
  adminListSupportTickets: (status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return apiFetch<any[]>(`/api/v1/admin/support/tickets${qs}`);
  },
  adminGetSupportTicket: (id: string) => apiFetch<any>(`/api/v1/admin/support/tickets/${id}`),
  adminReplySupportTicket: (id: string, body: string) =>
    apiFetch<any>(`/api/v1/admin/support/tickets/${id}/reply`, { method: "POST", body: JSON.stringify({ body }) }),
  adminUpdateSupportTicket: (id: string, status: string) =>
    apiFetch<any>(`/api/v1/admin/support/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
