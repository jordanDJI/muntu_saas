import type { Metadata } from "next";
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
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
