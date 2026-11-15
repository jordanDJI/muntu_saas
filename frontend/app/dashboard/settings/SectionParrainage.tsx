"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";

// Paramètres → Parrainage (migration 086). Le code est le slug du tenant ;
// le badge « Site créé avec Klientys » du site public porte déjà ce code.

type Lang = "fr" | "en" | "de" | "nl";

const T: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Parrainage",
    subtitle: "Un mois offert pour vous, et un mois offert pour chaque entreprise que vous recommandez.",
    how: "Comment ça marche",
    s1: "Partagez votre lien, ou donnez votre code à une entreprise de votre entourage.",
    s2: "Elle crée son espace : son premier mois d'abonnement est offert.",
    s3: "Dès qu'elle paie son deuxième mois, vous recevez un mois offert sur votre abonnement (ou 30 jours d'essai en plus si vous êtes encore en essai).",
    badge: "Le badge « Site créé avec Klientys » en bas de votre site contient déjà votre code : un visiteur qui s'inscrit depuis votre site compte comme votre filleul.",
    link: "Votre lien",
    code: "Votre code",
    copy: "Copier",
    copied: "Copié ✓",
    signed: "Inscrits",
    converted: "Abonnés",
    rewarded: "Mois gagnés",
    list: "Vos filleuls",
    empty: "Pas encore de filleul. Envoyez votre lien à un confrère, un fournisseur, un client professionnel…",
    st_signed: "Inscrit — pas encore abonné",
    st_credited: "Abonné — 1 mois crédité",
    st_trial: "Abonné — essai prolongé",
    st_pending: "Abonné — récompense en cours",
    st_failed: "Abonné — récompense en vérification",
    via_badge: "via votre site",
    share_msg: "J'utilise Klientys pour mon site et mes rendez-vous. Avec mon lien, ton premier mois est offert :",
  },
  en: {
    title: "Referrals",
    subtitle: "One free month for you, and one for every business you recommend.",
    how: "How it works",
    s1: "Share your link, or give your code to a business you know.",
    s2: "They create their workspace: their first month is free.",
    s3: "As soon as they pay their second month, you get a free month on your plan (or 30 more trial days if you are still on trial).",
    badge: "The “Site created with Klientys” badge at the bottom of your website already carries your code: a visitor who signs up from your site counts as your referral.",
    link: "Your link",
    code: "Your code",
    copy: "Copy",
    copied: "Copied ✓",
    signed: "Signed up",
    converted: "Subscribed",
    rewarded: "Months earned",
    list: "Your referrals",
    empty: "No referrals yet. Send your link to a peer, a supplier, a business client…",
    st_signed: "Signed up — not subscribed yet",
    st_credited: "Subscribed — 1 month credited",
    st_trial: "Subscribed — trial extended",
    st_pending: "Subscribed — reward in progress",
    st_failed: "Subscribed — reward being checked",
    via_badge: "via your website",
    share_msg: "I use Klientys for my website and bookings. With my link, your first month is free:",
  },
  de: {
    title: "Empfehlungen",
    subtitle: "Ein Gratismonat für Sie – und einer für jedes Unternehmen, das Sie empfehlen.",
    how: "So funktioniert es",
    s1: "Teilen Sie Ihren Link oder geben Sie Ihren Code an ein Unternehmen aus Ihrem Umfeld weiter.",
    s2: "Es erstellt seinen Bereich: Der erste Monat ist kostenlos.",
    s3: "Sobald es den zweiten Monat bezahlt, erhalten Sie einen Gratismonat (oder 30 zusätzliche Testtage, falls Sie noch testen).",
    badge: "Das Badge „Website erstellt mit Klientys“ unten auf Ihrer Website enthält bereits Ihren Code: Wer sich von Ihrer Website aus anmeldet, zählt als Ihre Empfehlung.",
    link: "Ihr Link",
    code: "Ihr Code",
    copy: "Kopieren",
    copied: "Kopiert ✓",
    signed: "Angemeldet",
    converted: "Abonniert",
    rewarded: "Gewonnene Monate",
    list: "Ihre Empfehlungen",
    empty: "Noch keine Empfehlung. Senden Sie Ihren Link an Kollegen, Lieferanten, Geschäftskunden…",
    st_signed: "Angemeldet — noch kein Abo",
    st_credited: "Abonniert — 1 Monat gutgeschrieben",
    st_trial: "Abonniert — Testphase verlängert",
    st_pending: "Abonniert — Prämie in Bearbeitung",
    st_failed: "Abonniert — Prämie wird geprüft",
    via_badge: "über Ihre Website",
    share_msg: "Ich nutze Klientys für meine Website und Termine. Mit meinem Link ist dein erster Monat gratis:",
  },
  nl: {
    title: "Doorverwijzen",
    subtitle: "Eén gratis maand voor u, en één voor elk bedrijf dat u aanbeveelt.",
    how: "Zo werkt het",
    s1: "Deel uw link of geef uw code aan een bedrijf uit uw omgeving.",
    s2: "Het maakt een account aan: de eerste maand is gratis.",
    s3: "Zodra het de tweede maand betaalt, krijgt u een gratis maand (of 30 extra proefdagen als u nog in de proefperiode zit).",
    badge: "De badge „Site gemaakt met Klientys” onderaan uw website bevat al uw code: een bezoeker die zich via uw site inschrijft, telt als uw doorverwijzing.",
    link: "Uw link",
    code: "Uw code",
    copy: "Kopiëren",
    copied: "Gekopieerd ✓",
    signed: "Ingeschreven",
    converted: "Geabonneerd",
    rewarded: "Verdiende maanden",
    list: "Uw doorverwijzingen",
    empty: "Nog geen doorverwijzing. Stuur uw link naar een collega, leverancier, zakelijke klant…",
    st_signed: "Ingeschreven — nog geen abonnement",
    st_credited: "Geabonneerd — 1 maand gecrediteerd",
    st_trial: "Geabonneerd — proefperiode verlengd",
    st_pending: "Geabonneerd — beloning in behandeling",
    st_failed: "Geabonneerd — beloning wordt gecontroleerd",
    via_badge: "via uw website",
    share_msg: "Ik gebruik Klientys voor mijn website en afspraken. Met mijn link is je eerste maand gratis:",
  },
};

const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", nl: "nl-NL" };

export default function SectionParrainage() {
  const { lang } = useLanguage();
  const l = (lang in T ? lang : "fr") as Lang;
  const t = T[l];
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.getMyReferrals().then(setData).catch((e) => setError(e.message));
  }, []);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* presse-papiers refusé : le texte reste sélectionnable */ }
  };

  const statusLabel = (r: any) => {
    if (r.status !== "converted") return t.st_signed;
    return ({ credited: t.st_credited, trial_extended: t.st_trial, failed: t.st_failed } as Record<string, string>)[r.reward_status] ?? t.st_pending;
  };

  const shareText = data?.link ? `${t.share_msg} ${data.link}` : "";

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">{t.how}</h3>
        <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">
          <li>{t.s1}</li>
          <li>{t.s2}</li>
          <li>{t.s3}</li>
        </ol>
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{t.badge}</p>
      </div>

      {data && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">{t.link}</label>
            <div className="flex gap-2">
              <input readOnly value={data.link} onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50" />
              <button onClick={() => copy("link", data.link)}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors">
                {copied === "link" ? t.copied : t.copy}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-500">{t.code}</span>
            <code className="text-sm font-semibold text-gray-900 bg-gray-100 rounded px-2 py-1">{data.code}</code>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 hover:underline">WhatsApp</a>
            <a href={`mailto:?subject=Klientys&body=${encodeURIComponent(shareText)}`}
              className="text-sm font-medium text-primary-700 hover:underline">Email</a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.link)}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-sky-700 hover:underline">LinkedIn</a>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[[t.signed, data.signed_up], [t.converted, data.converted], [t.rewarded, data.rewarded]].map(([label, value]) => (
            <div key={label as string} className="bg-white rounded-xl border p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="bg-white rounded-xl border p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{t.list}</h3>
          {data.referrals.length === 0 ? (
            <p className="text-sm text-gray-500">{t.empty}</p>
          ) : (
            <ul className="divide-y">
              {data.referrals.map((r: any, i: number) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString(LOCALES[l])}
                      {r.via === "badge" ? ` · ${t.via_badge}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-0.5 border ${
                    r.status === "converted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}>
                    {statusLabel(r)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
