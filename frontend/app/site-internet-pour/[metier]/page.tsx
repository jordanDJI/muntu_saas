import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import metiers from "../../../data/metiers.json";
import villes from "../../../data/villes.json";

export const revalidate = 86400;

export async function generateStaticParams() {
  return metiers.map((m) => ({ metier: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string }>;
}): Promise<Metadata> {
  const { metier: mSlug } = await params;
  const m = metiers.find((x) => x.slug === mSlug);
  if (!m) return { title: "Page introuvable" };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
  return {
    title: `Site internet pour ${m.label} — Klientys`,
    description: `Créez votre site de ${m.label.toLowerCase()} en 10 min. ${m.description}. Agenda en ligne, SEO local, agent IA. Essai gratuit.`,
    alternates: { canonical: `${APP_URL}/site-internet-pour/${mSlug}` },
  };
}

export default async function MetierPage({
  params,
}: {
  params: Promise<{ metier: string }>;
}) {
  const { metier: mSlug } = await params;
  const m = metiers.find((x) => x.slug === mSlug);
  if (!m) notFound();

  const villesFR = villes.filter((v) => v.pays === "FR").slice(0, 20);
  const villesBE = villes.filter((v) => v.pays === "BE").slice(0, 10);

  return (
    <main className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-6 pt-6 text-sm text-gray-500">
        <Link href="/site-internet-pour" className="hover:text-indigo-600">Tous les métiers</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-800">{m.label}</span>
      </div>

      {/* Hero */}
      <section className="bg-indigo-700 text-white py-20 px-6 text-center mt-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold">
          Site internet pour {m.label.toLowerCase()}
        </h1>
        <p className="mt-4 text-xl text-indigo-200 max-w-2xl mx-auto">
          {m.description} — Soyez trouvé localement sur Google.
        </p>
        <p className="mt-2 text-indigo-300 text-sm">
          {(m.kw_monthly_fr + m.kw_monthly_be).toLocaleString()} recherches/mois en France et Belgique
        </p>
        <Link
          href="/"
          className="mt-8 inline-block bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          Créer mon site gratuitement →
        </Link>
      </section>

      {/* Problèmes */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-6">Le problème de visibilité des {m.labelPlural.toLowerCase()}</h2>
        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          {m.painPoints.map((p, i) => (
            <div key={i} className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">❌ {p}</div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {m.keyFeatures.map((f, i) => (
            <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-700">✅ {f}</div>
          ))}
        </div>
      </section>

      {/* Témoignage */}
      <section className="bg-indigo-700 text-white py-12 px-6 text-center">
        <p className="text-lg italic text-indigo-100 max-w-2xl mx-auto">
          &quot;{m.testimonialQuote}&quot;
        </p>
        <p className="mt-4 text-indigo-300 text-sm">{m.testimonialName} — {m.label} à {m.testimonialCity}</p>
      </section>

      {/* Grille villes */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2">
          Site internet pour {m.label.toLowerCase()} par ville
        </h2>
        <p className="text-gray-500 mb-8 text-sm">
          Cliquez sur votre ville pour voir les spécificités locales.
        </p>

        <h3 className="text-lg font-semibold mb-4 text-gray-700">🇫🇷 France</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
          {villesFR.map((v) => (
            <Link
              key={v.slug}
              href={`/site-internet-pour/${mSlug}/${v.slug}`}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-center hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            >
              {v.label}
            </Link>
          ))}
        </div>

        <h3 className="text-lg font-semibold mb-4 text-gray-700">🇧🇪 Belgique</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {villesBE.map((v) => (
            <Link
              key={v.slug}
              href={`/site-internet-pour/${mSlug}/${v.slug}`}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-center hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            >
              {v.label}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Commencez gratuitement
        </h2>
        <p className="text-gray-600 mb-8">Aucune carte bancaire requise. Site en ligne en 10 minutes.</p>
        <Link
          href="/"
          className="bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-800 transition-colors"
        >
          Créer mon site {m.label.toLowerCase()} →
        </Link>
      </section>
    </main>
  );
}
