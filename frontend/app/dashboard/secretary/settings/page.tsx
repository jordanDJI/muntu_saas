"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { api, supabase } from "../../../../lib/api";
import { useLanguage, LANGUAGES } from "../../../../contexts/LanguageContext";

type Tab = "profil" | "securite" | "preferences" | "activite";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "profil",       label: "Profil",       icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> },
  { key: "securite",     label: "Sécurité",     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> },
  { key: "preferences",  label: "Préférences",  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg> },
  { key: "activite",     label: "Activité",     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> },
];

const ACTION_ICON: Record<string, string> = {
  "RDV confirmé": "✅", "RDV annulé": "❌", "RDV modifié": "📅",
  "Profil mis à jour": "✏️", "Mot de passe modifié": "🔑",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 p-6 space-y-4 ${className}`}>{children}</div>;
}

function Feedback({ msg }: { msg: string }) {
  if (!msg) return null;
  const ok = !msg.toLowerCase().includes("erreur");
  return <p className={`text-sm font-medium ${ok ? "text-green-600" : "text-red-500"}`}>{msg}</p>;
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-10 h-5 rounded-full transition-colors relative shrink-0 ${checked ? "bg-primary-600" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`}/>
      </button>
    </label>
  );
}

// ── Section Profil ───────────────────────────────────────────────────────────

function SectionProfil() {
  const { lang: ctxLang, setLang: ctxSetLang } = useLanguage();
  const [user, setUser]     = useState<any>(null);
  const [name, setName]     = useState("");
  const [tz, setTz]         = useState("Europe/Brussels");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return;
      setUser(u);
      const m = u.user_metadata ?? {};
      setName(m.full_name ?? [m.first_name, m.last_name].filter(Boolean).join(" "));
      setTz(m.timezone ?? "Europe/Brussels");
    });
  }, []);

  const initials = name ? name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "?");

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { full_name: name, lang: ctxLang, timezone: tz } });
      setMsg("Profil sauvegardé avec succès.");
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Profil utilisateur</h2>
        <p className="text-sm text-gray-500 mt-1">Vos informations personnelles.</p>
      </div>

      <Card>
        {/* Avatar initial */}
        <div className="flex items-center gap-4 pb-2">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0" style={{ background: "#0D4B58" }}>
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{name || "—"}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(13,75,88,.1)", color: "#0D4B58" }}>
              Secrétaire
            </span>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Prénom Nom"
              className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              value={user?.email ?? ""}
              disabled
              className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">L&apos;email ne peut pas être modifié.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Langue d&apos;affichage</label>
              <select
                value={ctxLang}
                onChange={e => ctxSetLang(e.target.value as any)}
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuseau horaire</label>
              <select
                value={tz}
                onChange={e => setTz(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="Europe/Brussels">Europe/Brussels (UTC+1/+2)</option>
                <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
                <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
            <Feedback msg={msg} />
          </div>
        </form>
      </Card>
    </>
  );
}

// ── Section Sécurité ─────────────────────────────────────────────────────────

function SectionSecurite() {
  const [current, setCurrent]     = useState("");
  const [next, setNext]           = useState("");
  const [confirm, setConfirm]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");
  const [isOAuth, setIsOAuth]     = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const p = user?.app_metadata?.provider;
      setIsOAuth(p === "google" || p === "github");
    });
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    if (next !== confirm) { setMsg("Erreur : les mots de passe ne correspondent pas."); return; }
    if (next.length < 8) { setMsg("Erreur : minimum 8 caractères."); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session introuvable");
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (signErr) throw new Error("Mot de passe actuel incorrect.");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setMsg("Mot de passe modifié avec succès.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      setMsg(`Erreur : ${err.message}`);
    } finally { setSaving(false); }
  };

  const sendReset = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email);
    setResetSent(true);
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Sécurité</h2>
        <p className="text-sm text-gray-500 mt-1">Gérez votre mot de passe et la sécurité de votre compte.</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Modifier le mot de passe</h3>
        {isOAuth ? (
          <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            Votre compte est connecté via Google. La modification du mot de passe n&apos;est pas disponible.
          </p>
        ) : (
          <form onSubmit={changePassword} className="space-y-3">
            {[
              { label: "Mot de passe actuel", value: current, set: setCurrent },
              { label: "Nouveau mot de passe", value: next, set: setNext, min: 8 },
              { label: "Confirmer le nouveau mot de passe", value: confirm, set: setConfirm },
            ].map(({ label, value, set, min }) => (
              <div key={label}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={e => set(e.target.value)}
                  required
                  minLength={min}
                  className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Modification…" : "Modifier le mot de passe"}
              </button>
              <Feedback msg={msg} />
            </div>
          </form>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Mot de passe oublié ?</h3>
        <p className="text-sm text-gray-500">Recevoir un lien de réinitialisation par email.</p>
        {resetSent ? (
          <p className="text-sm font-medium text-green-600">Email envoyé — vérifiez votre boîte mail.</p>
        ) : (
          <button
            onClick={sendReset}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Envoyer le lien de réinitialisation
          </button>
        )}
      </Card>
    </>
  );
}

// ── Section Préférences ──────────────────────────────────────────────────────

function SectionPreferences() {
  const [darkMode, setDarkMode] = useState(false);
  const [compact, setCompact]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const p = user.user_metadata?.ui_prefs ?? {};
      setDarkMode(p.darkMode ?? false);
      setCompact(p.compactView ?? false);
    });
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await supabase.auth.updateUser({ data: { ui_prefs: { darkMode, compactView: compact } } });
      setMsg("Préférences sauvegardées.");
    } catch { setMsg("Erreur lors de la sauvegarde."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Préférences</h2>
        <p className="text-sm text-gray-500 mt-1">Personnalisez l&apos;apparence de l&apos;interface.</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-700">Apparence</h3>
        <div className="space-y-4">
          <Toggle
            checked={darkMode}
            onChange={(v) => {
              setDarkMode(v);
              window.dispatchEvent(new CustomEvent("klientys-darkmode", { detail: { darkMode: v } }));
            }}
            label="Mode sombre"
            hint="Adapte l'interface aux environnements peu lumineux."
          />
          <Toggle
            checked={compact}
            onChange={setCompact}
            label="Vue compacte"
            hint="Réduit l'espacement pour afficher plus d'informations."
          />
        </div>
      </Card>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        <Feedback msg={msg} />
      </div>
    </>
  );
}

// ── Section Activité ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function SectionActivite() {
  const [logs, setLogs]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const offsetRef   = useRef(0);
  const busyRef     = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchMore = useCallback(async () => {
    if (busyRef.current || !hasMore) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const data = await api.getSecretaryActivityLog(PAGE_SIZE, offsetRef.current);
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
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) fetchMore(); }, { rootMargin: "100px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [fetchMore, hasMore]);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Journaux d&apos;activité</h2>
        <p className="text-sm text-gray-500 mt-1">Vos actions récentes sur les espaces de travail.</p>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#0D4B58", borderTopColor: "transparent" }} />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune activité enregistrée pour l&apos;instant.</p>
        ) : (
          <div className="space-y-0.5">
            {logs.map((e, i) => (
              <div key={e.id ?? i} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                <span className="text-base leading-none mt-0.5 shrink-0">{ACTION_ICON[e.action] ?? "📋"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{e.action}</p>
                  {e.detail && <p className="text-xs text-gray-400">{e.detail}</p>}
                  {e.tenant?.name && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ background: "rgba(13,75,88,.08)", color: "#0D4B58" }}>
                      {e.tenant.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 shrink-0 mt-0.5">
                  {new Date(e.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            ))}
            <div ref={sentinelRef} className="pt-1">
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#0D4B58", borderTopColor: "transparent" }} />
                </div>
              )}
              {!hasMore && logs.length >= PAGE_SIZE && (
                <p className="text-xs text-gray-400 text-center py-2">Tout l&apos;historique est chargé.</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SecretarySettingsPage() {
  const [active, setActive] = useState<Tab>("profil");

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex gap-6 items-start">

      {/* Sidebar nav — sticky */}
      <aside className="w-52 shrink-0 sticky top-20">
        <nav className="bg-white rounded-xl border border-gray-200 p-1.5 space-y-0.5">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              id={`settings-${key}-btn`}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active === key
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 space-y-4">
        {active === "profil"      && <SectionProfil />}
        {active === "securite"    && <SectionSecurite />}
        {active === "preferences" && <SectionPreferences />}
        {active === "activite"    && <SectionActivite />}
      </main>
    </div>
  );
}
