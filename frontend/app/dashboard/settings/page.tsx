"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api, supabase } from "../../../lib/api";
import { useLanguage, LANGUAGES } from "../../../contexts/LanguageContext";
import DemandPotentialCard from "../analytics/DemandPotentialCard";
import metiers from "../../../data/metiers.json";
import villes from "../../../data/villes.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section =
  | "profil" | "securite" | "site" | "metriques"
  | "abonnement" | "notifications" | "preferences"
  | "membres" | "integrations" | "export" | "activite" | "domaine" | "annuaire";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "profil",        label: "Profil",          icon: "👤" },
  { key: "securite",      label: "Sécurité",        icon: "🔐" },
  { key: "site",          label: "Mon site",        icon: "🌐" },
  { key: "domaine",       label: "Domaine",         icon: "🔗" },
  { key: "annuaire",      label: "Annuaire public",  icon: "📋" },
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
  const [user, setUser]               = useState<any>(null);
  const [name, setName]               = useState("");
  const [tz, setTz]                   = useState("Europe/Brussels");
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      const sessionUser = u ?? (await supabase.auth.getSession()).data.session?.user;
      if (!sessionUser) return;
      setUser(sessionUser);
      const m = sessionUser.user_metadata ?? {};
      const fullName = m.full_name ?? [m.first_name, m.last_name].filter(Boolean).join(" ");
      setName(fullName);
      setTz(m.timezone ?? "Europe/Brussels");
      setAvatarUrl(m.avatar_url ?? null);
    };
    load();
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setMsg("");
    try {
      const { url } = await api.uploadSitePhoto(file, "avatar");
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      setAvatarUrl(url);
      api.logActivity({ action: "Photo de profil mise à jour" }).catch(() => {});
    } catch (err: any) {
      setMsg(`Erreur upload : ${err.message}`);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = async (e: React.SyntheticEvent) => {
    e.preventDefault(); setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { full_name: name, lang: ctxLang, timezone: tz } });
      api.logActivity({ action: "Profil mis à jour", detail: name || undefined }).catch(() => {});
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
            {/* Avatar avec overlay upload */}
            <div className="relative w-16 h-16 shrink-0 group">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={name || "Avatar"} width={64} height={64}
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary-100" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
                title="Changer la photo"
              >
                {uploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Compte créé le {user?.created_at ? new Date(user.created_at).toLocaleDateString("fr-BE") : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Survolez la photo pour la modifier</p>
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
  const [current, setCurrent]     = useState("");
  const [next, setNext]           = useState("");
  const [confirm, setConfirm]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isOAuth, setIsOAuth]     = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const provider = user?.app_metadata?.provider;
      setIsOAuth(provider === "google" || provider === "github");
    });
  }, []);

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
        {isOAuth ? (
          <p className="text-sm text-gray-500 bg-gray-50 border rounded-lg px-4 py-3">
            Votre compte est connecté via Google. La modification du mot de passe n'est pas disponible pour les connexions OAuth.
          </p>
        ) : (
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
        )}
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
  const [publishing, setPublishing]       = useState(false);
  const [confirmDepublish, setConfirmDepublish] = useState(false);
  const [title, setTitle]                 = useState("");
  const [absenceMode, setAbsenceMode]     = useState(false);
  const [absenceMessage, setAbsenceMessage] = useState("");
  const [msg, setMsg]                     = useState("");
  const [publishMsg, setPublishMsg]       = useState("");
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

  const handlePublish = async () => {
    if (!site) return;
    setPublishing(true); setPublishMsg("");
    try {
      await api.publishSite(site.id);
      setSite({ ...site, status: "published" });
      setPublishMsg("✓ Site publié — visible par vos visiteurs.");
    } catch (err: any) {
      setPublishMsg(err?.message ?? "Erreur lors de la publication.");
    } finally { setPublishing(false); }
  };

  const handleUnpublish = async () => {
    if (!site) return;
    setPublishing(true); setConfirmDepublish(false); setPublishMsg("");
    try {
      await api.unpublishSite(site.id);
      setSite({ ...site, status: "draft" });
      setPublishMsg("Site dépublié — plus visible en ligne.");
    } catch (err: any) {
      setPublishMsg(err?.message ?? "Erreur lors de la dépublication.");
    } finally { setPublishing(false); }
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
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-semibold text-sm text-gray-700">Publication</p>
              <div className="flex items-center gap-2">
                {site?.status === "published" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Publié — visible en ligne
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    Brouillon — non visible
                  </span>
                )}
              </div>
              {tenantSlug && site?.status === "published" && (
                <a href={`${origin}/${tenantSlug}`} target="_blank" rel="noreferrer"
                  className="text-xs text-primary-500 hover:underline flex items-center gap-1 mt-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                  {origin.replace(/^https?:\/\//, "")}/{tenantSlug}
                </a>
              )}
            </div>
            {tenantSlug && (
              <a href={`${origin}/${tenantSlug}?preview=1`} target="_blank" rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                Prévisualiser
              </a>
            )}
          </div>

          {/* Publier */}
          {site?.status !== "published" && (
            <button onClick={handlePublish} disabled={publishing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors">
              {publishing ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Publication en cours…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Publier le site</>
              )}
            </button>
          )}

          {/* Dépublier avec confirmation */}
          {site?.status === "published" && !confirmDepublish && (
            <button onClick={() => setConfirmDepublish(true)} disabled={publishing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 disabled:opacity-60 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
              </svg>
              Dépublier le site
            </button>
          )}

          {site?.status === "published" && confirmDepublish && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">Confirmer la dépublication ?</p>
              <p className="text-xs text-red-600">Votre site ne sera plus accessible en ligne. Vos données sont conservées et vous pourrez le republier à tout moment.</p>
              <div className="flex gap-2">
                <button onClick={handleUnpublish} disabled={publishing}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                  {publishing ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : "Confirmer"}
                </button>
                <button onClick={() => setConfirmDepublish(false)}
                  className="flex-1 px-3 py-2 rounded-lg font-medium text-sm bg-white text-gray-600 border border-gray-200 hover:bg-gray-50">
                  Annuler
                </button>
              </div>
            </div>
          )}

          {publishMsg && (
            <p className={`text-xs font-medium ${publishMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
              {publishMsg}
            </p>
          )}
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

const PLAN_LABELS: Record<string, { price: string; desc: string }> = {
  "Essentiel": { price: "29,90", desc: "Site vitrine, réservations, 100 contacts" },
  "Pro":       { price: "59,90", desc: "CRM complet, agents IA, analytics, domaine inclus" },
  "Business":  { price: "99,90", desc: "Multi-espaces, équipe, account manager dédié" },
};

function SectionAbonnement() {
  const [sub, setSub]       = useState<any>(null);
  const [plans, setPlans]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading]     = useState(false);
  const [portalError, setPortalError]         = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [plansData] = await Promise.all([api.getPlans()]);
        setPlans(plansData);
      } catch { /* plans non critiques */ }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: mem } = await supabase.from("membership").select("tenant_id").eq("user_id", user.id).single();
      if (!mem) { setLoading(false); return; }
      const { data } = await supabase
        .from("subscription")
        .select("*, plan:plan_id(name, price_monthly)")
        .eq("tenant_id", mem.tenant_id)
        .in("status", ["active", "trialing"])
        .maybeSingle();
      setSub(data);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    setPortalError("");
    try {
      const base = window.location.origin;
      const { checkout_url } = await api.createCheckout({
        plan_id: planId,
        success_url: `${base}/dashboard/settings?checkout_success=1`,
        cancel_url:  `${base}/dashboard/settings`,
      });
      window.location.href = checkout_url;
    } catch (e: any) {
      setPortalError(e?.message ?? "Erreur lors de l'accès au paiement.");
      setCheckoutLoading(null);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    setPortalError("");
    try {
      const { url } = await api.billingPortal();
      if (url) window.open(url, "_blank");
    } catch (e: any) {
      setPortalError(e?.message ?? "Portail indisponible.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <>
      <SectionTitle title="Abonnement & facturation" subtitle="Votre offre actuelle, vos factures et vos moyens de paiement." />
      {loading ? <p className="text-sm text-gray-400">Chargement…</p> : (
        <>
          {/* Plan actuel */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{sub?.plan?.name ?? "Aucun abonnement actif"}</p>
                {sub?.plan?.price_monthly != null && (
                  <p className="text-sm text-gray-500 mt-0.5">{Number(sub.plan.price_monthly).toFixed(2).replace(".", ",")} € / mois</p>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${sub ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {sub ? "Actif" : "Inactif"}
              </span>
            </div>
          </Card>

          {/* Choix de plan — affiché si pas d'abo actif */}
          {!sub && plans.length > 0 && (
            <Card>
              <h3 className="font-semibold text-sm text-gray-700 mb-3">Choisir un plan</h3>
              <div className="flex flex-col gap-3">
                {plans.filter(p => p.stripe_price_id).map((plan) => {
                  const label = PLAN_LABELS[plan.name];
                  return (
                    <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div>
                        <p className="font-medium text-sm text-gray-800">{plan.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {label?.desc ?? ""} — {label?.price ?? Number(plan.price_monthly).toFixed(2).replace(".", ",")} €/mois
                        </p>
                      </div>
                      <button
                        onClick={() => handleCheckout(plan.id)}
                        disabled={checkoutLoading === plan.id}
                        className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap ml-3"
                      >
                        {checkoutLoading === plan.id ? "Redirection…" : "S'abonner →"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Portail Stripe — affiché si abo actif */}
          {sub && (
            <Card>
              <h3 className="font-semibold text-sm text-gray-700">Gérer mon abonnement</h3>
              <p className="text-sm text-gray-500 mt-1">Modifier votre plan, consulter les factures ou mettre à jour votre moyen de paiement.</p>
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="mt-3 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {portalLoading ? "Ouverture…" : "Portail de facturation Stripe →"}
              </button>
            </Card>
          )}

          {portalError && (
            <p className="text-sm text-red-500 mt-1">{portalError}</p>
          )}

          {/* Résiliation */}
          {sub && (
            <Card className="border-red-100">
              <h3 className="font-semibold text-sm text-red-600">Résilier l'abonnement</h3>
              <p className="text-sm text-gray-500 mt-1">La résiliation est effective à la fin de la période en cours. Vos données sont conservées 30 jours.</p>
              <button onClick={openPortal} disabled={portalLoading} className="mt-2 text-red-500 text-sm hover:underline disabled:opacity-50">
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
          <Toggle
            checked={darkMode}
            onChange={(v) => {
              setDarkMode(v);
              window.dispatchEvent(new CustomEvent("klientys-darkmode", { detail: { darkMode: v } }));
            }}
            label="Mode sombre"
          />
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

// ── Google Analytics Card ─────────────────────────────────────────────────────

function GoogleAnalyticsCard() {
  const [gaStatus, setGaStatus] = useState<{
    connected: boolean; property_configured: boolean;
    ga4_property_id: string | null; connected_at: string | null;
  } | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    api.getGoogleAnalyticsStatus()
      .then(s => { setGaStatus(s); if (s.ga4_property_id) setPropertyId(s.ga4_property_id.replace(/^properties\//, "")); })
      .catch(() => setGaStatus({ connected: false, property_configured: false, ga4_property_id: null, connected_at: null }));
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    localStorage.setItem("klientys_ga_connect", "1");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "email profile https://www.googleapis.com/auth/analytics.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const handleSave = async () => {
    const digits = propertyId.trim().replace(/^properties\//, "");
    if (!digits) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      await api.configureGoogleAnalytics(`properties/${digits}`);
      setSaved(true);
      setGaStatus(prev => prev ? { ...prev, property_configured: true, ga4_property_id: `properties/${digits}` } : prev);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'enregistrement");
    } finally { setSaving(false); }
  };

  const statusLabel = gaStatus === null ? "…"
    : gaStatus.property_configured ? "Connecté ✓"
    : gaStatus.connected ? "Compte lié, ID manquant"
    : "Non connecté";
  const statusColor = gaStatus?.property_configured ? "bg-green-50 text-green-600"
    : gaStatus?.connected ? "bg-amber-50 text-amber-600"
    : "bg-gray-50 text-gray-400";

  return (
    <Card>
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(251,188,5,.12)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22 12C22 6.477 17.523 2 12 2S2 6.477 2 12s4.477 10 10 10 10-4.477 10-10z" fill="#FBBC05" opacity=".2"/>
              <path d="M15 8.5A3.5 3.5 0 0 0 8.5 12v4" stroke="#FBBC05" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="15" cy="8.5" r="1.5" fill="#FBBC05"/>
              <circle cx="8.5" cy="16" r="1.5" fill="#4285F4"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">Google Analytics 4</p>
            <p className="text-xs text-gray-500 mt-0.5">Statistiques de visites de votre site vitrine</p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Pas encore connecté */}
      {gaStatus && !gaStatus.connected && (
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm text-gray-600">
            Connectez votre compte Google pour voir les statistiques de votre site directement dans votre tableau de bord.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.16C6.51 42.62 14.62 48 24 48z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.78-3-.78-4.59s.27-3.14.78-4.59l-7.98-6.16C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.75l7.97-6.16z"/>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.97 6.16C12.43 13.72 17.74 9.5 24 9.5z"/>
            </svg>
            {connecting ? "Redirection vers Google…" : "Connecter mon compte Google"}
          </button>
        </div>
      )}

      {/* Connecté — demander l'ID de propriété */}
      {gaStatus?.connected && (
        <div className="border-t pt-4 space-y-4">

          {/* Guide visuel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Identifiant de votre propriété GA4</p>
              <button
                onClick={() => setShowHelp(v => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showHelp ? "Masquer l'aide" : "Où trouver cet ID ?"}
              </button>
            </div>

            {showHelp && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3 text-sm">
                <p className="font-semibold text-blue-800 mb-3">En 3 étapes :</p>
                <div className="space-y-2.5">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                    <p className="text-blue-800">
                      Ouvrez{" "}
                      <a href="https://analytics.google.com" target="_blank" rel="noreferrer" className="font-semibold underline">
                        analytics.google.com
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                    <p className="text-blue-800">
                      En bas à gauche, cliquez sur <strong>⚙️ Administration</strong>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                    <p className="text-blue-800">
                      Dans la colonne <strong>Propriété</strong>, cliquez sur{" "}
                      <strong>Paramètres de la propriété</strong> — l&apos;ID (une suite de chiffres) est affiché en haut à droite.
                    </p>
                  </div>
                </div>
                <div className="mt-3 bg-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                  Exemple : si vous voyez <strong>123456789</strong>, saisissez uniquement <strong>123456789</strong>.
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1 flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
                <span className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-r shrink-0 select-none">properties/</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={propertyId}
                  onChange={e => setPropertyId(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456789"
                  className="flex-1 px-3 py-2 text-sm outline-none bg-white"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !propertyId.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: saved ? "#16a34a" : "var(--primary-600, #2563eb)" }}
              >
                {saving ? "…" : saved ? "Enregistré ✓" : "Enregistrer"}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            {gaStatus.property_configured && !saved && (
              <p className="text-xs text-gray-400 mt-1.5">
                ID actuel : <code className="bg-gray-100 px-1 rounded">{gaStatus.ga4_property_id}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Section Intégrations ──────────────────────────────────────────────────────

function SectionIntegrations() {
  return (
    <>
      <SectionTitle title="Intégrations" subtitle="Connectez votre espace à des services tiers." />
      <GoogleAnalyticsCard />
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
      api.logActivity({ action: "Export données RGPD" }).catch(() => {});
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
        <a
          href="mailto:support@klientys.co?subject=Droit à l'oubli — suppression de mes données"
          className="inline-block text-sm text-primary-600 hover:underline border border-primary-200 px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Contacter le support : support@klientys.co
        </a>
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
  "Connexion":                    "🔑",
  "Site publié":                  "🌐",
  "Site dépublié":                "🌐",
  "Mot de passe modifié":         "🔐",
  "Membre invité":                "👥",
  "Membre retiré":                "👥",
  "Nouvel espace créé":           "🏢",
  "Clé API régénérée":            "🔑",
  "Compte désactivé":             "⚠️",
  "Profil mis à jour":            "👤",
  "Photo de profil mise à jour":  "📷",
  "Export données RGPD":          "📤",
};

const PAGE_SIZE = 10;

function SectionActivite() {
  const [logs, setLogs]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const offsetRef                 = useRef(0);
  const busyRef                   = useRef(false);
  const sentinelRef               = useRef<HTMLDivElement>(null);

  const fetchMore = useCallback(async () => {
    if (busyRef.current || !hasMore) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const data = await api.getActivityLog(PAGE_SIZE, offsetRef.current);
      setLogs(prev => [...prev, ...data]);
      offsetRef.current += data.length;
      if (data.length < PAGE_SIZE) setHasMore(false);
    } catch {
      setHasMore(false);
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore]);

  useEffect(() => {
    fetchMore().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchMore();
    }, { rootMargin: "100px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [fetchMore, hasMore]);

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
            {/* Sentinel pour l'infinite scroll */}
            <div ref={sentinelRef} className="pt-1">
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              )}
              {!hasMore && logs.length > PAGE_SIZE && (
                <p className="text-xs text-gray-400 text-center py-2">Tout l'historique est chargé.</p>
              )}
            </div>
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
    const cleaned = connectInput.trim();
    if (!cleaned) return;
    if (!cleaned.includes(".")) {
      setConnectMsg("Erreur : entrez le domaine complet avec extension (ex: www.monsite.be)");
      return;
    }
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

// ── Section Annuaire ──────────────────────────────────────────────────────────

function SectionAnnuaire() {
  const [listing, setListing]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");

  const [isListed, setIsListed]           = useState(false);
  const [metierSlug, setMetierSlug]       = useState("");
  const [customMetierLabel, setCustomMetierLabel] = useState("");
  const [displayName, setDisplayName]     = useState("");
  const [tagline, setTagline]             = useState("");
  const [zones, setZones]                 = useState<string[]>([]);
  const [primaryZone, setPrimaryZone]     = useState("");
  const [acceptsBooking, setAcceptsBooking] = useState(true);
  const [zoneInput, setZoneInput]         = useState("");

  useEffect(() => {
    api.getDirectoryListing()
      .then(data => {
        if (data) {
          setListing(data);
          setIsListed(data.is_listed ?? false);
          const knownMetier = metiers.find(m => m.slug === data.metier_slug);
          if (knownMetier) {
            setMetierSlug(data.metier_slug ?? "");
          } else if (data.metier_slug) {
            setMetierSlug("autre");
            setCustomMetierLabel(data.metier_label ?? data.metier_slug);
          }
          setDisplayName(data.display_name ?? "");
          setTagline(data.tagline ?? "");
          setZones(data.zones ?? []);
          setPrimaryZone(data.primary_zone ?? "");
          setAcceptsBooking(data.accepts_booking ?? true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addZone = () => {
    const z = zoneInput.trim();
    if (z && !zones.includes(z)) {
      const next = [...zones, z];
      setZones(next);
      if (!primaryZone) setPrimaryZone(z);
    }
    setZoneInput("");
  };

  const removeZone = (z: string) => {
    const next = zones.filter(x => x !== z);
    setZones(next);
    if (primaryZone === z) setPrimaryZone(next[0] ?? "");
  };

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg("");
    try {
      if (isListed) {
        const finalSlug = metierSlug === "autre" ? slugify(customMetierLabel) : metierSlug;
        const finalLabel = metierSlug === "autre" ? customMetierLabel.trim() : null;
        await api.directoryOptIn({
          metier_slug: finalSlug,
          metier_label: finalLabel,
          display_name: displayName,
          tagline: tagline || null,
          zones,
          primary_zone: primaryZone || zones[0] || "",
          accepts_booking: acceptsBooking,
        });
        setMsg("Profil annuaire sauvegardé et visible publiquement.");
      } else {
        if (listing) await api.directoryOptOut();
        setMsg("Vous n'apparaissez plus dans l'annuaire.");
      }
      setListing((prev: any) => ({ ...prev, is_listed: isListed }));
    } catch (err: any) {
      setMsg(`Erreur : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const villeSlug = villes.find(v => v.label.toLowerCase() === primaryZone.toLowerCase())?.slug
    ?? primaryZone.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

  const effectiveMetierSlug = metierSlug === "autre" ? slugify(customMetierLabel) : metierSlug;

  const previewUrl = isListed && effectiveMetierSlug && primaryZone
    ? `/annuaire/${effectiveMetierSlug}/${villeSlug}`
    : null;

  if (loading) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <>
      <SectionTitle
        title="Annuaire public"
        subtitle="Apparaissez dans l'annuaire Klientys et soyez trouvé par vos clients locaux."
      />

      <form onSubmit={save} className="space-y-4">
        <Card>
          <Toggle
            checked={isListed}
            onChange={setIsListed}
            label={isListed ? "Visible dans l'annuaire public" : "Non listé dans l'annuaire"}
          />
          <p className="text-xs text-gray-400 mt-1">
            Quand activé, votre profil est indexé dans l'annuaire et référencé par les moteurs de recherche.
          </p>
        </Card>

        {isListed && (
          <Card>
            <h3 className="font-semibold text-sm text-gray-700 mb-1">Informations de profil</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Métier</label>
              <select
                value={metierSlug}
                onChange={e => setMetierSlug(e.target.value)}
                required
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">Choisir votre métier</option>
                {metiers.map(m => (
                  <option key={m.slug} value={m.slug}>{m.label}</option>
                ))}
                <option value="autre">Autre (précisez)</option>
              </select>
              {metierSlug === "autre" && (
                <input
                  value={customMetierLabel}
                  onChange={e => setCustomMetierLabel(e.target.value)}
                  placeholder="Ex: Ergothérapeute, Coach de vie…"
                  required
                  maxLength={80}
                  className="mt-2 border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nom affiché</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Jean Dupont"
                required
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tagline <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <input
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                placeholder="Kinésithérapeute spécialisé en rééducation sportive"
                maxLength={120}
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <p className="text-xs text-gray-400 mt-1">{tagline.length}/120 caractères</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Zones d'intervention</label>
              <div className="flex gap-2">
                <input
                  value={zoneInput}
                  onChange={e => setZoneInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addZone(); } }}
                  placeholder="Ex: Bruxelles"
                  className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  type="button"
                  onClick={addZone}
                  className="border px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Ajouter
                </button>
              </div>
              {zones.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {zones.map(z => (
                    <span key={z} className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                      📍 {z}
                      <button
                        type="button"
                        onClick={() => removeZone(z)}
                        className="text-primary-400 hover:text-primary-600 leading-none ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {zones.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-1">Zone principale <span className="text-gray-400 font-normal">(URL de votre fiche)</span></label>
                <select
                  value={primaryZone}
                  onChange={e => setPrimaryZone(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {zones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            )}

            <Toggle
              checked={acceptsBooking}
              onChange={setAcceptsBooking}
              label="Afficher l'option de réservation en ligne sur ma fiche"
            />
          </Card>
        )}

        <Feedback msg={msg} />
        <div className="flex items-center gap-3">
          <SaveBtn loading={saving} label={saving ? "Sauvegarde…" : "Sauvegarder"} />
        </div>
      </form>

      {previewUrl && (
        <Card className="border-primary-100 bg-primary-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary-800">Voir ma fiche dans l'annuaire</p>
              <p className="text-xs text-primary-600 mt-0.5">Votre profil est visible publiquement à cette adresse.</p>
            </div>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-800 transition-colors shrink-0"
            >
              Voir ma fiche →
            </a>
          </div>
        </Card>
      )}
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const SECTION_MAP: Record<Exclude<Section, "domaine">, React.FC> = {
  profil:        SectionProfil,
  securite:      SectionSecurite,
  site:          SectionSite,
  annuaire:      SectionAnnuaire,
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

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("section");
    if (s && s in SECTION_MAP) setActive(s as Section);
  }, []);
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
