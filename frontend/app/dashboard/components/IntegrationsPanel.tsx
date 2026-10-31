"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { useLanguage, type Lang } from "../../../contexts/LanguageContext";

// Intégrations des widgets sur des supports externes (migration 080).
// Partagé par Paramètres → Mon site (suivi, désactivation) et par la page
// Intégrer (création, choix de l'intégration dont on copie le code).

export type Integration = {
  id: string;
  key: string;
  name: string;
  kind: "website" | "iframe" | "link";
  status: "active" | "disabled";
  disabled_reason: "manual" | "custom_domain" | null;
  auto_created: boolean;
  last_seen_at: string | null;
  domains: { domain: string; last_seen_at: string }[];
  leads_count: number;
  appointments_count: number;
};

// Au-delà, un support qui ne charge plus les widgets a probablement retiré le code
const STALE_DAYS = 30;

const STR = {
  fr: {
    title: "Intégrations",
    subtitle: "Les supports externes où vos widgets Klientys sont installés.",
    empty: "Aucune intégration pour l'instant.",
    add: "Ajouter une intégration →",
    kind: { website: "Site web", iframe: "Iframe", link: "Lien" },
    active: "Active", disabled: "Désactivée",
    reasonDomain: "désactivée automatiquement : ce domaine affiche maintenant votre site Klientys",
    auto: "détectée automatiquement",
    leads: "demandes", appts: "RDV",
    seen: "Vue", never: "Jamais vue", ago: (d: number) => d === 0 ? "aujourd'hui" : `il y a ${d} j`,
    stale: `Plus vue depuis ${STALE_DAYS} jours : le code a peut-être été retiré.`,
    multi: (n: number) => `Utilisée sur ${n} domaines : créez une intégration par site pour mesurer séparément.`,
    noDomain: "Domaine non détecté",
    disable: "Désactiver", enable: "Réactiver", rename: "Renommer", save: "Enregistrer", cancel: "Annuler",
    confirmDisable: "Les widgets de ce support seront masqués, même si le code reste installé. Vous pourrez les réactiver.",
    confirmDisableLink: "Ce lien cessera de fonctionner : les visiteurs verront « service indisponible ». Vous pourrez le réactiver.",
    confirm: "Confirmer",
    createTitle: "Nouvelle intégration", namePh: "Ex. Site Muntu Cura, Bio Instagram…", create: "Créer",
    select: "Afficher le code",
    error: "Une erreur est survenue.",
    chatTitle: "Chatbot sur vos supports externes",
    chatReady: "Prêt : votre chatbot peut répondre sur vos supports externes.",
    chatMissing: "Inactif sur vos supports externes. Il manque :",
    req: { title: "le titre du site", description: "une description", service: "au moins une prestation", contact: "un téléphone ou un email de contact" },
    complete: "Compléter dans le site-builder →",
    slugLabel: "Identifiant (slug) utilisé dans le code de vos widgets :",
    noindexNote: "Vos widgets sont installés sur votre propre site : ce site Klientys reste consultable mais n'est pas référencé dans Google, pour ne pas concurrencer votre site. Il le sera dès que vous connecterez votre domaine personnalisé.",
    conflictTitle: "Ce domaine affiche déjà vos widgets Klientys",
    conflictText: (names: string) => `Intégration(s) concernée(s) : ${names}. Elles seront désactivées automatiquement dès que le domaine sera actif sur Klientys — d'ici là, votre site actuel garde ses widgets.`,
    conflictConfirm: "Connecter quand même",
  },
  en: {
    title: "Integrations",
    subtitle: "External platforms where your Klientys widgets are installed.",
    empty: "No integrations yet.",
    add: "Add an integration →",
    kind: { website: "Website", iframe: "Iframe", link: "Link" },
    active: "Active", disabled: "Disabled",
    reasonDomain: "disabled automatically: this domain now shows your Klientys site",
    auto: "detected automatically",
    leads: "requests", appts: "bookings",
    seen: "Seen", never: "Never seen", ago: (d: number) => d === 0 ? "today" : `${d} d ago`,
    stale: `Not seen for ${STALE_DAYS} days: the code may have been removed.`,
    multi: (n: number) => `Used on ${n} domains: create one integration per site to measure them separately.`,
    noDomain: "Domain not detected",
    disable: "Disable", enable: "Re-enable", rename: "Rename", save: "Save", cancel: "Cancel",
    confirmDisable: "The widgets on this platform will be hidden, even if the code stays installed. You can re-enable them.",
    confirmDisableLink: "This link will stop working: visitors will see “service unavailable”. You can re-enable it.",
    confirm: "Confirm",
    createTitle: "New integration", namePh: "E.g. My website, Instagram bio…", create: "Create",
    select: "Show code",
    error: "Something went wrong.",
    chatTitle: "Chatbot on your external platforms",
    chatReady: "Ready: your chatbot can answer on your external platforms.",
    chatMissing: "Inactive on your external platforms. Missing:",
    req: { title: "the site title", description: "a description", service: "at least one service", contact: "a contact phone or email" },
    complete: "Complete in the site builder →",
    slugLabel: "Identifier (slug) used in your widget code:",
    noindexNote: "Your widgets are installed on your own website: this Klientys site stays accessible but is not indexed by Google, so it does not compete with your site. It will be once you connect your custom domain.",
    conflictTitle: "This domain already shows your Klientys widgets",
    conflictText: (names: string) => `Integration(s) concerned: ${names}. They will be disabled automatically once the domain is active on Klientys — until then, your current site keeps its widgets.`,
    conflictConfirm: "Connect anyway",
  },
  de: {
    title: "Integrationen",
    subtitle: "Externe Plattformen, auf denen Ihre Klientys-Widgets installiert sind.",
    empty: "Noch keine Integration.",
    add: "Integration hinzufügen →",
    kind: { website: "Website", iframe: "Iframe", link: "Link" },
    active: "Aktiv", disabled: "Deaktiviert",
    reasonDomain: "automatisch deaktiviert: Diese Domain zeigt jetzt Ihre Klientys-Website",
    auto: "automatisch erkannt",
    leads: "Anfragen", appts: "Termine",
    seen: "Gesehen", never: "Nie gesehen", ago: (d: number) => d === 0 ? "heute" : `vor ${d} T.`,
    stale: `Seit ${STALE_DAYS} Tagen nicht gesehen: Der Code wurde vielleicht entfernt.`,
    multi: (n: number) => `Auf ${n} Domains verwendet: Erstellen Sie eine Integration pro Website, um sie getrennt zu messen.`,
    noDomain: "Domain nicht erkannt",
    disable: "Deaktivieren", enable: "Reaktivieren", rename: "Umbenennen", save: "Speichern", cancel: "Abbrechen",
    confirmDisable: "Die Widgets dieser Plattform werden ausgeblendet, auch wenn der Code installiert bleibt. Sie können sie reaktivieren.",
    confirmDisableLink: "Dieser Link funktioniert nicht mehr: Besucher sehen „Dienst nicht verfügbar“. Sie können ihn reaktivieren.",
    confirm: "Bestätigen",
    createTitle: "Neue Integration", namePh: "Z. B. Meine Website, Instagram-Bio…", create: "Erstellen",
    select: "Code anzeigen",
    error: "Ein Fehler ist aufgetreten.",
    chatTitle: "Chatbot auf Ihren externen Plattformen",
    chatReady: "Bereit: Ihr Chatbot kann auf Ihren externen Plattformen antworten.",
    chatMissing: "Auf Ihren externen Plattformen inaktiv. Es fehlt:",
    req: { title: "der Website-Titel", description: "eine Beschreibung", service: "mindestens eine Leistung", contact: "eine Kontakttelefonnummer oder E-Mail" },
    complete: "Im Website-Builder ergänzen →",
    slugLabel: "Kennung (Slug) im Code Ihrer Widgets:",
    noindexNote: "Ihre Widgets sind auf Ihrer eigenen Website installiert: Diese Klientys-Website bleibt erreichbar, wird aber nicht von Google indexiert, um Ihrer Website keine Konkurrenz zu machen. Das ändert sich, sobald Sie Ihre eigene Domain verbinden.",
    conflictTitle: "Diese Domain zeigt bereits Ihre Klientys-Widgets",
    conflictText: (names: string) => `Betroffene Integration(en): ${names}. Sie werden automatisch deaktiviert, sobald die Domain auf Klientys aktiv ist — bis dahin behält Ihre aktuelle Website ihre Widgets.`,
    conflictConfirm: "Trotzdem verbinden",
  },
  nl: {
    title: "Integraties",
    subtitle: "Externe platformen waar uw Klientys-widgets geïnstalleerd zijn.",
    empty: "Nog geen integraties.",
    add: "Integratie toevoegen →",
    kind: { website: "Website", iframe: "Iframe", link: "Link" },
    active: "Actief", disabled: "Gedeactiveerd",
    reasonDomain: "automatisch gedeactiveerd: dit domein toont nu uw Klientys-site",
    auto: "automatisch gedetecteerd",
    leads: "aanvragen", appts: "afspraken",
    seen: "Gezien", never: "Nooit gezien", ago: (d: number) => d === 0 ? "vandaag" : `${d} d geleden`,
    stale: `Al ${STALE_DAYS} dagen niet gezien: de code is mogelijk verwijderd.`,
    multi: (n: number) => `Gebruikt op ${n} domeinen: maak één integratie per site om ze apart te meten.`,
    noDomain: "Domein niet gedetecteerd",
    disable: "Deactiveren", enable: "Heractiveren", rename: "Hernoemen", save: "Opslaan", cancel: "Annuleren",
    confirmDisable: "De widgets op dit platform worden verborgen, ook als de code geïnstalleerd blijft. U kunt ze heractiveren.",
    confirmDisableLink: "Deze link werkt niet meer: bezoekers zien „dienst niet beschikbaar”. U kunt hem heractiveren.",
    confirm: "Bevestigen",
    createTitle: "Nieuwe integratie", namePh: "Bv. Mijn website, Instagram-bio…", create: "Aanmaken",
    select: "Code tonen",
    error: "Er is een fout opgetreden.",
    chatTitle: "Chatbot op uw externe platformen",
    chatReady: "Klaar: uw chatbot kan antwoorden op uw externe platformen.",
    chatMissing: "Inactief op uw externe platformen. Ontbreekt:",
    req: { title: "de titel van de site", description: "een beschrijving", service: "minstens één dienst", contact: "een contacttelefoon of -e-mail" },
    complete: "Aanvullen in de sitebouwer →",
    slugLabel: "Identificatie (slug) in de code van uw widgets:",
    noindexNote: "Uw widgets staan op uw eigen website: deze Klientys-site blijft bereikbaar maar wordt niet door Google geïndexeerd, zodat hij uw site niet beconcurreert. Dat verandert zodra u uw eigen domein koppelt.",
    conflictTitle: "Dit domein toont al uw Klientys-widgets",
    conflictText: (names: string) => `Betrokken integratie(s): ${names}. Ze worden automatisch gedeactiveerd zodra het domein actief is op Klientys — tot dan behoudt uw huidige site zijn widgets.`,
    conflictConfirm: "Toch koppelen",
  },
};

export function useIntegrationsT() {
  const { lang } = useLanguage();
  return STR[(lang as Lang) in STR ? (lang as keyof typeof STR) : "fr"];
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : null;
}

export function ChatbotReadiness() {
  const s = useIntegrationsT();
  const [state, setState] = useState<{ ready: boolean; missing: string[] } | null>(null);

  useEffect(() => { api.getChatbotReadiness().then(setState).catch(() => setState(null)); }, []);
  if (!state) return null;

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${state.ready ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
      <p className="font-semibold mb-1">{s.chatTitle}</p>
      {state.ready ? <p className="text-xs">{s.chatReady}</p> : (
        <>
          <p className="text-xs">{s.chatMissing}</p>
          <ul className="text-xs list-disc ml-5 mt-1">
            {state.missing.map(m => <li key={m}>{s.req[m as keyof typeof s.req] ?? m}</li>)}
          </ul>
          <Link href="/dashboard/site-builder" className="inline-block text-xs font-medium underline mt-2">{s.complete}</Link>
        </>
      )}
    </div>
  );
}

export function IntegrationsPanel({ showCreate = false, selectedId, onSelect, onLoaded }: {
  showCreate?: boolean;
  selectedId?: string | null;
  onSelect?: (integration: Integration) => void;
  onLoaded?: (integrations: Integration[]) => void;
}) {
  const s = useIntegrationsT();
  const [items, setItems] = useState<Integration[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<Integration["kind"]>("website");

  // Ref : un parent qui passe une fonction anonyme ne doit pas relancer le
  // chargement à chaque rendu.
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const errorLabel = s.error;

  const commit = useCallback((next: Integration[]) => {
    setItems(next);
    onLoadedRef.current?.(next);
  }, []);

  useEffect(() => {
    api.getIntegrations()
      .then((rows) => commit(rows as Integration[]))
      .catch(() => { setItems([]); setError(errorLabel); });
  }, [commit, errorLabel]);

  const replace = (row: Integration) => commit((items ?? []).map(i => i.id === row.id ? row : i));

  const setStatus = async (integ: Integration, status: "active" | "disabled") => {
    setBusy(integ.id); setError("");
    try { replace(await api.updateIntegration(integ.id, { status })); setConfirmId(null); }
    catch (e: any) { setError(e?.message ?? s.error); }
    finally { setBusy(null); }
  };

  const rename = async (integ: Integration) => {
    if (!renameValue.trim()) return;
    setBusy(integ.id); setError("");
    try { replace(await api.updateIntegration(integ.id, { name: renameValue.trim() })); setRenameId(null); }
    catch (e: any) { setError(e?.message ?? s.error); }
    finally { setBusy(null); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy("new"); setError("");
    try {
      const row = await api.createIntegration({ name: newName.trim(), kind: newKind }) as Integration;
      commit([...(items ?? []), row]);
      setNewName("");
      onSelect?.(row);
    } catch (e: any) { setError(e?.message ?? s.error); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold text-sm text-gray-700">{s.title}</p>
        <p className="text-xs text-gray-500">{s.subtitle}</p>
      </div>

      {items === null ? null : items.length === 0 ? (
        <p className="text-xs text-gray-400">{s.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map(integ => {
            const seenDays = daysSince(integ.last_seen_at);
            const stale = integ.status === "active" && integ.kind !== "link" && seenDays !== null && seenDays >= STALE_DAYS;
            const selected = selectedId === integ.id;
            return (
              <li key={integ.id} className={`rounded-xl border px-4 py-3 ${selected ? "border-primary-300 bg-primary-50/40" : "border-gray-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {renameId === integ.id ? (
                      <div className="flex gap-2">
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)} maxLength={80}
                          className="border rounded-lg px-2 py-1 text-sm" autoFocus />
                        <button onClick={() => rename(integ)} disabled={busy === integ.id} className="text-xs font-medium text-primary-600">{s.save}</button>
                        <button onClick={() => setRenameId(null)} className="text-xs text-gray-500">{s.cancel}</button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {integ.name}
                        <span className="ml-2 text-xs font-normal text-gray-500">{s.kind[integ.kind]}</span>
                        {integ.auto_created && <span className="ml-2 text-xs font-normal text-gray-400">· {s.auto}</span>}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {integ.leads_count} {s.leads} · {integ.appointments_count} {s.appts}
                      {integ.kind !== "link" && <> · {seenDays === null ? s.never : `${s.seen} ${s.ago(seenDays)}`}</>}
                    </p>
                    {integ.kind !== "link" && (
                      <p className="text-xs text-gray-400 truncate">
                        {integ.domains.length ? integ.domains.map(d => d.domain).join(", ") : s.noDomain}
                      </p>
                    )}
                    {integ.domains.length > 1 && <p className="text-xs text-amber-600">{s.multi(integ.domains.length)}</p>}
                    {stale && <p className="text-xs text-amber-600">{s.stale}</p>}
                    {integ.status === "disabled" && integ.disabled_reason === "custom_domain" && (
                      <p className="text-xs text-gray-500">{s.reasonDomain}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${integ.status === "active" ? "text-green-700 bg-green-50 border-green-200" : "text-gray-500 bg-gray-100 border-gray-200"}`}>
                    {integ.status === "active" ? s.active : s.disabled}
                  </span>
                </div>

                {confirmId === integ.id ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                    <p className="text-xs text-red-700">{integ.kind === "link" ? s.confirmDisableLink : s.confirmDisable}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setStatus(integ, "disabled")} disabled={busy === integ.id}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white disabled:opacity-60">{s.confirm}</button>
                      <button onClick={() => setConfirmId(null)} className="px-3 py-1 rounded-lg text-xs border bg-white text-gray-600">{s.cancel}</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {onSelect && <button onClick={() => onSelect(integ)} className="font-medium text-primary-600 hover:underline">{s.select}</button>}
                    <button onClick={() => { setRenameId(integ.id); setRenameValue(integ.name); }} className="text-gray-500 hover:text-gray-700">{s.rename}</button>
                    {integ.status === "active" ? (
                      <button onClick={() => setConfirmId(integ.id)} className="text-red-600 hover:underline">{s.disable}</button>
                    ) : (
                      <button onClick={() => setStatus(integ, "active")} disabled={busy === integ.id} className="text-green-700 hover:underline disabled:opacity-60">{s.enable}</button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showCreate ? (
        <form onSubmit={create} className="rounded-xl border border-dashed border-gray-300 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600">{s.createTitle}</p>
          <div className="flex flex-wrap gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={s.namePh} maxLength={80}
              className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px]" />
            <select value={newKind} onChange={e => setNewKind(e.target.value as Integration["kind"])}
              className="border rounded-lg px-2 py-1.5 text-sm">
              {(["website", "iframe", "link"] as const).map(k => <option key={k} value={k}>{s.kind[k]}</option>)}
            </select>
            <button type="submit" disabled={busy === "new" || !newName.trim()}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white disabled:opacity-50">{s.create}</button>
          </div>
        </form>
      ) : (
        <Link href="/dashboard/embed" className="inline-block text-xs font-medium text-primary-600 hover:underline">{s.add}</Link>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
