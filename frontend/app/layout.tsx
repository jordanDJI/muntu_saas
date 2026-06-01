import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { LanguageProvider } from "../contexts/LanguageContext";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Klientys — Site + RDV + CRM pour indépendants",
    template: "%s | Klientys",
  },
  description: "Créez votre site professionnel, gérez vos rendez-vous et clients depuis une seule plateforme. Sans compétences techniques. En 15 minutes.",
  alternates: {
    canonical: "https://klientys.co",
    languages: {
      fr: "https://klientys.co",
      en: "https://klientys.co",
      de: "https://klientys.co",
      nl: "https://klientys.co",
      "x-default": "https://klientys.co",
    },
  },
  openGraph: {
    type: "website",
    url: "https://klientys.co",
    siteName: "Klientys",
    title: "Klientys — Site + RDV + CRM pour indépendants",
    description: "Créez votre site professionnel, gérez vos rendez-vous et clients depuis une seule plateforme.",
    locale: "fr_FR",
    alternateLocale: ["en_GB", "de_DE", "nl_NL"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Klientys — Site + RDV + CRM pour indépendants",
    description: "Créez votre site professionnel, gérez vos rendez-vous et clients depuis une seule plateforme.",
  },
  verification: {
    other: {
      "msvalidate.01": "E44F6C24EA512692866812B24A7A98A7",
    },
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Klientys",
  url: "https://klientys.co",
  logo: "https://klientys.co/logo.png",
  description: "La plateforme tout-en-un pour indépendants et TPE",
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@klientys.co",
    contactType: "customer service",
    availableLanguage: "French",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${dmSans.variable}`}>
      <body className="text-gray-900 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {/* GA4 Klientys */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-C04SHMVM34" strategy="afterInteractive" />
        <Script id="ga4-klientys" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-C04SHMVM34');
        `}</Script>

        {/* Meta Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','26855191664139076');fbq('track','PageView');
        `}</Script>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

