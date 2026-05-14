import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import metiers from "../../../../../data/metiers.json";
import villes from "../../../../../data/villes.json";

export const revalidate = 3600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

async function getListing(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/directory/listing/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getSiteData(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/site/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metier: string; ville: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, metier: mSlug, ville: vSlug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: "Profil introuvable — Klientys" };

  const m = metiers.find((x) => x.slug === mSlug);
  const v = villes.find((x) => x.slug === vSlug);
  const canonical = `${APP_URL}/annuaire/${mSlug}/${vSlug}/${slug}`;

  return {
    title: `${listing.display_name}${m && v ? ` — ${m.label} ${v.labelPrep}` : ""} | Klientys`,
    description: listing.tagline ?? `${listing.display_name} — Profil professionnel et prise de RDV en ligne.`,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: listing.display_name,
      description: listing.tagline ?? undefined,
      url: canonical,
      type: "profile",
      siteName: "Klientys",
      ...(listing.profile_photo_url && { images: [listing.profile_photo_url] }),
    },
  };
}

export default async function FicheProPage({
  params,
}: {
  params: Promise<{ metier: string; ville: string; slug: string }>;
}) {
  const { slug, metier: mSlug, ville: vSlug } = await params;

  const [listing, site] = await Promise.all([getListing(slug), getSiteData(slug)]);
  if (!listing) notFound();

  const m = metiers.find((x) => x.slug === mSlug);
  const v = villes.find((x) => x.slug === vSlug);

  const offers: any[] = site?.service_offer ?? [];
  const testimonials: any[] = site?.testimonial ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.display_name,
    description: listing.tagline ?? site?.description ?? undefined,
    url: `${APP_URL}/${slug}`,
    ...(site?.phone && { telephone: site.phone }),
    ...(site?.email_contact && { email: site.email_contact }),
    areaServed: listing.zones?.map((z: string) => ({ "@type": "City", name: z })),
    ...(testimonials.length > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: (testimonials.reduce((s: number, t: any) => s + (t.rating ?? 5), 0) / testimonials.length).toFixed(1),
        reviewCount: testimonials.length,
        bestRating: "5",
      },
    }),
  };

  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <div className="max-w-4xl mx-auto px-6 pt-6 text-sm text-gray-500 flex flex-wrap gap-2">
        <Link href="/annuaire" className="hover:text-indigo-600">Annuaire</Link>
        <span>/</span>
        {m && <Link href={`/annuaire/${mSlug}/${vSlug}`} className="hover:text-indigo-600">{m.labelPlural}</Link>}
        {v && <><span>/</span><Link href={`/annuaire/${mSlug}/${vSlug}`} className="hover:text-indigo-600">{v.label}</Link></>}
        <span>/</span>
        <span className="text-gray-800 truncate">{listing.display_name}</span>
      </div>

      {/* Fiche pro */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white border rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* Header */}
          <div className="flex items-start gap-5 mb-6">
            {listing.profile_photo_url ? (
              <img
                src={listing.profile_photo_url}
                alt={listing.display_name}
                className="w-20 h-20 rounded-full object-cover shrink-0 border-2 border-indigo-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-3xl shrink-0">
                {listing.display_name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-gray-900">{listing.display_name}</h1>
              {m && <p className="text-indigo-600 font-medium text-sm mt-0.5">{m.label}</p>}
              {listing.tagline && <p className="text-gray-500 mt-2 text-sm">{listing.tagline}</p>}
              {listing.accepts_booking && (
                <span className="inline-block mt-3 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                  ✓ Réservation en ligne disponible
                </span>
              )}
            </div>
          </div>

          {/* Zones */}
          {listing.zones?.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">Zones d'intervention</p>
              <div className="flex flex-wrap gap-2">
                {listing.zones.map((z: string) => (
                  <span key={z} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                    📍 {z}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {site?.description && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">À propos</p>
              <p className="text-gray-600 text-sm leading-relaxed">{site.description}</p>
            </div>
          )}

          {/* Prestations */}
          {offers.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-3">Prestations</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {offers.slice(0, 4).map((o: any) => (
                  <div key={o.id} className="border rounded-lg p-3">
                    <p className="font-medium text-gray-800 text-sm">{o.name}</p>
                    <div className="flex gap-2 mt-1.5">
                      {o.duration_min && <span className="text-xs text-gray-500">{o.duration_min} min</span>}
                      {o.price_eur && <span className="text-xs text-indigo-600 font-medium">{o.price_eur} €</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Link
              href={`/${slug}`}
              className="flex-1 bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-center hover:bg-indigo-800 transition-colors"
            >
              Voir le site complet →
            </Link>
            {listing.accepts_booking && (
              <Link
                href={`/${slug}#contact`}
                className="flex-1 border border-indigo-300 text-indigo-700 font-semibold px-6 py-3 rounded-xl text-center hover:bg-indigo-50 transition-colors"
              >
                Prendre RDV
              </Link>
            )}
          </div>
        </div>

        {/* Témoignages */}
        {testimonials.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Avis clients</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {testimonials.slice(0, 4).map((t: any) => (
                <div key={t.id} className="border rounded-xl p-4 bg-white shadow-sm">
                  <div className="flex mb-2">
                    {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                      <span key={i} className="text-yellow-400 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 italic">"{t.content}"</p>
                  <p className="text-xs text-gray-400 mt-2 font-medium">{t.author_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
