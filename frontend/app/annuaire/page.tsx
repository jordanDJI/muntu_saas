import type { Metadata } from "next";
import Link from "next/link";
import metiers from "../../data/metiers.json";
import MarketingNav from "../../components/MarketingNav";
import MarketingFooter from "../../components/MarketingFooter";

export const metadata: Metadata = {
  title: "Annuaire des indépendants locaux — Klientys",
  description: "Trouvez un kinésithérapeute, plombier, coach sportif ou tout indépendant qui intervient près de chez vous. Annuaire gratuit et vérifié.",
  alternates: { canonical: "/annuaire" },
};

const FAMILLES: Record<string, { label: string; emoji: string; desc: string }> = {
  sante:    { label: "Santé & bien-être",    emoji: "🩺", desc: "Kinés, infirmiers, ostéopathes, naturopathes..." },
  artisan:  { label: "Artisanat & BTP",      emoji: "🔧", desc: "Plombiers, électriciens, menuisiers, jardiniers..." },
  services: { label: "Services & conseil",   emoji: "💼", desc: "Coachs, photographes, profs particuliers, DJs..." },
};

const TOP_VILLES_FR = [
  { slug: "paris",     label: "Paris" },
  { slug: "lyon",      label: "Lyon" },
  { slug: "marseille", label: "Marseille" },
  { slug: "bordeaux",  label: "Bordeaux" },
  { slug: "nantes",    label: "Nantes" },
  { slug: "lille",     label: "Lille" },
  { slug: "toulouse",  label: "Toulouse" },
  { slug: "strasbourg",label: "Strasbourg" },
];

const TOP_VILLES_BE = [
  { slug: "bruxelles", label: "Bruxelles" },
  { slug: "anvers",    label: "Anvers" },
  { slug: "gand",      label: "Gand" },
  { slug: "liege",     label: "Liège" },
  { slug: "charleroi", label: "Charleroi" },
  { slug: "bruges",    label: "Bruges" },
  { slug: "namur",     label: "Namur" },
  { slug: "mons",      label: "Mons" },
];

const TOP_VILLES_DE = [
  { slug: "berlin",     label: "Berlin" },
  { slug: "hambourg",   label: "Hambourg" },
  { slug: "munich",     label: "Munich" },
  { slug: "cologne",    label: "Cologne" },
  { slug: "francfort",  label: "Francfort" },
  { slug: "stuttgart",  label: "Stuttgart" },
  { slug: "dusseldorf", label: "Düsseldorf" },
  { slug: "leipzig",    label: "Leipzig" },
];

// Une ville représentative par pays, pour les chips dans les cartes métier
const VILLES_PAR_PAYS = [
  { slug: "paris",     label: "Paris",     flag: "🇫🇷" },
  { slug: "lyon",      label: "Lyon",      flag: "🇫🇷" },
  { slug: "bruxelles", label: "Bruxelles", flag: "🇧🇪" },
  { slug: "anvers",    label: "Anvers",    flag: "🇧🇪" },
  { slug: "berlin",    label: "Berlin",    flag: "🇩🇪" },
  { slug: "munich",    label: "Munich",    flag: "🇩🇪" },
];

export default function AnnuaireHub() {
  const grouped = metiers.reduce<Record<string, typeof metiers>>((acc, m) => {
    (acc[m.famille] ??= []).push(m);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#F4F8FA]">
      <MarketingNav />

      {/* Hero */}
      <section className="bg-primary-600 text-white pt-36 pb-20 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold">
          Annuaire des indépendants locaux
        </h1>
        <p className="mt-4 text-xl text-primary-100 max-w-2xl mx-auto">
          Trouvez un professionnel qui intervient dans votre commune.
          Prise de rendez-vous directe, sans intermédiaire.
        </p>
      </section>

      {/* Recherche rapide par ville */}
      <section className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <h2 className="text-lg font-semibold text-gray-700">Villes populaires</h2>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">🇫🇷 France</p>
          <div className="flex flex-wrap gap-2">
            {TOP_VILLES_FR.map((v) => (
              <Link key={v.slug} href={`/annuaire/kinesitherapeute/${v.slug}`}
                className="border border-gray-200 bg-white rounded-full px-4 py-1.5 text-sm hover:border-primary-400 hover:text-primary-600 transition-colors">
                📍 {v.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">🇧🇪 Belgique</p>
          <div className="flex flex-wrap gap-2">
            {TOP_VILLES_BE.map((v) => (
              <Link key={v.slug} href={`/annuaire/kinesitherapeute/${v.slug}`}
                className="border border-gray-200 bg-white rounded-full px-4 py-1.5 text-sm hover:border-primary-400 hover:text-primary-600 transition-colors">
                📍 {v.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">🇩🇪 Allemagne</p>
          <div className="flex flex-wrap gap-2">
            {TOP_VILLES_DE.map((v) => (
              <Link key={v.slug} href={`/annuaire/kinesitherapeute/${v.slug}`}
                className="border border-gray-200 bg-white rounded-full px-4 py-1.5 text-sm hover:border-primary-400 hover:text-primary-600 transition-colors">
                📍 {v.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Familles */}
      {Object.entries(grouped).map(([famille, list]) => (
        <section key={famille} className="max-w-5xl mx-auto px-6 pb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>{FAMILLES[famille]?.emoji}</span>
              <span>{FAMILLES[famille]?.label}</span>
            </h2>
            <p className="text-gray-500 text-sm mt-1">{FAMILLES[famille]?.desc}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((m) => (
              <div key={m.slug} className="border border-gray-100 rounded-xl p-4 bg-white">
                <p className="font-semibold text-gray-800 mb-3">{m.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {VILLES_PAR_PAYS.map((v) => (
                    <Link
                      key={v.slug}
                      href={`/annuaire/${m.slug}/${v.slug}`}
                      className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded-full hover:bg-primary-100 transition-colors"
                    >
                      {v.flag} {v.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* CTA pro */}
      <section className="bg-primary-50 border-t border-primary-100 py-14 px-6 text-center">
        <h2 className="text-xl font-bold text-primary-900 mb-2">Vous êtes indépendant ?</h2>
        <p className="text-primary-700 mb-6">
          Rejoignez l'annuaire gratuitement et soyez trouvé par vos clients locaux.
        </p>
        <Link
          href="/onboarding"
          className="bg-primary-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-primary-700 transition-colors"
        >
          Rejoindre l'annuaire →
        </Link>
      </section>

      <MarketingFooter />
    </main>
  );
}
