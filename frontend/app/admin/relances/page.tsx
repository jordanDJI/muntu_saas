"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  teal:   "#0D4B58", tealL: "#1A6E82", tealXL: "#2A8FA5",
  gold:   "#DDAA40",
  amber:  "#D97706", amberBg: "rgba(217,119,6,0.10)", amberBorder: "rgba(217,119,6,0.20)",
  red:    "#E06060", redBg:   "rgba(224,96,96,0.10)",
  green:  "#4ACA7A",
  card:   "#0D1B25", card2: "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text:   "#EEF2F5", muted: "#8BA5B0",
};

const STATUS_LABEL: Record<string, string> = {
  trial:         "En essai",
  trial_expired: "Essai expiré",
  active:        "Payant",
  trialing:      "Stripe trial",
};
const STATUS_COLOR: Record<string, string> = {
  trial:         K.gold,
  trial_expired: K.red,
  active:        K.tealXL,
  trialing:      K.tealXL,
};

type InactiveTenant = {
  tenant_id:       string;
  tenant_name:     string;
  tenant_slug:     string;
  owner_email:     string | null;
  last_sign_in_at: string | null;
  created_at:      string;
  computed_status: string;
  site_published:  boolean;
  site_id:         string | null;
};

function daysAgo(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string | null): string {
  if (!iso) return "jamais";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function RelancesPage() {
  const [items,         setItems]         = useState<InactiveTenant[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set());
  const [sentRelance,   setSentRelance]   = useState<Set<string>>(new Set());
  const [unpublished,   setUnpublished]   = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/v1/admin/inactive-tenants?days=30`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function adminPost(path: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function handleRelance(tenant_id: string) {
    setActionLoading(`relance-${tenant_id}`);
    try {
      await adminPost(`/api/v1/admin/tenants/${tenant_id}/relance`);
      setSentRelance(prev => new Set([...prev, tenant_id]));
    } catch (e: any) { alert(`Erreur : ${e.message}`); }
    finally { setActionLoading(null); }
  }

  async function handleUnpublish(tenant_id: string, tenant_name: string) {
    if (!confirm(`Dépublier le site de "${tenant_name}" ? Il ne sera plus accessible au public.`)) return;
    setActionLoading(`unpublish-${tenant_id}`);
    try {
      await adminPost(`/api/v1/admin/tenants/${tenant_id}/unpublish-site`);
      setUnpublished(prev => new Set([...prev, tenant_id]));
      setItems(prev => prev.map(t =>
        t.tenant_id === tenant_id ? { ...t, site_published: false } : t
      ));
    } catch (e: any) { alert(`Erreur : ${e.message}`); }
    finally { setActionLoading(null); }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: K.text }}>Relances</h1>
          <p className="text-sm mt-0.5" style={{ color: K.muted }}>
            Tenants sans activité depuis plus de 30 jours — {loading ? "…" : `${items.length} concerné${items.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
          style={{ background: "rgba(170,189,216,0.07)", color: K.muted, border: `1px solid ${K.border}` }}>
          {loading ? "Chargement…" : "Actualiser"}
        </button>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: K.red }}>{error}</p>}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full animate-spin"
            style={{ border: `2px solid ${K.border}`, borderTopColor: K.tealL }} />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: K.card, border: `1px solid ${K.border}` }}>
          <div className="text-3xl mb-3">✓</div>
          <p className="text-sm font-medium mb-1" style={{ color: K.text }}>Aucun tenant inactif</p>
          <p className="text-xs" style={{ color: K.muted }}>Tous les tenants se sont connectés dans les 30 derniers jours.</p>
        </div>
      )}

      {/* Notification cards */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((t) => {
            const isExpanded   = expanded.has(t.tenant_id);
            const hasSent      = sentRelance.has(t.tenant_id);
            const isUnpublished = unpublished.has(t.tenant_id);
            const inactiveDays = daysAgo(t.last_sign_in_at);
            const isLoadingRelance   = actionLoading === `relance-${t.tenant_id}`;
            const isLoadingUnpublish = actionLoading === `unpublish-${t.tenant_id}`;

            return (
              <div key={t.tenant_id} className="rounded-xl overflow-hidden transition-all"
                style={{ background: K.card, border: `1px solid ${isExpanded ? K.amberBorder : K.border}` }}>

                {/* Header — toujours visible, clic pour ouvrir */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                  style={{ background: isExpanded ? K.amberBg : "transparent" }}
                  onClick={() => toggleExpand(t.tenant_id)}
                >
                  {/* Icône warning */}
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(217,119,6,0.12)" }}>
                    <svg className="w-4 h-4" fill="none" stroke={K.amber} strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>

                  {/* Info principale */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: K.text }}>
                        {t.tenant_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: `${STATUS_COLOR[t.computed_status] ?? K.muted}1a`, color: STATUS_COLOR[t.computed_status] ?? K.muted }}>
                        {STATUS_LABEL[t.computed_status] ?? t.computed_status}
                      </span>
                      {(t.site_published && !isUnpublished) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: "rgba(74,202,122,0.12)", color: K.green }}>
                          Site publié
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: K.muted }}>
                      {t.owner_email ?? "—"} · Inactif depuis {inactiveDays === Infinity ? "la création" : `${inactiveDays}j`} (dernière connexion : {formatDate(t.last_sign_in_at)})
                    </p>
                  </div>

                  {/* Chevron */}
                  <svg className="w-4 h-4 shrink-0 transition-transform" style={{ color: K.muted, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Corps — visible seulement si ouvert */}
                {isExpanded && (
                  <div className="px-4 pb-4" style={{ borderTop: `1px solid ${K.amberBorder}` }}>
                    <p className="text-xs mt-3 mb-4" style={{ color: K.muted, lineHeight: 1.6 }}>
                      Ce tenant ne s'est pas connecté depuis{" "}
                      <strong style={{ color: K.amber }}>
                        {inactiveDays === Infinity ? "sa création" : `${inactiveDays} jours`}
                      </strong>.
                      Vous pouvez envoyer un email de relance au propriétaire, ou dépublier son site s'il reste sans réponse.
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Bouton Relance */}
                      {hasSent ? (
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(74,202,122,0.12)", color: K.green }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Relance envoyée
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRelance(t.tenant_id)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                          style={{ background: K.teal, color: "#fff" }}>
                          {isLoadingRelance ? (
                            <div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                          Envoyer une relance
                        </button>
                      )}

                      {/* Bouton Dépublier — uniquement si site publié ET essai expiré */}
                      {(t.site_published && !isUnpublished && t.computed_status === "trial_expired") && (
                        <button
                          onClick={() => handleUnpublish(t.tenant_id, t.tenant_name)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                          style={{ background: K.redBg, color: K.red, border: `1px solid rgba(224,96,96,0.2)` }}>
                          {isLoadingUnpublish ? (
                            <div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: "2px solid rgba(224,96,96,0.3)", borderTopColor: K.red }} />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          )}
                          Dépublier le site
                        </button>
                      )}

                      {isUnpublished && (
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: K.redBg, color: K.red, border: `1px solid rgba(224,96,96,0.2)` }}>
                          Site dépublié
                        </span>
                      )}

                      {/* Lien vers le détail */}
                      <Link href={`/admin/tenants/${t.tenant_id}`}
                        className="ml-auto text-xs transition-colors"
                        style={{ color: "rgba(170,189,216,0.35)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = K.muted; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(170,189,216,0.35)"; }}>
                        Voir le tenant →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
