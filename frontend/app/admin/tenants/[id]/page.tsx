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

const BOOL_FEATURES = [
  "analytics", "analytics_roi",
  "agent_vitrine", "agent_support", "agent_assistant",
  "booking", "crm", "campaigns",
  "custom_domain", "embed_widget", "custom_css",
  "multi_page_site", "multi_tenant",
];

const NUMERIC_FEATURES: Record<string, { label: string; min: number; max: number }> = {
  max_contacts:          { label: "Max contacts",            min: -1, max: 100000 },
  max_team_members:      { label: "Max membres équipe",      min: -1, max: 100    },
  max_tenants:           { label: "Max tenants",             min: -1, max: 50     },
  attachments_max:       { label: "Max pièces jointes",      min: 0,  max: 100    },
  attachment_file_max_mb:{ label: "Taille max fichier (Mo)", min: 0,  max: 500    },
  gallery_photos_limit:  { label: "Max photos galerie",      min: 0,  max: 100    },
};

const KNOWN_FEATURES = [...BOOL_FEATURES, ...Object.keys(NUMERIC_FEATURES)];

export default function TenantDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [userLevel, setUserLevel] = useState<"viewer"|"support"|"super_admin"|null>(null);
  const [data,   setData]   = useState<any>(null);
  const [tab,    setTab]    = useState<"actions"|"overrides"|"log"|"design">("actions");
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
  const [overrideKey,      setOverrideKey]      = useState(KNOWN_FEATURES[0]);
  const [overrideOn,       setOverrideOn]       = useState(true);
  const [overrideValueInt, setOverrideValueInt] = useState<number>(100);
  const [overrideNote,     setOverrideNote]     = useState("");
  const [overrideDuration, setOverrideDuration] = useState("permanent"); // "7d"|"1m"|"3m"|"6m"|"permanent"
  const [overrideNotify,   setOverrideNotify]   = useState(true);
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

  const isNumericFeature = (key: string) => key in NUMERIC_FEATURES;

  const durationToExpiresAt = (dur: string): string | null => {
    if (dur === "permanent") return null;
    const now = new Date();
    if (dur === "7d")  now.setDate(now.getDate() + 7);
    if (dur === "1m")  now.setMonth(now.getMonth() + 1);
    if (dur === "3m")  now.setMonth(now.getMonth() + 3);
    if (dur === "6m")  now.setMonth(now.getMonth() + 6);
    return now.toISOString();
  };

  const setOverride = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        feature_key: overrideKey,
        enabled:     overrideOn,
        note:        overrideNote || null,
        expires_at:  durationToExpiresAt(overrideDuration),
        notify:      overrideNotify,
      };
      if (isNumericFeature(overrideKey)) {
        body.value_int = overrideValueInt;
        body.enabled   = true;
      }
      await adminFetch(`/api/v1/admin/tenants/${id}/overrides`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      showToast(overrideNotify ? "Override enregistré + tenant notifié ✓" : "Override enregistré ✓", true);
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
        {(["actions","overrides","log","design"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1.5 text-xs rounded-md transition-colors capitalize"
            style={tab === t
              ? { background: "rgba(13,75,88,0.35)", color: "#7DD8E8" }
              : { color: K.muted }
            }>
            {t === "log" ? "Log" : t === "overrides" ? "Feature overrides" : t === "design" ? "🎨 Design" : "Actions"}
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
              <select value={overrideKey} onChange={(e) => { setOverrideKey(e.target.value); setOverrideValueInt(NUMERIC_FEATURES[e.target.value]?.min ?? 0); }}
                className="rounded px-2 py-1 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}>
                <optgroup label="Booléennes">
                  {BOOL_FEATURES.map((f) => <option key={f} value={f}>{f}</option>)}
                </optgroup>
                <optgroup label="Numériques">
                  {Object.entries(NUMERIC_FEATURES).map(([k, v]) => <option key={k} value={k}>{v.label} ({k})</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: K.muted }}>
                {isNumericFeature(overrideKey) ? "Valeur (-1 = illimité)" : "Valeur"}
              </label>
              {isNumericFeature(overrideKey) ? (
                <input
                  type="number"
                  value={overrideValueInt}
                  min={NUMERIC_FEATURES[overrideKey]?.min ?? 0}
                  max={NUMERIC_FEATURES[overrideKey]?.max ?? 99999}
                  onChange={(e) => setOverrideValueInt(parseInt(e.target.value) || 0)}
                  className="w-28 rounded px-2 py-1 text-xs focus:outline-none"
                  style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}
                />
              ) : (
                <select value={overrideOn ? "1" : "0"} onChange={(e) => setOverrideOn(e.target.value === "1")}
                  className="rounded px-2 py-1 text-xs focus:outline-none"
                  style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}>
                  <option value="1">Activé</option>
                  <option value="0">Désactivé</option>
                </select>
              )}
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: K.muted }}>Durée</label>
              <select value={overrideDuration} onChange={e => setOverrideDuration(e.target.value)}
                className="rounded px-2 py-1 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}>
                <option value="7d">7 jours</option>
                <option value="1m">1 mois</option>
                <option value="3m">3 mois</option>
                <option value="6m">6 mois</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>
            <div className="flex-1 min-w-32">
              <label className="text-xs block mb-1" style={{ color: K.muted }}>Note (optionnel)</label>
              <input value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="Ex: deal beta testeur"
                className="w-full rounded px-2 py-1 text-xs focus:outline-none"
                style={{ background: K.card2, border: `1px solid rgba(170,189,216,0.2)`, color: K.text }} />
            </div>
            <div className="flex items-center gap-1.5 self-end pb-1.5">
              <input type="checkbox" id="ov-notify" checked={overrideNotify} onChange={e => setOverrideNotify(e.target.checked)}
                className="w-3.5 h-3.5 accent-teal-600" />
              <label htmlFor="ov-notify" className="text-xs cursor-pointer" style={{ color: K.muted }}>Notifier</label>
            </div>
            <button onClick={setOverride} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50 self-end"
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
                  <th className="text-left py-2">Expiration</th>
                  <th className="text-left py-2">Note</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {overrides.map((o: any) => {
                  const exp = o.expires_at ? new Date(o.expires_at) : null;
                  const expired = exp && exp < new Date();
                  return (
                  <tr key={o.id} style={{ borderBottom: "1px solid rgba(170,189,216,0.04)" }}>
                    <td className="py-2 font-mono" style={{ color: K.tealXL }}>{o.feature_key}</td>
                    <td className="py-2">
                      {o.value_int != null ? (
                        <span className="px-1.5 py-0.5 rounded text-xs font-mono"
                          style={{ background: "rgba(221,170,64,0.12)", color: "#DDAA40" }}>
                          {o.value_int === -1 ? "∞ illimité" : o.value_int}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-xs"
                          style={o.enabled
                            ? { background: "rgba(74,202,122,0.1)", color: K.success }
                            : { background: "rgba(224,96,96,0.1)", color: K.danger }}>
                          {o.enabled ? "On" : "Off"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {exp ? (
                        <span style={{ color: expired ? K.danger : "#DDAA40" }}>
                          {exp.toLocaleDateString("fr-FR")}
                          {expired && " ⚠"}
                        </span>
                      ) : (
                        <span style={{ color: "rgba(170,189,216,0.4)" }}>Permanent</span>
                      )}
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
                  );
                })}
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

      {tab === "design" && (
        <DesignTab tenantId={id} tenantName={tenant.name} tenantSlug={tenant.slug} onImpersonate={impersonate} />
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

// ── DesignTab ──────────────────────────────────────────────────────────────────

type DesignMethod = {
  id: string;
  title: string;
  tagline: string;
  difficulty: "Facile" | "Intermédiaire" | "Avancé";
  time: string;
  icon: string;
  steps: { label: string; detail: string; warning?: string; action?: "impersonate" | "link"; actionLabel?: string; actionHref?: string }[];
};

const DESIGN_METHODS: DesignMethod[] = [
  {
    id: "palette",
    title: "Changer la palette & la police",
    tagline: "Couleur principale et style typographique — impact visuel immédiat.",
    difficulty: "Facile",
    time: "2 min",
    icon: "🎨",
    steps: [
      { label: "Ouvrir le site-builder en tant que tenant", detail: "Génère un lien d'impersonation et ouvre-le en navigation privée (Ctrl+Shift+N).", action: "impersonate", actionLabel: "Générer le lien →" },
      { label: "Aller à l'étape 1 — Logo & style", detail: "Dans le wizard, clique sur l'étape 1. Tu y trouveras le sélecteur de couleur principale (indigo, teal, rose…) et le style de police (moderne, classique, élégant)." },
      { label: "Choisir la nouvelle palette", detail: "Sélectionne la couleur et la police souhaitées. L'aperçu se met à jour en temps réel à droite." },
      { label: "Enregistrer & publier", detail: "Clique 'Enregistrer' en bas du wizard, puis 'Publier le site' pour que les changements soient visibles publiquement.", warning: "Ne pas confondre 'Enregistrer' (brouillon) et 'Publier' (visible par tous)." },
    ],
  },
  {
    id: "logo-photos",
    title: "Mettre à jour le logo & les photos",
    tagline: "Remplacer le logo texte par une image ou changer les visuels.",
    difficulty: "Facile",
    time: "5 min",
    icon: "🖼️",
    steps: [
      { label: "Ouvrir le site-builder", detail: "Impersonate le tenant et ouvre le dashboard → Site-builder.", action: "impersonate", actionLabel: "Générer le lien →" },
      { label: "Étape 1 — Logo", detail: "Sélectionner 'Logo image' (au lieu de 'Texte seul'), coller l'URL de l'image ou uploader depuis Supabase Storage. Format recommandé : PNG transparent, 200×60 px minimum." },
      { label: "Étape 2 — Photos", detail: "Choisir 'J'ai mes propres photos' et coller les URLs des visuels par section (hero, à-propos, prestations). Les photos doivent être hébergées (Cloudinary, Supabase Storage, Unsplash).", warning: "Si les photos sont sur le téléphone du client, demande-lui de les uploader sur Google Drive ou WeTransfer d'abord." },
      { label: "Enregistrer & publier", detail: "Sauvegarder le brouillon puis publier." },
    ],
  },
  {
    id: "content",
    title: "Refonte complète du contenu",
    tagline: "Réécrire titres, taglines, descriptions, prestations, atouts et témoignages.",
    difficulty: "Intermédiaire",
    time: "20–40 min",
    icon: "✍️",
    steps: [
      { label: "Récupérer les infos du client", detail: "Avant d'ouvrir le site-builder : liste des prestations (nom, durée, prix), zone d'intervention, téléphone/email, 3 atouts différenciants, 1–2 témoignages clients réels." },
      { label: "Ouvrir le site-builder (impersonate)", detail: "Navigation privée obligatoire.", action: "impersonate", actionLabel: "Générer le lien →" },
      { label: "Étape 3 — Titre & tagline", detail: "Titre court et percutant (ex. 'Cabinet de kinésithérapie à Lyon'). Tagline = promesse client en 1 phrase (ex. 'Retrouvez mobilité et bien-être en douceur')." },
      { label: "Étape 4 — Contact & adresse", detail: "Vérifier téléphone, email, adresse complète. Bien renseigner les champs séparés (rue, CP, ville, pays) pour l'affichage sur la carte." },
      { label: "Étape 5 — Prestations", detail: "Ajouter chaque prestation avec nom, description courte, durée et prix. Limiter à 6 prestations maximum pour l'affichage optimal.", warning: "Les prestations sans nom ne sont pas sauvegardées — vérifier qu'aucun champ nom n'est vide." },
      { label: "Étape 6 — Atouts & étape 7 — Témoignages", detail: "Atouts : choisir une icône SVG + titre court + description. Témoignages : nom complet + texte (pas de note en étoile — non supporté)." },
      { label: "Enregistrer & publier", detail: "Vérifier l'aperçu sur mobile avant de publier (bouton 📱 dans le header du site-builder)." },
    ],
  },
  {
    id: "css",
    title: "CSS custom (animations, mise en page avancée)",
    tagline: "Injecter du CSS pour personnaliser au-delà des options du wizard.",
    difficulty: "Intermédiaire",
    time: "Variable",
    icon: "💅",
    steps: [
      { label: "Identifier ce que le tenant veut", detail: "Exemples courants : animation d'entrée sur le hero, changement de police d'un seul élément, mise en page d'une section, couleur d'un bouton spécifique." },
      { label: "Inspecter le site public pour trouver les sélecteurs", detail: "Ouvre le site public du tenant dans les DevTools (F12 → Inspecteur). Les classes Tailwind sont générées — préfère cibler les balises sémantiques ou ajouter des data-attributes.", action: "link", actionLabel: "Voir le site public →", actionHref: "/{slug}" },
      { label: "Ouvrir le site-builder → Étape 9 (CSS custom)", detail: "Étape 9 du wizard = champ CSS libre. Le CSS est injecté dans une balise <style> dans le <head> du site public. Scope global — attention aux collisions.", warning: "Pas de <style> ni de <script> dans ce champ — uniquement des règles CSS pures. Éviter !important autant que possible." },
      { label: "Exemples d'animations courants", detail: "Fade-in hero : `.hero-section { animation: fadeIn 0.8s ease-out; } @keyframes fadeIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:none } }`. Hover bouton : `.btn-primary:hover { transform: scale(1.03); transition: transform 0.2s ease; }`" },
      { label: "Tester & publier", detail: "Aperçu dans le site-builder, puis tester sur mobile. Publier." },
    ],
  },
  {
    id: "managed",
    title: "Page sur mesure (service managé)",
    tagline: "Une page hors-template : galerie, tarifs, portfolio, programme… Facturation séparée.",
    difficulty: "Avancé",
    time: "1–3h selon complexité",
    icon: "🛠️",
    steps: [
      { label: "Qualifier la demande", detail: "Demander au client : contenu exact (textes, images, structure), page existante à prendre en référence, délai souhaité. Confirmer que c'est hors-abonnement (prestation ponctuelle)." },
      { label: "Choisir la méthode d'intégration", detail: "Option A — CSS custom étendu : si la page peut être simulée par du CSS sur une section existante (ex. galerie dans la section prestations). Option B — HTML dans la description : coller du HTML formaté dans le champ 'description' du site (rendu basique). Option C — Page externe embeddée : créer la page sur Notion/Tally/Carrd et l'intégrer via iframe dans le CSS custom (`body::after { content:''; }` + overlay).", warning: "Option C est un contournement — la page ne sera pas indexée par Google sous le domaine du tenant." },
      { label: "Ouvrir le site en impersonate", detail: "Toujours en navigation privée.", action: "impersonate", actionLabel: "Générer le lien →" },
      { label: "Appliquer les modifications", detail: "Selon l'option choisie : modifier les champs dans le wizard (A/B) ou ajouter l'iframe via CSS custom (C). Documenter ce qui a été fait dans le log admin (action manuelle)." },
      { label: "Valider avec le client", detail: "Envoyer le lien de preview (`/{slug}?preview=true`) au client pour validation avant de publier.", action: "link", actionLabel: "Ouvrir la preview →", actionHref: "/{slug}?preview=true" },
      { label: "Publier & facturer", detail: "Publier le site. Envoyer la facture pour la prestation hors-abonnement (indiquer le détail dans la note de la facture)." },
    ],
  },
];

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  "Facile":         { bg: "rgba(74,202,122,0.1)",   color: "#4ACA7A", border: "rgba(74,202,122,0.25)"  },
  "Intermédiaire":  { bg: "rgba(221,170,64,0.1)",   color: "#DDAA40", border: "rgba(221,170,64,0.25)"  },
  "Avancé":         { bg: "rgba(224,96,96,0.1)",    color: "#E06060", border: "rgba(224,96,96,0.25)"   },
};

function DesignTab({ tenantId, tenantName, tenantSlug, onImpersonate }: {
  tenantId: string; tenantName: string; tenantSlug: string; onImpersonate: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const method = DESIGN_METHODS.find(m => m.id === selected) ?? null;

  const resolveHref = (href: string) => href.replace("{slug}", tenantSlug);

  return (
    <div style={{ display: "grid", gridTemplateColumns: method ? "280px 1fr" : "1fr", gap: 16 }}>
      {/* Liste des méthodes */}
      <div className="space-y-2">
        <p className="text-xs mb-3" style={{ color: K_muted }}>
          Choisissez une méthode de refonte pour afficher le tutoriel pas-à-pas.
        </p>
        {DESIGN_METHODS.map(m => {
          const diff = DIFF_STYLE[m.difficulty];
          const active = selected === m.id;
          return (
            <button key={m.id} onClick={() => setSelected(active ? null : m.id)}
              className="w-full text-left rounded-xl p-3.5 transition-all"
              style={{
                background: active ? "rgba(13,75,88,0.25)" : K_card,
                border: `1px solid ${active ? "rgba(42,143,165,0.4)" : K_border}`,
              }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                <span className="text-sm font-medium" style={{ color: K_text }}>{m.title}</span>
              </div>
              <p className="text-xs mb-2 leading-relaxed" style={{ color: K_muted }}>{m.tagline}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold rounded px-2 py-0.5"
                  style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                  {m.difficulty}
                </span>
                <span className="text-xs" style={{ color: "rgba(170,189,216,0.4)" }}>⏱ {m.time}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tutoriel */}
      {method && (
        <div className="rounded-xl overflow-hidden" style={{ background: K_card, border: `1px solid ${K_border}` }}>
          {/* Header */}
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${K_border}` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 20 }}>{method.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: K_text }}>{method.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-semibold rounded px-1.5 py-0.5"
                      style={{ background: DIFF_STYLE[method.difficulty].bg, color: DIFF_STYLE[method.difficulty].color, border: `1px solid ${DIFF_STYLE[method.difficulty].border}` }}>
                      {method.difficulty}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(170,189,216,0.4)" }}>⏱ {method.time} — pour {tenantName}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-lg leading-none shrink-0" style={{ color: K_muted }}>×</button>
            </div>
          </div>

          {/* Étapes */}
          <div className="p-5 space-y-0">
            {method.steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                {/* Ligne verticale + numéro */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "rgba(13,75,88,0.4)", color: "#2A8FA5", border: "1px solid rgba(42,143,165,0.3)" }}>
                    {i + 1}
                  </div>
                  {i < method.steps.length - 1 && (
                    <div className="flex-1 w-px mt-1" style={{ background: "rgba(42,143,165,0.15)", minHeight: 24 }} />
                  )}
                </div>

                {/* Contenu */}
                <div className="pb-5 flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-1.5" style={{ color: K_text }}>{step.label}</p>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: K_muted, whiteSpace: "pre-wrap" }}>{step.detail}</p>

                  {step.warning && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg mb-2"
                      style={{ background: "rgba(221,170,64,0.08)", border: "1px solid rgba(221,170,64,0.2)" }}>
                      <span className="text-xs shrink-0">⚠️</span>
                      <p className="text-xs leading-relaxed" style={{ color: "#DDAA40" }}>{step.warning}</p>
                    </div>
                  )}

                  {step.action === "impersonate" && (
                    <button onClick={onImpersonate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: "rgba(13,75,88,0.35)", color: "#2A8FA5", border: "1px solid rgba(42,143,165,0.35)" }}>
                      🔑 {step.actionLabel}
                    </button>
                  )}

                  {step.action === "link" && step.actionHref && (
                    <a href={resolveHref(step.actionHref)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: "rgba(13,75,88,0.2)", color: "#2A8FA5", border: "1px solid rgba(42,143,165,0.25)", textDecoration: "none" }}>
                      🔗 {step.actionLabel}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
