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

type SendResult = { sent: number; failed: number; errors: string[] };

const SUBJECT_PRESETS = [
  "Votre espace Klientys vous attend 👋",
  "Un rappel pour développer votre activité en ligne",
  "Mise à jour importante — votre compte Klientys",
  "Nouveautés sur Klientys — ne les manquez pas",
];

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

  // Sélection multiple pour campagnes
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [showCampaign,  setShowCampaign]  = useState(false);
  const [subject,       setSubject]       = useState("");
  const [body,          setBody]          = useState("");
  const [sending,       setSending]       = useState(false);
  const [sendResult,    setSendResult]    = useState<SendResult | null>(null);

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

  async function adminPost(path: string, json?: object) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        ...(json ? { "Content-Type": "application/json" } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.detail || `HTTP ${res.status}`);
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
    if (!confirm(`Dépublier le site de "${tenant_name}" ?`)) return;
    setActionLoading(`unpublish-${tenant_id}`);
    try {
      await adminPost(`/api/v1/admin/tenants/${tenant_id}/unpublish-site`);
      setUnpublished(prev => new Set([...prev, tenant_id]));
      setItems(prev => prev.map(t => t.tenant_id === tenant_id ? { ...t, site_published: false } : t));
    } catch (e: any) { alert(`Erreur : ${e.message}`); }
    finally { setActionLoading(null); }
  }

  async function handleSendCampaign() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true); setSendResult(null);
    try {
      const result = await adminPost("/api/v1/admin/campaigns/send", {
        subject, body, tenant_ids: Array.from(selected),
      });
      setSendResult(result);
    } catch (e: any) { alert(`Erreur : ${e.message}`); }
    finally { setSending(false); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(t => t.tenant_id)));
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function openCampaign() {
    setSendResult(null); setSubject(""); setBody(""); setShowCampaign(true);
  }

  function closeCampaign() {
    if (sending) return;
    setShowCampaign(false); setSendResult(null);
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
        <div className="flex items-center gap-2">
          {items.length > 0 && !loading && (
            <button
              onClick={toggleAll}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{ background: selected.size === items.length ? "rgba(13,75,88,0.35)" : "rgba(170,189,216,0.07)", color: selected.size === items.length ? K.tealXL : K.muted, border: `1px solid ${selected.size === items.length ? K.tealL : K.border}` }}
            >
              {selected.size === items.length ? "Désélectionner tout" : "Tout sélectionner"}
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
            style={{ background: "rgba(170,189,216,0.07)", color: K.muted, border: `1px solid ${K.border}` }}>
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
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

      {/* Tenant cards */}
      {!loading && items.length > 0 && (
        <div className="space-y-2" style={{ paddingBottom: selected.size > 0 ? 80 : 0 }}>
          {items.map((t) => {
            const isExpanded     = expanded.has(t.tenant_id);
            const hasSent        = sentRelance.has(t.tenant_id);
            const isUnpublished  = unpublished.has(t.tenant_id);
            const isSelected     = selected.has(t.tenant_id);
            const inactiveDays   = daysAgo(t.last_sign_in_at);
            const isLoadingR     = actionLoading === `relance-${t.tenant_id}`;
            const isLoadingU     = actionLoading === `unpublish-${t.tenant_id}`;

            return (
              <div key={t.tenant_id} className="rounded-xl overflow-hidden transition-all"
                style={{ background: K.card, border: `1px solid ${isSelected ? K.tealL : isExpanded ? K.amberBorder : K.border}` }}>

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3.5"
                  style={{ background: isSelected ? "rgba(13,75,88,0.18)" : isExpanded ? K.amberBg : "transparent" }}>

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(t.tenant_id)}
                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors"
                    style={{
                      border: `2px solid ${isSelected ? K.tealXL : "rgba(170,189,216,0.3)"}`,
                      background: isSelected ? K.tealXL : "transparent",
                    }}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" fill="none" stroke="#fff" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Icône warning */}
                  <button
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(217,119,6,0.12)" }}
                    onClick={() => toggleExpand(t.tenant_id)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke={K.amber} strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </button>

                  {/* Info — clic pour ouvrir */}
                  <button className="flex-1 min-w-0 text-left" onClick={() => toggleExpand(t.tenant_id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: K.text }}>{t.tenant_name}</span>
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
                  </button>

                  {/* Chevron */}
                  <button onClick={() => toggleExpand(t.tenant_id)}>
                    <svg className="w-4 h-4 shrink-0 transition-transform" style={{ color: K.muted, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Corps */}
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
                          {isLoadingR ? (
                            <div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                          Envoyer une relance
                        </button>
                      )}

                      {(t.site_published && !isUnpublished && t.computed_status === "trial_expired") && (
                        <button
                          onClick={() => handleUnpublish(t.tenant_id, t.tenant_name)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                          style={{ background: K.redBg, color: K.red, border: `1px solid rgba(224,96,96,0.2)` }}>
                          {isLoadingU ? (
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

      {/* Barre flottante quand sélection active */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl z-40"
          style={{ background: "#0D2535", border: "1px solid rgba(42,143,165,0.35)", backdropFilter: "blur(12px)" }}>
          <span className="text-sm font-semibold" style={{ color: K.tealXL }}>
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <div style={{ width: 1, height: 20, background: "rgba(170,189,216,0.15)" }} />
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs transition-colors"
            style={{ color: "rgba(170,189,216,0.4)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = K.muted; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(170,189,216,0.4)"; }}
          >
            Annuler
          </button>
          <button
            onClick={openCampaign}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "linear-gradient(135deg, #0D4B58, #1A6E82)", color: "#fff" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Rédiger une campagne
          </button>
        </div>
      )}

      {/* Modal campagne */}
      {showCampaign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(5,15,25,0.80)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCampaign(); }}
        >
          <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "#0D1B25", border: "1px solid rgba(42,143,165,0.2)" }}>

            {/* Titre modal */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(170,189,216,0.08)" }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: K.text }}>Campagne groupée</h2>
                <p className="text-xs mt-0.5" style={{ color: K.muted }}>
                  Envoi à {selected.size} tenant{selected.size > 1 ? "s" : ""} inactif{selected.size > 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={closeCampaign} disabled={sending}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: K.muted }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">

              {/* Résultat après envoi */}
              {sendResult ? (
                <div>
                  <div className="rounded-xl p-5 text-center mb-4"
                    style={{ background: sendResult.failed === 0 ? "rgba(74,202,122,0.08)" : "rgba(221,170,64,0.08)", border: `1px solid ${sendResult.failed === 0 ? "rgba(74,202,122,0.2)" : "rgba(221,170,64,0.2)"}` }}>
                    <div className="text-3xl mb-2">{sendResult.failed === 0 ? "✓" : "⚠️"}</div>
                    <p className="text-sm font-semibold" style={{ color: sendResult.failed === 0 ? K.green : K.gold }}>
                      {sendResult.sent} email{sendResult.sent > 1 ? "s" : ""} envoyé{sendResult.sent > 1 ? "s" : ""}
                      {sendResult.failed > 0 && ` · ${sendResult.failed} erreur${sendResult.failed > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {sendResult.errors.length > 0 && (
                    <div className="rounded-lg p-3 mb-4" style={{ background: K.redBg, border: "1px solid rgba(224,96,96,0.2)" }}>
                      {sendResult.errors.map((e, i) => (
                        <p key={i} className="text-xs" style={{ color: K.red }}>{e}</p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={closeCampaign}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "rgba(170,189,216,0.08)", color: K.muted }}
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  {/* Suggestions d'objet */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: K.muted }}>Objet</label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Ex : Votre espace Klientys vous attend 👋"
                      style={{
                        width: "100%", background: "#071824", border: "1px solid rgba(170,189,216,0.12)",
                        borderRadius: 10, padding: "10px 14px", color: K.text, fontSize: 13, outline: "none",
                      }}
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {SUBJECT_PRESETS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSubject(s)}
                          className="text-[11px] px-2.5 py-1 rounded-lg transition-colors"
                          style={{
                            background: subject === s ? "rgba(13,75,88,0.45)" : "rgba(170,189,216,0.06)",
                            color: subject === s ? K.tealXL : "rgba(170,189,216,0.45)",
                            border: `1px solid ${subject === s ? K.tealL : "rgba(170,189,216,0.1)"}`,
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corps */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium" style={{ color: K.muted }}>Message</label>
                      <span className="text-[11px]" style={{ color: "rgba(170,189,216,0.35)" }}>
                        Placeholders : <code style={{ color: K.tealXL }}>{"{nom_business}"}</code>
                      </span>
                    </div>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      placeholder={`Bonjour,\n\nVotre espace {nom_business} n'a pas été consulté depuis un moment. Vos clients et rendez-vous vous attendent !\n\nL'équipe Klientys`}
                      style={{
                        width: "100%", background: "#071824", border: "1px solid rgba(170,189,216,0.12)",
                        borderRadius: 10, padding: "10px 14px", color: K.text, fontSize: 13,
                        outline: "none", resize: "vertical", lineHeight: 1.65,
                      }}
                    />
                  </div>

                  {/* Destinataires */}
                  <div className="rounded-lg px-3 py-2.5 flex items-center gap-2"
                    style={{ background: "rgba(13,75,88,0.12)", border: "1px solid rgba(13,75,88,0.25)" }}>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke={K.tealXL} strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-xs" style={{ color: K.muted }}>
                      {selected.size} destinataire{selected.size > 1 ? "s" : ""} ·{" "}
                      {items.filter(t => selected.has(t.tenant_id)).slice(0, 3).map(t => t.tenant_name).join(", ")}
                      {selected.size > 3 && ` + ${selected.size - 3} autres`}
                    </p>
                  </div>

                  {/* Bouton envoi */}
                  <button
                    onClick={handleSendCampaign}
                    disabled={sending || !subject.trim() || !body.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #0D4B58, #1A6E82)", color: "#fff" }}
                  >
                    {sending ? (
                      <>
                        <div className="w-4 h-4 rounded-full animate-spin" style={{ border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                        Envoi en cours…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Envoyer à {selected.size} tenant{selected.size > 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
