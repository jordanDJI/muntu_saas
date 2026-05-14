import type { Metadata } from "next";
import Link from "next/link";
import metiers from "../../data/metiers.json";

export const metadata: Metadata = {
  title: "Site internet pour indépendants — par métier | Klientys",
  description: "Créez votre site professionnel en 10 minutes. Choisissez votre métier et découvrez comment Klientys vous aide à être trouvé localement sur Google.",
  alternates: { canonical: "/site-internet-pour" },
};

const FAMILLES: Record<string, { label: string; emoji: string }> = {
  sante:    { label: "Santé libérale",    emoji: "🩺" },
  artisan:  { label: "Artisanat & BTP",   emoji: "🔧" },
  services: { label: "Services & conseil", emoji: "💼" },
};

export default function HubSiteInternetPour() {
  const grouped = metiers.reduce<Record<string, typeof metiers>>((acc, m) => {
    (acc[m.famille] ??= []).push(m);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-indigo-700 text-white py-20 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold">
          Site internet pour indépendants
        </h1>
        <p className="mt-4 text-xl text-indigo-200 max-w-2xl mx-auto">
          Choisissez votre métier. Créez votre site en 10 minutes.
          Soyez trouvé par vos clients locaux sur Google.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          Créer mon site gratuitement →
        </Link>
      </section>

      {/* Familles de métiers */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        {Object.entries(grouped).map(([famille, list]) => (
          <div key={famille} className="mb-14">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span>{FAMILLES[famille]?.emoji}</span>
              <span>{FAMILLES[famille]?.label}</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((m) => (
                <Link
                  key={m.slug}
                  href={`/site-internet-pour/${m.slug}`}
                  className="border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                  <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                    {m.label}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{m.description}</p>
                  <p className="text-xs text-indigo-600 mt-3 font-medium">
                    {(m.kw_monthly_fr + m.kw_monthly_be).toLocaleString()} recherches/mois →
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA bas de page */}
      <section className="bg-gray-50 py-16 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Votre métier n'est pas dans la liste ?</h2>
        <p className="text-gray-600 mb-8">
          Klientys fonctionne pour tout indépendant qui couvre une zone géographique.
        </p>
        <Link
          href="/"
          className="bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-800 transition-colors"
        >
          Essayer gratuitement →
        </Link>
      </section>
    </main>
  );
}
