"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, supabase } from "../../../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section =
  | "profil" | "securite" | "site"
  | "abonnement" | "notifications" | "preferences"
  | "membres" | "integrations" | "export" | "activite";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "profil",        label: "Profil",          icon: "👤" },
  { key: "securite",      label: "Sécurité",        icon: "🔐" },
  { key: "site",          label: "Mon site",        icon: "🌐" },
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
      className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
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
        className={`w-10 h-5 rounded-full transition-colors relative ${checked ? "bg-indigo-600" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`}/>
      </button>
    </label>
  );
}

// ── Section Profil ────────────────────────────────────────────────────────────

function SectionProfil() {
  const [user, setUser]     = useState<any>(null);
  const [name, setName]     = useState("");
  const [lang, setLang]     = useState("fr");
  const [tz, setTz]         = useState("Europe/Brussels");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUser(user);
      setName(user.user_metadata?.full_name ?? "");
      setLang(user.user_metadata?.lang ?? "fr");
      setTz(user.user_metadata?.timezone ?? "Europe/Brussels");
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { full_name: name, lang, timezone: tz } });
      setMsg("Profil mis à jour.");
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionTitle title="Profil utilisateur" subtitle="Vos informations personnelles et préférences de compte." />
      <Card>
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 shrink-0">
              {name ? name[0].toUpperCase() : user?.email?.[0].toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">Compte créé le {user?.created_at ? new Date(user.created_at).toLocaleDateString("fr-BE") : "—"}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom complet</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jean Dupont"
              className="border rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input value={user?.email ?? ""} disabled
              className="border rounded-lg px-3 py-2 w-full text-sm bg-gray-50 text-gray-400" />
            <p className="text-xs text-gray-400 mt-1">La modification de l'email n'est pas disponible pour le moment.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Langue</label>
              <select value={lang} onChange={e => setLang(e.target.value)} className="border rounded-lg px-3 py-2 w-full text-sm">
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="nl">Nederlands</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fuseau horaire</label>
              <select value={tz} onChange={e => setTz(e.target.value)} className="border rounded-lg px-3 py-2 w-full text-sm">
                <option value="Europe/Brussels">Europe/Brussels (UTC+1/+2)</option>
                <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
                <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <Feedback msg={msg} />
          <SaveBtn loading={saving} />
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
          <button onClick={sendReset} className="text-indigo-600 text-sm hover:underline">
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
                className="text-xs text-indigo-500 hover:underline mt-1 block">
                {origin.replace(/^https?:\/\//, "")}/{tenantSlug}
              </a>
            )}
          </div>
          <button onClick={togglePublish}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${site?.status === "published" ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-green-600 text-white hover:bg-green-700"}`}>
            {site?.status === "published" ? "Dépublier" : "Publier"}
          </button>
        </div>
      </Card>
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
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                Portail de facturation Stripe
              </button>
              {!sub && (
                <button onClick={() => window.location.href = "/dashboard"}
                  className="border border-indigo-300 text-indigo-600 px-4 py-2 rounded-lg text-sm hover:bg-indigo-50">
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
  const [prefs, setPrefs] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("notif_prefs");
      return stored ? JSON.parse(stored) : NOTIF_DEFAULTS;
    }
    return NOTIF_DEFAULTS;
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => setPrefs((p: any) => ({ ...p, [key]: !p[key] }));

  const save = () => {
    localStorage.setItem("notif_prefs", JSON.stringify(prefs));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
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
        <button onClick={save} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700">
          Sauvegarder
        </button>
        {saved && <p className="text-green-600 text-sm">Préférences sauvegardées.</p>}
      </div>
    </>
  );
}

// ── Section Préférences ───────────────────────────────────────────────────────

function SectionPreferences() {
  const [darkMode, setDarkMode]     = useState(false);
  const [compactView, setCompact]   = useState(false);
  const [dateFormat, setDateFormat] = useState("dd/mm/yyyy");
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem("ui_prefs") ?? "{}");
    setDarkMode(p.darkMode ?? false);
    setCompact(p.compactView ?? false);
    setDateFormat(p.dateFormat ?? "dd/mm/yyyy");
  }, []);

  const save = () => {
    localStorage.setItem("ui_prefs", JSON.stringify({ darkMode, compactView, dateFormat }));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
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
        <button onClick={save} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700">
          Sauvegarder
        </button>
        {saved && <p className="text-green-600 text-sm">Préférences sauvegardées.</p>}
      </div>
    </>
  );
}

// ── Section Membres ───────────────────────────────────────────────────────────

function SectionMembres() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState("");
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: mem } = await supabase.from("membership").select("tenant_id").eq("user_id", user.id).single();
      if (!mem) return;
      const { data } = await supabase
        .from("membership")
        .select("id, role, user_id, created_at")
        .eq("tenant_id", mem.tenant_id);
      setMembers(data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", admin: "Admin", member: "Membre" };

  return (
    <>
      <SectionTitle title="Équipe" subtitle="Gérez les membres qui ont accès à votre espace." />
      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Membres actuels</h3>
        {loading ? <p className="text-sm text-gray-400">Chargement…</p> : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                    {m.user_id?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{m.user_id}</p>
                    <p className="text-xs text-gray-400">Membre depuis {new Date(m.created_at).toLocaleDateString("fr-BE")}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
              </div>
            ))}
            {members.length === 0 && <p className="text-sm text-gray-400">Aucun membre pour l'instant.</p>}
          </div>
        )}
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Inviter un membre</h3>
        <p className="text-sm text-gray-500">L'invitation sera envoyée par email. <span className="text-amber-600 font-medium">(Fonctionnalité à venir)</span></p>
        <div className="flex gap-2">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button onClick={() => { setInvited(true); setEmail(""); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
            Inviter
          </button>
        </div>
        {invited && <p className="text-green-600 text-sm">Invitation envoyée (simulation).</p>}
      </Card>
    </>
  );
}

// ── Section Intégrations ──────────────────────────────────────────────────────

function SectionIntegrations() {
  return (
    <>
      <SectionTitle title="Intégrations & API" subtitle="Connectez votre espace à des services tiers." />
      {[
        { name: "Stripe", desc: "Paiements et abonnements", status: "Connecté", color: "text-green-600 bg-green-50" },
        { name: "Resend", desc: "Envoi d'emails transactionnels", status: "Connecté", color: "text-green-600 bg-green-50" },
        { name: "Google Calendar", desc: "Synchronisation des rendez-vous", status: "À venir", color: "text-gray-500 bg-gray-50" },
        { name: "WhatsApp Business", desc: "Agent de conversion client", status: "À venir", color: "text-gray-500 bg-gray-50" },
        { name: "Zapier / Make", desc: "Automatisations no-code", status: "À venir", color: "text-gray-500 bg-gray-50" },
      ].map(item => (
        <Card key={item.name}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-800">{item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.color}`}>{item.status}</span>
          </div>
        </Card>
      ))}
      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Clé API</h3>
        <p className="text-sm text-gray-500">Accès programmatique à votre compte. <span className="text-amber-600 font-medium">(Fonctionnalité à venir)</span></p>
        <div className="flex gap-2">
          <input value="sk_•••••••••••••••••••••••••••••" readOnly
            className="border rounded-lg px-3 py-2 text-sm flex-1 font-mono bg-gray-50 text-gray-400" />
          <button className="border px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Copier</button>
        </div>
      </Card>
    </>
  );
}

// ── Section Export & RGPD ─────────────────────────────────────────────────────

function SectionExport() {
  const [delStep, setDelStep]   = useState(0);
  const [confirm, setConfirm]   = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const requestExport = () => {
    setExporting(true);
    setTimeout(() => { setExporting(false); setExportDone(true); }, 1500);
  };

  return (
    <>
      <SectionTitle title="Export & RGPD" subtitle="Vos droits sur vos données personnelles (RGPD / CCPA)." />
      <Card>
        <h3 className="font-semibold text-sm text-gray-700">Exporter mes données</h3>
        <p className="text-sm text-gray-500">Téléchargez l'ensemble de vos données (contacts, rendez-vous, leads, paramètres) au format JSON.</p>
        {exportDone ? (
          <p className="text-green-600 text-sm">Votre export a été demandé. Vous recevrez un email avec le lien de téléchargement sous 24h.</p>
        ) : (
          <button onClick={requestExport} disabled={exporting}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {exporting ? "Préparation…" : "Demander l'export"}
          </button>
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
              <button disabled={confirm !== "SUPPRIMER"}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-red-700">
                Confirmer la suppression
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Section Activité ──────────────────────────────────────────────────────────

function SectionActivite() {
  const MOCK = [
    { action: "Connexion", detail: "Chrome · Windows", date: new Date().toISOString(), icon: "🔑" },
    { action: "Site publié", detail: "Vitrine mise en ligne", date: new Date(Date.now()-3600000).toISOString(), icon: "🌐" },
    { action: "Mot de passe modifié", detail: "Depuis les paramètres", date: new Date(Date.now()-86400000).toISOString(), icon: "🔐" },
    { action: "RDV créé", detail: "Marie Dupont — 14h00", date: new Date(Date.now()-172800000).toISOString(), icon: "📅" },
    { action: "Connexion", detail: "Safari · iPhone", date: new Date(Date.now()-259200000).toISOString(), icon: "🔑" },
  ];
  return (
    <>
      <SectionTitle title="Journaux d'activité" subtitle="Historique des actions récentes sur votre compte." />
      <Card>
        <div className="space-y-1">
          {MOCK.map((e, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b last:border-0">
              <span className="text-lg leading-none mt-0.5">{e.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{e.action}</p>
                <p className="text-xs text-gray-400">{e.detail}</p>
              </div>
              <p className="text-xs text-gray-400 shrink-0">
                {new Date(e.date).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center pt-2">Les journaux complets seront disponibles dans une prochaine mise à jour.</p>
      </Card>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const SECTION_MAP: Record<Section, React.FC> = {
  profil:        SectionProfil,
  securite:      SectionSecurite,
  site:          SectionSite,
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
  const [active, setActive] = useState<Section>("profil");
  const ActiveSection = SECTION_MAP[active];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Retour au dashboard
        </button>
        <h1 className="text-xl font-bold text-gray-900">Paramètres</h1>
      </div>

      <div className="max-w-6xl mx-auto flex gap-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 py-6 px-3 hidden md:block">
          <nav className="space-y-0.5">
            {NAV.map(item => (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  active === item.key
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden flex overflow-x-auto gap-1 px-4 py-3 border-b bg-white w-full">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active === item.key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <main className="flex-1 py-6 px-6 max-w-2xl space-y-4">
          <ActiveSection />
        </main>
      </div>
    </div>
  );
}
