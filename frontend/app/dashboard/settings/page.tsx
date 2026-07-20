"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api, supabase } from "../../../lib/api";
import { useLanguage, LANGUAGES } from "../../../contexts/LanguageContext";
import { useSubscription } from "../../../contexts/SubscriptionContext";
import DemandPotentialCard from "../analytics/DemandPotentialCard";
import metiers from "../../../data/metiers.json";
import villes from "../../../data/villes.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section =
  | "profil" | "securite" | "site" | "metriques"
  | "abonnement" | "notifications" | "preferences"
  | "membres" | "integrations" | "export" | "activite" | "domaine" | "annuaire" | "facturation" | "support";

function getNav(t: any) {
  return [
    { key: "profil",        label: t.sett_nav_profil,        icon: "👤" },
    { key: "securite",      label: t.sett_nav_securite,      icon: "🔐" },
    { key: "site",          label: t.sett_nav_site,          icon: "🌐" },
    { key: "domaine",       label: t.sett_nav_domaine,       icon: "🔗" },
    { key: "annuaire",      label: t.sett_nav_annuaire,      icon: "📋" },
    { key: "metriques",     label: t.sett_nav_metriques,     icon: "📊" },
    { key: "abonnement",    label: t.sett_nav_abonnement,    icon: "💳" },
    { key: "notifications", label: t.sett_nav_notifications, icon: "🔔" },
    { key: "preferences",   label: t.sett_nav_preferences,   icon: "⚙️" },
    { key: "membres",       label: t.sett_nav_membres,       icon: "👥" },
    { key: "facturation",   label: t.sett_nav_facturation,   icon: "🧾" },
    { key: "integrations",  label: t.sett_nav_integrations,  icon: "🔗" },
    { key: "support",       label: t.sett_nav_support,       icon: "💬" },
    { key: "export",        label: t.sett_nav_export,        icon: "📤" },
    { key: "activite",      label: t.sett_nav_activite,      icon: "📋" },
  ] as const;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

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

function SaveBtn({ loading, label }: { loading: boolean; label?: string }) {
  const { t } = useLanguage();
  const displayLabel = label ?? t.sett_save;
  return (
    <button type="submit" disabled={loading}
      className="bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
      {displayLabel}
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
      setMsg(`${t.sett_error_upload} : ${err.message}`);
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
    } catch { setMsg(t.sett_error_save); }
    finally { setSaving(false); }
  };

  const initials = name ? name[0].toUpperCase() : (user?.email?.[0]?.toUpperCase() ?? "?");

  return (
    <>
      <SectionTitle title={t.sett_profil_title} subtitle={t.sett_profil_subtitle} />
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
                title={t.sett_avatar_change}
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
                {t.sett_created_at} {user?.created_at ? new Date(user.created_at).toLocaleDateString("fr-BE") : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{t.sett_avatar_hover}</p>
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
  const { t } = useLanguage();
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
    if (next !== confirm) { setMsg(t.sett_sec_err_mismatch); return; }
    if (next.length < 8)  { setMsg(t.sett_sec_err_short); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session introuvable");
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (signErr) throw new Error(t.sett_sec_err_wrong_pass);
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setMsg(t.sett_sec_changed_ok); setCurrent(""); setNext(""); setConfirm("");
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
      <SectionTitle title={t.sett_sec_title} subtitle={t.sett_sec_subtitle} />
      <Card>
        <h3 className="font-semibold text-gray-700 text-sm">{t.sett_sec_change_pass}</h3>
        {isOAuth ? (
          <p className="text-sm text-gray-500 bg-gray-50 border rounded-lg px-4 py-3">
            {t.sett_sec_oauth_msg}
          </p>
        ) : (
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t.sett_sec_current_pass}</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
                className="border rounded-lg px-3 py-2 w-full text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.sett_sec_new_pass}</label>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8}
                className="border rounded-lg px-3 py-2 w-full text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.sett_sec_confirm_pass}</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="border rounded-lg px-3 py-2 w-full text-sm" />
            </div>
            <Feedback msg={msg} />
            <SaveBtn loading={saving} label={t.sett_sec_change_btn} />
          </form>
        )}
      </Card>
      <Card>
        <h3 className="font-semibold text-gray-700 text-sm">{t.sett_sec_forgot_title}</h3>
        <p className="text-sm text-gray-500">{t.sett_sec_forgot_desc}</p>
        {resetSent ? (
          <p className="text-green-600 text-sm">{t.sett_sec_reset_sent}</p>
        ) : (
          <button onClick={sendReset} className="text-primary-600 text-sm hover:underline">
            {t.sett_sec_reset_btn}
          </button>
        )}
      </Card>
    </>
  );
}

// ── Section Site ──────────────────────────────────────────────────────────────

function SectionSite() {
  const { t } = useLanguage();
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
      setSite(updated); setMsg(t.sett_site_saved);
    } catch { setMsg(t.sett_error_save); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!site) return;
    setPublishing(true); setPublishMsg("");
    try {
      await api.publishSite(site.id);
      setSite({ ...site, status: "published" });
      setPublishMsg(t.sett_site_published_msg);
    } catch (err: any) {
      setPublishMsg(err?.message ?? t.sett_site_err_publish);
    } finally { setPublishing(false); }
  };

  const handleUnpublish = async () => {
    if (!site) return;
    setPublishing(true); setConfirmDepublish(false); setPublishMsg("");
    try {
      await api.unpublishSite(site.id);
      setSite({ ...site, status: "draft" });
      setPublishMsg(t.sett_site_unpublished_msg);
    } catch (err: any) {
      setPublishMsg(err?.message ?? t.sett_site_err_unpublish);
    } finally { setPublishing(false); }
  };

  if (loading) return <p className="text-gray-400 text-sm">{t.dash_loading}</p>;

  return (
    <>
      <SectionTitle title={t.sett_site_title} subtitle={t.sett_site_subtitle} />
      <Card>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t.sett_site_disp_title}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="border rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <Toggle checked={absenceMode} onChange={setAbsenceMode} label={t.sett_site_absence} />
          {absenceMode && (
            <div>
              <label className="block text-sm font-medium mb-1">{t.sett_site_absence}</label>
              <input value={absenceMessage} onChange={e => setAbsenceMessage(e.target.value)}
                placeholder={t.sett_site_absence_ph}
                className="border rounded-lg px-3 py-2 w-full text-sm" />
            </div>
          )}
          <Feedback msg={msg} />
          <SaveBtn loading={saving} label={saving ? t.sett_saving : t.sett_save} />
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
                    {t.sett_site_published_badge}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    {t.sett_site_draft_badge}
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
                {t.sett_site_preview}
              </a>
            )}
          </div>

          {/* Publier */}
          {site?.status !== "published" && (
            <button onClick={handlePublish} disabled={publishing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors">
              {publishing ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t.sett_site_publishing}</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>{t.sett_site_publish_btn}</>
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
              {t.sett_site_unpublish_btn}
            </button>
          )}

          {site?.status === "published" && confirmDepublish && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">{t.sett_site_depublish_title}</p>
              <p className="text-xs text-red-600">{t.sett_site_depublish_info}</p>
              <div className="flex gap-2">
                <button onClick={handleUnpublish} disabled={publishing}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                  {publishing ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : t.sett_confirm}
                </button>
                <button onClick={() => setConfirmDepublish(false)}
                  className="flex-1 px-3 py-2 rounded-lg font-medium text-sm bg-white text-gray-600 border border-gray-200 hover:bg-gray-50">
                  {t.lay_cancel}
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

      <DesignRequestCard />
    </>
  );
}

function DesignRequestCard() {
  const { planName, loading: subLoading } = useSubscription();
  const [requests, setRequests]       = useState<any[]>([]);
  const [sites, setSites]             = useState<any[]>([]);
  const [message, setMessage]         = useState("");
  const [isAdditional, setIsAdditional] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    if (planName !== "Business") return;
    api.getMyDesignRequests().then(setRequests).catch(() => {});
    api.getSites().then(setSites).catch(() => {});
  }, [planName]);

  if (subLoading || planName !== "Business") return null;

  const hasPending = requests.some((r) => r.status === "pending" || r.status === "in_progress");

  const submit = async () => {
    if (!message.trim()) { setError("Décrivez votre demande."); return; }
    if (isAdditional && !selectedSiteId) { setError("Sélectionnez le site concerné."); return; }
    setSubmitting(true); setError("");
    try {
      const req = await api.createDesignRequest({
        message: message.trim(),
        is_additional: isAdditional,
        site_id: isAdditional ? selectedSiteId : undefined,
      });
      setRequests((prev) => [req, ...prev]);
      setMessage(""); setSelectedSiteId(""); setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    pending:     { label: "En attente",    cls: "bg-amber-100 text-amber-700" },
    in_progress: { label: "En cours",      cls: "bg-blue-100 text-blue-700" },
    done:        { label: "Terminée",      cls: "bg-green-100 text-green-700" },
  };

  return (
    <Card className="border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🎨</span>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-amber-900">Refonte design par notre équipe — 1 site inclus</h3>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Votre plan Business inclut une refonte design complète pour <strong>un site</strong> —
              moins standardisé, plus fidèle à votre image. Fournissez un template ou décrivez vos souhaits,
              notre équipe s&apos;en charge.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Plusieurs espaces de travail ? Les sites supplémentaires sont disponibles à un tarif ponctuel.
            </p>
          </div>

          {/* Demandes existantes */}
          {requests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Vos demandes</p>
              {requests.map((r) => {
                const s = STATUS_LABEL[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <div key={r.id} className="bg-white rounded-lg border border-amber-200 px-3 py-2.5 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{r.message}</p>
                      {r.admin_notes && (
                        <p className="text-xs text-blue-600 mt-1">💬 {r.admin_notes}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(r.created_at).toLocaleDateString("fr-FR")}
                        {r.is_additional && " · site supplémentaire"}
                      </p>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${s.cls}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulaire nouvelle demande */}
          {!success ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-additional"
                    checked={isAdditional}
                    onChange={(e) => { setIsAdditional(e.target.checked); setSelectedSiteId(""); }}
                    className="rounded"
                  />
                  <label htmlFor="is-additional" className="text-xs text-amber-800">
                    C&apos;est pour un site supplémentaire (devis ponctuel)
                  </label>
                </div>
                {isAdditional && sites.length > 0 && (
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">— Sélectionnez le site concerné —</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.title || s.id}</option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez vos souhaits : charte graphique, template à fournir, inspirations, éléments à conserver…"
                className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              {hasPending && (
                <p className="text-xs text-amber-700">⚠ Vous avez déjà une demande en cours.</p>
              )}
              <button
                onClick={submit}
                disabled={submitting || !message.trim()}
                className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "Envoi…" : "Envoyer ma demande →"}
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              ✓ Demande envoyée — notre équipe vous contactera sous 48h.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Section Métriques ─────────────────────────────────────────────────────────

const ALL_METRIC_IDS = ["new_leads", "pending", "confirmed", "contacts", "leads_30d", "rdv_30d", "conv_rate", "activity", "demand_potential"];

function SectionMetriques() {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState<string[]>(ALL_METRIC_IDS);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  const METRIC_DEFS = [
    { id: "new_leads",        label: t.sett_met_kpi_new_leads, desc: t.sett_met_kpi_new_leads_d, icon: "📨" },
    { id: "pending",          label: t.sett_met_kpi_pending,   desc: t.sett_met_kpi_pending_d,   icon: "⏳" },
    { id: "confirmed",        label: t.sett_met_kpi_confirmed, desc: t.sett_met_kpi_confirmed_d, icon: "✅" },
    { id: "contacts",         label: t.sett_met_kpi_contacts,  desc: t.sett_met_kpi_contacts_d,  icon: "👥" },
    { id: "leads_30d",        label: t.sett_met_kpi_leads_30d, desc: t.sett_met_kpi_leads_30d_d, icon: "📈" },
    { id: "rdv_30d",          label: t.sett_met_kpi_rdv_30d,   desc: t.sett_met_kpi_rdv_30d_d,   icon: "📅" },
    { id: "conv_rate",        label: t.sett_met_kpi_conv,      desc: t.sett_met_kpi_conv_d,      icon: "📊" },
    { id: "activity",         label: t.sett_met_kpi_activity,  desc: t.sett_met_kpi_activity_d,  icon: "📉" },
    { id: "demand_potential", label: t.sett_met_kpi_demand,    desc: t.sett_met_kpi_demand_d,    icon: "🌍" },
  ];

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
      setMsg(t.sett_met_saved);
    } catch { setMsg(t.sett_error_save); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionTitle title={t.sett_met_title} subtitle={t.sett_met_subtitle} />
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
          {saving ? t.sett_saving : t.sett_met_save}
        </button>
      </Card>
      <DemandPotentialCard />
    </>
  );
}

// ── Section Abonnement ────────────────────────────────────────────────────────

const PLANS_INFO = [
  {
    name: "Essentiel",
    price: "29,90",
    color: "gray" as const,
    features: ["Site vitrine complet", "Réservations en ligne", "100 contacts CRM", "Agent IA vitrine", "Support email"],
  },
  {
    name: "Pro",
    price: "59,90",
    color: "primary" as const,
    features: ["Tout Essentiel +", "1 000 contacts CRM", "3 agents IA (vitrine, support, assistant)", "Analytics & potentiel local", "Domaine personnalisé inclus", "Widget embarquable", "Support prioritaire 24/7"],
  },
  {
    name: "Business",
    price: "99,90",
    color: "amber" as const,
    features: ["Tout Pro +", "Contacts illimités", "Multi-espaces de travail", "Membres d'équipe illimités", "CSS personnalisé", "Refonte design par notre équipe", "Account manager dédié"],
  },
];

function SectionAbonnement() {
  const { planName: ctxPlan, status: ctxStatus, trialDaysLeft } = useSubscription();
  const [sub, setSub]                   = useState<any>(null);
  const [plans, setPlans]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading]     = useState(false);
  const [portalError, setPortalError]         = useState("");
  const [cancelOpen, setCancelOpen]     = useState(false);
  const [oneTimePurchases, setOneTimePurchases] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const plansData = await api.getPlans();
        setPlans(plansData);
      } catch { /* non critique */ }

      try {
        const reqs = await api.getMyDesignRequests();
        setOneTimePurchases(reqs.filter((r: any) => r.is_additional));
      } catch { /* non critique */ }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: mem } = await supabase.from("membership").select("tenant_id").eq("user_id", user.id).single();
      if (!mem) { setLoading(false); return; }
      const { data } = await supabase
        .from("subscription")
        .select("*, plan:plan_id(name, price_monthly), stripe_subscription_id")
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
        success_url: `${base}/dashboard/settings?section=abonnement&checkout_success=1`,
        cancel_url:  `${base}/dashboard/settings?section=abonnement`,
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

  const currentPlanName = sub?.plan?.name ?? ctxPlan ?? null;
  // Vrai abonnement Stripe = stripe_subscription_id présent (pas une activation admin gratuite)
  const hasRealStripeSub = !!(sub?.stripe_subscription_id);

  const DESIGN_STATUS: Record<string, string> = {
    pending: "En attente", in_progress: "En cours", done: "Terminée",
  };

  return (
    <>
      <SectionTitle title="Abonnement & facturation" subtitle="Gérez votre plan, vos factures et vos moyens de paiement." />
      {loading ? <p className="text-sm text-gray-400">Chargement…</p> : (
        <>
          {/* ── Plan actuel ── */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Plan actuel</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xl font-bold text-gray-900">{currentPlanName ?? "Aucun abonnement"}</p>
                  {sub && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Actif</span>
                  )}
                  {!sub && ctxStatus === "trial" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                      Essai — {trialDaysLeft ?? "?"} jour{(trialDaysLeft ?? 0) > 1 ? "s" : ""} restant{(trialDaysLeft ?? 0) > 1 ? "s" : ""}
                    </span>
                  )}
                  {ctxStatus === "trial_expired" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Essai expiré</span>
                  )}
                </div>
                {sub?.plan?.price_monthly != null && (
                  <p className="text-sm text-gray-500 mt-1">
                    {Number(sub.plan.price_monthly).toFixed(2).replace(".", ",")} € / mois · renouvelé automatiquement
                  </p>
                )}
              </div>
              {hasRealStripeSub && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={openPortal} disabled={portalLoading}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    {portalLoading ? "Ouverture…" : "Voir mes factures"}
                  </button>
                  <button onClick={openPortal} disabled={portalLoading}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                    </svg>
                    Moyen de paiement
                  </button>
                </div>
              )}
            </div>
            {portalError && <p className="text-xs text-red-500 mt-2">{portalError}</p>}
          </Card>

          {/* ── Choisir / changer de plan ── */}
          {plans.filter(p => p.stripe_price_id).length > 0 && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                {sub ? "Changer de plan" : "Choisir un plan"}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PLANS_INFO.map((info) => {
                  const dbPlan = plans.find(p => p.name === info.name && p.stripe_price_id);
                  const isCurrent = hasRealStripeSub && currentPlanName === info.name;
                  const accent = info.color === "amber"
                    ? { border: "border-amber-300", bg: "bg-amber-50", badge: "bg-amber-600", btn: "bg-amber-600 hover:bg-amber-700" }
                    : info.color === "primary"
                    ? { border: "border-primary-300", bg: "bg-primary-50", badge: "bg-primary-600", btn: "bg-primary-600 hover:bg-primary-700" }
                    : { border: "border-gray-200", bg: "bg-gray-50", badge: "bg-gray-500", btn: "bg-gray-600 hover:bg-gray-700" };

                  return (
                    <div key={info.name}
                      className={`relative rounded-xl border-2 p-4 flex flex-col gap-3 ${isCurrent ? accent.border + " " + accent.bg : "border-gray-100"}`}>
                      {isCurrent && (
                        <span className={`absolute -top-2.5 left-3 text-[10px] font-bold uppercase tracking-widest text-white px-2 py-0.5 rounded-full ${accent.badge}`}>
                          Actuel
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{info.name}</p>
                        <p className="text-lg font-bold text-gray-800 mt-0.5">{info.price} <span className="text-xs font-normal text-gray-400">€/mois</span></p>
                      </div>
                      <ul className="flex flex-col gap-1.5 flex-1">
                        {info.features.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <span className="text-xs text-center text-gray-400 font-medium py-1.5">Votre plan actuel</span>
                      ) : dbPlan ? (
                        <button
                          onClick={() => hasRealStripeSub ? openPortal() : handleCheckout(dbPlan.id)}
                          disabled={checkoutLoading === dbPlan.id || portalLoading}
                          className={`w-full text-xs font-semibold text-white py-2 rounded-lg transition-colors disabled:opacity-50 ${accent.btn}`}
                        >
                          {checkoutLoading === dbPlan.id ? "Redirection…" : hasRealStripeSub ? `Passer au plan ${info.name} →` : `Choisir ${info.name} →`}
                        </button>
                      ) : (
                        <span className="text-xs text-center text-gray-300">Bientôt disponible</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasRealStripeSub && (
                <p className="text-xs text-gray-400 mt-3">
                  Le changement de plan s&apos;effectue via le portail Stripe. La différence est calculée au prorata.
                </p>
              )}
            </Card>
          )}

          {/* ── Achats ponctuels ── */}
          {oneTimePurchases.length > 0 && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Achats ponctuels</p>
              <div className="flex flex-col gap-2">
                {oneTimePurchases.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Refonte design — {r.site_name || "Site"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.status === "done" ? "bg-green-100 text-green-700" :
                      r.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {DESIGN_STATUS[r.status] ?? r.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Résiliation ── */}
          {hasRealStripeSub && (
            <Card className="border-red-100">
              <button
                onClick={() => setCancelOpen(o => !o)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="font-semibold text-sm text-red-600">Annuler mon abonnement</h3>
                <svg className={`w-4 h-4 text-red-400 transition-transform ${cancelOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {cancelOpen && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Votre abonnement reste actif jusqu&apos;à la fin de la période en cours — vous ne perdez aucun accès immédiatement.
                    Vos données sont conservées 30 jours après la résiliation.
                  </p>
                  <button
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="text-sm font-medium text-red-500 hover:text-red-700 underline disabled:opacity-50"
                  >
                    {portalLoading ? "Ouverture…" : "Annuler depuis le portail Stripe →"}
                  </button>
                </div>
              )}
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

function usePushSetup() {
  const [pushState, setPushState] = useState<"idle" | "loading" | "enabled" | "denied" | "error">("idle");
  const [pushErr, setPushErr] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.register("/sw.js").then(async reg => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) setPushState("enabled");
      else if (Notification.permission === "denied") setPushState("denied");
    }).catch(() => {});
  }, []);

  async function enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushErr("Votre navigateur ne supporte pas les notifications push.");
      setPushState("error"); return;
    }
    setPushState("loading"); setPushErr("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm === "denied") { setPushState("denied"); return; }
      if (perm !== "granted") { setPushState("idle"); return; }
      let keyRes: { public_key: string };
      try { keyRes = await api.getVapidPublicKey(); }
      catch { setPushErr("Notifications non activées sur ce serveur."); setPushState("error"); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.public_key),
      });
      await api.subscribePush(sub.toJSON());
      setPushState("enabled");
    } catch (e: any) {
      setPushErr(e?.message || "Erreur inattendue.");
      setPushState("error");
    }
  }

  return { pushState, pushErr, enablePush };
}

function SectionNotifications() {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState(NOTIF_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const { pushState, pushErr, enablePush } = usePushSetup();

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
      setMsg(t.sett_notif_saved);
    } catch { setMsg(t.sett_error_save); }
    finally { setSaving(false); }
  };

  const Row = ({ k, label }: { k: string; label: string }) => (
    <Toggle checked={prefs[k]} onChange={() => toggle(k)} label={label} />
  );

  return (
    <>
      <SectionTitle title={t.sett_notif_title} subtitle={t.sett_notif_subtitle} />
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">{t.sett_notif_email_title}</h3>
        <div className="space-y-3">
          <Row k="email_new_lead"   label={t.sett_notif_new_lead} />
          <Row k="email_new_rdv"    label={t.sett_notif_new_rdv} />
          <Row k="email_reminder"   label={t.sett_notif_reminder} />
          <Row k="email_invoice"    label={t.sett_notif_invoice} />
          <Row k="email_newsletter" label={t.sett_notif_newsletter} />
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">{t.sett_notif_sms_title}</h3>
        <div className="space-y-3">
          <Row k="sms_rdv" label={t.sett_notif_sms_rdv} />
        </div>
        <p className="text-xs text-gray-400 mt-2">Les notifications SMS nécessitent un numéro de téléphone vérifié.</p>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">{t.sett_notif_inapp_title}</h3>
        <div className="space-y-3">
          <Row k="inapp_updates" label={t.sett_notif_inapp_upd} />
        </div>
      </Card>

      {/* Push navigateur */}
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-3">{t.supp_push_title}</h3>
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-gray-500 leading-relaxed">{t.supp_push_desc}</p>
          <div className="shrink-0">
            {pushState === "enabled" ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                {t.supp_push_enabled}
              </span>
            ) : pushState === "denied" ? (
              <span className="text-xs text-red-500">{t.supp_push_denied}</span>
            ) : (
              <button onClick={enablePush} disabled={pushState === "loading"}
                className="rounded-lg bg-primary-600 text-white text-xs font-semibold px-4 py-2 hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {pushState === "loading" ? "…" : t.supp_push_enable}
              </button>
            )}
          </div>
        </div>
        {pushState === "error" && pushErr && (
          <p className="mt-2 text-xs text-amber-600">{pushErr}</p>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          {saving ? t.sett_saving : t.sett_save}
        </button>
        <Feedback msg={msg} />
      </div>
    </>
  );
}

// ── Section Préférences ───────────────────────────────────────────────────────

function SectionPreferences() {
  const { t } = useLanguage();
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
      setMsg(t.sett_met_saved);
    } catch { setMsg(t.sett_error_save); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionTitle title={t.sett_pref_title} subtitle={t.sett_pref_subtitle} />
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">Apparence</h3>
        <div className="space-y-3">
          <Toggle
            checked={darkMode}
            onChange={(v) => {
              setDarkMode(v);
              window.dispatchEvent(new CustomEvent("klientys-darkmode", { detail: { darkMode: v } }));
            }}
            label={t.sett_pref_dark_mode}
          />
          <Toggle checked={compactView} onChange={setCompact} label={t.sett_pref_compact} />
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
          {saving ? t.sett_saving : t.sett_save}
        </button>
        <Feedback msg={msg} />
      </div>
    </>
  );
}

// ── Section Membres ───────────────────────────────────────────────────────────

const ALL_PERMS = ["crm", "calendar", "site_builder", "analytics", "agents"];

function useTeamT() {
  const { t } = useLanguage();
  const roleLabel = (role: string) => ({
    owner: t.team_role_owner, admin: t.team_role_admin,
    member: t.team_role_member, secretary: t.team_role_secretary,
  }[role] ?? role);
  const permLabel = (key: string) => ({
    crm: t.team_perm_crm, calendar: t.team_perm_calendar,
    site_builder: t.team_perm_site_builder, analytics: t.team_perm_analytics,
    agents: t.team_perm_agents,
  }[key] ?? key);
  return { t, roleLabel, permLabel };
}

function PermCheckboxes({
  perms, onChange, disabled = false,
}: { perms: string[]; onChange: (p: string[]) => void; disabled?: boolean }) {
  const { permLabel } = useTeamT();
  const toggle = (key: string) => {
    onChange(perms.includes(key) ? perms.filter(p => p !== key) : [...perms, key]);
  };
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {ALL_PERMS.map((key) => {
        const label = permLabel(key);
        const checked = perms.includes(key);
        return (
          <label
            key={key}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer select-none transition-colors ${
              disabled
                ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50"
                : checked
                  ? "border-primary-400 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              disabled={disabled}
              onChange={() => !disabled && toggle(key)}
            />
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
              checked ? "bg-primary-600 border-primary-600" : "border-gray-300 bg-white"
            }`}>
              {checked && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              )}
            </span>
            {label}
          </label>
        );
      })}
    </div>
  );
}

function SectionMembres() {
  const { t, roleLabel, permLabel } = useTeamT();
  const [members, setMembers]   = useState<any[]>([]);
  const [pending, setPending]   = useState<any[]>([]);
  const [myRole, setMyRole]     = useState<string>("member");
  const [loading, setLoading]   = useState(true);
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState("member");
  const [invitePerms, setInvitePerms] = useState<string[]>(ALL_PERMS);
  const [editingPerms, setEditingPerms] = useState<Record<string, string[]>>({});
  const [inviting, setInviting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const ROLE_OPTIONS = [
    { value: "admin",     label: t.team_role_admin },
    { value: "member",    label: t.team_role_member },
    { value: "secretary", label: t.team_role_secretary },
  ];

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

  const confirmPerms = (role === "admin" || role === "secretary") ? ALL_PERMS : invitePerms;

  const handleConfirmInvite = async () => {
    setInviting(true);
    setShowConfirm(false);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.inviteMember({ email: email.trim(), role, permissions: confirmPerms }) as any;
      if (res.email_sent) {
        setSuccess(`${t.team_invite_btn} → ${email.trim()}`);
      } else {
        setSuccess(`Invitation créée. Copiez ce lien :\n${res.invite_url}`);
      }
      setEmail("");
      setInvitePerms(ALL_PERMS);
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

  const handlePermsSave = async (userId: string) => {
    const perms = editingPerms[userId];
    if (!perms) return;
    try {
      await api.updateMemberPermissions(userId, perms);
      setEditingPerms(prev => { const next = { ...prev }; delete next[userId]; return next; });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm(t.team_remove_confirm)) return;
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
      {/* Modal de confirmation d'invitation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">{t.team_confirm_title}</h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm shrink-0">
                  {email.trim().slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{t.team_confirm_email}</p>
                  <p className="text-sm font-medium text-gray-900 break-all">{email.trim()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{t.team_confirm_role}</p>
                  <p className="text-sm font-medium text-gray-900">{roleLabel(role)}</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.team_confirm_access}</p>
                {role === "admin" || role === "secretary" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    {t.team_perm_all}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {confirmPerms.length === 0 ? (
                      <span className="text-xs text-gray-400">Aucun accès</span>
                    ) : confirmPerms.map(p => (
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100 font-medium">
                        {permLabel(p)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t.team_confirm_cancel}
              </button>
              <button
                onClick={handleConfirmInvite}
                disabled={inviting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: "#0D4B58" }}
              >
                {inviting ? t.team_inviting_btn : t.team_confirm_send}
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionTitle title={t.team_title} subtitle={t.team_subtitle} />

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
          <div className="divide-y">
            {members.map(m => {
              const initials = [m.first_name, m.last_name].filter(Boolean).map((s: string) => s[0]).join("").toUpperCase() || m.email?.slice(0, 2).toUpperCase() || "?";
              const displayName = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
              const isEditingPerms = m.user_id in editingPerms;
              const currentPerms = editingPerms[m.user_id] ?? (m.permissions || ALL_PERMS);
              const showPermsEdit = canManage && m.role === "member";
              return (
                <div key={m.id} className="py-3">
                  <div className="flex items-center justify-between">
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
                          {roleLabel(m.role)}
                        </span>
                      )}
                      {showPermsEdit && !isEditingPerms && (
                        <button
                          onClick={() => setEditingPerms(prev => ({ ...prev, [m.user_id]: m.permissions || ALL_PERMS }))}
                          className="text-xs text-primary-500 hover:text-primary-700 border border-primary-200 rounded-lg px-2 py-1 transition-colors"
                        >
                          {t.team_access_btn}
                        </button>
                      )}
                      {canManage && m.role !== "owner" && (
                        <button
                          onClick={() => handleRemove(m.user_id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panneau d'édition des permissions */}
                  {isEditingPerms && (
                    <div className="mt-3 ml-11 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2">{t.team_perms_title}</p>
                      <PermCheckboxes perms={currentPerms} onChange={p => setEditingPerms(prev => ({ ...prev, [m.user_id]: p }))} />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handlePermsSave(m.user_id)}
                          className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                        >
                          {t.team_save_btn}
                        </button>
                        <button
                          onClick={() => setEditingPerms(prev => { const next = { ...prev }; delete next[m.user_id]; return next; })}
                          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                        >
                          {t.team_cancel_btn}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Aperçu des permissions pour les membres (lecture seule si pas en édition) */}
                  {!isEditingPerms && m.role === "member" && (
                    <div className="mt-1.5 ml-11 flex flex-wrap gap-1.5">
                      {(m.permissions || ALL_PERMS).map((p: string) => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 border border-primary-100">
                          {permLabel(p)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {members.length === 0 && <p className="text-sm text-gray-400 py-2">{t.team_empty}</p>}
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.team_pending_title}</h4>
            <div className="space-y-1">
              {pending.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-gray-700">{p.email}</p>
                    <p className="text-xs text-gray-400">{roleLabel(p.role)} · {t.team_pending_expires} {new Date(p.expires_at).toLocaleDateString()}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleCancelInvite(p.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      {t.team_cancel_invite}
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
          <h3 className="font-semibold text-sm text-gray-700">{t.team_invite_title}</h3>
          <p className="text-sm text-gray-500">{t.team_invite_subtitle}</p>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); setSuccess(null); }}
              onKeyDown={e => e.key === "Enter" && email.trim() && setShowConfirm(true)}
              placeholder={t.team_invite_email_ph}
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select
              value={role}
              onChange={e => { setRole(e.target.value); if (e.target.value !== "member") setInvitePerms(ALL_PERMS); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={() => email.trim() && setShowConfirm(true)}
              disabled={inviting || !email.trim()}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40 transition-colors shrink-0"
            >
              {inviting ? t.team_inviting_btn : t.team_invite_btn}
            </button>
          </div>

          {/* Checkboxes d'accès — uniquement pour le rôle "member" */}
          {role === "member" && (
            <div className="border-t pt-4 mt-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">
                {t.team_perms_title}
                <span className="ml-2 font-normal text-gray-400">{t.team_perms_note}</span>
              </p>
              <PermCheckboxes perms={invitePerms} onChange={setInvitePerms} />
            </div>
          )}
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
  const [properties, setProperties] = useState<{ id: string; name: string; account: string }[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [loadingProps, setLoadingProps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    api.getGoogleAnalyticsStatus()
      .then(s => {
        setGaStatus(s);
        if (s.ga4_property_id) setSelectedProperty(s.ga4_property_id);
        if (s.connected) loadProperties();
      })
      .catch(() => setGaStatus({ connected: false, property_configured: false, ga4_property_id: null, connected_at: null }));

    // Après retour du flux OAuth, charger les propriétés automatiquement
    const params = new URLSearchParams(window.location.search);
    if (params.get("ga_connected") === "1") {
      setLoadingProps(true);
      api.getGoogleAnalyticsProperties()
        .then(d => { setProperties(d.properties); setGaStatus(prev => prev ? { ...prev, connected: true } : { connected: true, property_configured: false, ga4_property_id: null, connected_at: null }); })
        .catch(() => {})
        .finally(() => setLoadingProps(false));
    }
  }, []);

  const loadProperties = async () => {
    setLoadingProps(true);
    try {
      const d = await api.getGoogleAnalyticsProperties();
      setProperties(d.properties);
    } catch { /* silencieux */ }
    finally { setLoadingProps(false); }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.getGoogleAnalyticsAuthUrl();
      window.location.href = data.url;
    } catch {
      setConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProperty) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      await api.configureGoogleAnalytics(selectedProperty);
      setSaved(true);
      setGaStatus(prev => prev ? { ...prev, property_configured: true, ga4_property_id: selectedProperty } : prev);
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

      {/* Connecté — sélectionner la propriété GA4 */}
      {gaStatus?.connected && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Propriété GA4</p>
            <button onClick={loadProperties} className="text-xs text-blue-600 hover:underline">
              Actualiser la liste
            </button>
          </div>

          {loadingProps ? (
            <p className="text-sm text-gray-400">Chargement des propriétés…</p>
          ) : properties.length > 0 ? (
            <div className="flex gap-2">
              <select
                value={selectedProperty}
                onChange={e => setSelectedProperty(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">— Sélectionner une propriété —</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.account ? `(${p.account})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSave}
                disabled={saving || !selectedProperty}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: saved ? "#16a34a" : "var(--primary-600, #2563eb)" }}
              >
                {saving ? "…" : saved ? "Enregistré ✓" : "Enregistrer"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Aucune propriété GA4 trouvée.{" "}
              <button onClick={loadProperties} className="text-blue-600 hover:underline">Réessayer</button>
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          {gaStatus.property_configured && !saved && (
            <p className="text-xs text-gray-400">
              Propriété active : <code className="bg-gray-100 px-1 rounded">{gaStatus.ga4_property_id}</code>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Section Intégrations ──────────────────────────────────────────────────────

// ── Section Facturation ───────────────────────────────────────────────────────

function SectionFacturation() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [err, setErr]           = useState("");

  useEffect(() => {
    api.getInvoiceSettings().then((d: any) => { setSettings(d ?? {}); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function handleChange(field: string, value: string | number) {
    setSettings((s: any) => ({ ...s, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true); setErr(""); setSaved(false);
    try {
      await api.updateInvoiceSettings(settings);
      setSaved(true);
    } catch (e: any) { setErr(e.message ?? "Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;

  return (
    <>
      <SectionTitle title={t.sett_fact_title} subtitle={t.sett_fact_subtitle} />
      <Card>
        <p className="text-sm font-semibold text-gray-700">Informations légales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Numéro de TVA</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="BE0123456789"
              value={settings.vat_number ?? ""}
              onChange={e => handleChange("vat_number", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Préfixe de numérotation</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="FAC"
              value={settings.prefix ?? "FAC"}
              onChange={e => handleChange("prefix", e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Ex : FAC-2025-0001</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Délai de paiement (jours)</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={settings.payment_terms_days ?? 30}
              onChange={e => handleChange("payment_terms_days", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-gray-700">Coordonnées bancaires</p>
        <p className="text-xs text-gray-500">Apparaissent sur les factures pour faciliter le virement.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">IBAN</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="BE68 5390 0754 7034"
              value={settings.bank_iban ?? ""}
              onChange={e => handleChange("bank_iban", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">BIC / SWIFT</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="GEBABEBB"
              value={settings.bank_bic ?? ""}
              onChange={e => handleChange("bank_bic", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Nom de la banque</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="BNP Paribas Fortis"
              value={settings.bank_name ?? ""}
              onChange={e => handleChange("bank_name", e.target.value)}
            />
          </div>
        </div>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-gray-700">Note de bas de facture</p>
        <textarea
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Merci pour votre confiance. Tout retard de paiement entraîne des pénalités de 10%/an."
          value={settings.footer_note ?? ""}
          onChange={e => handleChange("footer_note", e.target.value)}
        />
      </Card>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Sauvegardé</span>}
      </div>
    </>
  );
}

function SectionIntegrations() {
  const { t } = useLanguage();
  return (
    <>
      <SectionTitle title={t.sett_int_title} subtitle={t.sett_int_subtitle} />
      <GoogleAnalyticsCard />
    </>
  );
}

// ── Section Export & RGPD ─────────────────────────────────────────────────────

function SectionExport() {
  const { t } = useLanguage();
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
      <SectionTitle title={t.sett_exp_title} subtitle={t.sett_exp_subtitle} />
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
  const { t } = useLanguage();
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
      <SectionTitle title={t.sett_act_title} subtitle={t.sett_act_subtitle} />
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
  const { t } = useLanguage();
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
        <SectionTitle title={t.sett_dom_title} subtitle={t.sett_dom_subtitle} />
        <p className="text-sm text-gray-400">Chargement…</p>
      </>
    );
  }

  return (
    <>
      <SectionTitle
        title={t.sett_dom_title}
        subtitle={t.sett_dom_subtitle}
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

const titleCaseZone = (s: string) =>
  s.replace(/(?:^|[\s-])\S/g, c => c.toUpperCase());

function SectionAnnuaire() {
  const { t } = useLanguage();
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
  const [zoneSuggestions, setZoneSuggestions] = useState<string[]>([]);
  const zoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setZones((data.zones ?? []).map((z: string) => titleCaseZone(z.trim())));
          setPrimaryZone(titleCaseZone((data.primary_zone ?? "").trim()));
          setAcceptsBooking(data.accepts_booking ?? true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addZone = (val?: string) => {
    const z = titleCaseZone((val ?? zoneInput).trim());
    if (z && !zones.includes(z)) {
      const next = [...zones, z];
      setZones(next);
      if (!primaryZone) setPrimaryZone(z);
    }
    setZoneInput("");
    setZoneSuggestions([]);
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
        setMsg(t.sett_ann_listed);
      } else {
        if (listing) await api.directoryOptOut();
        setMsg(t.sett_ann_unlisted);
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
        title={t.sett_ann_title}
        subtitle={t.sett_ann_subtitle}
      />

      <form onSubmit={save} className="space-y-4">
        <Card>
          <Toggle
            checked={isListed}
            onChange={setIsListed}
            label={isListed ? t.sett_ann_listed : t.sett_ann_unlisted}
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
                <div className="relative flex-1">
                  <input
                    value={zoneInput}
                    onChange={e => {
                      const v = e.target.value;
                      setZoneInput(v);
                      if (zoneTimerRef.current) clearTimeout(zoneTimerRef.current);
                      if (v.length < 2) { setZoneSuggestions([]); return; }
                      zoneTimerRef.current = setTimeout(async () => {
                        try {
                          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=6&addressdetails=1`);
                          const data = await res.json();
                          const items: string[] = [];
                          for (const d of data) {
                            const a = d.address ?? {};
                            const name = a.city || a.town || a.village || a.county || a.state || d.display_name.split(",")[0];
                            if (name && !items.includes(name)) items.push(name);
                          }
                          setZoneSuggestions(items);
                        } catch {}
                      }, 350);
                    }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addZone(); } }}
                    onBlur={() => setTimeout(() => setZoneSuggestions([]), 150)}
                    placeholder="Ex: Bruxelles, Rennes, Lyon…"
                    className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  {zoneSuggestions.length > 0 && (
                    <ul className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden text-sm">
                      {zoneSuggestions.map(s => (
                        <li key={s}>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                            onMouseDown={() => addZone(s)}
                          >
                            📍 {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addZone()}
                  className="border px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 shrink-0"
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
              label={t.sett_ann_booking}
            />
          </Card>
        )}

        <Feedback msg={msg} />
        <div className="flex items-center gap-3">
          <SaveBtn loading={saving} label={saving ? t.sett_saving : t.sett_save} />
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

// ── Section Support ───────────────────────────────────────────────────────────

function SectionSupport({ onTicketRead }: { onTicketRead?: () => void }) {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [newReply, setNewReply] = useState(false); // flash quand un msg admin arrive

  // Charge la liste + badge reset
  useEffect(() => {
    api.listSupportTickets().then((data: any[]) => {
      setTickets(data);
      onTicketRead?.();
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Poll la liste toutes les 20s pour mettre à jour les statuts (badge parent)
  useEffect(() => {
    const iv = setInterval(() =>
      api.listSupportTickets()
        .then((data: any[]) => setTickets(data))
        .catch(() => {}),
      20_000,
    );
    return () => clearInterval(iv);
  }, []);

  // Poll les messages du ticket ouvert toutes les 10s
  useEffect(() => {
    if (!selected) return;
    const iv = setInterval(async () => {
      try {
        const full = await api.getSupportTicket(selected.id);
        const next = full.messages || [];
        setMessages(prev => {
          if (next.length > prev.length) setNewReply(true); // flash
          return next;
        });
      } catch {}
    }, 10_000);
    return () => clearInterval(iv);
  }, [selected?.id]);

  // Reset du flash après 3s
  useEffect(() => {
    if (!newReply) return;
    const t = setTimeout(() => setNewReply(false), 3000);
    return () => clearTimeout(t);
  }, [newReply]);

  async function openTicket(ticket: any) {
    setSelected(ticket);
    setNewReply(false);
    setMsgLoading(true);
    try {
      const full = await api.getSupportTicket(ticket.id);
      setMessages(full.messages || []);
    } catch {} finally { setMsgLoading(false); }
  }

  async function handleSubmit() {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const ticket = await api.createSupportTicket({ subject: subject.trim(), body: body.trim() });
      setSent(true);
      setSubject(""); setBody("");
      setTickets(prev => [ticket, ...prev]);
      setTimeout(() => { setShowNew(false); setSent(false); }, 2500);
    } catch {} finally { setSubmitting(false); }
  }

  async function handleReply() {
    if (!replyBody.trim() || !selected) return;
    setReplying(true);
    try {
      await api.replySupportTicket(selected.id, replyBody.trim());
      const full = await api.getSupportTicket(selected.id);
      setMessages(full.messages || []);
      setReplyBody("");
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: "open", updated_at: new Date().toISOString() } : t));
    } catch {} finally { setReplying(false); }
  }

  const STATUS_COLORS: Record<string, string> = {
    open: "bg-blue-50 text-blue-700 border-blue-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    resolved: "bg-green-50 text-green-700 border-green-200",
    closed: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const STATUS_LABELS: Record<string, any> = {
    open: t.supp_status_open, in_progress: t.supp_status_in_progress,
    resolved: t.supp_status_resolved, closed: t.supp_status_closed,
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">{t.supp_title}</h2>
        <p className="text-sm text-gray-500 mt-1">{t.supp_subtitle}</p>
      </div>

      {/* View: ticket detail */}
      {selected ? (
        <Card>
          <button onClick={() => setSelected(null)} className="text-xs text-primary-600 hover:text-primary-800 mb-4 font-medium">
            {t.supp_back}
          </button>
          <div className="flex items-start justify-between gap-2 mb-4">
            <h3 className="font-semibold text-gray-900">{selected.subject}</h3>
            <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 shrink-0 ${STATUS_COLORS[selected.status] || ""}`}>
              {STATUS_LABELS[selected.status] || selected.status}
            </span>
          </div>

          {/* Flash "nouvelle réponse" quand un message arrive pendant que le ticket est ouvert */}
          {newReply && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold animate-pulse">
              <span>💬</span> Nouvelle réponse de Klientys
            </div>
          )}

          {msgLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">…</div>
          ) : (
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${msg.sender === "admin" ? "" : "flex-row-reverse"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${msg.sender === "admin" ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-600"}`}>
                    {msg.sender === "admin" ? "K" : "V"}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${msg.sender === "admin" ? "bg-primary-50 border border-primary-100 text-gray-800" : "bg-gray-100 text-gray-800"}`}>
                    <p className="text-xs font-semibold mb-1 text-gray-500">
                      {msg.sender === "admin" ? t.supp_from_admin : t.supp_from_you}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{fmtDate(msg.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!["resolved", "closed"].includes(selected.status) && (
            <div className="border-t pt-4">
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder={t.supp_reply_ph}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
              <button
                onClick={handleReply}
                disabled={replying || !replyBody.trim()}
                className="mt-2 rounded-lg bg-primary-600 text-white text-sm font-semibold px-4 py-2 hover:bg-primary-700 disabled:opacity-40 transition-colors"
              >
                {replying ? "…" : t.supp_reply_send}
              </button>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* New ticket form */}
          {showNew ? (
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{t.supp_new_ticket}</h3>
                <button onClick={() => { setShowNew(false); setSent(false); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              {sent ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  {t.supp_ticket_sent}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{t.supp_ticket_subject}</label>
                    <input
                      value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder={t.supp_ticket_subject_ph}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{t.supp_ticket_body}</label>
                    <textarea
                      value={body} onChange={e => setBody(e.target.value)}
                      placeholder={t.supp_ticket_body_ph}
                      rows={5}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !subject.trim() || !body.trim()}
                    className="w-full rounded-xl bg-primary-600 text-white py-2.5 text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 transition-colors"
                  >
                    {submitting ? t.supp_ticket_submitting : t.supp_ticket_submit}
                  </button>
                </div>
              )}
            </Card>
          ) : (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 rounded-xl bg-primary-600 text-white px-4 py-2 text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                {t.supp_new_ticket}
              </button>
            </div>
          )}

          {/* Ticket list */}
          <Card>
            {loading ? (
              <div className="text-center py-8 text-gray-400 text-sm">…</div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t.supp_no_tickets}</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {tickets.map(ticket => {
                  const hasAdminReply = ticket.status === "in_progress";
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className={`w-full text-left flex items-start gap-3 py-3.5 px-1 rounded-lg transition-colors group ${hasAdminReply ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"}`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 transition-colors ${hasAdminReply ? "bg-amber-500 animate-pulse" : "bg-primary-400 group-hover:bg-primary-600"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${hasAdminReply ? "font-bold text-amber-900" : "font-medium text-gray-900"}`}>{ticket.subject}</p>
                        {hasAdminReply && (
                          <p className="text-xs font-semibold text-amber-600 mt-0.5">💬 Klientys a répondu</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(ticket.updated_at)}</p>
                      </div>
                      <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 shrink-0 ${STATUS_COLORS[ticket.status] || ""}`}>
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const SECTION_MAP: Record<Exclude<Section, "domaine" | "support">, React.FC> = {
  profil:        SectionProfil,
  securite:      SectionSecurite,
  site:          SectionSite,
  annuaire:      SectionAnnuaire,
  metriques:     SectionMetriques,
  abonnement:    SectionAbonnement,
  notifications: SectionNotifications,
  preferences:   SectionPreferences,
  membres:       SectionMembres,
  facturation:   SectionFacturation,
  integrations:  SectionIntegrations,
  export:        SectionExport,
  activite:      SectionActivite,
};

// Sections réservées aux owner/admin (jamais visibles pour les "member")
const OWNER_ONLY_SECTIONS = new Set<Section>(["abonnement", "membres"]);

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const NAV = getNav(t);
  const [active, setActive] = useState<Section>("profil");
  const [myRole, setMyRole] = useState<string>("owner");
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    api.getMyRole().then(({ role }) => setMyRole(role)).catch(() => {});
    const s = new URLSearchParams(window.location.search).get("section");
    if (s && s in SECTION_MAP) setActive(s as Section);

    // Badge = tickets "in_progress" (= admin a répondu, tenant doit lire)
    // Rafraîchi toutes les 30s même sans ouvrir la section Support
    const refreshBadge = () =>
      api.listSupportTickets()
        .then((tickets: any[]) => setOpenTickets(tickets.filter((t: any) => t.status === "in_progress").length))
        .catch(() => {});
    refreshBadge();
    const iv = setInterval(refreshBadge, 30_000);
    return () => clearInterval(iv);
  }, []);

  const isMember = myRole === "member";
  const visibleNAV = isMember ? NAV.filter(n => !OWNER_ONLY_SECTIONS.has(n.key)) : NAV;

  // Si un membre tente d'accéder à une section restreinte, on le redirige vers profil
  useEffect(() => {
    if (isMember && OWNER_ONLY_SECTIONS.has(active)) setActive("profil");
  }, [isMember, active]);

  const activeItem = visibleNAV.find(n => n.key === active) ?? visibleNAV[0];

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
          {visibleNAV.map(item => (
            <option key={item.key} value={item.key}>
              {item.icon}  {item.label}{item.key === "support" && openTickets > 0 ? ` (${openTickets})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar desktop */}
        <aside id="settings-nav" className="w-56 shrink-0 py-6 px-3 hidden md:block">
          <nav className="space-y-0.5">
            {visibleNAV.map(item => (
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
                <span className="flex-1">{item.label}</span>
                {item.key === "support" && openTickets > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold px-1 leading-none" title="Réponse de Klientys en attente">
                    {openTickets > 9 ? "9+" : openTickets}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenu */}
        <main className="flex-1 py-6 px-4 sm:px-6 min-w-0 space-y-4">
          {active === "domaine"
            ? <SectionDomaine onNavigate={setActive} />
            : active === "support"
            ? <SectionSupport onTicketRead={() => setOpenTickets(0)} />
            : (() => { const S = SECTION_MAP[active as Exclude<Section, "domaine" | "support">]; return <S />; })()
          }
        </main>
      </div>
    </div>
  );
}
