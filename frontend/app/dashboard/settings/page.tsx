"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, supabase } from "../../../lib/api";
import { useLanguage, LangSelector, LANGUAGES } from "../../../contexts/LanguageContext";
import DemandPotentialCard from "../analytics/DemandPotentialCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section =
  | "profil" | "securite" | "site" | "metriques"
  | "abonnement" | "notifications" | "preferences"
  | "membres" | "integrations" | "export" | "activite" | "domaine";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "profil",        label: "Profil",          icon: "👤" },
  { key: "securite",      label: "Sécurité",        icon: "🔐" },
  { key: "site",          label: "Mon site",        icon: "🌐" },
  { key: "domaine",       label: "Domaine",         icon: "🔗" },
  { key: "metriques",     label: "Métriques",       icon: "📊" },
  { key: "abonnement",    label: "Abonnement",      icon: "💳" },
  { key: "notifications", label: "Notifications",   icon: "🔔" },
  { key: "preferences",  label: "Préférences",     icon: "⚙️" },
  { key: "membres",       label: "Équipe",          icon: "👥" },
  { key: "integrations",  label: "Intégrations",    icon: "🔗" },
  { key: "export",        label: "Export & RGPD",   icon: "📤" },
  { key: "activite",      label: "Activité",        icon: "📋" },
];

// ── Helpers UI ────────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border p-6 space-y-4 ${className}`}>{children}</div>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function SaveBtn({ loading, label = "Sauvegarder" }: { loading: boolean; label?: string }) {
  return (
    <button type="submit" disabled={loading}
      className="bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
      {loading ? "Sauvegarde…" : label}
    </button>
  );
}

function Feedback({ msg }: { msg: string }) {
  if (!msg) return null;
  const ok = !msg.toLowerCase().includes("erreur");
  return <p className={`text-sm ${ok ? "text-green-600" : "text-red-500"}`}>{msg}</p>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative ${checked ? "bg-primary-600" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`}/>
      </button>
    </label>
  );
}

// ── Section Profil ────────────────────────────────────────────────────────────

function SectionProfil() {
  const { lang: ctxLang, setLang: ctxSetLang, t } = useLanguage();
  const [user, setUser]     = useState<any>(null);
  const [name, setName]     = useState("");
  const [tz, setTz]         = useState("Europe/Brussels");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    const load = async () => {
      // Try server-validated user first, fall back to session (localStorage)
      const { data: { user: u } } = await supabase.auth.getUser();
      const sessionUser = u ?? (await supabase.auth.getSession()).data.session?.user;
      if (!sessionUser) return;
      setUser(sessionUser);
      const m = sessionUser.user_metadata ?? {};
      const fullName = m.full_name ?? [m.first_name, m.last_name].filter(Boolean).join(" ");
      setName(fullName);
      setTz(m.timezone ?? "Europe/Brussels");
    };
    load();
  }, []);

  const save = async (e: React.SyntheticEvent) => {
    e.preventDefault(); setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { full_name: name, lang: ctxLang, timezone: tz } });
      setMsg(t.sett_saved);
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  const initials = name ? name[0].toUpperCase() : (user?.email?.[0]?.toUpperCase() ?? "?");

  return (
    <>
      <SectionTitle title="Profil utilisateur" subtitle="Vos informations personnelles et préférences de compte." />
      <Card>
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600 shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Compte créé le {user?.created_at ? new Date(user.created_at).toLocaleDateString("fr-BE") : "—"}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.sett_fullname}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jean Dupont"
              className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.sett_email_label}</label>
            <input value={user?.email ?? ""} disabled
              className="border rounded-lg px-3 py-2 w-full text-sm bg-gray-50 text-gray-400" />
            <p className="text-xs text-gray-400 mt-1">{t.sett_email_no_change}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t.sett_lang_label}</label>
              <select
                value={ctxLang}
                onChange={e => ctxSetLang(e.target.value as any)}
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.sett_tz_label}</label>
              <select value={tz} onChange={e => setTz(e.target.value)} className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="Europe/Brussels">Europe/Brussels (UTC+1/+2)</option>
                <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
                <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <Feedback msg={msg} />
          <SaveBtn loading={saving} label={saving ? t.sett_saving : t.sett_save} />
        </form>
      </Card>
    </>
  );
}

// ── Section Sécurité ──────────────────────────────────────────────────────────

function SectionSecurite() {
  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");
  const [resetSent, setResetSent] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    if (next !== confirm) { setMsg("Erreur : les mots de passe ne correspondent pas."); return; }
    if (next.length < 8)  { setMsg("Erreur : minimum 8 caractères."); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session introuvable");
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (signErr) throw new Error("Mot de passe actuel incorrect.");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setMsg("Mot de passe modifié avec succès."); setCurrent(""); setNext(""); setConfirm("");
      api.logActivity({ action: "Mot de passe modifié", detail: "Depuis les paramètres" }).catch(() => {});
    } catch (err: any) { setMsg(`Erreur : ${err.message}`); }
    finally { setSaving(false); }
  };

  const sendReset = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email);
    setResetSent(true);
  };

  return (
    <>
      <SectionTitle title="Sécurité" subtitle="Gérez votre mot de passe et la sécurité de votre compte." />
      <Card>
        <h3 className="font-semibold text-gray-700 text-sm">Modifier le mot de passe</h3>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Mot de passe actuel</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
              className="border rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8}
              className="border rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="border rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <Feedback msg={msg} />
          <SaveBtn loading={saving} label="Modifier le mot de passe" />
        </form>
      </Card>
      <Card>
        <h3 className="font-semibold text-gray-700 text-sm">Mot de passe oublié ?</h3>
        <p className="text-sm text-gray-500">Recevoir un lien de réinitialisation par email.</p>
        {resetSent ? (
          <p className="text-green-600 text-sm">Email envoyé — vérifiez votre boîte mail.</p>
        ) : (
          <button onClick={sendReset} className="text-primary-600 text-sm hover:underline">
            Envoyer le lien de réinitialisation
          </button>
        )}
      </Card>
    </>
  );
}

// ── Section Site ──────────────────────────────────────────────────────────────

function SectionSite() {
  const [site, setSite]                   = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [title, setTitle]                 = useState("");
  const [absenceMode, setAbsenceMode]     = useState(false);
  const [absenceMessage, setAbsenceMessage] = useState("");
  const [msg, setMsg]                     = useState("");
  const [tenantSlug, setTenantSlug]       = useState("");
  const [origin, setOrigin]               = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    api.getSites().then(sites => {
      const s = sites[0];
      if (s) { setSite(s); setTitle(s.title ?? ""); setAbsenceMode(s.absence_mode ?? false); setAbsenceMessage(s.absence_message ?? ""); }
    }).finally(() => setLoading(false));
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("membership").select("tenant:tenant_id(slug)").eq("user_id", user.id).single();
      setTenantSlug((data?.tenant as any)?.slug ?? "");
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!site) return; setSaving(true); setMsg("");
    try {
      const updated = await api.updateSite(site.id, { title, absence_mode: absenceMode, absence_message: absenceMessage || null });
      setSite(updated); setMsg("Modifications sauvegardées.");
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  const togglePublish = async () => {
    if (!site) return;
    try {
      if (site.status === "published") { await api.unpublishSite(site.id); setSite({ ...site, status: "draft" }); }
      else { await api.publishSite(site.id); setSite({ ...site, status: "published" }); }
    } catch { setMsg("Erreur lors du changement de statut."); }
  };

  if (loading) return <p className="text-gray-400 text-sm">Chargement…</p>;

  return (
    <>
      <SectionTitle title="Mon site" subtitle="Titre affiché, mode absence et publication de votre vitrine." />
      <Card>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titre affiché</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="border rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <Toggle checked={absenceMode} onChange={setAbsenceMode} label="Mode absence" />
          {absenceMode && (
            <div>
              <label className="block text-sm font-medium mb-1">Message d'absence</label>
              <input value={absenceMessage} onChange={e => setAbsenceMessage(e.target.value)}
                placeholder="Ex: Actuellement en congé, retour le 15 mai."
                className="border rounded-lg px-3 py-2 w-full text-sm" />
            </div>
          )}
          <Feedback msg={msg} />
          <SaveBtn loading={saving} />
        </form>
      </Card>
      <Card>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-sm text-gray-700">Publication</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Statut : <span className={site?.status === "published" ? "text-green-600 font-medium" : "text-gray-400"}>
                {site?.status === "published" ? "Publié" : "Brouillon"}
              </span>
            </p>
            {tenantSlug && (
              <a href={`${origin}/${tenantSlug}`} target="_blank" rel="noreferrer"
                className="text-xs text-primary-500 hover:underline mt-1 block">
                {origin.replace(/^https?:\/\//, "")}/{tenantSlug}
              </a>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {tenantSlug && (
              <a href={`${origin}/${tenantSlug}?preview=1`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                Prévisualiser
              </a>
            )}
            <button onClick={togglePublish}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${site?.status === "published" ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200" : "bg-green-600 text-white hover:bg-green-700"}`}>
              {site?.status === "published" ? "Dépublier" : "Publier"}
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}

// ── Section Métriques ─────────────────────────────────────────────────────────

const METRIC_DEFS = [
  { id: "new_leads",  label: "Nouvelles demandes",    desc: "Leads non traités en attente de réponse",               icon: "📨" },
  { id: "pending",    label: "RDV en attente",         desc: "Rendez-vous à confirmer ou refuser",                    icon: "⏳" },
  { id: "confirmed",  label: "RDV confirmés à venir",  desc: "Prochains rendez-vous confirmés dans votre agenda",     icon: "✅" },
  { id: "contacts",   label: "Contacts distincts",     desc: "Nombre total de clients/prospects dans votre CRM",      icon: "👥" },
  { id: "leads_30d",  label: "Demandes (30 jours)",    desc: "Nouvelles demandes reçues sur les 30 derniers jours",   icon: "📈" },
  { id: "rdv_30d",    label: "RDV (30 jours)",         desc: "Rendez-vous créés ou confirmés ce mois",                icon: "📅" },
  { id: "conv_rate",  label: "Taux de confirmation",   desc: "% de RDV confirmés parmi tous les RDV clôturés",        icon: "📊" },
  { id: "activity",        label: "Activité hebdomadaire",         desc: "Graphique des demandes et RDV des 7 derniers jours",      icon: "📉" },
  { id: "demand_potential", label: "Potentiel de demande locale",  desc: "Indice Google Trends pour vos zones d'intervention",      icon: "🌍" },
];

const ALL_METRIC_IDS = METRIC_DEFS.map((m) => m.id);

function SectionMetriques() {
  const [enabled, setEnabled] = useState<string[]>(ALL_METRIC_IDS);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const prefs = user.user_metadata?.dashboard_kpis;
      if (Array.isArray(prefs)) setEnabled(prefs);
    });
  }, []);

  const toggle = (id: string) =>
    setEnabled((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { dashboard_kpis: enabled } });
      setMsg("Préférences sauvegardées.");
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionTitle title="Métriques" subtitle="Choisissez les indicateurs affichés sur votre tableau de bord." />
      <Card>
        <p className="text-sm font-semibold text-gray-700">Indicateurs du tableau de bord</p>
        <p className="text-xs text-gray-400">Activez ou désactivez les métriques selon vos priorités.</p>
        <div className="divide-y divide-gray-100 -mx-2">
          {METRIC_DEFS.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-4 px-2 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">{m.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-tight">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{m.desc}</p>
                </div>
              </div>
              <Toggle checked={enabled.includes(m.id)} onChange={() => toggle(m.id)} label="" />
            </div>
          ))}
        </div>
        <Feedback msg={msg} />
        <button onClick={save} disabled={saving}
          className="bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
          {saving ? "Sauvegarde…" : "Enregistrer"}
        </button>
      </Card>
      <DemandPotentialCard />
    </>
  );
}

// ── Section Abonnement ────────────────────────────────────────────────────────

function SectionAbonnement() {
  const [sub, setSub]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: mem } = await supabase.from("membership").select("tenant_id").eq("user_id", user.id).single();
      if (!mem) return;
      const { data } = await supabase
        .from("subscription")
        .select("*, plan:plan_id(name, price_eur)")
        .eq("tenant_id", mem.tenant_id)
        .eq("status", "active")
        .single();
      setSub(data);
    }).finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    try {
      const { url } = await api.createCheckout({ mode: "portal" }) as any;
      if (url) window.open(url, "_blank");
    } catch { alert("Portail de facturation indisponible."); }
  };

  return (
    <>
      <SectionTitle title="Abonnement & facturation" subtitle="Votre offre actuelle, vos factures et vos moyens de paiement." />
      {loading ? <p className="text-sm text-gray-400">Chargement…</p> : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{sub?.plan?.name ?? "Aucun abonnement actif"}</p>
                {sub?.plan?.price_eur && (
                  <p className="text-sm text-gray-500 mt-0.5">{sub.plan.price_eur} € / mois</p>
                )}
                {sub?.current_period_end && (
                  <p className="text-xs text-gray-400 mt-1">
                    Renouvellement le {new Date(sub.current_period_end).toLocaleDateString("fr-BE")}
                  </p>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${sub ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {sub ? "Actif" : "Inactif"}
              </span>
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold text-sm text-gray-700">Gérer mon abonnement</h3>
            <p className="text-sm text-gray-500">Modifier votre plan, consulter les factures ou mettre à jour votre moyen de paiement.</p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={openPortal}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
                Portail de facturation Stripe
              </button>
              {!sub && (
                <button onClick={() => window.location.href = "/dashboard"}
                  className="border border-primary-300 text-primary-600 px-4 py-2 rounded-lg text-sm hover:bg-primary-50">
                  Choisir un plan
                </button>
              )}
            </div>
          </Card>
          {sub && (
            <Card className="border-red-100">
              <h3 className="font-semibold text-sm text-red-600">Résilier l'abonnement</h3>
              <p className="text-sm text-gray-500">La résiliation est effective à la fin de la période en cours. Vos données sont conservées 30 jours.</p>
              <button onClick={openPortal} className="text-red-500 text-sm hover:underline">
                Résilier via le portail Stripe →
              </button>
            </Card>
          )}
        </>
      )}
    </>
  );
}

// ── Section Notifications ─────────────────────────────────────────────────────

const NOTIF_DEFAULTS = {
  email_new_lead: true,
  email_new_rdv: true,
  email_reminder: true,
  email_invoice: true,
  email_newsletter: false,
  sms_rdv: false,
  inapp_updates: true,
};

function SectionNotifications() {
  const [prefs, setPrefs] = useState(NOTIF_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const stored = user.user_metadata?.notif_prefs;
      if (stored) setPrefs({ ...NOTIF_DEFAULTS, ...stored });
    });
  }, []);

  const toggle = (key: string) => setPrefs((p: any) => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { notif_prefs: prefs } });
      setMsg("Préférences sauvegardées.");
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  const Row = ({ k, label }: { k: string; label: string }) => (
    <Toggle checked={prefs[k]} onChange={() => toggle(k)} label={label} />
  );

  return (
    <>
      <SectionTitle title="Notifications" subtitle="Choisissez comment et quand vous souhaitez être alerté." />
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">Email</h3>
        <div className="space-y-3">
          <Row k="email_new_lead"   label="Nouveau lead / demande de contact" />
          <Row k="email_new_rdv"    label="Nouveau rendez-vous confirmé" />
          <Row k="email_reminder"   label="Rappels de rendez-vous" />
          <Row k="email_invoice"    label="Factures et renouvellements" />
          <Row k="email_newsletter" label="Nouveautés et conseils" />
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">SMS</h3>
        <div className="space-y-3">
          <Row k="sms_rdv" label="Rappels de rendez-vous par SMS" />
        </div>
        <p className="text-xs text-gray-400 mt-2">Les notifications SMS nécessitent un numéro de téléphone vérifié.</p>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">In-app</h3>
        <div className="space-y-3">
          <Row k="inapp_updates" label="Nouvelles fonctionnalités et mises à jour" />
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <Feedback msg={msg} />
      </div>
    </>
  );
}

// ── Section Préférences ───────────────────────────────────────────────────────

function SectionPreferences() {
  const [darkMode, setDarkMode]     = useState(false);
  const [compactView, setCompact]   = useState(false);
  const [dateFormat, setDateFormat] = useState("dd/mm/yyyy");
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const p = user.user_metadata?.ui_prefs ?? {};
      setDarkMode(p.darkMode ?? false);
      setCompact(p.compactView ?? false);
      setDateFormat(p.dateFormat ?? "dd/mm/yyyy");
    });
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { ui_prefs: { darkMode, compactView, dateFormat } } });
      setMsg("Préférences sauvegardées.");
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionTitle title="Préférences" subtitle="Personnalisez l'apparence et le comportement de l'interface." />
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">Apparence</h3>
        <div className="space-y-3">
          <Toggle checked={darkMode} onChange={setDarkMode} label="Mode sombre (bêta)" />
          <Toggle checked={compactView} onChange={setCompact} label="Vue compacte (listes condensées)" />
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">Format d'affichage</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Format de date</label>
          <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-48">
            <option value="dd/mm/yyyy">JJ/MM/AAAA</option>
            <option value="mm/dd/yyyy">MM/JJ/AAAA</option>
            <option value="yyyy-mm-dd">AAAA-MM-JJ</option>
          </select>
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <Feedback msg={msg} />
      </div>
    </>
  );
}

// ── Section Membres ───────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", admin: "Admin", member: "Membre" };
const ROLE_OPTIONS = [{ value: "admin", label: "Admin" }, { value: "member", label: "Membre" }];

function SectionMembres() {
  const [members, setMembers]   = useState<any[]>([]);
  const [pending, setPending]   = useState<any[]>([]);
  const [myRole, setMyRole]     = useState<string>("member");
  const [loading, setLoading]   = useState(true);
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ members: m, pending: p }, { role: r }] = await Promise.all([
        api.getMembers(),
        api.getMyRole(),
      ]);
      setMembers(m);
      setPending(p);
      setMyRole(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.inviteMember({ email: email.trim(), role }) as any;
      if (res.email_sent) {
        setSuccess(`Invitation envoyée à ${email.trim()}`);
      } else {
        setSuccess(`Invitation créée. Copiez ce lien et envoyez-le manuellement :\n${res.invite_url}`);
      }
      setEmail("");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await api.cancelInvite(inviteId);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateMemberRole(userId, newRole);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Retirer ce membre de l'équipe ?")) return;
    try {
      await api.removeMember(userId);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <>
      <SectionTitle title="Équipe" subtitle="Gérez les membres qui ont accès à votre espace." />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 whitespace-pre-wrap break-all">
          {success}
        </div>
      )}

      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Membres actifs</h3>
        {loading ? <p className="text-sm text-gray-400">Chargement…</p> : (
          <div className="space-y-1">
            {members.map(m => {
              const initials = [m.first_name, m.last_name].filter(Boolean).map((s: string) => s[0]).join("").toUpperCase() || m.email?.slice(0, 2).toUpperCase() || "?";
              const displayName = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
              return (
                <div key={m.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{displayName}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && m.role !== "owner" ? (
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.user_id, e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                      >
                        {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    )}
                    {canManage && m.role !== "owner" && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        title="Retirer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {members.length === 0 && <p className="text-sm text-gray-400">Aucun membre pour l'instant.</p>}
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invitations en attente</h4>
            <div className="space-y-1">
              {pending.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-gray-700">{p.email}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABEL[p.role] ?? p.role} · Expire le {new Date(p.expires_at).toLocaleDateString("fr-BE")}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleCancelInvite(p.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {canManage && (
        <Card>
          <h3 className="font-semibold text-sm text-gray-700">Inviter un membre</h3>
          <p className="text-sm text-gray-500">Un email d'invitation sera envoyé à l'adresse saisie.</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); setSuccess(null); }}
              onKeyDown={e => e.key === "Enter" && handleInvite()}
              placeholder="email@exemple.com"
              className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              {inviting ? "Envoi…" : "Inviter"}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

// ── Section Intégrations ──────────────────────────────────────────────────────

function SectionIntegrations() {
  const [status, setStatus] = useState<{ stripe: boolean; resend: boolean; gemini: boolean; whatsapp: boolean } | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getIntegrationsStatus().then(setStatus).catch(() => {});
    api.getTenantApiKey().then(r => setApiKey(r.api_key)).catch(() => {});
  }, []);

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleRegenerate = async () => {
    if (!confirm("Régénérer la clé API ? L'ancienne clé sera immédiatement invalidée.")) return;
    setRegenerating(true);
    try {
      const r = await api.regenerateTenantApiKey();
      setApiKey(r.api_key);
      setRevealed(true);
    } finally { setRegenerating(false); }
  };

  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(24)}` : "sk_••••••••••••••••••••••••••••••";

  const integrations = [
    { name: "Stripe",             desc: "Paiements et abonnements",          key: "stripe"   as const },
    { name: "Resend",             desc: "Envoi d'emails transactionnels",     key: "resend"   as const },
    { name: "Google Gemini (IA)", desc: "Agents IA et analyses",              key: "gemini"   as const },
    { name: "WhatsApp Business",  desc: "Agent de conversion client",         key: "whatsapp" as const },
  ];

  return (
    <>
      <SectionTitle title="Intégrations & API" subtitle="Connectez votre espace à des services tiers." />
      {integrations.map(item => {
        const connected = status ? status[item.key] : null;
        return (
          <Card key={item.name}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                connected === null ? "bg-gray-50 text-gray-400" :
                connected ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
              }`}>
                {connected === null ? "…" : connected ? "Connecté" : "Non configuré"}
              </span>
            </div>
          </Card>
        );
      })}
      <Card>
        <p className="text-xs text-gray-400 bg-gray-50 border rounded px-2 py-1 inline-block">À venir</p>
        <p className="font-semibold text-sm text-gray-500 mt-1">Google Calendar · Zapier / Make</p>
        <p className="text-xs text-gray-400">Synchronisation des rendez-vous et automatisations no-code.</p>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Clé API</h3>
        <p className="text-sm text-gray-500">Accès programmatique à votre espace Klientys.</p>
        <div className="flex gap-2">
          <input
            value={revealed && apiKey ? apiKey : maskedKey}
            readOnly
            className="border rounded-lg px-3 py-2 text-sm flex-1 font-mono bg-gray-50 text-gray-600"
          />
          <button onClick={() => setRevealed(v => !v)} className="border px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 shrink-0">
            {revealed ? "Masquer" : "Révéler"}
          </button>
          <button onClick={handleCopy} className="border px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 shrink-0">
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
        <button onClick={handleRegenerate} disabled={regenerating} className="text-xs text-red-500 hover:underline disabled:opacity-50">
          {regenerating ? "Régénération…" : "Régénérer la clé (invalide l'ancienne)"}
        </button>
      </Card>
    </>
  );
}

// ── Section Export & RGPD ─────────────────────────────────────────────────────

function SectionExport() {
  const router = useRouter();
  const [delStep, setDelStep]       = useState(0);
  const [confirm, setConfirm]       = useState("");
  const [exporting, setExporting]   = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [exportError, setExportError] = useState("");

  const requestExport = async () => {
    setExporting(true); setExportError("");
    try {
      await api.exportData();
      setExportDone(true);
    } catch (e: any) {
      setExportError(e.message ?? "Erreur lors de l'export.");
    } finally { setExporting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      await supabase.auth.signOut();
      router.replace("/");
    } catch (e: any) {
      alert(e.message ?? "Erreur lors de la suppression.");
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionTitle title="Export & RGPD" subtitle="Vos droits sur vos données personnelles (RGPD / CCPA)." />
      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Exporter mes données</h3>
        <p className="text-sm text-gray-500">Téléchargez l'ensemble de vos données (contacts, rendez-vous, leads, paramètres) au format JSON.</p>
        {exportDone ? (
          <p className="text-green-600 text-sm">Export téléchargé avec succès.</p>
        ) : (
          <>
            <button onClick={requestExport} disabled={exporting}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {exporting ? "Préparation…" : "Télécharger mes données (JSON)"}
            </button>
            {exportError && <p className="text-red-500 text-sm">{exportError}</p>}
          </>
        )}
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Droit à l'oubli</h3>
        <p className="text-sm text-gray-500">Vous pouvez demander la suppression de toutes vos données conformément au RGPD. Cette action est irréversible.</p>
        <button className="text-sm text-gray-500 hover:underline border px-4 py-2 rounded-lg">
          Contacter le DPO : privacy@example.com
        </button>
      </Card>
      <Card className="border-red-100">
        <h3 className="font-semibold text-sm text-red-600">Supprimer mon compte</h3>
        <p className="text-sm text-gray-500">La suppression est définitive. Toutes vos données seront effacées sous 30 jours.</p>
        {delStep === 0 && (
          <button onClick={() => setDelStep(1)} className="text-red-500 text-sm border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50">
            Je veux supprimer mon compte
          </button>
        )}
        {delStep === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-red-600 font-medium">Tapez "SUPPRIMER" pour confirmer :</p>
            <input value={confirm} onChange={e => setConfirm(e.target.value)}
              className="border border-red-300 rounded-lg px-3 py-2 text-sm w-full" />
            <div className="flex gap-2">
              <button onClick={() => { setDelStep(0); setConfirm(""); }}
                className="px-4 py-2 border rounded-lg text-sm">Annuler</button>
              <button
                disabled={confirm !== "SUPPRIMER" || deleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-red-700">
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Section Activité ──────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, string> = {
  "Connexion":          "🔑",
  "Site publié":        "🌐",
  "Site dépublié":      "🌐",
  "Mot de passe modifié": "🔐",
  "Membre invité":      "👥",
  "Membre retiré":      "👥",
  "Nouvel espace créé": "🏢",
  "Clé API régénérée":  "🔑",
  "Compte désactivé":   "⚠️",
};

function SectionActivite() {
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getActivityLog(50)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SectionTitle title="Journaux d'activité" subtitle="Historique des actions récentes sur votre compte." />
      <Card>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune activité enregistrée pour l'instant.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((e, i) => (
              <div key={e.id ?? i} className="flex items-start gap-3 py-2.5 border-b last:border-0">
                <span className="text-lg leading-none mt-0.5">{ACTION_ICON[e.action] ?? "📋"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{e.action}</p>
                  {e.detail && <p className="text-xs text-gray-400">{e.detail}</p>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">
                  {new Date(e.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ── Section Domaine ───────────────────────────────────────────────────────────

function SectionDomaine({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const [plan, setPlan]               = useState<any>(null);
  const [domainInfo, setDomainInfo]   = useState<any>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [tab, setTab]                 = useState<"connect" | "buy">("connect");

  // Connect form
  const [connectInput, setConnectInput]   = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectMsg, setConnectMsg]       = useState("");

  // OVH search
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching]         = useState(false);
  const [searchMsg, setSearchMsg]         = useState("");

  // Purchase — confirmation inline
  const [confirmPurchase, setConfirmPurchase] = useState<{ domain: string; price_ht: number } | null>(null);
  const [autoRenew, setAutoRenew]             = useState(true);
  const [checkingOut, setCheckingOut]         = useState(false);
  const [purchaseMsg, setPurchaseMsg]         = useState("");

  // Polling
  const [polling, setPolling]             = useState(false);

  // Delete
  const [deleting, setDeleting]           = useState(false);

  const loadData = useCallback(async () => {
    setLoadingInit(true);
    try {
      const [p, d] = await Promise.all([
        api.getMySubscription().catch(() => null),
        api.getDomain().catch(() => null),
      ]);
      setPlan(p);
      setDomainInfo(d);
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Polling automatique toutes les 30s quand le domaine est en attente
  useEffect(() => {
    if (domainInfo?.status !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await api.pollDomainStatus();
        setDomainInfo(res);
      } catch { /* silencieux */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [domainInfo?.status]);

  const hasAccess = plan?.features?.custom_domain === true;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectInput.trim()) return;
    setConnectLoading(true); setConnectMsg("");
    try {
      const res = await api.connectDomain(connectInput.trim());
      setDomainInfo(res);
      setConnectMsg("Domaine ajouté. Configurez le DNS ci-dessous.");
    } catch (err: any) {
      setConnectMsg(`Erreur : ${err.message}`);
    } finally {
      setConnectLoading(false);
    }
  };

  const handlePollStatus = async () => {
    setPolling(true);
    try {
      const res = await api.pollDomainStatus();
      setDomainInfo(res);
      if (res.status === "active") setConnectMsg("Domaine vérifié et actif !");
      else setConnectMsg("DNS pas encore propagé. Réessayez dans quelques minutes.");
    } catch (err: any) {
      setConnectMsg(`Erreur : ${err.message}`);
    } finally {
      setPolling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer le domaine ${domainInfo?.domain} ?`)) return;
    setDeleting(true);
    try {
      await api.deleteDomain();
      setDomainInfo(null);
      setConnectInput("");
      setConnectMsg("");
    } catch (err: any) {
      setConnectMsg(`Erreur : ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchMsg(""); setSearchResults([]);
    try {
      const res = await api.searchDomains(searchQuery.trim());
      setSearchResults(res);
      if (!res.length) setSearchMsg("Aucun résultat.");
    } catch (err: any) {
      setSearchMsg(`Erreur : ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!confirmPurchase) return;
    setCheckingOut(true); setPurchaseMsg("");
    try {
      const base = `${window.location.origin}/dashboard/settings`;
      const res = await api.createDomainPurchaseCheckout(
        confirmPurchase.domain,
        autoRenew,
        `${base}?domain_success=1`,
        `${base}`,
      );
      window.location.href = res.checkout_url;
    } catch (err: any) {
      setPurchaseMsg(`Erreur : ${err.message}`);
      setCheckingOut(false);
    }
  };

  const handleAddonCheckout = async () => {
    try {
      const base = window.location.origin + "/dashboard/settings";
      const res = await api.createDomainAddonCheckout(`${base}?domain_addon=success`, `${base}`);
      window.location.href = res.checkout_url;
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  if (loadingInit) {
    return (
      <>
        <SectionTitle title="Domaine personnalisé" subtitle="Connectez votre site à votre propre nom de domaine." />
        <p className="text-sm text-gray-400">Chargement…</p>
      </>
    );
  }

  return (
    <>
      <SectionTitle
        title="Domaine personnalisé"
        subtitle="Connectez votre site à votre propre nom de domaine (ex: www.monsite.be)."
      />

      {/* ── Accès verrouillé ── */}
      {!hasAccess && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-amber-900">Fonctionnalité Premium</p>
              <p className="text-sm text-amber-700 mt-1">
                Le domaine personnalisé est <strong>inclus dans le plan Business</strong>. Si vous êtes
                sur un autre plan, vous pouvez l'activer pour <strong>+5€/mois</strong>.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={handleAddonCheckout}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
                >
                  Activer pour +5€/mois
                </button>
                <button
                  onClick={() => onNavigate("abonnement")}
                  className="border border-amber-400 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100"
                >
                  Passer au plan Business
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Domaine actif ── */}
      {hasAccess && domainInfo?.status === "active" && (
        <Card className="border-green-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <p className="font-semibold text-sm text-gray-800">{domainInfo.domain}</p>
                <p className="text-xs text-green-600 mt-0.5">Domaine actif et fonctionnel</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`https://${domainInfo.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
              >
                Visiter
              </a>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-500 hover:underline disabled:opacity-50"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Domaine en attente de vérification DNS ── */}
      {hasAccess && domainInfo?.status === "pending" && (
        <Card className="border-amber-200">
          <h3 className="font-semibold text-sm text-amber-800">En attente de validation</h3>

          {/* Barre de progression DNS → SSL → Actif */}
          <div className="flex items-center gap-1 text-xs">
            {[
              { label: "DNS propagé",  done: domainInfo.propagated },
              { label: "SSL actif",    done: domainInfo.ssl },
              { label: "Domaine actif", done: false },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-1">
                <span className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
                  step.done ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                }`}>
                  {step.done ? "✓" : "○"} {step.label}
                </span>
                {i < arr.length - 1 && <span className="text-gray-300">→</span>}
              </div>
            ))}
          </div>

          {/* Conflits DNS */}
          {domainInfo.conflicts?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <strong>Conflit DNS détecté :</strong> un enregistrement existant empêche la validation.
              Supprimez les enregistrements conflictuels chez votre registrar.
            </div>
          )}

          <p className="text-sm text-gray-600">
            {domainInfo.source === "ovh_purchased"
              ? "Les DNS ont été configurés automatiquement. La propagation prend quelques minutes."
              : "Chez votre registrar, créez l'enregistrement suivant :"}
          </p>

          {domainInfo.source !== "ovh_purchased" && (
            <div className="bg-gray-50 rounded-lg border p-4 font-mono text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-gray-500 block">Type</span><strong>{domainInfo.dns_record_type}</strong></div>
                <div><span className="text-gray-500 block">Nom / Hôte</span><strong>{domainInfo.dns_record_name}</strong></div>
                <div><span className="text-gray-500 block">Valeur / Cible</span><strong>{domainInfo.dns_record_value}</strong></div>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Vérification automatique toutes les 30 secondes. La propagation DNS peut prendre jusqu'à 48h.
          </p>

          <div className="flex gap-2 items-center flex-wrap">
            <button
              onClick={handlePollStatus}
              disabled={polling}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {polling ? "Vérification…" : "Vérifier maintenant"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-500 hover:underline disabled:opacity-50"
            >
              {deleting ? "Suppression…" : "Annuler"}
            </button>
          </div>
          {connectMsg && (
            <p className={`text-sm ${connectMsg.startsWith("Erreur") ? "text-red-500" : "text-green-600"}`}>
              {connectMsg}
            </p>
          )}
        </Card>
      )}

      {/* ── Formulaires (si pas encore de domaine) ── */}
      {hasAccess && !domainInfo && (
        <>
          {/* Tabs */}
          <div className="flex border-b">
            {(["connect", "buy"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "connect" ? "J'ai déjà un domaine" : "Acheter un domaine"}
              </button>
            ))}
          </div>

          {/* Connecter un domaine existant */}
          {tab === "connect" && (
            <Card>
              <h3 className="font-semibold text-sm text-gray-700">Connecter votre domaine</h3>
              <p className="text-sm text-gray-500">
                Entrez votre nom de domaine (ex: www.monsite.be). Nous vous fournirons les
                instructions DNS à configurer chez votre registrar.
              </p>
              <form onSubmit={handleConnect} className="flex gap-2">
                <input
                  type="text"
                  value={connectInput}
                  onChange={e => setConnectInput(e.target.value)}
                  placeholder="www.monsite.be"
                  className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  type="submit"
                  disabled={connectLoading || !connectInput.trim()}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40"
                >
                  {connectLoading ? "Connexion…" : "Connecter"}
                </button>
              </form>
              {connectMsg && (
                <p className={`text-sm ${connectMsg.startsWith("Erreur") ? "text-red-500" : "text-green-600"}`}>
                  {connectMsg}
                </p>
              )}
            </Card>
          )}

          {/* Acheter un domaine via OVH */}
          {tab === "buy" && (
            <Card>
              <h3 className="font-semibold text-sm text-gray-700">Chercher un nom de domaine</h3>
              <p className="text-sm text-gray-500">
                Tapez un nom (sans extension). Nous vérifions la disponibilité sur .be, .fr, .com, .eu et .net.
              </p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="monsite"
                  className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40"
                >
                  {searching ? "Recherche…" : "Rechercher"}
                </button>
              </form>

              {searchMsg && <p className="text-sm text-gray-400">{searchMsg}</p>}

              {searchResults.length > 0 && (
                <div className="space-y-2 mt-1">
                  {searchResults.map(r => (
                    <div
                      key={r.domain}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                        r.available ? "bg-white" : "bg-gray-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono font-medium ${r.available ? "text-gray-800" : "text-gray-400"}`}>
                          {r.domain}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.available ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                        }`}>
                          {r.available ? "Disponible" : "Pris"}
                        </span>
                      </div>
                      {r.available && (
                        <div className="flex items-center gap-3">
                          {r.price_ht != null && (
                            <span className="text-sm text-gray-500">{r.price_ht.toFixed(2)}€ HT/an</span>
                          )}
                          <button
                            onClick={() => { setConfirmPurchase({ domain: r.domain, price_ht: r.price_ht ?? 0 }); setPurchaseMsg(""); }}
                            disabled={confirmPurchase?.domain === r.domain}
                            className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-40"
                          >
                            Acheter
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Carte de confirmation ── */}
              {confirmPurchase && (
                <div className="border-2 border-primary-200 rounded-xl p-5 bg-primary-50 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">
                        Confirmer l'achat de <span className="font-mono">{confirmPurchase.domain}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {confirmPurchase.price_ht.toFixed(2)}€ HT/an · paiement sécurisé via Stripe
                      </p>
                    </div>
                    <button onClick={() => setConfirmPurchase(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                  </div>

                  {/* Toggle renouvellement automatique */}
                  <div className="bg-white border rounded-lg p-4 space-y-1">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Renouvellement automatique</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {autoRenew
                            ? "Votre domaine sera renouvelé automatiquement chaque année."
                            : "Vous devrez renouveler manuellement avant expiration — risque de perte du domaine."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoRenew(v => !v)}
                        className={`ml-4 w-10 h-5 rounded-full transition-colors relative shrink-0 ${autoRenew ? "bg-primary-600" : "bg-gray-300"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${autoRenew ? "left-5" : "left-0.5"}`} />
                      </button>
                    </label>
                    {!autoRenew && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        Sans renouvellement automatique, votre domaine peut être libéré et racheté par quelqu'un d'autre à expiration.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmPurchase}
                      disabled={checkingOut}
                      className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex-1"
                    >
                      {checkingOut ? "Redirection vers le paiement…" : `Payer ${confirmPurchase.price_ht.toFixed(2)}€ HT`}
                    </button>
                    <button
                      onClick={() => setConfirmPurchase(null)}
                      className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>

                  {purchaseMsg && (
                    <p className="text-sm text-red-500">{purchaseMsg}</p>
                  )}
                </div>
              )}

              {!confirmPurchase && purchaseMsg && (
                <p className={`text-sm ${purchaseMsg.startsWith("Erreur") ? "text-red-500" : "text-green-600"}`}>
                  {purchaseMsg}
                </p>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const SECTION_MAP: Record<Exclude<Section, "domaine">, React.FC> = {
  profil:        SectionProfil,
  securite:      SectionSecurite,
  site:          SectionSite,
  metriques:     SectionMetriques,
  abonnement:    SectionAbonnement,
  notifications: SectionNotifications,
  preferences:   SectionPreferences,
  membres:       SectionMembres,
  integrations:  SectionIntegrations,
  export:        SectionExport,
  activite:      SectionActivite,
};

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [active, setActive] = useState<Section>("profil");
  const activeItem = NAV.find(n => n.key === active)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          <span className="hidden sm:inline">{t.sett_back}</span>
          <span className="sm:hidden">←</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 truncate">
          <span className="hidden sm:inline">{t.nav_settings}</span>
          <span className="sm:hidden">{activeItem.icon} {activeItem.label}</span>
        </h1>
      </div>

      {/* Mobile — sélecteur déroulant */}
      <div className="md:hidden bg-white border-b px-4 py-3">
        <select
          value={active}
          onChange={e => setActive(e.target.value as Section)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {NAV.map(item => (
            <option key={item.key} value={item.key}>
              {item.icon}  {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar desktop */}
        <aside id="settings-nav" className="w-56 shrink-0 py-6 px-3 hidden md:block">
          <nav className="space-y-0.5">
            {NAV.map(item => (
              <button
                key={item.key}
                id={`settings-${item.key}-btn`}
                onClick={() => setActive(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  active === item.key
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenu */}
        <main className="flex-1 py-6 px-4 sm:px-6 min-w-0 space-y-4">
          {active === "domaine"
            ? <SectionDomaine onNavigate={setActive} />
            : (() => { const S = SECTION_MAP[active]; return <S />; })()
          }
        </main>
      </div>
    </div>
  );
}
