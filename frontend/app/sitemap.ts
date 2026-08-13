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

async function getListedDirectorySlugs(): Promise<{ metier: string; ville: string; slug: string }[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/directory-slugs`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.slugs ?? [];
  } catch {
    return [];
  }
}

async function getDbBlogPosts(): Promise<{ slug: string; lang: string; published_at: string }[]> {
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
    ...dbBlogPosts.map((a) => ({
      url: `${APP_URL}${blogPathFor(a.lang, a.slug)}`,
      lastModified: new Date(a.published_at),
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

  // SEO programmatique — site-internet-pour/{metier}
  const sipMetierPages: MetadataRoute.Sitemap = metiers.map((m) => ({
    url: `${APP_URL}/site-internet-pour/${m.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // SEO programmatique — site-internet-pour/{metier}/{ville}  (800 pages)
  const sipPages: MetadataRoute.Sitemap = metiers.flatMap((m) =>
    villes.map((v) => ({
      url: `${APP_URL}/site-internet-pour/${m.slug}/${v.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }))
  );

  // Annuaire — {metier}/{ville}  — uniquement les combos avec au moins une fiche réelle
  const annuaireCombosWithContent = new Set(directorySlugs.map(({ metier, ville }) => `${metier}/${ville}`));
  const annuairePages: MetadataRoute.Sitemap = [...annuaireCombosWithContent].map((key) => {
    const [metier, ville] = key.split("/");
    return {
      url: `${APP_URL}/annuaire/${metier}/${ville}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  // Fiches pros listées dans l'annuaire
  const fichePages: MetadataRoute.Sitemap = directorySlugs.map(({ metier, ville, slug }) => ({
    url: `${APP_URL}/annuaire/${metier}/${ville}/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  // Pages listing pour les villes hors villes.json (ex: Arlon, Heidelberg…)
  // On dédoublonne par {metier, ville} et on exclut les combos déjà couverts par annuairePages
  const villesSlugsConnus = new Set(villes.map((v) => v.slug));
  const extraListingKeys = new Set<string>();
  const extraListingPages: MetadataRoute.Sitemap = [];
  for (const { metier, ville } of directorySlugs) {
    const key = `${metier}/${ville}`;
    if (!villesSlugsConnus.has(ville) && !extraListingKeys.has(key)) {
      extraListingKeys.add(key);
      extraListingPages.push({
        url: `${APP_URL}/annuaire/${metier}/${ville}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    }
  }

  return [
    ...staticPages,
    ...blogPages,
    ...tenantPages,
    ...sipMetierPages,
    ...sipPages,
    ...annuairePages,
    ...extraListingPages,
    ...fichePages,
  ];
}
