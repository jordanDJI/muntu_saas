import type { MetadataRoute } from "next";
import metiers from "../data/metiers.json";
import villes from "../data/villes.json";
import { ARTICLES } from "./blog/_articles";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

async function getPublishedSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/published-slugs`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.slugs ?? [];
  } catch {
    return [];
  }
}

interface DirectorySlug {
  metier: string;
  ville: string;
  slug: string;
  updatedAt: string | null;
}

async function getListedDirectorySlugs(): Promise<DirectorySlug[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/directory-slugs`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.slugs ?? []).map((s: { metier: string; ville: string; slug: string; updated_at?: string | null }) => ({
      metier: s.metier,
      ville: s.ville,
      slug: s.slug,
      updatedAt: s.updated_at ?? null,
    }));
  } catch {
    return [];
  }
}

// La plus récente date parmi un groupe de fiches — undefined si aucune n'est connue
// (Next.js omet alors <lastmod> plutôt que d'afficher une fausse date de fraîcheur)
function latestDate(dates: (string | null)[]): Date | undefined {
  const timestamps = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
  return timestamps.length ? new Date(Math.max(...timestamps)) : undefined;
}

async function getDbBlogPosts(): Promise<{ slug: string; lang: string; published_at: string | null }[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/blog-all-langs`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function blogPathFor(lang: string, slug: string) {
  return lang === "fr" ? `/blog/${slug}` : `/blog/${lang}/${slug}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [publishedSlugs, directorySlugs, dbBlogPosts] = await Promise.all([
    getPublishedSlugs(),
    getListedDirectorySlugs(),
    getDbBlogPosts(),
  ]);

  const now = new Date();

  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    { url: APP_URL,                            lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${APP_URL}/annuaire`,              lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${APP_URL}/site-internet-pour`,    lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/blog`,                  lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
  ];

  // Articles de blog — DB (source de vérité, toutes langues confondues, inclut ceux
  // créés via /admin/content, l'agent de contenu automatisé ou le bouton "Traduire")
  // + fallback statique (fr) pour les slugs qui n'y seraient pas
  const dbBlogKeys = new Set(dbBlogPosts.map((a) => `${a.lang}/${a.slug}`));
  const blogPages: MetadataRoute.Sitemap = [
    // published_at peut être null en base (bug de saisie côté /admin/content) — new
    // Date(null) vaudrait 1970-01-01, une fausse date de fraîcheur pire que pas de date
    ...dbBlogPosts.map((a) => ({
      url: `${APP_URL}${blogPathFor(a.lang, a.slug)}`,
      lastModified: a.published_at ? new Date(a.published_at) : undefined,
      changeFrequency: "monthly" as const,
      priority: a.lang === "fr" ? 0.75 : 0.65,
    })),
    ...ARTICLES.filter((a) => !dbBlogKeys.has(`fr/${a.slug}`)).map((a) => ({
      url: `${APP_URL}/blog/${a.slug}`,
      lastModified: new Date(a.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];

  // Sites publiés des tenants
  const tenantPages: MetadataRoute.Sitemap = publishedSlugs.map((slug) => ({
    url: `${APP_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // SEO programmatique — site-internet-pour/{metier} — pages purement statiques
  // (contenu piloté par metiers.json, pas de signal de modification réel par page :
  // pas de lastModified plutôt qu'une fausse date "aujourd'hui" à chaque build)
  const sipMetierPages: MetadataRoute.Sitemap = metiers.map((m) => ({
    url: `${APP_URL}/site-internet-pour/${m.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // SEO programmatique — site-internet-pour/{metier}/{ville}  (800+ pages)
  const sipPages: MetadataRoute.Sitemap = metiers.flatMap((m) =>
    villes.map((v) => ({
      url: `${APP_URL}/site-internet-pour/${m.slug}/${v.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }))
  );

  // Annuaire — {metier}/{ville}  — uniquement les combos avec au moins une fiche réelle,
  // datées sur la fiche la plus récemment modifiée du groupe (directory_listing.updated_at)
  const annuaireGroups = new Map<string, (string | null)[]>();
  for (const { metier, ville, updatedAt } of directorySlugs) {
    const key = `${metier}/${ville}`;
    if (!annuaireGroups.has(key)) annuaireGroups.set(key, []);
    annuaireGroups.get(key)!.push(updatedAt);
  }
  const annuairePages: MetadataRoute.Sitemap = [...annuaireGroups.entries()].map(([key, dates]) => {
    const [metier, ville] = key.split("/");
    return {
      url: `${APP_URL}/annuaire/${metier}/${ville}`,
      lastModified: latestDate(dates),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  // Fiches pros listées dans l'annuaire
  const fichePages: MetadataRoute.Sitemap = directorySlugs.map(({ metier, ville, slug, updatedAt }) => ({
    url: `${APP_URL}/annuaire/${metier}/${ville}/${slug}`,
    lastModified: updatedAt ? new Date(updatedAt) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  // Pages listing pour les villes hors villes.json (ex: Arlon, Heidelberg…)
  // On dédoublonne par {metier, ville} et on exclut les combos déjà couverts par annuairePages
  const villesSlugsConnus = new Set(villes.map((v) => v.slug));
  const extraListingGroups = new Map<string, (string | null)[]>();
  for (const { metier, ville, updatedAt } of directorySlugs) {
    if (villesSlugsConnus.has(ville)) continue;
    const key = `${metier}/${ville}`;
    if (!extraListingGroups.has(key)) extraListingGroups.set(key, []);
    extraListingGroups.get(key)!.push(updatedAt);
  }
  const extraListingPages: MetadataRoute.Sitemap = [...extraListingGroups.entries()].map(([key, dates]) => {
    const [metier, ville] = key.split("/");
    return {
      url: `${APP_URL}/annuaire/${metier}/${ville}`,
      lastModified: latestDate(dates),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  // Annuaire — /annuaire/ville/{ville} (hub tous métiers d'une ville) —
  // uniquement les villes ayant au moins une fiche réelle, toutes confondues
  const villeGroups = new Map<string, (string | null)[]>();
  for (const { ville, updatedAt } of directorySlugs) {
    if (!villeGroups.has(ville)) villeGroups.set(ville, []);
    villeGroups.get(ville)!.push(updatedAt);
  }
  const villeHubPages: MetadataRoute.Sitemap = [...villeGroups.entries()].map(([ville, dates]) => ({
    url: `${APP_URL}/annuaire/ville/${ville}`,
    lastModified: latestDate(dates),
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  return [
    ...staticPages,
    ...blogPages,
    ...tenantPages,
    ...sipMetierPages,
    ...sipPages,
    ...annuairePages,
    ...extraListingPages,
    ...villeHubPages,
    ...fichePages,
  ];
}
