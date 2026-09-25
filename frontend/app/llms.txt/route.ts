import metiers from "../../data/metiers.json";
import villes from "../../data/villes.json";
import { ARTICLES } from "../blog/_articles";

export const revalidate = 3600;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface DbArticle {
  slug: string;
  title: string;
  description: string;
  published_at: string;
}

async function getFrArticles(): Promise<DbArticle[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/blog?lang=fr`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function GET() {
  const dbArticles = await getFrArticles();
  const dbSlugs = new Set(dbArticles.map((a) => a.slug));

  // Fallback : anciens articles statiques pas (encore) migrés en base
  const staticArticles: DbArticle[] = ARTICLES.filter((a) => !dbSlugs.has(a.slug)).map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    published_at: a.publishedAt,
  }));

  const allArticles = [...dbArticles, ...staticArticles].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  const metierLines = metiers
    .map((m) => `- [Site internet pour ${m.label.toLowerCase()}](${APP_URL}/site-internet-pour/${m.slug}): ${m.description}`)
    .join("\n");

  // Lien vers le miroir markdown brut (.md) plutôt que la page HTML — voir
  // app/api/blog-markdown/route.ts + la réécriture dans proxy.ts
  const articleLines = allArticles.length
    ? allArticles.map((a) => `- [${a.title}](${APP_URL}/blog/${a.slug}.md): ${a.description}`).join("\n")
    : "- (aucun article publié pour le moment)";

  const villeExamples = villes.slice(0, 6).map((v) => v.label).join(", ");

  const body = `# Klientys

> SaaS tout-en-un pour indépendants et TPE (kinés, infirmiers, artisans, coachs…). Crée un site vitrine SEO, un système de réservation en ligne, un CRM léger, des agents IA de communication, et des analytics de demande locale.

Klientys permet à chaque professionnel indépendant de créer son site internet en 15 minutes, d'activer la prise de rendez-vous en ligne, de gérer ses clients et d'automatiser sa communication — sans dépendre des plateformes intermédiaires (Doctolib, Habitatpresto, Superprof).

Tarif : dès 29,90 €/mois, essai gratuit 14 jours sans carte bancaire.

Fondé en Belgique. Cible principale : France et Belgique.

## Pages principales

- [Accueil](${APP_URL}/): Présentation, tarifs, témoignages, FAQ
- [Blog](${APP_URL}/blog): Guides pratiques pour indépendants et TPE, multilingue (fr/en/de/nl)
- [Annuaire](${APP_URL}/annuaire): Annuaire public des professionnels inscrits sur Klientys, cherchable par métier et par ville
- [Sites par métier](${APP_URL}/site-internet-pour): Pages dédiées par métier et par ville (ex: ${villeExamples}…)

## Métiers couverts (une page dédiée par métier × par ville, ex. ${APP_URL}/site-internet-pour/kinesitherapeute/lyon)

${metierLines}

## Articles de blog

${articleLines}

## Notes pour les agents IA

- Le contenu de l'annuaire (${APP_URL}/annuaire) et des sites de professionnels (${APP_URL}/{slug}) est généré par les utilisateurs de Klientys et évolue en continu — non listé ici de façon exhaustive.
- Plan complet et à jour de toutes les URLs (sites publiés, fiches annuaire, pages métier×ville) : ${APP_URL}/sitemap.xml.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
