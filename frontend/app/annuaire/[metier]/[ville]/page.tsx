import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import metiers from "../../../../data/metiers.json";
import villes from "../../../../data/villes.json";
import MarketingNav from "../../../../components/MarketingNav";
import MarketingFooter from "../../../../components/MarketingFooter";

export const revalidate = 3600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

async function getListings(metier: string, ville: string) {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/directory/listings?metier=${encodeURIComponent(metier)}&ville=${encodeURIComponent(ville)}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.listings ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string; ville: string }>;
}): Promise<Metadata> {
  const { metier: mSlug, ville: vSlug } = await params;
  const m = metiers.find((x) => x.slug === mSlug);
  const v = villes.find((x) => x.slug === vSlug);
  if (!m || !v) return { title: "Annuaire — Klientys" };

  const canonical = `${APP_URL}/annuaire/${mSlug}/${vSlug}`;
  return {
    title: `${m.labelPlural} ${villePrep} — Annuaire Klientys`,
    description: `Trouvez ${m.labelArticle} ${villePrep}. Profils vérifiés, prise de RDV directe. Annuaire gratuit Klientys.`,
    alternates: { canonical },
    openGraph: {
      title: `${m.labelPlural} ${villePrep}`,
      description: `Trouvez ${m.labelArticle} ${villePrep}. Profils vérifiés, prise de RDV directe.`,
      url: canonical,
      siteName: "Klientys",
      images: [{ url: `${APP_URL}/annuaire/${mSlug}/${vSlug}/opengraph-image`, width: 1200, height: 630 }],
    },
  };
}

export default async function AnnuaireVillePage({
  params,
}: {
  params: Promise<{ metier: string; ville: string }>;
}) {
  const { metier: mSlug, ville: vSlug } = await params;
  const m = metiers.find((x) => x.slug === mSlug);
  if (!m) notFound();

  // Ville connue (villes.json) ou inconnue : on accepte les deux
  const vKnown = villes.find((x) => x.slug === vSlug);
  const villeLabel = vKnown?.label ?? vSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const villePrep  = vKnown?.labelPrep ?? `à ${villeLabel}`;

  const listings = await getListings(mSlug, villeLabel);

  const canonical = `${APP_URL}/annuaire/${mSlug}/${vSlug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Annuaire", item: `${APP_URL}/annuaire` },
      { "@type": "ListItem", position: 3, name: `${m.labelPlural} ${villePrep}`, item: canonical },
    ],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${m.labelPlural} ${villePrep}`,
    numberOfItems: listings.length,
    itemListElement: listings.map((l: any, i: number) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "LocalBusiness",
        name: l.display_name,
        url: `${APP_URL}${l.site_url}`,
        areaServed: l.zones?.map((z: string) => ({ "@type": "City", name: z })),
      },
    })),
  };

  return (
    <main className="min-h-screen bg-[#F4F8FA]">
      <MarketingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-6 pt-28 text-sm text-gray-500 flex gap-2">
        <Link href="/annuaire" className="hover:text-primary-600">Annuaire</Link>
        <span>/</span>
        <Link href={`/annuaire/${mSlug}/${vSlug}`} className="text-gray-800">{m.labelPlural}</Link>
        <span>/</span>
        <span className="text-gray-800">{villeLabel}</span>
      </div>

      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-extrabold text-gray-900">
          {m.labelPlural} {villePrep}
        </h1>
        <p className="text-gray-500 mt-2">
          {listings.length > 0
            ? `${listings.length} professionnel${listings.length > 1 ? "s" : ""} listé${listings.length > 1 ? "s" : ""}`
            : "Aucun professionnel listé pour le moment"}
        </p>
      </section>

      {/* Liste */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        {listings.length === 0 ? (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-8 text-center">
            <p className="text-primary-800 font-semibold mb-2">
              Vous êtes {m.labelArticle} {villePrep} ?
            </p>
            <p className="text-primary-600 text-sm mb-4">
              Soyez le premier à apparaître dans cet annuaire — gratuitement.
            </p>
            <Link
              href="/"
              className="bg-primary-700 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-primary-800 transition-colors text-sm"
            >
              Rejoindre l'annuaire →
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l: any) => (
              <Link
                key={l.id}
                href={`/annuaire/${mSlug}/${vSlug}/${l.slug}`}
                className="border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-primary-300 transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  {l.profile_photo_url ? (
                    <Image
                      src={l.profile_photo_url}
                      alt={l.display_name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
                      {l.display_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">
                      {l.display_name}
                    </p>
                    {l.tagline && (
                      <p className="text-sm text-gray-500 truncate">{l.tagline}</p>
                    )}
                  </div>
                </div>

                {l.zones?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {l.zones.slice(0, 3).map((z: string) => (
                      <span key={z} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        📍 {z}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {l.accepts_booking && (
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      Réservation en ligne
                    </span>
                  )}
                  <span className="text-xs text-primary-600 font-medium ml-auto group-hover:underline">
                    Voir le profil →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* FAQ Schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: `Comment trouver ${m.labelArticle} ${villePrep} ?`,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: `L'annuaire Klientys liste les ${m.labelPlural.toLowerCase()} ${villePrep} avec prise de RDV directe. Chaque professionnel a vérifié ses zones d'intervention.`,
                },
              },
              {
                "@type": "Question",
                name: `Comment s'inscrire en tant que ${m.labelArticle} ${villePrep} ?`,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: `Créez votre site professionnel sur Klientys (essai gratuit), puis activez l'option "Apparaître dans l'annuaire" dans vos paramètres.`,
                },
              },
            ],
          }),
        }}
      />

      {/* CTA pro bas de page */}
      <section className="bg-primary-50 border-t border-primary-100 py-12 px-6 text-center">
        <p className="text-primary-900 font-semibold mb-4">
          Vous êtes {m.labelArticle} {villePrep} et vous n'êtes pas listé ?
        </p>
        <Link
          href="/onboarding"
          className="bg-primary-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          Créer mon profil gratuitement →
        </Link>
      </section>

      <MarketingFooter />
    </main>
  );
}
