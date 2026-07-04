"use client";
import { useState, useEffect } from "react";

type Colors = { hero: string; accent: string; light: string };

interface SiteFooterProps {
  site: any;
  colors: Colors;
  showAbout: boolean;
  showServices: boolean;
  tracking: { ga4_id?: string; meta_pixel_id?: string; gtm_id?: string };
}

type Modal = "legal" | "privacy" | "cookies" | null;

// ── Contenu des modals légales ──────────────────────────────────────────────

function LegalContent({ site }: { site: any }) {
  return (
    <>
      <h4 className="font-semibold text-gray-800">Éditeur du site</h4>
      <p>{site.title}</p>
      {site.address && <p>Adresse : {site.address}</p>}
      {site.email_contact && <p>Email : {site.email_contact}</p>}
      {site.phone && <p>Téléphone : {site.phone}</p>}

      <h4 className="font-semibold text-gray-800 mt-4">Hébergement</h4>
      <p>
        Ce site est hébergé par <strong>Klientys</strong> (klientys.co), propulsé par{" "}
        <strong>Vercel Inc.</strong> — 340 Pine Street, Suite 1101, San Francisco, CA 94104, USA.
      </p>

      <h4 className="font-semibold text-gray-800 mt-4">Propriété intellectuelle</h4>
      <p>
        L'ensemble du contenu de ce site (textes, images, graphismes) est la propriété exclusive de{" "}
        {site.title}. Toute reproduction, même partielle, est interdite sans autorisation préalable.
      </p>

      <h4 className="font-semibold text-gray-800 mt-4">Responsabilité</h4>
      <p>
        {site.title} s'efforce de fournir des informations exactes et à jour mais ne peut garantir
        l'exhaustivité ni l'exactitude des informations publiées.
      </p>
    </>
  );
}

function PrivacyContent({ site }: { site: any }) {
  return (
    <>
      <p className="text-gray-500 text-xs">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>

      <h4 className="font-semibold text-gray-800 mt-3">Responsable du traitement</h4>
      <p>{site.title}{site.address ? ` — ${site.address}` : ""}</p>
      {site.email_contact && <p>Contact DPO : {site.email_contact}</p>}

      <h4 className="font-semibold text-gray-800 mt-4">Données collectées</h4>
      <p>Via le formulaire de contact et de réservation, nous collectons :</p>
      <ul className="list-disc ml-4 space-y-1 mt-1">
        <li>Nom et prénom</li>
        <li>Adresse e-mail</li>
        <li>Numéro de téléphone (optionnel)</li>
        <li>Message ou motif de la demande</li>
      </ul>

      <h4 className="font-semibold text-gray-800 mt-4">Finalités et base légale</h4>
      <ul className="list-disc ml-4 space-y-1 mt-1">
        <li>Répondre à vos demandes de contact (intérêt légitime)</li>
        <li>Confirmer et gérer vos rendez-vous (exécution d'un contrat)</li>
        <li>Analyser la fréquentation du site (consentement)</li>
      </ul>

      <h4 className="font-semibold text-gray-800 mt-4">Conservation</h4>
      <p>Vos données sont conservées 3 ans à compter du dernier contact, puis supprimées.</p>

      <h4 className="font-semibold text-gray-800 mt-4">Vos droits (RGPD)</h4>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition et de portabilité.
        Pour exercer ces droits, contactez-nous à{" "}
        {site.email_contact ? (
          <a href={`mailto:${site.email_contact}`} className="underline text-gray-700">{site.email_contact}</a>
        ) : "l'adresse indiquée dans les mentions légales"}.
      </p>
      <p className="mt-2">
        En cas de litige, vous pouvez introduire une réclamation auprès de votre autorité de protection des données
        (CNIL en France, APD en Belgique).
      </p>

      <h4 className="font-semibold text-gray-800 mt-4">Sous-traitants</h4>
      <ul className="list-disc ml-4 space-y-1 mt-1">
        <li>Klientys / Supabase (stockage des données, UE)</li>
        <li>Vercel (hébergement, USA — encadré par des clauses contractuelles types)</li>
        {site.site_style?.tracking?.ga4_id && <li>Google Analytics (analyse de trafic)</li>}
        {site.site_style?.tracking?.meta_pixel_id && <li>Meta Pixel (publicité / retargeting)</li>}
        {site.site_style?.tracking?.gtm_id && <li>Google Tag Manager</li>}
      </ul>
    </>
  );
}

function CookiesContent({ site, tracking }: { site: any; tracking: SiteFooterProps["tracking"] }) {
  const hasGA4 = !!tracking.ga4_id;
  const hasMeta = !!tracking.meta_pixel_id;
  const hasGTM = !!tracking.gtm_id;
  return (
    <>
      <p className="text-gray-500 text-xs">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>

      <p className="mt-2">
        Un cookie est un petit fichier texte déposé sur votre appareil lors de la visite d'un site web.
        Ce site utilise les catégories de cookies suivantes :
      </p>

      <h4 className="font-semibold text-gray-800 mt-4">Cookies strictement nécessaires</h4>
      <p>Indispensables au fonctionnement du site. Ils ne nécessitent pas de consentement.</p>
      <ul className="list-disc ml-4 space-y-1 mt-1">
        <li><strong>_pp_sid</strong> — identifiant de session anonyme (sessionStorage, supprimé à la fermeture de l'onglet)</li>
      </ul>

      {(hasGA4 || hasGTM) && (
        <>
          <h4 className="font-semibold text-gray-800 mt-4">Cookies analytiques</h4>
          <p>Permettent de mesurer la fréquentation et améliorer l'expérience du site.</p>
          <ul className="list-disc ml-4 space-y-1 mt-1">
            {hasGA4 && <li><strong>Google Analytics 4</strong> — mesure d'audience (conservation 26 mois)</li>}
            {hasGTM && <li><strong>Google Tag Manager</strong> — gestion des balises de suivi</li>}
          </ul>
        </>
      )}

      {hasMeta && (
        <>
          <h4 className="font-semibold text-gray-800 mt-4">Cookies publicitaires</h4>
          <p>Permettent de diffuser des publicités adaptées à vos centres d'intérêt.</p>
          <ul className="list-disc ml-4 space-y-1 mt-1">
            <li><strong>Meta Pixel (Facebook)</strong> — suivi des conversions et retargeting publicitaire</li>
          </ul>
        </>
      )}

      {!hasGA4 && !hasGTM && !hasMeta && (
        <>
          <h4 className="font-semibold text-gray-800 mt-4">Cookies tiers</h4>
          <p>Ce site n'utilise actuellement aucun cookie analytique ou publicitaire tiers.</p>
        </>
      )}

      <h4 className="font-semibold text-gray-800 mt-4">Gérer vos préférences</h4>
      <p>
        Vous pouvez accepter ou refuser les cookies non essentiels via la bannière affichée à votre
        première visite. Vous pouvez également configurer votre navigateur pour bloquer les cookies.
        Note : le refus des cookies analytiques n'affecte pas votre navigation sur le site.
      </p>
    </>
  );
}

// ── Composant principal ─────────────────────────────────────────────────────

export default function SiteFooter({ site, colors, showAbout, showServices, tracking }: SiteFooterProps) {
  const [modal, setModal] = useState<Modal>(null);
  const [cookieConsent, setCookieConsent] = useState<boolean | null>(null);
  const social = site.social_links ?? {};
  const hasTracking = !!(tracking.ga4_id || tracking.meta_pixel_id || tracking.gtm_id);

  useEffect(() => {
    const stored = localStorage.getItem("klientys_cookie_consent");
    if (stored !== null) setCookieConsent(stored === "true");
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("klientys_cookie_consent", "true");
    setCookieConsent(true);
  };

  const declineCookies = () => {
    localStorage.setItem("klientys_cookie_consent", "false");
    setCookieConsent(false);
  };

  return (
    <>
      <footer style={{ backgroundColor: colors.hero }}>
        <div className="max-w-5xl mx-auto px-6 pt-14 pb-6">

          {/* 4 colonnes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 pb-10 border-b border-white/10">

            {/* Col 1 — Marque */}
            <div className="col-span-2 md:col-span-1">
              <p className="font-bold text-white text-xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {site.title}
              </p>
              {site.tagline && (
                <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.52)" }}>
                  {site.tagline}
                </p>
              )}
              {/* Réseaux sociaux */}
              {(social.facebook || social.instagram || social.linkedin || social.tiktok || social.twitter) && (
                <div className="flex gap-2 mt-5">
                  {social.facebook && (
                    <a href={social.facebook} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "rgba(255,255,255,0.13)", color: "white" }}>f</a>
                  )}
                  {social.instagram && (
                    <a href={social.instagram} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "rgba(255,255,255,0.13)", color: "white" }}>ig</a>
                  )}
                  {social.linkedin && (
                    <a href={social.linkedin} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "rgba(255,255,255,0.13)", color: "white" }}>in</a>
                  )}
                  {social.tiktok && (
                    <a href={social.tiktok} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "rgba(255,255,255,0.13)", color: "white" }}>tt</a>
                  )}
                  {social.twitter && (
                    <a href={social.twitter} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "rgba(255,255,255,0.13)", color: "white" }}>𝕏</a>
                  )}
                </div>
              )}
              {/* RDV CTA */}
              <a
                href="#rdv"
                className="inline-flex items-center gap-1.5 mt-5 text-xs font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-85"
                style={{ backgroundColor: colors.accent, color: "#fff" }}
              >
                Prendre rendez-vous →
              </a>
            </div>

            {/* Col 2 — Navigation */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.38)" }}>
                Navigation
              </p>
              <ul className="space-y-2.5">
                <li>
                  <a href="#hero" className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.58)" }}>
                    Accueil
                  </a>
                </li>
                {showAbout && site.description && (
                  <li>
                    <a href="#a-propos" className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.58)" }}>
                      À propos
                    </a>
                  </li>
                )}
                {showServices && site.service_offer?.length > 0 && (
                  <li>
                    <a href="#prestations" className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.58)" }}>
                      Prestations
                    </a>
                  </li>
                )}
                <li>
                  <a href="#contact" className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.58)" }}>
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3 — Coordonnées */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.38)" }}>
                Coordonnées
              </p>
              <ul className="space-y-3">
                {site.phone && (
                  <li>
                    <a href={`tel:${site.phone}`} className="flex items-start gap-2 text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.58)" }}>
                      <svg className="mt-0.5 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.5 3.18 2 2 0 012.18 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                      </svg>
                      {site.phone}
                    </a>
                  </li>
                )}
                {site.email_contact && (
                  <li>
                    <a href={`mailto:${site.email_contact}`} className="flex items-start gap-2 text-sm transition-colors hover:text-white break-all" style={{ color: "rgba(255,255,255,0.58)" }}>
                      <svg className="mt-0.5 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      {site.email_contact}
                    </a>
                  </li>
                )}
                {site.address && (
                  <li>
                    <span className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.58)" }}>
                      <svg className="mt-0.5 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      </svg>
                      {site.address}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Col 4 — Légal */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.38)" }}>
                Légal
              </p>
              <ul className="space-y-2.5">
                <li>
                  <button onClick={() => setModal("legal")}
                    className="text-sm text-left transition-colors hover:text-white"
                    style={{ color: "rgba(255,255,255,0.58)" }}>
                    Mentions légales
                  </button>
                </li>
                <li>
                  <button onClick={() => setModal("privacy")}
                    className="text-sm text-left transition-colors hover:text-white"
                    style={{ color: "rgba(255,255,255,0.58)" }}>
                    Politique de confidentialité
                  </button>
                </li>
                <li>
                  <button onClick={() => setModal("cookies")}
                    className="text-sm text-left transition-colors hover:text-white"
                    style={{ color: "rgba(255,255,255,0.58)" }}>
                    Politique de cookies
                  </button>
                </li>
                {hasTracking && (
                  <li>
                    <button
                      onClick={() => { localStorage.removeItem("klientys_cookie_consent"); setCookieConsent(null); }}
                      className="text-xs text-left transition-colors hover:text-white mt-1"
                      style={{ color: "rgba(255,255,255,0.35)" }}>
                      Gérer mes préférences
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Barre basse */}
          <div className="pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.32)" }}>
              © {new Date().getFullYear()} {site.title}. Tous droits réservés.
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
              Créé avec{" "}
              <a href="https://klientys.co" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/50 transition-colors underline">
                Klientys
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* ── Cookie Banner ──────────────────────────────────────────────────── */}
      {hasTracking && cookieConsent === null && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-[340px] z-50 rounded-2xl shadow-2xl p-5"
          style={{ backgroundColor: colors.hero, border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <p className="text-white font-semibold text-sm mb-1">Ce site utilise des cookies</p>
          <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.62)" }}>
            Nous utilisons des cookies pour analyser la fréquentation et améliorer votre expérience.{" "}
            <button onClick={() => setModal("cookies")} className="underline hover:text-white transition-colors">
              En savoir plus
            </button>
          </p>
          <div className="flex gap-2">
            <button
              onClick={acceptCookies}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-88"
              style={{ backgroundColor: colors.accent }}
            >
              Tout accepter
            </button>
            <button
              onClick={declineCookies}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.68)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              Refuser
            </button>
          </div>
        </div>
      )}

      {/* ── Modals légales ─────────────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="bg-white rounded-2xl w-full sm:max-w-lg max-h-[82vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-bold text-gray-900 text-base">
                {modal === "legal" && "Mentions légales"}
                {modal === "privacy" && "Politique de confidentialité"}
                {modal === "cookies" && "Politique de cookies"}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 text-sm text-gray-600 space-y-3 leading-relaxed">
              {modal === "legal" && <LegalContent site={site} />}
              {modal === "privacy" && <PrivacyContent site={site} />}
              {modal === "cookies" && <CookiesContent site={site} tracking={tracking} />}
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={() => setModal(null)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
