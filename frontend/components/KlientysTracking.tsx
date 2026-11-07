"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import CookieBanner, { getCookieConsentDetail } from "./CookieBanner";

const GA4_ID = "G-C04SHMVM34";
const META_PIXEL_ID = "26855191664139076";
const CONSENT_KEY = "klientys_cookie_consent";

// Pages du site Klientys lui-même. Tout le reste (/{slug} des tenants, widgets,
// dashboard, admin) n'a pas à charger les outils de mesure de Klientys.
const MARKETING_PREFIXES = ["/blog", "/annuaire", "/site-internet-pour", "/legal", "/onboarding", "/login"];

function isKlientysHost(hostname: string): boolean {
  return hostname === "klientys.co" || hostname.endsWith(".klientys.co")
    || hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app");
}

function isMarketingPath(pathname: string): boolean {
  return pathname === "/" || MARKETING_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * GA4 et Meta Pixel de Klientys, chargés seulement :
 *  - sur le site marketing (pas sur le site d'un tenant, même servi depuis
 *    klientys.co/{slug} ou un domaine personnalisé, ni dans les widgets) ;
 *  - après consentement (analytiques → GA4, marketing → Pixel).
 *
 * Ils étaient auparavant dans le layout racine, sans condition : chargés avant
 * tout choix de l'internaute, et sur les sites des tenants, où ils envoyaient à
 * Meta les visites des clients des pros.
 */
export default function KlientysTracking() {
  const pathname = usePathname() ?? "/";
  const [scope, setScope] = useState<"unknown" | "marketing" | "other">("unknown");
  const [consent, setConsent] = useState({ analytics: false, marketing: false });

  useEffect(() => {
    // Sur un domaine personnalisé, le proxy réécrit vers /{slug} mais l'URL du
    // navigateur reste « / » : seul le nom d'hôte permet de trancher.
    setScope(isKlientysHost(window.location.hostname) && isMarketingPath(pathname) ? "marketing" : "other");
  }, [pathname]);

  useEffect(() => {
    setConsent(getCookieConsentDetail(CONSENT_KEY));
    const onConsent = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.key === CONSENT_KEY) setConsent({ analytics: !!d.analytics, marketing: !!d.marketing });
    };
    window.addEventListener("cookie-consent", onConsent);
    return () => window.removeEventListener("cookie-consent", onConsent);
  }, []);

  if (scope !== "marketing") return null;

  return (
    <>
      {/* La landing affiche déjà sa bannière ; les autres pages marketing n'en avaient pas. */}
      {pathname !== "/" && <CookieBanner privacyUrl="/legal/privacy" />}

      {consent.analytics && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} strategy="afterInteractive" />
          <Script id="ga4-klientys" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA4_ID}');
          `}</Script>
        </>
      )}

      {consent.marketing && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${META_PIXEL_ID}');fbq('track','PageView');
        `}</Script>
      )}
    </>
  );
}
