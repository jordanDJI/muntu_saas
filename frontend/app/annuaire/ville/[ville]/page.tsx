import type { Metadata } from "next";
import Link from "next/link";
import metiers from "../../../../data/metiers.json";
import villes from "../../../../data/villes.json";
import MarketingNav from "../../../../components/MarketingNav";
import MarketingFooter from "../../../../components/MarketingFooter";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

async function getListingsByVille(ville: string) {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/directory/listings?ville=${encodeURIComponent(ville)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.listings ?? [];
  } catch {
    return [];
  }
}

function getMetierLabel(slug: string, metierLabel?: string) {
  const known = metiers.find((m) => m.slug === slug);
  return known?.label ?? metierLabel ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ville: string }>;
}): Promise<Metadata> {
  const { ville: vSlug } = await params;
  const vKnown = villes.find((v) => v.slug === vSlug);
  const villeLabel = vKnown?.label ?? vSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const villePrep = vKnown?.labelPrep ?? `à ${villeLabel}`;

  const listings = await getListingsByVille(villeLabel);
  if (listings.length === 0) {
    return {
      title: `Professionnels ${villePrep} — Annuaire Klientys`,
      robots: { index: false },
    };
  }

  return {
    title: `Professionnels ${villePrep} — Annuaire Klientys`,
    description: `Trouvez un professionnel indépendant ${villePrep}. Kinésithérapeutes, plombiers, coachs et plus encore. Prise de RDV directe, sans intermédiaire.`,
    alternates: { canonical: `${APP_URL}/annuaire/ville/${vSlug}` },
  };
}

export default async function AnnuaireVillePage({
  params,
}: {
  params: Promise<{ ville: string }>;
}) {
  const { ville: vSlug } = await params;
  const vKnown = villes.find((v) => v.slug === vSlug);
  const villeLabel = vKnown?.label ?? vSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const villePrep = vKnown?.labelPrep ?? `à ${villeLabel}`;

  const listings = await getListingsByVille(villeLabel);

  // Grouper par métier
  const grouped: Record<string, { metierLabel: string; items: typeof listings }> = {};
  for (const l of listings) {
    const key = l.metier_slug ?? "autre";
    if (!grouped[key]) {
      grouped[key] = {
        metierLabel: getMetierLabel(key, l.metier_label),
        items: [],
      };
    }
    grouped[key].items.push(l);
  }

  return (
    <main className="min-h-screen bg-[#F4F8FA]">
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-6 pt-28 text-sm text-gray-500 flex gap-2">
        <Link href="/annuaire" className="hover:text-primary-600">Annuaire</Link>
        <span>/</span>
        <span className="text-gray-800">{villeLabel}</span>
      </div>

      {/* Header */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Professionnels {villePrep}
        </h1>
        <p className="text-gray-500 mt-2">
          {listings.length > 0
            ? `${listings.length} professionnel${listings.length > 1 ? "s" : ""} listé${listings.length > 1 ? "s" : ""}`
            : "Aucun professionnel listé pour le moment"}
        </p>
      </section>

      {/* Contenu */}
      <section className="max-w-5xl mx-auto px-6 pb-16 space-y-10">
        {listings.length === 0 ? (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-8 text-center">
            <p className="text-primary-800 font-semibold mb-2">
              Vous êtes indépendant {villePrep} ?
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
          Object.entries(grouped).map(([mSlug, { metierLabel, items }]) => (
            <div key={mSlug}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">{metierLabel}</h2>
                <Link
                  href={`/annuaire/${mSlug}/${vSlug}`}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Voir tous →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((l: any) => (
                  <Link
                    key={l.id}
                    href={`/annuaire/${mSlug}/${vSlug}/${l.slug}`}
                    className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-md hover:border-primary-300 transition-all group"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                        {l.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">
                          {l.display_name}
                        </p>
                        {l.tagline && (
                          <p className="text-xs text-gray-500 truncate">{l.tagline}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(l.zones ?? []).slice(0, 3).map((z: string) => (
                        <span key={z} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          📍 {z}
                        </span>
                      ))}
                    </div>
                    {l.accepts_booking && (
                      <p className="text-xs text-primary-600 mt-2 font-medium">Réservation en ligne ✓</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <MarketingFooter />
    </main>
  );
}
