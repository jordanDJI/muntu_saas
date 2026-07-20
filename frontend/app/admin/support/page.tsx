"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  card: "#0D1B25", card2: "#0A1520", border: "rgba(170,189,216,0.10)",
  teal: "#0D4B58", tealL: "#1A6E82", tealXL: "#2A8FA5",
  gold: "#DDAA40", text: "#EEF2F5", muted: "#8BA5B0",
  danger: "#E06060", success: "#4ACA7A", blue: "#AABDD8",
};

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Tickets support ───────────────────────────────────────────────────────────

const TICKET_STATUS_STYLES: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: "En attente",   bg: "rgba(13,75,88,0.25)",    color: K.tealXL, border: "rgba(42,143,165,0.4)" },
  in_progress: { label: "En cours",     bg: "rgba(221,170,64,0.15)",  color: K.gold,   border: "rgba(221,170,64,0.4)" },
  resolved:    { label: "Résolu",       bg: "rgba(74,202,122,0.12)",  color: K.success, border: "rgba(74,202,122,0.3)" },
  closed:      { label: "Fermé",        bg: "rgba(170,189,216,0.07)", color: K.muted,  border: "rgba(170,189,216,0.2)" },
};

function TicketsTab({ initialTicketId }: { initialTicketId: string | null }) {
  const [tickets,  setTickets]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply,    setReply]    = useState("");
  const [replying, setReplying] = useState(false);
  const [toast,    setToast]    = useState("");
  const [toastOk,  setToastOk]  = useState(true);

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3500);
  };

  const loadTickets = async (status?: string) => {
    setLoading(true);
    try {
      const qs = (status && status !== "all") ? `?status=${status}` : "";
      const data = await adminFetch<any[]>(`/api/v1/admin/support/tickets${qs}`);
      setTickets(data);
      if (initialTicketId) {
        const t = data.find(x => x.id === initialTicketId);
        if (t) openTicket(t);
      }
    } catch (e: any) { showToast(e.message, false); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTickets(); }, []);

  const openTicket = async (ticket: any) => {
    setSelected(ticket); setMsgLoading(true);
    try {
      const full = await adminFetch<any>(`/api/v1/admin/support/tickets/${ticket.id}`);
      setMessages(full.messages || []);
    } catch {} finally { setMsgLoading(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setReplying(true);
    try {
      await adminFetch(`/api/v1/admin/support/tickets/${selected.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim() }),
      });
      const full = await adminFetch<any>(`/api/v1/admin/support/tickets/${selected.id}`);
      setMessages(full.messages || []);
      setReply("");
      showToast("Réponse envoyée ✓");
      setTickets(prev => prev.map(t => t.id === selected.id
        ? { ...t, status: "in_progress", updated_at: new Date().toISOString() } : t));
    } catch (e: any) { showToast(e.message, false); }
    finally { setReplying(false); }
  };

  const updateStatus = async (ticketId: string, status: string) => {
    try {
      await adminFetch(`/api/v1/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast("Statut mis à jour ✓");
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status, updated_at: new Date().toISOString() } : t));
      if (selected?.id === ticketId) setSelected((s: any) => s ? { ...s, status } : null);
    } catch (e: any) { showToast(e.message, false); }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const FILTERS = [
    { key: "all", label: "Tous" },
    { key: "open", label: "En attente" },
    { key: "in_progress", label: "En cours" },
    { key: "resolved", label: "Résolus" },
  ];

  const displayed = filter === "all" ? tickets : tickets.filter(t => t.status === filter);

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.4fr" : "1fr", gap: "16px", minHeight: "60vh" }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-sm px-4 py-2 rounded-lg shadow-lg"
          style={{ background: toastOk ? K.teal : "#7A1A1A", color: "#fff", border: `1px solid ${toastOk ? K.tealL : K.danger}` }}>
          {toast}
        </div>
      )}

      {/* Liste tickets */}
      <div className="rounded-xl overflow-hidden" style={{ background: K.card, border: `1px solid ${K.border}`, height: "fit-content" }}>
        {/* Filtres */}
        <div className="flex gap-1 p-3" style={{ borderBottom: `1px solid ${K.border}` }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); loadTickets(f.key === "all" ? undefined : f.key); }}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: filter === f.key ? "rgba(13,75,88,0.4)" : "transparent",
                color: filter === f.key ? K.tealXL : K.muted,
                border: `1px solid ${filter === f.key ? "rgba(42,143,165,0.4)" : "transparent"}`,
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid rgba(170,189,216,0.2)`, borderTopColor: K.tealL }} />
          </div>
        ) : displayed.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: "rgba(170,189,216,0.3)" }}>Aucun ticket</p>
        ) : (
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {displayed.map(ticket => {
              const st = TICKET_STATUS_STYLES[ticket.status] || TICKET_STATUS_STYLES.open;
              return (
                <button key={ticket.id} onClick={() => openTicket(ticket)}
                  className="w-full text-left px-4 py-3.5 transition-colors"
                  style={{
                    background: selected?.id === ticket.id ? "rgba(13,75,88,0.2)" : "transparent",
                    borderBottom: `1px solid ${K.border}`,
                  }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate" style={{ color: K.text }}>{ticket.subject}</p>
                    <span className="text-xs font-semibold rounded px-2 py-0.5 shrink-0"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs" style={{ color: K.muted }}>
                      {ticket.tenant?.name || "Tenant inconnu"}
                    </p>
                    <span style={{ color: "rgba(170,189,216,0.3)" }}>·</span>
                    <p className="text-xs" style={{ color: "rgba(170,189,216,0.4)" }}>{fmtDate(ticket.updated_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Détail ticket */}
      {selected && (
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: K.card, border: `1px solid ${K.border}` }}>
          {/* Header ticket */}
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${K.border}` }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-base" style={{ color: K.text }}>{selected.subject}</h3>
              <button onClick={() => setSelected(null)} className="text-lg leading-none" style={{ color: K.muted }}>×</button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs" style={{ color: K.muted }}>{selected.tenant?.name}</span>
              {/* Sélecteur statut */}
              <select
                value={selected.status}
                onChange={e => updateStatus(selected.id, e.target.value)}
                className="text-xs rounded px-2 py-1 focus:outline-none"
                style={{ background: K.card2, color: K.tealXL, border: `1px solid rgba(42,143,165,0.3)` }}>
                {Object.entries(TICKET_STATUS_STYLES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto" style={{ maxHeight: "50vh" }}>
            {msgLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-4 h-4 rounded-full animate-spin" style={{ border: `2px solid rgba(170,189,216,0.2)`, borderTopColor: K.tealL }} />
              </div>
            ) : messages.map(msg => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.sender === "admin" ? "flex-row-reverse" : ""}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: msg.sender === "admin" ? "rgba(221,170,64,0.2)" : "rgba(13,75,88,0.3)", color: msg.sender === "admin" ? K.gold : K.tealXL }}>
                  {msg.sender === "admin" ? "K" : "T"}
                </div>
                <div className="max-w-[78%] rounded-xl px-3.5 py-2.5"
                  style={{ background: msg.sender === "admin" ? "rgba(221,170,64,0.08)" : "rgba(13,75,88,0.25)", border: `1px solid ${msg.sender === "admin" ? "rgba(221,170,64,0.15)" : "rgba(42,143,165,0.2)"}` }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: msg.sender === "admin" ? K.gold : K.tealXL }}>
                    {msg.sender === "admin" ? "Équipe Klientys" : "Tenant"}
                  </p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: K.text }}>{msg.body}</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(170,189,216,0.4)" }}>{fmtDate(msg.created_at)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Champ réponse */}
          {!["resolved", "closed"].includes(selected.status) && (
            <div className="p-4" style={{ borderTop: `1px solid ${K.border}` }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Votre réponse au tenant…"
                rows={4}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none mb-3"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.15)`, color: K.text }}
              />
              <button
                onClick={sendReply}
                disabled={replying || !reply.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                style={{ background: "rgba(13,75,88,0.5)", color: K.tealXL, border: "1px solid rgba(42,143,165,0.4)" }}>
                {replying ? "Envoi…" : "Répondre →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Comptes support ───────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; perms: string[] }> = {
  viewer: {
    label: "Observateur", color: K.blue, bg: "rgba(170,189,216,0.08)", border: "rgba(170,189,216,0.2)",
    perms: ["Consulter la liste et le détail des tenants", "Lire les logs d'actions admin", "Consulter les métriques globales"],
  },
  support: {
    label: "Support opérationnel", color: K.tealXL, bg: "rgba(13,75,88,0.18)", border: "rgba(42,143,165,0.3)",
    perms: ["Tout ce que peut faire Observateur", "Confirmer l'email d'un tenant", "Prolonger la période d'essai", "Resynchroniser Stripe"],
  },
};

function AccountsTab() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState("");
  const [toastOk,  setToastOk]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole,  setNewRole]  = useState<"viewer"|"support">("support");
  const [busy,     setBusy]     = useState(false);
  const [roleChange, setRoleChange] = useState<Record<string, string>>({});

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch<any[]>("/api/v1/admin/support-accounts");
      setAccounts(data);
    } catch (e: any) { showToast(e.message, false); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newEmail.trim()) return;
    setBusy(true);
    try {
      await adminFetch("/api/v1/admin/support-accounts", { method: "POST", body: JSON.stringify({ email: newEmail.trim(), role: newRole }) });
      showToast("Compte créé ✓"); setModal(false); setNewEmail(""); setNewRole("support");
      await load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const changeRole = async (id: string, role: string) => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/support-accounts/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      showToast("Rôle mis à jour ✓"); await load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string, email: string) => {
    if (!confirm(`Révoquer l'accès de ${email} ?`)) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/support-accounts/${id}`, { method: "DELETE" });
      showToast("Accès révoqué ✓"); await load();
    } catch (e: any) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-sm px-4 py-2 rounded-lg shadow-lg"
          style={{ background: toastOk ? K.teal : "#7A1A1A", color: "#fff", border: `1px solid ${toastOk ? K.tealL : K.danger}` }}>
          {toast}
        </div>
      )}
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal(true)} className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "rgba(13,75,88,0.4)", color: K.tealXL, border: "1px solid rgba(42,143,165,0.35)" }}>
          + Nouveau compte
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: K.card, border: `1px solid ${K.border}` }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid rgba(170,189,216,0.2)`, borderTopColor: K.tealL }} />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: "rgba(170,189,216,0.3)" }}>Aucun compte support créé</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${K.border}` }}>
                {["Email", "Rôle", "Créé le", "Dernière connexion", ""].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-xs font-medium" style={{ color: K.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => {
                const meta = ROLE_META[a.role] ?? ROLE_META.viewer;
                const pendingRole = roleChange[a.id] ?? a.role;
                return (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${K.border}` }}>
                    <td className="px-5 py-3" style={{ color: K.text }}>{a.email}</td>
                    <td className="px-5 py-3">
                      <select value={pendingRole}
                        onChange={e => setRoleChange(p => ({ ...p, [a.id]: e.target.value }))}
                        className="rounded px-2 py-1 text-xs focus:outline-none"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        <option value="viewer">Observateur</option>
                        <option value="support">Support opérationnel</option>
                      </select>
                      {pendingRole !== a.role && (
                        <button onClick={() => changeRole(a.id, pendingRole)} disabled={busy}
                          className="ml-2 text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(42,143,165,0.2)", color: K.tealXL, border: "1px solid rgba(42,143,165,0.3)" }}>
                          Appliquer
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: K.muted }}>{fmt(a.created_at)}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: K.muted }}>{fmt(a.last_sign_in_at)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => revoke(a.id, a.email)} disabled={busy}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "rgba(224,96,96,0.08)", color: K.danger, border: "1px solid rgba(224,96,96,0.2)" }}>
                        Révoquer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: K.card, border: "1px solid rgba(170,189,216,0.15)" }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: K.text }}>Créer un compte support</h2>
            <label className="block text-xs mb-1" style={{ color: K.muted }}>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="support@agence.com" className="w-full rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none"
              style={{ background: K.card2, border: "1px solid rgba(170,189,216,0.2)", color: K.text }} />
            <label className="block text-xs mb-2" style={{ color: K.muted }}>Niveau d'accès</label>
            <div className="space-y-2 mb-6">
              {(["support", "viewer"] as const).map(r => {
                const m = ROLE_META[r];
                return (
                  <button key={r} onClick={() => setNewRole(r)} className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
                    style={{ background: newRole === r ? m.bg : "transparent", border: `1px solid ${newRole === r ? m.border : "rgba(170,189,216,0.12)"}` }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: newRole === r ? m.color : K.muted }}>{m.label}</p>
                    <p className="text-xs" style={{ color: "rgba(170,189,216,0.45)" }}>{m.perms[0]}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={create} disabled={busy || !newEmail.trim()}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ background: "rgba(13,75,88,0.5)", color: K.tealXL, border: "1px solid rgba(42,143,165,0.4)" }}>
                {busy ? "Création…" : "Créer et envoyer l'invitation"}
              </button>
              <button onClick={() => { setModal(false); setNewEmail(""); setNewRole("support"); }}
                className="px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(170,189,216,0.07)", color: K.muted }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page principale (tabs) ────────────────────────────────────────────────────

function SupportPageContent() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"tickets" | "accounts">("tickets");
  const initialTicketId = params.get("ticket");

  const TABS = [
    { key: "tickets",  label: "Tickets clients",  icon: "💬" },
    { key: "accounts", label: "Comptes support",  icon: "👥" },
  ] as const;

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1" style={{ color: K.text }}>Support</h1>
        <p className="text-sm" style={{ color: K.muted }}>Tickets des tenants et gestion des comptes support interne.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: K.card, border: `1px solid ${K.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t.key ? "rgba(13,75,88,0.5)" : "transparent",
              color: tab === t.key ? K.tealXL : K.muted,
              border: `1px solid ${tab === t.key ? "rgba(42,143,165,0.4)" : "transparent"}`,
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "tickets"  && <TicketsTab initialTicketId={initialTicketId} />}
      {tab === "accounts" && <AccountsTab />}
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: K.muted }}>Chargement…</div>}>
      <SupportPageContent />
    </Suspense>
  );
}
