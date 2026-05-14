import type { Metadata } from "next";
import Link from "next/link";
import metiers from "../../data/metiers.json";

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

const TOP_VILLES = [
  { slug: "paris", label: "Paris" }, { slug: "lyon", label: "Lyon" },
  { slug: "marseille", label: "Marseille" }, { slug: "bordeaux", label: "Bordeaux" },
  { slug: "nantes", label: "Nantes" }, { slug: "lille", label: "Lille" },
  { slug: "bruxelles", label: "Bruxelles" }, { slug: "toulouse", label: "Toulouse" },
];

export default function AnnuaireHub() {
  const grouped = metiers.reduce<Record<string, typeof metiers>>((acc, m) => {
    (acc[m.famille] ??= []).push(m);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-indigo-700 text-white py-20 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold">
          Annuaire des indépendants locaux
        </h1>
        <p className="mt-4 text-xl text-indigo-200 max-w-2xl mx-auto">
          Trouvez un professionnel qui intervient dans votre commune.
          Prise de rendez-vous directe, sans intermédiaire.
        </p>
      </section>

      {/* Recherche rapide par ville */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Villes populaires</h2>
        <div className="flex flex-wrap gap-3">
          {TOP_VILLES.map((v) => (
            <Link
              key={v.slug}
              href={`/annuaire/kinesitherapeute/${v.slug}`}
              className="border border-gray-200 rounded-full px-4 py-2 text-sm hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            >
              📍 {v.label}
            </Link>
          ))}
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
              <div key={m.slug} className="border border-gray-100 rounded-xl p-4">
                <p className="font-semibold text-gray-800 mb-3">{m.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {TOP_VILLES.slice(0, 4).map((v) => (
                    <Link
                      key={v.slug}
                      href={`/annuaire/${m.slug}/${v.slug}`}
                      className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full hover:bg-indigo-100 transition-colors"
                    >
                      {v.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* CTA pro */}
      <section className="bg-indigo-50 border-t border-indigo-100 py-14 px-6 text-center">
        <h2 className="text-xl font-bold text-indigo-900 mb-2">Vous êtes indépendant ?</h2>
        <p className="text-indigo-700 mb-6">
          Rejoignez l'annuaire gratuitement et soyez trouvé par vos clients locaux.
        </p>
        <Link
          href="/dashboard/settings"
          className="bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-800 transition-colors"
        >
          Rejoindre l'annuaire →
        </Link>
      </section>
    </main>
  );
}
