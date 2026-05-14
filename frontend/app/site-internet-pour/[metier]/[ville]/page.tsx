import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import metiers from "../../../../data/metiers.json";
import villes from "../../../../data/villes.json";

export const revalidate = 86400;

type MetierData = typeof metiers[0];
type VilleData = typeof villes[0];

function getMetier(slug: string): MetierData | null {
  return metiers.find((m) => m.slug === slug) ?? null;
}
function getVille(slug: string): VilleData | null {
  return villes.find((v) => v.slug === slug) ?? null;
}

export async function generateStaticParams() {
  return metiers.flatMap((m) =>
    villes.map((v) => ({ metier: m.slug, ville: v.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string; ville: string }>;
}): Promise<Metadata> {
  const { metier: mSlug, ville: vSlug } = await params;
  const m = getMetier(mSlug);
  const v = getVille(vSlug);
  if (!m || !v) return { title: "Page introuvable" };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
  const canonical = `${APP_URL}/site-internet-pour/${mSlug}/${vSlug}`;

  return {
    title: `Site internet pour ${m.label} ${v.labelPrep} — Klientys`,
    description: `Créez votre site professionnel de ${m.label.toLowerCase()} ${v.labelPrep} en 10 min. Agenda en ligne, zones d'intervention, agents IA. Essai gratuit.`,
    alternates: { canonical },
    openGraph: {
      title: `Site internet ${m.label} ${v.labelPrep}`,
      description: `La plateforme pour les ${m.labelPlural.toLowerCase()} qui couvrent ${v.label} et sa région.`,
      url: canonical,
      type: "website",
      siteName: "Klientys",
    },
  };
}

export default async function ProgrammaticPage({
  params,
}: {
  params: Promise<{ metier: string; ville: string }>;
}) {
  const { metier: mSlug, ville: vSlug } = await params;
  const m = getMetier(mSlug);
  const v = getVille(vSlug);
  if (!m || !v) notFound();

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
  const demandeEstimee = Math.round((m.kw_monthly_fr + m.kw_monthly_be) * (v.population / 1_000_000) * 12);
  const rayonKm = v.population > 200_000 ? 15 : v.population > 80_000 ? 20 : 30;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Klientys",
    applicationCategory: "BusinessApplication",
    description: `Site internet et agenda en ligne pour ${m.labelPlural.toLowerCase()} ${v.labelPrep}`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Essai gratuit" },
    areaServed: { "@type": "City", name: v.label, containedInPlace: { "@type": "AdministrativeArea", name: v.region } },
    audience: { "@type": "Audience", audienceType: m.label },
  };

  const faqItems = [
    {
      q: `Combien coûte un site internet pour ${m.labelArticle} ${v.labelPrep} ?`,
      a: `Klientys propose un essai gratuit complet. Les abonnements commencent à 29 €/mois — bien moins qu'un site sur mesure (1 500–5 000 €) ou les commissions des plateformes comme ${m.comparatif} (jusqu'à 160 €/mois).`,
    },
    {
      q: `Comment être trouvé sur Google en tant que ${m.labelArticle} ${v.labelPrep} ?`,
      a: `Klientys génère automatiquement les balises SEO, le Schema.org LocalBusiness et vos zones d'intervention. La plupart des professionnels apparaissent dans les résultats locaux Google sous 2 à 4 semaines après publication.`,
    },
    {
      q: `Puis-je gérer plusieurs communes autour de ${v.label} ?`,
      a: `Oui. Vous pouvez définir jusqu'à 10 zones d'intervention. Chaque zone est affichée sur votre site et indexée par Google, ce qui vous rend visible dans un rayon d'environ ${rayonKm} km autour de ${v.label}.`,
    },
  ];

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-6 pt-6 text-sm text-gray-500 flex gap-2">
        <Link href="/site-internet-pour" className="hover:text-indigo-600">Tous les métiers</Link>
        <span>/</span>
        <Link href={`/site-internet-pour/${mSlug}`} className="hover:text-indigo-600">{m.label}</Link>
        <span>/</span>
        <span className="text-gray-800">{v.label}</span>
      </div>

      {/* ── Section 1 — Hero ── */}
      <section className="bg-indigo-700 text-white py-20 px-6 text-center mt-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight max-w-3xl mx-auto">
          Site internet pour {m.label.toLowerCase()} {v.labelPrep}
        </h1>
        <p className="mt-4 text-xl text-indigo-200 max-w-2xl mx-auto">
          Prêt en 10 minutes. Visible sur Google sous 48h.
        </p>
        <div className="mt-4 flex justify-center gap-6 text-indigo-300 text-sm">
          <span>📍 Zones d'intervention affichées</span>
          <span>📅 Agenda en ligne inclus</span>
          <span>🤖 Agent IA WhatsApp</span>
        </div>
        <Link
          href="/"
          className="mt-8 inline-block bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          Créer mon site gratuitement →
        </Link>
      </section>

      {/* ── Section 2 — Pourquoi ce métier dans cette ville ── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8">
          Pourquoi {m.labelArticle} {v.labelPrep} a besoin d'un site ?
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          {m.painPoints.map((p, i) => (
            <div key={i} className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm text-red-700 leading-relaxed">❌ {p}</p>
            </div>
          ))}
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
          <p className="text-gray-700 leading-relaxed">
            À {v.label} ({v.population.toLocaleString()} habitants), on estime à{" "}
            <strong>{demandeEstimee.toLocaleString()} recherches annuelles</strong> les requêtes
            du type &quot;{m.label.toLowerCase()} {v.label}&quot; et communes alentour.
            Ces recherches ont une intention d'achat de 95 % — ce sont des clients prêts à vous appeler.
          </p>
        </div>
      </section>

      {/* ── Section 3 — Ce que Klientys fait pour vous ── */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Ce que Klientys fait pour les {m.labelPlural.toLowerCase()} {v.labelPrep}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {m.keyFeatures.map((f, i) => (
              <div key={i} className="bg-white border rounded-xl p-5 shadow-sm">
                <p className="text-green-600 font-bold mb-2">✓</p>
                <p className="text-gray-700 text-sm leading-relaxed">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4 — 3 étapes ── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Votre site en 3 étapes</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { n: "1", title: "Choisissez votre template", desc: `Template optimisé pour les ${m.labelPlural.toLowerCase()}` },
            { n: "2", title: `Renseignez vos zones autour de ${v.label}`, desc: `Jusqu'à 10 communes dans un rayon de ~${rayonKm} km` },
            { n: "3", title: "Publiez", desc: "Votre site est indexé par Google sous 48h" },
          ].map((step) => (
            <div key={step.n} className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-700 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                {step.n}
              </div>
              <h3 className="font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 5 — Témoignage ── */}
      <section className="bg-indigo-700 text-white py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            {[1,2,3,4,5].map((i) => <span key={i} className="text-yellow-400 text-2xl">★</span>)}
          </div>
          <p className="text-xl text-indigo-100 italic leading-relaxed">
            &quot;{m.testimonialQuote}&quot;
          </p>
          <p className="mt-6 font-semibold text-indigo-200">
            {m.testimonialName} — {m.label} à {m.testimonialCity}
          </p>
        </div>
      </section>

      {/* ── Section 6 — Comparatif ── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">
          Klientys vs {m.comparatif}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 border border-gray-200"></th>
                <th className="p-3 border border-gray-200 text-indigo-700 font-bold">Klientys</th>
                <th className="p-3 border border-gray-200 text-gray-500">{m.comparatif}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Site vitrine professionnel", "✅", "❌"],
                ["Zones d'intervention affichées", "✅", "❌"],
                ["Agenda de réservation", "✅", "✅"],
                ["SEO local automatique", "✅", "❌"],
                ["Agent IA WhatsApp", "✅", "❌"],
                ["Prix mensuel", "Dès 29 €/mois", "~160 €/mois"],
                ["Commission sur RDV", "0 %", "Oui"],
              ].map(([feature, klientys, comp]) => (
                <tr key={feature} className="border-b border-gray-100">
                  <td className="p-3 text-gray-700 font-medium">{feature}</td>
                  <td className="p-3 text-center text-green-600 font-semibold">{klientys}</td>
                  <td className="p-3 text-center text-gray-400">{comp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 7 — FAQ locale ── */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Questions fréquentes</h2>
          <div className="space-y-6">
            {faqItems.map((item) => (
              <div key={item.q} className="bg-white border rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">{item.q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />

      {/* CTA final */}
      <section className="py-16 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Prêt à être trouvé {v.labelPrep} ?
        </h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Rejoignez les {m.labelPlural.toLowerCase()} qui utilisent Klientys pour
          attirer des clients locaux sans dépendre des plateformes.
        </p>
        <Link
          href="/"
          className="bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-800 transition-colors"
        >
          Créer mon site — essai gratuit →
        </Link>
      </section>
    </main>
  );
}
