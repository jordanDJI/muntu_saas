"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const K = {
  teal:   "#0D4B58",
  tealL:  "#1A6E82",
  tealXL: "#2A8FA5",
  gold:   "#DDAA40",
  blue:   "#AABDD8",
  card:   "#0D1B25",
  card2:  "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text:   "#EEF2F5",
  muted:  "#8BA5B0",
  danger: "#E06060",
  success:"#4ACA7A",
  warning:"#DDAA40",
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

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  active:        { bg: "rgba(13,75,88,0.2)",    color: "#2A8FA5",                 border: "rgba(42,143,165,0.3)"   },
  trialing:      { bg: "rgba(170,189,216,0.1)",  color: "#AABDD8",                 border: "rgba(170,189,216,0.25)" },
  trial:         { bg: "rgba(221,170,64,0.1)",   color: "#DDAA40",                 border: "rgba(221,170,64,0.25)"  },
  trial_expired: { bg: "rgba(224,96,96,0.1)",    color: "#E06060",                 border: "rgba(224,96,96,0.25)"   },
  suspended:     { bg: "rgba(170,189,216,0.05)", color: "rgba(170,189,216,0.35)",  border: "rgba(170,189,216,0.1)"  },
};
const STATUS_LABEL: Record<string, string> = {
  active: "Actif", trialing: "Stripe trial", trial: "Essai", trial_expired: "Expiré", suspended: "Suspendu",
};

const KNOWN_FEATURES = [
  "analytics", "analytics_roi",
  "agent_vitrine", "agent_support", "agent_assistant",
  "booking", "crm", "campaigns",
  "custom_domain", "embed_widget", "custom_css",
  "multi_page_site", "multi_tenant",
  "max_contacts", "max_team_members", "max_tenants",
  "attachments_max", "attachment_file_max_mb", "gallery_photos_limit",
];

export default function TenantDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [userLevel, setUserLevel] = useState<"viewer"|"support"|"super_admin"|null>(null);
  const [data,   setData]   = useState<any>(null);
  const [tab,    setTab]    = useState<"actions"|"overrides"|"log">("actions");
  const [toast,  setToast]  = useState("");
  const [toastOk,setToastOk]= useState(true);
  const [error,  setError]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);
  const [linkCopied,      setLinkCopied]      = useState(false);
  const [trialDays,      setTrialDays]      = useState(7);
  const [suspendReason,  setSuspendReason]  = useState("");
  const [editField,      setEditField]      = useState<"name"|"slug"|"sector"|"country"|null>(null);
  const [editVal,        setEditVal]        = useState("");
  const [overrideKey,    setOverrideKey]    = useState(KNOWN_FEATURES[0]);
  const [overrideOn,     setOverrideOn]     = useState(true);
  const [overrideNote,   setOverrideNote]   = useState("");
  const [newOwnerEmail,  setNewOwnerEmail]  = useState("");

  const load = useCallback(async () => {
    try {
      const d = await adminFetch<any>(`/api/v1/admin/tenants/${id}`);
      setData(d);
    } catch (e: any) { setError(e.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.app_metadata?.is_super_admin) setUserLevel("super_admin");
      else if (user?.app_metadata?.support_role === "support") setUserLevel("support");
      else if (user?.app_metadata?.support_role === "viewer") setUserLevel("viewer");
    });
  }, []);

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(""), 3000);
  };

  const action = async (path: string, body: object = {}, method = "POST") => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/tenants/${id}/${path}`, { method, body: JSON.stringify(body) });
      showToast("Opération effectuée ✓", true);
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const impersonate = async () => {
    setBusy(true);
    try {
      const r = await adminFetch<{ email: string; otp: string }>(`/api/v1/admin/tenants/${id}/impersonate`, { method: "POST", body: JSON.stringify({}) });
      const relayUrl = `${window.location.origin}/auth/impersonate#email=${encodeURIComponent(r.email)}&otp=${encodeURIComponent(r.otp)}`;
      setImpersonateLink(relayUrl);
      setLinkCopied(false);
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const copyImpersonateLink = () => {
    if (!impersonateLink) return;
    navigator.clipboard.writeText(impersonateLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const changeOwnerEmail = async () => {
    if (!newOwnerEmail.trim()) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/tenants/${id}/owner-email`, { method: "PATCH", body: JSON.stringify({ email: newOwnerEmail.trim() }) });
      showToast("Email mis à jour ✓", true);
      setNewOwnerEmail("");
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const patch = async () => {
    if (!editField || !editVal.trim()) return;
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify({ [editField]: editVal }) });
      showToast("Modifié ✓", true);
      setEditField(null);
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const deleteTenant = async () => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/tenants/${id}`, { method: "DELETE" });
      router.replace("/admin/tenants");
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); setBusy(false); }
  };

  const setOverride = async () => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/tenants/${id}/overrides`, {
        method: "POST",
        body: JSON.stringify({ feature_key: overrideKey, enabled: overrideOn, note: overrideNote }),
      });
      showToast("Override enregistré ✓", true);
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  const removeOverride = async (key: string) => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/admin/tenants/${id}/overrides/${key}`, { method: "DELETE" });
      showToast("Override supprimé ✓", true);
      await load();
    } catch (e: any) { showToast(`Erreur : ${e.message}`, false); }
    finally { setBusy(false); }
  };

  if (error) return <div className="p-8" style={{ color: K.danger }}>{error}</div>;
  if (!data) return (
    <div className="p-8 flex justify-center">
      <div className="w-6 h-6 rounded-full animate-spin"
        style={{ border: `2px solid ${K.border}`, borderTopColor: K.tealL }} />
    </div>
  );

  const { tenant, owner, subscription, site, domain, counts, profile, trial_reminders_sent, overrides, action_log } = data;
  const st = tenant.computed_status;
  const badge = STATUS_BADGE[st] ?? STATUS_BADGE.suspended;

  // Permissions selon le niveau de l'utilisateur connecté
  const canWrite  = userLevel === "support" || userLevel === "super_admin"; // L2+
  const canDanger = userLevel === "super_admin";                            // L3 uniquement

  return (
    <div className="p-8 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-sm px-4 py-2 rounded-lg shadow-lg"
          style={{ background: toastOk ? K.teal : "#7A1A1A", color: "#fff", border: `1px solid ${toastOk ? K.tealL : "#E06060"}` }}>
          {toast}
        </div>
      )}

      {/* Modal impersonation */}
      {impersonateLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: K.card, border: "1px solid rgba(170,189,216,0.15)" }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: K.text }}>Connexion en tant que {tenant.name}</h2>
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg" style={{ background: "rgba(221,170,64,0.08)", border: "1px solid rgba(221,170,64,0.2)" }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <p className="text-xs leading-relaxed" style={{ color: K.gold }}>
                Ce lien est à usage unique. Ouvre-le dans une <strong>fenêtre de navigation privée</strong> (Ctrl+Shift+N) pour ne pas perdre ta session admin.
              </p>
            </div>
            <div className="rounded-lg px-3 py-2 mb-4 font-mono text-xs break-all select-all"
              style={{ background: K.card2, border: "1px solid rgba(170,189,216,0.12)", color: "rgba(170,189,216,0.6)" }}>
              {impersonateLink}
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyImpersonateLink}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: linkCopied ? "rgba(74,202,122,0.15)" : "rgba(13,75,88,0.35)", color: linkCopied ? K.success : K.tealXL, border: `1px solid ${linkCopied ? "rgba(74,202,122,0.3)" : "rgba(42,143,165,0.3)"}` }}>
                {linkCopied ? "✓ Copié !" : "Copier le lien"}
              </button>
              <button
                onClick={() => setImpersonateLink(null)}
                className="px-4 py-2 rounded-xl text-sm transition-colors"
                style={{ background: "rgba(170,189,216,0.07)", color: K.muted }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/admin/tenants" className="text-xs mb-2 inline-block transition-colors"
            style={{ color: K.muted }}>← Tenants</Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: K.text }}>{tenant.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
              {STATUS_LABEL[st] ?? st}
            </span>
          </div>
          <p className="text-sm font-mono mt-1" style={{ color: "rgba(170,189,216,0.35)" }}>{tenant.slug}</p>
        </div>
        {site?.status === "published" && (
          <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer"
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: K.tealXL }}>
            Voir le site ↗
          </a>
        )}
      </div>

      {/* 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Infos */}
        <div className="lg:col-span-2 space-y-4">
          <InfoCard title="Propriétaire">
            <Row label="Email" value={owner.email ?? "—"} />
            <Row label="User ID" value={owner.user_id ?? "—"} mono />
          </InfoCard>

          <InfoCard title="Abonnement">
            <Row label="Statut Stripe" value={subscription?.status ?? "—"} />
            <Row label="Plan"          value={subscription?.plan?.name ?? "Aucun"} />
            <Row label="Stripe ID"     value={subscription?.stripe_subscription_id ?? "—"} mono />
            {tenant.trial_extended_until && (
              <Row label="Trial étendu jusqu'au" value={new Date(tenant.trial_extended_until).toLocaleDateString("fr-FR")} />
            )}
            {tenant.suspended_at && (
              <Row label="Suspendu le" value={new Date(tenant.suspended_at).toLocaleDateString("fr-FR")} />
            )}
            {tenant.suspended_reason && (
              <Row label="Raison" value={tenant.suspended_reason} />
            )}
          </InfoCard>

          <InfoCard title="Données">
            <Row label="RDV"            value={String(counts.appointments)} />
            <Row label="Contacts"       value={String(counts.contacts)}     />
            <Row label="Leads"          value={String(counts.leads)}        />
            <Row label="Tags CRM"       value={String(counts.tags ?? 0)}    />
            <Row label="Campagnes"      value={String(counts.campaigns ?? 0)} />
            <Row label="Rappels CRM"    value={String(counts.reminders ?? 0)} />
            <Row label="Pièces jointes" value={String(counts.attachments ?? 0)} />
            <Row label="Site"           value={site ? `${site.title ?? "Sans titre"} (${site.status})` : "Aucun"} />
            <Row label="Domaine"        value={domain ? `${domain.domain} (${domain.status})` : "Aucun"} />
          </InfoCard>

          <InfoCard title="Profil &amp; onboarding">
            {profile && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: K.muted }}>Score de complétion</span>
                  <span className="text-sm font-bold" style={{ color: profile.score >= 80 ? K.success : profile.score >= 40 ? K.warning : K.danger }}>
                    {profile.score}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(170,189,216,0.1)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${profile.score}%`, background: profile.score >= 80 ? K.success : profile.score >= 40 ? K.warning : K.danger }} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.steps?.map((s: any) => (
                    <span key={s.key} className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: s.done ? "rgba(74,202,122,0.1)" : "rgba(224,96,96,0.1)", color: s.done ? K.success : K.danger }}>
                      {s.done ? "✓" : "✗"} {s.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-xs" style={{ color: K.muted }}>Rappels trial envoyés</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(trial_reminders_sent?.length ?? 0) === 0 ? (
                  <span className="text-xs" style={{ color: "rgba(170,189,216,0.3)" }}>Aucun</span>
                ) : trial_reminders_sent.map((d: number) => (
                  <span key={d} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: "rgba(221,170,64,0.1)", color: K.warning, border: "1px solid rgba(221,170,64,0.2)" }}>
                    J-{d}
                  </span>
                ))}
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Infos tenant">
            {(["name","slug","sector","country"] as const).map((f) => (
              <div key={f} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: "1px solid rgba(170,189,216,0.05)" }}>
                <span className="text-xs capitalize" style={{ color: K.muted }}>{f}</span>
                {editField === f ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && patch()}
                      className="rounded px-2 py-1 text-xs w-32 focus:outline-none"
                      style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}
                    />
                    <button onClick={patch} disabled={busy} className="text-xs" style={{ color: K.success }}>✓</button>
                    <button onClick={() => setEditField(null)} className="text-xs" style={{ color: K.muted }}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: K.text }}>{tenant[f] ?? "—"}</span>
                    <button
                      onClick={() => { setEditField(f); setEditVal(tenant[f] ?? ""); }}
                      className="text-xs transition-colors"
                      style={{ color: "rgba(170,189,216,0.2)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = K.tealXL)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(170,189,216,0.2)")}
                    >✎</button>
                  </div>
                )}
              </div>
            ))}
          </InfoCard>
        </div>

        {/* Panneau d'actions */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: K.muted }}>Actions rapides</h2>

          <ActionBlock title="Étendre l'essai" accent={K.gold}>
            <div className="flex items-center gap-2 mb-2">
              <input type="number" min={1} max={90} value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                className="w-16 rounded px-2 py-1 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }} />
              <span className="text-xs" style={{ color: K.muted }}>jours</span>
            </div>
            <ABtn onClick={() => action("extend-trial", { days: trialDays })} busy={busy} accent={K.gold}>
              Étendre
            </ABtn>
          </ActionBlock>

          {canDanger && (
            <ActionBlock title="Forcer l'activation" accent={K.tealXL}>
              <p className="text-xs mb-2" style={{ color: K.muted }}>Active le compte sans paiement Stripe (plan Pro).</p>
              <ABtn onClick={() => action("force-activate", {})} busy={busy} accent={K.tealXL}>Activer gratuitement</ABtn>
            </ActionBlock>
          )}

          {canDanger && (st !== "suspended" ? (
            <ActionBlock title="Suspendre" accent={K.danger}>
              <input type="text" placeholder="Raison (optionnel)" value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full rounded px-2 py-1 text-xs mb-2 focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }} />
              <ABtn onClick={() => action("suspend", { reason: suspendReason || undefined })} busy={busy} accent={K.danger}>Suspendre</ABtn>
            </ActionBlock>
          ) : (
            <ActionBlock title="Réactiver" accent={K.tealXL}>
              <ABtn onClick={() => action("unsuspend")} busy={busy} accent={K.tealXL}>Réactiver le compte</ABtn>
            </ActionBlock>
          ))}

          {canDanger && (
            <ActionBlock title="Se connecter en tant que" accent={K.tealXL}>
              <p className="text-xs mb-2" style={{ color: K.muted }}>Ouvre une session propriétaire dans un nouvel onglet.</p>
              <ABtn onClick={impersonate} busy={busy} accent={K.tealXL}>Impersonate →</ABtn>
            </ActionBlock>
          )}

          {canDanger && (
            <ActionBlock title="Email propriétaire" accent={K.blue}>
              <input
                type="email"
                placeholder={owner.email ?? "Nouvel email"}
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                className="w-full rounded px-2 py-1 text-xs mb-2 focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}
              />
              <ABtn onClick={changeOwnerEmail} busy={busy || !newOwnerEmail.trim()} accent={K.blue}>Changer l'email</ABtn>
            </ActionBlock>
          )}

          {canWrite && (
            <ActionBlock title="Authentification" accent={K.tealXL}>
              <div className="space-y-2">
                <ABtn onClick={() => action("confirm-email")} busy={busy} accent={K.tealXL}>Confirmer l'email</ABtn>
                <ABtn onClick={() => action("reset-password")} busy={busy} accent={K.tealXL}>Envoyer reset mot de passe</ABtn>
              </div>
            </ActionBlock>
          )}

          {canWrite && (
            <ActionBlock title="Stripe" accent={K.muted}>
              <p className="text-xs mb-2" style={{ color: K.muted }}>Resynchronise le statut depuis Stripe.</p>
              <ABtn onClick={() => action("sync-stripe")} busy={busy} accent={K.muted}>Sync Stripe</ABtn>
            </ActionBlock>
          )}

          {canWrite && (
            <ActionBlock title="Domaine personnalisé" accent={K.muted}>
              <p className="text-xs mb-2" style={{ color: K.muted }}>Déconnecte le domaine custom (status → pending).</p>
              <ABtn onClick={() => action("reset-domain")} busy={busy} accent={K.muted}>Reset domaine</ABtn>
            </ActionBlock>
          )}

          {canWrite && (
            <ActionBlock title="Cache" accent={K.muted}>
              <ABtn onClick={() => action("clear-cache")} busy={busy} accent={K.muted}>Vider cache ROI</ABtn>
            </ActionBlock>
          )}

          {canDanger && (
          <ActionBlock title="Supprimer définitivement" accent={K.danger}>
            <p className="text-xs mb-2" style={{ color: "rgba(224,96,96,0.7)" }}>Irréversible — supprime toutes les données.</p>
            {!confirmDelete ? (
              <ABtn onClick={() => setConfirmDelete(true)} busy={false} accent={K.danger}>Supprimer ce tenant</ABtn>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: K.danger }}>Confirmer la suppression ?</p>
                <div className="flex gap-2">
                  <button onClick={deleteTenant} disabled={busy}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: "#7A1A1A", color: "#FC8181", border: "1px solid rgba(224,96,96,0.3)" }}>
                    Oui, supprimer
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "rgba(170,189,216,0.07)", color: K.muted }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </ActionBlock>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: "rgba(170,189,216,0.04)" }}>
        {(["actions","overrides","log"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1.5 text-xs rounded-md transition-colors capitalize"
            style={tab === t
              ? { background: "rgba(13,75,88,0.35)", color: "#7DD8E8" }
              : { color: K.muted }
            }>
            {t === "log" ? "Log" : t === "overrides" ? "Feature overrides" : "Actions"}
          </button>
        ))}
      </div>

      {/* Panel overrides */}
      {tab === "overrides" && (
        <div className="rounded-xl p-5" style={{ background: K.card, border: `1px solid ${K.border}` }}>
          <h3 className="text-sm font-medium mb-4" style={{ color: K.text }}>Overrides de features pour ce tenant</h3>

          <div className="flex flex-wrap gap-2 mb-5 items-end">
            <div>
              <label className="text-xs block mb-1" style={{ color: K.muted }}>Feature</label>
              <select value={overrideKey} onChange={(e) => setOverrideKey(e.target.value)}
                className="rounded px-2 py-1 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}>
                {KNOWN_FEATURES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: K.muted }}>Valeur</label>
              <select value={overrideOn ? "1" : "0"} onChange={(e) => setOverrideOn(e.target.value === "1")}
                className="rounded px-2 py-1 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}>
                <option value="1">Activé</option>
                <option value="0">Désactivé</option>
              </select>
            </div>
            <div className="flex-1 min-w-32">
              <label className="text-xs block mb-1" style={{ color: K.muted }}>Note (optionnel)</label>
              <input value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="Ex: deal beta testeur"
                className="w-full rounded px-2 py-1 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }} />
            </div>
            <button onClick={setOverride} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
              style={{ background: K.teal, color: "#fff" }}>
              Appliquer
            </button>
          </div>

          {overrides.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>Aucun override</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: K.muted, borderBottom: `1px solid ${K.border}` }}>
                  <th className="text-left py-2">Feature</th>
                  <th className="text-left py-2">Valeur</th>
                  <th className="text-left py-2">Note</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {overrides.map((o: any) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid rgba(170,189,216,0.04)" }}>
                    <td className="py-2 font-mono" style={{ color: K.tealXL }}>{o.feature_key}</td>
                    <td className="py-2">
                      <span className="px-1.5 py-0.5 rounded text-xs"
                        style={o.enabled
                          ? { background: "rgba(74,202,122,0.1)", color: K.success }
                          : { background: "rgba(224,96,96,0.1)", color: K.danger }}>
                        {o.enabled ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="py-2" style={{ color: K.muted }}>{o.note ?? "—"}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => removeOverride(o.feature_key)}
                        className="text-xs transition-colors"
                        style={{ color: "rgba(224,96,96,0.4)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = K.danger)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(224,96,96,0.4)")}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Log */}
      {tab === "log" && (
        <div className="rounded-xl p-5" style={{ background: K.card, border: `1px solid ${K.border}` }}>
          <h3 className="text-sm font-medium mb-4" style={{ color: K.text }}>Historique des actions admin</h3>
          {action_log.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(170,189,216,0.25)" }}>Aucune action</p>
          ) : (
            <div className="space-y-1.5">
              {action_log.map((l: any) => (
                <div key={l.id} className="flex items-center gap-4 text-xs py-2"
                  style={{ borderBottom: "1px solid rgba(170,189,216,0.04)" }}>
                  <span className="font-mono shrink-0" style={{ color: K.tealXL }}>{l.action_type}</span>
                  {l.payload && <span className="truncate max-w-xs" style={{ color: "rgba(170,189,216,0.3)" }}>{JSON.stringify(l.payload)}</span>}
                  <span className="ml-auto shrink-0" style={{ color: "rgba(170,189,216,0.25)" }}>{new Date(l.created_at).toLocaleString("fr-FR")}</span>
                  <span className="shrink-0" style={{ color: "rgba(170,189,216,0.25)" }}>{l.admin_email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "actions" && (
        <p className="text-sm" style={{ color: "rgba(170,189,216,0.3)" }}>Les actions rapides sont dans le panneau de droite.</p>
      )}
    </div>
  );
}

// ── Composants locaux ──────────────────────────────────────────────────────────

const K_card   = "#0D1B25";
const K_border = "rgba(170,189,216,0.10)";
const K_muted  = "#8BA5B0";
const K_text   = "#EEF2F5";

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: K_card, border: `1px solid ${K_border}` }}>
      <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: K_muted }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5"
      style={{ borderBottom: "1px solid rgba(170,189,216,0.05)" }}>
      <span className="text-xs" style={{ color: K_muted }}>{label}</span>
      <span className="text-xs" style={{ color: mono ? "rgba(170,189,216,0.5)" : K_text, fontFamily: mono ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

function ActionBlock({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  const borderAlpha = accent === "#E06060" ? "rgba(224,96,96,0.12)" : accent === "#DDAA40" ? "rgba(221,170,64,0.12)" : "rgba(170,189,216,0.07)";
  return (
    <div className="rounded-xl p-4" style={{ background: K_card, border: `1px solid ${borderAlpha}` }}>
      <h4 className="text-xs font-medium mb-3" style={{ color: K_muted }}>{title}</h4>
      {children}
    </div>
  );
}

function ABtn({ onClick, busy, accent, children }: { onClick: () => void; busy: boolean; accent: string; children: React.ReactNode }) {
  const bg     = `${accent}1A`; // ~10% opacity hex trick doesn't work — use rgba
  const bgMap: Record<string, string> = {
    "#0D4B58": "rgba(13,75,88,0.18)",  "#1A6E82": "rgba(26,110,130,0.18)",
    "#2A8FA5": "rgba(42,143,165,0.18)","#DDAA40": "rgba(221,170,64,0.12)",
    "#E06060": "rgba(224,96,96,0.12)", "#AABDD8": "rgba(170,189,216,0.1)",
    "#8BA5B0": "rgba(139,165,176,0.1)","#4ACA7A": "rgba(74,202,122,0.12)",
  };
  const borderMap: Record<string, string> = {
    "#0D4B58": "rgba(13,75,88,0.4)",   "#1A6E82": "rgba(26,110,130,0.4)",
    "#2A8FA5": "rgba(42,143,165,0.3)", "#DDAA40": "rgba(221,170,64,0.3)",
    "#E06060": "rgba(224,96,96,0.3)",  "#AABDD8": "rgba(170,189,216,0.2)",
    "#8BA5B0": "rgba(139,165,176,0.2)","#4ACA7A": "rgba(74,202,122,0.3)",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: bgMap[accent] ?? "rgba(170,189,216,0.07)",
        color: accent,
        border: `1px solid ${borderMap[accent] ?? "rgba(170,189,216,0.15)"}`,
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}
