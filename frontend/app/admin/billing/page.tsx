"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function fmtEur(n: number, currency = "EUR") {
  return n.toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── Config statuts ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  paid:          { label: "Payé",        color: "#4CAF89", bg: "rgba(76,175,137,0.12)", border: "rgba(76,175,137,0.25)" },
  complete:      { label: "Payé",        color: "#4CAF89", bg: "rgba(76,175,137,0.12)", border: "rgba(76,175,137,0.25)" },
  open:          { label: "En attente",  color: "#DDAA40", bg: "rgba(221,170,64,0.12)", border: "rgba(221,170,64,0.25)" },
  draft:         { label: "Brouillon",   color: "#2A8FA5", bg: "rgba(42,143,165,0.12)", border: "rgba(42,143,165,0.25)" },
  void:          { label: "Annulé",      color: "#E06060", bg: "rgba(224,96,96,0.08)",  border: "rgba(224,96,96,0.2)" },
  uncollectible: { label: "Irrécouv.",   color: "#E06060", bg: "rgba(224,96,96,0.08)",  border: "rgba(224,96,96,0.2)" },
  expired:       { label: "Expiré",      color: "rgba(170,189,216,0.4)", bg: "rgba(170,189,216,0.05)", border: "rgba(170,189,216,0.1)" },
};

// ── Config types ──────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { label: string; color: string }> = {
  subscription:    { label: "Abonnement",    color: "#2A8FA5" },
  domain_purchase: { label: "Achat domaine", color: "#8b5cf6" },
  custom_domain:   { label: "Addon domaine", color: "#a78bfa" },
  logo_request:    { label: "Logo",          color: "#DDAA40" },
  design_request:  { label: "Design",        color: "#f59e0b" },
  other:           { label: "Ponctuel",      color: "rgba(170,189,216,0.55)" },
};

// ── Quelles actions sont disponibles selon le statut ─────────────────────────
type ActionKey = "send" | "mark-paid" | "void" | "resend" | "expire";

function availableActions(p: any): ActionKey[] {
  const actions: ActionKey[] = [];
  const isInvoice  = p.id?.startsWith("in_");
  const isSession  = p.id?.startsWith("cs_");
  const st         = p.status;

  if (isInvoice) {
    if (st === "draft")  { actions.push("send", "void"); }
    if (st === "open")   { actions.push("send", "mark-paid", "void"); }
    if (st === "paid")   { actions.push("resend"); }
  }
  if (isSession) {
    if (st === "open")     { actions.push("expire"); }
    if (st === "paid" || st === "complete") { actions.push("resend"); }
  }
  return actions;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.08)" }}>
      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(170,189,216,0.4)" }}>{label}</p>
      <p className="text-xl font-bold leading-none" style={{ color: color || "#AABDD8" }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: "rgba(170,189,216,0.35)" }}>{sub}</p>}
    </div>
  );
}

export default function BillingPage() {
  const [overview, setOverview]   = useState<any>(null);
  const [payments, setPayments]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [payLoading, setPayLoading] = useState(true);
  const [error, setError]         = useState("");

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter,   setTypeFilter]   = useState<string>("all");

  // Actions en cours
  const [actionState, setActionState]     = useState<Record<string, string>>({}); // id → "loading"|"ok"|"error"
  const [reminderState, setReminderState] = useState<Record<string, string>>({});

  // ── Chargement ────────────────────────────────────────────────────────────
  const loadOverview = async () => {
    setLoading(true);
    try {
      setOverview(await apiFetch("/api/v1/admin/billing"));
    } catch (e: any) {
      setError(e.message ?? "Erreur overview");
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setPayLoading(true);
    try {
      const data = await apiFetch("/api/v1/admin/billing/payments?limit=100");
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    } finally {
      setPayLoading(false);
    }
  };

  useEffect(() => { loadOverview(); loadPayments(); }, []);

  // ── Actions paiements ────────────────────────────────────────────────────
  const doAction = async (id: string, action: ActionKey) => {
    setActionState(s => ({ ...s, [id]: "loading" }));
    try {
      await apiPost(`/api/v1/admin/billing/payments/${id}/${action}`);
      setActionState(s => ({ ...s, [id]: "ok" }));
      setTimeout(() => loadPayments(), 800);
    } catch (e: any) {
      setActionState(s => ({ ...s, [id]: "error" }));
      alert(`Erreur : ${e.message}`);
      setTimeout(() => setActionState(s => { const n = { ...s }; delete n[id]; return n; }), 2000);
    }
  };

  // ── Relance impayé abonnement ─────────────────────────────────────────────
  const sendReminder = async (tenantId: string) => {
    setReminderState(s => ({ ...s, [tenantId]: "loading" }));
    try {
      await apiPost(`/api/v1/admin/billing/past-due/${tenantId}/send-reminder`);
      setReminderState(s => ({ ...s, [tenantId]: "ok" }));
    } catch (e: any) {
      setReminderState(s => ({ ...s, [tenantId]: "error" }));
      alert(`Erreur : ${e.message}`);
      setTimeout(() => setReminderState(s => { const n = { ...s }; delete n[tenantId]; return n; }), 2000);
    }
  };

  // ── Filtrage côté client ──────────────────────────────────────────────────
  const filtered = useMemo(() => payments.filter(p => {
    const stOk = statusFilter === "all" || p.status === statusFilter;
    const tyOk = typeFilter   === "all" || p.type   === typeFilter;
    return stOk && tyOk;
  }), [payments, statusFilter, typeFilter]);

  // Compteurs par statut (sur tous les paiements, pas juste filtrés)
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    payments.forEach(p => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [payments]);

  // ── Loading / Error screens ───────────────────────────────────────────────
  if (loading && !overview) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "#071824" }}>
      <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid rgba(170,189,216,0.2)", borderTopColor: "#1A6E82" }} />
    </div>
  );

  if (error) return (
    <div className="p-8"><p className="text-red-400">{error}</p></div>
  );

  const ov = overview ?? {};

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-8" style={{ color: "#EEF2F5" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#AABDD8" }}>Facturation SaaS</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(170,189,216,0.4)" }}>
            Revenus, abonnements, achats ponctuels — données Stripe en temps réel
          </p>
        </div>
        <button onClick={() => { loadOverview(); loadPayments(); }}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(42,143,165,0.12)", color: "#2A8FA5", border: "1px solid rgba(42,143,165,0.2)" }}>
          ↻ Rafraîchir
        </button>
      </div>

      {/* ── KPIs ligne 1 : abonnements ── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(170,189,216,0.35)" }}>Abonnements récurrents</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="MRR" value={fmtEur(ov.mrr ?? 0)} sub="Revenu mensuel récurrent" color="#DDAA40" />
          <KpiCard label="ARR" value={fmtEur(ov.arr ?? 0)} sub="Revenu annuel récurrent"  color="#2A8FA5" />
          <KpiCard label="Abonnés actifs"  value={String(ov.active_count ?? 0)}   sub="active / trialing" />
          <KpiCard label="Impayés"         value={String(ov.past_due_count ?? 0)} sub="past_due Stripe"   color={(ov.past_due_count ?? 0) > 0 ? "#E06060" : "#4CAF89"} />
        </div>
      </div>

      {/* ── KPIs ligne 2 : paiements 30j ── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(170,189,216,0.35)" }}>Activité — 30 derniers jours (tous types)</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Encaissé 30j"
            value={fmtEur(ov.revenue_30d ?? 0)}
            sub={`dont ponctuel ${fmtEur(ov.revenue_onetime_30d ?? 0)}`}
            color="#4CAF89" />
          <KpiCard label="En attente"
            value={String(ov.pending_count ?? 0)}
            sub={ov.pending_amount ? `${fmtEur(ov.pending_amount)} à encaisser` : "Aucun impayé"}
            color={(ov.pending_count ?? 0) > 0 ? "#DDAA40" : "#4CAF89"} />
          <KpiCard label="Payés 30j"
            value={String(ov.paid_30d_count ?? 0)}
            sub="factures + achats"
            color="#4CAF89" />
          <KpiCard label="Annulés / Expirés 30j"
            value={String(ov.voided_30d ?? 0)}
            sub="void + expired"
            color={(ov.voided_30d ?? 0) > 0 ? "#E06060" : "rgba(170,189,216,0.55)"} />
        </div>
      </div>

      {/* ── Répartition par plan ── */}
      {(ov.plan_breakdown ?? []).length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(170,189,216,0.35)" }}>Répartition par plan</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(ov.plan_breakdown as any[]).map((p: any) => (
              <KpiCard key={p.name} label={p.name}
                value={fmtEur(p.mrr)}
                sub={`${p.count} abonné${p.count > 1 ? "s" : ""}`}
                color="#AABDD8" />
            ))}
          </div>
        </div>
      )}

      {/* ── Table de tous les paiements ── */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-semibold" style={{ color: "#7DD8E8" }}>
            Tous les paiements
            <span className="ml-2 text-xs font-normal" style={{ color: "rgba(170,189,216,0.4)" }}>
              {filtered.length} / {payments.length}
            </span>
          </h2>
          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtre statut */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(170,189,216,0.12)" }}>
              {[
                { key: "all",   label: "Tous" },
                { key: "draft", label: `Brouillons${(counts.draft || 0) > 0 ? ` (${counts.draft})` : ""}` },
                { key: "open",  label: `En attente${(counts.open || 0) > 0 ? ` (${counts.open})` : ""}` },
                { key: "paid",  label: "Payés" },
                { key: "void",  label: "Annulés" },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className="px-3 py-1.5 text-xs transition-colors"
                  style={{
                    background: statusFilter === f.key ? "rgba(42,143,165,0.3)" : "transparent",
                    color: statusFilter === f.key ? "#7DD8E8" : "rgba(170,189,216,0.45)",
                    borderRight: "1px solid rgba(170,189,216,0.08)",
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Filtre type */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5"
              style={{ background: "#0D1B25", color: "rgba(170,189,216,0.7)", border: "1px solid rgba(170,189,216,0.12)" }}>
              <option value="all">Tous types</option>
              {Object.entries(TYPE_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {payLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid rgba(170,189,216,0.2)", borderTopColor: "#1A6E82" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "rgba(170,189,216,0.35)" }}>
            Aucun paiement pour ces filtres.
          </div>
        ) : (
          <div className="rounded-xl overflow-x-auto" style={{ background: "#0D1B25", border: "1px solid rgba(170,189,216,0.08)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(170,189,216,0.08)" }}>
                  {["Type", "Description", "Tenant", "Montant", "Statut", "Date", "Période", "Actions"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-medium ${i >= 3 && i < 7 ? "text-right" : "text-left"}`}
                      style={{ color: "rgba(170,189,216,0.4)", minWidth: i === 7 ? "180px" : undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const st  = STATUS_CFG[p.status] ?? { label: p.status, color: "rgba(170,189,216,0.4)", bg: "transparent", border: "transparent" };
                  const tp  = TYPE_CFG[p.type]     ?? { label: p.type, color: "rgba(170,189,216,0.45)" };
                  const acts = availableActions(p);
                  const aState = actionState[p.id];

                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(170,189,216,0.04)" }}>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
                          style={{ color: tp.color, background: `${tp.color}18`, border: `1px solid ${tp.color}33` }}>
                          {tp.label}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs truncate" style={{ color: "rgba(170,189,216,0.7)" }} title={p.label}>{p.label}</p>
                        <p className="text-[10px] font-mono" style={{ color: "rgba(170,189,216,0.3)" }}>{p.number}</p>
                      </td>

                      {/* Tenant */}
                      <td className="px-4 py-3">
                        {p.tenant_id ? (
                          <Link href={`/admin/tenants/${p.tenant_id}`} className="text-sm font-medium hover:underline" style={{ color: "#7DD8E8" }}>
                            {p.tenant_name || "—"}
                          </Link>
                        ) : (
                          <span className="text-xs" style={{ color: "rgba(170,189,216,0.4)" }}>{p.customer_email || "—"}</span>
                        )}
                      </td>

                      {/* Montant */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold" style={{ color: p.amount > 0 ? "#DDAA40" : "rgba(170,189,216,0.4)" }}>
                          {p.amount > 0 ? fmtEur(p.amount, p.currency) : "—"}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap"
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                          {st.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap" style={{ color: "rgba(170,189,216,0.5)" }}>
                        {fmtDate(p.created)}
                      </td>

                      {/* Période */}
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap" style={{ color: "rgba(170,189,216,0.4)" }}>
                        {p.period_start && p.period_end ? `${p.period_start} → ${p.period_end}` : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" style={{ minWidth: "180px" }}>
                        <div className="flex items-center gap-1.5 flex-wrap">

                          {/* PDF si dispo */}
                          {p.pdf_url && (
                            <a href={p.pdf_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded-md"
                              style={{ background: "rgba(42,143,165,0.1)", color: "#2A8FA5", border: "1px solid rgba(42,143,165,0.2)" }}>
                              PDF
                            </a>
                          )}

                          {aState === "loading" ? (
                            <span className="text-xs" style={{ color: "rgba(170,189,216,0.4)" }}>…</span>
                          ) : aState === "ok" ? (
                            <span className="text-xs" style={{ color: "#4CAF89" }}>✓ Fait</span>
                          ) : acts.length === 0 ? (
                            <span className="text-xs" style={{ color: "rgba(170,189,216,0.25)" }}>—</span>
                          ) : (
                            <>
                              {acts.includes("send") && (
                                <ActionBtn onClick={() => doAction(p.id, "send")}
                                  color="#2A8FA5" label={p.status === "draft" ? "Finaliser & Envoyer" : "Envoyer"} />
                              )}
                              {acts.includes("mark-paid") && (
                                <ActionBtn onClick={() => doAction(p.id, "mark-paid")}
                                  color="#4CAF89" label="Marquer payée" />
                              )}
                              {acts.includes("resend") && (
                                <ActionBtn onClick={() => doAction(p.id, "resend")}
                                  color="#DDAA40" label="Renvoyer reçu" />
                              )}
                              {acts.includes("void") && (
                                <ActionBtn onClick={() => {
                                  if (confirm("Annuler définitivement ce paiement ?")) doAction(p.id, "void");
                                }} color="#E06060" label="Annuler" />
                              )}
                              {acts.includes("expire") && (
                                <ActionBtn onClick={() => {
                                  if (confirm("Expirer cette session de paiement ?")) doAction(p.id, "expire");
                                }} color="#E06060" label="Expirer" />
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Impayés (past_due) ── */}
      {(ov.past_due_tenants ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#E06060" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Abonnements en échec de paiement ({ov.past_due_tenants.length})
          </h2>
          <div className="rounded-xl overflow-x-auto" style={{ background: "#0D1B25", border: "1px solid rgba(224,96,96,0.15)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(170,189,216,0.08)" }}>
                  {["Tenant", "Email", "Plan", "Depuis", ""].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-medium ${i >= 3 ? "text-right" : "text-left"}`}
                      style={{ color: "rgba(170,189,216,0.4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(ov.past_due_tenants as any[]).map((t: any) => {
                  const days = daysSince(t.start_date);
                  return (
                    <tr key={t.tenant_id} style={{ borderBottom: "1px solid rgba(170,189,216,0.04)" }}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/tenants/${t.tenant_id}`} className="font-medium hover:underline" style={{ color: "#7DD8E8" }}>
                          {t.tenant_name || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "rgba(170,189,216,0.5)" }}>{t.owner_email || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{ background: "rgba(42,143,165,0.12)", color: "#2A8FA5" }}>
                          {t.plan || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs"
                        style={{ color: days && days > 7 ? "#E06060" : "rgba(170,189,216,0.5)" }}>
                        {days !== null ? `${days}j` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {reminderState[t.tenant_id] === "loading" ? (
                          <span className="text-xs px-2 py-0.5" style={{ color: "rgba(170,189,216,0.4)" }}>…</span>
                        ) : reminderState[t.tenant_id] === "ok" ? (
                          <span className="text-xs px-2 py-0.5" style={{ color: "#4CAF89" }}>✓ Envoyé</span>
                        ) : (
                          <ActionBtn onClick={() => sendReminder(t.tenant_id)}
                            color="#E06060" label="Relancer" small />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Bouton d'action réutilisable ──────────────────────────────────────────────
function ActionBtn({ onClick, color, label, small }: { onClick: () => void; color: string; label: string; small?: boolean }) {
  return (
    <button onClick={onClick}
      className={`text-xs rounded-md whitespace-nowrap transition-opacity hover:opacity-80 ${small ? "px-2 py-0.5" : "px-2.5 py-1"}`}
      style={{ background: `${color}14`, color, border: `1px solid ${color}33` }}>
      {label}
    </button>
  );
}
